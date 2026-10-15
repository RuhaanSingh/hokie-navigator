import "server-only";
import { housingRecord as rec } from "@/data/offices/housing";
import type { OfficeHandler } from "./types";

// Simulated Housing & Residence Life agent.
export const housing: OfficeHandler = (action) => {
  const base = { office: "housing" as const, freshness: rec.freshness };
  switch (action) {
    case "assess_enrollment_change":
      return {
        ...base,
        summary: "Checked residence hall contract terms",
        ruleIds: ["HOU-4", "HOU-7"],
        assessments: {
          A: { impact: "Contract review required (below full-time)", tone: "warn", ruleIds: ["HOU-4"], approver: "Housing" },
          B: { impact: "No change to your contract", tone: "ok", ruleIds: ["HOU-4"] },
          C: { impact: "Contract release for the term", tone: "warn", ruleIds: ["HOU-7"], approver: "Housing" },
        },
      };
    case "confirm_housing":
      return { ...base, summary: "No change: your residence hall contract continues as-is.", ruleIds: ["HOU-4"] };
    case "contract_review":
      return { ...base, summary: "Contract review opened; you can stay in your room while it is reviewed.", ruleIds: ["HOU-4"] };
    case "contract_release":
      return { ...base, summary: "Contract release started effective your withdrawal date.", ruleIds: ["HOU-7"] };
    case "answer_question":
      return { ...base, summary: "Residence hall contracts require full-time enrollment; changes below 12 credits trigger a review (mock).", ruleIds: ["HOU-4"] };
    default:
      throw new Error(`Housing agent: unknown action ${action}`);
  }
};
