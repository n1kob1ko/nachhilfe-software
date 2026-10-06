import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, RotateCcw, X } from "lucide-react";
import { addPrerequisiteAction, removePrerequisiteAction } from "@/app/learning-actions";
import { PageHeader, Pill, SectionTitle } from "@/components/ui";
import { Info } from "@/components/Info";
import { requireTeacher } from "@/lib/auth";
import { LINK_ORIGIN_LABEL, nextSkillsOf, prerequisiteLinks } from "@/lib/lehrplan";
import * as repo from "@/lib/repo";
import { rangeLabel } from "@/lib/school";

export const metadata = { title: "Fähigkeit" };

/**
 * One skill: where it sits, what it needs (prerequisites) and what builds on it. Prerequisites are
 * only ever added or removed by the teacher; removed standard links stay removed.
 */
export default async function SkillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string }> }) {
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
          {sp.fehler && <p className="mb-3 rounded-lg bg-red-wash px-4 py-2.5 text-[14px] text-red">{sp.fehler}</p>}
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
                    <button className="btn btn-ghost btn-sm !px-2" aria-label={`Voraussetzung ${label(l.other_id)} entfernen`} title="Entfernen">
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
      </div>
    </>
  );
}
