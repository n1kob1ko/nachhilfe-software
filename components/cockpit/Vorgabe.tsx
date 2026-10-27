import Link from "next/link";
import { CalendarCheck, CalendarPlus, ChevronDown, ClipboardList, FileText, TriangleAlert } from "lucide-react";
import { unterlageSchrittAction } from "@/app/unterlagen-actions";
import { bestaetigeVorgabeAction, entferneVorgabeAction, planAnpassenAction, pruefungAusVorgabeAction, rolleAendernAction, stoffZurPruefungAction } from "@/app/vorgabe-actions";
import { RolleWahl } from "@/components/cockpit/RolleWahl";
import { VorgabeForm } from "@/components/cockpit/VorgabeForm";
import { ZuordnungWahl } from "@/components/cockpit/ZuordnungWahl";
import { Pill } from "@/components/ui";
import { aiEnabled, aiReadsImages } from "@/lib/ai";
import { hatBegonnen, type CockpitDaten } from "@/lib/cockpit";
import { dayOf } from "@/lib/exams";
import { ROLLE_SATZ } from "@/lib/pruefungsstoff";
import { tagMonat } from "@/lib/vorbereitung-auto";
import * as repo from "@/lib/repo";
import type { UnitView } from "@/lib/units";
import { schritteFuerUnterlagen, zumZuordnen } from "@/lib/unterlagen-unterricht";
import { abweichung, dateienDerVorgabe, materialZurWahl, pruefungZurVorgabe, schonEingetragen, stoffKnopfText, stoffzettelZurPruefung, vorgabeDerEinheit } from "@/lib/vorgabe";

const skillName = (id: string) => {
  const s = repo.getSkill(id);
  if (!s) return id;
  return s.parent_id ? `${repo.getSkill(s.parent_id)?.name ?? ""} › ${s.name}` : s.name;
};
const ROLLEN = Object.entries(ROLLE_SATZ).map(([wert, text]) => ({ wert, text }));
/** So viele Punkte stehen offen da; mehr (ein ganzer Stoffzettel) erst nach einem Tippen. */
const PUNKTE_OFFEN = 8;
const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/**
 * **Was steht heute an?** (lib/vorgabe.ts) im Unterricht, gleich nach dem Start: ohne Vorgabe eine zugeklappte Zeile
 * (der Start bleibt so schnell wie bisher), mit Vorgabe eine kurze Zusammenfassung: was heute dran ist und zu welcher
 * Fähigkeit, was kurz zu bestätigen ist, wo sie von der nächsten Prüfung abweicht, ein Termin zum Bestätigen und
 * „Plan anpassen“, wenn der Ablauf schon begonnen hat. Je Datei steht ihre Art in einer Zeile („Foto 2: erklärt ein Thema“)
 * und lässt sich mit einem Tippen ändern. Eine Erklärung, die zu keinem Schritt von selbst passt, bekommt darunter „Passt zu welchem
 * Schritt?“ (lib/unterlagen-unterricht.ts); erst nach der Wahl steht sie im Schritt unter „Das zeigst du“. Nur für die Lehrkraft.
 *
 * Die Vorgabe steht über dem Schritt, solange die Lehrkraft etwas bestätigen oder lesen muss; danach (alles bestätigt, oder der
 * Ablauf hat begonnen) ist sie eine Zeile („Vorgabe für heute · 2 Fotos · 17 Themen · 9 zum Bestätigen“), der Rest hinter
 * einem Tippen (Abnahme Phase A: „Eine aktuelle Aufgabe“ bleibt auf dem ersten Bildschirm). Mehr als 8 Punkte stehen auch
 * offen erst hinter „Alle … Punkte“.
 */
export function VorgabeKarte({ unit, c }: { unit: UnitView; c: CockpitDaten }) {
  const v = vorgabeDerEinheit(unit.id);
  const heute = dayOf(new Date());
  const tests = repo
    .upcomingTests(heute, unit.student_id)
    .slice(0, 6)
    .map((t) => ({ id: t.id, label: `${t.title || `${t.kind} ${t.subject}`} am ${tagMonat(t.date)}` }));
  const kiLiest = aiEnabled("stoffzettel") && aiReadsImages("stoffzettel");
  const material = materialZurWahl(unit.student_id).map((m) => ({ ...m, rolle: m.rolle ? ROLLE_SATZ[m.rolle] : "" }));

  if (!v)
    return (
      <details className="panel group px-4 sm:px-5" data-testid="vorgabe">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden" data-testid="vorgabe-oeffnen">
          <ClipboardList size={18} className="text-ink-2" aria-hidden />
          <span className="text-[16px] font-semibold">Was steht heute an?</span>
          <span className="text-[13.5px] text-ink-3">optional</span>
          <ChevronDown size={16} className="ml-auto text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="pb-4">
          <VorgabeForm unitId={unit.id} tests={tests} material={material} kiLiest={kiLiest} />
        </div>
      </details>
    );

  const p = pruefungZurVorgabe(v, unit.subject, heute);
  const abw = p ? abweichung(v.punkte, v.skillIds, p, unit.subject) : [];
  const begonnen = hatBegonnen(c.stand);
  const unklar = v.punkte.map((x, i) => ({ x, i })).filter(({ x }) => x.zuordnung === "unklar" && x.vorschlaege.length);
  const test = v.testId ? repo.getTest(v.testId) : null;
  // „Foto 1“, „Foto 2“, „PDF 1“: numbered per kind, as the teacher took them
  const dateien = dateienDerVorgabe(v).map((d, i, alle) => ({ ...d, name: `${d.art} ${alle.slice(0, i + 1).filter((x) => x.art === d.art).length}` }));
  // an explanation no step takes by itself: the teacher picks the step (never guessed)
  const zuordnen = new Map(zumZuordnen(unit.id, c).map((z) => [z.materialId, z.schrittId]));
  // numbered like the step dots; a provisional block (still to confirm) is no choice
  const nummer = new Map((c.paket ? c.schritte : c.plan).map((x, i) => [x.id, i + 1]));
  const schritte = schritteFuerUnterlagen(c).map((x) => ({ wert: String(x.id), text: `${nummer.get(x.id)}. ${x.titel}` }));
  const ohneSchritt = [...zuordnen.values()].filter((x) => x === null).length;
  // a Stoffzettel read today and an entered exam it belongs to: one tap takes its Stoff over (lib/vorgabe.ts stoffZurPruefung)
  const zuPruefung = stoffzettelZurPruefung(v, unit.subject, heute);
  const angebot = zuPruefung && !zuPruefung.uebernommen ? zuPruefung.test : null;
  // the same exam is in already: say so instead of offering it again
  const eingetragen = v.terminText ? schonEingetragen(v.terminText, repo.upcomingTests(heute, unit.student_id), heute, unit.subject) : null;
  // one line per point; a point confirmed with several skills stands once, with all of them
  const zeilen: { x: (typeof v.punkte)[number]; skills: string[] }[] = [];
  for (const x of v.punkte) {
    const skill = x.skill_id && (x.zuordnung === "sicher" || x.zuordnung === "bestaetigt") ? x.skill_id : null;
    const da = zeilen.find((z) => skill && z.skills.length && z.x.inhalt === x.inhalt && z.x.original === x.original);
    if (da) da.skills.push(skill!);
    else zeilen.push({ x, skills: skill ? [skill] : [] });
  }
  // open while there is something to confirm or read before the lesson goes on; afterwards one line
  const offen = !begonnen && (unklar.length > 0 || Boolean(v.hinweis) || Boolean(angebot));
  const fotos = dateien.filter((d) => d.art === "Foto").length;
  const pdfs = dateien.length - fotos;
  const kurz = [
    fotos ? mehrzahl(fotos, "Foto", "Fotos") : "",
    pdfs ? mehrzahl(pdfs, "PDF", "PDFs") : "",
    zeilen.length ? mehrzahl(zeilen.length, "Thema", "Themen") : "",
    unklar.length ? `${unklar.length} zum Bestätigen` : "",
    ohneSchritt ? `${mehrzahl(ohneSchritt, "Erklärung", "Erklärungen")} ohne Schritt` : "",
    angebot ? "Stoffzettel noch nicht bei der Prüfung" : "",
    !v.angewendet && begonnen ? "Plan noch nicht angepasst" : "",
  ].filter(Boolean);
  const punkte = (
    <ul className="grid gap-1.5" data-testid="vorgabe-punkte">
      {zeilen.map(({ x, skills }, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[14.5px]">
          <span className="font-medium">{x.inhalt}</span>
          <span className="text-[13px] text-ink-3">
            {skills.length
              ? `→ ${skills.map(skillName).join(", ")}`
              : x.zuordnung === "unklar"
                ? "→ kurz bestätigen"
                : x.gruppe === "umfang"
                  ? "Kapitel"
                  : "→ keine passende Fähigkeit"}
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <details className="panel group px-4 sm:px-5" open={offen} aria-label="Vorgabe für heute" data-testid="vorgabe">
      <summary className="flex min-h-[52px] cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 py-2 [&::-webkit-details-marker]:hidden" data-testid="vorgabe-zeile">
        <ClipboardList size={18} className="text-ink-2" aria-hidden />
        <h2 className="text-[16px] font-semibold">Vorgabe für heute</h2>
        {v.angewendet && <Pill tone="green">Plan danach</Pill>}
        {kurz.length > 0 && <span className="text-[13.5px] text-ink-2">{kurz.join(" · ")}</span>}
        <ChevronDown size={16} className="ml-auto text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-3 pb-4">
        {v.text && <p className="text-[14px] text-ink-2">„{v.text}“</p>}
        {dateien.length > 0 && (
          <ul className="grid gap-1" data-testid="vorgabe-dateien">
            {dateien.map((d) => (
              <li key={d.materialId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
                <a href={`/material/${d.materialId}/datei`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] min-w-[4.5rem] items-center gap-1 font-semibold text-accent hover:underline">
                  <FileText size={14} aria-hidden /> {d.name}:
                </a>
                <RolleWahl action={rolleAendernAction.bind(null, unit.id, d.materialId)} rolle={d.rolle ?? ""} optionen={ROLLEN} label={`Art von ${d.name}`} />
                {!d.gelesen && <span className="text-[12.5px] text-ink-3">nicht gelesen</span>}
                {zuordnen.has(d.materialId) && schritte.length > 0 && (
                  <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 pb-1" data-testid="unterlage-zuordnen">
                    <span className="text-[13.5px] text-ink-2">Passt zu welchem Schritt?</span>
                    <RolleWahl
                      action={unterlageSchrittAction.bind(null, unit.id, d.materialId)}
                      rolle={String(zuordnen.get(d.materialId) ?? "")}
                      optionen={schritte}
                      label={`Schritt für ${d.name}`}
                      name="schritt"
                      testid="unterlage-schritt"
                      leer="Zu keinem"
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {test && (
          <p className="text-[14px]">
            Prüfung: <span className="font-medium">{test.title || `${test.kind} ${test.subject}`}</span> am {tagMonat(test.date)}
          </p>
        )}
        {zeilen.length > PUNKTE_OFFEN ? (
          <details className="reveal" data-testid="vorgabe-alle-punkte">
            <summary>
              <ChevronDown size={15} aria-hidden className="reveal-chevron" />
              Alle {zeilen.length} Punkte
            </summary>
            <div className="pt-1">{punkte}</div>
          </details>
        ) : (
          zeilen.length > 0 && punkte
        )}
        {v.schwierigkeiten.length > 0 && (
          <p className="text-[14px]">
            <span className="font-medium">Schwierig: </span>
            {v.schwierigkeiten.join(" ")}
          </p>
        )}
        {unklar.length > 0 && (
          <form action={bestaetigeVorgabeAction.bind(null, unit.id)} className="grid gap-2 rounded-xl bg-panel px-3 py-3" data-testid="vorgabe-bestaetigen">
            <p className="text-[13px] text-ink-2">
              Welche Fähigkeiten sind gemeint? Mehrere gehen.{unklar.some(({ x }) => x.vorauswahl) ? " Angehakt ist, was die Wörter und das Lesen nahelegen; es zählt erst nach „Bestätigen“." : ""}
            </p>
            {unklar.map(({ x, i }) => (
              <fieldset key={i} className="grid gap-1.5">
                <legend className="text-[14px] font-medium">{x.inhalt}</legend>
                <ZuordnungWahl name={`zuordnung_${i}`} vorschlaege={x.vorschlaege.map((sid) => ({ id: sid, name: skillName(sid) }))} vorauswahl={x.vorauswahl} />
              </fieldset>
            ))}
            <div>
              <button className="btn btn-secondary btn-sm">Bestätigen</button>
            </div>
          </form>
        )}
        {angebot && (
          <form action={stoffZurPruefungAction.bind(null, unit.id, angebot.id)} className="grid gap-1.5 rounded-xl border border-line px-3 py-3" data-testid="vorgabe-stoff-zur-pruefung">
            <p className="text-[14px]">
              Der Stoffzettel gehört zu{angebot.title ? ` „${angebot.title}“` : ""}: {angebot.kind || "Prüfung"} am {tagMonat(angebot.date)}
            </p>
            <div>
              <button className="btn btn-primary btn-sm">
                <CalendarCheck size={15} aria-hidden /> {stoffKnopfText(angebot)}
              </button>
            </div>
            <p className="text-[12.5px] text-ink-3">Was dort schon steht, bleibt. Unklare Punkte bestätigst du bei der Prüfung.</p>
          </form>
        )}
        {zuPruefung?.uebernommen && (
          <p className="flex flex-wrap items-center gap-x-1.5 text-[14px] text-ink-2" data-testid="vorgabe-stoff-uebernommen">
            <CalendarCheck size={15} className="shrink-0 text-green" aria-hidden /> Stoff übernommen: {zuPruefung.test.kind || "Prüfung"} am {tagMonat(zuPruefung.test.date)}
            <Link href={`/schueler/${unit.student_id}/pruefung/${zuPruefung.test.id}/stoff`} className="inline-flex min-h-[44px] items-center font-semibold text-accent hover:underline">
              Ansehen
            </Link>
          </p>
        )}
        {abw.length > 0 && (
          <div className="flex gap-2 rounded-xl bg-amber-wash px-3 py-2.5 text-[14px] text-ink" data-testid="vorgabe-abweichung">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden />
            <div className="grid gap-1">
              <span className="font-semibold">Abweichung</span>
              {abw.map((a) => (
                <span key={a}>{a}</span>
              ))}
            </div>
          </div>
        )}
        {v.hinweis && <p className="text-[13px] text-ink-2">{v.hinweis}</p>}
        {v.terminText && eingetragen && (
          <p className="flex items-center gap-1.5 text-[14px] text-ink-2" data-testid="vorgabe-termin-da">
            <CalendarCheck size={15} className="shrink-0 text-green" aria-hidden /> Schon eingetragen: {eingetragen.title || eingetragen.kind} am {tagMonat(eingetragen.date)}
          </p>
        )}
        {v.terminText && !eingetragen && (
          <form action={pruefungAusVorgabeAction.bind(null, unit.id)} className="grid gap-2 rounded-xl border border-line px-3 py-3" data-testid="vorgabe-termin">
            <p className="text-[14px]">
              Im Text steht „{v.terminText}“. Als Prüfung eintragen? Das Datum trägst du selbst ein.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select name="art" defaultValue={/schularbeit|\bsa\b/i.test(v.terminText) ? "Schularbeit" : "Test"} className="input min-h-[44px] max-w-[11rem] text-[14px]" aria-label="Art">
                <option>Test</option>
                <option>Schularbeit</option>
                <option>Prüfung</option>
              </select>
              <input type="date" name="datum" required min={heute} className="input min-h-[44px] max-w-[12rem] text-[14px]" aria-label="Datum" />
              <button className="btn btn-secondary btn-sm">
                <CalendarPlus size={15} aria-hidden /> Prüfung eintragen
              </button>
            </div>
          </form>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!v.angewendet && (
            <form action={planAnpassenAction.bind(null, unit.id)}>
              <button className="btn btn-primary btn-sm" data-testid="vorgabe-plan-anpassen">
                Plan anpassen
              </button>
            </form>
          )}
          <details className="group">
            <summary className="btn btn-ghost btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">Ändern</summary>
            <div className="mt-2 w-[min(36rem,calc(100vw-4rem))]">
              <VorgabeForm unitId={unit.id} tests={tests} material={material} text={v.text} kiLiest={kiLiest} abbrechen />
            </div>
          </details>
          <form action={entferneVorgabeAction.bind(null, unit.id)}>
            <button className="btn btn-ghost btn-sm">Entfernen</button>
          </form>
        </div>
        {!v.angewendet && begonnen && <p className="text-[12.5px] text-ink-3">Du hast schon begonnen, darum ist der Ablauf noch der alte. „Plan anpassen“ fängt nach der Vorgabe von vorne an; Notizen bleiben.</p>}
      </div>
    </details>
  );
}
