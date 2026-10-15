import type { CaseStatus } from "./types";

export const STATUS_LABEL: Record<CaseStatus, { label: string; tone: "ok" | "warn" | "bad" | "primary" | "neutral" }> = {
  gathering: { label: "Gathering", tone: "neutral" },
  awaiting_student: { label: "Your choice needed", tone: "primary" },
  awaiting_staff: { label: "Awaiting staff approval", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  executing: { label: "In progress", tone: "warn" },
  paused: { label: "Paused · with a person", tone: "warn" },
  completed: { label: "Completed", tone: "ok" },
  rejected: { label: "Not approved", tone: "bad" },
};
