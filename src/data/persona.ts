// Fictional demo persona. No real student data anywhere in this prototype.
export const persona = {
  id: "stu-maya-chen",
  name: "Maya Chen",
  firstName: "Maya",
  pid: "mchen24 (simulated)",
  year: "Junior",
  major: "Computer Science",
  visa: "F-1 international student",
  residence: "On-campus residence hall (mock: Pritchard-style hall)",
  credits: 15,
  scholarship: { name: "Presidential Merit Scholarship (mock)", perSemester: 6000, requirement: "Full-time enrollment (12+ credits)" },
  courses: [
    { code: "CS 3114", title: "Data Structures & Algorithms", credits: 3 },
    { code: "CS 3214", title: "Computer Systems", credits: 3 },
    { code: "MATH 2534", title: "Intro to Discrete Math", credits: 3 },
    { code: "STAT 4705", title: "Probability & Statistics for Engineers", credits: 3 },
    { code: "ENGL 3764", title: "Technical Writing", credits: 3 },
  ],
  semester: {
    week: 9,
    dropDeadline: "Friday, 5:00 PM",
    timeTicket: "in 3 days",
    incompleteDue: "Week 6 of next term (mock)",
  },
};

export type Persona = typeof persona;
