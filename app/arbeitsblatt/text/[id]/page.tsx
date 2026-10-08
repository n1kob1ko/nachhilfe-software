import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageStyle } from "@/components/arbeitsblatt/Sheet";
import { TextPrintSettings } from "@/components/text/TextPrintSettings";
import { requireTeacher } from "@/lib/auth";
import { recommendationOf, applyAccepted, countLabel, getCorrection, listItems, overview, segmentsOf, snapshotDoc, type CorrectionItem } from "@/lib/text-correction";
import { categoryInfo } from "@/lib/text-correction-rules";
import { blockText, type Block, type Run } from "@/lib/text-doc";
import { readTextPrintOptions } from "@/lib/text-print";
import { getText, textDoc, wordsLabel } from "@/lib/texts";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const text = getText(Number((await params).id));
  // the title becomes the file name when the text is saved as PDF
  return { title: { absolute: text ? readTextPrintOptions(await searchParams, text.title).title : "Text" } };
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Vienna" });

/** Runs with bold/italic/underline and line breaks, never HTML from the text. */
function RunList({ runs }: { runs: Run[] }) {
  return runs.map((r, i) => {
    const parts = r.x.split("\n");
    let el: React.ReactNode = parts.map((x, j) => (
      <span key={j}>
        {j > 0 && <br />}
        {x}
      </span>
    ));
    if (r.u) el = <u>{el}</u>;
    if (r.i) el = <i>{el}</i>;
    if (r.b) el = <b>{el}</b>;
    return <span key={i}>{el}</span>;
  });
}

/** One block; with `marks`, the accepted corrections: struck through, the improvement next to it, the number of the place. */
function Runs({ block, marks }: { block: Block; marks?: { item: CorrectionItem; n: number }[] }) {
  if (!marks?.length) return <RunList runs={block.r} />;
  return segmentsOf(block, marks.map((m) => m.item)).map((s) => {
    if (s.itemId === null) return <RunList key={s.start} runs={s.runs} />;
    const m = marks.find((x) => x.item.id === s.itemId)!;
    return (
      <span key={s.start}>
        <span className="tx-k-del">
          <RunList runs={s.runs} />
        </span>
        {m.item.replacement && <span className="tx-k-ins">{m.item.replacement}</span>}
        <span className="tx-k-num">{m.n}</span>
      </span>
    );
  });
}

const VERSION_LABEL = { original: "", endfassung: "Korrigierte Fassung", korrektur: "Mit Korrekturen" } as const;

/** A Textarbeit as an A4 document for the Schulmappe: the worksheet's page setup, clean paragraphs, no cut-off lines. */
export default async function TextPrintPage({ params, searchParams }: Params) {
  await requireTeacher();
  const text = getText(Number((await params).id));
  if (!text) notFound();
  const o = readTextPrintOptions(await searchParams, text.title);
  // a correction of this text: its snapshot is the original; without one the current text, as before
  const c = o.correction ? getCorrection(o.correction) : null;
  const correction = c && c.text_id === text.id ? c : null;
  const items = correction ? listItems(correction.id) : [];
  const accepted = items.filter((i) => i.status === "uebernommen");
  const fassung = correction ? o.fassung : "original";
  const snapshot = correction ? snapshotDoc(correction) : textDoc(text);
  const doc = fassung === "endfassung" ? applyAccepted(snapshot, accepted).doc : snapshot;
  // numbered in reading order: places in the text first, then notes on the whole text
  const placed = accepted.filter((i) => i.block !== null && i.pos_start !== null).sort((a, b) => a.block! - b.block! || a.pos_start! - b.pos_start!);
  const numbered = placed.map((item, i) => ({ item, n: i + 1 }));
  const notes = accepted.filter((i) => i.pos_start === null);
  const ov = correction ? overview(items) : null;
  const rec = correction && ov ? recommendationOf(correction, ov) : null;
  const meta = o.subject ? [text.subject, text.topic && text.topic !== text.title ? text.topic : ""].filter(Boolean) : [];
  if (VERSION_LABEL[fassung]) meta.push(VERSION_LABEL[fassung]);
  if (o.words) meta.push(wordsLabel(correction ? correction.words : text.words));
  return (
    <div className="ab-screen">
      <PageStyle o={o} />
      <TextPrintSettings
        options={o}
        defaultTitle={text.title}
        path={`/arbeitsblatt/text/${text.id}`}
        back={correction ? { href: `/texte/${text.id}/korrektur?k=${correction.id}`, label: "Zur Korrektur" } : { href: `/texte/${text.id}`, label: "Zum Text" }}
        words={correction ? correction.words : text.words}
        withCorrection={Boolean(correction)}
      />
      <main className="ab-preview">
        <article className={`ab-sheet tx-print${o.spacing === "weit" ? " tx-print-wide" : ""}${fassung === "korrektur" ? " tx-print-korrektur" : ""}`} lang="de" data-fassung={fassung}>
          <header className="ab-head">
            <div className="ab-head-main">
              <h1 className="ab-title">{o.title}</h1>
              {meta.length > 0 && <p className="ab-meta">{meta.join(" · ")}</p>}
            </div>
            {(o.name || o.date) && (
              <div className="ab-fields">
                {o.name && (
                  <p className="ab-field">
                    <span>Name:</span>
                    <span className="ab-field-line">{text.student_name}</span>
                  </p>
                )}
                {o.date && (
                  <p className="ab-field">
                    <span>Datum:</span>
                    <span className="ab-field-line">{longDate(correction ? correction.created_at : text.updated_at)}</span>
                  </p>
                )}
              </div>
            )}
          </header>
          {o.prompt && text.prompt && (
            <section className="tx-print-task">
              <p className="tx-print-task-label">Aufgabe</p>
              <p className="ab-pre">{text.prompt}</p>
            </section>
          )}
          <div className="tx-print-body">
            {doc.length === 0 ? (
              <p className="no-print ab-muted">Noch nichts geschrieben.</p>
            ) : (
              doc.map((b, i) => {
                const marks = fassung === "korrektur" ? numbered.filter((m) => m.item.block === i) : undefined;
                return b.t === "h" ? (
                  <h2 key={i} className="tx-print-h">
                    <Runs block={b} marks={marks} />
                  </h2>
                ) : blockText(b).trim() ? (
                  <p key={i} className="tx-print-p">
                    <Runs block={b} marks={marks} />
                  </p>
                ) : (
                  <p key={i} className="tx-print-p tx-print-empty" aria-hidden />
                );
              })
            )}
          </div>
          {fassung === "korrektur" && (numbered.length > 0 || notes.length > 0) && (
            <section className="tx-k-section" data-testid="druck-korrekturen">
              <h2 className="tx-k-title">Korrekturen</h2>
              <ol className="tx-k-list">
                {numbered.map(({ item, n }) => (
                  <li key={item.id}>
                    <span className="num">{n}.</span>
                    <span>
                      <span className="tx-k-cat">
                        {categoryInfo(item.category)?.label ?? item.category}
                        {item.kind === "stil" ? " (Vorschlag)" : ""}:
                      </span>{" "}
                      <span className="tx-k-del">{item.quote}</span> → <b>{item.replacement || "streichen"}</b>
                      {item.explanation && <> – {item.explanation}</>}
                    </span>
                  </li>
                ))}
                {notes.map((item) => (
                  <li key={item.id}>
                    <span>•</span>
                    <span>
                      <span className="tx-k-cat">{categoryInfo(item.category)?.label ?? item.category}:</span> {item.quote && <>„{item.quote}“ → {item.replacement} – </>}
                      {item.explanation}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {o.overview && ov && (
            <section className="tx-k-section" data-testid="druck-uebersicht">
              <h2 className="tx-k-title">Fehlerübersicht</h2>
              <div className="tx-k-overview">
                {ov.categories.length === 0 ? (
                  <p>Keine bestätigten Fehler.</p>
                ) : (
                  ov.categories.map((k) => <p key={k.key}>{countLabel(k)}</p>)
                )}
                {ov.mainIssue && (
                  <p className="mt-2">
                    <b>Häufigstes Problem:</b> {ov.mainIssue}
                  </p>
                )}
                {rec && (
                  <p>
                    <b>Empfehlung:</b> {rec.text}
                  </p>
                )}
                {fassung !== "korrektur" && accepted.some((i) => i.kind !== "hinweis") && (
                  <ul className="mt-2 list-disc pl-5">
                    {accepted
                      .filter((i) => i.kind !== "hinweis")
                      .map((i) => (
                        <li key={i.id}>
                          „{i.quote}“ → „{i.replacement}“: {i.explanation}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </article>
        <p className="ab-hint no-print">Seitenumbrüche zeigt die Druckvorschau. Absätze werden nicht mitten in einer Zeile geteilt, Überschriften bleiben beim folgenden Text.</p>
      </main>
    </div>
  );
}
