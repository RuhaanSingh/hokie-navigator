import "server-only";
import { registrarRecord as rec } from "@/data/offices/registrar";
import { kbReply } from "./kb";
import type { EnrollmentChangeRequest, OfficeHandler } from "./types";

// Simulated Registrar agent: sole holder of access to the (mock) registration system.
export const registrar: OfficeHandler = (action, payload) => {
  const base = { office: "registrar" as const, freshness: rec.freshness };
  switch (action) {
    case "get_student_overview":
      return {
        ...base,
        summary: `Enrolled in ${rec.enrolledCredits} credits (${rec.status}). W grades used: ${rec.wGradesUsed} of ${rec.wGradesAllowed}.`,
        data: { credits: rec.enrolledCredits, status: rec.status, deadlines: rec.deadlines, wUsed: rec.wGradesUsed },
        ruleIds: ["REG-4"],
      };
    case "get_deadlines":
      return { ...base, summary: rec.deadlines.map((d) => `${d.label}: ${d.when}`).join("; "), data: rec.deadlines, ruleIds: [] };
    case "assess_enrollment_change": {
      const req = payload as unknown as EnrollmentChangeRequest;
      const a = req.options.find((o) => o.id === "A")!;
      return {
        ...base,
        summary: "Evaluated 3 options against registration rules",
        ruleIds: ["REG-1", "REG-2", "REG-3"],
        assessments: {
          A: { impact: `${a.creditsAfter} credits; 2 courses removed from transcript`, tone: "ok", ruleIds: ["REG-1"] },
          B: { impact: "Stays at 15 credits; 2 Incompletes (I) recorded", tone: "ok", ruleIds: ["REG-2"], approver: "Instructors (agreement)" },
          C: { impact: "Withdrawn from all 5 courses this term", tone: "warn", ruleIds: ["REG-3"] },
        },
      };
    }
    case "record_incomplete":
      return { ...base, summary: `Incomplete requests recorded for ${(payload.courses as string[]).join(" and ")} (pending instructor sign-off)`, ruleIds: ["REG-2"] };
    case "record_drop":
      return { ...base, summary: `Drop requests recorded for ${(payload.courses as string[]).join(" and ")}; schedule now 9 credits`, ruleIds: ["REG-1"] };
    case "record_withdrawal":
      return { ...base, summary: "Medical withdrawal recorded for the term; withdrawal date stamped today", ruleIds: ["REG-3"] };
    case "answer_question":
      return { ...base, summary: `Key dates: ${rec.deadlines.map((d) => `${d.label} — ${d.when}`).join("; ")}.`, ruleIds: ["REG-1", "REG-4"] };
    case "kb_search":
      return kbReply("registrar", String(payload.query ?? ""));
    default:
      throw new Error(`Registrar agent: unknown action ${action}`);
  }
};
