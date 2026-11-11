/**
 * Die festen Listen für Spitznamen und Bilder (lib/spielprofil.ts). Ohne Datenbank, damit auch der Browser sie laden darf.
 */
export const NAME_VORNE = ["Blitz", "Sturm", "Nacht", "Sonnen", "Turbo", "Wolken", "Funken", "Stern", "Donner", "Nebel", "Feuer", "Eis", "Wind", "Gold", "Silber", "Mond", "Zauber", "Wirbel", "Kristall", "Komet"] as const;
export const NAME_HINTEN = ["fuchs", "eule", "krake", "panda", "kröte", "löwe", "falke", "otter", "wal", "drache", "tiger", "igel", "hase", "wolf", "bär", "luchs", "pinguin", "koala", "delfin", "rabe"] as const;

/** Die Bilder: Schlüssel → Tier. Schlüssel bleiben gleich, damit gespeicherte Profile gültig bleiben. */
export const BILDER: Record<string, string> = {
  fuchs: "🦊",
  eule: "🦉",
  krake: "🐙",
  panda: "🐼",
  kroete: "🐢",
  loewe: "🦁",
  tiger: "🐯",
  igel: "🦔",
  hase: "🐰",
  wolf: "🐺",
  baer: "🐻",
  pinguin: "🐧",
  koala: "🐨",
  delfin: "🐬",
  drache: "🐲",
  falke: "🦅",
};
export const BILD_SCHLUESSEL = Object.keys(BILDER);

