"use client";

import { useEffect, useRef } from "react";

function animCount(el: HTMLElement, target: number, decimals: number, suffix: string, duration: number) {
  const start = performance.now();
  const run = (now: number) => {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const val = target * ease;
    el.textContent = (decimals ? val.toFixed(decimals) : String(Math.floor(val))) + suffix;
    if (p < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

const cells = [
  { id: "s1", target: 847, decimals: 0, suffix: "K", label: "Total value earning on testnet", suffixEl: null as React.ReactNode | null },
  { id: "s2", target: 8.2, decimals: 1, suffix: "", label: "Average APY via Scallop", suffixEl: <em className="not-italic">%</em> },
  { id: "s3", target: 142, decimals: 0, suffix: "", label: "Payment links created", suffixEl: null },
  { id: "s4", target: 0.5, decimals: 1, suffix: "", label: "Transaction finality on Sui", suffixEl: <em className="not-italic">s</em>, prefix: "<" as const },
];

export default function StatsStrip() {
  const triggered = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            if (!triggered.current) {
              triggered.current = true;
              const timings = [1800, 1400, 1600, 1000];
              cells.forEach((c, i) => {
                const el = document.getElementById(c.id);
                if (el) animCount(el, c.target, c.decimals, c.suffix, timings[i]);
              });
            }
          }
        });
      },
      { threshold: 0.12 },
    );

    document.querySelectorAll(".stat-cell").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="border-t border-b border-border">
      <div className="mx-auto max-w-[1200px] grid grid-cols-4 max-md:grid-cols-2 bg-border gap-[1px] stats-inner">
        {cells.map((c, i) => {
          const delayClass = i === 0 ? "" : i === 1 ? "rd1" : i === 2 ? "rd2" : "rd3";
          return (
            <div key={c.id} className={`stat-cell bg-background px-10 py-11 transition-colors hover:bg-bg-card reveal ${delayClass}`}>
              <div className="stat-num">
                {c.prefix === "<" && "<"}
                <span id={c.id}>0</span>
                {c.suffixEl}
              </div>
              <div className="stat-desc">{c.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
