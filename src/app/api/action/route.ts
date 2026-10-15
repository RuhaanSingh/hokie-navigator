import { z } from "zod";
import { addAudit, addNotice, db, resetStore, snapshot, touch } from "@/lib/store";
import { staffDecide, submitForApproval } from "@/agents/case-pipeline";
import { decidePlan, fillSection, reopenSection, requestHoldReview, triggerHold } from "@/agents/watchdog";
import { OFFICE_ORDER } from "@/data/offices-meta";
import type { OfficeId } from "@/lib/types";

export const dynamic = "force-dynamic";

const office = z.enum(OFFICE_ORDER as [OfficeId, ...OfficeId[]]);
const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reset") }),
  z.object({ type: z.literal("office_online"), office, online: z.boolean() }),
  z.object({ type: z.literal("office_latency"), office, ms: z.number().min(0).max(10000) }),
  z.object({ type: z.literal("fill_section"), sectionId: z.string(), overLimit: z.boolean().optional() }),
  z.object({ type: z.literal("reopen_section"), sectionId: z.string() }),
  z.object({ type: z.literal("trigger_hold") }),
  z.object({ type: z.literal("mode"), mode: z.enum(["live", "hybrid", "scripted"]) }),
  z.object({ type: z.literal("sim_badges"), on: z.boolean() }),
  z.object({ type: z.literal("consent"), office, allowed: z.boolean() }),
  z.object({ type: z.literal("submit_option"), caseId: z.string(), option: z.enum(["A", "B", "C"]) }),
  z.object({ type: z.literal("staff_decide"), caseId: z.string(), decision: z.enum(["approve", "reject"]), note: z.string().max(500).optional() }),
  z.object({ type: z.literal("plan_decide"), choice: z.enum(["approve", "next", "dismiss"]) }),
  z.object({ type: z.literal("plan_status"), status: z.enum(["signed", "revoked"]) }),
  z.object({ type: z.literal("plan_limits"), maxCredits: z.number().min(12).max(21), earliestMinutes: z.number().min(420).max(720) }),
  z.object({ type: z.literal("hold_review") }),
  z.object({ type: z.literal("dismiss_alert"), id: z.string() }),
]);

const fmt = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`;

export async function POST(req: Request) {
  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid action" }, { status: 400 });
  const a = parsed.data;
  const s = db();
  try {
    switch (a.type) {
      case "reset":
        resetStore();
        break;
      case "office_online":
        s.officeHealth[a.office].online = a.online;
        s.officeHealth[a.office].lastCheck = Date.now();
        addAudit({ caller: "Monitoring", office: a.office, action: a.online ? "health_restored" : "health_check_failed", decision: a.online ? "allowed" : "error", dataShared: "—", reason: a.online ? undefined : "Office agent offline (demo control)" });
        break;
      case "office_latency":
        s.officeHealth[a.office].extraLatencyMs = a.ms;
        touch();
        break;
      case "fill_section":
        void fillSection(a.sectionId, a.overLimit);
        break;
      case "reopen_section":
        reopenSection(a.sectionId);
        break;
      case "trigger_hold":
        triggerHold();
        break;
      case "mode":
        s.mode = a.mode;
        touch();
        break;
      case "sim_badges":
        s.showSimBadges = a.on;
        touch();
        break;
      case "consent": {
        const c = s.consent.find((x) => x.office === a.office)!;
        c.allowed = a.allowed;
        addAudit({ caller: "Maya (student)", office: a.office, action: a.allowed ? "consent_granted" : "consent_revoked", decision: "allowed", dataShared: "—" });
        addNotice({ title: a.allowed ? "Consent restored" : "Consent revoked", body: `Your agent ${a.allowed ? "may contact" : "will not contact"} this office.`, tone: a.allowed ? "ok" : "warn" });
        break;
      }
      case "submit_option":
        submitForApproval(a.caseId, a.option);
        break;
      case "staff_decide":
        staffDecide(a.caseId, a.decision, a.note);
        break;
      case "plan_decide":
        await decidePlan(a.choice);
        break;
      case "plan_status":
        s.plan.status = a.status;
        if (a.status === "signed") s.plan.signedAt = Date.now();
        addAudit({ caller: "Maya (student)", office: "personal_agent", action: a.status === "signed" ? "sign_plan" : "revoke_plan", decision: "allowed", dataShared: "—", level: "L3" });
        break;
      case "plan_limits":
        s.plan.limits = { maxCredits: a.maxCredits, earliestMinutes: a.earliestMinutes, earliestStart: fmt(a.earliestMinutes) };
        s.plan.status = "draft";
        touch();
        break;
      case "hold_review":
        await requestHoldReview();
        break;
      case "dismiss_alert": {
        const al = s.alerts.find((x) => x.id === a.id);
        if (al) al.resolved = true;
        touch();
        break;
      }
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Action failed" }, { status: 400 });
  }
  return Response.json(snapshot());
}
