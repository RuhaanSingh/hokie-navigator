import "server-only";
import { issRecord as rec } from "@/data/offices/iss";
import type { EnrollmentChangeRequest, OfficeHandler } from "./types";

// Simulated International Student Services agent.
export const iss: OfficeHandler = (action, payload) => {
  const base = { office: "iss" as const, freshness: rec.freshness };
  switch (action) {
    case "assess_enrollment_change": {
      const req = payload as unknown as EnrollmentChangeRequest;
      const medical = (req.reasonCategory ?? "").includes("medical");
      return {
        ...base,
        summary: "Checked F-1 full-time enrollment rules",
        ruleIds: ["ISS-1", "ISS-3", "ISS-5"],
        assessments: {
          A: {
            impact: medical
              ? "Below full-time: needs Reduced Course Load authorization before dropping"
              : "Below full-time: not permitted without Reduced Course Load authorization",
            tone: "bad",
            ruleIds: ["ISS-1", "ISS-3"],
            conflict: true,
            approver: "ISS (RCL)",
          },
          B: { impact: "Status maintained (still full-time)", tone: "ok", ruleIds: ["ISS-1"] },
          C: { impact: "Contact ISS before leaving to protect your status", tone: "warn", ruleIds: ["ISS-5"], approver: "ISS" },
        },
      };
    }
    case "confirm_status":
      return { ...base, summary: "No action needed: F-1 status maintained at full-time enrollment.", ruleIds: ["ISS-1"] };
    case "request_rcl":
      return { ...base, summary: "Reduced Course Load request filed (medical category); an ISS advisor must authorize before any drop.", ruleIds: ["ISS-3"] };
    case "notify_departure":
      return { ...base, summary: "ISS notified before departure; an advisor will confirm your record and travel guidance.", ruleIds: ["ISS-5"] };
    case "answer_question":
      return { ...base, summary: "F-1 students must stay full-time unless ISS authorizes a Reduced Course Load in advance (mock).", ruleIds: ["ISS-1", "ISS-3"] };
    default:
      throw new Error(`ISS agent: unknown action ${action}`);
  }
};
