# F15 — Dead code and encoding bugs left by the previous model

- **Severity:** P2 (each is small; together they signal unreviewed generated code)
- **Area:** frontend
- **Phase:** 4
- **Status:** Open

## Evidence

**(a) Dead function.** `zklogin.ts:51-64` — `initZkLogin()` generates an
ephemeral key, stores it, then `return ""`. Never called anywhere.

**(b) Dead computation with a hardcoded assumption.** `ClaimTab.tsx:152-157`:

```ts
const elapsed = paymentInfo ? now - (paymentInfo.expiry > 0
  ? Number(paymentInfo.expiry) - 86400000 * 14 : now) : 0;
```

Assumes every payment has a 14-day expiry (user-settable on-chain), and the
result is never used.

**(c) `None` encoded as `Some([])`.** `suisend.ts:73-78` and `:338-343`:

```ts
tx.pure.option("vector<u8>", [])   // encodes Some(empty vector), NOT None
```

The contract receives `note_blob_id = some([])` instead of `none()` for every
note-less payment. Correct: `tx.pure.option("vector<u8>", null)`.

**(d) Fragile base64url.** `walrus.ts:86-94` — `blobIdToHex` strips `-`/`_`
then calls `atob` on a 43-char string (no padding re-added). Works in
lenient browsers today, throws in stricter runtimes; one Walrus format change
away from breaking every note.

**(e) Unused imports.** `suisend.ts` imports `coinLabel` (never used);
`ClaimTab` imports `timeUntil`/`useNow` used only for the dead `elapsed`;
`yield_scallop.move` has `EPositionNotFound`/`EInvalidAmount` never asserted
(compiler warnings already say so for core's constants).

## Impact

Individually cosmetic; collectively they mean generated code shipped without
review. (c) corrupts on-chain data semantics; (d) is a time bomb.

## Fix

Delete (a), (b), (e). Fix (c) to pass `null`. Fix (d): pad to a multiple of 4
before `atob` (`s + "=".repeat((4 - s.length % 4) % 4)`). Run
`npx tsc --noEmit` and `sui move build` warning-free; treat warnings as CI
failures going forward.

## Verification

`npm run lint` and `sui move build` produce zero warnings. A note-less payment
stores `note_blob_id = none` on-chain (check via Suiscan object view).
