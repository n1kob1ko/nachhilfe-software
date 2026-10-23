import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { Info } from "@/components/Info";
import { formatDate } from "@/components/ui";
import { notizLabel, type SchuelerNotiz, type SchuelerWorte, type Wunsch } from "@/lib/schueler-notiz";

/** The student's words, as quotes: the tapped answers, then the free text. Never a rating. */
function Worte({ notiz }: { notiz: SchuelerNotiz }) {
  return (
    <>
      {notiz.auswahl.map((w) => `„${notizLabel(w)}“`).join(" · ")}
      {notiz.auswahl.length > 0 && notiz.text && <br />}
      {notiz.text && <span className="whitespace-pre-line">„{notiz.text}“</span>}
    </>
  );
}

const tag = (iso: string) => formatDate(iso, { weekday: "short", day: "numeric", month: "numeric" });

const ERKLAERUNG = (name: string) =>
  `${name} schreibt das selbst in der Schüler-App: nach einer Einheit „Was war heute schwer?“, jederzeit „Für nächstes Mal“. Es zählt nicht für Lernstand oder Einschätzung und geht nicht an die KI. „Passt zu“ sucht die App in den Wörtern, ohne KI.`;

/**
 * „Von Lena“ (lib/schueler-notiz.ts): was der Schüler vor dieser Einheit geschrieben hat, als Zitat, im Cockpit
 * und bei „Einheit vorbereiten“. Darunter die Fähigkeiten, die seine Wörter nennen.
 */
export function SchuelerWorteKarte({ worte, name }: { worte: SchuelerWorte; name: string }) {
  const skills = [...new Map(worte.treffer.flatMap((t) => t.skills).map((s) => [s.id, s])).values()];
  return (
    <section className="panel px-5 py-4" aria-label={`Von ${name}`} data-testid="schueler-worte">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold">
        <MessageSquareText size={17} className="shrink-0 text-accent" aria-hidden />
        Von {name} geschrieben
        <Info label="Was ist das?">{ERKLAERUNG(name)}</Info>
      </p>
      <div className="mt-2 grid gap-3">
        {worte.wunsch && (
          <div>
            <p className="text-[13px] text-ink-3">Für nächstes Mal · {tag(worte.wunsch.updated_at)}</p>
            <blockquote className="mt-0.5 border-l-2 border-accent-bright pl-3 text-[15.5px] whitespace-pre-line">„{worte.wunsch.text}“</blockquote>
          </div>
        )}
        {worte.schwer && (
          <div>
            <p className="text-[13px] text-ink-3">Was war schwer? · nach der Einheit am {tag(worte.schwer.started_at)}</p>
            <blockquote className="mt-0.5 border-l-2 border-accent-bright pl-3 text-[15.5px]">
              <Worte notiz={worte.schwer.notiz} />
            </blockquote>
          </div>
        )}
      </div>
      {skills.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
          <span>Passt zu:</span>
          {skills.map((s) => (
            <Link key={s.id} href={`/faehigkeiten/${s.id}`} className="rounded-full bg-accent-wash px-2.5 py-0.5 font-medium text-accent hover:underline">
              {s.name}
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}

/**
 * „Was war heute schwer?“ bei der Einheit selbst: auf ihrer Seite als Karte, `kompakt` als Zeile im Lernverlauf.
 */
export function SchuelerNotizAnzeige({ notiz, name, kompakt }: { notiz: SchuelerNotiz; name: string; kompakt?: boolean }) {
  if (kompakt) {
    return (
      <p className="mt-1.5 max-w-[80ch] text-[14px]" data-testid="schueler-notiz">
        <span className="text-ink-3">Notiz von {name}:</span> <Worte notiz={notiz} />
      </p>
    );
  }
  return (
    <section className="panel px-5 py-4" aria-label={`Notiz von ${name}`} data-testid="schueler-notiz">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold">
        <MessageSquareText size={17} className="shrink-0 text-accent" aria-hidden />
        Notiz von {name} zu dieser Einheit
        <Info label="Was ist das?">{ERKLAERUNG(name)}</Info>
      </p>
      <blockquote className="mt-2 border-l-2 border-accent-bright pl-3 text-[15.5px]">
        <Worte notiz={notiz} />
      </blockquote>
    </section>
  );
}

/** „Für nächstes Mal“ im Lernverlauf, bei der Einheit, für die es geschrieben war. */
export function WunschZeile({ wunsch, name }: { wunsch: Wunsch; name: string }) {
  return (
    <p className="mt-1.5 max-w-[80ch] text-[14px] whitespace-pre-line" data-testid="schueler-wunsch">
      <span className="text-ink-3">Vorher von {name}:</span> „{wunsch.text}“
    </p>
  );
}
