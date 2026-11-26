import { unterrichtLaeuft } from "@/lib/unterrichtspause";

export const dynamic = "force-dynamic";

/**
 * Für das Warten vor einem Update (scripts/warte-auf-pause.mjs): `pause` ist true, wenn gerade keine Einheit läuft.
 * Nur ja oder nein, keine Namen und keine Zahl.
 */
export function GET() {
  let pause = true;
  try {
    pause = !unterrichtLaeuft();
  } catch {
    // ohne Datenbank gibt es auch keinen Unterricht, der gestört würde
  }
  return Response.json({ pause }, { headers: { "Cache-Control": "no-store" } });
}
