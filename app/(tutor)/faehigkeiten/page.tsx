import Link from "next/link";
import { createSkillAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { hasBuiltInGenerator } from "@/lib/generators";
import { listSkills } from "@/lib/repo";

export const metadata = { title: "Fähigkeiten" };

export default function SkillsPage() {
  const skills = listSkills();
  const tree = new Map<string, Map<string, typeof skills>>();
  for (const s of skills) {
    const areas = tree.get(s.subject) ?? new Map();
    areas.set(s.area, [...(areas.get(s.area) ?? []), s]);
    tree.set(s.subject, areas);
  }
  return (
    <>
      <PageHeader title="Fähigkeiten" subtitle="Der Lernstand wird pro Fähigkeit gemessen. Fach › Thema › Fähigkeit." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          {[...tree].map(([subject, areas]) => (
            <section key={subject}>
              <h2 className="mb-3 text-[20px] font-semibold tracking-[-0.01em]">{subject}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {[...areas].map(([area, list]) => (
                  <div key={area} className="panel px-4 py-3">
                    <h3 className="font-semibold">{area}</h3>
                    <ul className="mt-1.5 text-[14px]">
                      {list.map((s, i) => (
                        <li key={s.id} className="flex items-baseline justify-between gap-3 py-0.5">
                          <span>
                            <span className="text-ink-3" aria-hidden>
                              {i === list.length - 1 ? "└─ " : "├─ "}
                            </span>
                            <Link href={`/uebungen/neu?skill=${encodeURIComponent(s.id)}`} className="hover:text-accent">
                              {s.name}
                            </Link>
                          </span>
                          <span className="num shrink-0 text-[12px] text-ink-3">
                            {s.grade_min}.–{s.grade_max}. Stufe{!hasBuiltInGenerator(s.id) && " · nur KI"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside>
          <form action={createSkillAction} className="panel grid gap-3 px-4 py-4 lg:sticky lg:top-8">
            <h2 className="font-semibold">Fähigkeit hinzufügen</h2>
            <label className="field">
              <span className="label">Fach</span>
              <input className="input" name="subject" required list="subjects" placeholder="z. B. Mathematik" />
              <datalist id="subjects">
                {[...tree.keys()].map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="label">Thema</span>
              <input className="input" name="area" required placeholder="z. B. Geometrie" />
            </label>
            <label className="field">
              <span className="label">Fähigkeit</span>
              <input className="input" name="name" required placeholder="z. B. Flächeninhalt Dreieck" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                <span className="label">Ab Stufe</span>
                <input className="input num" name="grade_min" type="number" min={1} max={13} defaultValue={1} />
              </label>
              <label className="field">
                <span className="label">Bis Stufe</span>
                <input className="input num" name="grade_max" type="number" min={1} max={13} defaultValue={13} />
              </label>
            </div>
            <button className="btn btn-primary">Hinzufügen</button>
            <p className="text-[12px] text-ink-3">Für neue Fähigkeiten erstellt Claude passende Aufgaben. Ohne KI gibt es Erklär- und Begründungsaufgaben.</p>
          </form>
        </aside>
      </div>
    </>
  );
}
