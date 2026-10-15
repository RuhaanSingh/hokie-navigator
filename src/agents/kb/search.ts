import finaidIndex from "./finaid/index.json";
import registrarIndex from "./registrar/index.json";
import bursarIndex from "./bursar/index.json";
import housingIndex from "./housing/index.json";
import dosIndex from "./dean_of_students/index.json";
import issIndex from "./iss/index.json";
import type { OfficeId } from "@/lib/types";

// Simple BM25 retrieval over committed snapshots of official VT office sites. No network, no vector DB.

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


type Index = { retrieved_at?: string; chunks: KbChunk[] };

export type KbOffice = Extract<OfficeId, "financial_aid" | "registrar" | "bursar" | "housing" | "dean_of_students" | "iss">;

/** Offices with a real knowledge base, and the site each was scraped from. */
export const KB_SITES: Record<KbOffice, string> = {
  financial_aid: "finaid.vt.edu",
  registrar: "registrar.vt.edu",
  bursar: "bursar.vt.edu",
  housing: "housing.vt.edu",
  dean_of_students: "dos.vt.edu",
  iss: "international.vt.edu",
};

const RAW: Record<KbOffice, Index> = {
  financial_aid: finaidIndex as Index,
  registrar: registrarIndex as Index,
  bursar: bursarIndex as Index,
  housing: housingIndex as Index,
  dean_of_students: dosIndex as Index,
  iss: issIndex as Index,
};

const cleanTitle = (t: string) => t.replace(/\s*\|\s*[^|]+$/, "").trim() || t;

const K1 = 1.4;
const B = 0.75;

function build(chunks: KbChunk[]) {
  const docs = chunks.map((c) => {
    const toks = tokenize(`${c.title} ${c.title} ${c.text}`);
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { c, tf, len: toks.length };
  });
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  return { docs, avgLen, df };
}

const INDEXES = Object.fromEntries(
  (Object.keys(RAW) as KbOffice[]).map((o) => {
    const chunks = RAW[o].chunks.map((c) => ({ ...c, title: cleanTitle(c.title) }));
    return [o, build(o === "financial_aid" ? [...chunks, ...SEED] : chunks.length ? chunks : [])];
  }),
) as Record<KbOffice, ReturnType<typeof build>>;

export const KB_RETRIEVED: Record<KbOffice, string> = Object.fromEntries((Object.keys(RAW) as KbOffice[]).map((o) => [o, RAW[o].retrieved_at ?? "2026-10-15"])) as Record<KbOffice, string>;
export const KB_RETRIEVED_AT = KB_RETRIEVED.financial_aid;

export function searchOffice(office: KbOffice, query: string, k = 4): KbResult[] {
  const q = [...new Set(tokenize(query))];
  const idx = INDEXES[office];
  if (!q.length || !idx.docs.length) return [];
  const N = idx.docs.length;
  return idx.docs
    .map((d) => {
      let score = 0;
      let hit = 0;
      for (const t of q) {
        const f = d.tf.get(t) ?? 0;
        if (!f) continue;
        hit++;
        const n = idx.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / idx.avgLen)));
      }
      return { ...d.c, score, coverage: hit / q.length };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Back-compat: Financial Aid search. */
export const searchKb = (query: string, k = 4) => searchOffice("financial_aid", query, k);

/** Is the knowledge base strong enough to answer? Used for the Low-confidence routing rule. */
export function retrievalStrong(results: KbResult[]) {
  const top = results[0];
  return Boolean(top && top.score >= 2.5 && top.coverage >= 0.5);
}

// Keyword routing: which office owns a question. Retrieval breaks ties and catches anything the keywords miss.
const ROUTES: Record<KbOffice, RegExp> = {
  financial_aid: /(financial aid|scholarship|\bsap\b|satisfactory academic|fafsa|\bgrants?\b|\bloans?\b|cost of attendance|\bcoa\b|work[- ]?study|\baid\b|withdraw|resign|w grade)/i,
  registrar: /(transcript|registrar|academic calendar|last day to (drop|add)|drop[- ]add|drop deadline|\bdrop (a|my) (class|course)|grades? (due|available|posted)|final grades?|enrollment verification|verify (my )?enrollment|ferpa|graduat|diploma|125%|credit hour surcharge|in-state tuition)/i,
  bursar: /(bursar|tuition (due|bill|payment)|\bbill\b|billing|\bpay(ing|ment)?\b|refund|late (fee|payment)|due date|hokie wallet|529|payment plan|budget tuition|overpay)/i,
  housing: /(housing|dorm|residence hall|res hall|\broom\b|move[- ]?in|move[- ]?out|housing contract|dining contract|contract (release|cancel|terminat|change)|live on campus)/i,
  dean_of_students: /(dean of students|emergency fund|basic needs|food (pantry|insecurity|security)|market of vt|absence verification|missed class(es)? (for|because)|cares team|student support|advocate)/i,
  iss: /(\bf-?1\b|\bj-?1\b|\bvisa\b|i-?20|international (student|office)|\bopt\b|\bcpt\b|stem opt|on[- ]campus (job|work|employment)|work (on|off) campus|re-?entry|travel (outside|abroad|home)|sevis|duration of status|\bd\/s\b|immigration|cranwell)/i,
};

export function routeOffice(query: string): { office: KbOffice; byKeyword: boolean } | null {
  const scores = (Object.keys(ROUTES) as KbOffice[]).map((o) => {
    const kw = ROUTES[o].test(query) ? 1 : 0;
    const top = searchOffice(o, query, 1)[0];
    const r = top ? Math.min(top.score, 12) / 12 * top.coverage : 0;
    // Without a keyword match, only route on a clearly strong retrieval hit.
    return { o, kw, total: kw * 2 + r, strong: Boolean(top && top.score >= 4 && top.coverage >= 0.75) };
  });
  scores.sort((a, b) => b.total - a.total);
  const best = scores[0];
  if (best.kw) return { office: best.o, byKeyword: true };
  if (best.strong) return { office: best.o, byKeyword: false };
  return null;
}
