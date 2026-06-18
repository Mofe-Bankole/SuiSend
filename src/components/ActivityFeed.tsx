"use client";

import { useSuiClient } from "@mysten/dapp-kit";
import { useLivePaymentEvents } from "@/lib/usePaymentEvents";
import { shortenAddress } from "@/lib/constants";

export default function ActivityFeed() {
  const suiClient = useSuiClient();
  const events = useLivePaymentEvents(suiClient);

  if (events.length === 0) return null;

  const displayItems = events.slice(0, 12);

  return (
    <div className="marquee-section border-t-0">
      <div className="marquee-fade-l" />
      <div className="marquee-fade-r" />
      <div className="marquee-track">
        {[...displayItems, ...displayItems].map((ev, i) => (
          <div key={`${ev.digest}-${i}`} className="marquee-item">
            <div className="m-dot" />
            <span className="m-addr">{shortenAddress(ev.sender, 4)}</span>{" "}
            sent <span className="m-yield">{ev.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
