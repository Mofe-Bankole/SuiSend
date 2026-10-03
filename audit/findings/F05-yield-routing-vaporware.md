# F05 — `YieldRouterCap` authorizes nothing; AdminCap docstring lies

- **Severity:** P0 (advertised capability does not exist; capability surface is fiction)
- **Area:** contracts
- **Phase:** 3
- **Status:** Open

## Evidence

`core.move:204`:

```move
/// Authorizes the off-chain agent to rebalance yield positions across
/// different protocols (e.g., move funds from Scallop to Navi when
/// Navi offers a better APY).
public struct YieldRouterCap has key, store { id: UID, agent: address }
```

There is **no rebalance function** anywhere in the package. The cap gates zero
entry points. `EUnauthorizedRebalance` (`:93`) is never used (the compiler
warns about it). `rotate_yield_router` rotates a key for a function that
doesn't exist.

Same pattern in the AdminCap docstring (`:188`): *"controls upgrade, pause,
and agent key management"* — there is **no pause function** in the package.
`yield.move:173` accepts `protocol = 1 (Scallop)` and `2 (Navi)` in the mock
`deposit()` and treats both identically to the mock — the "protocol routing"
the module docstring advertises does not exist.

## Impact

- Roadmap/marketing ("AI yield routing agent") is wired to a capability that
  authorizes nothing.
- Operationally worse: the team believes it has a pause switch for an incident.
  It does not.
- Dead capabilities minted in `init` expand the attack surface for no benefit.

## Fix

Decide, then delete or implement — no third option:

1. **Delete** (recommended for the next upgrade): drop `YieldRouterCap`,
   `EUnauthorizedRebalance`, `rotate_yield_router`. Correct the AdminCap
   docstring to what it actually does (agent rotation).
2. **Implement** (only if multi-protocol is actually next): `rebalance<T>`
   that withdraws from one vault and deposits to another, gated by the cap —
   with events and tests. Do not ship the cap before the function.

Also add a real `pause` flag on `PaymentBook` checked by create/claim, or
remove the word from the docstring. In an incident, the honest options today
are: none. Say so or build it.

## Verification

`grep -rn "YieldRouterCap\|pause" sources/` returns only live, tested code
paths. Docstrings compile-matched to behavior.
