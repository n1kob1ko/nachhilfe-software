import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { startDiagnosisAction } from "@/app/diagnose-actions";
import { Avatar } from "@/components/Art";
import { PageHeader, Pill, Reveal, formatDate } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { activeMaterial } from "@/lib/current-material";
import { DIAGNOSE_MAX, diagnosisSkills, planDiagnosis, recentDiagnoses } from "@/lib/diagnose";
import { dayOf, daysUntil } from "@/lib/exams";
import { hasBuiltInGenerator } from "@/lib/generators";
import { branchesWithSkills, browseSkills } from "@/lib/lehrplan";
import * as repo from "@/lib/repo";
import { klasseLabel, klassenLabel, SCHOOL_BRANCHES, type SchoolBranch } from "@/lib/school";
import { runningUnitForStudent } from "@/lib/units";

export const metadata = { title: "Diagnose" };

type Params = { schueler?: string; fach?: string; schulart?: string; klasse?: string; thema?: string | string[]; fehler?: string };
const href = (p: { schueler?: number | string; fach?: string; schulart?: string; klasse?: number | string; thema?: string[] }) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `/diagnose?${s}` : "/diagnose";
};
const STEPS = ["Schüler", "Fach", "Klasse", "Themen", "Starten"];

/**
 * Diagnose-Modus: Schüler › Fach › Schulart und Klasse › Themen › Starten. Each step is a link or a
 * small form; what the profile already says (class, current material, next test) is preselected.
 */
export default async function DiagnosePage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireTeacher();
  const sp = await searchParams;
  const students = repo.listStudents();
  const student = students.find((s) => s.id === Number(sp.schueler)) ?? null;
  const all = repo.listSkills();
  const subjects = [...new Set(all.filter((s) => !s.parent_id).map((s) => s.subject))];
  const subject = student && subjects.includes(sp.fach ?? "") ? sp.fach! : null;
  const branches = subject ? branchesWithSkills(subject).map((b) => b.branch) : [];
  const branch = subject ? (branches.find((b) => b.key === sp.schulart) ?? null) : null;
  const klasse = branch && branch.classes.includes(Number(sp.klasse)) ? Number(sp.klasse) : null;
  const scope = branch && klasse ? browseSkills({ subject: subject!, branch, klasse }).filter((s) => !s.parent_id) : [];
  const areas = [...new Set(scope.map((s) => s.area))];
  const chosen = (Array.isArray(sp.thema) ? sp.thema : sp.thema ? [sp.thema] : []).filter((t) => areas.includes(t));
  const step = !student ? 0 : !subject ? 1 : !klasse ? 2 : !chosen.length ? 3 : 4;
  const base = { schueler: student?.id, fach: subject ?? undefined, schulart: branch?.key, klasse: klasse ?? undefined };
  const first = student?.name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader
        back={student ? { href: `/schueler/${student.id}?tab=fortschritt`, label: student.name } : { href: "/mehr", label: "Mehr" }}
        title={student ? `Diagnose für ${first}` : "Diagnose"}
        info="Ein kurzer Test mit 5 bis 10 Aufgaben, wenn du den Stand noch nicht kennst. Leichte, mittlere und schwere Aufgaben zu den gewählten Themen. Die Antworten zählen normal zum Lernstand und sind als Diagnose markiert."
      />
      <ol className="-mt-4 mb-7 flex flex-wrap items-center gap-x-1 gap-y-1 text-[13.5px]" aria-label="Schritte">
        {STEPS.map((label, i) => {
          const done = i < step;
          const to = [href({}), href({ schueler: student?.id }), href({ schueler: student?.id, fach: subject ?? undefined }), href(base), href({ ...base, thema: chosen })][i];
          return (
            <li key={label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={13} aria-hidden className="text-ink-3" />}
              {done ? (
                <Link href={to} className="text-ink-2 hover:text-ink hover:underline">
                  {i === 0 && student ? student.name : i === 1 && subject ? subject : i === 2 && branch && klasse ? `${branch.short} ${klasseLabel(branch, klasse)}` : i === 3 ? `${chosen.length} ${chosen.length === 1 ? "Thema" : "Themen"}` : label}
                </Link>
              ) : (
                <span className={i === step ? "font-semibold text-ink" : "text-ink-3"} aria-current={i === step ? "step" : undefined}>
                  {i + 1}. {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {sp.fehler && (
        <p className="mb-4 rounded-lg bg-red-wash px-4 py-2.5 text-[14px] text-red" role="alert">
          {sp.fehler}
        </p>
      )}

      {step === 0 && <ChooseStudent students={students} />}
      {step === 1 && student && (
        <Cards
          items={[...student.subjects.filter((s) => subjects.includes(s)), ...subjects.filter((s) => !student.subjects.includes(s))].map((s) => ({
            key: s,
            label: s,
            note: student.subjects.includes(s) ? "Fach im Profil" : undefined,
            href: href({ schueler: student.id, fach: s }),
          }))}
        />
      )}
      {step === 2 && student && subject && <ChooseClass student={student} subject={subject} branches={branches} />}
      {step === 3 && student && subject && branch && klasse && <ChooseTopics student={student} subject={subject} branch={branch} klasse={klasse} areas={areas} scope={scope} />}
      {step === 4 && student && subject && branch && klasse && <Confirm student={student} subject={subject} branch={branch} klasse={klasse} topics={chosen} scope={scope} back={href({ ...base, thema: chosen })} />}
    </>
  );
}

function Cards({ items }: { items: { key: string; label: string; note?: string; href: string; primary?: boolean }[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <li key={i.key}>
          <Link href={i.href} className={`panel flex min-h-[76px] items-center gap-3 px-5 py-4 transition-colors hover:bg-panel ${i.primary ? "ring-2 ring-accent/40" : ""}`}>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold">{i.label}</span>
              {i.note && <span className="mt-0.5 block text-[13px] text-ink-2">{i.note}</span>}
            </span>
            <ChevronRight size={18} aria-hidden className="shrink-0 text-ink-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ChooseStudent({ students }: { students: repo.Student[] }) {
  const recent = recentDiagnoses(6);
  return (
    <div className="grid gap-10">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Schüler wählen">
        {students.map((s) => (
          <li key={s.id}>
            <Link href={href({ schueler: s.id })} className="panel flex min-h-[76px] items-center gap-3 px-4 py-3 transition-colors hover:bg-panel">
              <Avatar name={s.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{s.name}</span>
                <span className="block truncate text-[13px] text-ink-2">{[klassenLabel(s.school_type, s.klasse, { short: true }), s.subjects.join(", ")].filter(Boolean).join(" · ")}</span>
              </span>
              <ChevronRight size={18} aria-hidden className="shrink-0 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
      {recent.length > 0 && (
        <section aria-label="Letzte Diagnosen">
          <h2 className="mb-2 text-[15px] font-semibold text-ink-2">Letzte Diagnosen</h2>
          <ul className="panel divide-y divide-line">
            {recent.map((d) => (
              <li key={d.id}>
                <Link href={`/diagnose/${d.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2 hover:bg-panel/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {d.student_name} · {d.topic}
                    </span>
                    <span className="text-[13px] text-ink-3">{formatDate(d.assigned_at)}</span>
                  </span>
                  {d.done >= d.total ? (
                    <Pill tone="green">fertig</Pill>
                  ) : (
                    <Pill tone="amber">
                      {d.done}/{d.total}
                    </Pill>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ChooseClass({ student, subject, branches }: { student: repo.Student; subject: string; branches: SchoolBranch[] }) {
  const own = branches.find((b) => b.schoolType === student.school_type && student.klasse && b.classes.includes(student.klasse));
  const options = (b: SchoolBranch) => b.classes.filter((k) => browseSkills({ subject, branch: b, klasse: k }).some((s) => !s.parent_id));
  return (
    <div className="grid gap-6">
      {own && student.klasse && (
        <Cards items={[{ key: "own", label: `${own.label}, ${klasseLabel(own, student.klasse)}`, note: "laut Profil", href: href({ schueler: student.id, fach: subject, schulart: own.key, klasse: student.klasse }), primary: true }]} />
      )}
      {(() => {
        const list = (
          <div className="grid gap-4">
            {branches.map((b) => (
              <div key={b.key}>
                <h3 className="mb-1.5 text-[14px] font-semibold text-ink-2">{b.label}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {options(b).map((k) => (
                    <Link key={k} href={href({ schueler: student.id, fach: subject, schulart: b.key, klasse: k })} className="inline-flex min-h-[44px] items-center rounded-full bg-panel px-4 text-[14px] text-ink-2 hover:text-ink">
                      {klasseLabel(b, k)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
        return own ? <Reveal label="Andere Schulart oder Klasse">{list}</Reveal> : list;
      })()}
    </div>
  );
}

function ChooseTopics({ student, subject, branch, klasse, areas, scope }: { student: repo.Student; subject: string; branch: SchoolBranch; klasse: number; areas: string[]; scope: repo.Skill[] }) {
  const today = dayOf(new Date());
  const areaOf = new Map(repo.listSkills().map((s) => [s.id, s.area]));
  const material = activeMaterial(student.id).filter((m) => m.subject === subject);
  const exams = repo.upcomingTests(today, student.id).filter((t) => t.subject === subject && daysUntil(t.date, today) <= 30);
  const marks = new Map<string, string>();
  for (const m of material) for (const a of [m.topic, ...m.skill_ids.map((id) => areaOf.get(id) ?? "")]) if (areas.includes(a)) marks.set(a, "aktueller Stoff");
  for (const t of exams) for (const id of t.skill_ids) {
    const a = areaOf.get(id);
    if (a && areas.includes(a)) marks.set(a, `${t.kind} am ${formatDate(t.date, { day: "numeric", month: "short" })}`);
  }
  return (
    <form action="/diagnose" className="grid max-w-[720px] gap-4">
      <input type="hidden" name="schueler" value={student.id} />
      <input type="hidden" name="fach" value={subject} />
      <input type="hidden" name="schulart" value={branch.key} />
      <input type="hidden" name="klasse" value={klasse} />
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Welche Themen?</legend>
        {areas.length === 0 ? (
          <p className="text-[14px] text-ink-3">Für diese Klasse gibt es noch keine Fähigkeiten.</p>
        ) : (
          <ul className="panel divide-y divide-line">
            {areas.map((a) => (
              <li key={a}>
                <label className="flex min-h-[56px] cursor-pointer items-center gap-3 px-4 py-2 hover:bg-panel/60">
                  <input type="checkbox" name="thema" value={a} defaultChecked={marks.has(a)} className="h-5 w-5 accent-[var(--accent)]" />
                  <span className="min-w-0 flex-1 font-medium">{a}</span>
                  {marks.get(a) && <Pill tone="accent">{marks.get(a)}</Pill>}
                  <span className="num text-[13px] text-ink-3">{scope.filter((s) => s.area === a).length}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <div>
        <button className="btn btn-primary btn-lg" disabled={areas.length === 0}>
          Weiter
        </button>
      </div>
    </form>
  );
}

function Confirm({ student, subject, branch, klasse, topics, scope, back }: { student: repo.Student; subject: string; branch: SchoolBranch; klasse: number; topics: string[]; scope: repo.Skill[]; back: string }) {
  const picked = diagnosisSkills({ subject, branch, klasse, topics });
  const pickedIds = new Set(picked.map((s) => s.id));
  const candidates = scope.filter((s) => topics.includes(s.area));
  const plan = planDiagnosis(picked.map((s) => s.id));
  const count = (d: string) => plan.filter((p) => p.difficulty === d).length;
  const unit = runningUnitForStudent(student.id);
  const first = student.name.split(" ")[0];
  const needsAI = picked.some((s) => !hasBuiltInGenerator(s.id));
  return (
    <form action={startDiagnosisAction} className="grid max-w-[720px] gap-5">
      <input type="hidden" name="student_id" value={student.id} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="school_type" value={branch.schoolType} />
      <input type="hidden" name="klasse" value={klasse} />
      <input type="hidden" name="back" value={back} />
      {topics.map((t) => (
        <input key={t} type="hidden" name="topics" value={t} />
      ))}
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Geprüfte Fähigkeiten (höchstens {DIAGNOSE_MAX})</legend>
        <ul className="panel divide-y divide-line">
          {candidates.map((s) => (
            <li key={s.id}>
              <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4 py-2 hover:bg-panel/60">
                <input type="checkbox" name="skill_ids" value={s.id} defaultChecked={pickedIds.has(s.id)} className="h-5 w-5 accent-[var(--accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{s.name}</span>
                  {topics.length > 1 && <span className="ml-2 text-[13px] text-ink-3">{s.area}</span>}
                </span>
                {!hasBuiltInGenerator(s.id) && <Sparkles size={14} aria-label="Aufgaben aus der Bibliothek oder mit KI" className="shrink-0 text-ink-3" />}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <p className="text-[14px] text-ink-2">
        <span className="num font-semibold text-ink">{plan.length}</span> Aufgaben: <span className="num">{count("leicht")}</span> leicht, <span className="num">{count("mittel")}</span> mittel, <span className="num">{count("schwer")}</span> schwer.
        Aufgaben aus der Bibliothek werden zuerst verwendet.
      </p>
      {needsAI && aiEnabled() && (
        <label className="flex min-h-[44px] items-center gap-3 text-[14px]">
          <input type="checkbox" name="use_ai" value="1" defaultChecked className="h-5 w-5 accent-[var(--accent)]" />
          Fehlende Aufgaben mit Claude erstellen (nur Fach, Klasse und Fähigkeiten werden übermittelt)
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary btn-lg">Diagnose starten</button>
        <span className="text-[13px] text-ink-3">{unit ? `Geht direkt auf ${first}s Tablet.` : `Wird an ${first} gesendet.`}</span>
      </div>
    </form>
  );
}
