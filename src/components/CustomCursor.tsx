"use client";

import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      el.style.translate = `${e.clientX}px ${e.clientY}px`;
    };

    const onLeave = () => el.style.setProperty("opacity", "0");
    const onEnter = () => el.style.setProperty("opacity", "1");

    addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);

    return () => {
      removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      aria-hidden
      className="custom-cursor"
    >
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9.5" stroke="white" strokeWidth="1.5" />
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="white"
          strokeWidth="1"
          strokeDasharray="1.2 2"
          opacity="0.6"
        />
        <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="0.6" opacity="0.25" />
        <text
          x="12"
          y="15.5"
          textAnchor="middle"
          fill="white"
          fontSize="11"
          fontWeight="700"
          fontFamily="Space Grotesk, sans-serif"
          letterSpacing="-0.5"
        >
          S
        </text>
      </svg>
    </div>
  );
}
