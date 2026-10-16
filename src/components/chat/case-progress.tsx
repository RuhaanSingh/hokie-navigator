"use client";
import Link from "next/link";
import { CheckCircle2, Clock, ScrollText, UserCheck, XCircle } from "lucide-react";
import { useStore } from "@/components/shell/store-provider";
import { ExecutionTimeline } from "@/components/case/execution-timeline";
import { LevelPill } from "@/components/ui/level-pill";

/** Live status of a case after the student submits: waiting on staff → serialized execution → close the loop. */
export function CaseProgress({ caseId }: { caseId: string }) {
  const { snap } = useStore();
  const c = snap?.cases.find((x) => x.id === caseId);
  if (!c) return null;
  const opt = c.options.find((o) => o.id === c.selectedOption);

  if (c.status === "awaiting_staff")
    return (
      <div className="flex items-start gap-3 rounded-[12px] border border-border bg-white p-4">
        <span className="relative mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary-tint text-primary">
          <Clock className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary pulse-dot" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
            Awaiting Dean of Students approval <LevelPill level="Staff" />
          </div>
          <p className="text-[13px] text-muted">
            Option {c.selectedOption}: {opt?.title}. Your case file (goal, options, office responses, conflicts) was sent so you don&apos;t have to explain again. {c.stopReason && <>Why I stopped: {c.stopReason}.</>}
          </p>
        </div>
      </div>
    );

  if (c.status === "rejected")
    return (
      <div className="flex items-start gap-3 rounded-[12px] border border-border bg-white p-4">
        <XCircle className="mt-0.5 h-5 w-5 text-danger" />
        <div className="text-[13.5px]">
          <div className="font-semibold">The Dean of Students didn&apos;t approve this option</div>
          <div className="text-muted">{c.staffNote ? `Note: “${c.staffNote}”. ` : ""}A case manager will reach out. Nothing was changed.</div>
        </div>
      </div>
    );

  const done = c.status === "completed";
  return (
    <div className="rounded-[12px] border border-border bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <UserCheck className="h-4 w-4 text-success" />
        <span className="text-[14px] font-semibold">Approved by the Dean of Students</span>
        <span className="text-[13px] text-muted">· executing one step at a time</span>
        <span className="ml-auto text-[12.5px] text-muted">
          {c.timeline.filter((t) => t.status === "done").length}/{c.timeline.length} done
        </span>
      </div>
      <div className="px-4 py-4">
        <ExecutionTimeline steps={c.timeline} />
      </div>
      {done && (
        <div className="border-t border-border bg-[#f7fdf9] px-4 py-3.5">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> All set, Ruhaan. You told your story once.
          </div>
          {c.selectedOption === "B" ? (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13.5px] text-[#44403c]">
              <li>Your instructors for CS 3214 and STAT 4705 have been notified; no details about your family were shared.</li>
              <li>You stay at 15 credits. Your scholarship, housing and F-1 status are unchanged.</li>
              <li>Next step: when instructors confirm, finish the work by week 6 of next term (mock). I&apos;ll remind you.</li>
            </ul>
          ) : (
            <p className="mt-1 text-[13.5px] text-[#44403c]">Each office has the approved request. I&apos;ll tell you as soon as anyone replies.</p>
          )}
          <Link href={`/cases/${c.id}#audit`} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
            <ScrollText className="h-3.5 w-3.5" /> Every action logged: view audit trail
          </Link>
        </div>
      )}
      {c.status === "paused" && (
        <div className="border-t border-border bg-[#fffbeb] px-4 py-3 text-[13.5px] text-[#92400e]">Paused: an office agent didn&apos;t respond. Nothing irreversible happened, and a person has the case.</div>
      )}
    </div>
  );
}
