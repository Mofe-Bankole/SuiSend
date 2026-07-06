"use client";

import { useEffect, useState, useRef } from "react";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SUISEND_ALL_PACKAGE_IDS, SUI_PER_MIST } from "./constants";

export interface LivePaymentEvent {
  digest: string;
  timestamp: number;
  sender: string;
  amount: string;
  linkHash: string;
}

function formatSui(mist: number): string {
  const val = mist / SUI_PER_MIST;
  if (val >= 1000) return val.toFixed(0) + " SUI";
  if (val >= 1) return val.toFixed(2) + " SUI";
  if (val >= 0.01) return val.toFixed(4) + " SUI";
  return val.toFixed(6) + " SUI";
}

export function useLivePaymentEvents(suiClient: SuiJsonRpcClient | null) {
  const [events, setEvents] = useState<LivePaymentEvent[]>([]);
  const seen = useRef(new Set<string>());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!suiClient) return;

    const fetchEvents = async () => {
      const fresh: LivePaymentEvent[] = [];
      for (const pkgId of SUISEND_ALL_PACKAGE_IDS) {
        try {
          const result = await suiClient.queryEvents({
            query: { MoveEventType: `${pkgId}::core::PaymentCreatedEvent` },
            limit: 20,
            order: "descending",
          });
          for (const e of result.data) {
            if (seen.current.has(e.id.txDigest)) continue;
            seen.current.add(e.id.txDigest);
            const parsed = e.parsedJson as Record<string, unknown> | null;
            if (!parsed) continue;
            const amountVal = Number(parsed.amount ?? 0);
            fresh.push({
              digest: e.id.txDigest,
              timestamp: Number(parsed.created_at ?? 0),
              sender: parsed.sender as string,
              amount: formatSui(amountVal),
              linkHash: parsed.link_hash as string,
            });
          }
        } catch { /* skip */ }
      }

      if (fresh.length > 0) {
        setEvents((prev) => {
          const merged = [...fresh, ...prev];
          return merged.slice(0, 50);
        });
      }
    };

    fetchEvents();
    intervalRef.current = setInterval(fetchEvents, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [suiClient]);

  return events;
}

export function useLiveStats(suiClient: SuiJsonRpcClient | null) {
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [uniqueSenders, setUniqueSenders] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!suiClient) return;

    const fetchStats = async () => {
      try {
        let allPayments = 0;
        let totalMist = 0;
        const senders = new Set<string>();

        for (const pkgId of SUISEND_ALL_PACKAGE_IDS) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let cursor: any = null;
          let hasMore = true;
          while (hasMore) {
            const result = await suiClient.queryEvents({
              query: { MoveEventType: `${pkgId}::core::PaymentCreatedEvent` },
              limit: 100,
              cursor: cursor ?? undefined,
              order: "descending",
            });
            for (const e of result.data) {
              const parsed = e.parsedJson as Record<string, unknown> | null;
              if (!parsed) continue;
              allPayments++;
              totalMist += Number(parsed.amount ?? 0);
              senders.add(parsed.sender as string);
            }
            cursor = result.nextCursor ?? null;
            hasMore = result.hasNextPage;
          }
        }

        setTotalPayments(allPayments);
        setTotalVolume(totalMist / SUI_PER_MIST);
        setUniqueSenders(senders.size);
      } catch (err) {
        console.error("useLiveStats error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const id = setInterval(fetchStats, 60_000);
    return () => clearInterval(id);
  }, [suiClient]);

  return { totalPayments, totalVolume, uniqueSenders, loading };
}
