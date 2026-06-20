"use client";

function ensureProtocol(url: string): string {
  const cleaned = url.replace(/\/+$/, "");
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) return cleaned;
  return `https://${cleaned}`;
}

export function getAppUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (envUrl) return ensureProtocol(envUrl);
    return window.location.origin;
  }
  return ensureProtocol(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
}
