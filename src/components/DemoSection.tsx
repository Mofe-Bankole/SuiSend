"use client";

import { useState, useRef } from "react";
import Reveal from "./Reveal";

const checkIcon = (
  <svg viewBox="0 0 10 8" width="9" height="9">
    <polyline points="1,4 3.5,6.5 9,1" />
  </svg>
);

export default function DemoSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [amount, setAmount] = useState("100 SUI");
  const [linkShown, setLinkShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);

  const rawAmount = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const yieldEst = (rawAmount * 0.082 / 365 * 7).toFixed(4);

  const tabs = ["Send", "Claim", "History"];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("https://suisend.app/claim/0x4f2a...8c91");
    } catch {
      // fallback
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    setLinkShown(true);
    setTimeout(() => {
      linkRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  return (
    <div className="mx-auto max-w-[1200px] px-12 pb-[120px] grid grid-cols-[1fr_1.1fr] gap-20 items-start max-md:grid-cols-1 max-md:px-6 demo-wrap" id="send">
      <div className="sticky top-[100px] max-md:static demo-sticky">
        <div className="eyebrow">The product</div>
        <Reveal>
          <h2 className="section-h2" style={{ marginBottom: 16 }}>
            Payments that work<br />
            while you don&apos;t
          </h2>
        </Reveal>
        <Reveal delay="rd1">
          <p className="demo-sub">
            Traditional payment links lose value the moment they&apos;re sent. SuiSend flips that — every link is a live yield position, not a static IOU.
          </p>
        </Reveal>
        <Reveal delay="rd2">
          <ul className="demo-checklist">
            <li><div className="dcheck">{checkIcon}</div>Self-custodial. Funds sit in Scallop — never with us.</li>
            <li><div className="dcheck">{checkIcon}</div>Sub-second finality. No waiting for confirmations.</li>
            <li><div className="dcheck">{checkIcon}</div>30-day auto-refund with all yield if unclaimed.</li>
            <li><div className="dcheck">{checkIcon}</div>AI agent routes to best available APY on Sui.</li>
          </ul>
        </Reveal>
      </div>

      <Reveal delay="rd1">
        <div className="app-shell">
          <div className="app-bar">
            <div className="app-dot" />
            <div className="app-dot" />
            <div className="app-dot" />
            <div className="app-url">suisend.app/send</div>
          </div>
          <div className="app-body">
            <div className="app-tabs">
              {tabs.map((tab, i) => (
                <div
                  key={tab}
                  className={`app-tab ${i === activeTab ? "on" : ""}`}
                  onClick={() => setActiveTab(i)}
                >
                  {tab}
                </div>
              ))}
            </div>

            <div className="app-field">
              <div className="app-flabel">Amount</div>
              <input
                className="app-finput"
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="app-field">
              <div className="app-flabel">Note (optional)</div>
              <input className="app-finput" type="text" placeholder="For the Lagos trip..." />
            </div>

            <div className="yield-box">
              <div className="yb-left">Est. yield at 7 days (8.2% APY)</div>
              <div className="yb-right">+{yieldEst} SUI</div>
            </div>

            <button className="app-btn" onClick={handleSend}>
              Connect wallet to send →
            </button>

            {linkShown && (
              <div className="link-gen show" ref={linkRef}>
                <div className="lg-label">Link generated ✓</div>
                <div className="lg-url" onClick={handleCopy}>
                  suisend.app/claim/0x4f2a...8c91
                </div>
                {copied && <div className="lg-copied" style={{ display: "block" }}>Copied to clipboard ✓</div>}
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
