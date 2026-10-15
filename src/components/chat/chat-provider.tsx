"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Confidence, OptionCard, TraceEvent, TraceStep, WellbeingResource } from "@/lib/types";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: TraceStep[];
  sources?: { title: string; url: string }[];
  confidence?: Confidence;
  options?: { caseId: string; options: OptionCard[]; confidence: Confidence; notes: string[] };
  approval?: { caseId: string; action: string; approver: "student" | "staff" };
  wellbeing?: { urgent: boolean; resources: WellbeingResource[] };
  quickReplies?: string[];
  meta?: { intent: string; source: "llm" | "scripted" };
  startedAt: number;
  endedAt?: number;
  streaming?: boolean;
}

interface Ctx {
  messages: UiMessage[];
  busy: boolean;
  send: (text: string) => void;
  clear: () => void;
}

const ChatCtx = createContext<Ctx>({ messages: [], busy: false, send: () => {}, clear: () => {} });
const KEY = "hn-chat-v1";

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const msgsRef = useRef<UiMessage[]>([]);
  msgsRef.current = messages;

  // Per-viewer convenience: keep the conversation across page navigation / refresh.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    if (busy) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(messages));
    } catch {}
  }, [messages, busy]);

  const patch = (id: string, fn: (m: UiMessage) => UiMessage) => setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const history = msgsRef.current;
    const lastIntent = [...history].reverse().find((m) => m.role === "assistant")?.meta?.intent;
    const user: UiMessage = { id: crypto.randomUUID(), role: "user", content: t, steps: [], startedAt: Date.now() };
    const asst: UiMessage = { id: crypto.randomUUID(), role: "assistant", content: "", steps: [], startedAt: Date.now(), streaming: true };
    // Quick replies are one-shot: hide them once the student answers.
    setMessages((ms) => [...ms.map((m) => ({ ...m, quickReplies: undefined })), user, asst]);
    setBusy(true);

    const payload = {
      lastIntent,
      messages: [...history, user].filter((m) => m.content).slice(-12).map((m) => ({ role: m.role, content: m.content })),
    };

    const apply = (e: TraceEvent) => {
      patch(asst.id, (m) => {
        switch (e.type) {
          case "step": {
            const { type: _t, ...s } = e;
            void _t;
            const i = m.steps.findIndex((x) => x.id === s.id);
            const steps = i >= 0 ? m.steps.map((x, j) => (j === i ? { ...x, ...s } : x)) : [...m.steps, { ...s, ts: Date.now() }];
            return { ...m, steps };
          }
          case "token":
            return { ...m, content: m.content + e.text };
          case "sources":
            return { ...m, sources: e.items };
          case "confidence":
            return { ...m, confidence: { score: e.score, checks: e.checks } };
          case "options":
            return { ...m, options: { caseId: e.caseId, options: e.options, confidence: e.confidence, notes: e.notes } };
          case "approval_request":
            return { ...m, approval: { caseId: e.caseId, action: e.action, approver: e.approver } };
          case "wellbeing":
            return { ...m, wellbeing: { urgent: e.urgent, resources: e.resources } };
          case "quick_replies":
            return { ...m, quickReplies: e.items };
          case "meta":
            return { ...m, meta: { intent: e.intent, source: e.source } };
          case "done":
            return { ...m, streaming: false, endedAt: Date.now() };
          default:
            return m;
        }
      });
    };

    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok || !res.body) throw new Error("bad response");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.trim();
          if (!line.startsWith("data:")) continue;
          try {
            apply(JSON.parse(line.slice(5)) as TraceEvent);
          } catch {}
        }
      }
    } catch {
      // Never show a raw error: turn it into a friendly trace row.
      apply({ type: "step", id: "net-err", agent: "personal_agent", label: "Couldn't reach your agent — nothing was changed", status: "error" });
      apply({ type: "token", text: "I couldn't reach the server just now. Nothing was sent anywhere. Please try again in a moment." });
    } finally {
      patch(asst.id, (m) => ({ ...m, streaming: false, endedAt: m.endedAt ?? Date.now(), steps: m.steps.map((s) => (s.status === "running" ? { ...s, status: "done" } : s)) }));
      setBusy(false);
    }
  }, [busy]);

  const clear = useCallback(() => {
    setMessages([]);
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
  }, []);

  return <ChatCtx.Provider value={{ messages, busy, send, clear }}>{children}</ChatCtx.Provider>;
}

export const useChat = () => useContext(ChatCtx);
