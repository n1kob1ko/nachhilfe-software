import Link from "next/link";
import { ArrowDown, ArrowUp, BookMarked, CalendarClock, Check, CheckCircle2, CircleDot, ExternalLink, Presentation, ShieldAlert, SkipForward, Undo2 } from "lucide-react";
import {
  anpassenAction,
  entscheideAnpassungAction,
  markiereSchrittAction,
  notizAction,
  sendeGeneratorAction,
  sendeSchrittAction,
  verschiebeSchrittAction,
  waehleFaehigkeitAction,
  waehlePaketAction,
  zeigeSchrittAction,
} from "@/app/cockpit-actions";
import { AnpassenKnopf, CockpitSenden, SchrittNotiz } from "@/components/cockpit/CockpitClient";
import { KeinPaket, VorschlagWarum } from "@/components/cockpit/Vorbereitung";
import { TabletSend } from "@/components/device/TabletSend";
import { Info } from "@/components/Info";
import { StatusPill } from "@/components/LernpaketStatus";
import { TaskBody } from "@/components/TaskPreview";
import { Pill, Reveal, SectionTitle } from "@/components/ui";
import { grenzeHinweis, schuelerStand } from "@/lib/ai/schueler-kosten";
import { ANPASSUNG_ARTEN, anpassenStatus, anpassungen, type Anpassung } from "@/lib/anpassen";
import { KANDIDAT_LABEL } from "@/lib/briefing";
import { cockpit, zusammenfassung, ablauf, leseStand, type CockpitDaten } from "@/lib/cockpit";
import { ohnePaket, paketWahl, type PaketWahl } from "@/lib/cockpit-vorschlag";
import { kostenSchaetzung } from "@/lib/lernpaket-ki";
import { getLernpaket, SCHRITT_ARTEN, ungeprueft, type Lernpaket, type LernpaketSchritt } from "@/lib/lernpakete";
import { RULE_LABEL, RULE_TONE } from "@/lib/recommend";
import * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";
import { platzFuerEinheit, type UnitView } from "@/lib/units";
import { autoFuerEinheit, kiVorgabe, type Signal } from "@/lib/vorbereitung-auto";

const first = (n: string) => n.split(" ")[0];
const LP = "/mehr/lernpakete";

/** The teacher's script of a step, in the order it is used in the lesson. */
const SKRIPT = [
  ["lehrer_sagt", "Lehrer sagt"],
  ["lehrer_fragt", "Lehrer fragt"],
  ["erwartete_antwort", "Erwartete Antwort"],
  ["bei_fehler", "Bei Fehler"],
  ["notiz", "Notiz im Paket"],
] as const;

const stufeVon = (p: Pick<Lernpaket, "schulart" | "klasse">) => (p.klasse ? klassenLabel(p.schulart, p.klasse, { short: true }) : p.schulart || "jede Stufe");

/**
 * Das **Cockpit** der laufenden Einheit (lib/cockpit.ts): oben das Lernpaket für heute und warum, dann die
 * Schritte (am Handy als Leiste, ab Tablet quer links) und rechts der Schritt auf dem Schirm mit dem, was der
 * Lehrer sagt und fragt. Ohne Lernpaket steht da, was es zur Fähigkeit schon gibt. Nur für den Lehrer.
 */
export function CockpitBereich({ unit, student, fehler }: { unit: UnitView; student: repo.Student; fehler?: string }) {
  const c = cockpit(unit.id);
  const wahl = paketWahl(student.id, { fach: unit.subject, ausser: unit.id });
  const name = first(student.name);
  const vorschlag = c.paket ? wahl.vorschlaege.find((v) => v.paket.id === c.paket!.id) : undefined;
  // „Anpassen“: Vorschläge und Übernommenes gelten für das Paket, das gerade gewählt ist
  const liste = c.paket ? anpassungen(unit.id).filter((a) => a.paket_id === c.paket!.id) : [];
  // „Stunden automatisch vorbereiten“ (lib/vorbereitung-auto.ts): fehlt ein geprüftes Paket, „Mit KI entwerfen“ ausgefüllt, nur auf Klick
  const auto = c.paket ? null : autoFuerEinheit(unit);
  const fehlt: Signal | null = c.stand.automatisch?.luecke ?? (auto?.art === "kein_paket" ? auto.signal : null);
  const ki = fehlt ? kiVorgabe(fehlt, student, { fach: unit.subject, dauer: platzFuerEinheit(unit)?.geplante_dauer ?? 50, gibtSkill: (id) => Boolean(repo.getSkill(id)) }) : null;
  const kosten = ki ? kostenSchaetzung().text : "";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8" data-testid="cockpit">
      {fehler && (
        <p role="alert" className="rounded-2xl bg-red-wash px-4 py-3 text-[15px] text-red">
          {fehler}
        </p>
      )}
      <KiGrenzeHinweis studentId={student.id} name={name} />
      {c.paket ? (
        <>
          <PaketKopf c={c} paket={c.paket} warum={vorschlag?.warum ?? null} entfernen={c.stand.automatisch ? waehlePaketAction.bind(null, unit.id) : null}>
            {c.stand.automatisch?.luecke && ki && <KeinPaket klein thema={c.stand.automatisch.luecke.thema} ki={ki} kosten={kosten} />}
            <Reveal label={c.stand.automatisch ? "Anderes Paket" : "Anderes Lernpaket oder ohne"}>
              <div className="pt-2">
                <PaketAuswahl wahl={wahl} action={waehlePaketAction.bind(null, unit.id)} gewaehlt={c.paket.id} ohne />
              </div>
            </Reveal>
          </PaketKopf>
          <AnpassenBereich c={c} unitId={unit.id} studentId={student.id} name={name} liste={liste} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,290px)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <SchrittListe c={c} unitId={unit.id} />
            {c.aktuell ? <SchrittPanel c={c} s={c.aktuell} unitId={unit.id} name={name} paket={c.paket} angepasst={liste.filter((a) => a.status === "uebernommen" && a.schritt_id === c.aktuell!.id)} /> : <AllesDurch c={c} />}
          </div>
        </>
      ) : (
        <>
          <section aria-label="Lernpaket für heute">
            <SectionTitle>
              <span>Lernpaket für heute</span>
            </SectionTitle>
            {auto?.art === "kein_paket" && (
              <div className="panel mb-4 grid gap-1.5 px-5 py-4">
                <KeinPaket thema={auto.thema} ki={ki} kosten={kosten} entwuerfe={auto.entwuerfe} />
                <p className="text-[13px] text-ink-3">Warum dieses Thema: {auto.signal.warum}. Die KI läuft erst, wenn du im Formular „Entwurf erstellen“ tippst.</p>
              </div>
            )}
            <PaketAuswahl wahl={wahl} action={waehlePaketAction.bind(null, unit.id)} gewaehlt={null} unten />
          </section>
          <OhnePaketAnsicht unit={unit} student={student} skillId={c.stand.skill_id} />
        </>
      )}
    </div>
  );
}

/**
 * Title, status and „Warum heute“ of the chosen package; how far this unit got. A suggestion of the app
 * (`stand.automatisch`) says so and has „Entfernen“; the first tap in the cockpit keeps it.
 */
function PaketKopf({ c, paket, warum, entfernen, children }: { c: CockpitDaten; paket: Lernpaket; warum: string | null; entfernen: ((f: FormData) => Promise<void>) | null; children: React.ReactNode }) {
  const auto = c.stand.automatisch;
  const z = zusammenfassung(c.schritte, c.schritte.map((s) => s.id), c.stand);
  return (
    <section className="panel px-5 py-4" aria-label="Lernpaket">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <BookMarked size={18} className="shrink-0 text-accent" aria-hidden />
        <h2 className="text-[19px] leading-tight font-semibold">{paket.title}</h2>
        <StatusPill p={paket} />
        <Link href={`${LP}/${paket.id}`} className="ml-auto inline-flex min-h-[36px] items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
          Paket ansehen <ExternalLink size={13} aria-hidden />
        </Link>
        {entfernen && (
          <form action={entfernen}>
            <input type="hidden" name="paket_id" value="" />
            <button className="btn btn-ghost btn-sm" title="Ohne Lernpaket weiter; der Vorschlag kommt für diese Einheit nicht wieder">
              Entfernen
            </button>
          </form>
        )}
      </div>
      <p className="num mt-1 text-[14px] text-ink-2">
        {paket.fach} · {stufeVon(paket)} · {c.schritte.length} Schritte · {c.schritte.reduce((n, s) => n + s.minuten, 0)} min · erledigt {z.erledigt.length}
        {z.uebersprungen.length > 0 && `, übersprungen ${z.uebersprungen.length}`}
      </p>
      {auto ? (
        <VorschlagWarum className="mt-2" warum={auto.warum} unsicher={auto.passung === "stichwort"} />
      ) : (
        warum && (
          <p className="mt-2 text-[14.5px]">
            <span className="font-semibold">Warum heute: </span>
            {warum}
          </p>
        )
      )}
      {c.stand.vorbereitet && <p className="mt-1 text-[13px] text-ink-3">{auto ? "Von der App vorbereitet. Mit dem ersten Tippen auf einen Schritt bleibt es gewählt." : "Auf der Startseite für heute vorbereitet."}</p>}
      {ungeprueft(paket) && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-wash px-3 py-2 text-[14px] text-amber" role="note">
          <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong>Ungeprüft.</strong> {paket.quelle === "ki" ? "Von der KI erstellt" : "Importiert"} und noch von niemandem durchgesehen. Lies Schritt und Aufgaben, bevor du sie verwendest.
          </span>
        </p>
      )}
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  );
}

/**
 * Suggestions with „Warum heute“, then every package to pick from. `ohne` adds „Ohne Lernpaket“; `unten`
 * says that the skill's material follows below; `felder` go along with every form (the day on „Einheit vorbereiten“).
 * Used in the cockpit and on „Einheit vorbereiten“.
 */
export function PaketAuswahl({ wahl, action, gewaehlt, ohne, unten, felder = {} }: { wahl: PaketWahl; action: (f: FormData) => Promise<void>; gewaehlt: number | null; ohne?: boolean; unten?: boolean; felder?: Record<string, string> }) {
  const mit = Object.entries(felder).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  if (!wahl.gesamt) {
    return (
      <p className="panel px-5 py-4 text-[14.5px] text-ink-2">
        Noch keine Lernpakete. Unter{" "}
        <Link href={LP} className="font-semibold text-accent underline-offset-2 hover:underline">
          Mehr › Lernpakete
        </Link>{" "}
        anlegen oder importieren.{unten && " Bis dahin steht unten, was es zur Fähigkeit schon gibt."}
      </p>
    );
  }
  const option = (p: Lernpaket) => `${p.title} · ${p.fach}, ${stufeVon(p)} · ${p.minuten_summe} min${ungeprueft(p) ? " · Ungeprüft" : p.status === "entwurf" ? " · Entwurf" : ""}`;
  return (
    <div className="grid gap-4">
      {wahl.vorschlaege.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Vorschläge">
          {wahl.vorschlaege.map((v) => (
            <li key={v.paket.id} className={`panel flex flex-col gap-2 px-4 py-3 ${v.paket.id === gewaehlt ? "ring-2 ring-accent" : ""}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">{v.paket.title}</span>
                <StatusPill p={v.paket} />
              </div>
              <p className="num text-[13px] text-ink-2">
                {v.paket.fach} · {stufeVon(v.paket)} · {v.paket.schritt_zahl} Schritte · {v.paket.minuten_summe} min
              </p>
              <p className="text-[14px]">
                <span className="font-semibold">Warum heute: </span>
                {v.warum}
              </p>
              {v.ungeprueft && <p className="text-[13px] font-medium text-amber">Ungeprüft: vor dem Unterricht durchlesen.</p>}
              <form action={action} className="mt-auto pt-1">
                {mit}
                <input type="hidden" name="paket_id" value={v.paket.id} />
                <button className={`btn btn-sm ${v.paket.id === gewaehlt ? "btn-secondary" : "btn-primary"}`} disabled={v.paket.id === gewaehlt}>
                  {v.paket.id === gewaehlt ? "Gewählt" : "Nehmen"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-ink-2">Kein Lernpaket passt heute zu Prüfung, Empfehlung oder letzter Einheit. Du kannst trotzdem eines wählen.</p>
      )}
      <form action={action} className="flex flex-wrap items-end gap-2">
        {mit}
        <label className="field min-w-0 flex-1 basis-[260px]">
          <span className="label">Alle Lernpakete</span>
          <select className="input" name="paket_id" defaultValue={gewaehlt ?? ""} required>
            <option value="" disabled>
              Lernpaket wählen
            </option>
            {wahl.passend.length > 0 && (
              <optgroup label="Passt zu Fach und Stufe">
                {wahl.passend.map((p) => (
                  <option key={p.id} value={p.id}>
                    {option(p)}
                  </option>
                ))}
              </optgroup>
            )}
            {wahl.andere.length > 0 && (
              <optgroup label="Andere Fächer und Stufen">
                {wahl.andere.map((p) => (
                  <option key={p.id} value={p.id}>
                    {option(p)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <button className="btn btn-secondary">Nehmen</button>
      </form>
      {ohne && gewaehlt !== null && (
        <form action={action}>
          {mit}
          <input type="hidden" name="paket_id" value="" />
          <button className="btn btn-ghost btn-sm">Ohne Lernpaket weiter</button>
        </form>
      )}
    </div>
  );
}

const STATUS_TEXT = { erledigt: "erledigt", uebersprungen: "übersprungen", offen: "offen" } as const;
const statusVon = (c: CockpitDaten, id: number): keyof typeof STATUS_TEXT => (c.stand.erledigt.includes(id) ? "erledigt" : c.stand.uebersprungen.includes(id) ? "uebersprungen" : "offen");

/** The steps of this unit: a compact bar on the phone, a list on the left from iPad landscape on. */
function SchrittListe({ c, unitId }: { c: CockpitDaten; unitId: number }) {
  return (
    <nav aria-label="Schritte" className="lg:rounded-[18px] lg:border lg:border-line lg:bg-surface lg:px-2 lg:py-2 lg:shadow-[var(--shadow-card)]">
      <ol className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {c.schritte.map((s, i) => {
          const st = statusVon(c, s.id);
          const an = c.aktuell?.id === s.id;
          return (
            <li key={s.id} className="shrink-0">
              <form action={zeigeSchrittAction.bind(null, unitId, s.id)}>
                <button
                  aria-current={an ? "step" : undefined}
                  title={`${s.titel} · ${s.minuten} min · ${STATUS_TEXT[st]}`}
                  className={`flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full px-3 text-left text-[14px] transition-colors lg:w-full lg:rounded-xl lg:py-1.5 ${
                    an ? "bg-accent text-on-fill" : st === "erledigt" ? "bg-green-wash text-green" : st === "uebersprungen" ? "bg-panel text-ink-3" : "bg-surface text-ink shadow-[var(--shadow-card)] hover:bg-panel lg:shadow-none"
                  }`}
                >
                  <span className="num font-semibold">{i + 1}</span>
                  {st === "erledigt" && <Check size={14} aria-hidden />}
                  {st === "uebersprungen" && <SkipForward size={14} aria-hidden />}
                  <span className={`hidden min-w-0 flex-1 truncate lg:block ${st === "uebersprungen" && !an ? "line-through" : ""}`}>{s.titel}</span>
                  <span className={`num hidden text-[12px] lg:inline ${an ? "" : "text-ink-3"}`}>{s.minuten}′</span>
                  <span className="sr-only">
                    {s.titel}, {STATUS_TEXT[st]}
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The step on screen: what to say, ask, expect and do on a mistake; send its tasks; done, skip, move. */
function SchrittPanel({ c, s, unitId, name, paket, angepasst }: { c: CockpitDaten; s: LernpaketSchritt; unitId: number; name: string; paket: Lernpaket; angepasst: Anpassung[] }) {
  const i = c.schritte.findIndex((x) => x.id === s.id);
  const st = statusVon(c, s.id);
  const ab = c.ab.get(s.id) ?? 0;
  const gesendet = c.stand.gesendet[s.id]?.length ?? 0;
  const skillName = (id: string) => repo.getSkill(id)?.name ?? id;
  return (
    <section className="panel px-4 py-4 sm:px-5" aria-label="Aktueller Schritt" data-testid="cockpit-schritt">
      <p className="num flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
        <span>
          Schritt {i + 1} von {c.schritte.length}
        </span>
        <span>
          · Minute {ab}–{ab + s.minuten}
        </span>
        {s.folie && (
          <span className="inline-flex items-center gap-1">
            · <Presentation size={13} className="text-accent" aria-hidden /> Folie {s.folie}
          </span>
        )}
      </p>
      <h3 className="mt-1 flex flex-wrap items-center gap-2 text-[20px] leading-tight font-semibold">
        {s.titel}
        <Pill tone={s.art === "kontrolle" ? "green" : s.art === "zusatz" ? "amber" : "accent"}>{SCHRITT_ARTEN[s.art]}</Pill>
        <span className="num text-[14px] font-normal text-ink-3">{s.minuten} min</span>
      </h3>
      {st !== "offen" && (
        <p className={`mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold ${st === "erledigt" ? "text-green" : "text-ink-3"}`}>
          {st === "erledigt" ? <CheckCircle2 size={16} aria-hidden /> : <SkipForward size={16} aria-hidden />} {st === "erledigt" ? "Erledigt" : "Übersprungen"}
        </p>
      )}

      <dl className="mt-4 grid gap-3">
        {SKRIPT.filter(([k]) => s[k].trim()).map(([k, l]) => (
          <div key={k} className={k === "bei_fehler" ? "rounded-xl bg-amber-wash px-3 py-2" : k === "erwartete_antwort" ? "rounded-xl bg-green-wash px-3 py-2" : ""}>
            <dt className={`text-[13px] font-semibold ${k === "bei_fehler" ? "text-amber" : k === "erwartete_antwort" ? "text-green" : "text-ink-2"}`}>{l}</dt>
            <dd className={`mt-0.5 whitespace-pre-line ${k === "lehrer_sagt" || k === "lehrer_fragt" ? "text-[17px] leading-relaxed" : "text-[15px]"}`}>{s[k]}</dd>
          </div>
        ))}
      </dl>
      {SKRIPT.every(([k]) => !s[k].trim()) && <p className="mt-3 text-[14px] text-ink-3">Zu diesem Schritt steht im Paket nichts zum Sagen oder Fragen.</p>}

      {angepasst.length > 0 && (
        <div className="mt-4 grid gap-2" data-testid="angepasst">
          <p className="text-[13px] font-semibold text-ink-2">Für {name} angepasst, nur in dieser Einheit</p>
          {angepasst.map((a) => (
            <div key={a.id} className={`rounded-xl px-3 py-2 ${a.art === "bei_fehler" ? "bg-amber-wash" : "border border-line"}`}>
              <AnpassungInhalt a={a} />
              <form action={entscheideAnpassungAction.bind(null, unitId, a.id, "verworfen")} className="mt-1">
                <button className="btn btn-ghost btn-sm !px-2">Entfernen</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {s.pruefen.length > 0 && (
        <ul className="mt-3 grid gap-1 rounded-xl bg-amber-wash px-3 py-2 text-[13.5px] text-amber">
          {s.pruefen.map((h, j) => (
            <li key={j} className="flex items-start gap-1.5">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> Bitte prüfen: {h}
            </li>
          ))}
        </ul>
      )}

      {s.aufgaben.length > 0 && (
        <div className="mt-5 grid gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <CockpitSenden action={sendeSchrittAction.bind(null, unitId, s.id)} unitId={unitId} label={`Übung senden (${s.aufgaben.length} ${s.aufgaben.length === 1 ? "Aufgabe" : "Aufgaben"})`} primary={st === "offen"} />
            {gesendet > 0 && <span className="pt-2.5 text-[13px] text-ink-3">schon {gesendet === 1 ? "einmal" : `${gesendet}-mal`} an {name} gesendet</span>}
          </div>
          <Reveal label="Aufgaben mit Lösung ansehen">
            <ol className="grid gap-3">
              {s.aufgaben.map((a, j) => (
                <li key={j} className="rounded-xl border border-line px-3 py-3">
                  <p className="num mb-1.5 text-[12px] font-semibold text-ink-3">Aufgabe {j + 1}</p>
                  {a.data.pruefen?.map((h, k) => (
                    <p key={k} className="mb-1 text-[12.5px] text-amber">
                      Bitte prüfen: {h}
                    </p>
                  ))}
                  <TaskBody task={a} showSolution skillName={a.skillId ? skillName(a.skillId) : undefined} subject={paket.fach} />
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      )}

      <div className="btn-reihe mt-5 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        {st === "offen" ? (
          <>
            <form action={markiereSchrittAction.bind(null, unitId, s.id, "erledigt")}>
              <button className="btn btn-primary btn-lg w-full sm:w-auto">
                <Check size={18} aria-hidden /> Erledigt / Weiter
              </button>
            </form>
            <form action={markiereSchrittAction.bind(null, unitId, s.id, "uebersprungen")}>
              <button className="btn btn-secondary btn-lg w-full sm:w-auto">
                <SkipForward size={18} aria-hidden /> Überspringen
              </button>
            </form>
          </>
        ) : (
          <form action={markiereSchrittAction.bind(null, unitId, s.id, "offen")}>
            <button className="btn btn-secondary btn-lg w-full sm:w-auto">
              <Undo2 size={18} aria-hidden /> Wieder öffnen
            </button>
          </form>
        )}
        <span className="flex items-center gap-1 sm:ml-auto">
          <span className="mr-1 text-[13px] text-ink-3">Für heute verschieben</span>
          <form action={verschiebeSchrittAction.bind(null, unitId, s.id, -1)}>
            <button className="btn btn-ghost btn-sm min-w-[44px] !px-2" disabled={i === 0} aria-label="Einen Schritt früher" title="Früher">
              <ArrowUp size={16} aria-hidden />
            </button>
          </form>
          <form action={verschiebeSchrittAction.bind(null, unitId, s.id, 1)}>
            <button className="btn btn-ghost btn-sm min-w-[44px] !px-2" disabled={i === c.schritte.length - 1} aria-label="Einen Schritt später" title="Später">
              <ArrowDown size={16} aria-hidden />
            </button>
          </form>
        </span>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <SchrittNotiz key={s.id} speichern={notizAction.bind(null, unitId, s.id)} initial={c.stand.notizen[s.id] ?? ""} />
      </div>
    </section>
  );
}

/**
 * From the warning level of the limit per student and month on (lib/ai/schueler-kosten.ts): a note for the teacher.
 * Cockpit and student profile; never on student pages.
 */
export function KiGrenzeHinweis({ studentId, name, className = "" }: { studentId: number; name: string; className?: string }) {
  const text = grenzeHinweis(schuelerStand(studentId), name);
  if (!text) return null;
  return (
    <p className={`flex items-start gap-2 rounded-xl bg-amber-wash px-3 py-2 text-[14px] text-amber ${className}`} role="note" data-testid="ki-grenze">
      <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}

/** One adaptation: kind and title, the text, the expected answer. */
function AnpassungInhalt({ a }: { a: Anpassung }) {
  return (
    <>
      <p className={`text-[13px] font-semibold ${a.art === "bei_fehler" ? "text-amber" : "text-ink-2"}`}>
        {ANPASSUNG_ARTEN[a.art]}: {a.titel}
      </p>
      <p className="mt-0.5 text-[15px] whitespace-pre-line">{a.text}</p>
      {a.antwort && (
        <p className="mt-1 text-[14px] whitespace-pre-line">
          <span className="font-semibold text-green">Erwartete Antwort: </span>
          {a.antwort}
        </p>
      )}
    </>
  );
}

/**
 * „Anpassen“ (lib/anpassen.ts): on click the KI suggests examples, easier or harder questions and hints for this
 * student. Each suggestion is „Ungeprüft“ until the teacher takes it (for this unit only) or discards it. Without KI,
 * budget or with the student's limit reached the button says why; the cockpit works as before.
 */
function AnpassenBereich({ c, unitId, studentId, name, liste }: { c: CockpitDaten; unitId: number; studentId: number; name: string; liste: Anpassung[] }) {
  const status = anpassenStatus(studentId);
  const offen = liste.filter((a) => a.status === "vorschlag");
  const nr = new Map(c.schritte.map((s, i) => [s.id, i + 1]));
  return (
    <section className="panel px-5 py-4" aria-label="Anpassen" data-testid="anpassen-bereich">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-[260px]">
          <h3 className="flex items-center gap-1.5 text-[16px] font-semibold">
            Anpassen für {name}
            <Info label="Was geht an die KI?">
              Nur auf Klick, etwa 3 Cent: die Schritte dieses Lernpakets und Tatsachen aus der App, nämlich die letzten falschen Antworten, häufige Fehlerarten, Lernstand, letzte Diagnose und die nächste
              Schularbeit mit Stoff. Namen sind vorher durch [Name] ersetzt. Die Vorschläge gelten nur für diese Einheit; Lernpaket, Lernstand, Diagnose und Einschätzung bleiben unverändert.
            </Info>
          </h3>
          <p className="mt-0.5 text-[14px] text-ink-2">Zusatzbeispiel zu den letzten Fehlern, leichtere oder schwerere Frage, Hinweis bei Fehler. Das Paket bleibt, wie es ist.</p>
        </div>
        {status.moeglich ? (
          <AnpassenKnopf action={anpassenAction.bind(null, unitId)} label={offen.length ? "Neue Vorschläge" : "Anpassen"} />
        ) : (
          <p className="text-[14px] text-ink-2 sm:max-w-[320px]" data-testid="anpassen-aus">
            {status.grund}
          </p>
        )}
      </div>
      {offen.length > 0 && (
        <ul className="mt-4 grid gap-3" aria-label="Vorschläge">
          {offen.map((a) => (
            <li key={a.id} className="rounded-xl border border-line px-3 py-3">
              <p className="mb-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
                <Pill tone="amber">Ungeprüft</Pill>
                <span className="num">Schritt {nr.get(a.schritt_id) ?? "?"}</span>
              </p>
              <AnpassungInhalt a={a} />
              {a.bezug.length > 0 && (
                <div className="mt-2 text-[13px] text-ink-2">
                  <p className="font-semibold">Stützt sich auf</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {a.bezug.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={entscheideAnpassungAction.bind(null, unitId, a.id, "uebernommen")}>
                  <button className="btn btn-primary btn-sm">
                    <Check size={15} aria-hidden /> Übernehmen
                  </button>
                </form>
                <form action={entscheideAnpassungAction.bind(null, unitId, a.id, "verworfen")}>
                  <button className="btn btn-secondary btn-sm">Verwerfen</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Every step is done or skipped. */
function AllesDurch({ c }: { c: CockpitDaten }) {
  const z = zusammenfassung(c.schritte, c.schritte.map((s) => s.id), c.stand);
  return (
    <section className="panel px-5 py-5" aria-label="Alle Schritte durch">
      <p className="inline-flex items-center gap-2 text-[17px] font-semibold text-green">
        <CheckCircle2 size={20} aria-hidden /> Alle Schritte durch
      </p>
      <p className="mt-2 text-[15px]">
        {z.erledigt.length} erledigt{z.uebersprungen.length > 0 && `, ${z.uebersprungen.length} übersprungen (${z.uebersprungen.map((s) => s.titel).join(", ")})`}.
      </p>
      <p className="mt-1 text-[14px] text-ink-2">Beim Beenden der Einheit kommt das in die Dokumentation. Einen Schritt links antippen, um ihn wieder zu öffnen.</p>
    </section>
  );
}

/**
 * Ohne Lernpaket: die Fähigkeit für heute mit Grund, Erklärung und typischen Fehlern, passende Übungen mit
 * dem üblichen Senden, und aus dem Tagesbriefing der Plan mit Minuten. Geht ohne ein einziges Paket.
 */
function OhnePaketAnsicht({ unit, student, skillId }: { unit: UnitView; student: repo.Student; skillId: string | null }) {
  const d = ohnePaket(student.id, { skillId, fach: unit.subject });
  if (!d) return null;
  const name = first(student.name);
  const s = d.skill;
  const ziele = [{ unitId: unit.id, student: name }];
  const bereiche = [...new Set(d.waehlbar.map((x) => `${x.subject} › ${x.area}`))];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2 lg:items-start" data-testid="cockpit-ohne-paket">
      <section aria-label="Fähigkeit für heute" className="grid gap-4">
        <SectionTitle>
          <span>Ohne Lernpaket: Fähigkeit für heute</span>
        </SectionTitle>
        <form action={waehleFaehigkeitAction.bind(null, unit.id)} className="flex flex-wrap items-end gap-2">
          <label className="field min-w-0 flex-1 basis-[240px]">
            <span className="label">Fähigkeit</span>
            <select className="input" name="skill_id" defaultValue={s?.id ?? ""} required>
              <option value="" disabled>
                Fähigkeit wählen
              </option>
              {d.empfohlen.length > 0 && (
                <optgroup label="Empfohlen">
                  {d.empfohlen.map((r) => (
                    <option key={`e-${r.skill.id}`} value={r.skill.id}>
                      {r.skill.name} ({RULE_LABEL[r.rule]})
                    </option>
                  ))}
                </optgroup>
              )}
              {bereiche.map((b) => (
                <optgroup key={b} label={b}>
                  {d.waehlbar
                    .filter((x) => `${x.subject} › ${x.area}` === b)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="btn btn-secondary">Wählen</button>
        </form>
        {s ? (
          <div className="panel grid gap-3 px-5 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {d.empfehlung && <Pill tone={RULE_TONE[d.empfehlung.rule]}>{d.empfehlung.kind === "ueberpruefung" ? "Überprüfung" : RULE_LABEL[d.empfehlung.rule]}</Pill>}
              <span className="font-semibold">{s.name}</span>
              <span className="text-[13px] text-ink-3">
                {s.subject} › {s.area}
              </span>
            </div>
            {d.empfehlung && (
              <p className="text-[14.5px]">
                <span className="font-semibold">Warum heute: </span>
                {d.empfehlung.reason}
              </p>
            )}
            {d.erklaerung && <p className="text-[15px] leading-relaxed">{d.erklaerung}</p>}
            {d.typischeFehler.length > 0 && (
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-ink-2">Typische Fehler</p>
                <ul className="grid gap-1.5 text-[14px] text-ink-2">
                  {d.typischeFehler.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className="text-red">
                        ✗
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link href={`/faehigkeiten/${encodeURIComponent(s.id)}`} className="w-fit text-[13px] font-medium text-accent hover:underline">
              Zur Fähigkeit
            </Link>
          </div>
        ) : (
          <p className="text-[14px] text-ink-2">Keine Empfehlung offen. Wähle oben eine Fähigkeit.</p>
        )}
      </section>

      <div className="grid gap-8">
        {s && (
          <section aria-label="Übungen">
            <SectionTitle>
              <span>Übungen zu {s.name}</span>
            </SectionTitle>
            <div className="panel grid gap-3 px-5 py-4">
              <p className="text-[14px] text-ink-2">Neue Aufgaben aus den Generatoren und Aufgabenbanken der App, passend zum Lernstand von {name}.</p>
              <div className="flex flex-wrap items-start gap-2">
                <CockpitSenden action={sendeGeneratorAction.bind(null, unit.id, s.id)} unitId={unit.id} label={`Neue Übung an ${name} senden`} primary />
                <Link href={`/uebungen/neu?schueler=${student.id}&skill=${encodeURIComponent(s.id)}`} className="btn btn-secondary">
                  Im Builder anpassen
                </Link>
              </div>
            </div>
            {d.uebungen.length > 0 && (
              <ul className="panel mt-3 divide-y divide-line">
                {d.uebungen.map((k) => {
                  const ws = /^U\d+$/.test(k.id) && ["uebung", "ueberpruefung", "diagnose"].includes(k.art) ? Number(k.id.slice(1)) : null;
                  return (
                    <li key={k.id} className="grid gap-2 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={k.href} className="min-w-0 font-semibold hover:text-accent">
                          {k.titel}
                        </Link>
                        <Pill>{KANDIDAT_LABEL[k.art]}</Pill>
                      </div>
                      <p className="num text-[13px] text-ink-2">{k.info}</p>
                      {ws && <TabletSend targets={ziele} worksheetId={ws} small />}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {d.briefing && (
          <section aria-label="Aus dem Tagesbriefing">
            <SectionTitle>
              <span>Aus dem Tagesbriefing</span>
            </SectionTitle>
            <div className="panel grid gap-4 px-5 py-4 text-[14.5px]">
              {d.briefing.schularbeit && (
                <p className="flex items-start gap-2 font-semibold">
                  <CalendarClock size={16} className="mt-0.5 shrink-0" aria-hidden /> {d.briefing.schularbeit}
                </p>
              )}
              <div>
                <p className="mb-1 text-[13px] font-semibold text-ink-2">Plan{d.minuten ? ` für ${d.minuten} min` : ""}</p>
                <ol className="grid gap-1.5">
                  {d.briefing.plan.map((p, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="num w-[52px] shrink-0 text-ink-3">{p.minuten} min</span>
                      <span>
                        <span className="font-medium">{p.titel}</span>
                        {p.beschreibung && <span className="block text-[13.5px] text-ink-2">{p.beschreibung}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="mb-1 text-[13px] font-semibold text-ink-2">Wo es hakt</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {d.briefing.woEsHakt.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
              <Reveal label="Letzter Stand">
                <ul className="list-disc space-y-0.5 pl-5 text-ink-2">
                  {d.briefing.letzterStand.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </Reveal>
              <Link href={`/schueler/${student.id}/briefing`} className="w-fit text-[13px] font-medium text-accent hover:underline">
                Ganzes Briefing
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * On the ended unit: what happened with the Lernpaket, with the teacher's notes per step. Teacher-only, like
 * the rest of the documentation.
 */
export function AblaufRueckblick({ unitId }: { unitId: number }) {
  const s = leseStand(unitId);
  const p = s.paket_id && !s.vorbereitet ? getLernpaket(s.paket_id) : null;
  if (!p) return null;
  const byId = new Map(p.schritte.map((x) => [x.id, x]));
  const order = ablauf(p.schritte, s.reihenfolge);
  const angepasst = anpassungen(unitId, "uebernommen").filter((a) => a.paket_id === p.id);
  if (!s.erledigt.length && !s.uebersprungen.length && !Object.keys(s.notizen).length && !angepasst.length) return null;
  return (
    <section aria-label="Lernpaket">
      <SectionTitle>
        <span>Lernpaket „{p.title}“</span>
      </SectionTitle>
      <ol className="panel divide-y divide-line">
        {order.map((id, i) => {
          const x = byId.get(id)!;
          const st = s.erledigt.includes(id) ? "erledigt" : s.uebersprungen.includes(id) ? "übersprungen" : "nicht erreicht";
          return (
            <li key={id} className="grid gap-1 px-4 py-2.5">
              <p className="flex flex-wrap items-center gap-2 text-[15px]">
                <span className="num text-ink-3">{i + 1}.</span>
                <span className="font-medium">{x.titel}</span>
                <Pill tone={st === "erledigt" ? "green" : st === "übersprungen" ? "neutral" : "amber"}>
                  {st === "erledigt" ? <Check size={12} aria-hidden /> : st === "übersprungen" ? <SkipForward size={12} aria-hidden /> : <CircleDot size={12} aria-hidden />} {st}
                </Pill>
              </p>
              {s.notizen[id] && <p className="text-[14px] whitespace-pre-line text-ink-2 sm:pl-6">Notiz: {s.notizen[id]}</p>}
              {angepasst
                .filter((a) => a.schritt_id === id)
                .map((a) => (
                  <p key={a.id} className="text-[14px] text-ink-2 sm:pl-6">
                    Angepasst: {ANPASSUNG_ARTEN[a.art]} „{a.titel}“
                  </p>
                ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
