# Build plan, 2026-06-13

## Linked intent
`.suiperpower/intent.md` — Payment links on Sui where the sender's funds earn DeFi yield (via Scallop) while unclaimed, so idle money stops being idle.

## Package layout
- Package name: `suisend`
- Single package (not multi-package) — simpler for hackathon iteration, no upgrade boundary overhead
- Move.toml dependencies:
  - `Sui` framework (mainnet branch, pinned by git rev)
  - `@scallop-io/sui-scallop-sdk` — mainnet SDK for Scallop lending (installed in npm)
  - Walrus SDK — pinned by mainnet tag for blob storage
  - Navi SDK — pinned if multi-protocol routing proceeds (risk: confirm mainnet availability)

## Object model (per Object, forced ability decisions)

### `PaymentBook`
- Ownership: **shared**
- Abilities: `key`
- Purpose: Singleton shared object holding a `Table<vector<u8>, PaymentRecord>` keyed by link_hash. The canonical registry of all active payments.
- Created by: `suisend::core::init` (module initializer)
- Mutated by: `create_payment`, `claim_payment`, `refund_payment`
- Destroyed by: never (lives for the lifetime of the package)

### `PaymentVoucher`
- Ownership: **owned** (transferred to sender on creation)
- Abilities: `key, store`
- Purpose: Lightweight proof that the transaction sender created the payment. Needed for sender-initiated refunds before expiry.
- Created by: `suisend::core::create_payment`
- Mutated by: never (immutable after creation)
- Destroyed by: `suisend::core::refund_sender` (burned when sender refunds)

### `ClaimReceipt`
- Ownership: **owned** (transferred to recipient on claim)
- Abilities: `key, store`
- Purpose: On-chain proof that a payment was claimed, recording the yield earned. Displayed in frontend history.
- Created by: `suisend::core::claim_payment`
- Mutated by: never
- Destroyed by: never (permanent record)

### `AdminCap`
- Ownership: **owned** (transferred to deployer on publish)
- Abilities: `key`
- Purpose: Gates admin functions (pause, fee update, upgrade).
- Created by: `suisend::core::init`
- Mutated by: never
- Destroyed by: explicitly burnable by admin

### `RefundAgentCap`
- Ownership: **owned** (transferred to agent address on publish or via admin)
- Abilities: `key`
- Purpose: Authorizes the off-chain agent to trigger refunds on expired payments.
- Created by: `suisend::core::init` or admin function
- Mutated by: never
- Destroyed by: admin

### `YieldRouterCap`
- Ownership: **owned** (transferred to agent address on publish or via admin)
- Abilities: `key`
- Purpose: Authorizes the off-chain agent to rebalance yield positions across protocols (Scallop, Navi, etc.).
- Created by: `suisend::core::init` or admin function
- Mutated by: never
- Destroyed by: admin

### `PaymentRecord` (not an Object — a struct stored in PaymentBook's table)
- Ownership: stored in shared `PaymentBook` table
- Abilities: `store, drop`
- Fields:
  - `link_hash: vector<u8>` — 32-byte random unique identifier from the claim URL
  - `sender: address`
  - `amount: u64` — original SUI deposited (in MIST)
  - `protocol: u8` — enum: Scallop=0, Navi=1, ...
  - `protocol_position_id: ID` — opaque ID referencing the deposit position in whichever protocol
  - `created_at: u64`
  - `expiry: u64` — created_at + 30 days
  - `state: u8` — Active=0, Claimed=1, Refunded=2
  - `note_blob_id: Option<ID>` — Walrus blob ID for the sender's note
  - `recipient: Option<address>` — set at claim time

## Capabilities
- `AdminCap`: holder = deployer address on init. Gates: `pause()`, `unpause()`, `update_fee()`, `set_agent_address()`. Transferable via `transfer::transfer`.
- `RefundAgentCap`: holder = agent address (set by admin). Gates: `refund_expired()`. Not transferable (bound to agent).
- `YieldRouterCap`: holder = agent address (set by admin). Gates: `rebalance()`. Not transferable (bound to agent).

## Modules
- `suisend::core`:
  - Purpose: Payment lifecycle — create, claim, refund. Owns the PaymentBook singleton, PaymentVoucher, ClaimReceipt objects.
  - Public entry functions: `create_payment`, `claim_payment`, `refund_sender`, `refund_expired`
  - Friend modules: `suisend::yield` (core calls yield to deposit/withdraw)
  - Stdlib deps: `sui::transfer`, `sui::object`, `sui::coin`, `sui::table`, `sui::clock`, `sui::event`, `sui::tx_context`

- `suisend::yield`:
  - Purpose: Yield provider abstraction. Defines the interface for depositing/withdrawing from lending protocols. Implements Scallop and Navi adapters.
  - Public entry functions: `deposit`, `withdraw`, `rebalance`
  - Friend modules: none
  - Stdlib deps: `sui::coin`, `sui::transfer`, `sui::object`

- `suisend::walrus`:
  - Purpose: Walrus blob storage for payment notes and claim receipts.
  - Public entry functions: `store_note`, `store_receipt`, `read_blob`
  - Friend modules: none
  - Stdlib deps: Walrus blob SDK types

## Public entry points
- `suisend::core::create_payment(amount: u64, link_hash: vector<u8>, note_blob_id: Option<ID>, ctx: &mut TxContext)` — caller sends SUI coin, gets PaymentVoucher. Creates PaymentRecord in shared table. Emits `PaymentCreated` event.
- `suisend::core::claim_payment(link_hash: vector<u8>, ctx: &mut TxContext)` — caller proves knowledge of link_hash. Withdraws from yield protocol, transfers SUI to caller. Creates ClaimReceipt. Emits `PaymentClaimed` event. Aborts if not Active or already claimed.
- `suisend::core::refund_sender(voucher: PaymentVoucher, ctx: &mut TxContext)` — caller burns their PaymentVoucher. Withdraws from yield protocol, transfers SUI to voucher.sender. Emits `PaymentRefunded` event. Aborts if already claimed/refunded.
- `suisend::core::refund_expired(link_hash: vector<u8>, cap: &RefundAgentCap, clock: &Clock, ctx: &mut TxContext)` — agent calls. Verifies PaymentRecord.expiry < clock.timestamp_ms(). Withdraws from yield, transfers to sender. Aborts if not expired or not Active.
- `suisend::yield::deposit(amount: u64, protocol: u8, ctx: &mut TxContext) -> ID` — deposits SUI to the specified protocol, returns the protocol-specific position ID.
- `suisend::yield::withdraw(position_id: ID, protocol: u8, ctx: &mut TxContext) -> Coin<SUI>` — withdraws principal + accrued yield from the specified protocol.
- `suisend::yield::rebalance(protocol: u8, new_protocol: u8, amount: u64, cap: &YieldRouterCap, ctx: &mut TxContext)` — agent withdraws from one protocol, deposits to another, updates all affected PaymentRecords.

## PTB shape
- Composability: Single-tx entry points for create, claim, and refund. The create PTB chains: split SUI coin → deposit to yield protocol → create PaymentRecord → transfer PaymentVoucher → emit event.
- Gas envelope (rough): < 0.01 SUI per tx on mainnet. Create is most expensive (Scallop deposit + table write).

## Tests (one per intent.md success criterion)
- `test_create_and_claim`: creates payment → claims via link_hash → verifies recipient received amount + yield. Covers intent criteria #1, #2.
- `test_create_and_refund_expired`: creates → advances clock past expiry → agent refunds → sender gets funds back. Covers #3.
- `test_create_and_refund_sender`: sender refunds before expiry using PaymentVoucher. Covers #3 alternative path.
- `test_double_claim`: same link_hash claimed twice → abort expected.
- `test_unauthorized_refund`: non-agent calls refund_expired → abort expected.
- `test_wrong_link_hash`: claim with wrong link_hash → abort expected.

Any success criterion without a test: none.

## Frontend or off-chain pieces
- Stack: Next.js 16 + Tailwind v4 + @mysten/dapp-kit + @scallop-io/sui-scallop-sdk
- Routes: `/` (landing), `/send` (create payment), `/claim/[link_hash]` (claim page), `/history` (payment history)
- Auth: Wallet adapter (senders) + zkLogin (claimers, v1 for claiming only)
- Calls to chain: `create_payment`, `claim_payment`, `refund_sender`, `refund_expired`
- Off-chain agent: Node.js service that scans for expired payments (via events or PaymentBook table) and calls `refund_expired`. Also scans yield rates and calls `rebalance` when better APY available.

## Sponsor integrations (load-bearing, with verification commitment)
- **Scallop**:
  - Surface: `suisend::yield::deposit` calls Scallop's mint/deposit. `suisend::yield::withdraw` calls Scallop's redeem/withdraw.
  - Load-bearing test: `test_scallop_deposit_withdraw` — real Scallop deposit on mainnet → withdraw → verify funds return. Proof: mainnet tx hash.
  - Reference: `@scallop-io/sui-scallop-sdk` v2.4.5 docs (mainnet-only confirmed).
- **Walrus**:
  - Surface: `suisend::walrus::store_note` writes a blob. `suisend::walrus::store_receipt` writes a receipt blob after claim.
  - Load-bearing test: `test_walrus_store_read` — store a note blob → read it back via Walrus API. Proof: blob ID + content match.
  - Reference: Walrus SDK mainnet docs.
- **Navi** (v1 stretch):
  - Surface: second protocol adapter in `suisend::yield`. Agent can rebalance between Scallop and Navi.
  - Load-bearing test: `test_rebalance` — deposit to Scallop → rebalance to Navi → claim from Navi → full amount returned. Proof: mainnet tx hashes.
  - Reference: Navi SDK — must confirm mainnet availability before building.

## Network rollout
- Order: devnet → mainnet (skip testnet — Scallop has no testnet addresses)
- Devnet exit criterion: mock yield module works — all payment lifecycle tests pass with simulated interest
- Mainnet exit criterion: Scallop deposit/withdraw works with real SUI — a payment can be created, claimed, and yield verified on mainnet explorer

## Upgrade authority
- Strategy: keep solo with AdminCap during hackathon. Revisit for post-Overflow.
- Where the upgrade cap lives after publish: stored in deployer's wallet (AdminCap object).
- Package id capture: written to `.env` (`NEXT_PUBLIC_SUISEND_PACKAGE_ID`) and `src/lib/contracts.ts` after first publish.

## Risks and unknowns
- Scallop mainnet-only (high severity): Confirmed by SDK docs. Resolved by demoing on mainnet with real test SUI from faucet.
- Navi SDK availability (medium): Must check if Navi has a Move package on mainnet reachable by our yield module. Resolve: fetch Navi docs before building multi-protocol routing.
- Walrus blob costs on mainnet (low): Notes are < 1KB. Cost is negligible for demo volume. Resolve: proceed with Walrus, monitor gas.
- zkLogin + PTB complexity (medium): zkLogin requires JWT proof verification in the PTB. Resolve: ship wallet-only send first; add zkLogin claim flow as a separate tracked step.
- 30-day expiry on mainnet (low): Agent has 30 days to scan. Within hackathon timeframe, manually test with lowered expiry (e.g. 5 minutes) in test/dev mode.

## Order of build
1. **Mock yield module** (devnet) — prove the payment lifecycle works end-to-end with simulated interest. This is the riskiest unknown (object model + PTB shape), so we prove it first.
2. **Core module** — `create`, `claim`, `refund` with mock yield provider. Full test suite.
3. **Scallop integration** — swap mock for real Scallop adapter on mainnet. Verify with mainnet tx.
4. **Frontend PTB wiring** — connect @mysten/dapp-kit to `create_payment` and `claim_payment`. Landing page → send flow → claim flow.
5. **Walrus integration** — notes on create, receipts on claim.
6. **Agent** — auto-refund scanner (events → refund_expired calls).
7. **Multi-protocol routing** — Navi adapter + rebalance flows.
8. **zkLogin** — claim flow without wallet.
9. **Polish** — error handling, loading states, submission materials.

## What "done" looks like for this plan
- Intent criterion #1: User connects wallet, creates payment with amount + note on mainnet, sees tx in Explorer with Scallop deposit visible.
- Intent criterion #2: Recipient opens claim URL, authenticates (wallet or zkLogin), claims principal + yield, sees ClaimReceipt in their wallet.
- Intent criterion #3: Agent auto-refunds an expired payment (or sender manually refunds), full amount + yield returns to sender.
- Intent criterion #4: SuiSend landing page refreshed with live data, working demo deployable, submission to Sui Overflow complete.
