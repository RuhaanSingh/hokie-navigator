import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";
import type { TraceEvent, WellbeingResource } from "@/lib/types";
import { OFFICES, SUPPORT } from "@/data/offices-meta";
import { persona } from "@/data/persona";
import { addActivity, addAudit, db, touch } from "@/lib/store";
import { sleep, uid } from "@/lib/utils";
import { gateway } from "./gateway";
import { openCase, type CaseResult } from "./case-pipeline";
import { kbConfidence } from "./confidence";
import { retrievalStrong, tokenize, KB_RETRIEVED_AT, type KbResult } from "./kb/search";
import { KB_ANSWER_PROMPT, SYSTEM_PROMPT } from "./prompts";

// The personal agent: decides intent, runs tools through the gateway, writes prose.
// Hybrid reliability rule: the LLM chooses and words things; case pipelines and office responses are deterministic code.

type Emit = (e: TraceEvent) => void;
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type Intent =
  | "self_harm"
  | "medical"
  | "other_student"
  | "crisis_intake"
  | "crisis_choice"
  | "finaid"
  | "escalate"
  | "hold"
  | "force_add"
  | "general";

export const CRISIS_CHIPS = ["Stay enrolled if I can", "Step away this semester", "Not sure yet"];

// ---------- Intent detection (deterministic; also powers Scripted mode) ----------

const RX = {
  selfHarm: /(suicid|kill myself|end (it|my life)|self[- ]?harm|hurt(ing)? myself|want to die|don'?t want to (live|be here)|no reason to live)/i,
  medical: /(medication|meds\b|dosage|dose\b|prescri|diagnos|antidepress|should i (take|stop) (my|taking))/i,
  otherStudent: /((roommate|friend|classmate|girlfriend|boyfriend|someone else|another student|other student)'?s?\b.*\b(grade|record|transcript|schedule|gpa|info|aid|account))|((grade|record|transcript|gpa)s?\b.*\b(roommate|friend|classmate|another student))/i,
  crisis: /(hospital|emergency|passed away|died|funeral|surgery|accident|critically|icu\b|fly (out|home)|flying home|go(ing)? home|family (crisis|emergency)|sick)/i,
  classes: /(class|course|drop|semester|withdraw|deadline|enroll|credits)/i,
  hold: /(\bhold\b|bursar)/i,
  forceAdd: /(force[- ]?add|plan b|backup (plan|section)|registration|time ticket|seat (filled|open)|section)/i,
  finaid: /(financial aid|scholarship|\bsap\b|satisfactory academic|fafsa|grant|loan|cost of attendance|\bcoa\b|appeal|tuition|\baid\b|refund|w grade|course withdraw|withdraw(al)?|resign|work[- ]?study|parking|dining|permit)/i,
  escalate: /(route (this|me|it)|talk to (a|an) (human|person|counselor|advisor)|connect me|financial aid counselor)/i,
  distress: /(overwhelm|stress|anxious|anxiety|panic|scared|can'?t cope|hopeless|depress|struggl|falling apart|exhausted|crying)/i,
};

export function detectIntent(text: string, lastIntent?: string): Intent {
  if (RX.selfHarm.test(text)) return "self_harm";
  if (RX.otherStudent.test(text)) return "other_student";
  if (RX.medical.test(text)) return "medical";
  if (lastIntent === "crisis_intake" || CRISIS_CHIPS.some((c) => text.trim().toLowerCase() === c.toLowerCase())) return "crisis_choice";
  if (RX.crisis.test(text) && (RX.classes.test(text) || /hospitalized|passed away|emergency/i.test(text))) return "crisis_intake";
  if (RX.escalate.test(text)) return "escalate";
  if (RX.hold.test(text)) return "hold";
  if (RX.forceAdd.test(text)) return "force_add";
  if (RX.finaid.test(text)) return "finaid";
  return "general";
}

// ---------- LLM plumbing ----------

const groqKey = () => process.env.GROQ_API_KEY;
const MODEL = () => process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
let client: Groq | null = null;
const groq = () => (client ??= new Groq({ apiKey: groqKey(), timeout: 6000, maxRetries: 0 }));

// Circuit breaker: after an LLM failure, use scripted responses for a minute so the live demo never waits on repeated timeouts.
const breaker = globalThis as unknown as { __hnLlmDownUntil?: number };
const useLlm = () => db().mode !== "scripted" && Boolean(groqKey()) && (db().mode === "live" || Date.now() > (breaker.__hnLlmDownUntil ?? 0));

type LlmMsg = Groq.Chat.Completions.ChatCompletionMessageParam;

async function complete(messages: LlmMsg[], opts: { tools?: Groq.Chat.Completions.ChatCompletionTool[]; toolChoice?: Groq.Chat.Completions.ChatCompletionToolChoiceOption; temperature?: number } = {}) {
  const started = Date.now();
  let res: Groq.Chat.Completions.ChatCompletion;
  try {
    res = await groq().chat.completions.create({
      model: MODEL(),
      messages,
      tools: opts.tools,
      tool_choice: opts.tools ? (opts.toolChoice ?? "auto") : undefined,
      temperature: opts.temperature ?? 0.3,
      max_tokens: 700,
    });
  } catch (e) {
    breaker.__hnLlmDownUntil = Date.now() + 60_000;
    throw e;
  }
  addActivity(["personal", "router"]);
  db().stats.latencies.push(Date.now() - started);
  return res.choices[0].message;
}

async function streamText(emit: Emit, text: string) {
  const parts = text.match(/\S+\s*/g) ?? [];
  for (let i = 0; i < parts.length; i += 3) {
    emit({ type: "token", text: parts.slice(i, i + 3).join("") });
    await sleep(18);
  }
}

const TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_financial_aid_kb",
      description: "Search Virginia Tech's published Financial Aid information (finaid.vt.edu). Use for any informational financial aid question.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_office",
      description: "Ask an office agent a general informational (L0) question through the gateway.",
      parameters: {
        type: "object",
        properties: { office: { type: "string", enum: Object.keys(OFFICES) }, question: { type: "string" } },
        required: ["office", "question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_case",
      description: "Open a multi-office case (crisis, withdrawal, dropping courses, holds, force-adds). The case pipeline consults office agents in parallel and shows the student an option comparison.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One-sentence neutral summary of the situation, no medical details" },
          situation_type: { type: "string", enum: ["family_emergency", "medical", "withdrawal", "drop_courses", "hold", "force_add", "other"] },
          preference: { type: "string", description: "What the student wants: stay enrolled, step away, or not sure" },
        },
        required: ["summary", "situation_type"],
      },
    },
  },
  { type: "function", function: { name: "get_student_overview", description: "Get Maya's courses, credits, deadlines and alerts (via Registrar).", parameters: { type: "object", properties: {} } } },
  {
    type: "function",
    function: { name: "check_plan", description: "Read Maya's signed pre-approved registration plan.", parameters: { type: "object", properties: { course: { type: "string" } }, required: [] } },
  },
  {
    type: "function",
    function: {
      name: "escalate_to_human",
      description: "Send the conversation to a human staff queue.",
      parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] },
    },
  },
];

const ARGS = {
  search_financial_aid_kb: z.object({ query: z.string().min(2) }),
  ask_office: z.object({ office: z.enum(Object.keys(OFFICES) as [string, ...string[]]), question: z.string() }),
  open_case: z.object({ summary: z.string(), situation_type: z.string(), preference: z.string().optional() }),
  get_student_overview: z.object({}).passthrough(),
  check_plan: z.object({ course: z.string().optional() }).passthrough(),
  escalate_to_human: z.object({ reason: z.string() }),
};

// ---------- Shared helpers ----------

const step = (emit: Emit, agent: string, label: string, status: "running" | "done" | "blocked" | "error" = "done", level?: "L0" | "L1" | "L2" | "L3", detail?: string, id = uid("s-")) => {
  emit({ type: "step", id, agent, label, status, level, detail });
  return id;
};

function wellbeing(emit: Emit, kind: "crisis" | "medical" | "self_harm" | "distress") {
  const r: WellbeingResource[] =
    kind === "self_harm"
      ? [SUPPORT.lifeline, SUPPORT.cook, SUPPORT.dos]
      : kind === "medical"
        ? [SUPPORT.health, SUPPORT.cook]
        : [SUPPORT.dos, SUPPORT.cook];
  emit({ type: "wellbeing", urgent: kind === "self_harm", resources: r });
}

const who = (text: string) => (/\b(mom|mother|mum)\b/i.test(text) ? "your mom" : /\b(dad|father)\b/i.test(text) ? "your dad" : /\b(grandm|grandp|grandfather|grandmother)/i.test(text) ? "your grandparent" : "your family");

// ---------- Main entry ----------

export async function runTurn(messages: ChatMessage[], lastIntent: string | undefined, emit: Emit) {
  const last = messages[messages.length - 1]?.content ?? "";
  const intent = detectIntent(last, lastIntent);
  let source: "llm" | "scripted" = useLlm() ? "llm" : "scripted";
  addActivity(["channels", "identity", "personal"]);
  const setSource = (s: "llm" | "scripted") => (source = s);

  try {
    switch (intent) {
      case "self_harm":
        await selfHarm(emit);
        source = "scripted";
        break;
      case "other_student":
        await otherStudent(emit, messages, setSource);
        break;
      case "medical":
        await medical(emit, messages, setSource);
        break;
      case "crisis_intake":
        await crisisIntake(emit, messages, setSource);
        break;
      case "crisis_choice":
        await crisisChoice(emit, messages, setSource);
        break;
      case "finaid":
        await finaid(emit, last, setSource);
        break;
      case "escalate":
        await escalate(emit, last);
        source = "scripted";
        break;
      case "hold":
        await hold(emit);
        source = "scripted";
        break;
      case "force_add":
        await forceAdd(emit, messages, setSource);
        break;
      default:
        await general(emit, messages, setSource);
    }
  } catch (e) {
    console.warn("[agent] turn failed, using safe fallback:", e instanceof Error ? e.message : e);
    step(emit, "personal_agent", "Something went wrong on my side — nothing was changed", "error");
    await streamText(emit, "Sorry, I hit a snag on my side. Nothing was changed or sent anywhere. Could you try that again?");
  }
  // Any distress outside the dedicated safety/crisis flows still surfaces human support.
  if (RX.distress.test(last) && !["self_harm", "medical", "crisis_intake", "crisis_choice"].includes(intent)) wellbeing(emit, "distress");
  emit({ type: "meta", intent, source });
  emit({ type: "done" });
}

// ---------- Scenario E: safety ----------

async function selfHarm(emit: Emit) {
  step(emit, "safety", "Safety check: pausing all automation", "done", undefined, "No tools, no case, nothing shared with offices");
  wellbeing(emit, "self_harm");
  addAudit({ caller: "Maya's personal agent", office: "personal_agent", action: "safety_response", decision: "allowed", dataShared: "Nothing shared with any office", level: "L0" });
  await streamText(
    emit,
    "I'm really glad you told me, Maya. You don't have to go through this alone, and you deserve support from a person right now.\n\n**Please call or text 988** (Suicide & Crisis Lifeline), any time, day or night. Cook Counseling Center is here for you too, and the Dean of Students can help with anything school-related so you don't have to think about it.\n\nIf you're in immediate danger, call 911. I'm here, and I'm not going to do anything with your classes or offices unless you ask.",
  );
}

async function medical(emit: Emit, messages: ChatMessage[], setSource: (s: "llm" | "scripted") => void) {
  step(emit, "safety", "Safety check: medical question — outside what I can advise on", "blocked", undefined, "The agent never gives medical, legal, or mental-health advice");
  wellbeing(emit, "medical");
  const scripted =
    "I can't give medical advice, and I'd never want to guess about something this important. Please don't change or stop a medication without talking to the clinician who prescribed it.\n\nSchiffert Health Center can help with medical questions, and if this is weighing on you, Cook Counseling Center is there to talk. I've added both below.";
  await prose(emit, messages, scripted, "Maya asked a medical question. Decline to give medical advice in 2–3 warm sentences, tell her not to change medication without her prescriber, and point to Schiffert Health Center and Cook Counseling Center (cards are shown below; no phone numbers).", setSource);
}

async function otherStudent(emit: Emit, messages: ChatMessage[], setSource: (s: "llm" | "scripted") => void) {
  step(emit, "personal_agent", "Request involves another student's record", "running", "L0");
  await sleep(500);
  gateway.refuse("get_other_student_record", "Agents may only access the signed-in student's own records (FERPA-style rule)", { level: "L0" });
  step(emit, "audit", "Audit entry logged", "done");
  const scripted =
    "I can't do that. I can only access your own records, never another student's, even a roommate's. The gateway blocked that request and logged it.\n\nIf you're worried about your roommate, I'm happy to point you to resources you could share with them.";
  await prose(emit, messages, scripted, "Maya asked for another student's information. Refuse in 2 short sentences (you only access her own records; the request was blocked and logged), then offer to share resources she could pass along.", setSource);
}

// ---------- Scenario A: Tell Your Story Once ----------

async function crisisIntake(emit: Emit, messages: ChatMessage[], setSource: (s: "llm" | "scripted") => void) {
  const text = messages[messages.length - 1].content;
  step(emit, "personal_agent", "Understanding your situation", "done", "L0");
  await sleep(350);
  step(emit, "personal_agent", "Detected: family emergency affecting enrollment", "done", "L0", "Likely offices: Dean of Students, Registrar, Financial Aid, Housing, ISS");
  await sleep(300);
  step(emit, "safety", "Wellbeing check: surfacing human support", "done", undefined, "Dean of Students · Cook Counseling Center");
  wellbeing(emit, "crisis");
  const scripted = `I'm so sorry about ${who(text)}, Maya. That's a lot to carry, and you don't have to sort it all out alone. Real people can help right now: the **Dean of Students** supports students through family emergencies, and **Cook Counseling Center** is there if you want to talk to someone. Their contacts are below.\n\nI can coordinate with your offices so you only have to tell this story once. One question first: **do you want to stay enrolled this semester if possible, or step away entirely?**`;
  await prose(
    emit,
    messages,
    scripted,
    `Maya just shared a family emergency. Respond warmly in 2 short paragraphs: (1) empathy plus a mention that the Dean of Students and Cook Counseling Center are there for her (cards shown below, no numbers); (2) say you can coordinate with her offices so she only tells her story once, then ask exactly this one question in bold: "Do you want to stay enrolled this semester if possible, or step away entirely?" Do not offer options yet.`,
    setSource,
  );
  emit({ type: "quick_replies", items: CRISIS_CHIPS });
}

async function crisisChoice(emit: Emit, messages: ChatMessage[], setSource: (s: "llm" | "scripted") => void) {
  const story = [...messages].reverse().find((m) => m.role === "user" && RX.crisis.test(m.content))?.content ?? messages[0].content;
  const answer = messages[messages.length - 1].content;
  const preference = /step away|withdraw|leave/i.test(answer) ? "step away this semester" : /not sure|don'?t know|unsure/i.test(answer) ? "not sure yet" : "stay enrolled if possible";
  let summary = `Family medical emergency abroad; student needs to travel this week and wants to ${preference}.`;

  // Real tool call: the LLM must call open_case (forced), we validate its arguments, the pipeline itself is deterministic.
  if (useLlm()) {
    try {
      const msg = await complete(
        [{ role: "system", content: SYSTEM_PROMPT }, ...messages.map((m) => ({ role: m.role, content: m.content }) as LlmMsg)],
        { tools: TOOLS.filter((t) => t.function?.name === "open_case"), toolChoice: { type: "function", function: { name: "open_case" } }, temperature: 0 },
      );
      const call = msg.tool_calls?.[0];
      const parsed = call ? ARGS.open_case.safeParse(JSON.parse(call.function.arguments || "{}")) : null;
      if (parsed?.success) summary = parsed.data.summary;
      else setSource("scripted");
    } catch (e) {
      console.warn("[agent] open_case tool call failed, scripted fallback:", e instanceof Error ? e.message : e);
      setSource("scripted");
    }
  }

  const result = await openCase({ summary, situation: "family_emergency", preference, narrative: story }, emit);
  await prose(emit, messages, scriptedCaseProse(result, preference), `${result.summaryForLlm}\n\nMaya's preference: ${preference}.\nWrite 2–3 short paragraphs: say you checked with five offices at once so she didn't have to; say which option has the fewest consequences and why (one sentence); name any conflict plainly without picking a side; mention anything pending or unknown; end by saying the decision is hers plus Dean of Students approval and she can pick an option below.`, setSource);
  emit({ type: "approval_request", caseId: result.caseId, action: "Send to Dean of Students for approval", approver: "staff" });
}

function scriptedCaseProse(r: CaseResult, preference: string) {
  const f = r.fewest;
  const parts: string[] = [];
  parts.push(
    `I checked with five offices at once (Dean of Students, Registrar, Financial Aid, Housing, and International Student Services) so you didn't have to. Here's what each option would mean for you.`,
  );
  if (f.id === "B")
    parts.push(
      `**Option B, Incompletes, has the fewest consequences:** you stay full-time, so ${r.outage.includes("financial_aid") ? "your F-1 status isn't affected" : "your scholarship and F-1 status aren't affected"}${r.revoked.includes("housing") ? "" : " and your housing doesn't change"}. It needs your instructors to agree, and the work would be due next term.`,
    );
  else parts.push(`**Option ${f.id}, ${f.title}, has the fewest consequences** based on what the offices returned.`);
  const a = r.options.find((o) => o.id === "A")!;
  if (a.conflicts > 0)
    parts.push(`**Option A (dropping two courses) breaks ${a.conflicts} office rule${a.conflicts > 1 ? "s" : ""}**${a.conflictRules.includes("SCH-2") ? ": your scholarship requires 12+ credits" : ""}${a.conflictRules.includes("ISS-1") ? ", and F-1 status needs ISS to authorize a Reduced Course Load *before* you drop" : ""}. When office rules conflict, I don't pick a side.`);
  if (/step away/.test(preference)) parts.push("Since you'd like to step away, **Option C (medical withdrawal)** fits that goal; ISS must hear from you before you leave the country.");
  if (r.outage.includes("financial_aid"))
    parts.push("Financial Aid's agent didn't respond, so the scholarship impact is **pending a counselor's review**. Nothing irreversible has happened, and I've asked the Dean of Students to protect your Friday deadline.");
  if (r.revoked.includes("housing")) parts.push("You've turned off sharing with Housing, so I didn't contact them. **Housing impact is unknown** until you turn it back on or talk to them directly.");
  parts.push("The decision is yours, and the Dean of Students has to approve whichever you choose. Pick an option below and I'll send it with your case file.");
  return parts.join("\n\n");
}

// ---------- Scenario B: Financial Aid L0 ----------

// Scripted-mode answers for the canned Scenario B questions. Every sentence is taken from the scraped pages (verified Oct 2026).
const SAP_URL = "https://finaid.vt.edu/undergraduate/policies-regulations/satisfactory-academic-progress-sap.html";
const SAPQA_URL = "https://finaid.vt.edu/appeals/satisfactory-academic-progress/sap-q-a.html";
const WD_URL = "https://finaid.vt.edu/undergraduate/policies-regulations/enrollment-withdrawal.html";
const W_URL = "https://eng.vt.edu/undergraduate/resources-support/how-to/course-withdraw.html";
const CANNED: { test: RegExp; text: string; sources: { title: string; url: string }[] }[] = [
  {
    test: /\bsap\b|satisfactory academic/i,
    text: "**Satisfactory Academic Progress (SAP)** is how Financial Aid checks that you're on track to keep your aid. It has three parts: a minimum cumulative GPA (2.0 for undergraduates), a Pace of Progress of at least 67% of attempted credits, and not exceeding 150% of your program's published length (Maximum Timeframe) [1].\n\nTo appeal, you submit a completed SAP Appeal Form; priority dates and deadlines are posted on the SAP Appeal page, and reviews can take up to 15 business days. Students are limited to 2 appeals while at Virginia Tech [2].",
    sources: [
      { title: "Satisfactory Academic Progress (SAP)", url: SAP_URL },
      { title: "SAP Q & A", url: SAPQA_URL },
    ],
  },
  {
    test: /(how many|w grade|course withdraw|withdraw from (a|one) (class|course))/i,
    text: "A course withdrawal puts a **W** on your transcript after the drop deadline. It isn't calculated into your GPA, but you stay enrolled in those credit hours, and there are no tuition or fee refunds for a withdrawn course. You can use a maximum of **three** course withdrawals in your undergraduate career [1].\n\nIf you're using financial aid, check with Financial Aid before withdrawing [2].",
    sources: [
      { title: "How To Course Withdraw", url: W_URL },
      { title: "Withdrawing or Resigning", url: WD_URL },
    ],
  },
  {
    test: /(withdraw|resign)/i,
    text: "If you withdraw or resign after the semester starts, your financial aid **may be reduced and leave a balance due** to the Bursar's office. The withdrawal or resignation date is the key factor in calculating any unearned federal, state, and institutional aid to return, and the Bursar uses the same date to decide whether tuition charges are reduced [1].\n\nFinancial Aid recommends talking with a financial aid counselor and the Bursar's office **before** you resign [1]. Dropping a single course with a W is different: you stay enrolled in those credits and can use up to three W's in your undergraduate career [2].",
    sources: [
      { title: "Withdrawing or Resigning", url: WD_URL },
      { title: "How To Course Withdraw", url: W_URL },
    ],
  },
];


async function finaid(emit: Emit, question: string, setSource: (s: "llm" | "scripted") => void) {
  step(emit, "personal_agent", "Routing to Financial Aid agent", "done", "L0");
  const sid = uid("s-");
  const r = await gateway.call("financial_aid", "kb_search", { query: question }, { level: "L0", emit, step: { id: sid, label: "Searching finaid.vt.edu…" } });
  if (!r.ok) {
    step(emit, "personal_agent", "Routed to financial aid counselor queue", "done", "L1");
    queueCounselor(question, "Financial Aid agent unavailable");
    await streamText(emit, "Financial Aid's agent isn't responding right now, so I couldn't check their published information. I've routed your question to a financial aid counselor, and nothing else was changed.");
    emit({ type: "confidence", score: "low", checks: [{ name: "Financial Aid agent reachable", passed: false }] });
    return;
  }
  const results = (r.reply.data as KbResult[]) ?? [];
  const strong = retrievalStrong(results);
  const sources = dedupeSources(results);
  emit({ type: "step", id: sid, agent: "financial_aid", label: `Searching finaid.vt.edu (${results.length} passages)`, status: "done", level: "L0", detail: sources.map((s) => s.title).join(" · ") });

  if (!strong) {
    step(emit, "policy", "Confidence low: answer not found in published information", "blocked", "L0");
    const conf = kbConfidence({ strong: false, retrievedAt: KB_RETRIEVED_AT, sources: 0, coverage: results[0]?.coverage ?? 0 });
    emit({ type: "confidence", score: conf.score, checks: conf.checks });
    await streamText(emit, "I couldn't find that in Financial Aid's published information, so I won't guess. **Want me to route this to a financial aid counselor?**");
    emit({ type: "quick_replies", items: ["Route this to a financial aid counselor"] });
    return;
  }
  step(emit, "policy", "Policy check passed: answering only from finaid.vt.edu passages", "done", "L0");

  const top = results.slice(0, 3);
  let answer: string | null = null;
  if (useLlm()) {
    try {
      const ctx = top.map((p, i) => `[${i + 1}] ${p.title} (${p.url})\n${p.text.slice(0, 1800)}`).join("\n\n");
      const msg = await complete([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${KB_ANSWER_PROMPT}\n\nPassages:\n${ctx}\n\nMaya's question: ${question}` },
      ]);
      const text = (msg.content ?? "").trim();
      if (text && !text.includes("NOT_IN_KB")) answer = text;
      else if (text.includes("NOT_IN_KB")) {
        const conf = kbConfidence({ strong: false, retrievedAt: KB_RETRIEVED_AT, sources: 0, coverage: 0.3 });
        emit({ type: "confidence", score: conf.score, checks: conf.checks });
        await streamText(emit, "I couldn't find that in Financial Aid's published information, so I won't guess. **Want me to route this to a financial aid counselor?**");
        emit({ type: "quick_replies", items: ["Route this to a financial aid counselor"] });
        return;
      }
    } catch (e) {
      console.warn("[agent] KB answer LLM failed, extractive fallback:", e instanceof Error ? e.message : e);
    }
  }
  let shownSources = sources.slice(0, 3);
  if (!answer) {
    setSource("scripted");
    const canned = CANNED.find((c) => c.test.test(question));
    if (canned) {
      answer = canned.text;
      shownSources = canned.sources;
    } else answer = extractive(question, top);
  }
  await streamText(emit, answer);
  emit({ type: "sources", items: shownSources });
  const conf = kbConfidence({ strong, retrievedAt: KB_RETRIEVED_AT, sources: sources.length, coverage: Math.max(...top.map((t) => t.coverage)) });
  emit({ type: "confidence", score: conf.score, checks: conf.checks });
}

function dedupeSources(results: KbResult[]) {
  const seen = new Set<string>();
  return results.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true))).map((r) => ({ title: r.title, url: r.url }));
}

/** Scripted-mode answer: quote the most relevant sentences verbatim from the top passages. Never paraphrases facts. */
function extractive(question: string, passages: KbResult[]) {
  const q = new Set(tokenize(question));
  const urls = [...new Set(passages.map((p) => p.url))];
  const scored: { s: string; n: number; ref: number }[] = [];
  for (const p of passages) {
    const ref = urls.indexOf(p.url) + 1;
    const sentences = p.text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^#+\s.*$/gm, "")
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.replace(/^[-*]\s*/, "").replace(/\*\*?(Q|A):?\*?\*?\s*/g, "").replace(/\*+/g, "").trim())
      .filter((s) => s.length > 40 && s.length < 400);
    for (const s of sentences) {
      const n = tokenize(s).filter((t) => q.has(t)).length;
      if (n) scored.push({ s, n, ref });
    }
  }
  const best = scored.sort((a, b) => b.n - a.n).filter((x, i, arr) => arr.findIndex((y) => y.s === x.s) === i).slice(0, 3);
  return `Here's what Financial Aid's published information says:\n\n${best.map((b) => `- ${b.s} [${b.ref}]`).join("\n")}\n\nIf you'd like, I can route a follow-up question to a financial aid counselor.`;
}

function queueCounselor(question: string, reason: string) {
  const s = db();
  s.staffQueue.unshift({ id: uid("q-"), queue: "financial_aid_counselor", title: `Question: ${question.slice(0, 70)}`, reason, ts: Date.now(), status: "pending" });
  s.stats.escalations++;
  addAudit({ caller: "Maya's personal agent", office: "staff", action: "escalate_to_human", decision: "allowed", dataShared: "Question text only", level: "L1" });
  addActivity(["personal", "approvals"]);
  touch();
}

async function escalate(emit: Emit, text: string) {
  step(emit, "personal_agent", "Preparing a handoff note for a financial aid counselor", "done", "L1");
  queueCounselor(text, "Student asked for a human (answer not in published information)");
  step(emit, "approvals", "Routed to financial aid counselor queue", "done", "L1", "Visible in the staff view");
  await streamText(emit, "Done. I've sent your question to a financial aid counselor with a short note, so you won't have to explain it again. You'll see their reply in your cases.");
}

// ---------- Scenario G: hold ----------

async function hold(emit: Emit) {
  step(emit, "personal_agent", "Opening a short case: registration hold", "done", "L1");
  const calls: [Parameters<typeof gateway.call>[0], string][] = [
    ["bursar", "assess_hold"],
    ["financial_aid", "check_disbursement"],
    ["registrar", "get_deadlines"],
  ];
  const rs = await Promise.all(calls.map(([o, a]) => gateway.call(o, a, {}, { level: "L0", emit, step: { label: `Talking to ${OFFICES[o].agent}…`, group: "fanout" } })));
  const ok = rs.every((r) => r.ok);
  step(emit, "consequence_engine", ok ? "Cause identified: fee posted before your scholarship disbursement" : "Cause partly unknown — some offices didn't respond", ok ? "done" : "blocked", "L0");
  step(emit, "consequence_engine", "Fastest path: request a hold review (pending disbursement covers the fee)", "done", "L1", "Policy BUR-2 (mock)");
  await streamText(
    emit,
    "Here's what happened: a $245 student activity fee (mock) posted before your scholarship disbursement, so the Bursar's system placed a hold. Your disbursement is pending and covers it.\n\n**Fastest path:** ask the Bursar for a hold review before your time ticket in 3 days. I've drafted the request. It needs your OK before I send it.",
  );
  emit({ type: "approval_request", caseId: "HOLD", action: "Request hold review", approver: "student" });
}

// ---------- Scenario D: plans ----------

async function forceAdd(emit: Emit, messages: ChatMessage[], setSource: (s: "llm" | "scripted") => void) {
  const p = db().plan;
  step(emit, "personal_agent", "Reading your pre-approved plans", "done", "L0");
  const secs = p.steps.map((st) => db().sections.find((x) => x.id === st.sectionId)!);
  step(emit, "personal_agent", `Signed plan found: ${secs.map((s, i) => `${p.steps[i].rank}: ${s.course}-${s.section}`).join(" → ")}`, "done", "L3", `Limits: max ${p.limits.maxCredits} credits · nothing before ${p.limits.earliestStart}`);
  const scripted = `You have a **signed plan** for next term: Plan A is ${secs[0].course}-${secs[0].section} (${secs[0].time}), then Plan B ${secs[1].course}-${secs[1].section} (${secs[1].time}), then Plan C ${secs[2].course} (${secs[2].time}). Your limits are ${p.limits.maxCredits} credits max and nothing before ${p.limits.earliestStart}.\n\nIf a seat fills, I'll move to the next plan automatically, but **only if it fits your limits**. Otherwise I'll stop and ask you. You can change or revoke the plan anytime on the Plans page.`;
  await prose(emit, messages, scripted, `Maya asked about registration backups. Her signed plan: ${secs.map((s, i) => `Plan ${p.steps[i].rank}: ${s.course}-${s.section} ${s.time}`).join("; ")}. Limits: ${p.limits.maxCredits} credits max, nothing before ${p.limits.earliestStart}. Explain in 2 short paragraphs that you act automatically (L3) only inside these limits and otherwise stop and ask; she can revoke anytime on the Plans page.`, setSource);
}

// ---------- General: real LLM tool loop ----------

async function general(emit: Emit, messages: ChatMessage[], setSource: (s: "llm" | "scripted") => void) {
  const scripted =
    "I can help you with things that usually take several offices. For example:\n\n- **Tell your story once:** if something's happening in your life, I'll coordinate with your offices and show you your options.\n- **Financial aid questions**, answered from finaid.vt.edu with sources.\n- **Registration backups:** I can act within a plan you've signed, and nothing more.\n\nWhat's going on?";
  if (!useLlm()) {
    setSource("scripted");
    step(emit, "personal_agent", "Understanding your request", "done", "L0");
    await streamText(emit, scripted);
    emit({ type: "quick_replies", items: ["What is SAP and how do I appeal?", "What are my deadlines?", "Plan registration backups"] });
    return;
  }
  const convo: LlmMsg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages.map((m) => ({ role: m.role, content: m.content }) as LlmMsg)];
  try {
    for (let i = 0; i < 6; i++) {
      const msg = await complete(convo, { tools: TOOLS });
      if (!msg.tool_calls?.length) {
        await streamText(emit, msg.content || scripted);
        return;
      }
      convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        const name = call.function.name as keyof typeof ARGS;
        const schema = ARGS[name];
        if (!schema) throw new Error(`Unknown tool ${name}`);
        const parsed = schema.safeParse(JSON.parse(call.function.arguments || "{}"));
        if (!parsed.success) throw new Error(`Malformed arguments for ${name}`);
        const result = await runTool(name, parsed.data as Record<string, unknown>, emit, messages);
        convo.push({ role: "tool", tool_call_id: call.id, content: result });
        if (name === "open_case" || name === "search_financial_aid_kb") return; // these write their own prose
      }
    }
    await streamText(emit, "I've gathered what I can. Want me to route this to a person who can help?");
  } catch (e) {
    console.warn("[agent] tool loop failed, scripted fallback:", e instanceof Error ? e.message : e);
    setSource("scripted");
    step(emit, "personal_agent", "Understanding your request", "done", "L0");
    await streamText(emit, scripted);
  }
}

async function runTool(name: keyof typeof ARGS, args: Record<string, unknown>, emit: Emit, messages: ChatMessage[]): Promise<string> {
  switch (name) {
    case "search_financial_aid_kb":
      await finaid(emit, String(args.query), () => {});
      return "Answered with citations.";
    case "ask_office": {
      const office = args.office as Parameters<typeof gateway.call>[0];
      const r = await gateway.call(office, "answer_question", { question: args.question }, { level: "L0", emit, step: { label: `Asking ${OFFICES[office].agent}…` } });
      return r.ok ? r.reply.summary : `Office unavailable: ${r.message}`;
    }
    case "get_student_overview": {
      const r = await gateway.call("registrar", "get_student_overview", { studentId: persona.id }, { level: "L0", emit, step: { label: "Talking to Registrar agent…" }, subjectId: persona.id });
      return r.ok ? JSON.stringify(r.reply.data) : `Unavailable: ${r.message}`;
    }
    case "check_plan": {
      const p = db().plan;
      step(emit, "personal_agent", "Reading your signed plan", "done", "L0");
      return JSON.stringify({ status: p.status, steps: p.steps, limits: p.limits });
    }
    case "escalate_to_human":
      await escalate(emit, String(args.reason));
      return "Escalated.";
    case "open_case": {
      const r = await openCase({ summary: String(args.summary), situation: String(args.situation_type), preference: String(args.preference ?? "not sure yet"), narrative: messages[messages.length - 1].content }, emit);
      await streamText(emit, scriptedCaseProse(r, String(args.preference ?? "")));
      emit({ type: "approval_request", caseId: r.caseId, action: "Send to Dean of Students for approval", approver: "staff" });
      return r.summaryForLlm;
    }
  }
}

/** LLM writes the prose when available; otherwise (or on any failure) the scripted text is used. */
async function prose(emit: Emit, messages: ChatMessage[], scripted: string, instruction: string, setSource: (s: "llm" | "scripted") => void) {
  if (useLlm()) {
    try {
      const msg = await complete(
        [{ role: "system", content: SYSTEM_PROMPT }, ...messages.map((m) => ({ role: m.role, content: m.content }) as LlmMsg), { role: "system", content: `Instruction for this reply: ${instruction}` }],
        { temperature: 0.4 },
      );
      const text = (msg.content ?? "").trim();
      if (text.length > 20) {
        await streamText(emit, text);
        return;
      }
    } catch (e) {
      console.warn("[agent] prose LLM failed, scripted fallback:", e instanceof Error ? e.message : e);
    }
  }
  setSource("scripted");
  await streamText(emit, scripted);
}
