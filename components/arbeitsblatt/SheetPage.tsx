import type { SheetDoc, SheetOptions } from "@/lib/arbeitsblatt";
import { PageStyle, Sheet } from "./Sheet";
import { SheetSettings } from "./SheetSettings";

/** Settings on the left, the A4 sheet on the right; in print only the sheet. */
export function SheetPage(p: {
  doc: SheetDoc;
  o: SheetOptions;
  path: string;
  extra: [string, string][];
  back: { href: string; label: string };
}) {
  return (
    <div className="ab-screen">
      <PageStyle o={p.o} />
      <SheetSettings
        options={p.o}
        defaultTitle={p.doc.defaultTitle}
        path={p.path}
        extra={p.extra}
        back={p.back}
        taskCount={p.doc.tasks.length}
      />
      <main className="ab-preview">
        {p.doc.tasks.length ? (
          <Sheet doc={p.doc} o={p.o} />
        ) : (
          <p className="ab-empty no-print">Keine Aufgaben ausgewählt.</p>
        )}
        <p className="ab-hint no-print">
          Seitenumbrüche zeigt die Druckvorschau. Keine Aufgabe wird zwischen
          zwei Seiten geteilt; lange Sachaufgaben höchstens zwischen zwei
          Teilfragen.
        </p>
      </main>
    </div>
  );
}
