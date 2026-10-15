"use client";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/components/shell/store-provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Architecture } from "@/components/system/architecture";
import { AuditTable } from "@/components/case/audit-table";
import { DemoControls } from "@/components/shell/demo-controls";
import { AgentIcon } from "@/components/shell/agent-icon";
import { OFFICES, OFFICE_ORDER } from "@/data/offices-meta";
import { cn, timeAgo } from "@/lib/utils";

export default function SystemPage() {
  const { snap } = useStore();
  const [controls, setControls] = useState(false);
  if (!snap) return <div className="p-8 text-muted">Loading…</div>;
  const k = snap.kpis;
  const kpis = [
    { label: "Workflow completion", value: `${(k.completionRate * 100).toFixed(1)}%`, sub: `${k.workflows.toLocaleString()} workflows` },
    { label: "Median time to resolution", value: `${k.medianResolutionMin.toFixed(1)} min`, sub: "vs. days across offices today" },
    { label: "Human escalation rate", value: `${(k.escalationRate * 100).toFixed(1)}%`, sub: "Routed to a person by design" },
    { label: "Policy violations", value: String(k.policyViolations), sub: "Blocked at the gateway", good: true },
    { label: "P95 step latency", value: `${(k.p95LatencyMs / 1000).toFixed(2)}s`, sub: "Gateway → office agent" },
    { label: "Trust (delegation rate)", value: `${(k.delegationRate * 100).toFixed(0)}%`, sub: "Students using pre-approved plans" },
    { label: "Satisfaction", value: `${k.satisfaction.toFixed(1)} / 5`, sub: "Post-case survey" },
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">VT Agent Network · live</h2>
          <p className="text-[14px] text-muted">Every call lights up its path. Personal agent → gateway → office agents → systems of record.</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[12.5px] text-muted">
          Mode: <b className="font-semibold capitalize text-text">{snap.mode}</b> · LLM {snap.llmConfigured ? "configured" : "not configured"}
        </span>
      </div>

      <Architecture activity={snap.activity} health={snap.officeHealth} />

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {kpis.map((x) => (
          <div key={x.label} className="rounded-[12px] border border-border bg-white px-4 py-3">
            <div className="text-[12px] leading-tight text-muted">{x.label}</div>
            <div className={cn("mt-1 text-[22px] font-semibold tracking-tight tabular", x.good && "text-success")}>{x.value}</div>
            <div className="text-[11.5px] leading-tight text-muted">{x.sub}</div>
          </div>
        ))}
      </div>
      {snap.showSimBadges && <p className="mt-1.5 text-[11.5px] text-muted">KPIs combine seeded baseline numbers (simulated pilot) with live activity from this session.</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Global audit log</CardTitle>
            <span className="text-[12.5px] text-muted">Every gateway decision</span>
          </CardHeader>
          <CardBody>
            <AuditTable entries={snap.audit} max={80} />
          </CardBody>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Office agent health</CardTitle>
            </CardHeader>
            <ul className="divide-y divide-border">
              {OFFICE_ORDER.map((o) => {
                const h = snap.officeHealth[o];
                return (
                  <li key={o} className="flex items-center gap-3 px-5 py-2.5">
                    <AgentIcon agent={o} className="h-4 w-4 text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium">{OFFICES[o].short}</div>
                      <div className="text-[11.5px] text-muted">
                        {h.calls} calls · {h.errors} errors · checked {timeAgo(h.lastCheck)}
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", h.online ? (h.extraLatencyMs ? "text-warning" : "text-success") : "text-danger")}>
                      <span className={cn("h-2 w-2 rounded-full", h.online ? (h.extraLatencyMs ? "bg-warning" : "bg-success") : "bg-danger pulse-dot")} />
                      {h.online ? (h.extraLatencyMs ? "Slow" : "Healthy") : "Down"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <button onClick={() => setControls((c) => !c)} className="flex w-full items-center gap-2 px-5 py-3.5 text-left" aria-expanded={controls}>
              <SlidersHorizontal className="h-4 w-4 text-muted" />
              <span className="text-[14px] font-semibold">Demo controls</span>
              <span className="text-[12px] text-muted">presenter</span>
              <ChevronDown className={cn("ml-auto h-4 w-4 text-muted transition-transform", controls && "rotate-180")} />
            </button>
            {controls && (
              <div className="border-t border-border px-5 py-4">
                <DemoControls compact />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
