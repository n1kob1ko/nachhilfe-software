import { Gauge } from "lucide-react";
import { Info } from "@/components/Info";
import { Pill } from "@/components/ui";
import { SKALEN_TEXT, type Einschaetzung, type Stufe } from "@/lib/einschaetzung";
import type * as repo from "@/lib/repo";

/** Farbe eines Gesamteindrucks: gut grün, mittel gelb, schwierig rot. */
export function stufeTon(stufe: Stufe | null): "green" | "amber" | "red" | "neutral" {
  return stufe === null ? "neutral" : stufe >= 4 ? "green" : stufe === 3 ? "amber" : "red";
}

/** Der Gesamteindruck als kleines Schild, z. B. im Lernverlauf. */
export function EinschaetzungPill({ e }: { e: Einschaetzung }) {
  if (e.stufe === null) return null;
  return (
    <Pill tone={stufeTon(e.stufe)} title={e.saetze.join(" ")}>
      {e.titel}
    </Pill>
  );
}

const SKALEN: { feld: "understanding" | "concentration" | "participation" | "motivation"; label: string }[] = [
  { feld: "understanding", label: "Verständnis" },
  { feld: "concentration", label: "Konzentration" },
  { feld: "participation", label: "Mitarbeit" },
  { feld: "motivation", label: "Motivation" },
];

/** Fünf Punkte, davon `wert` gefüllt. */
function Punkte({ wert }: { wert: number }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i <= wert ? "bg-ink" : "bg-line-strong"}`} />
      ))}
    </span>
  );
}

/**
 * Wie der Schüler sich getan hat: Gesamteindruck, die Begründung in Sätzen und die Skalen der
 * Dokumentation. Werte, die noch automatisch sind, tragen den Grund aus den Daten; was der Lehrer
 * eingetragen hat, steht ohne.
 */
export function EinschaetzungKarte({ e, lesson, auto }: { e: Einschaetzung | null; lesson: repo.Lesson; auto: Set<string> }) {
  const skalen = SKALEN.filter((s) => lesson[s.feld]);
  if (!e && !skalen.length) return null;
  const ton = stufeTon(e?.stufe ?? null);
  return (
    <section className="panel px-5 py-4" aria-label="Einschätzung">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={ton === "neutral" ? { background: "var(--panel)", color: "var(--ink-2)" } : { background: `var(--${ton}-wash)`, color: `var(--${ton})` }}
        >
          <Gauge size={18} aria-hidden />
        </span>
        <h2 className="text-[17px] font-semibold">{e?.titel ?? "Einschätzung"}</h2>
        {e && e.aufgaben > 0 && (
          <span className="text-[13px] text-ink-3">
            aus {e.aufgaben} {e.aufgaben === 1 ? "Aufgabe" : "Aufgaben"} am Gerät
            <Info label="Wie entsteht die Einschätzung?">
              Ohne KI, aus dem, was die App misst: richtig beim ersten Versuch, Hilfen, Fehler, Zeit pro Aufgabe, längere Pausen und der Vergleich mit den letzten Einheiten. Erst ab 4 Aufgaben gibt es Werte auf den Skalen. Was du in der Dokumentation änderst, bleibt so.
            </Info>
          </span>
        )}
      </div>
      {e && e.saetze.length > 0 && (
        <ul className="mt-3 grid gap-1 text-[15px]">
          {e.saetze.map((s) => (
            <li key={s} className="text-pretty">
              {s}
            </li>
          ))}
        </ul>
      )}
      {skalen.length > 0 && (
        <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-line pt-3 sm:grid-cols-2">
          {skalen.map(({ feld, label }) => {
            const wert = lesson[feld]!;
            const automatisch = auto.has(feld);
            const grund = automatisch && feld !== "motivation" ? e?.gruende[feld] : undefined;
            return (
              <div key={feld}>
                <dt className="flex items-center gap-2 text-[13px] text-ink-2">
                  {label}
                  {automatisch && <span className="rounded-full bg-panel px-1.5 text-[11px] font-medium text-ink-3">automatisch</span>}
                </dt>
                <dd className="mt-0.5 flex items-center gap-2 text-[14.5px] font-medium">
                  <Punkte wert={wert} />
                  {SKALEN_TEXT[feld][wert - 1]}
                </dd>
                {grund && <dd className="text-[12.5px] text-ink-3">{grund}</dd>}
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
