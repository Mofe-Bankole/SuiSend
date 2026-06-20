"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import {
  getZkLoginState,
  clearZkLogin,
  getGoogleAuthUrl,
} from "@/lib/zklogin";
import { shortenAddress } from "@/lib/constants";

interface ConnectModalProps {
  open: boolean;
  onClose: () => void;
  onConnectWallet: () => void;
}

export default function ConnectModal({
  open,
  onClose,
  onConnectWallet,
}: ConnectModalProps) {
  const account = useCurrentAccount();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const [zkState, setZkState] = useState(getZkLoginState());
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  useEffect(() => {
    if (open) setZkState(getZkLoginState());
  }, [open]);

  const handleGoogle = async () => {
    if (zkState) {
      clearZkLogin();
      setZkState(null);
      window.location.reload();
      return;
    }
    setConnectingGoogle(true);
    try {
      const url = await getGoogleAuthUrl();
      window.location.href = url;
    } catch {
      setConnectingGoogle(false);
    }
  };

  const handleWallet = () => {
    if (account) {
      disconnectWallet();
      onClose();
    } else {
      onConnectWallet();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass-card p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold mb-1">Connect</h2>
        <p className="text-text-muted text-sm mb-5">
          Choose how to connect
        </p>

        <div className="space-y-3">
          <button
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-bg-card border border-border-light hover:border-accent/50 transition-all text-left cursor-pointer"
            onClick={handleWallet}
          >
            <div className="w-10 h-10 rounded-xl bg-bg-card border border-border-light flex items-center justify-center flex-shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <circle cx="16" cy="13" r="2" fill="currentColor" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                {account ? "Disconnect" : "Wallet"}
              </div>
              <div className="text-xs text-text-muted truncate">
                {account
                  ? shortenAddress(account.address, 6)
                  : "Connect your Sui wallet"}
              </div>
            </div>
            {account && (
              <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
            )}
          </button>

          <button
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-bg-card border border-border-light hover:border-accent/50 transition-all text-left cursor-pointer disabled:opacity-50"
            onClick={handleGoogle}
            disabled={connectingGoogle}
          >
            <div className="w-10 h-10 rounded-xl bg-bg-card border border-border-light flex items-center justify-center flex-shrink-0">
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
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                {zkState ? "Disconnect" : "Google"}
              </div>
              <div className="text-xs text-text-muted truncate">
                {zkState
                  ? `${shortenAddress(zkState.address, 4)}`
                  : connectingGoogle
                    ? "Connecting..."
                    : "Sign in with Google"}
              </div>
            </div>
            {zkState && (
              <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
            )}
          </button>
        </div>

        <button
          className="mt-5 w-full text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
