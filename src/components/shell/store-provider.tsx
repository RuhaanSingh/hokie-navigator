"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Snapshot } from "@/lib/types";

type Action = Record<string, unknown> & { type: string };
interface Ctx {
  snap: Snapshot | null;
  act: (a: Action) => Promise<Snapshot | null>;
  refresh: () => void;
}

const StoreCtx = createContext<Ctx>({ snap: null, act: async () => null, refresh: () => {} });

/** Polls the server-side in-memory store so the student, staff and system windows stay in sync. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const versionRef = useRef<number>(-1);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (!r.ok) return;
      const s = (await r.json()) as Snapshot;
      if (s.version !== versionRef.current) {
        versionRef.current = s.version;
        setSnap(s);
      }
    } catch {
      /* server restarting; keep last snapshot */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 1000);
    return () => clearInterval(t);
  }, [load]);

  const act = useCallback(async (a: Action) => {
    try {
      const r = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) });
      if (!r.ok) return null;
      const s = (await r.json()) as Snapshot;
      versionRef.current = s.version;
      setSnap(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  return <StoreCtx.Provider value={{ snap, act, refresh: load }}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);
