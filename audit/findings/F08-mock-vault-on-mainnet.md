# F08 — Insolvent mock vault shipped to mainnet with live entry functions

- **Severity:** P1
- **Area:** contracts
- **Phase:** 3
- **Status:** Open

## Evidence

`yield.move:243-244`:

```move
let _interest = principal * MOCK_APY_BPS / BPS_DENOM * elapsed_ms / MS_IN_YEAR;
let interest = 0;   // ← mock cannot mint yield; formula computed then discarded
```

The mock `YieldVault` only ever returns principal. Fine for devnet — but the
production package exposes all four mock entry functions publicly:
`create_payment`, `claim_payment`, `refund_sender`, `refund_expired`
(`core.move:329-596`), operating on a real shared `YieldVault` object that was
created at publish (`0x19fd7e20…`).

Worse, `yield::deposit` (`yield.move:173`) accepts `protocol = 0 (Mock)`,
`1 (Scallop)`, `2 (Navi)` and treats all three identically — no routing, no
abort for unimplemented protocols. The module docstring advertises a
"drop-in replacement" abstraction that was never finished.

## Impact

- Anyone can deposit real mainnet SUI into a vault that pays **zero yield by
  construction**, believing (from the README's "yield abstraction layer" and
  the app's APY displays) that it earns.
- Funds deposited via the mock path on mainnet earn nothing while the UI
  implies otherwise; support/confusion burden; reputational damage.
- The deployed surface is larger than the tested surface (F17): the mock path
  is the only tested path, and it's the one users shouldn't touch.

## Fix

In v5: remove `YieldVault` and the four mock entry functions from the
production build. Keep the mock module for tests by gating it:
`#[test_only]` on the mock vault module (or move it under `tests/`).
`yield.move` either disappears or becomes a thin trait-like module used only
by tests. Mainnet keeps exactly one create path (`create_payment_scallop`),
one generic path (`create_payment_generic`), and their claim/refund twins.

If a mock is still wanted on devnet, publish a separate dev-only package —
never gate behavior by a `protocol` u8 that silently does nothing.

## Verification

On the upgraded package, calling `core::create_payment` (mock) fails with
`FunctionNotFound`/`EFunctionDoesNotExist`. `grep -n "MOCK_APY_BPS" sources/`
returns nothing outside `#[test_only]` code.
