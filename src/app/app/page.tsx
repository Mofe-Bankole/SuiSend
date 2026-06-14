"use client";

import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@mysten/dapp-kit";
import SendTab from "@/components/app/SendTab";
import ClaimTab from "@/components/app/ClaimTab";
import HistoryTab from "@/components/app/HistoryTab";

const tabs = ["Send", "Claim", "History"];

const tabComponents = [
  <SendTab key="send" />,
  <ClaimTab key="claim" />,
  <HistoryTab key="history" />,
];

export default function AppPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-8 h-16 border-b border-border bg-[rgba(8,8,10,0.92)] backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-text-primary no-underline"
          >
            <div className="w-[7px] h-[7px] rounded-full bg-accent animate-[blink_2.4s_ease-in-out_infinite]" />
            SuiSend
          </Link>
          <nav className="flex gap-1 max-md:hidden">
            {tabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-5 py-2 rounded-lg text-[13px] font-medium font-display transition-all cursor-pointer ${
                  i === activeTab
                    ? "bg-text-primary text-background"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
        <ConnectButton connectText="Connect wallet" />
      </header>

      <nav className="flex gap-1 px-6 pt-4 md:hidden">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-1 py-2 rounded-lg text-[13px] font-medium font-display transition-all cursor-pointer ${
              i === activeTab
                ? "bg-text-primary text-background"
                : "text-text-secondary border border-border-light"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="flex-1 mx-auto w-full max-w-[640px] px-6 py-10">
        {tabComponents[activeTab]}
      </main>
    </div>
  );
}
