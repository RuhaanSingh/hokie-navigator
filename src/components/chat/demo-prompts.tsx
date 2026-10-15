"use client";
import { ChevronDown, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEMO_PROMPT_GROUPS } from "@/lib/demo-prompts";
import { cn } from "@/lib/utils";

/** Presenter panel: click any prompt and it's sent to the agent exactly as typed. */
export function DemoPrompts({ onSend, busy }: { onSend: (t: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors",
          open ? "border-primary bg-primary-tint text-primary" : "border-border bg-white text-[#57534e] hover:border-[#f6cdd5] hover:text-primary",
        )}
      >
        <Wand2 className="h-3.5 w-3.5" /> Demo prompts <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="dialog" aria-label="Demo prompts" className="absolute bottom-full left-0 z-40 mb-2 w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div>
              <div className="text-[14px] font-semibold">Demo prompts</div>
              <div className="text-[12px] text-muted">Click one to send it to the agent.</div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-[8px] p-1.5 text-muted hover:bg-surface" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[min(460px,60vh)] overflow-y-auto p-4">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[DEMO_PROMPT_GROUPS.filter((g) => !g.title.startsWith("Ask")), DEMO_PROMPT_GROUPS.filter((g) => g.title.startsWith("Ask"))].map((col, ci) => (
                <div key={ci} className="space-y-4">
                  {col.map((g) => (
                    <section key={g.title}>
                      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</h3>
                      <ul className="space-y-1">
                        {g.prompts.map((p) => (
                          <li key={p.label}>
                            <button
                              type="button"
                              disabled={busy}
                              title={p.prompt}
                              onClick={() => {
                                onSend(p.prompt);
                                setOpen(false);
                              }}
                              className="w-full rounded-[8px] px-2.5 py-1.5 text-left transition-colors hover:bg-primary-tint disabled:opacity-50"
                            >
                              <span className="block text-[13.5px] font-medium text-text">{p.label}</span>
                              <span className="block truncate text-[12px] text-muted">{p.note ? `${p.note} · ` : ""}“{p.prompt}”</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
