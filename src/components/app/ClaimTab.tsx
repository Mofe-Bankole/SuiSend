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
import { getZkLoginState, signWithZkLoginAndExecute, type ZkLoginState } from "@/lib/zklogin";
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

  const [paymentInfo, setPaymentInfo] = useState<{
    linkHash: string;
    amount: bigint;
    expiry: bigint;
    state: number;
    sender: string;
  } | null>(null);

  const [zkState, setZkState] = useState<ZkLoginState | null>(null);

  useEffect(() => {
    setZkState(getZkLoginState());
  }, []);

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
                <p className="text-text-muted text-[13px] text-center">
                  Connect a wallet or sign in with Google above to claim this
                  payment.
                </p>
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

    </div>
  );
}
