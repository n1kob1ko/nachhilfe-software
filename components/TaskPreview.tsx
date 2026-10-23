import { categoryLabel, TASK_TYPES } from "@/lib/curriculum";
import { englischFormat, ENGLISCH_TEIL, TEXTSORTEN, wortRahmen } from "@/lib/englisch-matura-formate";
import type { Task } from "@/lib/repo";
import { ASPECT_SHORT, isAspect, OPEN_ASPECTS, severalNoted } from "@/lib/lesen";
import { clozeParts } from "@/lib/math-format";
import { mathAnswerText } from "@/lib/math-task";
import { maturaLoesung } from "@/lib/matura-formate";
import { buchstabe, GAP, hintLabel, kreisZahl, type TaskDraft } from "@/lib/tasks";
import { FigurBild } from "./Figur";
import { genderTone, genusBadge } from "./genus";
import { MathText } from "./MathText";
import { ReadingTextView } from "./ReadingText";

const partName = (label: string, i: number) => label || `${String.fromCharCode(97 + i)})`;

/**
 * Das Genus eines Nomens als kleines Zeichen (D10): Farbton plus Buchstabe m/f/n, damit die Farbe
 * nie das einzige Signal ist. Ohne gesetztes Genus wird nichts gezeigt.
 */
export function GenusBadge({ genus, className = "" }: { genus: unknown; className?: string }) {
  const badge = genusBadge(genus);
  if (!badge) return null;
  const tone = genderTone(genus);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold ${className}`}
      style={{ background: tone.bg, color: tone.fg }}
      title={`Genus: ${badge.label}`}
    >
      <span aria-hidden>{badge.letter}</span>
      <span className="sr-only">Genus: {badge.label}</span>
    </span>
  );
}


function withGaps(text: string, ankreuzen = false) {
  const parts = clozeParts(text, GAP);
  return parts.map((p, i) => (
    <span key={i}>
      <MathText text={p.text} />
      {i < parts.length - 1 &&
        // Lückentext zum Ankreuzen: die Lücken heißen ① ② wie die Satzteile darunter
        (ankreuzen ? (
          <span className="mx-1 inline-block min-w-12 border-b-2 border-ink-3 text-center align-baseline font-semibold text-ink-2">{kreisZahl(i + 1)}</span>
        ) : p.raised ? (
          <span className="relative -top-[0.55em] mx-0.5 inline-block h-[0.9em] w-7 border-b-2 border-ink-3 align-baseline" aria-label="Lücke, Hochzahl" />
        ) : (
          <span className="mx-1 inline-block w-20 border-b-2 border-ink-3 align-baseline" aria-label="Lücke" />
        ))}
    </span>
  ));
}

export function answerText(t: Pick<TaskDraft, "type" | "data" | "answer">) {
  if (t.type === "rechenweg" || t.type === "sachaufgabe") return mathAnswerText(t);
  // Auswendig schreiben: die Lösung ist der Text selbst (lib/memorize.ts)
  if (t.type === "memorize") return t.data.passage?.trim() || null;
  // Matura-Formate: beide richtigen Antworten, die Satzteile zu ① ②, die Buchstaben der Zuordnung
  const matura = maturaLoesung(t);
  if (matura) return matura;
  if (t.data.options && typeof t.answer.correct === "number") return `${String.fromCharCode(97 + t.answer.correct)}) ${t.data.options[t.answer.correct]}`;
  if (t.answer.steps) return t.answer.steps.map((s, i) => `${i + 1}. ${s}`).join("  ");
  if (t.answer.blanks) return t.answer.blanks.map((b) => b[0]).join(" · ");
  if (t.answer.accepted) return t.answer.accepted[0];
  return null;
}

/** The task as the student sees it, plus the solution block for the teacher. */
export function TaskBody({ task, showSolution, skillName, subject, passageShown }: { task: TaskDraft; showSolution: boolean; skillName?: string; subject?: string; passageShown?: boolean }) {
  const aspect = isAspect(task.data.aspect) ? task.data.aspect : null;
  const cat = aspect ? ASPECT_SHORT[aspect] : subject ? categoryLabel(subject, task.category) : null;
  const evidence = (task.answer.evidence ?? []).filter((e) => e.quote.trim());
  // Englisch-Matura (lib/englisch-matura-formate.ts): der Lesetext mit nummerierten Absätzen, True or False und Fragen mit A bis D
  const en = englischFormat(task);
  const z = task.data.zuordnung;
  const englischZuordnung = Boolean(en && z && (z.art === "richtig-falsch" || z.art === "fragen"));
  const schreiben = task.data.schreibauftrag;
  return (
    <div className="min-w-0">
      {task.data.passage && !passageShown && en && ENGLISCH_TEIL[en] === "reading" ? (
        <div className="mb-4 max-w-[70ch] rounded-lg bg-paper px-4 py-3">
          <ReadingTextView title={task.data.passageTitle?.trim() ?? ""} text={task.data.passage} lang="en" />
        </div>
      ) : (
        task.data.passage && !passageShown && <blockquote className="ruled mb-4 max-w-[70ch] rounded-lg bg-paper px-4 py-1 text-[15px]"><MathText text={task.data.passage} /></blockquote>
      )}
      {task.data.wortliste && (
        <p className="mb-2 flex max-w-[70ch] flex-wrap gap-x-4 gap-y-1 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[15px]" lang="en">
          {task.data.wortliste.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </p>
      )}
      <p className="max-w-[70ch] text-[16px] leading-relaxed whitespace-pre-line">{task.prompt ? withGaps(task.prompt, Boolean(task.data.gapOptions)) : <span className="text-ink-3 italic">Noch keine Aufgabenstellung</span>}</p>
      {/* Aufgabe mit Bild: mit Lösung zeigt das Bild die gesuchten Werte (zum Prüfen, ob Bild und Lösung zusammenpassen) */}
      {task.data.figure ? <FigurBild figure={task.data.figure} loesung={showSolution} className="mb-1" /> : null}
      {task.quelle && <p className="mt-1 text-[12px] text-ink-3">Quelle: {task.quelle}</p>}
      {task.data.genus && (
        <p className="mt-1.5">
          <GenusBadge genus={task.data.genus} />
        </p>
      )}
      {task.data.options && (
        <ol className="mt-2 space-y-1">
          {task.data.options.map((o, i) => (
            <li key={i} className={`flex gap-2 ${showSolution && (task.answer.correct === i || task.answer.correctAll?.includes(i)) ? "font-semibold text-green" : ""}`}>
              <span className="text-ink-3">{String.fromCharCode(97 + i)})</span>
              <span>
                <MathText text={o} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {task.data.options && task.answer.correctAll && (
        <p className="mt-1 text-[13px] text-ink-3">Genau zwei Antworten sind richtig.</p>
      )}
      {task.data.gapOptions && (
        <div className="mt-2 grid max-w-[70ch] gap-2 sm:grid-cols-2">
          {task.data.gapOptions.map((g, i) => (
            <ul key={i} className="rounded-md border border-line bg-surface px-3 py-1.5">
              <li className="text-[13px] font-semibold text-ink-2">{kreisZahl(i + 1)}</li>
              {g.map((o, j) => (
                <li key={j} className={`flex gap-2 ${showSolution && task.answer.blanks?.[i]?.includes(o) ? "font-semibold text-green" : ""}`}>
                  <span className="text-ink-3" aria-hidden>
                    ☐
                  </span>
                  <span>
                    <MathText text={o} />
                  </span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
      {z && englischZuordnung && (
        <ol className="mt-2 max-w-[70ch] space-y-2" lang="en">
          {z.statements.map((st, i) => (
            <li key={i} className="flex gap-2">
              <span className="num text-ink-3">{i + 1}</span>
              <span className="min-w-0 flex-1">
                {st}
                {z.art === "richtig-falsch" ? (
                  <span className="mt-0.5 flex flex-wrap gap-3 text-[14px]">
                    {z.options.map((o, k) => (
                      <span key={k} className={showSolution && task.answer.pairs?.[i] === k ? "font-semibold text-green" : "text-ink-2"}>
                        {showSolution && task.answer.pairs?.[i] === k ? "☒" : "☐"} {o}
                      </span>
                    ))}
                    {showSolution && task.answer.belege?.[i] && <span className="text-ink-2">„{task.answer.belege[i]}“</span>}
                  </span>
                ) : (
                  <span className="mt-0.5 grid gap-0.5 text-[14px]">
                    {(z.choices?.[i] ?? []).map((o, k) => (
                      <span key={k} className={showSolution && task.answer.pairs?.[i] === k ? "font-semibold text-green" : "text-ink-2"}>
                        {buchstabe(k)} {o}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {task.data.zuordnung && !englischZuordnung && (
        <div className="mt-2 grid max-w-[70ch] gap-2 sm:grid-cols-2">
          <ol className="space-y-1">
            {task.data.zuordnung.statements.map((st, i) => (
              <li key={i} className="flex gap-2">
                <span className="num text-ink-3">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <MathText text={st} />
                </span>
                <span className={`num inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line-strong text-[13px] font-semibold ${showSolution ? "text-green" : ""}`}>
                  {showSolution && typeof task.answer.pairs?.[i] === "number" ? buchstabe(task.answer.pairs[i]) : ""}
                </span>
              </li>
            ))}
          </ol>
          <ul className="space-y-1">
            {task.data.zuordnung.options.map((o, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-semibold text-ink-3">{buchstabe(i)}</span>
                <span>
                  <MathText text={o} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {task.data.steps && (
        <ul className="mt-2 space-y-1">
          {task.data.steps.map((s, i) => (
            <li key={i} className="flex gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-[15px]">
              <span className="num text-ink-3" aria-hidden>
                ☐
              </span>
              <span>
                <MathText text={s} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {task.type === "rechenweg" && task.data.start && (
        <p className="mt-2 text-[18px] font-semibold">
          <MathText text={task.data.start} />
        </p>
      )}
      {task.type === "sachaufgabe" && (
        <ol className="mt-2 max-w-[70ch] space-y-1.5">
          {(task.data.parts ?? []).map((p, i) => {
            const sol = task.answer.parts?.[i];
            return (
              <li key={i} className="flex gap-2">
                <span className="w-6 shrink-0 font-semibold text-ink-2">{partName(p.label, i)}</span>
                <span className="min-w-0">
                  <MathText text={p.prompt} />
                  {showSolution && sol && (
                    <span className="mt-0.5 block text-[13px] text-green">
                      {p.kind === "text" ? (
                        <>Musterantwort: {sol.sample || sol.criteria?.join(" · ") || "–"}</>
                      ) : (
                        <>
                          <MathText text={(sol.accepted ?? []).join(" · ") || "–"} />
                          {sol.follow && <span className="text-ink-3"> · Folgefehler: <MathText text={sol.follow} /></span>}
                          {sol.solution && <span className="text-ink-2"> · <MathText text={sol.solution} /></span>}
                        </>
                      )}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {schreiben && (
        <p className="mt-2 text-[13px] text-ink-2">
          Writing: {TEXTSORTEN[schreiben.textsorte as keyof typeof TEXTSORTEN]?.name ?? schreiben.textsorte}, etwa {schreiben.woerter} Wörter ({wortRahmen(schreiben.woerter).min} bis {wortRahmen(schreiben.woerter).max})
        </p>
      )}
      {task.type === "fix" && task.data.faulty && <p className="ruled mt-2 max-w-[70ch] rounded-lg border border-line bg-paper px-4 py-1 text-[15px] whitespace-pre-line">{task.data.faulty}</p>}
      {(task.type === "rechenweg" || task.type === "sachaufgabe") && !showSolution && <div className="squared mt-3 h-24 max-w-[520px] rounded-md border border-line" aria-hidden />}
      {!task.data.options && !task.data.steps && !task.answer.blanks && !task.data.zuordnung && task.type !== "fix" && task.type !== "rechenweg" && task.type !== "sachaufgabe" && !showSolution && (
        <div className="mt-3 grid max-w-[520px] gap-3" aria-hidden>
          {Array.from(
            {
              length:
                task.type === "free"
                  ? Math.min(4, Math.max(1, task.data.lines ?? 2))
                  : task.type === "memorize"
                    ? Math.min(6, Math.max(2, Math.ceil((task.data.passage?.length ?? 0) / 60)))
                    : 1,
            },
            (_, i) => (
            <div key={i} className={`h-6 border-b border-dashed border-line-strong ${task.type === "free" && task.data.lines !== 1 ? "" : "max-w-[360px]"}`} />
          ))}
        </div>
      )}
      <p className="no-print mt-2 text-[12px] text-ink-3">
        {cat ?? TASK_TYPES[task.type]}
        {cat && cat !== TASK_TYPES[task.type] && ` (${TASK_TYPES[task.type]})`}
        {skillName && ` · ${skillName}`}
        {` · ${task.difficulty}`}
      </p>
      {showSolution && (
        <div className="mt-3 rounded-lg border border-green/30 bg-green-wash px-4 py-3 text-[14px]">
          {answerText(task) && (
            <p>
              <span className="font-semibold">Lösung:</span> <MathText text={answerText(task)} />
            </p>
          )}
          {!task.data.gapOptions && task.answer.blanks?.some((b) => b.filter((x) => x.trim()).length > 1) && (
            <p className="text-[13px] text-ink-2">
              Auch richtig:{" "}
              {task.answer.blanks
                .map((b, i) => (b.length > 1 ? `Lücke ${i + 1}: ${b.slice(1).join(", ")}` : ""))
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {task.type === "fix" && (task.answer.accepted?.length ?? 0) > 1 && <p className="text-[13px] text-ink-2">Auch richtig: {task.answer.accepted!.slice(1).join(" · ")}</p>}
          {task.type === "fix" && task.answer.fixes && task.answer.fixes.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[13px]">
              {task.answer.fixes.map((f, i) => (
                <li key={i}>
                  <span className="fx-wrong">{f.wrong || "(fehlt)"}</span> → <span className="fx-fixed">{f.right || "(weg)"}</span>
                  {f.label && <span className="text-ink-2"> · {f.label}</span>}
                </li>
              ))}
            </ul>
          )}
          {task.answer.sample && !answerText(task) && (
            <p>
              <span className="font-semibold">Musterlösung:</span> <MathText text={task.answer.sample} />
            </p>
          )}
          {aspect && OPEN_ASPECTS.has(aspect) && !severalNoted(task.answer.criteria) && <p className="text-[13px] text-ink-2">Mehrere Antworten sind richtig, wenn sie zum Text passen.</p>}
          {evidence.length > 0 && (
            <div className="mt-1 text-[13px]">
              <span className="font-semibold">Beleg im Text:</span>
              <ul className="text-ink-2">
                {evidence.map((e, i) => (
                  <li key={i}>
                    <span className="num">Abschnitt {e.paragraph}:</span> „{e.quote}“
                  </li>
                ))}
              </ul>
            </div>
          )}
          {task.answer.criteria && task.answer.criteria.length > 0 && (
            <div className="mt-1 text-[13px]">
              <span className="font-semibold">{aspect ? "Erwartungshorizont:" : "Darauf kommt es an:"}</span>
              <ul className="list-disc pl-5 text-ink-2">
                {task.answer.criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {task.type === "rechenweg" && (task.answer.accepted?.length ?? 0) > 1 && <p className="text-[13px] text-ink-2">Auch richtig: {task.answer.accepted!.slice(1).join(" · ")}</p>}
          {task.solution && <p className="mt-1 whitespace-pre-line text-ink-2"><MathText text={task.solution} /></p>}
          {task.hints.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[13px] text-ink-2">
              {task.hints.map((h, i) => (
                <li key={i}>
                  <span className="font-semibold text-ink-3">{hintLabel(i)}:</span> <MathText text={h} />
                </li>
              ))}
            </ul>
          )}
          {task.errorMap.length > 0 && (
            <p className="mt-1 text-[13px] text-ink-3">
              Typische Fehler: {task.errorMap.map((e) => e.label).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskPreview({ task, index, showSolution, skillName, subject, passageShown }: { task: Task; index: number; showSolution: boolean; skillName?: string; subject?: string; passageShown?: boolean }) {
  return (
    <li className="print-break grid grid-cols-[32px_1fr] gap-3 py-5">
      <span className="num pt-0.5 text-[15px] font-semibold text-ink-3">{index}.</span>
      <TaskBody task={task} showSolution={showSolution} skillName={skillName} subject={subject} passageShown={passageShown} />
    </li>
  );
}
