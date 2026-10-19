import { blockText, type Block, type Run } from "@/lib/text-doc";
import type { StoryImage } from "@/lib/picture-story";

/** Runs with bold/italic/underline and line breaks, never HTML from the text. */
export function RunList({ runs }: { runs: Run[] }) {
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

/** A text as written: headings, paragraphs, empty lines kept as space (Textarbeit, Mappe). */
export function TextBody({ doc }: { doc: Block[] }) {
  return (
    <div className="tx-print-body">
      {doc.map((b, i) =>
        b.t === "h" ? (
          <h3 key={i} className="tx-print-h">
            <RunList runs={b.r} />
          </h3>
        ) : blockText(b).trim() ? (
          <p key={i} className="tx-print-p">
            <RunList runs={b.r} />
          </p>
        ) : (
          <p key={i} className="tx-print-p tx-print-empty" aria-hidden />
        ),
      )}
    </div>
  );
}

/** The series of pictures, numbered; as many per row as keeps them large enough to see details. */
export function Pictures({ images }: { images: StoryImage[] }) {
  const n = images.length;
  const cols = n <= 2 ? 2 : n === 4 ? 2 : n <= 9 ? 3 : 4;
  return (
    <ol className={`bg-pics bg-pics-${cols}`} data-testid="druck-bilder">
      {images.map((img, i) => (
        <li key={img.id} className="bg-pic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/material/bildgeschichte/bild/${img.id}`} alt={`Bild ${i + 1}`} />
          <span className="bg-pic-num">{i + 1}</span>
        </li>
      ))}
    </ol>
  );
}
