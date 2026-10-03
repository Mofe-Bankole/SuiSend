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
    use sui::hash;
    use sui::object::{Self, ID, UID};
    use std::option::{Self, Option};
    use sui::sui::SUI;
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

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

    // ─── Error codes ─────────────────────────────────────────────────────────

    /// The caller is not authorized for this action.
    const EUnauthorized: u64 = 1;

    /// The payment is not in the expected state (e.g., trying to claim an
    /// already-claimed payment).
    const EWrongState: u64 = 2;

    /// The payment has not expired yet, so the agent cannot refund it.
    const ENotYetExpired: u64 = 3;

    /// A payment with this link_hash already exists (hash collision).
    const ELinkHashAlreadyExists: u64 = 5;

    /// The expiry offset is invalid (below minimum or above maximum).
    const EInvalidExpiry: u64 = 6;

    /// This function has been retired in the v5 upgrade.
    const EDeprecated: u64 = 8;

    /// The payment requires a PIN but none (or an empty one) was provided.
    const EPinRequired: u64 = 9;

    /// The provided PIN preimage does not match the payment's pin_hash.
    const EPinMismatch: u64 = 10;

    /// The payment is locked to a specific recipient address and the caller
    /// is not that address.
    const ERecipientMismatch: u64 = 11;

    /// The book is paused by the admin. Creates and claims are blocked;
    /// refunds always remain possible.
    const EPaused: u64 = 12;

    /// The claim_key or pin_hash is not a valid 32-byte blake2b-256 digest.
    const EInvalidDigest: u64 = 13;

    // ─── Authorization modes (v2) ────────────────────────────────────────────

    /// Anyone who knows the claim secret can claim (like cash).
    const AUTH_BEARER: u8 = 0;

    /// Claim requires the secret + the PIN preimage (two-channel).
    const AUTH_PIN: u8 = 1;

    /// Claim is locked to a specific recipient address.
    const AUTH_LOCKED: u8 = 2;

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
    /// DEPRECATED in v5 — the mock yield path earned zero yield by design
    /// and must not accept real mainnet deposits. Retained as a hard-abort
    /// stub because the `compatible` upgrade policy forbids removing public
    /// entry functions. Use `create_payment_v2` instead.
    public entry fun create_payment(
        _book: &mut PaymentBook,
        _vault: &mut YieldVault,
        _coin: Coin<SUI>,
        _link_hash: vector<u8>,
        _note_blob_id: Option<vector<u8>>,
        _expiry_offset_ms: u64,
        _protocol: u8,
        _clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        abort EDeprecated
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
    /// DEPRECATED in v5 — see `create_payment`. Use `claim_payment_v2`.
    public entry fun claim_payment(
        _book: &mut PaymentBook,
        _vault: &mut YieldVault,
        _link_hash: vector<u8>,
        _clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        abort EDeprecated
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
    /// DEPRECATED in v5 — see `create_payment`. Use `refund_sender_v2`.
    public entry fun refund_sender(
        _book: &mut PaymentBook,
        _vault: &mut YieldVault,
        _voucher: PaymentVoucher,
        _clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        abort EDeprecated
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
    /// DEPRECATED in v5 — see `create_payment`. Use `refund_expired_v2`.
    public entry fun refund_expired(
        _book: &mut PaymentBook,
        _vault: &mut YieldVault,
        _link_hash: vector<u8>,
        _cap: &RefundAgentCap,
        _clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        abort EDeprecated
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
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

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
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

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
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

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
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

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
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

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
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

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

    // ═══════════════════════════════════════════════════════════════════
    //  V5 — PAYMENT BOOK V2
    //
    //  Fixes delivered here (see audit/):
    //  - F01: the claim secret is NEVER stored or emitted. The table key is
    //    `blake2b256(secret)`; the URL carries the secret; claims hash and
    //    compare. Events carry only the key — safe to display publicly.
    //  - F19: per-link authorization modes. Bearer (like cash), PIN
    //    (two-channel), or locked to a recipient address.
    //  - F06: no `state` field — existence in the table IS active; removal
    //    is terminal. Refunded payments no longer masquerade as claimed.
    //  - F07: `coin_type` lives IN the record. The dynamic-field hack and
    //    its storage leak are gone for v2 payments.
    //  - F05: real pause switch (`paused`) administered by AdminCap.
    //
    //  Legacy (v1) paths above remain live for existing payments until they
    //  drain by claim or refund. New payments MUST use the v2 functions.
    // ═══════════════════════════════════════════════════════════════════

    /// Shared registry of v2 payments. Separate object from the legacy
    /// PaymentBook (struct layouts cannot change under a compatible
    /// upgrade). Created once by the deployer via `init_book_v2`.
    public struct PaymentBookV2 has key {
        id: UID,
        /// blake2b256(claim_secret) → PaymentRecordV2
        payments: Table<vector<u8>, PaymentRecordV2>,
        /// Admin pause. Blocks creates and claims; refunds always allowed.
        paused: bool,
    }

    /// A v2 payment record. Note what is NOT here (vs v1): no `state`
    /// field, no `link_hash` plaintext, no dynamic-field coin type.
    public struct PaymentRecordV2 has store, drop {
        sender: address,
        amount: u64,
        position_id: ID,
        coin_type: u8,
        created_at: u64,
        expiry: u64,
        /// When set, only this address may claim (AUTH_LOCKED).
        recipient_lock: Option<address>,
        /// blake2b256(pin). When set, claim must present the PIN (AUTH_PIN).
        pin_hash: Option<vector<u8>>,
        note_blob_id: Option<vector<u8>>,
    }

    // ─── V2 events (no secret material — ever) ─────────────────────────

    public struct PaymentCreatedEventV2 has copy, drop {
        claim_key: vector<u8>,
        sender: address,
        amount: u64,
        coin_type: u8,
        auth_mode: u8,
        recipient_lock: Option<address>,
        created_at: u64,
        expiry: u64,
    }

    public struct PaymentClaimedEventV2 has copy, drop {
        claim_key: vector<u8>,
        recipient: address,
        amount: u64,
        yield_earned: u64,
        claimed_at: u64,
    }

    public struct PaymentRefundedEventV2 has copy, drop {
        claim_key: vector<u8>,
        sender: address,
        amount: u64,
        yield_earned: u64,
        refunded_at: u64,
        initiator: vector<u8>,
    }

    // ─── V2 initialization & admin ──────────────────────────────────────

    /// Create and share the v2 PaymentBook. One-time, deployer-only.
    public entry fun init_book_v2(_: &AdminCap, ctx: &mut TxContext) {
        let book = PaymentBookV2 {
            id: object::new(ctx),
            payments: table::new(ctx),
            paused: false,
        };
        transfer::share_object(book);
    }

    /// The real pause switch (F05). Refunds are NOT gated by pause — users
    /// must always be able to exit.
    public entry fun set_book_v2_paused(_: &AdminCap, book: &mut PaymentBookV2, paused: bool) {
        book.paused = paused;
    }

    /// Admin-gated generic vault creation (F09). Replaces the permissionless
    /// `init_vault_generic`, which is now a hard-abort stub.
    public entry fun admin_init_vault_generic<T>(_: &AdminCap, ctx: &mut TxContext) {
        yield_scallop::new_vault_generic<T>(ctx);
    }

    // ─── V2 authorization helper ────────────────────────────────────────

    /// Assert the caller may claim this record. Lock first, then PIN.
    /// Package-visible so tests can exercise it directly.
    public(package) fun assert_claim_authorized(
        record: &PaymentRecordV2,
        pin: &Option<vector<u8>>,
        ctx: &TxContext,
    ) {
        if (option::is_some(&record.recipient_lock)) {
            assert!(
                tx_context::sender(ctx) == *option::borrow(&record.recipient_lock),
                ERecipientMismatch,
            );
        };
        if (option::is_some(&record.pin_hash)) {
            assert!(option::is_some(pin), EPinRequired);
            let provided = hash::blake2b256(option::borrow(pin));
            assert!(provided == *option::borrow(&record.pin_hash), EPinMismatch);
        };
    }

    fun derive_auth_mode(record: &PaymentRecordV2): u8 {
        if (option::is_some(&record.recipient_lock)) {
            AUTH_LOCKED
        } else if (option::is_some(&record.pin_hash)) {
            AUTH_PIN
        } else {
            AUTH_BEARER
        }
    }

    fun validate_v2_inputs(
        book: &PaymentBookV2,
        claim_key: &vector<u8>,
        pin_hash: &Option<vector<u8>>,
        expiry_offset_ms: u64,
    ) {
        assert!(!book.paused, EPaused);
        assert!(claim_key.length() == 32, EInvalidDigest);
        assert!(!table::contains(&book.payments, *claim_key), ELinkHashAlreadyExists);
        assert!(expiry_offset_ms >= MIN_LOCKUP_MS, EInvalidExpiry);
        if (option::is_some(pin_hash)) {
            assert!(option::borrow(pin_hash).length() == 32, EInvalidDigest);
        };
    }

    fun capped_expiry(now: u64, expiry_offset_ms: u64): u64 {
        let offset = if (expiry_offset_ms > MAX_LOCKUP_MS) {
            MAX_LOCKUP_MS
        } else {
            expiry_offset_ms
        };
        now + offset
    }

    // ─── V2 lifecycle: CREATE ───────────────────────────────────────────

    /// Create a v2 payment (SUI via Scallop).
    ///
    /// `claim_key` MUST be `blake2b256(secret)` computed off-chain — the raw
    /// secret never touches the chain until the legitimate claim spends it.
    public entry fun create_payment_v2(
        book: &mut PaymentBookV2,
        vault: &mut ScallopYieldVault,
        coin: Coin<SUI>,
        claim_key: vector<u8>,
        recipient_lock: Option<address>,
        pin_hash: Option<vector<u8>>,
        note_blob_id: Option<vector<u8>>,
        expiry_offset_ms: u64,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        validate_v2_inputs(book, &claim_key, &pin_hash, expiry_offset_ms);

        let amount = coin.value();
        let position_id = yield_scallop::deposit_scallop(vault, coin, version, market, clock, ctx);
        let now = clock.timestamp_ms();

        let record = PaymentRecordV2 {
            sender: tx_context::sender(ctx),
            amount,
            position_id,
            coin_type: 0,
            created_at: now,
            expiry: capped_expiry(now, expiry_offset_ms),
            recipient_lock,
            pin_hash,
            note_blob_id,
        };
        let auth_mode = derive_auth_mode(&record);
        let expiry = record.expiry;
        table::add(&mut book.payments, claim_key, record);

        let voucher = PaymentVoucher {
            id: object::new(ctx),
            sender: tx_context::sender(ctx),
            link_hash: claim_key,
        };
        transfer::public_transfer(voucher, tx_context::sender(ctx));

        event::emit(PaymentCreatedEventV2 {
            claim_key,
            sender: tx_context::sender(ctx),
            amount,
            coin_type: 0,
            auth_mode,
            recipient_lock: option::none(),
            created_at: now,
            expiry,
        });
    }

    /// Create a v2 payment for any coin type (USDC etc.).
    public entry fun create_payment_v2_generic<T>(
        book: &mut PaymentBookV2,
        vault: &mut ScallopYieldVaultGeneric<T>,
        coin: Coin<T>,
        claim_key: vector<u8>,
        recipient_lock: Option<address>,
        pin_hash: Option<vector<u8>>,
        note_blob_id: Option<vector<u8>>,
        expiry_offset_ms: u64,
        coin_type: u8,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        validate_v2_inputs(book, &claim_key, &pin_hash, expiry_offset_ms);

        let amount = coin.value();
        let position_id = yield_scallop::deposit_generic(vault, coin, version, market, clock, ctx);
        let now = clock.timestamp_ms();

        let record = PaymentRecordV2 {
            sender: tx_context::sender(ctx),
            amount,
            position_id,
            coin_type,
            created_at: now,
            expiry: capped_expiry(now, expiry_offset_ms),
            recipient_lock,
            pin_hash,
            note_blob_id,
        };
        let auth_mode = derive_auth_mode(&record);
        let expiry = record.expiry;
        table::add(&mut book.payments, claim_key, record);

        let voucher = PaymentVoucher {
            id: object::new(ctx),
            sender: tx_context::sender(ctx),
            link_hash: claim_key,
        };
        transfer::public_transfer(voucher, tx_context::sender(ctx));

        event::emit(PaymentCreatedEventV2 {
            claim_key,
            sender: tx_context::sender(ctx),
            amount,
            coin_type,
            auth_mode,
            recipient_lock: option::none(),
            created_at: now,
            expiry,
        });
    }

    // ─── V2 lifecycle: CLAIM ────────────────────────────────────────────

    /// Claim a v2 payment. The caller presents the `secret`; the contract
    /// hashes it and looks the record up by that key. Authorization (lock
    /// and/or PIN) is enforced before any funds move — a failed assert
    /// reverts the whole transaction, so the record stays put.
    public entry fun claim_payment_v2(
        book: &mut PaymentBookV2,
        vault: &mut ScallopYieldVault,
        secret: vector<u8>,
        pin: Option<vector<u8>>,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!book.paused, EPaused);
        let claim_key = hash::blake2b256(&secret);
        let record = table::remove(&mut book.payments, claim_key);
        assert_claim_authorized(&record, &pin, ctx);

        let recipient = tx_context::sender(ctx);
        let coin = yield_scallop::withdraw_scallop(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

        transfer::public_transfer(coin, recipient);

        let receipt = ClaimReceipt {
            id: object::new(ctx),
            payment_link_hash: claim_key,
            original_amount: record.amount,
            yield_earned,
            total_claimed: total_value,
            claimed_at: clock.timestamp_ms(),
            recipient,
        };
        transfer::public_transfer(receipt, recipient);

        event::emit(PaymentClaimedEventV2 {
            claim_key,
            recipient,
            amount: record.amount,
            yield_earned,
            claimed_at: clock.timestamp_ms(),
        });
    }

    /// Claim a v2 payment for any coin type.
    public entry fun claim_payment_v2_generic<T>(
        book: &mut PaymentBookV2,
        vault: &mut ScallopYieldVaultGeneric<T>,
        secret: vector<u8>,
        pin: Option<vector<u8>>,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!book.paused, EPaused);
        let claim_key = hash::blake2b256(&secret);
        let record = table::remove(&mut book.payments, claim_key);
        assert_claim_authorized(&record, &pin, ctx);

        let recipient = tx_context::sender(ctx);
        let coin = yield_scallop::withdraw_generic(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

        transfer::public_transfer(coin, recipient);

        let receipt = ClaimReceipt {
            id: object::new(ctx),
            payment_link_hash: claim_key,
            original_amount: record.amount,
            yield_earned,
            total_claimed: total_value,
            claimed_at: clock.timestamp_ms(),
            recipient,
        };
        transfer::public_transfer(receipt, recipient);

        event::emit(PaymentClaimedEventV2 {
            claim_key,
            recipient,
            amount: record.amount,
            yield_earned,
            claimed_at: clock.timestamp_ms(),
        });
    }

    // ─── V2 lifecycle: REFUND ───────────────────────────────────────────
    // Refunds are NEVER gated by pause — exiting is always safe.

    /// Sender refunds their own unclaimed v2 payment (voucher required).
    public entry fun refund_sender_v2(
        book: &mut PaymentBookV2,
        vault: &mut ScallopYieldVault,
        voucher: PaymentVoucher,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(voucher.sender == tx_context::sender(ctx), EUnauthorized);

        let claim_key = voucher.link_hash;
        let PaymentVoucher { id: voucher_id, sender: _, link_hash: _ } = voucher;
        object::delete(voucher_id);

        let record = table::remove(&mut book.payments, claim_key);
        let coin = yield_scallop::withdraw_scallop(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

        transfer::public_transfer(coin, record.sender);

        event::emit(PaymentRefundedEventV2 {
            claim_key,
            sender: record.sender,
            amount: record.amount,
            yield_earned,
            refunded_at: clock.timestamp_ms(),
            initiator: b"sender",
        });
    }

    /// Sender refunds their own unclaimed v2 payment (any coin type).
    public entry fun refund_sender_v2_generic<T>(
        book: &mut PaymentBookV2,
        vault: &mut ScallopYieldVaultGeneric<T>,
        voucher: PaymentVoucher,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(voucher.sender == tx_context::sender(ctx), EUnauthorized);

        let claim_key = voucher.link_hash;
        let PaymentVoucher { id: voucher_id, sender: _, link_hash: _ } = voucher;
        object::delete(voucher_id);

        let record = table::remove(&mut book.payments, claim_key);
        let coin = yield_scallop::withdraw_generic(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

        transfer::public_transfer(coin, record.sender);

        event::emit(PaymentRefundedEventV2 {
            claim_key,
            sender: record.sender,
            amount: record.amount,
            yield_earned,
            refunded_at: clock.timestamp_ms(),
            initiator: b"sender",
        });
    }

    /// Agent refunds an expired v2 payment.
    public entry fun refund_expired_v2(
        book: &mut PaymentBookV2,
        vault: &mut ScallopYieldVault,
        claim_key: vector<u8>,
        cap: &RefundAgentCap,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(cap.agent == tx_context::sender(ctx), EUnauthorized);

        let record = table::remove(&mut book.payments, claim_key);
        let now = clock.timestamp_ms();
        assert!(now >= record.expiry, ENotYetExpired);

        let coin = yield_scallop::withdraw_scallop(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

        transfer::public_transfer(coin, record.sender);

        event::emit(PaymentRefundedEventV2 {
            claim_key,
            sender: record.sender,
            amount: record.amount,
            yield_earned,
            refunded_at: now,
            initiator: b"agent",
        });
    }

    /// Agent refunds an expired v2 payment (any coin type).
    public entry fun refund_expired_v2_generic<T>(
        book: &mut PaymentBookV2,
        vault: &mut ScallopYieldVaultGeneric<T>,
        claim_key: vector<u8>,
        cap: &RefundAgentCap,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(cap.agent == tx_context::sender(ctx), EUnauthorized);

        let record = table::remove(&mut book.payments, claim_key);
        let now = clock.timestamp_ms();
        assert!(now >= record.expiry, ENotYetExpired);

        let coin = yield_scallop::withdraw_generic(vault, record.position_id, version, market, clock, ctx);
        let total_value = coin.value();
        let yield_earned = if (total_value > record.amount) { total_value - record.amount } else { 0 };

        transfer::public_transfer(coin, record.sender);

        event::emit(PaymentRefundedEventV2 {
            claim_key,
            sender: record.sender,
            amount: record.amount,
            yield_earned,
            refunded_at: now,
            initiator: b"agent",
        });
    }

    // ─── V2 read-only queries ───────────────────────────────────────────

    public fun payment_v2_exists(book: &PaymentBookV2, claim_key: vector<u8>): bool {
        table::contains(&book.payments, claim_key)
    }

    public fun payment_v2_amount(book: &PaymentBookV2, claim_key: vector<u8>): u64 {
        if (table::contains(&book.payments, claim_key)) {
            table::borrow(&book.payments, claim_key).amount
        } else {
            0
        }
    }

    public fun payment_v2_expiry(book: &PaymentBookV2, claim_key: vector<u8>): u64 {
        if (table::contains(&book.payments, claim_key)) {
            table::borrow(&book.payments, claim_key).expiry
        } else {
            0
        }
    }

    public fun payment_v2_coin_type(book: &PaymentBookV2, claim_key: vector<u8>): u8 {
        if (table::contains(&book.payments, claim_key)) {
            table::borrow(&book.payments, claim_key).coin_type
        } else {
            0
        }
    }

    public fun payment_v2_auth_mode(book: &PaymentBookV2, claim_key: vector<u8>): u8 {
        if (table::contains(&book.payments, claim_key)) {
            derive_auth_mode(table::borrow(&book.payments, claim_key))
        } else {
            AUTH_BEARER
        }
    }

    public fun payment_v2_recipient_lock(book: &PaymentBookV2, claim_key: vector<u8>): address {
        if (table::contains(&book.payments, claim_key)) {
            let lock = &table::borrow(&book.payments, claim_key).recipient_lock;
            if (option::is_some(lock)) {
                *option::borrow(lock)
            } else {
                @0x0
            }
        } else {
            @0x0
        }
    }

    public fun payment_v2_note_blob_id(book: &PaymentBookV2, claim_key: vector<u8>): vector<u8> {
        if (table::contains(&book.payments, claim_key)) {
            let note = &table::borrow(&book.payments, claim_key).note_blob_id;
            if (option::is_some(note)) {
                *option::borrow(note)
            } else {
                vector[]
            }
        } else {
            vector[]
        }
    }

    public fun payment_v2_is_paused(book: &PaymentBookV2): bool {
        book.paused
    }

    // ─── V2 test helpers ────────────────────────────────────────────────

    #[test_only]
    public(package) fun new_record_v2_for_testing(
        recipient_lock: Option<address>,
        pin_hash: Option<vector<u8>>,
        ctx: &mut TxContext,
    ): PaymentRecordV2 {
        let uid = object::new(ctx);
        let position_id = uid.to_inner();
        object::delete(uid);
        PaymentRecordV2 {
            sender: @0xA,
            amount: 1000,
            position_id,
            coin_type: 0,
            created_at: 0,
            expiry: 0,
            recipient_lock,
            pin_hash,
            note_blob_id: option::none(),
        }
    }
}
