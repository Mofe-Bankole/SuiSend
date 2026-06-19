import { useSyncExternalStore } from "react";

function getNow() {
  return Date.now();
}

const store = {
  now: getNow(),
  listeners: new Set<() => void>(),
};

function subscribe(cb: () => void) {
  store.listeners.add(cb);
  return () => {
    store.listeners.delete(cb);
  };
}

function getSnapshot() {
  return store.now;
}

function tick() {
  store.now = Date.now();
  store.listeners.forEach((cb) => cb());
}

setInterval(tick, 30000);

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
