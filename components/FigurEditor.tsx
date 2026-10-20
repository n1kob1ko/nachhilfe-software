"use client";

import { ChevronUp, Pencil, X } from "lucide-react";
import { useState } from "react";
import { FigurBild } from "@/components/Figur";
import { DIAGRAMM_FORMEN, FIGUR_ARTEN, KREIS_TEILE, type DiagrammForm, type Figur, type FlaechenForm, type KreisTeil, type Zahlenstrahl } from "@/lib/figur";
import {
  felderAus,
  figurAus,
  figurHinweise,
  MASSE,
  mitForm,
  SEITEN,
  type DiagrammFelder,
  type FigurFelder,
  type FlaechenFelder,
  type KoordFelder,
  type KreisFelder,
  type StrahlFelder,
} from "@/lib/figur-editor";

const FORMEN: Record<FlaechenForm, string> = {
  rechteck: "Rechteck",
  quadrat: "Quadrat",
  dreieck: "Dreieck",
  gleichschenklig: "Gleichschenkeliges Dreieck",
  rechtwinklig: "Rechtwinkeliges Dreieck",
  "l-form": "L-Form",
};
const SCHREIBWEISE: Record<Zahlenstrahl["format"], string> = { ganz: "Ganze Zahlen", dezimal: "Dezimalzahlen", bruch: "Brüche" };

/**
 * Das Bild einer Aufgabe im Editor (components/WorksheetEditor.tsx): Vorschau mit den gesuchten Werten, darunter
 * auf Wunsch ein kleines Formular je Art von Bild (lib/figur-editor.ts). Jede Änderung geht durch dieselbe
 * Prüfung wie alles, was gespeichert wird; nur ein Bild, das stimmt, kommt mit `onChange` zur Aufgabe, sonst der
 * Grund. Die Lösung der Aufgabe rechnet die App nicht neu aus.
 */
export function FigurEditor({ figure, onChange, onRemove }: { figure: Figur; onChange: (figur: Figur | null, fehler: string | null) => void; onRemove: () => void }) {
  // das Bild vor dem Bearbeiten: daraus folgt die Lage von Höhe, Diagonale und Text in einer Figur
  const [alt] = useState(figure);
  const [felder, setFelder] = useState<FigurFelder>(() => felderAus(figure));
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const aendern = (next: FigurFelder) => {
    setFelder(next);
    const r = figurAus(next, alt);
    setFehler(r.fehler);
    onChange(r.figur, r.fehler);
  };
  const hinweise = fehler ? [] : figurHinweise(figure);

  return (
    <div className="rounded-lg border border-line bg-paper px-4 py-3" aria-label="Bild zur Aufgabe">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink-2">Bild zur Aufgabe: {FIGUR_ARTEN[figure.art]} (mit den gesuchten Werten)</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={offen} onClick={() => setOffen((o) => !o)}>
            {offen ? <ChevronUp size={14} aria-hidden /> : <Pencil size={14} aria-hidden />} {offen ? "Schließen" : "Bild bearbeiten"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>
            Bild entfernen
          </button>
        </div>
      </div>
      <FigurBild figure={figure} loesung />
      {fehler && (
        <p className="mt-2 rounded-lg bg-red-wash px-3 py-2 text-[13px] text-red" role="alert">
          So geht das Bild nicht: {fehler} Bis das passt, bleibt das Bild oben, wie es war.
        </p>
      )}
      {hinweise.map((h) => (
        <p key={h} className="mt-2 text-[13px] text-amber">
          Achtung: {h}
        </p>
      ))}
      {offen && (
        <div className="mt-3 grid gap-3 border-t border-line pt-3">
          {felder.art === "zahlenstrahl" && <StrahlEingabe v={felder} set={aendern} />}
          {felder.art === "koordinaten" && <KoordEingabe v={felder} set={aendern} />}
          {felder.art === "figur" && <FlaechenEingabe v={felder} set={aendern} />}
          {felder.art === "kreis" && <KreisEingabe v={felder} set={aendern} />}
          {felder.art === "diagramm" && <DiagrammEingabe v={felder} set={aendern} />}
        </div>
      )}
      <p className="mt-2 text-[12px] text-ink-3">Die Lösung rechnet die App nicht neu aus. Änderst du Zahlen im Bild, prüf, ob Aufgabe, Lösung und Antworten noch passen.</p>
    </div>
  );
}

// ---------- kleine Bausteine ----------

function Feld({ label, value, onChange, zahl = false, hint, className = "" }: { label: string; value: string; onChange: (v: string) => void; zahl?: boolean; hint?: string; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="label">{label}</span>
      <input className="input" value={value} inputMode={zahl ? "decimal" : undefined} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}
function Haken({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[44px] items-center gap-2 text-[13px] text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--accent)]" />
      {label}
    </label>
  );
}
function Auswahl<K extends string>({ label, value, optionen, onChange }: { label: string; value: K; optionen: Record<K, string>; onChange: (v: K) => void }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as K)}>
        {(Object.keys(optionen) as K[]).map((k) => (
          <option key={k} value={k}>
            {optionen[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Eine Liste von Zeilen (Marken, Punkte, Werte …) mit Entfernen und „+ Zeile“; `spalten`: breiter Name (Diagramm). */
function Zeilen<T>({ titel, plus, zeilen, leer, neu, onChange, zeile, spalten = "grid-cols-[minmax(0,4.5rem)_minmax(0,1fr)_minmax(0,1fr)]" }: { titel: string; plus: string; zeilen: T[]; leer: string; neu: T; onChange: (next: T[]) => void; zeile: (z: T, set: (z: T) => void, i: number) => React.ReactNode; spalten?: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="label">{titel}</span>
      {zeilen.length === 0 && <span className="text-[12px] text-ink-3">{leer}</span>}
      {zeilen.map((z, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className={`grid min-w-0 flex-1 ${spalten} gap-2`}>{zeile(z, (n) => onChange(zeilen.map((x, j) => (j === i ? n : x))), i)}</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(zeilen.filter((_, j) => j !== i))} aria-label={`${titel}: Zeile ${i + 1} entfernen`}>
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
      <button type="button" className="justify-self-start text-[13px] font-semibold text-accent hover:underline" onClick={() => onChange([...zeilen, neu])}>
        + {plus}
      </button>
    </div>
  );
}
/** Ein schmales Eingabefeld in einer Zeile, mit Beschriftung für Screenreader. */
function Klein({ label, value, onChange, zahl = false }: { label: string; value: string; onChange: (v: string) => void; zahl?: boolean }) {
  return <input className="input min-w-0" value={value} placeholder={label} aria-label={label} inputMode={zahl ? "decimal" : undefined} onChange={(e) => onChange(e.target.value)} />;
}

// ---------- je Art von Bild ----------

function StrahlEingabe({ v, set }: { v: StrahlFelder; set: (v: StrahlFelder) => void }) {
  const p = (patch: Partial<StrahlFelder>) => set({ ...v, ...patch });
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Feld label="Anfang" value={v.anfang} onChange={(anfang) => p({ anfang })} zahl />
        <Feld label="Ende" value={v.ende} onChange={(ende) => p({ ende })} zahl />
        <Feld label="Ein Teilstück" value={v.schritt} onChange={(schritt) => p({ schritt })} zahl hint="10, 0,1 oder 1/4" />
        <Auswahl label="Schreibweise" value={v.format} optionen={SCHREIBWEISE} onChange={(format) => p({ format })} />
      </div>
      <Feld label="Zahlen unter den Strichen" value={v.zahlen} onChange={(zahlen) => p({ zahlen })} hint="Mit ; trennen, etwa 300; 350; 400" />
      <Zeilen
        titel="Marken"
        plus="Marke"
        zeilen={v.marken}
        leer="Keine Marke."
        neu={{ name: "", wert: "" }}
        onChange={(marken) => p({ marken })}
        zeile={(m, s) => (
          <>
            <Klein label="Name" value={m.name} onChange={(name) => s({ ...m, name })} />
            <Klein label="bei der Zahl" value={m.wert} onChange={(wert) => s({ ...m, wert })} zahl />
            <span />
          </>
        )}
      />
      {v.intervall && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Feld label="Bereich von" value={v.intervall.von} onChange={(von) => p({ intervall: { ...v.intervall!, von } })} zahl hint="leer: ohne Anfang" />
          <Feld label="Bereich bis" value={v.intervall.bis} onChange={(bis) => p({ intervall: { ...v.intervall!, bis } })} zahl hint="leer: ohne Ende" />
          <Haken label="Anfang gehört dazu" checked={v.intervall.vonDabei} onChange={(vonDabei) => p({ intervall: { ...v.intervall!, vonDabei } })} />
          <Haken label="Ende gehört dazu" checked={v.intervall.bisDabei} onChange={(bisDabei) => p({ intervall: { ...v.intervall!, bisDabei } })} />
        </div>
      )}
    </>
  );
}

function KoordEingabe({ v, set }: { v: KoordFelder; set: (v: KoordFelder) => void }) {
  const p = (patch: Partial<KoordFelder>) => set({ ...v, ...patch });
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Feld label="x von" value={v.xVon} onChange={(xVon) => p({ xVon })} zahl />
        <Feld label="x bis" value={v.xBis} onChange={(xBis) => p({ xBis })} zahl />
        <Feld label="y von" value={v.yVon} onChange={(yVon) => p({ yVon })} zahl />
        <Feld label="y bis" value={v.yBis} onChange={(yBis) => p({ yBis })} zahl />
        <Feld label="Ein Kästchen ist" value={v.einheit} onChange={(einheit) => p({ einheit })} zahl />
        <Feld label="Zahl an jedem … Kästchen" value={v.zahlenAlle} onChange={(zahlenAlle) => p({ zahlenAlle })} zahl />
      </div>
      <Zeilen
        titel="Punkte"
        plus="Punkt"
        zeilen={v.punkte}
        leer="Kein Punkt."
        neu={{ name: "", x: "", y: "" }}
        onChange={(punkte) => p({ punkte })}
        zeile={(q, s) => (
          <>
            <Klein label="Name" value={q.name} onChange={(name) => s({ ...q, name })} />
            <Klein label="x" value={q.x} onChange={(x) => s({ ...q, x })} zahl />
            <Klein label="y" value={q.y} onChange={(y) => s({ ...q, y })} zahl />
          </>
        )}
      />
      <Zeilen
        titel="Geraden"
        plus="Gerade"
        zeilen={v.geraden}
        leer="Keine Gerade."
        neu={{ name: "g", k: "", d: "" }}
        onChange={(geraden) => p({ geraden })}
        zeile={(g, s) => (
          <>
            <Klein label="Name" value={g.name} onChange={(name) => s({ ...g, name })} />
            <Klein label="k (Steigung)" value={g.k} onChange={(k) => s({ ...g, k })} zahl />
            <Klein label="d" value={g.d} onChange={(d) => s({ ...g, d })} zahl />
          </>
        )}
      />
      <span className="text-[12px] text-ink-3">Eine Gerade ist y = k · x + d; k auch als Bruch, etwa −1/2.</span>
    </>
  );
}

function FlaechenEingabe({ v, set }: { v: FlaechenFelder; set: (v: FlaechenFelder) => void }) {
  const p = (patch: Partial<FlaechenFelder>) => set({ ...v, ...patch });
  const seiten = SEITEN[v.form];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Auswahl label="Form" value={v.form} optionen={FORMEN} onChange={(form) => set(mitForm(v, form))} />
        {MASSE[v.form].map((m) => (
          <Feld key={m.key} label={m.label} value={v.masse[m.key] ?? ""} onChange={(x) => p({ masse: { ...v.masse, [m.key]: x } })} zahl />
        ))}
      </div>
      <span className="text-[12px] text-ink-3">Die Längen bestimmen die Form im Bild. Was an den Seiten steht, schreibst du darunter.</span>
      <div className="grid gap-1.5">
        <span className="label">Beschriftung der Seiten (leer: keine)</span>
        {v.seiten.map((s, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
            <span className="text-[13px] text-ink-3">{seiten[i] ?? `Seite ${i + 1}`}</span>
            <Klein label={`Seite ${seiten[i] ?? i + 1}: Beschriftung`} value={s.text} onChange={(text) => p({ seiten: v.seiten.map((x, j) => (j === i ? { ...x, text } : x)) })} />
            <Klein label={`Seite ${seiten[i] ?? i + 1}: Lösung (nur Lehrerfassung)`} value={s.loesung} onChange={(loesung) => p({ seiten: v.seiten.map((x, j) => (j === i ? { ...x, loesung } : x)) })} />
          </div>
        ))}
        <span className="text-[12px] text-ink-3">Gesuchtes mit „?“ beschriften (etwa b = ?) und die Lösung daneben (b = 4 cm).</span>
      </div>
      {v.strecken.map((s, i) => (
        <div key={i} className="grid grid-cols-2 gap-3">
          <Feld label={v.form === "rechteck" || v.form === "quadrat" ? "Diagonale" : "Höhe"} value={s.text} onChange={(text) => p({ strecken: v.strecken.map((x, j) => (j === i ? { ...x, text } : x)) })} />
          <Feld label="Lösung (nur Lehrerfassung)" value={s.loesung} onChange={(loesung) => p({ strecken: v.strecken.map((x, j) => (j === i ? { ...x, loesung } : x)) })} />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <Feld label="Namen der Ecken" value={v.namen} onChange={(namen) => p({ namen })} hint="Mit Leerzeichen, etwa A B C" />
        <Feld label="Text in der Figur" value={v.innen} onChange={(innen) => p({ innen })} hint="Etwa A = 48 cm²" />
      </div>
    </>
  );
}

function KreisEingabe({ v, set }: { v: KreisFelder; set: (v: KreisFelder) => void }) {
  const p = (patch: Partial<KreisFelder>) => set({ ...v, ...patch });
  const STRECKEN: Record<KreisFelder["strecke"], string> = { radius: "Radius", durchmesser: "Durchmesser", keine: "Keine" };
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Auswahl<KreisTeil> label="Teil" value={v.teil} optionen={KREIS_TEILE} onChange={(teil) => p({ teil })} />
        {v.teil === "sektor" && <Feld label="Winkel in Grad" value={v.winkel} onChange={(winkel) => p({ winkel })} zahl />}
        <Auswahl label="Eingezeichnet" value={v.strecke} optionen={STRECKEN} onChange={(strecke) => p({ strecke })} />
        <Feld label="Mittelpunkt heißt" value={v.mitte} onChange={(mitte) => p({ mitte })} />
      </div>
      {v.strecke !== "keine" && (
        <div className="grid grid-cols-2 gap-3">
          <Feld label="Beschriftung" value={v.text} onChange={(text) => p({ text })} hint={v.strecke === "radius" ? "Etwa r = 5 cm oder r = ?" : "Etwa d = 8 cm oder d = ?"} />
          <Feld label="Lösung (nur Lehrerfassung)" value={v.loesung} onChange={(loesung) => p({ loesung })} />
        </div>
      )}
      <div className="flex flex-wrap gap-x-5">
        <Haken label="Fläche getönt" checked={v.getoent} onChange={(getoent) => p({ getoent })} />
        {v.teil !== "kreis" && <Haken label="Übrigen Kreis gestrichelt dazu" checked={v.ganzerKreis} onChange={(ganzerKreis) => p({ ganzerKreis })} />}
        {v.teil !== "kreis" && <Haken label={v.teil === "viertelkreis" ? "Rechten Winkel zeichnen" : "Winkel anschreiben"} checked={v.winkelZeigen} onChange={(winkelZeigen) => p({ winkelZeigen })} />}
      </div>
    </>
  );
}

function DiagrammEingabe({ v, set }: { v: DiagrammFelder; set: (v: DiagrammFelder) => void }) {
  const p = (patch: Partial<DiagrammFelder>) => set({ ...v, ...patch });
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Auswahl<DiagrammForm> label="Art" value={v.form} optionen={DIAGRAMM_FORMEN} onChange={(form) => p({ form })} />
        <Feld label="Überschrift" value={v.titel} onChange={(titel) => p({ titel })} className="sm:col-span-2" />
        <Feld label="Achse zählt" value={v.achse} onChange={(achse) => p({ achse })} hint="Etwa Anzahl Kinder" />
        <Feld label="Achse von" value={v.min} onChange={(min) => p({ min })} zahl />
        <Feld label="Achse bis" value={v.max} onChange={(max) => p({ max })} zahl />
        <Feld label="Abstand der Linien" value={v.schritt} onChange={(schritt) => p({ schritt })} zahl />
        <Feld label="Zahl an jeder … Linie" value={v.zahlenAlle} onChange={(zahlenAlle) => p({ zahlenAlle })} zahl />
      </div>
      <Zeilen
        titel="Werte"
        spalten="grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)] sm:grid-cols-[minmax(0,12rem)_minmax(0,8rem)_auto]"
        plus="Wert"
        zeilen={v.werte}
        leer="Noch kein Wert."
        neu={{ name: "", wert: "", gesucht: false }}
        onChange={(werte) => p({ werte })}
        zeile={(w, s) => (
          <>
            <Klein label="Name" value={w.name} onChange={(name) => s({ ...w, name })} />
            <Klein label="Wert" value={w.wert} onChange={(wert) => s({ ...w, wert })} zahl />
            {v.form === "linie" ? (
              <span />
            ) : (
              <label className="flex min-h-[44px] items-center gap-1.5 text-[13px] text-ink-2">
                <input type="checkbox" checked={w.gesucht} onChange={(e) => s({ ...w, gesucht: e.target.checked })} className="accent-[var(--accent)]" />
                gesucht
              </label>
            )}
          </>
        )}
      />
      <Haken label="Jeden Wert anschreiben" checked={v.werteZeigen} onChange={(werteZeigen) => p({ werteZeigen })} />
      <span className="text-[12px] text-ink-3">Ein Wert zwischen zwei Linien wird im Bild angeschrieben, damit er genau ablesbar bleibt. „gesucht“ zeigt statt der Säule ein „?“.</span>
    </>
  );
}
