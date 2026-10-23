import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  bestaetigeBewertungAction,
  bewertungVorschlagenAction,
  erwartungVorschlagenAction,
  speichereErwartungAction,
  verwirfBewertungVorschlagAction,
  verwirfErwartungVorschlagAction,
} from "@/app/bewertung-actions";
import { BewertungForm, ErwartungForm, KiKnopf, type BewertungWerte } from "@/components/text/bewertung/BewertungTeile";
import { PageHeader, Pill, formatDate, formatTime } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { KRITERIEN, type KriteriumKey } from "@/lib/bewertung-kriterien";
import { SORTEN } from "@/lib/schreibauftrag";
import { bewertungInfo, bewertungMoeglich, erwartungInfo, kiStatus } from "@/lib/schreibauftrag-bewertung";
import { auftragFor } from "@/lib/schreibauftrag-store";
import { getText } from "@/lib/texts";

export const metadata = { title: "Bewertung" };

const wann = (s: string) => `${formatDate(s, { day: "numeric", month: "short" })}, ${formatTime(s)}`;
const verworfen = (n: number) => (n ? `${n === 1 ? "Eine Stelle" : `${n} Stellen`} mit Zitat oder Zeilenangabe ${n === 1 ? "stand" : "standen"} nicht im Text und ${n === 1 ? "wurde" : "wurden"} weggelassen.` : "");

/**
 * Erwartungshorizont und Bewertung eines Schreibauftrags (lib/schreibauftrag-bewertung.ts), nur für die Lehrkraft. Was
 * die KI vorschlägt, ist ungeprüft, bis die Lehrkraft speichert oder bestätigt; ihre Zitate und Zeilen prüft die App.
 */
export default async function BewertungPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeacher();
  const text = getText(Number(id));
  const auftrag = text ? auftragFor(text.id) : null;
  if (!text || !auftrag) notFound();
  const name = text.student_name.split(" ")[0];
  const e = erwartungInfo(text.id)!;
  const b = bewertungInfo(text.id);
  const sorte = SORTEN[auftrag.sorte];
  const erwartungWerte = e.vorschlag ?? e.gespeichert ?? e.vorlage;
  const erwartungKey = `${e.vorschlagAt ?? ""}|${e.gespeichertAt ?? ""}`;
  const kiErwartung = kiStatus("erwartung", text.student_id);
  const bewertungGrund = bewertungMoeglich(text);
  const v = b.vorschlag;
  const werte = Object.fromEntries(
    KRITERIEN.map((k) => {
      const aus = v?.kriterien.find((x) => x.key === k.key);
      const best = b.bestaetigt?.kriterien.find((x) => x.key === k.key);
      return [k.key, aus ? { stufe: aus.stufe, begruendung: aus.begruendung, belege: aus.belege } : { stufe: best?.stufe ?? null, begruendung: best?.begruendung ?? "", belege: [] }];
    }),
  ) as BewertungWerte;
  const fehlt = v ? KRITERIEN.filter((k) => !v.kriterien.some((x) => x.key === (k.key as KriteriumKey))).map((k) => k.name) : [];

  return (
    <div className="grid max-w-[860px] gap-6">
      <PageHeader
        title="Erwartungshorizont und Bewertung"
        subtitle={`${sorte.name} von ${text.student_name} · ${text.words.toLocaleString("de-AT")} Wörter · ${text.status === "fertig" ? "abgegeben" : "in Arbeit"}`}
        info="Nur für dich. Der Erwartungshorizont sagt je Kriterium, was ein guter Text enthalten kann. Die Bewertung gilt erst, wenn du sie bestätigst; sie geht nicht in den Lernstand."
        back={{ href: `/texte/${text.id}`, label: "Zum Text" }}
      />

      <section className="panel grid gap-4 p-5" data-testid="erwartungshorizont">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[19px] font-semibold">Erwartungshorizont</h2>
          {e.vorschlag ? (
            <Pill tone="amber">Ungeprüft</Pill>
          ) : e.gespeichert ? (
            <Pill tone="green">Gespeichert {e.gespeichertAt ? wann(e.gespeichertAt) : ""}</Pill>
          ) : (
            <Pill>Vorlage, noch nicht gespeichert</Pill>
          )}
          {e.gespeichert && <Pill tone={e.freigegeben ? "accent" : "neutral"}>{e.freigegeben ? `${name} sieht ihn` : `${name} sieht ihn nicht`}</Pill>}
        </div>
        <p className="text-[14px] text-ink-2">
          Je Kriterium, was ein guter Text zu diesem Auftrag enthalten kann. Bei offenen Fragen sind mehrere Richtungen richtig: Schreib auf, was zählt, nicht einen Mustertext.
        </p>
        {e.vorschlag && (
          <div className="grid gap-2 rounded-2xl bg-amber-wash px-4 py-3 text-[14px] text-amber" data-testid="erwartung-vorschlag">
            <p>
              Vorschlag der KI{e.vorschlagAt ? ` vom ${wann(e.vorschlagAt)}` : ""}, noch ungeprüft. Er gilt erst, wenn du ihn speicherst. {verworfen(e.verworfen)}
            </p>
            <form action={verwirfErwartungVorschlagAction.bind(null, text.id)}>
              <button className="btn btn-ghost btn-sm">Vorschlag verwerfen</button>
            </form>
          </div>
        )}
        {e.beilageGeaendert && (
          <p className="flex items-start gap-2 text-[14px] text-amber" data-testid="beilage-geaendert">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> Die Textbeilage wurde nach dem Speichern geändert. Prüf die Zeilenangaben.
          </p>
        )}
        <ErwartungForm key={erwartungKey} action={speichereErwartungAction.bind(null, text.id)} werte={erwartungWerte} freigegeben={e.freigegeben} name={name} />
        <div className="grid gap-2 border-t border-line pt-4">
          <KiKnopf action={erwartungVorschlagenAction.bind(null, text.id)} label="Mit KI vorschlagen" wartend="Vorschlag wird erstellt …" grund={kiErwartung.grund} testid="erwartung-ki" />
          {!kiErwartung.grund && <p className="text-[13px] text-ink-3">Geht mit Auftrag und Textbeilage an die KI, ohne Namen. Zitate und Zeilen, die nicht im Text stehen, lässt die App weg.</p>}
        </div>
      </section>

      <section className="panel grid gap-4 p-5" data-testid="bewertung">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[19px] font-semibold">Bewertung</h2>
          {v ? <Pill tone="amber">Vorschlag, ungeprüft</Pill> : null}
          {b.bestaetigt && (
            <Pill tone="green">
              Bestätigt {b.bestaetigtAt ? wann(b.bestaetigtAt) : ""}
              {b.bestaetigt.note ? ` · Note ${b.bestaetigt.note}` : ""}
            </Pill>
          )}
        </div>
        <p className="text-[14px] text-ink-2">Je Kriterium eine Stufe und ein, zwei Sätze, warum. Als Bewertung gilt nur, was du bestätigst.</p>
        {b.bestaetigt && b.version !== null && b.version !== text.version && <p className="text-[14px] text-amber">Der Text wurde nach der Bewertung noch geändert.</p>}
        {v && (
          <div className="grid gap-2 rounded-2xl bg-amber-wash px-4 py-3 text-[14px] text-amber" data-testid="bewertung-vorschlag">
            <p>
              Vorschlag der KI{v.at ? ` vom ${wann(v.at)}` : ""}, steht unten im Formular. Prüf jede Stufe und Begründung. {verworfen(v.verworfen)}
              {fehlt.length ? ` Ohne Vorschlag: ${fehlt.join(", ")}.` : ""}
              {v.version !== null && v.version !== text.version ? " Der Text wurde seither geändert." : ""}
            </p>
            <form action={verwirfBewertungVorschlagAction.bind(null, text.id)}>
              <button className="btn btn-ghost btn-sm">Vorschlag verwerfen</button>
            </form>
          </div>
        )}
        <BewertungForm key={`${v?.at ?? ""}|${b.bestaetigtAt ?? ""}`} action={bestaetigeBewertungAction.bind(null, text.id)} werte={werte} note={b.bestaetigt?.note ?? null} name={name} />
        <div className="grid gap-2 border-t border-line pt-4">
          <KiKnopf
            action={bewertungVorschlagenAction.bind(null, text.id)}
            label="Bewertung vorschlagen"
            wartend="Vorschlag wird erstellt …"
            zustimmung={`Der Text von ${name} geht mit Auftrag, Textbeilage und ${e.gespeichert ? "deinem Erwartungshorizont" : "der Vorlage des Erwartungshorizonts"} an die KI. Namen werden vorher zu [Name].`}
            grund={bewertungGrund}
            testid="bewertung-ki"
          />
        </div>
      </section>
    </div>
  );
}
