import Link from "next/link";
import { notFound } from "next/navigation";
import { BookPlus, Check, Library } from "lucide-react";
import { inBibliothekAction, loescheEintragAction, speichereEintragAction } from "@/app/referenz-actions";
import { LoeschenMitWarnung } from "@/components/LoeschenMitWarnung";
import { PageHeader, Pill, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { faehigkeitenFuer, formateFuer, getEintrag, nurAufbau, REFERENZ_GRENZEN, REFERENZ_STATUS, uebernahmeGrund } from "@/lib/referenz";
import * as repo from "@/lib/repo";

export const metadata = { title: "Referenzeintrag" };

/** One entry of the Referenzsammlung: check, complete and save it; take it into the library when that is allowed. */
export default async function ReferenzEintragPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; gespeichert?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const e = getEintrag(Number(id));
  if (!e) notFound();
  const sprache = nurAufbau(e.fach);
  const skills = faehigkeitenFuer(e.fach);
  const bereiche = [...new Set(skills.map((s) => s.area))];
  const formate = formateFuer(e.fach);
  const grund = uebernahmeGrund(e);
  const bibliothek = e.worksheet_id ? repo.getWorksheet(e.worksheet_id) : null;
  const speichern = speichereEintragAction.bind(null, e.id);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Referenzeintrag <Pill tone={e.status === "geprueft" ? "green" : "amber"}>{REFERENZ_STATUS[e.status]}</Pill>
          </span>
        }
        back={{ href: "/mehr/referenzen", label: "Referenzsammlung" }}
        subtitle={[e.fach, e.datei ? `aus ${e.datei}` : "von Hand", e.geprueft_am ? `geprüft ${formatDate(e.geprueft_am)}${e.geprueft_von_name ? ` von ${e.geprueft_von_name}` : ""}` : null].filter(Boolean).join(" · ")}
      />
      {sp.fehler && (
        <p className="mb-6 max-w-[760px] rounded-2xl bg-red-wash px-4 py-3 text-[14px] whitespace-pre-line text-red" role="alert">
          {sp.fehler}
        </p>
      )}
      {sp.gespeichert && !sp.fehler && (
        <p className="mb-6 text-[14px] font-semibold text-green" role="status">
          Gespeichert und geprüft.
        </p>
      )}
      {e.status === "ungeprueft" && e.hinweise.length > 0 && (
        <ul className="mb-6 max-w-[760px] list-disc rounded-2xl bg-amber-wash py-3 pr-4 pl-9 text-[14px] text-amber" aria-label="Beim Lesen aufgefallen">
          {e.hinweise.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}

      <form action={speichern} className="panel mb-6 grid max-w-[760px] gap-4 px-4 py-4 md:px-5" data-testid="referenz-form">
        <input type="hidden" name="fach" value={e.fach} />
        <label className="field">
          <span className="label">{sprache ? "Aufbau" : "Aufgabentext"}</span>
          <textarea className="input" rows={8} name="aufgabe" defaultValue={e.aufgabe} required maxLength={REFERENZ_GRENZEN.aufgabe} />
          {sprache && <span className="text-[12.5px] text-ink-3">Was verlangt ist, Textsorte, Länge, Teile. Keine Texte aus der Vorlage.</span>}
        </label>
        <label className="field">
          <span className="label">{sprache ? "Bewertungsraster" : "Lösungserwartung"}</span>
          <textarea className="input" rows={4} name="loesung" defaultValue={e.loesung} maxLength={REFERENZ_GRENZEN.loesung} />
        </label>
        <div className={`grid gap-3 ${sprache ? "sm:grid-cols-2" : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,9rem)]"}`}>
          <label className="field">
            <span className="label">Fähigkeit</span>
            <select className="input" name="skill_id" defaultValue={e.skill_id ?? ""}>
              <option value="">–</option>
              {bereiche.map((b) => (
                <optgroup key={b} label={b}>
                  {skills
                    .filter((s) => s.area === b)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Format</span>
            <select className="input" name="format" defaultValue={e.format}>
              <option value="">–</option>
              {formate.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {!sprache && (
            <label className="field">
              <span className="label">Grundkompetenz</span>
              <input className="input" name="grundkompetenz" defaultValue={e.grundkompetenz} maxLength={REFERENZ_GRENZEN.grundkompetenz} placeholder="z. B. AG 2.1" />
            </label>
          )}
        </div>
        <label className="field">
          <span className="label">Quelle</span>
          <input className="input" name="quelle" defaultValue={e.quelle} required maxLength={REFERENZ_GRENZEN.quelle} placeholder="z. B. aufgabenpool.at, 1_234" />
          <span className="text-[12.5px] text-ink-3">Pflicht. Nur was auf der Seite oder im Dateinamen steht, nichts dazuerfinden.</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-panel px-4 py-3 text-[15px]">
          <input type="checkbox" name="dritte" value="1" defaultChecked={e.dritte} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <span>
            enthält Texte oder Bilder Dritter
            <span className="block text-[13px] text-ink-2">Dann bleibt der Eintrag Referenz für Aufbau und Format. Behalte nur, was du dafür brauchst.</span>
          </span>
        </label>
        <div>
          <button className="btn btn-primary">
            <Check size={17} aria-hidden /> Geprüft speichern
          </button>
        </div>
      </form>

      <section className="panel mb-6 grid max-w-[760px] gap-3 px-4 py-4 md:px-5" aria-labelledby="bibliothek">
        <h2 id="bibliothek" className="text-[16px] font-semibold">
          In die Bibliothek
        </h2>
        {bibliothek ? (
          <p className="text-[14px] text-ink-2">
            Schon übernommen als{" "}
            <Link href={`/uebungen/bibliothek/${bibliothek.id}`} className="link">
              {bibliothek.title}
            </Link>
            . Die Quelle steht dort an der Aufgabe.
          </p>
        ) : grund ? (
          <p className="text-[14px] text-ink-2">{grund}</p>
        ) : (
          <>
            <p className="text-[14px] text-ink-2">Wird eine offene Aufgabe mit der Lösungserwartung als Musterlösung. Das Antwortformat kannst du dort im Editor ändern. Auf dem Blatt und beim Schüler steht „Quelle: {e.quelle}“.</p>
            <form action={inBibliothekAction.bind(null, e.id)}>
              <button className="btn btn-secondary">
                <BookPlus size={16} aria-hidden /> In die Bibliothek übernehmen
              </button>
            </form>
          </>
        )}
        {bibliothek && (
          <div>
            <Link href={`/uebungen/bibliothek/${bibliothek.id}`} className="btn btn-secondary">
              <Library size={16} aria-hidden /> In der Bibliothek ansehen
            </Link>
          </div>
        )}
      </section>

      <LoeschenMitWarnung action={loescheEintragAction.bind(null, e.id)} label="Eintrag löschen" frage="Diesen Eintrag löschen? Eine Aufgabe in der Bibliothek daraus bleibt." className="btn btn-ghost" />
    </>
  );
}
