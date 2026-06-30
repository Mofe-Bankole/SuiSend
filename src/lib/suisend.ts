"use client";

import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex, normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import {
  SUISEND_PACKAGE_ID,
  PAYMENT_BOOK_ID,
  SCALLOP_YIELD_VAULT_ID,
  SCALLOP_YIELD_VAULT_USDC_ID,
  SCALLOP_VERSION_ID,
  SCALLOP_MARKET_ID,
  EXPIRY_DAYS,
  COIN_TYPE_USDC,
  USDC_COIN_TYPE,
  formatAmount,
  mistToUnits,
  coinLabel,
} from "./constants";
import { getAppUrl } from "./url";

export type PaymentStatus = "pending" | "claimed" | "refunded" | "expired";

export interface PaymentLink {
  id: string;
  linkHash: string;
  sender: string;
  amount: string;
  numericAmount: number;
  coinType: number;
  note: string;
  status: PaymentStatus;
  yieldEarned: string;
  createdAt: number;
  expiresAt: number;
  claimUrl: string;
  claimedAt?: number;
  walrusBlobId?: string;
}

export interface ClaimRecord {
  id: string;
  linkHash: string;
  claimer: string;
  amount: string;
  yieldEarned: string;
  claimedAt: number;
  coinType: number;
}

const CLOCK_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000006";

export function randomHashHex(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + toHex(bytes);
}

export function buildCreatePaymentScallopPTB(params: {
  amount: bigint;
  linkHashHex: string;
  noteBlobIdHex?: string;
  expiryOffsetMs?: number;
}): Transaction {
  const tx = new Transaction();
  tx.setGasBudgetIfNotSet(BigInt(20000000));
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(params.amount)]);

  const noteBlobId = params.noteBlobIdHex
    ? tx.pure.option(
        "vector<u8>",
        Array.from(fromHex(params.noteBlobIdHex.replace("0x", ""))),
      )
    : tx.pure.option("vector<u8>", []);

  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::create_payment_scallop`,
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.object(SCALLOP_YIELD_VAULT_ID),
      coin,
      tx.pure.vector(
        "u8",
        Array.from(fromHex(params.linkHashHex.replace("0x", ""))),
      ),
      noteBlobId,
      tx.pure.u64(params.expiryOffsetMs ?? EXPIRY_DAYS * 86400 * 1000),
      tx.object(SCALLOP_VERSION_ID),
      tx.object(SCALLOP_MARKET_ID),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
}

export function buildClaimPaymentScallopPTB(linkHashHex: string): Transaction {
  const tx = new Transaction();
  tx.setGasBudgetIfNotSet(BigInt(20000000));
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::claim_payment_scallop`,
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.object(SCALLOP_YIELD_VAULT_ID),
      tx.pure.vector("u8", Array.from(fromHex(linkHashHex.replace("0x", "")))),
      tx.object(SCALLOP_VERSION_ID),
      tx.object(SCALLOP_MARKET_ID),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export interface PaymentLookup {
  exists: boolean;
  amount?: bigint;
  expiry?: bigint;
  state?: number;
  sender?: string;
  coinType?: number;
}

function decodeBool(bytes: Uint8Array): boolean {
  return bytes[0] === 1;
}

function decodeU64(bytes: Uint8Array): bigint {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(0, true);
}

function decodeU8(bytes: Uint8Array): number {
  return bytes[0];
}

function decodeAddress(bytes: Uint8Array): string {
  return "0x" + toHex(bytes);
}

export async function lookupPayment(
  suiClient: SuiJsonRpcClient,
  linkHashHex: string,
): Promise<PaymentLookup> {
  const linkHashBytes = fromHex(linkHashHex.replace("0x", ""));
  const dummySender =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  const tx = new Transaction();
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_exists`,
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.pure.vector("u8", Array.from(linkHashBytes)),
    ],
  });
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_amount`,
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.pure.vector("u8", Array.from(linkHashBytes)),
    ],
  });
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_expiry`,
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.pure.vector("u8", Array.from(linkHashBytes)),
    ],
  });
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_state`,
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.pure.vector("u8", Array.from(linkHashBytes)),
    ],
  });
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_sender`,
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.pure.vector("u8", Array.from(linkHashBytes)),
    ],
  });
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_coin_type`,
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.pure.vector("u8", Array.from(linkHashBytes)),
    ],
  });

  try {
    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: dummySender,
    });

    if (!result.results) return { exists: false };

    const bytes0 = result.results[0]?.returnValues?.[0]?.[0];
    const exists = bytes0 ? decodeBool(new Uint8Array(bytes0)) : false;

    if (!exists) return { exists: false };

    const bytes1 = result.results[1]?.returnValues?.[0]?.[0];
    const bytes2 = result.results[2]?.returnValues?.[0]?.[0];
    const bytes3 = result.results[3]?.returnValues?.[0]?.[0];
    const bytes4 = result.results[4]?.returnValues?.[0]?.[0];
    const bytes5 = result.results[5]?.returnValues?.[0]?.[0];

    return {
      exists: true,
      amount: bytes1 ? decodeU64(new Uint8Array(bytes1)) : undefined,
      expiry: bytes2 ? decodeU64(new Uint8Array(bytes2)) : undefined,
      state: bytes3 ? decodeU8(new Uint8Array(bytes3)) : undefined,
      sender: bytes4 ? decodeAddress(new Uint8Array(bytes4)) : undefined,
      coinType: bytes5 ? decodeU8(new Uint8Array(bytes5)) : undefined,
    };
  } catch (e) {
    console.error("lookupPayment error:", e);
    return { exists: false };
  }
}

async function batchCheckPaymentStates(
  suiClient: SuiJsonRpcClient,
  linkHashes: string[],
): Promise<Map<string, { state: number; exists: boolean }>> {
  if (linkHashes.length === 0) return new Map();

  const dummySender =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const map = new Map<string, { state: number; exists: boolean }>();

  const tx = new Transaction();
  for (const hash of linkHashes) {
    const bytes = fromHex(hash.replace("0x", ""));
    tx.moveCall({
      target: `${SUISEND_PACKAGE_ID}::core::payment_exists`,
      arguments: [
        tx.object(PAYMENT_BOOK_ID),
        tx.pure.vector("u8", Array.from(bytes)),
      ],
    });
    tx.moveCall({
      target: `${SUISEND_PACKAGE_ID}::core::payment_state`,
      arguments: [
        tx.object(PAYMENT_BOOK_ID),
        tx.pure.vector("u8", Array.from(bytes)),
      ],
    });
  }

  try {
    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: dummySender,
    });

    if (!result.results) return map;

    for (let i = 0; i < linkHashes.length; i++) {
      const existsBytes = result.results[i * 2]?.returnValues?.[0]?.[0];
      const stateBytes = result.results[i * 2 + 1]?.returnValues?.[0]?.[0];
      const exists = existsBytes
        ? decodeBool(new Uint8Array(existsBytes))
        : false;
      const state = stateBytes ? decodeU8(new Uint8Array(stateBytes)) : 0;
      map.set(linkHashes[i], { state, exists });
    }
  } catch (e) {
    console.warn("batchCheckPaymentStates error:", e);
  }

  return map;
}

async function batchCheckPaymentCoinTypes(
  suiClient: SuiJsonRpcClient,
  linkHashes: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (linkHashes.length === 0) return map;

  const dummySender =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  const tx = new Transaction();
  for (const hash of linkHashes) {
    const bytes = fromHex(hash.replace("0x", ""));
    tx.moveCall({
      target: `${SUISEND_PACKAGE_ID}::core::payment_coin_type`,
      arguments: [
        tx.object(PAYMENT_BOOK_ID),
        tx.pure.vector("u8", Array.from(bytes)),
      ],
    });
  }

  try {
    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: dummySender,
    });
    if (!result.results) return map;

    for (let i = 0; i < linkHashes.length; i++) {
      const bytes = result.results[i]?.returnValues?.[0]?.[0];
      map.set(linkHashes[i], bytes ? decodeU8(new Uint8Array(bytes)) : 0);
    }
  } catch (e) {
    console.warn("batchCheckPaymentCoinTypes error:", e);
  }

  return map;
}

export function buildCreatePaymentGenericPTB(params: {
  amount: bigint;
  linkHashHex: string;
  noteBlobIdHex?: string;
  expiryOffsetMs?: number;
  vaultId: string;
  coinType: string;
  coinTypeId: number;
  coinObjectId: string;
}): Transaction {
  const tx = new Transaction();
  tx.setGasBudgetIfNotSet(BigInt(20000000));

  const coin = tx.object(params.coinObjectId);
  const [paymentCoin] = tx.splitCoins(coin, [tx.pure.u64(params.amount)]);

  const noteBlobId = params.noteBlobIdHex
    ? tx.pure.option(
        "vector<u8>",
        Array.from(fromHex(params.noteBlobIdHex.replace("0x", ""))),
      )
    : tx.pure.option("vector<u8>", []);

  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::create_payment_generic`,
    typeArguments: [params.coinType],
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.object(params.vaultId),
      paymentCoin,
      tx.pure.vector(
        "u8",
        Array.from(fromHex(params.linkHashHex.replace("0x", ""))),
      ),
      noteBlobId,
      tx.pure.u64(params.expiryOffsetMs ?? EXPIRY_DAYS * 86400 * 1000),
      tx.pure.u8(params.coinTypeId),
      tx.object(SCALLOP_VERSION_ID),
      tx.object(SCALLOP_MARKET_ID),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
}

export function buildClaimPaymentGenericPTB(params: {
  linkHashHex: string;
  vaultId: string;
  coinType: string;
}): Transaction {
  const tx = new Transaction();
  tx.setGasBudgetIfNotSet(BigInt(20000000));
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::claim_payment_generic`,
    typeArguments: [params.coinType],
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.object(params.vaultId),
      tx.pure.vector(
        "u8",
        Array.from(fromHex(params.linkHashHex.replace("0x", ""))),
      ),
      tx.object(SCALLOP_VERSION_ID),
      tx.object(SCALLOP_MARKET_ID),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function buildCreatePaymentUSDCPTB(params: {
  amount: bigint;
  linkHashHex: string;
  noteBlobIdHex?: string;
  expiryOffsetMs?: number;
  coinObjectId: string;
}): Transaction {
  return buildCreatePaymentGenericPTB({
    ...params,
    vaultId: SCALLOP_YIELD_VAULT_USDC_ID,
    coinType: USDC_COIN_TYPE,
    coinTypeId: COIN_TYPE_USDC,
  });
}

export function buildClaimPaymentUSDCPTB(linkHashHex: string): Transaction {
  return buildClaimPaymentGenericPTB({
    linkHashHex,
    vaultId: SCALLOP_YIELD_VAULT_USDC_ID,
    coinType: USDC_COIN_TYPE,
  });
}

export async function queryUserSentPayments(
  suiClient: SuiJsonRpcClient,
  address: string,
): Promise<PaymentLink[]> {
  const eventResult = await suiClient.queryEvents({
    query: {
      MoveEventType: `${SUISEND_PACKAGE_ID}::core::PaymentCreatedEvent`,
    },
    limit: 50,
  });

  const rawPayments = eventResult.data
    .filter((e) => {
      const parsed = e.parsedJson as Record<string, unknown> | null;
      if (!parsed?.sender) return false;
      return (
        normalizeSuiAddress(parsed.sender as string) ===
        normalizeSuiAddress(address)
      );
    })
    .map((e) => {
      const parsed = e.parsedJson as Record<string, unknown>;
      const rawLinkHash = parsed.link_hash;
      const linkHash = Array.isArray(rawLinkHash)
        ? "0x" + toHex(new Uint8Array(rawLinkHash as number[]))
        : (rawLinkHash as string) || "";
      return { event: e, parsed, linkHash };
    });

  const claimedAtMap = new Map<string, number>();

  try {
    const claimedEvents = await suiClient.queryEvents({
      query: {
        MoveEventType: `${SUISEND_PACKAGE_ID}::core::PaymentClaimedEvent`,
      },
      limit: 50,
    });
    for (const ev of claimedEvents.data) {
      const p = ev.parsedJson as Record<string, unknown> | null;
      if (!p) continue;
      const rawHash = p.link_hash;
      const evHash = Array.isArray(rawHash)
        ? "0x" + toHex(new Uint8Array(rawHash as number[]))
        : (rawHash as string) || "";
      const claimedTs = Number(p.claimed_at ?? 0);
      if (evHash && claimedTs) claimedAtMap.set(evHash, claimedTs);
    }
  } catch (e) {
    console.warn("query sent: failed to fetch claimed events", e);
  }

  const linkHashes = rawPayments.map((p) => p.linkHash);

  const [stateMap, coinTypeMap] = await Promise.all([
    batchCheckPaymentStates(suiClient, linkHashes),
    batchCheckPaymentCoinTypes(suiClient, linkHashes),
  ]);

  const PAYMENT_STATE: Record<number, PaymentStatus> = {
    0: "pending",
    1: "claimed",
    2: "refunded",
    3: "expired",
  };

  return rawPayments.map(({ event: e, parsed, linkHash }) => {
    const amount = Number(parsed.amount ?? 0);
    const createdAt = Number(parsed.created_at ?? 0);
    const expiry = Number(parsed.expiry ?? 0);
    const coinType = coinTypeMap.get(linkHash) ?? 0;

    const checked = stateMap.get(linkHash);
    let status: PaymentStatus;
    if (!checked || !checked.exists) {
      status = "claimed";
    } else {
      status = PAYMENT_STATE[checked.state] ?? "pending";
    }

    return {
      id: e.id.txDigest,
      linkHash,
      sender: (parsed.sender as string) ?? "",
      amount: formatAmount(amount, coinType),
      numericAmount: mistToUnits(amount, coinType),
      coinType,
      note: "",
      status,
      yieldEarned: "0",
      createdAt,
      expiresAt: expiry,
      claimUrl: `${getAppUrl()}/claim/${linkHash}`,
      claimedAt: claimedAtMap.get(linkHash) || undefined,
    };
  });
}

export async function queryUserClaimReceipts(
  suiClient: SuiJsonRpcClient,
  address: string,
): Promise<ClaimRecord[]> {
  const objects = await suiClient.getOwnedObjects({
    owner: address,
    filter: { StructType: `${SUISEND_PACKAGE_ID}::core::ClaimReceipt` },
    limit: 50,
  });

  const claims: ClaimRecord[] = [];
  const linkHashes: string[] = [];

  for (const obj of objects.data) {
    if (!obj.data?.objectId) continue;
    const receipt = await suiClient.getObject({
      id: obj.data.objectId,
      options: { showContent: true },
    });
    const content = receipt.data?.content;
    if (content?.dataType !== "moveObject") continue;
    const fields = content.fields as Record<string, unknown>;
    const rawLinkHash = fields.payment_link_hash;
    const linkHash = Array.isArray(rawLinkHash)
      ? "0x" + toHex(new Uint8Array(rawLinkHash as number[]))
      : (rawLinkHash as string) || "";
    linkHashes.push(linkHash);
    claims.push({
      id: obj.data.objectId,
      linkHash,
      claimer: (fields.recipient as string) ?? "",
      amount: String(fields.total_claimed ?? 0),
      yieldEarned: String(fields.yield_earned ?? 0),
      claimedAt: Number(fields.claimed_at ?? 0),
      coinType: 0,
    });
  }

  const coinTypeMap = await batchCheckPaymentCoinTypes(suiClient, linkHashes);

  for (const claim of claims) {
    const coinType = coinTypeMap.get(claim.linkHash) ?? 0;
    claim.coinType = coinType;
    claim.amount = formatAmount(Number(claim.amount), coinType);
    claim.yieldEarned = formatAmount(Number(claim.yieldEarned), coinType);
  }

  return claims;
}

export interface PaymentStats {
  totalPayments: number;
  totalVolumeMist: number;
}

export async function queryPaymentStats(
  suiClient: SuiJsonRpcClient,
): Promise<PaymentStats> {
  let totalPayments = 0;
  let totalVolumeMist = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = null;
  let hasMore = true;

  while (hasMore) {
    const result = await suiClient.queryEvents({
      query: {
        MoveEventType: `${SUISEND_PACKAGE_ID}::core::PaymentCreatedEvent`,
      },
      limit: 100,
      cursor: cursor ?? undefined,
    });

    for (const ev of result.data) {
      const p = ev.parsedJson as Record<string, unknown> | null;
      if (!p) continue;
      totalPayments++;
      totalVolumeMist += Number(p.amount ?? 0);
    }

    cursor = result.nextCursor ?? null;
    hasMore = result.hasNextPage;
  }

  return { totalPayments, totalVolumeMist };
}

export function formatYield(val: number): string {
  if (val >= 1) return val.toFixed(4);
  if (val >= 0.001) return val.toFixed(6);
  return val.toFixed(8);
}
