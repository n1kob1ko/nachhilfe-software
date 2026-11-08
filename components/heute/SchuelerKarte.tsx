import Link from "next/link";
import { ArrowRight, BookOpenCheck, CheckCircle2, ChevronDown, Play, Sparkles } from "lucide-react";
import { vorbereitenAction } from "@/app/cockpit-actions";
import { startUnitAction } from "@/app/session-actions";
import { Avatar } from "@/components/Art";
import { nachtragenHref, type HeuteKarte, type HeutePunkt } from "@/lib/heute";
import { wienerDatum } from "@/lib/planung/zeit";
import type * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";

type Props = { p: HeutePunkt; student: repo.Student | undefined; karte: HeuteKarte | undefined; fach: string; haupt: boolean; wann?: string | null; oben?: boolean };

/**
 * Ein Schüler von heute auf einer kurzen Karte (lib/heute.ts). Audit 2026-11-07: auf einen Blick steht nur, was die
 * Lehrkraft jetzt braucht: Zeit, Name, Dauer · Klasse · Fach · Ort, das Thema (bei einem neuen Schüler ohne Signal die
 * geprüften Lernpakete zum Wählen; ein Tippen legt eines für heute fest), eine nahe Prüfung und der Knopf
 * „Einheit starten“. Warum, was bereitliegt, Schwierigkeiten, die Hausübung von letztem Mal und eine weiter entfernte
 * Prüfung stehen zugeklappt unter „Mehr“, mit den Wegen zum Schüler und zum Briefing.
 *
 * `haupt`: der nächste Schüler, sein Knopf ist der Hauptknopf der Seite. `oben`: seine Einheit läuft und steht oben
 * mit dem großen Knopf; hier bleibt eine Zeile mit einem ruhigen Link. Eine erledigte oder abgebrochene Einheit ist
 * ebenfalls nur eine Zeile („erledigt“ mit dem Weg zum Abschluss), damit die Liste des Tages kurz bleibt.
 */
export function SchuelerKarte({ p, student, karte, fach, haupt, wann, oben = false }: Props) {
  const klasse = student ? klassenLabel(student.school_type, student.klasse, { short: true }) : "";
  const dauer = karte?.dauerMin ? `${karte.dauerMin} Min.` : "";
  const meta = [dauer, klasse, fach, p.ort].filter(Boolean).join(" · ");
  const laeuft = p.einheitStatus === "gestartet";
  if (laeuft && oben)
    return (
      <Zeile p={p} meta={meta} testid="heute-karte-laeuft">
        <span className="inline-flex items-center gap-1.5 font-medium text-accent">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden /> läuft
        </span>
        <Punkt />
        <Link href={`/einheiten/${p.einheitId}`} className="inline-flex min-h-[44px] items-center font-medium text-ink-2 hover:text-ink hover:underline">
          Zum Unterricht
        </Link>
      </Zeile>
    );
  if (laeuft)
    return (
      <Zeile p={p} meta={meta} testid="heute-karte-laeuft">
        <span className="text-ink-2">läuft bei {p.einheitLehrer ?? "einem anderen Lehrer"}</span>
        <Punkt />
        <Link href={`/einheiten/${p.einheitId}`} className="inline-flex min-h-[44px] items-center font-medium text-ink-2 hover:text-ink hover:underline">
          Ansehen
        </Link>
      </Zeile>
    );
  if (p.einheitStatus === "beendet" || p.erledigt)
    return (
      <Zeile p={p} meta={meta} testid="heute-karte-fertig">
        <span className="inline-flex items-center gap-1 font-medium text-green">
          <CheckCircle2 size={16} aria-hidden /> erledigt
        </span>
        {p.einheitId !== null && (
          <>
            <Punkt />
            <Link href={`/einheiten/${p.einheitId}`} className="inline-flex min-h-[44px] items-center font-medium text-ink-2 hover:text-ink hover:underline">
              Abschluss
            </Link>
          </>
        )}
      </Zeile>
    );
  if (p.einheitStatus === "abgebrochen")
    return (
      <Zeile p={p} meta={meta} testid="heute-karte-fertig">
        <span className="text-ink-3">abgebrochen</span>
      </Zeile>
    );

  // zugeklappt unter „Mehr“: alles, was beim Starten hilft, aber nicht auf einen Blick nötig ist
  const mehr: [string, React.ReactNode][] = [];
  if (karte?.empfehlung) mehr.push(["Warum", karte.warumPruefung ? <span key="w" className="font-semibold text-amber">{karte.empfehlung}</span> : karte.empfehlung]);
  if (karte?.vorbereitet) mehr.push(["Vorbereitet", karte.vorbereitet]);
  if (karte?.schwierigkeiten.length)
    mehr.push([
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
  // the homework of last time: its result in one line, with where it comes from (lib/hausuebung-zurueck.ts)
  if (karte?.hausuebung)
    mehr.push([
      "Hausübung",
      <span key="h" data-testid="heute-hausuebung">
        {karte.hausuebung.zeile.replace(/^Hausübung: /, "")} <span className="text-[12.5px] whitespace-nowrap text-ink-3">{karte.hausuebung.quelle}</span>
      </span>,
    ]);
  // a near exam stands on the card; a far one only under „Mehr“
  if (karte?.pruefung && !karte.pruefungNah) mehr.push(["Prüfung", karte.pruefung]);
  const briefing = `/schueler/${p.studentId}/briefing${p.platzId ? `?platz=${p.platzId}` : ""}`;
  return (
    <li className={`panel grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 px-4 py-4 sm:px-5 ${p.nichtStattgefunden ? "opacity-80" : ""}`} data-testid="heute-karte">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="num w-[106px] shrink-0 text-[16px] font-semibold">
          {p.zeit}
          {wann && <span className="block text-[12.5px] font-medium text-accent">{wann}</span>}
        </span>
        <Avatar name={p.studentName} size={38} />
        <div className="min-w-[9rem] flex-1">
          <p className="truncate text-[17px] leading-tight font-semibold">{p.studentName}</p>
          {meta && <p className="truncate text-[13.5px] text-ink-2">{meta}</p>}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          {p.nichtStattgefunden && (
            // Audit 2026-11-07: neutral „keine Einheit“ statt „nicht stattgefunden“, und gleich der Weg zum Nachtragen
            <span className="flex items-center gap-2 text-[13px] text-ink-3" data-testid="keine-einheit">
              keine Einheit
              <Link href={nachtragenHref(p.studentId, wienerDatum(new Date()), p.startMin, p.endeMin - p.startMin)} className="inline-flex min-h-[44px] items-center font-semibold text-accent hover:underline">
                Nachtragen
              </Link>
            </span>
          )}
          {/* the unit starts for the Platz of this card (two students at the same time each get their own) */}
          <form action={startUnitAction.bind(null, p.studentId, p.platzId)} className="w-full sm:w-auto">
            <button className={`btn w-full sm:w-auto ${haupt ? "btn-primary" : "btn-secondary"}`}>
              <Play size={17} aria-hidden /> Einheit starten
            </button>
          </form>
        </div>
      </div>
      {(karte?.thema || karte?.pakete?.length || (karte?.pruefung && karte.pruefungNah)) && (
        <div className="grid gap-1 text-[14.5px] leading-snug sm:pl-[118px]" data-testid="heute-thema">
          {karte.thema ? (
            <p>
              <span className="mr-2 text-[13px] font-semibold text-ink-3">Thema</span>
              {karte.thema}
            </p>
          ) : karte.pakete?.length ? (
            <div>
              <p className="mb-1 text-[13px] font-semibold text-ink-3">Lernpaket wählen</p>
              <div className="flex flex-wrap gap-1.5" data-testid="lernpaket-waehlen">
                {karte.pakete.map((x) => (
                  <form key={x.id} action={vorbereitenAction.bind(null, p.studentId)}>
                    <input type="hidden" name="paket_id" value={x.id} />
                    <button className="btn btn-secondary btn-sm">
                      <BookOpenCheck size={15} aria-hidden /> {x.title}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
          {karte.pruefung && karte.pruefungNah && (
            <p>
              <span className="mr-2 text-[13px] font-semibold text-ink-3">Prüfung</span>
              <span className="font-semibold text-amber">{karte.pruefung}</span>
            </p>
          )}
        </div>
      )}
      <details className="group sm:pl-[118px]" data-testid="heute-mehr">
        <summary className="-my-1 inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-accent">
          Mehr <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        {mehr.length > 0 && (
          <dl className="grid gap-x-4 gap-y-1 pb-2 text-[14.5px] sm:grid-cols-[128px_minmax(0,1fr)]">
            {mehr.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[13px] font-semibold text-ink-3 sm:pt-px">{k}</dt>
                <dd className="mb-1 min-w-0 leading-snug sm:mb-0">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="-mb-2 flex flex-wrap gap-x-5 text-[13.5px]">
          <Link href={`/schueler/${p.studentId}`} className="inline-flex min-h-[44px] items-center font-medium text-accent hover:underline">
            Zum Schüler
          </Link>
          <Link href={briefing} className="inline-flex min-h-[44px] items-center font-medium text-ink-2 hover:text-ink">
            Briefing
          </Link>
        </p>
      </details>
    </li>
  );
}

/** Eine Zeile statt einer Karte: Zeit, Name, Dauer · Klasse · Fach · Ort und rechts der Stand (läuft, erledigt, abgebrochen). */
function Zeile({ p, meta, testid, children }: { p: HeutePunkt; meta: string; testid: string; children: React.ReactNode }) {
  return (
    <li className="panel flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-5" data-testid={testid}>
      <span className="num w-[106px] shrink-0 text-[16px] font-semibold">{p.zeit}</span>
      <Avatar name={p.studentName} size={32} />
      <div className="min-w-[9rem] flex-1">
        <p className="truncate text-[16px] leading-tight font-semibold">{p.studentName}</p>
        {meta && <p className="truncate text-[13px] text-ink-2">{meta}</p>}
      </div>
      <p className="flex items-center gap-2 text-[14px]">{children}</p>
    </li>
  );
}

const Punkt = () => (
  <span className="text-ink-3" aria-hidden>
    ·
  </span>
);
