import { PrueflisteEintrag } from "@/components/PrueflisteEintrag";
import { currentTeacher } from "@/lib/auth";
import { weitereFaecher } from "@/lib/faecher";
import { darfPruefliste, formular, offeneEinreichungen, zusammenfuehren } from "@/lib/pruefliste";
import type { Student } from "@/lib/repo";
import { stoffzettelLesbar } from "@/lib/stoffzettel";

/**
 * Die Prüfliste am Profil (Stoff & Prüfungen): was der Schüler in seiner App eingetragen hat und noch auf einen Lehrer
 * wartet (lib/pruefliste.ts). Nur für seine Lehrer und den Admin; ohne offene Einträge nichts.
 */
export async function Pruefliste({ student }: { student: Student }) {
  const me = await currentTeacher();
  if (!me || !darfPruefliste(me, student.id)) return null;
  const liste = offeneEinreichungen(student.id);
  if (!liste.length) return null;
  const faecher = student.subjects.length ? student.subjects : ["Mathematik"];
  const kiLiest = stoffzettelLesbar().ok;
  return (
    <section id="pruefliste" className="mb-6 scroll-mt-6" aria-labelledby="pruefliste-titel" data-testid="pruefliste">
      <h3 id="pruefliste-titel" className="text-[15px] font-semibold">
        Prüfliste <span className="num font-normal text-ink-3">({liste.length})</span>
      </h3>
      <p className="mt-0.5 mb-3 text-[13.5px] text-ink-2">Von {student.name.split(" ")[0]} in der App eingetragen. Was klar war, steht schon bei den Prüfungen; das andere wird erst mit „Übernehmen“ eine Prüfung.</p>
      <ul className="grid gap-3">
        {liste.map((e) => {
          const v = zusammenfuehren(e.fotos.map((f) => f.vorschlag));
          const f = formular(e, v);
          // schon eingetragen: das Formular zeigt die gespeicherte Prüfung
          const t = e.status === "automatisch" ? e.test : null;
          return (
            <li key={e.id}>
              <PrueflisteEintrag
                d={{
                  id: e.id,
                  eingereichtAm: e.eingereichtAm,
                  fotos: e.fotos.map((x) => ({ id: x.id, materialId: x.materialId, pdf: x.mime === "application/pdf", fehler: x.fehler })),
                  ungelesen: t ? 0 : e.fotos.filter((x) => !x.gelesen && x.materialId).length,
                  eingetragen: t != null,
                  werte: t ? { art: t.kind, fach: t.subject, datum: t.date, titel: t.title, stoff: t.topics.join(", "), notiz: t.notes } : { art: f.art, fach: f.fach, datum: f.datum, titel: f.titel, stoff: f.stoff, notiz: f.notiz },
                  vomFoto: f.vomFoto,
                  // eingetragen gibt es keinen Widerspruch mehr: der Stoff vom Foto steht schon drin
                  hinweise: [...(t ? [] : f.abweichungen), ...(v?.hinweise ?? [])],
                  gelesen: v != null,
                }}
                faecher={faecher}
                weitere={weitereFaecher(faecher)}
                kiLiest={kiLiest}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
