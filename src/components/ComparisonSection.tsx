"use client";

import Reveal from "./Reveal";

const rows = [
  { feature: "Money earns yield while pending", suisend: true, paypal: false, venmo: false, bank: false },
  { feature: "Sub-second finality", suisend: true, paypal: true, venmo: true, bank: false },
  { feature: "Self-custodial", suisend: true, paypal: false, venmo: false, bank: false },
  { feature: "No account needed to receive", suisend: true, paypal: false, venmo: false, bank: false },
  { feature: "Auto-refund with interest", suisend: true, paypal: false, venmo: false, bank: false },
  { feature: "Global, no borders", suisend: true, paypal: true, venmo: false, bank: false },
  { feature: "Programmable (smart contracts)", suisend: true, paypal: false, venmo: false, bank: false },
  { feature: "Zero platform fees", suisend: true, paypal: false, venmo: false, bank: false },
  { feature: "Audited smart contracts", suisend: true, paypal: true, venmo: true, bank: true },
];

const columns = [
  { key: "suisend" as const, label: "SuiSend" },
  { key: "paypal" as const, label: "PayPal" },
  { key: "venmo" as const, label: "Venmo" },
  { key: "bank" as const, label: "Bank Transfer" },
];

function Check() {
  return (
    <svg className="w-4 h-4 text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,8 6.5,11.5 13,5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg className="w-4 h-4 text-text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}

export default function ComparisonSection() {
  return (
    <div className="section-wrap" style={{ paddingTop: 0 }}>
      <div className="eyebrow">Why SuiSend</div>
      <Reveal>
        <h2 className="section-h2">
          Payments shouldn&apos;t
          <br />
          sit still.
        </h2>
      </Reveal>

      <Reveal delay="rd1">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left pb-4 pr-6 font-display text-[13px] font-semibold text-text-secondary uppercase tracking-[0.06em]">
                  Feature
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`pb-4 px-4 text-center font-display text-[13px] font-semibold uppercase tracking-[0.06em] ${
                      col.key === "suisend" ? "text-accent" : "text-text-muted"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`${
                    i < rows.length - 1 ? "border-b border-border" : ""
                  } transition-colors hover:bg-bg-card`}
                >
                  <td className="py-4 pr-6 text-[14px] text-text-primary font-medium">
                    {row.feature}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-4 px-4 text-center ${
                        col.key === "suisend" ? "bg-accent-soft/50 rounded" : ""
                      }`}
                    >
                      {row[col.key] ? <Check /> : <Cross />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal delay="rd2">
        <p className="text-[13px] text-text-muted mt-6 text-center max-w-[500px] mx-auto leading-relaxed">
          SuiSend is the only payment method where your money earns yield while waiting to be
          claimed. Idle money should work — not wait.
        </p>
      </Reveal>
    </div>
  );
}
