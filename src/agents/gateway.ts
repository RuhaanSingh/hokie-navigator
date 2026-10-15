import "server-only";
import type { Level, OfficeId, TraceEvent } from "@/lib/types";
import { OFFICES } from "@/data/offices-meta";
import { persona } from "@/data/persona";
import { addActivity, addAudit, db, recordLatency, touch } from "@/lib/store";
import { sleep, uid } from "@/lib/utils";
// Office agents are imported ONLY here. The personal agent can reach them solely through gateway.call().
import { registrar } from "./offices/registrar";
import { financialAid } from "./offices/financial-aid";
import { housing } from "./offices/housing";
import { iss } from "./offices/iss";
import { deanOfStudents } from "./offices/dean-of-students";
import { bursar } from "./offices/bursar";
import { department } from "./offices/department";
import type { OfficeHandler, OfficeReply } from "./offices/types";

const HANDLERS: Record<OfficeId, OfficeHandler> = {
  registrar,
  financial_aid: financialAid,
  housing,
  iss,
  dean_of_students: deanOfStudents,
  bursar,
  department,
};

/** Each office's approved tools. Anything else is refused before the office is contacted. */
export const ALLOW_LIST: Record<OfficeId, string[]> = {
  registrar: ["get_student_overview", "get_deadlines", "assess_enrollment_change", "record_incomplete", "record_drop", "record_withdrawal", "answer_question"],
  financial_aid: ["kb_search", "assess_enrollment_change", "confirm_aid_status", "check_disbursement", "answer_question"],
  housing: ["assess_enrollment_change", "confirm_housing", "contract_review", "contract_release", "answer_question"],
  iss: ["assess_enrollment_change", "confirm_status", "request_rcl", "notify_departure", "answer_question"],
  dean_of_students: ["assess_enrollment_change", "receive_case", "protect_deadline", "notify_instructors", "answer_question"],
  bursar: ["get_holds", "assess_hold", "request_hold_review", "answer_question"],
  department: ["list_sections", "check_section", "enroll_section", "answer_question"],
};

export const OUTAGE_TIMEOUT_MS = 4000;

type Emit = (e: TraceEvent) => void;

export interface CallContext {
  caller?: string;
  caseId?: string;
  level?: Level;
  /** Whose record is being requested. Anything but the signed-in student is refused. */
  subjectId?: string;
  emit?: Emit;
  /** If set, the gateway emits this trace row and resolves it with the outcome. */
  step?: { id?: string; label: string; group?: string };
  quiet?: boolean; // no simulated latency (used by background watchdog)
}

export type GatewayResult =
  | { ok: true; reply: OfficeReply; ms: number; shared: string }
  | { ok: false; reason: "consent_revoked" | "not_permitted" | "other_student" | "offline" | "error"; message: string; ms: number };

/**
 * Need-to-know filter: offices receive outcomes, not records. Only the Dean of Students (who coordinates
 * on the student's behalf) receives the student's own words; ISS receives only the reason *category*
 * because its RCL rule depends on it.
 */
function needToKnow(office: OfficeId, action: string, payload: Record<string, unknown>) {
  const { narrative, reasonCategory, ...rest } = payload as Record<string, unknown> & { narrative?: string; reasonCategory?: string };
  if (action !== "assess_enrollment_change") {
    return { payload: rest, shared: describe(action, rest) };
  }
  const out: Record<string, unknown> = { ...rest };
  let shared = "Student may change enrollment (3 options, credit totals only)";
  if (office === "dean_of_students") {
    out.narrative = narrative;
    out.reasonCategory = reasonCategory;
    shared = "Student's summary of the situation + 3 options (shared with consent)";
  } else if (office === "iss") {
    out.reasonCategory = reasonCategory;
    shared = "Reason category only (\"medical, family\") + credit totals; no medical details";
  }
  return { payload: out, shared };
}

function describe(action: string, p: Record<string, unknown>) {
  if (action === "kb_search") return `Question text only: "${String(p.query).slice(0, 60)}"`;
  if (action === "notify_instructors") return `Course names + approved accommodation; no reason shared`;
  if (action === "get_student_overview") return "Student ID only";
  if (action === "check_section" || action === "enroll_section") return `Section ${p.sectionId} only`;
  if (action === "answer_question") return "Question text only";
  return "Case ID and the approved action only";
}

export const gateway = {
  async call(office: OfficeId, action: string, payload: Record<string, unknown> = {}, ctx: CallContext = {}): Promise<GatewayResult> {
    const s = db();
    const started = Date.now();
    const caller = ctx.caller ?? "Maya's personal agent";
    const stepId = ctx.step?.id ?? uid("s-");
    const agentName = OFFICES[office].agent;
    const emitStep = (status: "running" | "done" | "blocked" | "error", label: string, detail?: string) =>
      ctx.step && ctx.emit?.({ type: "step", id: stepId, agent: office, label, status, level: ctx.level, detail, group: ctx.step.group });

    const block = (reason: Extract<GatewayResult, { ok: false }>["reason"], message: string, label: string): GatewayResult => {
      addAudit({ caller, office, action, decision: "blocked", reason: message, dataShared: "Nothing — request stopped at gateway", caseId: ctx.caseId, level: ctx.level });
      addActivity(["personal", "gateway"], "blocked");
      emitStep("blocked", label, message);
      return { ok: false, reason, message, ms: Date.now() - started };
    };

    // 1. Subject check: never another student's record.
    if (ctx.subjectId && ctx.subjectId !== persona.id) {
      return block("other_student", "Request is for another student's record", "Gateway: blocked (another student's record)");
    }
    // 2. Consent ledger.
    const consent = s.consent.find((c) => c.office === office);
    if (!consent?.allowed) {
      return block("consent_revoked", "Not contacted: consent revoked by student", `${OFFICES[office].short}: not contacted (consent revoked by student)`);
    }
    // 3. Allow-list.
    if (!ALLOW_LIST[office].includes(action)) {
      return block("not_permitted", `"${action}" is not an approved ${OFFICES[office].short} tool`, `Gateway: blocked (${action} not permitted)`);
    }

    emitStep("running", ctx.step?.label ?? `Talking to ${agentName}…`);
    const { payload: filtered, shared } = needToKnow(office, action, payload);

    // 4. Simulated latency + demo flags.
    const health = s.officeHealth[office];
    health.calls++;
    if (!health.online) {
      await sleep(ctx.quiet ? 300 : OUTAGE_TIMEOUT_MS);
      health.errors++;
      health.lastCheck = Date.now();
      const msg = `Health check failed · timed out after ${OUTAGE_TIMEOUT_MS / 1000}s`;
      addAudit({ caller, office, action, decision: "error", reason: msg, dataShared: "Nothing delivered", caseId: ctx.caseId, level: ctx.level });
      addActivity(["personal", "gateway", office], "error");
      emitStep("error", `${agentName}: unavailable`, msg);
      touch();
      return { ok: false, reason: "offline", message: msg, ms: Date.now() - started };
    }
    if (!ctx.quiet) await sleep(400 + Math.random() * 1100 + health.extraLatencyMs);

    try {
      const reply = HANDLERS[office](action, filtered);
      const ms = Date.now() - started;
      recordLatency(ms);
      health.lastCheck = Date.now();
      consent.shared.unshift({ ts: Date.now(), summary: `${action.replace(/_/g, " ")} — ${shared}`, caseId: ctx.caseId });
      if (consent.shared.length > 30) consent.shared.length = 30;
      addAudit({ caller, office, action, decision: "allowed", dataShared: shared, caseId: ctx.caseId, level: ctx.level });
      addActivity(["personal", "gateway", office], "ok");
      emitStep("done", ctx.step?.label.replace(/…$/, "") ?? agentName, `${reply.summary} · ${(ms / 1000).toFixed(1)}s`);
      return { ok: true, reply, ms, shared };
    } catch (e) {
      health.errors++;
      const msg = e instanceof Error ? e.message : "Office agent error";
      addAudit({ caller, office, action, decision: "error", reason: msg, dataShared: shared, caseId: ctx.caseId, level: ctx.level });
      addActivity(["personal", "gateway", office], "error");
      emitStep("error", `${agentName}: could not complete`, msg);
      return { ok: false, reason: "error", message: msg, ms: Date.now() - started };
    }
  },

  /** Requests for records that no office tool exposes (e.g. another student's grades) are refused here. */
  refuse(action: string, reason: string, ctx: CallContext) {
    addAudit({ caller: ctx.caller ?? "Maya's personal agent", office: "gateway", action, decision: "blocked", reason, dataShared: "Nothing", caseId: ctx.caseId, level: ctx.level });
    addActivity(["personal", "gateway"], "blocked");
    ctx.emit?.({ type: "step", id: uid("s-"), agent: "gateway", label: "Gateway: blocked (another student's record)", status: "blocked", level: ctx.level, detail: reason });
  },
};
