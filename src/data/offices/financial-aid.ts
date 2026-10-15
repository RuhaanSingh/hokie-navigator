// Mock Scholarships & Financial Aid record. F-1 students are generally not eligible for federal (Title IV) aid,
// so the persona's aid exposure is an institutional merit scholarship only.
export const financialAidRecord = {
  studentId: "stu-maya-chen",
  federalAid: "None (not Title IV eligible as an F-1 student)",
  scholarship: { name: "Presidential Merit Scholarship (mock)", perSemester: 6000, minCredits: 12 },
  // Mock estimate of the share of the term's scholarship kept after a week-9 withdrawal.
  week9WithdrawalRetainedPct: 0.45,
  freshness: "Synced 12 min ago (mock)",
};
