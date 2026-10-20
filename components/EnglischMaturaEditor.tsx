"use client";

import { X } from "lucide-react";
import { englischFormat, ENGLISCH_TEIL, pruefeEnglisch, TEXTSORTEN, wortRahmen, type Textsorte } from "@/lib/englisch-matura-formate";
import { wordCount } from "@/lib/lesen";
import { buchstabe, type TaskDraft } from "@/lib/tasks";

type SetT = (f: (cur: TaskDraft) => TaskDraft) => void;
type Zuordnung = NonNullable<TaskDraft["data"]["zuordnung"]>;

/**
 * Die Felder der Englisch-Matura im Editor (lib/englisch-matura-formate.ts): Lesetext mit Titel, True or False mit
 * Beleg, Multiple Choice je Frage mit A bis D, Multiple Matching mit Antworten, die übrig bleiben, die Wörter im
 * Kasten, die Wortgrenze der Short Answers und beim Writing Textsorte und Wortanzahl. Darunter steht, ob die Aufgabe
 * so in Ordnung ist: dieselbe Prüfung wie beim Speichern und bei Aufgaben der KI.
 * `geteilterText`: der Text gehört dem ganzen Blatt und wird oben bearbeitet.
 */
export function EnglischMaturaFelder({ t, setT, geteilterText }: { t: TaskDraft; setT: SetT; geteilterText: boolean }) {
  const k = englischFormat(t);
  if (!k) return null;
  const z = t.type === "zuordnung" ? t.data.zuordnung : undefined;
  const pairs = t.answer.pairs ?? [];
  const belege = t.answer.belege ?? [];
  const setData = (patch: Partial<TaskDraft["data"]>) => setT((cur) => ({ ...cur, data: { ...cur.data, ...patch } }));
  const setAnswer = (patch: Partial<TaskDraft["answer"]>) => setT((cur) => ({ ...cur, answer: { ...cur.answer, ...patch } }));
  const setZ = (patch: Partial<Zuordnung>) => setT((cur) => ({ ...cur, data: { ...cur.data, zuordnung: { statements: [], options: [], ...cur.data.zuordnung, ...patch } } }));
  const setPair = (i: number, v: number) => setAnswer({ pairs: (z?.statements ?? []).map((_, j) => (j === i ? v : (pairs[j] ?? 0))) });
  // eine Aussage oder Frage weg: ihre Lösung, ihr Beleg und ihre Antworten gehen mit
  const weg = (i: number) =>
    setT((cur) => {
      const c = cur.data.zuordnung!;
      return {
        ...cur,
        data: { ...cur.data, zuordnung: { ...c, statements: c.statements.filter((_, j) => j !== i), ...(c.choices ? { choices: c.choices.filter((_, j) => j !== i) } : {}) } },
        answer: { ...cur.answer, pairs: (cur.answer.pairs ?? []).filter((_, j) => j !== i), ...(cur.answer.belege ? { belege: cur.answer.belege.filter((_, j) => j !== i) } : {}) },
      };
    });
  const dazu = () =>
    setT((cur) => {
      const c = cur.data.zuordnung!;
      return {
        ...cur,
        data: { ...cur.data, zuordnung: { ...c, statements: [...c.statements, ""], ...(c.choices ? { choices: [...c.choices, ["", "", "", ""]] } : {}) } },
        answer: { ...cur.answer, pairs: [...(cur.answer.pairs ?? []), 0], ...(cur.answer.belege ? { belege: [...cur.answer.belege, ""] } : {}) },
      };
    });
  const problem = pruefeEnglisch(t);
  const s = t.data.schreibauftrag;
  return (
    <div className="grid gap-4">
      {ENGLISCH_TEIL[k] === "reading" && !geteilterText && (
        <div className="grid gap-2">
          <label className="field">
            <span className="label">Titel des Lesetexts</span>
            <input className="input" value={t.data.passageTitle ?? ""} onChange={(e) => setData({ passageTitle: e.target.value })} lang="en" />
          </label>
          <label className="field">
            <span className="label">Lesetext (Absätze mit einer Leerzeile trennen)</span>
            <textarea className="input min-h-[180px]" value={t.data.passage ?? ""} onChange={(e) => setData({ passage: e.target.value })} lang="en" />
            <span className="num text-[12px] text-ink-3">{wordCount(t.data.passage ?? "")} Wörter</span>
          </label>
        </div>
      )}

      {z?.art === "richtig-falsch" && (
        <div className="grid gap-2">
          <span className="label">Aussagen, True oder False und der Beleg: der ganze Satz aus dem Text, Wort für Wort</span>
          {z.statements.map((st, i) => (
            <div key={i} className="grid gap-1.5 rounded-lg border border-line p-2">
              <div className="flex items-center gap-2">
                <span className="num w-6 shrink-0 text-[13px] text-ink-3">{i + 1}</span>
                <input className="input" value={st} onChange={(e) => setZ({ statements: z.statements.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Aussage ${i + 1}`} lang="en" />
                <select className="input w-24 shrink-0" value={pairs[i] ?? 0} onChange={(e) => setPair(i, Number(e.target.value))} aria-label={`Aussage ${i + 1}: True oder False`}>
                  {z.options.map((o, j) => (
                    <option key={o} value={j}>
                      {o}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" disabled={z.statements.length <= 3} onClick={() => weg(i)} aria-label={`Aussage ${i + 1} entfernen`}>
                  <X size={14} aria-hidden />
                </button>
              </div>
              <input
                className="input text-[14px]"
                value={belege[i] ?? ""}
                placeholder="Beleg: der Satz aus dem Text"
                onChange={(e) => setAnswer({ belege: z.statements.map((_, j) => (j === i ? e.target.value : (belege[j] ?? ""))) })}
                aria-label={`Beleg zu Aussage ${i + 1}`}
                lang="en"
              />
            </div>
          ))}
          <button type="button" className="justify-self-start text-[13px] font-semibold text-accent hover:underline" onClick={dazu}>
            + Aussage
          </button>
          <span className="text-[12px] text-ink-3">Der Schüler schreibt die ersten vier Wörter des Belegs ab. Passt der Anfang, zählt die Begründung; sonst entscheidest du.</span>
        </div>
      )}

      {z?.art === "fragen" && (
        <div className="grid gap-2">
          <span className="label">Fragen mit je vier Antworten, die richtige markieren</span>
          {z.statements.map((st, i) => (
            <div key={i} className="grid gap-1.5 rounded-lg border border-line p-2">
              <div className="flex items-center gap-2">
                <span className="num w-6 shrink-0 text-[13px] text-ink-3">{i + 1}</span>
                <input className="input" value={st} onChange={(e) => setZ({ statements: z.statements.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Frage ${i + 1}`} lang="en" />
                <button type="button" className="btn btn-ghost btn-sm" disabled={z.statements.length <= 3} onClick={() => weg(i)} aria-label={`Frage ${i + 1} entfernen`}>
                  <X size={14} aria-hidden />
                </button>
              </div>
              {(z.choices?.[i] ?? ["", "", "", ""]).map((c, j) => (
                <div key={j} className="flex items-center gap-2 pl-8">
                  <input type="radio" name={`frage-${i}`} checked={(pairs[i] ?? 0) === j} onChange={() => setPair(i, j)} className="h-4 w-4 accent-[var(--green)]" aria-label={`Frage ${i + 1}, Antwort ${buchstabe(j)} ist richtig`} />
                  <span className="w-4 shrink-0 text-[13px] font-semibold text-ink-3">{buchstabe(j)}</span>
                  <input
                    className="input text-[14px]"
                    value={c}
                    onChange={(e) =>
                      setZ({ choices: z.statements.map((_, m) => (m === i ? (z.choices?.[m] ?? ["", "", "", ""]).map((x, n) => (n === j ? e.target.value : x)) : (z.choices?.[m] ?? ["", "", "", ""]))) })
                    }
                    aria-label={`Frage ${i + 1}, Antwort ${buchstabe(j)}`}
                    lang="en"
                  />
                </div>
              ))}
            </div>
          ))}
          <button type="button" className="justify-self-start text-[13px] font-semibold text-accent hover:underline" onClick={dazu}>
            + Frage
          </button>
        </div>
      )}

      {z && (z.art === "ueberschriften" || z.art === "satzenden") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <label className="field">
              <span className="label">Art</span>
              <select className="input" value={z.art} onChange={(e) => setZ({ art: e.target.value === "satzenden" ? "satzenden" : "ueberschriften" })}>
                <option value="ueberschriften">Überschriften zu Absätzen</option>
                <option value="satzenden">Satzanfänge und Satzenden</option>
              </select>
            </label>
            <span className="label">{z.art === "ueberschriften" ? "Absätze und ihr richtiger Buchstabe" : "Satzanfänge und ihr richtiger Buchstabe"}</span>
            {z.statements.map((st, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="num w-6 shrink-0 text-[13px] text-ink-3">{i + 1}</span>
                <input className="input" value={st} onChange={(e) => setZ({ statements: z.statements.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Zeile ${i + 1}`} lang="en" />
                <select className="input w-20 shrink-0" value={pairs[i] ?? 0} onChange={(e) => setPair(i, Number(e.target.value))} aria-label={`Richtiger Buchstabe für Zeile ${i + 1}`}>
                  {z.options.map((_, j) => (
                    <option key={j} value={j}>
                      {buchstabe(j)}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost btn-sm" disabled={z.statements.length <= 3} onClick={() => weg(i)} aria-label={`Zeile ${i + 1} entfernen`}>
                  <X size={14} aria-hidden />
                </button>
              </div>
            ))}
            <button type="button" className="justify-self-start text-[13px] font-semibold text-accent hover:underline" onClick={dazu}>
              + Zeile
            </button>
          </div>
          <div className="grid content-start gap-1.5">
            <span className="label">Antworten A bis {buchstabe(Math.max(0, z.options.length - 1))} (mindestens eine bleibt übrig)</span>
            {z.options.map((o, j) => (
              <div key={j} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-[13px] font-semibold text-ink-3">{buchstabe(j)}</span>
                <input className="input" value={o} onChange={(e) => setZ({ options: z.options.map((x, n) => (n === j ? e.target.value : x)) })} aria-label={`Antwort ${buchstabe(j)}`} lang="en" />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={z.options.length <= z.statements.length + 1}
                  onClick={() =>
                    setT((cur) => ({
                      ...cur,
                      data: { ...cur.data, zuordnung: { ...z, options: z.options.filter((_, n) => n !== j) } },
                      // die Buchstaben danach rücken nach
                      answer: { ...cur.answer, pairs: (cur.answer.pairs ?? []).map((p) => (p > j ? p - 1 : p === j ? 0 : p)) },
                    }))
                  }
                  aria-label={`Antwort ${buchstabe(j)} entfernen`}
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            ))}
            {z.options.length < 26 && (
              <button type="button" className="justify-self-start text-[13px] font-semibold text-accent hover:underline" onClick={() => setZ({ options: [...z.options, ""] })}>
                + Antwort
              </button>
            )}
          </div>
        </div>
      )}

      {k === "matura-banked-gap" && (
        <label className="field">
          <span className="label">Wörter im Kasten (mit Komma trennen, mindestens zwei bleiben übrig)</span>
          <input
            className="input"
            value={(t.data.wortliste ?? []).join(", ")}
            onChange={(e) => setData({ wortliste: e.target.value.split(",").map((x) => x.trim()) })}
            lang="en"
          />
        </label>
      )}

      {k === "matura-short-answers" && (
        <label className="field max-w-[260px]">
          <span className="label">Höchstens so viele Wörter je Antwort</span>
          <input className="input" type="number" min={1} max={6} value={t.answer.maxWords ?? 4} onChange={(e) => setAnswer({ maxWords: Number(e.target.value) || 4 })} />
        </label>
      )}

      {k === "matura-editing" && <p className="text-[12px] text-ink-3">Jede Zeile endet mit einer Lücke. Lösung: das überflüssige Wort der Zeile, bei einer richtigen Zeile ✓.</p>}
      {k === "matura-word-formation" && <p className="text-[12px] text-ink-3">Nach jeder Lücke steht das Grundwort in Großbuchstaben, z. B. ___ (DECIDE).</p>}

      {k === "matura-writing" && s && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span className="label">Textsorte</span>
            <select className="input" value={s.textsorte} onChange={(e) => setData({ schreibauftrag: { ...s, textsorte: e.target.value as Textsorte } })}>
              {Object.entries(TEXTSORTEN).map(([key, v]) => (
                <option key={key} value={key}>
                  {key === "email-formal" ? "email (formell)" : key === "email-informal" ? "email (informell)" : v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Wortanzahl (etwa)</span>
            <input className="input" type="number" min={100} max={500} step={10} value={s.woerter} onChange={(e) => setData({ schreibauftrag: { ...s, woerter: Number(e.target.value) || 250 } })} />
            <span className="num text-[12px] text-ink-3">
              Erlaubt: {wortRahmen(s.woerter).min} bis {wortRahmen(s.woerter).max} Wörter. Der Auftrag hat genau drei Punkte, jeder in einer Zeile mit •.
            </span>
          </label>
        </div>
      )}

      <p role="status" className={`rounded-lg px-3 py-2 text-[13px] ${problem ? "bg-amber-wash text-amber" : "bg-green-wash text-green"}`}>
        {problem ?? (k === "matura-writing" ? "Der Schreibauftrag passt. Du bewertest den Text nach den vier Kriterien." : "Die Aufgabe passt zum Format. Was die App nicht sicher prüfen kann, bewertest du.")}
      </p>
    </div>
  );
}
