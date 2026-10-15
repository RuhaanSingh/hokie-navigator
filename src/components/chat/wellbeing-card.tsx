import { ExternalLink, HeartHandshake, Phone } from "lucide-react";
import type { WellbeingResource } from "@/lib/types";
import { cn } from "@/lib/utils";

export function WellbeingCard({ urgent, resources }: { urgent: boolean; resources: WellbeingResource[] }) {
  return (
    <div className={cn("rounded-[12px] border p-4", urgent ? "border-[#f6cdd5] bg-primary-tint" : "border-border bg-white")} role={urgent ? "alert" : "region"} aria-label="Human support">
      <div className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-text">
        <HeartHandshake className="h-4 w-4 text-primary" aria-hidden />
        {urgent ? "Please reach out to a person now" : "People who can help right now"}
      </div>
      <div className={cn("grid gap-2", resources.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {resources.map((r) => (
          <div key={r.name} className="rounded-[10px] border border-border bg-white px-3 py-2.5">
            <div className="text-[13.5px] font-medium text-text">{r.name}</div>
            <div className="mb-1.5 text-[12px] leading-snug text-muted">{r.detail}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              {r.phone && (
                <a href={`tel:${r.phone.replace(/[^0-9]/g, "")}`} className="inline-flex items-center gap-1 font-semibold text-primary tabular hover:underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {r.phone}
                </a>
              )}
              <a href={r.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-text">
                Website <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>
          </div>
        ))}
      </div>
      {urgent && <p className="mt-2.5 text-[12.5px] text-[#57534e]">If you are in immediate danger, call 911.</p>}
    </div>
  );
}
