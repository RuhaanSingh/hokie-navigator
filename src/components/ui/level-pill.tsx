import { cn } from "@/lib/utils";
import type { Level } from "@/lib/types";

const META: Record<Level | "Staff", { name: string; cls: string }> = {
  L0: { name: "Inform", cls: "bg-surface text-muted border-border" },
  L1: { name: "Draft", cls: "bg-[#f5f5f4] text-[#57534e] border-[#e7e5e4]" },
  L2: { name: "Act with confirmation", cls: "bg-[#fffbeb] text-warning border-[#fde68a]" },
  L3: { name: "Pre-approved plan", cls: "bg-primary-tint text-primary border-[#f6cdd5]" },
  Staff: { name: "Staff approved", cls: "bg-[#f0fdf4] text-success border-[#bbf7d0]" },
};

/** Autonomy ladder pill shown on every action. */
export function LevelPill({ level, className, full }: { level: Level | "Staff"; className?: string; full?: boolean }) {
  const m = META[level];
  return (
    <span title={`${level === "Staff" ? "" : level + " · "}${m.name}`} className={cn("inline-flex shrink-0 items-center rounded-[5px] border px-1.5 text-[11px] font-semibold leading-[18px] tabular", m.cls, className)}>
      {level === "Staff" ? "Staff" : level}
      {full && <span className="ml-1 font-medium">{m.name}</span>}
    </span>
  );
}
