import Link from "next/link";
import { BookOpenText, Camera, Images, PenLine } from "lucide-react";
import { studentDevice } from "@/lib/live";
import { textZeile, type SchreibStart, type TextLauf } from "@/lib/textarbeit-ablauf";
import type { UnitView } from "@/lib/units";

const TON: Record<ReturnType<typeof textZeile>["stand"], string> = {
  schreibt: "text-ink-2",
  abgegeben: "text-accent",
  wird_korrigiert: "text-ink-2",
  bewertung_offen: "text-amber",
  bewertet: "text-green",
};

const name = (t: Pick<TextLauf, "titel" | "textsorte">) => (t.textsorte && !t.titel.toLowerCase().startsWith(t.textsorte.toLowerCase()) ? `${t.textsorte}: ${t.titel}` : t.titel);

/**
 * Je Textarbeit dieser Einheit eine kompakte Zeile im geführten Unterricht (lib/textarbeit-ablauf.ts `textZeile`): Stand
 * und genau ein nächster Schritt (Korrigieren, Bewertung übernehmen …). Nur die Texte dieser Einheit, auch bei zwei
 * Schülern zugleich. Eine Note steht nur, wenn die Lehrkraft sie übernommen hat.
 */
export function TextarbeitZeilen({ unit, laeufe }: { unit: UnitView; laeufe: TextLauf[] }) {
  if (!laeufe.length) return null;
  const geraet = studentDevice(unit) !== null;
  return (
    <ul className="panel divide-y divide-line" aria-label="Textarbeiten dieser Einheit" data-testid="textarbeit-zeilen">
      {laeufe.map((t) => {
        const z = textZeile(t, { amGeraet: geraet && unit.device_view === `text:${t.id}` });
        return (
          <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-5" data-testid="textarbeit-zeile" data-stand={z.stand}>
            <PenLine size={17} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1 basis-[180px]">
              <span className="block truncate text-[15px] font-semibold" title={name(t)}>
                {name(t)}
              </span>
              <span className={`num block text-[13.5px] font-medium ${TON[z.stand]}`}>{z.text}</span>
            </span>
            {z.stand === "schreibt" && !geraet && (
              <Link href={`/texte/${t.id}/papier?einheit=${unit.id}`} className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-medium text-ink-2 hover:text-ink">
                <Camera size={15} aria-hidden /> Vom Foto
              </Link>
            )}
            <Link href={z.aktion.href} className={`btn ${z.aktion.haupt ? "btn-primary" : "btn-secondary"}`} data-testid="textarbeit-aktion">
              {z.aktion.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * „Schreibauftrag starten“ im Schritt (lib/textarbeit-ablauf.ts `schreibStart`): der Hauptknopf, solange in dieser
 * Einheit noch kein Text dieser Textsorte läuft; danach nur der Hinweis, dass er läuft (die Zeile oben zeigt den Stand).
 * `haupt` false: neben „Übung senden“ im Schritt „Schularbeit vorbereiten“.
 */
export function SchreibauftragStart({ start, laeuft, haupt = true }: { start: SchreibStart; laeuft: TextLauf | null; haupt?: boolean }) {
  const Icon = start.art === "schreibauftrag" ? BookOpenText : start.art === "bildgeschichte" ? Images : PenLine;
  return (
    <div className="mt-5 grid gap-2 border-t border-line pt-4" data-testid="schreib-start">
      <p className="text-[14px] text-ink-2">
        Schreibaufgabe: <span className="font-semibold text-ink">{start.textsorte}</span>
        {start.art === "text" && start.aufgabe && <span className="block text-[14px] text-ink-2">„{start.aufgabe}“</span>}
        {start.art === "schreibauftrag" && <span className="block text-[13.5px]">Mit Textbeilage und Zeilennummern{start.testId ? ", zur Prüfung" : ""}.</span>}
        <span className="block text-[13px] text-ink-3">Vorgefüllt aus {start.quelle}. Vor dem Start kannst du alles ändern.</span>
      </p>
      {laeuft ? (
        <p className="text-[14.5px] font-medium text-green" data-testid="schreib-laeuft">
          {laeuft.titel.includes("„") ? laeuft.titel : `„${laeuft.titel}“`} ist gestartet. Den Stand siehst du oben.
        </p>
      ) : (
        <Link href={start.href} className={`btn btn-lg w-full sm:w-fit ${haupt ? "btn-primary" : "btn-secondary"}`} data-testid="schreibauftrag-starten">
          <Icon size={18} aria-hidden /> Schreibauftrag starten
        </Link>
      )}
    </div>
  );
}
