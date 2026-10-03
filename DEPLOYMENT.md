# SuiSend — Mainnet Deployment

**Date:** 2026-07-07
**Network:** Sui Mainnet
**Deployer:** `0x44e511dec5f801ee48f3290a16a6e2b5fdd3a577210badce24f37f5739d66835`

---

## Package History

| Version | Package ID | TX Digest | Date |
|---------|------------|-----------|------|
| **v1** (publish) | `0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9` | `BbaisuHJ5AbvY3v96SvfMJtMHBBRmq3Xnr7ZcFFYbAZZ` | 2026-06-17 |
| **v2** (upgrade) | `0x837811a8e28aab9c0d5ca9b369aa1da1e178de3e4c1a1c6f33dbf025738ee852` | — | — |
| **v3** (upgrade) | `0x15e985c9c82b8d4ed5d171b2bc6703aa78507c9cc1473ae6c0daf8b54625adcb` | — | — |
| **v4** (upgrade) | `0xcc8845801c91f3c4a7884553b07070b11ddcccbd5d61a544d81c380a128aa94e` | `4MMGJNiumZT3X3sZXyGQ8NUM81xHsVYCobzhf9zn1Vdk` | 2026-07-07 |

**Modules:** `core`, `yield`, `yield_scallop`, `walrus`

---

## Shared Objects

| Object | Type | ID |
|--------|------|-----|
| **PaymentBook** | `core::PaymentBook` | `0x4889941e6073c7e3bebc602c1a09ebc014c64a2b9137569a20100ece0219bafd` |
| **YieldVault** | `yield::YieldVault` | `0x19fd7e20ab2f2d83d5ae31b36821fc4d357d5c6da6032ee291798acce338719f` |
| **ScallopYieldVault** | `yield_scallop::ScallopYieldVault` | `0x4ef1d47e179884387b70d780ae33ca4cc2f0d55d1cd13d17a5be772bf01f24cb` |

---

## Owned Objects (Deployer)

| Object | Type | ID |
|--------|------|-----|
| **AdminCap** | `core::AdminCap` | `0x80d507ca0f2ad8baa02ac10445a5898fa2a44b88818d3e1b3d9134f59eb80f2b` |
| **YieldRouterCap** | `core::YieldRouterCap` | `0xb0c4c042f24d9bed50e57fecc5e65417c7fe6e942d115e3e01db71276ec2a4f5` |
| **RefundAgentCap** | `core::RefundAgentCap` | `0xb3599dd6d6f63de71b99b3e5747e33f0445eb29306fa30a0bf76463b0557a7a4` |
| **UpgradeCap** | `package::UpgradeCap` | `0xc72edb6cfed2183e066bb02f169c6e1fbdc336a2cd745819c0123cea1bed1933` |

---

## External Dependencies

| Dependency | Package ID |
|------------|------------|
| **Sui Framework** | `0x0000000000000000000000000000000000000000000000000000000000000002` |
| **Scallop Protocol** | `0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf` |
| **Scallop (published-at)** | `0xde5c09ad171544aa3724dc67216668c80e754860f419136a68d78504eb2e2805` |

### Scallop Integration

| Parameter | Value |
|-----------|-------|
| **scallopAddressId** | `67c44a103fe1b8c454eb9699` |

---

## Transactions

| Purpose | Digest | Link |
|---------|--------|------|
| **Publish** | `BbaisuHJ5AbvY3v96SvfMJtMHBBRmq3Xnr7ZcFFYbAZZ` | [Suiscan](https://suiscan.xyz/mainnet/tx/BbaisuHJ5AbvY3v96SvfMJtMHBBRmq3Xnr7ZcFFYbAZZ) |
| **v4 Upgrade** | `4MMGJNiumZT3X3sZXyGQ8NUM81xHsVYCobzhf9zn1Vdk` | [Suiscan](https://suiscan.xyz/mainnet/tx/4MMGJNiumZT3X3sZXyGQ8NUM81xHsVYCobzhf9zn1Vdk) |
| **Fund deployer** | `5wzLwr73GQY7D26Txp1spnMepp2ab4jsupQUsatFA1W7` | [Suiscan](https://suiscan.xyz/mainnet/tx/5wzLwr73GQY7D26Txp1spnMepp2ab4jsupQUsatFA1W7) |

---

## Gas Costs (v4 Upgrade)

| Item | MIST | SUI |
|------|------|-----|
| Storage Cost | 87,818,000 | 0.088 |
| Computation Cost | 199,000 | 0.0002 |
| Storage Rebate | 2,595,780 | 0.003 |
| **Net Cost** | **~85,421,220** | **~0.085** |

---

## Wallets

| Role | Address |
|------|---------|
| Deployer (CLI) | `0x44e511dec5f801ee48f3290a16a6e2b5fdd3a577210badce24f37f5739d66835` |
| Fund source / Slush wallet | `0x84b8b140aa5a2c8b357a1596459fced2ac37c8f7b7b5b623759e1d33254623f1` |

---

## Frontend Constants (`src/lib/constants.ts`)

```ts
export const SUISEND_PACKAGE_ID        = "0xcc8845801c91f3c4a7884553b07070b11ddcccbd5d61a544d81c380a128aa94e";
export const SUISEND_PACKAGE_ID_V2     = "0x837811a8e28aab9c0d5ca9b369aa1da1e178de3e4c1a1c6f33dbf025738ee852";
export const SUISEND_PACKAGE_ID_V3     = "0x15e985c9c82b8d4ed5d171b2bc6703aa78507c9cc1473ae6c0daf8b54625adcb";
export const SUISEND_ORIGINAL_PACKAGE_ID = "0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9";
export const PAYMENT_BOOK_ID           = "0x4889941e6073c7e3bebc602c1a09ebc014c64a2b9137569a20100ece0219bafd";
export const YIELD_VAULT_ID            = "0x19fd7e20ab2f2d83d5ae31b36821fc4d357d5c6da6032ee291798acce338719f";
export const SCALLOP_YIELD_VAULT_ID    = "0x4ef1d47e179884387b70d780ae33ca4cc2f0d55d1cd13d17a5be772bf01f24cb";
export const ADMIN_CAP_ID              = "0x80d507ca0f2ad8baa02ac10445a5898fa2a44b88818d3e1b3d9134f59eb80f2b";
export const YIELD_ROUTER_CAP_ID       = "0xb0c4c042f24d9bed50e57fecc5e65417c7fe6e942d115e3e01db71276ec2a4f5";
export const REFUND_AGENT_CAP_ID       = "0xb3599dd6d6f63de71b99b3e5747e33f0445eb29306fa30a0bf76463b0557a7a4";
export const UPGRADE_CAP_ID            = "0xc72edb6cfed2183e066bb02f169c6e1fbdc336a2cd745819c0123cea1bed1933";
export const SCALLOP_ADDRESS_ID        = "67c44a103fe1b8c454eb9699";
export const NETWORK                   = "mainnet";
```

---

## v5 Upgrade — Security & Authorization (prepared 2026-10-02, NOT YET DEPLOYED)

**Code status:** built, zero warnings, 8/8 authorization unit tests green.
**Audit basis:** F01, F05–F09, F19. See `audit/findings/`.

### What changes on-chain
- New shared object **`PaymentBookV2`** (created post-upgrade by deployer)
- New `PaymentRecordV2`: blake2b256(secret) keys, `recipient_lock`, `pin_hash`,
  `coin_type` in-record, no `state` field
- New functions: `create_payment_v2`, `create_payment_v2_generic`,
  `claim_payment_v2`, `claim_payment_v2_generic`, `refund_sender_v2`,
  `refund_sender_v2_generic`, `refund_expired_v2`, `refund_expired_v2_generic`,
  `init_book_v2`, `set_book_v2_paused`, `admin_init_vault_generic`,
  `payment_v2_*` getters
- Neutralized (hard-abort, ABI-compat): `create_payment`, `claim_payment`,
  `refund_sender`, `refund_expired` (mock path), `init_vault_generic`
- Legacy v1 scallop paths remain live for existing payments until they drain

### Deploy checklist
1. `sui move build` (zero warnings) + `sui move test` (8/8 green)
2. `sui client upgrade --upgrade-capability 0xc72edb6cfed2183e066bb02f169c6e1fbdc336a2cd745819c0123cea1bed1933`
   Record the new package ID and the digest below.
3. Call `core::init_book_v2` with the AdminCap
   (`0x80d507ca0f2ad8baa02ac10445a5898fa2a44b88818d3e1b3d9134f59eb80f2b`).
   Record the created `PaymentBookV2` object ID.
4. Frontend: add v5 package ID to `SUISEND_ALL_PACKAGE_IDS`, add
   `PAYMENT_BOOK_V2_ID`, switch send/claim to the v2 builders.
5. Senders of large legacy (v1) payments: refund + resend via v2 (legacy
   links remain bearer-exposed until they drain).

| Field | Value |
|-------|-------|
| v5 package ID | _TBD on deploy_ |
| v5 upgrade digest | _TBD on deploy_ |
| PaymentBookV2 ID | _TBD on deploy_ |
