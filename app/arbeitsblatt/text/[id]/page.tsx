import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageStyle } from "@/components/arbeitsblatt/Sheet";
import { TextPrintSettings } from "@/components/text/TextPrintSettings";
import { requireTeacher } from "@/lib/auth";
import { blockText, type Block } from "@/lib/text-doc";
import { readTextPrintOptions } from "@/lib/text-print";
import { getText, textDoc, wordsLabel } from "@/lib/texts";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const text = getText(Number((await params).id));
  // the title becomes the file name when the text is saved as PDF
  return { title: { absolute: text ? readTextPrintOptions(await searchParams, text.title).title : "Text" } };
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Vienna" });

/** One block: its runs with bold/italic/underline and line breaks, never HTML from the text. */
function Runs({ block }: { block: Block }) {
  return block.r.map((r, i) => {
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

/** A Textarbeit as an A4 document for the Schulmappe: the worksheet's page setup, clean paragraphs, no cut-off lines. */
export default async function TextPrintPage({ params, searchParams }: Params) {
  await requireTeacher();
  const text = getText(Number((await params).id));
  if (!text) notFound();
  const o = readTextPrintOptions(await searchParams, text.title);
  const doc = textDoc(text);
  const meta = o.subject ? [text.subject, text.topic && text.topic !== text.title ? text.topic : ""].filter(Boolean) : [];
  if (o.words) meta.push(wordsLabel(text.words));
  return (
    <div className="ab-screen">
      <PageStyle o={o} />
      <TextPrintSettings options={o} defaultTitle={text.title} path={`/arbeitsblatt/text/${text.id}`} back={{ href: `/texte/${text.id}`, label: "Zum Text" }} words={text.words} />
      <main className="ab-preview">
        <article className={`ab-sheet tx-print${o.spacing === "weit" ? " tx-print-wide" : ""}`} lang="de">
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
                    <span className="ab-field-line">{longDate(text.updated_at)}</span>
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
              doc.map((b, i) =>
                b.t === "h" ? (
                  <h2 key={i} className="tx-print-h">
                    <Runs block={b} />
                  </h2>
                ) : blockText(b).trim() ? (
                  <p key={i} className="tx-print-p">
                    <Runs block={b} />
                  </p>
                ) : (
                  <p key={i} className="tx-print-p tx-print-empty" aria-hidden />
                ),
              )
            )}
          </div>
        </article>
        <p className="ab-hint no-print">Seitenumbrüche zeigt die Druckvorschau. Absätze werden nicht mitten in einer Zeile geteilt, Überschriften bleiben beim folgenden Text.</p>
      </main>
    </div>
  );
}
