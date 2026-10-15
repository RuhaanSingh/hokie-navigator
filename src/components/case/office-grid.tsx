import type { OfficeResponseSummary } from "@/lib/types";
import { OFFICES } from "@/data/offices-meta";
import { cn } from "@/lib/utils";
import { AgentIcon } from "@/components/shell/agent-icon";
import { StatusRing } from "@/components/ui/status-ring";

/** Office agent status grid for a case. */
export function OfficeGrid({ responses }: { responses: OfficeResponseSummary[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {responses.map((r) => (
        <div key={r.office} className={cn("rounded-[10px] border p-3", r.status === "ok" ? "border-border bg-white" : r.status === "blocked" ? "border-[#fde68a] bg-[#fffbeb]" : "border-[#fecaca] bg-[#fef2f2]")}>
          <div className="flex items-center gap-2 text-[13.5px] font-medium">
            <AgentIcon agent={r.office} className="h-4 w-4 text-muted" />
            {OFFICES[r.office].short}
            <span className="ml-auto">
              <StatusRing status={r.status === "ok" ? "done" : r.status === "blocked" ? "blocked" : "error"} />
            </span>
          </div>
          <div className="mt-1 text-[12.5px] leading-snug text-muted">{r.status === "blocked" ? "Not contacted: consent revoked by student" : r.detail}</div>
        </div>
      ))}
    </div>
  );
}
