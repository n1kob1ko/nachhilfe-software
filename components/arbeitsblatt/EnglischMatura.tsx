import type { ReactNode } from "react";
import { englischFormat, ersteWoerter } from "@/lib/englisch-matura-formate";
import { buchstabe, type TaskDraft } from "@/lib/tasks";
import { RichText } from "./MathLine";

/**
 * Englisch-Matura (lib/englisch-matura-formate.ts) am A4-Blatt: True or False als Tabelle mit den Kästchen True
 * und False und einer Zeile für die ersten Wörter des Belegs, Multiple Choice zum Text je Frage mit A bis D und
 * dem Kästchen rechts, Multiple Matching mit einem Kästchen für den Buchstaben und den Antworten daneben.
 * `wahl` und `belege`: was eingetragen ist (Lehrerfassung: die Lösung, Mappe: die Antwort des Schülers).
 * `richtig` (Mappe mit Lösung): bei einer falschen Wahl steht die richtige daneben.
 */
export function EnglischAntworten({
  task,
  wahl = [],
  belege = [],
  richtig = null,
}: {
  task: TaskDraft;
  wahl?: (number | null)[];
  belege?: string[];
  richtig?: { wahl: number[]; belege: string[] } | null;
}) {
  const z = task.data.zuordnung;
  const k = englischFormat(task);
  if (!z || task.type !== "zuordnung" || !k) return null;
  const kaestchen = (an: boolean) => (
    <span className="ab-box" aria-label={an ? "angekreuzt" : undefined}>
      {an ? "✕" : ""}
    </span>
  );
  if (z.art === "richtig-falsch")
    return (
      <table className="ab-matura ab-englisch-tf" lang="en">
        <thead>
          <tr>
            <th scope="col" aria-label="Nummer" />
            <th scope="col">Statement</th>
            {z.options.map((o) => (
              <th key={o} scope="col" className="ab-englisch-tf-wahl">
                {o}
              </th>
            ))}
            <th scope="col">First four words</th>
          </tr>
        </thead>
        <tbody>
          {z.statements.map((st, i) => {
            const soll = richtig?.wahl[i] ?? null;
            return (
              <tr key={i}>
                <td className="num">{i + 1}</td>
                <td>
                  {st}
                  {soll !== null && soll !== (wahl[i] ?? null) && <span className="mp-richtig-markiert"> ← richtig: {z.options[soll]}</span>}
                </td>
                {z.options.map((o, j) => (
                  <td key={o} className="ab-matura-box">
                    {kaestchen(wahl[i] === j)}
                  </td>
                ))}
                <td className="ab-englisch-beleg">
                  {belege[i]?.trim() ?? ""}
                  {richtig && richtig.belege[i] && soll !== null && <span className="mp-richtig-markiert"> {ersteWoerter(richtig.belege[i])} …</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  if (z.art === "fragen")
    return (
      <ol className="ab-englisch-fragen" lang="en">
        {z.statements.map((st, i) => {
          const soll = richtig?.wahl[i] ?? null;
          return (
            <li key={i}>
              <p className="ab-englisch-frage">
                <span className="num">{i + 1}</span> {st}
              </p>
              <table className="ab-matura ab-matura-wahl">
                <tbody>
                  {(z.choices?.[i] ?? []).map((x, j) => {
                    const an = wahl[i] === j;
                    return (
                      <tr key={j} className={an ? "ab-matura-an" : undefined}>
                        <th scope="row">{buchstabe(j)}</th>
                        <td>
                          {x}
                          {soll === j && !an && <span className="mp-richtig-markiert"> ← richtig</span>}
                        </td>
                        <td className="ab-matura-box">{kaestchen(an)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </li>
          );
        })}
      </ol>
    );
  // Multiple Matching: Absätze oder Satzanfänge mit dem Kästchen, daneben die Antworten
  return (
    <div className="ab-matura-paar" lang="en">
      <table className="ab-matura">
        <tbody>
          {z.statements.map((st, i) => {
            const w = wahl[i] ?? null;
            const soll = richtig?.wahl[i] ?? null;
            return (
              <tr key={i}>
                <td>
                  <span className="num">{i + 1}</span> {st}
                  {soll !== null && soll !== w && <span className="mp-richtig-markiert"> ← richtig: {buchstabe(soll)}</span>}
                </td>
                <td className="ab-matura-box">
                  <span className="ab-matura-buchstabe" aria-label={w === null ? "Buchstabe eintragen" : undefined}>
                    {w === null ? "" : buchstabe(w)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <table className="ab-matura">
        <tbody>
          {z.options.map((o, j) => (
            <tr key={j}>
              <th scope="row">{buchstabe(j)}</th>
              <td>{o}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Die Lösung zum Eintragen (Lehrerfassung): je Aussage die Wahl, bei True or False auch die ersten Wörter des Belegs. */
export function englischEintrag(task: TaskDraft): { wahl: number[]; belege: string[] } {
  return { wahl: task.answer.pairs ?? [], belege: (task.answer.belege ?? []).map((b) => `${ersteWoerter(b)} …`) };
}

/**
 * Banked Gap Fill: der Arbeitsauftrag, dann der Kasten mit den Wörtern, dann der Text mit den Lücken (`rest`).
 * Ohne Wörter im Kasten nur `rest` mit dem ganzen Text.
 */
export function MitWortKasten({ task, prompt, rest }: { task: TaskDraft; prompt: string; rest: (text: string) => ReactNode }) {
  const woerter = task.data.wortliste;
  const teile = prompt.split("\n\n");
  if (!woerter?.length || teile.length < 2) return <>{rest(prompt)}</>;
  return (
    <>
      <RichText text={teile[0]} />
      <p className="ab-wortkasten" lang="en">
        {woerter.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </p>
      {rest(teile.slice(1).join("\n\n"))}
    </>
  );
}
