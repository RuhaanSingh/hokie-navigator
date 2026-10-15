import index from "./finaid/index.json";

// Simple BM25 retrieval over the committed finaid.vt.edu snapshot. No network, no vector DB.

export interface KbChunk {
  id: string;
  title: string;
  url: string;
  text: string;
}

export interface KbResult extends KbChunk {
  score: number;
  coverage: number; // share of query terms present in this passage
}

// Seed facts (mirrors seed.md) so answers stay possible even if the scraped index is empty.
const SEED: KbChunk[] = [
  {
    id: "seed#0",
    title: "Withdrawing or Resigning",
    url: "https://finaid.vt.edu/undergraduate/policies-regulations/enrollment-withdrawal.html",
    text: "Withdrawing or resigning after the semester starts may reduce financial aid and leave a balance owed to the Bursar; the withdrawal or resignation date drives the calculation. Students should talk with a financial aid counselor and the Bursar before resigning.",
  },
  {
    id: "seed#1",
    title: "Satisfactory Academic Progress (SAP)",
    url: "https://finaid.vt.edu/undergraduate/policies-regulations/satisfactory-academic-progress-sap.html",
    text: "Students must meet Satisfactory Academic Progress (SAP) standards (GPA, pace of progress, maximum timeframe) to keep federal, state, and institutional aid; failing SAP suspends aid eligibility. Students can appeal, with a limit of two SAP appeals during their time at VT.",
  },
  {
    id: "seed#2",
    title: "How To Course Withdraw",
    url: "https://eng.vt.edu/undergraduate/resources-support/how-to/course-withdraw.html",
    text: "Course withdrawal (W grade) is allowed after the drop deadline for up to three courses in an undergraduate career; a W does not count in GPA. Students using financial aid should consult the financial aid office before withdrawing.",
  },
];

const STOP = new Set(
  "a an and are as at be but by can do does for from how i if in into is it its me my of on or our so that the their then there these this to was what when where which who will with would you your about should after before am any have has get need want happen happens tell know".split(
    " ",
  ),
);

const stem = (w: string) =>
  w
    .replace(/'s$/, "")
    .replace(/(ies)$/, "y")
    .replace(/(ing|ed)$/, "")
    .replace(/(es|s)$/, "")
    .replace(/(al)$/, "");

export const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);

const cleanTitle = (t: string) => t.replace(/\s*\|\s*(Office of University Scholarships and Financial Aid|Engineering)\s*$/i, "").trim();

const scraped = (index as { chunks: KbChunk[] }).chunks.map((c) => ({ ...c, title: cleanTitle(c.title) }));
const CHUNKS: KbChunk[] = scraped.length ? [...scraped, ...SEED] : SEED;
export const KB_RETRIEVED_AT = (index as { retrieved_at?: string }).retrieved_at ?? "2026-10-15";

const docs = CHUNKS.map((c) => {
  const toks = tokenize(`${c.title} ${c.title} ${c.text}`);
  const tf = new Map<string, number>();
  for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
  return { c, tf, len: toks.length };
});
const avgLen = docs.reduce((s, d) => s + d.len, 0) / docs.length;
const df = new Map<string, number>();
for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);

const K1 = 1.4;
const B = 0.75;

export function searchKb(query: string, k = 4): KbResult[] {
  const q = [...new Set(tokenize(query))];
  if (!q.length) return [];
  const N = docs.length;
  const scored = docs.map((d) => {
    let score = 0;
    let hit = 0;
    for (const t of q) {
      const f = d.tf.get(t) ?? 0;
      if (!f) continue;
      hit++;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / avgLen)));
    }
    return { ...d.c, score, coverage: hit / q.length };
  });
  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Is the knowledge base strong enough to answer? Used for the Low-confidence routing rule. */
export function retrievalStrong(results: KbResult[]) {
  const top = results[0];
  return Boolean(top && top.score >= 4 && top.coverage >= 0.6);
}
