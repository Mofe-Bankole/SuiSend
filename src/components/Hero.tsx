"use client";

import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { getScallopApy } from "@/lib/scallop";
import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const rise = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function estimateWeeklyYield(principal: number, apyPct: number): number {
  return (principal * (apyPct / 100) * 7) / 365;
}

export default function Hero() {
  const suiClient = useSuiClient();
  const [apy, setApy] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScallopApy(suiClient)
      .then((v) => {
        if (!cancelled) setApy(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [suiClient]);

  const exampleApy = apy ?? 8.2;
  const weeklyYield = estimateWeeklyYield(100, exampleApy);

  return (
    <section
      className="relative overflow-hidden px-6 md:px-12 pt-36 md:pt-44 pb-24"
      id="top"
    >
      <div className="hero-glow" aria-hidden />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto max-w-[1200px] text-center"
      >
        <motion.div variants={rise} className="hero-tag mx-auto">
          <div className="hero-tag-dot" />
          Live on Sui mainnet · Yield by Scallop
        </motion.div>

        <motion.h1 variants={rise} className="hero-title">
          Send money.
          <br />
          It <em className="not-italic gradient-text">earns</em> while
          they wait.
        </motion.h1>

        <motion.p variants={rise} className="hero-sub mx-auto mt-7">
          Every payment link deposits into a real DeFi lending pool. The
          recipient claims your original amount — plus the interest it
          earned along the way.
        </motion.p>

        <motion.div
          variants={rise}
          className="flex gap-3 items-center justify-center mt-10"
        >
          <a href="/app" className="btn-p">
            Create a link
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 7h10M8 3l4 4-4 4" />
            </svg>
          </a>
          <a href="#how" className="btn-s">
            How it works
          </a>
        </motion.div>

        {/* Crafted product visual — honest, labeled example */}
        <motion.div
          initial={{ opacity: 0, y: 48, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-20 max-w-[560px]"
        >
          <div className="mock text-left">
            <div className="mock-bar">
              <div className="mock-dot" />
              <div className="mock-dot" />
              <div className="mock-dot" />
              <div className="mock-url">suisend.xyz/app</div>
            </div>
            <div className="mock-body">
              <div className="mock-label">Amount</div>
              <div className="mock-input">100 SUI</div>
              <div className="mock-label">Note</div>
              <div className="mock-input font-normal! text-text-secondary!">
                For the Lagos trip…
              </div>
              <div className="mock-yield">
                <span className="mock-yield-l">
                  Est. yield · 7 days ·{" "}
                  {apy === null ? "…" : exampleApy.toFixed(1) + "% live APY"}
                </span>
                <span className="mock-yield-r">
                  +{weeklyYield.toFixed(3)} SUI
                </span>
              </div>
              <div className="mock-btn">Generate payment link →</div>
              <div className="mock-link">
                <div className="mock-link-dot" />
                suisend.xyz/claim/0x4f2a…8c91
              </div>
            </div>
          </div>

          <div
            className="mock-float hidden lg:block"
            style={{ right: "-88px", bottom: "52px" }}
          >
            <div className="mf-label">Recipient claims</div>
            <div className="mf-val">
              {(100 + weeklyYield).toFixed(3)} SUI
            </div>
            <div className="mf-sub">principal + yield</div>
          </div>

          <div className="text-text-muted text-[11px] mt-5">
            Example, not a real transaction ·{" "}
            <a
              href="https://suiscan.xyz/mainnet/object/0x4889941e6073c7e3bebc602c1a09ebc014c64a2b9137569a20100ece0219bafd"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              verified on mainnet ↗
            </a>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
