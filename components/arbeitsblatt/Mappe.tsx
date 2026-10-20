import { Fragment } from "react";
import { BrandLogo } from "@/components/Brand";
import { DEFAULTS, buildSheet, shortAnswer, type SheetOptions, type SheetTask } from "@/lib/arbeitsblatt";
import { inDieLuecke, lueckenFuerMappe, type Antwort, type Bewertung, type Mappe, type MappeAufgabe, type MappeUebung } from "@/lib/mappe";
import type { MappeOptionen } from "@/lib/mappe-druck";
import * as repo from "@/lib/repo";
import { wordsLabel } from "@/lib/texts";
import { MathLine, RichText } from "./MathLine";
import { lueckenNamen, MaturaAntworten, MitBild, ReadingPassage, Start, StudentTask, TaskPassage } from "./Sheet";
import { maturaFormat, maturaKreuze } from "@/lib/matura-formate";
import { englischFormat } from "@/lib/englisch-matura-formate";
import { belegPasst } from "@/lib/englisch-matura-pruefen";
import { EnglischAntworten, MitWortKasten } from "./EnglischMatura";
import { Pictures, TextBody } from "./TextPrint";

const letter = (i: number) => String.fromCharCode(97 + i);
const longDate = (iso: string) => new Date(iso).toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Vienna" });

/** Platz und Felder wie auf dem Arbeitsblatt, für Aufgaben zum Weiterüben. */
const BLATT: SheetOptions = { ...DEFAULTS, title: "" };

/** Das Zeichen am Rand, wie mit dem Rotstift: Häkchen, Kreuz, halb richtig; ohne Zeichen, was noch offen ist. */
const ZEICHEN: Record<Bewertung, { zeichen: string; label: string } | null> = {
  richtig: { zeichen: "✓", label: "richtig" },
  teilweise: { zeichen: "(✓)", label: "teilweise richtig" },
  falsch: { zeichen: "✗", label: "falsch" },
  loesung: { zeichen: "–", label: "Lösung angesehen" },
  offen: null,
  nicht: null,
};

/** Kleine Zeile unter der Antwort: wie die Aufgabe ausgegangen ist, wenn das Zeichen allein es nicht sagt. */
function Hinweis({ a }: { a: MappeAufgabe }) {
  const text =
    a.bewertung === "loesung" ? "Lösung angesehen" : a.bewertung === "offen" ? "noch nicht bewertet" : a.bewertung === "richtig" && a.versuch > 1 ? `im ${a.versuch}. Versuch` : null;
  return text ? <p className="mp-hinweis">{text}</p> : null;
}

/** Geschriebener Text mit seinen Zeilenumbrüchen, Brüche gesetzt wie in der Aufgabe. */
function Zeilen({ text }: { text: string }) {
  const zeilen = text.trim().split("\n");
  if (!zeilen.join("").trim()) return "–";
  return zeilen.map((z, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      <MathLine text={z} />
    </Fragment>
  ));
}

/** Die Antwort des Schülers, so wie sie auf Papier stünde. */
function AntwortBlock({ t, a, zeigeLoesung }: { t: SheetTask; a: Antwort; zeigeLoesung: boolean }) {
  const { task } = t;
  switch (a.art) {
    case "wahl":
      return (
        <ol className={t.plan.optionColumns === 2 ? "ab-options ab-options-2" : "ab-options"}>
          {task.data.options!.map((x, i) => {
            const gewaehlt = a.index === i;
            const richtig = zeigeLoesung && task.answer.correct === i && !gewaehlt;
            return (
              <li key={i} className={gewaehlt ? "mp-gewaehlt" : undefined}>
                <span className="ab-box" aria-label={gewaehlt ? "angekreuzt" : undefined}>
                  {gewaehlt ? "✕" : ""}
                </span>
                <span className="ab-option-letter">{letter(i)})</span>
                <span>
                  <MathLine text={x} />
                  {richtig && <span className="mp-richtig-markiert"> ← richtig</span>}
                </span>
              </li>
            );
          })}
        </ol>
      );
    case "reihe":
      return (
        <ol className="mp-reihe">
          {a.schritte.map((s, i) => (
            <li key={i}>
              <span className="mp-reihe-nr">{i + 1}.</span>
              <MathLine text={s} />
            </li>
          ))}
        </ol>
      );
    case "luecken":
      // die Werte stehen schon in den Lücken der Aufgabe
      return null;
    case "kreuze":
    case "englisch":
      // Matura-Formate: die Kreuze und Buchstaben stehen in den Tabellen der Aufgabe (MappeTask)
      return null;
    case "rechnung":
      return (
        <div className="mp-rechnung">
          {a.schritte.map((s, i) => (
            <p key={i} className="mp-rechenzeile">
              <MathLine text={s} />
            </p>
          ))}
          {a.tafel && !a.schritte.length && <p className="mp-hinweis">Rechenweg am Whiteboard</p>}
          <p className="mp-ergebnis">
            <span className="mp-label">{t.plan.answerLabel ?? "Ergebnis:"}</span> {a.ergebnis ? <MathLine text={a.ergebnis} /> : <span className="ab-muted">–</span>}
          </p>
        </div>
      );
    case "teile":
      return (
        <ol className="ab-parts">
          {(task.data.parts ?? []).map((p, i) => {
            const teil = a.teile[i];
            return (
              <li key={i} className="ab-part">
                <span className="ab-part-label">{p.label || `${letter(i)})`}</span>
                <div className="ab-body">
                  <RichText text={p.prompt} />
                  {teil?.schritte.map((s, j) => (
                    <p key={j} className="mp-rechenzeile">
                      <MathLine text={s} />
                    </p>
                  ))}
                  {p.kind === "text" ? (
                    <p className="mp-antwort">
                      <Zeilen text={teil?.text ?? ""} />
                    </p>
                  ) : (
                    <p className="mp-ergebnis">
                      <span className="mp-label">Antwort:</span> {teil?.ergebnis ? <MathLine text={teil.ergebnis} /> : "–"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      );
    case "text":
      if (inDieLuecke(task, a)) return null;
      return (
        <p className="mp-antwort">
          <Zeilen text={a.text} />
        </p>
      );
  }
}

/** Eine bearbeitete Aufgabe: Aufgabe, Antwort des Schülers, Zeichen am Rand und bei Fehlern die richtige Lösung. */
function MappeTask({ t, a, o }: { t: SheetTask; a: MappeAufgabe; o: MappeOptionen }) {
  const { task } = t;
  const matura = maturaFormat(task);
  const en = englischFormat(task);
  const enTabelle = Boolean(en && task.type === "zuordnung");
  // wer bei einer Auswahl gleich die Lösung angesehen hat, sieht trotzdem die Möglichkeiten
  const antwort: Antwort | null =
    a.antwort ?? (matura ? { art: "kreuze", kreuze: [] } : enTabelle ? { art: "englisch", wahl: [], belege: [] } : task.data.options ? { art: "wahl", index: null } : null);
  const fehler = a.bewertung === "falsch" || a.bewertung === "teilweise" || a.bewertung === "loesung";
  // ohne Häkchen und Kreuze ein sauberes Blatt nur mit den Antworten: dann auch ohne Lösungen und Hinweise
  const zeigeLoesung = o.marks && o.solutions && fehler;
  const loesung = zeigeLoesung ? (shortAnswer(task) ?? task.answer.sample ?? null) : null;
  // falsche Lücken einzeln markiert; steht die richtige Antwort schon in der Lücke, entfällt die Zeile „Richtig:“
  // Short Answers: was die App nicht sicher prüfen kann, entscheidet die Lehrkraft; dort wird keine Lücke als falsch markiert
  const luecken = matura ? undefined : lueckenFuerMappe(task, antwort, { markieren: Boolean(o.marks && fehler) && en !== "matura-short-answers", loesung: zeigeLoesung });
  // Englisch-Matura: die richtige Wahl neben einer falschen, bei True or False die ersten Wörter des Belegs, wenn er nicht passt
  const enRichtig =
    zeigeLoesung && antwort?.art === "englisch"
      ? {
          wahl: task.answer.pairs ?? [],
          belege: (task.answer.belege ?? []).map((b, i) => (belegPasst(antwort.belege[i] ?? "", b, task.data.passage ?? "") === "ja" ? "" : b)),
        }
      : null;
  const loesungInLuecke = Boolean(luecken?.some((l) => l.richtig));
  const zeichen = o.marks ? ZEICHEN[a.bewertung] : null;
  return (
    <div className="ab-task mp-task" data-bewertung={a.bewertung}>
      <span className="ab-num">{t.n}</span>
      <div className="ab-body">
        {/* Aufgabe mit Bild: das Bild wie am Blatt; mit Lösung (bei Fehlern) zeigt es die gesuchten Werte */}
        <MitBild
          task={task}
          loesung={zeigeLoesung}
          rest={(prompt) => (
            <MitWortKasten
              task={task}
              prompt={prompt}
              rest={(text) => <RichText text={text} gapsMm={t.plan.gapsMm} gapLabels={lueckenNamen(task)} gapAnswers={luecken?.map((l) => ({ text: l.text, wrong: l.falsch, correct: l.richtig }))} />}
            />
          )}
        />
        <Start task={task} />
        {task.type === "fix" && task.data.faulty && <p className="ab-faulty">{task.data.faulty}</p>}
        {/* Matura-Formate: die Kreuze des Schülers wie auf dem Maturablatt, bei Fehlern die richtigen daneben */}
        {matura && <MaturaAntworten task={task} kreuze={antwort?.art === "kreuze" ? antwort.kreuze : []} richtig={zeigeLoesung ? maturaKreuze(task) : null} />}
        {enTabelle && <EnglischAntworten task={task} wahl={antwort?.art === "englisch" ? antwort.wahl : []} belege={antwort?.art === "englisch" ? antwort.belege : []} richtig={enRichtig} />}
        {antwort ? (
          <AntwortBlock t={t} a={antwort} zeigeLoesung={zeigeLoesung} />
        ) : (
          <p className="mp-antwort ab-muted">keine Antwort</p>
        )}
        {o.marks && <Hinweis a={a} />}
        {loesung && !loesungInLuecke && task.data.options === undefined && !matura && !enTabelle && (
          <p className="mp-loesung">
            <span className="mp-label">Richtig:</span> <MathLine text={loesung} />
          </p>
        )}
      </div>
      {zeichen && (
        <span className={`mp-zeichen mp-zeichen-${a.bewertung}`} title={zeichen.label} aria-label={zeichen.label}>
          {zeichen.zeichen}
        </span>
      )}
    </div>
  );
}

function aufzaehlen(nummern: number[]) {
  return nummern.length === 1 ? `Aufgabe ${nummern[0]}` : `Aufgaben ${nummern.slice(0, -1).join(", ")} und ${nummern[nummern.length - 1]}`;
}

/** Eine Übung der Einheit: Überschrift, Lesetext, die Aufgaben mit Antworten; nicht bearbeitete nur auf Wunsch. */
function UebungAbschnitt({ u, o, leer }: { u: MappeUebung; o: MappeOptionen; leer?: boolean }) {
  const doc = buildSheet(
    { title: u.titel, subject: u.worksheet.subject, klasseLabel: u.klasse, topic: u.worksheet.topic, studentName: null, tasks: u.aufgaben.map((a) => a.task) },
    (sid) => repo.getSkill(sid)?.name ?? null,
    BLATT,
  );
  const ausgelassen = u.aufgaben.flatMap((a, i) => (a.bewertung === "nicht" && !o.open ? [i + 1] : []));
  const zuZeigen = doc.tasks.filter((_, i) => o.open || u.aufgaben[i].bewertung !== "nicht");
  const meta = [u.worksheet.subject, u.worksheet.topic && u.worksheet.topic !== u.titel ? u.worksheet.topic : ""].filter(Boolean);
  return (
    <section className="mp-abschnitt" data-testid="mappe-uebung">
      <h2 className="mp-h2">
        {leer && <span className="mp-h2-vor">Zum Weiterüben: </span>}
        <MathLine text={u.titel} />
        {!leer && o.marks && u.bearbeitet > 0 && (
          <span className="mp-h2-zahl">
            {u.richtig} von {u.bearbeitet} richtig
          </span>
        )}
      </h2>
      {meta.length > 0 && <p className="ab-meta mp-meta">{meta.join(" · ")}</p>}
      {doc.reading && zuZeigen.length > 0 && <ReadingPassage title={doc.reading.title} text={doc.reading.text} teacher={false} zeilen={doc.reading.zeilen} leerzeilen={doc.reading.leerzeilen} />}
      <div className="ab-tasks">
        {doc.tasks.map((t, i) => {
          const a = u.aufgaben[i];
          if (a.bewertung === "nicht" && !o.open) return null;
          return (
            <Fragment key={t.n}>
              <TaskPassage t={t} teacher={false} />
              {a.bewertung === "nicht" ? <StudentTask t={t} o={BLATT} /> : <MappeTask t={t} a={a} o={o} />}
            </Fragment>
          );
        })}
      </div>
      {ausgelassen.length > 0 && (
        <p className="mp-ausgelassen">
          Nicht bearbeitet: {aufzaehlen(ausgelassen)}.
        </p>
      )}
    </section>
  );
}

/** Die ganze Mappe als ein A4-Dokument: Kopf, Übungen, Textarbeiten, Whiteboard. */
export function MappeDokument({ m, o }: { m: Mappe; o: MappeOptionen }) {
  const bearbeitet = m.uebungen.reduce((s, u) => s + u.bearbeitet, 0);
  const texte = o.texts ? m.texte : [];
  const tafel = o.board ? m.tafel : [];
  const leer = o.open ? m.unbearbeitet : [];
  const ueberblick = [
    m.uebungen.length > 0 && `${m.uebungen.length} ${m.uebungen.length === 1 ? "Übung" : "Übungen"}, ${bearbeitet} ${bearbeitet === 1 ? "Aufgabe" : "Aufgaben"}`,
    texte.length > 0 && `${texte.length} ${texte.length === 1 ? "Text" : "Texte"}`,
  ].filter(Boolean) as string[];
  return (
    <article className="ab-sheet mp" lang="de" data-testid="mappe">
      <header className="ab-head">
        <div className="ab-head-main">
          <h1 className="ab-title">{o.title}</h1>
          <p className="ab-meta">{[m.faecher.join(", "), m.klasse].filter(Boolean).join(" · ")}</p>
          {ueberblick.length > 0 && <p className="ab-meta">{ueberblick.join(" · ")}</p>}
        </div>
        {(o.logo || o.name || o.date) && (
          <div className="mp-kopf-rechts">
            {o.logo && <BrandLogo width={70} className="mp-logo" />}
            {(o.name || o.date) && (
              <div className="ab-fields">
                {o.name && (
                  <p className="ab-field">
                    <span>Name:</span>
                    <span className="ab-field-line">{m.student.name}</span>
                  </p>
                )}
                {o.date && (
                  <p className="ab-field">
                    <span>Datum:</span>
                    <span className="ab-field-line">{longDate(m.unit.started_at)}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </header>
      {m.uebungen.map((u) => (
        <UebungAbschnitt key={u.assignmentId} u={u} o={o} />
      ))}
      {leer.map((u) => (
        <UebungAbschnitt key={u.assignmentId} u={u} o={o} leer />
      ))}
      {texte.map(({ text, doc, story, bilder }) => (
        <section key={text.id} className="mp-abschnitt tx-print" data-testid="mappe-text">
          <h2 className="mp-h2">{text.title}</h2>
          <p className="ab-meta mp-meta">{[text.subject, text.topic && text.topic !== text.title ? text.topic : "", wordsLabel(text.words)].filter(Boolean).join(" · ")}</p>
          {text.prompt && (
            <div className="tx-print-task">
              <p className="tx-print-task-label">Aufgabe</p>
              <p className="ab-pre">{text.prompt}</p>
            </div>
          )}
          {bilder.length > 0 && <Pictures images={bilder} />}
          <TextBody doc={doc} />
          {story?.source_note && <p className="bg-source">Bilder: {story.source_note}</p>}
        </section>
      ))}
      {tafel.length > 0 && (
        <section className="mp-abschnitt" data-testid="mappe-tafel">
          <h2 className="mp-h2">Whiteboard</h2>
          <div className="mp-tafel">
            {tafel.map((p) => (
              <figure key={p.id} className="mp-tafel-seite">
                {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG, served by our own route */}
                <img src={`/tafel/${m.unit.id}/vorschau/${p.id}?v=${encodeURIComponent(p.updated_at)}`} alt={`Whiteboard: ${p.title}`} />
                {tafel.length > 1 && <figcaption>{p.title}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
