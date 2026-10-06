import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { analyzeMaterialAction, classifyMaterialAction, deleteMaterialAction, setMaterialSourceAction, takeOverTaskAction } from "@/app/material-actions";
import { Info } from "@/components/Info";
import { PageHeader, Pill, Reveal, SectionTitle, formatDate } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { DIFFICULTIES, SUBJECTS } from "@/lib/curriculum";
import {
  getMaterial,
  libraryTasksOf,
  MATERIAL_KINDS,
  MATERIAL_ORIGINS,
  MATERIAL_STATUS,
  materialOrigin,
  MAX_ANALYSIS_IMAGE_BYTES,
  MAX_ANALYSIS_PDF_BYTES,
  suggestedSkills,
  takeoverRule,
  type Material,
} from "@/lib/materials";
import * as repo from "@/lib/repo";
import { klassenLabel, SCHOOL_TYPES } from "@/lib/school";

export const metadata = { title: "Material" };

type Params = { fehler?: string; gespeichert?: string; vorhanden?: string; erkannt?: string; uebernommen?: string; vorschlag?: string };
const chip = "flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13.5px] has-checked:border-accent has-checked:bg-accent-wash has-checked:text-accent";
const statusTone = { hochgeladen: "amber", vorschlag: "accent", geprueft: "green" } as const;
const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/**
 * One material: the preview, where it belongs, its origin and licence, the optional recognition with
 * Claude (suggestions only) and taking over checked tasks into the library.
 */
export default async function MaterialPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  await requireTeacher();
  const m = getMaterial(Number((await params).id));
  if (!m) notFound();
  const sp = await searchParams;
  const rule = takeoverRule(m);
  const origin = materialOrigin(rule.source);
  const skills = repo.listSkills();
  const ofSubject = skills.filter((s) => s.subject === m.subject);
  const byId = new Map(skills.map((s) => [s.id, s]));
  const a = m.analysis;
  // a suggestion only fills the form when the teacher asks for it; saving the form is the check
  const useSuggestion = Boolean(sp.vorschlag && a);
  const values = {
    subject: (useSuggestion && a?.subject && (SUBJECTS as readonly string[]).includes(a.subject) ? a.subject : m.subject) || "",
    topic: (useSuggestion && a?.topic) || m.topic,
    skillIds: useSuggestion && a ? [...new Set([...m.skill_ids, ...a.skill_ids])] : m.skill_ids,
  };
  const chips = [...new Set([...values.skillIds, ...suggestedSkills(m).map((s) => s.id), ...(a?.skill_ids ?? [])])]
    .map((id) => byId.get(id))
    .filter((s): s is repo.Skill => Boolean(s) && (!values.subject || s!.subject === values.subject));
  const rest = ofSubject.filter((s) => !chips.some((c) => c.id === s.id));
  const areas = [...new Set(rest.map((s) => s.area))];
  const taken = libraryTasksOf(m.id);
  const students = repo.listStudents();
  const level = m.school_type ? klassenLabel(m.school_type, m.klasse) : "";
  const tooBig = m.size > (m.mime === "application/pdf" ? MAX_ANALYSIS_PDF_BYTES : MAX_ANALYSIS_IMAGE_BYTES);
  const fileUrl = `/material/${m.id}/datei`;

  return (
    <>
      <PageHeader
        back={{ href: "/mehr/material", label: "Material" }}
        title={m.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            <Pill tone={statusTone[m.status]}>{MATERIAL_STATUS[m.status]}</Pill>
            {MATERIAL_KINDS[m.kind]} · {[m.subject, level, m.topic].filter(Boolean).join(" · ") || "noch nicht eingeordnet"} · {mb(m.size)} · {formatDate(m.created_at)}
          </span>
        }
      />
      {sp.fehler && (
        <p className="mb-6 rounded-2xl bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
          {sp.fehler}
        </p>
      )}
      {(sp.gespeichert || sp.vorhanden || sp.uebernommen) && (
        <p className="mb-6 inline-flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-green" role="status">
          <CheckCircle2 size={16} aria-hidden />
          {sp.vorhanden ? "Diese Datei war schon da. Du siehst das vorhandene Material." : sp.uebernommen ? "In die Aufgabenbibliothek übernommen." : "Gespeichert."}
          {sp.uebernommen && Number(sp.uebernommen) > 0 && (
            <Link href={`/uebungen/bibliothek/${Number(sp.uebernommen)}`} className="link">
              Aufgabe ansehen
            </Link>
          )}
        </p>
      )}

      <div className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section aria-label="Vorschau" className="min-w-0">
          <div className="overflow-hidden rounded-[20px] border border-line bg-paper">
            {m.mime === "application/pdf" ? (
              <iframe src={fileUrl} title={`Vorschau ${m.title}`} className="h-[70vh] min-h-[420px] w-full" />
            ) : (
              <img src={fileUrl} alt={`Vorschau ${m.title}`} className="max-h-[75vh] w-full object-contain" />
            )}
          </div>
          <a href={fileUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mt-2">
            <ExternalLink size={15} aria-hidden /> In neuem Tab öffnen
          </a>
        </section>

        <section aria-label="Einordnung" className="min-w-0">
          <SectionTitle>
            <span>
              Einordnung
              <Info label="Info zur Einordnung">Fach, Thema und Fähigkeiten legst du fest. Vorschläge (aus dem Thema oder von Claude) sind nur angehakt, wenn du sie übernimmst. Mit dem Speichern gilt das Material als geprüft.</Info>
            </span>
          </SectionTitle>
          {a && !useSuggestion && (
            <Link href={`/mehr/material/${m.id}?vorschlag=1`} className="btn btn-secondary btn-sm mb-3">
              <Sparkles size={14} aria-hidden /> Vorschlag von Claude ins Formular
            </Link>
          )}
          {useSuggestion && <p className="mb-3 rounded-lg bg-accent-wash px-3 py-2 text-[13px] text-accent">Vorschlag eingesetzt. Bitte prüfen und speichern.</p>}
          <form action={classifyMaterialAction.bind(null, m.id)} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <label className="field">
                <span className="label">Titel</span>
                <input className="input" name="title" defaultValue={m.title} maxLength={120} required />
              </label>
              <label className="field">
                <span className="label">Art</span>
                <select className="input" name="kind" defaultValue={m.kind}>
                  {Object.entries(MATERIAL_KINDS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="field">
                <span className="label">Fach</span>
                <select className="input" name="subject" defaultValue={values.subject}>
                  <option value="">–</option>
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Schulart</span>
                <select className="input" name="school_type" defaultValue={m.school_type}>
                  <option value="">–</option>
                  {SCHOOL_TYPES.map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Klasse</span>
                <select className="input" name="klasse" defaultValue={m.klasse ?? ""}>
                  <option value="">–</option>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((k) => (
                    <option key={k} value={k}>
                      {k}.
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span className="label">Thema</span>
              <input className="input" name="topic" defaultValue={values.topic} maxLength={160} list="material-topics" placeholder="z. B. Bruchrechnen" />
              <datalist id="material-topics">
                {[...new Set(ofSubject.map((s) => s.area))].map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            {values.subject ? (
              <fieldset className="grid gap-1.5">
                <legend className="label mb-1">Fähigkeiten</legend>
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((s) => (
                    <label key={s.id} className={chip}>
                      <input type="checkbox" name="skill_ids" value={s.id} defaultChecked={values.skillIds.includes(s.id)} className="accent-[var(--accent)]" />
                      {s.name}
                      <span className="text-ink-3">· {s.area}</span>
                    </label>
                  ))}
                  {chips.length === 0 && <span className="text-[13px] text-ink-3">Kein Vorschlag zum Thema. Wähle aus der Liste.</span>}
                </div>
                {rest.length > 0 && (
                  <Reveal label="Aus allen Fähigkeiten wählen">
                    <div className="grid max-h-[280px] gap-3 overflow-y-auto rounded-lg border border-line bg-paper p-3">
                      {areas.map((area) => (
                        <fieldset key={area}>
                          <legend className="mb-1 text-[12px] font-semibold text-ink-3">{area}</legend>
                          <div className="flex flex-wrap gap-1.5">
                            {rest
                              .filter((s) => s.area === area)
                              .map((s) => (
                                <label key={s.id} className="flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[13px] has-checked:border-accent has-checked:bg-accent-wash">
                                  <input type="checkbox" name="skill_ids" value={s.id} defaultChecked={values.skillIds.includes(s.id)} className="accent-[var(--accent)]" />
                                  {s.name}
                                </label>
                              ))}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  </Reveal>
                )}
              </fieldset>
            ) : (
              <p className="text-[13px] text-ink-3">Nach dem Speichern mit Fach erscheinen passende Fähigkeiten.</p>
            )}
            <label className="field">
              <span className="label">Schüler (optional)</span>
              <select className="input" name="student_id" defaultValue={m.student_id ?? ""}>
                <option value="">–</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Notiz</span>
              <textarea className="input min-h-[72px]" name="notes" defaultValue={m.notes} maxLength={2000} />
            </label>
            <div>
              <button className="btn btn-primary">Einordnung speichern</button>
            </div>
          </form>
        </section>
      </div>

      <div className="mb-10 grid max-w-[1040px] gap-10 lg:grid-cols-2">
        <section id="herkunft" aria-label="Herkunft und Lizenz" className="scroll-mt-24">
          <SectionTitle>
            <span>
              Herkunft und Lizenz
              <Info label="Warum Herkunft und Lizenz?">
                Eigenes Material und frei lizenzierte Aufgaben (z. B. CC BY) dürfen nach deiner Prüfung so in die Bibliothek. Aufgaben aus Schulbuch, Verlag oder von der Schule nur in eigenen Worten. Die Angaben bleiben bei jeder übernommenen Aufgabe gespeichert.
              </Info>
            </span>
          </SectionTitle>
          <form action={setMaterialSourceAction.bind(null, m.id)} className="grid gap-3">
            <fieldset>
              <legend className="label mb-1.5">Woher kommt das Material?</legend>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MATERIAL_ORIGINS).map(([k, o]) => (
                  <label key={k} className={chip}>
                    <input type="radio" name="origin" value={k} defaultChecked={origin === k} required className="accent-[var(--accent)]" />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">
                <span className="label">Quelle (Buch, Website, Schule)</span>
                <input className="input" name="name" defaultValue={rule.source && origin !== "eigen" ? rule.source.name : ""} maxLength={160} />
              </label>
              <label className="field">
                <span className="label">Autor oder Verlag</span>
                <input className="input" name="author" defaultValue={rule.source?.author ?? ""} maxLength={160} />
              </label>
              <label className="field">
                <span className="label">Lizenz</span>
                <input className="input" name="license" defaultValue={rule.source && origin !== "eigen" ? rule.source.license : ""} maxLength={80} placeholder="z. B. CC BY 4.0" />
              </label>
              <label className="field">
                <span className="label">Link (optional)</span>
                <input className="input" name="url" type="url" defaultValue={rule.source?.url ?? ""} maxLength={500} placeholder="https://" />
              </label>
            </div>
            <label className="field">
              <span className="label">Namensnennung (optional)</span>
              <input className="input" name="attribution" defaultValue={rule.source?.attribution_text ?? ""} maxLength={400} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn btn-secondary">Herkunft speichern</button>
              {rule.source && (
                <span className={`inline-flex items-center gap-1.5 text-[13px] ${rule.allowed ? "text-green" : "text-amber"}`}>
                  <ShieldCheck size={15} aria-hidden /> {rule.reason}
                </span>
              )}
            </div>
          </form>
        </section>

        <section id="erkennung" aria-label="Erkennung" className="scroll-mt-24">
          <SectionTitle>
            <span>
              Erkennung
              <Info label="Was passiert bei der Erkennung?">
                Optional. Claude bekommt die Datei und die Liste der Fähigkeiten, nicht deinen Namen und keine Schülerdaten. Zurück kommen Vorschläge für Fach, Thema, Fähigkeiten und Aufgaben. Gespeichert wird nur, was du selbst übernimmst.
              </Info>
            </span>
          </SectionTitle>
          {!aiEnabled() ? (
            <p className="text-[14px] text-ink-2">Ohne KI-Schlüssel kommen die Vorschläge für Fähigkeiten aus dem Thema. Die Erkennung von Aufgaben ist möglich, sobald ein Schlüssel hinterlegt ist.</p>
          ) : tooBig ? (
            <p className="text-[14px] text-ink-2">Für die Erkennung ist die Datei zu groß (Foto höchstens 5 MB, PDF höchstens 10 MB).</p>
          ) : (
            <form action={analyzeMaterialAction.bind(null, m.id)} className="grid gap-3">
              <label className="flex min-h-[44px] items-start gap-2 text-[14px]">
                <input type="checkbox" name="keine_namen" value="1" required className="mt-1 accent-[var(--accent)]" />
                Auf dem Material stehen keine Namen, Noten oder anderen persönlichen Angaben.
              </label>
              <div>
                <button className="btn btn-secondary">
                  <Sparkles size={15} aria-hidden /> {a ? "Noch einmal erkennen" : "Mit Claude erkennen"}
                </button>
              </div>
            </form>
          )}
          {a && <Suggestion m={m} names={byId} />}
        </section>
      </div>

      <section id="uebernehmen" aria-label="Aufgabe in die Bibliothek" className="mb-10 max-w-[760px] scroll-mt-24">
        <SectionTitle>Aufgabe in die Bibliothek</SectionTitle>
        {taken.length > 0 && (
          <ul className="mb-4 flex flex-wrap gap-2">
            {taken.map((t) => (
              <li key={t.id}>
                <Link href={`/uebungen/bibliothek/${t.id}`} className="inline-flex min-h-[40px] items-center rounded-full border border-line bg-surface px-3 text-[13.5px] hover:border-accent">
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!m.subject ? (
          <p className="text-[14px] text-ink-2">Zuerst oben das Fach eintragen.</p>
        ) : !rule.source ? (
          <p className="text-[14px] text-ink-2">
            Zuerst <a href="#herkunft" className="link">Herkunft und Lizenz</a> angeben.
          </p>
        ) : (
          <Reveal label={taken.length ? "Noch eine Aufgabe übernehmen" : "Aufgabe abtippen und übernehmen"}>
            <TakeoverForm m={m} allowed={rule.allowed} skills={ofSubject} />
          </Reveal>
        )}
      </section>

      <div className="border-t border-line pt-6">
        <details className="reveal">
          <summary>
            <Trash2 size={15} aria-hidden className="text-red" /> Material löschen
          </summary>
          <form action={deleteMaterialAction.bind(null, m.id)} className="pt-2">
            <p className="mb-2 text-[13px] text-ink-2">Die Datei wird gelöscht. Aufgaben, die schon in der Bibliothek sind, bleiben mit ihrer Herkunft erhalten.</p>
            <button className="btn btn-danger">Endgültig löschen</button>
          </form>
        </details>
      </div>
    </>
  );
}

/** What Claude suggested; only shown, nothing of it is saved until the teacher takes it over. */
function Suggestion({ m, names }: { m: Material; names: Map<string, repo.Skill> }) {
  const a = m.analysis!;
  const rule = takeoverRule(m);
  const skills = repo.listSkills().filter((s) => s.subject === m.subject);
  return (
    <div className="mt-5 grid gap-3 rounded-[18px] border border-line bg-paper px-4 py-4">
      <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
        <Pill tone="accent">
          <Sparkles size={11} aria-hidden /> Vorschlag
        </Pill>
        {m.analyzed_at && formatDate(m.analyzed_at)}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
        <dt className="text-ink-3">Fach</dt>
        <dd>{a.subject ?? "–"}</dd>
        <dt className="text-ink-3">Thema</dt>
        <dd>{a.topic ?? "–"}</dd>
        <dt className="text-ink-3">Fähigkeiten</dt>
        <dd>{a.skill_ids.map((id) => names.get(id)?.name ?? id).join(", ") || "–"}</dd>
        {a.notes && (
          <>
            <dt className="text-ink-3">Hinweis</dt>
            <dd>{a.notes}</dd>
          </>
        )}
      </dl>
      {a.tasks.length > 0 && (
        <div className="grid gap-2">
          <p className="text-[13px] font-semibold text-ink-2">{a.tasks.length === 1 ? "1 erkannte Aufgabe" : `${a.tasks.length} erkannte Aufgaben`}</p>
          {a.tasks.map((t, i) => (
            <Reveal key={i} label={<span className="line-clamp-1 text-left">{t.prompt}</span>}>
              {m.subject && rule.source ? (
                <TakeoverForm m={m} allowed={rule.allowed} skills={skills} initial={{ prompt: t.prompt, answers: t.answer ?? "", solution: t.solution ?? "", skillId: t.skill_id ?? "" }} />
              ) : (
                <p className="text-[13px] text-ink-2">{t.prompt}</p>
              )}
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

/** One task to take over: the teacher checks (and for reference sources rewrites) it first. */
function TakeoverForm({ m, allowed, skills, initial }: { m: Material; allowed: boolean; skills: repo.Skill[]; initial?: { prompt: string; answers: string; solution: string; skillId: string } }) {
  return (
    <form action={takeOverTaskAction.bind(null, m.id)} className="grid gap-3 pt-2">
      <label className="field">
        <span className="label">Aufgabenstellung</span>
        <textarea className="input min-h-[96px]" name="prompt" defaultValue={initial?.prompt} required maxLength={4000} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span className="label">Richtige Antwort(en), mit ; getrennt</span>
          <input className="input" name="answers" defaultValue={initial?.answers} placeholder="leer: frei beantworten" />
        </label>
        <label className="field">
          <span className="label">Fähigkeit</span>
          <select className="input" name="skill_id" defaultValue={initial?.skillId ?? m.skill_ids[0] ?? ""}>
            <option value="">–</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.area} › {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="label">Lösungsweg</span>
        <textarea className="input min-h-[72px]" name="solution" defaultValue={initial?.solution} maxLength={4000} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span className="label">Schwierigkeit</span>
          <select className="input" name="difficulty" defaultValue="mittel">
            {DIFFICULTIES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Tags (mit Komma getrennt)</span>
          <input className="input" name="tags" placeholder="z. B. Schularbeit" />
        </label>
      </div>
      <label className="flex min-h-[44px] items-start gap-2 text-[14px]">
        <input type="checkbox" name="reviewed" value="1" required className="mt-1 accent-[var(--accent)]" />
        Ich habe Aufgabe, Antwort und Lösung geprüft.
      </label>
      {!allowed && (
        <label className="flex min-h-[44px] items-start gap-2 text-[14px]">
          <input type="checkbox" name="own_words" value="1" required className="mt-1 accent-[var(--accent)]" />
          Die Aufgabe ist in meinen eigenen Worten (andere Zahlen, anderer Text), nicht abgeschrieben.
        </label>
      )}
      <div>
        <button className="btn btn-primary">In die Bibliothek</button>
      </div>
    </form>
  );
}
