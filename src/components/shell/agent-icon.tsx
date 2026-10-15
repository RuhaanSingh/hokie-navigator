import {
  Bot,
  Building2,
  ClipboardList,
  GraduationCap,
  HandHeart,
  Home,
  Landmark,
  Network,
  Plane,
  Scale,
  ShieldCheck,
  Sparkles,
  Wallet,
  Eye,
  ScrollText,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<string, LucideIcon> = {
  personal_agent: Bot,
  gateway: Network,
  dean_of_students: HandHeart,
  registrar: ClipboardList,
  financial_aid: Wallet,
  housing: Home,
  iss: Plane,
  bursar: Landmark,
  department: GraduationCap,
  consequence_engine: Scale,
  policy: ShieldCheck,
  safety: HandHeart,
  audit: ScrollText,
  approvals: UserCheck,
  watchdog: Eye,
  staff: UserCheck,
  llm: Sparkles,
};

export function AgentIcon({ agent, className }: { agent: string; className?: string }) {
  const I = MAP[agent] ?? Building2;
  return <I className={cn("h-3.5 w-3.5", className)} aria-hidden />;
}
