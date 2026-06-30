"use client";

export const SUISEND_PACKAGE_ID =
  "0x837811a8e28aab9c0d5ca9b369aa1da1e178de3e4c1a1c6f33dbf025738ee852";
export const PAYMENT_BOOK_ID =
  "0x4889941e6073c7e3bebc602c1a09ebc014c64a2b9137569a20100ece0219bafd";
export const YIELD_VAULT_ID =
  "0x19fd7e20ab2f2d83d5ae31b36821fc4d357d5c6da6032ee291798acce338719f";

export const SCALLOP_YIELD_VAULT_ID =
  "0x4ef1d47e179884387b70d780ae33ca4cc2f0d55d1cd13d17a5be772bf01f24cb";
export const ADMIN_CAP_ID =
  "0x80d507ca0f2ad8baa02ac10445a5898fa2a44b88818d3e1b3d9134f59eb80f2b";
export const YIELD_ROUTER_CAP_ID =
  "0xb0c4c042f24d9bed50e57fecc5e65417c7fe6e942d115e3e01db71276ec2a4f5";
export const REFUND_AGENT_CAP_ID =
  "0xb3599dd6d6f63de71b99b3e5747e33f0445eb29306fa30a0bf76463b0557a7a4";
export const UPGRADE_CAP_ID =
  "0xc72edb6cfed2183e066bb02f169c6e1fbdc336a2cd745819c0123cea1bed1933";

export const SCALLOP_VERSION_ID =
  "0x07871c4b3c847a0f674510d4978d5cf6f960452795e8ff6f189fd2088a3f6ac7";
export const SCALLOP_MARKET_ID =
  "0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061939d9";
export const SCALLOP_ADDRESS_ID = "67c44a103fe1b8c454eb9699";

export const NETWORK = "mainnet" as const;

export const SUI_DECIMALS = 9;
export const SUI_PER_MIST = 1_000_000_000;

export const USDC_DECIMALS = 6;
export const USDC_PER_UNIT = 1_000_000;

export const USDC_COIN_TYPE =
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

export const SCALLOP_YIELD_VAULT_USDC_ID =
  "0x0d78f124d69b13b9d3deba0d9c9711499ca8ad0fa23dd9140f9aed26ba0cf6cb";

export const EXPIRY_DAYS = 14;
export const EXPIRY_MS = EXPIRY_DAYS * 86400 * 1000;

export const COIN_TYPE_SUI = 0;
export const COIN_TYPE_USDC = 1;

export function mistToSui(mist: bigint): number {
  return Number(mist) / SUI_PER_MIST;
}

export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * SUI_PER_MIST));
}

export function mistToUsdc(mist: bigint): number {
  return Number(mist) / USDC_PER_UNIT;
}

export function usdcToMist(usdc: number): bigint {
  return BigInt(Math.round(usdc * USDC_PER_UNIT));
}

export function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}
