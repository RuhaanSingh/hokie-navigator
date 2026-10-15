import "server-only";
import type { TraceStep } from "@/lib/types";
import { addAlert, addAudit, addNotice, db, touch } from "@/lib/store";
import { sleep, uid } from "@/lib/utils";
import { gateway } from "./gateway";

// Proactive watchdog: notices changes in office systems and acts only within a signed plan (L3); otherwise asks.

function log(label: string, status: TraceStep["status"], level?: TraceStep["level"], detail?: string, agent = "watchdog") {
  db().watchdog.unshift({ id: uid("w-"), agent, label, status, level, detail, ts: Date.now() });
  touch();
}

/** Demo control: a section fills up. `overLimit` moves Plan B to 8:00 AM so it breaks the student's limits. */
export async function fillSection(sectionId: string, overLimit = false) {
  const s = db();
  const sec = s.sections.find((x) => x.id === sectionId);
  if (!sec) return;
  if (overLimit) {
    const b = s.sections.find((x) => x.id === "CS3214-2")!;
    b.time = "MWF 8:00 AM";
    b.startMinutes = 480;
  }
  sec.seats = 0;
  touch();
  await sleep(1400);
  await runPlanCheck(sectionId);
}

export function reopenSection(sectionId: string) {
  const sec = db().sections.find((x) => x.id === sectionId);
  if (sec) sec.seats = 3;
  touch();
}

async function runPlanCheck(filledId: string) {
  const s = db();
  const plan = s.plan;
  const filled = s.sections.find((x) => x.id === filledId)!;
  log(`Seat filled in ${filled.course}-${filled.section} (detected)`, "done", "L0", "Watchdog polls the CS Department agent every 2 s (simulated)");
  if (plan.status !== "signed") {
    log("No signed plan on file — notifying you instead of acting", "blocked", "L0");
    addAlert({ kind: "seat", title: `${filled.course}-${filled.section} just filled`, body: "You have no signed plan, so your agent did nothing. Want to look at other sections?", tone: "warn", action: { label: "Open plans", href: "/plans" } });
    return;
  }
  const idx = plan.steps.findIndex((p) => p.sectionId === filledId);
  const next = plan.steps[idx + 1];
  if (idx < 0 || !next) return;
  const sec = s.sections.find((x) => x.id === next.sectionId)!;
  const check = await gateway.call("department", "check_section", { sectionId: sec.id }, { level: "L0", caller: "Watchdog (Maya's agent)" });
  const credits = plan.baseCredits + sec.credits;
  const timeOk = sec.startMinutes >= plan.limits.earliestMinutes;
  const creditsOk = credits <= plan.limits.maxCredits;
  const seatsOk = check.ok && sec.seats > 0;

  if (timeOk && creditsOk && seatsOk) {
    log(`Checking signed plan: Plan ${next.rank} within limits ✓ (${credits} credits, ${sec.time.replace(/^[A-Z]+ /, "")})`, "done", "L3", `Limits: max ${plan.limits.maxCredits} credits · nothing before ${plan.limits.earliestStart}`);
    const r = await gateway.call("department", "enroll_section", { sectionId: sec.id }, { level: "L3", caller: "Watchdog (Maya's agent)" });
    if (r.ok) {
      log(`L3: Enrolled in ${sec.course}-${sec.section} automatically`, "done", "L3", "Acted inside your signed plan · revocable · logged");
      addAlert({ kind: "seat", title: `Enrolled in ${sec.course}-${sec.section} (Plan ${next.rank})`, body: `Section ${filled.section} filled, so your agent used your signed plan: ${sec.time}, ${credits} credits total. Undo anytime from Plans.`, tone: "ok", action: { label: "View plan", href: "/plans" } });
      addNotice({ title: `Plan ${next.rank} executed: ${sec.course}-${sec.section}`, body: `${filled.course}-${filled.section} filled. Enrolled within your limits (${credits} credits, ${sec.time}).`, tone: "ok" });
      s.stats.delegated++;
    }
    return;
  }
  const why = !timeOk ? `${sec.time} is before your ${plan.limits.earliestStart} limit` : !creditsOk ? `${credits} credits exceeds your ${plan.limits.maxCredits}-credit limit` : "no seats open";
  log(`Checking signed plan: Plan ${next.rank} outside limits ✗ (${why})`, "blocked", "L3");
  log("Stopped: asking Maya instead of acting", "blocked", "L2", "L3 only runs inside the plan's limits");
  s.pendingPlanDecision = { sectionId: sec.id, reason: why };
  addAudit({ caller: "Watchdog (Maya's agent)", office: "personal_agent", action: "plan_step_outside_limits", decision: "blocked", reason: why, dataShared: "Nothing", level: "L3" });
  addAlert({ kind: "plan", title: `Plan ${next.rank} needs your OK`, body: `${filled.course}-${filled.section} filled. Plan ${next.rank} (${sec.course}-${sec.section}) is outside your limits: ${why}. Your agent did not act.`, tone: "warn", action: { label: "Decide", href: "/plans" } });
  addNotice({ title: "Your agent stopped and is asking", body: `Plan ${next.rank} is outside your limits (${why}).`, tone: "warn" });
}

/** Student resolves a stopped plan step (L2: acts only with explicit confirmation). */
export async function decidePlan(choice: "approve" | "next" | "dismiss") {
  const s = db();
  const pending = s.pendingPlanDecision;
  if (!pending) return;
  s.pendingPlanDecision = undefined;
  if (choice === "dismiss") {
    log("Maya chose to do nothing for now", "done", "L2");
    return;
  }
  const targetId = choice === "approve" ? pending.sectionId : s.plan.steps[s.plan.steps.length - 1].sectionId;
  const r = await gateway.call("department", "enroll_section", { sectionId: targetId }, { level: "L2", caller: "Maya's personal agent" });
  const sec = s.sections.find((x) => x.id === targetId)!;
  if (r.ok) {
    log(`L2: Enrolled in ${sec.course}-${sec.section} after your confirmation`, "done", "L2");
    addNotice({ title: `Enrolled in ${sec.course}-${sec.section}`, body: "Done with your confirmation. Logged in your audit trail.", tone: "ok" });
  } else {
    log(`Could not enroll in ${sec.course}-${sec.section}`, "error", "L2", r.message);
  }
}

export function triggerHold() {
  const s = db();
  s.holdActive = true;
  addAlert({
    kind: "hold",
    title: "A Bursar hold was placed on your account",
    body: "Your registration time ticket is in 3 days. A hold would block registration. Your agent can find the fastest fix.",
    tone: "bad",
    action: { label: "Resolve", href: "/assistant?q=hold" },
  });
  addNotice({ title: "Watchdog: new Bursar hold", body: "Registration opens in 3 days. Tap Resolve on your dashboard.", tone: "warn" });
  log("Bursar hold detected on account (registration in 3 days)", "done", "L0");
}

export async function requestHoldReview() {
  const s = db();
  const r = await gateway.call("bursar", "request_hold_review", {}, { level: "L2" });
  if (r.ok) {
    s.holdActive = false;
    for (const a of s.alerts) if (a.kind === "hold") a.resolved = true;
    addNotice({ title: "Hold review requested", body: r.reply.summary, tone: "ok" });
    log("L2: Hold review requested with your approval", "done", "L2");
  }
  return r;
}
