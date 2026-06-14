"use client";

import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { getMyPayments, getAllPayments } from "@/lib/suisend";
import { useNow, timeAgo, timeUntil } from "@/hooks/useNow";
import type { PaymentStatus } from "@/lib/suisend";

const statusLabel: Record<PaymentStatus, string> = {
  pending: "Pending",
  claimed: "Claimed",
  refunded: "Refunded",
  expired: "Expired",
};

const statusClass: Record<PaymentStatus, string> = {
  pending: "text-accent",
  claimed: "text-text-primary",
  refunded: "text-text-muted",
  expired: "text-text-muted",
};

export default function HistoryTab() {
  const account = useCurrentAccount();
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");

  const now = useNow();
  const allPayments = account ? getMyPayments(account.address) : getAllPayments();
  const payments = filter === "all" ? allPayments : allPayments.filter((p) => p.status === filter);

  const filters: { key: PaymentStatus | "all"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "claimed", label: "Claimed" },
    { key: "refunded", label: "Refunded" },
  ];

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-xl border border-border-light flex items-center justify-center text-[22px] mb-5">
          ◎
        </div>
        <h3 className="font-display text-xl font-semibold mb-2 tracking-tight">
          Connect wallet to see history
        </h3>
        <p className="text-text-secondary text-sm max-w-[300px]">
          Your sent payments and claimed links will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-1.5 mb-5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium font-display transition-all cursor-pointer ${
              filter === f.key
                ? "bg-text-primary text-background"
                : "text-text-secondary border border-border-light hover:border-text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-muted text-sm">
            {filter === "all" ? "No payments yet. Create your first one!" : `No ${filter} payments.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div
              key={p.id}
              className="p-3.5 rounded-lg border border-border bg-bg-card flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display font-semibold text-[15px] tracking-tight">
                    {p.amount}
                  </span>
                  <span className={`text-[11px] font-medium ${statusClass[p.status]}`}>
                    {statusLabel[p.status]}
                  </span>
                </div>
                {p.note && (
                  <div className="text-[12px] text-text-secondary truncate">
                    {p.note}
                  </div>
                )}
                <div className="text-[11px] text-text-muted mt-1">
                  {timeAgo(p.createdAt, now)}
                  {p.status === "claimed" && p.claimedAt && (
                    <> · claimed {timeAgo(p.claimedAt, now)}</>
                  )}
                  {p.status === "pending" && (
                    <> · expires in {timeUntil(p.expiresAt, now)}</>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {p.yieldEarned && p.yieldEarned !== "0" && (
                  <div className="text-accent text-[12px] font-semibold tabular-nums font-display">
                    +{p.yieldEarned}
                  </div>
                )}
                {p.status === "pending" && (
                  <div className="text-accent text-[10px] tabular-nums mt-0.5 opacity-70">
                    earning yield
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
