"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { motion, AnimatePresence } from "framer-motion";
import { lookupPayment, buildClaimPaymentScallopPTB } from "@/lib/suisend";
import { getScallopApy } from "@/lib/scallop";
import { useNow, timeAgo, timeUntil } from "@/hooks/useNow";
import { readText } from "@/lib/walrus";
import {
  getGoogleAuthUrl,
  getZkLoginState,
  clearZkLogin,
  signWithZkLoginAndExecute,
} from "@/lib/zklogin";
import type { TxPhase } from "./TxStatusOverlay";

export default function ClaimTab({
  setTxPhase,
}: {
  setTxPhase: (p: TxPhase) => void;
}) {
  const now = useNow();
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [claimInput, setClaimInput] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [claimResult, setClaimResult] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [claimMsg, setClaimMsg] = useState("");
  const [apy, setApy] = useState(8.2);
  const [zkLoggingIn, setZkLoggingIn] = useState(false);

  const [paymentInfo, setPaymentInfo] = useState<{
    linkHash: string;
    amount: bigint;
    expiry: bigint;
    state: number;
    sender: string;
  } | null>(null);

  const zkState = getZkLoginState();
  const canClaim =
    !!paymentInfo && paymentInfo.state === 0 && (!!account || zkState?.isReady);

  useEffect(() => {
    getScallopApy(suiClient)
      .then(setApy)
      .catch(() => {});
  }, [suiClient]);

  const handleLookup = async () => {
    const raw = claimInput.trim();
    if (!raw) return;

    let hash = raw;
    if (hash.startsWith("https://")) {
      try {
        hash = new URL(hash).pathname.replace("/claim/", "");
      } catch {}
    }
    hash = hash.replace(/^https?:\/\/[^\/]+\/claim\//, "");

    setSearched(false);
    setPaymentInfo(null);
    setClaimResult("idle");
    setClaimMsg("");
    setLoading(true);

    try {
      const result = await lookupPayment(suiClient, hash);
      if (
        result.exists &&
        result.amount !== undefined &&
        result.expiry !== undefined &&
        result.state !== undefined &&
        result.sender
      ) {
        setPaymentInfo({
          linkHash: hash,
          amount: result.amount,
          expiry: result.expiry,
          state: result.state,
          sender: result.sender,
        });
        setSearched(true);
      } else {
        setClaimResult("error");
        setClaimMsg("No active payment found. Check the link and try again.");
        setSearched(true);
      }
    } catch (e) {
      console.error("lookupPayment error:", e);
      setClaimResult("error");
      setClaimMsg("Failed to look up payment. Please try again.");
      setSearched(true);
    } finally {
      setLoading(false);
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

  const handleClaim = async () => {
    if (!paymentInfo) return;

    try {
      const tx = buildClaimPaymentScallopPTB(paymentInfo.linkHash);

      if (account) {
        setTxPhase({ status: "signing" });
        const result = await signAndExecute({ transaction: tx });
        setTxPhase({
          status: "confirmed",
          txId: result.digest,
          label: "Payment claimed",
        });
        setClaimResult("success");
        setClaimMsg(`Successfully claimed! View on SuiScan ↗`);
        setPaymentInfo(null);
      } else if (zkState?.isReady) {
        setTxPhase({ status: "signing" });
        const digest = await signWithZkLoginAndExecute(tx);
        setTxPhase({
          status: "confirmed",
          txId: digest,
          label: "Payment claimed",
        });
        setClaimResult("success");
        setClaimMsg(`Successfully claimed! View on SuiScan ↗`);
        setPaymentInfo(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Claim failed";
      setTxPhase({ status: "failed", error: msg });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLookup();
  };

  const elapsed = paymentInfo
    ? now -
      (paymentInfo.expiry > 0
        ? Number(paymentInfo.expiry) - 86400000 * 14
        : now)
    : 0;

  const [walrusNote, setWalrusNote] = useState<string | null>(null);
  useEffect(() => {
    setWalrusNote(null);
  }, [paymentInfo?.linkHash]);

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
              setPaymentInfo(null);
              setClaimResult("idle");
              setClaimMsg("");
            }}
            onKeyDown={handleKeyDown}
            placeholder="Paste payment link or hash here"
          />
          <div className="absolute left-[14px] top-1/2 -translate-y-1/2 text-text-muted text-[15px] pointer-events-none">
            🔗
          </div>
        </div>
      </div>

      <button
        className="btn-gradient"
        onClick={handleLookup}
        disabled={!claimInput.trim() || loading}
      >
        {loading ? "Looking up..." : "Find payment"}
      </button>

      <AnimatePresence mode="wait">
        {paymentInfo && paymentInfo.state === 0 && (
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
                    {`${(Number(paymentInfo.amount) / 1e9).toFixed(2)} SUI`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-text-secondary">
                    APY
                  </div>
                  <div className="font-display text-base font-semibold text-accent tabular-nums">
                    {apy.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-text-muted mb-4">
                <span>
                  Expires in {timeUntil(Number(paymentInfo.expiry), now)}
                </span>
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
                  Claim now{zkState?.isReady && !account ? " (via Google)" : ""}{" "}
                  →
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    className="btn-gradient w-full"
                    onClick={handleGoogleSignIn}
                    disabled={zkLoggingIn}
                  >
                    {zkLoggingIn
                      ? "Connecting..."
                      : "Sign in with Google to claim →"}
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

      {!account && !paymentInfo && (
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
                  <div className="text-[12px] font-medium">
                    Signed in with Google
                  </div>
                  <div className="text-[10px] font-mono text-text-muted">
                    {zkState.address.slice(0, 6)}...{zkState.address.slice(-4)}
                  </div>
                </div>
              </div>
              <button
                className="text-[11px] text-text-muted hover:text-accent transition-colors"
                onClick={() => {
                  clearZkLogin();
                  window.location.reload();
                }}
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
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.54 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.87 7.35 2.56 10.55l7.98-5.96z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.96C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
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
