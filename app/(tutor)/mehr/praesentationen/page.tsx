import Link from "next/link";
import { Search, ShieldAlert, Upload, X } from "lucide-react";
import { subjectTone } from "@/components/Calendar";
import { Empty, PageHeader, Pill } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { DIFFICULTIES } from "@/lib/curriculum";
import { listPraesentationen, praesentationFacetten, praesUngeprueft, type PraesStatus } from "@/lib/praesentationen";
import { GRENZEN } from "@/lib/praesentation-zip";
import * as repo from "@/lib/repo";
import { fachVorschlaege, klassenLabel, SCHOOL_TYPES } from "@/lib/school";

export const metadata = { title: "Präsentationen" };

type Params = { q?: string; status?: string; fach?: string; stufe?: string; thema?: string; skill?: string; schwierigkeit?: string; neu?: string; fehler?: string };
const KEYS = ["q", "status", "fach", "stufe", "thema", "skill", "schwierigkeit"] as const;
const FILTER = ["fach", "stufe", "thema", "skill", "schwierigkeit"] as const;
const PR = "/mehr/praesentationen";
const href = (p: Partial<Params>) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return q ? `${PR}?${q}` : PR;
};
const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString("de-AT", { maximumFractionDigits: 1 })} MB`;

/**
 * Präsentationen: animated HTML presentations with a Vortragstext per slide, filtered like the Lernpakete.
 * New ones come as one HTML file or a ZIP (claude.ai, reveal.js, iSpring, Articulate …).
 */
export default async function PraesentationenPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireTeacher();
  const sp = await searchParams;
  const [schulart, klasse] = (sp.stufe ?? "").split("|");
  const status: PraesStatus | undefined = sp.status === "archiviert" ? "archiviert" : undefined;
  const list = listPraesentationen({ q: sp.q, status, fach: sp.fach, schulart: schulart || undefined, klasse: Number(klasse) || null, thema: sp.thema, skillId: sp.skill, schwierigkeit: sp.schwierigkeit });
  const f = praesentationFacetten();
  const skills = repo.listSkills();
  const skillName = (id: string) => skills.find((s) => s.id === id)?.name ?? repo.getSkill(id)?.name ?? id;
  const subjects = [...new Set(skills.map((s) => s.subject))];
  const current: Partial<Params> = Object.fromEntries(KEYS.map((k) => [k, sp[k]]).filter(([, v]) => v));
  const active = FILTER.filter((k) => sp[k]);
  const label = (k: (typeof FILTER)[number], v: string) =>
    k === "stufe" ? klassenLabel(v.split("|")[0], Number(v.split("|")[1]) || null, { short: true }) || v.split("|")[0] : k === "skill" ? skillName(v) : v;
  const fehler = sp.fehler?.split("\n").filter(Boolean) ?? [];
  const offen = Boolean(sp.neu);

  return (
    <>
      <PageHeader
        back={{ href: "/mehr", label: "Mehr" }}
        title="Präsentationen"
        info="Präsentationen mit Animationen und Vortragstext je Folie. Du siehst Folie und Text, der Schüler nur die Folien. Hochladen als HTML-Datei oder ZIP-Datei (z. B. aus claude.ai, reveal.js, iSpring oder Articulate). PowerPoint geht als PDF unter Material, dann ohne Animationen."
        actions={
          <Link href={offen ? href(current) : href({ ...current, neu: "1" })} className={`btn ${offen ? "btn-secondary" : "btn-primary"}`}>
            <Upload size={16} aria-hidden /> Hochladen
          </Link>
        }
      />
      {fehler.length > 0 && (
        <div className="mb-4 rounded-lg bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
          <p className="font-semibold">Die Präsentation wurde nicht gespeichert:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {fehler.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {offen && (
        <form action="/material/praesentation" method="post" encType="multipart/form-data" className="panel mb-8 grid max-w-[760px] gap-3 px-5 py-4 sm:grid-cols-2">
          <label className="field sm:col-span-2">
            <span className="label">Datei: HTML oder ZIP (höchstens {GRENZEN.upload / 1024 / 1024} MB)</span>
            <input className="input" type="file" name="datei" accept=".html,.htm,.zip,.pdf,text/html,application/zip,application/pdf" required />
            <span className="text-[13px] text-ink-3">
              In der ZIP-Datei höchstens {GRENZEN.dateien} Dateien und {GRENZEN.gesamt / 1024 / 1024} MB ausgepackt: Webseiten, Styles, Skripte, Bilder, Schriften, Audio und Video. Vortragstext kann als
              „lernheft-notizen.json“ mitkommen. Ein PDF kommt ohne Animationen unter Material.
            </span>
          </label>
          <label className="field sm:col-span-2">
            <span className="label">Titel (sonst der Dateiname)</span>
            <input className="input" name="title" maxLength={120} placeholder="z. B. Die vier Fälle" />
          </label>
          <label className="field sm:col-span-2">
            <span className="label">Fähigkeit (bestimmt Fach und Thema)</span>
            <select className="input" name="skill_id" defaultValue="">
              <option value="">Ohne Fähigkeit (dann Fach angeben)</option>
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
            <span className="label">Fach (ohne Fähigkeit)</span>
            <input className="input" name="fach" list="pr-faecher" maxLength={60} autoComplete="off" placeholder="z. B. Biologie" />
            <datalist id="pr-faecher">
              {fachVorschlaege().map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="label">Schwierigkeit</span>
            <select className="input" name="schwierigkeit" defaultValue="mittel">
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Schulart (optional)</span>
            <select className="input" name="schulart" defaultValue="">
              <option value="">jede</option>
              {SCHOOL_TYPES.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Klasse (optional)</span>
            <select className="input" name="klasse" defaultValue="">
              <option value="">jede</option>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((k) => (
                <option key={k} value={k}>
                  {k}.
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn btn-primary">
              <Upload size={16} aria-hidden /> Hochladen
            </button>
          </div>
        </form>
      )}

      {f.gesamt === 0 ? (
        <Empty title="Noch keine Präsentationen">Oben eine HTML-Datei oder ZIP-Datei hochladen. Die Animationen bleiben erhalten.</Empty>
      ) : (
        <>
          <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Status">
            {(
              [
                ["", "Alle", f.status.aktiv],
                ["archiviert", "Archiviert", f.status.archiviert],
              ] as const
            ).map(([k, l, n]) => (
              <Link
                key={k || "alle"}
                href={href({ ...current, status: k })}
                aria-current={(status ?? "") === k ? "true" : undefined}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-[14px] font-medium ${(status ?? "") === k ? "bg-accent text-on-fill" : "bg-panel text-ink-2 hover:text-ink"}`}
              >
                {l} <span className="num opacity-75">{n}</span>
              </Link>
            ))}
          </nav>

          <form className="mb-3 grid gap-3" role="search" action={PR}>
            {status && <input type="hidden" name="status" value={status} />}
            <div className="flex max-w-[560px] gap-2">
              <input className="input" type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Titel, Thema oder Beschreibung" aria-label="Präsentationen durchsuchen" />
              <button className="btn btn-secondary">
                <Search size={15} aria-hidden /> Suchen
              </button>
            </div>
            <details className="reveal" open={active.length > 0 || undefined}>
              <summary>Filter{active.length > 0 && ` (${active.length})`}</summary>
              <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                <FilterSelect name="fach" label="Fach" value={sp.fach} options={f.faecher.map((v) => [v, v])} />
                <FilterSelect name="stufe" label="Schulart und Klasse" value={sp.stufe} options={f.stufen.map((v) => [v, label("stufe", v)])} />
                <FilterSelect name="thema" label="Thema" value={sp.thema} options={f.themen.map((v) => [v, v])} />
                <FilterSelect name="skill" label="Fähigkeit" value={sp.skill} options={f.skills.map((v) => [v, skillName(v)])} />
                <FilterSelect name="schwierigkeit" label="Schwierigkeit" value={sp.schwierigkeit} options={DIFFICULTIES.filter((d) => f.schwierigkeiten.includes(d)).map((v) => [v, v])} />
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

          <p className="mb-2 text-[13px] text-ink-3">
            <span className="num">{list.length}</span> {list.length === 1 ? "Präsentation" : "Präsentationen"}
          </p>
          <ul className="panel divide-y divide-line">
            {list.map((p) => {
              const t = subjectTone(p.fach);
              const notizen = Object.keys(p.notizen).length;
              return (
                <li key={p.id}>
                  <Link href={`${PR}/${p.id}`} className="group block px-4 py-3">
                    <p className="font-medium group-hover:text-accent">{p.title}</p>
                    {p.beschreibung && <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-2">{p.beschreibung}</p>}
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                      <span className="rounded-full px-2.5 py-0.5 font-semibold" style={{ background: t.soft, color: t.fg }}>
                        {p.fach}
                        {p.klasse ? ` · ${klassenLabel(p.schulart, p.klasse, { short: true })}` : p.schulart ? ` · ${p.schulart}` : ""}
                      </span>
                      {p.thema && <Pill>{p.thema}</Pill>}
                      <Pill>{p.schwierigkeit}</Pill>
                      <Pill>
                        Vortragstext zu <span className="num">{notizen}</span> {notizen === 1 ? "Folie" : "Folien"}
                      </Pill>
                      {p.quelle === "ki" && <Pill>mit KI erstellt</Pill>}
                      {praesUngeprueft(p) && (
                        <Pill tone="amber" title="Von der KI erstellt und noch von niemandem geprüft">
                          <ShieldAlert size={12} aria-hidden /> Ungeprüft
                        </Pill>
                      )}
                      <span className="num text-ink-3">{mb(p.groesse)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-5 py-6 text-[14px] text-ink-3">Keine Präsentationen zu diesem Filter.</li>}
          </ul>
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
