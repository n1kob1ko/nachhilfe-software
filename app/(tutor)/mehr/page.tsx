import Link from "next/link";
import {
  BarChart3,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  Coins,
  DoorOpen,
  Download,
  FileText,
  FileUp,
  FolderUp,
  GitBranch,
  KeyRound,
  Landmark,
  Library,
  ListChecks,
  ListTodo,
  LogOut,
  MessageSquarePlus,
  MonitorPlay,
  Package,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TabletSmartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/session-actions";
import { Avatar } from "@/components/Art";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { feedbackZahlen } from "@/lib/feedback";
import { wienerDatum } from "@/lib/planung/zeit";
import { zuErledigen } from "@/lib/zu-erledigen";
import { erweitertGruppen, type ErweitertEintrag } from "@/lib/erweitert";

export const metadata = { title: "Erweitert" };

const ICONS: Record<string, LucideIcon> = {
  BarChart3, BookMarked, BookOpen, BookOpenCheck, CalendarClock, CalendarDays, CalendarRange, ClipboardList, Clock3, Coins, DoorOpen, Download,
  FileText, FileUp, FolderUp, GitBranch, KeyRound, Landmark, Library, ListChecks, ListTodo, MessageSquarePlus, MonitorPlay, Package, ReceiptText,
  ShieldCheck, TabletSmartphone, Users,
};

/**
 * **Erweitert**: alles außer Heute, Unterricht und Abschluss (niko, 25.10.2026: „Alles andere kommt nach Erweitert und
 * wird nie gelöscht“). Seit dem Audit 2026-11-07 nach Rolle geordnet (lib/erweitert.ts): die Lehrkraft sieht oben acht
 * Kacheln ihrer Arbeit und ihr Konto, alles andere zugeklappt unter „Alles Weitere“; die Verwaltung hat eine eigene
 * Gruppe, „Unterricht und Material“ ist zugeklappt. Nichts fehlt, jede Seite steht genau einmal.
 */
export default async function MorePage() {
  const teacher = await requireTeacher();
  const offenesFeedback = feedbackZahlen(teacher.is_admin ? undefined : teacher.id).offen;
  const offen = zuErledigen(teacher.id, wienerDatum()).offen.length;
  const groups = erweitertGruppen(teacher, { offen, offenesFeedback });
  const kacheln = (items: ErweitertEintrag[]) => (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ href, label, hint, icon }) => {
        const Icon = ICONS[icon] ?? ChevronRight;
        return (
          <li key={href}>
            <Link href={href} className="panel drueck flex h-full min-h-[76px] items-center gap-3.5 px-4 py-3 transition-colors hover:border-line-strong">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-wash text-accent" aria-hidden>
                <Icon size={19} strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-[13px] leading-snug text-ink-2">{hint}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
  return (
    <>
      <PageHeader
        title="Erweitert"
        actions={
          <form action={logoutAction}>
            <button className="btn btn-secondary">
              <LogOut size={16} aria-hidden /> Abmelden
            </button>
          </form>
        }
      />
      <div className="panel mb-8 flex flex-wrap items-center gap-4 px-5 py-4">
        <Avatar name={teacher.name} size={52} />
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold">{teacher.name}</div>
          <div className="text-[14px] text-ink-2">{teacher.is_admin ? "Verwaltung" : "Lehrkraft"}</div>
        </div>
        <p className="flex items-center gap-2 text-[13px] text-ink-2">
          <Sparkles size={15} className="shrink-0 text-accent" aria-hidden />
          {aiEnabled() ? "KI ist eingerichtet." : "Ohne KI-Schlüssel: eingebaute Generatoren."}
        </p>
      </div>
      <div className="grid gap-8">
        {groups.map((g) =>
          g.zu ? (
            <details key={g.title} className="group" data-testid="erweitert-zu">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2">
                <ChevronDown size={16} className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
                <span className="gruppe-titel">{g.title}</span>
                <span className="min-w-0 truncate text-[13px] text-ink-3 group-open:hidden">{g.items.map((i) => i.label).join(" · ")}</span>
              </summary>
              <div className="mt-3">{kacheln(g.items)}</div>
            </details>
          ) : (
            <section key={g.title}>
              <h2 className="gruppe-titel mb-3">{g.title}</h2>
              {kacheln(g.items)}
            </section>
          ),
        )}
      </div>
    </>
  );
}
