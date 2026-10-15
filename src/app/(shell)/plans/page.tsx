"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, FileSignature, ShieldOff } from "lucide-react";
import { useStore } from "@/components/shell/store-provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LevelPill } from "@/components/ui/level-pill";
import { StatusRing } from "@/components/ui/status-ring";
import { AgentIcon } from "@/components/shell/agent-icon";
import { cn, clock } from "@/lib/utils";

const fmtTime = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`;

export default function PlansPage() {
  const { snap, act } = useStore();
  const [busy, setBusy] = useState(false);
  if (!snap) return <div className="p-8 text-muted">Loading…</div>;
  const p = snap.plan;
  const signed = p.status === "signed";
  const sec = (id: string) => snap.sections.find((s) => s.id === id)!;
  const pending = snap.pendingPlanDecision;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">Pre-approved plans</h2>
          <p className="text-[14px] text-muted">
            Tell your agent in advance what it may do. It acts on its own <LevelPill level="L3" full /> only inside these limits; anything else, it stops and asks.
          </p>
        </div>
      </div>

      {pending && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[12px] border border-[#fde68a] bg-[#fffbeb] p-4">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-semibold">Your agent stopped and is asking you</div>
            <div className="text-[13.5px] text-[#92400e]">
              Next step in your plan is {sec(pending.sectionId).course}-{sec(pending.sectionId).section}, but {pending.reason}. It did not act.
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={async () => (setBusy(true), await act({ type: "plan_decide", choice: "approve" }), setBusy(false))}>
            Enroll anyway (just this once)
          </Button>
          <Button size="sm" disabled={busy} onClick={async () => (setBusy(true), await act({ type: "plan_decide", choice: "next" }), setBusy(false))}>
            Use Plan C instead
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ type: "plan_decide", choice: "dismiss" })}>
            Do nothing
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{p.goal}</CardTitle>
              <div className="text-[12.5px] text-muted">{p.term} · registration opens in 3 days</div>
            </div>
            {signed ? (
              <Badge tone="ok">
                <FileSignature className="h-3 w-3" /> Signed {new Date(p.signedAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · revocable
              </Badge>
            ) : (
              <Badge tone={p.status === "revoked" ? "bad" : "warn"}>{p.status === "revoked" ? "Revoked" : "Draft · not signed"}</Badge>
            )}
          </CardHeader>
          <CardBody className="space-y-5">
            <ol className="space-y-2.5">
              {p.steps.map((st) => {
                const s = sec(st.sectionId);
                const enrolled = snap.nextTermSchedule.some((x) => x.startsWith(`${s.course}-${s.section}`));
                const outside = s.startMinutes < p.limits.earliestMinutes || p.baseCredits + s.credits > p.limits.maxCredits;
                return (
                  <li key={st.rank} className={cn("flex items-center gap-4 rounded-[10px] border px-4 py-3", enrolled ? "border-[#bbf7d0] bg-[#f0fdf4]" : "border-border")}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[13px] font-bold text-primary">{st.rank}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium">
                        {s.course}-{s.section} · {s.title}
                      </div>
                      <div className="text-[13px] text-muted">
                        {s.time} · {s.credits} credits · {p.baseCredits + s.credits} total
                        {outside && <span className="ml-1 text-warning">· outside your limits</span>}
                      </div>
                    </div>
                    {enrolled ? (
                      <Badge tone="ok">
                        <CheckCircle2 className="h-3 w-3" /> Enrolled
                      </Badge>
                    ) : (
                      <span className={cn("text-[13px] tabular", s.seats ? "text-muted" : "font-semibold text-danger")}>{s.seats ? `${s.seats} seats open` : "Full"}</span>
                    )}
                  </li>
                );
              })}
            </ol>

            <div>
              <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted">Limits</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="rounded-[10px] border border-border p-3">
                  <span className="text-[12.5px] text-muted">Max credits</span>
                  <select disabled={signed} value={p.limits.maxCredits} onChange={(e) => act({ type: "plan_limits", maxCredits: Number(e.target.value), earliestMinutes: p.limits.earliestMinutes })} className="mt-1 block w-full rounded-[8px] border border-border bg-white px-2 py-1.5 text-[15px] font-medium tabular disabled:bg-surface">
                    {[15, 16, 17, 18, 19].map((n) => (
                      <option key={n} value={n}>
                        {n} credits
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rounded-[10px] border border-border p-3">
                  <span className="text-[12.5px] text-muted">Nothing before</span>
                  <select disabled={signed} value={p.limits.earliestMinutes} onChange={(e) => act({ type: "plan_limits", maxCredits: p.limits.maxCredits, earliestMinutes: Number(e.target.value) })} className="mt-1 block w-full rounded-[8px] border border-border bg-white px-2 py-1.5 text-[15px] font-medium tabular disabled:bg-surface">
                    {[480, 540, 600].map((n) => (
                      <option key={n} value={n}>
                        {fmtTime(n)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {signed ? (
                <Button variant="danger" onClick={() => act({ type: "plan_status", status: "revoked" })}>
                  <ShieldOff className="h-4 w-4" /> Revoke plan
                </Button>
              ) : (
                <Button onClick={() => act({ type: "plan_status", status: "signed" })}>
                  <FileSignature className="h-4 w-4" /> Sign plan
                </Button>
              )}
              <span className="text-[12.5px] text-muted">{signed ? "Revoke to edit limits. Revoking stops all automatic actions immediately." : "Your agent won't act automatically until you sign."}</span>
            </div>
          </CardBody>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Watchdog activity</CardTitle>
            <Clock className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            {snap.watchdog.length === 0 ? (
              <p className="text-[13.5px] text-muted">Watching seat counts for your plan. Nothing has changed yet.</p>
            ) : (
              <ol className="space-y-2" aria-live="polite">
                {snap.watchdog.map((w) => (
                  <li key={w.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5">
                      <StatusRing status={w.status} size={15} />
                    </span>
                    <span className="mt-0.5 text-muted">
                      <AgentIcon agent={w.agent} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-[13.5px]", w.status === "blocked" ? "text-warning" : "text-text")}>{w.label}</div>
                      {w.detail && <div className="text-[12px] text-muted">{w.detail}</div>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {w.level && <LevelPill level={w.level} />}
                      <span className="text-[11px] text-muted tabular">{w.ts ? clock(w.ts) : ""}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-4 border-t border-border pt-3">
              <div className="text-[12.5px] font-medium text-muted">Next-term schedule</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {snap.nextTermSchedule.map((c) => (
                  <Badge key={c}>{c}</Badge>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
