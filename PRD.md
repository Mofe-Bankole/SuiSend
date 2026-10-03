# SuiSend — Product Requirements Document

> **Version:** 1.0  
> **Status:** Draft  
> **Author:** OpenCode / SuiSend Team  
> **Last Updated:** 2026-07-12  

---

## 1. Executive Summary

SuiSend is a crypto payment-link application on Sui mainnet that lets anyone send money with a single URL — and the sent funds earn DeFi yield while waiting to be claimed. Every payment link is backed by a real on-chain deposit into Scallop Protocol's lending pool, so the money never sits idle. Recipients claim the original amount plus all accrued interest; unclaimed payments auto-refund to the sender after expiry.

The product targets the $2T+ global remittance and peer-to-peer payment market, differentiating on zero fees, instant settlement, built-in yield, and no bank account required — just a Sui wallet or a Google account (via zkLogin).

---

## 2. Problem Statement

**Current State:**
- Venmo/PayPal/bank transfers: funds sit idle as static IOUs, earn zero yield, charge 1.5–3% fees, settle in 1–3 business days
- Crypto transfers: require recipient to have wallet, same-chain asset knowledge, and technical understanding; no yield while unclaimed
- Cross-border remittances: 5–7% average fees, 2–5 day settlement, bank account required on both ends

**Target User Pain Points:**
1. "I sent money to a friend but it just sits there doing nothing"
2. "I want to pay a freelancer overseas without losing 5% to fees"
3. "I need to send money to someone who doesn't have a crypto wallet"
4. "I want to see my sent payments earning interest in real time"
5. "Group fund organizers want transparency and automatic yield for pooled money"

---

## 3. Vision & Goals

### Product Vision
Make every sent payment earn yield by default — transform idle IOUs into productive assets. Be the Stripe of crypto payment links.

### Strategic Goals
| Goal | Metric | Timeline |
|------|--------|----------|
| **Mainnet launch** | Live on Sui mainnet, first payment created | ✅ Q2 2026 |
| **User adoption** | 1,000 monthly active senders | Q3 2026 |
| **Payment volume** | $100K+ total volume | Q3 2026 |
| **Multi-currency** | SUI + USDC support | ✅ v4 |
| **Mobile UX** | Responsive claim flow via zkLogin | Q3 2026 |
| **API/embed** | Third-party widget integration | Q4 2026 |

### Non-Goals
- Building a custodial wallet
- Supporting fiat on-ramp directly (user brings their own SUI/USDC)
- Cross-chain interoperability (Sui-only for v1)
- KYC/AML compliance (self-custodial, no accounts)

---

## 4. Target Users & Personas

### Persona 1: Crypto-Native Freelancer ("Alex")
- **Demographics:** 28, software engineer, works remotely
- **Behavior:** Holds crypto, uses DeFi, sends/receives USDC for freelance payments
- **Pain:** Clients send late; money sits as static IOU
- **Value Prop:** "Get paid instantly, earn yield while your client's payment waits"

### Persona 2: Cross-Border Remitter ("Maria")
- **Demographics:** 35, sends $200–500/month to family overseas
- **Behavior:** Uses Western Union, pays 7% fees
- **Pain:** High fees, slow settlement, both sides need bank accounts
- **Value Prop:** "Zero fees, instant link, recipient just needs a Google account"

### Persona 3: DAO / Group Treasurer ("David")
- **Demographics:** 42, manages $50K in DAO operational funds
- **Behavior:** Distributes grants, reimburses contributors
- **Pain:** Tracking who was paid, manual reconciliation, no yield on held funds
- **Value Prop:** "Send bulk payments with yield, track all on-chain"

### Persona 4: First-Time Crypto User ("Jamie")
- **Demographics:** 22, no wallet, received a SuiSend link from a friend
- **Behavior:** Uses Google for everything
- **Pain:** Doesn't know what a wallet or gas is
- **Value Prop:** "Claim with Google — no wallet, no gas, no fees"

---

## 5. User Stories

### Payment Creation
| ID | Story | Priority | Status |
|----|-------|----------|--------|
| P-01 | As a sender, I want to connect my Sui wallet so I can fund payments | P0 | ✅ |
| P-02 | As a sender, I want to select SUI or USDC so I can pay in the currency I hold | P0 | ✅ |
| P-03 | As a sender, I want to enter an amount and optional note so the recipient knows what it's for | P0 | ✅ |
| P-04 | As a sender, I want to see a real-time yield estimate so I know what the recipient will earn | P0 | ✅ |
| P-05 | As a sender, I want to generate a shareable link so I can send it via WhatsApp/Text/Email | P0 | ✅ |
| P-06 | As a sender, I want the ability to refund before expiry if I sent to the wrong person | P1 | ⬜ |

### Payment Claim
| ID | Story | Priority | Status |
|----|-------|----------|--------|
| P-07 | As a recipient, I want to open a link and see the payment details without connecting a wallet | P0 | ✅ |
| P-08 | As a recipient, I want to claim using a Sui wallet or Google account | P0 | ✅ |
| P-09 | As a recipient, I want to receive the principal plus all interest earned | P0 | ✅ |
| P-10 | As a recipient, I want an on-chain receipt (NFT) proving I claimed | P0 | ✅ |

### History & Tracking
| ID | Story | Priority | Status |
|----|-------|----------|--------|
| P-11 | As a user, I want to see all payments I've sent with their status (pending/claimed/refunded) | P0 | ✅ |
| P-12 | As a user, I want to see all payments I've claimed with the yield earned | P0 | ✅ |
| P-13 | As a user, I want to see live stats (total volume, payment count) on the landing page | P0 | ✅ |

### Admin & Operations
| ID | Story | Priority | Status |
|----|-------|----------|--------|
| P-14 | As an admin, I want to rotate the refund agent address so I can manage operational keys | P0 | ✅ |
| P-15 | As an agent, I want expired payments to auto-refund to the sender | P1 | ⬜ |

---

## 6. Product Features

### F0: Core Payment Protocol (✅ Live)
- Create payment with SUI/USDC → deposited into Scallop lending pool
- Claim payment → principal + yield returned to recipient
- Sender-initiated refund (before expiry)
- Agent-initiated refund (after expiry)
- Payment expiry mechanism (default 14 days, max 30 days)
- Multi-currency support via generic yield vault (v4)

### F1: Web Application (✅ Live)
- Landing page with live stats, how-it-works, comparison table, roadmap
- Send tab with amount presets, coin toggle, yield estimation
- Claim tab with payment lookup and claim flow
- History tab with sent/received filter
- Wallet connection via `@mysten/dapp-kit`
- zkLogin via Google OAuth
- TxStatusOverlay for transaction feedback

### F2: Yield Integration (✅ Live)
- Scallop Protocol deposit/withdraw for both SUI and USDC
- Real-time APY display from Scallop market data
- Mock yield module for testability

### F3: Walrus Storage (✅ Live)
- Optional note text stored on Walrus (decentralized blob storage)
- Water-visible on claim flow
- Best-effort upload (graceful fallback)

### F4: zkLogin Authentication (✅ Live)
- Google OAuth sign-in
- Server-side salt derivation
- ZK proof generation proxied to Mysten Labs prover
- Ephemeral keypair management in sessionStorage
- Claim via Google without any wallet

---

## 7. Roadmap

### Phase 1: Foundation (✅ Complete)
- Core Move contracts (create, claim, refund)
- Scallop yield integration
- Web app (send/claim/history)
- Mainnet deployment (v1–v4)
- USDC support (v4)

### Phase 2: Growth (Q3 2026)
- Off-chain refund agent cron service
- `claim/[link_hash]` route for direct-link claiming
- Email notification delivery
- Multi-language support
- Transaction history export
- Analytics dashboard for senders

### Phase 3: Expansion (Q4 2026)
- API / widget for third-party embedding (business payments)
- Additional yield protocols (Navi, DeepBook)
- More zkLogin providers (Apple, Facebook)
- Mobile native app (React Native)
- Bulk payment creation
- Recurring payments

### Phase 4: Monetization (Q1 2027)
- Premium API tier for businesses (volume-based pricing)
- Optional expedited claim (gas sponsorship)
- Enterprise dashboard
- Custom branding for business payment links

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Total payment volume | $100K+ | On-chain events |
| Payments created | 5,000+ | PaymentCreatedEvent count |
| Claim rate | >60% | Claimed vs total created |
| Avg yield earned per payment | >0.5% | PaymentClaimedEvent yield_earned |
| zkLogin usage | >30% of claims | ClaimReceipt address derivation |
| Landing page → Send conversion | >5% | Frontend analytics |
| Uptime | >99.9% | Vercel status |

---

## 9. Competitive Landscape

| Feature | SuiSend | PayPal/Venmo | Bank Transfer | Other Crypto Links |
|---------|---------|--------------|---------------|-------------------|
| Zero platform fees | ✅ | ❌ (1.5–3%) | ❌ (varies) | ~$0.001 gas only |
| Instant settlement | ✅ | ❌ (1–3 days) | ❌ (1–5 days) | ✅ |
| Funds earn yield while waiting | ✅ (Scallop) | ❌ | ❌ | ❌ |
| No bank/wallet required for recipient | ✅ (zkLogin) | ❌ | ❌ | ❌ |
| Self-custodial | ✅ | ❌ | ❌ | Varies |
| On-chain receipts (NFT) | ✅ | ❌ | ❌ | ❌ |
| Global (no borders) | ✅ | ❌ | ❌ | ✅ |
| Recurring payments | ⬜ Planned | ✅ | ✅ | ❌ |

---

## 10. Technical Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser    │────▶│  Next.js 16  │────▶│  Sui Mainnet    │
│  (User)      │     │  (Vercel)    │     │  (Smart Contracts)│
└─────────────┘     └──────┬───────┘     └────────┬────────┘
                           │                       │
                           ▼                       ▼
                    ┌──────────────┐     ┌─────────────────┐
                    │  Scallop SDK │     │  Walrus Storage  │
                    │  (APY/Data)  │     │  (Notes)         │
                    └──────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Mysten Labs │
                    │  zkProver    │
                    └──────────────┘
```

### On-Chain Modules
- **core.move** — Payment lifecycle: create, claim, refund, admin
- **yield.move** — Yield abstraction + mock module
- **yield_scallop.move** — Scallop protocol integration
- **walrus.move** — Blob ID wrapper type
- **External:** Scallop Protocol, Sui Framework

### Frontend Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** Tailwind CSS v4, Framer Motion
- **Blockchain:** @mysten/dapp-kit, @mysten/sui v2
- **DeFi:** @scallop-io/sui-scallop-sdk
- **Auth:** zkLogin (custom), Google OAuth
- **State:** TanStack React Query, React state
- **Deployment:** Vercel
- **Domain:** suisend.xyz (Namecheap)

---

## 11. Constraints & Assumptions

### Constraints
- Sui mainnet only (no cross-chain)
- SUI and USDC only (no fiat)
- Recipient needs internet access to claim
- Gas costs borne by sender (create) and recipient (claim)
- 14-day default expiry; max 30 days
- Max note length: 120 characters
- No fee mechanism in contract (zero-fee model)

### Assumptions
- Users hold SUI or USDC in a Sui wallet
- Scallop Protocol remains solvent and operational on Sui
- Walrus storage service remains available
- zkLogin prover service remains available
- Sui network maintains sub-second finality
- Mobile browser UX is sufficient for MVP (no native app)

---

## 12. Open Questions
1. Should we introduce a protocol fee (e.g., 0.1% on claim) for sustainability?
2. What minimum payment amount makes sense given gas costs (~$0.001)?
3. Should we add email delivery of claim links?
4. How do we prevent spam/brute-force of link hashes?
5. Should we support crypto-to-fiat conversion at claim time?

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **SUI** | Native token of Sui blockchain |
| **USDC** | USD Coin (Wormhole bridged on Sui) |
| **Scallop** | DeFi lending protocol on Sui |
| **sSUI / sUSDC** | Yield-bearing Scallop receipt tokens |
| **zkLogin** | Sui-native OAuth authentication |
| **Walrus** | Decentralized blob storage on Sui |
| **PaymentVoucher** | On-chain capability for sender refund |
| **ClaimReceipt** | NFT proof of claim |
| **PTB** | Programmable Transaction Block |
| **MIST** | Smallest unit of SUI (1 SUI = 10^9 MIST) |
| **APY** | Annual Percentage Yield |
| **Expiry** | Time after which payment auto-refunds (ms since epoch) |
