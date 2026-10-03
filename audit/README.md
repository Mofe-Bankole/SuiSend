# SuiSend Audit — Index

**Audit date:** 2026-10-02
**Audited state:** `HEAD` (commit `f700771`), contracts v4 (`0xcc884580…`), frontend as deployed to suisend.xyz
**Scope:** `sources/*.move`, `tests/*.move`, `src/**`, `scripts/`, package/dependency config, docs vs. reality.

This directory is the canonical record of everything wrong with SuiSend and the plan to fix it.
Each finding is a file in [`findings/`](./findings). The remediation order is in [`PLAN.md`](./PLAN.md).

---

## Severity legend

| Level | Meaning |
|-------|---------|
| **P0** | Funds at risk, or a core product promise is non-functional. Fix before any user touches this. |
| **P1** | Contract bugs: wrong state, storage leaks, dead-but-live code on mainnet. |
| **P2** | Frontend bugs: wrong data shown to users, broken flows. |
| **P3** | Process: dependencies, tests, docs, hygiene. |

## Findings

| ID | Title | Severity | Area | Phase | Status |
|----|-------|----------|------|-------|--------|
| [F01](./findings/F01-events-leak-claim-secret.md) | `PaymentCreatedEvent` broadcasts the claim secret; anyone can steal any payment | P0 | contracts | 0 | ⚠️ Mitigated (interim) |
| [F02](./findings/F02-claim-route-missing.md) | `/claim/[hash]` page does not exist — every generated link 404s | P0 | frontend | 1 | ✅ Fixed |
| [F03](./findings/F03-zklogin-broken-on-mainnet.md) | zkLogin uses dev prover, has no gas path, sessions rot silently | P0 | infra/frontend | 2 | 🔶 Partial (prover fixed) |
| [F04](./findings/F04-refund-path-missing.md) | Promised auto-refund is vaporware: no agent, no refund UI | P0 | contracts/ops/frontend | 2 | Open |
| [F05](./findings/F05-yield-routing-vaporware.md) | `YieldRouterCap` authorizes nothing; "pause" documented but absent | P0 | contracts | 3 | Open |
| [F06](./findings/F06-payment-state-fiction.md) | `PaymentRecord.state` never transitions; refunded shows as "Claimed" | P1 | contracts | 3 | Open |
| [F07](./findings/F07-coin-type-df-leak.md) | Coin-type dynamic field never removed — storage leak + latent abort | P1 | contracts | 3 | Open |
| [F08](./findings/F08-mock-vault-on-mainnet.md) | Zero-yield mock vault entry functions live on mainnet | P1 | contracts | 3 | Open |
| [F09](./findings/F09-permissionless-vault-init.md) | Anyone can spawn competing `ScallopYieldVaultGeneric<T>` vaults | P1 | contracts | 3 | Open |
| [F10](./findings/F10-package-id-sprawl.md) | 4 package versions; frontend event queries break on every upgrade | P1 | contracts/frontend | 3 | Open |
| [F11](./findings/F11-stats-decimal-confusion.md) | Public stats sum SUI (9-dec) + USDC (6-dec) as one number | P2 | frontend | 4 | Open |
| [F12](./findings/F12-history-fake-zeros.md) | Sent history hardcodes `yieldEarned: "0"`, `note: ""`; capped at 50 | P2 | frontend | 4 | Open |
| [F13](./findings/F13-walrus-notes-write-only.md) | Notes stored on Walrus but never read back; `walrus.move` unused | P2 | contracts/frontend | 4 | Open |
| [F14](./findings/F14-usdc-send-broken.md) | USDC send fails under zkLogin; first-of-10 coin picking, no merge | P2 | frontend | 4 | Open |
| [F15](./findings/F15-dead-code-encoding-bugs.md) | Dead functions, unused vars, `Some([])` vs `None`, fragile base64 | P2 | frontend | 4 | Open |
| [F16](./findings/F16-dependency-hygiene.md) | `jose` imported but undeclared; 4 declared deps never imported | P3 | infra | 5 | Open |
| [F17](./findings/F17-no-tests-on-prod-path.md) | All 8 tests target the mock vault; Scallop/generic paths untested | P3 | contracts/tests | 5 | Open |
| [F18](./findings/F18-docs-drift.md) | README lists stale package; FRD/PRD describe features that don't exist | P3 | docs | 5 | Open |

## The one-line diagnosis

The contracts are one event emission away from a drain, the one artifact the product
produces (the claim link) leads to a 404, the signature UX promise (claim without a
wallet) cannot execute on mainnet, and the safety net (refund) exists only in
marketing copy. Everything else is cleanup behind those four facts.

See [PLAN.md](./PLAN.md) for the fix order.
