"use client";

const chip = "flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13.5px] has-checked:border-accent has-checked:bg-accent-wash";

/**
 * Die Fähigkeiten eines unklaren Punkts der Vorgabe zum Anhaken, dazu „Keine passt“ (leerer Wert). Ein Haken bei „Keine passt“
 * nimmt die Haken der Vorschläge (auch die Vorauswahl) sofort weg, ein Haken bei einem Vorschlag den bei „Keine passt“. Ohne
 * JavaScript gilt dasselbe auf dem Server: „Keine passt“ geht vor (lib/vorgabe.ts `bestaetigeVorgabe`).
 */
export function ZuordnungWahl({ name, vorschlaege, vorauswahl }: { name: string; vorschlaege: { id: string; name: string }[]; vorauswahl?: string }) {
  const umschalten = (e: React.ChangeEvent<HTMLInputElement>) => {
    const box = e.currentTarget;
    if (!box.checked) return;
    const gruppe = box.closest("[data-zuordnung]");
    if (!gruppe) return;
    for (const x of gruppe.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) if (x !== box && (box.value === "" || x.value === "")) x.checked = false;
  };
  return (
    <div className="flex flex-wrap gap-1.5" data-zuordnung>
      {vorschlaege.map((s) => (
        <label key={s.id} className={chip}>
          <input type="checkbox" name={name} value={s.id} defaultChecked={vorauswahl === s.id} onChange={umschalten} className="shrink-0 accent-[var(--accent)]" />
          <span>{s.name}</span>
        </label>
      ))}
      <label className={chip}>
        <input type="checkbox" name={name} value="" onChange={umschalten} className="shrink-0 accent-[var(--accent)]" data-testid="keine-passt" />
        <span>Keine passt</span>
      </label>
    </div>
  );
}
