"use client";

const TESTNET_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const TESTNET_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

const MAINNET_PUBLISHER = "https://publisher.walrus.space";
const MAINNET_AGGREGATOR = "https://aggregator.walrus.space";

export interface WalrusStoreResult {
  blobId: string;
  storedForEpochs: number;
}

export interface WalrusEndpointConfig {
  publisher: string;
  aggregator: string;
}

export function getWalrusConfig(network: "testnet" | "mainnet" = "testnet"): WalrusEndpointConfig {
  return {
    publisher: network === "testnet" ? TESTNET_PUBLISHER : MAINNET_PUBLISHER,
    aggregator: network === "testnet" ? TESTNET_AGGREGATOR : MAINNET_AGGREGATOR,
  };
}

export async function storeBlob(
  data: Uint8Array,
  epochs = 5,
  network: "testnet" | "mainnet" = "testnet",
): Promise<WalrusStoreResult> {
  const { publisher } = getWalrusConfig(network);
  const url = `${publisher}/v1/blobs?epochs=${epochs}`;

  const resp = await fetch(url, { method: "PUT", body: data as any });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "unknown error");
    throw new Error(`walrus store failed (${resp.status}): ${text}`);
  }

  const json = await resp.json();
  const blobId =
    json.newlyCreated?.blobObject?.blobId ??
    json.alreadyCertified?.blobId;

  if (!blobId) throw new Error("walrus store: no blobId in response");

  return { blobId, storedForEpochs: epochs };
}

export async function readBlob(
  blobId: string,
  network: "testnet" | "mainnet" = "testnet",
): Promise<Uint8Array> {
  const { aggregator } = getWalrusConfig(network);
  const url = `${aggregator}/v1/blobs/${blobId}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "unknown error");
    throw new Error(`walrus read failed (${resp.status}): ${text}`);
  }

  return new Uint8Array(await resp.arrayBuffer());
}

export async function storeText(
  text: string,
  epochs = 5,
  network: "testnet" | "mainnet" = "testnet",
): Promise<WalrusStoreResult> {
  const encoder = new TextEncoder();
  return storeBlob(encoder.encode(text), epochs, network);
}

export async function readText(
  blobId: string,
  network: "testnet" | "mainnet" = "testnet",
): Promise<string> {
  const bytes = await readBlob(blobId, network);
  return new TextDecoder().decode(bytes);
}

export function blobIdToHex(blobId: string): string {
  const base64url = blobId.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64url);
  const hex: string[] = [];
  for (let i = 0; i < binary.length; i++) {
    hex.push(binary.charCodeAt(i).toString(16).padStart(2, "0"));
  }
  return "0x" + hex.join("");
}

export function hexToBlobId(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  const binary = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
