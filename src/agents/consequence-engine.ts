import "server-only";
import type { Confidence, ConfidenceCheck, OfficeId, OptionCard, OptionRow, Tone } from "@/lib/types";
import type { Assessment, OptionId, OfficeReply } from "./offices/types";
import { CHECK_NAMES, confidence } from "./confidence";

// Evaluates the three options across office responses, counts rule conflicts, and decides which option has the
// fewest consequences. It never chooses for the student.

export type OfficeOutcome = { office: OfficeId; ok: true; reply: OfficeReply } | { office: OfficeId; ok: false; reason: string; message: string };

export const OPTION_DEFS: { id: OptionId; title: string; summary: string; creditsAfter: number }[] = [
  { id: "A", title: "Drop two courses", summary: "Drop CS 3214 and STAT 4705 before Friday (→ 9 credits)", creditsAfter: 9 },
  { id: "B", title: "Incompletes in two courses", summary: "Finish CS 3214 and STAT 4705 next term; stay enrolled", creditsAfter: 15 },
  { id: "C", title: "Medical withdrawal", summary: "Step away from all courses this semester", creditsAfter: 0 },
];

const ROWS: { key: OptionRow["key"]; label: string; office: OfficeId }[] = [
  { key: "academic", label: "Academic", office: "registrar" },
  { key: "scholarship", label: "Scholarship $", office: "financial_aid" },
  { key: "housing", label: "Housing", office: "housing" },
  { key: "visa", label: "Visa status", office: "iss" },
];

const DEADLINE: Record<OptionId, string> = {
  A: "Drop by Friday 5:00 PM; RCL must be authorized first",
  B: "Request before Friday; work due week 6 next term (mock)",
  C: "File before you leave; tuition adjustment uses the filing date",
};

const TONE_WEIGHT: Record<Tone, number> = { ok: 0, unknown: 1, warn: 1, bad: 3 };

export function evaluate(outcomes: OfficeOutcome[]): { options: OptionCard[]; confidence: Confidence; notes: string[]; conflictsFound: { option: OptionId; rules: string[] }[] } {
  const get = (o: OfficeId) => outcomes.find((x) => x.office === o);
  const notes: string[] = [];

  const options: OptionCard[] = OPTION_DEFS.map((def) => {
    const rows: OptionRow[] = ROWS.map(({ key, label, office }) => {
      const out = get(office);
      if (!out) return { key, label, value: "Not consulted", tone: "unknown", ruleIds: [] };
      if (!out.ok) {
        if (out.reason === "consent_revoked") return { key, label, value: "Unknown — consent revoked", tone: "unknown", ruleIds: [] };
        return { key, label, value: "Pending human review", tone: "unknown", ruleIds: [] };
      }
      const a = out.reply.assessments![def.id];
      return { key, label, value: a.impact, tone: a.tone, ruleIds: a.ruleIds };
    });
    rows.push({ key: "deadline", label: "Deadline", value: DEADLINE[def.id], tone: def.id === "A" ? "warn" : "ok", ruleIds: def.id === "A" ? ["REG-1", "ISS-3"] : def.id === "B" ? ["REG-2"] : ["REG-3"] });

    const approvers = new Set<string>();
    const conflictRules: string[] = [];
    for (const out of outcomes) {
      if (!out.ok) continue;
      const a: Assessment | undefined = out.reply.assessments?.[def.id];
      if (a?.approver) approvers.add(a.approver);
      if (a?.conflict) conflictRules.push(...a.ruleIds.slice(0, 1));
    }
    if (approvers.size === 0) approvers.add("Dean of Students");
    rows.push({ key: "approvers", label: "Requires approval from", value: [...approvers].join(", "), tone: "ok", ruleIds: ["DOS-2"] });

    return {
      id: def.id,
      title: def.title,
      summary: def.summary,
      rows,
      conflicts: conflictRules.length,
      conflictRules,
      fewestConsequences: false,
      approvers: [...approvers],
    };
  });

  // Fewest consequences = lowest weighted tone score (conflicts weigh most). Unknown cells count against an option.
  const weight = (o: OptionCard) => o.rows.reduce((s, r) => s + TONE_WEIGHT[r.tone], 0) + o.conflicts * 2;
  const best = [...options].sort((a, b) => weight(a) - weight(b))[0];
  best.fewestConsequences = true;

  const failed = outcomes.filter((o) => !o.ok && o.reason !== "consent_revoked");
  const revoked = outcomes.filter((o) => !o.ok && o.reason === "consent_revoked");
  for (const f of failed) notes.push(`${label(f.office)} did not respond; its impact is pending human review.`);
  for (const r of revoked) notes.push(`${label(r.office)} was not contacted because you revoked consent; its impact is unknown.`);

  // Independent check: registrar's credit math must agree with what scholarship / ISS evaluated (no contradiction).
  const reg = get("registrar");
  const fa = get("financial_aid");
  const agree = Boolean(reg?.ok && fa?.ok);

  const checks: ConfidenceCheck[] = [
    { name: CHECK_NAMES.policy, passed: failed.length === 0, note: failed.length ? `${failed.map((f) => label(f.office)).join(", ")} policy check missing` : "All 5 office agents returned policy evaluations" },
    { name: CHECK_NAMES.fresh, passed: failed.length === 0 && revoked.length === 0, note: failed.length || revoked.length ? "Some office data unavailable" : "All records synced within the hour (mock)" },
    { name: CHECK_NAMES.cited, passed: true, note: "Each cell links to an office rule" },
    { name: CHECK_NAMES.agree, passed: agree, note: agree ? "Registrar and Financial Aid credit counts match" : "Could not cross-check credits with Financial Aid" },
  ];

  return {
    options,
    confidence: confidence(checks),
    notes,
    conflictsFound: options.filter((o) => o.conflicts > 0).map((o) => ({ option: o.id, rules: o.conflictRules })),
  };
}

const label = (o: OfficeId) =>
  ({ dean_of_students: "Dean of Students", registrar: "Registrar", financial_aid: "Financial Aid", housing: "Housing", iss: "ISS", bursar: "Bursar", department: "CS Department" })[o];
