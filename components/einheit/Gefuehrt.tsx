import Link from "next/link";
import { ArrowLeft, ArrowRight, Camera, Check, Eye, Keyboard, Loader2, NotebookPen, PenLine, Printer, RotateCcw, Send, ShieldAlert, Sparkles, Wrench } from "lucide-react";
import {
  ansichtAction,
  papierOhneFotoAction,
  textFehlerAction,
  uebenPapierAction,
  uebenTippenAction,
  heftNochmalAction,
  kurztestFertigAction,
  schrittAction,
  stoffFertigAction,
  stoffNochmalAction,
  stoffUebernehmenAction,
  stoffVerwerfenAction,
  stufeAction,
  themaAction,
  uebenAction,
  wegAction,
} from "@/app/ablauf-actions";
import { minitestAction } from "@/app/minitest-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { endUnitAction } from "@/app/session-actions";
import { LangText } from "@/components/cockpit/Ablauf";
import { PraesentationSchritt } from "@/components/cockpit/PraesentationSchritt";
import { AntwortKnoepfe } from "@/components/cockpit/Steuerung";
import { VorgabeKarte } from "@/components/cockpit/Vorgabe";
import { VorgabeForm } from "@/components/cockpit/VorgabeForm";
import { EinheitBeenden } from "@/components/EinheitBeenden";
import { FormKnopf } from "@/components/FormKnopf";
import { StoffpaketForm } from "@/components/StoffpaketForm";
import { aiEnabled, aiReadsImages } from "@/lib/ai";
import { cockpit, FRAGE_ARTEN, planFuehrung, type CockpitDaten, type PlanStep } from "@/lib/cockpit";
import {
  STUFE_LABEL,
  erklaerPaket,
  erklaerSchritte,
  freiesThema,
  gedruckteUebung,
  kurztestStand,
  leseAblauf,
  naechsteUebung,
  offenesStoffBlatt,
  ohneFaehigkeit,
  stoffpaketDerEinheit,
  stufenFuer,
  textFehler,
  uebenStand,
  type Ablauf,
  type Auswertung,
  type FreiesThema,
  type Stufe,
  type TextFehler,
} from "@/lib/einheit-ablauf";
import { gehtAlsHeft, heftDerEinheit, type Heft } from "@/lib/heft";
import { getLernpaket, type LernpaketMitSchritten } from "@/lib/lernpakete";
import { getPraesEntwurf } from "@/lib/praesentation-ki";
import { kostenSchaetzung, stoffpaketMoeglich, vorschlagFach, type Stoffpaket } from "@/lib/stoffpaket";
import { dayOf } from "@/lib/exams";
import { keinNameBestaetigt } from "@/lib/kein-name";
import { studentDevice } from "@/lib/live";
import { MINITEST_STANDARD, letzterStoff, stoffDatum, type Stoff } from "@/lib/minitest";
import * as repo from "@/lib/repo";
import type { UnitView } from "@/lib/units";
import { materialZurWahl, vorgabeDerEinheit } from "@/lib/vorgabe";
import { ROLLE_SATZ } from "@/lib/pruefungsstoff";
import { tagMonat } from "@/lib/vorbereitung-auto";

const first = (n: string) => n.split(" ")[0];
const skillName = (id: string | null) => (id ? (repo.getSkill(id)?.name ?? id) : "");
const SCHREIB_FAECHER = new Set(["Deutsch", "Englisch"]);

/**
 * Der **geführte Ablauf** der laufenden Einheit (niko, 26.11.2026; lib/einheit-ablauf.ts): oben die Stufen, darunter genau
 * eine Karte mit einer Frage und einem großen Knopf. Alles andere des früheren Cockpits liegt unter „Mehr Werkzeuge“.
 *
 *   Start ─┬─ Weiter mit dem Stoff vom letzten Mal → Kurztest → Üben → Hausübung
 *          └─ Neues Thema → Stoff (Fotos) → Erklären (Sprechtext, Präsentation, Fragen) → Üben → Hausübung
 */
export async function Gefuehrt({ unit, student, folien, stoffHand = false }: { unit: UnitView; student: repo.Student; folien: number | null; stoffHand?: boolean }) {
  const a = leseAblauf(unit.id);
  const name = first(student.name);
  const stufen = stufenFuer(a.weg);
  const jetzt = stufen.indexOf(a.stufe);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5" data-testid="gefuehrt">
      <nav aria-label="Ablauf der Einheit" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stufen.length}, minmax(0, 1fr))` }} data-testid="ablauf-stufen">
        {stufen.map((s, i) => {
          const aktiv = s === a.stufe;
          const fertig = i < jetzt;
          const tippbar = !aktiv && (s === "start" || a.weg !== null);
          const inhalt = (
            <>
              <span className={`block h-1.5 rounded-full ${aktiv ? "bg-accent" : fertig ? "bg-accent-bright" : "bg-line"}`} aria-hidden />
              <span className={`mt-1.5 flex items-center justify-center gap-1 text-[13px] sm:text-[14px] ${aktiv ? "font-semibold text-accent" : fertig ? "text-ink-2" : "text-ink-3"}`}>
                {fertig && <Check size={13} aria-hidden />}
                {STUFE_LABEL[s]}
              </span>
            </>
          );
          return tippbar ? (
            <form key={s} action={stufeAction.bind(null, unit.id, s)}>
              <button className="treffer w-full text-center" data-testid={`stufe-${s}`}>
                {inhalt}
              </button>
            </form>
          ) : (
            <div key={s} aria-current={aktiv ? "step" : undefined} className="text-center" data-testid={`stufe-${s}`}>
              {inhalt}
            </div>
          );
        })}
      </nav>

      {a.stufe === "start" && <StartKarte unit={unit} name={name} />}
      {a.stufe === "kurztest" && <KurztestKarte unit={unit} a={a} name={name} />}
      {a.stufe === "stoff" && <StoffKarte unit={unit} student={student} name={name} hand={stoffHand} />}
      {a.stufe === "erklaeren" && <ErklaerenKarte unit={unit} a={a} name={name} folien={folien} />}
      {a.stufe === "ueben" && <UebenKarte unit={unit} a={a} name={name} />}
      {a.stufe === "schluss" && <SchlussKarte unit={unit} name={name} />}

      <form action={ansichtAction.bind(null, unit.id, true)} className="border-t border-line pt-2">
        <button className="treffer mx-auto flex min-h-[44px] items-center gap-2 text-[14.5px] text-ink-2 hover:text-ink" data-testid="mehr-werkzeuge">
          <Wrench size={16} aria-hidden /> Mehr Werkzeuge
          <span className="text-[13px] text-ink-3">Whiteboard, Lernpaket, Arbeit fotografieren und mehr</span>
        </button>
      </form>
    </div>
  );
}

// ---------- Bausteine ----------

function Karte({ titel, children, testid }: { titel: string; children: React.ReactNode; testid: string }) {
  return (
    <section className="panel grid gap-4 px-5 py-5 sm:px-7 sm:py-6" aria-label={titel} data-testid={testid}>
      <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] sm:text-[24px]">{titel}</h2>
      {children}
    </section>
  );
}

/** Der eine große Knopf einer Stufe; `zweit`: der ruhigere zweite Weg darunter. */
function Gross({ action, children, icon, zweit = false, testid }: { action: () => Promise<void>; children: React.ReactNode; icon?: React.ReactNode; zweit?: boolean; testid?: string }) {
  return (
    <form action={action}>
      <FormKnopf icon={icon} className={`btn ${zweit ? "btn-secondary" : "btn-primary"} btn-lg w-full !text-[17px]`} style={{ whiteSpace: "normal", textAlign: "center", paddingBlock: 10 }} data-testid={testid}>
        {children}
      </FormKnopf>
    </form>
  );
}

function Leise({ children }: { children: React.ReactNode }) {
  return <p className="-mt-2 text-center text-[14px] text-ink-2">{children}</p>;
}

/** Eine kleine Zeile mit Knopf, für das, was selten gebraucht wird. */
function Klein({ action, children, testid }: { action: () => Promise<void>; children: React.ReactNode; testid?: string }) {
  return (
    <form action={action} className="flex justify-center">
      <button className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline" data-testid={testid}>
        {children}
      </button>
    </form>
  );
}

/** Fortschritt und Ergebnis: ein Balken, darunter je Thema richtig und falsch. */
function Ergebnis({ e, laeuft }: { e: Auswertung; laeuft: boolean }) {
  const anteil = e.aufgaben ? Math.round((e.fertig / e.aufgaben) * 100) : 0;
  return (
    <div className="grid gap-2" data-testid="ablauf-ergebnis">
      <div className="h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-[#2f7de1]" style={{ width: `${anteil}%` }} />
      </div>
      <p className="flex flex-wrap justify-between gap-x-4 text-[15px]">
        <span className="num">
          {e.fertig} von {e.aufgaben} {laeuft ? "gemacht" : "Aufgaben"}
        </span>
        <span className="num">
          <span className="font-semibold text-green">{e.richtig} richtig</span>
          {e.falsch > 0 && <span className="font-semibold text-red"> · {e.falsch} falsch</span>}
        </span>
      </p>
      {e.themen.length > 1 ? (
        <ul className="grid divide-y divide-line border-t border-line">
          {e.themen.map((t) => (
            <li key={t.skillId} className="flex flex-wrap justify-between gap-x-4 py-2 text-[14.5px]">
              <span>{t.name}</span>
              <span className="num text-ink-2">
                {t.richtig} richtig{t.falsch > 0 && <span className="font-semibold text-red"> · {t.falsch} falsch</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------- Start ----------

/** „Was machen wir heute?“: weiter mit dem Stoff vom letzten Mal (zuerst ein Kurztest) oder neues Thema. */
function StartKarte({ unit, name }: { unit: UnitView; name: string }) {
  const stoff = letzterStoff(unit.student_id, unit.id);
  return (
    <Karte titel="Was machen wir heute?" testid="ablauf-start">
      {stoff ? (
        <>
          <p className="text-[16px] leading-relaxed text-ink-2">
            Letztes Mal (<span className="num">{stoffDatum(stoff)}</span>): <span className="font-semibold text-ink">{stoffInhalt(stoff)}</span>. {letztesErgebnis(stoff)}
          </p>
          <Gross action={wegAction.bind(null, unit.id, "weiter")} icon={<ArrowRight size={19} aria-hidden />} testid="weg-weiter">
            Weiter mit „{stoffKurz(stoff)}“
          </Gross>
          <Leise>Zuerst ein Kurztest am Tablet, danach Übungen passend zum Ergebnis.</Leise>
          <Gross action={wegAction.bind(null, unit.id, "neu")} icon={<Camera size={19} aria-hidden />} zweit testid="weg-neu">
            Neues Thema
          </Gross>
          <Leise>{name} zeigt den Stoff, du fotografierst ihn ab.</Leise>
        </>
      ) : (
        <>
          <p className="text-[16px] leading-relaxed text-ink-2">Vom letzten Mal gibt es keine Aufgaben am Tablet. Darum beginnt die Einheit mit dem Stoff von heute.</p>
          <Gross action={wegAction.bind(null, unit.id, "neu")} icon={<Camera size={19} aria-hidden />} testid="weg-neu">
            Neues Thema
          </Gross>
          <Leise>{name} zeigt den Stoff, du fotografierst ihn ab.</Leise>
        </>
      )}
    </Karte>
  );
}

/** „Brüche kürzen, Brüche erweitern“: die Fähigkeiten, höchstens drei. */
function stoffInhalt(stoff: Stoff): string {
  const namen = stoff.faehigkeiten.slice(0, 3).map((f) => f.name);
  return namen.length ? `${namen.join(", ")}${stoff.faehigkeiten.length > 3 ? " …" : ""}` : "Wiederholung";
}
/** Für den Knopf: das erste Thema, mit „…“, wenn es mehr sind. */
function stoffKurz(stoff: Stoff): string {
  const f = stoff.faehigkeiten;
  return f.length ? `${f[0].name}${f.length > 1 ? " …" : ""}` : "Wiederholung";
}
function letztesErgebnis(stoff: Stoff): string {
  const n = stoff.aufgaben.length;
  const r = stoff.aufgaben.filter((x) => x.richtig).length;
  const schwach = stoff.faehigkeiten.filter((f) => f.falsch > 0).slice(0, 2).map((f) => f.name);
  return `${r} von ${n} richtig${schwach.length ? `, Fehler bei ${schwach.join(" und ")}` : ""}.`;
}

// ---------- Kurztest ----------

function KurztestKarte({ unit, a, name }: { unit: UnitView; a: Ablauf; name: string }) {
  const k = kurztestStand(unit.id);
  const geraet = studentDevice(unit);
  if (!k) {
    const stoff = letzterStoff(unit.student_id, unit.id);
    return (
      <Karte titel="Kurztest zum Start" testid="ablauf-kurztest">
        <p className="text-[16px] leading-relaxed text-ink-2">
          {MINITEST_STANDARD} Aufgaben{stoff ? ` zum Stoff vom ${stoffDatum(stoff)}: ${stoffInhalt(stoff)}` : ""}. Ein Versuch je Aufgabe, ohne Tipps. So siehst du, was {name} noch weiß.
        </p>
        <form action={minitestAction}>
          <input type="hidden" name="unit_id" value={unit.id} />
          <input type="hidden" name="anzahl" value={MINITEST_STANDARD} />
          <FormKnopf name="ziel" value="geraet" icon={<Send size={19} aria-hidden />} className="btn btn-primary btn-lg w-full !text-[17px]" data-testid="kurztest-senden">
            {geraet === "laptop" ? "Kurztest auf den Laptop senden" : "Kurztest ans Tablet senden"}
          </FormKnopf>
        </form>
        {!geraet && <Leise>Noch kein Tablet verbunden: oben „Gerät verbinden“, sonst liegt der Test am Lernlink.</Leise>}
        <div className="flex flex-wrap justify-center gap-x-6">
          <form action={minitestAction}>
            <input type="hidden" name="unit_id" value={unit.id} />
            <input type="hidden" name="anzahl" value={MINITEST_STANDARD} />
            <button name="ziel" value="druck" className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline" data-testid="kurztest-drucken">
              <Printer size={16} aria-hidden /> Lieber auf Papier
            </button>
          </form>
          <Klein action={stufeAction.bind(null, unit.id, "ueben")} testid="kurztest-auslassen">
            Ohne Kurztest gleich üben
          </Klein>
        </div>
      </Karte>
    );
  }
  // only printed: the teacher says when it is done; „Arbeit fotografieren“ takes the paper in (lib/papier-einheit.ts)
  if (k.assignmentId === null) {
    return (
      <Karte titel="Kurztest auf Papier" testid="ablauf-kurztest">
        <p className="text-[16px] leading-relaxed text-ink-2">Wenn {name} fertig ist: fotografieren, dann zählt das Ergebnis für die Übungen.</p>
        <Link href={`/einheiten/${unit.id}/papier?uebung=${k.worksheetId}`} className="btn btn-primary btn-lg w-full !text-[17px]" data-testid="kurztest-fotografieren">
          <Camera size={19} aria-hidden /> Kurztest fotografieren
        </Link>
        <div className="flex flex-wrap justify-center gap-x-6">
          <Link href={`/arbeitsblatt/${k.worksheetId}?einheit=${unit.id}`} className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline">
            <Printer size={16} aria-hidden /> Nochmal drucken
          </Link>
          <Klein action={stufeAction.bind(null, unit.id, "ueben")}>Weiter zum Üben</Klein>
        </div>
      </Karte>
    );
  }
  const fertig = k.fertig || a.kurztestFertig;
  if (!fertig) {
    return (
      <Karte titel={`${name} macht den Kurztest`} testid="ablauf-kurztest">
        <Ergebnis e={k.auswertung} laeuft />
        <p className="text-[14.5px] text-ink-2">Die Seite zeigt den Stand von selbst. Wie es gelaufen ist, sieht {name} erst am Ende.</p>
        <Klein action={kurztestFertigAction.bind(null, unit.id)} testid="kurztest-fertig">
          Kurztest ist fertig
        </Klein>
      </Karte>
    );
  }
  const n = naechsteUebung(a, k.auswertung, uebenStand(unit.id).einzeln);
  const fehler = k.auswertung.themen.filter((t) => t.falsch > 0);
  return (
    <Karte titel={`Kurztest: ${k.auswertung.richtig} von ${k.auswertung.aufgaben} richtig`} testid="ablauf-kurztest">
      <Ergebnis e={k.auswertung} laeuft={false} />
      {n ? (
        <>
          <Gross action={uebenAction.bind(null, unit.id, n.skillId)} icon={<Send size={19} aria-hidden />} testid="ueben-senden">
            {n.art === "fehler" ? `Aufgaben zu den Fehlern bei „${skillName(n.skillId)}“ senden` : `Übungen zu „${skillName(n.skillId)}“ senden`}
          </Gross>
          <Leise>{fehler.length ? "Neue Aufgaben genau zu den Fehlern, passend zum Lernstand." : "Alles richtig: die Übung wird etwas schwerer."}</Leise>
        </>
      ) : (
        <Gross action={stufeAction.bind(null, unit.id, "ueben")} icon={<ArrowRight size={19} aria-hidden />} testid="weiter-ueben">
          Weiter zum Üben
        </Gross>
      )}
    </Karte>
  );
}

// ---------- Stoff ----------

/** So entsteht im geführten Ablauf alles aus den Fotos: Präsentation mit Sprechtext und Fragen, Übungsblatt, Lernzettel. */
const STOFF_TEILE_GEFUEHRT = ["praesentation", "uebung", "lernzettel"];

/**
 * Der Stoff von heute. Mit KI (der Normalfall): Fotos vom Buch, Heft oder Stoffzettel, ein Knopf, und „Stoff vorbereiten“
 * (lib/stoffpaket.ts) macht daraus in einem Lauf die Präsentation mit Sprechtext und kurzen Fragen zum Mitkommen und ein
 * Übungsblatt fürs Tablet; danach „Übernehmen und erklären“. Ohne KI, oder wenn der Lehrer nur das Thema eintragen will
 * (`hand`): „Was steht heute an?“ (lib/vorgabe.ts), dann erklärt die App mit ihrem eigenen Erklärtext.
 */
function StoffKarte({ unit, student, name, hand }: { unit: UnitView; student: repo.Student; name: string; hand: boolean }) {
  const p = stoffpaketDerEinheit(unit.id);
  if (p && !hand && p.status !== "uebernommen") return <StoffpaketKarte unit={unit} p={p} name={name} />;
  if (p?.status === "uebernommen" && !hand) {
    return (
      <Karte titel={`Heute: ${p.thema || "der Stoff von den Fotos"}`} testid="ablauf-stoff">
        <p className="text-[16px] leading-relaxed text-ink-2">Präsentation, Sprechtext und Übungsblatt sind fertig.</p>
        <Gross action={stufeAction.bind(null, unit.id, "erklaeren")} icon={<ArrowRight size={19} aria-hidden />} testid="stoff-fertig">
          Weiter: erklären
        </Gross>
        <Klein action={stoffVerwerfenAction.bind(null, unit.id)} testid="stoff-anderer">
          <Camera size={15} aria-hidden /> Anderen Stoff fotografieren
        </Klein>
      </Karte>
    );
  }
  const geht = stoffpaketMoeglich({ studentId: student.id, dateien: 1 });
  const v = vorgabeDerEinheit(unit.id);
  // „nur das Thema eintragen“ ist schon geschehen: dann gilt das, nicht noch einmal das Formular für die Fotos
  if (geht.ok && !hand && !v) {
    const fach = unit.subject || vorschlagFach(student);
    return (
      <Karte titel="Stoff abfotografieren" testid="ablauf-stoff">
        <p className="text-[16px] leading-relaxed text-ink-2">
          Buchseiten, Seiten im Heft oder den Stoffzettel. Daraus entsteht eine Präsentation, die das Thema erklärt, mit Sprechtext für dich und kurzen Fragen, ob {name} mitkommt, dazu ein Übungsblatt fürs Tablet.
        </p>
        <StoffpaketForm
          studentId={student.id}
          unitId={unit.id}
          faecher={[fach]}
          fach={fach}
          keinNameBestaetigt={keinNameBestaetigt(unit)}
          kosten={kostenSchaetzung()}
          gesperrt={null}
          material={materialZurWahl(unit.student_id)
            .slice(0, 12)
            .map(({ id, titel, art, datum }) => ({ id, titel, art, datum }))}
          einfach={{ teile: STOFF_TEILE_GEFUEHRT, knopf: "Präsentation und Übungen erstellen", textTitel: `Oder kurz: was muss ${name} lernen?`, platzhalter: "z. B. Brüche kürzen, Seite 45 bis 48" }}
        />
        <div className="flex justify-center">
          <Link href={`/einheiten/${unit.id}?stoff=hand`} className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline" data-testid="stoff-hand">
            Ohne Präsentation: nur das Thema eintragen
          </Link>
        </div>
      </Karte>
    );
  }
  if (!v) {
    const heute = dayOf(new Date());
    const tests = repo
      .upcomingTests(heute, unit.student_id)
      .slice(0, 6)
      .map((t) => ({ id: t.id, label: `${t.title || `${t.kind} ${t.subject}`} am ${tagMonat(t.date)}` }));
    const material = materialZurWahl(unit.student_id).map((m) => ({ ...m, rolle: m.rolle ? ROLLE_SATZ[m.rolle] : "" }));
    return (
      <Karte titel="Stoff abfotografieren" testid="ablauf-stoff">
        <p className="text-[16px] leading-relaxed text-ink-2">Stoffzettel, Buchseiten oder Seiten im Heft. Oder kurz hineinschreiben, was {name} lernen muss.</p>
        <VorgabeForm unitId={unit.id} tests={tests} material={material} kiLiest={aiEnabled("stoffzettel") && aiReadsImages("stoffzettel")} keinNameBestaetigt={keinNameBestaetigt(unit)} />
        {hand && geht.ok && (
          <div className="flex justify-center">
            <Link href={`/einheiten/${unit.id}`} className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline">
              <Sparkles size={15} aria-hidden /> Doch mit Präsentation aus den Fotos
            </Link>
          </div>
        )}
      </Karte>
    );
  }
  const c = cockpit(unit.id, { mitPlan: true });
  const themen = v.skillIds.map(skillName).filter(Boolean);
  // kein Thema mit Aufgaben der App (Nebenfach ohne KI): das Eingetippte ist selbst das Thema, und es geht weiter
  const frei = themen.length ? null : freiesThema(unit.id);
  const zuBestaetigen = v.punkte.some((x) => x.zuordnung === "unklar" && x.vorschlaege.length);
  const fehlt = themen.length ? ohneFaehigkeit(unit.id) : [];
  return (
    <Karte titel={themen.length ? `Heute: ${themen.slice(0, 3).join(", ")}${themen.length > 3 ? " …" : ""}` : frei ? `Heute: ${frei.titel}` : "Stoff gelesen"} testid="ablauf-stoff">
      <VorgabeKarte unit={unit} c={c} />
      {themen.length ? (
        <>
          <Gross action={stoffFertigAction.bind(null, unit.id)} icon={<ArrowRight size={19} aria-hidden />} testid="stoff-fertig">
            Weiter: {themen[0]} erklären
          </Gross>
          <Leise>Danach Übungen am Tablet zu jedem Thema.</Leise>
          {fehlt.length > 0 && (
            <p className="text-center text-[14px] text-ink-2" data-testid="stoff-ohne-aufgaben">
              Dazu gibt es heute keine Aufgaben am Tablet: {fehlt.slice(0, 4).join(", ")}
              {fehlt.length > 4 ? " …" : ""}. {zuBestaetigen ? "Oben bestätigen, wenn eines davon gemeint ist." : "Das erklärst und übst du selbst."}
            </p>
          )}
        </>
      ) : frei ? (
        <>
          <p className="text-[16px] leading-relaxed text-ink-2" data-testid="stoff-frei">
            {zuBestaetigen
              ? "Oben kurz bestätigen, welches Thema gemeint ist: dann gibt es dazu Aufgaben am Tablet. Du kannst auch ohne weitermachen."
              : `Zu diesem Stoff hat die App keine eigenen Aufgaben. Die Einheit geht trotzdem weiter: du erklärst mit Buch oder Heft, ${name} übt mit einem Text oder am Whiteboard, und das Thema steht am Ende in der Dokumentation.`}
          </p>
          <Gross action={stoffFertigAction.bind(null, unit.id)} icon={<ArrowRight size={19} aria-hidden />} zweit={zuBestaetigen} testid="stoff-fertig">
            {zuBestaetigen ? "Ohne Aufgaben der App weiter" : "Weiter: erklären"}
          </Gross>
        </>
      ) : (
        <p className="text-[15px] text-ink-2">Noch kein Thema erkannt. Schreib oben unter „Ändern“ kurz dazu, was {name} heute lernen muss.</p>
      )}
    </Karte>
  );
}

/** „Stoff vorbereiten“ in der Einheit: läuft (die Seite lädt sich neu), ging nicht (noch einmal), oder fertig (übernehmen). */
function StoffpaketKarte({ unit, p, name }: { unit: UnitView; p: Stoffpaket; name: string }) {
  const ansehen = (
    <Link href={`/schueler/${p.student_id}/stoff/${p.id}`} className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline" data-testid="stoff-ansehen">
      <Eye size={15} aria-hidden /> Alles genau ansehen
    </Link>
  );
  if (p.status === "laeuft") {
    return (
      <Karte titel="Präsentation und Übungen werden erstellt" testid="ablauf-stoff">
        <AutoRefresh seconds={4} />
        <p className="flex items-center gap-3 text-[17px] font-semibold" aria-live="polite" data-testid="stoff-laeuft">
          <Loader2 size={20} className="animate-spin text-accent" aria-hidden /> {p.schritt || "Unterlagen lesen"} …
        </p>
        <p className="text-[15px] leading-relaxed text-ink-2">Das dauert meist 2 bis 5 Minuten. Inzwischen kann {name} schon im Buch lesen oder du erklärst mit den Fotos. Die Seite zeigt von selbst, wenn es fertig ist.</p>
      </Karte>
    );
  }
  if (p.status === "fehler") {
    return (
      <Karte titel="Das hat nicht geklappt" testid="ablauf-stoff">
        <p className="text-[16px] text-ink-2">{p.fehler || "Das Erstellen ging nicht."}</p>
        <Gross action={stoffNochmalAction.bind(null, unit.id)} icon={<RotateCcw size={19} aria-hidden />} testid="stoff-nochmal">
          Noch einmal mit denselben Fotos
        </Gross>
        <div className="flex flex-wrap justify-center gap-x-6">
          <Klein action={stoffVerwerfenAction.bind(null, unit.id)}>
            <Camera size={15} aria-hidden /> Andere Fotos
          </Klein>
          <Link href={`/einheiten/${unit.id}?stoff=hand`} className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline">
            Ohne Präsentation weiter
          </Link>
        </div>
      </Karte>
    );
  }
  const entwurf = p.praes_entwurf_id ? getPraesEntwurf(p.praes_entwurf_id) : null;
  const folien = entwurf?.deck.folien.length ?? 0;
  const paket = p.paket_id ? getLernpaket(p.paket_id) : null;
  const fragen = paket ? erklaerSchritte(paket).filter((s) => s.lehrer_fragt.trim()).length : 0;
  const aufgaben = p.uebung_id ? repo.listTasks(p.uebung_id).length : 0;
  const teile = [
    folien ? `Präsentation mit ${folien} Folien` : null,
    paket ? `Sprechtext für dich${fragen ? ` und ${fragen} kurze Fragen, ob ${name} mitkommt` : ""}` : null,
    aufgaben ? `Übungsblatt mit ${aufgaben} Aufgaben fürs Tablet` : null,
    p.lernzettel ? `Lernzettel in der App von ${name}` : null,
  ].filter((x): x is string => Boolean(x));
  return (
    <Karte titel={`Fertig: ${p.thema || "der Stoff"}`} testid="ablauf-stoff">
      <ul className="grid gap-1.5 text-[16px]">
        {teile.map((t) => (
          <li key={t} className="flex items-start gap-2">
            <Check size={18} className="mt-0.5 shrink-0 text-green" aria-hidden /> {t}
          </li>
        ))}
      </ul>
      {(p.unsicher.length > 0 || p.weggelassen.length > 0) && (
        <div className="grid gap-1 rounded-xl bg-amber-wash px-4 py-3 text-[14.5px]" data-testid="stoff-pruefen">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldAlert size={16} aria-hidden /> Kurz prüfen
          </p>
          <ul className="grid list-disc gap-0.5 pl-5">
            {[...p.unsicher, ...p.weggelassen].slice(0, 4).map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}
      <Gross action={stoffUebernehmenAction.bind(null, unit.id)} icon={<ArrowRight size={19} aria-hidden />} testid="stoff-uebernehmen">
        Übernehmen und erklären
      </Gross>
      <div className="flex flex-wrap justify-center gap-x-6">
        {ansehen}
        <Klein action={stoffVerwerfenAction.bind(null, unit.id)}>
          <Camera size={15} aria-hidden /> Andere Fotos
        </Klein>
      </div>
    </Karte>
  );
}

// ---------- Erklären ----------

/** Der Planschritt, der das Thema erklärt (mit Präsentation und Fragen), sonst null. */
function erklaerSchritt(c: CockpitDaten, skillId: string): PlanStep | null {
  return c.plan.find((s) => s.skillId === skillId && s.art === "erklaeren") ?? c.plan.find((s) => s.skillId === skillId && s.art === "grundlage") ?? null;
}

function ErklaerenKarte({ unit, a, name, folien }: { unit: UnitView; a: Ablauf; name: string; folien: number | null }) {
  const thema = a.aktuell ?? a.skillIds[0] ?? null;
  const frei = thema ? null : freiesThema(unit.id);
  if (frei) return <FreiErklaeren unit={unit} name={name} frei={frei} />;
  if (!thema) {
    return (
      <Karte titel="Zuerst den Stoff" testid="ablauf-erklaeren">
        <p className="text-[16px] text-ink-2">Es gibt noch kein Thema für heute.</p>
        <Gross action={stufeAction.bind(null, unit.id, "stoff")} icon={<Camera size={19} aria-hidden />}>
          Stoff abfotografieren
        </Gross>
      </Karte>
    );
  }
  const paket = erklaerPaket(unit.id);
  if (paket) return <PaketErklaeren unit={unit} a={a} name={name} folien={folien} paket={paket} thema={thema} />;
  const c = cockpit(unit.id, { mitPlan: true });
  const schritt = erklaerSchritt(c, thema);
  const f = planFuehrung(unit.id, schritt ?? { id: 0, uebung: null, skillId: thema, art: "erklaeren" });
  const andere = a.skillIds.filter((id) => id !== thema);
  return (
    <Karte titel={`${skillName(thema)} erklären`} testid="ablauf-erklaeren">
      {schritt && <PraesentationSchritt c={c} unitId={unit.id} schrittId={schritt.id} folienOffen={folien === schritt.id} titel="Präsentation" />}
      {f.sagt && (
        <div>
          <p className="text-[13px] font-semibold text-ink-2">Das sagst du</p>
          <div className="mt-0.5">
            <LangText text={f.sagt} />
          </div>
        </div>
      )}
      {f.zeigt && (
        <div>
          <p className="text-[13px] font-semibold text-ink-2">{unit.subject === "Mathematik" ? "Ein Beispiel zum Vorrechnen" : "Ein Beispiel zum Zeigen"}</p>
          <p className="mt-0.5 text-[17px] leading-relaxed whitespace-pre-line">{f.zeigt.aufgabe}</p>
          <p className="mt-1 text-[16px] leading-relaxed whitespace-pre-line">
            <span className="font-semibold text-green">Lösung: </span>
            {f.zeigt.loesung}
          </p>
        </div>
      )}
      {f.fragt && (
        <div className="rounded-xl bg-accent-wash px-4 py-3" data-testid="abruf-frage">
          <p className="text-[13px] font-semibold text-accent">Kurz fragen: kommt {name} mit?</p>
          <p className="mt-0.5 text-[18px] leading-relaxed whitespace-pre-line">{f.fragt}</p>
          {f.antwort && (
            <p className="mt-1 text-[15px] whitespace-pre-line text-ink-2">
              <span className="font-semibold text-green">Erwartet: </span>
              {f.antwort}
            </p>
          )}
          {schritt && <AntwortKnoepfe unitId={unit.id} schrittId={schritt.id} wert={c.stand.antworten[schritt.id] ?? null} />}
        </div>
      )}
      {!f.sagt && !f.fragt && !schritt && <p className="text-[15px] text-ink-2">Zu diesem Thema gibt es noch keinen Erklärtext. Erkläre es mit den Fotos vom Stoff.</p>}
      <Gross action={uebenAction.bind(null, unit.id, thema)} icon={<Send size={19} aria-hidden />} testid="ueben-senden">
        Verstanden: Übungen ans Tablet senden
      </Gross>
      <Leise>{gehtAlsHeft(unit) ? `${name} rechnet im Heft am Tablet, mit dem Stift. Beim „Fertig“ prüft die KI alles auf einmal.` : `Neue Aufgaben zu ${skillName(thema)}, passend zum Lernstand von ${name}.`}</Leise>
      <AndereWege unit={unit} skillId={thema} />
      {andere.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-5">
          {andere.slice(0, 3).map((id) => (
            <Klein key={id} action={themaAction.bind(null, unit.id, id, "erklaeren")}>
              Zuerst {skillName(id)} erklären
            </Klein>
          ))}
        </div>
      )}
    </Karte>
  );
}

/**
 * „Erklären“ zu einem Thema, zu dem die App keine Fähigkeit kennt (lib/einheit-ablauf.ts `freiesThema`, etwa Biologie ohne KI):
 * die Karte zeigt, was die Lehrkraft für heute geschrieben und fotografiert hat, und führt weiter zum Üben.
 */
function FreiErklaeren({ unit, name, frei }: { unit: UnitView; name: string; frei: FreiesThema }) {
  return (
    <Karte titel={`${frei.titel} erklären`} testid="ablauf-erklaeren">
      <div data-testid="erklaeren-frei">
        <p className="text-[13px] font-semibold text-ink-2">Das steht heute an</p>
        {frei.punkte.length ? (
          <ul className="mt-1 grid list-disc gap-0.5 pl-5 text-[17px] leading-relaxed">
            {frei.punkte.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-0.5 text-[17px] leading-relaxed whitespace-pre-line">{frei.text || "Der Stoff von den Fotos."}</p>
        )}
        {frei.umfang && <p className="mt-1 text-[15px] text-ink-2">{frei.umfang}</p>}
      </div>
      {frei.materialIds.length > 0 && (
        <div className="flex flex-wrap gap-x-5">
          {frei.materialIds.map((id, i) => (
            <a key={id} href={`/material/${id}/datei`} target="_blank" rel="noreferrer" className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline">
              <Eye size={15} aria-hidden /> Foto {i + 1} ansehen
            </a>
          ))}
        </div>
      )}
      <p className="text-[15px] leading-relaxed text-ink-2">
        Dazu hat die App keinen eigenen Erklärtext. Erkläre mit dem Buch oder dem Heft von {name}; am Whiteboard könnt ihr gemeinsam zeichnen und schreiben.
      </p>
      <Gross action={stufeAction.bind(null, unit.id, "ueben")} icon={<ArrowRight size={19} aria-hidden />} testid="weiter-ueben">
        Erklärt: weiter zum Üben
      </Gross>
      <div className="flex justify-center">
        <Link href={`/tafel/${unit.id}`} className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline" data-testid="frei-tafel">
          <PenLine size={15} aria-hidden /> Whiteboard öffnen
        </Link>
      </div>
    </Karte>
  );
}

/**
 * „Üben“ zu einem Thema ohne Fähigkeit: die App hat dazu keine Aufgaben, also bietet sie an, was ohne geht. Ein Text am Tablet
 * oder auf Papier (zusammenfassen in eigenen Worten) ist der große Knopf, daneben das Whiteboard; dann die Hausübung.
 */
function FreiUeben({ unit, name, frei, text }: { unit: UnitView; name: string; frei: FreiesThema; text: TextFehler | null }) {
  const cls = "treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline";
  return (
    <Karte titel={`Üben: ${frei.titel}`} testid="ablauf-ueben">
      <p className="text-[16px] leading-relaxed text-ink-2" data-testid="ueben-frei">
        Zu diesem Thema hat die App keine eigenen Aufgaben. So kann {name} trotzdem üben: das Gelernte in eigenen Worten aufschreiben, am Tablet oder auf Papier.
      </p>
      {text ? (
        <Link href={`/texte/${text.textId}/korrektur`} className="btn btn-primary btn-lg w-full !text-[17px]" data-testid="frei-text-ansehen">
          <Eye size={19} aria-hidden /> Text von {name} ansehen: {text.titel}
        </Link>
      ) : (
        <Link href={`/einheiten/${unit.id}/text?thema=${encodeURIComponent(frei.titel)}`} className="btn btn-primary btn-lg w-full !text-[17px]" data-testid="frei-text">
          <PenLine size={19} aria-hidden /> {name} schreibt eine Zusammenfassung
        </Link>
      )}
      <div className="flex flex-wrap justify-center gap-x-6">
        <Link href={`/tafel/${unit.id}`} className={cls} data-testid="frei-tafel">
          Gemeinsam am Whiteboard
        </Link>
        <Klein action={stufeAction.bind(null, unit.id, "schluss")} testid="weiter-schluss">
          Fertig geübt: weiter zur Hausübung
        </Klein>
      </div>
    </Karte>
  );
}

/**
 * „Erklären“ mit dem Lernpaket aus den Fotos von heute: ein Schritt nach dem anderen, je Schritt die Folie der Präsentation, „Das
 * sagst du“ und, wo es eine gibt, die Frage mit der erwarteten Antwort und Richtig / Teilweise / Falsch. „Weiter“ geht zum
 * nächsten Schritt, am Ende gehen die Übungen ans Tablet (zuerst das Übungsblatt aus dem Stoff).
 */
function PaketErklaeren({ unit, a, name, folien, paket, thema }: { unit: UnitView; a: Ablauf; name: string; folien: number | null; paket: LernpaketMitSchritten; thema: string }) {
  const schritte = erklaerSchritte(paket);
  const i = Math.max(0, schritte.findIndex((s) => s.id === a.schrittId));
  const s = schritte[i];
  const c = cockpit(unit.id);
  const letzter = i === schritte.length - 1;
  const frage = s.lehrer_fragt.trim();
  const antwort = s.erwartete_antwort.trim();
  const knoepfe = FRAGE_ARTEN.includes(s.art) && Boolean(frage || antwort);
  const blatt = offenesStoffBlatt(unit.id);
  const senden = (
    <>
      <Gross action={uebenAction.bind(null, unit.id, thema)} icon={<Send size={19} aria-hidden />} testid="ueben-senden">
        Verstanden: Übungen ans Tablet senden
      </Gross>
      <Leise>{blatt ? `Das Übungsblatt aus den Fotos, ${repo.listTasks(blatt).length} Aufgaben.` : `Neue Aufgaben, passend zum Lernstand von ${name}.`}</Leise>
      <AndereWege unit={unit} skillId={thema} />
    </>
  );
  return (
    <Karte titel={`${paket.title} erklären`} testid="ablauf-erklaeren">
      <p className="-mt-2 text-[14.5px] text-ink-2" data-testid="erklaeren-schritt">
        Schritt <span className="num">{i + 1}</span> von <span className="num">{schritte.length}</span>: {s.titel}
      </p>
      <PraesentationSchritt c={c} unitId={unit.id} schrittId={s.id} folienOffen={folien === s.id} titel="Präsentation" />
      {s.lehrer_sagt.trim() && (
        <div>
          <p className="text-[13px] font-semibold text-ink-2">Das sagst du</p>
          <div className="mt-0.5">
            <LangText text={s.lehrer_sagt} />
          </div>
        </div>
      )}
      {(frage || antwort) && (
        <div className="rounded-xl bg-accent-wash px-4 py-3" data-testid="abruf-frage">
          <p className="text-[13px] font-semibold text-accent">Kurz fragen: kommt {name} mit?</p>
          {frage && <p className="mt-0.5 text-[18px] leading-relaxed whitespace-pre-line">{frage}</p>}
          {antwort && (
            <p className="mt-1 text-[15px] whitespace-pre-line text-ink-2">
              <span className="font-semibold text-green">Erwartet: </span>
              {antwort}
            </p>
          )}
          {knoepfe && <AntwortKnoepfe unitId={unit.id} schrittId={s.id} wert={c.stand.antworten[s.id] ?? null} />}
        </div>
      )}
      {letzter ? (
        senden
      ) : (
        <>
          <Gross action={schrittAction.bind(null, unit.id, schritte[i + 1].id)} icon={<ArrowRight size={19} aria-hidden />} testid="schritt-weiter">
            Weiter: {schritte[i + 1].titel}
          </Gross>
          <Klein action={uebenAction.bind(null, unit.id, thema)} testid="ueben-senden">
            <Send size={15} aria-hidden /> Schon verstanden: gleich üben
          </Klein>
        </>
      )}
      {i > 0 && (
        <Klein action={schrittAction.bind(null, unit.id, schritte[i - 1].id)} testid="schritt-zurueck">
          <ArrowLeft size={15} aria-hidden /> Zurück
        </Klein>
      )}
    </Karte>
  );
}

// ---------- Üben ----------

function UebenKarte({ unit, a, name }: { unit: UnitView; a: Ablauf; name: string }) {
  const u = uebenStand(unit.id);
  const k = kurztestStand(unit.id);
  const schreiben = SCHREIB_FAECHER.has(unit.subject ?? "");
  const tf = schreiben ? textFehler(unit.id) : null;
  const textLink = schreiben ? <TextZeile unitId={unit.id} tf={tf} /> : null;
  // Heft am Tablet: solange es geschrieben oder geprüft wird (oder nicht geprüft werden konnte), ist es die ganze Karte
  const heft = heftDerEinheit(unit.id);
  if (heft && heft.assignmentId === u.letzte?.assignmentId && heft.status !== "geprueft") return <HeftKarte unit={unit} name={name} heft={heft} />;
  // a running exercise: its progress is the whole card; the next button comes when it is done
  if (u.letzte && !u.letzte.fertig) {
    return (
      <Karte titel={`${name} übt am Tablet`} testid="ablauf-ueben">
        <p className="-mt-2 text-[14.5px] text-ink-2">{u.letzte.titel}</p>
        <Ergebnis e={u.letzte.auswertung} laeuft />
        <p className="text-[14.5px] text-ink-2">Die Seite zeigt den Stand von selbst. Danach kommen Aufgaben zu den Fehlern.</p>
        <div className="flex flex-wrap justify-center gap-x-6">
          <Klein action={stufeAction.bind(null, unit.id, "schluss")} testid="weiter-schluss">
            Fertig geübt: weiter zur Hausübung
          </Klein>
        </div>
        {textLink}
      </Karte>
    );
  }
  // „Lieber auf Papier“: gedruckt, noch nicht fotografiert
  const papier = gedruckteUebung(unit.id);
  if (papier) return <PapierKarte unit={unit} name={name} papier={papier} />;
  const n = naechsteUebung(a, k?.auswertung ?? null, u.einzeln);
  // ein Thema ohne Fähigkeit (Nebenfach ohne KI): keine Aufgaben der App, aber ein Weg weiter
  const frei = n ? null : freiesThema(unit.id);
  if (frei && a.weg === "neu") return <FreiUeben unit={unit} name={name} frei={frei} text={textFehler(unit.id)} />;
  // Deutsch, Englisch: ein Text von heute geht vor (fotografieren, korrigieren, dann Aufgaben zu seinen Fehlern)
  if (tf && (tf.leer || tf.korrektur !== "fertig" || tf.skills.some((x) => x.offen))) return <TextKarte unit={unit} tf={tf} name={name} n={n} />;
  // neues Thema mit mehreren Themen: ein Thema, das noch nicht dran war, wird zuerst erklärt
  const blatt = offenesStoffBlatt(unit.id);
  const erklaeren = a.weg === "neu" && n?.art === "neu" && n.skillId !== a.aktuell && !blatt && !erklaerPaket(unit.id);
  const genug = u.gesamt.fertig > 0 && n?.art === "nochmal";
  const sendenText = !n ? "" : blatt && n.art !== "fehler" ? "Übungsblatt aus dem Stoff ans Tablet senden" : n.art === "fehler" ? `Aufgaben zu den Fehlern bei „${skillName(n.skillId)}“ senden` : n.art === "neu" ? `Übungen zu „${skillName(n.skillId)}“ senden` : `Weitere Übung zu „${skillName(n.skillId)}“ senden`;
  return (
    <Karte titel={u.gesamt.aufgaben ? `Üben: ${u.gesamt.richtig} von ${u.gesamt.fertig} richtig` : "Üben am Tablet"} testid="ablauf-ueben">
      {u.gesamt.aufgaben > 0 && <Ergebnis e={u.gesamt} laeuft={false} />}
      {heft?.status === "geprueft" && <HeftZeile unit={unit} heft={heft} />}
      {n?.art === "fehler" && <p className="rounded-xl bg-green-wash px-4 py-2.5 text-[15px] font-semibold text-green">Aus den Fehlern kommen neue Aufgaben, genau dazu.</p>}
      {genug ? (
        <>
          <Gross action={stufeAction.bind(null, unit.id, "schluss")} icon={<ArrowRight size={19} aria-hidden />} testid="weiter-schluss">
            Weiter zur Hausübung
          </Gross>
          <Leise>Alles ist geübt. Die Hausübung kommt aus den Fehlern von heute.</Leise>
          {n && (
            <Klein action={uebenAction.bind(null, unit.id, n.skillId)} testid="ueben-senden">
              {sendenText}
            </Klein>
          )}
        </>
      ) : n && erklaeren ? (
        <>
          <Gross action={themaAction.bind(null, unit.id, n.skillId, "erklaeren")} icon={<ArrowRight size={19} aria-hidden />} testid="naechstes-thema">
            Nächstes Thema: {skillName(n.skillId)} erklären
          </Gross>
          <Klein action={uebenAction.bind(null, unit.id, n.skillId)} testid="ueben-senden">
            Gleich üben
          </Klein>
          <Klein action={stufeAction.bind(null, unit.id, "schluss")} testid="weiter-schluss">
            Weiter zur Hausübung
          </Klein>
        </>
      ) : n ? (
        <>
          <Gross action={uebenAction.bind(null, unit.id, n.skillId)} icon={<Send size={19} aria-hidden />} testid="ueben-senden">
            {sendenText}
          </Gross>
          <Leise>{gehtAlsHeft(unit) ? `Im Heft am Tablet, mit dem Stift. Beim „Fertig“ prüft die KI alles auf einmal.` : `Neue Aufgaben am Tablet, passend zum Lernstand von ${name}.`}</Leise>
          <div className="flex flex-wrap justify-center gap-x-6">
            <AndereWege unit={unit} skillId={n.skillId} />
            <Klein action={stufeAction.bind(null, unit.id, "schluss")} testid="weiter-schluss">
              Weiter zur Hausübung
            </Klein>
          </div>
        </>
      ) : (
        <>
          <p className="text-[15px] text-ink-2">Es gibt noch kein Thema zum Üben.</p>
          <Gross action={stufeAction.bind(null, unit.id, "start")} icon={<ArrowRight size={19} aria-hidden />}>
            Zurück zum Start
          </Gross>
        </>
      )}
      {textLink}
    </Karte>
  );
}

/**
 * Der Text von heute in Deutsch und Englisch, als eigene Karte, solange er etwas braucht (niko, 26.11.2026: „mit der Hand
 * schreiben, abfotografieren, korrigieren, dann zu den Fehlern die Übungen“): auf Papier geschrieben, dann fotografieren;
 * dann korrigieren; während die KI korrigiert, warten; dann Aufgaben zu den Fehlern ans Tablet, eine Fähigkeit nach der anderen.
 */
function TextKarte({ unit, tf, name, n }: { unit: UnitView; tf: TextFehler; name: string; n: ReturnType<typeof naechsteUebung> }) {
  const link = "btn btn-primary btn-lg w-full !text-[17px]";
  const nebenbei = (
    <div className="flex flex-wrap justify-center gap-x-6">
      {n && (
        <Klein action={uebenAction.bind(null, unit.id, n.skillId)} testid="ueben-senden">
          Lieber Übungen zu „{skillName(n.skillId)}“
        </Klein>
      )}
      <Klein action={stufeAction.bind(null, unit.id, "schluss")} testid="weiter-schluss">
        Weiter zur Hausübung
      </Klein>
    </div>
  );
  if (tf.leer) {
    return (
      <Karte titel={`Text von heute: ${tf.titel}`} testid="ablauf-text">
        <p className="text-[16px] leading-relaxed text-ink-2">Schreibt {name} auf Papier: wenn der Text fertig ist, die Seiten fotografieren. Die App liest die Handschrift wörtlich, du prüfst kurz. Am Tablet geschrieben kommt der Text von selbst.</p>
        <Link href={`/texte/${tf.textId}/papier`} className={link} data-testid="text-fotografieren">
          <Camera size={19} aria-hidden /> Text fotografieren
        </Link>
        {nebenbei}
      </Karte>
    );
  }
  if (tf.korrektur === "keine") {
    return (
      <Karte titel={`Text von heute: ${tf.titel}`} testid="ablauf-text">
        <p className="text-[16px] leading-relaxed text-ink-2">Wenn {name} fertig ist: korrigieren. Die KI markiert Rechtschreibung, Grammatik, Beistriche und Ausdruck, du entscheidest. Danach kommen hier Aufgaben zu den Fehlern.</p>
        <Link href={`/texte/${tf.textId}/korrektur`} className={link} data-testid="text-korrigieren">
          <Check size={19} aria-hidden /> Text korrigieren
        </Link>
        {nebenbei}
      </Karte>
    );
  }
  if (tf.korrektur === "laeuft") {
    return (
      <Karte titel="Der Text wird korrigiert" testid="ablauf-text">
        <AutoRefresh seconds={5} />
        <p className="flex items-center gap-3 text-[17px] font-semibold" aria-live="polite">
          <Loader2 size={20} className="animate-spin text-accent" aria-hidden /> {tf.titel} …
        </p>
        <p className="text-[15px] text-ink-2">Das dauert ein bis zwei Minuten. Danach kommen hier die Aufgaben zu den Fehlern.</p>
        {nebenbei}
      </Karte>
    );
  }
  const offen = tf.skills.find((x) => x.offen)!;
  return (
    <Karte titel={`Text von heute: ${tf.fehler} Fehler`} testid="ablauf-text">
      {tf.bereiche.length > 0 && (
        <ul className="grid divide-y divide-line border-y border-line" data-testid="text-bereiche">
          {tf.bereiche.slice(0, 5).map((b) => (
            <li key={b.label} className="flex justify-between gap-4 py-2 text-[15px]">
              <span>{b.label}</span>
              <span className="num font-semibold text-red">{b.anzahl}</span>
            </li>
          ))}
        </ul>
      )}
      <Gross action={textFehlerAction.bind(null, unit.id, offen.skillId)} icon={<Send size={19} aria-hidden />} testid="text-fehler-senden">
        Aufgaben zu den Fehlern im Text senden: {offen.name}
      </Gross>
      <Leise>Neue Aufgaben genau dazu, am Tablet, passend zum Lernstand von {name}.</Leise>
      <div className="flex flex-wrap justify-center gap-x-6">
        <Link href={`/texte/${tf.textId}/korrektur`} className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline">
          <Eye size={15} aria-hidden /> Korrektur ansehen
        </Link>
        <Klein action={stufeAction.bind(null, unit.id, "schluss")} testid="weiter-schluss">
          Weiter zur Hausübung
        </Klein>
      </div>
    </Karte>
  );
}

/** Unter Üben in Deutsch und Englisch: einen Text schreiben lassen (Tablet oder Papier), oder die Korrektur des Texts von heute. */
function TextZeile({ unitId, tf }: { unitId: number; tf: TextFehler | null }) {
  const cls = "treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline";
  return (
    <div className="flex justify-center">
      {tf ? (
        <Link href={`/texte/${tf.textId}/korrektur`} className={cls}>
          <Eye size={15} aria-hidden /> Korrektur von „{tf.titel}“
        </Link>
      ) : (
        <Link href={`/einheiten/${unitId}/text`} className={cls} data-testid="text-schreiben">
          <PenLine size={15} aria-hidden /> Text schreiben lassen, am Tablet oder auf Papier
        </Link>
      )}
    </div>
  );
}

/** Unter dem großen Knopf: in Mathe „Lieber tippen“ (statt im Heft), und „Lieber auf Papier rechnen“. */
function AndereWege({ unit, skillId }: { unit: UnitView; skillId: string }) {
  return (
    <>
      {gehtAlsHeft(unit) && (
        <Klein action={uebenTippenAction.bind(null, unit.id, skillId)} testid="ueben-tippen">
          <Keyboard size={15} aria-hidden /> Lieber tippen
        </Klein>
      )}
      <PapierKlein unitId={unit.id} skillId={skillId} mathe={unit.subject === "Mathematik"} />
    </>
  );
}

/**
 * Heft am Tablet (lib/heft.ts): der Schüler rechnet mit dem Stift; beim „Fertig“ liest die KI alle Aufgaben in einem Lauf und die
 * App übernimmt das Ergebnis (Unsicheres wartet auf dich). Die Seite lädt sich selbst neu, bis es geprüft ist.
 */
function HeftKarte({ unit, name, heft }: { unit: UnitView; name: string; heft: Heft }) {
  return (
    <Karte titel={heft.status === "schreibt" ? `${name} rechnet im Heft` : heft.status === "pruefen" ? "Das Heft wird geprüft" : "Das Heft ist noch nicht geprüft"} testid="ablauf-heft">
      <p className="-mt-2 text-[14.5px] text-ink-2">
        {heft.titel} · {heft.aufgaben.length} Aufgaben
      </p>
      {heft.status === "schreibt" ? (
        <>
          <p className="text-[16px] leading-relaxed text-ink-2">
            {name} schreibt frei mit dem Stift. Wenn {name} auf „Fertig“ tippt, prüft die KI alle Aufgaben auf einmal. Du musst nichts tun.
          </p>
          <AutoRefresh seconds={8} />
        </>
      ) : heft.status === "pruefen" ? (
        <>
          <p className="flex items-center gap-2 text-[16px] font-semibold" data-testid="heft-wird-geprueft">
            <Loader2 size={18} className="animate-spin text-accent" aria-hidden /> Die KI liest alle Aufgaben, das dauert etwa eine halbe Minute.
          </p>
          <AutoRefresh seconds={4} />
        </>
      ) : (
        <>
          <p className="rounded-xl bg-red-wash px-4 py-3 text-[15px] text-red" data-testid="heft-fehler">
            {heft.grund || "Das Heft konnte nicht geprüft werden."}
          </p>
          <Gross action={heftNochmalAction.bind(null, unit.id, heft.assignmentId)} icon={<RotateCcw size={19} aria-hidden />} testid="heft-nochmal">
            Noch einmal prüfen
          </Gross>
        </>
      )}
      <div className="flex flex-wrap justify-center gap-x-6">
        {heft.materialIds.length > 0 && (
          <Link href={`/einheiten/${unit.id}/heft/${heft.assignmentId}`} className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline">
            <Eye size={15} aria-hidden /> Heft ansehen
          </Link>
        )}
        <Klein action={stufeAction.bind(null, unit.id, "schluss")} testid="weiter-schluss">
          Fertig geübt: weiter zur Hausübung
        </Klein>
      </div>
    </Karte>
  );
}

/** Nach dem Prüfen: das Heft ansehen, und wie viele Antworten noch auf dich warten. */
function HeftZeile({ unit, heft }: { unit: UnitView; heft: Heft }) {
  const offen = heft.aufgaben.filter((a) => a.urteil === "offen").length;
  return (
    <Link href={`/einheiten/${unit.id}/heft/${heft.assignmentId}`} className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-[15px] font-semibold ${offen ? "bg-[#fff1dc] text-[#a35a00]" : "text-accent"}`} data-testid="heft-ansehen">
      <NotebookPen size={16} aria-hidden />
      {offen ? `Heft ansehen: ${offen === 1 ? "1 Aufgabe wartet" : `${offen} Aufgaben warten`} auf dich` : "Heft ansehen"}
    </Link>
  );
}

/**
 * „Lieber auf Papier rechnen“ (in anderen Fächern „üben“, dort wird nicht gerechnet): dieselbe Übung gedruckt; danach
 * fotografieren, die KI liest alle Aufgaben auf einmal.
 */
function PapierKlein({ unitId, skillId, mathe }: { unitId: number; skillId: string; mathe: boolean }) {
  return (
    <Klein action={uebenPapierAction.bind(null, unitId, skillId)} testid="ueben-papier">
      <Printer size={15} aria-hidden /> {mathe ? "Lieber auf Papier rechnen" : "Lieber auf Papier üben"}
    </Klein>
  );
}

/** Eine Übung auf Papier: wenn der Schüler fertig ist, die Seite fotografieren (lib/papier-einheit.ts). */
function PapierKarte({ unit, name, papier }: { unit: UnitView; name: string; papier: { worksheetId: number; titel: string } }) {
  return (
    <Karte titel={`${name} rechnet auf Papier`} testid="ablauf-papier">
      <p className="-mt-2 text-[14.5px] text-ink-2">{papier.titel}</p>
      <p className="text-[16px] leading-relaxed text-ink-2">Wenn {name} fertig ist: die Seite fotografieren. Die KI liest alle Antworten auf einmal, die App prüft sie, du bestätigst.</p>
      <Link href={`/einheiten/${unit.id}/papier?uebung=${papier.worksheetId}`} className="btn btn-primary btn-lg w-full !text-[17px]" data-testid="papier-fotografieren">
        <Camera size={19} aria-hidden /> Seite fotografieren
      </Link>
      <div className="flex flex-wrap justify-center gap-x-6">
        <Link href={`/arbeitsblatt/${papier.worksheetId}?einheit=${unit.id}`} className="treffer inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-medium text-accent hover:underline">
          <Printer size={15} aria-hidden /> Nochmal drucken
        </Link>
        <Klein action={papierOhneFotoAction.bind(null, unit.id, papier.worksheetId)} testid="papier-ohne-foto">
          Ohne Foto weiter
        </Klein>
      </div>
    </Karte>
  );
}

// ---------- Hausübung ----------

function SchlussKarte({ unit, name }: { unit: UnitView; name: string }) {
  const u = uebenStand(unit.id);
  const k = kurztestStand(unit.id);
  const fehler = [...new Set([...(k?.auswertung.themen ?? []), ...u.gesamt.themen].filter((t) => t.falsch > 0).map((t) => t.name))];
  return (
    <Karte titel="Hausübung und Schluss" testid="ablauf-schluss">
      <p className="text-[16px] leading-relaxed text-ink-2">
        Beim Beenden schreibt die App die Dokumentation und stellt die Hausübung zusammen
        {fehler.length ? (
          <>
            , vor allem zu <span className="font-semibold text-ink">{fehler.slice(0, 3).join(", ")}</span>
          </>
        ) : (
          " aus dem Stoff von heute"
        )}
        . Du siehst beides gleich danach und gibst die Hausübung mit einem Tippen frei.
      </p>
      <EinheitBeenden action={endUnitAction.bind(null, unit.id)} name={name} className="btn btn-primary btn-lg w-full !text-[17px]" />
      <Klein action={stufeAction.bind(null, unit.id, "ueben")}>
        <PenLine size={15} aria-hidden /> Doch noch üben
      </Klein>
    </Karte>
  );
}

