import Link from "next/link";
import { ArrowRight, CheckCircle2, Play, Sparkles } from "lucide-react";
import { startUnitAction } from "@/app/session-actions";
import { Avatar } from "@/components/Art";
import type { HeuteKarte, HeutePunkt } from "@/lib/heute";
import type * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";

/**
 * Ein Schüler von heute auf einer kurzen Karte (lib/heute.ts): Zeit, Name, Klasse, Fach, dann aus der automatischen
 * Vorbereitung Thema, Warum, was bereitliegt (geprüftes Lernpaket oder Plan aus den Daten), Schwierigkeiten und
 * Prüfung. Eine Aktion: „Einheit starten“. `haupt`: der nächste Schüler, sein Knopf ist der Hauptknopf der Seite.
 * `oben`: seine Einheit läuft und steht oben mit dem großen Knopf; hier bleibt nur eine Zeile mit einem ruhigen Link.
 */
export function SchuelerKarte({ p, student, karte, fach, haupt, wann, oben = false }: { p: HeutePunkt; student: repo.Student | undefined; karte: HeuteKarte | undefined; fach: string; haupt: boolean; wann?: string | null; oben?: boolean }) {
  const klasse = student ? klassenLabel(student.school_type, student.klasse, { short: true }) : "";
  const laeuft = p.einheitStatus === "gestartet";
  if (laeuft && oben) return <KurzeKarte p={p} meta={[klasse, fach, p.ort].filter(Boolean).join(" · ")} />;
  const zeilen: [string, React.ReactNode][] = [];
  if (karte?.thema) zeilen.push(["Thema", karte.thema]);
  if (karte?.empfehlung) zeilen.push(["Warum", karte.warumPruefung ? <span key="w" className="font-semibold text-amber">{karte.empfehlung}</span> : karte.empfehlung]);
  if (karte?.vorbereitet) zeilen.push(["Vorbereitet", karte.vorbereitet]);
  if (karte?.schwierigkeiten.length)
    zeilen.push([
      "Schwierigkeiten",
      karte.mitKi ? (
        <span key="s">
          {karte.schwierigkeiten.join(" · ")}{" "}
          <span className="inline-flex items-center gap-1 text-[12.5px] whitespace-nowrap text-ink-3">
            <Sparkles size={12} aria-hidden /> aus dem KI-Briefing
          </span>
        </span>
      ) : (
        karte.schwierigkeiten.join(" · ")
      ),
    ]);
  if (karte?.pruefung) zeilen.push(["Prüfung", <span key="p" className="font-semibold text-amber">{karte.pruefung}</span>]);
  const briefing = `/schueler/${p.studentId}/briefing${p.platzId ? `?platz=${p.platzId}` : ""}`;
  return (
    <li className={`panel grid gap-3 px-4 py-4 sm:px-5 ${p.nichtStattgefunden || p.erledigt ? "opacity-80" : ""}`} data-testid="heute-karte">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="num w-[106px] shrink-0 text-[16px] font-semibold">
          {p.zeit}
          {wann && <span className="block text-[12.5px] font-medium text-accent">{wann}</span>}
        </span>
        <Avatar name={p.studentName} size={38} />
        <div className="min-w-[9rem] flex-1">
          <p className="truncate text-[17px] leading-tight font-semibold">{p.studentName}</p>
          <p className="truncate text-[13.5px] text-ink-2">{[klasse, fach, p.ort].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          {laeuft && p.einheitLehrer ? (
            <>
              <span className="text-[14px] text-ink-2">läuft bei {p.einheitLehrer}</span>
              <Link href={`/einheiten/${p.einheitId}`} className="btn btn-ghost btn-sm">
                Ansehen
              </Link>
            </>
          ) : laeuft ? (
            <Link href={`/einheiten/${p.einheitId}`} className="btn btn-primary w-full sm:w-auto">
              Zum Unterricht <ArrowRight size={17} aria-hidden />
            </Link>
          ) : p.einheitStatus === "beendet" || p.erledigt ? (
            <>
              <span className="inline-flex items-center gap-1 text-[14px] font-medium text-green">
                <CheckCircle2 size={16} aria-hidden /> erledigt
              </span>
              {p.einheitId !== null && (
                <Link href={`/einheiten/${p.einheitId}`} className="btn btn-ghost btn-sm">
                  Abschluss
                </Link>
              )}
            </>
          ) : p.einheitStatus === "abgebrochen" ? (
            <span className="text-[14px] text-ink-3">abgebrochen</span>
          ) : (
            <>
              {p.nichtStattgefunden && <span className="text-[13px] text-ink-3">nicht stattgefunden</span>}
              <form action={startUnitAction.bind(null, p.studentId)} className="w-full sm:w-auto">
                <button className={`btn w-full sm:w-auto ${haupt ? "btn-primary" : "btn-secondary"}`}>
                  <Play size={17} aria-hidden /> Einheit starten
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      {zeilen.length > 0 && (
        <dl className="grid gap-x-4 gap-y-1 text-[14.5px] sm:grid-cols-[128px_minmax(0,1fr)] sm:pl-[118px]">
          {zeilen.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[13px] font-semibold text-ink-3 sm:pt-px">{k}</dt>
              <dd className="mb-1 min-w-0 leading-snug sm:mb-0">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="-my-2 flex flex-wrap gap-x-5 text-[13.5px] sm:pl-[118px]">
        <Link href={`/schueler/${p.studentId}`} className="inline-flex min-h-[44px] items-center font-medium text-accent hover:underline">
          Mehr zum Schüler
        </Link>
        {!p.erledigt && p.einheitStatus !== "beendet" && (
          <Link href={briefing} className="inline-flex min-h-[44px] items-center font-medium text-ink-2 hover:text-ink">
            Briefing
          </Link>
        )}
      </p>
    </li>
  );
}

/** Die Karte eines Schülers, dessen Einheit oben läuft: eine Zeile, „läuft“ und ein ruhiger Link, kein zweiter großer Knopf. */
function KurzeKarte({ p, meta }: { p: HeutePunkt; meta: string }) {
  return (
    <li className="panel flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-5" data-testid="heute-karte-laeuft">
      <span className="num w-[106px] shrink-0 text-[16px] font-semibold">{p.zeit}</span>
      <Avatar name={p.studentName} size={32} />
      <div className="min-w-[9rem] flex-1">
        <p className="truncate text-[16px] leading-tight font-semibold">{p.studentName}</p>
        {meta && <p className="truncate text-[13px] text-ink-2">{meta}</p>}
      </div>
      <p className="flex items-center gap-2 text-[14px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-accent">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden /> läuft
        </span>
        <span className="text-ink-3" aria-hidden>
          ·
        </span>
        <Link href={`/einheiten/${p.einheitId}`} className="inline-flex min-h-[44px] items-center font-medium text-ink-2 hover:text-ink hover:underline">
          Zum Unterricht
        </Link>
      </p>
    </li>
  );
}
