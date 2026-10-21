import Link from "next/link";
import { CalendarDays, Plus, Search } from "lucide-react";
import { loadDemoData } from "@/app/actions";
import { Empty, PageHeader, StatusChip, TrendBadge } from "@/components/ui";
import { listStudents, listTeachers } from "@/lib/repo";
import { checkLevel, klassenLabel } from "@/lib/school";
import { Avatar } from "@/components/Art";
import { subjectTone } from "@/components/Calendar";
import { analyzeStudent } from "@/lib/service";
import { termineFuerSchueler } from "@/lib/planung/schueler-termine";

export const metadata = { title: "Schüler" };

/** Schulart oder Klasse fehlt (z. B. nach dem Import der Dokumentation): die Schulstufe ist unklar. */
const klasseFehlt = (s: { school_type: string; klasse: number | null; grade: number }) => checkLevel(s.school_type, s.klasse, s.grade).status === "unklar";

export default async function Students({ searchParams }: { searchParams: Promise<{ suche?: string; filter?: string }> }) {
  const sp = await searchParams;
  const q = (sp.suche ?? "").trim();
  const nurOffen = sp.filter === "klasse-fehlt";
  const all = listStudents();
  const offen = all.filter(klasseFehlt).length;
  const students = all.filter((s) => (!q || s.name.toLowerCase().includes(q.toLowerCase())) && (!nurOffen || klasseFehlt(s)));
  const filterLink = (an: boolean) => {
    const p = new URLSearchParams();
    if (q) p.set("suche", q);
    if (an) p.set("filter", "klasse-fehlt");
    return `/schueler${p.size ? `?${p}` : ""}`;
  };
  const teachers = new Map(listTeachers().map((t) => [t.id, t.name]));
  return (
    <>
      <PageHeader
        title="Schüler"
        subtitle={`${all.length} Schüler`}
        actions={
          <Link href="/schueler/neu" className="btn btn-secondary">
            <Plus size={16} aria-hidden /> Neuer Schüler
          </Link>
        }
      />
      {all.length > 0 && (
        <form className="mb-6 flex max-w-[520px] gap-2" role="search">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
            <input className="input !min-h-[48px] !pl-11 text-[16px]" name="suche" defaultValue={q} placeholder="Schüler suchen" aria-label="Schüler suchen" autoComplete="off" />
          </div>
          {nurOffen && <input type="hidden" name="filter" value="klasse-fehlt" />}
          <button className="btn btn-secondary !min-h-[48px]">Suchen</button>
        </form>
      )}
      {(offen > 0 || nurOffen) && (
        <nav className="mb-5 flex flex-wrap gap-2" aria-label="Filter">
          <Link href={filterLink(false)} className={`btn btn-sm ${nurOffen ? "btn-secondary" : "btn-primary"}`} aria-current={nurOffen ? undefined : "page"}>
            Alle
          </Link>
          <Link href={filterLink(true)} className={`btn btn-sm ${nurOffen ? "btn-primary" : "btn-secondary"}`} aria-current={nurOffen ? "page" : undefined}>
            Klasse fehlt <span className="num">{offen}</span>
          </Link>
        </nav>
      )}
      {(q || nurOffen) && students.length === 0 ? (
        <p className="text-[15px] text-ink-2">
          {nurOffen && !q ? "Bei allen Schülern sind Schulart und Klasse eingetragen." : `Kein Schüler heißt „${q}“${nurOffen ? " und hat keine Klasse" : ""}.`}{" "}
          <Link href="/schueler" className="link">Alle anzeigen</Link>
        </p>
      ) : students.length === 0 ? (
        <Empty
          title="Noch keine Schüler"
          action={
            <form action={loadDemoData}>
              <button className="btn btn-secondary">Demo-Daten laden</button>
            </form>
          }
        >
          Ein Schülerprofil sammelt Einheiten, Hausübungen, Tests und Übungsergebnisse und berechnet daraus den Lernstand pro Fähigkeit.
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((s) => {
            const a = analyzeStudent(s.id)!;
            // wann der Schüler als Nächstes kommt (veröffentlichter Plan, diese und nächste Woche)
            const termin = termineFuerSchueler(s.id).naechster;
            return (
              <li key={s.id}>
                <Link href={`/schueler/${s.id}`} className="panel drueck block h-full px-5 py-4 transition-colors hover:border-line-strong">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{s.name}</span>
                      <span className="block text-[13px] leading-snug text-ink-2">
                        {klasseFehlt(s) ? <span className="text-amber">{klassenLabel(s.school_type, s.klasse) || "Klasse fehlt"}</span> : klassenLabel(s.school_type, s.klasse)}
                        {teachers.get(s.teacher_id ?? 0) && ` · ${teachers.get(s.teacher_id ?? 0)}`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.subjects.length ? (
                      s.subjects.map((sub) => {
                        const t = subjectTone(sub);
                        return (
                          <span key={sub} className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: t.soft, color: t.fg }}>
                            {sub}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[13px] text-ink-3">Keine Fächer</span>
                    )}
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[13.5px]">
                    <CalendarDays size={15} className="shrink-0 text-accent" aria-hidden />
                    {termin ? (
                      <span>
                        <span className="num font-semibold">{termin.jetzt ? "jetzt" : termin.heute ? "heute" : termin.label}</span>
                        {" "}
                        <span className="num">{termin.zeit}</span>
                        {!termin.raumOffen && <span className="text-ink-2"> · {termin.ort.split(" · ")[0]}</span>}
                      </span>
                    ) : (
                      <span className="text-ink-3">kein Termin im Plan</span>
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[13px]">
                    <StatusChip mastery={a.overall.mastery} />
                    <TrendBadge trend={a.overall.trend} delta={a.overall.delta} compact />
                    <span className="basis-full text-ink-2">
                      {a.mainProblem ? (
                        <>
                          Schwierigkeit: <span className="font-medium text-red">{a.mainProblem.skill.name}</span>
                        </>
                      ) : (
                        "keine Schwierigkeit erkannt"
                      )}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
