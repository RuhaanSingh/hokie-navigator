import type { Section } from "@/lib/types";

// Mock CS Department section inventory for next term.
export const SECTIONS: Section[] = [
  { id: "CS3214-1", course: "CS 3214", section: "1", title: "Computer Systems", credits: 3, time: "MWF 9:05 AM", startMinutes: 545, seats: 2, capacity: 120 },
  { id: "CS3214-2", course: "CS 3214", section: "2", title: "Computer Systems", credits: 3, time: "MWF 10:10 AM", startMinutes: 610, seats: 14, capacity: 120 },
  { id: "STAT4714-1", course: "STAT 4714", section: "1", title: "Probability & Statistics for EE", credits: 3, time: "TR 11:00 AM", startMinutes: 660, seats: 9, capacity: 60 },
];

// Next-term schedule before the CS 3214 add (12 credits).
export const NEXT_TERM_BASE = ["CS 3304 (3)", "CS 3704 (3)", "MATH 3134 (3)", "PHIL 2304 (3)"];
