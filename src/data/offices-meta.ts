import type { OfficeId } from "@/lib/types";

// Display metadata only (safe for the client). Office *data* lives in src/data/offices/ and is imported only by office agents.
export const OFFICES: Record<OfficeId, { name: string; short: string; agent: string }> = {
  dean_of_students: { name: "Dean of Students", short: "Dean of Students", agent: "Dean of Students agent" },
  registrar: { name: "University Registrar", short: "Registrar", agent: "Registrar agent" },
  financial_aid: { name: "Scholarships & Financial Aid", short: "Financial Aid", agent: "Financial Aid agent" },
  housing: { name: "Housing & Residence Life", short: "Housing", agent: "Housing agent" },
  iss: { name: "International Student Services", short: "ISS", agent: "International Student Services agent" },
  bursar: { name: "University Bursar", short: "Bursar", agent: "Bursar agent" },
  department: { name: "Dept. of Computer Science", short: "CS Dept.", agent: "CS Department agent" },
};

export const OFFICE_ORDER: OfficeId[] = ["dean_of_students", "registrar", "financial_aid", "housing", "iss", "bursar", "department"];

// The five offices involved in an enrollment-change case (Scenario A).
export const CASE_OFFICES: OfficeId[] = ["dean_of_students", "registrar", "financial_aid", "housing", "iss"];

// Real, verified human support (fetched from official VT pages, Oct 2026).
export const SUPPORT = {
  cook: {
    name: "Cook Counseling Center",
    detail: "Counseling and mental health support for students",
    href: "https://ucc.vt.edu",
    phone: "540-231-6557",
  },
  dos: {
    name: "Dean of Students",
    detail: "Advocacy and support during family or medical emergencies",
    href: "https://dos.vt.edu",
    phone: "540-231-3787",
  },
  lifeline: {
    name: "988 Suicide & Crisis Lifeline",
    detail: "Call or text 988, any time, 24/7",
    href: "https://988lifeline.org",
    phone: "988",
  },
  health: {
    name: "Schiffert Health Center",
    detail: "Medical questions belong with a clinician",
    href: "https://healthcenter.vt.edu",
  },
};
