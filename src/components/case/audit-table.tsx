"use client";
import { useMemo, useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { OFFICES } from "@/data/offices-meta";
import { cn, clock } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LevelPill } from "@/components/ui/level-pill";

const officeName = (o: AuditEntry["office"]) =>
  o === "gateway" ? "Gateway" : o === "personal_agent" ? "Personal agent" : o === "staff" ? "Staff queue" : OFFICES[o].short;

export function AuditTable({ entries, filters = true, empty = "No entries yet.", max = 200 }: { entries: AuditEntry[]; filters?: boolean; empty?: string; max?: number }) {
  const [office, setOffice] = useState("all");
  const [decision, setDecision] = useState("all");
  const offices = useMemo(() => [...new Set(entries.map((e) => e.office))], [entries]);
  const rows = entries.filter((e) => (office === "all" || e.office === office) && (decision === "all" || e.decision === decision)).slice(0, max);

  return (
    <div>
      {filters && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
          <label className="flex items-center gap-1.5 text-muted">
            Office
            <select value={office} onChange={(e) => setOffice(e.target.value)} className="h-8 rounded-[8px] border border-border bg-white px-2 text-text">
              <option value="all">All</option>
              {offices.map((o) => (
                <option key={o} value={o}>
                  {officeName(o)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            Decision
            <select value={decision} onChange={(e) => setDecision(e.target.value)} className="h-8 rounded-[8px] border border-border bg-white px-2 text-text">
              <option value="all">All</option>
              <option value="allowed">Allowed</option>
              <option value="blocked">Blocked</option>
              <option value="error">Error</option>
            </select>
          </label>
          <span className="ml-auto text-muted">{rows.length} entries</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-[10px] border border-border">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="bg-surface text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Caller</th>
              <th className="px-3 py-2 font-medium">Office</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Decision</th>
              <th className="px-3 py-2 font-medium">Data shared</th>
              <th className="px-3 py-2 font-medium">Case</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  {empty}
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr key={e.id} className={cn("border-t border-border align-top", e.decision !== "allowed" && "bg-[#fffdf7]")}>
                <td className="whitespace-nowrap px-3 py-2 text-muted tabular">{clock(e.ts)}</td>
                <td className="px-3 py-2">{e.caller}</td>
                <td className="whitespace-nowrap px-3 py-2">{officeName(e.office)}</td>
                <td className="px-3 py-2">
                  <span className="font-mono text-[12px]">{e.action}</span> {e.level && <LevelPill level={e.level} className="ml-1" />}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={e.decision === "allowed" ? "ok" : e.decision === "blocked" ? "warn" : "bad"}>{e.decision}</Badge>
                  {e.reason && <div className="mt-0.5 max-w-[220px] text-[12px] text-muted">{e.reason}</div>}
                </td>
                <td className="max-w-[260px] px-3 py-2 text-muted">{e.dataShared}</td>
                <td className="whitespace-nowrap px-3 py-2 text-muted">{e.caseId ? `#${e.caseId}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
