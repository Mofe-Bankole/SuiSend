"use client";

export const SUISEND_PACKAGE_ID = "";
export const PAYMENT_BOOK_ID = "";
export const YIELD_VAULT_ID = "";

export const SCALLOP_ADDRESS_ID = "67c44a103fe1b8c454eb9699";

export const NETWORK = "mainnet" as const;

export const SUI_DECIMALS = 9;
export const SUI_PER_MIST = 1_000_000_000;

export const EXPIRY_DAYS = 14;
export const EXPIRY_MS = EXPIRY_DAYS * 86400 * 1000;

export function mistToSui(mist: bigint): number {
  return Number(mist) / SUI_PER_MIST;
}

export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * SUI_PER_MIST));
}

export function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}
