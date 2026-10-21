import Link from "next/link";
import { Brand, Nav, TabBar } from "@/components/Nav";
import { Avatar } from "@/components/Art";
import { RunningUnits } from "@/components/RunningUnits";
import { requireTeacher } from "@/lib/auth";
import { backfillAutoDocs } from "@/lib/autodoc";
import { sweepIdleUnits } from "@/lib/learning";
import { platzFuerEinheit, runningUnits } from "@/lib/units";
import { zeitfenster } from "@/lib/planung/heute";

export const dynamic = "force-dynamic";

/**
 * Der Rahmen der Lehrkraft: links eine ruhige Leiste auf Elfenbein mit dem Logo und den fünf
 * Einträgen, rechts die Seite. Am Telefon steht das Logo oben und die fünf Einträge unten (TabBar).
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
  const me = (
    <Link href="/mehr" className="flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1 text-[14px] transition-colors hover:bg-surface" title="Konto und Einstellungen">
      <Avatar name={teacher.name} size={32} />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{teacher.name}</span>
        <span className="block truncate text-[12px] text-ink-3">{teacher.is_admin ? "Verwaltung" : "Lehrkraft"}</span>
      </span>
    </Link>
  );
  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[236px_minmax(0,1fr)] print:bg-white">
      <header className="no-print flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-2.5 md:hidden">
        <Brand />
        {me}
      </header>
      <aside className="no-print hidden border-r border-line md:sticky md:top-0 md:flex md:h-screen md:flex-col md:px-4 md:py-6">
        <Brand />
        <div className="mt-8">
          <Nav />
        </div>
        <div className="mt-auto">{me}</div>
      </aside>
      <main className="min-w-0 px-4 pt-5 pb-28 md:px-8 md:py-8 lg:px-10">
        <div className="mx-auto max-w-[1120px]">
          <RunningUnits units={running} />
          {children}
        </div>
      </main>
      <TabBar />
    </div>
  );
}
