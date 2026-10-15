"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { useStore } from "@/components/shell/store-provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptionComparison } from "@/components/chat/option-comparison";
import { OfficeGrid } from "@/components/case/office-grid";
import { ExecutionTimeline } from "@/components/case/execution-timeline";
import { AuditTable } from "@/components/case/audit-table";
import { STATUS_LABEL } from "@/lib/status";
import { clock } from "@/lib/utils";

export default function CaseView() {
  const { id } = useParams<{ id: string }>();
  const { snap } = useStore();
  if (!snap) return <div className="p-8 text-muted">Loading…</div>;
  const c = snap.cases.find((x) => x.id === id);
  if (!c)
    return (
      <div className="p-8 text-muted">
        Case not found (the demo may have been reset). <Link href="/cases" className="text-primary underline">All cases</Link>
      </div>
    );
  const audit = snap.audit.filter((a) => a.caseId === c.id);

  const approval = [
    { label: "Student chose an option", done: Boolean(c.selectedOption), note: c.selectedOption ? `Option ${c.selectedOption}` : "Waiting for you" },
    { label: "Dean of Students review", done: Boolean(c.staffDecisionAt), note: c.staffDecisionAt ? `${c.status === "rejected" ? "Not approved" : "Approved"} at ${clock(c.staffDecisionAt)}` : c.status === "awaiting_staff" ? "In the queue now" : "Not yet requested" },
    { label: "Execution", done: c.status === "completed", note: c.status === "completed" ? "All steps done" : c.status === "executing" ? "Running" : c.status === "paused" ? "Paused with a person" : "Not started" },
  ];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8">
      <Link href="/cases" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> Cases
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="text-[22px] font-semibold tracking-tight">
          #{c.id} · {c.title}
        </h2>
        <Badge tone={STATUS_LABEL[c.status].tone}>{STATUS_LABEL[c.status].label}</Badge>
        <Link href="/assistant" className="ml-auto">
          <Button variant="outline" size="sm">
            <MessageSquareText className="h-4 w-4" /> Open conversation
          </Button>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Office agents</CardTitle>
              <span className="text-[12.5px] text-muted">via the agent gateway</span>
            </CardHeader>
            <CardBody>
              <OfficeGrid responses={c.officeResponses} />
            </CardBody>
          </Card>
          {c.confidence && (
            <div>
              <h3 className="mb-2 text-[14px] font-semibold">Consequence comparison</h3>
              <OptionComparison caseId={c.id} options={c.options} confidence={c.confidence} notes={c.notes} readOnly={c.status !== "awaiting_student"} highlight={c.selectedOption} />
            </div>
          )}
          <Card id="audit">
            <CardHeader>
              <CardTitle>Audit trail for this case</CardTitle>
              <span className="text-[12.5px] text-muted">{audit.length} entries</span>
            </CardHeader>
            <CardBody>
              <AuditTable entries={audit} filters={false} />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Approval status</CardTitle>
            </CardHeader>
            <CardBody>
              <ol className="space-y-3">
                {approval.map((a) => (
                  <li key={a.label} className="flex gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.done ? "bg-success" : "bg-[#d6d3d1]"}`} />
                    <div>
                      <div className="text-[14px] font-medium">{a.label}</div>
                      <div className="text-[12.5px] text-muted">{a.note}</div>
                    </div>
                  </li>
                ))}
              </ol>
              {c.staffNote && <p className="mt-3 rounded-[8px] bg-surface px-3 py-2 text-[13px]">Staff note: “{c.staffNote}”</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Execution timeline</CardTitle>
            </CardHeader>
            <CardBody>{c.timeline.length ? <ExecutionTimeline steps={c.timeline} /> : <p className="text-[13.5px] text-muted">Nothing runs until a person approves.</p>}</CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
