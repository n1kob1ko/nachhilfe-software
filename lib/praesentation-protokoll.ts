/**
 * The small message protocol between a presentation (in its sandboxed frame) and the app
 * (docs/praesentation-format.md, „Folien-Abgleich“). Used on the teacher's player, on the student device
 * and, as BRUECKE, inside every served HTML page. No Node imports: client components use it.
 *
 * deck → app:  { quelle: "lernheft-praesentation", v: 1, typ: "bereit", folien: n | null }
 *              { quelle: "lernheft-praesentation", v: 1, typ: "folie", folie: n, folien?: n | null, schritt?: k | null }
 * app → deck:  { quelle: "lernheft", v: 1, typ: "gehe-zu", folie: n, schritt?: k | null }
 *              { quelle: "lernheft", v: 1, typ: "weiter" }   and   { …, typ: "zurueck" }
 * folie counts from 1 through all slides; schritt is the animation step shown on the slide (reveal.js:
 * the fragment index from 0), null when none is shown yet.
 *
 * The deck runs in a sandbox without allow-same-origin, so its messages arrive with origin "null". The app
 * therefore accepts a message only from its own frame's window (event.source), with origin "null" (or the
 * presentation address, for a browser without sandbox), and only in exactly this shape.
 */

export const MAX_FOLIE = 500;
const MAX_SCHRITT = 200;

export type Stelle = { folie: number; schritt: number | null };
export type DeckNachricht = { typ: "bereit"; folien: number | null } | ({ typ: "folie"; folien: number | null } & Stelle);

const folienNr = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= MAX_FOLIE;
const schrittNr = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= MAX_SCHRITT;

/** A message of a deck in the protocol's shape, or null. Anything else (other scripts, wrong numbers) is ignored. */
export function leseDeckNachricht(data: unknown): DeckNachricht | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (d.quelle !== "lernheft-praesentation" || d.v !== 1) return null;
  const folien = folienNr(d.folien) ? d.folien : null;
  if (d.typ === "bereit") return { typ: "bereit", folien };
  if (d.typ === "folie" && folienNr(d.folie)) return { typ: "folie", folie: d.folie, folien, schritt: schrittNr(d.schritt) ? d.schritt : null };
  return null;
}

/** Is this message event from the deck in `frame`? */
export function vonDeck(e: Pick<MessageEvent, "origin" | "source">, frame: Window | null | undefined, deckOrigin: string | null): boolean {
  if (!frame || e.source !== frame) return false;
  return e.origin === "null" || (deckOrigin !== null && e.origin === deckOrigin);
}

/** The message that sends the deck to slide n (and an animation step on it). */
export const geheZu = (s: Stelle) => ({ quelle: "lernheft", v: 1, typ: "gehe-zu", folie: s.folie, schritt: s.schritt });
/** One step on or back, animations included (a presenter's clicker on the teacher's page). */
export const blaettern = (typ: "weiter" | "zurueck") => ({ quelle: "lernheft", v: 1, typ });

/**
 * Put into every served HTML page (before </body>). It speaks the protocol for reveal.js (a global
 * `Reveal` that is ready): it reports the slide (counted through, vertical slides included, from 1) and
 * the animation step, and follows „gehe-zu“, „weiter“ and „zurueck“. For any other deck it does nothing;
 * a deck can speak the protocol itself.
 */
export const BRUECKE = `(function(){
  if (window.parent === window) return;
  var R = null, versuche = 0;
  function sende(m){ m.quelle = "lernheft-praesentation"; m.v = 1; try { window.parent.postMessage(m, "*"); } catch (e) {} }
  function gesamt(){ try { var n = R.getTotalSlides(); return typeof n === "number" ? n : null; } catch (e) { return null; } }
  function melde(){
    try {
      var f = R.getIndices().f;
      sende({ typ: "folie", folie: R.getSlidePastCount() + 1, folien: gesamt(), schritt: typeof f === "number" && f >= 0 ? f : null });
    } catch (e) {}
  }
  function verbinde(){
    var r = window.Reveal;
    if (r && typeof r.isReady === "function" && r.isReady() && typeof r.on === "function" && typeof r.getSlides === "function") {
      R = r;
      R.on("slidechanged", melde); R.on("fragmentshown", melde); R.on("fragmenthidden", melde);
      sende({ typ: "bereit", folien: gesamt() }); melde(); return;
    }
    if (++versuche < 120) setTimeout(verbinde, 250);
  }
  window.addEventListener("message", function(e){
    if (e.source !== window.parent || !R) return;
    var d = e.data;
    if (!d || d.quelle !== "lernheft" || d.v !== 1) return;
    if (d.typ === "weiter") return R.next();
    if (d.typ === "zurueck") return R.prev();
    if (d.typ !== "gehe-zu") return;
    var n = d.folie;
    if (typeof n !== "number" || n < 1 || n % 1 !== 0) return;
    var folien = R.getSlides(), el = folien[Math.min(n, folien.length) - 1];
    if (!el) return;
    var i = R.getIndices(el);
    R.slide(i.h, i.v || 0, typeof d.schritt === "number" && d.schritt >= 0 ? d.schritt : -1);
  });
  verbinde();
})();`;
