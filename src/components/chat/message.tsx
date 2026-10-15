"use client";
import { ExternalLink, FileCheck2, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { UiMessage } from "./chat-provider";
import { AgentTrace } from "./agent-trace";
import { RichText } from "./rich-text";
import { WellbeingCard } from "./wellbeing-card";
import { ConfidenceChip } from "./confidence-chip";
import { OptionComparison } from "./option-comparison";
import { Button } from "@/components/ui/button";
import { LevelPill } from "@/components/ui/level-pill";
import { useStore } from "@/components/shell/store-provider";
import { LogoMark } from "@/components/shell/logo";

function StudentApproval({ action }: { action: string }) {
  const { act } = useStore();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const resolved = state === "done";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-border bg-white p-4">
      <FileCheck2 className="h-5 w-5 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[14px] font-semibold">
          {action} <LevelPill level="L2" full />
        </div>
        <div className="text-[13px] text-muted">Drafted by your agent. Sent to the Bursar agent only if you approve.</div>
      </div>
      {resolved ? (
        <span className="text-[13.5px] font-medium text-success">Sent · logged</span>
      ) : (
        <Button
          disabled={state === "sending"}
          onClick={async () => {
            setState("sending");
            await act({ type: "hold_review" });
            setState("done");
          }}
        >
          Approve &amp; send
        </Button>
      )}
    </div>
  );
}

export function Message({ m, onQuickReply }: { m: UiMessage; onQuickReply: (t: string) => void }) {
  const { snap } = useStore();
  if (m.role === "user")
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-[14px] rounded-br-[4px] bg-[#f5f5f4] px-4 py-2.5 text-[15px] leading-relaxed text-text">{m.content}</div>
      </div>
    );

  return (
    <div className="flex gap-3">
      <LogoMark className="mt-0.5 h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">
        <AgentTrace steps={m.steps} streaming={m.streaming} startedAt={m.startedAt} endedAt={m.endedAt} />
        {m.wellbeing && <WellbeingCard urgent={m.wellbeing.urgent} resources={m.wellbeing.resources} />}
        {m.content && <RichText text={m.content} sources={m.sources} />}
        {m.sources && m.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Sources">
            {m.sources.map((s, i) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex max-w-[280px] items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-[12.5px] text-[#44403c] hover:border-[#d6d3d1] hover:bg-surface">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-primary-tint text-[10.5px] font-bold text-primary">{i + 1}</span>
                <span className="truncate">{s.title}</span>
                <span className="shrink-0 text-muted">finaid.vt.edu</span>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted" />
              </a>
            ))}
          </div>
        )}
        {m.confidence && !m.options && <ConfidenceChip confidence={m.confidence} />}
        {m.options && <OptionComparison {...m.options} />}
        {m.approval?.approver === "student" && <StudentApproval action={m.approval.action} />}
        {m.quickReplies && (
          <div className="flex flex-wrap gap-2">
            {m.quickReplies.map((q) => (
              <button key={q} onClick={() => onQuickReply(q)} className="rounded-full border border-[#f6cdd5] bg-white px-3.5 py-1.5 text-[13.5px] font-medium text-primary transition-colors hover:bg-primary-tint">
                {q}
              </button>
            ))}
          </div>
        )}
        {!m.streaming && m.meta && snap?.showSimBadges && (
          <div className={cn("flex items-center gap-1.5 text-[11.5px] text-[#a8a29e]")}>
            <Sparkles className="h-3 w-3" />
            {m.meta.source === "llm" ? "Written by LLM (Groq)" : snap.mode === "scripted" ? "Scripted response" : "Scripted fallback"} · office agents simulated
          </div>
        )}
      </div>
    </div>
  );
}
