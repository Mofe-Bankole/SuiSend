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
import {
  getGoogleAuthUrl,
  getZkLoginState,
  clearZkLogin,
} from "@/lib/zklogin";
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
  const [zkLoggingIn, setZkLoggingIn] = useState(false);

  const zkState = getZkLoginState();
  const canClaim = foundPayment && foundPayment.status === "pending" && (!!account || zkState?.isReady);

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

  const handleGoogleSignIn = async () => {
    setZkLoggingIn(true);
    try {
      const url = await getGoogleAuthUrl();
      window.location.href = url;
    } catch (e) {
      console.error("zkLogin init failed:", e);
      setZkLoggingIn(false);
    }
  };

  const handleClaim = () => {
    if (!foundPayment) return;

    if (account) {
      const hashForClaim = foundPayment.linkHash.substring(0, 10);
      const result = claimPayment(
        account.address,
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
    } else if (zkState?.isReady) {
      // TODO: Replace with real PTB once contract is deployed
      // For now, use the same mock claim since we're pre-deployment
      const hashForClaim = foundPayment.linkHash.substring(0, 10);
      const result = claimPayment(
        zkState.address,
        hashForClaim,
      );

      if (result.success && result.payment) {
        setClaimResult("success");
        setClaimMsg(
          `Claimed ${result.payment.amount} including yield! (via Google)`,
        );
        setFoundPayment(result.payment);
      } else {
        setClaimResult("error");
        setClaimMsg(result.error || "Claim failed. Try again.");
      }
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

              {canClaim ? (
                <button
                  className="btn-gradient"
                  onClick={handleClaim}
                  style={{
                    background: "var(--accent)",
                    color: "var(--bg)",
                  }}
                >
                  Claim now{zkState?.isReady && !account ? " (via Google)" : ""} →
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    className="btn-gradient w-full"
                    onClick={handleGoogleSignIn}
                    disabled={zkLoggingIn}
                  >
                    {zkLoggingIn ? "Connecting..." : "Sign in with Google to claim →"}
                  </button>
                  <p className="text-[11px] text-text-muted text-center">
                    or connect a wallet above
                  </p>
                </div>
              )}
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

      {/* zkLogin section — shown when no wallet and no pending payment found */}
      {!account && !foundPayment && (
        <div className="mt-8 pt-6 border-t border-border">
          <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-medium mb-3">
            No wallet? No problem
          </div>
          <p className="text-[13px] text-text-secondary leading-relaxed mb-4">
            Sign in with Google to get a Sui wallet instantly — no extension, no
            seed phrase.
          </p>

          {zkState ? (
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
                  G
                </div>
                <div>
                  <div className="text-[12px] font-medium">Signed in with Google</div>
                  <div className="text-[10px] font-mono text-text-muted">
                    {zkState.address.slice(0, 6)}...{zkState.address.slice(-4)}
                  </div>
                </div>
              </div>
              <button
                className="text-[11px] text-text-muted hover:text-accent transition-colors"
                onClick={() => { clearZkLogin(); window.location.reload(); }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              className="btn-gradient flex items-center justify-center gap-2"
              onClick={handleGoogleSignIn}
              disabled={zkLoggingIn}
            >
              {zkLoggingIn ? (
                "Connecting..."
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.54 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.87 7.35 2.56 10.55l7.98-5.96z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.96C6.51 42.62 14.62 48 24 48z"/>
                    <path fill="none" d="M0 0h48v48H0z"/>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
