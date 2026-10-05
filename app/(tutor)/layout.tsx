import Link from "next/link";
import { ChevronDown, Download, LogOut, Sparkles, UserCog } from "lucide-react";
import { logoutAction } from "@/app/session-actions";
import { Brand, Nav } from "@/components/Nav";
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
    <div className="md:grid md:min-h-screen md:grid-cols-[220px_1fr]">
      <aside className="no-print border-b border-line bg-panel px-3 py-3 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-r md:border-b-0 md:py-5">
        <div className="flex flex-col gap-2 md:block">
          <div className="flex items-center justify-between gap-3">
            <Brand />
            <details className="relative md:hidden">
              <summary className="btn btn-ghost btn-sm list-none" aria-label={`Konto von ${teacher.name}`}>
                {teacher.name} <ChevronDown size={14} aria-hidden />
              </summary>
              <div className="absolute right-0 z-30 mt-1 grid min-w-[190px] gap-1 rounded-xl border border-line bg-surface p-2 text-[14px] shadow-lg">
                <Link href="/passwort" className="rounded-lg px-3 py-2 hover:bg-panel">
                  Passwort ändern
                </Link>
                {teacher.is_admin ? (
                  <>
                    <Link href="/lehrer" className="rounded-lg px-3 py-2 hover:bg-panel">
                      Lehrer verwalten
                    </Link>
                    <Link href="/export" className="rounded-lg px-3 py-2 hover:bg-panel">
                      Datenexport
                    </Link>
                  </>
                ) : null}
                <form action={logoutAction}>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-panel">
                    <LogOut size={14} aria-hidden /> Abmelden
                  </button>
                </form>
              </div>
            </details>
          </div>
          <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:mt-6 md:px-0">
            <Nav />
          </div>
        </div>
        <div className="mt-auto hidden space-y-4 px-3 md:block">
          <div className="border-t border-line pt-4 text-[13px]">
            <div className="text-ink-3">Angemeldet als</div>
            <div className="font-semibold">{teacher.name}</div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <Link href="/passwort" className="link text-[12px]">
                Passwort
              </Link>
              {teacher.is_admin ? (
                <>
                  <Link href="/lehrer" className="link inline-flex items-center gap-1 text-[12px]">
                    <UserCog size={12} aria-hidden /> Lehrer verwalten
                  </Link>
                  <Link href="/export" className="link inline-flex items-center gap-1 text-[12px]">
                    <Download size={12} aria-hidden /> Datenexport
                  </Link>
                </>
              ) : null}
              <form action={logoutAction}>
                <button className="link text-[12px]">Abmelden</button>
              </form>
            </div>
          </div>
          <p className="flex items-start gap-2 text-[12px] leading-snug text-ink-3">
            <Sparkles size={14} className={`mt-0.5 shrink-0 ${ai ? "text-accent" : ""}`} aria-hidden />
            {ai ? "KI aktiv: Übungen und Analysen mit Claude." : "Ohne KI-Schlüssel: eingebaute Aufgabengeneratoren."}
          </p>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-[1160px]">
          <RunningUnits units={running} />
          {children}
        </div>
      </main>
    </div>
  );
}
