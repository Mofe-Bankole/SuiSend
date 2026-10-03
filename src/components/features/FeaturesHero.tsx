"use client";

import { motion } from "framer-motion";

export default function FeaturesHero() {
  return (
    <section
      className="min-h-[80vh] flex items-center justify-center px-20 pb-20 pt-[140px] relative overflow-hidden max-md:px-6 max-md:pt-[120px] max-md:pb-[60px]"
      id="top"
    >
      <div className="dot-grid" />

      <div className="absolute inset-0 pointer-events-none">
        <div className="hero-glow-1" />
        <div className="hero-glow-2" />
      </div>

      <motion.div
        className="relative z-2 max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div
          className="hero-tag justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="hero-tag-dot" />
          Deep dive into the protocol
        </motion.div>

        <motion.h1
          className="font-display text-[clamp(40px,6vw,88px)] font-bold tracking-[-0.05em] leading-[1.0] mb-[24px]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          Every feature
          <br />
          <span className="gradient-text">on-chain</span>
          <br />
          <span className="gradient-text">by design</span>
        </motion.h1>

        <motion.p
          className="text-lg text-text-secondary font-light leading-[1.8] max-w-[560px] mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          No trusted intermediaries. No off-chain promises. Your funds live
          in audited Scallop smart contracts, earning real DeFi yield from
          the moment you send until the moment they claim.
        </motion.p>

        <motion.div
          className="flex flex-wrap gap-4 items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <a href="#features" className="btn-p btn-primary">
            Explore features
          </a>
          <a href="/app" className="btn-s">
            Launch app →
          </a>
        </motion.div>

        <motion.div
          className="flex items-center justify-center gap-12 pt-12 border-t border-border max-w-xl mx-auto mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
        >
          <StatPill value="8.2%" label="Base APY (Scallop)" />
          <StatPill value="30d" label="Max lockup" />
          <StatPill value="0.001" label="Gas cost (SUI)" />
          <StatPill value="v4" label="Mainnet version" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-pill">
      <div className="stat-pill-value">{value}</div>
      <div className="stat-pill-label">{label}</div>
    </div>
  );
}