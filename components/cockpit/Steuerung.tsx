import { ArrowDown, ArrowUp, Check, CornerDownLeft, Crosshair, HelpCircle, Lightbulb, Presentation, Sparkles, X } from "lucide-react";
import { antwortAction, vorschlagNeuAction, vorschlagReaktionAction, vorschlagSendenAction } from "@/app/cockpit-actions";
import { VorschlagKnopf } from "@/components/cockpit/CockpitClient";
import { NachschubLaeuft, NachschubVorschau } from "@/components/cockpit/Nachschub";
import { Reveal } from "@/components/ui";
import type { Beobachtung } from "@/lib/cockpit";
import { nachschubImVorschlag } from "@/lib/ki-nachschub";
import { getUnit } from "@/lib/units";
import type { Anzeige, Knopf } from "@/lib/steuerung";
import type { Art } from "@/lib/steuerung-regeln";

const ICON: Record<Art, typeof ArrowDown> = {
  leichter: ArrowDown,
  voraussetzung: CornerDownLeft,
  fehler: Crosshair,
  erklaeren: HelpCircle,
  tafel: Presentation,
  schwerer: ArrowUp,
  weiter: Check,
};

const QUELLE = { A: "aus dem Bestand", B: "neu aus dem Generator, ohne KI", C: "" } as const;

/** Ein Knopf des Vorschlags: senden (A oder B), neu mit KI (C, mit Kosten oder gesperrt mit Grund) oder ohne Aufgabe. */
function KnopfAktion({ k, unitId, schrittId, primary, hinweis = null }: { k: Knopf; unitId: number; schrittId: number | null; primary: boolean; hinweis?: string | null }) {
  const Icon = ICON[k.option.art];
  const icon = <Icon size={17} aria-hidden />;
  if (k.quelle === "C")
    return (
      <div className="grid gap-1">
        <VorschlagKnopf
          action={vorschlagNeuAction.bind(null, unitId, k.option, schrittId)}
          label={`${k.label}${k.kosten ? ` · ${k.kosten}` : ""}`}
          icon={<Sparkles size={17} aria-hidden />}
          gesperrt={Boolean(k.gesperrt)}
          testid="vorschlag-neu"
          laeuft="Wird erstellt …"
        />
        {(k.gesperrt || hinweis) && <p className="text-[13px] text-ink-3">{k.gesperrt || hinweis}</p>}
      </div>
    );
  if (k.quelle)
    return (
      <div className="grid gap-0.5">
        <VorschlagKnopf action={vorschlagSendenAction.bind(null, unitId, k.option)} label={k.label} primary={primary} icon={icon} testid={primary ? "vorschlag-haupt" : `vorschlag-${k.option.art}`} />
        {!primary && <p className="text-[12.5px] text-ink-3">{QUELLE[k.quelle]}</p>}
      </div>
    );
  const was = k.option.art === "weiter" ? "weiter" : k.option.art === "tafel" ? "tafel" : "erklaeren";
  return (
    <VorschlagKnopf
      action={vorschlagReaktionAction.bind(null, unitId, was, schrittId)}
      label={k.label}
      primary={primary}
      icon={icon}
      testid={primary ? "vorschlag-haupt" : `vorschlag-${k.option.art}`}
      laeuft="Einen Moment …"
    />
  );
}

/**
 * **Anpassung im Unterricht** (lib/steuerung.ts): eine kompakte Karte mit dem Grund in einfachen Worten („2 Fehler:
 * Kehrwert vergessen · Brüche dividieren“), einem Hauptknopf und unter „Andere Möglichkeit“ dem Rest: die übrigen Wege,
 * neue Aufgaben der KI nur dort und mit Kosten, und „Nicht nötig“. Der KI-Hinweis der Live-Analyse steht darunter als
 * Zusatz, nie an Stelle des Vorschlags. Kommt mit jeder neuen Antwort neu (die Gerätezeile lädt die Seite nach).
 */
export function VorschlagKarte({ a, unitId, schrittId, imSchritt = false }: { a: Anzeige; unitId: number; schrittId: number | null; imSchritt?: boolean }) {
  // neue Aufgaben der KI zu C (lib/ki-nachschub.ts): von selbst im Budget der Einheit, immer erst als Vorschau; dann ohne den Knopf C
  const n = nachschubImVorschlag(unitId, schrittId, a);
  const vorschau = n?.eintrag?.status === "bereit" ? n.eintrag : null;
  const laeuft = !vorschau && Boolean(n && (n.eintrag?.status === "laeuft" || n.gleich));
  const ohneC = vorschau || laeuft;
  const andere = ohneC ? a.andere.filter((k) => k.quelle !== "C") : a.andere;
  return (
    <section
      aria-label="Vorschlag"
      data-testid="vorschlag"
      data-ausloeser={a.ausloeser}
      className={imSchritt ? "mt-4 rounded-xl border border-accent/30 bg-accent-wash/60 px-3 py-3" : "panel border-l-4 border-l-accent px-4 py-3 sm:px-5"}
    >
      <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-4">
        <p className="min-w-0 text-[15.5px] sm:flex-1">
          <span className="inline-flex items-start gap-1.5 font-semibold" data-testid="vorschlag-grund">
            <Lightbulb size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            {a.grund}
          </span>
          {a.faehigkeit && <span className="text-ink-2"> · {a.faehigkeit}</span>}
        </p>
        {a.haupt ? (
          <KnopfAktion k={a.haupt} unitId={unitId} schrittId={schrittId} primary />
        ) : ohneC ? null : (
          <p className="text-[14px] text-ink-2">Im Bestand und in den Generatoren gibt es dazu nichts.</p>
        )}
      </div>
      {vorschau && <NachschubVorschau n={vorschau} unitId={unitId} name={(getUnit(unitId)?.student_name ?? "").split(" ")[0]} />}
      {laeuft && <NachschubLaeuft automatisch={n?.eintrag?.automatisch ?? true} />}
      <Reveal label="Andere Möglichkeit" className="mt-1">
        <div className="grid gap-2 pb-1 sm:flex sm:flex-wrap sm:items-start" data-testid="vorschlag-andere">
          {andere.map((k, i) => (
            <KnopfAktion key={i} k={k} unitId={unitId} schrittId={schrittId} primary={false} hinweis={k.quelle === "C" ? (n?.hinweis ?? null) : null} />
          ))}
          <VorschlagKnopf action={vorschlagReaktionAction.bind(null, unitId, "nicht_noetig", schrittId)} label="Nicht nötig" icon={<X size={16} aria-hidden />} testid="vorschlag-nicht-noetig" laeuft="Einen Moment …" />
        </div>
      </Reveal>
      {a.zusatz && (
        <p className="mt-1.5 text-[13.5px] text-ink-2" data-testid="zusatz-hinweis">
          <span className="font-semibold">Zusatz-Hinweis:</span> {a.zusatz}
        </p>
      )}
    </section>
  );
}

const ANTWORT: { wert: Beobachtung; label: string; an: string }[] = [
  { wert: "richtig", label: "Richtig", an: "bg-green-wash text-green ring-2 ring-green" },
  { wert: "teilweise", label: "Teilweise", an: "bg-amber-wash text-amber ring-2 ring-amber" },
  { wert: "falsch", label: "Falsch", an: "bg-red-wash text-red ring-2 ring-red" },
];

/**
 * Bei einer Frage oder Kontrolle: was der Schüler mündlich geantwortet hat, mit einem Tippen. Noch einmal tippen nimmt es
 * zurück. „Falsch“ bringt den leichteren Weg als Vorschlag. Der Abschluss kann es später als Beleg lesen.
 */
export function AntwortKnoepfe({ unitId, schrittId, wert }: { unitId: number; schrittId: number; wert: Beobachtung | null }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Wie war die Antwort?" data-testid="antwort-knoepfe">
      <span className="mr-1 text-[13px] text-ink-2">Antwort war</span>
      {ANTWORT.map((x) => (
        <form key={x.wert} action={antwortAction.bind(null, unitId, schrittId, x.wert)}>
          <button
            aria-pressed={wert === x.wert}
            className={`inline-flex min-h-[44px] items-center rounded-full px-3.5 text-[14px] font-semibold transition-colors ${wert === x.wert ? x.an : "bg-surface text-ink shadow-[var(--shadow-card)] hover:bg-panel"}`}
          >
            {x.label}
          </button>
        </form>
      ))}
    </div>
  );
}
