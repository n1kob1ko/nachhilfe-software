"use client";

import { useEffect } from "react";

/** Alte Anker der Startseite, die jetzt unter Erweitert › Übersicht stehen. */
const UMGEZOGEN = new Set(["#offen", "#vorbereitung", "#terminanfragen"]);

/**
 * Leitet alte Lesezeichen wie `/#offen` oder `/#vorbereitung` zur Übersicht weiter. Der Anker kommt nie beim Server
 * an, deshalb hier im Browser.
 */
export function AlteAnker() {
  useEffect(() => {
    const anker = window.location.hash;
    if (UMGEZOGEN.has(anker)) window.location.replace(`/mehr/uebersicht${anker === "#terminanfragen" ? "?tab=woche" : ""}${anker}`);
  }, []);
  return null;
}
