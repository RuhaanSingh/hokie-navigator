import "server-only";
import { db } from "@/lib/store";
import type { OfficeHandler } from "./types";

// Simulated CS Department agent: owns section seat inventory.
export const department: OfficeHandler = (action, payload) => {
  const base = { office: "department" as const, freshness: "Live seat count (mock)" };
  const s = db();
  switch (action) {
    case "list_sections":
      return { ...base, summary: `${s.sections.length} sections`, data: s.sections, ruleIds: [] };
    case "check_section": {
      const sec = s.sections.find((x) => x.id === payload.sectionId);
      if (!sec) throw new Error("Unknown section");
      return { ...base, summary: `${sec.course}-${sec.section}: ${sec.seats} seats open, ${sec.time}`, data: sec, ruleIds: ["DEP-1"] };
    }
    case "enroll_section": {
      const sec = s.sections.find((x) => x.id === payload.sectionId);
      if (!sec || sec.seats <= 0) throw new Error("Section full");
      sec.seats -= 1;
      s.nextTermSchedule.push(`${sec.course}-${sec.section} (${sec.credits})`);
      return { ...base, summary: `Enrolled in ${sec.course}-${sec.section} (${sec.time})`, data: sec, ruleIds: ["DEP-1"] };
    }
    case "answer_question":
      return { ...base, summary: "Seats are released in registration order (mock).", ruleIds: ["DEP-1"] };
    default:
      throw new Error(`Department agent: unknown action ${action}`);
  }
};
