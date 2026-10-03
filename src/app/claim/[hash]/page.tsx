"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
  ConnectModal as WalletConnectModal,
} from "@mysten/dapp-kit";
import ConnectModal from "@/components/app/ConnectModal";
import {
  lookupPayment,
  buildClaimPaymentScallopPTB,
  buildClaimPaymentUSDCPTB,
  queryPaymentTerminalStatus,
  type TerminalStatus,
} from "@/lib/suisend";
import { formatAmount, coinLabel, shortenAddress } from "@/lib/constants";
import {
  getZkLoginState,
  signWithZkLoginAndExecute,
  type ZkLoginState,
} from "@/lib/zklogin";
import { useNow, timeUntil } from "@/hooks/useNow";

interface PaymentInfo {
  linkHash: string;
  amount: bigint;
  expiry: bigint;
  sender: string;
  coinType: number;
}

type Phase = "loading" | "invalid" | "terminal" | "ready" | "error";

function normalizeHashParam(raw: string): string | null {
  let h = raw.trim();
  // Tolerate a full URL pasted into the path segment.
  h = h.replace(/^https?:\/\/[^/]+\/claim\//, "");
  h = h.startsWith("0x") ? h.slice(2) : h;
  if (!/^[0-9a-fA-F]+$/.test(h) || h.length % 2 !== 0 || h.length > 128) {
    return null;
  }
  return "0x" + h;
}

const TERMINAL_COPY: Record<TerminalStatus, { title: string; desc: string }> = {
  claimed: {
    title: "Already claimed",
    desc: "This payment has already been claimed by the recipient.",
  },
  refunded: {
    title: "Refunded by sender",
    desc: "The sender took this payment back. Check with them if you expected it.",
  },
  unknown: {
    title: "Payment not found",
    desc: "This payment was claimed, refunded, or the link is incorrect. Double-check the full link.",
  },
};

export default function ClaimPage() {
  const params = useParams();
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const now = useNow();

  const [phase, setPhase] = useState<Phase>("loading");
  const [terminal, setTerminal] = useState<TerminalStatus>("unknown");
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [zkState, setZkState] = useState<ZkLoginState | null>(null);

  useEffect(() => {
    setZkState(getZkLoginState());
  }, []);

  useEffect(() => {
    const raw = params?.hash;
    if (raw === undefined) return; // params not hydrated yet — stay loading
    const hashParam = Array.isArray(raw) ? raw[0] : raw;
    const hash =
      typeof hashParam === "string" ? normalizeHashParam(hashParam) : null;
    if (!hash) {
      setPhase("invalid");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await lookupPayment(suiClient, hash);
        if (cancelled) return;
        if (
          result.exists &&
          result.amount !== undefined &&
          result.expiry !== undefined &&
          result.sender
        ) {
          setInfo({
            linkHash: hash,
            amount: result.amount,
            expiry: result.expiry,
            sender: result.sender,
            coinType: result.coinType ?? 0,
          });
          setPhase("ready");
        } else {
          const status = await queryPaymentTerminalStatus(suiClient, hash);
          if (cancelled) return;
          setTerminal(status);
          setPhase("terminal");
        }
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, suiClient]);

  const isConnected = !!account || !!zkState?.isReady;
  const expired = info ? Number(info.expiry) <= now : false;

  const handleClaim = async () => {
    if (!info || claiming || !isConnected) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const tx =
        info.coinType === 1
          ? buildClaimPaymentUSDCPTB(info.linkHash)
          : buildClaimPaymentScallopPTB(info.linkHash);
      let txDigest: string;
      if (account) {
        const result = await signAndExecute({ transaction: tx });
        txDigest = result.digest;
      } else {
        txDigest = await signWithZkLoginAndExecute(tx);
      }
      setDigest(txDigest);
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-8 h-14 md:h-16 glass sticky top-0 z-50">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-[16px] font-semibold tracking-tight text-text-primary no-underline"
        >
          <div className="w-[7px] h-[7px] rounded-full bg-accent animate-[blink_2.4s_ease-in-out_infinite]" />
          SuiSend
        </Link>
        <Link
          href="/app"
          className="px-4 py-1.5 rounded-lg text-[13px] font-medium font-display bg-bg-card border border-border-light text-text-primary hover:border-text-muted transition-colors no-underline"
        >
          Open app
        </Link>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[560px] px-4 md:px-6 py-10 md:py-16">
        {phase === "loading" && (
          <div className="empty-state !py-24">
            <div className="empty-desc">Looking up payment…</div>
          </div>
        )}

        {phase === "invalid" && (
          <div className="glass-card p-6 text-center">
            <div className="tx-x mx-auto mb-4 w-12 h-12">
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 className="font-display text-lg font-bold mb-2">
              Invalid link
            </h1>
            <p className="text-text-secondary text-sm">
              This doesn&apos;t look like a SuiSend payment link. Check that
              you copied the whole URL.
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="glass-card p-6 text-center">
            <div className="tx-x mx-auto mb-4 w-12 h-12">
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 className="font-display text-lg font-bold mb-2">
              Lookup failed
            </h1>
            <p className="text-text-secondary text-sm mb-4">
              Couldn&apos;t reach the Sui network. Check your connection.
            </p>
            <button
              className="btn-gradient"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        )}

        {phase === "terminal" && (
          <div className="glass-card p-6 text-center">
            <div className="empty-icon mx-auto mb-4">◎</div>
            <h1 className="font-display text-lg font-bold mb-2">
              {TERMINAL_COPY[terminal].title}
            </h1>
            <p className="text-text-secondary text-sm">
              {TERMINAL_COPY[terminal].desc}
            </p>
          </div>
        )}

        {phase === "ready" && info && !digest && (
          <div className="claim-card">
            <div className="claim-card-content">
              <div className="text-[10px] uppercase tracking-[0.08em] text-accent font-medium mb-1">
                You received a payment
              </div>
              <div className="font-display text-4xl font-bold tracking-tight">
                {formatAmount(Number(info.amount), info.coinType)}
              </div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-medium mt-1 mb-4">
                {coinLabel(info.coinType)} + yield earned while waiting
              </div>

              <div className="flex items-center gap-2 text-[12px] text-text-muted mb-1">
                <span>
                  From{" "}
                  <span className="font-mono">
                    {shortenAddress(info.sender, 6)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-text-muted mb-5">
                {expired ? (
                  <span className="text-amber-400">
                    Expired — claimable until the sender refunds
                  </span>
                ) : (
                  <span>
                    Expires in {timeUntil(Number(info.expiry), now)}
                  </span>
                )}
              </div>

              {isConnected ? (
                <>
                  <button
                    className="btn-gradient"
                    onClick={handleClaim}
                    disabled={claiming}
                  >
                    {claiming
                      ? "Claiming…"
                      : `Claim ${formatAmount(Number(info.amount), info.coinType)} →`}
                  </button>
                  {!account && zkState?.isReady && (
                    <p className="text-text-muted text-[11px] text-center mt-3">
                      Claiming as {shortenAddress(zkState.address, 4)} via
                      Google. A small SUI balance is needed for gas.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <button
                    className="btn-gradient"
                    onClick={() => setShowConnectModal(true)}
                  >
                    Connect to claim →
                  </button>
                  <p className="text-text-muted text-[11px] text-center mt-3">
                    Sui wallet or Google sign-in
                  </p>
                </>
              )}

              {claimError && (
                <p className="text-red-400 text-[12px] text-center mt-3">
                  {claimError}
                </p>
              )}
            </div>
          </div>
        )}

        {digest && (
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="tx-check !w-10 !h-10 !m-0">
                <svg viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div className="font-display text-base font-semibold">
                  Payment claimed
                </div>
                <div className="text-[13px] text-text-secondary">
                  {info &&
                    `${formatAmount(Number(info.amount), info.coinType)} is in your wallet, plus accrued yield.`}
                </div>
              </div>
            </div>
            <a
              href={`https://suiscan.xyz/mainnet/tx/${digest}`}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-accent text-[13px] font-medium mt-4 hover:underline"
            >
              View transaction on Suiscan ↗
            </a>
          </div>
        )}
      </main>

      <ConnectModal
        open={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnectWallet={() => setShowWalletModal(true)}
      />
      <WalletConnectModal
        trigger={<span />}
        open={showWalletModal}
        onOpenChange={setShowWalletModal}
      />
    </div>
  );
}
