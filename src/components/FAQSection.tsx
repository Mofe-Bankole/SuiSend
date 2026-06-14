"use client";

import { useState } from "react";
import Reveal from "./Reveal";

const faqs = [
  {
    q: "How does SuiSend work?",
    a: "You connect your wallet and create a payment link with an amount. The funds are deposited into DeFi lending pools (Scallop) where they earn yield until claimed. You share the link, and the recipient claims the original amount plus all interest accrued.",
  },
  {
    q: "Is my money safe?",
    a: "Yes — funds never sit with us. They're deposited directly into audited DeFi protocols on Sui (starting with Scallop) via smart contracts you can verify on-chain. Every transaction is self-custodial.",
  },
  {
    q: "What happens if the recipient never claims?",
    a: "Payment links auto-refund after 14 days. You get back your original amount plus all yield earned during that period — nothing is lost.",
  },
  {
    q: "Does the recipient need a crypto wallet?",
    a: "Not in the current version. Recipients can claim using just the link. zkLogin support (claim with Google, Twitter, or email) is coming soon — no wallet required on either side.",
  },
  {
    q: "What yield can I expect?",
    a: "Current APY on Scallop's Sui lending pool is approximately 8.2%. The yield is calculated in real time and prorated by the second — every moment your money is unclaimed, it earns.",
  },
  {
    q: "Is this on mainnet or testnet?",
    a: "The smart contracts are deployed on Sui testnet for the hackathon. Mainnet deployment is planned post-hackathon. The Scallop integration will work with real SUI on mainnet.",
  },
  {
    q: "How does the AI yield routing work?",
    a: "Our agent monitors multiple DeFi protocols (Scallop, Navi) and automatically routes deposits to the highest available APY. Multi-protocol routing is in development — for now, funds are deposited into Scallop.",
  },
  {
    q: "What fees does SuiSend charge?",
    a: "Zero platform fees. You only pay Sui network gas fees (typically less than $0.01 per transaction). The yield your money earns while unclaimed is entirely yours (or the recipient's).",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <div className="section-wrap">
      <div className="eyebrow">Common questions</div>
      <Reveal>
        <h2 className="section-h2">
          Everything you<br />
          need to know
        </h2>
      </Reveal>

      <Reveal delay="rd1">
        <div className="faq-list">
          {faqs.map((faq, i) => (
            <div key={i} className={`faq-item ${openIndex === i ? "open" : ""}`}>
              <button className="faq-q" onClick={() => toggle(i)}>
                <span>{faq.q}</span>
                <svg className="faq-arrow" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6l5 5 5-5" />
                </svg>
              </button>
              <div className="faq-a">
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
