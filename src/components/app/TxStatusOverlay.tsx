"use client";

import { useEffect } from "react";

export type TxPhase =
  | { status: "idle" }
  | { status: "signing" }
  | { status: "broadcasting"; txId?: string }
  | { status: "confirmed"; txId: string; label: string }
  | { status: "failed"; error: string };

export default function TxStatusOverlay({
  phase,
  onClose,
  onRetry,
}: {
  phase: TxPhase;
  onClose: () => void;
  onRetry?: () => void;
}) {
  useEffect(() => {
    if (phase.status === "idle") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase.status, onClose]);

  if (phase.status === "idle") return null;

  return (
    <div className="tx-overlay" onClick={onClose}>
      <div className="tx-modal" onClick={(e) => e.stopPropagation()}>
        {phase.status === "signing" && (
          <>
            <div className="tx-spinner" />
            <div className="tx-status-label">Confirm in wallet</div>
            <div className="tx-status-sub">
              Approve the transaction in your wallet to continue.
            </div>
          </>
        )}

        {phase.status === "broadcasting" && (
          <>
            <div className="tx-pulse" />
            <div className="tx-status-label">Broadcasting</div>
            <div className="tx-status-sub">
              Waiting for the transaction to be confirmed on-chain…
            </div>
          </>
        )}

        {phase.status === "confirmed" && (
          <>
            <div className="tx-check">
              <svg viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="tx-status-label">{phase.label}</div>
            <div className="tx-status-sub">
              <a
                href={`https://suiscan.xyz/mainnet/tx/${phase.txId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on SuiScan ↗
              </a>
            </div>
            <button className="tx-retry" onClick={onClose}>
              Done
            </button>
          </>
        )}

        {phase.status === "failed" && (
          <>
            <div className="tx-x">
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div className="tx-status-label">Transaction failed</div>
            <div className="tx-status-sub">{phase.error}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {onRetry && (
                <button className="tx-retry" onClick={onRetry}>
                  Retry
                </button>
              )}
              <button className="tx-retry" onClick={onClose}>
                Dismiss
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
