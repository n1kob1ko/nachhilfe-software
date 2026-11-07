/**
 * **Erweitert** nach Rolle (Audit 2026-11-07): vorher sah jede Lehrkraft 26 Kacheln, darunter Räume, Lehrplan und
 * KI-Kosten, die nur die Verwaltung braucht. Jetzt stehen oben nur die Kacheln der eigenen Arbeit; alles andere bleibt
 * erreichbar, zugeklappt unter „Alles Weitere“ (niko, 25.10.2026: nichts wird gelöscht). Die Seiten selbst prüfen ihre
 * Rechte weiter selbst; diese Datei ordnet nur an. `icon` ist der Name des Lucide-Symbols (app/(tutor)/mehr/page.tsx).
 */
import { VORAUS_TAGE } from "./vorbereitung-auto";

export type ErweitertEintrag = { href: string; label: string; hint: string; icon: string };
export type ErweitertGruppe = {
  title: string;
  items: ErweitertEintrag[];
  /** zugeklappt, die Namen stehen in der Zeile */
  zu?: boolean;
};

export type ErweitertZahlen = { offen: number; offenesFeedback: number };

function eintraege(admin: boolean, z: ErweitertZahlen): Record<string, ErweitertEintrag> {
  return {
    schueler: { href: "/schueler", label: "Schüler", hint: "Profile, Lernstand, Lernverlauf, Prüfungen und Stoff", icon: "Users" },
    uebungen: { href: "/uebungen", label: "Übungen", hint: "Übungen erstellen, prüfen, freigeben und zuweisen", icon: "BookOpenCheck" },
    abrechnung: { href: "/abrechnung", label: "Abrechnung", hint: "Stattgefundene Einheiten pro Monat, auch als CSV", icon: "ReceiptText" },
    planung: {
      href: "/planung",
      label: "Planung",
      hint: admin ? "Wochenplan: generieren, verschieben, sperren, veröffentlichen und drucken" : "Der Wochenplan der Verwaltung, zum Nachschauen",
      icon: "CalendarDays",
    },
    woche: { href: "/mehr/uebersicht?tab=woche", label: "Meine Woche", hint: "Deine veröffentlichte Woche und Terminanfragen", icon: "CalendarRange" },
    offen: {
      href: "/mehr/uebersicht#offen",
      label: "Zu erledigen",
      hint: z.offen ? `${z.offen} offen: Prüfungen, Ergebnisse, Hausübungen, Texte` : "Nichts offen. Prüfungen, Ergebnisse, Hausübungen, Texte",
      icon: "ListTodo",
    },
    vorbereitung: { href: "/mehr/uebersicht#vorbereitung", label: `Vorbereitung: nächste ${VORAUS_TAGE} Tage`, hint: "Lernpaket je kommender Einheit: deine Wahl oder der Vorschlag der App", icon: "ClipboardList" },
    blaetter: { href: "/blaetter", label: "Blätter erstellen", hint: "Lesetabelle, Satzbaukasten und Nachmalblatt einstellen und drucken", icon: "FileText" },
    einheiten: { href: "/einheiten", label: "Alle Einheiten", hint: "Wer hat wann mit wem gearbeitet, pro Monat", icon: "Clock3" },
    lehrer: admin
      ? { href: "/lehrer", label: "Lehrer & Verfügbarkeit", hint: "Accounts und Rollen, Verfügbarkeit, Wochenziel und Raumwünsche aller Lehrer", icon: "CalendarClock" }
      : { href: "/lehrer", label: "Meine Verfügbarkeit", hint: "Wann du unterrichten kannst, Wochenziel und Raumwünsche", icon: "CalendarClock" },
    raeume: { href: "/mehr/raeume", label: "Räume", hint: "Gebäude, Raumname, vor Ort oder online", icon: "DoorOpen" },
    faecher: {
      href: "/mehr/faecher",
      label: "Fächer",
      hint: admin ? "Alle Schulfächer für Profil, Einheit und Schularbeit; eigene ergänzen" : "Alle Schulfächer, aus denen Profil, Einheit und Schularbeit wählen",
      icon: "BookOpen",
    },
    diagnose: { href: "/diagnose", label: "Diagnose", hint: "Stand eines Schülers mit 5 bis 10 Aufgaben prüfen", icon: "ListChecks" },
    bibliothek: { href: "/uebungen/bibliothek", label: "Aufgabenbibliothek", hint: "Gespeicherte Aufgaben suchen und wiederverwenden", icon: "Library" },
    lernpakete: { href: "/mehr/lernpakete", label: "Lernpakete", hint: "Vorbereitete Einheiten je Thema: Ablauf, Fragen, Aufgaben; anlegen, importieren, exportieren", icon: "Package" },
    praesentationen: { href: "/mehr/praesentationen", label: "Präsentationen", hint: "Folien mit Animationen und Vortragstext; hochladen, vortragen, am Schülergerät zeigen", icon: "MonitorPlay" },
    material: { href: "/mehr/material", label: "Material", hint: "Fotos und PDFs hochladen, einordnen, Aufgaben übernehmen", icon: "FolderUp" },
    referenzen: { href: "/mehr/referenzen", label: "Referenzsammlung", hint: "Aufgaben mit Quelle als Vorbild für die KI; nur für Lehrer", icon: "BookMarked" },
    geraete: { href: "/mehr/geraete", label: "Schülergeräte", hint: "Schüler-Tablet verbinden oder trennen", icon: "TabletSmartphone" },
    faehigkeiten: { href: "/faehigkeiten", label: "Themen und Fähigkeiten", hint: "Woran der Lernstand gemessen wird; eigene Fähigkeiten anlegen", icon: "GitBranch" },
    lehrplan: { href: "/mehr/lehrplan", label: "Curriculum / Lehrplan", hint: "Österreich, VS/MS/AHS/HTL/HAK, Quellen, Importe, Lizenzen", icon: "Landmark" },
    statistik: { href: "/mehr/statistik", label: "Statistik", hint: "Schwierige Fähigkeiten, Fehlerarten, Aufgabenqualität", icon: "BarChart3" },
    datenqualitaet: { href: "/mehr/datenqualitaet", label: "Datenqualität", hint: "Fähigkeiten zuordnen, Dubletten, Voraussetzungen korrigieren", icon: "ShieldCheck" },
    kiKosten: { href: "/mehr/ki-kosten", label: "KI-Kosten", hint: "Aufrufe, Tokens und Kosten pro Tag, Monat, Lehrer und Funktion", icon: "Coins" },
    passwort: { href: "/passwort", label: "Passwort ändern", hint: "Für dein Login", icon: "KeyRound" },
    feedback: {
      href: "/mehr/feedback",
      label: "Feedback",
      hint: admin ? `${z.offenesFeedback ? `${z.offenesFeedback} offen. ` : ""}Was Lehrkräfte melden: lesen, abhaken, weitergeben` : "Was du gemeldet hast und was schon erledigt ist",
      icon: "MessageSquarePlus",
    },
    export: { href: "/export", label: "Datenexport", hint: "Sicherung und Tabellen herunterladen", icon: "Download" },
    import: { href: "/mehr/import", label: "Import", hint: "Schüler und Lehrer aus einer CSV-Datei übernehmen, mit Vorschau vor dem Schreiben", icon: "FileUp" },
  };
}

/** Die Gruppen von Erweitert für diese Rolle; jede Adresse genau einmal. */
export function erweitertGruppen(teacher: { is_admin: number | boolean }, z: ErweitertZahlen): ErweitertGruppe[] {
  const admin = Boolean(teacher.is_admin);
  const e = eintraege(admin, z);
  const nimm = (...keys: string[]) => keys.map((k) => e[k]);
  if (admin)
    return [
      { title: "Arbeit", items: nimm("schueler", "uebungen", "planung", "abrechnung", "woche", "offen", "vorbereitung") },
      { title: "Verwaltung", items: nimm("lehrer", "raeume", "faecher", "lehrplan", "statistik", "datenqualitaet", "kiKosten", "feedback", "export", "import") },
      { title: "Unterricht und Material", zu: true, items: nimm("blaetter", "einheiten", "diagnose", "bibliothek", "lernpakete", "praesentationen", "material", "referenzen", "geraete", "faehigkeiten") },
      { title: "Konto", items: nimm("passwort") },
    ];
  return [
    { title: "Arbeit", items: nimm("schueler", "uebungen", "woche", "offen", "vorbereitung", "blaetter", "geraete", "lehrer") },
    { title: "Konto", items: nimm("passwort", "feedback") },
    {
      title: "Alles Weitere",
      zu: true,
      items: nimm("abrechnung", "planung", "einheiten", "diagnose", "bibliothek", "lernpakete", "praesentationen", "material", "referenzen", "faehigkeiten", "faecher", "raeume", "lehrplan", "statistik", "datenqualitaet", "kiKosten"),
    },
  ];
}
