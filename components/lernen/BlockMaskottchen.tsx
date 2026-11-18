"use client";

import "./blockwerk-bild.css";
import { useEffect } from "react";
import { STIMMUNGEN, stimmung } from "@/lib/blockwerk-stimmung";
import { spieleMusik } from "./musik";

/**
 * Das Maskottchen unter dem Brett von Blockwerk (lib/blockwerk-stimmung.ts sagt, welche Pose). Alle sechs Bilder
 * liegen übereinander und sind gleich geladen, gezeigt wird nur eines: so blitzt beim Wechsel nichts leer auf.
 * Nur Deko (aria-hidden), der Hinweis daneben sagt dasselbe in Worten.
 */
export function BlockMaskottchen(props: Parameters<typeof stimmung>[0]) {
  const jetzt = stimmung(props);
  return (
    <span className="bw-maskottchen" data-stimmung={jetzt} aria-hidden data-testid="bw-maskottchen">
      {STIMMUNGEN.map((s) => (
        <img key={s} src={`/spiele/blockwerk/maskottchen-${s}.webp`} alt="" width={288} height={288} data-an={s === jetzt ? "" : undefined} draggable={false} decoding="async" />
      ))}
    </span>
  );
}

/** Die Spielmusik von Blockwerk (musik.ts), solange das Spiel offen ist. */
export function BlockMusik() {
  useEffect(() => spieleMusik(), []);
  return null;
}
