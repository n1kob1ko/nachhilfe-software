"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { DIAGNOSE_MAX, planDiagnosis } from "@/lib/diagnose-plan";

export type DiagnoseSkill = { id: string; name: string; area: string; generator: boolean };

function Start({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary btn-lg" disabled={disabled || pending}>
      {pending ? "Diagnose wird erstellt …" : "Diagnose starten"}
    </button>
  );
}

/**
 * Last step of the Diagnose-Modus, inside its form: the skills to check, with number and difficulty
 * of the tasks recounted on every tick. At most DIAGNOSE_MAX skills (further boxes are locked, so no
 * tick gets lost on the server); the Claude option only shows when a ticked skill has no built-in
 * generator. "Diagnose starten" is locked while the diagnosis is made, so a double tap sends one.
 */
export function DiagnoseConfirm({ skills, picked, showArea, ai, note }: { skills: DiagnoseSkill[]; picked: string[]; showArea: boolean; ai: boolean; note: string }) {
  const [ticked, setTicked] = useState(() => new Set(picked));
  const [useAI, setUseAI] = useState(true);
  const ids = skills.filter((s) => ticked.has(s.id)).map((s) => s.id);
  const plan = planDiagnosis(ids);
  const count = (d: string) => plan.filter((p) => p.difficulty === d).length;
  const full = ids.length >= DIAGNOSE_MAX;
  const noGenerator = skills.some((s) => ticked.has(s.id) && !s.generator);
  const needsAI = ai && noGenerator;
  // without Claude, a skill without a generator only gets as many tasks as there are different ones
  const maybeFewer = noGenerator && !(needsAI && useAI);
  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Geprüfte Fähigkeiten (höchstens {DIAGNOSE_MAX})</legend>
        <ul className="panel divide-y divide-line">
          {skills.map((s) => {
            const locked = full && !ticked.has(s.id);
            return (
              <li key={s.id}>
                <label className={`flex min-h-[52px] items-center gap-3 px-4 py-2 ${locked ? "cursor-not-allowed text-ink-3" : "cursor-pointer hover:bg-panel/60"}`}>
                  <input type="checkbox" name="skill_ids" value={s.id} checked={ticked.has(s.id)} disabled={locked} onChange={() => toggle(s.id)} className="h-5 w-5 accent-[var(--accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{s.name}</span>
                    {showArea && <span className="ml-2 text-[13px] text-ink-3">{s.area}</span>}
                  </span>
                  {!s.generator && <Sparkles size={14} aria-label="Aufgaben aus der Bibliothek oder mit KI" className="shrink-0 text-ink-3" />}
                </label>
              </li>
            );
          })}
        </ul>
        {full && (
          <p className="mt-2 text-[13px] text-ink-2" role="status">
            {DIAGNOSE_MAX} Fähigkeiten gewählt, mehr geht nicht, damit die Diagnose kurz bleibt. Nimm eine heraus, um eine andere zu wählen.
          </p>
        )}
      </fieldset>
      <p className="text-[14px] text-ink-2" aria-live="polite">
        {plan.length ? (
          <>
            {maybeFewer && "Bis zu "}
            <span className="num font-semibold text-ink">{plan.length}</span> Aufgaben: <span className="num">{count("leicht")}</span> leicht, <span className="num">{count("mittel")}</span> mittel,{" "}
            <span className="num">{count("schwer")}</span> schwer. Aufgaben aus der Bibliothek werden zuerst verwendet.
            {maybeFewer && " Fähigkeiten ohne eigenen Aufgabengenerator bekommen ohne Claude weniger Aufgaben, damit sich keine wiederholt."}
          </>
        ) : (
          "Bitte mindestens eine Fähigkeit wählen."
        )}
      </p>
      {needsAI && (
        <label className="flex min-h-[44px] items-center gap-3 text-[14px]">
          <input type="checkbox" name="use_ai" value="1" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
          Fehlende Aufgaben mit Claude erstellen (nur Fach, Klasse und Fähigkeiten werden übermittelt)
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Start disabled={!plan.length} />
        <span className="text-[13px] text-ink-3">{note}</span>
      </div>
    </>
  );
}
