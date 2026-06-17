# SuiSend — Mainnet Deployment

**Date:** 2026-06-17
**Network:** Sui Mainnet
**Deployer:** `0x44e511dec5f801ee48f3290a16a6e2b5fdd3a577210badce24f37f5739d66835`

---

## Package

| Field | Value |
|-------|-------|
| **Package ID** | `0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9` |
| **Version** | 1 |
| **Modules** | `core`, `yield`, `yield_scallop`, `walrus` |
| **Publish Tx** | `BbaisuHJ5AbvY3v96SvfMJtMHBBRmq3Xnr7ZcFFYbAZZ` |

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
| **Fund deployer** | `5wzLwr73GQY7D26Txp1spnMepp2ab4jsupQUsatFA1W7` | [Suiscan](https://suiscan.xyz/mainnet/tx/5wzLwr73GQY7D26Txp1spnMepp2ab4jsupQUsatFA1W7) |
| **Refund leftover** | `CcZaMsSFoMNgangmYbLnGgChBSjHjTArUR4ZdZRGNh4y` | [Suiscan](https://suiscan.xyz/mainnet/tx/CcZaMsSFoMNgangmYbLnGgChBSjHjTArUR4ZdZRGNh4y) |

---

## Gas Costs

| Item | MIST | SUI |
|------|------|-----|
| Storage Cost | 80,157,200 | 0.080 |
| Computation Cost | 196,000 | 0.0002 |
| Storage Rebate | 978,120 | 0.001 |
| **Net Publish Cost** | **79,375,080** | **~0.079** |

---

## Wallets

| Role | Address |
|------|---------|
| Deployer (CLI) | `0x44e511dec5f801ee48f3290a16a6e2b5fdd3a577210badce24f37f5739d66835` |
| Fund source / Slush wallet | `0x84b8b140aa5a2c8b357a1596459fced2ac37c8f7b7b5b623759e1d33254623f1` |

---

## Frontend Constants (`src/lib/constants.ts`)

```ts
export const SUISEND_PACKAGE_ID     = "0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9";
export const PAYMENT_BOOK_ID        = "0x4889941e6073c7e3bebc602c1a09ebc014c64a2b9137569a20100ece0219bafd";
export const YIELD_VAULT_ID         = "0x19fd7e20ab2f2d83d5ae31b36821fc4d357d5c6da6032ee291798acce338719f";
export const SCALLOP_YIELD_VAULT_ID = "0x4ef1d47e179884387b70d780ae33ca4cc2f0d55d1cd13d17a5be772bf01f24cb";
export const ADMIN_CAP_ID           = "0x80d507ca0f2ad8baa02ac10445a5898fa2a44b88818d3e1b3d9134f59eb80f2b";
export const YIELD_ROUTER_CAP_ID    = "0xb0c4c042f24d9bed50e57fecc5e65417c7fe6e942d115e3e01db71276ec2a4f5";
export const REFUND_AGENT_CAP_ID    = "0xb3599dd6d6f63de71b99b3e5747e33f0445eb29306fa30a0bf76463b0557a7a4";
export const UPGRADE_CAP_ID         = "0xc72edb6cfed2183e066bb02f169c6e1fbdc336a2cd745819c0123cea1bed1933";
export const SCALLOP_ADDRESS_ID     = "67c44a103fe1b8c454eb9699";
export const NETWORK                = "mainnet";
```
