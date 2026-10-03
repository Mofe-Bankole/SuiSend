# SuiSend Remediation Plan

Fix order is driven by one question: **what can hurt a user today?**
Phases are sequential gates. Do not start a phase until the previous gate passes.

---

## Phase 0 — Stop the bleed (contract security)

**Goal:** make it impossible for a third party to claim a payment they weren't given the link to.
**Findings:** F01
**Requires:** package upgrade (v5). Bundled with Phase 3 contract fixes so we upgrade **once**.

Interim mitigation (no upgrade needed, ship today): **✅ SHIPPED 2026-10-02**
- ~~Remove `ActivityFeed` and the live-events marquee from the landing page.~~ Done.
- ~~Add a banner in `SendTab`: "Anyone with this link can claim the funds."~~ Done.

Permanent fix (in v5 upgrade, spec in F01): **OPEN**
- Payment key becomes `sha3_256(secret)`; the URL carries the `secret`, never the key.
- Events emit only the key hash — safe to display publicly.
- Claim functions take `secret: vector<u8>` and hash it on-chain.

**Gate:** a payment created on mainnet cannot be claimed by a script that only
reads public events. Prove it with a test that replays the attack from F01.

---

## Phase 1 — The product's one artifact works (claim page)

**Goal:** `https://suisend.xyz/claim/<secret>` loads, looks up the payment, and claims.
**Findings:** F02 (also unblocks F13 note display, F04 refund entry point)
**Requires:** nothing on-chain. Pure frontend. Can ship before Phase 0's upgrade.

**✅ SHIPPED 2026-10-02** (build green, route smoke-tested):
- `src/app/claim/[hash]/page.tsx` — lookup, claim via wallet/zkLogin, all
  terminal states, expired-but-claimable note, success state with Suiscan link.
- `queryPaymentTerminalStatus` in `src/lib/suisend.ts` distinguishes
  claimed / refunded / unknown via events.
- OAuth return-to: Google sign-in from a claim link returns to the link.
- Also fixed en passant: zkLogin prover URL → mainnet (F03 partial);
  pre-existing TS breakage in `Hero.tsx` / `FeatureDetailSection.tsx` that was
  blocking the build.
- Deferred with the contract: Walrus note display needs the v5 on-chain getter (F13).

**Gate (still to run on deploy):** create a real payment on mainnet, open the link
in an incognito window, claim it with a fresh wallet. No copy-pasting hashes into `/app`.

---

## Phase 2 — Claim without a wallet, money back guarantee

**Goal:** the two promises on the landing page become true.
**Findings:** F03 (zkLogin), F04 (refunds)
**Requires:** Phase 0 contract upgrade (claims must use the new `secret` argument).

zkLogin (F03):
- Switch `PROVER_URL` to `https://prover.mystenlabs.com/v1` (mainnet prover).
- Sponsor claim transactions (Shinami Gas Station or self-hosted sponsor) so a
  zero-balance zkLogin address can claim. Without this, zkLogin claim is impossible.
- Check epoch expiry in `getZkLoginState()`; force re-auth with a clear message
  instead of an opaque transaction failure.

Refunds (F04):
- Frontend: "Refund" button on pending/expired payments in `HistoryTab`
  (sender holds `PaymentVoucher` — build `refund_sender_scallop` PTB).
- Agent: `scripts/refund-agent.mjs` — scans `PaymentCreatedEvent`s, calls
  `refund_expired(_generic)` for anything past expiry. Run on a cron.
  Documented in DEPLOYMENT.md.

**Gate:** (1) claim via Google sign-in on a brand-new browser profile with zero SUI.
(2) create a payment with a 60-second expiry, wait, watch the agent refund it.

---

## Phase 3 — Contract hardening (the v5 upgrade)

**Goal:** one upgrade that fixes F01, F05, F06, F07, F08, F09.
**Findings:** F01, F05, F06, F07, F08, F09, and lays groundwork for F10.

- F01: secret/commitment scheme (Phase 0 spec).
- F05: delete `YieldRouterCap`/`EUnauthorizedRebalance` or implement `rebalance`. Fix the AdminCap docstring. No dead capabilities.
- F06: delete the `state` field entirely. Existence in the table **is** ACTIVE; removal is terminal. Fix `payment_state()` fallback to not fabricate CLAIMED.
- F07: move `coin_type` into `PaymentRecord`; delete the dynamic-field hack.
- F08: delete mock `YieldVault` + its 4 entry functions from the production build (keep behind `#[test_only]` in the yield module for tests).
- F09: gate `init_vault_generic` behind `AdminCap`, or create the USDC vault in package `init`.
- F10: emit events with a version-stable type strategy (document the package-ID
  dependency in DEPLOYMENT.md; frontend reads the list from one constant with a comment).

**Gate:** `sui move build` + `sui move test` green; upgrade executed on mainnet;
DEPLOYMENT.md gains a v5 row; frontend constants updated in the same commit.

---

## Phase 4 — Data honesty (frontend)

**Goal:** nothing on screen is a lie.
**Findings:** F11, F12, F13, F14, F15

- F11: per-coin-type totals in stats (SUI total, USDC total), never mixed.
- F12: real yield from `ClaimReceipt`s / vault queries; paginate event queries.
- F13: claim page reads `note_blob_id` from the record and fetches the note from Walrus.
- F14: USDC coin selection queries the zkLogin address when in zk mode; merge coins via `tx.mergeCoins` when needed; raise/remove the 10-coin limit.
- F15: delete dead code (`initZkLogin`, `elapsed`, `init_vault_generic` doc-noise); fix `tx.pure.option` None encoding; pad base64url before `atob`.

**Gate:** manual pass over every number the UI can display: send, claim, history,
stats banner, landing stats — each verified against a Suiscan ground truth.

---

## Phase 5 — Hygiene & proof

**Goal:** the repo tells the truth and can prove it.
**Findings:** F16, F17, F18

- F16: declare `jose`; delete `fastify`, `@fastify/cors`, `better-sqlite3`, `@privy-io/react-auth`.
- F17: tests for the Scallop/generic paths (testnet deployment + PTB e2e script; Move unit tests for the commitment scheme, coin-type-in-record, expiry edges).
- F18: rewrite README to match reality (correct package ID, real feature list); prune FRD/PRD to shipped scope or mark unbuilt sections clearly.

**Gate:** fresh clone → `npm install && npm run build && sui move test` all pass
with no undeclared imports; a stranger can deploy from README alone.

---

## Dependency graph

```
Phase 0 (F01 mitigation) ──┐
                           ├──► v5 upgrade (F01,F05–F09) ──► Phase 2 (F03,F04)
Phase 1 (F02 claim page) ──┘            ▲                        │
                                        │                        ▼
                                        └──────── Phase 4 (F11–F15) ◄── (zk/claim fixes land first)
                                                             │
                                                             ▼
                                                    Phase 5 (F16–F18)
```

Phase 1 (claim page) has **no contract dependency** — start it in parallel with
Phase 0's interim mitigation today.
