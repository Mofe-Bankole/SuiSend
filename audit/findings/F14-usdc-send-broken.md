# F14 — USDC send is broken under zkLogin and fragile for wallets

- **Severity:** P2
- **Area:** frontend
- **Phase:** 4
- **Status:** Open

## Evidence

`SendTab.tsx:56-60`:

```ts
const { data: usdcCoinsData } = useSuiClientQuery("getCoins", {
  owner: account?.address ?? "",   // ← under zkLogin this is the EMPTY address
  coinType: USDC_COIN_TYPE,
  limit: 10,                        // ← and only the first 10 coins
});
```

`:194-204` then picks the **first** coin with sufficient balance; no merge of
dust coins; if the sufficient coin is beyond the 10-coin page, the send fails
spuriously with "No USDC coin with sufficient balance found."

Under zkLogin (`account == null`), `owner: ""` returns no coins, so USDC send
is **always impossible** for Google-sign-in users — even though the SUI path
works via `tx.gas` splitting.

## Impact

- zkLogin users (the "no wallet" audience — the product's target!) can never
  send USDC.
- Wallet users with fragmented USDC (common: CEX withdrawals, change outputs)
  get told they have no money while their balance says otherwise.

## Fix

1. Owner should be the **active** address: `account?.address ?? zkState?.address`.
2. Fetch all coins (paginate `getCoins` cursor), sort by balance desc,
   `tx.mergeCoins` dust into the largest until the amount is covered, then
   `splitCoins` the exact amount — the standard PTB pattern.
3. Gas: USDC path under zkLogin still needs SUI for gas — same sponsorship
   story as F03 (or require a tiny SUI balance and say so).

## Verification

- zkLogin session with 2 USDC coins (e.g., 60 + 40) sends 75 USDC: succeeds,
  one merged input.
- Wallet with 12 dust coins sends an amount only reachable via merge: succeeds.
