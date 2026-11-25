import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { abgabenVon, ergebnisVon, testsFuer } from "@/lib/eigene-tests-speicher";
import { punkteZahl } from "@/lib/eigene-tests";
import type { Student } from "@/lib/repo";

/**
 * Freigeschaltete eigene Tests (lib/eigene-tests.ts) als Karte in der Schüler-App, auf Start und unter Prüfungen:
 * noch nicht gemacht → „Starten“, sonst das letzte Ergebnis.
 */
export function EigeneTestsTeaser({ student, token, von }: { student: Pick<Student, "id" | "spiele_test">; token: string; von?: "pruefungen" }) {
  const tests = testsFuer(student);
  if (!tests.length) return null;
  return (
    <ul className="mt-8 space-y-3" data-testid="eigene-tests">
      {tests.map((t) => {
        const a = abgabenVon(student.id, t.key)[0];
        const e = a ? ergebnisVon(a) : null;
        return (
          <li key={t.key}>
            <Link href={`/lernen/${token}/test/${t.key}${von ? `?von=${von}` : ""}`} className="panel flex items-center gap-4 px-5 py-4 transition-colors hover:border-accent" data-testid={`eigener-test-${t.key}`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent">
                <ClipboardCheck size={24} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold tracking-wide text-ink-3 uppercase">{t.fach} · Test</span>
                <span className="block text-[17px] font-semibold" lang={t.sprache}>
                  {t.titel}
                </span>
                <span className="block text-[14px] text-ink-2">
                  {e ? (
                    <>
                      <span className="num">
                        {punkteZahl(e.punkte)} von {e.gesamt} Punkten
                      </span>{" "}
                      · {e.note}
                      {e.offen > 0 && ` · ${e.offen === 1 ? "1 Frage" : `${e.offen} Fragen`} noch bewerten`}
                    </>
                  ) : (
                    `etwa ${t.minuten} Minuten · noch nicht gemacht`
                  )}
                </span>
              </span>
              <span className={a ? "btn btn-secondary" : "btn btn-primary"}>
                {a ? "Ansehen" : "Starten"} <ChevronRight size={16} aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
