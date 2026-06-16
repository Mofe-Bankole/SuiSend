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
}
