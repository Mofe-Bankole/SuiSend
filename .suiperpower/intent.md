# Intent, 2026-06-13

## One-sentence summary
Payment links on Sui where the sender's funds earn DeFi yield (via Scallop) while unclaimed, so idle money stops being idle.

## Problem and audience
- Problem: Every payment link today (Venmo, PayPal, crypto) sits as static value. The sender loses opportunity cost while the recipient delays claiming.
- Audience: Crypto-native users on Sui who want to send money to friends/family without losing yield. Also non-crypto users who receive payments via a simple claim link (zkLogin).
- Core valuable shape: The claimable amount goes up over time, not down. Yield accrues transparently and atomically with the payment.

## On-chain shape
- User-held Objects: `Payment` (sender holds, tracks deposited amount + recipient + yield), `ClaimReceipt` (recipient gets after claiming, proof of claim)
- Protocol-held shared Objects: None initially. Yield position is managed via Scallop's shared objects.
- Capabilities: `AdminCap` (protocol owner — pause, upgrade, fee config). `TreasuryCap` not needed since we use SUI directly (no custom coin).
- Move modules expected: 2-3 — `payment` (core create/claim/refund logic), `yield` (Scallop deposit/withdraw wrapper + agent routing), optionally `storage` (Walrus blob for payment metadata)
- PTB composability: Single-tx flow for create (deposit to Scallop + record Payment object) and claim (withdraw from Scallop + transfer to recipient + delete Payment). Refund is also single-tx (withdraw + return to sender).

## Off-chain shape
- Frontend: Next.js (already scaffolded) with Tailwind v4
- Auth: Both wallet adapter (@mysten/dapp-kit) and zkLogin — wallet for senders, zkLogin for non-crypto claimers
- Off-chain services: Yield-routing agent (scans Sui DeFi protocols for best APY, auto-rebalances), indexer (queryable history of payments/claims)

## Sponsor integrations (load-bearing only)
- Scallop: Core yield source. Every payment deposits into and withdraws from Scallop's lending pool. Load-bearing.
- Walrus: Payment metadata storage (notes, receipt blobs). Load-bearing — not decorative.

## Network and upgrade authority
- Target network at launch: testnet (Sui Overflow 2026 submission)
- Upgrade authority intent: keep solo for iteration during hackathon
- Package id capture plan: stored in `.env`, committed for the team

## Success criteria
1. User can connect wallet, create a payment link with an amount + optional note, and the SUI is deposited into Scallop on testnet — observable via Explorer + Scallop dashboard
2. Recipient can open the claim link (with or without a Sui wallet via zkLogin), claim the original amount + accrued yield, observable on testnet
3. If unclaimed for 30 days, sender can refund and receive original amount + all accrued yield
4. Landing page + working demo + polished submission ready for Sui Overflow judging

## Out of scope
- Multi-currency (SUI only for v1)
- Mobile app (web-only)
- Custom SUI-derivative token (native SUI only)

## Constraints
- Deadline: Sui Overflow 2026 cutoff (TBD — but aiming for working demo ASAP)
- Risk tolerance: Hackathon demo / testnet pilot
- Existing assets: Next.js scaffold with Tailwind v4, landing page UI, @mysten/dapp-kit + @scallop-io/sui-scallop-sdk in dependencies

## Open questions for the user
- Exact object schema for `Payment`: what fields (sender, recipient address or claim-link hash, deposited amount, Scallop obligation id, timestamps)?
- Refund trigger: time-based (30-day expiry auto-refund via a cron/agent) or manual (sender clicks "refund" after 30 days)?
- Walrus blob shape: what metadata gets stored (note text, optional receipt)?
- zkLogin integration: just for claiming, or also for sending?
