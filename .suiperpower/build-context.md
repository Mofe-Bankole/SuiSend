# Build context

## build-with-move session, 2026-06-13
- module: `suisend::yield` — Mock yield provider with shared YieldVault. Supports deposit/withdraw with simulated 8.2% APY interest.
- module: `suisend::core` — Payment lifecycle. PaymentBook (shared table), PaymentVoucher (sender), ClaimReceipt (recipient), AdminCap, RefundAgentCap, YieldRouterCap. Entry functions: create_payment, claim_payment, refund_sender, refund_expired.
- module: `suisend::walrus` — Stub. store_note/store_receipt return dummy IDs. read_blob aborts (not implemented).
- tests: `suisend::core_tests` — 5 tests covering create→claim, sender refund, agent refund (expired), double-claim prevention, wrong link_hash rejection.
- dependencies added: Sui framework (testnet branch)
- Move.toml targets testnet framework

## Open issues (to resolve next session)
- **Sui CLI not installed** — Binary download was truncated (network issue). Cargo install timed out. Need to install `sui` CLI to build and run tests.
- **Compilation not verified** — Move code may need tweaks after `sui move build`. Particularly around test_scenario API signatures and coin::mint_for_testing availability.
- **Scallop integration** — Not started. Mainnet-only SDK confirmed. Plan says mock yield first, swap for Scallop after core tests pass.
- **Agent + frontend** — Not started. Focus was on Move contracts.

## Project state
- Move.toml at `/home/mofebanks/Documents/Sui/suisend/Move.toml`
- Sources: `sources/yield.move`, `sources/core.move`, `sources/walrus.move`
- Tests: `tests/core_tests.move`
- No other Sui packages or Move files exist.
