# F18 — Documentation drift: README, FRD/PRD describe a product that doesn't exist

- **Severity:** P3
- **Area:** docs
- **Phase:** 5
- **Status:** Open

## Evidence

- `README.md:56` documents package `0xbefd…` (v1) as "the" contract; the app
  uses v4 `0xcc88…`. The address table omits the USDC vault entirely.
- `README.md:48` lists "zkLogin — Google OAuth (no wallet required)" as
  shipped. F03: it cannot execute on mainnet.
- `README.md:104` roadmap claims "Done — … zkLogin scaffolding" while the
  claim route (F02) — more fundamental — is missing entirely.
- `FRD.md` (32 KB) and `PRD.md` (13 KB) — dated Jul 12, after most of the
  code — specify email notifications, business dashboards, and other
  unbuilt features in the voice of shipped requirements.
- `DEPLOYMENT.md` is the only accurate doc (correct v4 row, real digests) —
  and it's the one nobody updated the README from.

## Impact

A new contributor (or auditor, or judge, or the team in 3 weeks) reads the
README and models a system that does not exist. Trust in every other document
erodes. Hackathon judges who tested the README's claims hit 404s and broken
zkLogin — this plausibly already cost the project.

## Fix

1. README rewrite driven from DEPLOYMENT.md: current package ID, USDC vault
   row, honest feature list (link to this audit for known-limitations until
   fixed).
2. FRD/PRD: either prune to shipped scope or tag every section
   `[shipped]` / `[planned]` — no third state.
3. Add a `docs/KNOWN-ISSUES.md` pointer to `audit/` until Phase 5 closes.
4. Rule going forward: a doc section ships in the same PR as the feature it
   describes.

## Verification

Read README top-to-bottom as a stranger: every command runs, every link
resolves, every "Done" feature demonstrably works on mainnet.
