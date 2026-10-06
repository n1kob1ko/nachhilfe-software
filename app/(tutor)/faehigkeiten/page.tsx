import Link from "next/link";
import { BookOpen, ChevronRight, Plus, Sparkles } from "lucide-react";
import { Info } from "@/components/Info";
import { createSkillAction } from "@/app/actions";
import { PageHeader, Reveal } from "@/components/ui";
import { hasBuiltInGenerator } from "@/lib/generators";
import { branchesWithSkills, browseSkills, curriculumFor } from "@/lib/lehrplan";
import { listSkills, type Skill } from "@/lib/repo";
import { klasseLabel, klassenRange, MAX_STUFE, stufeLabel } from "@/lib/school";

const STUFEN = Array.from({ length: MAX_STUFE }, (_, i) => i + 1);

export const metadata = { title: "Fähigkeiten" };

type Params = { fach?: string; schulart?: string; klasse?: string; thema?: string };
const href = (p: Params) => `/faehigkeiten?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`.replace(/\?$/, "");

/**
 * Fähigkeiten: one level at a time – Fach › Schulart › Klasse › Thema › Fähigkeit. Every level is a
 * filter on the skills that are there (school_types and Schulstufe), so a skill shows up in every
 * class it covers without being stored twice.
 */
export default async function SkillsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const all = listSkills();
  const subjects = [...new Set(all.filter((s) => !s.parent_id).map((s) => s.subject))];
  const subject = subjects.includes(sp.fach ?? "") ? sp.fach! : null;
  const branches = subject ? branchesWithSkills(subject) : [];
  const branch = subject ? branches.find((b) => b.branch.key === sp.schulart)?.branch ?? null : null;
  const klasse = branch && branch.classes.includes(Number(sp.klasse)) ? Number(sp.klasse) : null;

  const inScope = subject ? browseSkills({ subject, branch, klasse }) : [];
  const areas = [...new Set(inScope.filter((s) => !s.parent_id).map((s) => s.area))];
  const area = klasse && areas.includes(sp.thema ?? "") ? sp.thema! : null;
  const curriculum = branch ? curriculumFor(branch.schoolType, subject!) : null;

  const crumbs = [
    { label: "Fächer", href: "/faehigkeiten" },
    ...(subject ? [{ label: subject, href: href({ fach: subject }) }] : []),
    ...(branch ? [{ label: branch.label, href: href({ fach: subject!, schulart: branch.key }) }] : []),
    ...(klasse ? [{ label: klasseLabel(branch!, klasse), href: href({ fach: subject!, schulart: branch!.key, klasse: String(klasse) }) }] : []),
    ...(area ? [{ label: area, href: href({ fach: subject!, schulart: branch!.key, klasse: String(klasse), thema: area }) }] : []),
  ];
  const back = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;

  return (
    <>
      <PageHeader
        title={crumbs[crumbs.length - 1].label === "Fächer" ? "Fähigkeiten" : crumbs[crumbs.length - 1].label}
        back={back ? { href: back.href, label: back.label } : { href: "/mehr", label: "Mehr" }}
        info="Der Lernstand wird pro Fähigkeit gemessen. Wähle Fach, Schulart und Klasse, um nur die passenden Themen zu sehen. Tippe auf eine Fähigkeit, um dazu eine Übung zu erstellen."
      />

      {crumbs.length > 1 && (
        <nav aria-label="Pfad" className="-mt-4 mb-7 flex flex-wrap items-center gap-x-1 gap-y-1 text-[13.5px] text-ink-2">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={13} aria-hidden className="text-ink-3" />}
              {i === crumbs.length - 1 ? (
                <span className="font-medium text-ink">{c.label}</span>
              ) : (
                <Link href={c.href} className="hover:text-ink hover:underline">
                  {c.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}

      {!subject && <Cards items={subjects.map((s) => ({ key: s, label: s, note: `${branchesWithSkills(s).length} Schularten`, href: href({ fach: s }) }))} />}

      {subject && !branch && (
        <Cards
          items={branches.map(({ branch: b, count }) => ({
            key: b.key,
            label: b.label,
            note: klassenRange(b),
            count,
            href: href({ fach: subject, schulart: b.key }),
          }))}
        />
      )}

      {subject && branch && !klasse && (
        <Cards
          wide
          items={branch.classes
            .map((k) => ({ k, list: browseSkills({ subject, branch, klasse: k }).filter((s) => !s.parent_id) }))
            .filter((x) => x.list.length > 0)
            .map(({ k, list }) => ({
              key: String(k),
              label: klasseLabel(branch, k),
              count: list.length,
              href: href({ fach: subject, schulart: branch.key, klasse: String(k) }),
            }))}
        />
      )}

      {subject && branch && klasse && !area && (
        <Cards
          items={areas.map((a) => ({
            key: a,
            label: a,
            count: inScope.filter((s) => !s.parent_id && s.area === a).length,
            href: href({ fach: subject, schulart: branch.key, klasse: String(klasse), thema: a }),
          }))}
        />
      )}

      {area && (
        <>
          <SkillList list={inScope.filter((s) => !s.parent_id && s.area === area)} all={all} />
          {areas.length > 1 && (
            <nav aria-label="Anderes Thema" className="mt-4 flex flex-wrap gap-1.5">
              {areas
                .filter((a) => a !== area)
                .map((a) => (
                  <Link key={a} href={href({ fach: subject!, schulart: branch!.key, klasse: String(klasse), thema: a })} className="inline-flex min-h-[40px] items-center rounded-full bg-panel px-4 text-[14px] text-ink-2 hover:text-ink">
                    {a}
                  </Link>
                ))}
            </nav>
          )}
        </>
      )}

      {subject && branch && klasse && areas.length === 0 && <p className="text-[15px] text-ink-3">Für diese Klasse gibt es noch keine Fähigkeiten.</p>}

      {subject && branch && klasse && curriculum && (
        <p className="mt-6 text-[14px]">
          <Link href={`/mehr/lehrplan/${encodeURIComponent(curriculum.key)}?klasse=${klasse}`} className="link inline-flex min-h-[44px] items-center gap-1.5 font-medium">
            <BookOpen size={15} aria-hidden /> Lehrplan {branch.label}, {klasseLabel(branch, klasse)}
          </Link>
        </p>
      )}

      {!subject && <AddSkill all={all} subjects={subjects} />}
    </>
  );
}

/** One level of the hierarchy: large, obvious targets instead of a long list. */
function Cards({ items, wide = false }: { items: { key: string; label: string; note?: string; count?: number; href: string }[]; wide?: boolean }) {
  return (
    <ul className={`grid gap-3 ${wide ? "sm:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {items.map((i) => (
        <li key={i.key}>
          <Link href={i.href} className="panel flex min-h-[84px] items-center gap-3 px-5 py-4 transition-colors hover:bg-panel">
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold">{i.label}</span>
              <span className="mt-0.5 block text-[13px] text-ink-2">
                {i.note}
                {i.note && i.count != null && " · "}
                {i.count != null && (
                  <>
                    <span className="num">{i.count}</span> {i.count === 1 ? "Fähigkeit" : "Fähigkeiten"}
                  </>
                )}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden className="shrink-0 text-ink-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SkillList({ list, all }: { list: Skill[]; all: Skill[] }) {
  return (
    <ul className="panel divide-y divide-line">
      {list.map((s) => {
        const subs = all.filter((x) => x.parent_id === s.id);
        return (
          <li key={s.id} className="px-5 py-3">
            <Link href={`/uebungen/neu?skill=${encodeURIComponent(s.id)}`} className="flex min-h-[44px] items-center gap-2 text-[16px] font-medium hover:text-accent">
              {s.name}
              {!hasBuiltInGenerator(s.id) && <Sparkles size={14} aria-label="Aufgaben nur mit KI" className="shrink-0 text-ink-3" />}
            </Link>
            {subs.length > 0 && (
              <span className="mb-1 flex flex-wrap gap-1.5">
                {subs.map((x) => (
                  <Link key={x.id} href={`/uebungen/neu?skill=${encodeURIComponent(x.id)}`} className="inline-flex min-h-[32px] items-center rounded-full bg-panel px-3 text-[13px] text-ink-2 hover:text-accent">
                    {x.name}
                  </Link>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AddSkill({ all, subjects }: { all: Skill[]; subjects: string[] }) {
  const parents = all.filter((s) => !s.parent_id);
  return (
    <Reveal className="mt-8" label={<span className="inline-flex items-center gap-1.5"><Plus size={15} aria-hidden /> Fähigkeit hinzufügen</span>}>
      <form action={createSkillAction} className="panel grid w-[min(460px,100%)] gap-3 px-4 py-4">
        <div className="field">
          <span className="label">
            <label htmlFor="parent_id">Teil von (optional)</label>
            <Info label="Info zu Teilfähigkeiten">Wählst du eine Fähigkeit, gelten deren Fach, Thema und Klassen.</Info>
          </span>
          <select className="input" id="parent_id" name="parent_id" defaultValue="">
            <option value="">Eigene Fähigkeit</option>
            {subjects.map((subject) => (
              <optgroup key={subject} label={subject}>
                {parents
                  .filter((s) => s.subject === subject)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.area} › {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span className="label">Fach</span>
            <input className="input" name="subject" list="subjects" placeholder="Mathematik" />
            <datalist id="subjects">
              {subjects.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="label">Thema</span>
            <input className="input" name="area" placeholder="Geometrie" />
          </label>
        </div>
        <label className="field">
          <span className="label">Fähigkeit</span>
          <input className="input" name="name" required placeholder="z. B. Flächeninhalt Dreieck" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["grade_min", "Ab", 1],
              ["grade_max", "Bis", MAX_STUFE],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="field">
              <span className="label">{label}</span>
              <select className="input" name={name} defaultValue={value}>
                {STUFEN.map((n) => (
                  <option key={n} value={n}>
                    {stufeLabel(n)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary">Hinzufügen</button>
          <Info label="Info zu Aufgaben für neue Fähigkeiten">Für neue Fähigkeiten erstellt Claude passende Aufgaben. Ohne KI gibt es Erklär- und Begründungsaufgaben.</Info>
        </div>
      </form>
    </Reveal>
  );
}
