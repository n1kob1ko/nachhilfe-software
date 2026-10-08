"use client";

import { AlertTriangle, BookOpenText, Pencil, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/builder-actions";
import { addReadingQuestionAction, saveReadingTextAction } from "@/app/lesen-actions";
import { ReadingTextView } from "@/components/ReadingText";
import { ASPECT_KEYS, ASPECT_SHORT, aspectSkill, findQuote, isAspect, NEEDS_EVIDENCE, OPEN_ASPECTS, paragraphsOf, readingSetIssues, wordCount, type Aspect, type ReadingText } from "@/lib/lesen";
import type { TaskDraft } from "@/lib/tasks";

/** The shared text of a reading exercise: shown once above the questions, edited once for all of them. */
export function ReadingTextPanel({ worksheetId, reading, tasks, editable, subject }: { worksheetId: number; reading: ReadingText; tasks: TaskDraft[]; editable: boolean; subject: string }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reading.title);
  const [text, setText] = useState(reading.text);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<ActionResult>(null);
  const kinds = new Map<Aspect, number>();
  for (const t of tasks) if (isAspect(t.data.aspect)) kinds.set(t.data.aspect, (kinds.get(t.data.aspect) ?? 0) + 1);
  const setNotes = readingSetIssues(tasks);
  const ps = paragraphsOf(text).length;
  const save = () =>
    start(async () => {
      const r = await saveReadingTextAction(worksheetId, title, text);
      setNote(r);
      if (r?.ok) setEditing(false);
    });

  return (
    <section className="panel mb-2 px-5 py-5 md:px-6" aria-label="Lesetext">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="label flex items-center gap-1.5">
          <BookOpenText size={14} aria-hidden /> Lesetext für alle {tasks.length} Fragen
        </p>
        {editable && !editing && (
          <button type="button" className="btn btn-ghost btn-sm no-print ml-auto" onClick={() => setEditing(true)}>
            <Pencil size={14} aria-hidden /> Text bearbeiten
          </button>
        )}
      </div>
      {editing ? (
        <div className="grid gap-3">
          <label className="field">
            <span className="label">Titel</span>
            <input className="input" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Text (Absätze mit einer Leerzeile trennen)</span>
            <textarea className="input min-h-[420px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} />
            <span className="num text-[13px] text-ink-2">
              {wordCount(text)} Wörter · {ps} {ps === 1 ? "Abschnitt" : "Abschnitte"}
            </span>
          </label>
          <p className="text-[13px] text-ink-3">Alle Fragen verwenden danach den neuen Text. Prüfe Belege und Abschnittsnummern, wenn du Absätze verschiebst: die Hinweise bei den Fragen zeigen es an.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>
              {pending ? "Speichert …" : "Text speichern"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setTitle(reading.title);
                setText(reading.text);
                setEditing(false);
              }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <ReadingTextView title={reading.title} text={reading.text} meta lang={subject === "Englisch" ? "en" : "de"} />
      )}
      {note && <p className={`mt-2 text-[13px] ${note.error ? "text-red" : "text-green"}`} role={note.error ? "alert" : "status"}>{note.error ?? note.ok}</p>}
      {kinds.size > 0 && (
        <div className="no-print mt-5 flex flex-wrap items-center gap-1.5 border-t border-line pt-4 text-[12.5px]">
          <span className="mr-1 text-ink-3">Die Fragen üben:</span>
          {ASPECT_KEYS.filter((a) => kinds.has(a)).map((a) => (
            <span key={a} className="rounded-full bg-paper px-2.5 py-1 text-ink-2">
              {ASPECT_SHORT[a]}
              {kinds.get(a)! > 1 && <span className="num"> ×{kinds.get(a)}</span>}
            </span>
          ))}
        </div>
      )}
      {setNotes.map((n) => (
        <p key={n} className="no-print mt-2 flex items-start gap-1.5 text-[13px] text-amber">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /> {n}
        </p>
      ))}
    </section>
  );
}

/** What the teacher should check on one question (lib/lesen.ts readingIssues). */
export function ReadingIssues({ issues }: { issues: string[] }) {
  if (!issues.length) return null;
  return (
    <div className="no-print mt-3 rounded-lg bg-amber-wash px-3 py-2 text-[13px] text-amber" role="note">
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={14} aria-hidden /> Bitte prüfen
      </p>
      <ul className="mt-0.5 list-disc pl-5">
        {issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

/** In the question editor: what the question practises and where the answer stands in the text. */
export function ReadingQuestionFields({ t, setT, subject, text }: { t: TaskDraft; setT: (f: (cur: TaskDraft) => TaskDraft) => void; subject: string; text: string }) {
  const aspect = isAspect(t.data.aspect) ? t.data.aspect : null;
  const evidence = t.answer.evidence ?? [];
  const ps = paragraphsOf(text).length;
  const setEvidence = (next: { paragraph: number; quote: string }[]) => setT((cur) => ({ ...cur, answer: { ...cur.answer, evidence: next } }));
  const setAspect = (a: Aspect) =>
    setT((cur) => {
      const skill = aspectSkill(subject, a);
      const old = isAspect(cur.data.aspect) ? aspectSkill(subject, cur.data.aspect) : null;
      return { ...cur, data: { ...cur.data, aspect: a }, skillId: skill, skillIds: [skill, ...(cur.skillIds ?? []).filter((x) => x !== skill && x !== old)] };
    });
  return (
    <div className="grid gap-3 rounded-lg bg-paper px-4 py-3">
      <p className="text-[13px] text-ink-2">Der Lesetext gilt für alle Fragen. Du bearbeitest ihn oben beim Text.</p>
      <label className="field max-w-[320px]">
        <span className="label">Was die Frage übt</span>
        <select className="input" value={aspect ?? ""} onChange={(e) => isAspect(e.target.value) && setAspect(e.target.value)}>
          {!aspect && <option value="">–</option>}
          {ASPECT_KEYS.map((a) => (
            <option key={a} value={a}>
              {ASPECT_SHORT[a]}
            </option>
          ))}
        </select>
      </label>
      {aspect && OPEN_ASPECTS.has(aspect) && <p className="-mt-1 text-[12.5px] text-ink-3">Hier sind mehrere Antworten richtig. Die Musterlösung ist ein Beispiel, du bewertest selbst.</p>}
      <div className="grid gap-1.5">
        <span className="label">Beleg im Text{aspect && NEEDS_EVIDENCE.has(aspect) ? "" : " (optional)"}</span>
        {evidence.map((e, i) => {
          const at = e.quote.trim() ? findQuote(text, e.quote) : null;
          return (
            <div key={i} className="grid gap-1">
              <div className="flex items-center gap-2">
                <label className="flex shrink-0 items-center gap-1 text-[13px] text-ink-2">
                  Abschnitt
                  <input
                    className="input num w-[64px]"
                    type="number"
                    min={1}
                    max={ps}
                    value={e.paragraph || ""}
                    onChange={(ev) => setEvidence(evidence.map((x, j) => (j === i ? { ...x, paragraph: Number(ev.target.value) || 0 } : x)))}
                  />
                </label>
                <input
                  className="input"
                  value={e.quote}
                  placeholder="Textstelle wörtlich, z. B. ein Satz"
                  onChange={(ev) => setEvidence(evidence.map((x, j) => (j === i ? { ...x, quote: ev.target.value } : x)))}
                  aria-label={`Beleg ${i + 1}`}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEvidence(evidence.filter((_, j) => j !== i))} aria-label={`Beleg ${i + 1} entfernen`}>
                  <X size={14} aria-hidden />
                </button>
              </div>
              {e.quote.trim() && (
                <span className={`pl-1 text-[12px] ${at === null ? "text-amber" : "text-green"}`}>
                  {at === null ? "Steht so nicht im Text." : at === e.paragraph ? "Gefunden." : `Gefunden in Abschnitt ${at}.`}
                  {at !== null && at !== e.paragraph && (
                    <button type="button" className="ml-2 font-semibold text-accent hover:underline" onClick={() => setEvidence(evidence.map((x, j) => (j === i ? { ...x, paragraph: at } : x)))}>
                      Übernehmen
                    </button>
                  )}
                </span>
              )}
            </div>
          );
        })}
        <button type="button" className="justify-self-start text-[13px] font-semibold text-accent hover:underline" onClick={() => setEvidence([...evidence, { paragraph: 1, quote: "" }])}>
          + Beleg
        </button>
      </div>
    </div>
  );
}

/** Instead of "Neue Aufgabe": a new question about the same text, of the kind chosen. */
export function AddReadingQuestion({ worksheetId, afterId, onAdded }: { worksheetId: number; afterId?: number; onAdded: (id: number) => void }) {
  const [aspect, setAspect] = useState<Aspect>("info");
  const [format, setFormat] = useState<"free" | "cloze" | "reading">("free");
  const [pending, start] = useTransition();
  const [note, setNote] = useState<ActionResult>(null);
  const add = () =>
    start(async () => {
      const r = await addReadingQuestionAction(worksheetId, aspect, format, afterId);
      setNote(r);
      if (r?.id) onAdded(r.id);
    });
  return (
    <div className="no-print rounded-xl border border-dashed border-line-strong px-5 py-4">
      <p className="label mb-3">Weitere Frage zum Text</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="field min-w-[220px]">
          <span className="label">Was sie übt</span>
          <select className="input" value={aspect} onChange={(e) => isAspect(e.target.value) && setAspect(e.target.value)}>
            {ASPECT_KEYS.map((a) => (
              <option key={a} value={a}>
                {ASPECT_SHORT[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="field min-w-[200px]">
          <span className="label">Antwort</span>
          <select className="input" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <option value="free">Eigene Antwort</option>
            <option value="cloze">Lückentext</option>
            <option value="reading">Auswahl (Multiple Choice)</option>
          </select>
        </label>
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={add}>
          <Plus size={15} aria-hidden /> Anlegen und bearbeiten
        </button>
      </div>
      {note?.error && (
        <p className="mt-2 text-[13px] text-red" role="alert">
          {note.error}
        </p>
      )}
    </div>
  );
}
