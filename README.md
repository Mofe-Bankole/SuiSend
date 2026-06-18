# SuiSend — Send money. It earns while they wait.

Every payment link you create automatically deposits into DeFi yield. Recipients claim your original amount — plus interest.

Built on **Sui** and **Scallop Protocol**. Deployed on **mainnet**.

---

## How it works

**1. Create a link** — Connect your Sui wallet, enter an amount. One transaction deposits your SUI into Scallop's lending pool and generates a shareable claim link.

**2. It earns** — While unclaimed, your funds compound at real Scallop APY (~8.2%). The yield counter ticks in real time.

**3. They claim** — Recipient opens the link, clicks claim. They receive the original amount + all interest accrued. A `ClaimReceipt` lands in their wallet as on-chain proof.

If unclaimed after 14 days, the sender gets everything back — principal + yield.

---

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Command | Purpose |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |

---

## Tech stack

| Layer | |
|---|---|
| Blockchain | Sui (mainnet) |
| Smart contracts | Sui Move (edition 2024.beta) |
| Yield | Scallop Protocol (sSUI lending pool) |
| Storage | Walrus (decentralized blob storage for notes) |
| Frontend | Next.js 16, Tailwind CSS, shadcn/ui |
| Wallet | @mysten/dapp-kit + @mysten/sui v2.17 |
| zkLogin | Google OAuth (no wallet required) |
| Hosting | Vercel |
| Domain | suisend.xyz |

---

## Smart contracts

Deployed on Sui mainnet at [`0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9`](https://suiexplorer.com/object/0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9).

| Module | Lines | Purpose |
|---|---|---|
| [`core.move`](sources/core.move) | 848 | Payment lifecycle: create, claim, refund. Shared `PaymentBook` singleton. |
| [`yield_scallop.move`](sources/yield_scallop.move) | 178 | Scallop adapter: mints sSUI on deposit, redeems on claim. |
| [`yield.move`](sources/yield.move) | 286 | Yield abstraction layer (mock + protocol routing). |
| [`walrus.move`](sources/walrus.move) | 44 | Typed wrapper for Walrus blob IDs. |
| [`core_tests.move`](tests/core_tests.move) | 433 | 5 test scenarios covering full lifecycle. |

---

## Architecture

```
Frontend (Next.js) ── PTB ──▶ Sui Mainnet
                                  │
                            ┌─────┴─────┐
                            │  core.move  │
                            │  (Payment   │
                            │   Book)     │
                            └─────┬─────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │  yield_scallop.move        │
                    │  (mint/redeem sSUI)        │
                    └─────────────┬─────────────┘
                                  │
                          Scallop Lending Pool
                               (8.2% APY)
```

---

## On-chain addresses

| Name | Address |
|---|---|
| Package | `0xbefdf372ed7b01a45561b71eb62ba2aed0370f7b79221d42ba1a14e8f75d6fe9` |
| PaymentBook | `0x4889941e6073c7e3bebc602c1a09ebc014c64a2b9137569a20100ece0219bafd` |
| ScallopYieldVault | `0x4ef1d47e179884387b70d780ae33ca4cc2f0d55d1cd13d17a5be772bf01f24cb` |
| Scallop Version | `0x07871c4b3c847a0f674510d4978d5cf6f960452795e8ff6f189fd2088a3f6ac7` |
| Scallop Market | `0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061939d9` |

---

## Roadmap

- **Done** — Payment links + Scallop yield on mainnet, wallet integration, zkLogin scaffolding
- **Now** — Email notifications, domain deployment
- **Next** — AI yield routing agent (multi-protocol), business dashboard
- **Future** — Mobile app, fiat on-ramp, recurring links, API/widgets

---

## License

MIT
