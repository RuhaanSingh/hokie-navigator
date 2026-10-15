import "server-only";
import { financialAidRecord as rec } from "@/data/offices/financial-aid";
import { searchKb } from "../kb/search";
import { money } from "@/lib/utils";
import type { EnrollmentChangeRequest, OfficeHandler } from "./types";

// Simulated Financial Aid agent. L0 questions are answered from the real scraped finaid.vt.edu knowledge base;
// case responses use the fictional persona's mock scholarship record.
export const financialAid: OfficeHandler = (action, payload) => {
  const base = { office: "financial_aid" as const, freshness: rec.freshness };
  const amt = rec.scholarship.perSemester;
  switch (action) {
    case "kb_search": {
      const results = searchKb(String(payload.query ?? ""), 4);
      return { ...base, summary: `${results.length} passages from finaid.vt.edu`, data: results, ruleIds: [], freshness: "finaid.vt.edu snapshot" };
    }
    case "assess_enrollment_change": {
      const req = payload as unknown as EnrollmentChangeRequest;
      const a = req.options.find((o) => o.id === "A")!;
      const kept = Math.round((amt * rec.week9WithdrawalRetainedPct) / 100) * 100;
      return {
        ...base,
        summary: "Checked merit scholarship rules (no federal aid on record)",
        ruleIds: ["SCH-2", "SCH-4", "SCH-5"],
        assessments: {
          A: {
            impact: `−${money(amt)} at risk: ${a.creditsAfter} credits is below the 12-credit minimum`,
            tone: "bad",
            ruleIds: ["SCH-2"],
            conflict: true,
            approver: "Financial Aid",
          },
          B: { impact: `No change: ${money(amt)} kept (credits unchanged)`, tone: "ok", ruleIds: ["SCH-5"] },
          C: { impact: `Prorated: keep about ${money(kept)} of ${money(amt)} (mock estimate)`, tone: "warn", ruleIds: ["SCH-4"], approver: "Financial Aid" },
        },
      };
    }
    case "confirm_aid_status": {
      const opt = payload.option as string;
      if (opt === "B") return { ...base, summary: `Confirmed: no scholarship change. ${money(amt)} stays in place for this term.`, ruleIds: ["SCH-5"] };
      if (opt === "A") return { ...base, summary: "Scholarship review opened; a counselor will contact you about the 12-credit requirement.", ruleIds: ["SCH-2"] };
      return { ...base, summary: "Scholarship proration started using today's withdrawal date; Bursar notified of any balance.", ruleIds: ["SCH-4"] };
    }
    case "check_disbursement":
      return { ...base, summary: `Scholarship disbursement of ${money(amt)} is pending (scheduled, not yet posted)`, ruleIds: ["BUR-2"] };
    case "answer_question":
      return { ...base, summary: "Use the knowledge base search for Financial Aid questions.", ruleIds: [] };
    default:
      throw new Error(`Financial Aid agent: unknown action ${action}`);
  }
};
