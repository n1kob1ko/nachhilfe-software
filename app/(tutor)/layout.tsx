import Link from "next/link";
import { Brand, Nav, TabBar } from "@/components/Nav";
import { Avatar } from "@/components/Art";
import { FeedbackButton } from "@/components/FeedbackButton";
import { RunningUnits } from "@/components/RunningUnits";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireTeacher } from "@/lib/auth";
import { backfillAutoDocs } from "@/lib/autodoc";
import { sweepIdleUnits } from "@/lib/learning";
import { platzFuerEinheit, runningUnits } from "@/lib/units";
import { zeitfenster } from "@/lib/planung/heute";

export const dynamic = "force-dynamic";

/**
 * Der Rahmen der Lehrkraft: links eine ruhige Leiste mit dem Logo und den fünf Einträgen (Heute, Unterricht,
 * Abschluss, Schüler, Erweitert), rechts die Seite. Am Telefon steht das Logo oben und die fünf Einträge unten (TabBar).
 * Die Knöpfe für Feedback und den Dunkelmodus stehen neben dem Konto, nie als Eintrag in der Navigation.
 */
export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const teacher = await requireTeacher();
  backfillAutoDocs();
  sweepIdleUnits();
  // mit geplantem Ende („bis 15:40“) aus dem Wochenplan, wo es einen Platz gibt
  const running = runningUnits(teacher.id).map((u) => {
    const platz = platzFuerEinheit(u);
    return { ...u, bis: platz ? zeitfenster(platz).bis : null };
  });
  // welche Einheiten laufen (auch die anderer Lehrkräfte): ihre Seite gehört zu „Unterricht“, eine beendete zu „Abschluss“
  const laufend = runningUnits().map((u) => u.id);
  // am Telefon nur das Bild: neben Feedback und Dunkelmodus ist für den Namen kein Platz
  const me = (kompakt = false) => (
    <Link href="/mehr" className={`flex items-center gap-2.5 rounded-full text-[14px] transition-colors hover:bg-surface ${kompakt ? "p-1" : "py-1 pr-3 pl-1"}`} title="Konto und Einstellungen">
      <Avatar name={teacher.name} size={32} />
      <span className={kompakt ? "sr-only" : "min-w-0"}>
        <span className="block truncate font-semibold">{teacher.name}</span>
        <span className="block truncate text-[12px] text-ink-3">{teacher.is_admin ? "Verwaltung" : "Lehrkraft"}</span>
      </span>
    </Link>
  );
  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[236px_minmax(0,1fr)] print:bg-white">
      <header className="no-print flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-2.5 md:hidden">
        <Brand />
        <div className="flex min-w-0 items-center gap-2">
          {me(true)}
          <FeedbackButton />
          <ThemeToggle />
        </div>
      </header>
      <aside className="no-print hidden border-r border-line md:sticky md:top-0 md:flex md:h-screen md:flex-col md:px-4 md:py-6">
        <Brand />
        <div className="mt-8">
          <Nav laufend={laufend} />
        </div>
        <div className="mt-auto space-y-2">
          <FeedbackButton variant="zeile" />
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">{me()}</div>
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 pt-5 pb-28 md:px-8 md:py-8 lg:px-10">
        <div className="mx-auto max-w-[1120px]">
          <RunningUnits units={running} />
          {children}
        </div>
      </main>
      <TabBar laufend={laufend} />
    </div>
  );
}
