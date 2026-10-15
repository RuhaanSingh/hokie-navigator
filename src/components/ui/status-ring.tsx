"use client";

// Adapted from 21st.dev "AI Tool Call" (educalvolpz) status badge: one ring that changes behaviour
// (spins while running, draws a check when done, a cross on error), restyled to Hokie Navigator tokens.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { StepStatus } from "@/lib/types";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const CHECK = "M 8.5 12.2 L 11 14.8 L 15.8 9.6";
const CROSS = ["M 9 9 L 15 15", "M 15 9 L 9 15"] as const;
const BLOCK = "M 8.6 12 L 15.4 12";

const COLOR: Record<StepStatus, string> = {
  running: "var(--primary)",
  done: "var(--success)",
  error: "var(--danger)",
  blocked: "var(--warning)",
};

export function StatusRing({ status, size = 16 }: { status: StepStatus; size?: number }) {
  const reduce = Boolean(useReducedMotion());
  const running = status === "running";
  const color = COLOR[status];
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <svg className="overflow-visible" width={size} height={size} viewBox="0 0 24 24">
        <motion.g
          animate={reduce || !running ? { rotate: 0 } : { rotate: 360 }}
          style={{ transformBox: "view-box", transformOrigin: "center" }}
          transition={running ? { duration: 0.9, ease: "linear", repeat: Infinity } : { duration: 0 }}
        >
          <motion.circle
            cx={12}
            cy={12}
            r={8.5}
            fill="none"
            pathLength={1}
            strokeLinecap="round"
            strokeWidth={2.2}
            animate={{ stroke: color, strokeDasharray: running ? "0.68 0.32" : "1 0" }}
            transition={reduce ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT }}
          />
        </motion.g>
        <AnimatePresence initial={false}>
          {status === "done" && (
            <motion.path key="c" d={CHECK} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT }} />
          )}
          {status === "error" &&
            CROSS.map((d, i) => (
              <motion.path key={d} d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ delay: reduce ? 0 : i * 0.06, duration: reduce ? 0 : 0.16 }} />
            ))}
          {status === "blocked" && <motion.path key="b" d={BLOCK} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.18 }} />}
        </AnimatePresence>
      </svg>
    </span>
  );
}
