"use client";

import { useState, useRef } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { createPaymentLink, simulateYieldAccrual } from "@/lib/suisend";

export default function SendTab() {
  const account = useCurrentAccount();
  const [amount, setAmount] = useState("100");
  const [note, setNote] = useState("");
  const [linkShown, setLinkShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const linkRef = useRef<HTMLDivElement>(null);

  const rawAmount = parseFloat(amount) || 0;
  const weeklyYield = simulateYieldAccrual(rawAmount, 7 * 86400000);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, "");
    setAmount(val);
    if (linkShown) {
      setLinkShown(false);
      setCopied(false);
    }
  };

  const handleSend = () => {
    if (!account || rawAmount <= 0) return;
    const sender = account.address;
    const payment = createPaymentLink(sender, rawAmount, note);
    setGeneratedUrl(payment.claimUrl);
    setLinkShown(true);
    setTimeout(() => {
      linkRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `https://${generatedUrl}`,
      );
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-xl border border-border-light flex items-center justify-center text-[22px] mb-5">
          →
        </div>
        <h3 className="font-display text-xl font-semibold mb-2 tracking-tight">
          Connect your wallet to send
        </h3>
        <p className="text-text-secondary text-sm max-w-[300px]">
          Use the button in the top-right to connect. Your funds never leave your
          wallet until you send.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="app-field">
        <div className="app-flabel">Amount (SUI)</div>
        <input
          className="app-finput"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={handleAmountChange}
          placeholder="0.00"
        />
      </div>

      <div className="app-field">
        <div className="app-flabel">Note (optional)</div>
        <input
          className="app-finput"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's this for?"
          maxLength={120}
        />
      </div>

      <div className="yield-box">
        <div className="yb-left">Yield after 7 days (8.2% APY)</div>
        <div className="yb-right">
          +{weeklyYield < 0.0001 ? "< 0.0001" : weeklyYield.toFixed(weeklyYield >= 1 ? 2 : weeklyYield >= 0.01 ? 4 : 6)} SUI
        </div>
      </div>

      <button
        className="app-btn"
        onClick={handleSend}
        disabled={rawAmount <= 0}
        style={{ opacity: rawAmount <= 0 ? 0.4 : 1, cursor: rawAmount <= 0 ? "not-allowed" : "pointer" }}
      >
        Generate payment link →
      </button>

      <div className={`link-gen ${linkShown ? "show" : ""}`} ref={linkRef}>
        <div className="lg-label">Payment link ready</div>
        <div className="lg-url" onClick={handleCopy} title="Click to copy">
          {generatedUrl}
        </div>
        {copied && <div className="lg-copied" style={{ display: "block" }}>Copied to clipboard</div>}
        <p className="text-text-muted text-[11px] mt-4 leading-relaxed">
          Share this link with anyone. They only need the link to claim — no wallet required
          on their end. Funds you send earn yield until claimed.
        </p>
      </div>
    </div>
  );
}
