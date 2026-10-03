# F10 — Four package versions; frontend event queries break on every upgrade

- **Severity:** P1
- **Area:** contracts / frontend
- **Phase:** 3 (with the v5 upgrade)
- **Status:** Open

## Evidence

`constants.ts:15-20`:

```ts
export const SUISEND_ALL_PACKAGE_IDS = [
  SUISEND_ORIGINAL_PACKAGE_ID,   // v1 0xbefd…
  SUISEND_PACKAGE_ID_V2,         // v2 0x8378…
  SUISEND_PACKAGE_ID_V3,         // v3 0x15e9…
  SUISEND_PACKAGE_ID,            // v4 0xcc88…
];
```

DEPLOYMENT.md records v2 and v3 with no TX digests and no dates — unplanned,
undocumented upgrades ("Fixed USDC / SUI vault contracts" committed twice,
identical messages, `git log`).

Event types are stamped with the emitting package version, so after every
upgrade the frontend must query **all historical package IDs** to see the full
history. Every event query in the codebase (`suisend.ts` ×4 call sites,
`usePaymentEvents.ts` ×2) loops over this array.

## Impact

- History, stats, activity feed, and claim lookups silently go stale the
  moment anyone upgrades the package again without remembering to append the
  new ID to this constant.
- Every query is 4× the RPC cost; public fullnode rate limits make this
  flaky under any real traffic.
- The duplicated-commit history shows the team has already fumbled upgrades
  twice.

## Fix

1. Going forward: **events are version-pinned by design** — accept the array,
   but reduce it to a single source of truth with a loud comment:
   `// APPEND NEW PACKAGE ID HERE ON EVERY UPGRADE — history breaks otherwise`.
2. Better: emit a `suisend::events` shadow event from a tiny **immutable
   companion package** that never upgrades, so event queries have one stable
   type forever. (Bigger change; evaluate at v5 design time.)
3. Process: upgrades only via `scripts/upgrade.mjs` + a DEPLOYMENT.md row with
   digest, date, and reason. No more drive-by upgrades.
4. `Published.toml` is the machine-readable record — the frontend should read
   `original-id` semantics from constants with a comment pointing at it.

## Verification

Simulate: upgrade in a test environment, confirm history still loads with the
new ID appended — and that the code review checklist in DEPLOYMENT.md now
includes the constants step.
