"use client";
import { AlertTriangle, Check, ChevronDown, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/utils";

const META = {
  high: { label: "High confidence", cls: "border-[#bbf7d0] bg-[#f0fdf4] text-success", note: "Presented with citations." },
  medium: { label: "Medium confidence", cls: "border-[#fde68a] bg-[#fffbeb] text-warning", note: "Shown with a caveat and flagged for staff review." },
  low: { label: "Low confidence", cls: "border-[#fecaca] bg-[#fef2f2] text-danger", note: "Not answered. Routed to a person instead." },
};

export function ConfidenceChip({ confidence, defaultOpen }: { confidence: Confidence; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const m = META[confidence.score];
  return (
    <div className="inline-block max-w-full align-top">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-medium", m.cls)}>
        {confidence.score === "high" ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {m.label}
        <span className="font-normal opacity-80">· {confidence.checks.filter((c) => c.passed).length}/{confidence.checks.length} checks</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 rounded-[10px] border border-border bg-white p-3 text-[13px] shadow-sm">
          <ul className="space-y-1.5">
            {confidence.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-2">
                {c.passed ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="passed" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-label="failed" />}
                <span>
                  <span className="text-text">{c.name}</span>
                  {c.note && <span className="block text-[12px] text-muted">{c.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-border pt-2 text-[12px] text-muted">{m.note}</p>
        </div>
      )}
    </div>
  );
}
