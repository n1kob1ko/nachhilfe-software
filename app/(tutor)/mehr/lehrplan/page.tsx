import Link from "next/link";
import { CheckCircle2, ExternalLink, FileJson, XCircle } from "lucide-react";
import { applyImportAction, discardImportAction, previewImportAction, removeDemoAction, setThresholdsAction } from "@/app/curriculum-actions";
import { Info } from "@/components/Info";
import { PageHeader, Pill, Reveal, SectionTitle, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { bundledPackages, getImport, listImports, type Diff } from "@/lib/curriculum-import";
import { curriculumOverview, examThresholds, listSources, SOURCE_TYPE_LABEL, taskBankAllowed, type SourceType } from "@/lib/lehrplan";
import { rangeLabel } from "@/lib/school";

export const metadata = { title: "Lehrplan" };

const TABS = [
  ["uebersicht", "Übersicht"],
  ["quellen", "Quellen"],
  ["importe", "Importe"],
  ["lizenzen", "Lizenzen"],
  ["einstellungen", "Einstellungen"],
] as const;
const TYPE_TONE: Record<SourceType, "green" | "accent" | "neutral" | "amber" | "red"> = { lehrplan: "green", eigen: "accent", ki: "neutral", oer: "neutral", referenz: "amber", demo: "red" };

/** Mehr › Lehrplan: curriculum versions per school type, sources, imports, licences, reminder settings. */
export default async function CurriculumPage({ searchParams }: { searchParams: Promise<{ tab?: string; vorschau?: string; importiert?: string; fehler?: string; gespeichert?: string }> }) {
  const teacher = await requireTeacher();
  const sp = await searchParams;
  const tab = TABS.find(([k]) => k === sp.tab)?.[0] ?? "uebersicht";
  const admin = Boolean(teacher.is_admin);
  return (
    <>
      <PageHeader
        title="Lehrplan"
        back={{ href: "/mehr", label: "Mehr" }}
        info="Österreichische Lehrpläne, Quellen und Lizenzen. Fähigkeiten und Lernstand bauen darauf auf. Lehrplandaten kommen nur aus geprüften Quellen und werden mit Vorschau importiert."
      />
      <nav className="no-print mb-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-panel p-1" aria-label="Bereiche">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/mehr/lehrplan?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={`flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-medium whitespace-nowrap ${tab === key ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {sp.fehler && <p className="mb-6 rounded-lg bg-red-wash px-4 py-3 text-[14px] text-red">{sp.fehler}</p>}
      {tab === "uebersicht" && <Overview />}
      {tab === "quellen" && <Sources />}
      {tab === "importe" && <Imports admin={admin} previewId={Number(sp.vorschau) || null} importedId={Number(sp.importiert) || null} />}
      {tab === "lizenzen" && <Licences />}
      {tab === "einstellungen" && <Settings admin={admin} saved={Boolean(sp.gespeichert)} />}
    </>
  );
}

function Overview() {
  const rows = curriculumOverview();
  return (
    <div className="grid max-w-[920px] gap-4">
      <p className="text-[15px] text-ink-2">
        <span className="font-semibold text-ink">Österreich</span> · Schulstufen 1–13 · intern wird jede Klasse auf die Schulstufe abgebildet (2. Klasse Mittelschule = Schulstufe 6).
      </p>
      {rows.map((r) => (
        <section key={r.schoolType} className="panel px-5 py-4" aria-label={r.schoolType}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-semibold">
              {r.short} · {r.schoolType}
            </h2>
            <span className="num text-[13px] text-ink-2">
              Schulstufe {r.stufen[0]}–{r.stufen[1]} · {rangeLabel(r.stufen[0], r.stufen[1])}
            </span>
          </div>
          <div className="mt-2 grid gap-1 text-[14px]">
            {r.source ? (
              <p>
                <a href={r.source.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 font-medium">
                  {r.source.name} <ExternalLink size={13} aria-hidden />
                </a>
                <span className="text-ink-2"> · {r.source.attribution_text}</span>
              </p>
            ) : (
              <p className="text-ink-3">Offizielle Quelle noch nicht hinterlegt.</p>
            )}
            {r.curricula.length ? (
              r.curricula.map((c) => (
                <p key={c.key} className="text-ink-2">
                  {c.subject}: {c.name} · Version {c.version} · <span className="num">{c.nodes}</span> Einträge
                </p>
              ))
            ) : (
              <p className="text-amber">Lehrplantext noch nicht importiert.</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.skills.map((s) => (
              <Pill key={s.subject}>
                {s.subject} <span className="num">{s.count}</span> Fähigkeiten
              </Pill>
            ))}
            {r.skills.length === 0 && <span className="text-[13px] text-ink-3">noch keine Fähigkeiten für diese Schulstufen</span>}
          </div>
        </section>
      ))}
    </div>
  );
}

function Sources() {
  const sources = listSources();
  return (
    <ul className="panel grid max-w-[920px] divide-y divide-line">
      {sources.map((s) => {
        const bank = taskBankAllowed(s);
        return (
          <li key={s.id} className="px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{s.name}</span>
              <Pill tone={TYPE_TONE[s.source_type]}>{SOURCE_TYPE_LABEL[s.source_type]}</Pill>
              {s.url && (
                <a href={s.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-[13px]" aria-label={`${s.name} öffnen`}>
                  Quelle <ExternalLink size={12} aria-hidden />
                </a>
              )}
            </div>
            <p className="mt-0.5 text-[13px] text-ink-2">
              Lizenz: {s.license || "–"} · {bank.ok ? "darf in die Aufgabenbank" : bank.reason}
              {(s.skills > 0 || s.tasks > 0) && (
                <span className="num">
                  {" "}
                  · {s.skills} Fähigkeiten · {s.tasks} Aufgaben
                </span>
              )}
            </p>
            {(s.notes || s.attribution_text || s.retrieved_at) && (
              <Reveal label="Details">
                <dl className="grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[140px_minmax(0,1fr)]">
                  {(
                    [
                      ["Herausgeber", s.publisher],
                      ["Zitat", s.attribution_text],
                      ["Abgerufen", s.retrieved_at],
                      ["Hinweis", s.notes],
                    ] as [string, string | null][]
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-ink-3">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
              </Reveal>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DiffView({ d }: { d: Diff }) {
  const n = (x: number, label: string) => (
    <div className="rounded-xl bg-panel px-3 py-2">
      <div className="num text-[22px] font-semibold">{x}</div>
      <div className="text-[12.5px] text-ink-2">{label}</div>
    </div>
  );
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {n(d.newTopics.length, "Neue Themen")}
        {n(d.newSkills.length, "Neue Fähigkeiten")}
        {n(d.changedSkills.length, "Geänderte Fähigkeiten")}
        {n(d.unchanged, "Unverändert")}
        {n(d.newNodes, "Neue Lehrplan-Einträge")}
        {n(d.newLinks, "Neue Voraussetzungen")}
        {n(d.duplicates.length, "Dubletten (übersprungen)")}
        {n(d.conflicts.length, "Konflikte (übersprungen)")}
      </div>
      {d.alreadyImported && <p className="text-[14px] font-medium text-amber">Genau dieses Paket wurde schon importiert.</p>}
      {d.errors.map((e) => (
        <p key={e} className="text-[14px] text-red">
          {e}
        </p>
      ))}
      {d.warnings.map((e) => (
        <p key={e} className="text-[14px] text-amber">
          {e}
        </p>
      ))}
      {d.newTopics.length > 0 && <Reveal label="Neue Themen">{d.newTopics.join(" · ")}</Reveal>}
      {d.changedSkills.length > 0 && (
        <Reveal label="Was sich ändert">
          <ul className="text-[13px]">
            {d.changedSkills.map((c) => (
              <li key={c.id}>
                {c.id}: {c.fields.join(", ")}
              </li>
            ))}
          </ul>
        </Reveal>
      )}
      {(d.duplicates.length > 0 || d.conflicts.length > 0) && (
        <Reveal label="Übersprungen">
          <ul className="text-[13px]">
            {d.duplicates.map((x) => (
              <li key={x.id}>
                {x.id}: gibt es schon als {x.existing}
              </li>
            ))}
            {d.conflicts.map((x) => (
              <li key={x.id}>
                {x.id}: {x.reason}
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}

function Imports({ admin, previewId, importedId }: { admin: boolean; previewId: number | null; importedId: number | null }) {
  const packages = bundledPackages();
  const preview = previewId ? getImport(previewId) : null;
  const done = importedId ? getImport(importedId) : null;
  const history = listImports(15);
  const demo = listSources().find((s) => s.source_type === "demo");
  return (
    <div className="grid max-w-[920px] gap-10">
      {done && (
        <p className="flex items-center gap-2 rounded-lg bg-green-wash px-4 py-3 text-[14px] text-green">
          <CheckCircle2 size={16} aria-hidden /> „{done.label}“ importiert: {done.diff.newSkills.length} neue, {done.diff.changedSkills.length} geänderte Fähigkeiten.
        </p>
      )}
      {preview && (
        <section className="panel px-5 py-5" aria-label="Vorschau">
          <SectionTitle>Vorschau: {preview.label}</SectionTitle>
          <DiffView d={preview.diff} />
          {preview.status === "vorschau" && admin && !preview.diff.alreadyImported && preview.diff.errors.length === 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={applyImportAction.bind(null, preview.id)}>
                <button className="btn btn-primary">Importieren</button>
              </form>
              <form action={discardImportAction.bind(null, preview.id)}>
                <button className="btn btn-ghost">Verwerfen</button>
              </form>
            </div>
          )}
          {preview.status !== "vorschau" && <p className="mt-3 text-[14px] text-ink-2">Status: {preview.status}</p>}
        </section>
      )}

      <section>
        <SectionTitle>
          <span>
            Pakete
            <Info label="Was ist ein Paket?">
              Eine JSON-Datei im Format „lernheft-curriculum/1“ mit Quelle, Lehrplan-Einträgen und Fähigkeiten. Vor dem Import siehst du immer eine Vorschau; nichts wird blind überschrieben, frühere Fassungen bleiben gespeichert.
            </Info>
          </span>
        </SectionTitle>
        <ul className="grid gap-3 md:grid-cols-2">
          {packages.map((p) => (
            <li key={p.file} className="panel flex flex-col gap-2 px-4 py-4">
              <div className="flex items-start gap-2">
                <FileJson size={17} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
                <span className="font-semibold">{p.label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Pill tone={TYPE_TONE[p.sourceType]}>{SOURCE_TYPE_LABEL[p.sourceType]}</Pill>
                <Pill>
                  <span className="num">{p.skills}</span> Fähigkeiten
                </Pill>
                {p.nodes > 0 && (
                  <Pill>
                    <span className="num">{p.nodes}</span> Lehrplan-Einträge
                  </Pill>
                )}
                {p.imported && <Pill tone="green">importiert</Pill>}
              </div>
              <Reveal label="Beschreibung">
                <p className="text-[13.5px] text-ink-2">{p.description}</p>
              </Reveal>
              {admin && !p.imported && (
                <form action={previewImportAction} className="mt-auto">
                  <input type="hidden" name="bundled" value={p.file} />
                  <button className="btn btn-secondary">Vorschau</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {demo && admin && (
          <form action={removeDemoAction.bind(null, demo.key)} className="mt-3">
            <button className="btn btn-ghost btn-sm">Demo-Daten entfernen</button>
          </form>
        )}
      </section>

      {admin && (
        <Reveal label="Eigene Datei importieren">
          <form action={previewImportAction} className="panel grid gap-3 px-4 py-4">
            <label className="field">
              <span className="label">JSON-Datei</span>
              <input className="input" type="file" name="file" accept=".json,application/json" />
            </label>
            <label className="field">
              <span className="label">oder JSON einfügen</span>
              <textarea className="input num min-h-[120px] text-[13px]" name="json" placeholder='{"format": "lernheft-curriculum/1", …}' />
            </label>
            <button className="btn btn-secondary justify-self-start">Vorschau</button>
          </form>
        </Reveal>
      )}

      <section>
        <SectionTitle>Verlauf</SectionTitle>
        {history.length === 0 ? (
          <p className="text-[14px] text-ink-3">Noch nichts importiert.</p>
        ) : (
          <ul className="panel divide-y divide-line text-[14px]">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/mehr/lehrplan?tab=importe&vorschau=${h.id}`} className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 hover:bg-panel/60">
                  {h.status === "importiert" ? <CheckCircle2 size={16} className="text-green" aria-hidden /> : h.status === "verworfen" ? <XCircle size={16} className="text-ink-3" aria-hidden /> : <FileJson size={16} className="text-amber" aria-hidden />}
                  <span className="min-w-0 flex-1 font-medium">{h.label}</span>
                  <span className="text-[13px] text-ink-2">{h.status}</span>
                  <span className="num text-[13px] text-ink-3">{formatDate(h.applied_at ?? h.created_at, { day: "numeric", month: "short" })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Licences() {
  const sources = listSources();
  const allowed = sources.filter((s) => taskBankAllowed(s).ok);
  const blocked = sources.filter((s) => !taskBankAllowed(s).ok);
  return (
    <div className="grid max-w-[920px] gap-8">
      <dl className="panel grid gap-x-6 gap-y-2 px-5 py-4 text-[14px] sm:grid-cols-[220px_minmax(0,1fr)]">
        <dt className="font-medium">Darf in die Aufgabenbank</dt>
        <dd>CC0, CC BY, CC BY-SA (Namensnennung, bei SA gleiche Lizenz), eigene Inhalte, geprüfte KI-Aufgaben, amtliche Werke wie Lehrpläne (§ 7 UrhG)</dd>
        <dt className="font-medium">Nie automatisch</dt>
        <dd>NC (nicht kommerziell), ND (keine Bearbeitung), ungeklärte Lizenzen</dd>
        <dt className="font-medium">Nur Referenz</dt>
        <dd>IQS-Aufgabenpools, Matura-Aufgaben, Schulbücher: verlinken und als Orientierung nutzen, nicht kopieren</dd>
      </dl>
      <section>
        <SectionTitle>Kommerziell nutzbar ({allowed.length})</SectionTitle>
        <ul className="flex flex-wrap gap-1.5">
          {allowed.map((s) => (
            <Pill key={s.id} tone="green">
              {s.name} · <span className="num">{s.tasks}</span> Aufgaben
            </Pill>
          ))}
        </ul>
      </section>
      <section>
        <SectionTitle>Nicht in der Aufgabenbank ({blocked.length})</SectionTitle>
        <ul className="grid gap-1 text-[14px]">
          {blocked.map((s) => (
            <li key={s.id}>
              <span className="font-medium">{s.name}</span> <span className="text-ink-2">· {taskBankAllowed(s).reason}</span>
            </li>
          ))}
          {blocked.length === 0 && <li className="text-ink-3">–</li>}
        </ul>
      </section>
    </div>
  );
}

function Settings({ admin, saved }: { admin: boolean; saved: boolean }) {
  const [start, priority, soon] = examThresholds();
  return (
    <form action={setThresholdsAction} className="panel grid max-w-[560px] gap-4 px-5 py-5">
      <p className="font-semibold">Erinnerungen vor Schularbeiten und Tests</p>
      <p className="-mt-2 text-[13.5px] text-ink-2">Erscheinen auf der Startseite und im Schülerprofil, nur in der App.</p>
      {(
        [
          ["start", "Vorbereitung beginnen", start],
          ["priority", "Höhere Priorität", priority],
          ["soon", "Prüfung bald", soon],
        ] as const
      ).map(([name, label, value]) => (
        <label key={name} className="flex items-center justify-between gap-4 text-[15px]">
          {label}
          <span className="flex items-center gap-2">
            <input className="input num w-[84px]" type="number" min={0} max={90} name={name} defaultValue={value} disabled={!admin} />
            <span className="text-ink-2">Tage vorher</span>
          </span>
        </label>
      ))}
      {admin ? <button className="btn btn-primary justify-self-start">Speichern</button> : <p className="text-[13px] text-ink-3">Nur die Verwaltung kann das ändern.</p>}
      {saved && <p className="text-[14px] text-green">Gespeichert.</p>}
    </form>
  );
}
