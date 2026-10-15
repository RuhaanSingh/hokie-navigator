import "server-only";
import { bursarRecord as rec } from "@/data/offices/bursar";
import { money } from "@/lib/utils";
import type { OfficeHandler } from "./types";

// Simulated Bursar agent (Scenario G).
export const bursar: OfficeHandler = (action) => {
  const base = { office: "bursar" as const, freshness: rec.freshness };
  const h = rec.holdScenario;
  switch (action) {
    case "get_holds":
    case "assess_hold":
      return {
        ...base,
        summary: `Registration hold: ${money(h.amount)} unpaid — ${h.item}`,
        data: { amount: h.amount, item: h.item },
        ruleIds: ["BUR-1"],
      };
    case "request_hold_review":
      return { ...base, summary: "Hold review requested; pending disbursement noted. Typical review: 1 business day (mock).", ruleIds: ["BUR-2"] };
    case "answer_question":
      return { ...base, summary: "Unpaid balances over $200 place a registration hold (mock).", ruleIds: ["BUR-1"] };
    default:
      throw new Error(`Bursar agent: unknown action ${action}`);
  }
};
