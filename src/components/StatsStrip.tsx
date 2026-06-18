"use client";

import { useEffect, useRef } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useLiveStats } from "@/lib/usePaymentEvents";

function animCount(el: HTMLElement, target: number, decimals: number, duration: number) {
  const start = performance.now();
  const run = (now: number) => {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = decimals ? (target * ease).toFixed(decimals) : String(Math.floor(target * ease));
    if (p < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

export default function StatsStrip() {
  const suiClient = useSuiClient();
  const { totalPayments, totalVolume, loading } = useLiveStats(suiClient);
  const triggered = useRef(false);

  useEffect(() => {
    triggered.current = false;
  }, [totalPayments, totalVolume]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            if (!triggered.current) {
              triggered.current = true;
              const cells: { id: string; target: number; decimals: number }[] = [
                { id: "s1", target: totalVolume, decimals: totalVolume >= 100 ? 1 : 2 },
                { id: "s2", target: 8.2, decimals: 1 },
                { id: "s3", target: totalPayments, decimals: 0 },
                { id: "s4", target: 0.5, decimals: 1 },
              ];
              const timings = [1800, 1400, 1600, 1000];
              cells.forEach((c, i) => {
                const el = document.getElementById(c.id);
                if (el && c.target > 0) {
                  animCount(el, c.target, c.decimals, timings[i]);
                }
              });
            }
          }
        });
      },
      { threshold: 0.12 },
    );

    document.querySelectorAll(".stat-cell").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, totalVolume, totalPayments]);

  return (
    <div className="border-t border-b border-border">
      <div className="mx-auto max-w-[1200px] grid grid-cols-4 max-md:grid-cols-2 bg-border gap-[1px] stats-inner">
        {[
          { id: "s1", label: "Total value on mainnet",
            content: loading ? <span className="skel inline-block w-24 h-8 align-middle" /> : <><span id="s1">0</span> <em className="not-italic">SUI</em></> },
          { id: "s2", label: "Average APY via Scallop",
            content: loading ? <span className="skel inline-block w-16 h-8 align-middle" /> : <><span id="s2">0</span><em className="not-italic">%</em></> },
          { id: "s3", label: "Payment links created",
            content: loading ? <span className="skel inline-block w-12 h-8 align-middle" /> : <span id="s3">0</span> },
          { id: "s4", label: "Transaction finality on Sui",
            content: loading ? <span className="skel inline-block w-16 h-8 align-middle" /> : <>&lt;<span id="s4">0</span><em className="not-italic">s</em></> },
        ].map((cell, i) => {
          const delayClass = i === 0 ? "" : i === 1 ? "rd1" : i === 2 ? "rd2" : "rd3";
          return (
            <div key={cell.id} className={`stat-cell bg-background px-10 py-11 transition-colors hover:bg-bg-card reveal ${delayClass}`}>
              <div className="stat-num">{cell.content}</div>
              <div className="stat-desc">{cell.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
