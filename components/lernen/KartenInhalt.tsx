import type { ReactNode } from "react";
import { MathText } from "@/components/MathText";
import type { SpielKarte } from "@/lib/lernspiele-typen";

/**
 * Was auf einer Karte der Lernspiele steht (Lernspiel.tsx, WischFeld.tsx, RadFeld.tsx): ein Nomen, ein Satz mit Lücke
 * oder ein Satz mit markiertem Teil, dazu nach einer Antwort die Wahl in der Lücke (grün oder rot durchgestrichen).
 */

/** Nach einer Antwort: was gewählt wurde und ob es stimmt. */
export type Stand = { wahl: string; richtig: boolean } | null;

/** Mathe-Karten (`mathe`) werden gesetzt wie in den Übungen: Bruchstrich, Hochzahl, Wurzel. */
export const gesetzt = (karte: Pick<SpielKarte, "mathe">, text: string): ReactNode => (karte.mathe ? <MathText text={text} /> : text);
/** Der Satz mit eingesetzter Antwort; bei Präpositionen steht ein Leerzeichen vor dem Nomen, Endungen hängen am Wort. */
export const ohneStrich = (s: string) => s.replace(/^-/, "");

/** Eine Endung („-en“) hängt am Wort davor, alles andere steht als eigenes Wort in der Lücke. */
export const haengt = (karte: SpielKarte) => karte.richtig.startsWith("-");
/** Der Text hinter der Lücke: mit Leerzeichen davor, außer vor einem Satzzeichen oder wenn schon eines da ist. */
export const hinterLuecke = (karte: SpielKarte) => (haengt(karte) || /^[\s,.;:!?]/.test(karte.nach) || !karte.nach ? karte.nach : ` ${karte.nach}`);
/** Was in der Lücke steht, wenn die Antwort stimmt („sind“ für die Kiste „sein“, „Das“ am Satzanfang). */
export const eingesetzt = (karte: SpielKarte) => karte.einsatz ?? ohneStrich(karte.richtig);
/** Was bei einer falschen Wahl in der Lücke steht; beim Perfekt die passende Form („ich bin“ statt „ich sein“). */
const HILFSVERB_PAARE = [
  ["habe", "bin"],
  ["hast", "bist"],
  ["hat", "ist"],
  ["haben", "sind"],
  ["habt", "seid"],
];
export function falschEingesetzt(karte: SpielKarte, wahl: string) {
  const paar = karte.einsatz ? HILFSVERB_PAARE.find((p) => p.includes(karte.einsatz!.toLowerCase())) : undefined;
  if (paar && (wahl === "haben" || wahl === "sein")) return paar[wahl === "haben" ? 0 : 1];
  return ohneStrich(wahl);
}
/**
 * Der Inhalt einer Karte. `probe`: eine Wahl, die noch nicht geprüft ist, steht schon in der Lücke (das Drehrad setzt
 * sie beim Drehen ein, damit man den ganzen Satz liest).
 */
export function KartenInhalt({ karte, stand, probe }: { karte: SpielKarte; stand: Stand; probe?: string }) {
  if (karte.wort) {
    return (
      <>
        <p className="ls-wort">
          {stand && (
            <span className="ls-artikel" data-a={stand.richtig ? stand.wahl : undefined} style={stand.richtig ? undefined : { color: "var(--red)", textDecoration: "line-through" }}>
              {stand.wahl}
            </span>
          )}
          {karte.wort}
        </p>
        {karte.bedeutung && <p className="ls-bedeutung">({karte.bedeutung})</p>}
      </>
    );
  }
  if (karte.mitte !== undefined) {
    // ein markierter Teil statt einer Lücke; die Wahl steht danach als Schild unter dem Satz
    return (
      <>
        <p className="ls-satz">
          {karte.vor}
          <mark className="ls-markiert" data-stand={stand ? (stand.richtig ? "richtig" : "falsch") : undefined}>
            {karte.mitte}
          </mark>
          {karte.nach}
        </p>
        {stand && (
          <span className="ls-marke" data-falsch={stand.richtig ? undefined : ""}>
            {stand.wahl}
          </span>
        )}
      </>
    );
  }
  const h = haengt(karte);
  const luecke = (
    <span className="ls-luecke" data-haengt={h ? "" : undefined} data-stand={stand ? (stand.richtig ? "richtig" : "falsch") : undefined} data-probe={!stand && probe ? "" : undefined}>
      {stand
        ? gesetzt(karte, stand.richtig ? eingesetzt(karte) : falschEingesetzt(karte, stand.wahl))
        : probe
          ? gesetzt(karte, probe === karte.richtig ? eingesetzt(karte) : falschEingesetzt(karte, probe))
          : h
            ? "…"
            : "\u00a0"}
    </span>
  );
  // eine Endung hängt am Wort: Wort und Lücke brechen nie auseinander
  const vor = karte.vor.trimEnd();
  const trenn = h ? vor.lastIndexOf(" ") + 1 : vor.length;
  return (
    <>
      <p className="ls-satz" data-mathe={karte.mathe ? "" : undefined}>
        {gesetzt(karte, vor.slice(0, trenn))}
        {h ? (
          <span className="whitespace-nowrap">
            {vor.slice(trenn)}
            {luecke}
          </span>
        ) : (
          <>
            {vor ? " " : ""}
            {luecke}
          </>
        )}
        {gesetzt(karte, hinterLuecke(karte))}
      </p>
      {karte.hinweis && <p className="ls-bedeutung">{karte.hinweis}</p>}
      {stand?.richtig && karte.marke && <span className="ls-marke">{karte.marke}</span>}
    </>
  );
}
