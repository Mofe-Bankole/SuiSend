/// Core payment lifecycle module for SuiSend.
///
/// Manages the three phases of a payment:
///   1. CREATE — sender deposits SUI into a yield protocol (via `yield::deposit`)
///      and a `PaymentRecord` is stored in the shared `PaymentBook`. The sender
///      receives a `PaymentVoucher` as proof.
///   2. CLAIM — whoever holds the claim link (identified by `link_hash`) can
///      redeem the funds + accrued yield. A `ClaimReceipt` is transferred to
///      the recipient.
///   3. REFUND — before expiry the sender can refund using their voucher;
///      after expiry the off-chain agent (holding `RefundAgentCap`) can trigger
///      the refund. All yield earned is returned to the sender.
///
/// ## Object model
/// - `PaymentBook` (shared singleton) — registry of all active payments
/// - `PaymentVoucher` (owned by sender) — proof-of-sender for manual refunds
/// - `ClaimReceipt` (owned by recipient) — on-chain proof of claim
/// - `AdminCap` (owned by deployer) — upgrade gating and admin functions
/// - `RefundAgentCap` (owned by off-chain agent) — auto-refund authority
/// - `YieldRouterCap` (owned by off-chain agent) — yield rebalancing authority
///
/// ## Dependencies
/// - `suisend::yield` — deposit/withdraw abstraction. The core module never
///   holds SUI directly; all funds flow through the yield vault.
module suisend::core {
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use sui::dynamic_field as df;
    use sui::event;
    use sui::object::{Self, ID, UID};
    use std::option::{Self, Option};
    use sui::sui::SUI;
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use suisend::yield;
    use suisend::yield::YieldVault;

    use protocol::market::Market;
    use protocol::version::Version;

    use suisend::yield_scallop;
    use suisend::yield_scallop::ScallopYieldVault;
    use suisend::yield_scallop::ScallopYieldVaultGeneric;

    // ─── Constants ───────────────────────────────────────────────────────────

    /// Maximum lockup period: 30 days in milliseconds.
    /// 30 * 24 * 3600 * 1000 = 2,592,000,000 ms.
    /// The `expiry_offset_ms` parameter in `create_payment` is capped at this
    /// value to prevent senders from locking funds forever.
    const MAX_LOCKUP_MS: u64 = 2_592_000_000;

    /// Minimum lockup: 60 seconds in milliseconds.
    /// Prevents accidentally setting a zero-second lockup (which would make
    /// the payment instantly refundable by the agent).
    const MIN_LOCKUP_MS: u64 = 60_000;

    // ─── Payment states ─────────────────────────────────────────────────────

    /// Payment is active — funds are in the yield protocol, not yet claimed.
    const STATE_ACTIVE: u8 = 0;

    /// Payment has been claimed by the recipient.
    const STATE_CLAIMED: u8 = 1;

    /// Payment has been refunded to the sender.
    const STATE_REFUNDED: u8 = 2;

    // ─── Error codes ─────────────────────────────────────────────────────────

    /// The caller is not authorized for this action.
    const EUnauthorized: u64 = 1;

    /// The payment is not in the expected state (e.g., trying to claim an
    /// already-claimed payment).
    const EWrongState: u64 = 2;

    /// The payment has not expired yet, so the agent cannot refund it.
    const ENotYetExpired: u64 = 3;

    /// The provided link_hash does not match any active payment.
    const ELinkHashNotFound: u64 = 4;

    /// A payment with this link_hash already exists (hash collision).
    const ELinkHashAlreadyExists: u64 = 5;

    /// The expiry offset is invalid (below minimum or above maximum).
    const EInvalidExpiry: u64 = 6;

    /// The YieldRouterCap does not authorize this rebalance.
    const EUnauthorizedRebalance: u64 = 7;

    // ─── Objects ─────────────────────────────────────────────────────────────

    /// Shared registry of all active payments.
    ///
    /// This is a singleton shared object created in `init`. Every payment is
    /// stored as a `PaymentRecord` in the `payments` table, keyed by the
    /// 32-byte `link_hash` from the claim URL.
    ///
    /// ## Why shared?
    /// Claim and refund operations need to look up payments by link_hash.
    /// If `PaymentRecord` were an owned object, only the owner could modify
    /// it. By using a shared table, anyone who knows the link_hash can
    /// initiate a claim or (if authorized) a refund.
    public struct PaymentBook has key {
        id: UID,
        /// Table mapping link_hash → PaymentRecord.
        /// The link_hash is a random 32-byte value from the claim URL.
        payments: Table<vector<u8>, PaymentRecord>,
    }

    /// A record of an individual payment stored in the PaymentBook.
    ///
    /// This is NOT an Object itself (no `key` ability). It lives inside the
    /// shared `PaymentBook`'s table. When the payment is claimed or refunded,
    /// the record is removed from the table.
    public struct PaymentRecord has store, drop {
        /// Counterparty-facing: unique 32-byte hash embedded in the claim URL.
        /// This is what the recipient presents to prove they know the link.
        link_hash: vector<u8>,
        /// Address of the sender who created the payment.
        sender: address,
        /// Amount of SUI originally deposited (in MIST).
        /// This does NOT include yield — the yield is held by the protocol.
        amount: u64,
        /// ID of the position in the yield protocol (from `yield::deposit`).
        position_id: ID,
        /// Protocol identifier (0 = Mock, 1 = Scallop, etc.).
        protocol: u8,
        /// Timestamp when the payment was created (ms since epoch).
        created_at: u64,
        /// Timestamp after which the sender/agent can refund (ms since epoch).
        expiry: u64,
        /// Current state: ACTIVE | CLAIMED | REFUNDED.
        state: u8,
        /// Optional Walrus blob ID (raw bytes) for the sender's note.
        /// Upload the note to Walrus off-chain, store the blob ID here.
        note_blob_id: Option<vector<u8>>,
        /// Address of the recipient — set when the payment is claimed.
        /// `None` while the payment is active and unclaimed.
        recipient: Option<address>,
    }

    /// Lightweight voucher the sender receives when creating a payment.
    ///
    /// The sender holds this object in their wallet. To manually refund a
    /// payment before expiry, the sender presents this voucher in the
    /// transaction. The voucher is burned (deleted) on refund.
    ///
    /// ## Why not just check sender in the record?
    /// The PaymentRecord is in a shared table; the `sender` field is publicly
    /// readable. But to refund, we need proof that the transaction signer IS
    /// the sender. The voucher is a capability-like object that proves
    /// ownership — only the original sender has it in their wallet.
    public struct PaymentVoucher has key, store {
        id: UID,
        /// Address of the sender who created the payment.
        sender: address,
        /// Link_hash identifying the payment this voucher controls.
        link_hash: vector<u8>,
    }

    /// Proof-of-claim receipt transferred to the recipient on successful claim.
    ///
    /// The frontend reads this object to display "You claimed X SUI + Y SUI
    /// in yield" in the recipient's transaction history.
    public struct ClaimReceipt has key, store {
        id: UID,
        /// The link_hash that was claimed.
        payment_link_hash: vector<u8>,
        /// Original amount deposited (without yield).
        original_amount: u64,
        /// Yield earned while the payment was unclaimed.
        yield_earned: u64,
        /// Total claimed = original_amount + yield_earned.
        total_claimed: u64,
        /// Timestamp when the claim happened (ms since epoch).
        claimed_at: u64,
        /// Address that received the funds.
        recipient: address,
    }

    // ─── Capabilities ────────────────────────────────────────────────────────

    /// Admin capability — controls upgrade, pause, and agent key management.
    ///
    /// Initially held by the deployer. During the hackathon this stays solo.
    /// Before mainnet, consider moving to a multi-sig.
    public struct AdminCap has key, store { id: UID }

    /// Authorizes the off-chain agent to call `refund_expired`.
    ///
    /// Without this cap, no one can refund an expired payment except the
    /// original sender (via `refund_sender`). The agent's address is set at
    /// deploy time and can be rotated by the admin.
    public struct RefundAgentCap has key, store { id: UID, agent: address }

    /// Authorizes the off-chain agent to rebalance yield positions across
    /// different protocols (e.g., move funds from Scallop to Navi when
    /// Navi offers a better APY).
    public struct YieldRouterCap has key, store { id: UID, agent: address }

    // ─── Events ──────────────────────────────────────────────────────────────

    /// Emitted when a new payment is created.
    public struct PaymentCreatedEvent has copy, drop {
        /// Link hash that identifies this payment.
        link_hash: vector<u8>,
        /// Address of the sender.
        sender: address,
        /// Amount deposited (in MIST for SUI, 10^6 for USDC).
        amount: u64,
        /// Protocol the funds were deposited into.
        protocol: u8,
        /// Timestamp of creation.
        created_at: u64,
        /// Timestamp when the payment expires.
        expiry: u64,
    }

    /// Emitted when a payment is successfully claimed.
    public struct PaymentClaimedEvent has copy, drop {
        /// Link hash of the claimed payment.
        link_hash: vector<u8>,
        /// Address of the recipient.
        recipient: address,
        /// Original deposit amount.
        amount: u64,
        /// Yield earned during the lockup period.
        yield_earned: u64,
        /// Timestamp of the claim.
        claimed_at: u64,
    }

    /// Emitted when a payment is refunded (either by sender or agent).
    public struct PaymentRefundedEvent has copy, drop {
        /// Link hash of the refunded payment.
        link_hash: vector<u8>,
        /// Address of the sender who received the refund.
        sender: address,
        /// Original deposit amount returned.
        amount: u64,
        /// Yield earned that was returned with the principal.
        yield_earned: u64,
        /// Timestamp of the refund.
        refunded_at: u64,
        /// Who initiated the refund: "sender" or "agent".
        initiator: vector<u8>,
    }

    // ─── Initialization ──────────────────────────────────────────────────────

    /// Package initializer — runs once at publish time.
    ///
    /// Creates:
    /// 1. The shared `PaymentBook` singleton (empty table).
    /// 2. An `AdminCap` transferred to the deployer.
    /// 3. A `RefundAgentCap` transferred to the deployer (the deployer can
    ///    later transfer it to the off-chain agent's address).
    /// 4. A `YieldRouterCap` transferred to the deployer (same pattern).
    fun init(ctx: &mut TxContext) {
        // Create the shared PaymentBook with an empty payments table.
        let book = PaymentBook {
            id: object::new(ctx),
            payments: table::new(ctx),
        };
        transfer::share_object(book);

        // Admin capability — deployer gets full control.
        transfer::transfer(
            AdminCap { id: object::new(ctx) },
            tx_context::sender(ctx),
        );

        // Agent capabilities — deployer holds initially, will transfer
        // to the agent's address after deploy.
        transfer::transfer(
            RefundAgentCap {
                id: object::new(ctx),
                agent: tx_context::sender(ctx),
            },
            tx_context::sender(ctx),
        );
        transfer::transfer(
            YieldRouterCap {
                id: object::new(ctx),
                agent: tx_context::sender(ctx),
            },
            tx_context::sender(ctx),
        );
    }

    /// Test-only wrapper so core_tests can initialize the module.
    #[test_only]
    public(package) fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    // ─── Payment lifecycle: CREATE ──────────────────────────────────────────

    /// Create a new payment link.
    ///
    /// Deposits the sender's SUI into the yield protocol and records the
    /// payment in the shared `PaymentBook`. The sender receives a
    /// `PaymentVoucher` that lets them manually refund before expiry.
    ///
    /// ## Parameters
    /// - `book`: Shared PaymentBook (must be &mut to insert a record).
    /// - `vault`: Shared YieldVault from the yield module.
    /// - `coin`: The SUI coin the sender wants to deposit. Consumed.
    /// - `link_hash`: 32-byte unique identifier for the claim URL. The sender
    ///   generates this off-chain (crypto random). Must not collide with any
    ///   existing link_hash in the PaymentBook.
    /// - `note_blob_id`: Optional Walrus blob ID (raw bytes) for a text note
    ///   from the sender. Upload the note to Walrus off-chain, then pass the
    ///   blob ID here. Pass `option::none()` if no note.
    /// - `expiry_offset_ms`: How long (in ms) the payment stays active before
    ///   refund is allowed. The frontend typically passes 30 days.
    /// - `protocol`: Which yield protocol to deposit into.
    /// - `clock`: Sui Clock for timestamps.
    /// - `ctx`: Transaction context.
    ///
    /// ## Aborts
    /// - `ELinkHashAlreadyExists` if the link_hash is already in the table.
    /// - `EInvalidExpiry` if expiry_offset_ms is < MIN_LOCKUP_MS.
    public entry fun create_payment(
        book: &mut PaymentBook,
        vault: &mut YieldVault,
        coin: Coin<SUI>,
        link_hash: vector<u8>,
        note_blob_id: Option<vector<u8>>,
        expiry_offset_ms: u64,
        protocol: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Ensure the link_hash doesn't collide with an existing payment.
        // Each payment must have a unique link_hash.
        assert!(!table::contains(&book.payments, link_hash), ELinkHashAlreadyExists);

        // Validate and cap the expiry offset.
        // Minimum 60 seconds prevents instant-expiry payments.
        assert!(expiry_offset_ms >= MIN_LOCKUP_MS, EInvalidExpiry);
        let actual_expiry_offset = if (expiry_offset_ms > MAX_LOCKUP_MS) {
            MAX_LOCKUP_MS
        } else {
            expiry_offset_ms
        };

        // Record the SUI amount BEFORE the coin is consumed by yield::deposit.
        let amount = coin.value();

        // Deposit the SUI into the yield protocol. This consumes the coin
        // and returns a position_id we store in the payment record.
        let position_id = yield::deposit(vault, coin, protocol, clock, ctx);

        // Current timestamp used for both created_at and expiry calculation.
        let now = clock.timestamp_ms();

        // Build and store the PaymentRecord, keyed by link_hash.
        table::add(&mut book.payments, link_hash, PaymentRecord {
            link_hash: copy link_hash,
            sender: tx_context::sender(ctx),
            amount,
            position_id,
            protocol,
            created_at: now,
            expiry: now + actual_expiry_offset,
            state: STATE_ACTIVE,
            note_blob_id,
            recipient: option::none(),
        });

        // Create a PaymentVoucher and transfer it to the sender.
        // This voucher is needed for manual refunds before expiry.
        let voucher = PaymentVoucher {
            id: object::new(ctx),
            sender: tx_context::sender(ctx),
            link_hash,
        };
        transfer::public_transfer(voucher, tx_context::sender(ctx));

        // Emit an event for the off-chain indexer.
        event::emit(PaymentCreatedEvent {
            link_hash: copy link_hash,
            sender: tx_context::sender(ctx),
            amount,
            protocol,
            created_at: now,
            expiry: now + actual_expiry_offset,
        });
    }

    // ─── Payment lifecycle: CLAIM ───────────────────────────────────────────

    /// Claim a payment and receive the deposited SUI plus all accrued yield.
    ///
    /// The caller must provide the `link_hash` from the claim URL. The funds
    /// are withdrawn from the yield protocol and transferred to the caller.
    /// A `ClaimReceipt` is created as proof of claim.
    ///
    /// ## Who can claim?
    /// Anyone who knows the link_hash can claim — the caller is the recipient.
    /// In practice, the sender shares the URL with the intended recipient.
    /// For zkLogin flows, the recipient authenticates via OAuth and the
    /// frontend constructs the transaction.
    ///
    /// ## Parameters
    /// - `book`: Shared PaymentBook (must be &mut to remove the record).
    /// - `vault`: Shared YieldVault from the yield module.
    /// - `link_hash`: The 32-byte identifier from the claim URL.
    /// - `clock`: Sui Clock for timestamps.
    /// - `ctx`: Transaction context.
    ///
    /// ## Aborts
    /// - `ELinkHashNotFound` if the link_hash is not in the PaymentBook.
    /// - `EWrongState` if the payment is not in STATE_ACTIVE.
    public entry fun claim_payment(
        book: &mut PaymentBook,
        vault: &mut YieldVault,
        link_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Look up and remove the PaymentRecord from the table.
        // Aborts if not found (ELinkHashNotFound).
        let record = table::remove(&mut book.payments, link_hash);

        // Verify the payment is still active (not already claimed/refunded).
        assert!(record.state == STATE_ACTIVE, EWrongState);

        // Record who is claiming — the transaction signer is the recipient.
        let recipient = tx_context::sender(ctx);

        // Withdraw the principal + accrued yield from the vault.
        // This consumes the position_id and returns a Coin<SUI>.
        let coin = yield::withdraw(vault, record.position_id, clock, ctx);

        // Calculate the yield earned: total withdrawn minus original deposit.
        let total_value = coin.value();
        let yield_earned = total_value - record.amount;

        // Transfer the full amount (principal + yield) to the recipient.
        transfer::public_transfer(coin, recipient);

        // Create a ClaimReceipt as proof of claim.
        let receipt = ClaimReceipt {
            id: object::new(ctx),
            payment_link_hash: link_hash,
            original_amount: record.amount,
            yield_earned,
            total_claimed: total_value,
            claimed_at: clock.timestamp_ms(),
            recipient,
        };
        transfer::public_transfer(receipt, recipient);

        // Emit a claim event for the off-chain indexer.
        event::emit(PaymentClaimedEvent {
            link_hash,
            recipient,
            amount: record.amount,
            yield_earned,
            claimed_at: clock.timestamp_ms(),
        });
        // PaymentRecord drops here because it has `drop`.
    }

    // ─── Payment lifecycle: REFUND (by sender via voucher) ──────────────────

    /// Refund a payment before expiry.
    ///
    /// Only the original sender can call this — their `PaymentVoucher` is
    /// required as proof of identity. The voucher is burned in the process.
    ///
    /// The sender receives the full principal + all yield earned so far.
    ///
    /// ## Parameters
    /// - `book`: Shared PaymentBook.
    /// - `vault`: Shared YieldVault.
    /// - `voucher`: The sender's PaymentVoucher. Burned on success.
    /// - `clock`: Sui Clock for timestamps.
    /// - `ctx`: Transaction context.
    ///
    /// ## Aborts
    /// - `EUnauthorized` if the caller is not the voucher's sender.
    /// - `ELinkHashNotFound` if the payment no longer exists.
    /// - `EWrongState` if the payment is not active.
    public entry fun refund_sender(
        book: &mut PaymentBook,
        vault: &mut YieldVault,
        voucher: PaymentVoucher,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Verify the caller is the sender who received the voucher.
        assert!(voucher.sender == tx_context::sender(ctx), EUnauthorized);

        // Extract the link_hash from the voucher before burning it.
        let link_hash = voucher.link_hash;

        // Burn the voucher — it can only be used once.
        let PaymentVoucher { id: voucher_id, sender: _, link_hash: _ } = voucher;
        object::delete(voucher_id);

        // Look up and remove the PaymentRecord.
        let record = table::remove(&mut book.payments, link_hash);

        // Verify the payment is still active.
        assert!(record.state == STATE_ACTIVE, EWrongState);

        // Withdraw principal + yield from the vault.
        let coin = yield::withdraw(vault, record.position_id, clock, ctx);
        let total_value = coin.value();
        let yield_earned = total_value - record.amount;

        // Send all funds back to the recorded sender.
        transfer::public_transfer(coin, record.sender);

        // Emit a refund event.
        event::emit(PaymentRefundedEvent {
            link_hash,
            sender: record.sender,
            amount: record.amount,
            yield_earned,
            refunded_at: clock.timestamp_ms(),
            initiator: b"sender",
        });
        // PaymentRecord drops here.
    }

    // ─── Payment lifecycle: REFUND (by agent after expiry) ──────────────────

    /// Refund an expired payment (agent-initiated).
    ///
    /// Called by the off-chain agent (scanning for expired payments). The
    /// agent must hold the `RefundAgentCap` to authorize this call.
    ///
    /// The sender receives the full principal + all yield earned.
    ///
    /// ## Parameters
    /// - `book`: Shared PaymentBook.
    /// - `vault`: Shared YieldVault.
    /// - `link_hash`: The payment's link hash.
    /// - `cap`: The RefundAgentCap proving the caller is the authorized agent.
    /// - `clock`: Sui Clock for checking expiry.
    /// - `ctx`: Transaction context.
    ///
    /// ## Aborts
    /// - `EUnauthorized` if the caller is not the agent address in the cap.
    /// - `ENotYetExpired` if the payment's expiry hasn't been reached.
    /// - `ELinkHashNotFound` if the payment doesn't exist.
    /// - `EWrongState` if the payment is not active.
    public entry fun refund_expired(
        book: &mut PaymentBook,
        vault: &mut YieldVault,
        link_hash: vector<u8>,
        cap: &RefundAgentCap,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Verify the caller is the authorized agent.
        assert!(cap.agent == tx_context::sender(ctx), EUnauthorized);

        // Look up the payment record.
        let record = table::remove(&mut book.payments, link_hash);

        // Verify the payment is still active.
        assert!(record.state == STATE_ACTIVE, EWrongState);

        // Verify the payment has expired.
        let now = clock.timestamp_ms();
        assert!(now >= record.expiry, ENotYetExpired);

        // Withdraw principal + yield.
        let coin = yield::withdraw(vault, record.position_id, clock, ctx);
        let total_value = coin.value();
        let yield_earned = total_value - record.amount;

        // Send all funds back to the sender.
        transfer::public_transfer(coin, record.sender);

        // Emit a refund event.
        event::emit(PaymentRefundedEvent {
            link_hash,
            sender: record.sender,
            amount: record.amount,
            yield_earned,
            refunded_at: now,
            initiator: b"agent",
        });
        // PaymentRecord drops here.
    }

    // ─── Admin functions ────────────────────────────────────────────────────

    /// Rotate the agent address for the RefundAgentCap.
    ///
    /// Only the AdminCap holder can call this. The new agent address receives
    /// the refund capability. Use when the off-chain agent's key is rotated.
    public entry fun rotate_refund_agent(
        _: &AdminCap,
        cap: &mut RefundAgentCap,
        new_agent: address,
    ) {
        cap.agent = new_agent;
    }

    /// Rotate the agent address for the YieldRouterCap.
    public entry fun rotate_yield_router(
        _: &AdminCap,
        cap: &mut YieldRouterCap,
        new_agent: address,
    ) {
        cap.agent = new_agent;
    }

    // ─── Read-only query functions ──────────────────────────────────────────

    /// Check if a payment with the given link_hash exists and is active.
    public fun payment_exists(book: &PaymentBook, link_hash: vector<u8>): bool {
        table::contains(&book.payments, link_hash)
    }

    /// Get the sender address for a payment (returns @0x0 if not found).
    public fun payment_sender(book: &PaymentBook, link_hash: vector<u8>): address {
        if (table::contains(&book.payments, link_hash)) {
            table::borrow(&book.payments, link_hash).sender
        } else {
            @0x0
        }
    }

    /// Get the amount of SUI deposited for a payment.
    public fun payment_amount(book: &PaymentBook, link_hash: vector<u8>): u64 {
        if (table::contains(&book.payments, link_hash)) {
            table::borrow(&book.payments, link_hash).amount
        } else {
            0
        }
    }

    /// Get the expiry timestamp for a payment.
    public fun payment_expiry(book: &PaymentBook, link_hash: vector<u8>): u64 {
        if (table::contains(&book.payments, link_hash)) {
            table::borrow(&book.payments, link_hash).expiry
        } else {
            0
        }
    }

    /// Get the current state of a payment.
    public fun payment_state(book: &PaymentBook, link_hash: vector<u8>): u8 {
        if (table::contains(&book.payments, link_hash)) {
            table::borrow(&book.payments, link_hash).state
        } else {
            // Return CLAIMED for non-existent payments — they've been
            // removed (either claimed or refunded). This is a reasonable
            // default for frontend queries.
            STATE_CLAIMED
        }
    }

    /// Get the number of active payments in the book.
    public fun active_payment_count(book: &PaymentBook): u64 {
        table::length(&book.payments)
    }

    /// Get the coin type for a payment (0 = SUI, 1 = USDC).
    /// Defaults to 0 (SUI) for backward compatibility with existing payments.
    public fun payment_coin_type(book: &PaymentBook, link_hash: vector<u8>): u8 {
        if (df::exists_with_type<vector<u8>, u8>(&book.id, link_hash)) {
            *df::borrow<vector<u8>, u8>(&book.id, link_hash)
        } else {
            0
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SCALLOP-SPECIFIC PAYMENT FUNCTIONS
    //
    //  These are identical in logic to the mock-path functions above but
    //  operate on a `ScallopYieldVault` instead of `YieldVault`, and
    //  pass Scallop's `Version` and `Market` shared objects through to
    //  `yield_scallop::deposit_scallop` / `withdraw_scallop`.
    //
    //  Use these for mainnet deployments. The mock versions are kept
    //  for devnet/testing.
    // ═══════════════════════════════════════════════════════════════════

    /// Create a payment using Scallop's lending pool.
    ///
    /// Same as `create_payment` but uses `ScallopYieldVault` and requires
    /// Scallop's `Version` and `Market` shared objects for on-chain mint.
    public entry fun create_payment_scallop(
        book: &mut PaymentBook,
        vault: &mut ScallopYieldVault,
        coin: Coin<SUI>,
        link_hash: vector<u8>,
        note_blob_id: Option<vector<u8>>,
        expiry_offset_ms: u64,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!table::contains(&book.payments, link_hash), ELinkHashAlreadyExists);
        assert!(expiry_offset_ms >= MIN_LOCKUP_MS, EInvalidExpiry);
        let actual_expiry_offset = if (expiry_offset_ms > MAX_LOCKUP_MS) {
            MAX_LOCKUP_MS
        } else {
            expiry_offset_ms
        };

        let amount = coin.value();
        let position_id = yield_scallop::deposit_scallop(vault, coin, version, market, clock, ctx);

        let now = clock.timestamp_ms();
        table::add(&mut book.payments, link_hash, PaymentRecord {
            link_hash: copy link_hash,
            sender: tx_context::sender(ctx),
            amount,
            position_id,
            protocol: 1,
            created_at: now,
            expiry: now + actual_expiry_offset,
            state: STATE_ACTIVE,
            note_blob_id,
            recipient: option::none(),
        });

        let voucher = PaymentVoucher {
            id: object::new(ctx),
            sender: tx_context::sender(ctx),
            link_hash,
        };
        transfer::public_transfer(voucher, tx_context::sender(ctx));

        event::emit(PaymentCreatedEvent {
            link_hash: copy link_hash,
            sender: tx_context::sender(ctx),
            amount,
            protocol: 1,
            created_at: now,
            expiry: now + actual_expiry_offset,
        });
    }

    /// Claim a payment using Scallop's lending pool.
    public entry fun claim_payment_scallop(
        book: &mut PaymentBook,
        vault: &mut ScallopYieldVault,
        link_hash: vector<u8>,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let record = table::remove(&mut book.payments, link_hash);
        assert!(record.state == STATE_ACTIVE, EWrongState);

        let recipient = tx_context::sender(ctx);
        let coin = yield_scallop::withdraw_scallop(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = total_value - record.amount;

        transfer::public_transfer(coin, recipient);

        let receipt = ClaimReceipt {
            id: object::new(ctx),
            payment_link_hash: link_hash,
            original_amount: record.amount,
            yield_earned,
            total_claimed: total_value,
            claimed_at: clock.timestamp_ms(),
            recipient,
        };
        transfer::public_transfer(receipt, recipient);

        event::emit(PaymentClaimedEvent {
            link_hash,
            recipient,
            amount: record.amount,
            yield_earned,
            claimed_at: clock.timestamp_ms(),
        });
    }

    /// Refund a payment via sender voucher using Scallop's lending pool.
    public entry fun refund_sender_scallop(
        book: &mut PaymentBook,
        vault: &mut ScallopYieldVault,
        voucher: PaymentVoucher,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(voucher.sender == tx_context::sender(ctx), EUnauthorized);

        let link_hash = voucher.link_hash;
        let PaymentVoucher { id: voucher_id, sender: _, link_hash: _ } = voucher;
        object::delete(voucher_id);

        let record = table::remove(&mut book.payments, link_hash);
        assert!(record.state == STATE_ACTIVE, EWrongState);

        let coin = yield_scallop::withdraw_scallop(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = total_value - record.amount;

        transfer::public_transfer(coin, record.sender);

        event::emit(PaymentRefundedEvent {
            link_hash,
            sender: record.sender,
            amount: record.amount,
            yield_earned,
            refunded_at: clock.timestamp_ms(),
            initiator: b"sender",
        });
    }

    /// Refund an expired payment (agent-initiated) using Scallop's lending pool.
    public entry fun refund_expired_scallop(
        book: &mut PaymentBook,
        vault: &mut ScallopYieldVault,
        link_hash: vector<u8>,
        cap: &RefundAgentCap,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(cap.agent == tx_context::sender(ctx), EUnauthorized);

        let record = table::remove(&mut book.payments, link_hash);
        assert!(record.state == STATE_ACTIVE, EWrongState);

        let now = clock.timestamp_ms();
        assert!(now >= record.expiry, ENotYetExpired);

        let coin = yield_scallop::withdraw_scallop(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = total_value - record.amount;

        transfer::public_transfer(coin, record.sender);

        event::emit(PaymentRefundedEvent {
            link_hash,
            sender: record.sender,
            amount: record.amount,
            yield_earned,
            refunded_at: now,
            initiator: b"agent",
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  GENERIC PAYMENT FUNCTIONS (any coin type)
    //
    //  These functions work with ANY coin via the generic vault
    //  `ScallopYieldVaultGeneric<T>`. The frontend passes the
    //  coin type as a PTB type argument at call time — no
    //  compile-time dependency on external coin types needed.
    //
    //  ┌─ When to use ─────────────────────────────────────────┐
    //  │                                                        │
    //  │  For USDC (Wormhole), the frontend passes:             │
    //  │    typeArguments: ["0xdba346...::usdc::USDC"]          │
    //  │                                                        │
    //  │  The `coin_type` parameter distinguishes coins in      │
    //  │  events so the frontend can format amounts correctly:  │
    //  │    0 = SUI (9 decimals)                                │
    //  │    1 = USDC (6 decimals)                               │
    //  │                                                        │
    //  │  Existing SUI-specific functions (create_payment_scallop│
    //  │  etc.) are unchanged — call those for SUI payments.    │
    //  │  Call these generic functions for USDC and any future   │
    //  │  coin types.                                           │
    //  └────────────────────────────────────────────────────────┘
    // ═══════════════════════════════════════════════════════════════

    /// Create a payment for any coin type using Scallop's lending pool.
    ///
    /// Generic version of `create_payment_scallop`. Handles USDC, USDT,
    /// or any coin with a Scallop pool.
    ///
    /// ## Parameters (new vs SUI version)
    /// - `vault`: `ScallopYieldVaultGeneric<T>` instead of `ScallopYieldVault`
    /// - `coin`: `Coin<T>` instead of `Coin<SUI>`
    /// - `coin_type`: discriminator for events (0=SUI, 1=USDC, ...)
    public entry fun create_payment_generic<T>(
        book: &mut PaymentBook,
        vault: &mut ScallopYieldVaultGeneric<T>,
        coin: Coin<T>,
        link_hash: vector<u8>,
        note_blob_id: Option<vector<u8>>,
        expiry_offset_ms: u64,
        coin_type: u8,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!table::contains(&book.payments, link_hash), ELinkHashAlreadyExists);
        assert!(expiry_offset_ms >= MIN_LOCKUP_MS, EInvalidExpiry);
        let actual_expiry_offset = if (expiry_offset_ms > MAX_LOCKUP_MS) {
            MAX_LOCKUP_MS
        } else {
            expiry_offset_ms
        };

        let amount = coin.value();
        let position_id = yield_scallop::deposit_generic(vault, coin, version, market, clock, ctx);

        let now = clock.timestamp_ms();
        table::add(&mut book.payments, copy link_hash, PaymentRecord {
            link_hash: copy link_hash,
            sender: tx_context::sender(ctx),
            amount,
            position_id,
            protocol: 1,
            created_at: now,
            expiry: now + actual_expiry_offset,
            state: STATE_ACTIVE,
            note_blob_id,
            recipient: option::none(),
        });

        df::add<vector<u8>, u8>(&mut book.id, copy link_hash, coin_type);

        let voucher = PaymentVoucher {
            id: object::new(ctx),
            sender: tx_context::sender(ctx),
            link_hash: copy link_hash,
        };
        transfer::public_transfer(voucher, tx_context::sender(ctx));

        event::emit(PaymentCreatedEvent {
            link_hash,
            sender: tx_context::sender(ctx),
            amount,
            protocol: 1,
            created_at: now,
            expiry: now + actual_expiry_offset,
        });
    }

    /// Claim a payment for any coin type.
    public entry fun claim_payment_generic<T>(
        book: &mut PaymentBook,
        vault: &mut ScallopYieldVaultGeneric<T>,
        link_hash: vector<u8>,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let record = table::remove(&mut book.payments, link_hash);
        assert!(record.state == STATE_ACTIVE, EWrongState);

        let recipient = tx_context::sender(ctx);
        let coin = yield_scallop::withdraw_generic(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = total_value - record.amount;

        transfer::public_transfer(coin, recipient);

        let receipt = ClaimReceipt{
            id : object::new(ctx),
            payment_link_hash: link_hash,
            original_amount: record.amount,
            yield_earned,
            total_claimed: total_value,
            claimed_at: clock.timestamp_ms(),
            recipient,
        };
        transfer::public_transfer(receipt, recipient);

        event::emit(PaymentClaimedEvent {
            link_hash,
            recipient,
            amount: record.amount,
            yield_earned,
            claimed_at: clock.timestamp_ms(),
        });
    }

    /// Refund a payment via sender voucher (any coin type).
    public entry fun refund_sender_generic<T>(
        book: &mut PaymentBook,
        vault: &mut ScallopYieldVaultGeneric<T>,
        voucher: PaymentVoucher,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(voucher.sender == tx_context::sender(ctx), EUnauthorized);

        let link_hash = voucher.link_hash;
        let PaymentVoucher { id: voucher_id, sender: _, link_hash: _ } = voucher;
        object::delete(voucher_id);

        let record = table::remove(&mut book.payments, link_hash);
        assert!(record.state == STATE_ACTIVE, EWrongState);

        let coin = yield_scallop::withdraw_generic(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = total_value - record.amount;

        transfer::public_transfer(coin, record.sender);

        event::emit(PaymentRefundedEvent {
            link_hash,
            sender: record.sender,
            amount: record.amount,
            yield_earned,
            refunded_at: clock.timestamp_ms(),
            initiator: b"sender",
        });
    }

    /// Refund an expired payment (agent-initiated) for any coin type.
    public entry fun refund_expired_generic<T>(
        book: &mut PaymentBook,
        vault: &mut ScallopYieldVaultGeneric<T>,
        link_hash: vector<u8>,
        cap: &RefundAgentCap,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(cap.agent == tx_context::sender(ctx), EUnauthorized);

        let record = table::remove(&mut book.payments, link_hash);
        assert!(record.state == STATE_ACTIVE, EWrongState);

        let now = clock.timestamp_ms();
        assert!(now >= record.expiry, ENotYetExpired);

        let coin = yield_scallop::withdraw_generic(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = total_value - record.amount;

        transfer::public_transfer(coin, record.sender);

        event::emit(PaymentRefundedEvent {
            link_hash,
            sender: record.sender,
            amount: record.amount,
            yield_earned,
            refunded_at: now,
            initiator: b"agent",
        });
    }
}
