import type { Policy } from "@/lib/types";

// Mock policies for the fictional case. Every rule the consequence engine uses is cited in the UI by id.
export const POLICIES: Policy[] = [
  // Registrar
  { id: "REG-1", office: "registrar", text: "Courses dropped by the drop deadline are removed from the transcript.", source: "Registrar Academic Calendar §2 (mock)" },
  { id: "REG-2", office: "registrar", text: "An Incomplete (I) may be recorded when the instructor agrees and remaining work is due by an agreed date next term.", source: "Grading Policy §5.3 (mock)" },
  { id: "REG-3", office: "registrar", text: "A medical withdrawal removes the student from all courses for the term; tuition adjustment depends on the withdrawal date.", source: "Withdrawal Policy §1 (mock)" },
  { id: "REG-4", office: "registrar", text: "Undergraduates may use up to 3 course withdrawals (W) in their career. Ruhaan has used 0 of 3.", source: "W Grade Policy (mock record)" },
  // Financial aid / scholarships
  { id: "SCH-2", office: "financial_aid", text: "The merit scholarship requires full-time enrollment (12+ credits) each term.", source: "Merit Scholarship Terms §2 (mock)" },
  { id: "SCH-4", office: "financial_aid", text: "If a student withdraws, the term's scholarship is prorated by withdrawal date; the remainder may be owed to the Bursar.", source: "Merit Scholarship Terms §4 (mock)" },
  { id: "SCH-5", office: "financial_aid", text: "Incomplete grades do not change enrolled credit hours for scholarship purposes.", source: "Merit Scholarship Terms §5 (mock)" },
  // Housing
  { id: "HOU-4", office: "housing", text: "Residence hall contracts require full-time enrollment; dropping below 12 credits triggers a contract review.", source: "Housing Contract §4 (mock)" },
  { id: "HOU-7", office: "housing", text: "A contract release is granted when a student withdraws from the university for the term.", source: "Housing Contract §7 (mock)" },
  // ISS
  { id: "ISS-1", office: "iss", text: "F-1 students must maintain full-time enrollment (12+ credits) unless ISS authorizes a Reduced Course Load before dropping.", source: "F-1 Enrollment Guidance (mock)" },
  { id: "ISS-3", office: "iss", text: "A Reduced Course Load may be authorized for documented medical reasons, including a family medical emergency, only with ISS approval in advance.", source: "RCL Procedure (mock)" },
  { id: "ISS-5", office: "iss", text: "Students leaving the U.S. after a withdrawal must contact ISS before departure to protect their record.", source: "F-1 Departure Guidance (mock)" },
  // Dean of Students
  { id: "DOS-1", office: "dean_of_students", text: "The Dean of Students supports students in family and medical emergencies and can notify instructors on the student's behalf.", source: "Student Support Procedures (mock)" },
  { id: "DOS-2", office: "dean_of_students", text: "Withdrawals, incompletes requested under emergency circumstances, and reduced course loads require Dean of Students approval.", source: "Student Support Procedures §3 (mock)" },
  // Bursar
  { id: "BUR-1", office: "bursar", text: "Unpaid balances over $200 past due place a registration hold.", source: "Bursar Holds Policy (mock)" },
  { id: "BUR-2", office: "bursar", text: "A hold review may be requested when a pending scholarship disbursement covers the balance.", source: "Bursar Holds Policy §2 (mock)" },
  // Department
  { id: "DEP-1", office: "department", text: "Seats are released in registration order; waitlist and plan-based enrollment are processed in the order received.", source: "CS Registration Guidelines (mock)" },
];

export const policyById = (id: string) => POLICIES.find((p) => p.id === id);
