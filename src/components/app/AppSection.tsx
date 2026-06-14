"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import SendTab from "./SendTab";
import ClaimTab from "./ClaimTab";
import HistoryTab from "./HistoryTab";

const checkIcon = (
  <svg viewBox="0 0 10 8" width="9" height="9">
    <polyline points="1,4 3.5,6.5 9,1" />
  </svg>
);

const tabs = ["Send", "Claim", "History"];

export default function AppSection() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (i: number) => {
    setActiveTab(i);
  };

  const tabContent = [<SendTab key="send" />, <ClaimTab key="claim" />, <HistoryTab key="history" />];

  return (
    <div
      className="mx-auto max-w-[1200px] px-12 pb-[120px] grid grid-cols-[1fr_1.1fr] gap-20 items-start max-md:grid-cols-1 max-md:px-6"
      id="send"
    >
      <div className="sticky top-[100px] max-md:static">
        <div className="eyebrow">The app</div>
        <Reveal>
          <h2 className="section-h2" style={{ marginBottom: 16 }}>
            Send money.
            <br />
            It earns while they wait.
          </h2>
        </Reveal>
        <Reveal delay="rd1">
          <p className="demo-sub">
            Create a payment link, share it, and your money earns yield until claimed.
            Recipients don&apos;t even need a wallet — they can claim with just a link.
          </p>
        </Reveal>
        <Reveal delay="rd2">
          <ul className="demo-checklist">
            <li>
              <div className="dcheck">{checkIcon}</div>
              Funds deposited into Sui DeFi — never held by us.
            </li>
            <li>
              <div className="dcheck">{checkIcon}</div>
              Earn yield from the moment you send.
            </li>
            <li>
              <div className="dcheck">{checkIcon}</div>
              14-day auto-refund if unclaimed.
            </li>
            <li>
              <div className="dcheck">{checkIcon}</div>
              AI agent routes to best available APY.
            </li>
          </ul>
        </Reveal>
      </div>

      <Reveal delay="rd1">
        <div className="app-shell">
          <div className="app-bar">
            <div className="app-dot" />
            <div className="app-dot" />
            <div className="app-dot" />
            <div className="app-url">
              suisend.app/
              {["send", "claim", "history"][activeTab]}
            </div>
          </div>
          <div className="app-body">
            <div className="app-tabs">
              {tabs.map((tab, i) => (
                <div
                  key={tab}
                  className={`app-tab ${i === activeTab ? "on" : ""}`}
                  onClick={() => handleTabChange(i)}
                >
                  {tab}
                </div>
              ))}
            </div>

            <div className="transition-opacity duration-200">{tabContent[activeTab]}</div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
