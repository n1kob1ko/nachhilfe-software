"use client";

import { BookOpenText, Sparkles } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/app/builder-actions";
import { createReadingDraftAction } from "@/app/lesen-actions";
import { SchoolClassFields } from "@/components/SchoolClassFields";
import { paragraphsOf, QUESTION_COUNTS, recommendedWords, TEXT_TYPES, wordCount } from "@/lib/lesen";
import { schulstufe } from "@/lib/school";

type Student = { id: number; name: string; schoolType: string; klasse: number | null; subjects: string[] };

const chip =
  "cursor-pointer rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[14px] transition-colors hover:border-ink-3 has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent has-focus-visible:outline-2 has-focus-visible:outline-accent has-disabled:cursor-not-allowed has-disabled:opacity-50";

/** "Leseverständnis erstellen": a longer text (own or by the KI) and several questions about it. */
export function ReadingBuilderForm({ students, studentId, aiEnabled }: { students: Student[]; studentId: number | null; aiEnabled: boolean }) {
  const [state, action] = useActionState<ActionResult, FormData>(createReadingDraftAction, null);
  const initial = students.find((s) => s.id === studentId) ?? null;
  const [student, setStudent] = useState<Student | null>(initial);
  const [subject, setSubject] = useState(initial?.subjects.includes("Englisch") && !initial.subjects.includes("Deutsch") ? "Englisch" : "Deutsch");
  const [level, setLevel] = useState({ type: initial?.schoolType || "Mittelschule", klasse: initial?.klasse ?? 2 });
  const [source, setSource] = useState<"eigen" | "ki">("eigen");
  const [text, setText] = useState("");
  const [questions, setQuestions] = useState<"ki" | "vorlage">(aiEnabled ? "ki" : "vorlage");
  const rec = recommendedWords(schulstufe(level.type, level.klasse));
  const [words, setWords] = useState<number | null>(null);
  const length = words ?? rec.default;
  const count = wordCount(text);
  const paragraphs = paragraphsOf(text).length;
  const tone = !count ? "text-ink-3" : count < rec.min * 0.6 || count > rec.max * 1.4 ? "text-amber" : "text-ink-2";

  const pickStudent = (id: string) => {
    const s = students.find((x) => String(x.id) === id) ?? null;
    setStudent(s);
    if (s?.schoolType) setLevel({ type: s.schoolType, klasse: s.klasse ?? 1 });
  };

  return (
    <form action={action} className="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="text_source" value={source} />
      <input type="hidden" name="questions" value={questions} />
      <ol className="grid gap-8">
        <Step n={1} title="Schüler und Klasse">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="field">
              <span className="label">Schüler</span>
              <select className="input" name="student_id" value={student?.id ?? ""} onChange={(e) => pickStudent(e.target.value)}>
                <option value="">Ohne Schüler (allgemeine Übung)</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <SchoolClassFields key={`${student?.id ?? 0}`} type={level.type} klasse={level.klasse} onChange={(type, klasse) => setLevel({ type, klasse })} />
            </div>
          </div>
          <fieldset className="mt-4">
            <legend className="label mb-2">Fach</legend>
            <div className="flex flex-wrap gap-2">
              {["Deutsch", "Englisch"].map((s) => (
                <label key={s} className={chip}>
                  <input type="radio" name="subject" value={s} checked={subject === s} onChange={() => setSubject(s)} className="sr-only" />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
        </Step>

        <Step n={2} title="Lesetext" note={`Empfehlung für die ${rec.label}: ${rec.min}–${rec.max} Wörter. Das ist kein Limit.`}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Woher kommt der Text?">
            <label className={chip}>
              <input type="radio" name="_source" checked={source === "eigen"} onChange={() => setSource("eigen")} className="sr-only" />
              Eigenen Text einfügen
            </label>
            <label className={chip}>
              <input type="radio" name="_source" checked={source === "ki"} onChange={() => setSource("ki")} disabled={!aiEnabled} className="sr-only" />
              <Sparkles size={14} className="mr-1 inline" aria-hidden />
              Text von der KI schreiben lassen
            </label>
          </div>
          {!aiEnabled && <p className="mt-2 text-[13px] text-ink-3">Ohne KI fügst du einen eigenen Text ein. Die Fragen kommen dann aus Vorlagen.</p>}

          <label className="field mt-4">
            <span className="label">Titel{source === "ki" ? " (optional)" : ""}</span>
            <input className="input" name="title" maxLength={160} placeholder={source === "ki" ? "Sonst wählt die KI einen Titel" : "z. B. Der verschwundene Schlüssel"} />
          </label>

          {source === "eigen" ? (
            <label className="field mt-4">
              <span className="label">Text</span>
              <textarea
                className="input min-h-[280px] font-[inherit] leading-relaxed"
                name="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Text hier einfügen. Absätze mit einer Leerzeile trennen."
              />
              <span className={`num text-[13px] ${tone}`}>
                {count} Wörter · {paragraphs} {paragraphs === 1 ? "Absatz" : "Absätze"}
              </span>
              <span className="text-[12.5px] text-ink-3">Verwende nur Texte, die du verwenden darfst (eigene Texte, freie Lizenzen, Schulbuch für den eigenen Unterricht).</span>
            </label>
          ) : (
            <div className="mt-4 grid gap-4">
              <label className="field">
                <span className="label">Thema</span>
                <input className="input" name="topic" maxLength={200} required placeholder={subject === "Englisch" ? "z. B. a school trip to London" : "z. B. Ein Tag am Bauernhof"} />
              </label>
              <fieldset>
                <legend className="label mb-2">Textart</legend>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TEXT_TYPES).map(([k, label], i) => (
                    <label key={k} className={chip}>
                      <input type="radio" name="text_type" value={k} defaultChecked={i === 0} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="field max-w-[260px]">
                <span className="label">Ungefähre Länge</span>
                <span className="flex items-center gap-2">
                  <input className="input num w-[110px]" type="number" name="words" min={80} max={2000} step={10} value={length} onChange={(e) => setWords(Number(e.target.value) || null)} />
                  <span className="text-[14px] text-ink-2">Wörter</span>
                </span>
              </label>
              <p className="-mt-2 text-[12.5px] text-ink-3">Die KI schreibt einen neuen, eigenen Text. Sie übernimmt keine Texte aus dem Internet. Du kannst ihn danach bearbeiten.</p>
            </div>
          )}
        </Step>

        <Step n={3} title="Fragen">
          <div className="grid gap-4">
            <fieldset>
              <legend className="label mb-2">Anzahl</legend>
              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((n) => (
                  <label key={n} className={chip}>
                    <input type="radio" name="count" value={n} defaultChecked={n === 8} className="sr-only" />
                    <span className="num">{n}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label mb-2">Schwierigkeit</legend>
              <div className="flex flex-wrap gap-2">
                {["leicht", "mittel", "schwer"].map((d) => (
                  <label key={d} className={chip}>
                    <input type="radio" name="difficulty" value={d} defaultChecked={d === "mittel"} className="sr-only" />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label mb-2">Wer schreibt die Fragen?</legend>
              <div className="flex flex-wrap gap-2">
                <label className={chip}>
                  <input type="radio" checked={questions === "ki"} onChange={() => setQuestions("ki")} disabled={!aiEnabled} className="sr-only" />
                  <Sparkles size={14} className="mr-1 inline" aria-hidden />
                  KI, passend zum Text
                </label>
                <label className={chip}>
                  <input type="radio" checked={questions === "vorlage"} onChange={() => setQuestions("vorlage")} className="sr-only" />
                  Vorlagen, ich passe sie an
                </label>
              </div>
            </fieldset>
            <p className="text-[13px] text-ink-2">
              Die Fragen decken verschiedene Bereiche ab: Informationen finden, Zusammenhänge, Schlussfolgern, Wörter erklären, Textstelle als Beleg, Zusammenfassen und eine eigene Stellungnahme. Meist mit
              eigener Antwort, dazu ein Lückentext.
            </p>
            <label className={`flex min-h-[44px] items-center gap-2 text-[14px] ${questions === "ki" ? "cursor-pointer" : "text-ink-3"}`}>
              <input type="checkbox" name="mc" disabled={questions !== "ki"} className="h-4 w-4 accent-[var(--accent)]" />
              Auch Auswahlfragen erlauben (höchstens jede vierte Frage)
            </label>
          </div>
        </Step>
      </ol>

      <aside className="grid content-start gap-4 xl:sticky xl:top-6">
        <div className="panel grid gap-3 px-4 py-4">
          <p className="flex items-center gap-2 font-semibold">
            <BookOpenText size={17} className="text-accent" aria-hidden /> So geht es weiter
          </p>
          <p className="text-[13.5px] text-ink-2">
            Du siehst Text und Fragen zuerst in der Vorschau. Dort kannst du den Text, jede Frage und jede Musterlösung ändern. Fragen, die nicht gut zum Text passen, sind markiert.
          </p>
          {(source === "ki" || questions === "ki") && <p className="text-[12.5px] text-ink-3">Die KI bekommt nur Fach, Klasse, Thema und Text, keine Namen.</p>}
          <Submit ai={source === "ki" || questions === "ki"} />
          {state?.error && (
            <p className="text-[14px] text-red" role="alert">
              {state.error}
            </p>
          )}
        </div>
      </aside>
    </form>
  );
}

function Submit({ ai }: { ai: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary btn-lg" disabled={pending}>
      <Sparkles size={17} aria-hidden />
      {pending ? (ai ? "Die KI schreibt …" : "Wird erstellt …") : "Übung erstellen und Vorschau zeigen"}
    </button>
  );
}

function Step({ n, title, note, children }: { n: number; title: string; note?: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3">
      <span className="num flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-surface" aria-hidden>
        {n}
      </span>
      <section aria-label={title}>
        <h2 className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        {note && <p className="mt-0.5 text-[13px] text-ink-3">{note}</p>}
        <div className="mt-3">{children}</div>
      </section>
    </li>
  );
}
