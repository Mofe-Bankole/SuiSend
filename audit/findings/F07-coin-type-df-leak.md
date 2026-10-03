# F07 — Coin-type dynamic field is never removed: storage leak + latent abort

- **Severity:** P1
- **Area:** contracts
- **Phase:** 3
- **Status:** 🔶 Fixed in code (2026-10-02, pending deployment): `PaymentRecordV2.coin_type` lives in the record. The dynamic-field mechanism is unused by v2. Legacy v1 df entries remain on the old book (frozen layout) but no new ones are created.

## Evidence

`core.move:934` (inside `create_payment_generic`):

```move
df::add<vector<u8>, u8>(&mut book.id, copy link_hash, coin_type);
```

No claim or refund path (`claim_payment_generic:954`, `refund_sender_generic:994`,
`refund_expired_generic:1029`) ever calls `df::remove`. The field lives on the
`PaymentBook` object **forever**, after the payment record itself is long gone.

## Impact

1. **Permanent storage leak** on a shared singleton — every USDC payment ever
   made bloats the book with an orphaned field, storage rebate never reclaimed.
2. **Latent abort:** `df::add` aborts if the field already exists. If a
   link_hash/secret key is ever reused after a prior generic payment (user
   error, hash collision, or deliberate griefing), `create_payment_generic`
   aborts — while `create_payment_scallop` (SUI path, no df) would succeed.
   Inconsistent failure surface.
3. **Stale reads:** `payment_coin_type` (`:674`) happily returns a coin type
   for payments that no longer exist.

## Root cause

The coin type couldn't fit in `PaymentRecord` without breaking the existing
table schema in a prior upgrade, so the previous model bolted it on as a
dynamic field — and forgot the removal path (and its abort semantics).

## Fix

In the v5 upgrade: add `coin_type: u8` directly to `PaymentRecord` (F06 is
already restructuring that struct; do both together). Delete the
`df::add`/`payment_coin_type` dynamic-field machinery entirely.
Frontend reads coin type from the record via the existing getter pattern —
`batchCheckPaymentCoinTypes` can then be deleted or repointed at the record.

## Verification

- Move test: create generic payment → claim → assert `df::exists_with_type` on
  the book is false (or rather: no df was ever created).
- Create → refund → recreate with the same key must succeed.
