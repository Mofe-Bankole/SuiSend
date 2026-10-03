"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

const faqs = [
  {
    q: "How does SuiSend work?",
    a: "You connect your wallet and create a payment link with an amount. The funds are deposited into Scallop's lending pool on Sui where they earn yield until claimed. You share the link, and the recipient claims the original amount plus all interest accrued.",
  },
  {
    q: "Is my money safe?",
    a: "Funds never sit with us — they're deposited directly into Scallop via smart contracts you can verify on-chain. Two things to know: the claim link is a bearer link (anyone who has it can claim, so share it carefully), and DeFi yields carry smart-contract risk. We never custody anything.",
  },
  {
    q: "What happens if the recipient never claims?",
    a: "You can take an unclaimed payment back at any time — you get your original amount plus all yield earned. Automatic refunds on link expiry are rolling out as well.",
  },
  {
    q: "Does the recipient need a crypto wallet?",
    a: "They can claim with any Sui wallet, or by signing in with Google (zkLogin) — no seed phrase needed. Google claims currently require a small SUI balance for gas; fully sponsored, zero-balance claims are coming.",
  },
  {
    q: "What yield can I expect?",
    a: "Whatever Scallop's SUI lending pool is paying — recently around 8% APY, variable. The app shows you the live pool rate before you send. Yield accrues in real time until the moment the link is claimed.",
  },
  {
    q: "Is this on mainnet or testnet?",
    a: "Fully on Sui mainnet, with real SUI and USDC, integrated with Scallop's production lending pools. Contract addresses are linked in our docs.",
  },
  {
    q: "How will yield routing work?",
    a: "Today every deposit goes to Scallop. On the roadmap: routing across Sui lending protocols (Navi and others) to always land in the highest pool — automatically.",
  },
  {
    q: "What fees does SuiSend charge?",
    a: "Zero platform fees. You only pay Sui network gas (typically less than $0.01 per transaction). Every point of yield goes to you or your recipient.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <div className="section-wrap">
      <SectionHead
        index={5}
        of={5}
        label="Questions"
        title={
          <>
            Everything you
            <br />
            need to know
          </>
        }
      />

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
