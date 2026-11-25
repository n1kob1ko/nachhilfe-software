import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { testFreigabeAction } from "@/app/eigene-test-actions";
import { abgabenVon, ergebnisVon, istFreigegeben } from "@/lib/eigene-tests-speicher";
import { EIGENE_TESTS } from "@/lib/eigene-tests-liste";
import { punkteZahl } from "@/lib/eigene-tests";
import { formatDate } from "@/components/ui";
import type { Student } from "@/lib/repo";

/**
 * Im Schülerprofil (Tab „Übungen & Verlauf“, ganz oben): die eigenen Tests der App (lib/eigene-tests.ts). Je Test „Freischalten“ — dann steht er
 * in der Schüler-App auf Start und unter Prüfungen — und die Abgaben mit Punkten, Note und offenen Fragen.
 */
export function EigeneTestsProfil({ student }: { student: Pick<Student, "id" | "name"> }) {
  const first = student.name.split(" ")[0];
  return (
    <ul className="space-y-3" data-testid="eigene-tests-profil">
      {EIGENE_TESTS.map((t) => {
        const frei = istFreigegeben(student.id, t.key);
        const abgaben = abgabenVon(student.id, t.key);
        return (
          <li key={t.key} className="panel px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent">
                <ClipboardCheck size={22} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold" lang={t.sprache}>
                  {t.titel}
                </span>
                <span className="block text-[14px] text-ink-2">
                  {t.fach} · etwa {t.minuten} Minuten · {frei ? `${first} sieht ihn in der App` : "noch nicht freigeschaltet"}
                </span>
              </span>
              <form action={testFreigabeAction.bind(null, student.id, t.key, !frei)}>
                <button type="submit" className={frei ? "btn btn-ghost" : "btn btn-primary"} data-testid={`freigabe-${t.key}`}>
                  {frei ? "Zurücknehmen" : `Für ${first} freischalten`}
                </button>
              </form>
            </div>
            {abgaben.length > 0 && (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {abgaben.map((a) => {
                  const e = ergebnisVon(a);
                  return (
                    <li key={a.id}>
                      <Link href={`/schueler/${student.id}/test/${a.id}`} className="group flex min-h-[52px] items-center gap-3 py-2.5">
                        <span className="min-w-0 flex-1 text-[15px]">
                          <span className="num font-semibold group-hover:text-accent">{e ? `${punkteZahl(e.punkte)} von ${e.gesamt} Punkten · ${e.note}` : "Abgabe"}</span>
                          <span className="block text-[13px] text-ink-2">
                            {formatDate(a.created_at.replace(" ", "T") + "Z", { weekday: "short", day: "numeric", month: "short" })}
                            {a.sekunden ? ` · ${Math.max(1, Math.round(a.sekunden / 60))} Min.` : ""}
                            {e && e.offen > 0 ? ` · ${e.offen === 1 ? "1 offene Frage" : `${e.offen} offene Fragen`} zu bewerten` : ""}
                          </span>
                        </span>
                        <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
