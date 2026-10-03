# F01 — Events leak the claim secret; anyone can steal any payment

- **Severity:** P0 (funds at risk, active on mainnet today)
- **Area:** contracts
- **Phase:** 0
- **Status:** ⚠️ Interim mitigation shipped (2026-10-02): `ActivityFeed` removed from the landing page, bearer-link warning added to `SendTab`. **The event leak itself is still live on-chain** — the permanent commitment-scheme fix ships with the v5 upgrade (Phase 3).

## Evidence

`core.move:387` (and the scallop/generic twins at `:742`, `:943`):

```move
event::emit(PaymentCreatedEvent {
    link_hash: copy link_hash,   // ← the bearer credential, in plaintext
    sender: tx_context::sender(ctx),
    amount,
    ...
});
```

Claiming requires **only** the `link_hash` (`core.move:421-447`):

```move
/// ## Who can claim?
/// Anyone who knows the link_hash can claim — the caller is the recipient.
```

Sui events are publicly queryable by any RPC client. The frontend itself
demonstrates the attack in `src/lib/usePaymentEvents.ts:35`:

```ts
await suiClient.queryEvents({
  query: { MoveEventType: `${pkgId}::core::PaymentCreatedEvent` },
  ...
});
```

`parsed.link_hash` is right there in the response.

## Impact

A bot that polls `PaymentCreatedEvent` and immediately submits
`claim_payment_scallop(link_hash)` wins every race against the legitimate
recipient. Every payment created since deployment is claimable by anyone who
reads the event stream. The "secret link" is not secret — it is broadcast at
creation time. This is a total-loss primitive, live on mainnet.

## Root cause

Naming that confused the previous model: `link_hash` is not a hash of a
secret. It **is** the secret (random bytes generated in `suisend.ts:randomHashHex`).
The contract stores it, keys the table by it, emits it, and accepts it as the
sole claim credential. There is no commitment scheme anywhere.

## Fix

Preimage commitment:

1. Frontend generates `secret` (32 random bytes). The claim URL carries `secret`.
2. The on-chain key is `key = sha3_256(secret)`. `create_payment*` stores and
   emits **only** `key`. Events become safe to display publicly.
3. `claim_payment*(secret)` computes `sha3_256(secret)` on-chain and looks up
   the record by that key. `payment_exists/amount/expiry` getters also take the
   key (or the secret and hash it — pick one and be consistent).
4. `PaymentVoucher.link_hash` stores the key (voucher holder is the sender;
   no secrecy needed there).

Changes: `core.move` (all create/claim/refund variants + getters), `suisend.ts`
(`randomHashHex` → `randomSecretHex` + `claimKeyFromSecret` using
`@mysten/sui`'s sha3 helper or `js-sha3`), the new claim page (F02), and
`usePaymentEvents` (now harmless — it only sees key hashes).

## Verification

- Move test: create with key K, attempt claim with wrong secret → abort;
  claim with correct secret → succeeds.
- E2E: create a payment on mainnet, run the attack script from this file's
  Evidence section against it, confirm the bot **cannot** derive the secret
  from the event.
