import type { Confidence, ConfidenceCheck, ConfidenceScore } from "@/lib/types";

// Confidence = four independent checks. High → present with citations. Medium → caveat + flagged for staff review.
// Low → do not answer; route to a human with the case file.

export const CHECK_NAMES = {
  policy: "Passed the office's deterministic policy check",
  fresh: "Data is current",
  cited: "Every claim cites a policy or record",
  agree: "Independent check agrees",
} as const;

export function score(checks: ConfidenceCheck[]): ConfidenceScore {
  const passed = checks.filter((c) => c.passed).length;
  if (passed === 4) return "high";
  if (passed >= 2) return "medium";
  return "low";
}

export function confidence(checks: ConfidenceCheck[], force?: ConfidenceScore): Confidence {
  return { score: force ?? score(checks), checks };
}

/** For Financial Aid L0 answers built from retrieved passages. */
export function kbConfidence(opts: { strong: boolean; retrievedAt: string; sources: number; coverage: number }): Confidence {
  const ageDays = (Date.now() - new Date(opts.retrievedAt).getTime()) / 86_400_000;
  const checks: ConfidenceCheck[] = [
    { name: CHECK_NAMES.policy, passed: opts.strong, note: opts.strong ? "Retrieval score above threshold" : "No passage scored high enough" },
    { name: CHECK_NAMES.fresh, passed: ageDays < 90, note: `finaid.vt.edu snapshot from ${new Date(opts.retrievedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` },
    { name: CHECK_NAMES.cited, passed: opts.sources > 0, note: `${opts.sources} source link${opts.sources === 1 ? "" : "s"}` },
    { name: CHECK_NAMES.agree, passed: opts.coverage >= 0.6, note: `Passages contain ${Math.round(opts.coverage * 100)}% of the question's key terms` },
  ];
  return confidence(checks, opts.strong ? undefined : "low");
}
