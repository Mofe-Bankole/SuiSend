"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { motion, AnimatePresence } from "framer-motion";
import { queryUserSentPayments, queryUserClaimReceipts } from "@/lib/suisend";
import { useNow, timeAgo, timeUntil } from "@/hooks/useNow";
import type { PaymentLink, PaymentStatus, ClaimRecord } from "@/lib/suisend";

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
  const now = useNow();
  const [filter, setFilter] = useState("all");
  const [sentPayments, setSentPayments] = useState<PaymentLink[]>([]);
  const [claimReceipts, setClaimReceipts] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      queryUserSentPayments(suiClient, account.address),
      queryUserClaimReceipts(suiClient, account.address),
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
  }, [suiClient, account?.address]);

  const allItems = [
    ...sentPayments.map((p) => ({ type: "sent" as const, data: p })),
    ...claimReceipts.map((c) => ({
      type: "received" as const,
      data: {
        id: c.id,
        linkHash: c.linkHash,
        sender: c.claimer,
        amount: c.amount,
        numericAmount: parseFloat(c.amount) || 0,
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div
                        className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                        style={{ background: statusDot[item.data.status] }}
                      />
                      <span className="font-display font-semibold text-[15px] tracking-tight">
                        {item.data.amount}
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-soft text-accent">
                        {item.type === "received" ? "Received" : "Sent"}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          item.data.status === "pending"
                            ? "bg-accent-soft text-accent"
                            : item.data.status === "claimed"
                              ? "bg-[rgba(255,255,255,0.06)] text-text-secondary"
                              : "bg-[rgba(255,255,255,0.03)] text-text-muted"
                        }`}
                      >
                        {statusLabel[item.data.status] ?? item.data.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-1">
                      {timeAgo(item.data.createdAt, now)}
                      {item.data.status === "pending" && item.data.expiresAt > 0 && (
                        <> · expires in {timeUntil(item.data.expiresAt, now)}</>
                      )}
                      {item.data.claimedAt && (
                        <> · claimed {timeAgo(item.data.claimedAt, now)}</>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {item.data.yieldEarned && item.data.yieldEarned !== "0" && item.data.yieldEarned !== "0 SUI" && (
                      <div className="text-accent text-[13px] font-semibold tabular-nums font-display">
                        +{item.data.yieldEarned}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
