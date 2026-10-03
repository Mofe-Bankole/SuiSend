"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Reveal from "../Reveal";

const comparisonRows = [
  { feature: "Funds earn yield while pending", suisend: true, paypal: false, venmo: false, bank: false, crypto: false },
  { feature: "Sub-second finality", suisend: true, paypal: false, venmo: false, bank: false, crypto: true },
  { feature: "Self-custodial (you hold keys)", suisend: true, paypal: false, venmo: false, bank: false, crypto: true },
  { feature: "No account needed to receive", suisend: true, paypal: false, venmo: false, bank: false, crypto: false },
  { feature: "Auto-refund with interest if unclaimed", suisend: true, paypal: false, venmo: false, bank: false, crypto: false },
  { feature: "Global, no borders", suisend: true, paypal: true, venmo: false, bank: false, crypto: true },
  { feature: "Programmable (smart contracts)", suisend: true, paypal: false, venmo: false, bank: false, crypto: true },
  { feature: "Zero platform fees", suisend: true, paypal: false, venmo: false, bank: false, crypto: true },
  { feature: "Audited smart contracts", suisend: true, paypal: true, venmo: true, bank: true, crypto: false },
  { feature: "Multi-currency (SUI + USDC)", suisend: true, paypal: true, venmo: false, bank: true, crypto: false },
  { feature: "On-chain receipt (NFT proof)", suisend: true, paypal: false, venmo: false, bank: false, crypto: false },
  { feature: "Transparent yield tracking", suisend: true, paypal: false, venmo: false, bank: false, crypto: false },
];

const columns = [
  { key: "suisend" as const, label: "SuiSend", highlight: true },
  { key: "paypal" as const, label: "PayPal" },
  { key: "venmo" as const, label: "Venmo" },
  { key: "bank" as const, label: "Bank Transfer" },
  { key: "crypto" as const, label: "Crypto Transfer" },
];

function Check() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,8 6.5,11.5 13,5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}

export default function ComparisonTable() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      className="section-wrap mx-auto max-w-[1200px] px-12 py-[120px] max-md:px-6 bg-bg-card border-t border-border"
      id="comparison"
    >
      <div className="eyebrow">Why SuiSend</div>
      <Reveal>
        <h2 className="section-h2">
          The only payment method<br />
          where <span className="gradient-text">idle money works</span>
        </h2>
      </Reveal>

      <motion.div
        className="comparison-table-wrap"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="comparison-table-container">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="comparison-th">Feature</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`comparison-th ${
                      col.highlight ? "comparison-th-highlight" : ""
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`comparison-row ${
                    i % 2 === 0 ? "even" : "odd"
                  }`}
                  style={{
                    animationDelay: `${i * 0.03}s`,
                  }}
                >
                  <td className="comparison-td comparison-td-feature">
                    <span className="feature-text">{row.feature}</span>
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="comparison-td comparison-td-center">
                      {row[col.key] ? (
                        <motion.div
                          className="check-icon"
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.03 }}
                        >
                          <Check />
                        </motion.div>
                      ) : (
                        <motion.div
                          className="cross-icon"
                          initial={{ scale: 0, rotate: 45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.02 }}
                        >
                          <Cross />
                        </motion.div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <motion.div
        className="comparison-cta"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <p className="comparison-note">
          SuiSend is the only payment method where your money earns yield while
          waiting to be claimed. Idle money should work — not wait.
        </p>
        <div className="comparison-buttons">
          <a href="/app" className="btn-p btn-primary">
            Try it now →
          </a>
          <a href="https://github.com/suisend/suisend" target="_blank" rel="noopener noreferrer" className="btn-s">
            View on GitHub ↗
          </a>
        </div>
      </motion.div>
    </section>
  );
}