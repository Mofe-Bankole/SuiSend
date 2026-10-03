# SuiSend Brand

Design direction: **Soft Consumer** — warm dark surfaces, friendly and
confidence-building. A payments product for regular people, not a trading
terminal. Chosen 2026-10-02; replaces the previous acid-green-on-black
"crypto template" look.

## Voice

Warm, plain-spoken, honest to a fault. Never promise what the product
doesn't do today. Roadmap items are always labeled "Coming soon".
Numbers on screen are real or clearly labeled "Example"/"est." — never
fabricated tickers.

## Color

Dark mode is the primary experience.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#12130f` | Page background — warm charcoal, never blue-black, never pure black |
| `--bg-card` | `#1a1c16` | Card/panel surfaces |
| `--bg-card2` | `#f7f5ee` | Light "flip" card (feature grid contrast) |
| `--border` | `rgba(244,243,238,0.07)` | Hairlines |
| `--border-light` | `rgba(244,243,238,0.12)` | Inputs, hover states |
| `--text-primary` | `#f4f3ee` | Warm white |
| `--text-secondary` | `#a9a79c` | Secondary — readable (≥4.5:1 on bg), don't darken |
| `--text-muted` | `#6d6c62` | Captions only |
| `--accent` (`--mint`) | `#7ee2b2` | The one accent — soft spring mint |
| `--accent-strong` | `#4fd49b` | Hover/active depth |
| `--accent-soft` | `rgba(126,226,178,0.09)` | Tinted surfaces |
| `--accent-mid` | `rgba(126,226,178,0.22)` | Accent borders |
| `--mint-ink` | `#0d241a` | Text/icons on accent buttons |

**Signature gradient** (`--gradient-brand`): `linear-gradient(135deg, #7ee2b2, #5fd8c4)` —
reserved for brand moments ONLY: primary CTA buttons, the hero "earns"
wordmark, primary action buttons in-app. Never on backgrounds, cards, or
decorative elements.

Rules:
- One accent. No competing hues (no cyan/blue/purple gradients — ever).
- Accent means "money, yield, go". It is not decoration.
- No pure `#000` anywhere. No neon/acid greens.

## Typography

One family drives everything: **Sora** (`--font-sora`) — headlines, buttons,
body, labels, and all numbers. Rounded, warm geometry that reads friendly at
every size; tight tracking (-0.03em to -0.04em) reserved for headlines.
- **Mono:** IBM Plex Mono (`--font-mono`) — addresses, hashes ONLY. Humanist
  and warm; do NOT use JetBrains Mono or Geist Mono (harsh IDE impression).
- Numbers always `font-variant-numeric: tabular-nums`.
- Hierarchy: 3 weights max (400/600/700), 4-5 sizes per surface.
- Do NOT reintroduce Space Grotesk or Inter — single-family rule.

## Shape & depth

- Radii: `--r-sm: 10px`, `--r-md: 14px` (buttons, inputs), `--r-lg: 18px`
  (cards), `--r-xl: 24px` (hero objects). Radius varies by role, not uniform.
- Depth comes from **glows and surface steps**, not drop shadows:
  `--glow-accent` on primary actions only; `--shadow-card` (soft, 28% black,
  40px blur) on hero-level cards only.
- Glassmorphism only where structurally justified (sticky header, modals) —
  never decorative.

## Motion

Welcoming, not mechanical. Entrance 300-500ms with
`cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint feel); staggered children
(40-90ms) on first mount. Exits faster than entries. Slight playfulness on
success moments (`tx-pop` spring). No `transition: all` — ever; transition
named properties only. Marquees/auto-playing carousels are banned.

## Honesty rules (binding)

1. No fake live data. If it ticks, it's real or it's labeled.
2. No fabricated activity (no invented addresses, transactions, testimonials).
3. "Coming soon" badge on anything not shipped today.
4. No "audited" claims until an external audit exists.
5. Bearer-link risk is stated, not hidden: "anyone with this link can claim".

## Don'ts

- Acid green `#9eff5b` or any neon on near-black
- Emoji as iconography (inline SVG only, 1.6-1.8px stroke, rounded caps)
- Three-column icon+heading+paragraph grids repeated down the page
- Vague headlines ("the future of…", "seamless", "cutting-edge")
- Custom cursors, `cursor: none`, scroll-jacking
- `transition: all`
