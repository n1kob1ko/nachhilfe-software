import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, History, Printer, RotateCcw, Tablet } from "lucide-react";
import { restoreRevisionAction, setTextStatusAction, showTextOnTabletAction, updateTextInfoAction } from "@/app/text-actions";
import { TextEditor } from "@/components/text/TextEditor";
import { TextLive } from "@/components/text/TextLive";
import { Pill, Reveal, formatDate, formatTime } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { SUBJECTS } from "@/lib/curriculum";
import { hasDevice } from "@/lib/devices";
import { getText, listRevisions, textDoc, TEXT_KINDS, unitsOfText, wordsLabel } from "@/lib/texts";
import { canManageUnit, runningUnitForStudent } from "@/lib/units";

export const metadata = { title: "Textarbeit" };

const first = (n: string) => n.split(" ")[0];

/** One Textarbeit at the teacher's laptop: read along while the student writes, write here, print, continue later. */
export default async function TextPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const text = getText(Number(id));
  if (!text) notFound();
  const unit = runningUnitForStudent(text.student_id);
  const ownUnit = unit && canManageUnit(teacher, unit) ? unit : null;
  const onTablet = ownUnit?.device_view === `text:${text.id}`;
  const canShow = ownUnit && !onTablet && hasDevice(ownUnit.teacher_id);
  const revisions = listRevisions(text.id);
  const units = unitsOfText(text.id);
  const name = first(text.student_name);
  const meta = [text.subject, text.topic, text.student_name].filter(Boolean).join(" · ");

  const actions = (
    <>
      {canShow && (
        <form action={showTextOnTabletAction.bind(null, text.id)}>
          <button className="btn btn-secondary">
            <Tablet size={16} aria-hidden /> Am Tablet öffnen
          </button>
        </form>
      )}
      <Link href={`/arbeitsblatt/text/${text.id}`} className="btn btn-secondary" target="_blank">
        <Printer size={16} aria-hidden /> PDF / Drucken
      </Link>
      <form action={setTextStatusAction.bind(null, text.id, text.status === "fertig" ? "offen" : "fertig")}>
        <button className="btn btn-ghost">
          {text.status === "fertig" ? (
            <>
              <RotateCcw size={16} aria-hidden /> Wieder öffnen
            </>
          ) : (
            <>
              <CheckCircle2 size={16} aria-hidden /> Als fertig markieren
            </>
          )}
        </button>
      </form>
    </>
  );

  return (
    <>
      <TextLive textId={text.id} />
      <div className="no-print mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {ownUnit ? (
          <Link href={`/einheiten/${ownUnit.id}`} className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-medium text-ink-2 hover:text-ink">
            ← Zurück zur Einheit
          </Link>
        ) : (
          <Link href={`/schueler/${text.student_id}?tab=lernverlauf`} className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-medium text-ink-2 hover:text-ink">
            ← Lernverlauf von {text.student_name}
          </Link>
        )}
        {onTablet && (
          <Pill tone="green">
            <Tablet size={12} aria-hidden /> {name} schreibt am Tablet
          </Pill>
        )}
        {text.status === "fertig" ? <Pill tone="green">fertig</Pill> : <Pill tone="amber">in Arbeit</Pill>}
      </div>

      <TextEditor
        key={text.id}
        textId={text.id}
        saveUrl={`/texte/${text.id}/speichern`}
        initial={{ body: textDoc(text), version: text.version, updatedAt: text.updated_at }}
        title={text.title}
        prompt={text.prompt}
        meta={meta}
        actions={actions}
      />

      <div className="mt-8 grid max-w-[820px] gap-3">
        <p className="text-[14px] text-ink-2">
          Begonnen am {formatDate(text.created_at, { day: "numeric", month: "long", year: "numeric" })}
          {text.teacher_name ? ` von ${text.teacher_name}` : ""} · zuletzt geändert {formatDate(text.updated_at, { day: "numeric", month: "short" })},{" "}
          <span className="num">{formatTime(text.updated_at)}</span>
        </p>
        {units.length > 0 && (
          <p className="text-[14px] text-ink-2">
            Bearbeitet in {units.length === 1 ? "einer Einheit" : `${units.length} Einheiten`}:{" "}
            {units.map((u, i) => (
              <span key={u.unit_id}>
                {i > 0 && ", "}
                <Link href={`/einheiten/${u.unit_id}`} className="font-medium text-accent hover:underline">
                  {formatDate(u.started_at, { day: "numeric", month: "short" })}
                </Link>{" "}
                <span className="num">
                  ({u.words_after - u.words_before >= 0 ? "+" : ""}
                  {u.words_after - u.words_before})
                </span>
              </span>
            ))}
          </p>
        )}
        <Reveal label="Titel und Aufgabe ändern">
          <form action={updateTextInfoAction.bind(null, text.id)} className="grid gap-4 pt-1">
            <label className="field">
              <span className="label">Titel</span>
              <input className="input" name="title" required maxLength={140} defaultValue={text.title} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field">
                <span className="label">Fach</span>
                <input className="input" name="subject" list="text-subjects" maxLength={60} defaultValue={text.subject} />
              </label>
              <label className="field">
                <span className="label">Textsorte</span>
                <input className="input" name="topic" list="text-kinds" maxLength={80} defaultValue={text.topic} />
              </label>
            </div>
            <datalist id="text-subjects">
              {SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <datalist id="text-kinds">
              {TEXT_KINDS.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
            <label className="field">
              <span className="label">Aufgabenstellung</span>
              <textarea className="input" name="prompt" rows={3} maxLength={4000} defaultValue={text.prompt} />
            </label>
            <div>
              <button className="btn btn-primary">Speichern</button>
            </div>
          </form>
        </Reveal>
        {revisions.length > 0 && (
          <Reveal
            label={
              <span className="inline-flex items-center gap-1.5">
                <History size={15} aria-hidden /> Frühere Fassungen ({revisions.length})
              </span>
            }
          >
            <p className="mb-2 text-[14px] text-ink-2">Werden beim Schreiben automatisch aufbewahrt. Beim Zurückholen bleibt die jetzige Fassung ebenfalls erhalten.</p>
            <ul className="panel divide-y divide-line">
              {revisions.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                  <span className="num min-w-0 flex-1 text-[14px]">
                    {formatDate(r.saved_at, { day: "numeric", month: "short" })}, {formatTime(r.saved_at)} · {wordsLabel(r.words)}
                  </span>
                  <form action={restoreRevisionAction.bind(null, text.id, r.id)}>
                    <button className="btn btn-ghost btn-sm">Zurückholen</button>
                  </form>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </>
  );
}
