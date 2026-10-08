import Link from "next/link";
import { BookmarkPlus, Plus, Printer, Search, X } from "lucide-react";
import { createLibraryTaskAction, exerciseFromLibraryAction } from "@/app/library-actions";
import { subjectTone } from "@/components/Calendar";
import { Info } from "@/components/Info";
import { Empty, PageHeader, Pill } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { DIFFICULTIES, TASK_TYPES, worksheetTypeLabel } from "@/lib/curriculum";
import { LIBRARY_ORIGIN_LABEL, libraryFacets, searchLibrary, type LibraryFilter, type LibraryOrigin } from "@/lib/library";
import * as repo from "@/lib/repo";
import { klassenLabel, SCHOOL_TYPES } from "@/lib/school";
import { GAP } from "@/lib/tasks";
import { MathText } from "@/components/MathText";

export const metadata = { title: "Aufgabenbibliothek" };

type Params = { q?: string; fach?: string; stufe?: string; thema?: string; skill?: string; schwierigkeit?: string; typ?: string; herkunft?: string; tag?: string; neu?: string; fehler?: string; geloescht?: string };
const KEYS = ["q", "fach", "stufe", "thema", "skill", "schwierigkeit", "typ", "herkunft", "tag"] as const;
const LIB = "/uebungen/bibliothek";
const href = (p: Partial<Params>) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return q ? `${LIB}?${q}` : LIB;
};
const tone = (o: LibraryOrigin) => (o === "ki" ? "accent" : o === "importiert" ? "amber" : "neutral") as "accent" | "amber" | "neutral";

/**
 * Aufgabenbibliothek: saved tasks with search and filters. Selected tasks become a new exercise; one
 * task opens for editing, copying or sending.
 */
export default async function LibraryPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireTeacher();
  const sp = await searchParams;
  const [schoolType, klasse] = (sp.stufe ?? "").split("|");
  const filter: LibraryFilter = {
    q: sp.q,
    subject: sp.fach,
    schoolType: schoolType || undefined,
    klasse: Number(klasse) || null,
    topic: sp.thema,
    skillId: sp.skill,
    difficulty: sp.schwierigkeit,
    type: sp.typ,
    origin: sp.herkunft && Object.hasOwn(LIBRARY_ORIGIN_LABEL, sp.herkunft) ? (sp.herkunft as LibraryOrigin) : undefined,
    tag: sp.tag,
  };
  const facets = libraryFacets(sp.fach);
  const list = searchLibrary(filter);
  const skills = repo.listSkills();
  const skillName = (id: string) => skills.find((s) => s.id === id)?.name ?? id;
  const current: Partial<Params> = Object.fromEntries(KEYS.map((k) => [k, sp[k]]).filter(([, v]) => v));
  const active = KEYS.filter((k) => k !== "q" && k !== "fach" && sp[k]);
  const label = (k: (typeof KEYS)[number], v: string) =>
    k === "stufe"
      ? klassenLabel(v.split("|")[0], Number(v.split("|")[1]) || null, { short: true }) || v.split("|")[0]
      : k === "skill"
        ? skillName(v)
        : k === "typ"
          ? worksheetTypeLabel(sp.fach ?? "", v)
          : k === "herkunft"
            ? Object.hasOwn(LIBRARY_ORIGIN_LABEL, v) ? LIBRARY_ORIGIN_LABEL[v as LibraryOrigin] : v
            : k === "tag"
              ? `#${v}`
              : v;
  const students = repo.listStudents();
  const subjects = [...new Set(skills.map((s) => s.subject))];

  return (
    <>
      <PageHeader
        back={{ href: "/uebungen", label: "Übungen" }}
        title="Aufgabenbibliothek"
        info="Gute Aufgaben zum Wiederverwenden. In jeder Übung mit „In Bibliothek“ speichern oder hier neu schreiben. Ausgewählte Aufgaben werden zu einer neuen Übung."
        actions={
          <Link href={sp.neu ? href(current) : href({ ...current, neu: "1" })} className={`btn ${sp.neu ? "btn-secondary" : "btn-primary"}`}>
            <Plus size={16} aria-hidden /> Neue Aufgabe
          </Link>
        }
      />
      {sp.fehler && <p className="mb-4 rounded-lg bg-red-wash px-4 py-2.5 text-[14px] text-red" role="alert">{sp.fehler}</p>}
      {sp.geloescht && <p className="mb-4 text-[14px] text-green" role="status">Aufgabe gelöscht.</p>}

      {sp.neu && (
        <form action={createLibraryTaskAction} className="panel mb-8 grid max-w-[760px] gap-3 px-5 py-4 sm:grid-cols-2">
          <label className="field sm:col-span-2">
            <span className="label">Fähigkeit</span>
            <select className="input" name="skill_id" required defaultValue={sp.skill ?? ""}>
              <option value="" disabled>
                Fähigkeit wählen …
              </option>
              {subjects.map((subject) =>
                [...new Set(skills.filter((s) => s.subject === subject).map((s) => s.area))].map((area) => (
                  <optgroup key={`${subject}-${area}`} label={`${subject} › ${area}`}>
                    {skills
                      .filter((s) => s.subject === subject && s.area === area)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.parent_id ? `${skillName(s.parent_id)} › ${s.name}` : s.name}
                        </option>
                      ))}
                  </optgroup>
                )),
              )}
            </select>
          </label>
          <label className="field">
            <span className="label">Antwortformat</span>
            <select className="input" name="format" defaultValue="calc">
              {(Object.keys(TASK_TYPES) as (keyof typeof TASK_TYPES)[])
                .filter((k) => k !== "mixed")
                .map((k) => (
                  <option key={k} value={k}>
                    {TASK_TYPES[k]}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Schwierigkeit</span>
            <select className="input" name="difficulty" defaultValue="mittel">
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Schulart (optional)</span>
            <select className="input" name="school_type" defaultValue="">
              <option value="">–</option>
              {SCHOOL_TYPES.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Klasse (optional)</span>
            <select className="input" name="klasse" defaultValue="">
              <option value="">–</option>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((k) => (
                <option key={k} value={k}>
                  {k}.
                </option>
              ))}
            </select>
          </label>
          <label className="field sm:col-span-2">
            <span className="label">Tags (optional, mit Komma getrennt)</span>
            <input className="input" name="tags" placeholder="z. B. Schularbeit, Textaufgabe" />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn btn-primary">Anlegen und bearbeiten</button>
            <span className="text-[13px] text-ink-3">Text, Lösung und Hilfen schreibst du im nächsten Schritt.</span>
          </div>
        </form>
      )}

      {facets.total === 0 && !sp.fach ? (
        <Empty title="Noch keine Aufgaben in der Bibliothek">
          In einer Übung bei einer Aufgabe auf <BookmarkPlus size={14} className="inline align-[-2px]" aria-label="" /> „In Bibliothek“ tippen, oder oben eine neue Aufgabe anlegen.
        </Empty>
      ) : (
        <>
          <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Fach">
            {[["", "Alle Fächer"], ...facets.subjects.map((s) => [s, s])].map(([k, l]) => (
              <Link
                key={k || "alle"}
                href={href({ q: sp.q, fach: k })}
                aria-current={(sp.fach ?? "") === k ? "true" : undefined}
                className={`inline-flex min-h-[40px] items-center rounded-full px-4 text-[14px] font-medium ${(sp.fach ?? "") === k ? "bg-ink text-surface" : "bg-panel text-ink-2 hover:text-ink"}`}
              >
                {l}
              </Link>
            ))}
          </nav>

          <form className="mb-3 grid gap-3" role="search" action={LIB}>
            {sp.fach && <input type="hidden" name="fach" value={sp.fach} />}
            <div className="flex max-w-[560px] gap-2">
              <input className="input" type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Text, Titel, Thema oder Tag" aria-label="Bibliothek durchsuchen" />
              <button className="btn btn-secondary">
                <Search size={15} aria-hidden /> Suchen
              </button>
            </div>
            <details className="reveal" open={active.length > 0 || undefined}>
              <summary>Filter{active.length > 0 && ` (${active.length})`}</summary>
              <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <FilterSelect name="stufe" label="Schulart und Klasse" value={sp.stufe} options={facets.levels.map((v) => [v, label("stufe", v)])} />
                <FilterSelect name="thema" label="Thema" value={sp.thema} options={facets.topics.map((v) => [v, v])} />
                <FilterSelect name="skill" label="Fähigkeit" value={sp.skill} options={facets.skills.map((v) => [v, skillName(v)])} />
                <FilterSelect name="schwierigkeit" label="Schwierigkeit" value={sp.schwierigkeit} options={DIFFICULTIES.filter((d) => facets.difficulties.includes(d)).map((d) => [d, d])} />
                <FilterSelect name="typ" label="Aufgabentyp" value={sp.typ} options={facets.types.map((v) => [v, worksheetTypeLabel(sp.fach ?? "", v)])} />
                <FilterSelect name="herkunft" label="Herkunft" value={sp.herkunft} options={facets.origins.map((v) => [v, LIBRARY_ORIGIN_LABEL[v]])} />
                <FilterSelect name="tag" label="Tag" value={sp.tag} options={facets.tags.map((v) => [v, `#${v}`])} />
                <div className="flex items-end">
                  <button className="btn btn-secondary w-full">Filter anwenden</button>
                </div>
              </div>
            </details>
          </form>

          {active.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Aktive Filter">
              {active.map((k) => (
                <Link key={k} href={href({ ...current, [k]: undefined })} className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-accent-wash px-3 text-[13px] font-medium text-accent" aria-label={`Filter ${label(k, sp[k]!)} entfernen`}>
                  {label(k, sp[k]!)} <X size={13} aria-hidden />
                </Link>
              ))}
            </div>
          )}

          <form action={exerciseFromLibraryAction}>
            <input type="hidden" name="back" value={href(current)} />
            <p className="mb-2 text-[13px] text-ink-3">
              <span className="num">{list.length}</span> {list.length === 1 ? "Aufgabe" : "Aufgaben"}
            </p>
            <ul className="panel divide-y divide-line">
              {list.map((e) => {
                const t = subjectTone(e.subject);
                return (
                  <li key={e.id} className="flex items-start gap-2 px-3 py-2.5 sm:px-4">
                    <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                      <input type="checkbox" name="eintrag" value={e.id} className="h-5 w-5 accent-[var(--accent)]" aria-label={`${e.title} auswählen`} />
                    </label>
                    <Link href={`${LIB}/${e.id}`} className="group min-w-0 flex-1 py-1">
                      <p className="font-medium group-hover:text-accent">{e.title}</p>
                      {e.title !== e.task.prompt.split("\n")[0] && <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-2"><MathText text={e.task.prompt.replaceAll(GAP, "…")} /></p>}
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                        <span className="rounded-full px-2.5 py-0.5 font-semibold" style={{ background: t.soft, color: t.fg }}>
                          {e.subject}
                          {e.klasse ? ` · ${klassenLabel(e.school_type, e.klasse, { short: true })}` : ""}
                        </span>
                        {e.topic && <Pill>{e.topic}</Pill>}
                        <Pill>{e.task.difficulty}</Pill>
                        <Pill>{worksheetTypeLabel(e.subject, e.task.category ?? e.task.type)}</Pill>
                        <Pill tone={tone(e.origin)}>{LIBRARY_ORIGIN_LABEL[e.origin]}</Pill>
                        {e.tags.map((tag) => (
                          <span key={tag} className="text-ink-3">
                            #{tag}
                          </span>
                        ))}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {list.length === 0 && <li className="px-5 py-6 text-[14px] text-ink-3">Keine Aufgaben zu diesem Filter.</li>}
            </ul>
            {/* below md the bar sits above the TabBar (60px, border and safe area) */}
            {list.length > 0 && (
              <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 mt-4 flex flex-wrap items-end gap-3 rounded-2xl md:bottom-3 bg-surface/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur">
                <label className="field min-w-[200px] flex-1 sm:max-w-[280px]">
                  <span className="label">Für Schüler (optional)</span>
                  <select className="input" name="student_id" defaultValue="">
                    <option value="">–</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-primary">Ausgewählte als neue Übung</button>
                <button className="btn btn-secondary" formAction="/arbeitsblatt/bibliothek" formMethod="get" formNoValidate>
                  <Printer size={16} aria-hidden /> Als Arbeitsblatt
                </button>
                <Info label="Info zu neuen Übungen aus der Bibliothek">Die Aufgaben werden kopiert und als Entwurf geöffnet. Dort prüfen und senden. Eine Übung hat ein Fach: Aufgaben anderer Fächer bleiben weg.</Info>
              </div>
            )}
          </form>
        </>
      )}
    </>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <select className="input" name={name} defaultValue={value ?? ""} disabled={options.length === 0 && !value}>
        <option value="">Alle</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
