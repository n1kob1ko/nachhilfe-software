"use client";

import { useActionState, useMemo, useState } from "react";
import { BookOpenText, RotateCcw } from "lucide-react";
import type { InterpretationFormState } from "@/app/textinterpretation-actions";
import { cleanTarget, defaultArbeitsauftrag, isStoryKind, lastLine, MAX_TARGET, MIN_STORY_LINES, MIN_TARGET, numberedLines, schreibplan, STORY_KINDS, wordRange, type StoryKind } from "@/lib/textinterpretation";
import { BEISPIEL_AUTORIN, BEISPIEL_GESCHICHTE, BEISPIEL_JAHR, BEISPIEL_TITEL } from "@/lib/textinterpretation-beispiel";
import { NumberedStory, SchreibplanList } from "./NumberedStory";
import { TextFotoLesen } from "./TextFotoLesen";

export type InterpretationDefaults = {
  title: string;
  author: string;
  year: string;
  kind: StoryKind;
  story: string;
  countBlank: boolean;
  target: number;
  /** empty: the Arbeitsauftrag follows the entries until the teacher changes it */
  prompt: string;
  sourceNote: string;
};

type Props = {
  action: (prev: InterpretationFormState, f: FormData) => Promise<InterpretationFormState>;
  defaults: InterpretationDefaults;
  /** the student's device, when "open it there at once" is offered */
  device?: "laptop" | "tablet" | null;
  name: string;
  submitLabel: string;
  /** shown under the form, e.g. that the written text is kept */
  note?: string;
  /** the KI can read the printed story from a photo (lib/textinterpretation-foto.ts); only on click */
  kiLiest?: boolean;
  studentId?: number;
};

/**
 * Story, author, word target and Arbeitsauftrag of a Textinterpretation. The story keeps its line breaks;
 * the preview shows the line numbers the student will see. The Arbeitsauftrag follows the entries until
 * the teacher writes their own.
 */
export function InterpretationForm({ action, defaults, device, name, submitLabel, note, kiLiest, studentId }: Props) {
  const [state, formAction, pending] = useActionState<InterpretationFormState, FormData>(action, null);
  const [title, setTitle] = useState(defaults.title);
  const [author, setAuthor] = useState(defaults.author);
  const [year, setYear] = useState(defaults.year);
  const [kind, setKind] = useState<StoryKind>(defaults.kind);
  const [story, setStory] = useState(defaults.story);
  const [countBlank, setCountBlank] = useState(defaults.countBlank);
  const [target, setTarget] = useState(String(defaults.target));
  const [own, setOwn] = useState(defaults.prompt);
  const auto = defaultArbeitsauftrag({ title: title.trim() || "…", author, year, kind, target: cleanTarget(target) });
  const prompt = own || auto;
  const lines = useMemo(() => lastLine(numberedLines(story, countBlank)), [story, countBlank]);
  const blanks = useMemo(() => story.replace(/\r\n?/g, "\n").trim().split("\n").filter((l) => !l.trim()).length, [story]);
  const { min, max } = wordRange(cleanTarget(target));

  const example = () => {
    setTitle(BEISPIEL_TITEL);
    setAuthor(BEISPIEL_AUTORIN);
    setYear(BEISPIEL_JAHR);
    setKind("Kurzgeschichte");
    setStory(BEISPIEL_GESCHICHTE);
    setCountBlank(false);
    setOwn("");
  };

  // a page read from a photo goes under what is there already, so a story over two pages is read page by page
  const fromPhoto = (v: { titel: string; text: string }) => {
    setStory((s) => (s.trim() ? `${s.replace(/\s+$/, "")}\n${v.text}` : v.text));
    if (!title.trim() && v.titel) setTitle(v.titel);
  };

  return (
    <form action={formAction} className="grid gap-6" data-testid="interpretation-form">
      <section className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          <label className="field">
            <span className="label">Titel der Geschichte</span>
            <input className="input" name="title" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Sieben Uhr zwölf" />
          </label>
          <label className="field">
            <span className="label">Autor oder Autorin</span>
            <input className="input" name="author" maxLength={120} value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <label className="field">
            <span className="label">Jahr (wenn bekannt)</span>
            <input className="input" name="year" maxLength={20} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Textsorte</span>
            <select className="input" name="kind" value={kind} onChange={(e) => isStoryKind(e.target.value) && setKind(e.target.value)}>
              {Object.keys(STORY_KINDS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="field col-span-2 sm:col-span-1">
            <span className="label">Wortziel</span>
            <input className="input" name="target" type="number" min={MIN_TARGET} max={MAX_TARGET} step={10} required value={target} onChange={(e) => setTarget(e.target.value)} />
            <span className="text-[13px] text-ink-2">
              Im Auftrag: {min} bis {max} Wörter
            </span>
          </label>
        </div>
      </section>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label htmlFor="ti-story" className="label">
            Text der Geschichte
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={example} data-testid="beispiel-einfuegen">
            <BookOpenText size={15} aria-hidden /> Beispielgeschichte einfügen
          </button>
        </div>
        <p className="text-[13px] text-ink-2">Füge den ganzen Text so ein, wie er auf dem Blatt steht: Jede Zeile bleibt eine Zeile und bekommt ihre Nummer. Kopiere ihn am besten aus einer PDF-Datei.</p>
        {kiLiest && <TextFotoLesen studentId={studentId} onText={fromPhoto} />}
        <textarea
          id="ti-story"
          className="input font-[inherit] leading-relaxed"
          name="story"
          rows={16}
          required
          wrap="off"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          spellCheck={false}
          data-testid="geschichte"
        />
        <p className="num text-[13px] text-ink-2" data-testid="zeilen-erkannt">
          {lines ? `${lines} Zeilen erkannt` : "Noch kein Text"}
          {lines > 0 && lines < MIN_STORY_LINES ? `: zu wenig für eine Interpretation, bitte mit Zeilenumbrüchen einfügen` : ""}
        </p>
        {blanks > 0 && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px]">
            <input type="checkbox" name="countBlank" value="1" checked={countBlank} onChange={(e) => setCountBlank(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
            Leerzeilen mitzählen ({blanks} im Text)
          </label>
        )}
        {lines > 0 && (
          <details className="ti-box">
            <summary className="ti-summary">Vorschau mit Zeilennummern</summary>
            <div className="max-h-[420px] overflow-y-auto pt-1 pb-2">
              <NumberedStory text={story} countBlank={countBlank} title={title} author={author} year={year} kind={kind} headingLevel={3} />
            </div>
          </details>
        )}
      </section>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label htmlFor="ti-prompt" className="label">
            Arbeitsauftrag
          </label>
          {own && own !== auto && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOwn("")}>
              <RotateCcw size={15} aria-hidden /> Wieder aus den Angaben
            </button>
          )}
        </div>
        <textarea id="ti-prompt" className="input leading-relaxed" rows={9} name="prompt" maxLength={4000} value={prompt} onChange={(e) => setOwn(e.target.value)} data-testid="arbeitsauftrag" />
        <p className="text-[13px] text-ink-2">Wie bei einer Schularbeit: Textsorte, Bezugstext, Arbeitsaufträge und Umfang. Du kannst ihn frei ändern.</p>
      </section>

      <details className="ti-box">
        <summary className="ti-summary">Schreibplan für {name} ansehen</summary>
        <p className="text-[13px] text-ink-2">Steht beim Schreiben über dem Textfeld und auf dem Arbeitsblatt. Die Wortzahlen richten sich nach dem Wortziel.</p>
        <SchreibplanList plan={schreibplan(cleanTarget(target), kind)} className="mt-2" />
      </details>

      <label className="field">
        <span className="label">Quelle (nur für dich, wird nicht gedruckt)</span>
        <input className="input" name="sourceNote" maxLength={400} defaultValue={defaults.sourceNote} placeholder="z. B. Schulbuch S. 34 oder Kopie der Lehrerin" />
      </label>

      {device !== undefined &&
        (device ? (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px]">
            <input type="checkbox" name="tablet" value="1" defaultChecked className="h-5 w-5 accent-[var(--accent)]" />
            Gleich am {device === "laptop" ? "Laptop" : "Tablet"} von {name} öffnen
          </label>
        ) : (
          <p className="text-[14px] text-ink-2">Kein Schülergerät verbunden: Der Text öffnet sich hier, {name} schreibt an diesem Gerät.</p>
        ))}
      {state?.error && (
        <p className="text-[14px] text-red" role="alert">
          {state.error}
        </p>
      )}
      {note && <p className="text-[14px] text-ink-2">{note}</p>}
      <div>
        <button className="btn btn-primary btn-lg" disabled={pending} data-testid="interpretation-speichern">
          {pending ? "Wird gespeichert …" : submitLabel}
        </button>
      </div>
    </form>
  );
}

