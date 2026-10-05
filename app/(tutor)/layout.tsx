import Link from "next/link";
import { ChevronDown, Download, LogOut, Sparkles, UserCog } from "lucide-react";
import { logoutAction } from "@/app/session-actions";
import { Brand, Nav } from "@/components/Nav";
import { Avatar } from "@/components/Art";
import { RunningUnits } from "@/components/RunningUnits";
import { aiEnabled } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { backfillAutoDocs } from "@/lib/autodoc";
import { sweepIdleUnits } from "@/lib/learning";
import { runningUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const teacher = await requireTeacher();
  const ai = aiEnabled();
  backfillAutoDocs();
  sweepIdleUnits();
  const running = runningUnits(teacher.id);
  return (
    <div className="min-h-screen bg-[radial-gradient(120%_80%_at_0%_0%,var(--backdrop-2),var(--backdrop))] print:bg-none lg:p-3.5">
      <div className="min-h-screen bg-paper md:grid md:grid-cols-[236px_minmax(0,1fr)] lg:min-h-[calc(100vh-28px)] lg:rounded-[32px] lg:shadow-[0_30px_80px_-40px_rgba(120,60,20,0.45)] print:shadow-none">
        <aside className="no-print border-b border-line px-3 py-3 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-b-0 md:px-4 md:py-6 lg:top-3.5 lg:h-[calc(100vh-28px)]">
          <div className="flex flex-col gap-2 md:block">
            <div className="flex items-center justify-between gap-3">
              <Brand />
              <details className="relative md:hidden">
                <summary className="btn btn-ghost btn-sm list-none" aria-label={`Konto von ${teacher.name}`}>
                  <Avatar name={teacher.name} size={26} /> <ChevronDown size={14} aria-hidden />
                </summary>
                <div className="absolute right-0 z-30 mt-1 grid min-w-[190px] gap-1 rounded-2xl border border-line bg-surface p-2 text-[14px] shadow-[var(--shadow-pop)]">
                  <Link href="/passwort" className="rounded-xl px-3 py-2 hover:bg-panel">
                    Passwort ändern
                  </Link>
                  {teacher.is_admin ? (
                    <>
                      <Link href="/lehrer" className="rounded-xl px-3 py-2 hover:bg-panel">
                        Lehrer verwalten
                      </Link>
                      <Link href="/export" className="rounded-xl px-3 py-2 hover:bg-panel">
                        Datenexport
                      </Link>
                    </>
                  ) : null}
                  <form action={logoutAction}>
                    <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-panel">
                      <LogOut size={14} aria-hidden /> Abmelden
                    </button>
                  </form>
                </div>
              </details>
            </div>
            <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:mt-8 md:px-0">
              <Nav />
            </div>
          </div>
          <div className="mt-auto hidden space-y-3 md:block">
            <p className="flex items-start gap-2 rounded-2xl bg-panel px-3 py-2.5 text-[12px] leading-snug text-ink-2">
              <Sparkles size={14} className={`mt-0.5 shrink-0 ${ai ? "text-accent" : ""}`} aria-hidden />
              {ai ? "KI aktiv: Übungen und Analysen mit Claude." : "Ohne KI-Schlüssel: eingebaute Aufgabengeneratoren."}
            </p>
            <div className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2.5">
                <Avatar name={teacher.name} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{teacher.name}</div>
                  <div className="text-[12px] text-ink-3">{teacher.is_admin ? "Admin" : "Lehrkraft"}</div>
                </div>
                <form action={logoutAction} className="ml-auto">
                  <button className="btn btn-ghost btn-sm !h-8 !w-8 !p-0" aria-label="Abmelden" title="Abmelden">
                    <LogOut size={15} aria-hidden />
                  </button>
                </form>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2.5">
                <Link href="/passwort" className="link text-[12px]">
                  Passwort
                </Link>
                {teacher.is_admin ? (
                  <>
                    <Link href="/lehrer" className="link inline-flex items-center gap-1 text-[12px]">
                      <UserCog size={12} aria-hidden /> Lehrer
                    </Link>
                    <Link href="/export" className="link inline-flex items-center gap-1 text-[12px]">
                      <Download size={12} aria-hidden /> Export
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
        <main className="min-w-0 px-4 py-6 md:px-8 md:py-8 lg:pr-10">
          <div className="mx-auto max-w-[1240px]">
            <RunningUnits units={running} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
