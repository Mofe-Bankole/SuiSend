import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const id = setInterval(cb, 30000);
  return () => clearInterval(id);
}

function getNow() {
  return Date.now();
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getNow, getNow);
}

export function msToDays(ms: number): number {
  return Math.floor(ms / 86400000);
}

export function timeAgo(from: number, now: number): string {
  const diff = now - from;
  if (diff < 0) return "just now";
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  const minutes = Math.floor(diff / 60000);
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function timeUntil(to: number, now: number): string {
  const diff = to - now;
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(diff / 60000);
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}
