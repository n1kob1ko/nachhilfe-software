import { notFound } from "next/navigation";
import { EigenerTest } from "@/components/lernen/EigenerTest";
import { testAnsicht } from "@/lib/eigene-tests";
import { abgabenVon, darfTest, ergebnisVon } from "@/lib/eigene-tests-speicher";
import { eigenerTest } from "@/lib/eigene-tests-liste";
import * as repo from "@/lib/repo";

export const metadata = { title: "Test" };

/**
 * Ein eigener Test in der Schüler-App (lib/eigene-tests.ts), nur wenn die Lehrkraft ihn für diesen Schüler
 * freigeschaltet hat. Gibt es schon eine Abgabe, steht ihr Ergebnis da („Nochmal machen“ beginnt neu).
 */
export default async function TestSeite({ params, searchParams }: { params: Promise<{ token: string; key: string }>; searchParams: Promise<{ von?: string }> }) {
  const { token, key } = await params;
  const { von } = await searchParams;
  const student = repo.getStudentByToken(token);
  const test = eigenerTest(key);
  if (!student || !test || !darfTest(student, test.key)) notFound();
  const a = abgabenVon(student.id, test.key)[0];
  const letzte = a ? { abgabeId: a.id, ergebnis: ergebnisVon(a)!, antworten: a.antworten, selbst: a.selbst, lehrer: a.lehrer } : null;
  return <EigenerTest token={token} test={testAnsicht(test)} letzte={letzte} zurueck={von === "pruefungen" ? `/lernen/${token}/pruefungen` : `/lernen/${token}`} />;
}
