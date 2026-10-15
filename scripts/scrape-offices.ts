/**
 * One-time scraper for the other offices' knowledge bases (Registrar, Bursar, Housing, Dean of Students, ISS).
 * Run: npx tsx scripts/scrape-offices.ts
 * Output (committed): src/agents/kb/<office>/*.md and index.json. Nothing is fetched at runtime.
 * Financial Aid has its own crawler: scripts/scrape-finaid.ts.
 */
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCES: Record<string, string[]> = {
  registrar: [
    "https://registrar.vt.edu/dates-deadlines.html",
    "https://registrar.vt.edu/dates-deadlines/academic-calendar.html",
    "https://registrar.vt.edu/dates-deadlines/Enrollment-Dates.html",
    "https://registrar.vt.edu/dates-deadlines/grade-deadlines-availability.html",
    "https://registrar.vt.edu/Enrollment.html",
    "https://registrar.vt.edu/Enrollment/125-Rule.html",
    "https://registrar.vt.edu/academic-records.html",
    "https://registrar.vt.edu/academic-records/Transcript-Requests.html",
    "https://registrar.vt.edu/academic-records/Certifications-Verifications.html",
    "https://registrar.vt.edu/FERPA.html",
    "https://registrar.vt.edu/forms-multi-brief.html",
    "https://registrar.vt.edu/graduation-multi-brief/graduation-policies.html",
  ],
  bursar: [
    "https://bursar.vt.edu/index.html",
    "https://bursar.vt.edu/payments.html",
    "https://bursar.vt.edu/payments/financial-aid.html",
    "https://bursar.vt.edu/payments/budget-tuition-plan-.html",
    "https://bursar.vt.edu/payments/report-outside-scholarships.html",
    "https://bursar.vt.edu/refunds1.html",
    "https://bursar.vt.edu/refunds1/refunds.html",
    "https://bursar.vt.edu/refunds1/overpayment.html",
    "https://bursar.vt.edu/tuition-fee-rates/tuitionduedates.html",
    "https://bursar.vt.edu/tuition-fee-rates/tuition-fees.html",
    "https://bursar.vt.edu/about/contactus.html",
  ],
  housing: [
    "https://housing.vt.edu/index.html",
    "https://housing.vt.edu/contracts.html",
    "https://housing.vt.edu/contracts/terms.html",
    "https://housing.vt.edu/contracts/Makingchangestocontract.html",
    "https://housing.vt.edu/contracts/rates.html",
    "https://housing.vt.edu/contracts/apply.html",
    "https://housing.vt.edu/experience/movein.html",
    "https://housing.vt.edu/experience/moveout.html",
  ],
  dean_of_students: [
    "https://dos.vt.edu/index.html",
    "https://dos.vt.edu/office/our_services.html",
    "https://dos.vt.edu/office/Absence_Verification_Request.html",
    "https://dos.vt.edu/office/emergencyfund.html",
    "https://dos.vt.edu/office/cares.html",
    "https://dos.vt.edu/office/basicneeds.html",
    "https://dos.vt.edu/office/resources.html",
    "https://dos.vt.edu/food_security.html",
  ],
  iss: [
    "https://international.vt.edu/index.html",
    "https://international.vt.edu/FAQ.html",
    "https://international.vt.edu/duration_of_status.html",
    "https://international.vt.edu/academics/immigration-advising.html",
    "https://international.vt.edu/employment.html",
    "https://international.vt.edu/employment/on_campus_employment.html",
    "https://international.vt.edu/employment/cpt.html",
    "https://international.vt.edu/employment/opt.html",
    "https://international.vt.edu/travel.html",
    "https://international.vt.edu/new_students/undergrads.html",
    "https://international.vt.edu/about/contact_us.html",
  ],
};

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

function extractMain(html: string) {
  const i = html.indexOf('<main id="vt_main"');
  if (i < 0) return "";
  const j = html.indexOf("</main>", i);
  return html.slice(i, j < 0 ? undefined : j);
}

function toMarkdown(html: string, base: string) {
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
  return decode(s)
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n- \n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const title = (html: string) =>
  decode((html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "Untitled").replace(/\s+/g, " ").trim()).replace(/\s*\|\s*Virginia Tech\s*$/i, "");

const slug = (u: string) => new URL(u).pathname.replace(/\.html$/, "").replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";

type Chunk = { id: string; title: string; url: string; text: string };

function chunk(md: string, t: string, url: string, base: string): Chunk[] {
  const chunks: Chunk[] = [];
  let cur: string[] = [];
  let words = 0;
  let heading = "";
  const flush = () => {
    if (words > 25) chunks.push({ id: `${base}#${chunks.length}`, title: t, url, text: (heading && !cur[0]?.startsWith("#") ? heading + "\n\n" : "") + cur.join("\n\n") });
    cur = [];
    words = 0;
  };
  for (const p of md.split(/\n\n+/)) {
    const w = p.split(/\s+/).length;
    if (p.startsWith("#")) heading = p;
    if (words + w > 450 && words > 150) flush();
    cur.push(p);
    words += w;
  }
  flush();
  return chunks;
}

async function get(u: string) {
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (HokieNavigator prototype KB builder)" }, signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

async function main() {
  const retrieved = new Date().toISOString();
  for (const [office, urls] of Object.entries(SOURCES)) {
    const out = join(process.cwd(), "src/agents/kb", office);
    mkdirSync(out, { recursive: true });
    for (const f of readdirSync(out)) if (f.endsWith(".md")) unlinkSync(join(out, f));
    const all: Chunk[] = [];
    for (const u of urls) {
      const html = await get(u);
      if (!html) {
        console.warn("skip", u);
        continue;
      }
      const md = toMarkdown(extractMain(html), u);
      if (md.split(/\s+/).length < 40) {
        console.warn("thin", u);
        continue;
      }
      const t = title(html);
      const s = slug(u);
      writeFileSync(join(out, `${s}.md`), `---\ntitle: ${JSON.stringify(t)}\nurl: ${u}\nretrieved_at: ${retrieved}\n---\n\n${md}\n`);
      all.push(...chunk(md, t, u, `${office}:${s}`));
    }
    writeFileSync(join(out, "index.json"), JSON.stringify({ retrieved_at: retrieved, chunks: all }));
    console.log(`${office}: ${all.length} chunks from ${new Set(all.map((c) => c.url)).size} pages`);
  }
}

main();
