import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowDown, ArrowUp, CheckCircle2, Download, Pencil, Presentation, RotateCcw, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import {
  addAufgabeAction,
  addSchrittAction,
  archiveLernpaketAction,
  markGeprueftAction,
  moveSchrittAction,
  removeAufgabeAction,
  removeSchrittAction,
  restoreLernpaketAction,
  updateLernpaketAction,
  updateSchrittAction,
  zurueckZuEntwurfAction,
} from "@/app/lernpaket-actions";
import { StatusPill } from "@/components/LernpaketStatus";
import { SkillPicker } from "@/components/SkillPicker";
import { TaskBody } from "@/components/TaskPreview";
import { PageHeader, Pill, Reveal, SectionTitle, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { DIFFICULTIES, TASK_TYPES } from "@/lib/curriculum";
import { searchLibrary } from "@/lib/library";
import { getLernpaket, GRENZEN, offeneHinweise, PAKET_QUELLE, SCHRITT_ARTEN, ungeprueft, type LernpaketSchritt } from "@/lib/lernpakete";
import * as repo from "@/lib/repo";
import { fachVorschlaege, klassenLabel, SCHOOL_TYPES } from "@/lib/school";

export const metadata = { title: "Lernpaket" };

type Params = { bearbeiten?: string; schritt?: string; neuerSchritt?: string; fehler?: string; importiert?: string; geprueft?: string; gespeichert?: string; archiviert?: string; wiederhergestellt?: string };
const LP = "/mehr/lernpakete";

/** The teacher's script fields of a step, in the order they are used. */
const SKRIPT = [
  ["lehrer_sagt", "Lehrer sagt"],
  ["lehrer_fragt", "Lehrer fragt"],
  ["erwartete_antwort", "Erwartete Antwort"],
  ["bei_fehler", "Bei Fehler"],
  ["notiz", "Notiz"],
] as const;

/**
 * One Lernpaket: the steps in order with their minutes adding up, the teacher's script, the tasks with
 * solutions. Unchecked imports carry „Ungeprüft“ until a teacher marks them Geprüft. With „Bearbeiten“ the
 * steps can be added, moved, changed and removed.
 */
export default async function LernpaketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const p = getLernpaket(Number(id));
  if (!p) notFound();
  const archiviert = p.status === "archiviert";
  const bearbeiten = Boolean(sp.bearbeiten) && !archiviert;
  const skills = repo.listSkills();
  const skillName = (sid: string) => repo.getSkill(sid)?.name ?? sid;
  const fehler = sp.fehler?.split("\n").filter(Boolean) ?? [];
  const hinweise = offeneHinweise(p);
  const offen = ungeprueft(p);
  const summe = p.minuten_summe;
  const aufgabenZahl = p.schritte.reduce((n, s) => n + s.aufgaben.length, 0);
  const folien = new Set(p.schritte.map((s) => s.folie).filter(Boolean)).size;
  const stufe = p.klasse ? klassenLabel(p.schulart, p.klasse) : p.schulart;
  const bibliothek = bearbeiten ? searchLibrary({ subject: p.fach }, 300) : [];
  const fehlerOrt = sp.schritt ? `schritt-${sp.schritt}` : sp.neuerSchritt ? "neuer-schritt" : null;
  // start minute of each step: the minutes add up to the total
  const start = p.schritte.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + p.schritte[i - 1].minuten], []);
  const diff = p.dauer_minuten - summe;

  const meldung = sp.importiert
    ? "Importiert. Lies die Schritte und Aufgaben durch, dann „Geprüft“."
    : sp.geprueft
      ? "Als geprüft markiert."
      : sp.gespeichert
        ? "Gespeichert."
        : sp.archiviert
          ? "Archiviert. Das Paket ist unter „Archiviert“ weiter da."
          : sp.wiederhergestellt
            ? "Wiederhergestellt."
            : null;

  return (
    <>
      <PageHeader
        back={{ href: archiviert ? `${LP}?status=archiviert` : LP, label: "Lernpakete" }}
        title={p.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            {p.fach}
            {stufe && ` · ${stufe}`}
            {p.thema && ` · ${p.thema}`}
            <Pill>{p.schwierigkeit}</Pill>
            <StatusPill p={p} />
          </span>
        }
        actions={
          <>
            <a href={`${LP}/${p.id}/export`} className="btn btn-secondary" download>
              <Download size={16} aria-hidden /> Exportieren
            </a>
            {!archiviert && (
              <Link href={bearbeiten ? `${LP}/${p.id}` : `${LP}/${p.id}?bearbeiten=1`} className={`btn ${bearbeiten ? "btn-primary" : "btn-secondary"}`}>
                {bearbeiten ? <CheckCircle2 size={16} aria-hidden /> : <Pencil size={16} aria-hidden />} {bearbeiten ? "Fertig" : "Bearbeiten"}
              </Link>
            )}
          </>
        }
      />
      {meldung && (
        <p className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-green" role="status">
          <CheckCircle2 size={16} aria-hidden /> {meldung}
        </p>
      )}
      {fehler.length > 0 && !fehlerOrt && <Fehler fehler={fehler} />}

      {archiviert ? (
        <section className="panel mb-8 flex flex-wrap items-center gap-3 px-5 py-4" aria-label="Archiviert">
          <Archive size={18} className="text-ink-3" aria-hidden />
          <p className="min-w-0 flex-1 text-[14px] text-ink-2">Archiviert. Es steht in keiner Liste mehr, bleibt aber mit allen Schritten erhalten.</p>
          <form action={restoreLernpaketAction.bind(null, p.id)}>
            <button className="btn btn-secondary">
              <RotateCcw size={16} aria-hidden /> Wiederherstellen
            </button>
          </form>
        </section>
      ) : (
        p.status === "entwurf" && (
          <section id="pruefen" className={`mb-8 scroll-mt-24 rounded-[18px] px-5 py-4 ${offen ? "bg-amber-wash" : "panel"}`} aria-label="Prüfen">
            <p className={`flex items-start gap-2 text-[14px] ${offen ? "text-amber" : "text-ink-2"}`}>
              {offen ? <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden /> : <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />}
              <span>
                {offen
                  ? `${p.quelle === "ki" ? "Von der KI erstellt" : "Importiert"} und noch nicht geprüft. Lies jeden Schritt und jede Aufgabe mit Lösung, bevor du damit unterrichtest.`
                  : "Entwurf. Wenn Ablauf und Aufgaben passen, als geprüft markieren."}
              </span>
            </p>
            {hinweise.length > 0 && (
              <div className="mt-3">
                <p className="text-[13px] font-semibold">Noch zu prüfen:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[14px]">
                  {hinweise.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            <form action={markGeprueftAction.bind(null, p.id)} className="mt-3 flex flex-wrap items-center gap-3">
              {hinweise.length > 0 && (
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px]">
                  <input type="checkbox" name="hinweise_geprueft" value="1" required className="h-5 w-5 accent-[var(--accent)]" />
                  Ich habe diese Punkte geprüft.
                </label>
              )}
              <button className="btn btn-primary" disabled={!p.schritte.length}>
                <ShieldCheck size={16} aria-hidden /> Geprüft
              </button>
            </form>
          </section>
        )
      )}

      <ul className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Auf einen Blick">
        <li className="kennzahl">
          <span className="kennzahl-wort">Dauer</span>
          <span className="kennzahl-wert">{summe} min</span>
          <span className="kennzahl-zusatz">{diff === 0 ? "wie geplant" : diff > 0 ? `geplant ${p.dauer_minuten}, noch ${diff} frei` : `${-diff} min über ${p.dauer_minuten}`}</span>
        </li>
        <li className="kennzahl">
          <span className="kennzahl-wort">Schritte</span>
          <span className="kennzahl-wert">{p.schritte.length}</span>
          <span className="kennzahl-zusatz">{PAKET_QUELLE[p.quelle]}</span>
        </li>
        <li className="kennzahl">
          <span className="kennzahl-wort">Aufgaben</span>
          <span className="kennzahl-wert">{aufgabenZahl}</span>
          <span className="kennzahl-zusatz">mit Lösung</span>
        </li>
        <li className="kennzahl">
          <span className="kennzahl-wort">Folien</span>
          <span className="kennzahl-wert">{folien}</span>
          <span className="kennzahl-zusatz">in der Präsentation</span>
        </li>
      </ul>

      {(p.ziel || p.skill_ids.length > 0 || p.geprueft_am) && (
        <section className="mb-8 max-w-[760px]" aria-label="Ziel">
          {p.ziel && (
            <p className="text-[15px]">
              <span className="font-semibold">Ziel: </span>
              {p.ziel}
            </p>
          )}
          {p.skill_ids.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
              Fähigkeiten:
              {p.skill_ids.map((sid) => (
                <Link key={sid} href={`/faehigkeiten/${encodeURIComponent(sid)}`} className="rounded-full bg-accent-wash px-2.5 py-0.5 font-semibold text-accent hover:underline">
                  {skillName(sid)}
                </Link>
              ))}
            </p>
          )}
          {p.geprueft_am && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-2">
              <ShieldCheck size={14} className="text-green" aria-hidden /> Geprüft am {formatDate(p.geprueft_am)}
              {p.geprueft_von_name && ` von ${p.geprueft_von_name}`}
            </p>
          )}
        </section>
      )}

      <SectionTitle>Ablauf</SectionTitle>
      {p.schritte.length === 0 && <p className="mb-4 text-[14px] text-ink-3">Noch keine Schritte. {bearbeiten ? "Unten den ersten Schritt anlegen." : "Mit „Bearbeiten“ den ersten Schritt anlegen."}</p>}
      <ol className="grid gap-3">
        {p.schritte.map((s, i) => (
          <li key={s.id} id={`schritt-${s.id}`} className="panel scroll-mt-24 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
              <span className="num w-[78px] shrink-0 pt-0.5 text-[13px] font-semibold text-ink-3" aria-label={`Minute ${start[i]} bis ${start[i] + s.minuten}`}>
                {start[i]}–{start[i] + s.minuten} min
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="num text-ink-3">{i + 1}.</span> {s.titel}
                  <Pill tone={s.art === "kontrolle" ? "green" : s.art === "zusatz" ? "amber" : "accent"}>{SCHRITT_ARTEN[s.art]}</Pill>
                  <span className="num text-[13px] font-normal text-ink-3">{s.minuten} min</span>
                </h3>
              </div>
            </div>
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-[14px] sm:grid-cols-[150px_1fr] sm:pl-[90px]">
              {s.folie && (
                <>
                  <dt className="text-ink-3">Präsentation zeigt</dt>
                  <dd className="flex items-center gap-1.5">
                    <Presentation size={14} className="text-accent" aria-hidden /> Folie {s.folie}
                  </dd>
                </>
              )}
              {SKRIPT.filter(([k]) => s[k]).map(([k, l]) => (
                <div key={k} className="contents">
                  <dt className={k === "bei_fehler" ? "text-amber" : "text-ink-3"}>{l}</dt>
                  <dd className="whitespace-pre-line">{s[k]}</dd>
                </div>
              ))}
            </dl>
            {s.pruefen.length > 0 && (
              <ul className="mt-2 grid gap-1 rounded-lg bg-amber-wash px-3 py-2 text-[13px] text-amber sm:ml-[90px]">
                {s.pruefen.map((h, j) => (
                  <li key={j} className="flex items-start gap-1.5">
                    <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> Bitte prüfen: {h}
                  </li>
                ))}
              </ul>
            )}
            {s.aufgaben.length > 0 && (
              <div className="mt-3 sm:pl-[90px]">
                <Reveal label={`${s.aufgaben.length} ${s.aufgaben.length === 1 ? "Aufgabe" : "Aufgaben"} mit Lösung`}>
                  <ol className="grid gap-3">
                    {s.aufgaben.map((a, j) => (
                      <li key={j} className="rounded-xl border border-line px-3 py-3">
                        <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                          <span className="num font-semibold text-ink-3">Aufgabe {j + 1}</span>
                          <Pill>{TASK_TYPES[a.type] ?? a.type}</Pill>
                          <Pill>{a.difficulty}</Pill>
                          {a.data.pruefen?.map((h, k) => (
                            <Pill key={k} tone="amber">
                              Bitte prüfen: {h}
                            </Pill>
                          ))}
                        </p>
                        <TaskBody task={a} showSolution skillName={a.skillId ? skillName(a.skillId) : undefined} subject={p.fach} />
                        {bearbeiten && (
                          <form action={removeAufgabeAction.bind(null, s.id, j)} className="mt-2">
                            <button className="btn btn-ghost btn-sm text-red">
                              <Trash2 size={14} aria-hidden /> Aufgabe entfernen
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ol>
                </Reveal>
              </div>
            )}
            {bearbeiten && (
              <SchrittBearbeiten
                s={s}
                erster={i === 0}
                letzter={i === p.schritte.length - 1}
                offen={sp.schritt === String(s.id)}
                fehler={fehlerOrt === `schritt-${s.id}` ? fehler : []}
                bibliothek={bibliothek.map((e) => ({ id: e.id, title: e.title }))}
              />
            )}
          </li>
        ))}
      </ol>
      {p.schritte.length > 0 && (
        <p className="mt-3 text-right text-[14px] text-ink-2">
          Zusammen <span className="num font-semibold text-ink">{summe} min</span>
          {diff !== 0 && <span className={diff < 0 ? "text-amber" : ""}> · geplant {p.dauer_minuten} min</span>}
        </p>
      )}

      {bearbeiten && (
        <>
          <details id="neuer-schritt" className="panel mt-4 scroll-mt-24 px-4 py-3 sm:px-5" open={Boolean(sp.neuerSchritt) || p.schritte.length === 0 || undefined}>
            <summary className="cursor-pointer font-semibold text-accent">Schritt hinzufügen</summary>
            {fehlerOrt === "neuer-schritt" && <Fehler fehler={fehler} />}
            <form action={addSchrittAction.bind(null, p.id)} className="pt-3">
              <SchrittFelder />
              <button className="btn btn-primary mt-3">Schritt anlegen</button>
            </form>
          </details>

          <section id="angaben" className="mt-10 max-w-[760px] scroll-mt-24" aria-label="Angaben">
            <SectionTitle>Angaben zum Paket</SectionTitle>
            {fehler.length > 0 && !fehlerOrt && <p className="mb-2 text-[13px] text-red">Siehe oben.</p>}
            <form action={updateLernpaketAction.bind(null, p.id)} className="grid gap-3 sm:grid-cols-2">
              <label className="field sm:col-span-2">
                <span className="label">Titel</span>
                <input className="input" name="title" defaultValue={p.title} required maxLength={GRENZEN.titel} />
              </label>
              <label className="field">
                <span className="label">Fach</span>
                <input className="input" name="fach" defaultValue={p.fach} required list="lp-faecher" maxLength={60} autoComplete="off" />
                <datalist id="lp-faecher">
                  {fachVorschlaege().map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span className="label">Thema</span>
                <input className="input" name="thema" defaultValue={p.thema} maxLength={GRENZEN.thema} />
              </label>
              <label className="field">
                <span className="label">Schulart</span>
                <select className="input" name="schulart" defaultValue={p.schulart}>
                  <option value="">jede</option>
                  {SCHOOL_TYPES.map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Klasse</span>
                <select className="input" name="klasse" defaultValue={p.klasse ?? ""}>
                  <option value="">jede</option>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((k) => (
                    <option key={k} value={k}>
                      {k}.
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Schwierigkeit</span>
                <select className="input" name="schwierigkeit" defaultValue={p.schwierigkeit}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Geplante Minuten</span>
                <input className="input num" type="number" name="dauer_minuten" min={1} max={GRENZEN.dauer} defaultValue={p.dauer_minuten} required />
              </label>
              <label className="field sm:col-span-2">
                <span className="label">Ziel</span>
                <textarea className="input" name="ziel" rows={2} defaultValue={p.ziel} maxLength={GRENZEN.ziel} />
              </label>
              <div className="field sm:col-span-2">
                <span className="label">Fähigkeiten ({p.fach})</span>
                <SkillPicker skills={skills.filter((k) => k.subject === p.fach)} selected={p.skill_ids} />
              </div>
              <div className="sm:col-span-2">
                <button className="btn btn-secondary">Angaben speichern</button>
              </div>
            </form>
          </section>
        </>
      )}

      {!archiviert && (
        <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-5">
          {p.status === "geprueft" && (
            <form action={zurueckZuEntwurfAction.bind(null, p.id)}>
              <button className="btn btn-secondary">Zurück zum Entwurf</button>
            </form>
          )}
          <form action={archiveLernpaketAction.bind(null, p.id)}>
            <button className="btn btn-secondary">
              <Archive size={16} aria-hidden /> Archivieren
            </button>
          </form>
          <p className="basis-full text-[13px] text-ink-3">Archivieren nimmt das Paket aus der Liste. Gelöscht wird nichts; unter „Archiviert“ lässt es sich wiederherstellen.</p>
        </div>
      )}
    </>
  );
}

function Fehler({ fehler }: { fehler: string[] }) {
  return (
    <div className="my-3 rounded-lg bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
      <ul className="list-disc space-y-0.5 pl-5">
        {fehler.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

/** The fields of a step, empty for a new one. */
function SchrittFelder({ s }: { s?: LernpaketSchritt }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_110px_110px]">
      <label className="field sm:col-span-2">
        <span className="label">Titel</span>
        <input className="input" name="titel" defaultValue={s?.titel} required maxLength={GRENZEN.titel} placeholder="z. B. Vier Fälle, vier Fragen" />
      </label>
      <label className="field">
        <span className="label">Minuten</span>
        <input className="input num" type="number" name="minuten" min={1} max={GRENZEN.minuten} defaultValue={s?.minuten ?? 5} required />
      </label>
      <label className="field">
        <span className="label">Folie</span>
        <input className="input num" type="number" name="folie" min={1} max={500} defaultValue={s?.folie ?? ""} placeholder="–" />
      </label>
      <label className="field sm:col-span-4">
        <span className="label">Art</span>
        <select className="input" name="art" defaultValue={s?.art ?? "erklaerung"}>
          {Object.entries(SCHRITT_ARTEN).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {SKRIPT.map(([k, l]) => (
        <label key={k} className="field sm:col-span-4">
          <span className="label">{l}</span>
          <textarea className="input" name={k} rows={k === "lehrer_sagt" ? 3 : 2} defaultValue={s?.[k]} maxLength={GRENZEN.text} />
        </label>
      ))}
      <label className="field sm:col-span-4">
        <span className="label">Noch zu prüfen (ein Punkt pro Zeile)</span>
        <textarea className="input" name="pruefen" rows={2} defaultValue={s?.pruefen.join("\n")} />
      </label>
    </div>
  );
}

function SchrittBearbeiten({ s, erster, letzter, offen, fehler, bibliothek }: { s: LernpaketSchritt; erster: boolean; letzter: boolean; offen: boolean; fehler: string[]; bibliothek: { id: number; title: string }[] }) {
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={moveSchrittAction.bind(null, s.id, -1)}>
          <button className="btn btn-secondary btn-sm" disabled={erster} aria-label={`„${s.titel}“ nach oben`}>
            <ArrowUp size={15} aria-hidden /> Nach oben
          </button>
        </form>
        <form action={moveSchrittAction.bind(null, s.id, 1)}>
          <button className="btn btn-secondary btn-sm" disabled={letzter} aria-label={`„${s.titel}“ nach unten`}>
            <ArrowDown size={15} aria-hidden /> Nach unten
          </button>
        </form>
      </div>
      {fehler.length > 0 && <Fehler fehler={fehler} />}
      <details className="reveal mt-2" open={offen || undefined}>
        <summary>Schritt bearbeiten</summary>
        <form action={updateSchrittAction.bind(null, s.id)} className="pt-3">
          <SchrittFelder s={s} />
          <button className="btn btn-primary mt-3">Schritt speichern</button>
        </form>
        <form action={addAufgabeAction.bind(null, s.id)} className="mt-5 flex flex-wrap items-end gap-2">
          <label className="field min-w-[220px] flex-1">
            <span className="label">Aufgabe aus der Aufgabenbibliothek</span>
            <select className="input" name="eintrag" required defaultValue="" disabled={!bibliothek.length}>
              <option value="" disabled>
                {bibliothek.length ? "Aufgabe wählen …" : "Keine Aufgaben in diesem Fach"}
              </option>
              {bibliothek.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-secondary" disabled={!bibliothek.length}>
            Hinzufügen
          </button>
        </form>
        <form action={removeSchrittAction.bind(null, s.id)} className="mt-5">
          <button className="btn btn-ghost btn-sm text-red">
            <Trash2 size={14} aria-hidden /> Schritt entfernen
          </button>
        </form>
      </details>
    </div>
  );
}
