import Link from "next/link";
import { Brand, Nav, TabBar } from "@/components/Nav";
import { Avatar } from "@/components/Art";
import { RunningUnits } from "@/components/RunningUnits";
import { requireTeacher } from "@/lib/auth";
import { backfillAutoDocs } from "@/lib/autodoc";
import { sweepIdleUnits } from "@/lib/learning";
import { runningUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const teacher = await requireTeacher();
  backfillAutoDocs();
  sweepIdleUnits();
  const running = runningUnits(teacher.id);
  const me = (
    <Link href="/mehr" className="flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1 text-[14px] hover:bg-surface" title="Konto und Einstellungen">
      <Avatar name={teacher.name} size={32} />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{teacher.name}</span>
      </span>
    </Link>
  );
  return (
    <div className="min-h-screen bg-[radial-gradient(120%_80%_at_0%_0%,var(--backdrop-2),var(--backdrop))] print:bg-none lg:p-3.5">
      <div className="min-h-screen bg-paper md:grid md:grid-cols-[220px_minmax(0,1fr)] lg:min-h-[calc(100vh-28px)] lg:rounded-[32px] lg:shadow-[0_30px_80px_-40px_rgba(120,60,20,0.45)] print:shadow-none">
        <header className="no-print flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 md:hidden">
          <Brand />
          {me}
        </header>
        <aside className="no-print hidden md:sticky md:top-0 md:flex md:h-screen md:flex-col md:px-4 md:py-6 lg:top-3.5 lg:h-[calc(100vh-28px)]">
          <Brand />
          <div className="mt-8">
            <Nav />
          </div>
          <div className="mt-auto">{me}</div>
        </aside>
        <main className="min-w-0 px-4 pt-5 pb-28 md:px-8 md:py-8 lg:pr-10">
          <div className="mx-auto max-w-[1100px]">
            <RunningUnits units={running} />
            {children}
          </div>
        </main>
        <TabBar />
      </div>
    </div>
  );
}
