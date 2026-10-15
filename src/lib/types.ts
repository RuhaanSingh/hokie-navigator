// Shared types used by both server (agents, store) and client (UI). No runtime imports here.

export type OfficeId =
  | "dean_of_students"
  | "registrar"
  | "financial_aid"
  | "housing"
  | "iss"
  | "bursar"
  | "department";

export type Level = "L0" | "L1" | "L2" | "L3";
export type Tone = "ok" | "warn" | "bad" | "unknown";
export type Mode = "live" | "hybrid" | "scripted";
export type ConfidenceScore = "high" | "medium" | "low";

export interface ConfidenceCheck {
  name: string;
  passed: boolean;
  note?: string;
}

export interface Confidence {
  score: ConfidenceScore;
  checks: ConfidenceCheck[];
}

export interface Policy {
  id: string;
  office: OfficeId;
  text: string;
  source: string;
}

export interface OptionRow {
  key: "academic" | "scholarship" | "housing" | "visa" | "deadline" | "approvers";
  label: string;
  value: string;
  tone: Tone;
  ruleIds: string[];
}

export interface OptionCard {
  id: "A" | "B" | "C";
  title: string;
  summary: string;
  rows: OptionRow[];
  conflicts: number;
  conflictRules: string[];
  fewestConsequences: boolean;
  approvers: string[];
}

export type StepStatus = "running" | "done" | "blocked" | "error";

export interface TraceStep {
  id: string;
  agent: string;
  label: string;
  status: StepStatus;
  level?: Level;
  detail?: string;
  group?: string;
  ts?: number;
}

export interface WellbeingResource {
  name: string;
  detail: string;
  href: string;
  phone?: string;
}

export type TraceEvent =
  | ({ type: "step" } & TraceStep)
  | { type: "token"; text: string }
  | { type: "sources"; items: { title: string; url: string }[] }
  | { type: "confidence"; score: ConfidenceScore; checks: ConfidenceCheck[] }
  | { type: "options"; caseId: string; options: OptionCard[]; confidence: Confidence; notes: string[] }
  | { type: "approval_request"; caseId: string; action: string; approver: "student" | "staff" }
  | { type: "case_update"; caseId: string }
  | { type: "wellbeing"; urgent: boolean; resources: WellbeingResource[] }
  | { type: "quick_replies"; items: string[] }
  | { type: "meta"; intent: string; source: "llm" | "scripted" }
  | { type: "done" };

export type CaseStatus =
  | "gathering"
  | "awaiting_student"
  | "awaiting_staff"
  | "approved"
  | "executing"
  | "paused"
  | "completed"
  | "rejected";

export interface OfficeResponseSummary {
  office: OfficeId;
  status: "ok" | "error" | "blocked";
  detail: string;
  ms: number;
}

export interface TimelineStep {
  id: string;
  office: OfficeId | "personal_agent";
  label: string;
  detail?: string;
  level: Level | "Staff";
  status: "pending" | "running" | "done" | "error" | "skipped";
  ts?: number;
  draft?: string;
}

export interface CaseRecord {
  id: string;
  title: string;
  summary: string;
  situation: string;
  preference: string;
  status: CaseStatus;
  createdAt: number;
  updatedAt: number;
  officeResponses: OfficeResponseSummary[];
  options: OptionCard[];
  confidence?: Confidence;
  notes: string[];
  selectedOption?: OptionCard["id"];
  staffNote?: string;
  staffDecisionAt?: number;
  stopReason?: string;
  timeline: TimelineStep[];
  pausedOn?: OfficeId;
}

export interface AuditEntry {
  id: string;
  ts: number;
  caller: string;
  office: OfficeId | "gateway" | "personal_agent" | "staff";
  action: string;
  decision: "allowed" | "blocked" | "error";
  reason?: string;
  dataShared: string;
  caseId?: string;
  level?: Level | "Staff";
}

export interface Activity {
  id: string;
  ts: number;
  path: ("channels" | "identity" | "personal" | "gateway" | "approvals" | "router" | "monitoring" | OfficeId)[];
  status: "ok" | "blocked" | "error";
}

export interface Alert {
  id: string;
  ts: number;
  kind: "hold" | "seat" | "deadline" | "plan" | "info";
  title: string;
  body: string;
  tone: Tone;
  action?: { label: string; href: string };
  resolved?: boolean;
}

export interface Notice {
  id: string;
  ts: number;
  title: string;
  body: string;
  tone: Tone;
}

export interface Section {
  id: string;
  course: string;
  section: string;
  title: string;
  credits: number;
  time: string;
  startMinutes: number;
  seats: number;
  capacity: number;
}

export interface Plan {
  id: string;
  term: string;
  goal: string;
  steps: { rank: "A" | "B" | "C"; sectionId: string }[];
  limits: { maxCredits: number; earliestStart: string; earliestMinutes: number };
  signedAt?: number;
  status: "draft" | "signed" | "revoked";
  baseCredits: number;
}

export interface ConsentEntry {
  office: OfficeId;
  allowed: boolean;
  shared: { ts: number; summary: string; caseId?: string }[];
}

export interface OfficeHealth {
  online: boolean;
  extraLatencyMs: number;
  lastCheck: number;
  calls: number;
  errors: number;
}

export interface StaffItem {
  id: string;
  caseId?: string;
  queue: "dean_of_students" | "financial_aid_counselor";
  title: string;
  reason: string;
  ts: number;
  status: "pending" | "approved" | "rejected" | "modified";
}

export interface Kpis {
  completionRate: number;
  medianResolutionMin: number;
  escalationRate: number;
  policyViolations: number;
  p95LatencyMs: number;
  delegationRate: number;
  satisfaction: number;
  workflows: number;
}

export interface Snapshot {
  version: number;
  mode: Mode;
  showSimBadges: boolean;
  llmConfigured: boolean;
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
  kpis: Kpis;
}
