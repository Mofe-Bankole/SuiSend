"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import Reveal from "../Reveal";

const featureDetails = [
  {
    id: "create",
    number: "01",
    icon: "→",
    title: "Create Payment Link",
    subtitle: "One transaction. Instant yield. Shareable link.",
    description:
      "Connect your Sui wallet, select SUI or USDC, enter an amount, and optionally add a note. Your funds are deposited directly into Scallop's lending pool in a single atomic transaction, minting yield-bearing sSUI/sUSDC receipt tokens.",
    technicalDetails: [
      "Atomic: deposit + record creation + voucher mint in one PTB",
      "Gas cost: ~0.001 SUI (sub-cent)",
      "Supports SUI and Wormhole USDC",
      "Optional note stored on Walrus (5 epochs ≈ 10 weeks)",
      "Generates cryptographically random 32-byte link hash",
      "PaymentVoucher NFT transferred to sender for refunds",
    ],
    codeSnippet: `// PTB: create_payment_scallop
tx.moveCall({
  target: \`\${PACKAGE}::core::create_payment_scallop\`,
  arguments: [
    tx.object(PAYMENT_BOOK),
    tx.object(SCALLOP_VAULT),
    tx.object(YIELD_ROUTER_CAP),
    tx.object(SCALLOP_VERSION),
    tx.object(SCALLOP_MARKET),
    tx.object(CLOCK),
    paymentCoin,      // split from gas
    tx.pure.vector('u8', linkHash),
    tx.pure.u64(expiryMs),
    tx.pure.vector('u8', noteBlobId),
  ],
});`,
    benefits: [
      "Funds never sit idle — earning from block 1",
      "Self-custodial: you hold the voucher, not us",
      "Instant finality on Sui (< 0.5s)",
      "Works with any Sui wallet or zkLogin",
    ],
  },
  {
    id: "yield",
    number: "02",
    icon: "◎",
    title: "Real-Time Yield Accrual",
    subtitle: "Your money compounds every block, not every month.",
    description:
      "While a payment sits unclaimed, the underlying sSUI/sUSDC in Scallop's pool continuously accrues interest. The yield rate updates in real-time based on Scallop's utilization curve — currently ~8.2% APY for SUI deposits.",
    technicalDetails: [
      "APY sourced from Scallop market data in real-time",
      "Interest = supply_rate × deposited_amount × time",
      "Compounds continuously (per Sui checkpoint ~0.5s)",
      "Frontend displays live estimate: amount × APY × days/365",
      "No rebasing — sToken value grows, quantity stays fixed",
    ],
    codeSnippet: `// Scallop integration (yield_scallop.move)
public fun withdraw_scallop(vault: &mut ScallopYieldVault, position_id: ID): (u64, u64, Coin<SUI>) {
  let scoin = vault.balance.withdraw(position_scoin_amount);
  let (principal, interest) = scallop::redeem::redeem<SUI>(scoin);
  // principal = original deposit
  // interest = yield earned
  return (principal, interest, coin::into_coin(principal + interest));
}`,
    benefits: [
      "Transparent: yield visible on-chain via events",
      "No lockup penalty — claim anytime",
      "Higher utilization = higher APY for senders",
      "Recipient gets 100% of accrued yield",
    ],
  },
  {
    id: "claim",
    number: "03",
    icon: "↓",
    title: "Claim & Auto-Refund",
    subtitle: "Recipient gets principal + yield. Sender protected.",
    description:
      "Anyone with the link hash can claim. The contract withdraws from Scallop (redeeming sSUI for SUI + yield), transfers the full amount to the recipient, and mints a ClaimReceipt NFT as on-chain proof. If unclaimed after expiry (default 14 days, max 30), an authorized agent refunds the sender with all yield.",
    technicalDetails: [
      "claim_payment_scallop: removes record, redeems, transfers to recipient",
      "refund_sender_scallop: burns PaymentVoucher, redeems, returns to sender",
      "refund_expired_scallop: agent-only, requires expiry < now",
      "All paths emit events for indexing (PaymentClaimedEvent, PaymentRefundedEvent)",
      "ClaimReceipt stores: original_amount, yield_earned, total_claimed, claimed_at",
      "Uses saturating arithmetic — no underflow risk",
    ],
    codeSnippet: `// Claim flow (core.move)
public entry fun claim_payment_scallop(
  payment_book: &mut PaymentBook,
  scallop_vault: &mut ScallopYieldVault,
  clock: &Clock,
  link_hash: vector<u8>,
  ctx: &mut TxContext,
) {
  let record = table::remove(&mut payment_book.payments, link_hash);
  assert!(record.state == STATE_ACTIVE, EWrongState);
  
  let (principal, interest, coin) = yield_scallop::withdraw_scallop(scallop_vault, record.position_id);
  
  transfer::public_transfer(coin, ctx.sender());
  
  let receipt = ClaimReceipt { ... };
  transfer::public_transfer(receipt, ctx.sender());
  
  event::emit(PaymentClaimedEvent { ... });
}`,
    benefits: [
      "Zero trust: claim permissionless, no approval needed",
      "Auto-refund: sender never loses funds",
      "On-chain receipt: verifiable proof of claim",
      "All yield goes to recipient (or sender on refund)",
    ],
  },
  {
    id: "multicurrency",
    number: "04",
    icon: "⚡",
    title: "Multi-Currency Support (v4)",
    subtitle: "SUI + USDC. Extensible to any coin type.",
    description:
      "Version 4 introduced generic yield vaults allowing any SPL-compatible coin on Sui. Currently supports SUI (native) and Wormhole USDC. The architecture uses Move generics: `ScallopYieldVaultGeneric<phantom T>` where T is the coin type.",
    technicalDetails: [
      "Generic vault: `ScallopYieldVaultGeneric<phantom T>`",
      "create_payment_generic<T> / claim_payment_generic<T> / refund_*_generic",
      "Coin type tracked via dynamic field on PaymentBook ID",
      "USDC uses Scallop's USDC market (8.2% APY currently)",
      "Frontend auto-detects coin type from PaymentCreatedEvent",
      "Extensible: add new coins without contract upgrade",
    ],
    codeSnippet: `// Generic vault (yield_scallop.move)
struct ScallopYieldVaultGeneric<phantom T> has key {
  id: UID,
  balance: Balance<MarketCoin<T>>,
  positions: Table<ID, PositionRecord>,
}

public fun deposit_scallop_generic<T>(
  vault: &mut ScallopYieldVaultGeneric<T>,
  version: &Version,
  market: &Market,
  clock: &Clock,
  coin: Coin<T>,
): ID {
  let scoin = scallop::mint::mint<T>(coin, version, market, clock);
  // ... store position
}`,
    benefits: [
      "Stablecoin payments without volatility",
      "Same yield mechanics for any supported asset",
      "Future: add Sui native USDC, ETH, BTC bridges",
      "No new contract deployments needed",
    ],
  },
];

export default function FeatureDetailSection() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      className="section-wrap mx-auto max-w-[1200px] px-12 py-[120px] max-md:px-6"
      id="features"
    >
      <div className="eyebrow">Core features</div>
      <Reveal>
        <h2 className="section-h2">
          Four primitives.
          <br />
          Infinite <span className="gradient-text">possibilities</span>
        </h2>
      </Reveal>

      <div className="feature-detail-grid">
        {featureDetails.map((feature, i) => (
          <FeatureDetailCard
            key={feature.id}
            feature={feature}
            index={i}
            isExpanded={expanded === feature.id}
            onToggle={() => setExpanded(expanded === feature.id ? null : feature.id)}
            inView={isInView}
          />
        ))}
      </div>
    </section>
  );
}

function FeatureDetailCard({
  feature,
  index,
  isExpanded,
  onToggle,
  inView,
}: {
  feature: (typeof featureDetails)[0];
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  inView: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={cardRef}
      className="feature-detail-card"
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      style={{ "--accent-color": "var(--accent)" } as React.CSSProperties}
    >
      <div className="feature-card-header" onClick={onToggle}>
        <div className="feature-card-number">
          <span>{feature.number}</span>
        </div>
        <div className="feature-card-icon">{feature.icon}</div>
        <div className="feature-card-title-group">
          <h3 className="feature-card-title">{feature.title}</h3>
          <p className="feature-card-subtitle">{feature.subtitle}</p>
        </div>
        <motion.div
          className="feature-card-expand"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.div>
      </div>

      <motion.div
        className="feature-card-content"
        initial={false}
        animate={{
          height: isExpanded ? "auto" : 0,
          opacity: isExpanded ? 1 : 0,
          paddingTop: isExpanded ? 24 : 0,
          paddingBottom: isExpanded ? 24 : 0,
        }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        style={{ overflow: "hidden" }}
      >
        <div className="feature-card-body">
          <p className="feature-card-desc">{feature.description}</p>

          <div className="feature-card-section">
            <h4 className="feature-card-section-title">Technical details</h4>
            <ul className="feature-card-list">
              {feature.technicalDetails.map((detail, i) => (
                <li key={i}>
                  <span className="feature-card-bullet" />
                  {detail}
                </li>
              ))}
            </ul>
          </div>

          <div className="feature-card-section">
            <h4 className="feature-card-section-title">On-chain implementation</h4>
            <div className="feature-card-code">
              <pre>{feature.codeSnippet}</pre>
            </div>
          </div>

          <div className="feature-card-section">
            <h4 className="feature-card-section-title">Why it matters</h4>
            <ul className="feature-card-list">
              {feature.benefits.map((benefit, i) => (
                <li key={i}>
                  <span className="feature-card-bullet check" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}