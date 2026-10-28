import Link from "next/link";
import { after } from "next/server";
import { ArrowUp, Check, ChevronDown, Lightbulb, ListPlus, Repeat, Send, SlidersHorizontal, Sparkles, X } from "lucide-react";
import {
  anderesThemaAction,
  beispieleAction,
  einfacherAction,
  einfacherKiAction,
  kontrolleWeglassenAction,
  nachschubVerwerfenAction,
  schwererKiAction,
  schwererKiDruckenAction,
  schwererKiSendenAction,
  schwererSendenAction,
  themaVerstandenAction,
} from "@/app/cockpit-actions";
import { VorschlagKnopf } from "@/components/cockpit/CockpitClient";
import { NachschubLaeuft, NachschubVorschau } from "@/components/cockpit/Nachschub";
import { Reveal } from "@/components/ui";
import { frageText, loesungText, type CockpitDaten } from "@/lib/cockpit";
import { erstelleNachschub, nachschubAnzeige, type NachschubAnzeige } from "@/lib/ki-nachschub";
import { getStudent } from "@/lib/repo";
import { einfacherKiAngebot, KNOPF_LABEL, schwererBedarf, schwererVorschau, TEXT_QUELLE, themenZurWahl, type Beispiel, type KnopfEintrag } from "@/lib/knoepfe";
import { getUnit } from "@/lib/units";

/** Die Uhrzeit eines Eintrags in Wien („14:32“); gespeichert ist UTC (datetime('now')). */
const uhrzeit = (at: string) => new Date(`${at.replace(" ", "T")}Z`).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });

/** Ein Knopf, der (noch) nicht geht: grau, mit dem Grund als Titel. */
function Aus({ icon, label, grund }: { icon: React.ReactNode; label: string; grund: string }) {
  return (
    <button type="button" className="btn btn-secondary w-full sm:w-fit" disabled title={grund}>
      {icon} {label}
    </button>
  );
}

/**
 * **Anpassen** am Schritt (lib/knoepfe.ts): ein Knopf in der Reihe von Weiter, Wiederholen und „versteht es nicht“, der die fünf
 * Lehrer-Knöpfe aufklappt. Zugeklappt eine Zeile; aufgeklappt nimmt er auf dem Laptop die ganze Breite. Alles ohne KI; nur
 * „Einfacher erklären“ bietet danach die KI an, wenn nichts Einfacheres gespeichert ist, mit Kosten.
 */
export function AnpassenMenue({ unitId, schrittId, skill, thema, offen = false }: { unitId: number; schrittId: number; skill: boolean; thema: boolean; offen?: boolean }) {
  const ohne = "Zu diesem Schritt gibt es keine Fähigkeit.";
  const vorschau = (k: "schwerer" | "thema") => `/einheiten/${unitId}?knopf=${k}#knopf`;
  // the reason for grey buttons as a line, not only as a tooltip (a tablet shows no tooltip)
  const grund =
    !skill && !thema
      ? "Zu diesem Schritt gibt es keine Fähigkeit und kein Thema. Hier geht nur „Anderes Thema“."
      : !skill
        ? "Zu diesem Schritt gibt es keine Fähigkeit. Hier gehen nur „Thema verstanden“ und „Anderes Thema“."
        : !thema
          ? "Dieser Schritt gehört zu keinem Thema. Darum geht „Thema verstanden“ hier nicht."
          : null;
  return (
    <details className="group w-full sm:w-auto sm:open:basis-full" open={offen} data-testid="anpassen-menue">
      <summary className="btn btn-secondary btn-lg w-full list-none sm:w-auto [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal size={18} aria-hidden /> Anpassen
        <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-2 grid gap-2 rounded-xl border border-line p-2 sm:flex sm:flex-wrap" data-testid="anpassen-knoepfe">
        {skill ? (
          <VorschlagKnopf action={einfacherAction.bind(null, unitId, schrittId)} label={KNOPF_LABEL.einfacher} icon={<Lightbulb size={17} aria-hidden />} testid="knopf-einfacher" laeuft="Einen Moment …" />
        ) : (
          <Aus icon={<Lightbulb size={17} aria-hidden />} label={KNOPF_LABEL.einfacher} grund={ohne} />
        )}
        {skill ? (
          <VorschlagKnopf action={beispieleAction.bind(null, unitId, schrittId)} label={KNOPF_LABEL.beispiele} icon={<ListPlus size={17} aria-hidden />} testid="knopf-beispiele" laeuft="Einen Moment …" />
        ) : (
          <Aus icon={<ListPlus size={17} aria-hidden />} label={KNOPF_LABEL.beispiele} grund={ohne} />
        )}
        {skill ? (
          <Link href={vorschau("schwerer")} className="btn btn-secondary w-full sm:w-fit" data-testid="knopf-schwerer">
            <ArrowUp size={17} aria-hidden /> {KNOPF_LABEL.schwerer}
          </Link>
        ) : (
          <Aus icon={<ArrowUp size={17} aria-hidden />} label={KNOPF_LABEL.schwerer} grund={ohne} />
        )}
        {thema ? (
          <VorschlagKnopf action={themaVerstandenAction.bind(null, unitId, schrittId)} label={KNOPF_LABEL.verstanden} icon={<Check size={17} aria-hidden />} testid="knopf-verstanden" laeuft="Einen Moment …" />
        ) : (
          <Aus icon={<Check size={17} aria-hidden />} label={KNOPF_LABEL.verstanden} grund="Dieser Schritt gehört zu keinem Thema." />
        )}
        <Link href={vorschau("thema")} className="btn btn-secondary w-full sm:w-fit" data-testid="knopf-thema">
          <Repeat size={17} aria-hidden /> {KNOPF_LABEL.thema}
        </Link>
      </div>
      {grund && (
        <p className="mt-1.5 px-1 text-[13px] text-ink-3" data-testid="anpassen-grund">
          {grund}
        </p>
      )}
    </details>
  );
}

/** Ein durchgerechnetes Beispiel: Aufgabe groß, Lösung grün. */
function BeispielZeile({ b }: { b: Beispiel }) {
  return (
    <>
      <p className="text-[17px] leading-relaxed whitespace-pre-line">{b.aufgabe}</p>
      <p className="mt-0.5 text-[16px] leading-relaxed whitespace-pre-line">
        <span className="font-semibold text-green">Lösung: </span>
        {b.loesung}
      </p>
    </>
  );
}

const HERKUNFT: Record<Beispiel["herkunft"], string> = { generator: "neu aus dem Generator", bibliothek: "aus der Bibliothek", ki: "von der KI, Rechnung von der App geprüft" };

/**
 * „Einfacher:“ unter „Das sagst du“ (lib/knoepfe.ts `einfacherErklaeren`): der einfachere Text und ein neues Beispiel des letzten
 * Tippens; frühere darunter zugeklappt, der erste Text bleibt oben stehen. Ohne Text sagt die Karte das und bietet die KI an (mit
 * Kosten, nur wenn sie für diesen Schüler darf); ist die KI aus, nur der Satz.
 */
export function EinfacherBlock({ eintraege, unitId, studentId }: { eintraege: KnopfEintrag[]; unitId: number; studentId: number }) {
  const letzter = eintraege.at(-1);
  if (!letzter) return null;
  const frueher = eintraege.slice(0, -1).reverse();
  const e = letzter.inhalt;
  const b = e.beispiele?.[0] ?? null;
  const student = getStudent(studentId);
  const tor = student ? einfacherKiAngebot(letzter, student) : null;
  const kiKnopf = tor && (tor.erlaubt || tor.grund !== "Die KI ist aus.") ? tor : null;
  return (
    <div className="grid gap-2 rounded-xl bg-accent-wash px-3 py-2.5" data-testid="einfacher">
      <div>
        <p className="text-[13px] font-semibold text-accent">Einfacher:</p>
        {e.text ? (
          <>
            <p className="mt-0.5 text-[18px] leading-relaxed whitespace-pre-line">{e.text}</p>
            {e.quelle && <p className="mt-1 text-[12.5px] text-ink-3">{TEXT_QUELLE[e.quelle]}</p>}
          </>
        ) : (
          <div className="mt-0.5 grid gap-1.5" data-testid="einfacher-leer">
            <p className="text-[15px]">Dazu ist nichts Einfacheres gespeichert.</p>
            {kiKnopf && (
              <div className="grid gap-1" data-testid="einfacher-ki">
                <VorschlagKnopf
                  action={einfacherKiAction.bind(null, unitId, letzter.id)}
                  label={kiKnopf.erlaubt ? `Einfacher erklären lassen · ${kiKnopf.kosten}` : "Einfacher erklären lassen"}
                  icon={<Sparkles size={16} aria-hidden />}
                  gesperrt={!kiKnopf.erlaubt}
                  laeuft="Wird geschrieben …"
                />
                <p className="text-[13px] text-ink-3">{kiKnopf.erlaubt ? "Mit KI, einmal für diese Fähigkeit und Schulstufe; danach für jeden Schüler ohne Kosten." : kiKnopf.grund}</p>
              </div>
            )}
          </div>
        )}
      </div>
      {b ? (
        <div className="border-t border-accent/20 pt-2">
          <p className="text-[13px] text-ink-2">Neues Beispiel zum Vorrechnen, noch nicht gezeigt oder gesendet ({HERKUNFT[b.herkunft]})</p>
          <BeispielZeile b={b} />
        </div>
      ) : (
        <p className="text-[13.5px] text-ink-2">Ein neues Beispiel gibt es dazu ohne KI gerade nicht.</p>
      )}
      {frueher.length > 0 && (
        <Reveal label={`Vorher einfacher erklärt (${frueher.length})`}>
          <ul className="grid gap-2">
            {frueher.map((x) => (
              <li key={x.id} className="text-[15px] leading-relaxed whitespace-pre-line">
                {x.inhalt.text ?? "Kein einfacherer Text."}
                {x.inhalt.beispiele?.[0] && <span className="mt-0.5 block text-ink-2">Beispiel: {x.inhalt.beispiele[0].aufgabe}</span>}
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}

/** „Weitere Beispiele“ (lib/knoepfe.ts `weitereBeispiele`): alle, die zum Schritt geholt wurden, neueste zuerst. Nur für den Lehrer. */
export function BeispieleBlock({ eintraege }: { eintraege: KnopfEintrag[] }) {
  const alle = eintraege
    .slice()
    .reverse()
    .flatMap((e) => e.inhalt.beispiele ?? []);
  if (!alle.length) return null;
  return (
    <div className="rounded-xl border border-line px-3 py-2.5" data-testid="weitere-beispiele">
      <p className="text-[13px] font-semibold text-ink-2">Weitere Beispiele, nur für dich</p>
      <ol className="mt-1 grid gap-2.5">
        {alle.map((b, i) => (
          <li key={i}>
            <BeispielZeile b={b} />
            <p className="text-[12.5px] text-ink-3">{HERKUNFT[b.herkunft]}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Was die Knöpfe unter der Reihe zeigen (Anker `#knopf`): die Vorschau von „Schwerere Aufgaben“ mit Senden, die Wahl bei
 * „Anderes Thema“, nach „Thema verstanden“ auf der Lernkontrolle die Zeile mit „Lernkontrolle weglassen“, nach einem Wechsel woher.
 */
export function KnopfPanel({ c, unitId, schrittId, knopf, eintraege, name }: { c: CockpitDaten; unitId: number; schrittId: number; knopf: string | null; eintraege: KnopfEintrag[]; name: string }) {
  const verstanden = eintraege.filter((e) => e.art === "verstanden" && e.inhalt.kontrolle === schrittId).at(-1);
  const gewechselt = eintraege.filter((e) => e.art === "thema" && !e.inhalt.dazu && e.inhalt.ziel === schrittId).at(-1);
  const zurueck = (
    <Link href={`/einheiten/${unitId}#schritt`} className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-medium text-ink-2 hover:text-ink">
      <X size={15} aria-hidden /> Abbrechen
    </Link>
  );
  return (
    <div id="knopf" className="scroll-mt-4">
      {verstanden && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-green-wash px-3 py-2 text-[14.5px]" data-testid="thema-verstanden">
          <span>
            <span className="font-semibold text-green">Thema verstanden</span> · deine Entscheidung um {uhrzeit(verstanden.at)}. Die kurze Lernkontrolle bleibt.
          </span>
          <form action={kontrolleWeglassenAction.bind(null, unitId, verstanden.id)}>
            <button className="btn btn-ghost btn-sm min-h-[44px]" data-testid="kontrolle-weglassen">
              Lernkontrolle weglassen
            </button>
          </form>
        </div>
      )}
      {gewechselt && (
        <p className="mt-4 text-[14px] text-ink-2" data-testid="thema-gewechselt">
          Gewechselt{gewechselt.inhalt.von ? ` von ${gewechselt.inhalt.von}` : ""}: {gewechselt.inhalt.verschoben?.length ? "was dort offen war, kommt nächstes Mal." : "dort war nichts mehr offen."}
        </p>
      )}
      {knopf === "schwerer" && <SchwererVorschauKarte c={c} unitId={unitId} schrittId={schrittId} name={name} zurueck={zurueck} />}
      {knopf === "thema" && <ThemaWahlKarte c={c} unitId={unitId} schrittId={schrittId} zurueck={zurueck} />}
    </div>
  );
}

const QUELLE = { A: "aus dem Bestand", B: "neu aus dem Generator, ohne KI" } as const;

/**
 * „Schwerere Aufgaben“: die Aufgaben eine Stufe höher mit Lösung, erst „Senden“ schickt sie an den Schüler. Haben Bestand und
 * Generator auf dieser Stufe nichts, macht die KI sie (lib/knoepfe.ts `schwererBedarf`): auf Tippen mit Kosten, im KI-Budget der
 * Einheit von selbst; immer erst als Vorschau „neu erstellt, ungeprüft“ mit „Senden“, „Drucken“ und „Verwerfen“.
 */
function SchwererVorschauKarte({ c, unitId, schrittId, name, zurueck }: { c: CockpitDaten; unitId: number; schrittId: number; name: string; zurueck: React.ReactNode }) {
  const v = schwererVorschau(unitId, schrittId, c);
  const unit = getUnit(unitId);
  const b = "fehler" in v && v.option ? schwererBedarf(unitId, schrittId, v.option) : null;
  const ki = b && unit ? nachschubAnzeige(unitId, b, unit.student_id) : null;
  // within the unit's KI budget: asked without a further tap, after the page is shown (like lib/ki-nachschub.ts nachschubAutomatisch)
  if (ki?.gleich && b && unit) after(() => erstelleNachschub(unitId, b, { automatisch: true, teacherId: unit.teacher_id }));
  return (
    <section className="mt-4 grid gap-2 rounded-xl border border-accent/30 bg-accent-wash/60 px-3 py-3" aria-label={KNOPF_LABEL.schwerer} data-testid="schwerer-vorschau">
      <p className="text-[15px] font-semibold">{KNOPF_LABEL.schwerer}</p>
      {"fehler" in v ? (
        <>
          <p className="text-[14.5px]">{v.fehler}</p>
          {ki && <SchwererKi a={ki} unitId={unitId} schrittId={schrittId} name={name} />}
          {zurueck}
        </>
      ) : (
        <>
          <p className="text-[14px] text-ink-2">
            {v.skill}, Stufe {v.stufe} von 5, {QUELLE[v.quelle]}. Vorschau mit Lösung; {name} bekommt die Aufgaben erst mit „Senden“.
          </p>
          <ol className="grid gap-1.5">
            {v.aufgaben.map((a, j) => (
              <li key={j} className="grid grid-cols-[1.5rem_minmax(0,1fr)] text-[15px] leading-snug">
                <span className="num text-ink-3">{j + 1}.</span>
                <span>
                  <span className="whitespace-pre-line">{frageText(a)}</span>
                  <span className="block font-medium whitespace-pre-line text-green">{loesungText(a)}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <VorschlagKnopf action={schwererSendenAction.bind(null, unitId, schrittId)} label={`Senden (${v.aufgaben.length} ${v.aufgaben.length === 1 ? "Aufgabe" : "Aufgaben"})`} primary icon={<Send size={16} aria-hidden />} testid="schwerer-senden" />
            {zurueck}
          </div>
        </>
      )}
    </section>
  );
}

/** Die KI zu „Schwerere Aufgaben“: Vorschau, „wird erstellt“ oder „Schwerere Aufgaben erstellen · ca. 4 Cent“ mit dem Grund. */
function SchwererKi({ a, unitId, schrittId, name }: { a: NachschubAnzeige; unitId: number; schrittId: number; name: string }) {
  const n = a.eintrag;
  if (n?.status === "bereit")
    return (
      <NachschubVorschau
        n={n}
        name={name}
        aktionen={{ senden: schwererKiSendenAction.bind(null, unitId, schrittId, n.id), verwerfen: nachschubVerwerfenAction.bind(null, unitId, n.id), drucken: schwererKiDruckenAction.bind(null, unitId, schrittId, n.id) }}
      />
    );
  if (n?.status === "laeuft" || a.gleich) return <NachschubLaeuft automatisch={n?.automatisch ?? true} />;
  // with the KI off: only the line above
  if (!a.tor.ki.erlaubt && a.tor.ki.grund === "Die KI ist aus.") return null;
  return (
    <div className="grid gap-1" data-testid="schwerer-ki">
      <VorschlagKnopf
        action={schwererKiAction.bind(null, unitId, schrittId)}
        label={`Schwerere Aufgaben erstellen${a.kosten ? ` · ${a.kosten}` : ""}`}
        icon={<Sparkles size={16} aria-hidden />}
        gesperrt={!a.tor.ki.erlaubt}
        testid="schwerer-ki-erstellen"
        laeuft="Wird erstellt …"
      />
      <p className="text-[13px] text-ink-3">{a.hinweis ?? "Mit KI. Du siehst sie zuerst als Vorschau mit Lösungen."}</p>
    </div>
  );
}

/** „Anderes Thema“: die Themen zur Wahl; was vom Thema auf dem Schirm offen ist, kommt auf „Nächstes Mal“. */
function ThemaWahlKarte({ c, unitId, schrittId, zurueck }: { c: CockpitDaten; unitId: number; schrittId: number; zurueck: React.ReactNode }) {
  const wahl = themenZurWahl(unitId, c, schrittId);
  // with a chosen package: the package becomes a topic of the plan, its open steps go to „Nächstes Mal“ (lib/cockpit.ts paketAlsPlan)
  const jetzt = c.paket ? `dem Lernpaket „${c.paket.title}“` : (c.plan.find((x) => x.id === schrittId)?.thema ?? null);
  const anderesPaket = (
    <Link href={`/einheiten/${unitId}?bereich=cockpit#werkzeuge`} className="font-semibold text-accent underline-offset-2 hover:underline">
      Weitere Werkzeuge
    </Link>
  );
  return (
    <section className="mt-4 grid gap-2 rounded-xl border border-accent/30 bg-accent-wash/60 px-3 py-3" aria-label={KNOPF_LABEL.thema} data-testid="thema-wahl">
      <p className="text-[15px] font-semibold">{KNOPF_LABEL.thema}</p>
      {!wahl.length ? (
        c.paket ? (
          <p className="text-[14.5px]">Prüfung, Empfehlung und Plan nennen gerade kein anderes Thema. Ein anderes Lernpaket wählst du unter {anderesPaket}.</p>
        ) : (
          <p className="text-[14.5px]">Es gibt gerade kein anderes Thema: der Plan hat keines mehr offen, und Prüfung und Empfehlung nennen keines.</p>
        )
      ) : (
        <>
          <p className="text-[14px] text-ink-2">{jetzt ? `Was von ${jetzt} noch offen ist, kommt auf „Nächstes Mal“. Nichts wird gelöscht.` : "Der Plan geht mit dem gewählten Thema weiter."}</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {wahl.map((w) => (
              <li key={w.art === "plan" ? `p:${w.name}` : `s:${w.skillId}`}>
                <form action={anderesThemaAction.bind(null, unitId, schrittId)}>
                  <input type="hidden" name={w.art === "plan" ? "thema" : "skill_id"} value={w.art === "plan" ? w.name : w.skillId} />
                  <button className="flex min-h-[52px] w-full flex-col items-start justify-center rounded-xl border border-line bg-surface px-3 py-1.5 text-left hover:bg-panel" data-testid="thema-option">
                    <span className="text-[15px] font-semibold">{w.name}</span>
                    <span className="text-[13px] text-ink-2">
                      {w.warum}
                      {w.art === "plan" && w.minuten > 0 ? ` · ${w.minuten} Min.` : ""}
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {c.paket && <p className="text-[13px] text-ink-3">Ein anderes Lernpaket wählst du unter {anderesPaket}; es fängt von vorne an.</p>}
        </>
      )}
      {zurueck}
    </section>
  );
}
