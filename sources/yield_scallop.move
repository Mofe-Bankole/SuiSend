/// Scallop-specific yield integration for SuiSend.
///
/// This module replaces the mock yield vault with real Scallop lending pool
/// interactions. Deposits go to Scallop's mint (SUI → sSUI), withdrawals
/// come from Scallop's redeem (sSUI → SUI + yield).
///
/// The vault holds sSUI (Coin<MarketCoin<SUI>>) in a Balance, not raw SUI.
/// Each position tracks both the original SUI amount and the sSUI amount
/// received at mint time.
module suisend::yield_scallop {
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::sui::SUI;
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use protocol::mint;
    use protocol::redeem;
    use protocol::market::Market;
    use protocol::reserve::MarketCoin;
    use protocol::version::Version;

    const PROTOCOL_SCALLOP: u8 = 1;

    const EPositionNotFound: u64 = 1;

    const EInvalidAmount: u64 = 2;

    /// Shared vault holding sSUI (Coin<MarketCoin<SUI>>) deposited into
    /// Scallop's lending pool.
    ///
    /// When a sender creates a payment, their SUI is deposited into Scallop
    /// via `mint`, and the resulting sSUI is held in this vault. When the
    /// recipient claims (or the sender refunds), the sSUI is redeemed via
    /// Scallop's `redeem`, returning SUI + accrued yield.
    public struct ScallopYieldVault has key {
        id: UID,
        /// Balance of sSUI (MarketCoin<SUI>) held in the vault.
        scoin_balance: Balance<MarketCoin<SUI>>,
        /// Registry of all active yield positions.
        positions: Table<ID, PositionRecord>,
    }

    /// A record tracking an individual yield position.
    public struct PositionRecord has store {
        /// Amount of SUI originally deposited (in MIST).
        principal: u64,
        /// Amount of sSUI received from Scallop mint (in MIST equivalent).
        /// At mint time: scoin_amount ≈ principal (1:1 initial rate).
        /// Over time, sSUI appreciates against SUI as yield accrues.
        scoin_amount: u64,
        /// Protocol identifier (1 = Scallop).
        protocol: u8,
    }

    /// Emitted when funds are deposited into Scallop.
    public struct ScallopDepositEvent has copy, drop {
        position_id: ID,
        amount: u64,
        scoin_amount: u64,
    }

    /// Emitted when funds are withdrawn from Scallop.
    public struct ScallopWithdrawEvent has copy, drop {
        position_id: ID,
        principal: u64,
        interest: u64,
        total: u64,
    }

    fun init(ctx: &mut TxContext) {
        let vault = ScallopYieldVault {
            id: object::new(ctx),
            scoin_balance: balance::zero<MarketCoin<SUI>>(),
            positions: table::new(ctx),
        };
        transfer::share_object(vault);
    }

    #[test_only]
    public(package) fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    /// Deposit SUI into Scallop's lending pool.
    ///
    /// Mints sSUI from Scallop (via `protocol::mint::mint`), stores the
    /// sSUI in the vault's balance, and returns a position ID.
    public fun deposit_scallop(
        vault: &mut ScallopYieldVault,
        coin: Coin<SUI>,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ): ID {
        let amount = coin.value();
        let s_sui = mint::mint<SUI>(version, market, coin, clock, ctx);
        let scoin_amount = s_sui.value();
        balance::join(&mut vault.scoin_balance, coin::into_balance(s_sui));

        let uid = object::new(ctx);
        let position_id = uid.to_inner();
        object::delete(uid);
        table::add(
            &mut vault.positions,
            position_id,
            PositionRecord {
                principal: amount,
                scoin_amount,
                protocol: PROTOCOL_SCALLOP,
            },
        );

        event::emit(ScallopDepositEvent {
            position_id,
            amount,
            scoin_amount,
        });

        position_id
    }

    /// Withdraw SUI + yield from Scallop's lending pool.
    ///
    /// Redeems sSUI from Scallop (via `protocol::redeem::redeem`), which
    /// returns the original SUI principal plus accrued yield.
    ///
    /// The sSUI amount redeemed is exactly what was originally minted for
    /// this position. Because sSUI appreciates over time (1 sSUI → more
    /// than 1 SUI after yield accrual), the returned Coin<SUI> includes
    /// both principal and yield.
    public fun withdraw_scallop(
        vault: &mut ScallopYieldVault,
        position_id: ID,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Coin<SUI> {
        let PositionRecord { principal, scoin_amount, protocol: _ } =
            table::remove(&mut vault.positions, position_id);

        let s_sui = coin::take(&mut vault.scoin_balance, scoin_amount, ctx);
        let sui = redeem::redeem<SUI>(version, market, s_sui, clock, ctx);
        let total_value = sui.value();
        let interest = total_value - principal;

        event::emit(ScallopWithdrawEvent {
            position_id,
            principal,
            interest,
            total: total_value,
        });

        sui
    }

    public fun get_principal(vault: &ScallopYieldVault, position_id: ID): u64 {
        if (table::contains(&vault.positions, position_id)) {
            table::borrow(&vault.positions, position_id).principal
        } else {
            0
        }
    }

    public fun active_position_count(vault: &ScallopYieldVault): u64 {
        table::length(&vault.positions)
    }

    public fun total_scoin_balance(vault: &ScallopYieldVault): u64 {
        balance::value(&vault.scoin_balance)
    }

    // ═══════════════════════════════════════════════════════════════
    //  GENERIC VAULT (for USDC, USDT, and future coins)
    //
    //  ┌─ Why a generic vault? ─────────────────────────────────────┐
    //  │                                                            │
    //  │  The concrete ScallopYieldVault above is hard-coded to     │
    //  │  MarketCoin<SUI>. To support USDC without importing the    │
    //  │  external Wormhole USDC type at compile time, we make the  │
    //  │  vault generic over a phantom type parameter T.            │
    //  │                                                            │
    //  │  ┌─ Sui Move phantom generics ──────────────────────┐      │
    //  │  │  struct ScallopYieldVaultGeneric<phantom T>      │      │
    //  │  │                                                  │      │
    //  │  │  "phantom" means T is never read or written at   │      │
    //  │  │  runtime — it only exists at the type level to   │      │
    //  │  │  distinguish vaults for different coins. This    │      │
    //  │  │  means:                                          │      │
    //  │  │   - No constraints on T (no abilities needed)    │      │
    //  │  │   - The compiler doesn't need the source of T    │      │
    //  │   - The frontend passes T as a string at PTB time │      │
    //  │  └────────────────────────────────────────────────┘      │
    //  │                                                            │
    //  │  For USDC on mainnet, the frontend would pass              │
    //  │  typeArguments: ["0xdba3...::usdc::USDC"]                  │
    //  │                                                            │
    //  │  ┌─ How the frontend builds the PTB ───────────────┐       │
    //  │  │  tx.moveCall({                                   │       │
    //  │  │    target: "pkg::yield_scallop::deposit_generic",│       │
    //  │  │    typeArguments: [USDC_COIN_TYPE_STRING],       │       │
    //  │  │    arguments: [vault, coin, version, market,     │       │
    //  │  │                clock],                           │       │
    //  │  │  });                                             │       │
    //  │  └──────────────────────────────────────────────────┘       │
    //  └────────────────────────────────────────────────────────────┘
    // ═══════════════════════════════════════════════════════════════

    // ┌──────────────────────────────────────────────────────────┐
    // │ GENERIC VAULT STRUCT                                     │
    // │                                                          │
    // │ `phantom T` = any coin type (SUI, USDC, USDT, ...).     │
    // │ The `scoin_balance` holds MarketCoin<T>, which changes   │
    // │ per T. This is a DIFFERENT type from ScallopYieldVault   │
    // │ (which is concrete). Existing SUI vault objects are NOT  │
    // │ affected by this new struct.                             │
    // └──────────────────────────────────────────────────────────┘

    /// Shared vault holding sCoin (MarketCoin<T>) for an arbitrary
    /// coin type T. Used for USDC, USDT, etc.
    ///
    /// `phantom T` means T is never stored or accessed — it just
    /// provides type-level routing so Scallop's market knows which
    /// pool to use.
    public struct ScallopYieldVaultGeneric<phantom T> has key {
        id: UID,
        /// Balance of sCoin (MarketCoin<T>) held in the vault.
        scoin_balance: Balance<MarketCoin<T>>,
        /// Registry of all active yield positions.
        positions: Table<ID, PositionRecord>,
    }

    // ┌──────────────────────────────────────────────────────────┐
    // │ init_vault_generic()                                      │
    // │                                                          │
    // │ Creates a shared ScallopYieldVaultGeneric<T> for any T.  │
    // │ The frontend calls this once per coin type with the      │
    // │ appropriate type argument, then captures the vault ID.   │
    // │                                                          │
    // │ Call once per coin at deploy time:                       │
    // │   - typeArguments: ["0xdba3...::usdc::USDC"]             │
    // │   - captures vault ID → stored in constants.ts           │
    // └──────────────────────────────────────────────────────────┘

    /// Create a new generic yield vault for coin type T.
    ///
    /// Call this once per coin via PTB, passing the coin type as
    /// a type argument. The returned object ID is the vault address
    /// used in all subsequent create/claim PTBs for that coin.
    public fun init_vault_generic<T>(ctx: &mut TxContext) {
        let vault = ScallopYieldVaultGeneric<T> {
            id: object::new(ctx),
            scoin_balance: balance::zero<MarketCoin<T>>(),
            positions: table::new(ctx),
        };
        transfer::share_object(vault);
    }

    // ┌──────────────────────────────────────────────────────────┐
    // │ deposit_generic<T>()                                      │
    // │                                                          │
    // │ ONE function for ALL coin types. The type parameter T    │
    // │ determines which Scallop pool the deposit routes to.     │
    // │                                                          │
    // │ Compare to deposit_scallop() (line 93) which is          │
    // │ hard-coded to <SUI>. This version works for ANY T.       │
    // └──────────────────────────────────────────────────────────┘

    /// Deposit any coin into Scallop's lending pool.
    ///
    /// Generic version of `deposit_scallop` that works with any
    /// coin type T. The frontend specifies T as a type argument
    /// in the PTB — no compile-time import needed.
    public fun deposit_generic<T>(
        vault: &mut ScallopYieldVaultGeneric<T>,
        coin: Coin<T>,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ): ID {
        let amount = coin.value();
        let s_coin = mint::mint<T>(version, market, coin, clock, ctx);
        let scoin_amount = s_coin.value();
        balance::join(&mut vault.scoin_balance, coin::into_balance(s_coin));

        let uid = object::new(ctx);
        let position_id = uid.to_inner();
        object::delete(uid);
        table::add(
            &mut vault.positions,
            position_id,
            PositionRecord {
                principal: amount,
                scoin_amount,
                protocol: PROTOCOL_SCALLOP,
            },
        );

        event::emit(ScallopDepositEvent {
            position_id,
            amount,
            scoin_amount,
        });

        position_id
    }

    // ┌──────────────────────────────────────────────────────────┐
    // │ withdraw_generic<T>()                                     │
    // │                                                          │
    // │ Generic version of withdraw_scallop(). Returns Coin<T>.   │
    // │ T must match the coin type used at deposit time.         │
    // └──────────────────────────────────────────────────────────┘

    /// Withdraw any coin + yield from Scallop's lending pool.
    ///
    /// Generic version of `withdraw_scallop` that works with any
    /// coin type T. The caller must pass a position_id from a
    /// previous deposit_generic call with the same T.
    public fun withdraw_generic<T>(
        vault: &mut ScallopYieldVaultGeneric<T>,
        position_id: ID,
        version: &Version,
        market: &mut Market,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Coin<T> {
        let PositionRecord { principal, scoin_amount, protocol: _ } =
            table::remove(&mut vault.positions, position_id);

        let s_coin = coin::take(&mut vault.scoin_balance, scoin_amount, ctx);
        let coin = redeem::redeem<T>(version, market, s_coin, clock, ctx);
        let total_value = coin.value();
        let interest = total_value - principal;

        event::emit(ScallopWithdrawEvent {
            position_id,
            principal,
            interest,
            total: total_value,
        });

        coin
    }

    // ┌──────────────────────────────────────────────────────────┐
    // │ READ-ONLY QUERIES (generic versions)                     │
    // │                                                          │
    // │ These mirror the SUI-specific query functions above but  │
    // │ work with the generic vault type. Same logic, just       │
    // │ generic over T.                                          │
    // └──────────────────────────────────────────────────────────┘

    public fun get_principal_generic<T>(vault: &ScallopYieldVaultGeneric<T>, position_id: ID): u64 {
        if (table::contains(&vault.positions, position_id)) {
            table::borrow(&vault.positions, position_id).principal
        } else {
            0
        }
    }

    public fun active_position_count_generic<T>(vault: &ScallopYieldVaultGeneric<T>): u64 {
        table::length(&vault.positions)
    }

    public fun total_scoin_balance_generic<T>(vault: &ScallopYieldVaultGeneric<T>): u64 {
        balance::value(&vault.scoin_balance)
    }
}
