import Link from "next/link";
import { ChevronRight, Presentation } from "lucide-react";
import { notFound } from "next/navigation";
import { SubjectArt } from "@/components/Art";
import { AppHinweis } from "@/components/AppHinweis";
import { Hausuebungen } from "@/components/lernen/Hausuebungen";
import { NaechsterTermin } from "@/components/lernen/NaechsterTermin";
import { SchuelerNotizFrage } from "@/components/SchuelerNotizFrage";
import { termineFuerSchueler } from "@/lib/planung/schueler-termine";
import * as repo from "@/lib/repo";
import { activeMaterial, materialLabel } from "@/lib/current-material";
import { notizFuerSchueler } from "@/lib/schueler-notiz";
import { runningUnitForStudent } from "@/lib/units";

/** Das Thema zum Bild der Bühne: der aktuelle Stoff des Schülers (Thema und Unterthema). */
const bildThema = (studentId: number) => {
  const m = activeMaterial(studentId)[0];
  return m ? `${m.topic} ${materialLabel(m)}` : null;
};

/**
 * Start der Schüler-App: nur, was jetzt zu tun ist (offene Übungen, Hausübungen), der nächste Termin und am Tag
 * der Einheit die Frage „Was war heute schwer?“. Alles andere hat seine eigene Seite (niko 2026-11-08: die eine
 * lange Seite war zu unübersichtlich): Termine, Prüfungen, Fortschritt (components/lernen/SchuelerNav.tsx).
 */
export default async function LearnHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  const open = repo.listAssignments(student.id).filter((a) => !a.completed_at);
  const first = student.name.split(" ")[0];
  const unit = runningUnitForStudent(student.id);
  // wo und wann: nur veröffentlichte Plätze, ohne Namen (lib/planung/schueler-termine.ts)
  const { naechster } = termineFuerSchueler(student.id);
  // „Was war heute schwer?“ nur am Tag der Einheit und am Tag danach; danach steht die Notiz unter Fortschritt
  const notiz = notizFuerSchueler(student.id);
  const notizFrisch = notiz !== null && (notiz.wann === "heute" || notiz.wann === "gestern");

  return (
    <>
      <section className="buehne px-6 py-7 md:px-8 md:py-9">
        <div className="setzen relative z-10 sm:pr-[170px]">
          <h1 className="text-[30px] font-semibold tracking-[-0.02em] md:text-[34px]">Hallo {first}!</h1>
          <p className="buehne-meta mt-1 text-[17px]">
            {open.length === 0 ? "Gerade ist nichts offen. Gut gemacht!" : open.length === 1 ? "Eine Übung wartet auf dich." : `${open.length} Übungen warten auf dich.`}
          </p>
        </div>
        <SubjectArt subject={student.subjects[0]} topic={bildThema(student.id)} seed={student.id} className="bogen pointer-events-none absolute -right-4 -bottom-6 hidden h-[190px] w-[190px] sm:block" />
      </section>

      {/* wann und wo ist das Wichtigste für den Schüler: gleich unter der Begrüßung (niko 2026-11-08) */}
      {naechster && <NaechsterTermin naechster={naechster} token={token} alleLink />}

      {unit && (
        <Link href={`/lernen/${token}/tafel`} className="panel mt-8 flex items-center gap-4 border-accent-bright/60 bg-accent-wash px-5 py-5 transition-colors hover:border-accent-bright">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-on-fill">
            <Presentation size={24} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-semibold">Whiteboard öffnen</span>
            <span className="block text-[14px] text-ink-2">Deine Einheit läuft. Schreib und rechne gemeinsam mit {unit.teacher_name}.</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-accent" aria-hidden />
        </Link>
      )}

      {open.length > 0 && (
        <ul className="staffel mt-8 space-y-3" data-testid="offene-uebungen">
          {open.map((x) => (
            <li key={x.id}>
              <Link href={`/lernen/${token}/${x.id}`} className="panel flex items-center gap-4 px-5 py-4 transition-colors hover:border-accent">
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold">{x.title}</p>
                  <p className="text-[14px] text-ink-2">
                    {x.task_count} Aufgaben · {x.difficulty}
                    {x.done_count > 0 && ` · ${x.done_count} schon erledigt`}
                  </p>
                  {x.done_count > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bar-track)]">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(x.done_count / x.task_count) * 100}%` }} />
                    </div>
                  )}
                </div>
                <span className="btn btn-primary">
                  {x.done_count > 0 ? "Weitermachen" : "Starten"} <ChevronRight size={16} aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Hausuebungen studentId={student.id} token={token} />

      {notizFrisch && (
        <SchuelerNotizFrage
          token={token}
          unitId={notiz.unitId}
          wann={notiz.wann}
          notiz={notiz.notiz && { auswahl: notiz.notiz.auswahl, text: notiz.notiz.text, uebersprungen: notiz.notiz.uebersprungen }}
        />
      )}

      <AppHinweis />
    </>
  );
}
