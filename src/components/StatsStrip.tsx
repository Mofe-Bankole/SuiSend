"use client";

import { useEffect, useRef, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { useLiveStats } from "@/lib/usePaymentEvents";
import { getScallopApy } from "@/lib/scallop";

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
  const { totalPayments, totalVolume, loading, failed } = useLiveStats(suiClient);
  const [apy, setApy] = useState<number | null>(null);
  const triggered = useRef(false);

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

  useEffect(() => {
    if (loading || failed || apy === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !triggered.current) {
            triggered.current = true;
            const cells: { id: string; target: number; decimals: number; dur: number }[] = [
              { id: "s1", target: totalVolume, decimals: totalVolume >= 100 ? 1 : 2, dur: 1600 },
              { id: "s2", target: apy, decimals: 1, dur: 1200 },
              { id: "s3", target: totalPayments, decimals: 0, dur: 1400 },
            ];
            cells.forEach((c) => {
              const el = document.getElementById(c.id);
              if (el && c.target > 0) animCount(el, c.target, c.decimals, c.dur);
            });
          }
        });
      },
      { threshold: 0.2 },
    );

    document.querySelectorAll(".stat-cell").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, failed, apy, totalVolume, totalPayments]);

  // When live chain data is unreachable, degrade to always-true facts
  // instead of showing lying zeros (brand honesty rule).
  const usageAvailable = !failed;

  const cells = [
    usageAvailable
      ? {
          id: "s1",
          label: "SUI sent through links",
          content: loading ? (
            <span className="skel inline-block w-24 h-8 align-middle" />
          ) : (
            <>
              <span id="s1">0</span> <em className="not-italic">SUI</em>
            </>
          ),
        }
      : {
          id: "f1",
          label: "Platform fees",
          content: (
            <>
              $0<em className="not-italic"> fees</em>
            </>
          ),
        },
    {
      id: "s2",
      label: "Live Scallop supply APY",
      content:
        apy === null ? (
          <span className="skel inline-block w-16 h-8 align-middle" />
        ) : (
          <>
            <span id="s2">0</span>
            <em className="not-italic">%</em>
          </>
        ),
    },
    usageAvailable
      ? {
          id: "s3",
          label: "Payment links created",
          content: loading ? (
            <span className="skel inline-block w-12 h-8 align-middle" />
          ) : (
            <span id="s3">0</span>
          ),
        }
      : {
          id: "f3",
          label: "Self-custodial, always",
          content: (
            <>
              100<em className="not-italic">%</em>
            </>
          ),
        },
    {
      id: "s4",
      label: "Transaction finality on Sui",
      content: (
        <>
          &lt;1<em className="not-italic">s</em>
        </>
      ),
    },
  ];

  return (
    <div className="border-t border-b border-border">
      <div className="mx-auto max-w-[1200px] grid grid-cols-4 max-md:grid-cols-2 bg-border gap-[1px] stats-inner">
        {cells.map((cell, i) => {
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
