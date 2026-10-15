"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, GitFork } from "lucide-react";
import { useEffect, useState } from "react";
import type { TraceStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusRing } from "@/components/ui/status-ring";
import { LevelPill } from "@/components/ui/level-pill";
import { AgentIcon } from "@/components/shell/agent-icon";

const OFFICE_AGENTS = new Set(["dean_of_students", "registrar", "financial_aid", "housing", "iss", "bursar", "department"]);

function Row({ s, indent }: { s: TraceStep; indent?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex items-start gap-2.5 py-[3px]", indent && "pl-1")}
    >
      <span className="mt-[2px]">
        <StatusRing status={s.status} size={15} />
      </span>
      <span className="mt-[2px] text-muted">
        <AgentIcon agent={s.agent} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("text-[13px] leading-5", s.status === "error" ? "text-danger" : s.status === "blocked" ? "text-warning" : s.status === "running" ? "text-text" : "text-[#57534e]")}>
          {s.label}
        </span>
        {s.detail && <span className="block text-[12px] leading-[18px] text-muted">{s.detail}</span>}
      </span>
      {s.level && <LevelPill level={s.level} className="mt-[1px]" />}
    </motion.li>
  );
}

/** The live agent trace shown above each assistant reply. Collapses to one line when finished. */
export function AgentTrace({ steps, streaming, startedAt, endedAt }: { steps: TraceStep[]; streaming?: boolean; startedAt: number; endedAt?: number }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!streaming && steps.length) {
      const t = setTimeout(() => setOpen(false), 1200);
      return () => clearTimeout(t);
    }
    if (streaming) setOpen(true);
  }, [streaming, steps.length]);

  if (!steps.length) {
    return streaming ? (
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <span className="h-2 w-2 rounded-full bg-primary pulse-dot" /> Thinking…
      </div>
    ) : null;
  }

  const offices = new Set(steps.filter((s) => OFFICE_AGENTS.has(s.agent)).map((s) => s.agent));
  const secs = ((endedAt ?? Date.now()) - startedAt) / 1000;
  const issues = steps.filter((s) => s.status === "error" || s.status === "blocked").length;
  const summary = [offices.size ? `Consulted ${offices.size} office agent${offices.size > 1 ? "s" : ""}` : null, `${steps.length} step${steps.length > 1 ? "s" : ""}`, `${secs.toFixed(1)}s`, issues ? `${issues} flagged` : null].filter(Boolean).join(" · ");

  // Build render list: consecutive group members collapse into one block at the first member's position.
  const blocks: ({ kind: "row"; s: TraceStep } | { kind: "group"; id: string; items: TraceStep[] })[] = [];
  for (const s of steps) {
    if (s.group) {
      const existing = blocks.find((b) => b.kind === "group" && b.id === s.group) as { kind: "group"; id: string; items: TraceStep[] } | undefined;
      if (existing) existing.items.push(s);
      else blocks.push({ kind: "group", id: s.group, items: [s] });
    } else blocks.push({ kind: "row", s });
  }

  return (
    <div className="rounded-[10px] border border-border bg-surface/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-muted hover:text-text"
      >
        {streaming ? <span className="h-2 w-2 rounded-full bg-primary pulse-dot" aria-hidden /> : <StatusRing status={issues ? "blocked" : "done"} size={14} />}
        <span className="font-medium text-[#44403c]">{streaming ? "Working on it" : "Agent trace"}</span>
        <span className="truncate">· {summary}</span>
        <ChevronRight className={cn("ml-auto h-4 w-4 shrink-0 transition-transform", open && "rotate-90")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <ol className="border-t border-border px-3 py-2" aria-live="polite" aria-label="Agent steps">
              {blocks.map((b) =>
                b.kind === "row" ? (
                  <Row key={b.s.id} s={b.s} />
                ) : (
                  <li key={b.id} className="my-1.5 rounded-[8px] border border-dashed border-[#d6d3d1] bg-white px-2.5 py-1.5">
                    <div className="mb-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-muted">
                      <GitFork className="h-3 w-3" aria-hidden /> In parallel · {b.items.length} office agents
                      <span className="ml-auto font-normal normal-case tracking-normal">
                        {b.items.filter((i) => i.status !== "running").length}/{b.items.length} replied
                      </span>
                    </div>
                    <ol>
                      {b.items.map((s) => (
                        <Row key={s.id} s={s} indent />
                      ))}
                    </ol>
                  </li>
                ),
              )}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
