"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpenText, CalendarClock, CheckCircle2, ChevronRight, HeartHandshake, ListChecks, Shield, X, XCircle } from "lucide-react";
import { useStore } from "@/components/shell/store-provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, timeAgo } from "@/lib/utils";
import { persona } from "@/data/persona";
import type { Alert } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/status";


function AlertCard({ a, onDismiss }: { a: Alert; onDismiss: () => void }) {
  const Icon = a.tone === "bad" ? XCircle : a.tone === "warn" ? AlertTriangle : CheckCircle2;
  return (
    <div className={cn("flex gap-3 rounded-[12px] border bg-white p-4", a.tone === "bad" ? "border-[#fecaca]" : a.tone === "warn" ? "border-[#fde68a]" : "border-border")}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", a.tone === "bad" ? "text-danger" : a.tone === "warn" ? "text-warning" : "text-success")} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="text-[14.5px] font-semibold">{a.title}</div>
          <span className="ml-auto shrink-0 text-[12px] text-muted">{timeAgo(a.ts)}</span>
        </div>
        <p className="mt-0.5 text-[13.5px] text-muted">{a.body}</p>
        {a.action && (
          <Link href={a.action.href} className="mt-2 inline-flex items-center gap-1 text-[13.5px] font-medium text-primary hover:underline">
            {a.action.label} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <button onClick={onDismiss} className="h-6 w-6 shrink-0 rounded-[6px] text-[#a8a29e] hover:bg-surface hover:text-muted" aria-label="Dismiss alert">
        <X className="mx-auto h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { snap, act } = useStore();
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  const alerts = snap?.alerts.filter((a) => !a.resolved) ?? [];
  const cases = snap?.cases ?? [];
  const allowed = snap?.consent.filter((c) => c.allowed).length ?? 0;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h2 className="text-[26px] font-semibold tracking-tight">
            {greeting}, {persona.firstName}
          </h2>
          <p className="text-[14.5px] text-muted">
            Week {persona.semester.week} · {persona.credits} credits · your agent is watching {cases.length ? `${cases.length} case${cases.length > 1 ? "s" : ""} and ` : ""}your deadlines.
          </p>
        </div>
        <Link href="/privacy" className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] text-muted hover:bg-surface hover:text-text">
          <Shield className="h-3.5 w-3.5" /> Your agent can contact: <b className="font-semibold text-text">{allowed} offices</b> · Manage
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/assistant?q=story", icon: HeartHandshake, title: "Tell your story", body: "Say it once. I'll coordinate the offices." },
          { href: "/assistant?q=aid", icon: BookOpenText, title: "Ask about financial aid", body: "Answers from finaid.vt.edu with sources." },
          { href: "/plans", icon: ListChecks, title: "Plan registration backups", body: "Pre-approve what I may do, and nothing more." },
        ].map((q) => (
          <Link key={q.title} href={q.href} className="group flex items-start gap-3 rounded-[12px] border border-border bg-white p-4 transition-colors hover:border-[#f6cdd5] hover:bg-primary-tint/40">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-primary-tint text-primary">
              <q.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold">{q.title}</span>
              <span className="block text-[13px] text-muted">{q.body}</span>
            </span>
            <ChevronRight className="ml-auto mt-1 h-4 w-4 text-[#d6d3d1] group-hover:text-primary" />
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="alerts-h">
            <h3 id="alerts-h" className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
              Watchdog alerts {alerts.length > 0 && <Badge tone="primary">{alerts.length}</Badge>}
            </h3>
            <div className="space-y-2.5">
              {alerts.length === 0 && <div className="rounded-[12px] border border-dashed border-border px-4 py-6 text-center text-[13.5px] text-muted">All quiet. Your agent will tell you if anything changes.</div>}
              {alerts.map((a) => (
                <AlertCard key={a.id} a={a} onDismiss={() => act({ type: "dismiss_alert", id: a.id })} />
              ))}
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Active cases</CardTitle>
              <Link href="/cases" className="text-[13px] font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            {cases.length === 0 ? (
              <CardBody className="text-[13.5px] text-muted">No open cases. If something comes up, tell your agent once and it will open one for you.</CardBody>
            ) : (
              <ul className="divide-y divide-border">
                {cases.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link href={`/cases/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium">
                          #{c.id} · {c.title}
                        </div>
                        <div className="text-[12.5px] text-muted">Updated {timeAgo(c.updatedAt)}</div>
                      </div>
                      <Badge tone={STATUS_LABEL[c.status].tone}>{STATUS_LABEL[c.status].label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardBody>
            <ol className="space-y-4">
              {[
                { when: "Friday · 5:00 PM", what: "Course drop deadline", tone: "warn", note: "In 2 days" },
                { when: "In 3 days · 8:00 AM", what: "Registration time ticket (next term)", tone: "ok", note: "Signed plan active" },
                { when: "Last day of classes", what: "Course withdrawal (W) request deadline", tone: "neutral", note: "0 of 3 W's used" },
              ].map((d) => (
                <li key={d.what} className="flex gap-3">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", d.tone === "warn" ? "bg-warning" : d.tone === "ok" ? "bg-success" : "bg-[#d6d3d1]")} />
                  <div>
                    <div className="text-[14px] font-medium">{d.what}</div>
                    <div className="text-[12.5px] text-muted">
                      {d.when} · {d.note}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {snap?.showSimBadges && <p className="mt-4 border-t border-border pt-3 text-[11.5px] text-muted">Dates are mock data from the simulated Registrar agent.</p>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
