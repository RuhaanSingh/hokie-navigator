"use client";
import { Lock, ShieldCheck } from "lucide-react";
import { useStore } from "@/components/shell/store-provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AgentIcon } from "@/components/shell/agent-icon";
import { AuditTable } from "@/components/case/audit-table";
import { OFFICES } from "@/data/offices-meta";
import { cn, timeAgo } from "@/lib/utils";

export default function PrivacyPage() {
  const { snap, act } = useStore();
  if (!snap) return <div className="p-8 text-muted">Loading…</div>;
  const mine = snap.audit.filter((a) => a.caller.includes("Ruhaan") || a.office !== "staff");

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8">
      <div className="mb-5">
        <h2 className="text-[22px] font-semibold tracking-tight">Privacy &amp; consent</h2>
        <p className="text-[14px] text-muted">Your consent ledger. Your agent can only contact offices you allow, and offices get outcomes, not your records.</p>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {[
          { icon: ShieldCheck, t: "Need-to-know only", b: "Housing hears “may drop below full-time”, never why." },
          { icon: Lock, t: "Gateway enforced", b: "Revoke an office and the gateway refuses every call to it." },
          { icon: ShieldCheck, t: "Everything logged", b: "Every request, allowed or blocked, lands in your audit log." },
        ].map((x) => (
          <div key={x.t} className="flex gap-3 rounded-[12px] border border-border bg-surface p-4">
            <x.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <div className="text-[14px] font-semibold">{x.t}</div>
              <div className="text-[13px] text-muted">{x.b}</div>
            </div>
          </div>
        ))}
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Offices your agent may contact</CardTitle>
          <span className="text-[12.5px] text-muted">{snap.consent.filter((c) => c.allowed).length} of {snap.consent.length} allowed</span>
        </CardHeader>
        <ul className="divide-y divide-border">
          {snap.consent.map((c) => (
            <li key={c.office} className="flex flex-wrap items-start gap-4 px-5 py-3.5">
              <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]", c.allowed ? "bg-primary-tint text-primary" : "bg-surface text-muted")}>
                <AgentIcon agent={c.office} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium">{OFFICES[c.office].name}</div>
                {c.shared.length === 0 ? (
                  <div className="text-[13px] text-muted">Nothing shared yet.</div>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {c.shared.slice(0, 2).map((s, i) => (
                      <li key={i} className="text-[13px] text-muted">
                        <span className="text-[#57534e]">Shared:</span> {s.summary} · {timeAgo(s.ts)}
                      </li>
                    ))}
                    {c.shared.length > 2 && <li className="text-[12px] text-muted">+{c.shared.length - 2} more in the audit log</li>}
                  </ul>
                )}
              </div>
              <label className="flex items-center gap-2.5 text-[13px] text-muted">
                {c.allowed ? "Allowed" : "Revoked"}
                <Switch checked={c.allowed} onCheckedChange={(v) => act({ type: "consent", office: c.office, allowed: v })} aria-label={`Allow agent to contact ${OFFICES[c.office].name}`} />
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your personal audit log</CardTitle>
          <span className="text-[12.5px] text-muted">Every office contact made on your behalf</span>
        </CardHeader>
        <CardBody>
          <AuditTable entries={mine} />
        </CardBody>
      </Card>
    </div>
  );
}
