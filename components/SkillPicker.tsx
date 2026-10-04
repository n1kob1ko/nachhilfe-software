import type { Skill } from "@/lib/repo";

export function SkillPicker({ skills, selected = [] }: { skills: Skill[]; selected?: string[] }) {
  const groups = new Map<string, Skill[]>();
  for (const s of skills) groups.set(`${s.subject} › ${s.area}`, [...(groups.get(`${s.subject} › ${s.area}`) ?? []), s]);
  return (
    <div className="mt-2 max-h-[260px] space-y-3 overflow-y-auto rounded-lg border border-line bg-paper p-3">
      {[...groups].map(([g, list]) => (
        <fieldset key={g}>
          <legend className="mb-1 text-[12px] font-semibold text-ink-3">{g}</legend>
          <div className="flex flex-wrap gap-1.5">
            {list.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[13px] has-checked:border-accent has-checked:bg-accent-wash">
                <input type="checkbox" name="skill_ids" value={s.id} defaultChecked={selected.includes(s.id)} className="accent-[var(--accent)]" />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

