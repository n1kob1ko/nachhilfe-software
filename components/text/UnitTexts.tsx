import Link from "next/link";
import { FileText, Laptop, PenLine, Printer, Tablet } from "lucide-react";
import { showTextOnTabletAction } from "@/app/text-actions";
import { Pill, SectionTitle, formatDate } from "@/components/ui";
import { textsForStudent, textsForUnit, wordsLabel, type UnitText } from "@/lib/texts";

const label = (t: Pick<UnitText, "title" | "topic">) => (t.topic && t.topic !== t.title ? `${t.topic}: ${t.title}` : t.title);

/**
 * Textarbeiten in a running unit: the ones of this unit (open on the tablet, read along) and earlier
 * unfinished texts of the student, to continue them.
 */
export function RunningUnitTexts({ unitId, studentId, deviceView, device, name }: { unitId: number; studentId: number; deviceView: string; device: "laptop" | "tablet" | null; name: string }) {
  const word = device === "laptop" ? "Laptop" : "Tablet";
  const here = textsForUnit(unitId);
  const ids = new Set(here.map((t) => t.id));
  const earlier = textsForStudent(studentId).filter((t) => !ids.has(t.id) && t.status !== "fertig");
  if (!here.length && !earlier.length) return null;
  const row = (t: Pick<UnitText, "id" | "title" | "topic" | "words" | "status">, sub: string) => {
    const shown = deviceView === `text:${t.id}`;
    return (
      <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <PenLine size={18} className="shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{label(t)}</span>
          <span className="num block text-[14px] text-ink-2">{sub}</span>
        </span>
        {shown && device ? <Pill tone="green">am {word} offen</Pill> : t.status === "fertig" && <Pill tone="green">fertig</Pill>}
        {device && !shown && (
          <form action={showTextOnTabletAction.bind(null, t.id)}>
            <button className="btn btn-secondary">
              {device === "laptop" ? <Laptop size={16} aria-hidden /> : <Tablet size={16} aria-hidden />} Am {word} öffnen
            </button>
          </form>
        )}
        <Link href={`/texte/${t.id}`} className={`btn ${shown ? "btn-primary" : "btn-secondary"}`}>
          {shown ? "Mitlesen" : "Öffnen"}
        </Link>
      </li>
    );
  };
  return (
    <section>
      <h2 className="mb-4 text-[20px] font-semibold">Textarbeiten</h2>
      {here.length > 0 && (
        <ul className="panel divide-y divide-line">
          {here.map((t) => row(t, `${wordsLabel(t.words)}${t.started_here ? "" : ` · weitergeschrieben (vorher ${wordsLabel(t.words_before)})`}`))}
        </ul>
      )}
      {earlier.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-[14px] font-semibold text-ink-2">Noch nicht fertig, aus früheren Einheiten von {name}</p>
          <ul className="panel divide-y divide-line">{earlier.map((t) => row(t, `${wordsLabel(t.words)} · zuletzt ${formatDate(t.updated_at, { day: "numeric", month: "short" })}`))}</ul>
        </>
      )}
    </section>
  );
}

/** "Dokumente dieser Einheit" after the unit: every text written or continued in it, to open and print. */
export function UnitDocuments({ unitId }: { unitId: number }) {
  const texts = textsForUnit(unitId);
  if (!texts.length) return null;
  return (
    <section aria-label="Dokumente dieser Einheit">
      <SectionTitle>Dokumente dieser Einheit</SectionTitle>
      <ul className="panel divide-y divide-line">
        {texts.map((t) => {
          const added = t.words_after - t.words_before;
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <FileText size={18} className="shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {label(t)} – <span className="num">{wordsLabel(t.words)}</span>
                </span>
                <span className="num block text-[14px] text-ink-2">
                  {t.started_here ? "in dieser Einheit begonnen" : `weitergeschrieben, ${added >= 0 ? "+" : ""}${added} Wörter`}
                  {t.subject ? ` · ${t.subject}` : ""}
                  {t.status === "fertig" ? " · fertig" : ""}
                </span>
              </span>
              <Link href={`/texte/${t.id}`} className="btn btn-secondary">
                Öffnen
              </Link>
              <Link href={`/arbeitsblatt/text/${t.id}`} target="_blank" className="btn btn-secondary">
                <Printer size={16} aria-hidden /> PDF / Drucken
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
