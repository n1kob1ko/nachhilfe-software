"use client";

import { useActionState, useMemo, useState } from "react";
import { BookOpenText, RotateCcw, WrapText } from "lucide-react";
import type { AuftragFormState } from "@/app/schreibauftrag-actions";
import { arbeitsauftrag, beispielFor, hasLongLines, kindsOf, planFor, SORTEN, wrapLines, type SorteKey } from "@/lib/schreibauftrag";
import { cleanTarget, lastLine, MAX_TARGET, MIN_STORY_LINES, MIN_TARGET, numberedLines, wordRange } from "@/lib/textinterpretation";
import { MerkmaleList, NumberedStory, SchreibplanList } from "./NumberedStory";
import { TextFotoLesen } from "./TextFotoLesen";

export type AuftragDefaults = {
  title: string;
  author: string;
  year: string;
  medium: string;
  kind: string;
  story: string;
  countBlank: boolean;
  target: number;
  situation: string;
  /** empty: the Arbeitsauftrag follows the entries until the teacher changes it */
  prompt: string;
  sourceNote: string;
};

/** An empty form for a new Schreibauftrag of this Textsorte. */
const emptyDefaults = (sorte: SorteKey): AuftragDefaults => ({
  title: "",
  author: "",
  year: "",
  medium: "",
  kind: SORTEN[sorte].defaultKind,
  story: "",
  countBlank: false,
  target: SORTEN[sorte].target,
  situation: "",
  prompt: "",
  sourceNote: "",
});

type Props = {
  sorte: SorteKey;
  action: (prev: AuftragFormState, f: FormData) => Promise<AuftragFormState>;
  /** the saved entries when editing; a new Schreibauftrag starts empty */
  defaults?: AuftragDefaults;
  /** the student's device, when "open it there at once" is offered */
  device?: "laptop" | "tablet" | null;
  name: string;
  submitLabel: string;
  /** shown under the form, e.g. that the written text is kept */
  note?: string;
  /** the KI can read the printed text from a photo (lib/textinterpretation-foto.ts); only on click */
  kiLiest?: boolean;
  studentId?: number;
};

/**
 * Textbeilage (or story), author, medium, word target, Schreibsituation and Arbeitsauftrag of a Schreibauftrag. The
 * text keeps its line breaks; the preview shows the line numbers the student will see. A text from a web page,
 * with a whole paragraph in one line, can be broken into lines. The Arbeitsauftrag follows the entries until the
 * teacher writes their own.
 */
export function SchreibauftragForm({ sorte, action, defaults: saved, device, name, submitLabel, note, kiLiest, studentId }: Props) {
  const s = SORTEN[sorte];
  const defaults = saved ?? emptyDefaults(sorte);
  const story = s.beilage === "Geschichte";
  const [state, formAction, pending] = useActionState<AuftragFormState, FormData>(action, null);
  const [title, setTitle] = useState(defaults.title);
  const [author, setAuthor] = useState(defaults.author);
  const [year, setYear] = useState(defaults.year);
  const [medium, setMedium] = useState(defaults.medium);
  const [kind, setKind] = useState(defaults.kind);
  const [text, setText] = useState(defaults.story);
  const [countBlank, setCountBlank] = useState(defaults.countBlank);
  const [target, setTarget] = useState(String(defaults.target));
  const [situation, setSituation] = useState(defaults.situation);
  const [own, setOwn] = useState(defaults.prompt);
  const words = cleanTarget(target, s.target);
  const auto = arbeitsauftrag({ sorte, title: title.trim() || "…", author, year, medium, kind, target: words, situation });
  const prompt = own || auto;
  const lines = useMemo(() => lastLine(numberedLines(text, countBlank)), [text, countBlank]);
  const blanks = useMemo(() => text.replace(/\r\n?/g, "\n").trim().split("\n").filter((l) => !l.trim()).length, [text]);
  const long = useMemo(() => hasLongLines(text), [text]);
  const { min, max } = wordRange(words);
  const was = story ? "der Geschichte" : "der Textbeilage";

  const example = () => {
    const b = beispielFor(sorte);
    setTitle(b.beilage.title);
    setAuthor(b.beilage.author);
    setYear(b.beilage.year);
    setMedium(b.beilage.medium);
    setKind(b.beilage.kind);
    setText(b.beilage.text);
    setCountBlank(false);
    if (s.situation) setSituation(b.situation);
    setOwn("");
  };

  // a page read from a photo goes under what is there already, so a text over two pages is read page by page
  const fromPhoto = (v: { titel: string; text: string }) => {
    setText((t) => (t.trim() ? `${t.replace(/\s+$/, "")}\n${v.text}` : v.text));
    if (!title.trim() && v.titel) setTitle(v.titel);
  };

  return (
    <form action={formAction} className="grid gap-6" data-testid="schreibauftrag-form" data-sorte={sorte}>
      <section className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          <label className="field">
            <span className="label">Titel {was}</span>
            <input className="input" name="title" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={story ? "z. B. Sieben Uhr zwölf" : "z. B. Ausgeschlafen lernt es sich besser"} />
          </label>
          <label className="field">
            <span className="label">Autor oder Autorin</span>
            <input className="input" name="author" maxLength={120} value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
        </div>
        {story ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <label className="field">
              <span className="label">Jahr (wenn bekannt)</span>
              <input className="input" name="year" maxLength={20} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
            <KindSelect sorte={sorte} kind={kind} setKind={setKind} label="Textsorte" />
            <TargetInput target={target} setTarget={setTarget} min={min} max={max} className="col-span-2 sm:col-span-1" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
              <label className="field">
                <span className="label">Erschienen in</span>
                <input className="input" name="medium" maxLength={120} value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="Zeitung, Zeitschrift oder Webseite" />
              </label>
              <label className="field">
                <span className="label">Datum</span>
                <input className="input" name="year" maxLength={40} value={year} onChange={(e) => setYear(e.target.value)} placeholder="z. B. 12. März 2026" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <KindSelect sorte={sorte} kind={kind} setKind={setKind} label="Art der Textbeilage" />
              <TargetInput target={target} setTarget={setTarget} min={min} max={max} />
            </div>
            {s.situation && (
              <label className="field">
                <span className="label">{s.situation.label}</span>
                <input className="input" name="situation" maxLength={300} required={s.situation.pflicht} value={situation} onChange={(e) => setSituation(e.target.value)} placeholder={s.situation.placeholder} data-testid="situation" />
              </label>
            )}
          </>
        )}
      </section>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label htmlFor="ti-story" className="label">
            Text {was}
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={example} data-testid="beispiel-einfuegen">
            <BookOpenText size={15} aria-hidden /> {story ? "Beispielgeschichte einfügen" : "Beispiel einfügen"}
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          data-testid="geschichte"
        />
        <p className="num text-[13px] text-ink-2" data-testid="zeilen-erkannt">
          {lines ? `${lines} Zeilen erkannt` : "Noch kein Text"}
          {lines > 0 && lines < MIN_STORY_LINES ? `: zu wenig für ${s.einen}, bitte mit Zeilenumbrüchen einfügen` : ""}
        </p>
        {long && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-panel px-4 py-2 text-[14px]" data-testid="lange-zeilen">
            <span>Manche Zeilen sind sehr lang, wie bei Text aus einer Webseite.</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setText((t) => wrapLines(t))} data-testid="zeilen-umbrechen">
              <WrapText size={15} aria-hidden /> Zeilen umbrechen
            </button>
          </div>
        )}
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
              <NumberedStory text={text} countBlank={countBlank} title={title} author={author} year={year} medium={medium} kind={kind} headingLevel={3} />
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
        <p className="text-[13px] text-ink-2">Wie bei einer Schularbeit: Textsorte, {story ? "Bezugstext" : "Textbeilage"}, Arbeitsaufträge und Umfang. Du kannst ihn frei ändern.</p>
      </section>

      <details className="ti-box">
        <summary className="ti-summary">Schreibplan für {name} ansehen</summary>
        <p className="text-[13px] text-ink-2">Steht beim Schreiben über dem Textfeld und auf dem Arbeitsblatt. Die Wortzahlen richten sich nach dem Wortziel.</p>
        <SchreibplanList plan={planFor({ sorte, target: words, kind })} className="mt-2" />
        <MerkmaleList merkmale={s.merkmale} className="mt-3" />
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
        <button className="btn btn-primary btn-lg" disabled={pending} data-testid="schreibauftrag-speichern">
          {pending ? "Wird gespeichert …" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function KindSelect({ sorte, kind, setKind, label }: { sorte: SorteKey; kind: string; setKind: (k: string) => void; label: string }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <select className="input" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
        {kindsOf(sorte).map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </label>
  );
}

function TargetInput({ target, setTarget, min, max, className = "" }: { target: string; setTarget: (v: string) => void; min: number; max: number; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="label">Wortziel</span>
      <input className="input" name="target" type="number" min={MIN_TARGET} max={MAX_TARGET} step={10} required value={target} onChange={(e) => setTarget(e.target.value)} />
      <span className="text-[13px] text-ink-2">
        Im Auftrag: {min} bis {max} Wörter
      </span>
    </label>
  );
}
