# F03 — zkLogin is broken on mainnet three different ways

- **Severity:** P0 (the "no wallet required" promise cannot execute)
- **Area:** infra / frontend
- **Phase:** 2
- **Status:** 🔶 Partial (2026-10-02): (a) prover switched to `https://prover.mystenlabs.com/v1` (mainnet); OAuth callback now returns users to the page they started from. Still open: (b) gas sponsorship for zero-balance claimants, (c) epoch-expiry detection + re-auth flow.

## Evidence

**(a) Wrong prover.** `src/app/api/zklogin/route.ts:5`:

```ts
const PROVER_URL = "https://prover-dev.mystenlabs.com/v1";
```

`prover-dev` is Mysten's development prover, documented for devnet/testnet
use. The rest of the stack (constants, RPC, Scallop) targets mainnet. Mainnet
proving must use `https://prover.mystenlabs.com/v1`.

**(b) No gas path.** A recipient who signs in with Google gets a fresh zkLogin
address with zero SUI. Every transaction on Sui requires gas.
`signWithZkLoginAndExecute` (`zklogin.ts:197`) submits the transaction with no
sponsorship — it will simply fail for the exact users the feature targets.
README: *"They only need the link to claim — no wallet required on their end."*
False.

**(c) Silent session rot.** `zklogin.ts:70` sets `maxEpoch = currentEpoch + 2`
(~48 h). `getZkLoginState()` (:178) never checks the current epoch against
`maxEpoch`. After expiry, the ephemeral key + proof are invalid and every
transaction fails opaquely. There is no refresh/re-auth trigger.

## Root cause

zkLogin was copy-pasted from a testnet tutorial ("Added zkLogins" commits
×2 with no follow-up fix) and never exercised against a real mainnet claim.

## Fix

1. `PROVER_URL = "https://prover.mystenlabs.com/v1"`.
2. Sponsor claim transactions — Shinami Gas Station (`@shinami/clients`) or a
   minimal self-hosted sponsor route (`/api/sponsor`) that co-signs claim PTBs
   only (whitelist `claim_payment*` targets, rate-limit by address).
3. `getZkLoginState()`: fetch current epoch, return `isReady: false` +
   `expired: true` when `epoch >= maxEpoch`; UI shows "Sign in again" instead
   of failing at execution.
4. Persist nothing sensitive beyond `sessionStorage` (already true) but also
   clear on expiry so stale proofs are never reused.

## Verification

From a brand-new browser profile, zero SUI anywhere: receive a link, sign in
with Google, claim. The transaction must land on mainnet with $0 spent by the
recipient. Repeat after forcing an expired session — the UI must ask for
re-auth, not throw.
