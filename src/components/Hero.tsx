"use client";

import { useEffect, useRef } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useLiveStats } from "@/lib/usePaymentEvents";

export default function Hero() {
  const suiClient = useSuiClient();
  const { totalPayments, totalVolume, loading } = useLiveStats(suiClient);

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
    <section className="min-h-screen flex items-center justify-center px-20 pb-20 pt-[100px] relative overflow-hidden max-md:px-6 max-md:pt-[90px] max-md:pb-[60px]" id="top">
      <div className="dot-grid" />

      <div className="relative z-2 max-w-2xl mx-auto text-center">
        <div className="hero-tag justify-center">
          <div className="hero-tag-dot" />
          Built on Sui · Scallop DeFi
        </div>

        <h1 className="font-display text-[clamp(44px,5.5vw,76px)] font-bold tracking-[-0.04em] leading-[1.0] mb-[22px]">
          Send money.<br />
          It <em className="not-italic text-accent">earns</em><br />
          while they wait.
        </h1>

        <p className="text-base text-text-secondary font-light leading-[1.75] max-w-[400px] mx-auto mb-10">
          Every payment link you create automatically deposits into DeFi yield. Recipients claim your original amount — plus interest. Idle money is dead money.
        </p>

        <div className="flex gap-2.5 items-center justify-center mb-16">
          <a href="/app" className="btn-p">
            Create a link
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h10M8 3l4 4-4 4"/></svg>
          </a>
          <a href="#how" className="btn-s">How it works</a>
        </div>

        <div className="flex items-center justify-center gap-8 pt-8 border-t border-border max-w-lg mx-auto">
          <div>
            <div className="live-val">
              {loading ? (
                <span className="skel inline-block w-16 h-6 align-middle" />
              ) : (
                <span>{volumeStr(totalVolume, totalPayments)}</span>
              )}{" "}
              <em className="not-italic">SUI</em>
            </div>
            <div className="live-label">Total value sent</div>
          </div>
          <div className="live-divider" />
          <div>
            <div className="live-val">
              {loading ? (
                <span className="skel inline-block w-12 h-6 align-middle" />
              ) : (
                totalPayments
              )}
            </div>
            <div className="live-label">Payments created</div>
          </div>
          <div className="live-divider" />
          <div>
            <div className="live-val">8.2<em className="not-italic">%</em></div>
            <div className="live-label">Current APY</div>
          </div>
        </div>
      </div>

      <div className="max-md:hidden pointer-events-none" aria-hidden>
        <div className="orb-card" style={{ position: 'absolute', top: '18%', left: '6%', width: '160px', animationDelay: '0s' }}>
          <div className="oc-label">Yield earned</div>
          <div className="oc-val green" ref={ocYieldRef}>0.08471</div>
          <div className="oc-sub">SUI accrued</div>
          <div className="oc-badge">▲ 8.2% APY</div>
        </div>

        <div className="orb-card" style={{ position: 'absolute', bottom: '18%', right: '6%', width: '150px', animationDelay: '1.5s' }}>
          <div className="oc-status">
            <div className="oc-dot" />
            <span>Earning now</span>
          </div>
          <div className="mt-2.5">
            <div className="oc-val text-[15px]">{loading ? "—" : totalPayments} links</div>
            <div className="oc-sub">{loading ? "—" : `${volumeShort(totalVolume)} active`}</div>
          </div>
        </div>

        <div className="orb-card" style={{ position: 'absolute', top: '38%', right: '10%', width: '130px', animationDelay: '2.5s' }}>
          <div className="oc-label">Claimed</div>
          <div className="oc-val text-[15px]">
            100.084 <span className="text-[11px] text-text-secondary font-normal">SUI</span>
          </div>
          <div className="oc-sub text-accent">+0.084 earned</div>
        </div>
      </div>
    </section>
  );
}

function volumeStr(vol: number, count: number): string {
  if (count === 0) return "0";
  if (vol >= 1000) return (vol / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return vol.toFixed(vol < 1 ? 4 : vol < 10 ? 2 : 1);
}

function volumeShort(vol: number): string {
  if (vol === 0) return "$0";
  if (vol >= 1000) return "$" + (vol / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return "$" + vol.toFixed(1);
}
