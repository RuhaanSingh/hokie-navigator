"use client";
import * as D from "@radix-ui/react-dialog";
import { RotateCcw, X, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { OFFICES, OFFICE_ORDER } from "@/data/offices-meta";
import { cn } from "@/lib/utils";
import type { Mode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useStore } from "./store-provider";
import { useChat } from "@/components/chat/chat-provider";

/** Presenter panel. Inline on /system; floating via Ctrl/Cmd + Shift + D anywhere. */
export function DemoControls({ compact }: { compact?: boolean }) {
  const { snap, act } = useStore();
  const { clear } = useChat();
  const [busy, setBusy] = useState<string | null>(null);
  if (!snap) return <div className="p-4 text-sm text-muted">Loading…</div>;

  const run = async (key: string, a: Record<string, unknown> & { type: string }, msg?: string) => {
    setBusy(key);
    await act(a);
    setBusy(null);
    if (msg) toast(msg);
  };

  const sec = (id: string) => snap.sections.find((s) => s.id === id)!;

  return (
    <div className={cn("space-y-5 text-[13.5px]", compact && "space-y-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await run("reset", { type: "reset" });
            clear();
            toast.success("Demo reset", { description: "All fixtures restored." });
          }}
          disabled={busy === "reset"}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset demo state
        </Button>
        <Button size="sm" variant="outline" onClick={() => run("hold", { type: "trigger_hold" }, "Watchdog: hold alert triggered")}>
          <Zap className="h-3.5 w-3.5" /> Trigger hold alert
        </Button>
      </div>

      <section>
        <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Agent mode</h3>
        <div className="inline-flex rounded-[8px] border border-border bg-surface p-0.5" role="radiogroup" aria-label="Agent mode">
          {(["live", "hybrid", "scripted"] as Mode[]).map((m) => (
            <button key={m} role="radio" aria-checked={snap.mode === m} onClick={() => run("mode", { type: "mode", mode: m })} className={cn("rounded-[6px] px-3 py-1 text-[13px] font-medium capitalize", snap.mode === m ? "bg-white text-text shadow-sm" : "text-muted hover:text-text")}>
              {m}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] text-muted">
          LLM {snap.llmConfigured ? <span className="text-success">configured (Groq)</span> : <span className="text-warning">not configured: running scripted</span>} · Hybrid falls back silently on any error or a slow first response.
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Office agents</h3>
        <div className="divide-y divide-border rounded-[10px] border border-border">
          {OFFICE_ORDER.map((o) => {
            const h = snap.officeHealth[o];
            return (
              <div key={o} className="flex items-center gap-3 px-3 py-2">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", h.online ? (h.extraLatencyMs ? "bg-warning" : "bg-success") : "bg-danger")} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{OFFICES[o].short}</span>
                <select
                  aria-label={`Latency for ${OFFICES[o].short}`}
                  value={h.extraLatencyMs}
                  onChange={(e) => run("lat" + o, { type: "office_latency", office: o, ms: Number(e.target.value) })}
                  className="h-7 rounded-[6px] border border-border bg-white px-1.5 text-[12px]"
                >
                  <option value={0}>Normal</option>
                  <option value={2000}>+2s slow</option>
                  <option value={5000}>+5s slow</option>
                </select>
                <label className="flex items-center gap-2 text-[12px] text-muted">
                  {h.online ? "Online" : "Offline"}
                  <Switch checked={h.online} onCheckedChange={(v) => run("on" + o, { type: "office_online", office: o, online: v }, `${OFFICES[o].short} agent ${v ? "online" : "offline"}`)} aria-label={`${OFFICES[o].short} online`} />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Course sections (next term)</h3>
        <div className="divide-y divide-border rounded-[10px] border border-border">
          {snap.sections.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate">
                {s.course}-{s.section} <span className="text-muted">· {s.time}</span>
              </span>
              <span className={cn("tabular text-[12px]", s.seats ? "text-muted" : "font-semibold text-danger")}>{s.seats ? `${s.seats} seats` : "Full"}</span>
              {s.seats ? (
                <Button size="sm" variant="outline" className="h-7" onClick={() => run("fill" + s.id, { type: "fill_section", sectionId: s.id }, `${s.course}-${s.section} filled`)}>
                  Fill
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-7" onClick={() => run("re" + s.id, { type: "reopen_section", sectionId: s.id })}>
                  Reopen
                </Button>
              )}
            </div>
          ))}
        </div>
        {sec("CS3214-1").seats > 0 && (
          <Button size="sm" variant="outline" className="mt-2" onClick={() => run("fillx", { type: "fill_section", sectionId: "CS3214-1", overLimit: true }, "CS 3214-1 filled (Plan B moved to 8:00 AM)")}>
            Fill CS 3214-1 · variant: Plan B breaks a limit
          </Button>
        )}
      </section>

      <section className="flex items-center justify-between">
        <span>Show &ldquo;simulated&rdquo; badges</span>
        <Switch checked={snap.showSimBadges} onCheckedChange={(v) => run("sim", { type: "sim_badges", on: v })} aria-label="Show simulated badges" />
      </section>
    </div>
  );
}

export function DemoControlsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/10" />
        <D.Content className="fixed bottom-4 right-4 top-4 z-50 flex w-[400px] max-w-[calc(100vw-2rem)] flex-col rounded-[14px] border border-border bg-white shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <D.Title className="text-[15px] font-semibold">Demo controls</D.Title>
              <D.Description className="text-[12px] text-muted">Presenter only · ⌘/Ctrl + Shift + D</D.Description>
            </div>
            <D.Close className="rounded-[8px] p-1.5 text-muted hover:bg-surface" aria-label="Close">
              <X className="h-4 w-4" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <DemoControls compact />
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
