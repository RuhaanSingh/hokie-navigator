"use client";
import { ArrowUp, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function PromptBox({ onSend, busy, autoFocus }: { onSend: (t: string) => void; busy: boolean; autoFocus?: boolean }) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [v]);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const submit = () => {
    if (!v.trim() || busy) return;
    onSend(v);
    setV("");
  };
  return (
    <div className="rounded-[14px] border border-border bg-white shadow-[0_2px_12px_-6px_rgba(28,25,23,0.12)] focus-within:border-[#d6d3d1]">
      <label htmlFor="prompt" className="sr-only">
        Message your agent
      </label>
      <textarea
        id="prompt"
        ref={ref}
        rows={1}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Tell your agent what's going on…"
        className="block w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed text-text placeholder:text-[#a8a29e] focus:outline-none"
      />
      <div className="flex items-center gap-2 px-3 pb-2.5 pt-1">
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <Lock className="h-3 w-3" /> Works only for you · every office contact is logged
        </span>
        <button onClick={submit} disabled={!v.trim() || busy} aria-label="Send" className={cn("ml-auto flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors", v.trim() && !busy ? "bg-primary text-white hover:bg-primary-hover" : "bg-[#f5f5f4] text-[#a8a29e]")}>
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
