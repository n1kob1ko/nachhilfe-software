"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, WandSparkles } from "lucide-react";
import { bildErstellenAction, bildfolgePlanenAction, type BildfolgeFuer } from "@/app/bildfolge-actions";
import { ManualAustausch } from "@/components/ai/ManualAustausch";
import type { ErstelltesBild } from "@/lib/bildfolge";

/** Mirrors lib/bildfolge.ts (kept here so the browser does not load server code). */
const ANZAHL = [3, 4, 5, 6, 7, 8];
const MAX_BESCHREIBUNG = 600;

export type BildfolgeGenerator = {
  fuer: BildfolgeFuer;
  /** null: pictures can be made; else why not (shown instead of the form) */
  aus: string | null;
  /** estimates in euro cents: the plan and one picture */
  planCent: number;
  bildCent: number;
};

/** „ca. 4 Cent“; a price below half a cent is never shown as nothing. */
export const centText = (c: number) => (c <= 0 ? "kostenlos" : c < 0.5 ? "unter 1 Cent" : `ca. ${Math.round(c)} Cent`);

type Stand = { id: number; szenen: number[]; fertig: number[] };

/**
 * „Bilder erstellen lassen“ in the Bildgeschichte form (lib/bildfolge.ts): a short description and the number of
 * pictures; the cost stands on the button. On the click the app plans the scenes, then makes one picture after the
 * other and hands each to the form (`onBild`), where it can be sorted, described or made again. When a picture
 * fails, the ones made stay and „Weiter“ makes the rest.
 */
export function BildfolgeErstellen(p: BildfolgeGenerator & { leer: boolean; platz: number; onBild: (b: ErstelltesBild) => void; onTitel: (t: string) => void; onBusy: (on: boolean) => void }) {
  const [beschreibung, setBeschreibung] = useState("");
  const [anzahl, setAnzahl] = useState(6);
  const [laeuft, setLaeuft] = useState<null | { schritt: "plan" } | { schritt: "bild"; nr: number; von: number }>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [stand, setStand] = useState<Stand | null>(null);
  const [gezahlt, setGezahlt] = useState(0);
  const [seit, setSeit] = useState(0);
  // open at the start when the story has no picture yet; afterwards only the teacher opens and closes it
  const [offenAmAnfang] = useState(p.leer && !p.aus);
  const box = useRef<HTMLDetailsElement>(null);
  const unterwegs = useRef(false);

  useEffect(() => {
    if (!laeuft) return;
    const start = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [laeuft]);

  const n = Math.min(anzahl, p.platz);
  const gesamt = p.planCent + n * p.bildCent;

  async function bilder(s: Stand) {
    const offen = s.szenen.filter((x) => !s.fertig.includes(x));
    for (const [i, szene] of offen.entries()) {
      setLaeuft({ schritt: "bild", nr: s.fertig.length + 1, von: s.szenen.length });
      const r = await bildErstellenAction(s.id, szene);
      if (!r.ok) {
        setFehler(`${r.error}${i + s.fertig.length > 0 ? " Die fertigen Bilder bleiben." : ""}`);
        return;
      }
      s = { ...s, fertig: [...s.fertig, szene] };
      setStand(s);
      setGezahlt((g) => g + r.cent);
      p.onBild(r.bild);
    }
  }

  async function los(weiter: boolean) {
    if (unterwegs.current || p.aus) return;
    unterwegs.current = true;
    setFehler(null);
    p.onBusy(true);
    try {
      if (weiter && stand) await bilder(stand);
      else {
        if (beschreibung.trim().length < 10) {
          setFehler("Bitte kurz beschreiben, worum es in der Geschichte geht (mindestens ein Satz).");
          return;
        }
        const form = box.current?.closest("form");
        const val = (k: string) => String((form?.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "");
        setLaeuft({ schritt: "plan" });
        setGezahlt(0);
        const plan = await bildfolgePlanenAction({ beschreibung, anzahl: n, schulart: val("school_type"), klasse: Number(val("klasse")) || null }, p.fuer);
        if (!plan.ok) {
          setFehler(plan.error);
          return;
        }
        setGezahlt(plan.cent);
        p.onTitel(plan.titel);
        const s = { id: plan.id, szenen: plan.szenen.map((x) => x.szene), fertig: [] };
        setStand(s);
        await bilder(s);
      }
    } catch {
      setFehler("Keine Antwort vom Server. Die fertigen Bilder bleiben; „Weiter“ erstellt den Rest.");
    } finally {
      setLaeuft(null);
      p.onBusy(false);
      unterwegs.current = false;
    }
  }

  const offen = stand ? stand.szenen.length - stand.fertig.length : 0;
  return (
    <details ref={box} className="reveal" open={offenAmAnfang} data-testid="bilder-erstellen">
      <summary>
        <ChevronDown size={15} aria-hidden className="reveal-chevron" />
        Bilder erstellen lassen
        {!p.aus && <span className="num font-normal text-ink-3"> · {centText(p.planCent + 6 * p.bildCent)} für 6 Bilder</span>}
      </summary>
      <div className="panel mt-3 grid gap-3 px-5 py-4">
        <ManualAustausch aktiv={laeuft?.schritt === "plan"} />
        {p.aus ? (
          <p className="text-[14px] text-ink-2" role="status" data-testid="bilder-erstellen-aus">
            {p.aus}
          </p>
        ) : (
          <>
            <p className="text-[14px] text-ink-2">
              Beschreibe die Geschichte in ein, zwei Sätzen. Die App plant die Szenen und zeichnet dazu Bilder mit immer gleichen Figuren, passend zu Schulart und Klasse. Jedes Bild lässt sich danach einzeln neu erstellen. Bitte keine Namen von Schülern eintragen: Gesendet wird nur diese Beschreibung, keine Fotos und keine Daten von Schülern.
            </p>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
              <label className="field">
                <span className="label">Worum geht es?</span>
                <textarea
                  className="input"
                  rows={3}
                  maxLength={MAX_BESCHREIBUNG}
                  value={beschreibung}
                  onChange={(e) => setBeschreibung(e.target.value)}
                  placeholder="z. B. Ein Mädchen und ihr Hund finden im Park einen Drachen, der im Baum hängt, und holen ihn mit Hilfe eines Opas herunter."
                  disabled={laeuft !== null}
                  data-testid="bild-beschreibung-eingabe"
                />
              </label>
              <label className="field">
                <span className="label">Anzahl Bilder</span>
                <select className="input" value={anzahl} onChange={(e) => setAnzahl(Number(e.target.value))} disabled={laeuft !== null}>
                  {ANZAHL.map((a) => (
                    <option key={a} value={a} disabled={a > p.platz}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => void los(false)} disabled={laeuft !== null || n < 3} data-testid="bilder-erstellen-los">
                {laeuft ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <WandSparkles size={17} aria-hidden />} {n} Bilder erstellen · <span className="num">{centText(gesamt)}</span>
              </button>
              {stand && offen > 0 && !laeuft && (
                <button type="button" className="btn btn-ghost" onClick={() => void los(true)} data-testid="bilder-erstellen-weiter">
                  Weiter: {offen === 1 ? "1 Bild" : `${offen} Bilder`} · <span className="num">{centText(offen * p.bildCent)}</span>
                </button>
              )}
            </div>
            <p className="text-[13px] text-ink-3" role="status" aria-live="polite">
              {laeuft?.schritt === "plan" && <>Die Szenen werden geplant … <span className="num">{seit} s</span></>}
              {laeuft?.schritt === "bild" && (
                <>
                  Bild <span className="num">{laeuft.nr}</span> von <span className="num">{laeuft.von}</span> wird gezeichnet … <span className="num">{seit} s</span>
                </>
              )}
              {!laeuft && stand && offen === 0 && "Fertig. Die Bilder stehen unten und lassen sich wie hochgeladene sortieren und beschreiben."}
              {gezahlt > 0 && <span className="num"> Bisher bezahlt: {centText(gezahlt)}.</span>}
            </p>
            <p className="text-[13px] text-ink-3">Zählt zum monatlichen KI-Budget. Schätzung: Plan {centText(p.planCent)}, je Bild {centText(p.bildCent)}.</p>
            {fehler && (
              <p className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" role="alert" data-testid="bilder-erstellen-fehler">
                {fehler}
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}
