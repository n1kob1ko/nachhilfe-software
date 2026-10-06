import Link from "next/link";
import { FileText, ImageIcon, Upload } from "lucide-react";
import { Empty, PageHeader, Pill, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { SUBJECTS } from "@/lib/curriculum";
import { libraryTasksOf, listMaterials, MATERIAL_KINDS, MATERIAL_STATUS, MAX_UPLOAD_BYTES } from "@/lib/materials";
import { sourceById } from "@/lib/lehrplan";
import * as repo from "@/lib/repo";

export const metadata = { title: "Material" };

const statusTone = { hochgeladen: "amber", vorschlag: "accent", geprueft: "green" } as const;

/**
 * Material: photos and PDFs (worksheets, school book pages, tests) to keep with Fach and Thema, its
 * source and licence. Tasks from it go into the library only after the teacher has checked them.
 */
export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ fehler?: string; geloescht?: string; fach?: string }> }) {
  await requireTeacher();
  const sp = await searchParams;
  const all = listMaterials();
  const subjects = [...new Set(all.map((m) => m.subject).filter(Boolean))];
  const list = sp.fach ? all.filter((m) => m.subject === sp.fach) : all;
  const students = repo.listStudents();

  return (
    <>
      <PageHeader
        title="Material"
        back={{ href: "/mehr", label: "Mehr" }}
        info="Fotos und PDFs von Arbeitsblättern, Schulbuchseiten oder Tests. Die Datei bleibt privat auf diesem Server. Aufgaben daraus kommen erst in die Aufgabenbibliothek, wenn du sie geprüft hast, und fremde Aufgaben nur in eigenen Worten."
      />
      {sp.fehler && (
        <p className="mb-6 rounded-2xl bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
          {sp.fehler}
        </p>
      )}
      {sp.geloescht && (
        <p className="mb-6 text-[14px] font-semibold text-green" role="status">
          Material gelöscht.
        </p>
      )}

      <form action="/material/hochladen" method="post" encType="multipart/form-data" className="panel mb-10 grid max-w-[760px] gap-4 px-4 py-4 md:px-5" aria-label="Material hochladen">
        <label className="field">
          <span className="label">Foto oder PDF</span>
          <input className="input py-2" type="file" name="datei" accept="image/jpeg,image/png,image/webp,application/pdf" required />
          <span className="text-[12.5px] text-ink-3">JPG, PNG, WebP oder PDF, höchstens {MAX_UPLOAD_BYTES / 1024 / 1024} MB. Auf dem Tablet öffnet sich auch die Kamera.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="field">
            <span className="label">Art</span>
            <select className="input" name="art" defaultValue="">
              <option value="">automatisch</option>
              {Object.entries(MATERIAL_KINDS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Fach</span>
            <select className="input" name="fach" defaultValue={sp.fach ?? ""}>
              <option value="">später</option>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Schüler (optional)</span>
            <select className="input" name="schueler" defaultValue="">
              <option value="">–</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="label">Titel (optional)</span>
          <input className="input" name="titel" maxLength={120} placeholder="z. B. Arbeitsblatt Bruchrechnen, Schularbeit Nov." />
        </label>
        <div>
          <button className="btn btn-primary btn-lg">
            <Upload size={17} aria-hidden /> Hochladen
          </button>
        </div>
      </form>

      {subjects.length > 1 && (
        <nav className="mb-4 flex flex-wrap gap-2" aria-label="Nach Fach">
          {[undefined, ...subjects].map((s) => (
            <Link
              key={s ?? "alle"}
              href={s ? `/mehr/material?fach=${encodeURIComponent(s)}` : "/mehr/material"}
              className={`inline-flex min-h-[40px] items-center rounded-full border px-4 text-[14px] ${sp.fach === s ? "border-accent bg-accent-wash font-semibold text-accent" : "border-line bg-surface hover:border-accent"}`}
              aria-current={sp.fach === s ? "page" : undefined}
            >
              {s ?? "Alle"}
            </Link>
          ))}
        </nav>
      )}

      {list.length === 0 ? (
        <Empty title="Noch kein Material">Lade oben ein Foto oder PDF hoch.</Empty>
      ) : (
        <ul className="panel max-w-[920px] divide-y divide-line">
          {list.map((m) => {
            const src = sourceById(m.source_id);
            const taken = libraryTasksOf(m.id).length;
            const student = m.student_id ? students.find((s) => s.id === m.student_id) : null;
            return (
              <li key={m.id}>
                <Link href={`/mehr/material/${m.id}`} className="flex min-h-[72px] items-center gap-4 px-4 py-3 hover:bg-panel/60">
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper text-ink-3">
                    {m.mime.startsWith("image/") ? (
                      <img src={`/material/${m.id}/datei`} alt="" loading="lazy" className="size-full object-cover" />
                    ) : m.mime === "application/pdf" ? (
                      <FileText size={22} aria-hidden />
                    ) : (
                      <ImageIcon size={22} aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.title}</span>
                    <span className="block truncate text-[13px] text-ink-2">
                      {[m.subject || "Fach offen", m.topic, student?.name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
                    <Pill tone={statusTone[m.status]}>{MATERIAL_STATUS[m.status]}</Pill>
                    {!src && <Pill tone="amber">Herkunft fehlt</Pill>}
                    {taken > 0 && <Pill>{taken === 1 ? "1 Aufgabe" : `${taken} Aufgaben`} in der Bibliothek</Pill>}
                  </span>
                  <span className="num shrink-0 text-[13px] text-ink-3">{formatDate(m.created_at, { day: "numeric", month: "short" })}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
