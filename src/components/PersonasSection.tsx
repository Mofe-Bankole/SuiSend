"use client";

import Reveal from "./Reveal";

const personas = [
  {
    emoji: "🌍",
    tag: "Remote work",
    title: "Get paid across borders",
    desc: "Invoice a client overseas. While they take their time approving payment, your money's already earning — not sitting in limbo.",
  },
  {
    emoji: "🏠",
    tag: "Remittances",
    title: "Send home, with interest",
    desc: "Family receives your transfer plus everything it earned in transit. Every transfer becomes a small gift on top.",
  },
  {
    emoji: "🏛️",
    tag: "DAOs & teams",
    title: "Payroll that doesn't sleep",
    desc: "Grant disbursements and contributor payouts earn yield until claimed. No idle treasury, ever.",
  },
  {
    emoji: "🎉",
    tag: "Group funds",
    title: "Pooled money, working money",
    desc: "Collect contributions for a trip or event. The pool earns yield right up until it's spent.",
  },
];

export default function PersonasSection() {
  return (
    <div className="section-wrap" style={{ paddingTop: 0 }}>
      <div className="eyebrow">Who&apos;s sending</div>
      <Reveal>
        <h2 className="section-h2">
          Built for how money<br />
          actually moves
        </h2>
      </Reveal>

      <div className="persona-grid">
        {personas.map((p, i) => {
          const delays: Array<"rd1" | "rd2" | "rd3" | undefined> = [undefined, "rd1", "rd2", "rd3"];
          return (
            <Reveal key={p.tag} delay={delays[i]}>
              <div className="persona-card">
                <span className="persona-emoji">{p.emoji}</span>
                <div className="persona-tag">{p.tag}</div>
                <div className="persona-title">{p.title}</div>
                <p className="persona-desc">{p.desc}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
