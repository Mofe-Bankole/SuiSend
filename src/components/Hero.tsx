"use client";

import { useEffect, useRef } from "react";

export default function Hero() {
  const yvRef = useRef(0.08471);
  const ocYieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      yvRef.current += 0.0000028;
      if (ocYieldRef.current) {
        ocYieldRef.current.textContent = yvRef.current.toFixed(5);
      }
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="min-h-screen grid grid-cols-[1fr_1fr] items-center px-20 pb-20 pt-[100px] relative overflow-hidden gap-10 max-md:grid-cols-1 max-md:px-6 max-md:pt-[90px] max-md:pb-[60px] hero-grid" id="top">
      <div className="dot-grid" />

      <div className="relative z-2">
        <div className="hero-tag">
          <div className="hero-tag-dot" />
          Built on Sui · Scallop DeFi
        </div>

        <h1 className="font-display text-[clamp(44px,5.5vw,76px)] font-bold tracking-[-0.04em] leading-[1.0] mb-[22px]">
          Send money.<br />
          It <em className="not-italic text-accent">earns</em><br />
          while they wait.
        </h1>

        <p className="text-base text-text-secondary font-light leading-[1.75] max-w-[400px] mb-10">
          Every payment link you create automatically deposits into DeFi yield. Recipients claim your original amount — plus interest. Idle money is dead money.
        </p>

        <div className="flex gap-2.5 items-center mb-16">
          <a href="/app" className="btn-p">
            Create a link
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h10M8 3l4 4-4 4"/></svg>
          </a>
          <a href="#how" className="btn-s">How it works</a>
        </div>

        <div className="flex items-center gap-8 pt-8 border-t border-border">
          <div>
            <div className="live-val"><span>847K</span> <em className="not-italic">SUI</em></div>
            <div className="live-label">Earning on testnet</div>
          </div>
          <div className="live-divider" />
          <div>
            <div className="live-val">8.2<em className="not-italic">%</em></div>
            <div className="live-label">Current APY</div>
          </div>
          <div className="live-divider" />
          <div>
            <div className="live-val">&lt;0.5<em className="not-italic">s</em></div>
            <div className="live-label">Finality on Sui</div>
          </div>
        </div>
      </div>

      <div className="relative z-2 flex items-center justify-center hero-right">
        <div className="relative w-[460px] h-[460px] max-md:hidden">
          <div className="orb-glow" />
          <div className="orb-ring" />
          <div className="orb-ring-2" />

          <svg className="orb-coin" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="cg1" cx="38%" cy="32%" r="65%">
                <stop offset="0%" stopColor="#C8FF8A" />
                <stop offset="45%" stopColor="#9EFF5B" />
                <stop offset="100%" stopColor="#4A8A20" />
              </radialGradient>
              <radialGradient id="cg2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
              </radialGradient>
              <filter id="cshadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="16" stdDeviation="24" floodColor="rgba(158,255,91,0.25)" />
              </filter>
            </defs>
            <ellipse cx="120" cy="120" rx="108" ry="108" fill="url(#cg1)" filter="url(#cshadow)" />
            <ellipse cx="120" cy="120" rx="108" ry="108" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
            <ellipse cx="120" cy="120" rx="84" ry="84" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <ellipse cx="84" cy="84" rx="40" ry="28" fill="rgba(255,255,255,0.18)" transform="rotate(-25 84 84)" />
            <text x="120" y="136" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="61.5" fontWeight="700" fill="rgba(0,0,0,0.5)" letterSpacing="-4">Suisend</text>
            <text x="118" y="133" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="72" fontWeight="700" fill="rgba(255,255,255,0.85)" letterSpacing="-4"></text>
            <ellipse cx="120" cy="120" rx="108" ry="108" fill="url(#cg2)" opacity="0.3" />
          </svg>

          <div className="orb-card oc1">
            <div className="oc-label">Yield earned</div>
            <div className="oc-val green" ref={ocYieldRef}>0.08471</div>
            <div className="oc-sub">SUI accrued</div>
            <div className="oc-badge">▲ 8.2% APY</div>
          </div>

          <div className="orb-card oc2">
            <div className="oc-status">
              <div className="oc-dot" />
              <span>Earning now</span>
            </div>
            <div className="mt-2.5">
              <div className="oc-val text-[15px]">3 links</div>
              <div className="oc-sub">$847 active</div>
            </div>
          </div>

          <div className="orb-card oc3">
            <div className="oc-label">Claimed</div>
            <div className="oc-val text-[15px]">
              100.084 <span className="text-[11px] text-text-secondary font-normal">SUI</span>
            </div>
            <div className="oc-sub text-accent">+0.084 earned</div>
          </div>
        </div>
      </div>
    </section>
  );
}
