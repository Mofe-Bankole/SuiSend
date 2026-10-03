"use client";

import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

const icons = {
  globe: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  wallet: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="16.5" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const personas = [
  {
    icon: icons.globe,
    tag: "Remote work",
    title: "Get paid across borders",
    desc: "Invoice a client overseas. While they take their time approving payment, your money's already earning — not sitting in limbo.",
  },
  {
    icon: icons.home,
    tag: "Remittances",
    title: "Send home, with interest",
    desc: "Family receives your transfer plus everything it earned in transit. Every transfer becomes a small gift on top.",
  },
  {
    icon: icons.users,
    tag: "DAOs & teams",
    title: "Payroll that doesn't sleep",
    desc: "Grant disbursements and contributor payouts earn yield until claimed. No idle treasury, ever.",
  },
  {
    icon: icons.wallet,
    tag: "Group funds",
    title: "Pooled money, working money",
    desc: "Collect contributions for a trip or event. The pool earns yield right up until it's spent.",
  },
];

export default function PersonasSection() {
  return (
    <div className="section-wrap" style={{ paddingTop: 0 }}>
      <SectionHead
        index={3}
        of={5}
        label="Who's sending"
        title={
          <>
            Built for how money
            <br />
            actually moves
          </>
        }
      />

      <div className="persona-grid">
        {personas.map((p, i) => {
          const delays: Array<"rd1" | "rd2" | "rd3" | undefined> = [undefined, "rd1", "rd2", "rd3"];
          return (
            <Reveal key={p.tag} delay={delays[i]}>
              <div className="persona-card">
                <span className="persona-icon">{p.icon}</span>
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
