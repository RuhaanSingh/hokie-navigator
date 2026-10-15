import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/types";

const tones: Record<Tone | "neutral" | "primary", string> = {
  ok: "bg-[#f0fdf4] text-success border-[#bbf7d0]",
  warn: "bg-[#fffbeb] text-warning border-[#fde68a]",
  bad: "bg-[#fef2f2] text-danger border-[#fecaca]",
  unknown: "bg-surface text-muted border-border",
  neutral: "bg-surface text-text border-border",
  primary: "bg-primary-tint text-primary border-[#f6cdd5]",
};

export function Badge({ tone = "neutral", className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium leading-5", tones[tone], className)} {...p} />;
}
