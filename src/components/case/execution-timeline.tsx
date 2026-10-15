"use client";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, Mail } from "lucide-react";
import { useState } from "react";
import type { TimelineStep } from "@/lib/types";
import { OFFICES } from "@/data/offices-meta";
import { cn, clock } from "@/lib/utils";
import { StatusRing } from "@/components/ui/status-ring";
import { LevelPill } from "@/components/ui/level-pill";
import { AgentIcon } from "@/components/shell/agent-icon";

function Draft({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline" aria-expanded={open}>
        <Mail className="h-3.5 w-3.5" /> {open ? "Hide" : "View"} drafted notices <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-[8px] border border-border bg-surface p-3 font-sans text-[12.5px] leading-relaxed text-[#44403c]">{text}</pre>}
    </div>
  );
}

/** Serialized execution after approval. One step at a time, each with a level pill and office icon. */
export function ExecutionTimeline({ steps }: { steps: TimelineStep[] }) {
  const reduce = useReducedMotion();
  return (
    <ol className="relative" aria-live="polite" aria-label="Execution timeline">
      {steps.map((t, i) => {
        const status = t.status === "pending" || t.status === "skipped" ? null : t.status;
        const name = t.office === "personal_agent" ? "Your agent" : OFFICES[t.office].short;
        return (
          <motion.li key={t.id} initial={reduce ? false : { opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduce ? 0 : i * 0.03 }} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className={cn("absolute left-[11px] top-6 h-[calc(100%-20px)] w-px", t.status === "done" ? "bg-success/40" : "bg-border")} aria-hidden />}
            <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
              {status ? <StatusRing status={status} size={20} /> : <span className={cn("h-2.5 w-2.5 rounded-full border-2", t.status === "skipped" ? "border-[#d6d3d1] bg-[#f5f5f4]" : "border-[#d6d3d1] bg-white")} />}
            </span>
            <div className={cn("min-w-0 flex-1 pt-0.5", (t.status === "pending" || t.status === "skipped") && "opacity-55")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted">
                  <AgentIcon agent={t.office} /> {name}
                </span>
                <LevelPill level={t.level} />
                {t.ts && t.status !== "pending" && <span className="ml-auto text-[11.5px] text-muted tabular">{clock(t.ts)}</span>}
              </div>
              <div className={cn("text-[14px] font-medium", t.status === "error" ? "text-danger" : "text-text")}>{t.label}</div>
              {t.detail && <div className="text-[13px] text-muted">{t.status === "skipped" ? "Skipped: earlier step needs a person" : t.detail}</div>}
              {t.draft && <Draft text={t.draft} />}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
