"use client";
import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpenText, HeartHandshake, ListChecks, Trash2 } from "lucide-react";
import { useChat } from "@/components/chat/chat-provider";
import { useStore } from "@/components/shell/store-provider";
import { Message } from "@/components/chat/message";
import { PromptBox } from "@/components/chat/prompt-box";
import { LogoMark } from "@/components/shell/logo";
import { HERO_PROMPT } from "@/lib/demo-prompts";


const STARTERS = [
  { icon: HeartHandshake, title: "Tell your story", body: "Something happening in your life? Say it once; I'll coordinate the offices.", prompt: HERO_PROMPT },
  { icon: BookOpenText, title: "Ask about financial aid", body: "Answers from finaid.vt.edu, with sources.", prompt: "What happens to my financial aid if I withdraw from the semester?" },
  { icon: ListChecks, title: "Plan registration backups", body: "I act only within a plan you've signed.", prompt: "How do my registration backups for CS 3214 work?" },
];

const QUERY_PROMPTS: Record<string, string> = {
  hold: "Help me resolve the Bursar hold on my account.",
  story: HERO_PROMPT,
  aid: "What happens to my financial aid if I withdraw from the semester?",
  plan: "How do my registration backups for CS 3214 work?",
};

function AssistantInner() {
  const { messages, busy, send, clear } = useChat();
  const params = useSearchParams();
  const router = useRouter();
  const bottom = useRef<HTMLDivElement>(null);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const q = params.get("q");
    if (!q || handled.current === q || busy) return;
    handled.current = q;
    send(QUERY_PROMPTS[q] ?? q);
    router.replace("/assistant");
  }, [params, send, busy, router]);

  const { snap } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, last?.content.length, last?.steps.length, last?.options]);
  // Live case updates (staff approval, execution steps) arrive via the store; follow them if the student is near the bottom.
  const caseProgress = snap?.cases.map((c) => `${c.status}:${c.timeline.filter((t) => t.status !== "pending").length}`).join("|");
  useEffect(() => {
    const el = scroller.current;
    if (!el || !caseProgress) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 420) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [caseProgress]);

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[880px] px-4 py-6 md:px-6">
          {messages.length === 0 ? (
            <div className="pt-6 md:pt-12">
              <LogoMark className="h-10 w-10" />
              <h2 className="mt-4 text-[26px] font-semibold tracking-tight">Tell your story once.</h2>
              <p className="mt-1 max-w-xl text-[15px] text-muted">I&apos;m your personal agent. I talk to office agents for you, show you your options, and never act on anything sensitive without a person approving it.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {STARTERS.map((s) => (
                  <button key={s.title} onClick={() => send(s.prompt)} className="group rounded-[12px] border border-border bg-white p-4 text-left transition-colors hover:border-[#f6cdd5] hover:bg-primary-tint/40">
                    <s.icon className="h-5 w-5 text-primary" />
                    <div className="mt-3 text-[14.5px] font-semibold">{s.title}</div>
                    <div className="mt-0.5 text-[13px] leading-snug text-muted">{s.body}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-7 pb-4">
              {messages.map((m) => (
                <Message key={m.id} m={m} onQuickReply={send} />
              ))}
              <div ref={bottom} />
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 border-t border-border bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[880px] px-4 py-3 md:px-6">
          <PromptBox onSend={send} busy={busy} autoFocus />
          <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-[#a8a29e]">
            <span>The AI coordinates; people decide. Not for emergencies: call 911 or 988.</span>
            {messages.length > 0 && (
              <button onClick={clear} disabled={busy} className="inline-flex items-center gap-1 hover:text-muted">
                <Trash2 className="h-3 w-3" /> Clear conversation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense>
      <AssistantInner />
    </Suspense>
  );
}
