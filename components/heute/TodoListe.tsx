import Link from "next/link";
import { CalendarClock, CalendarPlus, CalendarSync, Check, CheckCircle2, ClipboardCheck, FileCheck2, NotebookPen, PenLine } from "lucide-react";
import { abhakenAction } from "@/app/zu-erledigen-actions";
import { Pill, formatDate } from "@/components/ui";
import { STAGE_LABEL } from "@/lib/exams";
import { ZUSTAND_LABEL, ZUSTAND_TONE, type Punkt } from "@/lib/zu-erledigen";

const firstName = (n: string) => n.split(" ")[0];

const TODO_ICON = { pruefung: CalendarClock, ergebnis: FileCheck2, hausuebung: NotebookPen, text: PenLine, bewertung: ClipboardCheck, terminanfrage: CalendarSync, einreichung: CalendarPlus };

/** Was ein Punkt in „Zu erledigen“ sagt; der Zustand steht darunter. */
function todoText(p: Punkt): React.ReactNode {
  const name = <b>{firstName(p.studentName)}</b>;
  switch (p.art) {
    case "pruefung": {
      const e = p.pruefung;
      return (
        <>
          <span className={`font-semibold ${e.stage === "bald" ? "text-red" : e.stage === "prioritaet" ? "text-amber" : ""}`}>{STAGE_LABEL[e.stage]}:</span> {e.kind} {e.subject} von {name} {e.days === 0 ? "heute" : e.days === 1 ? "morgen" : `in ${e.days} Tagen`}
        </>
      );
    }
    case "ergebnis":
      return p.zustand === "wartet" ? (
        <>
          Ergebnis von {name} bewerten: {p.titel} ({p.zuBewerten} {p.zuBewerten === 1 ? "Antwort" : "Antworten"})
        </>
      ) : (
        <>
          Ergebnis von {name} ansehen: {p.titel} ({p.richtig}/{p.aufgaben} richtig)
        </>
      );
    case "hausuebung":
      return (
        <>
          Hausübung von {name}
          {p.zustand === "erledigt" ? "" : " kontrollieren"}: {p.beschreibung}
          {p.uebung && <span className="text-ink-2"> · Übung „{p.uebung}“</span>}
        </>
      );
    case "text":
      return (
        <>
          Text von {name} {p.zustand === "erledigt" ? "abgegeben" : "ansehen"}: {p.titel}
        </>
      );
    case "bewertung":
      return (
        <>
          Bewertung von {name} bestätigen: {p.titel}
          {p.vorschlag && <span className="text-ink-2"> · Vorschlag da</span>}
        </>
      );
    case "terminanfrage":
      return (
        <>
          {p.aufgabe === "bestaetigen" ? <>Terminanfrage für {name} bestätigen</> : <>Tausch für {name} zustimmen</>}: {p.beschreibung}
        </>
      );
    case "einreichung":
      // vom Schüler in seiner App eingetragen (lib/pruefliste.ts)
      return (
        <>
          Prüfung von {name} {p.zustand === "erledigt" ? (p.uebernommen ? "übernommen" : "verworfen") : p.zuPruefen ? "prüfen" : "eingetragen, bitte ansehen"}: {p.titel}
          <span className="text-ink-2"> · {p.pruefungsDatum ? formatDate(p.pruefungsDatum, { day: "numeric", month: "short" }) : "ohne Datum"}</span>
        </>
      );
  }
}

/** Die Zeilen von „Zu erledigen“ (offen oder erledigt): Link zum Punkt, Zustand, Datum und, wo es geht, „Abhaken“. */
/** `rahmen={false}`: ohne eigene Karte (auf dem Dashboard in Heute); dort fehlt auch der Zustand „Offen“, nur besondere stehen da. */
export function TodoListe({ punkte, rahmen = true }: { punkte: Punkt[]; rahmen?: boolean }) {
  return (
    <ul className={`divide-y divide-line ${rahmen ? "panel" : ""}`}>
      {punkte.map((p) => {
        const Icon = p.zustand === "erledigt" ? CheckCircle2 : TODO_ICON[p.art];
        return (
          <li key={p.key} className="flex items-stretch">
            <Link href={p.href} className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-panel/60">
              <Icon size={19} className={`shrink-0 ${p.zustand === "erledigt" ? "text-green" : "text-accent"}`} aria-hidden />
              <span className={`min-w-0 flex-1 ${p.zustand === "erledigt" ? "text-ink-2" : ""}`}>
                {todoText(p)}
                {(rahmen || p.zustand !== "offen") && (
                  <span className="mt-1 block">
                    <Pill tone={ZUSTAND_TONE[p.zustand]}>{ZUSTAND_LABEL[p.zustand]}</Pill>
                  </span>
                )}
              </span>
              <span className="num shrink-0 text-[13px] text-ink-3">{formatDate(p.datum, { day: "numeric", month: "short" })}</span>
            </Link>
            {p.abhaken && (
              <form action={abhakenAction.bind(null, p.abhaken)} className="flex shrink-0 items-center pr-2">
                <button className="btn btn-ghost btn-sm min-h-[44px] min-w-[44px] !px-2 text-ink-3 hover:text-green" aria-label="Abhaken" title="Abhaken">
                  <Check size={18} aria-hidden />
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
