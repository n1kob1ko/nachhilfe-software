import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, FileText, Plus } from "lucide-react";
import { bestaetigeStoffAction } from "@/app/curriculum-actions";
import { Info } from "@/components/Info";
import { PageHeader, Pill, SectionTitle, StatusChip } from "@/components/ui";
import { erkanntAnsicht, type SkillStand } from "@/lib/erkannt";
import { dayOf } from "@/lib/exams";
import { QUELLE_LABEL, STATUS_LABEL, type StoffZeile } from "@/lib/pruefungsstoff";
import * as repo from "@/lib/repo";

export const metadata = { title: "Erkannt" };

const skillName = (id: string) => {
  const s = repo.getSkill(id);
  if (!s) return id;
  return s.parent_id ? `${repo.getSkill(s.parent_id)?.name ?? ""} › ${s.name}` : s.name;
};

/**
 * **Erkannt** (lib/erkannt.ts): was DreamStudy aus den Unterlagen einer Prüfung gelesen hat, je Punkt Wortlaut auf dem
 * Blatt → Lerninhalt → Fähigkeit mit Lernstand, die Quelle, ausgeschlossen und noch zu klären. Oben nur das, was kurz
 * bestätigt werden muss; darunter, was für den Unterricht bereitliegt und was fehlt.
 */
export default async function ErkanntPage({ params, searchParams }: { params: Promise<{ id: string; testId: string }>; searchParams: Promise<{ bestaetigt?: string }> }) {
  const { id, testId } = await params;
  const sp = await searchParams;
  const a = erkanntAnsicht(Number(testId), dayOf(new Date()));
  if (!a || a.student.id !== Number(id)) notFound();
  const { test, student } = a;
  const first = student.name.split(" ")[0];
  const vorbereitung = `/schueler/${student.id}/pruefung/${test.id}`;
  const builder = (s: SkillStand) => `/uebungen/neu?schueler=${student.id}&skill=${encodeURIComponent(s.skill.id)}`;
  const leer = a.gruppen.length === 0;

  return (
    <>
      <PageHeader
        title={`Erkannt: ${test.title || `${test.kind} ${test.subject}`}`}
        back={{ href: vorbereitung, label: "Vorbereitung" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {a.dokumente.length > 0 ? (
              a.dokumente.map((d) => (
                <a key={d.nr} href={`/material/${d.materialId}/datei`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-accent hover:underline">
                  <FileText size={14} aria-hidden /> {d.nr}. {d.rolle}
                </a>
              ))
            ) : (
              <span>Kein gelesenes Blatt</span>
            )}
          </span>
        }
      />
      <div className="grid max-w-[980px] grid-cols-[minmax(0,1fr)] gap-9" data-testid="erkannt">
        {sp.bestaetigt && (
          <p role="status" className="-mt-4 flex items-center gap-2 rounded-lg bg-green-wash px-3 py-2 text-[14px] text-green" data-testid="erkannt-bestaetigt">
            <Check size={16} aria-hidden /> Gespeichert. Plan und Vorbereitung richten sich danach.
          </p>
        )}
        {leer && <p className="text-[15px] text-ink-2">Zu dieser Prüfung ist noch nichts erkannt. Lade in der Vorbereitung oder im Profil die Fotos hoch.</p>}

        {a.zuBestaetigen.length > 0 && (
          <section aria-label="Kurz bestätigen" data-testid="erkannt-bestaetigen">
            <SectionTitle>
              <span>
                Kurz bestätigen
                <Info label="Warum nur diese?">
                  Was eindeutig passt, ist schon zugeordnet. Hier stehen nur Punkte, bei denen Buchwort und Fähigkeit nicht sicher zusammenpassen. Was du nicht antippst, bleibt offen. DreamStudy merkt sich deine Wahl für dieselben Wörter beim nächsten Mal.
                </Info>
              </span>
            </SectionTitle>
            <form action={bestaetigeStoffAction.bind(null, test.id)} className="panel grid divide-y divide-line px-4">
              {a.zuBestaetigen.map((z) => (
                <fieldset key={z.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-4" data-testid="erkannt-unklar">
                  <legend className="sr-only">{z.inhalt}</legend>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{z.inhalt}</p>
                    <p className="text-[13px] text-ink-3">
                      „{z.original}“ · {QUELLE_LABEL[z.quelle]}
                      {z.einheit && ` · ${z.einheit}`}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {z.vorschlaege.map((sid) => (
                      <label key={sid} className="flex min-h-[44px] min-w-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13.5px] has-checked:border-accent has-checked:bg-accent-wash">
                        <input type="radio" name={`zuordnung_${z.id}`} value={sid} className="shrink-0 accent-[var(--accent)]" />
                        <span className="min-w-0">{skillName(sid)}</span>
                      </label>
                    ))}
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13.5px] has-checked:border-accent has-checked:bg-accent-wash">
                      <input type="radio" name={`zuordnung_${z.id}`} value="" className="shrink-0 accent-[var(--accent)]" />
                      <span>Keine passt</span>
                    </label>
                  </div>
                </fieldset>
              ))}
              <div className="py-3">
                <button className="btn btn-primary" data-testid="erkannt-bestaetigen-speichern">
                  Bestätigen
                </button>
              </div>
            </form>
          </section>
        )}

        {a.zuKlaeren.length > 0 && (
          <section aria-label="Noch zu klären" data-testid="erkannt-klaeren">
            <SectionTitle>Noch zu klären</SectionTitle>
            <ul className="panel divide-y divide-line">
              {a.zuKlaeren.map((z) => (
                <li key={z.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{z.inhalt}</span>
                    <span className="block text-[13px] text-ink-2">{z.grund || `„${z.original}“`}</span>
                  </span>
                  <form action={bestaetigeStoffAction.bind(null, test.id)} className="flex gap-2">
                    <input type="hidden" name="zeile" value={z.id} />
                    <button name="status" value="pruefung" className="btn btn-secondary btn-sm">
                      Gehört dazu
                    </button>
                    <button name="status" value="ausgeschlossen" className="btn btn-ghost btn-sm">
                      Nicht dazu
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(a.vorbereitet.length > 0 || a.fehlt.length > 0) && (
          <section aria-label="Für den Unterricht" data-testid="erkannt-unterricht">
            <SectionTitle>Für den Unterricht</SectionTitle>
            <div className="panel grid gap-3 px-4 py-4 text-[15px]">
              {a.vorbereitet.length > 0 && (
                <p>
                  <span className="font-semibold">Für heute vorbereitet: </span>
                  {a.vorbereitet.map((s, i) => (
                    <span key={s.skill.id}>
                      {i > 0 && ", "}
                      {s.skill.name} ({s.status}
                      {s.paket ? `, Lernpaket „${s.paket.title}“${s.paket.praesentation ? " mit Präsentation" : ""}` : ", Übungen bereit"})
                    </span>
                  ))}
                  . Der Unterricht nimmt das von selbst, wenn die Prüfung die nächste ist.
                </p>
              )}
              {a.fehlt.length > 0 && (
                <div className="grid gap-2">
                  <p>
                    <span className="font-semibold">Fehlt noch:</span> Übungen zu {a.fehlt.map((s) => s.skill.name).join(", ")}.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {a.fehlt.slice(0, 4).map((s) => (
                      <Link key={s.skill.id} href={builder(s)} className="btn btn-secondary btn-sm">
                        <Plus size={15} aria-hidden /> {s.skill.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {a.gruppen.map((g) => (
          <section key={g.gruppe} aria-label={g.label} data-testid={`erkannt-gruppe-${g.gruppe}`}>
            <SectionTitle>
              {g.label} · <span className="num">{g.zeilen.length}</span>
            </SectionTitle>
            <ul className="panel divide-y divide-line">
              {g.zeilen.map((z) => (
                <Zeile key={z.id} z={z} a={a} />
              ))}
            </ul>
          </section>
        ))}

        <p className="text-[13px] text-ink-3">
          Wortlaut, Lerninhalt und Fähigkeit stehen nebeneinander, damit du sie mit dem Blatt vergleichen kannst. Ohne passende Fähigkeit bleibt ein Punkt trotzdem Prüfungsstoff von {first}.{" "}
          <Link href={vorbereitung} className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-accent hover:underline">
            Zur Vorbereitung <ArrowRight size={14} aria-hidden />
          </Link>
        </p>
      </div>
    </>
  );
}

/** Eine Zeile: Wortlaut → Lerninhalt → Fähigkeit (mit Lernstand), dazu Quelle und Status. */
function Zeile({ z, a }: { z: StoffZeile; a: NonNullable<ReturnType<typeof erkanntAnsicht>> }) {
  const s = z.skill_id ? a.skills.get(z.skill_id) : null;
  const aus = z.status === "ausgeschlossen";
  return (
    <li className={`grid gap-1.5 px-4 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-4 ${aus ? "text-ink-3" : ""}`} data-testid="erkannt-zeile">
      <div className="min-w-0">
        <p className={`text-[14.5px] ${aus ? "line-through decoration-1" : ""}`}>„{z.original}“</p>
        <p className="text-[12.5px] text-ink-3">
          {QUELLE_LABEL[z.quelle]}
          {z.einheit && ` · ${z.einheit}`}
        </p>
      </div>
      <p className="min-w-0 text-[14.5px] font-medium">
        <span className="text-ink-3 md:hidden">→ </span>
        {z.inhalt}
        {z.status !== "pruefung" && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] font-normal">
            <Pill tone={aus ? "neutral" : "amber"}>{STATUS_LABEL[z.status]}</Pill>
            {z.grund && <span className="text-ink-2">{z.grund}</span>}
          </span>
        )}
      </p>
      <div className="min-w-0 text-[14px]">
        {z.gruppe === "umfang" ? (
          <span className="text-ink-3">Kapitel, keine Fähigkeit</span>
        ) : aus ? (
          <span className="text-ink-3">–</span>
        ) : s ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink-3 md:hidden">→ </span>
            <span className="font-medium">{skillName(s.skill.id)}</span>
            <StatusChip mastery={s.mastery} />
            {z.zuordnung === "bestaetigt" && <span className="text-[12.5px] text-ink-3">von dir bestätigt</span>}
          </span>
        ) : z.zuordnung === "unklar" ? (
          <span className="text-amber">kurz bestätigen: {z.vorschlaege.map(skillName).join(" oder ")}</span>
        ) : (
          <span className="text-ink-2">keine passende Fähigkeit – bleibt als Prüfungsstoff gespeichert</span>
        )}
      </div>
    </li>
  );
}
