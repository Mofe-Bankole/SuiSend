"use client";

import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex, normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import {
  SUISEND_PACKAGE_ID,
  PAYMENT_BOOK_ID,
  SCALLOP_YIELD_VAULT_ID,
  SCALLOP_VERSION_ID,
  SCALLOP_MARKET_ID,
  EXPIRY_DAYS,
} from "./constants";
import { getAppUrl } from "./url";

export type PaymentStatus = "pending" | "claimed" | "refunded" | "expired";

export interface PaymentLink {
  id: string;
  linkHash: string;
  sender: string;
  amount: string;
  numericAmount: number;
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
}

const CLOCK_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";

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
    ? tx.pure.option("vector<u8>", Array.from(fromHex(params.noteBlobIdHex.replace("0x", ""))))
    : tx.pure.option("vector<u8>", []);

  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::create_payment_scallop`,
    arguments: [
      tx.object(PAYMENT_BOOK_ID),
      tx.object(SCALLOP_YIELD_VAULT_ID),
      coin,
      tx.pure.vector("u8", Array.from(fromHex(params.linkHashHex.replace("0x", "")))),
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
  const dummySender = "0x0000000000000000000000000000000000000000000000000000000000000000";

  const tx = new Transaction();
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_exists`,
    arguments: [tx.object(PAYMENT_BOOK_ID), tx.pure.vector("u8", Array.from(linkHashBytes))],
  });
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_amount`,
    arguments: [tx.object(PAYMENT_BOOK_ID), tx.pure.vector("u8", Array.from(linkHashBytes))],
  });
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_expiry`,
    arguments: [tx.object(PAYMENT_BOOK_ID), tx.pure.vector("u8", Array.from(linkHashBytes))],
  });
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_state`,
    arguments: [tx.object(PAYMENT_BOOK_ID), tx.pure.vector("u8", Array.from(linkHashBytes))],
  });
  tx.moveCall({
    target: `${SUISEND_PACKAGE_ID}::core::payment_sender`,
    arguments: [tx.object(PAYMENT_BOOK_ID), tx.pure.vector("u8", Array.from(linkHashBytes))],
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

    return {
      exists: true,
      amount: bytes1 ? decodeU64(new Uint8Array(bytes1)) : undefined,
      expiry: bytes2 ? decodeU64(new Uint8Array(bytes2)) : undefined,
      state: bytes3 ? decodeU8(new Uint8Array(bytes3)) : undefined,
      sender: bytes4 ? decodeAddress(new Uint8Array(bytes4)) : undefined,
    };
  } catch (e) {
    console.error("lookupPayment error:", e);
    return { exists: false };
  }
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

  return eventResult.data
    .filter((e) => {
      const parsed = e.parsedJson as Record<string, unknown> | null;
      if (!parsed?.sender) return false;
      return normalizeSuiAddress(parsed.sender as string) === normalizeSuiAddress(address);
    })
    .map((e) => {
      const parsed = e.parsedJson as Record<string, unknown>;
      const amount = Number(parsed.amount ?? 0);
      const createdAt = Number(parsed.created_at ?? 0);
      const expiry = Number(parsed.expiry ?? 0);

      const rawLinkHash = parsed.link_hash;
      const linkHash = Array.isArray(rawLinkHash)
        ? "0x" + toHex(new Uint8Array(rawLinkHash as number[]))
        : (rawLinkHash as string) || "";

      return {
        id: e.id.txDigest,
        linkHash,
        sender: (parsed.sender as string) ?? "",
        amount: formatSui(amount),
        numericAmount: amount / 1e9,
        note: "",
        status: "pending" as PaymentStatus,
        yieldEarned: "0",
        createdAt,
        expiresAt: expiry,
        claimUrl: `${getAppUrl()}/claim/${linkHash}`,
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
    claims.push({
      id: obj.data.objectId,
      linkHash,
      claimer: (fields.recipient as string) ?? "",
      amount: formatSui(Number(fields.total_claimed ?? 0)),
      yieldEarned: formatSui(Number(fields.yield_earned ?? 0)),
      claimedAt: Number(fields.claimed_at ?? 0),
    });
  }
  return claims;
}

function formatSui(val: number): string {
  const sui = val / 1e9;
  if (sui >= 1000) return sui.toFixed(0) + " SUI";
  if (sui >= 1) return sui.toFixed(2) + " SUI";
  if (sui >= 0.01) return sui.toFixed(4) + " SUI";
  return sui.toFixed(6) + " SUI";
}

export function formatYield(val: number): string {
  if (val >= 1) return val.toFixed(4);
  if (val >= 0.001) return val.toFixed(6);
  return val.toFixed(8);
}
