"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { useStore } from "@/components/shell/store-provider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, timeAgo } from "@/lib/utils";

const QUEUES = [
  { id: "dean_of_students", label: "Dean of Students" },
  { id: "financial_aid_counselor", label: "Financial aid counselors" },
  { id: "office_staff", label: "Other offices" },
] as const;

export default function StaffQueue() {
  const { snap } = useStore();
  const [q, setQ] = useState<(typeof QUEUES)[number]["id"]>("dean_of_students");
  const items = snap?.staffQueue.filter((i) => i.queue === q) ?? [];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8">
      <div className="mb-5">
        <h2 className="text-[22px] font-semibold tracking-tight">Approval queue</h2>
        <p className="text-[14px] text-muted">Cases arrive as one-screen packets. The agent prepared them; you decide.</p>
      </div>
      <div role="tablist" className="mb-4 flex gap-1 border-b border-border">
        {QUEUES.map((x) => {
          const n = snap?.staffQueue.filter((i) => i.queue === x.id && i.status === "pending").length ?? 0;
          return (
            <button key={x.id} role="tab" aria-selected={q === x.id} onClick={() => setQ(x.id)} className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-[14px] font-medium", q === x.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-text")}>
              {x.label}
              {n > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">{n}</span>}
            </button>
          );
        })}
      </div>
      <Card>
        {items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <Inbox className="h-8 w-8 text-[#d6d3d1]" />
            <div className="mt-3 text-[15px] font-medium">No cases waiting</div>
            <p className="mt-1 max-w-sm text-[13.5px] text-muted">When a student&apos;s agent hits an action that needs a person, the case packet lands here, with everything you need on one screen.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((i) => {
              const c = snap?.cases.find((x) => x.id === i.caseId);
              const body = (
                <div className="flex items-center gap-4 px-5 py-4">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", i.status === "pending" ? "bg-primary pulse-dot" : "bg-[#d6d3d1]")} aria-label={i.status === "pending" ? "New" : undefined} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">{i.title}</div>
                    <div className="truncate text-[13px] text-muted">
                      John Doe · Junior, CS · F-1 · {i.reason}
                    </div>
                  </div>
                  {c?.confidence && <Badge tone={c.confidence.score === "high" ? "ok" : c.confidence.score === "medium" ? "warn" : "bad"}>{c.confidence.score} confidence</Badge>}
                  <Badge tone={i.status === "pending" ? "primary" : i.status === "rejected" ? "bad" : "ok"}>{i.status}</Badge>
                  <span className="w-16 text-right text-[12.5px] text-muted">{timeAgo(i.ts)}</span>
                  {i.caseId && <ChevronRight className="h-4 w-4 text-muted" />}
                </div>
              );
              return <li key={i.id}>{i.caseId && q === "dean_of_students" ? <Link href={`/staff/cases/${i.caseId}`} className="block hover:bg-surface">{body}</Link> : body}</li>;
            })}
          </ul>
        )}
      </Card>
      {snap?.showSimBadges && <p className="mt-3 text-[12px] text-muted">Simulated staff view. In production this lives inside the office&apos;s existing case system.</p>}
    </div>
  );
}
