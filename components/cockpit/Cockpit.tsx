import Link from "next/link";
import { BookMarked, CalendarClock, Check, CircleDot, ExternalLink, ShieldAlert, SkipForward } from "lucide-react";
import { anpassenAction, entscheideAnpassungAction, sendeGeneratorAction, waehleFaehigkeitAction } from "@/app/cockpit-actions";
import { AnpassenKnopf, CockpitSenden } from "@/components/cockpit/CockpitClient";
import { VorschlagWarum } from "@/components/cockpit/Vorbereitung";
import { TabletSend } from "@/components/device/TabletSend";
import { Info } from "@/components/Info";
import { StatusPill } from "@/components/LernpaketStatus";
import { Pill, Reveal, SectionTitle } from "@/components/ui";
import { grenzeHinweis, schuelerStand } from "@/lib/ai/schueler-kosten";
import { ANPASSUNG_ARTEN, anpassenStatus, anpassungen, type Anpassung } from "@/lib/anpassen";
import { KANDIDAT_LABEL } from "@/lib/briefing";
import { zusammenfassung, ablauf, leseStand, type CockpitDaten } from "@/lib/cockpit";
import { ohnePaket, type PaketWahl } from "@/lib/cockpit-vorschlag";
import { getLernpaket, ungeprueft, type Lernpaket } from "@/lib/lernpakete";
import { RULE_LABEL, RULE_TONE } from "@/lib/recommend";
import * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";
import type { UnitView } from "@/lib/units";

const first = (n: string) => n.split(" ")[0];
const LP = "/mehr/lernpakete";

const stufeVon = (p: Pick<Lernpaket, "schulart" | "klasse">) => (p.klasse ? klassenLabel(p.schulart, p.klasse, { short: true }) : p.schulart || "jede Stufe");

/**
 * Das **Cockpit** der laufenden Einheit (lib/cockpit.ts) in Teilen: der geführte Unterricht
 * (components/cockpit/Ablauf.tsx) zeigt Schritt für Schritt, was der Lehrer sagt, zeigt und fragt; was hier steht,
 * liegt dort unter „Weitere Werkzeuge“ (Paket, Anpassen, ohne Paket die Fähigkeit) oder im Abschluss (Rückblick).
 * Nur für den Lehrer.
 */

/**
 * Title, status and „Warum heute“ of the chosen package; how far this unit got. A suggestion of the app
 * (`stand.automatisch`) says so and has „Entfernen“; the first tap in the cockpit keeps it.
 */
export function PaketKopf({ c, paket, warum, entfernen, children }: { c: CockpitDaten; paket: Lernpaket; warum: string | null; entfernen: ((f: FormData) => Promise<void>) | null; children: React.ReactNode }) {
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
      {c.stand.vorbereitet && <p className="mt-1 text-[13px] text-ink-3">{auto ? "Von der App vorbereitet. Mit dem ersten Tippen auf einen Schritt bleibt es gewählt." : "Für heute vorbereitet."}</p>}
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
          Erweitert › Lernpakete
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
export function AnpassungInhalt({ a }: { a: Anpassung }) {
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
export function AnpassenBereich({ c, unitId, studentId, name, liste }: { c: CockpitDaten; unitId: number; studentId: number; name: string; liste: Anpassung[] }) {
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

/**
 * Ohne Lernpaket: die Fähigkeit für heute mit Grund, Erklärung und typischen Fehlern, passende Übungen mit
 * dem üblichen Senden, und aus dem Tagesbriefing der Plan mit Minuten. Geht ohne ein einziges Paket.
 */
export function OhnePaketAnsicht({ unit, student, skillId }: { unit: UnitView; student: repo.Student; skillId: string | null }) {
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
 * On the ended unit: what happened with the Lernpaket or, without one, with the „Plan für heute“, with the teacher's
 * notes per step and how often a step was repeated or not understood. Teacher-only, like the rest of the documentation.
 */
export function AblaufRueckblick({ unitId }: { unitId: number }) {
  const s = leseStand(unitId);
  const p = s.paket_id && !s.vorbereitet ? getLernpaket(s.paket_id) : null;
  const schritte: { id: number; titel: string }[] | null = p ? p.schritte : !s.paket_id && s.plan?.length ? s.plan : null;
  if (!schritte) return null;
  const byId = new Map(schritte.map((x) => [x.id, x]));
  const order = ablauf(schritte, s.reihenfolge);
  const angepasst = p ? anpassungen(unitId, "uebernommen").filter((a) => a.paket_id === p.id) : [];
  const gezaehlt = Object.keys(s.wiederholt).length + Object.keys(s.nichtVerstanden).length;
  if (!s.erledigt.length && !s.uebersprungen.length && !Object.keys(s.notizen).length && !angepasst.length && !gezaehlt) return null;
  const mal = (n: number) => (n === 1 ? "einmal" : `${n}-mal`);
  return (
    <section aria-label={p ? "Lernpaket" : "Plan für heute"}>
      <SectionTitle>
        <span>{p ? `Lernpaket „${p.title}“` : "Plan für heute"}</span>
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
              {(s.wiederholt[id] > 0 || s.nichtVerstanden[id] > 0) && (
                <p className="text-[14px] text-ink-2 sm:pl-6">
                  {[s.wiederholt[id] > 0 && `${mal(s.wiederholt[id])} wiederholt`, s.nichtVerstanden[id] > 0 && `${mal(s.nichtVerstanden[id])} nicht verstanden`].filter(Boolean).join(" · ")}
                </p>
              )}
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
