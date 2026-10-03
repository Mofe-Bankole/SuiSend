# F02 — `/claim/[hash]` route does not exist; every payment link 404s

- **Severity:** P0 (the product's only deliverable artifact is broken)
- **Area:** frontend
- **Phase:** 1
- **Status:** ✅ Fixed (2026-10-02): `src/app/claim/[hash]/page.tsx` created — lookup, claim via wallet or zkLogin, terminal states (claimed / refunded / unknown / invalid / error), expired-but-claimable handling, success state with Suiscan link. `queryPaymentTerminalStatus` added to `src/lib/suisend.ts`. OAuth return-to fixed so Google sign-in from a claim link returns to the link. Build passes; route smoke-tested at `/claim/<hash>`. Note display (F13) still pending the v5 getter.

## Evidence

Links are generated in three places, all pointing to `/claim/<hash>`:

- `src/lib/suisend.ts:525` — `claimUrl: \`${getAppUrl()}/claim/${linkHash}\``
- `src/components/app/SendTab.tsx:229` — `setGeneratedUrl(...)`
- `src/components/DemoSection.tsx:27,115` — marketing demo copies the same shape

The directory `src/app/claim/` is **empty** — no `page.tsx` at any depth.
`git log --all -- src/app/claim/` returns zero commits: this page has never
existed. `next.config.ts` contains no rewrites that could rescue the route.

## Impact

The recipient journey — the entire reason the product exists — ends at a 404.
The sender's own "Open link" buttons (`SendTab.tsx:448`, `HistoryTab.tsx:274`)
open a 404. Only a user who manually pastes the link into the Claim tab inside
`/app` (and knows to do so) can claim. That is not a payment link product.

## Root cause

The app was built as a single-page `/app` with tabs (Send / Claim / History).
The Claim tab even contains URL-parsing logic for `/claim/` links
(`ClaimTab.tsx:64-70`) — evidence the route was intended — but the route itself
was never created. Nobody clicked a generated link end-to-end.

## Fix

Create `src/app/claim/[secret]/page.tsx`:

1. Client component reading `params.secret`.
2. On mount: `lookupPayment(suiClient, key)` (F01 renames hash→key).
3. Render: amount + coin, shortened sender, Walrus note (F13), live countdown
   to expiry, APY context.
4. CTA: connect wallet **or** continue with Google (zkLogin, F03) → build and
   execute the claim PTB → success state with Suiscan link.
5. Terminal states rendered honestly: claimed / refunded / never existed /
   wrong network.
6. Mobile-first (recipients are on phones); no app chrome needed beyond a
   minimal header.

Also: `lookupPayment`'s dummy-sender `devInspect` pattern stays, but the new
page must handle `exists:false` without console noise.

## Verification

Create a real payment on mainnet → open the generated URL in an **incognito**
window → claim with a fresh wallet address → funds arrive. If any step
requires copy-pasting a hash manually, the gate fails.
