"use client";

// Adapted from 21st.dev "Animated Beam" (dillionverma / Magic UI), restyled for Hokie Navigator:
// hairline grey paths, red pulse only while a call is passing through (`active`).
import { type RefObject, useEffect, useId, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface AnimatedBeamProps {
  className?: string;
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  curvature?: number;
  reverse?: boolean;
  active?: boolean;
  tone?: "ok" | "blocked" | "error";
  duration?: number;
  startYOffset?: number;
  endYOffset?: number;
}

const TONE = { ok: "#C8102E", blocked: "#B45309", error: "#B91C1C" };

export function AnimatedBeam({ className, containerRef, fromRef, toRef, curvature = 0, reverse = false, active = false, tone = "ok", duration = 1.4, startYOffset = 0, endYOffset = 0 }: AnimatedBeamProps) {
  const id = useId();
  const [d, setD] = useState("");
  const [dim, setDim] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => {
      if (!containerRef.current || !fromRef.current || !toRef.current) return;
      const c = containerRef.current.getBoundingClientRect();
      const a = fromRef.current.getBoundingClientRect();
      const b = toRef.current.getBoundingClientRect();
      setDim({ w: c.width, h: c.height });
      const sx = a.left - c.left + a.width / 2;
      const sy = a.top - c.top + a.height / 2 + startYOffset;
      const ex = b.left - c.left + b.width / 2;
      const ey = b.top - c.top + b.height / 2 + endYOffset;
      setD(`M ${sx},${sy} Q ${(sx + ex) / 2},${(sy + ey) / 2 - curvature} ${ex},${ey}`);
    };
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    update();
    return () => ro.disconnect();
  }, [containerRef, fromRef, toRef, curvature, startYOffset, endYOffset]);

  const coords = reverse ? { x1: ["90%", "-10%"], x2: ["100%", "0%"] } : { x1: ["10%", "110%"], x2: ["0%", "100%"] };
  const color = TONE[tone];

  return (
    <svg fill="none" width={dim.w} height={dim.h} viewBox={`0 0 ${dim.w} ${dim.h}`} className={cn("pointer-events-none absolute left-0 top-0", className)} aria-hidden>
      <path d={d} stroke={active ? (tone === "ok" ? "#F2B8C1" : tone === "blocked" ? "#FCD34D" : "#FCA5A5") : "#D6D3D1"} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" style={{ transition: "stroke 300ms" }} />
      {active && (
        <>
          <path d={d} strokeWidth={2.5} stroke={`url(#${id})`} strokeLinecap="round" />
          <defs>
            <motion.linearGradient
              id={id}
              gradientUnits="userSpaceOnUse"
              initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
              animate={{ x1: coords.x1, x2: coords.x2, y1: ["0%", "0%"], y2: ["0%", "0%"] }}
              transition={{ duration, ease: [0.16, 1, 0.3, 1], repeat: Infinity }}
            >
              <stop stopColor={color} stopOpacity="0" />
              <stop stopColor={color} />
              <stop offset="32.5%" stopColor={color} />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </>
      )}
    </svg>
  );
}
