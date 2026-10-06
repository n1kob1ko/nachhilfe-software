import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Info } from "@/components/Info";
import { createSkillAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { hasBuiltInGenerator } from "@/lib/generators";
import { listSkills } from "@/lib/repo";
import { MAX_STUFE, rangeLabel, stufeLabel } from "@/lib/school";

const STUFEN = Array.from({ length: MAX_STUFE }, (_, i) => i + 1);

export const metadata = { title: "Fähigkeiten" };

export default function SkillsPage() {
  const skills = listSkills();
  const tree = new Map<string, Map<string, typeof skills>>();
  for (const s of skills.filter((x) => !x.parent_id)) {
    const areas = tree.get(s.subject) ?? new Map();
    areas.set(s.area, [...(areas.get(s.area) ?? []), s]);
    tree.set(s.subject, areas);
  }
  const subChips = (id: string) => skills.filter((x) => x.parent_id === id);
  const commonRange = (list: typeof skills) => {
    const counts = new Map<string, number>();
    for (const s of list) counts.set(`${s.grade_min}-${s.grade_max}`, (counts.get(`${s.grade_min}-${s.grade_max}`) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  };
  return (
    <>
      <PageHeader
        title="Fähigkeiten"
        subtitle="Fach › Thema › Fähigkeit"
        info="Der Lernstand wird pro Fähigkeit gemessen. Teilfähigkeiten zählen auch für ihre Fähigkeit. Tippe auf eine Fähigkeit, um dazu eine Übung zu erstellen."
      />
      <div className="mb-8 flex flex-wrap items-start gap-3">
        <nav className="flex flex-wrap gap-1.5" aria-label="Zu Fach springen">
          {[...tree].map(([subject, areas]) => (
            <a key={subject} href={`#fach-${encodeURIComponent(subject)}`} className="inline-flex min-h-[36px] items-center rounded-full bg-panel px-3.5 text-[13px] font-medium text-ink-2 hover:text-ink">
              {subject}
              <span className="num ml-1.5 opacity-70">{[...areas.values()].flat().length}</span>
            </a>
          ))}
        </nav>
        <details className="add-skill group sm:ml-auto">
          <summary className="btn btn-secondary list-none">
            <Plus size={16} aria-hidden /> Fähigkeit hinzufügen
          </summary>
          <form action={createSkillAction} className="panel mt-3 grid w-[min(420px,calc(100vw-32px))] gap-3 px-4 py-4">
            <div className="field">
              <span className="label">
                <label htmlFor="parent_id">Teil von (optional)</label>
                <Info label="Info zu Teilfähigkeiten">Wählst du eine Fähigkeit, gelten deren Fach, Thema und Klassen.</Info>
              </span>
              <select className="input" id="parent_id" name="parent_id" defaultValue="">
                <option value="">Eigene Fähigkeit</option>
                {[...tree].map(([subject, areas]) => (
                  <optgroup key={subject} label={subject}>
                    {[...areas].flatMap(([area, list]) =>
                      list.map((s) => (
                        <option key={s.id} value={s.id}>
                          {area} › {s.name}
                        </option>
                      )),
                    )}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                <span className="label">Fach</span>
                <input className="input" name="subject" list="subjects" placeholder="Mathematik" />
                <datalist id="subjects">
                  {[...tree.keys()].map((s) => (
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
              <label className="field">
                <span className="label">Ab</span>
                <select className="input" name="grade_min" defaultValue={1}>
                  {STUFEN.map((n) => (
                    <option key={n} value={n}>
                      {stufeLabel(n)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Bis</span>
                <select className="input" name="grade_max" defaultValue={MAX_STUFE}>
                  {STUFEN.map((n) => (
                    <option key={n} value={n}>
                      {stufeLabel(n)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-primary">Hinzufügen</button>
              <Info label="Info zu Aufgaben für neue Fähigkeiten">Für neue Fähigkeiten erstellt Claude passende Aufgaben. Ohne KI gibt es Erklär- und Begründungsaufgaben.</Info>
            </div>
          </form>
        </details>
      </div>
      <div className="space-y-10">
        {[...tree].map(([subject, areas]) => (
          <section key={subject} id={`fach-${encodeURIComponent(subject)}`} className="scroll-mt-6">
            <h2 className="mb-3 text-[20px] font-semibold tracking-[-0.01em]">{subject}</h2>
            <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[...areas].map(([area, list]) => {
                const common = commonRange(list);
                const [min, max] = common.split("-").map(Number);
                return (
                  <div key={area} className="panel px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="font-semibold">{area}</h3>
                      {common && <span className="num text-[12px] text-ink-3">{rangeLabel(min, max)}</span>}
                    </div>
                    <ul className="mt-1.5 space-y-1 text-[14px]">
                      {list.map((s) => {
                        const subs = subChips(s.id);
                        return (
                          <li key={s.id}>
                            <span className="flex items-baseline gap-2">
                              <Link href={`/uebungen/neu?skill=${encodeURIComponent(s.id)}`} className="hover:text-accent">
                                {s.name}
                              </Link>
                              {`${s.grade_min}-${s.grade_max}` !== common && <span className="num text-[12px] text-ink-3">{rangeLabel(s.grade_min, s.grade_max)}</span>}
                              {!hasBuiltInGenerator(s.id) && (
                                <span title="Aufgaben nur mit KI" className="self-center text-ink-3">
                                  <Sparkles size={13} aria-label="nur mit KI" />
                                </span>
                              )}
                            </span>
                            {subs.length > 0 && (
                              <span className="mt-1 mb-1 flex flex-wrap gap-1">
                                {subs.map((x) => (
                                  <Link key={x.id} href={`/uebungen/neu?skill=${encodeURIComponent(x.id)}`} className="rounded-full bg-panel px-2 py-0.5 text-[12px] text-ink-2 hover:text-accent">
                                    {x.name}
                                  </Link>
                                ))}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
