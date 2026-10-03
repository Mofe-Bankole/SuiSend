# F06 — `PaymentRecord.state` is write-only fiction

- **Severity:** P1
- **Area:** contracts (surfaced in frontend)
- **Phase:** 3
- **Status:** 🔶 Fixed in code (2026-10-02, pending deployment): `PaymentRecordV2` has no `state` field — existence in the table IS active; removal is terminal. Terminal truth comes from `PaymentClaimedEventV2` / `PaymentRefundedEventV2`. (Struct layouts are frozen under the compatible upgrade policy, so v1 records keep their vestigial field; v2 path eliminates it.)

## Evidence

`core.move:137` declares `state: u8` with three constants (`STATE_ACTIVE=0`,
`STATE_CLAIMED=1`, `STATE_REFUNDED=2`). Every create sets `STATE_ACTIVE`.
**No code path ever writes CLAIMED or REFUNDED** — claim and refund
`table::remove` the record instead. `STATE_REFUNDED` is literally unused
(compiler warning).

The query function then fabricates state (`:656-665`):

```move
public fun payment_state(book: &PaymentBook, link_hash: vector<u8>): u8 {
    if (table::contains(...)) { ...state } else {
        STATE_CLAIMED   // ← "reasonable default" — it's a lie
    }
}
```

The frontend compounds it (`suisend.ts:507-511`): `!exists → "claimed"`.
A refunded payment displays in the sender's history as **"Claimed"**.

## Impact

- Users are told refunded money was claimed — a trust-destroying lie in a
  money app.
- `state` occupies storage in every record while conveying zero information.
- The frontend has no way to distinguish the two terminal states (claimed vs
  refunded) from chain data via this function.

## Fix

1. Delete the `state` field and all three constants from `PaymentRecord`.
   Existence in the table **is** ACTIVE; removal **is** terminal.
2. Delete `payment_state()` (or make it return `bool` = `payment_exists`).
3. Terminal-state truth comes from events: `PaymentClaimedEvent` vs
   `PaymentRefundedEvent` (both already emitted with `initiator`). The
   frontend already fetches claimed events for timestamps — extend the same
   map to refunded events and derive status correctly:
   `exists → pending`, `in refunded-events → refunded`,
   `in claimed-events → claimed`.
4. Remove the `{3: "expired"}` map entry in `suisend.ts` (`PAYMENT_STATE`) —
   "expired" was never an on-chain state either; expiry is a clock comparison,
   compute it client-side from `expiry`.

## Verification

History shows "Refunded" for an agent-refunded payment and "Claimed" for a
claimed one — verified against the two event types on Suiscan. `sui move build`
emits no unused-constant warnings.
