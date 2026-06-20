# SuiSend — Pitch Deck Generation Prompt

Copy this entire prompt and paste it to the other model. It has everything needed to generate a pitch deck.

---

## Role

You are generating a pitch deck for a Sui blockchain product. You must follow the Sequoia/YC/Guy Kawasaki pitch framework. Output a single self-contained HTML file (one file, zero dependencies, works offline) that can be opened in a browser and File → Print → Save as PDF. Use dark theme (projector-friendly). Each slide must have presenter notes (hidden by default, toggle with `N` key). Navigation with arrow keys and click-to-advance.

## Brand Colors (MANDATORY — use these exactly)

These are the product's brand colors and must be used as the CSS variables in the deck:

```css
--bg: #08080a
--bg-card: #0f0f12
--accent: #9eff5b (neon lime green — this is the primary brand color)
--accent-dim: rgba(158, 255, 91, 0.08)
--accent-mid: rgba(158, 255, 91, 0.18)
--text-primary: #f0efe9 (warm off-white)
--text-secondary: rgba(240, 239, 233, 0.65)
--text-muted: rgba(240, 239, 233, 0.35)
--border: rgba(240, 239, 233, 0.08)
```

Font: Inter (headings + body), JetBrains Mono (code/monospace). Google Fonts CDN is fine.

## Product Info

### One-Liner
**Send SUI via link, earn yield while they wait.**

### Full Description
SuiSend is a payment link platform on the Sui blockchain where sent funds auto-deposit into Scallop lending protocol and earn yield until the recipient claims them. Think "Venmo link meets yield-bearing stablecoin." Currently live on Sui mainnet.

### The Problem (make the audience feel this)
- Crypto transfers are binary — funds either arrive or they don't. While "in flight," they sit idle earning nothing.
- Recipient needs a wallet with the correct network configured — high friction for casual users.
- Existing escrow/timelock contracts just hold funds, they don't grow them.
- No way to send money to someone without first asking for their address.

### The Solution
1. **Yield-In-Flight** — Sender creates a payment link. Funds atomically deposit to Scallop → mint sSUI (yield-bearing receipt). Yield accrues from second one until claim.
2. **Link-Based Claim** — Recipient gets a URL. Opens in browser. Connects any wallet. Claims base amount + accrued yield. No address sharing needed.
3. **Encrypted Notes (optional)** — Sender can attach a message encrypted via Walrus blob storage. Best-effort: CORS failures silently skip the note without failing the transaction.
4. **Auto-Refund** — If recipient never claims, funds return to sender after expiry.

### Why Now (Three Catalysts)
1. **Yield Unlocked** — Scallop protocol brought real lending yield to Sui. Any Sui program can atomically deposit into Scallop — no bridging, no wrapping.
2. **Tech Unlock** — Sui's Programmable Transaction Blocks (PTBs) let SuiSend chain Scallop deposit + payment link creation into a single atomic operation.
3. **UX Proven** — Link-based payments are already understood by billions (Venmo, CashApp, PayLink). No education needed.

### Why Sui (Blockchain Necessity Test — removing blockchain breaks the product)
- **Without blockchain:** Needs a trusted intermediary to hold and deploy funds. 3-5 day settlement. KYC required. Cross-border friction. No programmatic composable yield.
- **With Sui:** Atomic PTB executes deposit → mint → link creation in one tx. Composable with Scallop — yield without wrapping contracts. Permissionless, global by default, no KYC.

### Smart Contracts (Move language, all deployed to Sui mainnet)
- **Package ID:** `0xbefdf37eec293a5a26e0d28c9f3161d325e50661f88390c6179d92bb44f1e06e`
- **4 modules:**
  - `core.move` (848 lines) — Payment lifecycle: create, claim, refund, cancel. Shared PaymentBook singleton. 6 objects, 3 events (PaymentCreated, PaymentClaimed, PaymentRefunded), 8 entry functions, 5 query functions.
  - `yield_scallop.move` (178 lines) — Scallop mint/redeem adapter: deposits SUI → Scallop → sSUI, redeems sSUI + yield → SUI.
  - `yield.move` (286 lines) — Yield abstraction layer: generic deposit/withdraw interface so other yield sources can be swapped in.
  - `walrus.move` (44 lines) — Typed Walrus blob ID wrapper for encrypted notes.
- **Scallop integration:** Uses Scallop core version `0x07871c4b...`, market `0xa7579752...`, protocol `0xefe8b3...`. Funds deposited into Scallop earn interest until claimed.
- **First successful on-chain transaction:** `HkeqZBFuk8hWJQhBJqzjRt8HH8UFv1hhJKGK37MJmgQ1` — 0.3 SUI → Scallop, sSUI minted, PaymentCreatedEvent emitted.

### Frontend
- **Next.js 16** with `@mysten/dapp-kit` v1.0.6 and `@mysten/sui` v2.17.0
- **Live at:** suisend.xyz (Vercel + Namecheap domain)
- **Tabs:** Send (create payment link with amount + optional note), Claim (paste link to claim), History (live on-chain payment activity polled from events)
- **Auth:** Wallet connection via dapp-kit (zkLogin ready for non-wallet users)
- **Landing page:** Live on-chain stats (total payments, volume, unique senders polled from PaymentCreatedEvent) with animated count-up
- **Custom cursor:** SVG neon coin silhouette with `mix-blend-mode: difference`
- **Dark theme:** `#08080a` background, `#9eff5b` neon accent

### Traction / Proof (these are REAL — on mainnet)
- 4 Move modules deployed and functional on Sui mainnet
- First payment tx confirmed: `HkeqZBFuk8hWJQhBJqzjRt8HH8UFv1hhJKGK37MJmgQ1`
- Scallop yield cycle works end-to-end (SUI → deposit → sSUI minted → redeem → SUI + yield)
- Live frontend at suisend.xyz displaying real on-chain data
- Package object IDs all valid: version `0x07871c...`, market `0xa75797...`, protocol `0xefe8b3...`

### Audience
- **Hackathon judges** (e.g., Sui Overflow)
- Need to see: working demo, innovation, completeness, technical sophistication

### Tone
- Bold, confident, punchy. Short sentences. Lowercase energy.
- Examples: "Funds sit dead in transit", "Payment links that earn while pending"
- No corporate fluff. No "revolutionizing the future of finance."

### The Ask
- **Vote / Win the track.** Key judging points: full-stack implementation (smart contracts + frontend + deployment), real mainnet usage, Scallop composability, innovation of yield-in-flight concept.
- Future roadmap items (mention briefly): zkLogin for non-wallet users, multi-token support, mobile app.

### Pitch Deck Structure (required slides — hackathon format)
10 slides maximum:
1. Title — SuiSend, tagline, category badges
2. Problem — Crypto transfers are binary, funds idle in transit
3. Why Now — Scallop + Sui PTBs + proven link UX
4. Solution — 3 feature cards (yield-in-flight, link claim, encrypted notes)
5. Demo / Product — Screenshot area + callouts (leave a placeholder that says "Drop your app screenshot here")
6. Why Sui — Without blockchain vs With Sui comparison table/cards
7. Traction — Live on mainnet metrics
8. Team — Solo founder, end-to-end builder
9. Ask — Summary of what was built + judge ask
10. Contact — suisend.xyz

### Design Rules (enforced)
- Dark theme only (projectors in dark rooms)
- One idea per slide. Max 6 words per bullet, max 6 bullets per slide.
- 28px minimum body font. 18px minimum for labels/captions.
- Whitespace is confidence — don't fill every pixel.
- No purple. No gradient backgrounds. Flat colors only (use the brand colors above).
- No decorative elements (random shapes, stock photos, gradients for the sake of it).
- Slides alternate between `#08080a` and `#0b0b0e` backgrounds for visual rhythm.
- Presenter notes on every slide (hidden, toggle with N key).
- Navigation: arrow keys (left/right), space bar to advance, click left/right half of slide.
- Print support: `@media print` — position relative, page-break-after always, hide nav and notes.

### Deliverable
A single self-contained HTML file at the project root named `pitch-deck.html`. Open in browser, Ctrl+P → Save as PDF gives a production-ready PDF pitch deck.

---

End of prompt. Copy everything above.
