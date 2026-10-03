"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Reveal from "../Reveal";

const useCases = [
  {
    category: "Freelancers & Agencies",
    icon: "💻",
    scenarios: [
      {
        title: "Invoice with built-in yield",
        description:
          "Send a payment link instead of a static invoice. While your client processes payment (Net 30, Net 60), your funds earn 8.2% APY in Scallop.",
        yieldExample: "10,000 SUI × 60 days = ~135 SUI earned",
      },
      {
        title: "Milestone payments that compound",
        description:
          "Break a project into milestone links. Each unclaimed milestone earns yield until the client approves. Early payments = more yield for you.",
        yieldExample: "3 milestones × 30 days avg = ~67 SUI each",
      },
    ],
  },
  {
    category: "Global Remittances",
    icon: "🌍",
    scenarios: [
      {
        title: "Send home, they receive more",
        description:
          "Traditional remittance: 5-7% fees, 3-5 days. SuiSend: ~$0.001 gas, sub-second finality, recipient gets principal + yield. Every transfer becomes a gift.",
        yieldExample: "500 SUI sent → ~500.5 SUI received after 2 weeks",
      },
      {
        title: "No bank account needed for recipient",
        description:
          "Recipient claims via Google (zkLogin) — no Sui wallet, no exchange account, no KYC. Just a Google account and internet access.",
        yieldExample: "Claim in 3 clicks, zero onboarding friction",
      },
    ],
  },
  {
    category: "DAOs & Treasuries",
    icon: "🏛️",
    scenarios: [
      {
        title: "Grant disbursements that earn",
        description:
          "DAO approves 50 grants. Instead of batch-transferring, create 50 payment links. Each earns yield until the grantee claims. Treasury never sits idle.",
        yieldExample: "50 grants × 1000 SUI × 14 days = ~1,570 SUI total yield",
      },
      {
        title: "Contributor payroll with auto-refund",
        description:
          "Monthly contributor payments as links. If a contributor leaves or doesn't claim in 30 days, funds + yield auto-return to DAO treasury. No manual clawbacks.",
        yieldExample: "Auto-refund protects against stale payments",
      },
    ],
  },
  {
    category: "Group Funds & Events",
    icon: "🎉",
    scenarios: [
      {
        title: "Trip fund that grows",
        description:
          "Collect contributions for a group trip. The pooled money earns yield right up until it's spent on accommodations, flights, activities.",
        yieldExample: "10 people × 200 SUI × 60 days = ~270 SUI for the group",
      },
      {
        title: "Event ticketing with refunds",
        description:
          "Sell event access as payment links. If event cancels, auto-refund returns principal + yield to buyers. No chargeback fees, no payment processor disputes.",
        yieldExample: "Built-in consumer protection",
      },
    ],
  },
];

export default function UseCasesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      className="section-wrap mx-auto max-w-[1200px] px-12 py-[120px] max-md:px-6"
      id="use-cases"
    >
      <div className="eyebrow">Real-world uses</div>
      <Reveal>
        <h2 className="section-h2">
          Built for how money<br />
          <span className="gradient-text">actually moves</span>
        </h2>
      </Reveal>

      <motion.p
        className="text-[16px] text-text-secondary max-w-[600px] mb-16 leading-relaxed"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        From solo freelancers to DAOs managing millions — SuiSend turns every
        payment into a yield-generating position. Here's how different users
        put it to work.
      </motion.p>

      <div className="use-cases-grid">
        {useCases.map((category, i) => (
          <motion.div
            key={category.category}
            className="use-case-category"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
          >
            <div className="use-case-header">
              <span className="use-case-icon">{category.icon}</span>
              <div>
                <h3 className="use-case-title">{category.category}</h3>
                <p className="use-case-subtitle">
                  {category.scenarios.length} ways to use it
                </p>
              </div>
            </div>
            <div className="use-case-scenarios">
              {category.scenarios.map((scenario, j) => (
                <div key={scenario.title} className="use-case-scenario">
                  <h4 className="scenario-title">{scenario.title}</h4>
                  <p className="scenario-desc">{scenario.description}</p>
                  <div className="scenario-yield">
                    <span className="yield-label">Example yield:</span>
                    <span className="yield-value">{scenario.yieldExample}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}