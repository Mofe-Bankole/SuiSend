# F04 — The promised auto-refund is vaporware

- **Severity:** P0 (safety-net promise is false; funds can strand)
- **Area:** contracts / ops / frontend
- **Phase:** 2
- **Status:** Open

## Evidence

README: *"If unclaimed after 14 days, the sender gets everything back —
principal + yield."* DemoSection: *"30-day auto-refund with all yield if
unclaimed."*

On-chain, two refund functions exist (`refund_sender*` requires the sender's
`PaymentVoucher`; `refund_expired*` requires an off-chain agent holding
`RefundAgentCap`).

Reality:

1. **No agent exists.** `scripts/` contains only `upgrade.mjs`. Nothing,
   anywhere, calls `refund_expired`. `RefundAgentCap` sits in the deployer
   wallet doing nothing.
2. **No refund UI.** Grepping `SendTab`/`ClaimTab`/`HistoryTab` for "refund"
   finds nothing. The sender cannot even *manually* refund from the product.

## Impact

If a recipient never claims (wrong email, lost link, ghosting), the sender's
money sits in Scallop indefinitely. The only escape is hand-building a PTB
against `refund_sender_scallop` — beyond any normal user. The marketing
promise inverts the actual behavior.

## Fix

1. **Refund UI** (`HistoryTab`): for each pending payment the sender owns,
   show "Refund" once expired (and optionally a "cancel early" pre-expiry).
   The sender's `PaymentVoucher` is already in their wallet — build
   `refund_sender_scallop` / `refund_sender_generic` PTBs
   (`buildRefundSenderPTB` in `suisend.ts`).
2. **Agent** (`scripts/refund-agent.mjs`): wallet holding `RefundAgentCap`;
   hourly cron; paginate `PaymentCreatedEvent`s, `devInspect` `payment_expiry`,
   call `refund_expired_scallop`/`_generic` for anything past due. Log digests.
   Document the wallet + cron in `DEPLOYMENT.md`.
3. Keep the doc honest: refunds are *agent-assisted*, not automatic protocol
   magic — say "auto-refund after expiry (agent-run)" until the agent has
   proven uptime.

## Verification

Create a payment with `MIN_LOCKUP_MS` (60 s) expiry on mainnet. Wait 2
minutes. Watch the agent refund it (digest logged). Then repeat the manual
flow from the History tab with a second payment. Both paths must return
principal + yield to the sender.
