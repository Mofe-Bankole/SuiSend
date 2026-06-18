"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  useCurrentAccount,
  useSuiClient,
  useSuiClientQuery,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { motion, AnimatePresence } from "framer-motion";
import { buildCreatePaymentScallopPTB, randomHashHex } from "@/lib/suisend";
import { getScallopApy } from "@/lib/scallop";
import { mistToSui, suiToMist } from "@/lib/constants";
import { storeText, blobIdToHex } from "@/lib/walrus";
import { getAppUrl } from "@/lib/url";
import type { TxPhase } from "./TxStatusOverlay";

const DAY_MS = 86400000;

function calcYield(amount: number, apyBps: number, elapsedMs: number): number {
  return (amount * apyBps * elapsedMs) / (365 * DAY_MS) / 10000;
}

const PRESETS = [10, 25, 35, 50, 100, 500];

export default function SendTab({
  setTxPhase,
}: {
  setTxPhase: (p: TxPhase) => void;
}) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { data: balance } = useSuiClientQuery("getBalance", {
    owner: account?.address ?? "",
  });

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [apy, setApy] = useState(8.2);
  const [linkShown, setLinkShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [animatingYield, setAnimatingYield] = useState(0);
  const [walrusBlobId, setWalrusBlobId] = useState<string | null>(null);
  const [walrusUploading, setWalrusUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getScallopApy(suiClient).then((val) => {
      if (!cancelled) setApy(val);
    });
    return () => {
      cancelled = true;
    };
  }, [suiClient]);

  const rawAmount = parseFloat(amount) || 0;
  const apyBps = Math.round(apy * 100);
  const weeklyYield = calcYield(rawAmount, apyBps, 7 * DAY_MS);

  useEffect(() => {
    if (rawAmount > 0 && weeklyYield > 0) {
      const start = performance.now();
      const duration = 600;
      const target = weeklyYield;
      let raf: number;
      const tick = (now: number) => {
        const pct = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - pct, 3);
        setAnimatingYield(target * eased);
        if (pct < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    setAnimatingYield(0);
  }, [rawAmount, weeklyYield]);

  const formatYield = useCallback((val: number) => {
    if (val >= 1) return val.toFixed(4);
    if (val >= 0.001) return val.toFixed(6);
    if (val <= 0) return "0";
    return val.toFixed(8);
  }, []);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, "");
    setAmount(val);
    if (linkShown) {
      setLinkShown(false);
      setCopied(false);
    }
  };

  const handlePreset = (val: number) => {
    setAmount(String(val));
    if (linkShown) {
      setLinkShown(false);
      setCopied(false);
    }
  };

  const handleSend = async () => {
    if (!account || rawAmount <= 0 || sending) return;

    setSending(true);

    try {
      let noteBlobIdHex: string | undefined;
      if (note.trim()) {
        setWalrusUploading(true);
        try {
          const result = await storeText(note.trim(), 5, "mainnet");
          noteBlobIdHex = blobIdToHex(result.blobId);
          setWalrusBlobId(result.blobId);
        } catch (e) {
          console.warn("Walrus upload failed, continuing without blob:", e);
        } finally {
          setWalrusUploading(false);
        }
      }

      const linkHash = randomHashHex();
      const amountMist = suiToMist(rawAmount);

      const tx = buildCreatePaymentScallopPTB({
        amount: amountMist,
        linkHashHex: linkHash,
        noteBlobIdHex,
      });

      setTxPhase({ status: "signing" });

      const result = await signAndExecute({ transaction: tx });

      setTxPhase({
        status: "confirmed",
        txId: result.digest,
        label: "Payment created",
      });

      setGeneratedUrl(`${getAppUrl()}/claim/${linkHash}`);
      setLinkShown(true);
      setTimeout(() => {
        linkRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 50);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setTxPhase({ status: "failed", error: msg });
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayUrl = generatedUrl
    ? generatedUrl.length > 60
      ? generatedUrl.substring(0, 45) + "..." + generatedUrl.slice(-16)
      : generatedUrl
    : "";

  const suiBalance = balance ? mistToSui(BigInt(balance.totalBalance)) : 0;
  const canSend = rawAmount > 0 && rawAmount <= suiBalance;

  if (!account) {
    return (
      <div className="empty-state">
        <div className="empty-icon">→</div>
        <div className="empty-title">Connect your wallet</div>
        <div className="empty-desc">
          Use the button in the top-right to connect. Your funds never leave
          your wallet until you send.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Send money
          </h2>
          <p className="text-text-secondary text-[13px] mt-0.5">
            Create a payment link that earns yield
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text-muted font-medium">
            Balance
          </div>
          <div className="font-display text-[15px] font-semibold tabular-nums">
            {suiBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })}{" "}
            <span className="text-text-secondary text-[13px]">SUI</span>
          </div>
        </div>
      </div>

      <div className="app-field">
        <div className="app-flabel">Amount (SUI)</div>
        <div className="relative">
          <input
            className="app-finput !text-[28px] !font-bold !tracking-tight !pl-4 !pr-14 !py-4"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.00"
          />
          <div className="absolute right-[14px] top-1/2 -translate-y-1/2 text-text-muted font-display text-[13px] font-semibold pointer-events-none">
            SUI
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4">
        {PRESETS.map((val) => (
          <button
            key={val}
            onClick={() => handlePreset(val)}
            className={`flex-1 py-2 rounded-lg text-[12px] font-medium font-display cursor-pointer transition-all ${
              parseFloat(amount) === val
                ? "bg-accent text-background"
                : "bg-bg-card border border-border-light text-text-secondary hover:border-text-muted"
            }`}
          >
            {val} SUI
          </button>
        ))}
      </div>

      <div className="app-field">
        <div className="app-flabel">Note (optional)</div>
        <input
          className="app-finput"
          type="text"
          value={note}
          onChange={(e) => {
            if (e.target.value.length <= 120) setNote(e.target.value);
          }}
          placeholder="What's this for?"
        />
        <div className="text-right text-[10px] text-text-muted mt-1">
          {note.length}/120
        </div>
      </div>

      <div className="yield-box-premium">
        <div className="ybp-row">
          <span className="ybp-label">Estimated yield in 7 days</span>
          <span className="ybp-value">
            {rawAmount > 0 ? <>+{formatYield(animatingYield)} SUI</> : "—"}
          </span>
        </div>
        <div className="ybp-sub">
          Based on real Scallop APY:{" "}
          <span className="text-accent font-semibold">{apy.toFixed(2)}%</span>
        </div>
      </div>

      <button
        className="btn-gradient"
        onClick={handleSend}
        disabled={!canSend || walrusUploading || sending}
      >
        {sending
          ? "Confirming..."
          : walrusUploading
            ? "Uploading note to Walrus..."
            : rawAmount <= 0
              ? "Enter an amount"
              : !canSend
                ? "Insufficient balance"
                : "Generate payment link →"}
      </button>

      <AnimatePresence>
        {linkShown && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="link-gen-premium show"
            ref={linkRef}
          >
            <div className="lgp-header">
              <div className="lgp-icon">✓</div>
              <div className="lgp-title">Payment link ready</div>
            </div>
            <div className="lgp-url-wrap">
              <div
                className="lgp-url"
                onClick={handleCopy}
                title="Click to copy"
              >
                {displayUrl}
              </div>
              <button
                className={`lgp-copy ${copied ? "copied" : ""}`}
                onClick={handleCopy}
                aria-label="Copy link"
              >
                {copied ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
            {copied && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-accent text-[11px] mt-2 font-medium"
              >
                Copied to clipboard
              </motion.div>
            )}
            {walrusBlobId && (
              <div className="mt-3 p-2 rounded-lg bg-bg-card border border-border-light">
                <div className="text-[10px] uppercase tracking-[0.06em] text-text-muted font-medium mb-0.5">
                  Note stored on Walrus
                </div>
                <div className="text-[11px] font-mono text-accent break-all">
                  {walrusBlobId}
                </div>
              </div>
            )}
            <div className="lgp-note">
              Share this link with anyone. They only need the link to claim — no
              wallet required on their end. Funds earn yield until claimed.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
