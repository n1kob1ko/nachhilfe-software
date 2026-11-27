import type { Abschnitt } from "@/lib/uebungsheft-ansicht";

/**
 * Übungsheft zu den Fehlern (lib/uebungsheft-ansicht.ts): vor der ersten Aufgabe eines Teils sein Titel, der Merke-Kasten und „aus deinem
 * Text“; vor der ersten Aufgabe einer Übung ihr Titel, die Anweisung und das Beispiel. Am Tablet, in der Vorschau und im Ausdruck
 * (`druck`: schwarz auf weiß, ohne Farbflächen).
 */
export function HeftAbschnitt({ a, druck = false }: { a: Abschnitt; druck?: boolean }) {
  if (!a.teil && !a.uebung) return null;
  return (
    <div className={druck ? "heft-abschnitt mt-4 mb-2 break-inside-avoid" : "mt-6 mb-2 first:mt-2"} data-testid="heft-abschnitt">
      {a.teil && (
        <div className="mb-4">
          <h2 className={druck ? "border-b-2 border-black pb-1 text-[17px] font-bold" : "text-[22px] leading-tight font-semibold tracking-[-0.01em]"}>
            Teil {a.teil.buchstabe} – {a.teil.titel}
          </h2>
          {(a.teil.merke.length > 0 || a.teil.beispiele.length > 0) && (
            <div className={druck ? "mt-2 border border-black px-3 py-2 text-[13px]" : "mt-3 rounded-2xl border border-[#f1d58a] bg-[#fff8e1] px-4 py-3 text-[16px] text-[#3d3215]"} data-testid="heft-merke">
              {a.teil.merke.length > 0 && (
                <>
                  <p className="font-semibold">Merke</p>
                  <ul className="mt-1 grid gap-1">
                    {a.teil.merke.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </>
              )}
              {a.teil.beispiele.length > 0 && (
                <div className={a.teil.merke.length ? "mt-2" : ""}>
                  <p className="font-semibold">Aus deinem Text</p>
                  <ul className="mt-1 grid gap-1">
                    {a.teil.beispiele.map((b, i) => (
                      <li key={i}>
                        <span className={druck ? "line-through" : "text-red line-through decoration-1"}>✗ {b.falsch}</span>
                        <span aria-hidden> → </span>
                        <span className={druck ? "font-semibold" : "font-semibold text-green"}>✓ {b.richtig}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {a.uebung && (
        <div>
          <h3 className={druck ? "text-[14px] font-bold" : "text-[18px] font-semibold"}>
            Übung {a.uebung.nr}: {a.uebung.titel}
          </h3>
          {a.uebung.auftrag && <p className={druck ? "text-[13px]" : "mt-0.5 text-[16px] text-ink-2"}>{a.uebung.auftrag}</p>}
          {a.uebung.beispiel && <p className={druck ? "mt-0.5 text-[12.5px] italic" : "mt-1 text-[15px] text-ink-2 italic"}>Beispiel: {a.uebung.beispiel}</p>}
        </div>
      )}
    </div>
  );
}

/** Oben im Heft: was die Lehrkraft vorweg sagt; unten: die Kontroll-Liste für den nächsten eigenen Text. */
export function HeftVorweg({ text, druck = false }: { text: string; druck?: boolean }) {
  if (!text) return null;
  return <p className={druck ? "mb-3 text-[13px] italic" : "mb-2 rounded-2xl bg-panel px-4 py-3 text-[16px] leading-relaxed"} data-testid="heft-vorweg">{text}</p>;
}

export function HeftKontrolle({ punkte, druck = false }: { punkte: string[]; druck?: boolean }) {
  if (!punkte.length) return null;
  return (
    <div className={druck ? "mt-4 border border-black px-3 py-2 text-[13px] break-inside-avoid" : "mt-6 rounded-2xl border border-line bg-surface px-5 py-4"} data-testid="heft-kontrolle">
      <p className={druck ? "font-bold" : "text-[17px] font-semibold"}>Deine Kontroll-Liste für den nächsten Text</p>
      <ul className="mt-2 grid gap-1">
        {punkte.map((k, i) => (
          <li key={i}>☐ {k}</li>
        ))}
      </ul>
    </div>
  );
}
