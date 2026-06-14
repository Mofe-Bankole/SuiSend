"use client";

import { useEffect, useRef } from "react";
import Reveal from "./Reveal";

export default function HowItWorks() {
  const featTickerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const yvRef = useRef(0.08471);

  useEffect(() => {
    const id = setInterval(() => {
      yvRef.current += 0.0000028;
      if (featTickerRef.current) {
        featTickerRef.current.textContent = yvRef.current.toFixed(7);
      }
    }, 900);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
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
    grid.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="section-wrap mx-auto max-w-[1200px] px-12 py-[120px] max-md:px-6"
      id="how"
    >
      <div className="eyebrow">How it works</div>
      <Reveal>
        <h2 className="section-h2">
          Three steps.
          <br />
          No idle money.
        </h2>
      </Reveal>

      <div className="feature-grid" ref={gridRef}>
        <div className="feat feat-dark feat-tall reveal">
          <div className="feat-num">01</div>
          <div className="feat-icon">→</div>
          <div className="feat-h3">Create a payment link</div>
          <p className="feat-p">
            Connect your Sui wallet, enter an amount. One transaction deposits
            your funds directly into Scallop&apos;s lending pool and generates a
            shareable claim link.
          </p>
          <div className="feat-yield-vis">
            <div className="fyv-label">Live yield preview</div>
            <div className="fyv-val" ref={featTickerRef}>
              0.0000000
            </div>
            <div className="fyv-sub">SUI earned this session</div>
            <div className="fyv-bar">
              <div className="fyv-bar-fill" />
            </div>
          </div>
        </div>

        <div className="feat feat-light reveal rd1">
          <div className="feat-num" style={{ color: "rgba(8,8,10,0.35)" }}>
            02
          </div>
          <div
            className="feat-icon"
            style={{ borderColor: "rgba(8,8,10,0.12)", color: "#08080A" }}
          >
            ◎
          </div>
          <div className="feat-h3">Money earns</div>
          <p className="feat-p">
            While unclaimed, every second your funds compound. The longer they
            wait — the more they receive.
          </p>
        </div>

        <div className="feat feat-mid reveal rd2">
          <div className="feat-num">02b <span className="coming-badge ml-2">Coming soon</span></div>
          <div className="feat-icon">⚡</div>
          <div className="feat-h3">AI picks best yield</div>
          <p className="feat-p">
            Our agent scans Sui DeFi protocols in real time and routes to the
            highest APY automatically.
          </p>
        </div>

        <div className="feat feat-accent feat-wide reveal rd1">
          <div className="feat-num">03</div>
          <div
            className="feat-icon"
            style={{ borderColor: "rgba(158,255,91,0.2)" }}
          >
            ↓
          </div>
          <div className="feat-h3">Recipient claims everything</div>
          <p className="feat-p">
            One click. They receive your original amount plus all interest
            accrued during the wait. If unclaimed after 30 days, you get it all
            back — with yield.
          </p>
        </div>
      </div>
    </div>
  );
}
