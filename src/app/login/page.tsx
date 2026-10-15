"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, KeyRound, Smartphone } from "lucide-react";
import { Wordmark } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";

type Stage = "form" | "push" | "approved";

export default function LoginPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("form");
  const [pid, setPid] = useState("mchen24");

  useEffect(() => {
    document.title = "Sign in · Hokie Navigator";
  }, []);
  useEffect(() => {
    if (stage === "push") {
      const t = setTimeout(() => setStage("approved"), 1600);
      return () => clearTimeout(t);
    }
    if (stage === "approved") {
      const t = setTimeout(() => router.push("/"), 1500);
      return () => clearTimeout(t);
    }
  }, [stage, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex justify-center">
          <Wordmark />
        </div>
        <div className="rounded-[14px] border border-border bg-white p-7 shadow-[0_8px_30px_-12px_rgba(28,25,23,0.15)]">
          <AnimatePresence mode="wait">
            {stage === "form" && (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  setStage("push");
                }}
                className="space-y-4"
              >
                <div>
                  <h1 className="text-[20px] font-semibold tracking-tight">Sign in with VT credentials</h1>
                  <p className="text-[13.5px] text-muted">Your personal agent works only for you.</p>
                </div>
                <label className="block">
                  <span className="text-[13px] font-medium">PID</span>
                  <input value={pid} onChange={(e) => setPid(e.target.value)} className="mt-1 block h-10 w-full rounded-[8px] border border-border px-3 text-[15px] focus:border-[#d6d3d1] focus:outline-none" autoComplete="off" />
                </label>
                <label className="block">
                  <span className="text-[13px] font-medium">Password</span>
                  <input type="password" defaultValue="demo-only" className="mt-1 block h-10 w-full rounded-[8px] border border-border px-3 text-[15px] focus:border-[#d6d3d1] focus:outline-none" autoComplete="off" />
                </label>
                <Button type="submit" size="lg" className="w-full">
                  <KeyRound className="h-4 w-4" /> Continue
                </Button>
              </motion.form>
            )}
            {stage !== "form" && (
              <motion.div key="push" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-4 text-center">
                <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint">
                  <AnimatePresence mode="wait">
                    {stage === "push" ? (
                      <motion.span key="phone" initial={{ scale: 0.8 }} animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                        <Smartphone className="h-7 w-7 text-primary" />
                      </motion.span>
                    ) : (
                      <motion.span key="ok" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                        <CheckCircle2 className="h-8 w-8 text-success" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="text-[17px] font-semibold">{stage === "push" ? "Push sent to your phone" : "Approved"}</div>
                <p className="mt-1 text-[13.5px] text-muted">{stage === "push" ? "Approve the two-factor request to continue." : "Opening your dashboard…"}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-4 text-center text-[12px] text-muted">Simulated sign-in · prototype · no real credentials are checked or stored</p>
      </div>
    </div>
  );
}
