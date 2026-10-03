# SuiSend — Functional Requirements Document

> **Version:** 1.0  
> **Status:** Draft  
> **Author:** OpenCode / SuiSend Team  
> **Last Updated:** 2026-07-12  

---

## 1. Introduction

This document specifies the functional behavior of all SuiSend system components: on-chain Move modules, frontend web application, off-chain agent, and auxiliary services. It serves as the detailed reference for implementation, testing, and cross-agent handoff.

**System Overview:** SuiSend is a payment-link protocol on Sui mainnet. Funds are deposited into Scallop Protocol's lending pool on creation and withdrawn with accrued yield on claim or refund. The entire lifecycle is on-chain with a Next.js frontend for interaction.

---

## 2. On-Chain Smart Contracts

### 2.1 Module: `suisend::core`

**Package:** `suisend`  
**File:** `sources/core.move`  
**Version:** 4 (upgraded)  
**Published-At:** `0xcc8845801c91f3c4a7884553b07070b11ddcccbd5d61a544d81c380a128aa94e`  
**Original ID:** `0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9`

#### 2.1.1 Constants

| Name | Value | Description |
|------|-------|-------------|
| `MAX_LOCKUP_MS` | 2,592,000,000 (30 days) | Hard cap on lockup period in ms |
| `MIN_LOCKUP_MS` | 60,000 (60 seconds) | Minimum lockup to prevent instant-expiry |
| `STATE_ACTIVE` | 0 | Payment is live |
| `STATE_CLAIMED` | 1 | Payment has been claimed |
| `STATE_REFUNDED` | 2 | Payment has been refunded |
| `PROTOCOL_MOCK` | 0 | Mock yield protocol (testing) |
| `PROTOCOL_SCALLOP` | 1 | Scallop protocol |
| `PROTOCOL_NAVI` | 2 | Navi protocol (reserved, not implemented) |

#### 2.1.2 Error Codes

| Code | Name | Cause |
|------|------|-------|
| 0 | — | (No error) |
| 1 | `EUnauthorized` | Caller is not the authorized agent |
| 2 | `EWrongState` | Payment state ≠ expected (claimed/refunded/active) |
| 3 | `ENotYetExpired` | Agent refund called before `now >= expiry` |
| 4 | `ELinkHashNotFound` | `link_hash` not in `PaymentBook` table |
| 5 | `ELinkHashAlreadyExists` | Hash collision on create |
| 6 | `EInvalidExpiry` | Expiry outside [MIN_LOCKUP_MS, MAX_LOCKUP_MS] |
| 7 | `EUnauthorizedRebalance` | Unauthorized caller for yield rebalance |

#### 2.1.3 Structs

```move
/// Global singleton — registry of all payments
struct PaymentBook has key {
    id: UID,
    payments: Table<vector<u8>, PaymentRecord>,
}

/// Individual payment entry
struct PaymentRecord has store, drop {
    link_hash: vector<u8>,       // 32 random bytes
    sender: address,
    amount: u64,                 // MIST
    position_id: ID,
    protocol: u8,                // 0=mock, 1=Scallop, 2=Navi
    created_at: u64,             // ms since epoch
    expiry: u64,                 // ms since epoch
    state: u8,                   // 0=active, 1=claimed, 2=refunded
    note_blob_id: vector<u8>,    // Walrus blob ID (may be empty)
    recipient: address,          // address that claimed (0x0 if unclaimed)
}

/// Capability — transferred to sender on create
struct PaymentVoucher has key, store {
    id: UID,
    link_hash: vector<u8>,
}

/// NFT receipt — transferred to recipient on claim
struct ClaimReceipt has key, store {
    id: UID,
    link_hash: vector<u8>,
    original_amount: u64,
    yield_earned: u64,
    total_claimed: u64,
    claimed_at: u64,
    recipient: address,
}

/// Admin authority — owned by deployer
struct AdminCap has key, store {
    id: UID,
}

/// Agent refund authority
struct RefundAgentCap has key, store {
    id: UID,
    agent: address,
}

/// Yield rebalance authority
struct YieldRouterCap has key, store {
    id: UID,
    agent: address,
}
```

#### 2.1.4 Events

```move
struct PaymentCreatedEvent has copy, drop {
    link_hash: vector<u8>,
    sender: address,
    amount: u64,
    protocol: u8,
    created_at: u64,
    expiry: u64,
}

struct PaymentClaimedEvent has copy, drop {
    link_hash: vector<u8>,
    recipient: address,
    amount: u64,
    yield_earned: u64,
    claimed_at: u64,
}

struct PaymentRefundedEvent has copy, drop {
    link_hash: vector<u8>,
    sender: address,
    amount: u64,
    yield_earned: u64,
    refunded_at: u64,
    initiator: ascii::String,  // "sender" or "agent"
}
```

#### 2.1.5 Public Functions

##### `create_payment_scallop`

```move
public entry fun create_payment_scallop(
    payment_book: &mut PaymentBook,
    scallop_vault: &mut ScallopYieldVault,
    yield_router_cap: &YieldRouterCap,
    version: &Version,
    market: &Market,
    clock: &Clock,
    coin: Coin<SUI>,
    link_hash: vector<u8>,
    expiry: u64,
    note_blob_id: vector<u8>,
    ctx: &mut TxContext,
)
```

**Behavior:**
1. Validates `expiry ∈ [60_000, 2_592_000_000]`
2. Validates `link_hash` not already in `payment_book.payments`
3. Calls `yield_scallop::deposit_scallop` — mints sSUI via Scallop, stores `Balance<MarketCoin<SUI>>` in `ScallopYieldVault`
4. Creates `PaymentRecord` in `payment_book.payments[link_hash]`
5. Creates `PaymentVoucher`, transfers to `ctx.sender()`
6. Emits `PaymentCreatedEvent`

**Preconditions:**
- `coin.value() > 0`
- `link_hash.length() == 32`
- `exists(payment_book.payments[link_hash]) == false`

**Postconditions:**
- `exists(payment_book.payments[link_hash]) == true`
- `payment_book.payments[link_hash].state == STATE_ACTIVE`

---

##### `create_payment_generic` (v4)

```move
public entry fun create_payment_generic<phantom T>(
    payment_book: &mut PaymentBook,
    scallop_vault_generic: &mut ScallopYieldVaultGeneric<T>,
    yield_router_cap: &YieldRouterCap,
    version: &Version,
    market: &Market,
    clock: &Clock,
    coin: Coin<T>,
    link_hash: vector<u8>,
    expiry: u64,
    note_blob_id: vector<u8>,
    ctx: &mut TxContext,
)
```

**Behavior:** Same as `create_payment_scallop` but for generic coin type `T`. Calls `yield_scallop::deposit_scallop_generic`. The `coin_type` is stored as a dynamic field on `object_id(&payment_book)`.

---

##### `claim_payment_scallop`

```move
public entry fun claim_payment_scallop(
    payment_book: &mut PaymentBook,
    scallop_vault: &mut ScallopYieldVault,
    clock: &Clock,
    link_hash: vector<u8>,
    ctx: &mut TxContext,
)
```

**Behavior:**
1. Validates `link_hash` exists in `payment_book.payments`
2. Validates `record.state == STATE_ACTIVE`
3. Removes record from table
4. Calls `yield_scallop::withdraw_scallop` — redeems sSUI → gets `principal + interest`
5. Transfers `Coin<SUI>` with full amount to `ctx.sender()`
6. Sets `record.state = STATE_CLAIMED`, `record.recipient = ctx.sender()`
7. Actually creates new `PaymentRecord` with updated state — NOTE: record was removed at step 3, so a new record (or the old one) is re‑inserted with `state = STATE_CLAIMED`
8. Creates `ClaimReceipt`, transfers to `ctx.sender()`
9. Emits `PaymentClaimedEvent`

**Preconditions:**
- `exists(payment_book.payments[link_hash]) == true`
- `record.state == STATE_ACTIVE`

---

##### `claim_payment_generic` (v4)

```move
public entry fun claim_payment_generic<phantom T>(
    payment_book: &mut PaymentBook,
    scallop_vault_generic: &mut ScallopYieldVaultGeneric<T>,
    clock: &Clock,
    link_hash: vector<u8>,
    ctx: &mut TxContext,
)
```

**Behavior:** Same as `claim_payment_scallop` but for generic coin type via `yield_scallop::withdraw_scallop_generic`.

---

##### `refund_sender_scallop`

```move
public entry fun refund_sender_scallop(
    payment_book: &mut PaymentBook,
    scallop_vault: &mut ScallopYieldVault,
    clock: &Clock,
    voucher: PaymentVoucher,
    ctx: &mut TxContext,
)
```

**Behavior:**
1. Validates `link_hash` exists in `payment_book.payments`
2. Validates `record.state == STATE_ACTIVE`
3. Validates `voucher.link_hash == link_hash`
4. Destroys `voucher` (burns the voucher)
5. Removes record, sets `state = STATE_REFUNDED`
6. Calls `yield_scallop::withdraw_scallop` → gets `principal + interest`
7. Transfers `Coin<SUI>` to `record.sender`
8. Emits `PaymentRefundedEvent { initiator: "sender" }`

---

##### `refund_sender_generic` (v4)

Same as `refund_sender_scallop` but for generic coin type.

---

##### `refund_expired_scallop`

```move
public entry fun refund_expired_scallop(
    payment_book: &mut PaymentBook,
    scallop_vault: &mut ScallopYieldVault,
    cap: &RefundAgentCap,
    clock: &Clock,
    link_hash: vector<u8>,
    ctx: &mut TxContext,
)
```

**Behavior:**
1. Validates `ctx.sender() == cap.agent`
2. Validates `link_hash` exists
3. Validates `record.state == STATE_ACTIVE`
4. Validates `now >= record.expiry` (via `clock.timestamp_ms()`)
5. Removes record, sets `state = STATE_REFUNDED`
6. Withdraws from Scallop, transfers to `record.sender`
7. Emits `PaymentRefundedEvent { initiator: "agent" }`

---

##### `refund_expired_generic` (v4)

Same as `refund_expired_scallop` but for generic coin type.

---

##### `rotate_refund_agent`

```move
public entry fun rotate_refund_agent(
    cap: &mut RefundAgentCap,
    _admin: &AdminCap,
    new_agent: address,
)
```

Updates `cap.agent = new_agent`.

##### `rotate_yield_router`

```move
public entry fun rotate_yield_router(
    cap: &mut YieldRouterCap,
    _admin: &AdminCap,
    new_agent: address,
)
```

Updates `cap.agent = new_agent`.

##### Read-Only Functions

```move
public fun payment_exists(payment_book: &PaymentBook, link_hash: vector<u8>): bool
public fun payment_amount(payment_book: &PaymentBook, link_hash: vector<u8>): u64
public fun payment_expiry(payment_book: &PaymentBook, link_hash: vector<u8>): u64
public fun payment_state(payment_book: &PaymentBook, link_hash: vector<u8>): u8
public fun payment_sender(payment_book: &PaymentBook, link_hash: vector<u8>): address
public fun payment_coin_type(payment_book: &PaymentBook, link_hash: vector<u8>): Option<u8>
public fun active_payment_count(payment_book: &PaymentBook): u64
```

All return error `ELinkHashNotFound` (4) if hash does not exist in table.

---

### 2.2 Module: `suisend::yield`

**Purpose:** Yield abstraction layer + mock implementation for testing.

**Constants:** `MOCK_APY_BPS = 820` (8.2%)

#### Structs

```move
struct YieldVault has key {
    id: UID,
    balance: Balance<SUI>,
    positions: Table<ID, PositionRecord>,
}

struct PositionRecord has store {
    principal: u64,
    created_at: u64,
    protocol: u8,
}
```

#### Events

```move
struct DepositEvent has copy, drop { position_id: ID, amount: u64, protocol: u8 }
struct WithdrawEvent has copy, drop { position_id: ID, principal: u64, interest: u64, total: u64, protocol: u8 }
```

#### Functions

| Function | Visibility | Behavior |
|----------|-----------|----------|
| `deposit` | `public` | Splits coin into vault balance, creates `PositionRecord`, emits `DepositEvent`, returns `position_id` |
| `withdraw` | `public` | Removes position, takes balance out, returns `(principal, interest, Coin<SUI>)` |
| `balance` | `public` | Returns `vault.balance.value()` |
| `interest_for` | `public` | Computes `amount * MOCK_APY_BPS * elapsed / (10000 * LOCKUP_MS)`, returns `u64` |

**Note:** The current `withdraw` implementation returns interest = 0 (commented as "result is set to zero so that withdraw returns only the principal"). Real yield comes from Scallop module.

---

### 2.3 Module: `suisend::yield_scallop`

**Purpose:** Scallop Protocol integration for real yield.

#### Structs

```move
struct ScallopYieldVault has key {
    id: UID,
    balance: Balance<MarketCoin<SUI>>,
    positions: Table<ID, PositionRecord>,
}

struct ScallopYieldVaultGeneric<phantom T> has key {
    id: UID,
    balance: Balance<MarketCoin<T>>,
    positions: Table<ID, PositionRecord>,
}

struct PositionRecord has store, drop {
    principal: u64,
    created_at: u64,
    protocol: u8,
}
```

#### Events

```move
struct ScallopDepositEvent has copy, drop { position_id: ID, amount: u64, scoin_amount: u64 }
struct ScallopWithdrawEvent has copy, drop { position_id: ID, principal: u64, interest: u64, total: u64 }
```

#### Functions (Public)

| Function | Description |
|----------|-------------|
| `deposit_scallop` | Mints sSUI via `scallop_protocol::mint::mint<SUI>`, stores `Balance<MarketCoin<SUI>>` |
| `withdraw_scallop` | Redeems sSUI via `scallop_protocol::redeem::redeem<SUI>`, returns `(principal, interest, Coin<SUI>)` |
| `deposit_scallop_generic<T>` | Mints `sT` via `mint<T>`, stores `Balance<MarketCoin<T>>` |
| `withdraw_scallop_generic<T>` | Redeems `sT` via `redeem<T>`, returns `(principal, interest, Coin<T>)` |
| `balance_scallop` | Returns `vault.balance.value()` |

**External Dependencies:**
- Package: `0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf`
- Published-At: `0xde5c09ad171544aa3724dc67216668c80e754860f419136a68d78504eb2e2805`
- Objects: `Version` (`0x07871c4b...`), `Market` (`0xa7579752...`)

---

### 2.4 Module: `suisend::walrus`

**Purpose:** Typed wrapper for Walrus blob IDs.

```move
struct WalrusBlobId has store, copy, drop { id: vector<u8> }
```

Used inline in `PaymentRecord.note_blob_id`. No public entry functions.

---

## 3. Frontend Application

### 3.1 Route Map

| Path | Page | Auth Required | Description |
|------|------|---------------|-------------|
| `/` | Landing page | No | Hero, stats, how-it-works, comparison, roadmap, FAQ |
| `/app` | App page | No (wallet/zkLogin for actions) | Send, Claim, History tabs |
| `/app#send` | Send tab | Wallet connected | Create payment link |
| `/app#claim` | Claim tab | No | Lookup and claim payment |
| `/app#history` | History tab | Wallet connected | View sent/received payments |
| `/claim/[link_hash]` | Direct claim | No | **NOT IMPLEMENTED** — route directory exists but empty |
| `/auth/callback` | zkLogin callback | N/A | Handles Google OAuth redirect |

### 3.2 Landing Page (`/`)

#### Requirements

| Section | Component | Data Source | Dynamic? |
|---------|-----------|-------------|----------|
| **Navbar** | Logo, links (How it works, Send, Explorer), CTA | Static | No |
| **Hero** | Headline, subtitle, live stats, animated cards | `useLiveStats()` | Yes (polls chain) |
| **ActivityFeed** | Scrolling marquee of recent payments | `useLivePaymentEvents()` | Yes (polls chain) |
| **StatsStrip** | 4 counter cells (Total value, APY, Payments, Finality) | `useLiveStats()` | Yes (animated counters) |
| **HowItWorks** | 3-step grid with live yield ticker | Static + Scallop APY | Partial (APY live) |
| **PersonasSection** | 4 use-case cards | Static | No |
| **ComparisonSection** | Comparison table (9 criteria) | Static | No |
| **DemoSection** | Interactive mockup | Static | No |
| **RoadmapSection** | 4-phase roadmap | Static | No |
| **FAQSection** | 8 accordion questions | Static | No |
| **ProtocolStrip** | "Built with" logos | Static | No |
| **CTA** | "Create your first link" button | Static | No |
| **Footer** | Logo, links, credit | Static | No |

#### Live Stats Data Flow

```
useLiveStats()
  ├── PaymentCreatedEvent query (SUISEND_ALL_PACKAGE_IDS)
  │     → total_volume, payments_created_count
  ├── PaymentClaimedEvent query (SUISEND_ALL_PACKAGE_IDS)
  │     → claimed_count
  └── getScallopApy()
        → current_apy (from Scallop market data)
```

Queries iterate over all 4 package versions. Events are deduplicated by `tx_digest` and `event_seq`.

### 3.3 App Page (`/app`)

#### 3.3.1 Send Tab

**Layout:**
- Coin type toggle (SUI / USDC)
- Amount input with presets (10 / 25 / 50 / 100 / 500)
- Optional note input (max 120 chars)
- Live yield estimate display (uses Scallop APY × amount × default lockup)
- "Generate payment link" button

**Flow:**
1. User selects coin type, enters amount, optionally types note
2. Note upload: if note length > 0, PUT to `https://publisher.walrus.space/v1/blobs?epochs=5` (best-effort)
3. Frontend generates 32 random bytes via `crypto.getRandomValues()`
4. Builds PTB via `buildSendPaymentPTB()`:
   - For SUI: calls `core::create_payment_scallop`
   - For USDC: calls `core::create_payment_generic<USDC>`
5. User signs with wallet (via `@mysten/dapp-kit` `signAndExecuteTransaction`) or zkLogin
6. On success: displays claim URL `https://suisend.xyz/app?claim=<base64url(hash)>`
7. "Copy link" button copies to clipboard

**PTB Construction (`suisend.ts:buildSendPaymentPTB`):**

```typescript
// Split coin input
const [paymentCoin] = tx.splitCoins(tx.gas, [amount]);

// For SUI:
tx.moveCall({
  target: `${SUISEND_PACKAGE_ID}::core::create_payment_scallop`,
  arguments: [
    tx.object(PAYMENT_BOOK_ID),
    tx.object(SCALLOP_YIELD_VAULT_ID),
    tx.object(YIELD_ROUTER_CAP_ID),
    tx.object(SCALLOP_VERSION_ID),
    tx.object(SCALLOP_MARKET_ID),
    tx.object(CLOCK_ID),
    paymentCoin,
    tx.pure.vector('u8', linkHashBytes),
    tx.pure.u64(expiryMs),
    tx.pure.vector('u8', noteBlobIdBytes),
  ],
});

// For USDC:
tx.moveCall({
  target: `${SUISEND_PACKAGE_ID}::core::create_payment_generic`,
  typeArguments: [USDC_COIN_TYPE],
  arguments: [
    tx.object(PAYMENT_BOOK_ID),
    tx.object(SCALLOP_YIELD_VAULT_GENERIC_ID),
    tx.object(YIELD_ROUTER_CAP_ID),
    tx.object(SCALLOP_VERSION_ID),
    tx.object(SCALLOP_MARKET_ID),
    tx.object(CLOCK_ID),
    paymentCoin,
    tx.pure.vector('u8', linkHashBytes),
    tx.pure.u64(expiryMs),
    tx.pure.vector('u8', noteBlobIdBytes),
  ],
});
```

**Gas Budget:** 0.02 SUI (hardcoded)

#### 3.3.2 Claim Tab

**Layout:**
- Text input for link hash or full URL
- "Look up" button
- Payment info card (shown after lookup):
  - Amount (formatted)
  - APY
  - Time until expiry (countdown)
  - Note (if any, fetched from Walrus)
  - Sender address
- "Claim now" button
- "Sign in with Google" prompt if no wallet connected

**Lookup Flow:**

```typescript
async function lookupPayment(linkHash: string): Promise<PaymentInfo | null> {
  // Use devInspectTransactionBlock to call read-only functions
  // Tries each package version in SUISEND_ALL_PACKAGE_IDS
  // Returns null if not found in any version
}
```

**Claim Flow:**
1. Builds PTB via `buildClaimPaymentPTB()` — same pattern as create
2. Supports both wallet (`@mysten/dapp-kit`) and zkLogin signers
3. On success: displays success card with amount + yield earned + link to SuiScan

#### 3.3.3 History Tab

**Layout:**
- Filter pills: All / Pending / Claimed
- Two sections: "Sent" / "Received"

**Data Sources:**
- **Sent queries:** `PaymentCreatedEvent` filtered by sender address
  - Query: `{ Sender: accountAddress, MoveEventType: PaymentCreatedEvent }` for each package version
- **Received queries:** `ClaimReceipt` objects owned by address
  - Query: `{ Owner: accountAddress }` filtered by type `ClaimReceipt`

**Card Display (per payment):**
- Status badge: "Pending" (green), "Claimed" (blue), "Refunded" (gray)
- Amount + coin type
- Yield earned (if claimed)
- Link hash (truncated)
- "Open link" / "Copy link" buttons
- Created date
- (Future: "Refund" button for pending sender payments)

#### 3.3.4 Shared Components

**ConnectModal:**
- "Connect Wallet" button → opens `@mysten/dapp-kit` connect modal
- "Sign in with Google" button → initiates zkLogin flow
- Shows connected state (address, balance) when authenticated

**TxStatusOverlay:**
- States: signing → broadcasting → confirming → confirmed (with SuiScan link) | failed (with error message)
- Animated with Framer Motion
- Blocks UI interaction while active

### 3.4 zkLogin Flow

#### 3.4.1 Initiation (`zklogin.ts:startZkLogin`)

```
1. Generate Ed25519 ephemeral keypair (getEphemeralKeyPair)
2. Store in sessionStorage
3. Fetch latest Sui epoch from RPC
4. Compute nonce = hash(ephemeralPubKey || maxEpoch || randomness)
5. Build Google OAuth URL with:
   - client_id = NEXT_PUBLIC_GOOGLE_CLIENT_ID
   - redirect_uri = suisend.xyz/auth/callback
   - response_type = id_token
   - nonce = computed nonce
6. window.location.href = OAuth URL
```

#### 3.4.2 Callback (`/auth/callback`)

```
1. Parse id_token from URL fragment
2. POST /api/zklogin with { action: "salt", jwt: id_token }
   → Server returns salt = HMAC-SHA256(MASTER_SEED, jwt.sub)
3. Derive Sui address: jwtToAddress(jwt, salt)
4. POST /api/zklogin with { action: "prove", jwt, ephemeralPubKey, maxEpoch, randomness, salt }
   → Server proxies to https://prover-dev.mystenlabs.com/v1
   → Returns ZK proof
5. Store in sessionStorage: { address, ephemeralKeyPair, jwt, salt, proof, maxEpoch }
6. Redirect to /app with zkLogin state active
```

#### 3.4.3 Transaction Signing (`zklogin.ts:signWithZkLoginAndExecute`)

```
1. Build PTB
2. Sign with ephemeral keypair
3. Execute via sui_executeTransactionBlock with:
   - zkLogin signature (proof + ephemeralSig)
   - User signature (ephemeralSig)
4. Wait for confirm
```

**API Route (`/api/zklogin`):**

```typescript
// POST /api/zklogin
// { action: "salt", jwt: string }
// → { salt: string }

// { action: "prove", jwt, ephemeralPubKey, maxEpoch, randomness, salt }
// → Proxy to prover-dev.mystenlabs.com/v1
// → { proof: ZkProof }
```

**Salt derivation:** `HKDF-SHA256(ZKLOGIN_MASTER_SEED, salt: jwt.sub)` — deterministic per Google account.

### 3.5 Walrus Note Storage

**Endpoints:**
- Publisher: `https://publisher.walrus.space/v1/blobs?epochs=5`
- Aggregator: `https://aggregator.walrus.space/v1/`

**Upload Flow:**
```typescript
async function uploadNote(text: string): Promise<string> {
  // PUT text as media type "text/plain;charset=utf-8"
  // Response header: X-Walrus-BlobId (base64url encoded)
  // Convert to hex, return
}
```

**Retrieval:**
```typescript
async function readNote(blobIdHex: string): Promise<string> {
  // Convert hex to base64url
  // GET aggregator/{blobId}
  // Return text
}
```

**Best-effort semantics:** If Walrus upload fails (CORS, timeout), the transaction still succeeds without the note.

### 3.6 Scallop Integration

**Initialization:**
```typescript
const scallopSDK = new ScallopSDK({
  addressId: "67c44a103fe1b8c454eb9699",  // Scallop mainnet config
  networkType: "mainnet",
});
```

**APY Query:**
```typescript
async function getScallopApy(): Promise<number> {
  const market = await scallopSDK.getMarket();
  return market.suiSupplyRate;  // e.g., 0.082 = 8.2%
}
```

### 3.7 Constants & Configuration (`constants.ts`)

| Constant | Source | Fallback |
|----------|--------|----------|
| `SUISEND_PACKAGE_ID` | `process.env.NEXT_PUBLIC_SUISEND_PACKAGE_ID` | v4 mainnet ID |
| `SUISEND_PACKAGE_ID_V1` | Hardcoded | v1 mainnet ID |
| `SUISEND_PACKAGE_ID_V2` | Hardcoded | v2 mainnet ID |
| `SUISEND_PACKAGE_ID_V3` | `process.env.NEXT_PUBLIC_SUISEND_PACKAGE_ID_V3` | v3 mainnet ID |
| `SUISEND_ALL_PACKAGE_IDS` | Computed | [v1, v2, v3, v4] |
| `PAYMENT_BOOK_ID` | `process.env.NEXT_PUBLIC_PAYMENT_BOOK_ID` | mainnet ID |
| `SCALLOP_YIELD_VAULT_ID` | `process.env.NEXT_PUBLIC_SCALLOP_YIELD_VAULT_ID` | mainnet ID |
| `SCALLOP_YIELD_VAULT_GENERIC_ID` | `process.env.NEXT_PUBLIC_SCALLOP_YIELD_VAULT_GENERIC_ID` | mainnet ID |
| `YIELD_ROUTER_CAP_ID` | `process.env.NEXT_PUBLIC_YIELD_ROUTER_CAP_ID` | mainnet ID |
| `REFUND_AGENT_CAP_ID` | Hardcoded | mainnet ID |
| `SCALLOP_VERSION_ID` | Hardcoded | `0x07871c4b...` |
| `SCALLOP_MARKET_ID` | Hardcoded | `0xa7579752...` |
| `SCALLOP_PACKAGE_ID` | Hardcoded | `0xefe8b36d...` |
| `USDC_COIN_TYPE` | Hardcoded | `0xdba34672...::usdc::USDC` |
| `SUI_DECIMALS` | Hardcoded | 9 |
| `USDC_DECIMALS` | Hardcoded | 6 |
| `MAINNET_CHAIN_ID` | Hardcoded | `35834a8a` |

**Utility Functions:**
- `formatAmount(amount, coinType)` — formats with correct decimals
- `mistToUnits(mist, decimals)` — divides by 10^decimals, returns string
- `coinLabel(coinType)` — returns "SUI" or "USDC"

### 3.8 Multi-Package Query Logic

All event and object queries in `suisend.ts` iterate over `SUISEND_ALL_PACKAGE_IDS`:

```typescript
async function queryPayments(filters) {
  const results = [];
  for (const packageId of SUISEND_ALL_PACKAGE_IDS) {
    const events = await suiClient.queryEvents({
      query: { MoveModule: { package: packageId, module: "core" } },
      ...filters,
    });
    results.push(...events.data);
  }
  // Deduplicate by tx_digest + event_seq
  return deduplicate(results);
}
```

This ensures old payments (created under v1/v2/v3) continue to appear. `devInspectTransactionBlock` queries for `payment_exists` and similar read-only functions attempt each package version in sequence until one succeeds.

---

## 4. Off-Chain Refund Agent

**Status:** ⬜ Not implemented

### Requirements

- Cron job (or serverless function) running every hour
- Queries `PaymentBook` table for records where `expiry < now && state == STATE_ACTIVE`
- For each expired payment:
  1. Determines protocol type from record
  2. Calls `refund_expired_scallop` (or `_generic`)
  3. Signs with refund agent keypair
- Logs all refunds to local database for audit

### Pseudocode

```typescript
async function refundExpiredPayments() {
  // Query active payments
  // Filter: expiry < Date.now() && state == STATE_ACTIVE
  // For each:
  //   Determine package version from original_id
  //   Call refund_expired_* with RefundAgentCap
  //   Wait for confirmation
  //   Log to audit db
}
```

---

## 5. Test Requirements

### 5.1 Move Unit Tests (`tests/core_tests.move`)

| Test | Coverage | Status |
|------|----------|--------|
| `test_create_and_claim` | Full happy path: admin init → sender create → recipient claim → verify ClaimReceipt | ✅ |
| `test_sender_refund` | Sender creates payment, refunds via PaymentVoucher before expiry | ✅ |
| `test_agent_refund_expired` | Create payment, advance clock past expiry, agent refunds | ✅ |
| `test_double_claim_fails` | Claim same payment twice → abort EWrongState | ✅ |
| `test_wrong_link_hash_fails` | Claim with wrong hash → abort ELinkHashNotFound | ✅ |
| `test_duplicate_link_hash` | Create two payments with same hash → abort ELinkHashAlreadyExists | ✅ |
| `test_refund_before_expiry` | Agent refund before expiry → abort ENotYetExpired | ✅ |
| `test_invalid_expiry` | Create with expiry < MIN_LOCKUP_MS → abort EInvalidExpiry | ✅ |

**Note:** Tests use mock yield module (Scallop objects unavailable in test environment).

### 5.2 Frontend Testing

- **Component tests:** Not yet implemented
- **E2E:** Not yet implemented
- **Manual test checklist:**
  - Create SUI payment with wallet
  - Create USDC payment with wallet
  - Claim payment with wallet
  - Claim payment via zkLogin (Google)
  - Verify stats update on landing page
  - Verify history shows sent and received payments
  - Verify old (v1–v3) payments appear in stats and history

---

## 6. Error Handling

### 6.1 On-Chain Errors

| Error | Frontend Behavior |
|-------|-------------------|
| `EUnauthorized` | Show "You are not authorized to perform this action" |
| `EWrongState` | Show "Payment has already been claimed or refunded" |
| `ENotYetExpired` | Show "Payment has not expired yet" |
| `ELinkHashNotFound` | Show "Payment not found — check the link" |
| `ELinkHashAlreadyExists` | Show "This link hash already exists, try again" (rare) |
| `EInvalidExpiry` | Show "Invalid expiry duration" |
| `EUnauthorizedRebalance` | Show "Unauthorized" |

### 6.2 Frontend Errors

| Error | Handling |
|-------|----------|
| Wallet not connected | Show ConnectModal prompt |
| Insufficient balance | Show "Insufficient balance" inline error |
| Transaction failed | Show TxStatusOverlay with error + retry |
| Network error | Retry with exponential backoff (3 attempts) |
| Walrus upload fails | Continue without note (best-effort) |
| zkLogin proof generation fails | Show "Authentication failed, try again" |

---

## 7. Security Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| Link hash is 32 random bytes | ✅ | `crypto.getRandomValues()` |
| PaymentVoucher on refund | ✅ | Burned after use |
| Agent gated by RefundAgentCap | ✅ | Can be rotated by admin |
| AdminCap gated admin functions | ✅ | Single deployer owner |
| Sender address verified on refund | ✅ | `voucher.link_hash == record.link_hash` |
| zkLogin ephemeral keypair | ✅ | Stored in sessionStorage only |
| No plaintext secrets in source | ✅ | .env for sensitive config |
| No fee/withdraw backdoors | ✅ | No TreasuryCap or withdraw functions |
| Expiry enforced on-chain | ✅ | Agent refund requires `now >= expiry` |

---

## 8. Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Landing page load | < 2s FCP | Lighthouse |
| Payment creation TX | < 5s to finality | Sui RPC |
| Payment lookup | < 2s | `devInspectTransactionBlock` |
| Claim TX | < 5s to finality | Sui RPC |
| Stats feed refresh | Every 15s | Polling interval |
| Activity feed refresh | Every 30s | Polling interval |
| Max concurrent queries | 4 parallel (one per package version) | Implementation |
| Scallop APY cache | 60s | TanStack React Query staleTime |

---

## 9. Deployment Configuration

### 9.1 Sui Mainnet Objects

| Object | ID |
|--------|-----|
| AdminCap | `0x80d507ca0f2ad8baa02ac10445a5898fa2a44b88818d3e1b3d9134f59eb80f2b` |
| UpgradeCap | `0xc72edb6cfed2183e066bb02f169c6e1fbdc336a2cd745819c0123cea1bed1933` |
| PaymentBook | `0x4889941e6073c7e3bebc602c1a09ebc014c64a2b9137569a20100ece0219bafd` |
| YieldVault | `0x19fd7e20ab2f2d83d5ae31b36821fc4d357d5c6da6032ee291798acce338719f` |
| ScallopYieldVault | `0x4ef1d47e179884387b70d780ae33ca4cc2f0d55d1cd13d17a5be772bf01f24cb` |
| YieldRouterCap | `0xb0c4c042f24d9bed50e57fecc5e65417c7fe6e942d115e3e01db71276ec2a4f5` |
| RefundAgentCap | `0xb3599dd6d6f63de71b99b3e5747e33f0445eb29306fa30a0bf76463b0557a7a4` |

### 9.2 Wallet Keys

| Wallet | Address | Purpose |
|--------|---------|---------|
| Deployer (CLI) | `0x44e511dec5f801ee48f3290a16a6e2b5fdd3a577210badce24f37f5739d66835` | Package owner, admin |
| Slush | `0x84b8b140aa5a2c8b357a1596459fced2ac37c8f7b7b5b623759e1d33254623f1` | Fund source for operations |

### 9.3 Environment Variables

| Variable | Source | Example |
|----------|--------|---------|
| `NEXT_PUBLIC_SUISEND_PACKAGE_ID` | v4 | `0xcc8845...` |
| `NEXT_PUBLIC_SUISEND_PACKAGE_ID_V3` | v3 | `0x15e985...` |
| `NEXT_PUBLIC_PAYMENT_BOOK_ID` | Mainnet | `0x488994...` |
| `NEXT_PUBLIC_SCALLOP_YIELD_VAULT_ID` | Mainnet | `0x4ef1d4...` |
| `NEXT_PUBLIC_SCALLOP_YIELD_VAULT_GENERIC_ID` | Mainnet | (USDC vault) |
| `NEXT_PUBLIC_YIELD_ROUTER_CAP_ID` | Mainnet | `0xb0c4c0...` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | GCP Console | `xxx.apps.googleusercontent.com` |
| `ZKLOGIN_MASTER_SEED` | Secret | `hex-encoded` |
| `SUI_MAINNET_RPC` | RPC provider | `https://mainnet.sui.rpc...` |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **PTB** | Programmable Transaction Block — Sui's composable multi-step transaction |
| **sSUI / sUSDC** | Scallop receipt tokens representing deposited SUI/USDC earning yield |
| **zkLogin** | Sui's native OAuth-to-wallet flow using zero-knowledge proofs |
| **zkProver** | Mysten Labs service that generates ZK proofs for zkLogin |
| **Walrus** | Sui's decentralized blob storage protocol |
| **PaymentBook** | Shared on-chain table mapping link hashes to PaymentRecords |
| **PaymentVoucher** | Owned capability for sender-initiated refunds |
| **ClaimReceipt** | NFT transferred to recipient as proof of claim |
| **RefundAgentCap** | Admin-gated capability for off-chain refund agent |
| **digest** | Package digest — SHA3-256 of BCS(sorted_modules ++ dependencies) |
| **MIST** | 10^-9 SUI, the smallest unit |
| **devInspect** | Dry-run transaction to simulate on-chain execution without gas |

---

## 11. Future Functional Work

| Feature | FRD Section Needed | Priority |
|---------|-------------------|----------|
| Off-chain refund agent cron | §4 (to be written) | P1 |
| `/claim/[link_hash]` route | §3.1 (route handler spec) | P1 |
| Email notification delivery | New section | P2 |
| Refund button in History tab | §3.3.3 (button + tx builder) | P2 |
| Navi protocol integration | §2.3 (module spec) | P3 |
| API / widget for embedding | New section | P3 |
| Recurring payments | New section | P3 |
| Bulk payment creation | New section | P3 |
