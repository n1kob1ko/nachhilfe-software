import Link from "next/link";
import { ClipboardCheck, ShieldAlert } from "lucide-react";
import { MathText } from "@/components/MathText";
import { ReviewButtons } from "@/components/ReviewButtons";
import { Pill } from "@/components/ui";
import { PAPIER_ANTWORT } from "@/lib/blatt-einlesen";
import { GRUND_TEXT, QUELLE_TEXT, zuBewertenTitel, type OffeneAntwort, type OffenerText, type ZuBewerten } from "@/lib/zu-bewerten";

const mathe = (t: string) => /[\^/√]|sqrt/.test(t);
const VORSCHLAG = { richtig: "richtig", teilweise: "teilweise", falsch: "falsch", leer: "leer" } as const;

/**
 * „Zu bewerten“ (lib/zu-bewerten.ts): die eine Liste offener Entscheidungen, im Unterricht, im Abschluss und im Profil gleich.
 * Je Zeile woher (Gerät, Papier, Probeschularbeit, Text), warum offen, die Aufgabe kurz, die Antwort, die Lösung für dich und
 * Richtig / Teilweise / Falsch (mit Punkten, wo die Aufgabe welche hat). Nur auf Lehrerseiten; `bewerten` false: nur lesen.
 */
export function ZuBewertenListe({ zeilen, bewerten = true }: { zeilen: ZuBewerten[]; bewerten?: boolean }) {
  return (
    <ul className="grid gap-3" data-testid="zu-bewerten-liste">
      {zeilen.map((z) => (z.art === "antwort" ? <AntwortZeile key={z.key} z={z} bewerten={bewerten} /> : <TextZeile key={z.key} z={z} bewerten={bewerten} />))}
    </ul>
  );
}

function Kopf({ z, wo }: { z: ZuBewerten; wo: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill tone="accent">{QUELLE_TEXT[z.quelle]}{z.art === "antwort" && z.quelle === "probe" && z.papier ? " · Papier" : ""}</Pill>
      <Pill tone="amber">{GRUND_TEXT[z.grund]}</Pill>
      <Link href={z.href} className="inline-flex min-h-[32px] min-w-0 items-center text-[13px] text-ink-2 hover:text-ink hover:underline pointer-coarse:min-h-[44px]">
        <span className="truncate">{wo}</span>
      </Link>
    </div>
  );
}

function AntwortZeile({ z, bewerten }: { z: OffeneAntwort; bewerten: boolean }) {
  return (
    <li className="grid gap-2.5 rounded-xl border border-line bg-surface px-4 py-3" data-testid="zu-bewerten-zeile" data-quelle={z.quelle} data-grund={z.grund}>
      <Kopf z={z} wo={`„${z.titel}“ · Aufgabe ${z.nr}`} />
      <p className="text-[15px] leading-snug whitespace-pre-line break-words">{mathe(z.aufgabe) ? <MathText text={z.aufgabe} /> : z.aufgabe}</p>
      <dl className="grid gap-x-4 gap-y-1 text-[14px] sm:grid-cols-[110px_minmax(0,1fr)]">
        <dt className="text-ink-2">Antwort</dt>
        <dd className="font-medium whitespace-pre-line break-words" data-testid="zu-bewerten-antwort">
          {z.antwort === PAPIER_ANTWORT ? <span className="font-normal text-ink-3">{z.nichtLesbar ? "Auf Papier, nicht lesbar" : "Auf Papier, nicht gelesen"}</span> : mathe(z.antwort) ? <MathText text={z.antwort} /> : z.antwort}
        </dd>
        <dt className="text-ink-2">Lösung</dt>
        <dd className="whitespace-pre-line break-words text-green" data-testid="zu-bewerten-loesung">
          {z.loesung ? mathe(z.loesung) ? <MathText text={z.loesung} /> : z.loesung : <span className="text-ink-3">keine hinterlegt</span>}
        </dd>
      </dl>
      {(z.grundText || z.vorschlag) && (
        <p className="flex items-start gap-1.5 text-[13.5px] text-amber">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {z.grundText}
            {z.vorschlag && `${z.grundText ? " " : ""}Vorschlag: ${VORSCHLAG[z.vorschlag]}.`}
          </span>
        </p>
      )}
      {bewerten && <ReviewButtons attemptId={z.attemptId} review={null} kurz max={z.max} />}
    </li>
  );
}

function TextZeile({ z, bewerten }: { z: OffenerText; bewerten: boolean }) {
  return (
    <li className="grid gap-2 rounded-xl border border-line bg-surface px-4 py-3" data-testid="zu-bewerten-zeile" data-quelle="text" data-grund={z.grund}>
      <Kopf z={z} wo={`„${z.titel}“ · ${z.woerter} Wörter`} />
      {z.grundText && <p className="text-[13.5px] text-ink-2">{z.grundText}</p>}
      {bewerten && (
        <Link href={z.href} className="btn btn-secondary btn-sm justify-self-start">
          {z.linkText}
        </Link>
      )}
    </li>
  );
}

/**
 * Im Unterricht neben der Schrittkarte: ein kleiner Chip „3 zu bewerten“, der die Liste aufklappt. Nichts, solange nichts offen ist.
 */
export function ZuBewertenChip({ zeilen }: { zeilen: ZuBewerten[] }) {
  if (!zeilen.length) return null;
  return (
    <details className="group -mt-2" data-testid="zu-bewerten-chip">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-full bg-amber-wash px-4 text-[15px] font-semibold text-amber [&::-webkit-details-marker]:hidden">
        <ClipboardCheck size={17} aria-hidden />
        <span>
          <span className="num">{zeilen.length}</span> zu bewerten
        </span>
      </summary>
      <div className="mt-3 grid gap-2">
        <p className="text-[14px] text-ink-2">{zuBewertenTitel(zeilen)}. Sie zählen erst, wenn du sie bewertest.</p>
        <ZuBewertenListe zeilen={zeilen} />
      </div>
    </details>
  );
}
