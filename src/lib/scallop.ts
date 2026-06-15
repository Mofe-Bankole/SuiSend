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

export async function getScallopApy(suiClient: SuiJsonRpcClient): Promise<number> {
  try {
    const builder = await getScallopBuilder(suiClient);
    const market = await builder.query.queryMarket();
    const suiPool = market.pools.sui;
    if (suiPool) {
      const supplyApy = Number(suiPool.supplyApy) * 100;
      return supplyApy || 8.2;
    }
    return 8.2;
  } catch {
    return 8.2;
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
    return { tx: scallopTx.txBlock, sSUIArg: sSUIResult as TransactionObjectArgument | null };
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
