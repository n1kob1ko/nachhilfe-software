import Link from "next/link";
import { FileUp, Plus, Search, Sparkles, X } from "lucide-react";
import { createLernpaketAction, importLernpaketAction } from "@/app/lernpaket-actions";
import { subjectTone } from "@/components/Calendar";
import { LernpaketKiForm } from "@/components/LernpaketKiForm";
import { StatusPill } from "@/components/LernpaketStatus";
import { Empty, PageHeader, Pill } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { DIFFICULTIES } from "@/lib/curriculum";
import { KI_DAUER, kiAusGrund, kostenSchaetzung } from "@/lib/lernpaket-ki";
import { lernpaketFacetten, listLernpakete, PAKET_STATUS, type PaketStatus } from "@/lib/lernpakete";
import * as repo from "@/lib/repo";
import { fachVorschlaege, klassenLabel, SCHOOL_TYPES } from "@/lib/school";

export const metadata = { title: "Lernpakete" };

type Params = { q?: string; status?: string; fach?: string; stufe?: string; thema?: string; skill?: string; neu?: string; import?: string; ki?: string; fehler?: string } & KiParams;
/** „Mit KI entwerfen“ ausgefüllt aus „Kein Paket für …“ (lib/vorbereitung-auto.ts `kiHref`) */
type KiParams = { ki_skill?: string; ki_fach?: string; ki_thema?: string; ki_schulart?: string; ki_klasse?: string; ki_dauer?: string };
const KEYS = ["q", "status", "fach", "stufe", "thema", "skill"] as const;
const FILTER = ["fach", "stufe", "thema", "skill"] as const;
const LP = "/mehr/lernpakete";
const href = (p: Partial<Params>) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return q ? `${LP}?${q}` : LP;
};
const isStatus = (s: string | undefined): s is PaketStatus => Boolean(s && Object.hasOwn(PAKET_STATUS, s));

/**
 * Lernpakete: prepared lessons per topic, for many students. Filters by Fach, Schulart und Klasse, Thema and
 * Fähigkeit; status chips on top. New ones are written here, imported as a JSON file or drafted by the KI
 * (lib/lernpaket-ki.ts).
 */
export default async function LernpaketePage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireTeacher();
  const sp = await searchParams;
  const [schulart, klasse] = (sp.stufe ?? "").split("|");
  const status = isStatus(sp.status) ? sp.status : undefined;
  const list = listLernpakete({ q: sp.q, status, fach: sp.fach, schulart: schulart || undefined, klasse: Number(klasse) || null, thema: sp.thema, skillId: sp.skill });
  const f = lernpaketFacetten();
  const skills = repo.listSkills();
  const skillName = (id: string) => skills.find((s) => s.id === id)?.name ?? repo.getSkill(id)?.name ?? id;
  const subjects = [...new Set(skills.map((s) => s.subject))];
  const current: Partial<Params> = Object.fromEntries(KEYS.map((k) => [k, sp[k]]).filter(([, v]) => v));
  const active = FILTER.filter((k) => sp[k]);
  const label = (k: (typeof FILTER)[number], v: string) =>
    k === "stufe" ? klassenLabel(v.split("|")[0], Number(v.split("|")[1]) || null, { short: true }) || v.split("|")[0] : k === "skill" ? skillName(v) : v;
  const fehler = sp.fehler?.split("\n").filter(Boolean) ?? [];
  const offen = sp.neu ? "neu" : sp.import ? "import" : sp.ki ? "ki" : null;
  const skillLabel = (s: repo.Skill) => (s.parent_id ? `${skillName(s.parent_id)} › ${s.name}` : s.name);
  const gruppen = subjects.flatMap((subject) =>
    [...new Set(skills.filter((s) => s.subject === subject).map((s) => s.area))].map((area) => ({
      label: `${subject} › ${area}`,
      skills: skills.filter((s) => s.subject === subject && s.area === area).map((s) => ({ id: s.id, label: skillLabel(s) })),
    })),
  );
  const aktiv = f.status.entwurf + f.status.geprueft;
  const kiVorgabe =
    sp.ki_skill || sp.ki_fach || sp.ki_thema
      ? {
          skillId: sp.ki_skill && repo.getSkill(sp.ki_skill) ? sp.ki_skill : undefined,
          fach: sp.ki_fach?.slice(0, 60),
          thema: sp.ki_thema?.slice(0, 120),
          schulart: SCHOOL_TYPES.some((t) => t.name === sp.ki_schulart) ? sp.ki_schulart : undefined,
          klasse: Number(sp.ki_klasse) >= 1 && Number(sp.ki_klasse) <= 8 ? Number(sp.ki_klasse) : null,
          dauer: Number(sp.ki_dauer) >= KI_DAUER.von && Number(sp.ki_dauer) <= KI_DAUER.bis ? Number(sp.ki_dauer) : undefined,
        }
      : null;

  return (
    <>
      <PageHeader
        back={{ href: "/mehr", label: "Mehr" }}
        title="Lernpakete"
        info="Eine vorbereitete Einheit zu einem Thema, für viele Schüler: Ablauf mit Minuten, was du sagst und fragst, erwartete Antworten, was bei Fehlern hilft, Aufgaben mit Lösungen. Importierte und von der KI entworfene Pakete sind ungeprüft, bis du sie durchgehst und „Geprüft“ tippst."
        actions={
          <>
            <Link href={offen === "ki" ? href(current) : href({ ...current, ki: "1" })} className={`btn ${offen === "ki" ? "btn-primary" : "btn-secondary"}`}>
              <Sparkles size={16} aria-hidden /> Mit KI entwerfen
            </Link>
            <Link href={offen === "import" ? href(current) : href({ ...current, import: "1" })} className={`btn ${offen === "import" ? "btn-primary" : "btn-secondary"}`}>
              <FileUp size={16} aria-hidden /> Importieren
            </Link>
            <Link href={offen === "neu" ? href(current) : href({ ...current, neu: "1" })} className={`btn ${offen === "neu" ? "btn-secondary" : "btn-primary"}`}>
              <Plus size={16} aria-hidden /> Neues Lernpaket
            </Link>
          </>
        }
      />
      {fehler.length > 0 && (
        <div className="mb-4 rounded-lg bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
          <p className="font-semibold">{offen === "import" ? "Die Datei wurde nicht importiert:" : "Bitte korrigieren:"}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {fehler.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {offen === "ki" && (
        <LernpaketKiForm
          gruppen={gruppen}
          faecher={fachVorschlaege()}
          schularten={SCHOOL_TYPES.map((t) => t.name)}
          schwierigkeiten={DIFFICULTIES}
          dauer={KI_DAUER}
          kiAus={kiAusGrund()}
          kosten={kostenSchaetzung().text}
          vorgabe={kiVorgabe}
        />
      )}

      {offen === "import" && (
        <form action={importLernpaketAction} className="panel mb-8 grid max-w-[760px] gap-3 px-5 py-4">
          <label className="field">
            <span className="label">Datei (JSON, Format „lernheft-lernpaket“, Version 1)</span>
            <input className="input" type="file" name="datei" accept=".json,application/json" required />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary">
              <FileUp size={16} aria-hidden /> Importieren
            </button>
            <span className="text-[13px] text-ink-3">Das Paket kommt als Entwurf und bleibt „Ungeprüft“, bis du es geprüft hast.</span>
          </div>
        </form>
      )}

      {offen === "neu" && (
        <form action={createLernpaketAction} className="panel mb-8 grid max-w-[760px] gap-3 px-5 py-4 sm:grid-cols-2">
          <label className="field sm:col-span-2">
            <span className="label">Titel</span>
            <input className="input" name="title" required maxLength={120} placeholder="z. B. Die vier Fälle" />
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
                          {skillLabel(s)}
                        </option>
                      ))}
                  </optgroup>
                )),
              )}
            </select>
          </label>
          <label className="field">
            <span className="label">Fach (ohne Fähigkeit)</span>
            <input className="input" name="fach" list="lp-faecher" maxLength={60} autoComplete="off" placeholder="z. B. Biologie" />
            <datalist id="lp-faecher">
              {fachVorschlaege().map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="label">Dauer in Minuten</span>
            <input className="input num" type="number" name="dauer_minuten" min={1} max={300} defaultValue={50} required />
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
          <label className="field">
            <span className="label">Schwierigkeit</span>
            <select className="input" name="schwierigkeit" defaultValue="mittel">
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="field sm:col-span-2">
            <span className="label">Ziel (optional)</span>
            <textarea className="input" name="ziel" rows={2} maxLength={1000} placeholder="Was kann der Schüler am Ende?" />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn btn-primary">Anlegen und Schritte schreiben</button>
          </div>
        </form>
      )}

      {f.gesamt === 0 ? (
        <Empty title="Noch keine Lernpakete">
          Oben ein neues Lernpaket anlegen, mit der KI entwerfen oder eine Datei im Format „lernheft-lernpaket“ importieren.
        </Empty>
      ) : (
        <>
          <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Status">
            {(
              [
                ["", "Alle", aktiv],
                ["entwurf", "Entwurf", f.status.entwurf],
                ["geprueft", "Geprüft", f.status.geprueft],
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

          <form className="mb-3 grid gap-3" role="search" action={LP}>
            {status && <input type="hidden" name="status" value={status} />}
            <div className="flex max-w-[560px] gap-2">
              <input className="input" type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Titel, Thema oder Ziel" aria-label="Lernpakete durchsuchen" />
              <button className="btn btn-secondary">
                <Search size={15} aria-hidden /> Suchen
              </button>
            </div>
            <details className="reveal" open={active.length > 0 || undefined}>
              <summary>Filter{active.length > 0 && ` (${active.length})`}</summary>
              <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-5">
                <FilterSelect name="fach" label="Fach" value={sp.fach} options={f.faecher.map((v) => [v, v])} />
                <FilterSelect name="stufe" label="Schulart und Klasse" value={sp.stufe} options={f.stufen.map((v) => [v, label("stufe", v)])} />
                <FilterSelect name="thema" label="Thema" value={sp.thema} options={f.themen.map((v) => [v, v])} />
                <FilterSelect name="skill" label="Fähigkeit" value={sp.skill} options={f.skills.map((v) => [v, skillName(v)])} />
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
            <span className="num">{list.length}</span> {list.length === 1 ? "Lernpaket" : "Lernpakete"}
          </p>
          <ul className="panel divide-y divide-line">
            {list.map((p) => {
              const t = subjectTone(p.fach);
              return (
                <li key={p.id}>
                  <Link href={`${LP}/${p.id}`} className="group block px-4 py-3">
                    <p className="font-medium group-hover:text-accent">{p.title}</p>
                    {p.ziel && <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-2">{p.ziel}</p>}
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                      <span className="rounded-full px-2.5 py-0.5 font-semibold" style={{ background: t.soft, color: t.fg }}>
                        {p.fach}
                        {p.klasse ? ` · ${klassenLabel(p.schulart, p.klasse, { short: true })}` : p.schulart ? ` · ${p.schulart}` : ""}
                      </span>
                      {p.thema && <Pill>{p.thema}</Pill>}
                      <Pill>
                        <span className="num">{p.minuten_summe}</span> min · <span className="num">{p.schritt_zahl}</span> {p.schritt_zahl === 1 ? "Schritt" : "Schritte"}
                      </Pill>
                      <StatusPill p={p} />
                    </span>
                  </Link>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-5 py-6 text-[14px] text-ink-3">Keine Lernpakete zu diesem Filter.</li>}
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
