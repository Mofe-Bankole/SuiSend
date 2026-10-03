# F19 — Claim links are pure bearer instruments; no recipient authorization

- **Severity:** P0 (product-design-level; affects every payment)
- **Area:** contracts / product design
- **Phase:** 3 (v5 upgrade)
- **Status:** 🔶 Fixed in code (2026-10-02, pending deployment): all three modes implemented in `PaymentRecordV2` — bearer / PIN (`pin_hash`, preimage checked at claim) / address lock (`recipient_lock`, sender checked at claim). 8/8 unit tests green: wrong-PIN, missing-PIN, thief-with-secret, locked+PIN combo all abort; legitimate claims pass. Frontend (mode picker + PIN prompt) is the remaining work.

## Evidence

The user raised this at conceptualization: a claim link
(`suisend.xyz/claim/0x…`) is cash. Anyone who obtains it — forwarded,
intercepted, shoulder-surfed, or scraped from events (F01) — claims the
funds, and the *intended* recipient has no recourse, no proof, and no
verification step. The contract asks only "do you know the secret?"; it
never asks "are you the person this was for?"

Distinct from F01: F01 is a leak (the secret is broadcast in events).
This finding is the *model* — even with a perfectly-kept secret, possession
= ownership.

## Decision (2026-10-02)

Per-link authorization mode, chosen by the sender at creation:

| Mode | On-chain mechanism | UX |
|------|-------------------|----|
| `AUTH_BEARER` (0) | commitment key only (F01 fix still applies) | like cash — small sends |
| `AUTH_PIN` (1) | `pin_hash = blake2b256(pin)` on record; claim requires preimage | link via one channel, PIN via another |
| `AUTH_LOCKED` (2) | `recipient_lock: Option<address>`; claim asserts `ctx.sender == lock` | known recipient (address or SuiNS) |

Rejected: sender-approval two-phase claims (latency kills send-and-forget);
server-signed OTP gate (backend trust point + infra; revisit with sponsored
claims in Phase 2). Address-binding can't work for Google/zkLogin recipients
(a zkLogin address can't be derived from an email — the `sub` only exists in
the recipient's JWT), so PIN mode is the path for no-wallet recipients.

## Fix (v5 upgrade)

1. `PaymentRecordV2` gains `recipient_lock: Option<address>` and
   `pin_hash: Option<vector<u8>>`.
2. `claim_payment_v2*` takes `secret` + `pin: Option<vector<u8>>`; asserts
   lock and/or PIN preimage before withdrawal.
3. Events carry `auth_mode` (never the secret, never the PIN).
4. Frontend: send-flow mode picker; claim page renders a PIN prompt when
   `auth_mode == 1` and a wallet-locked notice when `auth_mode == 2`.

## Verification

- Move tests: bearer OK; wrong-PIN aborts; missing-PIN aborts; correct PIN
  OK; locked-to-other-address aborts; locked-to-caller OK.
- E2E: PIN link claimed with correct PIN; wrong PIN fails on-chain; locked
  link rejects a different wallet even with the secret.
