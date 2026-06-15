"use client";

import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { motion, AnimatePresence } from "framer-motion";
import { getMyPayments, getAllPayments } from "@/lib/suisend";
import { useNow, timeAgo, timeUntil } from "@/hooks/useNow";
import type { PaymentStatus } from "@/lib/suisend";

const statusLabel: Record<PaymentStatus, string> = {
  pending: "Pending",
  claimed: "Claimed",
  refunded: "Refunded",
  expired: "Expired",
};

const statusDot: Record<PaymentStatus, string> = {
  pending: "var(--accent)",
  claimed: "var(--text-primary)",
  refunded: "var(--text-muted)",
  expired: "var(--text-muted)",
};

const filters: { key: PaymentStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "claimed", label: "Claimed" },
  { key: "refunded", label: "Refunded" },
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
  const now = useNow();
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");

  const allPayments = account
    ? getMyPayments(account.address)
    : getAllPayments();
  const payments =
    filter === "all"
      ? allPayments
      : allPayments.filter((p) => p.status === filter);

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
        {payments.length === 0 ? (
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
            {payments.map((p) => (
              <motion.div key={p.id} variants={itemVariants}>
                <div className="history-card">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div
                        className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                        style={{ background: statusDot[p.status] }}
                      />
                      <span className="font-display font-semibold text-[15px] tracking-tight">
                        {p.amount}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          p.status === "pending"
                            ? "bg-accent-soft text-accent"
                            : p.status === "claimed"
                              ? "bg-[rgba(255,255,255,0.06)] text-text-secondary"
                              : "bg-[rgba(255,255,255,0.03)] text-text-muted"
                        }`}
                      >
                        {statusLabel[p.status]}
                      </span>
                    </div>
                    {p.note && (
                      <div className="text-[12px] text-text-secondary truncate mt-0.5">
                        {p.note}
                      </div>
                    )}
                    <div className="text-[11px] text-text-muted mt-1">
                      {timeAgo(p.createdAt, now)}
                      {p.status === "pending" && (
                        <> · expires in {timeUntil(p.expiresAt, now)}</>
                      )}
                      {p.status === "claimed" && p.claimedAt && (
                        <> · claimed {timeAgo(p.claimedAt, now)}</>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {p.yieldEarned && p.yieldEarned !== "0" && (
                      <div className="text-accent text-[13px] font-semibold tabular-nums font-display">
                        +{p.yieldEarned}
                      </div>
                    )}
                    {p.status === "pending" && (
                      <div className="text-accent text-[10px] tabular-nums mt-0.5 opacity-60">
                        earning yield
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
