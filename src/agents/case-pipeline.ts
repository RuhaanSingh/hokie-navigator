import "server-only";
import type { CaseRecord, Level, OfficeId, OptionCard, TimelineStep, TraceEvent } from "@/lib/types";
import { CASE_OFFICES, OFFICES } from "@/data/offices-meta";
import { persona } from "@/data/persona";
import { policyById } from "@/data/policies";
import { addAudit, addActivity, db, getCase, nextCaseId, saveCase, touch } from "@/lib/store";
import { sleep, uid } from "@/lib/utils";
import { gateway } from "./gateway";
import { evaluate, OPTION_DEFS, type OfficeOutcome } from "./consequence-engine";

type Emit = (e: TraceEvent) => void;

const step = (emit: Emit, agent: string, label: string, status: "running" | "done" | "blocked" | "error" = "done", level?: Level, detail?: string, id = uid("s-")) => {
  emit({ type: "step", id, agent, label, status, level, detail });
  return id;
};

export interface CaseResult {
  caseId: string;
  options: OptionCard[];
  summaryForLlm: string;
  fewest: OptionCard;
  notes: string[];
  outage: OfficeId[];
  revoked: OfficeId[];
}

/** Scenario A: open a case and fan out to five office agents in parallel through the gateway. */
export async function openCase(input: { summary: string; situation: string; preference: string; narrative: string; autoSelect?: OptionCard["id"] }, emit: Emit): Promise<CaseResult> {
  const s = db();
  const caseId = nextCaseId();
  s.stats.workflows++;
  const rec: CaseRecord = {
    id: caseId,
    title: "Family emergency — classes this semester",
    summary: input.summary,
    situation: input.situation,
    preference: input.preference,
    status: "gathering",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    officeResponses: [],
    options: [],
    notes: [],
    timeline: [],
  };
  saveCase(rec);
  addActivity(["channels", "identity", "personal"]);

  step(emit, "personal_agent", `Opening case #${caseId}`, "done", "L1", "Situation: family medical emergency · goal: " + input.preference);

  // Consent check (the gateway enforces it again on every call; this row makes it visible up front).
  const allowed = CASE_OFFICES.filter((o) => s.consent.find((c) => c.office === o)?.allowed);
  const revokedOffices = CASE_OFFICES.filter((o) => !allowed.includes(o));
  const cid = step(emit, "gateway", "Gateway: checking consent ledger…", "running", "L0");
  await sleep(450);
  step(emit, "gateway", `Gateway: consent verified for ${allowed.length} office${allowed.length === 1 ? "" : "s"}`, "done", "L0", allowed.map((o) => OFFICES[o].short).join(" · ") + (revokedOffices.length ? ` — revoked: ${revokedOffices.map((o) => OFFICES[o].short).join(", ")}` : ""), cid);
  addActivity(["personal", "gateway"]);

  // Parallel fan-out ("parallel in thinking").
  const payload = {
    studentId: persona.id,
    currentCredits: persona.credits,
    options: OPTION_DEFS.map((o) => ({ id: o.id, label: o.title, creditsAfter: o.creditsAfter })),
    reasonCategory: "medical (family)",
    leavingCountry: true,
    narrative: input.narrative,
  };
  const outcomes: OfficeOutcome[] = await Promise.all(
    CASE_OFFICES.map(async (office): Promise<OfficeOutcome> => {
      const r = await gateway.call(office, "assess_enrollment_change", payload, {
        caseId,
        level: "L0",
        emit,
        step: { label: `Talking to ${OFFICES[office].agent}…`, group: "fanout" },
      });
      if (r.ok) return { office, ok: true, reply: r.reply };
      return { office, ok: false, reason: r.reason, message: r.message };
    }),
  );

  rec.officeResponses = outcomes.map((o) => ({
    office: o.office,
    status: o.ok ? "ok" : o.reason === "consent_revoked" ? "blocked" : "error",
    detail: o.ok ? o.reply.summary : o.message,
    ms: 0,
  }));

  // Consequence engine.
  const cid2 = step(emit, "consequence_engine", "Consequence engine: comparing 3 options across office rules…", "running", "L0");
  await sleep(600);
  const ev = evaluate(outcomes);
  step(emit, "consequence_engine", "Consequence engine: 3 options evaluated", "done", "L0", undefined, cid2);
  const sch = policyById("SCH-2")!;
  if (outcomes.find((o) => o.office === "financial_aid")?.ok) step(emit, "policy", `Policy check: Scholarship rule ${sch.id} (requires 12+ credits)`, "done", "L0", sch.source);
  if (outcomes.find((o) => o.office === "iss")?.ok) step(emit, "policy", "Policy check: ISS rule ISS-1 (F-1 full-time unless RCL authorized)", "done", "L0", policyById("ISS-1")!.source);
  for (const c of ev.conflictsFound) {
    step(emit, "consequence_engine", `Conflict detected: Option ${c.option} breaks ${c.rules.length} office rule${c.rules.length === 1 ? "" : "s"}`, "blocked", "L0", c.rules.join(", ") + " — the agent will not pick a side; staff decide");
  }

  const outage = outcomes.filter((o) => !o.ok && o.reason !== "consent_revoked").map((o) => o.office);
  const revoked = outcomes.filter((o) => !o.ok && o.reason === "consent_revoked").map((o) => o.office);

  if (outage.length) {
    step(emit, "personal_agent", "Nothing irreversible executed", "done", "L0");
    step(emit, "personal_agent", `Case paused on ${outage.map((o) => OFFICES[o].short).join(", ")} step`, "blocked", "L0");
    if (outage.includes("financial_aid")) {
      s.staffQueue.unshift({ id: uid("q-"), caseId, queue: "financial_aid_counselor", title: `#${caseId}: scholarship impact needed`, reason: "Financial Aid agent unavailable during case evaluation", ts: Date.now(), status: "pending" });
      addAudit({ caller: "Ruhaan's personal agent", office: "staff", action: "route_to_counselor_queue", decision: "allowed", dataShared: "Case ID + question: scholarship impact of 3 options", caseId, level: "L1" });
      step(emit, "personal_agent", "Routed to financial aid counselor queue", "done", "L1");
      addActivity(["personal", "approvals"]);
    }
    await gateway.call("dean_of_students", "protect_deadline", {}, { caseId, level: "L1", emit, step: { label: "Dean of Students notified to protect Friday deadline" } });
    rec.pausedOn = outage[0];
    s.stats.escalations++;
  }

  rec.options = ev.options;
  rec.confidence = ev.confidence;
  rec.notes = ev.notes;
  rec.status = "awaiting_student";
  saveCase(rec);

  // The student already told us which option they want and asked for it to go forward: send it for staff approval now.
  if (input.autoSelect) {
    const opt = ev.options.find((o) => o.id === input.autoSelect)!;
    const sid = step(emit, "personal_agent", `You asked for Option ${opt.id} (${opt.title}): preparing your case file…`, "running", "L2");
    await sleep(500);
    submitForApproval(caseId, input.autoSelect);
    step(emit, "personal_agent", `Option ${opt.id} sent to Dean of Students for approval`, "done", "L2", "Your request counts as your confirmation. Nothing executes until staff approve.", sid);
    step(emit, "approvals", "Waiting on Dean of Students: always-staff-approved action", "blocked", undefined, getCase(caseId)?.stopReason);
  }

  emit({ type: "confidence", score: ev.confidence.score, checks: ev.confidence.checks });
  emit({ type: "options", caseId, options: ev.options, confidence: ev.confidence, notes: ev.notes, autoSubmitted: input.autoSelect });
  emit({ type: "case_update", caseId });

  const fewest = ev.options.find((o) => o.fewestConsequences)!;
  const summaryForLlm = [
    `Case #${caseId} opened. Office agents consulted: ${CASE_OFFICES.map((o) => OFFICES[o].short).join(", ")}.`,
    ...ev.options.map((o) => `Option ${o.id} (${o.title}): ${o.rows.filter((r) => r.key !== "approvers").map((r) => `${r.label}: ${r.value}`).join("; ")}. Conflicts: ${o.conflicts}.`),
    `Fewest consequences: Option ${fewest.id} (${fewest.title}).`,
    ...ev.notes,
    `Confidence: ${ev.confidence.score}.`,
    "The comparison card is already shown to the student. Do not repeat the table. Do not choose for the student.",
  ].join("\n");
  return { caseId, options: ev.options, summaryForLlm, fewest, notes: ev.notes, outage, revoked };
}

/** Student picked an option and asked to send it for staff approval (always-staff-approved action). */
export function submitForApproval(caseId: string, optionId: OptionCard["id"]) {
  const s = db();
  const c = getCase(caseId);
  if (!c) throw new Error("Case not found");
  c.selectedOption = optionId;
  c.status = "awaiting_staff";
  const opt = c.options.find((o) => o.id === optionId)!;
  c.stopReason = `Action requires staff approval (${optionId === "C" ? "Medical withdrawal" : optionId === "B" ? "Incomplete" : "Reduced course load"} policy, DOS-2)`;
  s.staffQueue.unshift({ id: uid("q-"), caseId, queue: "dean_of_students", title: `#${caseId}: ${opt.title}`, reason: c.stopReason, ts: Date.now(), status: "pending" });
  addAudit({ caller: "Ruhaan (student)", office: "personal_agent", action: `select_option_${optionId}`, decision: "allowed", dataShared: `Chose Option ${optionId}: ${opt.title}`, caseId, level: "L2" });
  // Fire-and-forget: deliver the packet to the Dean of Students agent (through the gateway).
  void gateway.call("dean_of_students", "receive_case", {}, { caseId, level: "L1" });
  addActivity(["personal", "gateway", "approvals"]);
  saveCase(c);
  return c;
}

export function staffDecide(caseId: string, decision: "approve" | "reject", note?: string) {
  const s = db();
  const c = getCase(caseId);
  if (!c) throw new Error("Case not found");
  const item = s.staffQueue.find((q) => q.caseId === caseId && q.queue === "dean_of_students" && q.status === "pending");
  if (item) item.status = decision === "approve" ? (note ? "modified" : "approved") : "rejected";
  c.staffNote = note;
  c.staffDecisionAt = Date.now();
  addAudit({ caller: "Dean of Students (staff)", office: "staff", action: decision === "approve" ? `approve_option_${c.selectedOption}` : "reject", decision: "allowed", dataShared: note ? `Note: ${note}` : "No note", caseId, level: "Staff" });
  addActivity(["approvals", "personal"]);
  if (decision === "reject") {
    c.status = "rejected";
    saveCase(c);
    return c;
  }
  c.status = "approved";
  c.timeline = planExecution(c);
  saveCase(c);
  void execute(caseId);
  return c;
}

function planExecution(c: CaseRecord): TimelineStep[] {
  const mk = (office: TimelineStep["office"], label: string, level: TimelineStep["level"]): TimelineStep => ({ id: uid("t-"), office, label, level, status: "pending" });
  const staff = mk("dean_of_students", `Dean of Students approved Option ${c.selectedOption}`, "Staff");
  staff.status = "done";
  staff.ts = c.staffDecisionAt;
  staff.detail = c.staffNote ? `Note: “${c.staffNote}”` : "Approved without changes";
  const close = mk("personal_agent", "Close the loop: confirmation sent to Ruhaan", "L1");
  if (c.selectedOption === "B")
    return [
      staff,
      mk("dean_of_students", "Dean of Students notifies instructors", "L2"),
      mk("registrar", "Registrar records Incomplete requests", "L2"),
      mk("financial_aid", "Financial Aid confirms scholarship status", "L0"),
      mk("housing", "Housing confirms contract status", "L0"),
      mk("iss", "ISS confirms F-1 status", "L0"),
      close,
    ];
  if (c.selectedOption === "A")
    return [
      staff,
      mk("iss", "ISS files Reduced Course Load request (must be authorized before any drop)", "L2"),
      mk("financial_aid", "Financial Aid opens scholarship review", "L2"),
      mk("housing", "Housing opens contract review", "L2"),
      mk("registrar", "Registrar holds drop requests until ISS authorizes", "L1"),
      close,
    ];
  return [
    staff,
    mk("iss", "ISS notified before departure", "L2"),
    mk("registrar", "Registrar records medical withdrawal", "L2"),
    mk("financial_aid", "Financial Aid prorates scholarship", "L2"),
    mk("housing", "Housing starts contract release", "L2"),
    mk("dean_of_students", "Dean of Students notifies instructors", "L2"),
    close,
  ];
}

const ACTIONS: Record<string, [OfficeId, string, Record<string, unknown>]> = {
  "Dean of Students notifies instructors": ["dean_of_students", "notify_instructors", { courses: ["CS 3214", "STAT 4705"] }],
  "Registrar records Incomplete requests": ["registrar", "record_incomplete", { courses: ["CS 3214", "STAT 4705"] }],
  "Financial Aid confirms scholarship status": ["financial_aid", "confirm_aid_status", { option: "B" }],
  "Housing confirms contract status": ["housing", "confirm_housing", {}],
  "ISS confirms F-1 status": ["iss", "confirm_status", {}],
  "ISS files Reduced Course Load request (must be authorized before any drop)": ["iss", "request_rcl", {}],
  "Financial Aid opens scholarship review": ["financial_aid", "confirm_aid_status", { option: "A" }],
  "Housing opens contract review": ["housing", "contract_review", {}],
  "Registrar holds drop requests until ISS authorizes": ["registrar", "record_drop", { courses: ["CS 3214", "STAT 4705"] }],
  "ISS notified before departure": ["iss", "notify_departure", {}],
  "Registrar records medical withdrawal": ["registrar", "record_withdrawal", {}],
  "Financial Aid prorates scholarship": ["financial_aid", "confirm_aid_status", { option: "C" }],
  "Housing starts contract release": ["housing", "contract_release", {}],
};

/** Serialized execution: one step at a time, each through the gateway, each audited. */
async function execute(caseId: string) {
  const s = db();
  const c = getCase(caseId);
  if (!c) return;
  c.status = "executing";
  saveCase(c);
  await sleep(900);
  let failed = false;
  for (const t of c.timeline) {
    if (t.status === "done") continue;
    if (failed) {
      t.status = "skipped";
      continue;
    }
    t.status = "running";
    t.ts = Date.now();
    touch();
    if (t.office === "personal_agent") {
      await sleep(700);
      t.status = "done";
      t.detail = "Summary, next steps and the full audit trail are in your case.";
      addAudit({ caller: "Ruhaan's personal agent", office: "personal_agent", action: "close_the_loop", decision: "allowed", dataShared: "Confirmation to student only", caseId, level: "L1" });
      touch();
      continue;
    }
    const a = ACTIONS[t.label];
    const r = await gateway.call(a[0], a[1], a[2], { caseId, level: t.level === "Staff" ? undefined : t.level });
    if (r.ok) {
      t.status = "done";
      t.detail = r.reply.summary;
      const drafts = (r.reply.data as { drafts?: string[] } | undefined)?.drafts;
      if (drafts) t.draft = drafts.join("\n\n———\n\n");
    } else {
      t.status = "error";
      t.detail = `${r.message}. Nothing irreversible executed; routed to a human.`;
      failed = true;
      c.pausedOn = t.office as OfficeId;
    }
    t.ts = Date.now();
    touch();
    await sleep(500);
  }
  c.status = failed ? "paused" : "completed";
  if (!failed) {
    s.stats.completed++;
    s.stats.delegated++;
  }
  saveCase(c);
}
