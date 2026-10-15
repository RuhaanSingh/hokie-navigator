"use client";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Bot, Database, Fingerprint, Gauge, MessageSquare, Network, Route, UserCheck } from "lucide-react";
import type { Activity, OfficeHealth, OfficeId } from "@/lib/types";
import { OFFICES, OFFICE_ORDER } from "@/data/offices-meta";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { AgentIcon } from "@/components/shell/agent-icon";
import { cn } from "@/lib/utils";

type NodeId = Activity["path"][number] | `sor_${OfficeId}`;
const WINDOW_MS = 2600;

const SOR: Record<OfficeId, string> = {
  dean_of_students: "Case notes",
  registrar: "Registration",
  financial_aid: "Aid & scholarships",
  housing: "Housing contracts",
  iss: "Immigration records",
  bursar: "Student accounts",
  department: "Section inventory",
};

function useRefs<T extends string>(ids: readonly T[]) {
  const store = useRef<Record<string, RefObject<HTMLDivElement | null>>>({});
  for (const id of ids) store.current[id] ??= { current: null };
  return store.current as Record<T, RefObject<HTMLDivElement | null>>;
}

function Node({ r, active, tone, icon, title, sub, small, offline }: { r: RefObject<HTMLDivElement | null>; active: boolean; tone?: "ok" | "blocked" | "error"; icon: ReactNode; title: string; sub?: string; small?: boolean; offline?: boolean }) {
  return (
    <div
      ref={r}
      className={cn(
        "relative z-10 flex w-full min-w-0 items-center gap-2 rounded-[10px] border bg-white transition-colors duration-300",
        small ? "px-2.5 py-1.5" : "px-3 py-2.5",
        active ? (tone === "error" ? "border-danger bg-[#fef2f2]" : tone === "blocked" ? "border-warning bg-[#fffbeb]" : "node-ping border-primary bg-primary-tint") : offline ? "border-[#fecaca] bg-[#fef2f2]" : "border-border",
      )}
    >
      <span className={cn("hidden shrink-0 items-center justify-center rounded-[7px] min-[1360px]:flex", small ? "h-6 w-6" : "h-7 w-7", active ? "bg-white text-primary" : "bg-surface text-muted")}>{icon}</span>
      <div className="min-w-0 leading-tight">
        <div className={cn("break-words font-medium text-text", small ? "text-[12px]" : "text-[13px]")}>{title}</div>
        {sub && <div className="break-words text-[11px] text-muted">{sub}</div>}
      </div>
      {offline && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-danger" aria-label="offline" />}
    </div>
  );
}

export function Architecture({ activity, health }: { activity: Activity[]; health: Record<OfficeId, OfficeHealth> }) {
  const container = useRef<HTMLDivElement>(null);
  const ids = ["channels", "identity", "personal", "gateway", "approvals", "router", "monitoring", ...OFFICE_ORDER, ...OFFICE_ORDER.map((o) => `sor_${o}` as const)] as const;
  const refs = useRefs<NodeId>(ids as unknown as NodeId[]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(t);
  }, []);

  const recent = activity.filter((a) => now - a.ts < WINDOW_MS);
  const nodeState = (id: NodeId): { active: boolean; tone?: "ok" | "blocked" | "error" } => {
    if (id.startsWith("sor_")) {
      const o = id.slice(4);
      const hit = recent.find((a) => a.path.includes(o as OfficeId) && a.status === "ok");
      return { active: Boolean(hit), tone: "ok" };
    }
    const hit = recent.find((a) => a.path.includes(id as Activity["path"][number]));
    if (!hit) return { active: false };
    const last = hit.path[hit.path.length - 1] === id;
    return { active: true, tone: last && hit.status !== "ok" ? hit.status : "ok" };
  };
  const edgeState = (from: NodeId, to: NodeId) => {
    if (to.startsWith("sor_")) {
      const o = to.slice(4) as OfficeId;
      return { active: recent.some((a) => a.path.includes(o) && a.status === "ok"), tone: "ok" as const };
    }
    const hit = recent.find((a) => {
      const i = a.path.indexOf(from as Activity["path"][number]);
      const j = a.path.indexOf(to as Activity["path"][number]);
      return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
    });
    return { active: Boolean(hit), tone: hit?.status ?? ("ok" as const) };
  };

  const beam = (from: NodeId, to: NodeId, curvature = 0) => {
    const e = edgeState(from, to);
    return <AnimatedBeam key={`${from}-${to}`} containerRef={container} fromRef={refs[from]} toRef={refs[to]} curvature={curvature} active={e.active} tone={e.tone} />;
  };

  return (
    <div ref={container} className="relative overflow-hidden rounded-[12px] border border-border bg-[radial-gradient(#e7e5e4_1px,transparent_1px)] [background-size:18px_18px] p-5">
      <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.2fr)_minmax(0,1.2fr)] items-center gap-x-6 [&>div]:min-w-0">
        <div className="space-y-1">
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted">Student channels</div>
          <Node r={refs.channels} {...nodeState("channels")} icon={<MessageSquare className="h-3.5 w-3.5" />} title="Web · mobile" sub="SMS · voice (future)" />
        </div>
        <div>
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted">Identity + consent</div>
          <Node r={refs.identity} {...nodeState("identity")} icon={<Fingerprint className="h-3.5 w-3.5" />} title="VT SSO + Duo" sub="Consent ledger" />
        </div>
        <div>
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted">Personal agent</div>
          <Node r={refs.personal} {...nodeState("personal")} icon={<Bot className="h-3.5 w-3.5" />} title="Maya's agent" sub="Works only for her" />
        </div>
        <div>
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted">Agent gateway</div>
          <Node r={refs.gateway} {...nodeState("gateway")} icon={<Network className="h-3.5 w-3.5" />} title="Gateway" sub="Consent · policy · audit" />
        </div>
        <div className="space-y-1.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">Office agents (simulated)</div>
          {OFFICE_ORDER.map((o) => (
            <Node key={o} r={refs[o]} {...nodeState(o)} small offline={!health[o].online} icon={<AgentIcon agent={o} />} title={OFFICES[o].short} />
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">Systems of record</div>
          {OFFICE_ORDER.map((o) => (
            <Node key={o} r={refs[`sor_${o}`]} {...nodeState(`sor_${o}`)} small icon={<Database className="h-3 w-3" />} title={SOR[o]} />
          ))}
        </div>
      </div>
      <div className="mt-8 grid grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.2fr)_minmax(0,1.2fr)] gap-x-6 border-t border-dashed border-[#d6d3d1] pt-5 [&>div]:min-w-0">
        <div className="col-span-2 self-center text-[11.5px] leading-snug text-muted">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider">Shared services</div>
          Used by every agent. Staff approvals keep people in charge of sensitive decisions.
        </div>
        <div>
          <Node r={refs.router} {...nodeState("router")} icon={<Route className="h-3.5 w-3.5" />} title="Model router" sub="Groq · scripted fallback" />
        </div>
        <div>
          <Node r={refs.approvals} {...nodeState("approvals")} icon={<UserCheck className="h-3.5 w-3.5" />} title="Staff approvals" sub="People decide" />
        </div>
        <div>
          <Node r={refs.monitoring} {...nodeState("monitoring")} icon={<Gauge className="h-3.5 w-3.5" />} title="Monitoring + evals" sub="Health · latency · audit" />
        </div>
      </div>

      {beam("channels", "identity")}
      {beam("identity", "personal")}
      {beam("personal", "gateway")}
      {OFFICE_ORDER.map((o) => beam("gateway", o))}
      {OFFICE_ORDER.map((o) => beam(o, `sor_${o}`))}
      {beam("personal", "router")}
      {beam("personal", "approvals")}
      {beam("gateway", "approvals")}
      {beam("gateway", "monitoring")}
    </div>
  );
}
