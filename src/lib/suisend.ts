"use client";

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
}

export interface ClaimRecord {
  id: string;
  linkHash: string;
  claimer: string;
  amount: string;
  yieldEarned: string;
  claimedAt: number;
}

const APY_BPS = 820;
const BPS_DENOM = 10000;
const DAY_MS = 86400000;
const EXPIRY_DAYS = 14;
const MS_IN_YEAR = 365 * DAY_MS;

function randomHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function calcYield(amount: number, elapsedMs: number): number {
  return (amount * APY_BPS * elapsedMs) / MS_IN_YEAR / BPS_DENOM;
}

function formatSui(val: number): string {
  if (val >= 1000) return val.toFixed(0);
  if (val >= 1) return val.toFixed(2);
  if (val >= 0.01) return val.toFixed(4);
  return val.toFixed(6);
}

export function formatYield(val: number): string {
  if (val >= 1) return val.toFixed(4);
  if (val >= 0.001) return val.toFixed(6);
  return val.toFixed(8);
}

const paymentStore: PaymentLink[] = [
  {
    id: "demo1",
    linkHash: "0x4f2a1b3c8d9e0f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3",
    sender: "0xabc...def",
    amount: "100.00 SUI",
    numericAmount: 100,
    note: "For the Lagos trip",
    status: "pending",
    yieldEarned: "0.0000457",
    createdAt: Date.now() - 3 * DAY_MS,
    expiresAt: Date.now() + 11 * DAY_MS,
    claimUrl: "suisend.app/claim/0x4f2a...c91",
  },
  {
    id: "demo2",
    linkHash: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    sender: "0xabc...def",
    amount: "25.50 SUI",
    numericAmount: 25.5,
    note: "Birthday gift 🎂",
    status: "claimed",
    yieldEarned: "0.0012483",
    createdAt: Date.now() - 10 * DAY_MS,
    expiresAt: Date.now() + 4 * DAY_MS,
    claimUrl: "suisend.app/claim/0xa1b2...a1b",
    claimedAt: Date.now() - 6 * DAY_MS,
  },
  {
    id: "demo3",
    linkHash: "0xdeadbeefcafe1234567890abcdef1234567890abcdef1234567890abcdef12345678",
    sender: "0x789...ghi",
    amount: "500.00 SUI",
    numericAmount: 500,
    note: "Consulting fees",
    status: "refunded",
    yieldEarned: "0.3245678",
    createdAt: Date.now() - 20 * DAY_MS,
    expiresAt: Date.now() - 6 * DAY_MS,
    claimUrl: "suisend.app/claim/0xdead...5678",
  },
  {
    id: "demo4",
    linkHash: "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff0001",
    sender: "0xabc...def",
    amount: "10.00 SUI",
    numericAmount: 10,
    note: "Coffee run ☕",
    status: "pending",
    yieldEarned: "0.0000192",
    createdAt: Date.now() - 1 * DAY_MS,
    expiresAt: Date.now() + 13 * DAY_MS,
    claimUrl: "suisend.app/claim/0x1111...0001",
  },
];

const claimStore: ClaimRecord[] = [
  {
    id: "c1",
    linkHash: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    claimer: "0x456...jkl",
    amount: "25.50 SUI",
    yieldEarned: "0.0012483",
    claimedAt: Date.now() - 6 * DAY_MS,
  },
];

export function getDemoSender(): string {
  return "0xabc...def";
}

export function getMyPayments(address: string): PaymentLink[] {
  const userPayments = paymentStore.filter(
    (p) => p.sender.toLowerCase() === address.toLowerCase(),
  );
  return userPayments;
}

export function getMyClaims(address: string): ClaimRecord[] {
  return claimStore.filter(
    (c) => c.claimer.toLowerCase() === address.toLowerCase(),
  );
}

export function getAllPayments(): PaymentLink[] {
  return [...paymentStore];
}

export function findPaymentByHash(hash: string): PaymentLink | undefined {
  return paymentStore.find((p) => p.linkHash.includes(hash));
}

export function getPendingCount(): number {
  return paymentStore.filter((p) => p.status === "pending").length;
}

export function getTotalYieldAccrued(): number {
  return paymentStore.reduce((sum, p) => sum + parseFloat(p.yieldEarned || "0"), 0);
}

export function getTotalVolume(): number {
  return paymentStore.reduce((sum, p) => sum + p.numericAmount, 0);
}

export function createPaymentLink(
  sender: string,
  amount: number,
  note: string,
): PaymentLink {
  const hash = randomHash();
  const shortHash = hash.substring(0, 10) + "..." + hash.substring(hash.length - 6);
  const now = Date.now();
  const link: PaymentLink = {
    id: genId(),
    linkHash: hash,
    sender,
    amount: `${formatSui(amount)} SUI`,
    numericAmount: amount,
    note,
    status: "pending",
    yieldEarned: "0",
    createdAt: now,
    expiresAt: now + EXPIRY_DAYS * DAY_MS,
    claimUrl: `suisend.app/claim/${shortHash}`,
  };
  paymentStore.push(link);
  return link;
}

export function claimPayment(
  claimer: string,
  hash: string,
): { success: boolean; payment?: PaymentLink; error?: string } {
  const payment = paymentStore.find(
    (p) => p.linkHash.includes(hash) && p.status === "pending",
  );
  if (!payment) {
    return { success: false, error: "Payment not found or already claimed" };
  }
  const elapsed = Date.now() - payment.createdAt;
  const yieldVal = calcYield(payment.numericAmount, elapsed);
  const yieldStr = formatYield(yieldVal);

  payment.status = "claimed";
  payment.yieldEarned = yieldStr;
  payment.claimedAt = Date.now();
  payment.amount = `${formatSui(payment.numericAmount + yieldVal)} SUI`;

  claimStore.push({
    id: genId(),
    linkHash: payment.linkHash,
    claimer,
    amount: payment.amount,
    yieldEarned: yieldStr,
    claimedAt: Date.now(),
  });

  return { success: true, payment };
}

export function simulateYieldAccrual(amount: number, elapsedMs: number): number {
  return calcYield(amount, elapsedMs);
}
