"use client";

import { useState } from "react";
import { findPaymentByHash, claimPayment, simulateYieldAccrual } from "@/lib/suisend";
import { useNow, timeAgo, timeUntil } from "@/hooks/useNow";
import type { PaymentLink } from "@/lib/suisend";

export default function ClaimTab() {
  const now = useNow();
  const [claimInput, setClaimInput] = useState("");
  const [foundPayment, setFoundPayment] = useState<PaymentLink | null>(null);
  const [claimResult, setClaimResult] = useState<"idle" | "success" | "error">("idle");
  const [claimMsg, setClaimMsg] = useState("");
  const [searched, setSearched] = useState(false);

  const handleLookup = () => {
    const raw = claimInput.trim();
    if (!raw) return;

    let hash = raw;
    if (hash.startsWith("https://")) {
      hash = new URL(hash).pathname.replace("/claim/", "");
    }
    hash = hash.replace("suisend.app/claim/", "");

    const payment = findPaymentByHash(hash);
    setSearched(true);

    if (payment && payment.status === "pending") {
      setFoundPayment(payment);
      setClaimResult("idle");
      setClaimMsg("");
    } else if (payment && payment.status === "claimed") {
      setFoundPayment(null);
      setClaimResult("error");
      setClaimMsg("This payment has already been claimed.");
    } else if (payment && payment.status === "refunded") {
      setFoundPayment(null);
      setClaimResult("error");
      setClaimMsg("This payment has expired and been refunded to the sender.");
    } else {
      setFoundPayment(null);
      setClaimResult("error");
      setClaimMsg("No payment found. Check the link and try again.");
    }
  };

  const handleClaim = () => {
    if (!foundPayment) return;
    const hashForClaim = foundPayment.linkHash.substring(0, 10);
    const result = claimPayment("0xclaimer...temp", hashForClaim);

    if (result.success && result.payment) {
      setClaimResult("success");
      setClaimMsg(
        `Claimed ${result.payment.amount} including yield!`,
      );
      setFoundPayment(result.payment);
    } else {
      setClaimResult("error");
      setClaimMsg(result.error || "Claim failed. Try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLookup();
  };

  const elapsed =
    foundPayment && foundPayment.status === "pending"
      ? now - foundPayment.createdAt
      : 0;
  const dueYield = foundPayment
    ? simulateYieldAccrual(foundPayment.numericAmount, elapsed)
    : 0;

  return (
    <div>
      <div className="app-field">
        <div className="app-flabel">Paste payment link or hash</div>
        <input
          className="app-finput"
          type="text"
          value={claimInput}
          onChange={(e) => {
            setClaimInput(e.target.value);
            setSearched(false);
            setClaimResult("idle");
            setClaimMsg("");
          }}
          onKeyDown={handleKeyDown}
          placeholder="suisend.app/claim/0x4f2a... or 0x4f2a..."
        />
      </div>

      <button className="app-btn" onClick={handleLookup} disabled={!claimInput.trim()}
        style={{ opacity: !claimInput.trim() ? 0.4 : 1, cursor: !claimInput.trim() ? "not-allowed" : "pointer" }}>
        Find payment →
      </button>

      {foundPayment && foundPayment.status === "pending" && (
        <div className="mt-5 p-4 rounded-lg border border-accent-mid bg-accent-soft">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-accent font-medium mb-1">
                Payment found
              </div>
              <div className="font-display text-2xl font-bold tracking-tight">
                {foundPayment.amount}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.08em] text-text-secondary">
                With yield
              </div>
              <div className="font-display text-sm font-semibold text-accent tabular-nums">
                +{dueYield < 0.0001 ? "< 0.0001" : dueYield.toFixed(dueYield >= 1 ? 2 : 6)} SUI
              </div>
            </div>
          </div>

          {foundPayment.note && (
            <div className="text-sm text-text-secondary mb-3">
              &ldquo;{foundPayment.note}&rdquo;
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-text-muted mb-4">
            <span>Sent {timeAgo(foundPayment.createdAt, now)}</span>
            <span className="w-1 h-1 rounded-full bg-border-light" />
            <span>Expires in {timeUntil(foundPayment.expiresAt, now)}</span>
          </div>

          <button className="app-btn" onClick={handleClaim}
            style={{ background: "var(--accent)", color: "var(--bg)" }}>
            Claim now →
          </button>
        </div>
      )}

      {claimResult === "success" && (
        <div className="mt-5 p-4 rounded-lg border border-accent-mid bg-accent-soft">
          <div className="font-display text-lg font-semibold text-accent mb-1">
            Successfully claimed
          </div>
          <p className="text-sm text-text-secondary">{claimMsg}</p>
        </div>
      )}

      {claimResult === "error" && searched && (
        <div className="mt-5 p-4 rounded-lg border border-border-light bg-bg-card">
          <div className="font-display text-sm text-text-secondary mb-1">
            {claimMsg}
          </div>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-border">
        <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-medium mb-3">
          No wallet? No problem
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Recipients can claim with just an email or Google account — no crypto wallet needed.
          zkLogin handles the authentication on-chain. Coming in v1.
        </p>
      </div>
    </div>
  );
}
