import { Lightbulb, TriangleAlert } from "lucide-react";
import { MathText } from "@/components/MathText";
import type { Lernzettel as LernzettelDaten } from "@/lib/ai/stoffpaket";

/** Absätze eines Texts (Leerzeile = neuer Absatz). */
const absaetze = (t: string) =>
  t
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Der Lernzettel aus „Stoff vorbereiten“ (lib/stoffpaket.ts): Abschnitte mit Erklärung, Merksatz und Beispielen, dazu die
 * typischen Fehler. Dieselbe Ansicht auf dem A4-Blatt (app/arbeitsblatt/lernzettel), in der Vorschau der Lehrkraft und in
 * der Schüler-App; Farben erbt sie, damit sie im Druck schwarz und in der App im Hell- und Dunkelmodus passt.
 */
export function LernzettelInhalt({ z, titel = true }: { z: LernzettelDaten; titel?: boolean }) {
  return (
    <div className="grid gap-5" data-testid="lernzettel">
      {titel && <h2 className="text-[1.35em] font-bold leading-tight">{z.titel}</h2>}
      {z.einleitung && (
        <p className="leading-relaxed">
          <MathText text={z.einleitung} />
        </p>
      )}
      {z.abschnitte.map((a, i) => (
        <section key={i} className="grid gap-2 break-inside-avoid">
          {a.ueberschrift && (
            <h3 className="text-[1.1em] font-semibold">
              {i + 1}. <MathText text={a.ueberschrift} />
            </h3>
          )}
          {absaetze(a.text).map((p, k) => (
            <p key={k} className="leading-relaxed">
              <MathText text={p} />
            </p>
          ))}
          {a.merke && (
            <p className="flex items-start gap-2 rounded-lg border-2 border-current/30 px-3 py-2 font-medium">
              <Lightbulb size={18} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">Merke: </span>
                <MathText text={a.merke} />
              </span>
            </p>
          )}
          {a.beispiele.length > 0 && (
            <ul className="grid gap-1.5 pl-1">
              {a.beispiele.map((b, k) => (
                <li key={k} className="grid gap-0.5 border-l-4 border-current/20 pl-3">
                  <span>
                    <span className="font-semibold">Beispiel: </span>
                    <MathText text={b.aufgabe} />
                  </span>
                  {b.loesung && (
                    <span className="opacity-80">
                      Lösung: <MathText text={b.loesung} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {z.typische_fehler.length > 0 && (
        <section className="grid gap-2 break-inside-avoid">
          <h3 className="flex items-center gap-2 text-[1.1em] font-semibold">
            <TriangleAlert size={18} aria-hidden /> Typische Fehler
          </h3>
          <ul className="grid list-disc gap-1 pl-6">
            {z.typische_fehler.map((f, k) => (
              <li key={k}>
                <MathText text={f} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
