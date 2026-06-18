# Suisend — Complete Product Breakdown for Video Script

## 🪙 What Is Suisend?

A crypto payment app on **Sui mainnet** where every payment link you send automatically earns DeFi yield while waiting to be claimed. The money never sits idle.

**Tagline:** *"Send money. It earns while they wait."*

**The mental model shift:** Every payment link is a mini DeFi vault. When you send $100, it starts earning interest before the recipient even opens it. That's never been possible before.

---

## ⚡ Core Problem

Traditional payments (PayPal, Venmo, bank transfer, crypto transfers) sit as dead IOUs once sent. Zero yield, zero utility. If your recipient delays opening the app, your money is doing *nothing*.

| Payment method | Earns yield while pending | Self-custodial | No account needed to receive | Auto-refund with interest | Zero platform fees |
|---|---|---|---|---|---|
| **SuiSend** | ✅ | ✅ | ✅ | ✅ | ✅ |
| PayPal | ❌ | ❌ | ❌ | ❌ | ❌ |
| Venmo | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bank Transfer | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js 16)                     │
│  @mysten/dapp-kit · Tailwind CSS · shadcn/ui · Framer Motion    │
│                        Vercel (suisend.xyz)                      │
├─────────────────────────────────────────────────────────────────┤
│                        Smart Contracts (Sui Move)                │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │ core.move │  │ yield.move   │  │yield_scallop │  │walrus   │ │
│  │(lifecycle)│  │(mock yield)  │  │ (Scallop)    │  │ (blobs) │ │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘  └────┬────┘ │
│       │               │                │                │       │
│       └───────────────┴────────────────┘                │       │
│                           │                             │       │
│                    ┌──────┴──────┐              ┌───────┴──────┐ │
│                    │Scallop Lend │              │    Walrus    │ │
│                    │ (sSUI mint) │              │   Publisher  │ │
│                    └─────────────┘              └──────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                            Sui Mainnet                           │
│  Package: 0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📜 Smart Contract Deep Dive (Sui Move, 848 lines + 464 lines across modules)

### 👑 Module: `core.move` (848 lines) — The Payment Lifecycle

#### Objects (the on-chain data model)

| Object | Type | Purpose |
|---|---|---|
| **`PaymentBook`** | Shared singleton | The central registry. A shared `Table<vector<u8>, PaymentRecord>` mapping 32-byte link hashes → payment records. Anyone who knows the link hash can look up or claim a payment. |
| **`PaymentRecord`** | Table entry (not an Object) | Stores link_hash, sender address, amount (in MIST), Scallop position_id, protocol ID, created_at, expiry timestamp, state (active/claimed/refunded), optional Walrus blob ID, optional recipient address. Lives *inside* the PaymentBook table. |
| **`PaymentVoucher`** | Owned by sender | A lightweight capability object proving the sender created a payment. Required for manual refunds before expiry. Burned when used. |
| **`ClaimReceipt`** | Owned by recipient | NFT-like proof of claim containing payment_link_hash, original_amount, yield_earned, total_claimed, claimed_at, recipient address. Appears in the recipient's wallet. |
| **`AdminCap`** | Owned by deployer | Admin control for rotating agent keys. |
| **`RefundAgentCap`** | Owned by off-chain agent | Authorizes the agent to call `refund_expired` on payments past their expiry. Agent address can be rotated by admin. |
| **`YieldRouterCap`** | Owned by off-chain agent | Future: authorizes rebalancing yield positions across protocols (e.g., Scallop → Navi). |

#### Constants

| Constant | Value | What it does |
|---|---|---|
| `MAX_LOCKUP_MS` | 2,592,000,000 (30 days) | Hard cap on how long funds can be locked |
| `MIN_LOCKUP_MS` | 60,000 (60 seconds) | Prevents instant-expiry payments |
| `STATE_ACTIVE` | 0 | Payment is live and earning yield |
| `STATE_CLAIMED` | 1 | Payment has been claimed |
| `STATE_REFUNDED` | 2 | Payment has been refunded |

#### Error Codes

| Code | Constant | When it fires |
|---|---|---|
| 1 | `EUnauthorized` | Wrong caller tries to refund |
| 2 | `EWrongState` | Claiming a claimed/refunded payment |
| 3 | `ENotYetExpired` | Agent tries refund before expiry |
| 4 | `ELinkHashNotFound` | Link hash doesn't exist in PaymentBook |
| 5 | `ELinkHashAlreadyExists` | Hash collision on create |
| 6 | `EInvalidExpiry` | Expiry outside [60s, 30d] range |
| 7 | `EUnauthorizedRebalance` | Unauthorized yield routing |

#### Events (indexed off-chain)

| Event | Fields | Emitted when |
|---|---|---|
| `PaymentCreatedEvent` | link_hash, sender, amount, protocol, created_at, expiry | A new payment link is created |
| `PaymentClaimedEvent` | link_hash, recipient, amount, yield_earned, claimed_at | A payment is claimed |
| `PaymentRefundedEvent` | link_hash, sender, amount, yield_earned, refunded_at, initiator | A payment is refunded (by sender or agent) |

#### Entry Functions (8 total — 4 mock, 4 Scallop)

**Create** (`create_payment` / `create_payment_scallop`):
1. Validates link_hash uniqueness, expiry range
2. Reads coin value (records amount)
3. Calls `yield::deposit` or `yield_scallop::deposit_scallop` to send SUI into Scallop
4. Inserts `PaymentRecord` into `PaymentBook` table
5. Creates `PaymentVoucher` → transfers to sender
6. Emits `PaymentCreatedEvent`

**Claim** (`claim_payment` / `claim_payment_scallop`):
1. Removes `PaymentRecord` from table (aborts if not found)
2. Asserts state == ACTIVE
3. Calls `yield::withdraw` — returns Coin<SUI> with principal + yield
4. Calculates yield = total - principal
5. Transfers Coin to recipient, creates `ClaimReceipt`, emits event

**Refund (sender)** (`refund_sender` / `refund_sender_scallop`):
1. Verifies caller matches voucher.sender
2. Burns the voucher (deletes the object)
3. Removes record, withdraws from yield, sends all back to sender

**Refund (agent)** (`refund_expired` / `refund_expired_scallop`):
1. Verifies caller matches cap.agent
2. Verifies now >= record.expiry
3. Same withdrawal flow, sends to sender, emits event with initiator = "agent"

#### Read-only Query Functions

| Function | Returns |
|---|---|
| `payment_exists()` | bool — whether link_hash is in the table |
| `payment_sender()` | address (0x0 if not found) |
| `payment_amount()` | u64 (0 if not found) |
| `payment_expiry()` | u64 (0 if not found) |
| `payment_state()` | u8 (returns CLAIMED=1 if not found — sensible default) |
| `active_payment_count()` | u64 — number of active payments |

---

### 💰 Module: `yield.move` (286 lines) — Yield Abstraction Layer

**Purpose:** An abstraction layer over lending protocols so `core.move` never knows which protocol backs each position. Deposit/withdraw calls route through this module.

**Mock vault:** Holds raw SUI `Balance` in a shared `YieldVault`. Interest formula is:
```
interest = principal * APY_bps / BPS_DENOM * elapsed_ms / MS_IN_YEAR
```
With `MOCK_APY_BPS = 820` (8.2% APY). Currently interest is set to 0 (the real yield comes from Scallop). The formula is preserved for audit inspection.

**Protocol IDs:**
- 0 = Mock (devnet/testing)
- 1 = Scallop (mainnet — live)
- 2 = Navi (future stretch goal)

---

### 🏦 Module: `yield_scallop.move` (178 lines) — Scallop Integration

**This is the real yield engine.** The module that talks to Scallop Protocol.

**How it works:**
1. `deposit_scallop()` — Calls `protocol::mint::mint<SUI>` to convert SUI → sSUI (Scallop's yield-bearing receipt token). The sSUI is stored in the vault's `scoin_balance`. Records principal (original SUI amount) and scoin_amount (sSUI received).
2. `withdraw_scallop()` — Takes sSUI from the vault's balance, calls `protocol::redeem::redeem<SUI>` to convert sSUI → SUI (+ accrued yield). The returned Coin<SUI> contains **principal + interest**. Calculates `interest = total_value - principal`.

**Key insight:** sSUI appreciates against SUI over time (1 sSUI → >1 SUI as yield accrues). The vault holds sSUI, not raw SUI. The amount of sSUI minted ≈ principal at deposit time. When withdrawn later, that same sSUI amount redeems for more SUI.

**Shared objects required:**
- `Version` (Scallop protocol version — singleton)
- `Market` (Scallop market — singleton for managing pool state)
- `Clock` (Sui system clock)

---

### 📦 Module: `walrus.move` (44 lines) — Decentralized Note Storage

A thin wrapper around Walrus blob IDs. Stores optional notes from the sender on Walrus decentralized storage.

- `WalrusBlobId` struct wraps raw `vector<u8>` bytes (typed wrapper for readability)
- `from_bytes()` / `to_bytes()` — convert between raw bytes and typed wrapper
- Upload happens **off-chain** (frontend PUTs to Walrus publisher)
- Blob ID is passed into `create_payment_scallop` as `note_blob_id: Option<vector<u8>>`

---

## 🧪 Tests (`core_tests.move`, 433 lines, 5 test scenarios)

| Test | What it covers | Expected behavior |
|---|---|---|
| `test_create_and_claim` | Full happy path: admin initializes → sender creates payment → recipient claims | Everything succeeds, ClaimReceipt transferred to recipient |
| `test_sender_refund` | Sender creates payment, then refunds via PaymentVoucher before expiry | Voucher burned, funds returned |
| `test_agent_refund_expired` | Payment created, clock advanced past expiry, agent refunds using RefundAgentCap | Funds returned to sender with "agent" initiator |
| `test_double_claim_fails` | Same payment claimed twice | Second claim aborts with error |
| `test_wrong_link_hash_fails` | Attempt to claim with different link_hash | Aborts with ELinkHashNotFound |

---

## 🖥️ Frontend Architecture

### Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (Turbopack, App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Animations | Framer Motion |
| Wallet | `@mysten/dapp-kit` (SuiClientProvider, WalletProvider) |
| Sui SDK | `@mysten/sui` v2.17 |
| Yield SDK | `@scallop-io/sui-scallop-sdk` |
| Query | `@tanstack/react-query` |
| Hosting | Vercel |
| Domain | suisend.xyz (Namecheap) |

### Key Frontend Files

**`src/lib/suisend.ts`** (271 lines) — The bridge between frontend and smart contracts.
- `buildCreatePaymentScallopPTB()` — Builds a Programmable Transaction Block (PTB) that calls `core::create_payment_scallop` with the correct args: PaymentBook ID, ScallopYieldVault, split coin, link hash (as `vector<u8>`), optional Walrus blob ID, expiry offset (default 14 days), Scallop Version, Scallop Market, Clock.
- `buildClaimPaymentScallopPTB()` — PTB calling `core::claim_payment_scallop`.
- `lookupPayment()` — Calls 5 read-only view functions via `devInspectTransactionBlock` to check if a payment exists, get amount, expiry, state, and sender. Returns parsed results.
- `queryUserSentPayments()` — Queries `PaymentCreatedEvent` events filtered by sender address to show payment history.
- `queryUserClaimReceipts()` — Queries `ClaimReceipt` objects owned by the address to show claim history.
- `randomHashHex()` — Generates cryptographically random 32-byte hex string for the link hash.

**`src/lib/scallop.ts`** (100 lines) — Scallop SDK integration.
- `getScallopBuilder()` — Lazily initializes Scallop SDK singleton with `addressId` and `networkType: "mainnet"`.
- `getScallopApy()` — Queries Scallop market for real-time SUI supply APY.
- `buildDepositPTB()` / `buildWithdrawPTB()` — Direct Scallop PTB builders (used for manual Scallop interactions).

**`src/lib/walrus.ts`** (103 lines) — Walrus decentralized storage.
- `storeText()` / `readText()` — PUT/GET text to Walrus HTTP publisher/aggregator.
- `storeBlob()` / `readBlob()` — Raw binary blob storage.
- `blobIdToHex()` / `hexToBlobId()` — Conversion between Walrus base64url blob IDs and hex for on-chain storage.
- **Endpoints:**`publisher.walrus.space` (mainnet), `aggregator.walrus.space` (mainnet).

**`src/lib/constants.ts`** — All on-chain addresses and configuration.
- Package: `0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9`
- PaymentBook: `0x4889941e6073c7e3bebc602c1a09ebc014c64a2b9137569a20100ece0219bafd`
- ScallopYieldVault: `0x4ef1d47e179884387b70d780ae33ca4cc2f0d55d1cd13d17a5be772bf01f24cb`
- Scallop Version: `0x07871c4b3c847a0f674510d4978d5cf6f960452795e8ff6f189fd2088a3f6ac7`
- Scallop Market: `0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061939d9`
- Scallop Address ID: `67c44a103fe1b8c454eb9699`
- Expiry: 14 days default, 30 days max

### Frontend Components

**SendTab.tsx** (376 lines) — The "Create payment link" interface.
- Amount input with preset buttons (10, 25, 35, 50, 100, 500 SUI)
- Optional note field (120 char max, stored on Walrus)
- Live yield estimation: queries real Scallop APY, calculates projected 7-day yield, animates the number counting up
- Sends transaction via `useSignAndExecuteTransaction`
- On success: shows generated link with copy button, Walrus blob ID display
- Walrus upload is best-effort (silently continues if CORS/fetch fails)

**ClaimTab.tsx** (400 lines) — The "Claim payment" interface.
- Input field (accepts full URL or just the hash)
- Strips `https://.../claim/` prefix automatically
- Calls `lookupPayment()` via `devInspectTransactionBlock` to check if payment exists
- Shows payment card with amount, APY, time until expiry
- **zkLogin integration:** If no wallet connected, shows "Sign in with Google" button. Uses Google OAuth to create a Sui zkLogin wallet — no extension, no seed phrase needed.
- Claims via `useSignAndExecuteTransaction` (wallet users) or `signWithZkLoginAndExecute` (zkLogin users)

**Providers.tsx** — Wraps the app with QueryClient, SuiClientProvider (mainnet default), and WalletProvider (auto-connect).

### Landing Page Sections (in order)

| Section | File | Content |
|---|---|---|
| Navbar | `Navbar.tsx` | Logo, "Create a link", "How it works", Connect Wallet button |
| Hero | `Hero.tsx` | Headline + live stats bar (total volume from chain, payment count, APY) + 3 floating cards |
| ActivityFeed | `ActivityFeed.tsx` | Scrolling marquee of *real* on-chain PaymentCreatedEvents — shows sender + amount |
| StatsStrip | `StatsStrip.tsx` | 4 animated counter cells (Total value, APY, Payments created, Finality) |
| HowItWorks | `HowItWorks.tsx` | 3-step feature grid (Create → Earn → Claim) with live yield ticker |
| Personas | `PersonasSection.tsx` | 4 use-case cards (Remote work, Remittances, DAOs, Group funds) |
| Comparison | `ComparisonSection.tsx` | Table: SuiSend vs PayPal/Venmo/Bank Transfer on 9 criteria |
| Demo | `DemoSection.tsx` | Interactive app mockup showing tabs and flow |
| Roadmap | `RoadmapSection.tsx` | 4-phase roadmap (MVP → Mainnet → AI routing → Platform) |
| FAQ | `FAQSection.tsx` | 8 accordion questions |
| ProtocolStrip | `ProtocolStrip.tsx` | "Built with" strip (Sui, Scallop, Next.js, @mysten/dapp-kit) |
| CTA | `CTA.tsx` | "Create your first link" + GitHub link |
| Footer | `Footer.tsx` | Logo, links (Docs, GitHub, Explorer), copyright |

---

## 💸 How Money Flows (Step-by-Step)

### Sender Creates a Payment

```
Sender's Wallet                   Smart Contract                       Scallop
     │                                  │                                 │
     │  tx: create_payment_scallop      │                                 │
     │  ├─ PaymentBook (shared)         │                                 │
     │  ├─ ScallopYieldVault (shared)   │                                 │
     │  ├─ Coin<SUI> (split from gas)   │                                 │
     │  ├─ link_hash (32 random bytes)  │                                 │
     │  ├─ note_blob_id (optional)      │                                 │
     │  └─ expiry_offset_ms (14d)       │                                 │
     │─────────────────────────────────>│                                 │
     │                                  │  protocol::mint::mint<SUI>()    │
     │                                  │────────────────────────────────>│
     │                                  │       returns sSUI Coin         │
     │                                  │<────────────────────────────────│
     │                                  │                                 │
     │                                  │  Store sSUI in vault balance    │
     │                                  │  Create PositionRecord          │
     │                                  │  Insert PaymentRecord in table  │
     │                                  │  Create PaymentVoucher          │
     │                                  │  Emit PaymentCreatedEvent       │
     │<─────────────────────────────────│                                 │
     │  Receives PaymentVoucher         │                                 │
     │  Gets claim URL: suisend.xyz/claim/{shortHash}                     │
     │                                                                     │
     │  Shares URL with recipient (WhatsApp, email, text, etc.)           │
```

### Recipient Claims

```
Recipient                         Frontend                           Smart Contract                  Scallop
    │                                 │                                     │                          │
    │  Opens claim URL                │                                     │                          │
    │────────────────────────────────>│                                     │                          │
    │                                 │  lookupPayment(link_hash)           │                          │
    │                                 │  (devInspectTransactionBlock)       │                          │
    │                                 │────────────────────────────────────>│                          │
    │                                 │  Returns: amount, expiry, state,    │                          │
    │                                 │  sender address                     │                          │
    │                                 │<────────────────────────────────────│                          │
    │                                 │                                     │                          │
    │  Sees "2.00 SUI available"      │                                     │                          │
    │  Clicks "Claim now"             │                                     │                          │
    │────────────────────────────────>│                                     │                          │
    │                                 │  tx: claim_payment_scallop          │                          │
    │                                 │────────────────────────────────────>│                          │
    │                                 │                                     │  redeem::redeem<SUI>()  │
    │                                 │                                     │─────────────────────────>│
    │                                 │                                     │  returns SUI + yield    │
    │                                 │                                     │<─────────────────────────│
    │                                 │                                     │                          │
    │                                 │  Transfer Coin<SUI> to recipient    │                          │
    │                                 │  Create ClaimReceipt → to recipient │                          │
    │                                 │  Emit PaymentClaimedEvent           │                          │
    │<────────────────────────────────│                                     │                          │
    │  Gets: 2.00 SUI + yield         │                                     │                          │
    │  Receives ClaimReceipt NFT      │                                     │                          │
```

### If Unclaimed After 14 Days (Agent Refund)

```
Agent (off-chain cron)          Smart Contract                      Scallop
    │                                 │                                │
    │  Scans expired payments         │                                │
    │  Calls: refund_expired_scallop  │                                │
    │  ├─ RefundAgentCap (auth)       │                                │
    │  └─ link_hash                   │                                │
    │────────────────────────────────>│                                │
    │                                 │  redeem::redeem<SUI>()         │
    │                                 │───────────────────────────────>│
    │                                 │  SUI + yield back             │
    │                                 │<───────────────────────────────│
    │                                 │                                │
    │  Transfers Coin<SUI> to sender  │                                │
    │  Emit PaymentRefundedEvent      │                                │
    │  (initiator = "agent")          │                                │
```

---

## 🚀 Current Status & Roadmap

### ✅ Live on Mainnet
- Smart contract deployed at `0xbefdf372...`
- First on-chain payment executed (0.3 SUI → Scallop → sSUI minted)
- Landing page with live Activity Feed showing real on-chain payments
- Wallet integration via `@mysten/dapp-kit`
- Scallop SDK integration for real APY queries
- Walrus decentralized note storage
- zkLogin scaffolding (Google sign-in, no wallet needed)

### 🚧 In Progress
- Domain: suisend.xyz → Vercel
- Email notifications for claim links
- Enhanced zkLogin flow (Facebook, Apple, Twitch)

### 🔮 Coming Soon
- AI yield routing agent (auto-scans Scallop, Navi for best APY)
- Business dashboard (multi-link management, analytics)
- Mobile app (React Native + Sui Mobile SDK)
- Recurring payment links (subscriptions)
- Fiat on-ramp integration
- API/widgets for third-party embedding

---

## 🔑 Key Design Decisions

1. **Why shared PaymentBook instead of owned PaymentRecords?** — So anyone who knows the link hash can claim. If PaymentRecord were an owned object, only its owner could modify it.

2. **Why PaymentVoucher for refunds?** — The sender address in PaymentRecord is publicly readable. But to refund, we need cryptographic proof the transaction signer IS the sender. The voucher is a capability object only the sender possesses.

3. **Why separate Scallop entry functions?** — Two code paths (mock + Scallop) kept during development. Mainnet only uses `*_scallop` variants. Mock path preserved for future devnet testing.

4. **Why Walrus for notes?** — Notes are optional metadata, not critical to payment settlement. Storing them off-chain saves gas and avoids bloating on-chain state. Best-effort upload: if Walrus CORS fails, the transaction still succeeds.

5. **Why 14-day default expiry?** — Balances recipient convenience with capital efficiency. 30-day hard cap prevents indefinite fund locking.

6. **Why zkLogin?** — Removes the biggest onboarding friction: "download an extension, create a wallet, save seed phrase." Google sign-in creates an ephemeral Sui wallet instantly.

---

## 🎥 Video Hook Angles

- **"Every payment link is a DeFi vault"** — The core mental model shift
- **"Send $100, they get $100.08"** — Concrete tiny number that represents a big idea
- **"Your money shouldn't stop working just because you hit 'send'"** — Emotional angle
- **"No platform fees. Only gas (~$0.001)"** — Why this is better than PayPal
- **"Smart contracts on Sui. Sub-second finality. 8.2% APY"** — Technical credibility
- **"14 days unclaimed? Auto-refund with interest."** — Trust and safety

---

## 🎨 Brand Guide

- **Colors:** Background `#08080a` (near black), Accent `#9eff5b` (green), Text `#f0efe9` (off-white)
- **Fonts:** Space Grotesk (display), Inter (body), Geist Mono (code)
- **Tone:** Premium, dark, technical but warm. Minimalist. Green glow on dark.
- **Cursor:** Custom coin SVG with `mix-blend-mode: difference` — inverts against any background
- **Domain:** suisend.xyz
