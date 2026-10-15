import "server-only";
import { deanRecord as rec } from "@/data/offices/dean-of-students";
import type { OfficeHandler } from "./types";

// Simulated Dean of Students agent. This is the only office that receives the student's own words (with consent),
// because it coordinates the response on the student's behalf.
export const deanOfStudents: OfficeHandler = (action, payload) => {
  const base = { office: "dean_of_students" as const, freshness: rec.freshness };
  switch (action) {
    case "assess_enrollment_change":
      return {
        ...base,
        summary: "Can support: emergency case, instructor notices available",
        ruleIds: ["DOS-1", "DOS-2"],
        assessments: {
          A: { impact: "Supports; approval needed for reduced load", tone: "ok", ruleIds: ["DOS-2"], approver: "Dean of Students" },
          B: { impact: "Supports; will notify instructors after approval", tone: "ok", ruleIds: ["DOS-1", "DOS-2"], approver: "Dean of Students" },
          C: { impact: "Supports; coordinates the medical withdrawal", tone: "ok", ruleIds: ["DOS-2"], approver: "Dean of Students" },
        },
      };
    case "receive_case":
      return { ...base, summary: "Case packet received in the Dean of Students approval queue", ruleIds: ["DOS-2"] };
    case "protect_deadline":
      return { ...base, summary: "Dean of Students notified so the Friday drop deadline can be protected while the case is paused", ruleIds: ["DOS-1"] };
    case "notify_instructors": {
      const courses = (payload.courses as string[]) ?? [];
      const drafts = courses.map(
        (c) =>
          `To: ${c} instructor\nSubject: Student support notice — John Doe\n\nThe Dean of Students office is supporting John through a family emergency and has approved an Incomplete request for ${c}. Please reply to confirm an agreed completion date (proposed: week 6 of next term). No further details are shared.\n\n— Dean of Students (sent via Hokie Navigator, simulated)`,
      );
      return { ...base, summary: `Instructor notices sent for ${courses.join(" and ")}`, data: { drafts }, ruleIds: ["DOS-1"] };
    }
    case "answer_question":
      return { ...base, summary: "The Dean of Students supports students through family and medical emergencies and can notify instructors.", ruleIds: ["DOS-1"] };
    default:
      throw new Error(`Dean of Students agent: unknown action ${action}`);
  }
};
