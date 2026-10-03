"use client";

import { Scallop, ScallopBuilder } from "@scallop-io/sui-scallop-sdk";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Transaction } from "@mysten/sui/transactions";
import type { TransactionObjectArgument } from "@mysten/sui/transactions";
import { SCALLOP_ADDRESS_ID } from "./constants";

let scallopBuilder: ScallopBuilder | null = null;
let initPromise: Promise<ScallopBuilder> | null = null;

export async function getScallopBuilder(
  suiClient: SuiJsonRpcClient,
): Promise<ScallopBuilder> {
  if (scallopBuilder) return scallopBuilder;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const sdk = new Scallop({
      addressId: SCALLOP_ADDRESS_ID,
      networkType: "mainnet",
      suiClients: [suiClient],
    });
    await sdk.init();
    scallopBuilder = sdk.client.builder;
    return scallopBuilder;
  })();

  return initPromise;
}

export function resetScallopBuilder() {
  scallopBuilder = null;
  initPromise = null;
}

/* ── Resilient APY fetching ──────────────────────────────────
   The Scallop SDK's queryMarket is heavy and rate-limit-prone.
   Strategy: serve a recently-cached real value instantly, race a
   6s timeout, and only fall back to a static default as a last
   resort. Cache is sessionStorage so repeat renders/tabs are free. */

const APY_CACHE_KEY = "suisend.apy.v1";
const APY_TTL_MS = 10 * 60 * 1000; // 10 min
const APY_TIMEOUT_MS = 6000;

const FALLBACK_SUI_APY = 8.2;
const FALLBACK_USDC_APY = 5.0;

interface ApyCache {
  sui?: number;
  usdc?: number;
  t: number;
}

function readApyCache(): ApyCache | null {
  try {
    const raw = sessionStorage.getItem(APY_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ApyCache) : null;
  } catch {
    return null;
  }
}

function writeApyCache(patch: Partial<ApyCache>) {
  try {
    const prev = readApyCache() ?? { t: 0 };
    sessionStorage.setItem(
      APY_CACHE_KEY,
      JSON.stringify({ ...prev, ...patch, t: Date.now() }),
    );
  } catch {
    /* storage unavailable — non-fatal */
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("scallop query timeout")), ms),
    ),
  ]);
}

async function fetchMarketApys(
  suiClient: SuiJsonRpcClient,
): Promise<{ sui: number; usdc: number }> {
  const builder = await getScallopBuilder(suiClient);
  const market = await withTimeout(builder.query.queryMarket(), APY_TIMEOUT_MS);
  const suiApy = market.pools.sui
    ? Number(market.pools.sui.supplyApy) * 100
    : NaN;
  const usdcApy = market.pools.usdc
    ? Number(market.pools.usdc.supplyApy) * 100
    : NaN;
  return {
    sui: Number.isFinite(suiApy) && suiApy > 0 ? suiApy : FALLBACK_SUI_APY,
    usdc: Number.isFinite(usdcApy) && usdcApy > 0 ? usdcApy : FALLBACK_USDC_APY,
  };
}

let apyInflight: Promise<{ sui: number; usdc: number }> | null = null;

async function getApys(
  suiClient: SuiJsonRpcClient,
): Promise<{ sui: number; usdc: number }> {
  const cached = readApyCache();
  if (cached?.sui && cached?.usdc && Date.now() - cached.t < APY_TTL_MS) {
    return { sui: cached.sui, usdc: cached.usdc };
  }
  if (!apyInflight) {
    apyInflight = fetchMarketApys(suiClient)
      .then((fresh) => {
        writeApyCache(fresh);
        return fresh;
      })
      .finally(() => {
        apyInflight = null;
      });
  }
  return apyInflight;
}

export async function getScallopApy(
  suiClient: SuiJsonRpcClient,
): Promise<number> {
  try {
    if (!suiClient) return FALLBACK_SUI_APY;
    const { sui } = await getApys(suiClient);
    return sui;
  } catch {
    return readApyCache()?.sui ?? FALLBACK_SUI_APY;
  }
}

export async function getScallopUsdcApy(
  suiClient: SuiJsonRpcClient,
): Promise<number> {
  try {
    if (!suiClient) return FALLBACK_USDC_APY;
    const { usdc } = await getApys(suiClient);
    return usdc;
  } catch {
    return readApyCache()?.usdc ?? FALLBACK_USDC_APY;
  }
}

export async function buildDepositPTB(
  suiClient: SuiJsonRpcClient,
  sender: string,
  amount: bigint,
): Promise<{
  tx: Transaction;
  sSUIArg: TransactionObjectArgument | null;
}> {
  const builder = await getScallopBuilder(suiClient);
  const scallopTx = builder.createTxBlock();
  scallopTx.setSender(sender);

  try {
    const sSUIResult = await scallopTx.depositQuick(
      Number(amount),
      "sui",
      true,
    );
    return {
      tx: scallopTx.txBlock,
      sSUIArg: sSUIResult as TransactionObjectArgument | null,
    };
  } catch (err) {
    console.error("depositQuick failed:", err);
    throw err;
  }
}

export async function buildWithdrawPTB(
  suiClient: SuiJsonRpcClient,
  sender: string,
  sSUIObjectId: string,
): Promise<Transaction> {
  const builder = await getScallopBuilder(suiClient);
  const scallopTx = builder.createTxBlock();
  scallopTx.setSender(sender);

  const sSUICoin = scallopTx.object(sSUIObjectId);
  const suiCoin = scallopTx.withdraw(sSUICoin, "sui");
  scallopTx.transferObjects([suiCoin], sender);

  return scallopTx.txBlock;
}
