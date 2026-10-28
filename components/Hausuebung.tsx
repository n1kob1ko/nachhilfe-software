import Link from "next/link";
import { CheckCircle2, Printer, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";
import {
  huAnzahlAction,
  huEntfernenAction,
  huFreigebenAction,
  huGeprueftAction,
  huKiAction,
  huNeuAction,
  huNotizAction,
  huTauschenAction,
  huThemaDazuAction,
  huUeberspringenAction,
  huZuruecknehmenAction,
} from "@/app/hausuebung-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { HausuebungKnopf } from "@/components/HausuebungKnopf";
import { Pill, Reveal } from "@/components/ui";
import { antwortText, frageText, loesungText } from "@/lib/cockpit";
import { kiGrundText } from "@/lib/ai/grund";
import { fehlt, HERKUNFT, MAX_JE_THEMA, themaKopf, zusammenfassung, type HuThema, type Vorschlag } from "@/lib/hausuebung";
import { antwortenText } from "@/lib/zu-bewerten";
import { shortDate } from "@/lib/summary";

const aufgabenText = (n: number) => `${n} ${n === 1 ? "Aufgabe" : "Aufgaben"}`;

/**
 * **Hausübung vorbereitet** im Abschluss (lib/hausuebung.ts): je Thema eine Zeile mit dem Grund, die Vorschau aller Aufgaben mit Lösung
 * (nur für die Lehrkraft), Ändern, Fälligkeit und „Hausübung freigeben“. Nichts davon sieht der Schüler, bevor freigegeben ist.
 */
export function HausuebungKarte({ v, name, fehler }: { v: Vorschlag; name: string; fehler: string | null }) {
  const unitId = v.unitId;
  return (
    <div id="hausuebung" className="mt-6 grid scroll-mt-24 gap-3 border-t border-line pt-4" data-testid="hausuebung">
      {v.status === "freigegeben" ? (
        <Freigegeben v={v} name={name} />
      ) : v.status === "uebersprungen" ? (
        <div className="grid gap-2">
          <h2 className="text-[17px] font-semibold">Hausübung</h2>
          <p className="text-[15px] text-ink-2" data-testid="hausuebung-keine">
            Heute keine Hausübung. So steht es in der Dokumentation.
          </p>
          <form action={huZuruecknehmenAction.bind(null, unitId)}>
            <HausuebungKnopf label="Doch eine Hausübung" art="ghost" klein testid="hausuebung-zuruecknehmen" />
          </form>
        </div>
      ) : (
        <Vorschlagen v={v} name={name} />
      )}
      {fehler && (
        <p role="alert" className="text-[14px] text-red" data-testid="hausuebung-fehler">
          {fehler}
        </p>
      )}
    </div>
  );
}

function Freigegeben({ v, name }: { v: Vorschlag; name: string }) {
  const themen = v.themen.filter((t) => t.aufgaben.length);
  return (
    <div className="grid gap-2" data-testid="hausuebung-freigegeben">
      <h2 className="inline-flex items-center gap-2 text-[17px] font-semibold text-green">
        <CheckCircle2 size={18} aria-hidden /> Hausübung freigegeben
      </h2>
      <p className="text-[15px]">
        {zusammenfassung(themen)}
        {v.faellig && <span className="num">, fällig {shortDate(v.faellig)}</span>}
      </p>
      <p className="text-[14px] text-ink-2">Steht im Schülerportal von {name}. Erledigt zählt, sobald die Übung fertig ist.</p>
      {v.worksheetId && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={`/arbeitsblatt/${v.worksheetId}`} target="_blank" className="btn btn-secondary btn-sm" data-testid="hausuebung-drucken">
            <Printer size={15} aria-hidden /> Drucken
          </Link>
          <Link href={`/uebungen/${v.worksheetId}`} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-accent hover:underline">
            Übung ansehen
          </Link>
        </div>
      )}
    </div>
  );
}

function Vorschlagen({ v, name }: { v: Vorschlag; name: string }) {
  const unitId = v.unitId;
  const laeuft = v.themen.some((t) => t.ki?.status === "laeuft");
  const keine = (
    <form action={huUeberspringenAction.bind(null, unitId)}>
      <HausuebungKnopf label="Heute keine Hausübung" art="ghost" testid="hausuebung-ueberspringen" />
    </form>
  );
  if (v.ohneErgebnisse)
    return (
      <div className="grid gap-2" data-testid="hausuebung-ohne">
        <h2 className="text-[17px] font-semibold">Hausübung vorbereitet</h2>
        <p className="text-[15px] text-ink-2">
          {v.offen
            ? `Noch alles offen: ${antwortenText(v.offen)} ${v.offen === 1 ? "wartet" : "warten"} auf deine Bewertung. Danach steht hier der Vorschlag.`
            : "Heute gibt es kein geprüftes Ergebnis, aus dem eine Hausübung folgt."}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {v.offen > 0 && (
            <Link href="#zu-bewerten" className="btn btn-secondary">
              Erst bewerten
            </Link>
          )}
          {v.planThemen.length > 0 && (
            <form action={huNeuAction.bind(null, unitId, true)}>
              <HausuebungKnopf label="Aus den Themen von heute bauen" testid="hausuebung-aus-plan" laeuft="Wird gebaut …" />
            </form>
          )}
          {keine}
        </div>
      </div>
    );
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[17px] font-semibold">Hausübung vorbereitet</h2>
        <p className="num text-[14px] text-ink-2" data-testid="hausuebung-dauer">
          {v.fach && `${v.fach} · `}
          {v.aufgaben.length ? `${aufgabenText(v.aufgaben.length)} · ${v.dauer.text}` : "noch keine Aufgabe"}
        </p>
      </div>
      {v.offen > 0 && (
        <p className="text-[14px] text-ink-2">
          {antwortenText(v.offen)} {v.offen === 1 ? "wartet" : "warten"} noch auf deine Bewertung; {v.offen === 1 ? "sie zählt" : "sie zählen"} hier erst danach.
        </p>
      )}
      {v.ausPlan && <p className="text-[14px] text-ink-2">Aus den Themen von heute gebaut, nicht aus Ergebnissen.</p>}
      <ul className="grid gap-2" data-testid="hausuebung-themen">
        {v.themen.map((t) => (
          <ThemaZeile key={t.id} t={t} v={v} />
        ))}
      </ul>
      {laeuft && <AutoRefresh seconds={4} />}
      {v.aufgaben.length > 0 && (
        <Reveal label={`Vorschau mit Lösungen (${aufgabenText(v.aufgaben.length)})`}>
          <Vorschau v={v} />
        </Reveal>
      )}
      <Reveal label="Ändern">
        <Aendern v={v} />
      </Reveal>
      <form action={huFreigebenAction.bind(null, unitId)} className="grid gap-2 border-t border-line pt-3">
        <label className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
          <span className="font-semibold">Fällig am</span>
          <input type="date" name="faellig" defaultValue={v.faellig ?? ""} required className="input num" style={{ width: "11rem", minHeight: 44 }} data-testid="hausuebung-faellig" />
          <span className="text-[13px] text-ink-3">{v.faelligAusTermin && v.faellig ? `nächste Einheit laut Plan: ${shortDate(v.faellig)}` : v.faellig ? "" : "Kein Termin im Plan: bitte wählen"}</span>
        </label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <HausuebungKnopf label="Hausübung freigeben" art="primary" gesperrt={Boolean(v.gesperrt)} laeuft="Wird freigegeben …" testid="hausuebung-freigeben" icon={<Send size={17} aria-hidden />} />
        </div>
        <p className="text-[13.5px] text-ink-2" data-testid="hausuebung-grund">
          {v.gesperrt ?? `${name} sieht sie erst danach im Schülerportal, ohne Lösungen.`}
        </p>
      </form>
      <div className="-mt-1">{keine}</div>
    </div>
  );
}

/** „4 Aufgaben Present Continuous“ mit dem Grund; fehlen Aufgaben, die KI auf Tippen (mit Kosten) oder der Hinweis zum Selbst-Ergänzen. */
function ThemaZeile({ t, v }: { t: HuThema; v: Vorschlag }) {
  const n = t.aufgaben.length;
  const f = fehlt(t);
  // the KI can still fill this topic (on tap or running): otherwise the teacher adds tasks herself (lib/hausuebung.ts themaKopf)
  const mitKi = f > 0 && Boolean(t.skillId) && t.stand !== "schreiben" && (t.ki?.status === "laeuft" || v.ki.erlaubt);
  return (
    <li className="grid gap-1" data-testid="hausuebung-thema">
      <p className="text-[15.5px]">
        <span className="font-semibold">{themaKopf(t, { selbst: !mitKi })}</span>
        <span className="ml-2 text-[13px] text-ink-3">{t.grund}</span>
      </p>
      {f > 0 && t.skillId && t.stand !== "schreiben" && (
        <div className="grid gap-1 pl-0 text-[14px]" data-testid="hausuebung-fehlt">
          {t.ki?.status === "laeuft" ? (
            <p className="flex items-center gap-2 text-ink-2" role="status">
              <Sparkles size={15} className="text-amber motion-safe:animate-pulse" aria-hidden /> Neue Aufgaben werden erstellt. Sie kommen hier als Vorschau.
            </p>
          ) : v.ki.erlaubt ? (
            <>
              <p className="text-ink-2">Ohne KI {f === 1 ? "fehlt eine passende Aufgabe" : `fehlen ${f} passende Aufgaben`}.</p>
              <form action={huKiAction.bind(null, v.unitId, t.id)}>
                <HausuebungKnopf label={`Neue Aufgaben erstellen${v.ki.kosten ? ` · ${v.ki.kosten}` : ""}`} klein icon={<Sparkles size={15} aria-hidden />} laeuft="Wird erstellt …" testid="hausuebung-ki" />
              </form>
              <p className="text-[13px] text-ink-3">{t.ki?.status === "fehler" ? `Ging gerade nicht: ${kiGrundText(t.ki.problem)}` : "Du siehst sie zuerst mit Lösungen; jede braucht dein „geprüft“."}</p>
            </>
          ) : (
            <p className="text-ink-2" data-testid="hausuebung-selbst">
              {n ? `${f === 1 ? "Eine passende Aufgabe fehlt" : `${f} passende Aufgaben fehlen`}, bitte selbst ergänzen: ` : ""}
              <Link href={`/einheiten/${v.unitId}?aendern=1#aendern`} className="font-semibold text-accent hover:underline">
                Hausübung eintragen
              </Link>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Jede Aufgabe mit Lösung und Herkunft; neue Aufgaben der KI mit „geprüft“. Nur für die Lehrkraft. */
function Vorschau({ v }: { v: Vorschlag }) {
  let nr = 0;
  return (
    <div className="grid gap-4" data-testid="hausuebung-vorschau">
      {v.themen
        .filter((t) => t.aufgaben.length)
        .map((t) => (
          <section key={t.id} className="grid gap-2" aria-label={t.name}>
            <h3 className="text-[14px] font-semibold text-ink-2">{t.name}</h3>
            <ol className="grid gap-3">
              {t.aufgaben.map((a) => {
                const antwort = antwortText(a.task);
                const weg = loesungText(a.task);
                nr++;
                return (
                  <li key={a.key} className="grid grid-cols-[1.75rem_minmax(0,1fr)] text-[15px] leading-snug" data-testid="hausuebung-aufgabe">
                    <span className="num text-ink-3">{nr}.</span>
                    <div className="grid min-w-0 gap-1 break-words">
                      <span className="whitespace-pre-line">{frageText(a.task)}</span>
                      {antwort.trim() ? (
                        <span className="font-medium whitespace-pre-line text-green">Lösung: {antwort}</span>
                      ) : (
                        <span className="text-[13.5px] text-ink-2">Freie Antwort: du bewertest sie.</span>
                      )}
                      {weg.trim() && weg !== antwort && <span className="text-[13.5px] whitespace-pre-line text-ink-2">{weg}</span>}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {a.herkunft === "ki" ? <Pill tone={a.geprueft ? "green" : "amber"}>{a.geprueft ? "neu erstellt, von dir geprüft" : "neu erstellt, ungeprüft"}</Pill> : !a.geprueft ? <Pill tone="amber">ungeprüft</Pill> : <span className="text-[12px] text-ink-3">{HERKUNFT[a.herkunft]}</span>}
                        {(a.herkunft === "ki" || !a.geprueft || a.task.sourceType === "ki") && (
                          <form action={huGeprueftAction.bind(null, v.unitId, t.id, a.key, !a.geprueft)}>
                            <HausuebungKnopf label={a.geprueft ? "Doch nicht geprüft" : "Geprüft"} art={a.geprueft ? "ghost" : "secondary"} klein icon={a.geprueft ? undefined : <CheckCircle2 size={14} aria-hidden />} testid="hausuebung-geprueft" />
                          </form>
                        )}
                        {t.stand !== "schreiben" && (
                          <form action={huTauschenAction.bind(null, v.unitId, t.id, a.key)}>
                            <HausuebungKnopf label="Tauschen" art="ghost" klein icon={<RefreshCw size={14} aria-hidden />} testid="hausuebung-tauschen" />
                          </form>
                        )}
                        <form action={huEntfernenAction.bind(null, v.unitId, t.id, a.key)}>
                          <HausuebungKnopf label="Entfernen" art="ghost" klein icon={<Trash2 size={14} aria-hidden />} testid="hausuebung-entfernen" />
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
    </div>
  );
}

/** Anzahl je Thema, ein Thema von heute dazu, der Hinweis für den Schüler, wieder wie vorgeschlagen. */
function Aendern({ v }: { v: Vorschlag }) {
  const unitId = v.unitId;
  return (
    <div className="grid gap-4 text-[15px]" data-testid="hausuebung-aendern">
      {v.themen.length > 0 && (
        <div className="grid gap-2">
          {v.themen
            .filter((t) => t.stand !== "schreiben")
            .map((t) => (
              <form key={t.id} action={huAnzahlAction.bind(null, unitId, t.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <label className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0">{t.name}</span>
                  <input name="anzahl" type="number" min={0} max={MAX_JE_THEMA} defaultValue={t.soll} className="input num text-right" style={{ width: "4.5rem", minHeight: 44 }} aria-label={`Aufgaben ${t.name}`} />
                  <span className="text-ink-2">Aufgaben</span>
                </label>
                <HausuebungKnopf label="Übernehmen" klein testid="hausuebung-anzahl" />
              </form>
            ))}
          <p className="text-[13px] text-ink-3">0 nimmt das Thema heraus.</p>
        </div>
      )}
      {v.planThemen.length > 0 && (
        <form action={huThemaDazuAction.bind(null, unitId)} className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label className="flex flex-wrap items-center gap-2">
            <span>Thema von heute dazu</span>
            <select name="skill_id" className="input" style={{ minHeight: 44, maxWidth: "100%" }} data-testid="hausuebung-thema-wahl">
              {v.planThemen.map((p) => (
                <option key={p.skillId} value={p.skillId}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <HausuebungKnopf label="Dazunehmen" klein testid="hausuebung-thema-dazu" />
        </form>
      )}
      <form action={huNotizAction.bind(null, unitId)} className="grid gap-2">
        <label className="grid gap-1">
          <span>Hinweis für den Schüler (steht bei der Hausübung)</span>
          <input name="notiz" type="text" maxLength={300} defaultValue={v.notiz} className="input" style={{ minHeight: 44 }} placeholder="z. B. Buch S. 42 dazu lesen" data-testid="hausuebung-notiz" />
        </label>
        <HausuebungKnopf label="Hinweis speichern" klein testid="hausuebung-notiz-speichern" />
      </form>
      {v.gespeichert && (
        <form action={huNeuAction.bind(null, unitId, false)}>
          <HausuebungKnopf label="Wieder wie vorgeschlagen" art="ghost" klein testid="hausuebung-neu" />
        </form>
      )}
    </div>
  );
}
