"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import Reveal from "./Reveal";

const features = [
  {
    number: "01",
    icon: "→",
    title: "Create a payment link",
    description:
      "Connect your Sui wallet, enter an amount in SUI or USDC. One transaction deposits your funds directly into Scallop's lending pool and generates a shareable claim link.",
    highlight: "Live yield preview",
    badge: null,
    gradient: "from-accent to-lime-400",
    bgClass: "feat-dark",
  },
  {
    number: "02",
    icon: "◎",
    title: "Money earns while they wait",
    description:
      "While unclaimed, every second your funds compound at 8.2% APY. The longer they wait — the more they receive. No idle money, ever.",
    highlight: "Compounding every block",
    badge: null,
    gradient: "from-cyan-400 to-blue-400",
    bgClass: "feat-light",
  },
  {
    number: "03",
    icon: "⚡",
    title: "AI routes to best yield",
    description:
      "Our agent scans Sui DeFi protocols in real time and automatically routes to the highest available APY across Scallop, Navi, and DeepBook.",
    highlight: "Multi-protocol optimization",
    badge: "Coming soon",
    gradient: "from-purple-500 to-pink-500",
    bgClass: "feat-mid",
  },
  {
    number: "04",
    icon: "↓",
    title: "Recipient claims everything",
    description:
      "One click. They receive your original amount plus all interest accrued during the wait. If unclaimed after 30 days, you get it all back — with yield.",
    highlight: "Auto-refund with interest",
    badge: null,
    gradient: "from-accent to-lime-400",
    bgClass: "feat-accent",
    wide: true,
  },
];

export default function FeaturesSection() {
  const [activeFeature, setActiveFeature] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollY = useScroll();
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
          }
        });
      },
      { threshold: 0.12 },
    );
    const grid = gridRef.current;
    if (grid) {
      grid.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="section-wrap mx-auto max-w-[1200px] px-12 py-[120px] max-md:px-6"
      id="features"
    >
      <motion.div
        className="eyebrow"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        Key features
      </motion.div>
      <motion.div
        className="reveal"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <h2 className="section-h2">
          Payments that compound<br />
          <span className="gradient-text">while you wait</span>
        </h2>
      </motion.div>

      <motion.p
        className="text-[16px] text-text-secondary max-w-[600px] mb-16 leading-relaxed"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Every feature is built on-chain. No trusted intermediaries. Your funds
        never leave Scallop's audited smart contracts.
      </motion.p>

      <div className="feature-grid" ref={gridRef}>
        {features.map((feature, i) => (
          <FeatureCard
            key={feature.title}
            feature={feature}
            index={i}
            isActive={activeFeature === i}
            onHover={() => setActiveFeature(i)}
            onLeave={() => setActiveFeature(-1)}
          />
        ))}
      </div>

      <motion.div
        className="features-cta"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <a href="/app" className="btn-p btn-primary">
          Try it live →
        </a>
        <a href="/features" className="btn-s ml-3">
          View all features
        </a>
      </motion.div>
    </div>
  );
}

function FeatureCard({
  feature,
  index,
  isActive,
  onHover,
  onLeave,
}: {
  feature: (typeof features)[0];
  index: number;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [yieldValue, setYieldValue] = useState(0.0000000);

  useEffect(() => {
    if (feature.number === "01" || feature.number === "02") {
      const id = setInterval(() => {
        setYieldValue((v) => {
          const next = v + 0.0000028;
          return next > 0.1 ? 0 : next;
        });
      }, 900);
      return () => clearInterval(id);
    }
  }, [feature.number]);

  const cardStyle = {
    gridColumn: feature.wide ? "span 2" : "auto",
    gridRow: feature.number === "01" ? "span 2" : "auto",
  };

  return (
    <motion.div
      ref={cardRef}
      className={`feat ${feature.bgClass} reveal ${index === 0 ? "" : `rd${index}`}`}
      style={cardStyle}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      whileHover={{ scale: 1.01, zIndex: 10 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="feat-num"
        style={{
          color:
            feature.bgClass === "feat-light"
              ? "rgba(8,8,10,0.35)"
              : "var(--text-secondary)",
        }}
      >
        {feature.number}
      </div>
      <div
        className="feat-icon"
        style={{
          borderColor:
            feature.bgClass === "feat-light"
              ? "rgba(8,8,10,0.12)"
              : "var(--border-light)",
          color:
            feature.bgClass === "feat-light" ? "#08080A" : "inherit",
          background: `linear-gradient(135deg, ${feature.gradient})`,
        }}
      >
        {feature.icon}
      </div>
      <div
        className="feat-h3"
        style={{
          color: feature.bgClass === "feat-light" ? "#08080a" : "inherit",
        }}
      >
        {feature.title}
      </div>
      <p
        className="feat-p"
        style={{
          color:
            feature.bgClass === "feat-light"
              ? "rgba(8,8,10,0.55)"
              : "var(--text-secondary)",
        }}
      >
        {feature.description}
      </p>

      {feature.number === "01" && (
        <div className="feat-yield-vis">
          <div className="fyv-label">Live yield preview</div>
          <div className="fyv-val" style={{ color: "var(--accent)" }}>
            {yieldValue.toFixed(7)}
          </div>
          <div className="fyv-sub">SUI earned this session</div>
          <div className="fyv-bar">
            <motion.div
              className="fyv-bar-fill"
              animate={{ width: ["0%", "63%"] }}
              transition={{ duration: 2, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {feature.number === "02" && (
        <div className="feat-yield-vis" style={{ marginTop: 28 }}>
          <div className="fyv-label">Compounding in real-time</div>
          <div className="fyv-val" style={{ color: "#06b6d4" }}>
            {yieldValue.toFixed(7)}
          </div>
          <div className="fyv-sub">SUI per 100 SUI / 7 days</div>
          <div className="fyv-bar">
            <motion.div
              className="fyv-bar-fill"
              style={{ background: "linear-gradient(90deg, #06b6d4, #3b82f6)" }}
              animate={{ width: ["0%", "42%"] }}
              transition={{ duration: 2, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {feature.badge && (
        <div className="coming-badge ml-2" style={{ fontSize: 10 }}>
          {feature.badge}
        </div>
      )}

      <div
        className="feat-highlight"
        style={{
          borderColor:
            feature.bgClass === "feat-light"
              ? "rgba(8,8,10,0.15)"
              : "rgba(158,255,91,0.2)",
          background:
            feature.bgClass === "feat-light"
              ? "rgba(8,8,10,0.03)"
              : "rgba(158,255,91,0.06)",
        }}
      >
        <span className="fyv-label" style={{ color: "inherit" }}>
          {feature.highlight}
        </span>
      </div>
    </motion.div>
  );
}