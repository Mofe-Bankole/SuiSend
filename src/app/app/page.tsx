"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ConnectButton, useCurrentAccount, useSuiClient, useSuiClientQuery } from "@mysten/dapp-kit";
import { AnimatePresence, motion } from "framer-motion";
import SendTab from "@/components/app/SendTab";
import ClaimTab from "@/components/app/ClaimTab";
import HistoryTab from "@/components/app/HistoryTab";
import TxStatusOverlay, { type TxPhase } from "@/components/app/TxStatusOverlay";
import { mistToSui } from "@/lib/constants";

const tabs = [
  { key: "send", label: "Send", icon: "→" },
  { key: "claim", label: "Claim", icon: "↓" },
  { key: "history", label: "History", icon: "◎" },
];

function tabComponents(setTxPhase: (p: TxPhase) => void): Record<string, React.ReactNode> {
  return {
    send: <SendTab key="send" setTxPhase={setTxPhase} />,
    claim: <ClaimTab key="claim" setTxPhase={setTxPhase} />,
    history: <HistoryTab key="history" />,
  };
}

export default function AppPage() {
  const [activeTab, setActiveTab] = useState("send");
  const [txPhase, setTxPhase] = useState<TxPhase>({ status: "idle" });

  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const balanceParams = useMemo(
    () => ({ owner: account?.address ?? "" }),
    [account?.address],
  );
  const { data: balance } = useSuiClientQuery("getBalance", balanceParams);

  const activeComponent = useMemo(
    () => tabComponents(setTxPhase)[activeTab],
    [activeTab, setTxPhase],
  );

  const handleCloseOverlay = useCallback(() => {
    setTxPhase({ status: "idle" });
  }, []);

  const displayBalance = balance
    ? `${mistToSui(BigInt(balance.totalBalance)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SUI`
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 h-14 md:h-16 glass sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-[16px] font-semibold tracking-tight text-text-primary no-underline"
          >
            <div className="w-[7px] h-[7px] rounded-full bg-accent animate-[blink_2.4s_ease-in-out_infinite]" />
            SuiSend
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`tab-underline px-4 py-1.5 rounded-lg text-[13px] font-medium font-display transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? "active text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {account && displayBalance && (
            <div className="balance-badge hidden sm:flex">
              <div className="balance-dot" />
              {displayBalance}
            </div>
          )}
          <ConnectButton connectText="Connect" />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[560px] px-4 md:px-6 py-6 md:py-10 app-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {activeComponent}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="app-bottom-nav md:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? "active" : ""}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="bn-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <TxStatusOverlay
        phase={txPhase}
        onClose={handleCloseOverlay}
      />
    </div>
  );
}
