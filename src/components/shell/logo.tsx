import { cn } from "@/lib/utils";

/** Original glyph: a compass needle inside a ring of agent nodes. Not a VT mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#C8102E" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.3" />
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={16 + 9.5 * Math.sin((a * Math.PI) / 180)} cy={16 - 9.5 * Math.cos((a * Math.PI) / 180)} r="1.9" fill="#fff" />
      ))}
      <path d="M16 9.5 L18.6 16 L16 22.5 L13.4 16 Z" fill="#fff" />
      <path d="M16 16 L18.6 16 L16 22.5 Z" fill="#FDF2F4" opacity=".55" />
    </svg>
  );
}

export function Wordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-text">Hokie Navigator</div>
          <div className="text-[11px] text-muted">VT Agent Network</div>
        </div>
      )}
    </div>
  );
}
