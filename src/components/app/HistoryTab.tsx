"use client";

import { useState, useEffect, useRef } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { motion, AnimatePresence } from "framer-motion";
import { queryUserSentPayments, queryUserClaimReceipts } from "@/lib/suisend";
import { useNow, timeAgo, timeUntil } from "@/hooks/useNow";
import type { PaymentLink, PaymentStatus, ClaimRecord } from "@/lib/suisend";
import { coinLabel } from "@/lib/constants";

const statusDot: Record<string, string> = {
  pending: "var(--accent)",
  claimed: "var(--text-primary)",
  refunded: "var(--text-muted)",
  expired: "var(--text-muted)",
};

const statusLabel: Record<string, string> = {
  pending: "Pending",
  claimed: "Claimed",
  refunded: "Refunded",
  expired: "Expired",
};

const filters: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "claimed", label: "Claimed" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function HistoryTab() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const suiClientRef = useRef(suiClient);
  suiClientRef.current = suiClient;
  const now = useNow();
  const [filter, setFilter] = useState("all");
  const [sentPayments, setSentPayments] = useState<PaymentLink[]>([]);
  const [claimReceipts, setClaimReceipts] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      queryUserSentPayments(suiClientRef.current, account.address),
      queryUserClaimReceipts(suiClientRef.current, account.address),
    ])
      .then(([sent, claims]) => {
        if (!cancelled) {
          setSentPayments(sent);
          setClaimReceipts(claims);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [account?.address]);

  const allItems = [
    ...sentPayments.map((p) => ({ type: "sent" as const, data: p })),
    ...claimReceipts.map((c) => ({
      type: "received" as const,
      data: {
        id: c.id,
        linkHash: c.linkHash,
        sender: c.claimer,
        amount: c.amount,
        numericAmount: 0,
        coinType: c.coinType,
        note: "",
        status: "claimed" as PaymentStatus,
        yieldEarned: c.yieldEarned,
        createdAt: c.claimedAt,
        expiresAt: c.claimedAt,
        claimUrl: "",
        claimedAt: c.claimedAt,
      } as PaymentLink,
    })),
  ].sort((a, b) => b.data.createdAt - a.data.createdAt);

  const filteredItems =
    filter === "all"
      ? allItems
      : allItems.filter((item) => item.data.status === filter);

  if (!account) {
    return (
      <div className="empty-state">
        <div className="empty-icon">◎</div>
        <div className="empty-title">Connect your wallet</div>
        <div className="empty-desc">
          Your sent payments and claimed links will appear here.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-xl font-bold tracking-tight mb-1">
        History
      </h2>
      <p className="text-text-secondary text-[13px] mb-5">
        All your payment activity
      </p>

      <div className="filter-group mb-5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`filter-pill ${filter === f.key ? "active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="empty-state !py-16"
          >
            <div className="empty-desc">Loading...</div>
          </motion.div>
        ) : filteredItems.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="empty-state !py-16"
          >
            <div className="empty-icon">◇</div>
            <div className="empty-title">
              {filter === "all"
                ? "No payments yet"
                : `No ${filter} payments`}
            </div>
            <div className="empty-desc">
              {filter === "all"
                ? "Create your first payment link to get started."
                : "No matching payments found."}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={filter}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-2"
          >
            {filteredItems.map((item) => (
              <motion.div key={item.type + item.data.id} variants={itemVariants}>
                <div className="history-card">
                  <div className="history-card-top">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-[16px] tracking-tight">
                          {item.data.amount}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(158,255,91,0.12)] text-accent">
                          {item.type === "received" ? "Received" : "Sent"}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-text-muted">
                          {coinLabel(item.data.coinType)}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted mt-1.5">
                        {timeAgo(item.data.createdAt, now)}
                        {item.data.status === "pending" && item.data.expiresAt > 0 && (
                          <> · expires {timeUntil(item.data.expiresAt, now)}</>
                        )}
                        {item.data.claimedAt && (
                          <> · claimed {timeAgo(item.data.claimedAt, now)}</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: statusDot[item.data.status] }}
                      />
                      <span className="text-[11px] font-medium text-text-secondary">
                        {statusLabel[item.data.status] ?? item.data.status}
                      </span>
                    </div>
                  </div>

                  {item.type === "sent" && (
                    <>
                      <div className="history-card-divider" />
                      <div
                        className={`history-card-link ${item.data.status !== "pending" ? "disabled" : ""}`}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`flex-shrink-0 ${
                            item.data.status === "pending"
                              ? "text-accent"
                              : "text-text-muted"
                          }`}
                        >
                          {item.data.status === "pending" ? (
                            <>
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </>
                          ) : (
                            <>
                              <rect x="3" y="11" width="18" height="11" rx="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </>
                          )}
                        </svg>
                        <span
                          className={`flex-1 font-mono text-[11px] truncate ${
                            item.data.status === "pending"
                              ? "text-accent"
                              : "text-text-muted"
                          }`}
                        >
                          {item.data.claimUrl.length > 50
                            ? item.data.claimUrl.slice(0, 30) +
                              "…" +
                              item.data.claimUrl.slice(-14)
                            : item.data.claimUrl}
                        </span>
                        {item.data.status === "pending" && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              className="history-card-link-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(item.data.claimUrl, "_blank");
                              }}
                              aria-label="Open link"
                              title="Open claim link"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </button>
                            <button
                              className="history-card-link-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyLink(item.data.id, item.data.claimUrl);
                              }}
                              aria-label="Copy link"
                            >
                              {copiedId === item.data.id ? (
                                <svg
                                  width="12"
                                  height="12"
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
                                  width="12"
                                  height="12"
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
                        )}
                      </div>
                    </>
                  )}

                  {item.data.yieldEarned &&
                    item.data.yieldEarned !== "0" && (
                      <div className="history-yield">
                        +{item.data.yieldEarned}
                      </div>
                    )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
