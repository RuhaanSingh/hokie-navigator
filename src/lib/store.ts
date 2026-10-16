import "server-only";
import type {
  Activity,
  Alert,
  AuditEntry,
  CaseRecord,
  ConsentEntry,
  Kpis,
  Mode,
  Notice,
  OfficeHealth,
  OfficeId,
  Plan,
  Section,
  Snapshot,
  StaffItem,
  TraceStep,
} from "./types";
import { OFFICE_ORDER } from "@/data/offices-meta";
import { SECTIONS, NEXT_TERM_BASE } from "@/data/offices/department";
import { uid } from "./utils";

// Server-side in-memory store. A globalThis singleton so every route handler (and HMR reload) shares one copy,
// which keeps the student window and staff window in sync. State does not survive a server restart (by design).

interface State {
  version: number;
  mode: Mode;
  showSimBadges: boolean;
  caseCounter: number;
  officeHealth: Record<OfficeId, OfficeHealth>;
  consent: ConsentEntry[];
  cases: CaseRecord[];
  staffQueue: StaffItem[];
  plan: Plan;
  sections: Section[];
  nextTermSchedule: string[];
  audit: AuditEntry[];
  activity: Activity[];
  alerts: Alert[];
  notices: Notice[];
  watchdog: TraceStep[];
  pendingPlanDecision?: { sectionId: string; reason: string };
  holdActive: boolean;
  kpiBase: Kpis;
  stats: { workflows: number; completed: number; escalations: number; latencies: number[]; delegated: number };
}

const DAY = 86_400_000;

function fresh(): State {
  const now = Date.now();
  const health = {} as Record<OfficeId, OfficeHealth>;
  for (const o of OFFICE_ORDER) health[o] = { online: true, extraLatencyMs: 0, lastCheck: now, calls: 0, errors: 0 };
  return {
    version: 1,
    mode: (process.env.DEMO_MODE as Mode) || "hybrid",
    showSimBadges: true,
    caseCounter: 2041,
    officeHealth: health,
    consent: OFFICE_ORDER.map((office) => ({ office, allowed: true, shared: [] })),
    cases: [],
    staffQueue: [],
    plan: {
      id: "plan-spring",
      term: "Spring (next term)",
      goal: "Get into CS 3214 for next term",
      steps: [
        { rank: "A", sectionId: "CS3214-1" },
        { rank: "B", sectionId: "CS3214-2" },
        { rank: "C", sectionId: "STAT4714-1" },
      ],
      limits: { maxCredits: 17, earliestStart: "9:00 AM", earliestMinutes: 540 },
      status: "signed",
      signedAt: new Date(new Date(now).getFullYear(), 9, 12, 14, 30).getTime(),
      baseCredits: 12,
    },
    sections: SECTIONS.map((s) => ({ ...s })),
    nextTermSchedule: [...NEXT_TERM_BASE],
    audit: [
      {
        id: uid("a-"),
        ts: now - 2 * DAY,
        caller: "John's personal agent",
        office: "registrar",
        action: "get_student_overview",
        decision: "allowed",
        dataShared: "Student ID only",
        level: "L0",
      },
      {
        id: uid("a-"),
        ts: now - 3 * DAY,
        caller: "John (student)",
        office: "personal_agent",
        action: "sign_plan",
        decision: "allowed",
        dataShared: "Signed pre-approved registration plan (CS 3214)",
        level: "L3",
      },
    ],
    activity: [],
    alerts: [
      {
        id: "al-deadline",
        ts: now - 3_600_000,
        kind: "deadline",
        title: "Course drop deadline is Friday at 5:00 PM",
        body: "Your agent is watching this date. If anything changes in your plans, start a conversation before Friday.",
        tone: "warn",
        action: { label: "Talk to your agent", href: "/assistant" },
      },
      {
        id: "al-ticket",
        ts: now - 7_200_000,
        kind: "plan",
        title: "Registration opens for you in 3 days",
        body: "Your signed plan for CS 3214 is active. Your agent will act only within the limits you set.",
        tone: "ok",
        action: { label: "View plan", href: "/plans" },
      },
    ],
    notices: [],
    watchdog: [],
    holdActive: false,
    kpiBase: {
      completionRate: 0.91,
      medianResolutionMin: 4.2,
      escalationRate: 0.18,
      policyViolations: 0,
      p95LatencyMs: 1480,
      delegationRate: 0.64,
      satisfaction: 4.6,
      workflows: 1284,
    },
    stats: { workflows: 0, completed: 0, escalations: 0, latencies: [], delegated: 0 },
  };
}

const g = globalThis as unknown as { __hokieStore?: State };

export function db(): State {
  if (!g.__hokieStore) g.__hokieStore = fresh();
  return g.__hokieStore;
}

export function touch() {
  db().version++;
}

export function resetStore() {
  const keepMode = db().mode;
  g.__hokieStore = fresh();
  g.__hokieStore.mode = keepMode;
  g.__hokieStore.version = Date.now() % 1_000_000;
}

export function nextCaseId() {
  return `NAV-${db().caseCounter++}`;
}

export function addAudit(e: Omit<AuditEntry, "id" | "ts">) {
  const entry = { ...e, id: uid("a-"), ts: Date.now() };
  db().audit.unshift(entry);
  if (db().audit.length > 400) db().audit.length = 400;
  touch();
  return entry;
}

export function addActivity(path: Activity["path"], status: Activity["status"] = "ok") {
  db().activity.unshift({ id: uid("ac-"), ts: Date.now(), path, status });
  if (db().activity.length > 60) db().activity.length = 60;
  touch();
}

export function addNotice(n: Omit<Notice, "id" | "ts">) {
  db().notices.unshift({ ...n, id: uid("n-"), ts: Date.now() });
  if (db().notices.length > 20) db().notices.length = 20;
  touch();
}

export function addAlert(a: Omit<Alert, "id" | "ts">) {
  const alert = { ...a, id: uid("al-"), ts: Date.now() };
  db().alerts.unshift(alert);
  touch();
  return alert;
}

export function getCase(id: string) {
  return db().cases.find((c) => c.id === id);
}

export function saveCase(c: CaseRecord) {
  const s = db();
  const i = s.cases.findIndex((x) => x.id === c.id);
  c.updatedAt = Date.now();
  if (i >= 0) s.cases[i] = c;
  else s.cases.unshift(c);
  touch();
}

export function recordLatency(ms: number) {
  const l = db().stats.latencies;
  l.push(ms);
  if (l.length > 200) l.shift();
}

function kpis(s: State): Kpis {
  const b = s.kpiBase;
  const n = b.workflows;
  const w = s.stats.workflows;
  const lat = [...s.stats.latencies].sort((a, b) => a - b);
  const p95 = lat.length >= 5 ? lat[Math.floor(lat.length * 0.95) - 1] : b.p95LatencyMs;
  return {
    workflows: n + w,
    completionRate: (b.completionRate * n + s.stats.completed) / (n + Math.max(w, s.stats.completed)),
    medianResolutionMin: b.medianResolutionMin,
    escalationRate: (b.escalationRate * n + s.stats.escalations) / (n + w || 1),
    policyViolations: 0,
    p95LatencyMs: Math.round(p95),
    delegationRate: (b.delegationRate * n + s.stats.delegated) / (n + Math.max(w, s.stats.delegated)),
    satisfaction: b.satisfaction,
  };
}

export function snapshot(): Snapshot {
  const s = db();
  return {
    version: s.version,
    mode: s.mode,
    showSimBadges: s.showSimBadges,
    llmConfigured: Boolean(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_BACKUP),
    officeHealth: s.officeHealth,
    consent: s.consent,
    cases: s.cases,
    staffQueue: s.staffQueue,
    plan: s.plan,
    sections: s.sections,
    nextTermSchedule: s.nextTermSchedule,
    audit: s.audit.slice(0, 200),
    activity: s.activity.slice(0, 30),
    alerts: s.alerts,
    notices: s.notices,
    watchdog: s.watchdog.slice(0, 40),
    pendingPlanDecision: s.pendingPlanDecision,
    holdActive: s.holdActive,
    kpis: kpis(s),
  };
}
