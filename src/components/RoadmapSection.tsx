"use client";

import Reveal from "./Reveal";

const phases = [
  {
    status: "done" as const,
    label: "Hackathon",
    title: "Testnet MVP",
    items: [
      "Payment link creation & claiming",
      "Scallop yield integration",
      "Mock yield on devnet",
      "Wallet-based sender flow",
      "14-day auto-refund",
    ],
  },
  {
    status: "current" as const,
    label: "Now shipping",
    title: "Mainnet launch",
    items: [
      "Deploy to Sui mainnet",
      "Real Scallop yield (8.2% APY)",
      "zkLogin for claimers",
      "Email notification on claim",
      "Hardened test suite & audit prep",
    ],
  },
  {
    status: "next" as const,
    label: "Next up",
    title: "AI yield routing",
    items: [
      "Multi-protocol agent (Scallop + Navi)",
      "Auto-select best APY in real time",
      "Walrus receipt storage",
      "Analytics dashboard",
    ],
  },
  {
    status: "future" as const,
    label: "On the horizon",
    title: "Platform",
    items: [
      "Business dashboard & team payments",
      "Mobile app (React Native)",
      "Fiat on-ramp via MoonPay",
      "Recurring payment links",
      "Public API & embeddable widgets",
    ],
  },
];

const statusStyles: Record<string, string> = {
  done: "border-accent bg-accent-soft",
  current: "border-[#FFD700] bg-[rgba(255,215,0,0.06)]",
  next: "border-border-light bg-bg-card",
  future: "border-border bg-bg-card opacity-60",
};

const dotStyles: Record<string, string> = {
  done: "bg-accent",
  current: "bg-[#FFD700] animate-[blink_1.5s_ease-in-out_infinite]",
  next: "bg-text-muted",
  future: "bg-border-light",
};

const labelStyles: Record<string, string> = {
  done: "text-accent",
  current: "text-[#FFD700]",
  next: "text-text-muted",
  future: "text-text-muted",
};

export default function RoadmapSection() {
  return (
    <div className="section-wrap" style={{ paddingTop: 0 }}>
      <div className="eyebrow">Roadmap</div>
      <Reveal>
        <h2 className="section-h2">
          Built for today.
          <br />
          Designed for tomorrow.
        </h2>
      </Reveal>

      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
        {phases.map((phase, i) => {
          const delays = [
            undefined,
            "rd1" as const,
            "rd2" as const,
            "rd3" as const,
          ];
          return (
            <Reveal key={phase.label} delay={delays[i]}>
              <div
                className={`rounded-xl border p-6 ${statusStyles[phase.status]} transition-all duration-300`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${dotStyles[phase.status]}`}
                  />
                  <span
                    className={`text-[10px] uppercase tracking-[0.08em] font-semibold ${labelStyles[phase.status]}`}
                  >
                    {phase.label}
                  </span>
                </div>
                <h3 className="font-display text-[17px] font-bold tracking-tight mb-4">
                  {phase.title}
                </h3>
                <ul className="space-y-2.5">
                  {phase.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-[13px] text-text-secondary leading-relaxed"
                    >
                      <svg
                        className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent"
                        viewBox="0 0 14 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="2,7 5.5,10.5 12,4" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
