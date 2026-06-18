"use client";

import { useEffect, useState, useRef } from "react";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SUISEND_PACKAGE_ID } from "./constants";

export interface LivePaymentEvent {
  digest: string;
  timestamp: number;
  sender: string;
  amount: string;
  linkHash: string;
}

export function useLivePaymentEvents(suiClient: SuiJsonRpcClient | null) {
  const [events, setEvents] = useState<LivePaymentEvent[]>([]);
  const seen = useRef(new Set<string>());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!suiClient) return;

    const fetchEvents = async () => {
      try {
        const result = await suiClient.queryEvents({
          query: {
            MoveEventType: `${SUISEND_PACKAGE_ID}::core::PaymentCreatedEvent`,
          },
          limit: 20,
          order: "descending",
        });

        const fresh: LivePaymentEvent[] = [];
        for (const e of result.data) {
          if (seen.current.has(e.id.txDigest)) continue;
          seen.current.add(e.id.txDigest);
          const parsed = e.parsedJson as Record<string, unknown> | null;
          if (!parsed) continue;
          const amountVal = Number(parsed.amount ?? 0);
          const suiAmount = amountVal / 1e9;
          const amount =
            suiAmount >= 1000
              ? suiAmount.toFixed(0) + " SUI"
              : suiAmount >= 1
                ? suiAmount.toFixed(2) + " SUI"
                : suiAmount >= 0.01
                  ? suiAmount.toFixed(4) + " SUI"
                  : suiAmount.toFixed(6) + " SUI";
          fresh.push({
            digest: e.id.txDigest,
            timestamp: Number(parsed.created_at ?? 0),
            sender: parsed.sender as string,
            amount,
            linkHash: parsed.link_hash as string,
          });
        }

        if (fresh.length > 0) {
          setEvents((prev) => {
            const merged = [...fresh, ...prev];
            return merged.slice(0, 50);
          });
        }
      } catch (err) {
        console.error("useLivePaymentEvents error:", err);
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
        const result = await suiClient.queryEvents({
          query: {
            MoveEventType: `${SUISEND_PACKAGE_ID}::core::PaymentCreatedEvent`,
          },
          limit: 100,
          order: "descending",
        });

        let vol = 0;
        const senders = new Set<string>();
        for (const e of result.data) {
          const parsed = e.parsedJson as Record<string, unknown> | null;
          if (!parsed) continue;
          vol += Number(parsed.amount ?? 0) / 1e9;
          senders.add(parsed.sender as string);
        }

        setTotalPayments(result.data.length);
        setTotalVolume(vol);
        setUniqueSenders(senders.size);
        setLoading(false);
      } catch (err) {
        console.error("useLiveStats error:", err);
        setLoading(false);
      }
    };

    fetchStats();
    const id = setInterval(fetchStats, 60_000);
    return () => clearInterval(id);
  }, [suiClient]);

  return { totalPayments, totalVolume, uniqueSenders, loading };
}
