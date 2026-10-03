"use client";

import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { getScallopApy } from "@/lib/scallop";
import Reveal from "./Reveal";
import SectionHead from "./SectionHead";

const steps = [
  {
    title: "Create a payment link",
    desc: "Connect your Sui wallet, enter an amount. One transaction deposits your funds directly into Scallop's lending pool and generates a shareable claim link.",
    aside: null,
  },
  {
    title: "It earns the whole wait",
    desc: "While unclaimed, your funds stay in the pool earning the live rate. Yield accrues in real time — the longer they wait, the more they receive.",
    aside: "apy",
  },
  {
    title: "They claim everything",
    desc: "One click and the recipient gets your original amount plus all interest accrued. Changed your mind? You can take an unclaimed link back — yield included.",
    aside: null,
  },
];

export default function HowItWorks() {
  const suiClient = useSuiClient();
  const [apy, setApy] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScallopApy(suiClient)
      .then((v) => {
        if (!cancelled) setApy(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [suiClient]);

  return (
    <div
      className="section-wrap mx-auto max-w-[1200px] px-12 py-[120px] max-md:px-6"
      id="how"
    >
      <SectionHead
        index={1}
        of={5}
        label="How it works"
        title={
          <>
            Three steps.
            <br />
            No idle money.
          </>
        }
      />

      <div className="steps">
        {steps.map((step, i) => (
          <Reveal key={step.title} delay={i === 1 ? "rd1" : i === 2 ? "rd2" : undefined}>
            <div className="step">
              <div className="step-index">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <div className="step-title">{step.title}</div>
                <p className="step-desc">{step.desc}</p>
                {step.aside === "apy" && (
                  <div className="mock-yield mt-6 max-w-[340px]">
                    <span className="mock-yield-l">
                      Live Scallop SUI supply APY
                    </span>
                    <span className="mock-yield-r">
                      {apy === null ? "…" : `${apy.toFixed(2)}%`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
