// Mock Bursar account. The hold scenario (Scenario G) is switched on by a demo control.
export const bursarRecord = {
  studentId: "stu-maya-chen",
  balance: 0,
  holdScenario: {
    amount: 245,
    item: "Student activity fee (mock)",
    pendingDisbursement: 6000,
    cause: "The fee posted before your scholarship disbursement; the disbursement is pending and covers it.",
  },
  freshness: "Synced 2 min ago (mock)",
};
