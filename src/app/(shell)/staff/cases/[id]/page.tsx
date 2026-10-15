"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, OctagonPause, Target, X } from "lucide-react";
import { useStore } from "@/components/shell/store-provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LevelPill } from "@/components/ui/level-pill";
import { OptionComparison } from "@/components/chat/option-comparison";
import { ConfidenceChip } from "@/components/chat/confidence-chip";
import { OfficeGrid } from "@/components/case/office-grid";
import { ExecutionTimeline } from "@/components/case/execution-timeline";
import { timeAgo } from "@/lib/utils";

export default function StaffCase() {
  const { id } = useParams<{ id: string }>();
  const { snap, act } = useStore();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const c = snap?.cases.find((x) => x.id === id);

  if (!snap) return <div className="p-8 text-muted">Loading…</div>;
  if (!c) return <div className="p-8 text-muted">Case not found. <Link className="text-primary underline" href="/staff">Back to queue</Link></div>;

  const opt = c.options.find((o) => o.id === c.selectedOption);
  const pending = c.status === "awaiting_staff";
  const decide = async (decision: "approve" | "reject") => {
    setBusy(true);
    await act({ type: "staff_decide", caseId: c.id, decision, note: note.trim() || undefined });
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8">
      <Link href="/staff" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> Approval queue
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="text-[22px] font-semibold tracking-tight">Case #{c.id}</h2>
        <Badge tone={pending ? "primary" : c.status === "completed" ? "ok" : c.status === "rejected" ? "bad" : "warn"}>{c.status.replace("_", " ")}</Badge>
        <span className="text-[13px] text-muted">Received {timeAgo(c.updatedAt)} · Maya Chen · Junior, Computer Science · F-1 · shared with student consent</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardBody>
                <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted">
                  <Target className="h-3.5 w-3.5" /> Student goal
                </div>
                <div className="text-[15px] font-medium first-letter:uppercase">{c.preference}</div>
                <p className="mt-1 text-[13.5px] text-muted">{c.summary}</p>
              </CardBody>
            </Card>
            <Card className="border-[#f6cdd5]">
              <CardBody>
                <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-primary">
                  <OctagonPause className="h-3.5 w-3.5" /> Why the agent stopped
                </div>
                <div className="text-[15px] font-medium">{c.stopReason ?? "Waiting for the student's choice"}</div>
                <p className="mt-1 text-[13.5px] text-muted">
                  Requested: <b className="font-semibold text-text">Option {c.selectedOption}: {opt?.title}</b> <LevelPill level="Staff" className="ml-1" />
                </p>
              </CardBody>
            </Card>
          </div>

          <div>
            <h3 className="mb-2 text-[14px] font-semibold">Options considered</h3>
            {c.confidence && <OptionComparison caseId={c.id} options={c.options} confidence={c.confidence} notes={c.notes} readOnly highlight={c.selectedOption} />}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Office agent responses</CardTitle>
              <span className="text-[12.5px] text-muted">Consulted in parallel through the gateway</span>
            </CardHeader>
            <CardBody>
              <OfficeGrid responses={c.officeResponses} />
              {c.options.some((o) => o.conflicts) && (
                <div className="mt-3 flex gap-2 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-[13px] text-[#92400e]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <b className="font-semibold">Conflicts:</b> {c.options.filter((o) => o.conflicts).map((o) => `Option ${o.id} breaks ${o.conflicts} office rules (${o.conflictRules.join(", ")})`).join("; ")}. The agent did not pick a side.
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
              {c.confidence && <Badge tone={c.confidence.score === "high" ? "ok" : "warn"}>{c.confidence.score}</Badge>}
            </CardHeader>
            <CardBody className="space-y-3">
              {c.confidence && <ConfidenceChip confidence={c.confidence} defaultOpen />}
              {pending ? (
                <>
                  <label className="block text-[13px] font-medium" htmlFor="note">
                    Note to the student / offices <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. Approved. Please check in with ISS before you fly." className="w-full rounded-[8px] border border-border px-3 py-2 text-[14px] focus:border-[#d6d3d1] focus:outline-none" />
                  <Button size="lg" variant="success" className="w-full" disabled={busy} onClick={() => decide("approve")}>
                    <Check className="h-4 w-4" /> {note.trim() ? "Approve with note" : "Approve"}
                  </Button>
                  <Button variant="danger" className="w-full" disabled={busy} onClick={() => decide("reject")}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                  <p className="text-[12px] text-muted">Approving runs each step in order through the gateway. Every step is logged.</p>
                </>
              ) : (
                <p className="text-[13.5px] text-muted">{c.status === "awaiting_student" ? "Waiting for the student to choose an option." : `Decision recorded${c.staffNote ? `: “${c.staffNote}”` : ""}.`}</p>
              )}
            </CardBody>
          </Card>
          {c.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Execution</CardTitle>
              </CardHeader>
              <CardBody>
                <ExecutionTimeline steps={c.timeline} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
