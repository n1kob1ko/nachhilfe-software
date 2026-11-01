import { CheckCircle2, Info, Lightbulb } from "lucide-react";
import { beispielFor, hinweiseFor, SORTEN, type AuftragView, type SorteKey } from "@/lib/schreibauftrag";
import type { TextDoc } from "@/lib/text-doc";
import { wordRange, type HinweisTone } from "@/lib/textinterpretation";
import { NumberedStory } from "./NumberedStory";

/** How far the text is: words against the target, with the range of the Arbeitsauftrag marked. */
export function WordProgress({ words, target }: { words: number; target: number }) {
  const { min, max } = wordRange(target);
  const scale = max * 1.15;
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100).toFixed(1)}%`;
  const state = words < min ? "unter" : words <= max ? "im-ziel" : "ueber";
  return (
    <div className="ti-progress" data-testid="wortfortschritt" data-state={state}>
      <div className="ti-progress-bar" role="progressbar" aria-label="Wörter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(words, max)} aria-valuetext={`${words} von ${min} bis ${max} Wörtern`}>
        <span className="ti-progress-range" style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }} aria-hidden />
        <span className="ti-progress-fill" style={{ width: pct(words) }} aria-hidden />
      </div>
      <p className="ti-progress-text">
        <span className="num font-semibold">{words.toLocaleString("de-AT")}</span> von <span className="num">{min}</span> bis <span className="num">{max}</span> Wörtern
        {state === "im-ziel" ? " · im Ziel" : state === "ueber" ? " · etwas mehr als geplant" : ""}
      </p>
    </div>
  );
}

const TONE: Record<HinweisTone, { icon: React.ReactNode; cls: string; label: string }> = {
  gut: { icon: <CheckCircle2 size={16} aria-hidden />, cls: "text-green", label: "Passt" },
  tipp: { icon: <Lightbulb size={16} aria-hidden />, cls: "text-amber", label: "Tipp" },
  info: { icon: <Info size={16} aria-hidden />, cls: "text-ink-2", label: "Info" },
};

/** Hinweise without KI on the text as it is now. Only hints: nothing here is a grade. */
export function HintsPanel({ doc, auftrag }: { doc: TextDoc; auftrag: AuftragView }) {
  const list = hinweiseFor(doc, auftrag);
  const tips = list.filter((h) => h.tone === "tipp").length;
  return (
    <details className="ti-box" data-testid="hinweise">
      <summary className="ti-summary">
        Hinweise zu deinem Text{tips ? <span className="ti-badge num">{tips}</span> : null}
      </summary>
      <p className="mt-1 text-[13px] text-ink-2">Nur Hinweise, keine Note. Sie zählen und suchen, sie lesen nicht mit. Prüf selbst, ob sie für deinen Text stimmen.</p>
      <ul className="mt-2 grid gap-2">
        {list.map((h) => (
          <li key={h.key} className="flex items-start gap-2 text-[14px]" data-hinweis={h.key} data-tone={h.tone}>
            <span className={`mt-0.5 shrink-0 ${TONE[h.tone].cls}`} title={TONE[h.tone].label}>
              {TONE[h.tone].icon}
            </span>
            <span>{h.text}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * „Darauf kommt es an“: the Erwartungshorizont the teacher saved and released, criterion by criterion. Never a
 * suggestion that is not checked; the page only gets it when it is released (lib/schreibauftrag-bewertung.ts).
 */
export function ErwartungPanel({ erwartung }: { erwartung: { name: string; punkte: string[] }[] }) {
  return (
    <details className="ti-box" data-testid="erwartung-schueler">
      <summary className="ti-summary">Darauf kommt es an</summary>
      <p className="mt-1 text-[13px] text-ink-2">Was ein guter Text enthalten kann. Es gibt mehr als einen richtigen Weg.</p>
      <div className="mt-2 grid gap-3">
        {erwartung.map((k) => (
          <div key={k.name}>
            <p className="text-[12px] font-semibold tracking-[0.04em] text-accent uppercase">{k.name}</p>
            <ul className="mt-1 grid list-disc gap-0.5 pl-5 text-[14px]">
              {k.punkte.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

/**
 * „So kann es aussehen“: DreamStudy's model text of this Textsorte about its own example, part by part. A
 * Betreff, an Anrede or a Gruß stays on its own line, as in the letter.
 */
export function ExamplePanel({ sorte }: { sorte: SorteKey }) {
  const b = beispielFor(sorte);
  const s = SORTEN[sorte];
  const story = s.beilage === "Geschichte";
  return (
    <details className="ti-box" data-testid="beispiel">
      <summary className="ti-summary">So kann es aussehen</summary>
      <p className="mt-1 text-[13px] text-ink-2">
        {story ? "Eine Beispiel-Interpretation zu einer anderen Kurzgeschichte" : `Ein Beispiel für ${s.einen} zu einer anderen Textbeilage`} („{b.beilage.title}“, für DreamStudy geschrieben). {story ? "Sie" : "Es"} zeigt
        den Aufbau, nicht die Lösung für deinen Text.
      </p>
      {b.situation && <p className="mt-2 text-[13px] text-ink-2">Schreibsituation: {b.situation}</p>}
      <div className="mt-3 grid gap-3">
        {b.teile.map((p) => (
          <div key={p.key}>
            <p className="text-[12px] font-semibold tracking-[0.04em] text-accent uppercase">{p.title}</p>
            {p.text.split("\n").map((t, i) => (
              <p key={i} className="mt-0.5 text-[14px] leading-relaxed">
                {t}
              </p>
            ))}
          </div>
        ))}
      </div>
      <details className="mt-3">
        <summary className="ti-summary text-[14px]">{story ? "Die Beispielgeschichte lesen" : "Die Beispiel-Textbeilage lesen"}</summary>
        <NumberedStory text={b.beilage.text} title={b.beilage.title} author={b.beilage.author} year={b.beilage.year} medium={b.beilage.medium} kind={b.beilage.kind} className="mt-2" headingLevel={3} />
      </details>
    </details>
  );
}
