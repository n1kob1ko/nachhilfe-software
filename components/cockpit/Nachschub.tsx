import { Send, Sparkles, Trash2 } from "lucide-react";
import { applyRecommendationAction, vorschauSendenAction, vorschauVerwerfenAction } from "@/app/actions";
import { einheitBudgetAction, nachschubDruckenAction, nachschubSchrittAction, nachschubSendenAction, nachschubVerwerfenAction } from "@/app/cockpit-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { VorschlagKnopf } from "@/components/cockpit/CockpitClient";
import { DruckenKnopf } from "@/components/cockpit/DruckenKnopf";
import type { KiNeu } from "@/components/device/LiveStatus";
import { Pill } from "@/components/ui";
import { BUDGET_MAX_EUR, einheitBudget, euro, euroKlein, kostenJeFunktion, kostenZeile } from "@/lib/ai/einheit-budget";
import { aiEnabled } from "@/lib/ai/router";
import { antwortText, frageText, loesungText } from "@/lib/cockpit";
import { nachschubImLiveHinweis, vorschauAufgaben, type Nachschub, type NachschubAnzeige } from "@/lib/ki-nachschub";
import { empfehlungWeg, laeuftNoch, schluesselEmpfehlung, vorschauZu } from "@/lib/ki-vorschau";
import type { NextStep } from "@/lib/recommend";
import { getSkill } from "@/lib/repo";

/**
 * **Neue Aufgaben der KI mit Vorschau** (lib/ki-nachschub.ts): „neu erstellt, ungeprüft“, jede Aufgabe mit Lösung; erst „Senden“ schickt
 * genau diese an den Schüler. In einer Einheit geht statt „Senden“ auch „Drucken“: genau diese Aufgaben als A4-Blatt, gemerkt wie
 * „Drucken“ am Schritt (`druckeNachschub`). Nur für den Lehrer; der Schüler sieht davon nichts, bis gesendet ist. Ohne Einheit
 * (Empfehlung, Diagnose; lib/ki-vorschau.ts) mit eigenen `aktionen`; in einem Blatt mit Aufgaben ohne KI sind die neuen markiert.
 */
export function NachschubVorschau({
  n,
  unitId,
  name,
  aktionen,
}: {
  n: Nachschub;
  unitId?: number;
  name: string;
  aktionen?: { senden: () => Promise<void>; verwerfen: () => Promise<void>; drucken?: () => Promise<void> };
}) {
  const skill = getSkill(n.ziel.skillId)?.name ?? "dieser Fähigkeit";
  const alle = vorschauAufgaben(n);
  const gemischt = alle.some((x) => !x.neu);
  const senden = aktionen?.senden ?? nachschubSendenAction.bind(null, unitId ?? 0, n.id);
  const verwerfen = aktionen?.verwerfen ?? nachschubVerwerfenAction.bind(null, unitId ?? 0, n.id);
  // printing belongs to a unit (marked as printed there, for „Arbeit fotografieren“)
  const drucken = aktionen ? (aktionen.drucken ?? null) : unitId ? nachschubDruckenAction.bind(null, unitId, n.id) : null;
  return (
    <section className="mt-3 grid gap-2 rounded-xl border border-amber/40 bg-amber-wash/50 px-3 py-3" aria-label="Neue Aufgaben, ungeprüft" data-testid="ki-nachschub">
      <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
        <Sparkles size={16} className="text-amber" aria-hidden /> {n.ziel.art === "diagnose" && n.ziel.blatt ? `Diagnose: ${n.ziel.blatt.topic}` : `Neue Aufgaben zu ${skill}`}
        <Pill tone="amber">neu erstellt, ungeprüft</Pill>
      </p>
      <p className="text-[14px] text-ink-2">
        {n.automatisch ? "Von der KI von selbst erstellt, im KI-Budget dieser Einheit." : "Von der KI auf deinen Tipp erstellt."} Bitte mit den Lösungen durchsehen; {name} bekommt sie erst mit „Senden“
        {drucken ? " oder auf Papier mit „Drucken“." : "."}
      </p>
      <ol className="grid gap-1.5">
        {alle.map(({ t, neu }, j) => {
          // die Antwort zuerst, darunter der Lösungsweg, wenn er mehr sagt
          const antwort = antwortText(t);
          const weg = loesungText(t);
          return (
            <li key={j} className="grid grid-cols-[1.5rem_minmax(0,1fr)] text-[15px] leading-snug">
              <span className="num text-ink-3">{j + 1}.</span>
              <span className="min-w-0 break-words">
                <span className="whitespace-pre-line">{frageText(t)}</span>
                {!neu && <span className="ml-1.5 text-[12px] text-ink-3">ohne KI</span>}
                {neu && gemischt && <span className="ml-1.5 text-[12px] font-medium text-amber">neu erstellt</span>}
                <span className="block font-medium whitespace-pre-line text-green">Lösung: {antwort}</span>
                {weg !== antwort && <span className="block text-[13.5px] whitespace-pre-line text-ink-2">{weg}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <VorschlagKnopf action={senden} label={`Senden (${alle.length} ${alle.length === 1 ? "Aufgabe" : "Aufgaben"})`} primary icon={<Send size={16} aria-hidden />} testid="ki-nachschub-senden" />
        {drucken && <DruckenKnopf action={drucken} />}
        <VorschlagKnopf action={verwerfen} label="Verwerfen" icon={<Trash2 size={16} aria-hidden />} testid="ki-nachschub-verwerfen" laeuft="Einen Moment …" />
      </div>
    </section>
  );
}

/** Die KI erstellt gerade neue Aufgaben: eine ruhige Zeile; die Seite lädt alle paar Sekunden nach, bis die Vorschau da ist. */
export function NachschubLaeuft({ automatisch }: { automatisch: boolean }) {
  return (
    <p className="mt-3 flex items-start gap-2 text-[14.5px] text-ink-2" role="status" data-testid="ki-nachschub-laeuft">
      <Sparkles size={16} className="mt-0.5 shrink-0 text-amber motion-safe:animate-pulse" aria-hidden />
      <span>
        Neue Aufgaben werden erstellt{automatisch ? ", von selbst im KI-Budget dieser Einheit" : ""}. Sie kommen hier als Vorschau.
      </span>
      <AutoRefresh seconds={4} />
    </p>
  );
}

/**
 * Im Schritt, wenn ohne KI Aufgaben fehlen: Vorschau, „wird erstellt“ oder „Neue Aufgaben erstellen · ca. 2 Cent“ auf Tippen, mit dem
 * Grund, wenn die App nicht von selbst fragt (Budget der Einheit erreicht) oder die KI nicht darf. Mit ausgeschalteter KI nur ein Satz.
 */
export function NachschubImSchritt({ a, unitId, schrittId, name }: { a: NachschubAnzeige; unitId: number; schrittId: number; name: string }) {
  const n = a.eintrag;
  if (n?.status === "bereit") return <NachschubVorschau n={n} unitId={unitId} name={name} />;
  if (n?.status === "laeuft" || a.gleich) return <NachschubLaeuft automatisch={n?.automatisch ?? true} />;
  // printed from the preview: the step says „für … gedruckt“, with „Arbeit fotografieren“
  if (n?.status === "gedruckt") return null;
  const ohne = a.bedarf.dazu.length;
  const kiAus = !a.tor.ki.erlaubt && a.tor.ki.grund === "Die KI ist aus.";
  return (
    <div className="mt-3 grid gap-1" data-testid="ki-nachschub-knopf">
      <p className="text-[14px] text-ink-2">
        {ohne ? `Ohne KI gibt es dazu nur ${ohne === 1 ? "eine passende Aufgabe" : `${ohne} passende Aufgaben`}.` : "Ohne KI gibt es dazu gerade keine passenden Aufgaben."}
      </p>
      {!kiAus && (
        <VorschlagKnopf
          action={nachschubSchrittAction.bind(null, unitId, schrittId)}
          label={`Neue Aufgaben erstellen${a.kosten ? ` · ${a.kosten}` : ""}`}
          icon={<Sparkles size={16} aria-hidden />}
          gesperrt={!a.tor.ki.erlaubt}
          testid="ki-nachschub-erstellen"
          laeuft="Wird erstellt …"
        />
      )}
      {!kiAus && <p className="text-[13px] text-ink-3">{a.hinweis ?? "Du siehst sie zuerst als Vorschau mit Lösungen."}</p>}
    </div>
  );
}

/**
 * Für den KI-Hinweis im Live-Status (components/device/LiveStatus.tsx): Kosten und Grund für „Passende Aufgaben erstellen“ und dieselbe
 * Vorschau wie im Schritt, hier auf dem Server gezeichnet. null, solange in der Einheit nichts gelöst ist.
 */
export function kiNeuImLiveHinweis(unitId: number, name: string): KiNeu | null {
  const a = nachschubImLiveHinweis(unitId);
  if (!a) return null;
  const n = a.eintrag;
  const vorschau = n?.status === "bereit" ? <NachschubVorschau n={n} unitId={unitId} name={name} /> : n?.status === "laeuft" ? <NachschubLaeuft automatisch={false} /> : null;
  return { kosten: a.kosten, gesperrt: !a.tor.ki.erlaubt, hinweis: a.hinweis, vorschau, offen: vorschau !== null };
}

/**
 * Die Kostenzeile im Unterricht: „KI heute: 0,07 € von 0,30 €“ oder „… · automatisch aus“, mit „Budget ändern“. Die Lehrkraft kann den
 * Betrag dieser Einheit senken, die Administration auch erhöhen (lib/ai/einheit-budget.ts). Nur für Lehrkräfte.
 */
export function KiKostenZeile({ unitId, admin }: { unitId: number; admin: boolean }) {
  const b = einheitBudget(unitId);
  const max = admin ? BUDGET_MAX_EUR : b.standardEur;
  const zeile = kostenZeile(b, aiEnabled());
  return (
    <div className="no-print grid gap-1 text-[13.5px] text-ink-2" data-testid="ki-kosten-einheit">
      <details className="group">
        <summary className="inline-flex min-h-[44px] cursor-pointer list-none flex-wrap items-center gap-x-2 [&::-webkit-details-marker]:hidden">
          <span className="num" data-testid="ki-kosten-zeile">
            {zeile}
          </span>
          {b.erreicht && <Pill tone="amber">erreicht</Pill>}
          {b.eigen && <span className="text-ink-3">(für diese Einheit geändert)</span>}
          <span className="font-medium text-accent group-open:hidden">Budget ändern</span>
        </summary>
        <div className="grid max-w-[34rem] gap-2 pt-1 pb-2">
          <p>
            Bis zu diesem Betrag erstellt die KI fehlende Aufgaben von selbst, immer erst als Vorschau. Darüber nur auf Tippen, mit Kosten. Standard für jede Einheit: {b.standardEur > 0 ? euro(b.standardEur) : "0 € (automatisch aus)"}.
            {!admin && " Erhöhen kann nur die Administration."}
          </p>
          {max > 0 ? (
            <form action={einheitBudgetAction.bind(null, unitId)} className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="flex flex-wrap items-center gap-2">
                Diese Einheit bis
                <input
                  name="eur"
                  type="text"
                  inputMode="decimal"
                  defaultValue={b.budgetEur.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  className="input num text-right"
                  style={{ width: "6rem", minHeight: 44 }}
                  data-testid="einheit-budget-eingabe"
                />
                €
              </label>
              <button className="btn btn-secondary" data-testid="einheit-budget-speichern">
                Speichern
              </button>
              {b.eigen && (
                <button name="standard" value="1" className="btn btn-ghost">
                  Wieder Standard
                </button>
              )}
            </form>
          ) : (
            <p className="text-ink-3">Für jede Einheit ist 0 € eingestellt; einen Betrag setzt die Administration unter Erweitert › KI-Kosten.</p>
          )}
        </div>
      </details>
    </div>
  );
}

/** Im Abschluss: was die KI in dieser Einheit gekostet hat, eine Zeile je Funktion. Nur für Lehrkräfte; nichts, wenn nichts lief. */
export function EinheitKiKosten({ unitId }: { unitId: number }) {
  const zeilen = kostenJeFunktion(unitId);
  if (!zeilen.length) return null;
  const summe = zeilen.reduce((s, z) => s + z.eur, 0);
  return (
    <div className="no-print mt-6 border-t border-line pt-4 text-[14px]" data-testid="abschluss-ki-kosten">
      <p className="font-semibold">
        KI in dieser Einheit: <span className="num">{euroKlein(summe)}</span>
      </p>
      <ul className="mt-1 grid max-w-[28rem] gap-0.5 text-ink-2">
        {zeilen.map((z) => (
          <li key={z.fn} className="flex flex-wrap justify-between gap-x-4">
            <span>
              {z.label}
              {z.aufrufe > 1 && <span className="text-ink-3"> · {z.aufrufe}-mal</span>}
            </span>
            <span className="num">{euroKlein(z.eur)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- ohne Einheit: Empfehlung und Diagnose (lib/ki-vorschau.ts) ----------

/** Die Vorschau ohne Einheit, mit „Senden“ und „Verwerfen“ für diesen Schüler; danach zurück nach `zurueck`. Läuft sie noch: eine Zeile. */
export function VorschauOhneEinheit({ n, name, zurueck }: { n: Nachschub; name: string; zurueck: string }) {
  if (n.status === "laeuft") return laeuftNoch(n) ? <NachschubLaeuft automatisch={false} /> : null;
  if (n.status !== "bereit" || n.studentId === null) return null;
  const aktionen = { senden: vorschauSendenAction.bind(null, n.studentId, n.id, zurueck), verwerfen: vorschauVerwerfenAction.bind(null, n.studentId, n.id, zurueck) };
  return <NachschubVorschau n={n} name={name} aktionen={aktionen} />;
}

/**
 * „Direkt an … senden“ bei einer Empfehlung: ohne KI wie bisher (gleich gesendet); mit KI „Aufgaben erstellen · ca. 3 Cent“, die
 * Aufgaben kommen als Vorschau darunter. Ging die KI nicht: der Grund und „Ohne KI senden“. Nichts, solange eine Vorschau offen ist.
 */
export function EmpfehlungKnopf({ studentId, rec, name, diagnosisId }: { studentId: number; rec: NextStep; name: string; diagnosisId: number | null }) {
  const n = vorschauZu(studentId, schluesselEmpfehlung(rec.key));
  if (n && (n.status === "bereit" || laeuftNoch(n))) return null;
  const weg = empfehlungWeg(studentId, rec);
  const fehler = weg.ki && n?.status === "fehler" ? n.problem : null;
  const hinweis = fehler ? `Ging gerade nicht: ${fehler} Nichts gesendet.` : weg.ki ? "Du siehst sie zuerst als Vorschau mit Lösungen." : weg.grund ? `Ohne KI: ${weg.grund}` : null;
  return (
    <>
      {weg.ki ? (
        <VorschlagKnopf
          action={applyRecommendationAction.bind(null, studentId, rec.key, diagnosisId, false)}
          label={`Aufgaben erstellen · ${weg.kosten}`}
          icon={<Sparkles size={15} aria-hidden />}
          testid="empfehlung-ki"
          laeuft="Wird erstellt …"
          klein
        />
      ) : (
        <form action={applyRecommendationAction.bind(null, studentId, rec.key, diagnosisId, false)}>
          <button className="btn btn-secondary btn-sm" title={`${rec.count} Aufgaben, ${rec.difficulty}, sofort senden`} data-testid="empfehlung-senden">
            Direkt an {name} senden
          </button>
        </form>
      )}
      {fehler && (
        <form action={applyRecommendationAction.bind(null, studentId, rec.key, diagnosisId, true)}>
          <button className="btn btn-ghost btn-sm" data-testid="empfehlung-ohne-ki">
            Ohne KI senden
          </button>
        </form>
      )}
      {hinweis && (
        <span className="order-last basis-full text-[13px] text-ink-3" data-testid="empfehlung-hinweis">
          {hinweis}
        </span>
      )}
    </>
  );
}

/** Unter einer Empfehlung: ihre Vorschau, solange sie offen ist. */
export function EmpfehlungVorschau({ studentId, rec, name, zurueck }: { studentId: number; rec: NextStep; name: string; zurueck: string }) {
  const n = vorschauZu(studentId, schluesselEmpfehlung(rec.key));
  return n ? <VorschauOhneEinheit n={n} name={name} zurueck={zurueck} /> : null;
}
