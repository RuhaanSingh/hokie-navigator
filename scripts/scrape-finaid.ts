/**
 * One-time scraper for the Financial Aid knowledge base.
 * Run: npx tsx scripts/scrape-finaid.ts
 * Output (committed): src/agents/kb/finaid/*.md and src/agents/kb/finaid/index.json
 * The app never touches the network at runtime for KB answers.
 */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "src/agents/kb/finaid");
const MAX_PAGES = 40;
const SEEDS = [
  "https://finaid.vt.edu/undergraduate/policies-regulations/enrollment-withdrawal.html",
  "https://finaid.vt.edu/appeals/satisfactory-academic-progress.html",
  "https://finaid.vt.edu/undergraduate/policies-regulations/satisfactory-academic-progress-sap.html",
  "https://finaid.vt.edu/",
  "https://eng.vt.edu/undergraduate/resources-support/how-to/course-withdraw.html",
];
// Topics worth following from the home page / seeds (one level deep).
const FOLLOW = /(cost|attendance|types-of-aid|scholarship|apply|deadline|contact|withdraw|enrollment|sap|appeal|grant|loan|work-study|policies|undergraduate\/|international|bursar|refund|disburse|fafsa)/i;

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function extractMain(html: string): string {
  const i = html.indexOf('<main id="vt_main"');
  if (i < 0) return "";
  const j = html.indexOf("</main>", i);
  return html.slice(i, j < 0 ? undefined : j);
}

function toMarkdown(html: string, base: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<img[^>]*>/gi, "");
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l, t) => `\n\n${"#".repeat(Math.max(2, Number(l)))} ${t.replace(/<[^>]+>/g, "").trim()}\n\n`);
  s = s.replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, t: string) => {
    const text = t.replace(/<[^>]+>/g, "").trim();
    if (!text) return "";
    if (href.startsWith("#") || href.startsWith("javascript")) return text;
    try {
      return `[${text}](${new URL(href, base).toString()})`;
    } catch {
      return text;
    }
  });
  s = s
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|ul|ol|table|tr|section)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<[^>]+>/g, "");
  s = decode(s)
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n- \n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

function title(html: string): string {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return decode((m?.[1] ?? "Untitled").replace(/\s+/g, " ").trim()).replace(/\s*\|\s*Virginia Tech\s*$/i, "");
}

function links(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="([^"#?]+\.html)"/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.hostname === "finaid.vt.edu" && FOLLOW.test(u.pathname) && !/test/i.test(u.pathname)) out.add(u.toString());
    } catch {}
  }
  return [...out];
}

const slug = (u: string) =>
  new URL(u).hostname.split(".")[0] +
  "-" +
  (new URL(u).pathname.replace(/\.html$/, "").replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home");

async function get(u: string): Promise<string | null> {
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (HokieNavigator prototype KB builder)" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

type Chunk = { id: string; title: string; url: string; text: string };

function chunk(md: string, t: string, url: string, base: string): Chunk[] {
  const paras = md.split(/\n\n+/);
  const chunks: Chunk[] = [];
  let cur: string[] = [];
  let words = 0;
  let heading = "";
  const flush = () => {
    if (words > 25) chunks.push({ id: `${base}#${chunks.length}`, title: t, url, text: (heading && !cur[0]?.startsWith("#") ? heading + "\n\n" : "") + cur.join("\n\n") });
    cur = [];
    words = 0;
  };
  for (const p of paras) {
    const w = p.split(/\s+/).length;
    if (p.startsWith("#")) heading = p;
    if (words + w > 450 && words > 150) flush();
    cur.push(p);
    words += w;
  }
  flush();
  return chunks;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (f.endsWith(".md") && f !== "seed.md") unlinkSync(join(OUT, f));
  const queue = [...SEEDS];
  const seen = new Set<string>();
  const all: Chunk[] = [];
  const retrieved = new Date().toISOString();
  let depth0 = new Set(SEEDS);
  while (queue.length && seen.size < MAX_PAGES) {
    const u = queue.shift()!;
    if (seen.has(u)) continue;
    seen.add(u);
    const html = await get(u);
    if (!html) {
      console.warn("skip", u);
      continue;
    }
    const md = toMarkdown(extractMain(html), u);
    if (md.split(/\s+/).length < 60) continue;
    const t = title(html);
    const s = slug(u);
    writeFileSync(join(OUT, `${s}.md`), `---\ntitle: ${JSON.stringify(t)}\nurl: ${u}\nretrieved_at: ${retrieved}\n---\n\n${md}\n`);
    all.push(...chunk(md, t, u, s));
    console.log("ok", u, md.length);
    if (depth0.has(u)) for (const l of links(html, u)) if (!seen.has(l)) queue.push(l);
  }
  writeFileSync(join(OUT, "index.json"), JSON.stringify({ retrieved_at: retrieved, chunks: all }, null, 0));
  console.log(`pages=${seen.size} chunks=${all.length}`);
  depth0 = new Set();
}

main();
