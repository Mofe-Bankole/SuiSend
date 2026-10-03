"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Reveal from "../Reveal";

const protocolSteps = [
  {
    step: 1,
    title: "Sender creates payment",
    description:
      "Sender calls `create_payment_scallop` (or `_generic`). Funds split from gas coin → deposited into Scallop via `mint<SUI>` → sSUI minted to ScallopYieldVault. PaymentRecord created in shared PaymentBook table. PaymentVoucher NFT transferred to sender.",
    contracts: ["core::create_payment_scallop", "yield_scallop::deposit_scallop"],
    events: ["PaymentCreatedEvent"],
    objects: ["PaymentBook (shared)", "ScallopYieldVault (shared)", "PaymentVoucher (owned)"],
  },
  {
    step: 2,
    title: "Funds earn yield in Scallop",
    description:
      "sSUI in ScallopYieldVault represents share of lending pool. Scallop's interest rate model updates utilization-based APY in real-time. No action needed — yield compounds automatically every checkpoint (~0.5s). Frontend polls Scallop SDK for live APY display.",
    contracts: ["Scallop Protocol (external)"],
    events: ["ScallopDepositEvent"],
    objects: ["ScallopYieldVault balance grows", "Market singleton tracks utilization"],
  },
  {
    step: 3,
    title: "Recipient claims payment",
    description:
      "Anyone with link_hash calls `claim_payment_scallop`. Record removed from PaymentBook. sSUI redeemed via Scallop `redeem<SUI>` → returns Coin<SUI> with principal + interest. Transferred to recipient. ClaimReceipt NFT minted as proof. PaymentClaimedEvent emitted.",
    contracts: ["core::claim_payment_scallop", "yield_scallop::withdraw_scallop"],
    events: ["PaymentClaimedEvent", "ScallopWithdrawEvent"],
    objects: ["ClaimReceipt (owned by recipient)", "PaymentBook record removed"],
  },
  {
    step: 4,
    title: "Auto-refund (if expired)",
    description:
      "After expiry (default 14 days, max 30), authorized agent calls `refund_expired_scallop` with RefundAgentCap. Verifies `clock.timestamp_ms() >= record.expiry`. Redeems sSUI from Scallop, transfers full amount (principal + yield) to original sender. PaymentRefundedEvent emitted with initiator='agent'.",
    contracts: ["core::refund_expired_scallop", "yield_scallop::withdraw_scallop"],
    events: ["PaymentRefundedEvent"],
    objects: ["RefundAgentCap (owned by agent)", "PaymentBook record removed"],
  },
];

const sharedObjects = [
  {
    name: "PaymentBook",
    type: "core::PaymentBook",
    id: "0x4889941e...0219bafd",
    description: "Global registry. Table<link_hash, PaymentRecord>. Shared object — anyone can read, only entry functions modify.",
  },
  {
    name: "ScallopYieldVault (SUI)",
    type: "yield_scallop::ScallopYieldVault",
    id: "0x4ef1d47e...01f24cb",
    description: "Holds Balance<MarketCoin<SUI>> (sSUI). Tracks positions per payment. Shared object.",
  },
  {
    name: "ScallopYieldVaultGeneric (USDC)",
    type: "yield_scallop::ScallopYieldVaultGeneric<USDC>",
    id: "0x... (v4)",
    description: "Generic vault for USDC. Holds Balance<MarketCoin<USDC>>. Created in v4 upgrade.",
  },
  {
    name: "YieldRouterCap",
    type: "core::YieldRouterCap",
    id: "0xb0c4c042...ec2a4f5",
    description: "Authorizes yield rebalancing. Owned by deployer. Can rotate agent.",
  },
  {
    name: "RefundAgentCap",
    type: "core::RefundAgentCap",
    id: "0xb3599dd6...557a7a4",
    description: "Authorizes expired payment refunds. Contains agent address. Can rotate.",
  },
  {
    name: "AdminCap",
    type: "core::AdminCap",
    id: "0x80d507ca...eb80f2b",
    description: "Super admin. Owns UpgradeCap. Can rotate RefundAgentCap and YieldRouterCap.",
  },
];

export default function ProtocolDeepDive() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      className="section-wrap mx-auto max-w-[1200px] px-12 py-[120px] max-md:px-6 bg-bg-card border-t border-border"
      id="protocol"
    >
      <div className="eyebrow">Protocol deep dive</div>
      <Reveal>
        <h2 className="section-h2">
          How it works
          <br />
          <span className="gradient-text">under the hood</span>
        </h2>
      </Reveal>

      <motion.div
        className="protocol-flow"
        initial={false}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {protocolSteps.map((step, i) => (
          <ProtocolStepCard key={step.step} step={step} index={i} />
        ))}
      </motion.div>

      <motion.div
        className="shared-objects-section"
        initial={false}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <h3 className="section-h3">Shared objects on mainnet</h3>
        <div className="shared-objects-grid">
          {sharedObjects.map((obj, i) => (
            <SharedObjectCard key={obj.name} obj={obj} index={i} />
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function ProtocolStepCard({ step, index }: { step: typeof protocolSteps[0]; index: number }) {
  return (
    <div className="protocol-step-card">
      <div className="protocol-step-number">
        <span>{step.step}</span>
        {index < protocolSteps.length - 1 && <div className="protocol-step-connector" />}
      </div>
      <div className="protocol-step-content">
        <h3 className="protocol-step-title">{step.title}</h3>
        <p className="protocol-step-desc">{step.description}</p>

        <div className="protocol-step-tags">
          <div className="protocol-tag-group">
            <span className="protocol-tag-label">Contracts</span>
            <div className="protocol-tags">
              {step.contracts.map((c) => (
                <span key={c} className="protocol-tag">{c}</span>
              ))}
            </div>
          </div>
          <div className="protocol-tag-group">
            <span className="protocol-tag-label">Events</span>
            <div className="protocol-tags">
              {step.events.map((e) => (
                <span key={e} className="protocol-tag event">{e}</span>
              ))}
            </div>
          </div>
          <div className="protocol-tag-group">
            <span className="protocol-tag-label">Objects</span>
            <div className="protocol-tags">
              {step.objects.map((o) => (
                <span key={o} className="protocol-tag object">{o}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SharedObjectCard({ obj, index }: { obj: typeof sharedObjects[0]; index: number }) {
  return (
    <motion.div
      className="shared-object-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <div className="shared-object-header">
        <div className="shared-object-icon">{obj.name.charAt(0)}</div>
        <div>
          <h4 className="shared-object-name">{obj.name}</h4>
          <p className="shared-object-type">{obj.type}</p>
        </div>
      </div>
      <p className="shared-object-desc">{obj.description}</p>
      <div className="shared-object-id">
        <code>{obj.id}</code>
        <span className="copy-hint" title="Click to copy">Copy</span>
      </div>
    </motion.div>
  );
}