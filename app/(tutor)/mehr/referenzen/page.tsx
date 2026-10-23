import Link from "next/link";
import { Plus } from "lucide-react";
import { neuerEintragAction } from "@/app/referenz-actions";
import { ReferenzLesen } from "@/components/ReferenzLesen";
import { Empty, PageHeader, Pill } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { formateFuer, listeEintraege, nurAufbau, REFERENZ_FAECHER, REFERENZ_STATUS, referenzLesbar, type ReferenzStatus } from "@/lib/referenz";

export const metadata = { title: "Referenzsammlung" };

const RS = "/mehr/referenzen";
const ersteZeile = (s: string) => s.split("\n").find((z) => z.trim())?.trim() ?? "";

/**
 * Referenzsammlung (lib/referenz.ts): Aufgaben aus PDFs, die ein Lehrer von Hand geladen hat, mit Quelle, Fähigkeit,
 * Format und Lösungserwartung. Nur für Lehrer; geprüfte Einträge gehen als Vorbilder an die KI.
 */
export default async function ReferenzenPage({ searchParams }: { searchParams: Promise<{ fach?: string; status?: string; fehler?: string; geloescht?: string }> }) {
  await requireTeacher();
  const sp = await searchParams;
  const fach = (REFERENZ_FAECHER as readonly string[]).includes(sp.fach ?? "") ? sp.fach : undefined;
  const status = sp.status && Object.hasOwn(REFERENZ_STATUS, sp.status) ? (sp.status as ReferenzStatus) : undefined;
  const liste = listeEintraege({ fach, status });
  const offen = listeEintraege({ status: "ungeprueft" }).length;
  const lesbar = referenzLesbar();
  const skills = new Map(repo.listSkills().map((s) => [s.id, s]));
  const link = (o: { fach?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (o.fach) q.set("fach", o.fach);
    if (o.status) q.set("status", o.status);
    return q.size ? `${RS}?${q}` : RS;
  };
  const chip = (aktiv: boolean) =>
    `inline-flex min-h-[40px] items-center rounded-full border px-4 text-[14px] ${aktiv ? "border-accent bg-accent-wash font-semibold text-accent" : "border-line bg-surface hover:border-accent"}`;

  return (
    <>
      <PageHeader
        title="Referenzsammlung"
        back={{ href: "/mehr", label: "Mehr" }}
        info="Aufgaben als Vorbild, nur für Lehrer. Mathematik: Aufgabe mit Quelle, Grundkompetenz, Format und Lösungserwartung. Sprachen: nur Aufbau, Format und Bewertungsraster, keine fremden Texte. Erst geprüfte Einträge gehen beim Erstellen ähnlicher Aufgaben als Beispiele an die KI. Die App lädt nichts von Webseiten herunter: einzelne PDFs lädst du selbst herunter und hier hoch."
      />
      {sp.fehler && (
        <p className="mb-6 rounded-2xl bg-red-wash px-4 py-3 text-[14px] whitespace-pre-line text-red" role="alert">
          {sp.fehler}
        </p>
      )}
      {sp.geloescht && (
        <p className="mb-6 text-[14px] font-semibold text-green" role="status">
          Eintrag gelöscht.
        </p>
      )}

      <div className="mb-10 grid max-w-[1040px] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="panel px-4 py-4 md:px-5" aria-labelledby="pdf-lesen">
          <h2 id="pdf-lesen" className="mb-3 text-[16px] font-semibold">
            PDF lesen
          </h2>
          <ReferenzLesen faecher={REFERENZ_FAECHER} fach={fach} gesperrt={lesbar.ok ? null : lesbar.grund} />
        </section>
        <section className="panel px-4 py-4 md:px-5" aria-labelledby="von-hand">
          <h2 id="von-hand" className="mb-3 text-[16px] font-semibold">
            Von Hand anlegen
          </h2>
          <form action={neuerEintragAction} className="grid gap-4">
            <label className="field">
              <span className="label">Fach</span>
              <select className="input" name="fach" defaultValue={fach ?? REFERENZ_FAECHER[0]}>
                {REFERENZ_FAECHER.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Quelle</span>
              <input className="input" name="quelle" required maxLength={200} placeholder="z. B. aufgabenpool.at, 1_234" />
            </label>
            <div>
              <button className="btn btn-secondary">
                <Plus size={16} aria-hidden /> Eintrag anlegen
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className="mb-4 grid gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Nach Fach">
          {[undefined, ...REFERENZ_FAECHER].map((f) => (
            <Link key={f ?? "alle"} href={link({ fach: f, status })} className={chip(fach === f)} aria-current={fach === f ? "page" : undefined}>
              {f ?? "Alle Fächer"}
            </Link>
          ))}
        </nav>
        <nav className="flex flex-wrap gap-2" aria-label="Nach Stand">
          {([undefined, "ungeprueft", "geprueft"] as const).map((s) => (
            <Link key={s ?? "alle"} href={link({ fach, status: s })} className={chip(status === s)} aria-current={status === s ? "page" : undefined}>
              {s ? REFERENZ_STATUS[s] : "Alle"}
              {s === "ungeprueft" && offen > 0 && <span className="num ml-1.5">{offen}</span>}
            </Link>
          ))}
        </nav>
      </div>

      {liste.length === 0 ? (
        <Empty title={fach || status ? "Keine Einträge in dieser Auswahl" : "Noch keine Einträge"}>Lies oben ein PDF ein oder leg einen Eintrag von Hand an.</Empty>
      ) : (
        <ul className="panel max-w-[1040px] divide-y divide-line" data-testid="referenz-liste">
          {liste.map((e) => {
            const s = e.skill_id ? skills.get(e.skill_id) : null;
            const format = formateFuer(e.fach).find((f) => f.key === e.format)?.label;
            return (
              <li key={e.id}>
                <Link href={`${RS}/${e.id}`} className="flex min-h-[72px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-panel/60">
                  <span className="min-w-0 flex-1 basis-[16rem]">
                    <span className="block truncate font-semibold">{ersteZeile(e.aufgabe) || <span className="font-normal text-ink-3 italic">Noch kein Text</span>}</span>
                    <span className="block truncate text-[13px] text-ink-2">{[e.fach, s ? `${s.area} › ${s.name}` : "Fähigkeit offen", format, e.grundkompetenz].filter(Boolean).join(" · ")}</span>
                    <span className="block truncate text-[12.5px] text-ink-3">Quelle: {e.quelle || "–"}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {e.dritte && <Pill>Material Dritter</Pill>}
                    {nurAufbau(e.fach) && <Pill>nur Aufbau</Pill>}
                    {e.worksheet_id && <Pill tone="accent">in der Bibliothek</Pill>}
                    <Pill tone={e.status === "geprueft" ? "green" : "amber"}>{REFERENZ_STATUS[e.status]}</Pill>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
