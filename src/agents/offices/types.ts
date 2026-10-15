import type { OfficeId, Tone } from "@/lib/types";

export type OptionId = "A" | "B" | "C";

export interface Assessment {
  impact: string;
  tone: Tone;
  ruleIds: string[];
  conflict?: boolean;
  approver?: string;
}

/** What the gateway passes on after need-to-know filtering. Offices never receive the student's narrative. */
export interface EnrollmentChangeRequest {
  studentId: string;
  options: { id: OptionId; label: string; creditsAfter: number }[];
  currentCredits: number;
  reasonCategory?: string; // e.g. "medical (family)", only for offices whose rules depend on it
  leavingCountry?: boolean;
}

export interface OfficeReply {
  office: OfficeId;
  summary: string;
  assessments?: Record<OptionId, Assessment>;
  data?: unknown;
  freshness: string;
  ruleIds: string[];
}

export type OfficeHandler = (action: string, payload: Record<string, unknown>) => OfficeReply;
