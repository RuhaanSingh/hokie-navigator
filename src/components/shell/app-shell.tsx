"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast, Toaster } from "sonner";
import {
  Activity,
  FileStack,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "./logo";
import { useStore } from "./store-provider";
import { DemoControlsDialog } from "./demo-controls";
import { TipProvider } from "@/components/ui/tooltip";

const STUDENT_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistant", label: "Navigator", icon: MessageSquareText },
  { href: "/cases", label: "Cases", icon: FileStack },
  { href: "/plans", label: "Pre-approved plans", icon: ListChecks },
  { href: "/privacy", label: "Privacy & consent", icon: Shield },
];

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Dashboard"],
  [/^\/assistant/, "Navigator"],
  [/^\/cases\/.+/, "Case"],
  [/^\/cases/, "Cases"],
  [/^\/plans/, "Pre-approved plans"],
  [/^\/privacy/, "Privacy & consent"],
  [/^\/staff\/cases/, "Staff case file"],
  [/^\/staff/, "Approval queue"],
  [/^\/system/, "System view"],
];

type Role = "student" | "staff" | "system";
const roleOf = (p: string): Role => (p.startsWith("/staff") ? "staff" : p.startsWith("/system") ? "system" : "student");

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { snap } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const role = roleOf(pathname);
  const title = TITLES.find(([r]) => r.test(pathname))?.[1] ?? "Hokie Navigator";
  const pendingStaff = snap?.staffQueue.filter((q) => q.status === "pending" && q.queue === "dean_of_students").length ?? 0;

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("hn-collapsed") === "1");
    } catch {}
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("hn-collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  // Presenter shortcut: Ctrl/Cmd + Shift + D toggles Demo Controls from any page.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setDemoOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    document.title = `${title} · Hokie Navigator`;
  }, [title]);

  // Watchdog notices → toasts (only ones that arrive after this window loaded).
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!snap) return;
    if (!seen.current) {
      seen.current = new Set(snap.notices.map((n) => n.id));
      return;
    }
    for (const n of [...snap.notices].reverse()) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      (n.tone === "ok" ? toast.success : n.tone === "bad" ? toast.error : toast)(n.title, { description: n.body });
    }
  }, [snap]);

  const navItem = (href: string, label: string, Icon: typeof Inbox, badge?: number) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-[8px] px-3 py-2 text-[14px] font-medium transition-colors",
          active ? "bg-primary-tint text-primary" : "text-[#44403c] hover:bg-surface",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
        {!collapsed && <span className="truncate">{label}</span>}
        {!!badge && (
          <span className={cn("ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white", collapsed && "absolute right-1 top-0.5 h-4 min-w-4 text-[10px]")}>
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <TipProvider>
      <div className="flex h-dvh overflow-hidden bg-white">
        <aside className={cn("hidden shrink-0 flex-col border-r border-border bg-white transition-[width] duration-200 md:flex", collapsed ? "w-[68px]" : "w-[248px]")} aria-label="Main navigation">
          <div className={cn("flex h-16 items-center border-b border-border px-4", collapsed && "justify-center px-0")}>
            <Link href="/" aria-label="Hokie Navigator home">
              <Wordmark collapsed={collapsed} />
            </Link>
          </div>
          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {!collapsed && <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Student</div>}
              {STUDENT_NAV.map((n) => navItem(n.href, n.label, n.icon))}
            </div>
            <div className="space-y-1">
              {!collapsed && <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Staff</div>}
              {navItem("/staff", "Approval queue", Inbox, pendingStaff)}
            </div>
            <div className="space-y-1">
              {!collapsed && <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Platform</div>}
              {navItem("/system", "System view", Activity)}
            </div>
          </nav>
          <div className="border-t border-border p-3">
            {snap?.showSimBadges && !collapsed && (
              <p className="mb-2 rounded-[8px] bg-surface px-3 py-2 text-[11.5px] leading-snug text-muted">
                Prototype · office agents are <b className="font-semibold text-[#57534e]">simulated</b> · student data is fictional
              </p>
            )}
            <button onClick={toggleCollapsed} className={cn("flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-[13px] text-muted hover:bg-surface", collapsed && "justify-center px-0")} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!collapsed && "Collapse"}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-white px-4 md:px-6">
            <h1 className="truncate text-[17px] font-semibold text-text">{title}</h1>
            <div className="ml-auto flex items-center gap-3">
              <div role="tablist" aria-label="View as" className="hidden items-center rounded-[9px] border border-border bg-surface p-0.5 sm:flex">
                {(
                  [
                    ["student", "Student", "/"],
                    ["staff", "Staff: Dean of Students", "/staff"],
                    ["system", "System", "/system"],
                  ] as const
                ).map(([r, label, href]) => (
                  <button
                    key={r}
                    role="tab"
                    aria-selected={role === r}
                    onClick={() => router.push(href)}
                    className={cn("relative rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-colors", role === r ? "bg-white text-text shadow-sm" : "text-muted hover:text-text")}
                  >
                    {label}
                    {r === "staff" && pendingStaff > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" aria-label={`${pendingStaff} pending`} />}
                  </button>
                ))}
              </div>
              <button onClick={() => setDemoOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-[8px] text-muted hover:bg-surface hover:text-text" aria-label="Demo controls (Ctrl/Cmd + Shift + D)" title="Demo controls (⌘⇧D)">
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2.5 border-l border-border pl-3">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold", role === "staff" ? "bg-[#f5f5f4] text-[#44403c]" : "bg-primary-tint text-primary")}>{role === "staff" ? "DS" : role === "system" ? "OP" : "MC"}</div>
                <div className="hidden leading-tight lg:block">
                  <div className="text-[13px] font-medium text-text">{role === "staff" ? "Case manager" : role === "system" ? "Platform operator" : "Maya Chen"}</div>
                  <div className="text-[11.5px] text-muted">{role === "staff" ? "Dean of Students · simulated" : role === "system" ? "Monitoring · simulated" : "Junior · CS · simulated sign-in"}</div>
                </div>
              </div>
            </div>
          </header>
          <main id="main" className="min-h-0 flex-1 overflow-y-auto bg-white">
            {children}
          </main>
        </div>
      </div>
      <DemoControlsDialog open={demoOpen} onOpenChange={setDemoOpen} />
      <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: 12, border: "1px solid #E7E5E4", fontFamily: "inherit" } }} />
    </TipProvider>
  );
}
