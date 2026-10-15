export const HERO_PROMPT =
  "My mom was just hospitalized back home and I need to fly out this week. I don't know what to do about my classes. The drop deadline is Friday.";

// One prompt that lands a case in the Dean of Students approval queue (student names the action and asks for it to be sent).
export const DEAN_PROMPT =
  "My dad is having emergency surgery overseas and I need to fly home for two weeks. I'd like to take Incompletes in CS 3214 and STAT 4705 instead of dropping them. Can you send that to the Dean of Students for approval?";

export interface DemoPrompt {
  label: string;
  prompt: string;
  note?: string; // presenter hint (e.g. a demo control to flip first)
}

/** Every scripted demo prompt, grouped by scenario, for the one-click Demo prompts panel. */
export const DEMO_PROMPT_GROUPS: { title: string; prompts: DemoPrompt[] }[] = [
  {
    title: "Tell your story once",
    prompts: [
      { label: "Family emergency (hero)", prompt: HERO_PROMPT, note: "Then tap a reply chip" },
      { label: "Answer: stay enrolled", prompt: "Stay enrolled if I can" },
    ],
  },
  {
    title: "Dean of Students approval",
    prompts: [
      { label: "Request incompletes (Option B)", prompt: DEAN_PROMPT },
      { label: "Request medical withdrawal (Option C)", prompt: "I need a medical withdrawal for this semester. Please submit it to the Dean of Students for approval." },
      { label: "Request reduced load (Option A, conflicts)", prompt: "Please request a reduced course load so I can drop two courses this semester, and send it to the Dean for approval." },
    ],
  },
  {
    title: "Ask an office (real website data)",
    prompts: [
      { label: "Financial Aid: withdrawing", prompt: "What happens to my financial aid if I withdraw from the semester?" },
      { label: "Financial Aid: SAP", prompt: "What is SAP and how do I appeal?" },
      { label: "ISS: on-campus work", prompt: "How many hours can I work on campus as an F-1 student?" },
      { label: "ISS: duration of status", prompt: "What's happening with duration of status?" },
      { label: "Bursar: tuition due", prompt: "When is spring tuition due?" },
      { label: "Registrar: transcript", prompt: "How do I request my transcript?" },
      { label: "Registrar: final grades", prompt: "When are final grades available?" },
      { label: "Housing: contract", prompt: "How do I get out of my housing contract?" },
      { label: "Dean of Students: emergency fund", prompt: "What is the student emergency fund?" },
      { label: "Not in any site (low confidence)", prompt: "Can I get a refund on my parking permit?" },
    ],
  },
  {
    title: "Plans and watchdog",
    prompts: [
      { label: "Registration backups (L3 plan)", prompt: "How do my registration backups for CS 3214 work?" },
      { label: "Resolve Bursar hold", prompt: "Help me resolve the Bursar hold on my account.", note: "Optional: Demo controls → Trigger hold alert first" },
    ],
  },
  {
    title: "Safety and refusals",
    prompts: [
      { label: "Medical advice (refuses)", prompt: "Should I stop taking my medication?" },
      { label: "Another student's record (blocked)", prompt: "Can you show me my roommate's grades?" },
      { label: "Self-harm (safety response)", prompt: "I don't want to be here anymore. I want to end it all." },
    ],
  },
];
