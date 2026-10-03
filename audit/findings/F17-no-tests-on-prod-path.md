# F17 — Zero test coverage on the production path

- **Severity:** P3
- **Area:** contracts / tests
- **Phase:** 5
- **Status:** Open

## Evidence

`tests/core_tests.move` (8 tests, all passing) exercises only the **mock**
vault: `core::create_payment`, `claim_payment`, `refund_sender`,
`refund_expired` — the exact functions F08 says should not exist on mainnet.

Untested — i.e., all of production:

- `create_payment_scallop` / `claim_payment_scallop` / refunds (SUI path)
- `*_generic<T>` (USDC path) — including the F07 dynamic-field behavior
- `init_vault_generic`
- The F01 attack (claim via event-scraped hash) — the most important test in
  the repo, absent.

Move unit tests can't call real Scallop (no testnet liquidity mock in-repo),
which is precisely why the previous model tested only the mock — and stopped.

## Impact

The only code path real users hit has never been executed in a test. Every
mainnet fix so far (v2, v3, v4) was verified by… redeploying. The duplicated
"Fixed USDC / SUI vault contracts" commits are the visible symptom.

## Fix

Two layers:

1. **Move unit tests** for what can be unit-tested after the v5 restructure:
   commitment scheme (F01: wrong-secret aborts, right-secret claims),
   coin-type-in-record (F07), expiry edges (`MIN_LOCKUP_MS`, `MAX_LOCKUP_MS`
   cap), voucher burn, double-claim abort.
2. **E2E script** (`scripts/e2e-testnet.mjs`): deploy package to testnet, run
   create → claim, create → expire → agent-refund, USDC create → claim via
   PTBs against real Scallop testnet. Runs before every mainnet upgrade.
   This is the gate DEPLOYMENT.md must reference.

## Verification

`sui move test` covers the new invariant list; `scripts/e2e-testnet.mjs`
exits 0 on a fresh testnet deploy. The v5 upgrade is the first upgrade in
project history executed only after e2e passes.
