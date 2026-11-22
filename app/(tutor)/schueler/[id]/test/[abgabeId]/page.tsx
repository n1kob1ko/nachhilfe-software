import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { PageHeader, formatDate } from "@/components/ui";
import { TestLehrerPunkte } from "@/components/TestLehrerPunkte";
import { requireTeacher } from "@/lib/auth";
import { maxPunkte, type FrageErgebnis } from "@/lib/eigene-tests";
import { ergebnisVon, getAbgabe } from "@/lib/eigene-tests-speicher";
import { eigenerTest } from "@/lib/eigene-tests-liste";
import * as repo from "@/lib/repo";

export const metadata = { title: "Test-Ergebnis" };

/** **fett** in der Musterlösung */
const Fett = ({ text }: { text: string }) => <>{text.split("**").map((t, i) => (i % 2 ? <strong key={i}>{t}</strong> : <span key={i}>{t}</span>))}</>;

/**
 * Eine Abgabe eines eigenen Tests (lib/eigene-tests.ts) für die Lehrkraft: Punkte, Note, je Frage die Antworten mit ✓ / ✗
 * und der Lösung; bei offenen Fragen der Text, die Musterlösung, die Selbstbewertung und die eigenen Punkte.
 */
export default async function TestErgebnisSeite({ params }: { params: Promise<{ id: string; abgabeId: string }> }) {
  await requireTeacher();
  const { id, abgabeId } = await params;
  const student = repo.getStudent(Number(id));
  const a = getAbgabe(Number(abgabeId));
  if (!student || !a || a.student_id !== student.id) notFound();
  const test = eigenerTest(a.test);
  const e = ergebnisVon(a);
  if (!test || !e) notFound();
  const first = student.name.split(" ")[0];
  const fragen = new Map(e.fragen.map((f) => [f.id, f]));
  const datum = formatDate(a.created_at.replace(" ", "T") + "Z", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader
        title={<span lang={test.sprache}>{test.titel}</span>}
        subtitle={`${first} · ${datum}${a.sekunden ? ` · ${Math.max(1, Math.round(a.sekunden / 60))} Minuten` : ""}`}
        back={{ href: `/schueler/${student.id}?tab=lernverlauf#eigene-tests-titel`, label: student.name }}
      />

      <section className="panel px-5 py-5" data-testid="test-ergebnis-lehrer">
        <p className="num text-[30px] leading-tight font-semibold">
          {e.punkte} / {e.gesamt} Punkte <span className="text-[18px] text-ink-3">({e.prozent} %)</span>
        </p>
        <p className="mt-1 font-semibold">Note (Orientierung): {e.note}</p>
        {e.offen > 0 && <p className="mt-2 rounded-xl bg-amber-wash px-4 py-3 text-[15px] text-amber">{e.offen === 1 ? "Eine offene Frage hat" : `${e.offen} offene Fragen haben`} noch keine Punkte. Unten bewerten.</p>}
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {e.teile.map((t) => (
            <li key={t.id} className="flex justify-between gap-3 rounded-xl bg-panel px-3.5 py-2 text-[15px]" lang={test.sprache}>
              <span className="min-w-0 truncate">{t.titel}</span>
              <span className="num shrink-0 font-semibold">
                {t.punkte}/{t.max}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {test.teile.map((teil) => (
        <section key={teil.id} className="mt-8">
          <h2 className="gruppe-titel mb-3" lang={test.sprache}>
            {teil.titel}
          </h2>
          <ol className="space-y-3">
            {teil.fragen.map((f) => {
              const r = fragen.get(f.id)!;
              const max = maxPunkte(f);
              return (
                <li key={f.id} className="panel px-5 py-4" lang={test.sprache}>
                  <h3 className="flex items-start justify-between gap-3 font-semibold">
                    <span>
                      {f.id}. {f.titel}
                    </span>
                    <span className={`num shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${r.punkte === null ? "bg-amber-wash text-amber" : r.punkte === max ? "bg-green-wash text-green" : r.punkte > 0 ? "bg-amber-wash text-amber" : "bg-red-wash text-red"}`}>
                      {r.punkte === null ? "offen" : `${r.punkte}/${max}`}
                    </span>
                  </h3>
                  <Antworten f={f} r={r} />
                  {f.art === "offen" && (
                    <div className="mt-3 space-y-3" lang="de">
                      <p className="rounded-xl bg-panel px-4 py-3 text-[15px] whitespace-pre-wrap" lang={test.sprache}>
                        {r.text || <span className="text-ink-3">(keine Antwort)</span>}
                      </p>
                      <p className="rounded-xl border-l-4 border-accent px-4 py-2 text-[15px]">
                        <span className="font-semibold">Musterlösung: </span>
                        <span lang={test.sprache}>
                          <Fett text={f.muster} />
                        </span>
                      </p>
                      <p className="text-[14px] text-ink-2">{a.selbst[f.id] !== undefined ? `${first} hat sich ${a.selbst[f.id]} von ${max} Punkten gegeben.` : `${first} hat sich noch nicht bewertet.`}</p>
                      <TestLehrerPunkte abgabeId={a.id} frage={f.id} max={max} lehrer={a.lehrer[f.id] ?? null} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Zeichen({ ok }: { ok: boolean }) {
  return ok ? <Check size={17} strokeWidth={3} className="shrink-0 text-green" aria-label="richtig" /> : <X size={17} strokeWidth={3} className="shrink-0 text-red" aria-label="falsch" />;
}

function Antworten({ f, r }: { f: NonNullable<ReturnType<typeof eigenerTest>>["teile"][number]["fragen"][number]; r: FrageErgebnis }) {
  if (f.art === "auswahl" || f.art === "rf" || f.art === "luecken") {
    const labels = f.art === "luecken" ? f.luecken.map((_, i) => `Lücke ${i + 1}`) : f.items.map(([z]) => z);
    return (
      <ul className="mt-2 divide-y divide-dashed divide-line text-[15px]">
        {r.zeilen!.map((z, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
            <span className="min-w-0 flex-[1_1_220px] text-ink-2">{labels[i]}</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <Zeichen ok={z.richtig} />
              {z.gegeben || <span className="font-normal text-ink-3">leer</span>}
              {!z.richtig && <span className="font-normal text-ink-2">→ {z.loesung}</span>}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (f.art === "mc" || f.art === "mehrfach") {
    return (
      <ul className="mt-2 space-y-1 text-[15px]">
        {f.optionen.map((o, i) => {
          const an = r.gewaehlt?.includes(i);
          const richtig = r.richtige?.includes(i);
          if (!an && !richtig) return null;
          return (
            <li key={i} className="flex items-center gap-2">
              {an ? <Zeichen ok={Boolean(richtig)} /> : <span className="w-[17px] shrink-0" />}
              <span className={an ? "font-semibold" : "text-ink-2"}>{o}</span>
              {!an && richtig && <span className="text-[13px] text-ink-3" lang="de">(richtig, nicht angekreuzt)</span>}
            </li>
          );
        })}
        {!r.gewaehlt?.length && (
          <li className="text-ink-3" lang="de">
            nichts angekreuzt
          </li>
        )}
      </ul>
    );
  }
  return null;
}
