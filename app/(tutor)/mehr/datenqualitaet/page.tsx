import Link from "next/link";
import { mergePairAction, moveSkillsAction, resetSkillOverrideAction, setCarelessAction } from "@/app/datenqualitaet-actions";
import { Info } from "@/components/Info";
import { More, PageHeader, Pill, Reveal, SectionTitle, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { corrections, findDuplicates, ownCorrections, type DuplicateSkill } from "@/lib/datenqualitaet";
import { listSkills, type Skill } from "@/lib/repo";
import { rangeLabel } from "@/lib/school";
import { carelessCredit } from "@/lib/service";

export const metadata = { title: "Datenqualität" };

type Params = { fach?: string; thema?: string; alle?: string; fehler?: string; ok?: string };
const DQ = "/mehr/datenqualitaet";
const href = (p: Partial<Params>, hash = "") => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return `${q ? `${DQ}?${q}` : DQ}${hash}`;
};
const skillHref = (id: string) => `/faehigkeiten/${encodeURIComponent(id)}`;
const OK_TEXT: Record<string, string> = {
  zusammengefuehrt: "Zusammengeführt.",
  zurueckgesetzt: "Auf das Original zurückgesetzt.",
  verschoben: "Verschoben.",
  getrennt: "Zusammenführung aufgehoben.",
  gespeichert: "Gespeichert.",
};
const navChip = (on: boolean) => `inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[14px] font-medium whitespace-nowrap ${on ? "bg-ink text-surface" : "bg-panel text-ink-2 hover:text-ink"}`;
const radioChip = "flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13.5px] has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent";

/**
 * Mehr › Datenqualität: Dubletten, own corrections with reset, moving skills to another Thema, the
 * Lernstand setting for Flüchtigkeitsfehler and the correction log. Corrections of a single skill
 * (Einordnung, Lehrplan links, prerequisites, merging) live on its own page.
 */
export default async function DataQualityPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireTeacher();
  const sp = await searchParams;
  const skills = listSkills();
  const subjects = [...new Set(skills.map((s) => s.subject))];
  const subject = subjects.includes(sp.fach ?? "") ? sp.fach! : null;
  const crossArea = sp.alle === "1";
  const base: Partial<Params> = { fach: subject ?? undefined, alle: crossArea ? "1" : undefined };

  const pairs = findDuplicates(subject, { crossArea });
  const own = ownCorrections();
  const log = corrections(30);
  const careless = carelessCredit();

  const inSubject = subject ? skills.filter((s) => s.subject === subject) : [];
  const areas = [...new Set(inSubject.map((s) => s.area))];
  const area = areas.includes(sp.thema ?? "") ? sp.thema! : null;
  const inArea = area ? inSubject.filter((s) => s.area === area) : [];
  const tops = inArea.filter((s) => !s.parent_id || !inArea.some((p) => p.id === s.parent_id));

  return (
    <>
      <PageHeader
        title="Datenqualität"
        back={{ href: "/mehr", label: "Mehr" }}
        info="Offizielle Lehrplandaten bleiben unverändert. Eigene Korrekturen werden getrennt gespeichert und lassen sich jederzeit zurücksetzen. Thema, Klassen, Voraussetzungen und Lehrplan-Verknüpfungen einer Fähigkeit korrigierst du auf ihrer Seite."
      />
      {sp.fehler && (
        <p className="mb-6 max-w-[920px] rounded-lg bg-red-wash px-4 py-2.5 text-[14px] text-red" role="alert">
          {sp.fehler}
        </p>
      )}
      {sp.ok && OK_TEXT[sp.ok] && (
        <p className="mb-6 text-[14px] font-medium text-green" role="status">
          {OK_TEXT[sp.ok]}
        </p>
      )}

      <nav aria-label="Fach" className="-mt-2 mb-8 flex max-w-full gap-1.5 overflow-x-auto pb-1">
        <Link href={href({ alle: base.alle })} aria-current={!subject ? "page" : undefined} className={navChip(!subject)}>
          Alle Fächer
        </Link>
        {subjects.map((s) => (
          <Link key={s} href={href({ ...base, fach: s })} aria-current={subject === s ? "page" : undefined} className={navChip(subject === s)}>
            {s}
          </Link>
        ))}
      </nav>

      <div className="grid max-w-[920px] gap-10">
        <section aria-label="Dubletten" id="dubletten">
          <SectionTitle
            action={
              <Link href={href({ ...base, alle: crossArea ? undefined : "1" }, "#dubletten")} aria-current={crossArea ? "true" : undefined} className={navChip(crossArea)}>
                auch andere Themen
              </Link>
            }
          >
            <span>
              Dubletten {pairs.length > 0 && <Pill tone="amber">{pairs.length}</Pill>}
              <Info label="Info zu Dubletten">Gleicher Name im selben Fach; Groß-/Kleinschreibung, Umlaute und Satzzeichen zählen nicht. Die App führt nichts selbst zusammen.</Info>
            </span>
          </SectionTitle>
          {pairs.length === 0 ? (
            <p className="text-[14px] text-ink-3">Keine Dubletten gefunden.</p>
          ) : (
            <ul className="grid gap-3">
              {pairs.map((p) => (
                <li key={`${p.a.id}|${p.b.id}`} className="panel px-4 py-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DuplicateCell s={p.a} />
                    <DuplicateCell s={p.b} />
                  </div>
                  <Reveal label="Zusammenführen" className="mt-1">
                    <form action={mergePairAction} className="grid gap-3">
                      <input type="hidden" name="a" value={p.a.id} />
                      <input type="hidden" name="b" value={p.b.id} />
                      <input type="hidden" name="fach" value={subject ?? ""} />
                      <input type="hidden" name="alle" value={crossArea ? "1" : ""} />
                      <fieldset className="field">
                        <legend className="label mb-1.5">Bleibt</legend>
                        <div className="flex flex-wrap gap-1.5">
                          {[p.a, p.b].map((s) => (
                            <label key={s.id} className={radioChip}>
                              <input type="radio" name="keep" value={s.id} defaultChecked={s.id === p.keep} className="sr-only" />
                              {s.name}
                              {!p.sameArea && <span className="text-ink-3">· {s.area}</span>}
                              <span className="num text-ink-3">· {s.answers} Antw.</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <p className="text-[13px] text-ink-2">Die andere verschwindet aus den Listen, ihre Antworten zählen für die bleibende. Rückgängig unter „Eigene Korrekturen“.</p>
                      <button className="btn btn-primary btn-sm justify-self-start">Zusammenführen</button>
                    </form>
                  </Reveal>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Eigene Korrekturen" id="korrekturen">
          <SectionTitle>
            <span>
              Eigene Korrekturen {own.length > 0 && <Pill>{own.length}</Pill>}
              <Info label="Info zu eigenen Korrekturen">Getrennt vom Lehrplan gespeichert. „Zurücksetzen“ stellt das Original her und hebt eine Zusammenführung auf. Übernommene Verknüpfungen bleiben und sind auf der Fähigkeit entfernbar.</Info>
            </span>
          </SectionTitle>
          {own.length === 0 ? (
            <p className="text-[14px] text-ink-3">Noch keine eigenen Korrekturen.</p>
          ) : (
            <ul className="panel divide-y divide-line">
              {own.map((c) => (
                <li key={c.skill_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
                  <Link href={skillHref(c.skill_id)} className="flex min-h-[44px] items-center font-medium hover:text-accent">
                    {c.name}
                  </Link>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {c.changes.map((x) => (
                      <Pill key={x}>{x}</Pill>
                    ))}
                    {c.merged_into && <Pill tone="amber">zusammengeführt mit {c.merged_name ?? c.merged_into}</Pill>}
                  </span>
                  <details className="reveal">
                    <summary>Zurücksetzen</summary>
                    <form action={resetSkillOverrideAction.bind(null, c.skill_id)} className="pb-2">
                      <button className="btn btn-danger btn-sm">Ja, auf Original</button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Fähigkeiten verschieben" id="verschieben">
          <SectionTitle>
            <span>
              Fähigkeiten verschieben
              <Info label="Info zum Verschieben">Ändert das Thema mehrerer Fähigkeiten auf einmal. Teilfähigkeiten im selben Thema wandern mit. Klassen, Lehrplan-Verknüpfungen und Antworten bleiben.</Info>
            </span>
          </SectionTitle>
          {!subject ? (
            <p className="text-[14px] text-ink-3">Oben ein Fach wählen.</p>
          ) : (
            <>
              <nav aria-label="Thema" className="mb-3 flex flex-wrap gap-1.5">
                {areas.map((a) => (
                  <Link key={a} href={href({ ...base, thema: a }, "#verschieben")} aria-current={a === area ? "page" : undefined} className={navChip(a === area)}>
                    {a} <span className="num opacity-70">{inSubject.filter((s) => s.area === a).length}</span>
                  </Link>
                ))}
              </nav>
              {area && (
                <form action={moveSkillsAction} className="panel grid gap-3 px-4 py-3">
                  <input type="hidden" name="fach" value={subject} />
                  <input type="hidden" name="thema" value={area} />
                  <ul className="grid">
                    {tops.map((s) => (
                      <MoveRow key={s.id} s={s} inArea={inArea} depth={0} />
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                    <label className="field min-w-[220px] flex-1">
                      <span className="label">Neues Thema</span>
                      <input className="input" name="ziel" list="dq-themen" required maxLength={80} placeholder="Thema wählen oder neu eingeben" />
                    </label>
                    <datalist id="dq-themen">
                      {areas
                        .filter((a) => a !== area)
                        .map((a) => (
                          <option key={a} value={a} />
                        ))}
                    </datalist>
                    <button className="btn btn-primary">Verschieben</button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>

        <section aria-label="Lernstand" id="lernstand">
          <SectionTitle>Lernstand</SectionTitle>
          <div className="panel flex flex-wrap items-center gap-3 px-4 py-2">
            <span className="flex min-w-[200px] flex-1 items-center">
              Flüchtigkeitsfehler milder werten
              <Info label="Info zu Flüchtigkeitsfehlern">
                Falsche Antworten, die du als Flüchtigkeitsfehler oder „Aufgabe falsch gelesen“ markiert hast, zählen im Lernstand mit 30 % statt 0 %. Der Vorschlag der App allein zählt nie.
              </Info>
            </span>
            <Pill tone={careless ? "green" : "neutral"}>{careless ? "an" : "aus"}</Pill>
            <form action={setCarelessAction.bind(null, !careless)}>
              <button className="btn btn-secondary btn-sm">{careless ? "Ausschalten" : "Einschalten"}</button>
            </form>
          </div>
        </section>

        <section aria-label="Letzte Korrekturen" id="verlauf">
          <SectionTitle>Letzte Korrekturen</SectionTitle>
          <More
            limit={8}
            empty="Noch keine Korrekturen."
            className="panel divide-y divide-line"
            items={log.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-2 text-[14px]">
                <span className="num w-[52px] shrink-0 text-[12.5px] text-ink-3">{formatDate(c.changed_at, { day: "numeric", month: "short" })}</span>
                <Link href={skillHref(c.skill_id)} className="flex min-h-[40px] items-center font-medium hover:text-accent">
                  {c.skill_name}
                </Link>
                <Pill tone={c.action === "zusammenfuehren" ? "amber" : "neutral"}>{c.label}</Pill>
                {c.detail && <span className="min-w-0 flex-1 text-ink-2">{c.detail}</span>}
                {c.teacher_name && <span className="text-[12.5px] text-ink-3">{c.teacher_name}</span>}
              </div>
            ))}
          />
        </section>
      </div>
    </>
  );
}

function DuplicateCell({ s }: { s: DuplicateSkill }) {
  return (
    <div className="min-w-0">
      <Link href={skillHref(s.id)} className="flex min-h-[44px] items-center font-semibold hover:text-accent">
        {s.name}
      </Link>
      <div className="flex flex-wrap gap-1">
        <Pill>
          {s.area}
          {s.parent_name ? ` › ${s.parent_name}` : ""}
        </Pill>
        <Pill>{rangeLabel(s.grade_min, s.grade_max)}</Pill>
        <Pill tone={s.answers ? "accent" : "neutral"}>
          <span className="num">{s.answers}</span> {s.answers === 1 ? "Antwort" : "Antworten"}
        </Pill>
        {s.tasks > 0 && (
          <Pill>
            <span className="num">{s.tasks}</span> {s.tasks === 1 ? "Aufgabe" : "Aufgaben"}
          </Pill>
        )}
      </div>
    </div>
  );
}

/** One skill with a checkbox; its Teilfähigkeiten in the same Thema below it. */
function MoveRow({ s, inArea, depth }: { s: Skill; inArea: Skill[]; depth: number }) {
  const children = inArea.filter((c) => c.parent_id === s.id);
  return (
    <li>
      <span className="flex items-center gap-1" style={{ paddingLeft: depth * 28 }}>
        <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center" title={depth ? "Einzeln verschieben" : "Verschieben (mit Teilfähigkeiten)"}>
          <input type="checkbox" name="skill_ids" value={s.id} aria-label={`${s.name} verschieben`} className="h-5 w-5 accent-[var(--accent)]" />
        </label>
        <Link href={skillHref(s.id)} className={`flex min-h-[44px] items-center hover:text-accent ${depth ? "text-[14px] text-ink-2" : "font-medium"}`}>
          {s.name}
        </Link>
        {s.subtopic && <span className="text-[12.5px] text-ink-3">· {s.subtopic}</span>}
      </span>
      {children.length > 0 && (
        <ul>
          {children.map((c) => (
            <MoveRow key={c.id} s={c} inArea={inArea} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
