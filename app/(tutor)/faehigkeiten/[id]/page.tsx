import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, RotateCcw, X } from "lucide-react";
import {
  addCurriculumLinkAction,
  mergeSkillAction,
  removeCurriculumLinkAction,
  resetSkillPlacementAction,
  saveSkillPlacementAction,
  unmergeSkillAction,
} from "@/app/datenqualitaet-actions";
import { addPrerequisiteAction, removePrerequisiteAction } from "@/app/learning-actions";
import { PageHeader, Pill, Reveal, SectionTitle } from "@/components/ui";
import { Info } from "@/components/Info";
import { requireTeacher } from "@/lib/auth";
import {
  candidateNodes,
  curriculumLinks,
  linkableCurricula,
  mergedInto,
  normalizeName,
  officialSkill,
  PRACTICE_SHIFT_LABEL,
  PRACTICE_SHIFTS,
  skillOverride,
} from "@/lib/datenqualitaet";
import { LINK_ORIGIN_LABEL, nextSkillsOf, prerequisiteLinks } from "@/lib/lehrplan";
import * as repo from "@/lib/repo";
import { MAX_STUFE, rangeLabel, stufeLabel } from "@/lib/school";

export const metadata = { title: "Fähigkeit" };

const STUFEN = Array.from({ length: MAX_STUFE }, (_, i) => i + 1);
const OK_TEXT: Record<string, string> = {
  gespeichert: "Gespeichert.",
  zurueckgesetzt: "Auf das Original zurückgesetzt.",
  entfernt: "Entfernt. Bleibt auch nach einem neuen Import entfernt.",
  zusammengefuehrt: "Zusammengeführt.",
  getrennt: "Zusammenführung aufgehoben.",
};
const radioChip = "flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13.5px] has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent";
const navChip = (on: boolean) => `inline-flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-[14px] font-medium whitespace-nowrap ${on ? "bg-ink text-surface" : "bg-panel text-ink-2 hover:text-ink"}`;
const cut = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
/** Group entries of a curriculum; the entries below them are indented in the select. */
const GROUP_KINDS = new Set(["kompetenzbereich", "thema", "lehrstoffbereich"]);

type Params = { fehler?: string; ok?: string; bei?: string; lp?: string; lpk?: string };

/**
 * One skill: where it sits, what it needs (prerequisites) and what builds on it, and the own
 * corrections of Mehr › Datenqualität: Einordnung, Lehrplan links and merging a duplicate.
 * Prerequisites and Lehrplan links are only ever added or removed by the teacher; removed ones stay
 * removed. The official data of the skill is never changed: corrections are stored separately.
 */
export default async function SkillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const skill = repo.getSkill(decodeURIComponent(id));
  if (!skill) notFound();
  const all = repo.listSkills();
  const byId = new Map(all.map((s) => [s.id, s]));
  const label = (sid: string) => {
    const s = byId.get(sid) ?? repo.getSkill(sid);
    return s ? (s.area === skill.area ? s.name : `${s.area} › ${s.name}`) : sid;
  };
  const links = prerequisiteLinks(skill.id);
  const active = links.filter((l) => !l.removed_at);
  const removed = links.filter((l) => l.removed_at);
  const next = nextSkillsOf(skill.id).filter((x) => byId.has(x));
  const parent = skill.parent_id ? repo.getSkill(skill.parent_id) : null;
  const candidates = all.filter((s) => s.subject === skill.subject && s.id !== skill.id && !active.some((l) => l.other_id === s.id));
  const areas = [...new Set(candidates.map((s) => s.area))];

  // Datenqualität: own corrections next to the original values
  const official = officialSkill(skill.id)!;
  const own = skillOverride(skill.id);
  const ownPlacement = Boolean(own && (own.area !== null || own.subtopic !== null || own.grade_min !== null || own.grade_max !== null || own.practice_shift || own.note));
  const inSubject = all.filter((s) => s.subject === skill.subject);
  const subjectAreas = [...new Set(inSubject.map((s) => s.area))];
  const lpLinks = curriculumLinks(skill.id);
  const lpActive = lpLinks.filter((l) => !l.removed_at);
  const lpRemoved = lpLinks.filter((l) => l.removed_at);
  const curricula = linkableCurricula(skill.id);
  const lp = curricula.find((c) => c.key === sp.lp) ?? null;
  const fits = (k: { schulstufe: number | null }) => k.schulstufe !== null && k.schulstufe >= skill.grade_min && k.schulstufe <= skill.grade_max;
  const lpKlasse = lp ? (lp.classes.find((k) => String(k.klasse) === sp.lpk)?.klasse ?? lp.classes.find(fits)?.klasse ?? lp.classes[0]?.klasse ?? null) : null;
  const nodes = lp ? candidateNodes(skill.id, lp.id, lpKlasse) : [];
  const lpHref = (key: string, klasse?: number) => `/faehigkeiten/${encodeURIComponent(skill.id)}?lp=${encodeURIComponent(key)}${klasse ? `&lpk=${klasse}` : ""}#lehrplan`;
  const mergedHere = mergedInto(skill.id);
  const mergeTargets = inSubject.filter((s) => s.id !== skill.id);
  const mergeAreas = [...new Set(mergeTargets.map((s) => s.area))];
  const sameName = mergeTargets.find((s) => normalizeName(s.name) === normalizeName(skill.name));
  const message = (section: string) =>
    sp.bei !== section ? null : sp.fehler ? (
      <p className="mb-3 rounded-lg bg-red-wash px-4 py-2.5 text-[14px] text-red" role="alert">
        {sp.fehler}
      </p>
    ) : sp.ok && OK_TEXT[sp.ok] ? (
      <p className="mb-3 text-[14px] font-medium text-green" role="status">
        {OK_TEXT[sp.ok]}
      </p>
    ) : null;

  return (
    <>
      <PageHeader
        title={skill.name}
        subtitle={`${skill.subject} › ${skill.area}${parent ? ` › ${parent.name}` : ""}`}
        back={{ href: `/faehigkeiten?fach=${encodeURIComponent(skill.subject)}`, label: skill.subject }}
        actions={
          <Link href={`/uebungen/neu?skill=${encodeURIComponent(skill.id)}`} className="btn btn-primary">
            Übung erstellen
          </Link>
        }
      />
      <div className="-mt-4 mb-8 flex flex-wrap gap-1.5">
        <Pill>{rangeLabel(skill.grade_min, skill.grade_max)}</Pill>
        {skill.code && <Pill>{skill.code}</Pill>}
        {skill.practice_shift && <Pill tone="amber">in der Praxis oft {skill.practice_shift === "frueher" ? "früher" : "später"}</Pill>}
        {skill.merged_into && <Pill tone="amber">zusammengeführt mit {label(skill.merged_into)}</Pill>}
        {ownPlacement && <Pill tone="accent">eigene Einordnung</Pill>}
      </div>

      <div className="grid max-w-[920px] gap-10">
        <section aria-label="Voraussetzungen">
          <SectionTitle>
            <span>
              Voraussetzungen
              <Info label="Info zu Voraussetzungen">
                Was sitzen sollte, bevor diese Fähigkeit geübt wird. Ist der Schüler hier schwach, prüft die Empfehlung, ob eine Voraussetzung die Ursache sein könnte. Die App legt keine Beziehungen selbst an.
              </Info>
            </span>
          </SectionTitle>
          {sp.fehler && !sp.bei && <p className="mb-3 rounded-lg bg-red-wash px-4 py-2.5 text-[14px] text-red">{sp.fehler}</p>}
          {active.length === 0 ? (
            <p className="mb-3 text-[14px] text-ink-3">Keine Voraussetzungen eingetragen.</p>
          ) : (
            <ul className="panel mb-3 divide-y divide-line">
              {active.map((l) => (
                <li key={l.other_id} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
                  <Link href={`/faehigkeiten/${encodeURIComponent(l.other_id)}`} className="min-w-0 flex-1 font-medium hover:text-accent">
                    {label(l.other_id)}
                  </Link>
                  <Pill>{LINK_ORIGIN_LABEL[l.origin] ?? l.origin}</Pill>
                  <form action={removePrerequisiteAction.bind(null, skill.id, l.other_id)}>
                    <button className="btn btn-ghost btn-sm min-w-[44px] !px-2" aria-label={`Voraussetzung ${label(l.other_id)} entfernen`} title="Entfernen">
                      <X size={15} aria-hidden />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addPrerequisiteAction.bind(null, skill.id)} className="flex flex-wrap items-end gap-2">
            <label className="field min-w-[260px] flex-1">
              <span className="label">Voraussetzung hinzufügen</span>
              <select className="input" name="before" required defaultValue="">
                <option value="" disabled>
                  Fähigkeit wählen …
                </option>
                {areas.map((area) => (
                  <optgroup key={area} label={area}>
                    {candidates
                      .filter((s) => s.area === area)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.parent_id ? `${byId.get(s.parent_id)?.name ?? ""} › ${s.name}` : s.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button className="btn btn-secondary">
              <Plus size={15} aria-hidden /> Hinzufügen
            </button>
          </form>
          {removed.length > 0 && (
            <details className="reveal mt-3">
              <summary>Entfernt ({removed.length})</summary>
              <ul className="mt-2 grid gap-1">
                {removed.map((l) => (
                  <li key={l.other_id} className="flex items-center gap-2 text-[14px] text-ink-2">
                    <span className="line-through">{label(l.other_id)}</span>
                    <span className="text-[12px] text-ink-3">{LINK_ORIGIN_LABEL[l.origin] ?? l.origin}</span>
                    <form action={addPrerequisiteAction.bind(null, skill.id)}>
                      <input type="hidden" name="before" value={l.other_id} />
                      <button className="btn btn-ghost btn-sm" title="Wiederherstellen">
                        <RotateCcw size={13} aria-hidden /> wieder aufnehmen
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {next.length > 0 && (
          <section aria-label="Baut darauf auf">
            <SectionTitle>Baut darauf auf</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {next.map((n) => (
                <Link key={n} href={`/faehigkeiten/${encodeURIComponent(n)}`} className="inline-flex min-h-[40px] items-center rounded-full bg-panel px-4 text-[14px] text-ink-2 hover:text-ink">
                  {label(n)}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section aria-label="Einordnung" id="einordnung" className="scroll-mt-6">
          <SectionTitle
            action={
              ownPlacement && (
                <form action={resetSkillPlacementAction.bind(null, skill.id)}>
                  <button className="btn btn-ghost btn-sm" title="Thema, Klassen, Praxis-Hinweis und Notiz auf das Original zurücksetzen">
                    <RotateCcw size={13} aria-hidden /> Original
                  </button>
                </form>
              )
            }
          >
            <span>
              Einordnung
              <Info label="Info zur Einordnung">
                Eigene Korrektur von Thema, Unterthema und Klassen. Das Original bleibt gespeichert und gilt wieder nach „Original“. Wirkt auf Listen, Lernstand und Empfehlungen.
              </Info>
            </span>
          </SectionTitle>
          {message("einordnung")}
          <form action={saveSkillPlacementAction.bind(null, skill.id)} className="panel grid gap-3 px-4 py-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">Thema</span>
              <input className="input" name="area" list="einordnung-themen" defaultValue={skill.area} required maxLength={80} />
              {own?.area != null && <span className="text-[12.5px] text-ink-3">Original: {official.area}</span>}
            </label>
            <datalist id="einordnung-themen">
              {subjectAreas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <label className="field">
              <span className="label">Unterthema</span>
              <input className="input" name="subtopic" defaultValue={skill.subtopic ?? ""} maxLength={80} placeholder="–" />
              {own?.subtopic != null && <span className="text-[12.5px] text-ink-3">Original: {official.subtopic || "–"}</span>}
            </label>
            {(
              [
                ["grade_min", "Ab", skill.grade_min, own?.grade_min != null ? official.grade_min : null],
                ["grade_max", "Bis", skill.grade_max, own?.grade_max != null ? official.grade_max : null],
              ] as const
            ).map(([name, text, value, original]) => (
              <label key={name} className="field">
                <span className="label">{text}</span>
                <select className="input" name={name} defaultValue={value}>
                  {STUFEN.map((n) => (
                    <option key={n} value={n}>
                      {stufeLabel(n)}
                    </option>
                  ))}
                </select>
                {original !== null && <span className="text-[12.5px] text-ink-3">Original: {stufeLabel(original)}</span>}
              </label>
            ))}
            <fieldset className="field sm:col-span-2">
              <legend className="label mb-1.5 flex items-center">
                In der Praxis
                <Info label="Info zum Praxis-Hinweis">Nur ein Hinweis: In der Schule kommt das oft früher oder später dran, als der Lehrplan sagt. Erscheint als Chip bei der Fähigkeit.</Info>
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {PRACTICE_SHIFTS.map((p) => (
                  <label key={p || "gleich"} className={radioChip}>
                    <input type="radio" name="practice_shift" value={p} defaultChecked={(skill.practice_shift ?? "") === p} className="sr-only" />
                    {PRACTICE_SHIFT_LABEL[p]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field sm:col-span-2">
              <span className="label">Notiz (optional)</span>
              <input className="input" name="note" defaultValue={own?.note ?? ""} maxLength={500} placeholder="z. B. an der Schule erst in der 3. Klasse" />
            </label>
            <button className="btn btn-primary justify-self-start">Speichern</button>
          </form>
        </section>

        <section aria-label="Lehrplan-Verknüpfungen" id="lehrplan" className="scroll-mt-6">
          <SectionTitle>
            <span>
              Lehrplan-Verknüpfungen
              <Info label="Info zu Lehrplan-Verknüpfungen">
                Welche Stellen des offiziellen Lehrplans diese Fähigkeit übt. Die Zuordnung ist eine eigene Entscheidung, nicht Teil des Lehrplans. Entfernte bleiben entfernt, auch nach einem neuen Import.
              </Info>
            </span>
          </SectionTitle>
          {message("lehrplan")}
          {lpActive.length === 0 ? (
            <p className="mb-3 text-[14px] text-ink-3">Keine Lehrplan-Verknüpfung.</p>
          ) : (
            <ul className="panel mb-3 divide-y divide-line">
              {lpActive.map((l) => (
                <li key={l.node_id} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium" title={l.text || l.name}>
                      {cut(l.name, 140)}
                    </span>
                    <Link href={`/mehr/lehrplan/${encodeURIComponent(l.curriculum_key)}${l.klasse ? `?klasse=${l.klasse}` : ""}`} className="inline-flex min-h-[44px] items-center text-[12.5px] text-ink-3 hover:text-ink hover:underline">
                      {l.short}
                      {l.klasse_name ? ` · ${l.klasse_name}` : ""} · {l.code}
                    </Link>
                  </span>
                  {l.origin === "lehrer" && <Pill>{LINK_ORIGIN_LABEL.lehrer}</Pill>}
                  <form action={removeCurriculumLinkAction.bind(null, skill.id, l.node_id)}>
                    <button className="btn btn-ghost btn-sm min-w-[44px] !px-2" aria-label={`Lehrplan-Verknüpfung ${l.code} entfernen`} title="Entfernen">
                      <X size={15} aria-hidden />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {curricula.length === 0 ? (
            <p className="text-[13.5px] text-ink-3">
              Für {skill.subject} ist noch kein Lehrplan importiert.{" "}
              <Link href="/mehr/lehrplan?tab=importe" className="link">
                Lehrplan importieren
              </Link>
            </p>
          ) : (
            <details className="reveal" open={lp ? true : undefined}>
              <summary>
                <Plus size={14} aria-hidden /> Verknüpfung hinzufügen
              </summary>
              <div className="grid gap-3 pt-2">
                <nav aria-label="Lehrplan" className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
                  {curricula.map((c) => (
                    <Link key={c.key} href={lpHref(c.key)} aria-current={lp?.key === c.key ? "page" : undefined} className={navChip(lp?.key === c.key)} title={c.name}>
                      {c.short}
                    </Link>
                  ))}
                </nav>
                {lp && lp.classes.length > 1 && (
                  <nav aria-label="Klasse" className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
                    {lp.classes.map((k) => (
                      <Link key={k.klasse} href={lpHref(lp.key, k.klasse)} aria-current={lpKlasse === k.klasse ? "page" : undefined} className={navChip(lpKlasse === k.klasse)}>
                        {k.name}
                      </Link>
                    ))}
                  </nav>
                )}
                {lp &&
                  (nodes.length === 0 ? (
                    <p className="text-[13.5px] text-ink-3">Alle Einträge sind schon verknüpft.</p>
                  ) : (
                    <form action={addCurriculumLinkAction.bind(null, skill.id)} className="flex flex-wrap items-end gap-2">
                      <label className="field min-w-[260px] flex-1">
                        <span className="label">{lp.name}</span>
                        <select className="input" name="node_id" required defaultValue="">
                          <option value="" disabled>
                            Eintrag wählen …
                          </option>
                          {nodes.map((n) => (
                            <option key={n.id} value={n.id}>
                              {GROUP_KINDS.has(n.kind) ? cut(n.name) : `\u00a0\u00a0– ${cut(n.name)}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="btn btn-secondary">
                        <Plus size={15} aria-hidden /> Hinzufügen
                      </button>
                    </form>
                  ))}
              </div>
            </details>
          )}
          {lpRemoved.length > 0 && (
            <details className="reveal mt-3">
              <summary>Entfernt ({lpRemoved.length})</summary>
              <ul className="mt-2 grid gap-1">
                {lpRemoved.map((l) => (
                  <li key={l.node_id} className="flex items-center gap-2 text-[14px] text-ink-2">
                    <span className="min-w-0 line-through" title={l.text || l.name}>
                      {l.short} · {cut(l.name, 70)}
                    </span>
                    <form action={addCurriculumLinkAction.bind(null, skill.id)}>
                      <input type="hidden" name="node_id" value={l.node_id} />
                      <button className="btn btn-ghost btn-sm" title="Wiederherstellen">
                        <RotateCcw size={13} aria-hidden /> wieder aufnehmen
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section aria-label="Zusammenführen" id="zusammenfuehren" className="scroll-mt-6">
          <SectionTitle>
            <span>
              Zusammenführen
              <Info label="Info zum Zusammenführen">
                Für doppelte Fähigkeiten: Die Dublette verschwindet aus den Listen, ihre Antworten zählen für die andere. Voraussetzungen und Lehrplan-Verknüpfungen werden übernommen und bleiben entfernbar. Jederzeit rückgängig.
              </Info>
            </span>
          </SectionTitle>
          {message("zusammenfuehren")}
          {skill.merged_into ? (
            <div className="panel flex flex-wrap items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1 text-[14.5px]">
                Zusammengeführt mit{" "}
                <Link href={`/faehigkeiten/${encodeURIComponent(skill.merged_into)}`} className="link font-medium">
                  {label(skill.merged_into)}
                </Link>
              </span>
              <form action={unmergeSkillAction.bind(null, skill.id, skill.id)}>
                <button className="btn btn-secondary btn-sm">
                  <RotateCcw size={13} aria-hidden /> Rückgängig
                </button>
              </form>
            </div>
          ) : (
            <>
              {mergedHere.length > 0 && (
                <ul className="panel mb-3 divide-y divide-line">
                  {mergedHere.map((m) => (
                    <li key={m.id} className="flex min-h-[52px] items-center gap-3 px-4 py-1.5">
                      <Link href={`/faehigkeiten/${encodeURIComponent(m.id)}`} className="min-w-0 flex-1 font-medium hover:text-accent">
                        {m.name}
                      </Link>
                      <Pill tone="amber">Dublette</Pill>
                      <form action={unmergeSkillAction.bind(null, m.id, skill.id)}>
                        <button className="btn btn-ghost btn-sm">Trennen</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {mergeTargets.length > 0 && (
                <Reveal label="Mit einer anderen Fähigkeit zusammenführen">
                  <form action={mergeSkillAction.bind(null, skill.id)} className="grid max-w-[560px] gap-3">
                    <label className="field">
                      <span className="label">Bleibt</span>
                      <select className="input" name="into" required defaultValue={sameName?.id ?? ""}>
                        <option value="" disabled>
                          Fähigkeit wählen …
                        </option>
                        {mergeAreas.map((area) => (
                          <optgroup key={area} label={area}>
                            {mergeTargets
                              .filter((s) => s.area === area)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.parent_id ? `${byId.get(s.parent_id)?.name ?? ""} › ${s.name}` : s.name}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <p className="text-[13px] text-ink-2">„{skill.name}“ verschwindet aus den Listen; ihre Antworten zählen dann für die gewählte Fähigkeit.</p>
                    <button className="btn btn-primary btn-sm justify-self-start">Zusammenführen</button>
                  </form>
                </Reveal>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
