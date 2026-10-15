// Mock Registrar system of record (fictional).
export const registrarRecord = {
  studentId: "stu-maya-chen",
  enrolledCredits: 15,
  status: "Enrolled, full-time",
  wGradesUsed: 0,
  wGradesAllowed: 3,
  deadlines: [
    { id: "drop", label: "Course drop deadline", when: "Friday, 5:00 PM", daysAway: 2 },
    { id: "ticket", label: "Registration time ticket (next term)", when: "In 3 days, 8:00 AM", daysAway: 3 },
    { id: "w", label: "Last day to request a course withdrawal (W)", when: "Last day of classes", daysAway: 38 },
  ],
  freshness: "Synced 4 min ago (mock)",
};
