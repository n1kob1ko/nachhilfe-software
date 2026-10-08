"use client";

import { ArrowDown, ArrowUp, BookmarkPlus, Library, Pencil, Plus, Presentation, RefreshCw, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  addTaskAction,
  deleteTaskAction,
  moveTaskAction,
  regenerateTaskAction,
  saveTaskAction,
  searchTasksAction,
  sendTaskToBoardAction,
  sendTaskToStudentAction,
  type ActionResult,
} from "@/app/builder-actions";
import { saveToLibraryAction } from "@/app/library-actions";
import { TaskBody } from "@/components/TaskPreview";
import { TabletSend } from "@/components/device/TabletSend";
import { categoriesFor, DIFFICULTIES, TASK_TYPES, type Difficulty, type TaskType } from "@/lib/curriculum";
import type { Task } from "@/lib/repo";
import { expectedFixes } from "@/lib/fix-text";
import { GAP, gapCount, hintLabel, type TaskDraft } from "@/lib/tasks";
import { MathText } from "./MathText";

type Skill = { id: string; name: string; area: string; parent_id: string | null };
type Unit = { unit_id: number; student_id: number; student_name: string };
type Props = {
  worksheetId: number;
  subject: string;
  editable: boolean;
  tasks: Task[];
  skills: Skill[];
  students: { id: number; name: string }[];
  defaultStudentId: number | null;
  units: Unit[];
  /** the teacher's running unit: single tasks go straight to its student's tablet */
  active?: { unitId: number; student: string } | null;
  showSolutions: boolean;
  aiEnabled: boolean;
  /** Aufgabenbibliothek: one task, no adding, reordering or regenerating, no "In Bibliothek" */
  library?: boolean;
  /** task that opens in the editor right away (a new library task) */
  initialEditing?: number | null;
};

const FORMATS = (Object.keys(TASK_TYPES) as (keyof typeof TASK_TYPES)[]).filter((k): k is TaskType => k !== "mixed");

function Note({ r }: { r: ActionResult }) {
  if (!r) return null;
  const text = r.error ?? r.warning ?? r.ok;
  const cls = r.error ? "text-red" : r.warning ? "text-amber" : "text-green";
  return (
    <p className={`text-[13px] ${cls}`} role={r.error ? "alert" : "status"}>
      {text}
      {r.link && (
        <>
          {" "}
          <Link href={r.link.href} className="link font-medium">
            {r.link.label}
          </Link>
        </>
      )}
    </p>
  );
}

export function WorksheetEditor(p: Props) {
  const [editing, setEditing] = useState<number | null>(p.initialEditing ?? null);
  const passages = new Set<string>();
  const skillName = (id: string | null) => {
    const s = p.skills.find((x) => x.id === id);
    if (!s) return undefined;
    const parent = s.parent_id ? p.skills.find((x) => x.id === s.parent_id) : null;
    return parent ? `${parent.name} › ${s.name}` : s.name;
  };
  return (
    <div className="grid gap-3">
      {p.tasks.length === 0 && <p className="panel px-5 py-6 text-[15px] text-ink-2">Noch keine Aufgaben. Leg unten die erste an oder übernimm eine aus der Aufgabensammlung.</p>}
      <ol className="grid gap-3" aria-label="Aufgaben">
        {p.tasks.map((t, i) => {
          const shown = t.data.passage ? passages.has(t.data.passage) : false;
          if (t.data.passage) passages.add(t.data.passage);
          return (
            <li key={t.id} id={`aufgabe-${t.id}`} className="panel scroll-mt-6 px-5 py-4">
              {editing === t.id ? (
                <TaskForm task={t} index={i + 1} subject={p.subject} skills={p.skills} onDone={() => setEditing(null)} />
              ) : (
                <TaskCard
                  {...p}
                  task={t}
                  index={i + 1}
                  first={i === 0}
                  last={i === p.tasks.length - 1}
                  skillName={skillName(t.skillId)}
                  passageShown={shown}
                  onEdit={() => setEditing(t.id)}
                />
              )}
            </li>
          );
        })}
      </ol>
      {p.editable && !p.library && <AddTask {...p} afterId={p.tasks.at(-1)?.id} onAdded={(id) => setEditing(id)} />}
    </div>
  );
}

function TaskCard(p: Props & { task: Task; index: number; first: boolean; last: boolean; skillName?: string; passageShown: boolean; onEdit: () => void }) {
  const { task: t } = p;
  const [pending, start] = useTransition();
  const [note, setNote] = useState<ActionResult>(null);
  const [panel, setPanel] = useState<"none" | "send">("none");
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setNote(null);
      setNote(await fn());
    });
  return (
    <div className={pending ? "opacity-60 transition-opacity" : ""} aria-busy={pending}>
      <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
        <span className="num pt-0.5 text-[15px] font-semibold text-ink-3">{p.index}.</span>
        <TaskBody task={t} showSolution={p.showSolutions} skillName={p.skillName} subject={p.subject} passageShown={p.passageShown} />
      </div>
      <div className="no-print mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3 pl-[44px]">
        {p.editable && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={p.onEdit}>
              <Pencil size={14} aria-hidden /> Bearbeiten
            </button>
            {/* a library task is curated: it changes only in the editor (difficulty included), never replaced at a click */}
            {!p.library && (
              <>
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => regenerateTaskAction(t.id))} title={p.aiEnabled ? "Claude erstellt eine neue Aufgabe für dieselbe Fähigkeit" : "Der Generator erstellt eine neue Aufgabe für dieselbe Fähigkeit"}>
                  <RefreshCw size={14} aria-hidden /> Neu erstellen
                </button>
                <label className="flex items-center gap-1 text-[13px] text-ink-2">
                  <span className="sr-only">Schwierigkeit ändern</span>
                  <select
                    className="input h-8 py-0 text-[13px]"
                    value={(DIFFICULTIES as readonly string[]).includes(t.difficulty) ? t.difficulty : ""}
                    disabled={pending}
                    onChange={(e) => run(() => regenerateTaskAction(t.id, e.target.value as Difficulty))}
                    aria-label="Schwierigkeit ändern (erstellt die Aufgabe neu)"
                    title="Schwierigkeit ändern: die Aufgabe wird in dieser Schwierigkeit neu erstellt"
                  >
                    {!(DIFFICULTIES as readonly string[]).includes(t.difficulty) && <option value="">{t.difficulty}</option>}
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="mx-1 h-5 w-px bg-line" aria-hidden />
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending || p.first} onClick={() => run(() => moveTaskAction(t.id, -1))} aria-label={`Aufgabe ${p.index} nach oben`} title="Nach oben">
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending || p.last} onClick={() => run(() => moveTaskAction(t.id, 1))} aria-label={`Aufgabe ${p.index} nach unten`} title="Nach unten">
                  <ArrowDown size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-red"
                  disabled={pending}
                  onClick={() => confirm(`Aufgabe ${p.index} löschen?`) && run(() => deleteTaskAction(t.id))}
                  aria-label={`Aufgabe ${p.index} löschen`}
                  title="Löschen"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </>
            )}
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          </>
        )}
        {!p.library && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => saveToLibraryAction(t.id))} title="Eine Kopie dieser Aufgabe in der Aufgabenbibliothek speichern">
            <BookmarkPlus size={14} aria-hidden /> In Bibliothek
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={panel === "send"} onClick={() => setPanel(panel === "send" ? "none" : "send")} title="Nur diese eine Aufgabe an einen Schüler oder aufs Whiteboard senden">
          <Send size={14} aria-hidden /> Einzeln senden
        </button>
      </div>
      {panel === "send" && <SendPanel {...p} run={run} pending={pending} />}
      <div className="mt-2 pl-[44px]">
        <Note r={note} />
      </div>
    </div>
  );
}

/** "An Schüler senden" and "Auf Whiteboard senden" for one task. */
function SendPanel(p: Props & { task: Task; run: (fn: () => Promise<ActionResult>) => void; pending: boolean }) {
  const [studentId, setStudentId] = useState<number | "">(p.defaultStudentId ?? "");
  const preferred = p.units.find((u) => u.unit_id === p.active?.unitId) ?? p.units.find((u) => u.student_id === p.defaultStudentId) ?? p.units[0];
  const [unitId, setUnitId] = useState(preferred?.unit_id ?? 0);
  return (
    <div className="mt-3 ml-[44px] grid gap-3 rounded-lg bg-paper px-4 py-3 sm:grid-cols-2">
      {p.active ? (
        <div className="grid content-start gap-2">
          <span className="label">An Schüler senden</span>
          <TabletSend student={p.active.student} unitId={p.active.unitId} taskId={p.task.id} small />
        </div>
      ) : (
      <div className="grid gap-2">
        <span className="label">An Schüler senden</span>
        <div className="flex gap-2">
          <select className="input min-w-0 flex-1" value={studentId} onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : "")} aria-label="Schüler">
            <option value="">Schüler wählen</option>
            {p.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!studentId || p.pending} onClick={() => studentId && p.run(() => sendTaskToStudentAction(p.task.id, studentId))}>
            <Send size={14} aria-hidden /> Senden
          </button>
        </div>
        <p className="text-[12px] text-ink-3">Kommt als einzelne Aufgabe auf seinen Lernlink.</p>
      </div>
      )}
      <div className="grid gap-2">
        <span className="label flex items-center gap-1.5">
          <Presentation size={14} aria-hidden /> Auf Whiteboard senden
        </span>
        {p.units.length === 0 ? (
          <p className="text-[13px] text-ink-3">Nur während einer laufenden Einheit.</p>
        ) : (
          <div className="flex gap-2">
            <select className="input min-w-0 flex-1" value={unitId} onChange={(e) => setUnitId(Number(e.target.value))} aria-label="Whiteboard von">
              {p.units.map((u) => (
                <option key={u.unit_id} value={u.unit_id}>
                  Whiteboard von {u.student_name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" disabled={p.pending} onClick={() => p.run(() => sendTaskToBoardAction(p.task.id, unitId))}>
              <Presentation size={14} aria-hidden /> Aufs Whiteboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- adding ----------
function AddTask(p: Props & { afterId?: number; onAdded: (id: number) => void }) {
  const [open, setOpen] = useState<"none" | "neu" | "sammlung">("none");
  const [pending, start] = useTransition();
  const [note, setNote] = useState<ActionResult>(null);
  const cats = categoriesFor(p.subject);
  const main = p.tasks.at(-1)?.skillId ?? p.skills.find((s) => !s.parent_id)?.id ?? null;
  const [skillId, setSkillId] = useState<string | null>(main);
  const [category, setCategory] = useState(cats[0]?.key ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>((p.tasks.at(-1)?.difficulty as Difficulty) ?? "mittel");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Awaited<ReturnType<typeof searchTasksAction>> | null>(null);
  const add = (what: Parameters<typeof addTaskAction>[1]) =>
    start(async () => {
      const r = await addTaskAction(p.worksheetId, what, p.afterId);
      setNote(r);
      if (r?.id && !("copyFrom" in what)) {
        setOpen("none");
        p.onAdded(r.id);
      }
    });
  const search = (q: string) => start(async () => setFound(await searchTasksAction(p.worksheetId, q)));
  const cat = cats.find((c) => c.key === category);

  return (
    <div className="no-print rounded-xl border border-dashed border-line-strong px-5 py-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn btn-sm ${open === "neu" ? "btn-primary" : "btn-secondary"}`} onClick={() => setOpen(open === "neu" ? "none" : "neu")}>
          <Plus size={14} aria-hidden /> Neue Aufgabe
        </button>
        <button
          type="button"
          className={`btn btn-sm ${open === "sammlung" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => {
            setOpen(open === "sammlung" ? "none" : "sammlung");
            if (!found) search("");
          }}
        >
          <Library size={14} aria-hidden /> Aus Bibliothek und früheren Übungen
        </button>
      </div>
      {open === "neu" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="field">
            <span className="label">Aufgabentyp</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Fähigkeit</span>
            <SkillSelect skills={p.skills} value={skillId} onChange={setSkillId} />
          </label>
          <label className="field">
            <span className="label">Schwierigkeit</span>
            <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3 sm:col-span-3">
            <button type="button" className="btn btn-primary btn-sm" disabled={pending || !cat} onClick={() => cat && add({ format: cat.formats[0], skillId, category, difficulty })}>
              Anlegen und bearbeiten
            </button>
            {cat && <span className="text-[13px] text-ink-3">{cat.hint}</span>}
          </div>
        </div>
      )}
      {open === "sammlung" && (
        <div className="mt-4 grid gap-3">
          <form
            className="flex max-w-[420px] gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
          >
            <input className="input" type="search" placeholder="Text in der Aufgabe" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Aufgaben durchsuchen" />
            <button className="btn btn-secondary btn-sm" disabled={pending}>
              Suchen
            </button>
          </form>
          <p className="text-[12px] text-ink-3">Aufgaben zu denselben Fähigkeiten stehen oben, Bibliotheksaufgaben zuerst.</p>
          {found && found.length === 0 && <p className="text-[14px] text-ink-3">Keine passenden Aufgaben gefunden.</p>}
          <ul className="grid max-h-[360px] gap-1.5 overflow-y-auto">
            {found?.map((t) => (
              <li key={t.id} className="flex items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[14px]"><MathText text={t.prompt.replaceAll(GAP, "…")} /></p>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {TASK_TYPES[t.type]} · {t.difficulty} · {t.library ? "aus der Bibliothek" : `aus „${t.worksheetTitle}“`}
                  </p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm shrink-0" disabled={pending} onClick={() => add({ copyFrom: t.id })}>
                  Übernehmen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2">
        <Note r={note} />
      </div>
    </div>
  );
}

function SkillSelect({ skills, value, onChange }: { skills: Skill[]; value: string | null; onChange: (id: string | null) => void }) {
  const areas = [...new Set(skills.map((s) => s.area))];
  return (
    <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Keine</option>
      {areas.map((a) => (
        <optgroup key={a} label={a}>
          {skills
            .filter((s) => s.area === a && !s.parent_id)
            .flatMap((s) => [s, ...skills.filter((x) => x.parent_id === s.id)])
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.parent_id ? `  › ${s.name}` : s.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

// ---------- editing ----------
/** Switches the answer format and keeps what still fits (prompt, solution, hints). */
function reshape(t: TaskDraft, format: TaskType): TaskDraft {
  const keep = { ...t, type: format };
  const opts = t.data.options ?? ["", "", ""];
  switch (format) {
    case "mc":
      return { ...keep, data: { options: opts }, answer: { correct: t.answer.correct ?? 0 } };
    case "reading":
      return { ...keep, data: { passage: t.data.passage ?? "", options: opts }, answer: { correct: t.answer.correct ?? 0 } };
    case "cloze":
      return { ...keep, data: {}, prompt: t.prompt.includes(GAP) ? t.prompt : `${t.prompt} ${GAP}`.trim(), answer: { blanks: t.answer.blanks ?? [[t.answer.accepted?.[0] ?? ""]], mode: t.answer.mode ?? "text" } };
    case "free":
      return { ...keep, data: { passage: t.data.passage, lines: t.data.lines ?? 5 }, answer: { sample: t.answer.sample ?? t.answer.accepted?.[0] ?? "", criteria: t.answer.criteria ?? [] } };
    case "fix":
      return {
        ...keep,
        data: { faulty: t.data.faulty ?? "" },
        answer: { accepted: t.type === "fix" ? (t.answer.accepted ?? [""]) : [""], mode: t.answer.mode === "text" ? "text" : "exact", fixes: t.answer.fixes ?? [], criteria: t.answer.criteria ?? [] },
      };
    case "order":
      return { ...keep, data: {}, answer: { steps: t.answer.steps ?? ["", "", ""] } };
    case "grammar":
      return { ...keep, data: {}, answer: { accepted: t.answer.accepted ?? [""], mode: t.answer.mode === "exact" ? "exact" : "text" } };
    default:
      return { ...keep, data: {}, answer: { accepted: t.answer.accepted ?? [""], mode: "value" } };
  }
}

function TaskForm({ task, index, subject, skills, onDone }: { task: Task; index: number; subject: string; skills: Skill[]; onDone: () => void }) {
  const { id: _id, worksheet_id: _w, position: _p, ...initial } = task;
  void _id, void _w, void _p;
  const [t, setT] = useState<TaskDraft>({ ...initial, hints: initial.hints.length ? initial.hints : ["", "", ""] });
  const [pending, start] = useTransition();
  const [note, setNote] = useState<ActionResult>(null);
  const set = (patch: Partial<TaskDraft>) => setT((cur) => ({ ...cur, ...patch }));
  const setAnswer = (patch: Partial<TaskDraft["answer"]>) => setT((cur) => ({ ...cur, answer: { ...cur.answer, ...patch } }));
  const setData = (patch: Partial<TaskDraft["data"]>) => setT((cur) => ({ ...cur, data: { ...cur.data, ...patch } }));
  const cats = categoriesFor(subject);
  const gaps = gapCount(t.prompt);
  const blanks = t.answer.blanks ?? [];
  const save = () =>
    start(async () => {
      const r = await saveTaskAction(task.id, t);
      setNote(r);
      if (r?.ok) onDone();
    });
  const list = (items: string[], onChange: (next: string[]) => void, label: (i: number) => string, opts: { min?: number; correct?: number; onCorrect?: (i: number) => void; movable?: boolean; addLabel: string }) => (
    <div className="grid gap-1.5">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          {opts.onCorrect && <input type="radio" name={`correct-${task.id}`} checked={opts.correct === i} onChange={() => opts.onCorrect!(i)} className="h-4 w-4 accent-[var(--green)]" aria-label={`${label(i)} ist richtig`} title="Richtige Antwort" />}
          <span className="num w-6 shrink-0 text-[13px] text-ink-3">{label(i)}</span>
          <input className="input" value={v} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} aria-label={label(i)} />
          {opts.movable && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => onChange(items.map((x, j) => (j === i - 1 ? items[i] : j === i ? items[i - 1] : x)))} aria-label={`${label(i)} nach oben`}>
              <ArrowUp size={14} aria-hidden />
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" disabled={items.length <= (opts.min ?? 1)} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`${label(i)} entfernen`}>
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
      <button type="button" className="justify-self-start text-[13px] font-semibold text-accent hover:underline" onClick={() => onChange([...items, ""])}>
        + {opts.addLabel}
      </button>
    </div>
  );

  return (
    <div className="grid gap-4" aria-label={`Aufgabe ${index} bearbeiten`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Aufgabe {index} bearbeiten</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Abbrechen
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="field">
          <span className="label">Aufgabentyp</span>
          <select
            className="input"
            value={t.category ?? ""}
            onChange={(e) => {
              const c = cats.find((x) => x.key === e.target.value);
              setT((cur) => (c && !c.formats.includes(cur.type) ? { ...reshape(cur, c.formats[0]), category: c.key } : { ...cur, category: e.target.value || null }));
            }}
          >
            <option value="">–</option>
            {cats.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Antwortformat</span>
          <select className="input" value={t.type} onChange={(e) => setT((cur) => reshape(cur, e.target.value as TaskType))}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {TASK_TYPES[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Fähigkeit</span>
          <SkillSelect skills={skills} value={t.skillId} onChange={(id) => set({ skillId: id, skillIds: [...new Set([id, ...(t.skillIds ?? []).filter((x) => x !== t.skillId)].filter((x): x is string => Boolean(x)))] })} />
        </label>
        <label className="field">
          <span className="label">Schwierigkeit</span>
          <select className="input" value={t.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
            {!(DIFFICULTIES as readonly string[]).includes(t.difficulty) && <option>{t.difficulty}</option>}
            {DIFFICULTIES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      <details className="text-[13px]">
        <summary className="cursor-pointer text-ink-2">Weitere Fähigkeiten, die diese Aufgabe trainiert ({Math.max(0, (t.skillIds ?? []).filter((x) => x !== t.skillId).length)})</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {skills
            .filter((s) => s.id !== t.skillId)
            .map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 has-checked:border-accent has-checked:bg-accent-wash">
                <input
                  type="checkbox"
                  checked={(t.skillIds ?? []).includes(s.id)}
                  onChange={(e) => set({ skillIds: e.target.checked ? [...(t.skillIds ?? []), s.id] : (t.skillIds ?? []).filter((x) => x !== s.id) })}
                  className="accent-[var(--accent)]"
                />
                {s.name}
              </label>
            ))}
        </div>
      </details>

      {(t.type === "reading" || (t.type === "free" && t.data.passage !== undefined)) && (
        <label className="field">
          <span className="label">Lesetext</span>
          <textarea className="input min-h-[120px]" value={t.data.passage ?? ""} onChange={(e) => setData({ passage: e.target.value })} />
        </label>
      )}
      <label className="field">
        <span className="label">Aufgabenstellung</span>
        <textarea className="input min-h-[84px]" value={t.prompt} onChange={(e) => set({ prompt: e.target.value })} />
        {t.type === "cloze" && <span className="text-[12px] text-ink-3">Lücken mit {GAP} (drei Unterstriche) markieren. Jetzt: {gaps} {gaps === 1 ? "Lücke" : "Lücken"}.</span>}
      </label>

      {(t.type === "mc" || t.type === "reading") &&
        list(t.data.options ?? [], (next) => setT((cur) => ({ ...cur, data: { ...cur.data, options: next }, answer: { ...cur.answer, correct: Math.min(cur.answer.correct ?? 0, next.length - 1) } })), (i) => `${String.fromCharCode(97 + i)})`, {
          min: 2,
          correct: t.answer.correct,
          onCorrect: (i) => setAnswer({ correct: i }),
          addLabel: "Antwortmöglichkeit",
        })}
      {(t.type === "calc" || t.type === "grammar") && (
        <div className="grid gap-1.5">
          <span className="label">Richtige Antwort{t.type === "calc" ? " (Zahl, Bruch oder Text)" : ""}</span>
          {list(t.answer.accepted ?? [""], (next) => setAnswer({ accepted: next }), (i) => (i === 0 ? "✓" : "oder"), { addLabel: "Weitere richtige Schreibweise" })}
          {t.type === "grammar" && (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={t.answer.mode === "exact"} onChange={(e) => setAnswer({ mode: e.target.checked ? "exact" : "text" })} className="accent-[var(--accent)]" />
              Groß- und Kleinschreibung beachten
            </label>
          )}
        </div>
      )}
      {t.type === "cloze" && (
        <div className="grid gap-1.5">
          <span className="label">Lösungen der Lücken (weitere richtige Antworten mit | trennen)</span>
          {Array.from({ length: Math.max(gaps, blanks.length) }, (_, i) => (
            <label key={i} className={`flex items-center gap-2 ${i >= gaps ? "opacity-50" : ""}`}>
              <span className="num w-16 shrink-0 text-[13px] text-ink-3">Lücke {i + 1}</span>
              <input
                className="input"
                value={(blanks[i] ?? []).join(" | ")}
                onChange={(e) => {
                  const next = Array.from({ length: Math.max(gaps, blanks.length) }, (_, j) => blanks[j] ?? [""]);
                  next[i] = e.target.value.split("|").map((x) => x.trim());
                  setAnswer({ blanks: next.slice(0, Math.max(gaps, 1)) });
                }}
              />
            </label>
          ))}
          {t.answer.mode !== "value" && (
            <label className="flex min-h-[44px] items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={t.answer.mode === "exact"} onChange={(e) => setAnswer({ mode: e.target.checked ? "exact" : "text" })} className="accent-[var(--accent)]" />
              Groß- und Kleinschreibung beachten
            </label>
          )}
        </div>
      )}
      {t.type === "fix" && <FixFields t={t} setT={setT} />}
      {t.type === "free" && (
        <>
          <label className="field">
            <span className="label">Antwortfeld für den Schüler</span>
            <select className="input max-w-[320px]" value={String(t.data.lines ?? 5)} onChange={(e) => setData({ lines: Number(e.target.value) })}>
              <option value="1">Einzeilig (kurze Antwort)</option>
              <option value="3">Ein paar Sätze</option>
              <option value="5">Mehrere Sätze</option>
              <option value="9">Längerer Text</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Musterlösung</span>
            <textarea className="input min-h-[72px]" value={t.answer.sample ?? ""} onChange={(e) => setAnswer({ sample: e.target.value })} />
            <span className="text-[12px] text-ink-3">Der Schüler sieht sie nach dem Abgeben. Du bewertest die Antwort als richtig, teilweise richtig oder falsch.</span>
          </label>
        </>
      )}
      {(t.type === "free" || t.type === "fix") && (
        <div className="grid gap-1.5">
          <span className="label">Erwartung: darauf kommt es an</span>
          {list(t.answer.criteria ?? [], (next) => setAnswer({ criteria: next }), (i) => `${i + 1}.`, { min: 0, addLabel: "Punkt" })}
        </div>
      )}
      {t.type === "order" && (
        <div className="grid gap-1.5">
          <span className="label">Schritte in der richtigen Reihenfolge</span>
          {list(t.answer.steps ?? [], (next) => setAnswer({ steps: next }), (i) => `${i + 1}.`, { min: 2, movable: true, addLabel: "Schritt" })}
          <span className="text-[12px] text-ink-3">Der Schüler sieht die Schritte gemischt.</span>
        </div>
      )}

      <label className="field">
        <span className="label">Lösungsweg</span>
        <textarea className="input min-h-[84px]" value={t.solution} onChange={(e) => set({ solution: e.target.value })} />
      </label>
      <div className="grid gap-1.5">
        <span className="label">Hilfestufen (der Schüler öffnet sie nacheinander)</span>
        {list(t.hints, (next) => set({ hints: next }), (i) => String(i + 1), { min: 0, addLabel: "Hilfe" })}
        <span className="text-[12px] text-ink-3">{[0, 1, 2].map(hintLabel).join(" · ")}</span>
      </div>
      <div className="grid gap-1.5">
        <span className="label">Typische Fehler</span>
        {t.errorMap.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="input w-36" placeholder={t.data.options ? "Option (0, 1 …)" : "falsche Antwort"} value={e.answer} onChange={(ev) => set({ errorMap: t.errorMap.map((x, j) => (j === i ? { ...x, answer: ev.target.value } : x)) })} aria-label="Falsche Antwort" />
            <input className="input" placeholder="Was dahintersteckt, z. B. Kehrwert vergessen" value={e.label} onChange={(ev) => set({ errorMap: t.errorMap.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)) })} aria-label="Fehler" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ errorMap: t.errorMap.filter((_, j) => j !== i) })} aria-label="Fehler entfernen">
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" className="justify-self-start text-[13px] font-semibold text-accent hover:underline" onClick={() => set({ errorMap: [...t.errorMap, { answer: "", label: "" }] })}>
          + Typischer Fehler
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>
          {pending ? "Speichert …" : "Speichern"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Abbrechen
        </button>
        <Note r={note} />
      </div>
    </div>
  );
}

/** Fehler korrigieren: the text with errors, the corrected text (and other right versions), the errors it finds. */
function FixFields({ t, setT }: { t: TaskDraft; setT: (f: (cur: TaskDraft) => TaskDraft) => void }) {
  const faulty = t.data.faulty ?? "";
  const accepted = t.answer.accepted ?? [""];
  const setAccepted = (next: string[]) => setT((cur) => ({ ...cur, answer: { ...cur.answer, accepted: next } }));
  const cs = t.answer.mode !== "text";
  const found = faulty.trim() && accepted[0]?.trim() ? expectedFixes(faulty, accepted[0], cs) : [];
  const labelOf = (f: { wrong: string; right: string }) => t.answer.fixes?.find((x) => x.wrong === f.wrong && x.right === f.right)?.label ?? "";
  const setLabel = (f: { wrong: string; right: string }, label: string) =>
    setT((cur) => ({
      ...cur,
      answer: {
        ...cur.answer,
        fixes: found.map((x) => (x.wrong === f.wrong && x.right === f.right ? { ...x, label } : { ...x, label: labelOf(x), errorType: cur.answer.fixes?.find((o) => o.wrong === x.wrong && o.right === x.right)?.errorType ?? null })),
      },
    }));
  return (
    <div className="grid gap-3">
      <label className="field">
        <span className="label">Text mit Fehlern (das sieht der Schüler)</span>
        <textarea className="input min-h-[96px]" value={faulty} onChange={(e) => setT((cur) => ({ ...cur, data: { ...cur.data, faulty: e.target.value }, answer: { ...cur.answer, accepted: cur.answer.accepted?.[0] ? cur.answer.accepted : [e.target.value] } }))} />
      </label>
      <div className="grid gap-1.5">
        <span className="label">Verbesserter Text</span>
        {accepted.map((v, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-10 shrink-0 pt-2.5 text-[13px] text-ink-3">{i === 0 ? "✓" : "oder"}</span>
            <textarea
              className="input min-h-[72px]"
              value={v}
              aria-label={i === 0 ? "Verbesserter Text" : `Weitere richtige Fassung ${i}`}
              onChange={(e) => setAccepted(accepted.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button type="button" className="btn btn-ghost btn-sm" disabled={accepted.length <= 1} onClick={() => setAccepted(accepted.filter((_, j) => j !== i))} aria-label={`${i === 0 ? "Verbesserten Text" : `Fassung ${i}`} entfernen`}>
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" className="justify-self-start text-[13px] font-semibold text-accent hover:underline" onClick={() => setAccepted([...accepted, accepted[0] ?? ""])}>
          + Weitere richtige Fassung
        </button>
        <label className="flex min-h-[44px] items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={cs} onChange={(e) => setT((cur) => ({ ...cur, answer: { ...cur.answer, mode: e.target.checked ? "exact" : "text" } }))} className="accent-[var(--accent)]" />
          Groß- und Kleinschreibung beachten
        </label>
      </div>
      <div className="grid gap-1.5" aria-live="polite">
        <span className="label">Gefundene Fehler ({found.length})</span>
        {found.length === 0 ? (
          <p className="text-[13px] text-ink-3">{faulty.trim() && accepted[0]?.trim() ? "Die beiden Texte sind gleich. Verbessere den Text oben." : "Schreib beide Texte, dann erscheinen hier die Fehler."}</p>
        ) : (
          found.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="min-w-[180px] text-[14px]">
                <span className="fx-wrong">{f.wrong || "(fehlt)"}</span> → <span className="fx-fixed">{f.right || "(weg)"}</span>
              </span>
              <input className="input min-w-0 flex-1" placeholder="Was ist falsch? z. B. Dativ nach „mit“" value={labelOf(f)} onChange={(e) => setLabel(f, e.target.value)} aria-label={`Fehler ${i + 1}: was ist falsch`} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
