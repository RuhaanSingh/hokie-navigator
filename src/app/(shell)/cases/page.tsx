"use client";
import Link from "next/link";
import { ChevronRight, FileStack } from "lucide-react";
import { useStore } from "@/components/shell/store-provider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/lib/status";
import { timeAgo } from "@/lib/utils";

export default function CasesPage() {
  const { snap } = useStore();
  const cases = snap?.cases ?? [];
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8">
      <div className="mb-5">
        <h2 className="text-[22px] font-semibold tracking-tight">Cases</h2>
        <p className="text-[14px] text-muted">Everything your agent is coordinating for you, in one place.</p>
      </div>
      <Card>
        {cases.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <FileStack className="h-8 w-8 text-[#d6d3d1]" />
            <div className="mt-3 text-[15px] font-medium">No cases yet</div>
            <p className="mt-1 max-w-sm text-[13.5px] text-muted">When you tell your agent about something that involves more than one office, it opens a case here.</p>
            <Link href="/assistant" className="mt-4">
              <Button>Talk to your agent</Button>
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {cases.map((c) => (
              <li key={c.id}>
                <Link href={`/cases/${c.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">
                      #{c.id} · {c.title}
                    </div>
                    <div className="truncate text-[13px] text-muted">
                      {c.officeResponses.length} office agents consulted{c.selectedOption ? ` · Option ${c.selectedOption} chosen` : ""} · updated {timeAgo(c.updatedAt)}
                    </div>
                  </div>
                  <Badge tone={STATUS_LABEL[c.status].tone}>{STATUS_LABEL[c.status].label}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
