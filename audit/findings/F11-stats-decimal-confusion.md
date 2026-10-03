# F11 — Public stats mix SUI (9 decimals) and USDC (6 decimals) into one number

- **Severity:** P2 (publicly wrong numbers on a money product)
- **Area:** frontend
- **Phase:** 4
- **Status:** Open

## Evidence

`usePaymentEvents.ts:105` and `suisend.ts:621`:

```ts
totalMist += Number(parsed.amount ?? 0);   // no coin-type discrimination
```

…then displayed as SUI: `app/page.tsx:145`
`formatAmount(stats.totalVolumeMist, COIN_TYPE_SUI)` and
`usePaymentEvents.ts:114` `setTotalVolume(totalMist / SUI_PER_MIST)`.

`PaymentCreatedEvent` carries no coin-type field (it lives in the F07 dynamic
field, or nowhere for SUI), so the aggregation can't even be fixed without
joining per-payment lookups.

## Impact

A single 1,000 USDC payment adds "1,000,000,000 MIST" = **1 SUI** to a volume
counter that presents as SUI — and a 1,000 SUI payment adds 1,000 USDC-sized
units to the same pot. Every stats banner (landing `StatsStrip`, app stats
banner) shows a meaningless number. On a product whose entire pitch is trust
with money, public arithmetic that is wrong by up to 1000× per payment is a
credibility bug.

## Fix

1. v5 contract (F06/F07): add `coin_type` to `PaymentRecord` **and** to
   `PaymentCreatedEvent`. Indexers should not need N+1 lookups for basics.
2. Frontend: aggregate per coin type — `{ sui: {count, mist}, usdc: {count, units} }`
   — and render two stats, or a coin switcher. Never sum across types.
3. While the v4 contract lives: join each event against
   `batchCheckPaymentCoinTypes` before summing (slow but correct).

## Verification

Create 1 SUI payment and 1 USDC payment. Landing stats show exactly
"1 SUI" and "1 USDC" (or the two correct per-coin totals). Suiscan agrees.
