# F12 — Sent history shows fake zeros for yield and notes; capped at 50

- **Severity:** P2
- **Area:** frontend
- **Phase:** 4
- **Status:** Open

## Evidence

`suisend.ts:521-522` inside `queryUserSentPayments`:

```ts
note: "",
...
yieldEarned: "0",
```

Hardcoded. The yield counter the sender watches while the payment is pending
(the product's signature feature!) never appears in history. Same file,
`:424`: `limit: 50` with **no pagination** in `queryAllPaymentCreatedEvents` —
any payment beyond the newest 50 per package silently vanishes from history.

## Impact

- "It earns while they wait" — except your history says 0, always.
- Users with >50 payments lose records with no indication.
- `HistoryTab` renders `item.data.yieldEarned !== "0"` before showing the
  yield row, so the row never renders for sent items.

## Fix

1. Yield for pending payments: `devInspect` the vault position
   (`get_principal` + current sSUI exchange rate via Scallop SDK) — or, more
   honestly, compute estimated yield client-side from elapsed time × APY and
   label it "est."
2. Yield for terminal payments: from `PaymentClaimedEvent.yield_earned` /
   `PaymentRefundedEvent.yield_earned` (both already emitted — the data
   exists, it was just never wired).
3. Notes: F13 adds a getter; then join `note_blob_id` and fetch from Walrus
   (cache aggressively).
4. Paginate `queryEvents` with cursors until `hasNextPage` is false (the
   pattern already exists in `queryPaymentStats` — reuse it).

## Verification

A 3-day-old pending payment shows a non-zero estimated yield that matches
Suiscan's sSUI rate within rounding. A wallet with >50 created payments shows
all of them.
