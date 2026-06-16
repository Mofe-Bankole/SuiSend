/// Yield provider module for SuiSend.
///
/// Provides an abstraction layer over lending protocols (Scallop, Navi, etc.)
/// so the core module can deposit and withdraw SUI without knowing which
/// protocol backs each payment position.
///
/// ## MOCK VERSION (pre-Scallop)
/// This version holds deposited SUI in a shared vault and simulates a fixed
/// APY. The interest calculation is linear and prorated by milliseconds
/// elapsed since deposit. Use for devnet testing only.
///
/// ## Migration path
/// When the Scallop adapter is ready, replace the vault logic with:
///   - `deposit()` calls Scallop's mint/deposit function
///   - `withdraw()` calls Scallop's redeem/withdraw function
///   - The `YieldVault` object is no longer needed (Scallop holds the funds)
///   - The `protocol` field on PositionRecord routes to the right adapter
///
/// The core module never touches the vault directly. It only calls
/// `yield::deposit` and `yield::withdraw`, so swapping the backend is
/// a drop-in replacement.
module suisend::yield {
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use sui::object::{Self, ID, UID};
    use sui::sui::SUI;
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    // ─── Constants ───────────────────────────────────────────────────────────

    /// Mock annual percentage yield in basis points.
    /// 820 basis points = 8.20% APY. 10000 basis points = 100%.
    const MOCK_APY_BPS: u64 = 820;

    /// Number of milliseconds in one year (used for prorated interest).
    /// 365 days * 24 hours * 3600 seconds * 1000 ms = 31,536,000,000 ms.
    const MS_IN_YEAR: u64 = 31_536_000_000;

    /// Basis points denominator: 10000 = 100%.
    const BPS_DENOM: u64 = 10_000;

    // ─── Error codes ─────────────────────────────────────────────────────────

    /// Caller tried to withdraw from a position that does not exist.
    const EPositionNotFound: u64 = 1;

    /// Caller provided an invalid protocol identifier.
    const EInvalidProtocol: u64 = 2;

    /// Arithmetic overflow during interest calculation.
    const EMathOverflow: u64 = 3;

    // ─── Protocol identifiers ────────────────────────────────────────────────

    /// Mock protocol (for devnet/testing).
    const PROTOCOL_MOCK: u8 = 0;

    /// Scallop lending protocol (mainnet).
    const PROTOCOL_SCALLOP: u8 = 1;

    /// Navi lending protocol (mainnet). Stretch goal.
    const PROTOCOL_NAVI: u8 = 2;

    // ─── Objects and structs ─────────────────────────────────────────────────

    /// Shared vault holding all deposited SUI.
    ///
    /// In the mock version, this is where deposited coins sit while they
    /// "earn" yield. The balance grows only when new deposits arrive and
    /// shrinks when positions are withdrawn.
    ///
    /// ## Shared object
    /// Anyone can call `deposit()` to add funds, and anyone holding a valid
    /// `PositionRecord` ID can call `withdraw()` to redeem. The core module
    /// gates access through the payment lifecycle.
    public struct YieldVault has key {
        id: UID,
        /// Total SUI balance held by this vault.
        balance: Balance<SUI>,
        /// Registry of all active yield positions.
        /// Keyed by a unique position ID generated at deposit time.
        positions: Table<ID, PositionRecord>,
    }

    /// A record tracking an individual yield position inside the vault.
    ///
    /// Not an Object itself — it lives inside the YieldVault's Table.
    /// The `store` ability allows it to be embedded in the Table.
    public struct PositionRecord has store {
        /// Amount originally deposited (in MIST = 10^-9 SUI).
        principal: u64,
        /// Unix timestamp in milliseconds when the deposit was made.
        created_at: u64,
        /// Protocol identifier (e.g., 0 = Mock, 1 = Scallop).
        protocol: u8,
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    /// Emitted when funds are deposited into a yield protocol.
    public struct DepositEvent has copy, drop {
        /// Unique position ID identifying this deposit.
        position_id: ID,
        /// Amount deposited (in MIST).
        amount: u64,
        /// Protocol the funds were routed to.
        protocol: u8,
    }

    /// Emitted when funds are withdrawn from a yield protocol.
    public struct WithdrawEvent has copy, drop {
        /// Position ID that was redeemed.
        position_id: ID,
        /// Principal originally deposited (in MIST).
        principal: u64,
        /// Interest earned (in MIST).
        interest: u64,
        /// Total amount withdrawn = principal + interest.
        total: u64,
        /// Protocol the funds were withdrawn from.
        protocol: u8,
    }

    // ─── Initialization ──────────────────────────────────────────────────────

    /// Create the shared YieldVault singleton.
    ///
    /// Called once when the package is published. The vault starts empty.
    fun init(ctx: &mut TxContext) {
        let vault = YieldVault {
            id: object::new(ctx),
            balance: balance::zero<SUI>(),
            positions: table::new(ctx),
        };
        transfer::share_object(vault);
    }

    /// Test-only wrapper so core_tests can initialize the module.
    #[test_only]
    public(package) fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    // ─── Public entry functions ─────────────────────────────────────────────

    /// Deposit SUI into a yield protocol.
    ///
    /// Takes a Coin<SUI> from the caller, stores its value in the vault,
    /// creates a PositionRecord, and returns the newly generated position ID.
    /// The position ID must be recorded by the caller (typically in a
    /// PaymentRecord) so it can be redeemed later.
    ///
    /// ## Parameters
    /// - `vault`: The shared YieldVault (must be passed as &mut to modify).
    /// - `coin`: The SUI coin to deposit. Consumed by this function.
    /// - `protocol`: Protocol to deposit into (0 = Mock, 1 = Scallop, etc.).
    /// - `clock`: Sui Clock object for timestamps.
    /// - `ctx`: Transaction context for generating the position ID.
    ///
    /// ## Returns
    /// The unique position ID that can be used to withdraw later.
    public fun deposit(
        vault: &mut YieldVault,
        coin: Coin<SUI>,
        protocol: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ): ID {
        // Validate the protocol identifier.
        assert!(protocol == PROTOCOL_MOCK || protocol == PROTOCOL_SCALLOP || protocol == PROTOCOL_NAVI, EInvalidProtocol);

        // Extract the value from the incoming coin and merge it into the vault.
        let amount = coin.value();
        balance::join(&mut vault.balance, coin::into_balance(coin));

        // Create a new position record and store it in the vault's table.
        let uid = object::new(ctx);
        let position_id = uid.to_inner();
        object::delete(uid);
        table::add(
            &mut vault.positions,
            position_id,
            PositionRecord {
                principal: amount,
                created_at: clock.timestamp_ms(),
                protocol,
            },
        );

        // Emit an event so the off-chain indexer can track the deposit.
        sui::event::emit(DepositEvent {
            position_id,
            amount,
            protocol,
        });

        position_id
    }

    /// Withdraw SUI + accrued interest from a yield position.
    ///
    /// Consumes the position (removes it from the vault's table), calculates
    /// the mock interest earned since deposit, and returns a Coin<SUI>
    /// containing the principal + interest.
    ///
    /// ## Parameters
    /// - `vault`: The shared YieldVault (must be passed as &mut to modify).
    /// - `position_id`: The ID of the position to redeem.
    /// - `clock`: Sui Clock object for elapsed time calculation.
    /// - `ctx`: Transaction context for creating the output Coin.
    ///
    /// ## Returns
    /// A Coin<SUI> containing principal + accrued interest.
    public fun withdraw(
        vault: &mut YieldVault,
        position_id: ID,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Coin<SUI> {
        // Remove the position record from the vault's table.
        // Aborts with EPositionNotFound if the ID doesn't exist.
        let PositionRecord { principal, created_at, protocol } = table::remove(&mut vault.positions, position_id);

        // Calculate elapsed time in milliseconds.
        let elapsed_ms = clock.timestamp_ms() - created_at;

        // Calculate mock interest using the formula:
        //   interest = principal * APY_bps / BPS_DENOM * elapsed_ms / MS_IN_YEAR
        //
        // NOTE: The mock vault holds only the deposited principal — it cannot
        // conjure SUI out of thin air to pay interest. The interest formula is
        // preserved here for audit/inspection but the result is set to zero so
        // that withdraw returns only the principal. Real yield (Scallop, Navi)
        // will be earned on-protocol and the extra SUI will be available in the
        // vault at withdrawal time.
        //
        // Example: 100 SUI deposited for 7 days at 8.2% APY:
        //   interest = 100SUI * 820 / 10000 * 604800000 / 31536000000
        //           ≈ 0.1575 SUI
        let _interest = principal * MOCK_APY_BPS / BPS_DENOM * elapsed_ms / MS_IN_YEAR;
        let interest = 0;

        // Total amount to return = principal + interest.
        // Use a safe add that aborts on overflow.
        let total = principal + interest;

        // Take the total amount from the vault's balance and create a Coin.
        let withdrawn = coin::take(&mut vault.balance, total, ctx);

        // Emit a withdraw event for the off-chain indexer.
        sui::event::emit(WithdrawEvent {
            position_id,
            principal,
            interest,
            total,
            protocol,
        });

        withdrawn
    }

    // ─── Read-only query functions ──────────────────────────────────────────

    /// Get the principal amount for a given position ID.
    /// Returns 0 if the position does not exist.
    public fun get_principal(vault: &YieldVault, position_id: ID): u64 {
        if (table::contains(&vault.positions, position_id)) {
            table::borrow(&vault.positions, position_id).principal
        } else {
            0
        }
    }

    /// Get the number of currently active positions in the vault.
    public fun active_position_count(vault: &YieldVault): u64 {
        table::length(&vault.positions)
    }

    /// Get the total SUI balance currently held in the vault (in MIST).
    public fun total_balance(vault: &YieldVault): u64 {
        balance::value(&vault.balance)
    }
}
