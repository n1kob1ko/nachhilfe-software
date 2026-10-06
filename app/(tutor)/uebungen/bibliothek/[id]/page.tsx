import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Copy, Sparkles, Trash2 } from "lucide-react";
import { deleteLibraryEntryAction, duplicateLibraryEntryAction, exerciseFromLibraryAction, updateLibraryEntryAction } from "@/app/library-actions";
import { Info } from "@/components/Info";
import { PageHeader, Pill, SectionTitle, formatDate } from "@/components/ui";
import { WorksheetEditor } from "@/components/WorksheetEditor";
import { aiEnabled } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { worksheetTypeLabel } from "@/lib/curriculum";
import { getLibraryEntry, LIBRARY_ORIGIN_LABEL } from "@/lib/library";
import * as repo from "@/lib/repo";
import { klassenLabel, SCHOOL_TYPES } from "@/lib/school";
import { activeUnitForTeacher } from "@/lib/units";
import { runningBoardsFor } from "@/lib/whiteboard";

export const metadata = { title: "Bibliotheksaufgabe" };

/** One task of the library: the task in the editor, where it belongs, where it comes from, and reuse. */
export default async function LibraryEntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bearbeiten?: string; gespeichert?: string; kopie?: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const e = getLibraryEntry(Number(id));
  if (!e) notFound();
  const skills = repo.listSkills().filter((s) => s.subject === e.subject);
  const students = repo.listStudents().map(({ id, name }) => ({ id, name }));
  const active = activeUnitForTeacher(teacher.id);
  const topics = [...new Set(skills.map((s) => s.area))];
  const level = e.klasse ? klassenLabel(e.school_type, e.klasse) : e.school_type;

  return (
    <>
      <PageHeader
        back={{ href: `/uebungen/bibliothek?fach=${encodeURIComponent(e.subject)}`, label: "Aufgabenbibliothek" }}
        title={e.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            {e.subject}
            {level && ` · ${level}`}
            {e.topic && ` · ${e.topic}`}
            <Pill>{e.task.difficulty}</Pill>
            <Pill>{worksheetTypeLabel(e.subject, e.task.category ?? e.task.type)}</Pill>
            <Pill tone={e.origin === "ki" ? "accent" : e.origin === "importiert" ? "amber" : "neutral"}>
              {e.origin === "ki" && <Sparkles size={11} aria-hidden />} {LIBRARY_ORIGIN_LABEL[e.origin]}
            </Pill>
            {e.tags.map((t) => (
              <Link key={t} href={`/uebungen/bibliothek?tag=${encodeURIComponent(t)}`} className="text-[13px] text-ink-3 hover:text-accent">
                #{t}
              </Link>
            ))}
          </span>
        }
      />
      {(sp.gespeichert || sp.kopie) && (
        <p className="no-print mb-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-green" role="status">
          <CheckCircle2 size={16} aria-hidden /> {sp.kopie ? "Kopie angelegt. Du siehst jetzt die Kopie." : "Gespeichert."}
        </p>
      )}

      <section className="no-print mb-8 rounded-[24px] bg-accent-wash px-5 py-5 md:px-6" aria-label="Verwenden">
        <h2 className="mb-3 text-[18px] font-semibold">Verwenden</h2>
        <form action={exerciseFromLibraryAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="eintrag" value={e.id} />
          <input type="hidden" name="back" value={`/uebungen/bibliothek/${e.id}`} />
          <label className="field min-w-[220px]">
            <span className="label">Für Schüler (optional)</span>
            <select className="input" name="student_id" defaultValue="">
              <option value="">–</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary btn-lg">Als neue Übung</button>
        </form>
        <p className="mt-3 text-[13px] text-ink-2">Nur diese eine Aufgabe sofort senden: unten „Einzeln senden“.</p>
      </section>

      <WorksheetEditor
        worksheetId={e.id}
        subject={e.subject}
        editable
        library
        initialEditing={sp.bearbeiten ? e.task.id : null}
        tasks={[e.task]}
        skills={skills.map(({ id, name, area, parent_id }) => ({ id, name, area, parent_id }))}
        students={students}
        defaultStudentId={null}
        units={runningBoardsFor(teacher.id)}
        active={active ? { unitId: active.id, student: active.student_name.split(" ")[0] } : null}
        showSolutions
        aiEnabled={aiEnabled()}
      />

      <div className="no-print mt-10 grid max-w-[920px] gap-10 lg:grid-cols-2">
        <section aria-label="Einordnung">
          <SectionTitle>Einordnung</SectionTitle>
          <form action={updateLibraryEntryAction.bind(null, e.id)} className="grid gap-3">
            <label className="field">
              <span className="label">Titel</span>
              <input className="input" name="title" defaultValue={e.title} maxLength={120} required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                <span className="label">Schulart</span>
                <select className="input" name="school_type" defaultValue={e.school_type}>
                  <option value="">–</option>
                  {SCHOOL_TYPES.map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Klasse</span>
                <select className="input" name="klasse" defaultValue={e.klasse ?? ""}>
                  <option value="">–</option>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((k) => (
                    <option key={k} value={k}>
                      {k}.
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span className="label">Thema</span>
              <input className="input" name="topic" defaultValue={e.topic} list="lib-topics" />
              <datalist id="lib-topics">
                {topics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="label">Tags (mit Komma getrennt)</span>
              <input className="input" name="tags" defaultValue={e.tags.join(", ")} placeholder="z. B. Schularbeit, Textaufgabe" />
            </label>
            <div>
              <button className="btn btn-secondary">Speichern</button>
            </div>
          </form>
        </section>

        <section aria-label="Herkunft und Lizenz">
          <SectionTitle>
            <span>
              Herkunft und Lizenz
              <Info label="Info zu Herkunft und Lizenz">Wo die Aufgabe herkommt, bleibt bei der Aufgabe gespeichert, auch in jeder Kopie. Quellen und Lizenzen pflegst du unter Mehr › Curriculum / Lehrplan › Quellen.</Info>
            </span>
          </SectionTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
            <dt className="text-ink-3">Herkunft</dt>
            <dd>{LIBRARY_ORIGIN_LABEL[e.origin]}</dd>
            <dt className="text-ink-3">Quelle</dt>
            <dd>{e.source ? e.source.url ? <a href={e.source.url} className="link" target="_blank" rel="noreferrer">{e.source.name}</a> : e.source.name : "–"}</dd>
            <dt className="text-ink-3">Lizenz</dt>
            <dd>{e.source?.license || "–"}</dd>
            {e.source?.attribution && (
              <>
                <dt className="text-ink-3">Namensnennung</dt>
                <dd>{e.source.attribution}</dd>
              </>
            )}
            <dt className="text-ink-3">Gespeichert</dt>
            <dd>{formatDate(e.created_at)}</dd>
          </dl>
          {e.origin === "importiert" && !e.source?.license && (
            <p className="mt-3 rounded-lg bg-amber-wash px-3 py-2 text-[13px] text-amber">
              Keine Lizenz hinterlegt. Vor dem Weitergeben die Quelle unter{" "}
              <Link href="/mehr/lehrplan?tab=quellen" className="font-semibold underline">
                Quellen
              </Link>{" "}
              ergänzen.
            </p>
          )}
        </section>
      </div>

      <div className="no-print mt-10 flex flex-wrap gap-3 border-t border-line pt-6">
        <form action={duplicateLibraryEntryAction.bind(null, e.id)}>
          <button className="btn btn-secondary">
            <Copy size={15} aria-hidden /> Duplizieren
          </button>
        </form>
        <details className="reveal">
          <summary>
            <Trash2 size={15} aria-hidden className="text-red" /> Aus der Bibliothek löschen
          </summary>
          <form action={deleteLibraryEntryAction.bind(null, e.id)} className="pt-2">
            <p className="mb-2 text-[13px] text-ink-2">Übungen, die diese Aufgabe schon enthalten, behalten ihre Kopie.</p>
            <button className="btn btn-danger">Endgültig löschen</button>
          </form>
        </details>
      </div>
    </>
  );
}
