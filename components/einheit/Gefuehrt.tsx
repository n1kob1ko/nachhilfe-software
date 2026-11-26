import Link from "next/link";
import { ArrowRight, Camera, Check, PenLine, Printer, Send, Wrench } from "lucide-react";
import { ansichtAction, kurztestFertigAction, stoffFertigAction, stufeAction, themaAction, uebenAction, wegAction } from "@/app/ablauf-actions";
import { minitestAction } from "@/app/minitest-actions";
import { endUnitAction } from "@/app/session-actions";
import { LangText, TextSchreibenLink } from "@/components/cockpit/Ablauf";
import { PraesentationSchritt } from "@/components/cockpit/PraesentationSchritt";
import { AntwortKnoepfe } from "@/components/cockpit/Steuerung";
import { VorgabeKarte } from "@/components/cockpit/Vorgabe";
import { VorgabeForm } from "@/components/cockpit/VorgabeForm";
import { EinheitBeenden } from "@/components/EinheitBeenden";
import { FormKnopf } from "@/components/FormKnopf";
import { aiEnabled, aiReadsImages } from "@/lib/ai";
import { cockpit, planFuehrung, type CockpitDaten, type PlanStep } from "@/lib/cockpit";
import { STUFE_LABEL, kurztestStand, leseAblauf, naechsteUebung, stufenFuer, uebenStand, type Ablauf, type Auswertung, type Stufe } from "@/lib/einheit-ablauf";
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
export async function Gefuehrt({ unit, student, folien }: { unit: UnitView; student: repo.Student; folien: number | null }) {
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
      {a.stufe === "stoff" && <StoffKarte unit={unit} name={name} />}
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

/** Die Fotos vom Stoff (Stoffzettel, Buch, Heft) über „Was steht heute an?“ (lib/vorgabe.ts); danach die erkannten Themen. */
function StoffKarte({ unit, name }: { unit: UnitView; name: string }) {
  const v = vorgabeDerEinheit(unit.id);
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
      </Karte>
    );
  }
  const c = cockpit(unit.id, { mitPlan: true });
  const themen = v.skillIds.map(skillName).filter(Boolean);
  return (
    <Karte titel={themen.length ? `Heute: ${themen.slice(0, 3).join(", ")}${themen.length > 3 ? " …" : ""}` : "Stoff gelesen"} testid="ablauf-stoff">
      <VorgabeKarte unit={unit} c={c} />
      {themen.length ? (
        <>
          <Gross action={stoffFertigAction.bind(null, unit.id)} icon={<ArrowRight size={19} aria-hidden />} testid="stoff-fertig">
            Weiter: {themen[0]} erklären
          </Gross>
          <Leise>Danach Übungen am Tablet zu jedem Thema.</Leise>
        </>
      ) : (
        <p className="text-[15px] text-ink-2">Noch kein Thema sicher erkannt. Oben bestätigen, welches gemeint ist, oder kurz dazuschreiben.</p>
      )}
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
          <p className="text-[13px] font-semibold text-ink-2">Ein Beispiel zum Vorrechnen</p>
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
      <Leise>Neue Aufgaben zu {skillName(thema)}, passend zum Lernstand von {name}.</Leise>
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

// ---------- Üben ----------

function UebenKarte({ unit, a, name }: { unit: UnitView; a: Ablauf; name: string }) {
  const u = uebenStand(unit.id);
  const k = kurztestStand(unit.id);
  const schreiben = SCHREIB_FAECHER.has(unit.subject ?? "");
  const textLink = schreiben ? (
    <div className="flex justify-center">
      <TextSchreibenLink unitId={unit.id} />
    </div>
  ) : null;
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
  const n = naechsteUebung(a, k?.auswertung ?? null, u.einzeln);
  // neues Thema mit mehreren Themen: ein Thema, das noch nicht dran war, wird zuerst erklärt
  const erklaeren = a.weg === "neu" && n?.art === "neu" && n.skillId !== a.aktuell;
  const genug = u.gesamt.fertig > 0 && n?.art === "nochmal";
  const sendenText = !n ? "" : n.art === "fehler" ? `Aufgaben zu den Fehlern bei „${skillName(n.skillId)}“ senden` : n.art === "neu" ? `Übungen zu „${skillName(n.skillId)}“ senden` : `Weitere Übung zu „${skillName(n.skillId)}“ senden`;
  return (
    <Karte titel={u.gesamt.aufgaben ? `Üben: ${u.gesamt.richtig} von ${u.gesamt.fertig} richtig` : "Üben am Tablet"} testid="ablauf-ueben">
      {u.gesamt.aufgaben > 0 && <Ergebnis e={u.gesamt} laeuft={false} />}
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
          <Leise>Am Tablet mit verschiedenen Aufgabenarten, passend zum Lernstand von {name}.</Leise>
          <Klein action={stufeAction.bind(null, unit.id, "schluss")} testid="weiter-schluss">
            Weiter zur Hausübung
          </Klein>
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

