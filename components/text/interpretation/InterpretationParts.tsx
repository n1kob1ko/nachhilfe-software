import { CheckCircle2, Info, Lightbulb } from "lucide-react";
import type { TextDoc } from "@/lib/text-doc";
import { hinweise, numberedLines, TEIL_TITLES, wordRange, type HinweisTone, type InterpretationView } from "@/lib/textinterpretation";
import { BEISPIEL_AUTORIN, BEISPIEL_GESCHICHTE, BEISPIEL_INTERPRETATION, BEISPIEL_JAHR, BEISPIEL_TITEL } from "@/lib/textinterpretation-beispiel";
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
export function HintsPanel({ doc, story }: { doc: TextDoc; story: InterpretationView }) {
  const list = hinweise(doc, { title: story.title, author: story.author, target: story.target, lines: numberedLines(story.text, story.countBlank) });
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

/** „So kann es aussehen“: the Lernheft's model interpretation of its own example story, part by part. */
export function ExamplePanel() {
  return (
    <details className="ti-box" data-testid="beispiel">
      <summary className="ti-summary">So kann es aussehen</summary>
      <p className="mt-1 text-[13px] text-ink-2">
        Eine Beispiel-Interpretation zu einer anderen Kurzgeschichte („{BEISPIEL_TITEL}“, für das Lernheft geschrieben). Sie zeigt den Aufbau, nicht die Lösung für deinen Text.
      </p>
      <div className="mt-3 grid gap-3">
        {BEISPIEL_INTERPRETATION.map((p) => (
          <div key={p.teil}>
            <p className="text-[12px] font-semibold tracking-[0.04em] text-accent uppercase">{TEIL_TITLES[p.teil]}</p>
            <p className="mt-0.5 text-[14px] leading-relaxed">{p.text}</p>
          </div>
        ))}
      </div>
      <details className="mt-3">
        <summary className="ti-summary text-[14px]">Die Beispielgeschichte lesen</summary>
        <NumberedStory text={BEISPIEL_GESCHICHTE} title={BEISPIEL_TITEL} author={BEISPIEL_AUTORIN} year={BEISPIEL_JAHR} kind="Kurzgeschichte" className="mt-2" headingLevel={3} />
      </details>
    </details>
  );
}
