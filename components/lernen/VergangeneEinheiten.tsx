import { History } from "lucide-react";
import { More, Pill } from "@/components/ui";
import { vergangeneStunden, type PortalStunde } from "@/lib/schuelerportal";
import { Abschnitt, tagLabel } from "./Abschnitt";

/**
 * Vergangene Einheiten in der Schüler-App: Datum, Fach, Thema und was geübt wurde, die neueste zuerst. Nur diese
 * Angaben, nie die Dokumentation des Lehrers. Ohne Einheit kein Abschnitt.
 */
export function VergangeneEinheiten({ studentId }: { studentId: number }) {
  const liste = vergangeneStunden(studentId);
  if (liste.length === 0) return null;
  return (
    <Abschnitt titel="Vergangene Einheiten" icon={History} testId="vergangene-einheiten">
      <div className="mt-1">
        <More limit={3} className="divide-y divide-line" items={liste.map((s) => <Zeile key={s.id} s={s} />)} />
      </div>
    </Abschnitt>
  );
}

function Zeile({ s }: { s: PortalStunde }) {
  // ohne eigenes Thema steht die erste geübte Fähigkeit oben, nicht zweimal
  const thema = s.thema || s.geuebt[0] || "";
  const geuebt = s.geuebt.filter((g) => g !== thema);
  return (
    <div className="grid gap-1 py-3">
      <span className="flex flex-wrap items-center gap-x-2 text-[14px] text-ink-2">
        <span className="num font-semibold text-ink">{tagLabel(s.datum)}</span>
        <span>· {s.fach}</span>
      </span>
      {thema && <span className="text-[16px] font-semibold break-words">{thema}</span>}
      {(geuebt.length > 0 || s.aufgaben > 0) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {geuebt.slice(0, 3).map((g) => (
            <Pill key={g}>{g}</Pill>
          ))}
          {geuebt.length > 3 && <Pill>+{geuebt.length - 3}</Pill>}
          {s.aufgaben > 0 && (
            <span className="num text-[13px] text-ink-2">
              {s.aufgaben} {s.aufgaben === 1 ? "Aufgabe" : "Aufgaben"}, {s.richtig} richtig
            </span>
          )}
        </span>
      )}
    </div>
  );
}
