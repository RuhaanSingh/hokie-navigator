"use client";
import { AlertTriangle, Check, CircleDashed, Send, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";
import type { Confidence, OptionCard, Tone } from "@/lib/types";
import { policyById } from "@/data/policies";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LevelPill } from "@/components/ui/level-pill";
import { ConfidenceChip } from "./confidence-chip";
import { useStore } from "@/components/shell/store-provider";
import { CaseProgress } from "./case-progress";

const ToneIcon = ({ tone }: { tone: Tone }) =>
  tone === "ok" ? (
    <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-success" aria-label="No issue" />
  ) : tone === "warn" ? (
    <AlertTriangle className="mt-[3px] h-3.5 w-3.5 shrink-0 text-warning" aria-label="Caution" />
  ) : tone === "bad" ? (
    <XCircle className="mt-[3px] h-3.5 w-3.5 shrink-0 text-danger" aria-label="Breaks a rule" />
  ) : (
    <CircleDashed className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted" aria-label="Unknown" />
  );

function Cell({ value, tone, ruleIds }: { value: string; tone: Tone; ruleIds: string[] }) {
  const inner = (
    <div className={cn("flex gap-1.5 text-[13px] leading-[18px]", tone === "bad" ? "text-danger" : tone === "unknown" ? "italic text-muted" : "text-text")}>
      <ToneIcon tone={tone} />
      <span>
        {value}
        {ruleIds.length > 0 && <span className="ml-1 whitespace-nowrap text-[11px] not-italic text-muted underline decoration-dotted underline-offset-2">{ruleIds.join(", ")}</span>}
      </span>
    </div>
  );
  if (!ruleIds.length) return inner;
  return (
    <Tip
      content={
        <div className="space-y-1.5">
          {ruleIds.map((id) => {
            const p = policyById(id);
            return (
              <div key={id}>
                <span className="font-semibold">{id}</span> {p?.text}
                <div className="text-[11px] text-muted">{p?.source}</div>
              </div>
            );
          })}
        </div>
      }
    >
      <button type="button" className="w-full cursor-help rounded-[6px] text-left">
        {inner}
      </button>
    </Tip>
  );
}

/** Option Comparison: one column per option, rows per consequence, every cell cites its rule. The agent does not choose. */
export function OptionComparison({ caseId, options, confidence, notes, readOnly, highlight }: { caseId: string; options: OptionCard[]; confidence: Confidence; notes: string[]; readOnly?: boolean; highlight?: OptionCard["id"] }) {
  const { snap, act } = useStore();
  const live = snap?.cases.find((c) => c.id === caseId);
  const submitted = readOnly || (live && live.status !== "awaiting_student" && live.status !== "gathering");
  const fewest = options.find((o) => o.fewestConsequences);
  const [picked, setPicked] = useState<OptionCard["id"] | null>(null);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const collapsed = !readOnly && submitted && !expanded;
  const rows = options[0].rows.map((r) => ({ key: r.key, label: r.label }));
  const chosen = highlight ?? live?.selectedOption ?? picked;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[12px] border border-border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="text-[14px] font-semibold">Your options · case #{caseId}</div>
          <span className="text-[12.5px] text-muted">Evaluated by 5 office agents against their rules</span>
          <div className="ml-auto">
            <ConfidenceChip confidence={confidence} />
          </div>
        </div>
        {collapsed ? (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-[13.5px]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white">{chosen}</span>
            <span className="font-medium">You chose Option {chosen}: {options.find((o) => o.id === chosen)?.title}</span>
            <button onClick={() => setExpanded(true)} className="ml-auto text-[13px] font-medium text-primary hover:underline">
              Show full comparison
            </button>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
            <caption className="sr-only">Comparison of three options across academic, scholarship, housing, visa, deadline and approval consequences</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[118px] border-b border-border bg-surface px-3 py-2.5 text-[12px] font-medium text-muted" />
                {options.map((o) => (
                  <th key={o.id} scope="col" className={cn("border-b border-l border-border px-3 py-2.5 align-top", chosen === o.id ? "bg-primary-tint" : o.fewestConsequences ? "bg-[#f7fdf9]" : "bg-surface")}>
                    <div className="flex items-start gap-2">
                      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold", chosen === o.id ? "bg-primary text-white" : "bg-white text-text ring-1 ring-border")}>{o.id}</span>
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold leading-tight text-text">{o.title}</div>
                        <div className="mt-0.5 text-[12px] font-normal leading-snug text-muted">{o.summary}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {o.fewestConsequences && (
                        <Badge tone="ok">
                          <Sparkles className="h-3 w-3" /> Fewest consequences
                        </Badge>
                      )}
                      {o.conflicts > 0 && (
                        <Badge tone="warn">
                          <AlertTriangle className="h-3 w-3" /> Conflict: breaks {o.conflicts} office rule{o.conflicts > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="border-b border-border bg-surface px-3 py-2.5 align-top text-[12.5px] font-medium text-muted">
                    {r.label}
                  </th>
                  {options.map((o) => {
                    const cell = o.rows.find((x) => x.key === r.key)!;
                    return (
                      <td key={o.id} className={cn("border-b border-l border-border px-3 py-2.5 align-top", chosen === o.id && "bg-primary-tint/50")}>
                        <Cell value={cell.value} tone={cell.tone} ruleIds={r.key === "approvers" ? [] : cell.ruleIds} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        {notes.length > 0 && !collapsed && (
          <div className="border-b border-border bg-[#fffbeb] px-4 py-2.5 text-[13px] text-[#92400e]">
            {notes.map((n) => (
              <div key={n} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {n}
              </div>
            ))}
            {confidence.score === "medium" && <div className="mt-1 pl-5.5 text-[12.5px]">Flagged for staff review because confidence is Medium.</div>}
          </div>
        )}

        {!submitted ? (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="text-[13px] text-muted">The agent doesn&apos;t choose for you.{fewest ? ` Option ${fewest.id} has the fewest consequences.` : ""} Pick one:</span>
            <div role="radiogroup" aria-label="Choose an option" className="flex gap-1.5">
              {options.map((o) => (
                <button key={o.id} role="radio" aria-checked={picked === o.id} onClick={() => setPicked(o.id)} className={cn("h-8 rounded-[8px] border px-3 text-[13px] font-semibold", picked === o.id ? "border-primary bg-primary-tint text-primary" : "border-border bg-white hover:bg-surface")}>
                  Option {o.id}
                </button>
              ))}
            </div>
            <Button
              className="ml-auto"
              disabled={!picked || sending}
              onClick={async () => {
                if (!picked) return;
                setSending(true);
                await act({ type: "submit_option", caseId, option: picked });
                setSending(false);
              }}
            >
              <Send className="h-4 w-4" /> Send to Dean of Students for approval
            </Button>
            <div className="flex w-full items-center gap-1.5 text-[12px] text-muted">
              <LevelPill level="Staff" /> Withdrawals, incompletes and reduced loads always need staff approval. Nothing happens until a person approves.
            </div>
          </div>
        ) : null}
      </div>
      {submitted && !readOnly && <CaseProgress caseId={caseId} />}
    </div>
  );
}
