import { Fragment, type ReactNode } from "react";

/** Minimal, safe markdown: paragraphs, bullet lists, **bold**, *italic*, [n] citation markers. No raw HTML. */
function inline(text: string, sources?: { title: string; url: string }[]): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\d+\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={k++} className="font-semibold text-text">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("[")) {
      const n = Number(t.slice(1, -1));
      const src = sources?.[n - 1];
      out.push(
        src ? (
          <a key={k++} href={src.url} target="_blank" rel="noreferrer" title={src.title} className="mx-0.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[4px] bg-primary-tint px-1 align-[1px] text-[11px] font-semibold text-primary no-underline hover:bg-[#fae4e8]">
            {n}
          </a>
        ) : (
          <sup key={k++} className="text-[11px] text-muted">{n}</sup>
        ),
      );
    } else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, sources }: { text: string; sources?: { title: string; url: string }[] }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2.5 text-[15px] leading-relaxed text-[#292524]">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-[#a8a29e]">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""), sources)}</li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l, sources)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
