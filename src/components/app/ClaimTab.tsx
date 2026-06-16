"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { motion, AnimatePresence } from "framer-motion";
import {
  findPaymentByHash,
  claimPayment,
  simulateYieldAccrual,
} from "@/lib/suisend";
import { getScallopApy } from "@/lib/scallop";
import { useNow, timeAgo, timeUntil } from "@/hooks/useNow";
import { readText } from "@/lib/walrus";
import type { PaymentLink } from "@/lib/suisend";

export default function ClaimTab() {
  const now = useNow();
  const suiClient = useSuiClient();
  const account = useCurrentAccount();

  const [claimInput, setClaimInput] = useState("");
  const [foundPayment, setFoundPayment] = useState<PaymentLink | null>(null);
  const [claimResult, setClaimResult] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [claimMsg, setClaimMsg] = useState("");
  const [searched, setSearched] = useState(false);
  const [apy, setApy] = useState(8.2);
  const [animatingYield, setAnimatingYield] = useState(0);

  useEffect(() => {
    getScallopApy(suiClient).then(setApy).catch(() => {});
  }, [suiClient]);

  const handleLookup = () => {
    const raw = claimInput.trim();
    if (!raw) return;

    let hash = raw;
    if (hash.startsWith("https://")) {
      try {
        hash = new URL(hash).pathname.replace("/claim/", "");
      } catch {}
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
      setClaimMsg("This payment has expired and been refunded.");
    } else {
      setFoundPayment(null);
      setClaimResult("error");
      setClaimMsg("No payment found. Check the link and try again.");
    }
  };

  const handleClaim = () => {
    if (!foundPayment) return;
    const hashForClaim = foundPayment.linkHash.substring(0, 10);
    const result = claimPayment(
      account?.address || "0xclaimer...temp",
      hashForClaim,
    );

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

  useEffect(() => {
    if (foundPayment && foundPayment.status === "pending" && dueYield > 0) {
      const start = performance.now();
      const duration = 500;
      const target = dueYield;
      let raf: number;
      const tick = (t: number) => {
        const pct = Math.min((t - start) / duration, 1);
        const eased = 1 - Math.pow(1 - pct, 3);
        setAnimatingYield(target * eased);
        if (pct < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    setAnimatingYield(0);
  }, [foundPayment?.status, dueYield, foundPayment?.linkHash]);

  const [walrusNote, setWalrusNote] = useState<string | null>(null);

  useEffect(() => {
    if (foundPayment?.walrusBlobId) {
      setWalrusNote(null);
      readText(foundPayment.walrusBlobId, "testnet")
        .then((text) => setWalrusNote(text))
        .catch(() => setWalrusNote(null));
    } else {
      setWalrusNote(null);
    }
  }, [foundPayment?.walrusBlobId, foundPayment?.linkHash]);

  const formatYield = useCallback((val: number) => {
    if (val >= 1) return val.toFixed(4);
    if (val >= 0.001) return val.toFixed(6);
    if (val <= 0) return "0";
    return val.toFixed(8);
  }, []);

  return (
    <div>
      <h2 className="font-display text-xl font-bold tracking-tight mb-1">
        Claim payment
      </h2>
      <p className="text-text-secondary text-[13px] mb-5">
        Paste the link or hash you received
      </p>

      <div className="app-field">
        <div className="relative">
          <input
            className="app-finput !pl-10"
            type="text"
            value={claimInput}
            onChange={(e) => {
              setClaimInput(e.target.value);
              setSearched(false);
              setClaimResult("idle");
              setClaimMsg("");
            }}
            onKeyDown={handleKeyDown}
            placeholder="suisend.app/claim/0x... or paste hash"
          />
          <div className="absolute left-[14px] top-1/2 -translate-y-1/2 text-text-muted text-[15px] pointer-events-none">
            🔗
          </div>
        </div>
      </div>

      <button
        className="btn-gradient"
        onClick={handleLookup}
        disabled={!claimInput.trim()}
      >
        Find payment
      </button>

      <AnimatePresence mode="wait">
        {foundPayment && foundPayment.status === "pending" && (
          <motion.div
            key="found"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="claim-card mt-5"
          >
            <div className="claim-card-content">
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
                    Yield accrued
                  </div>
                  <div className="font-display text-base font-semibold text-accent tabular-nums">
                    +{formatYield(animatingYield)} SUI
                  </div>
                </div>
              </div>

              {foundPayment.note && (
                <div className="text-sm text-text-secondary mb-3 italic">
                  &ldquo;{foundPayment.note}&rdquo;
                </div>
              )}
              {walrusNote && (
                <div className="glass-card p-2 mb-3">
                  <div className="text-[10px] uppercase tracking-[0.06em] text-text-muted font-medium mb-0.5">
                    Note (from Walrus)
                  </div>
                  <div className="text-sm text-text-secondary italic">
                    &ldquo;{walrusNote}&rdquo;
                  </div>
                </div>
              )}
              {foundPayment.walrusBlobId && !walrusNote && (
                <div className="text-[10px] text-text-muted mb-3">
                  Fetching note from Walrus...
                </div>
              )}

              <div className="flex items-center gap-2 text-[11px] text-text-muted mb-4">
                <span>Sent {timeAgo(foundPayment.createdAt, now)}</span>
                <span className="w-1 h-1 rounded-full bg-border-light" />
                <span>Expires in {timeUntil(foundPayment.expiresAt, now)}</span>
              </div>

              <button
                className="btn-gradient"
                onClick={handleClaim}
                style={{
                  background: "var(--accent)",
                  color: "var(--bg)",
                }}
              >
                Claim now →
              </button>
            </div>
          </motion.div>
        )}

        {claimResult === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card mt-5 p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="tx-check !w-10 !h-10 !m-0">
                <svg viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div className="font-display text-base font-semibold">
                  Successfully claimed
                </div>
                <div className="text-[13px] text-text-secondary">
                  {claimMsg}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {claimResult === "error" && searched && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card mt-5 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="tx-x !w-10 !h-10 !m-0">
                <svg viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <div>
                <div className="font-display text-sm font-medium">
                  {claimMsg}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 pt-6 border-t border-border">
        <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-medium mb-3">
          No wallet? No problem
        </div>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          Recipients can claim with just an email or Google account — no crypto
          wallet needed. zkLogin handles the authentication on-chain.{" "}
          <span className="text-accent font-medium">Coming in v1.</span>
        </p>
      </div>
    </div>
  );
}
