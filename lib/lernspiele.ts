/**
 * Lernspiele in der Schüler-App (niko 2026-11-11: „nicht nur da, sondern beim aktuellen Stoff helfen“).
 *
 * - **Welches Spiel**: die App wählt es nach dem Stoff des Schülers (`spielVorschlaege`), in dieser Reihenfolge:
 *   eine Prüfung in den nächsten 21 Tagen mit passender Fähigkeit, der aktuelle Stoff im Profil, die letzte
 *   Einheit (14 Tage), eine unsichere Fähigkeit im Lernstand, sonst das Fach (Deutsch-Spiele mit Deutsch, die
 *   Englisch-Spiele mit Englisch oder einer eigenen Vokabelliste, „Kopfrechnen“ und „Zahlenstrahl“ mit Mathematik).
 * - **Welche Karten**: aus den geprüften Aufgabenbanken (lib/lernspiele-karten.ts), Stufe nach Schulstufe und
 *   Lernstand, Fehler der letzten Runden kommen wieder. „Vokabel-Paare“ (Englisch) nimmt die eigenen Vokabellisten
 *   des Schülers, sonst eine Themenliste (`vokabelPlan`, lib/lernspiele-vokabeln.ts). Die Englisch-Spiele mit Kisten
 *   nehmen die Sätze der Englisch-Generatoren; „English Tenses“ und „English Grammar“ spielen je Runde ein Thema
 *   (`themenPlan`, lib/lernspiele-themen.ts). „Kopfrechnen“ (Mathe) ebenso, mit den Aufgaben der Mathe-Generatoren
 *   und eigenen Karten für die Volksschule (lib/lernspiele-mathe.ts); „Zahlenstrahl“ mit den Zahlenstrahlen der
 *   Aufgaben mit Bild (lib/lernspiele-strahl.ts).
 * - **Was zählt**: die erste Wahl je Karte. Der Server prüft sie an den Karten, die er beim Start gespeichert hat.
 *   Eine beendete Runde ist ein Beleg für den Lernstand mit Gewicht 1,5 (`SOURCE_WEIGHT.spiel`), so viel wie eine
 *   dokumentierte Stunde und viel weniger als die Aufgaben einer Übung. Abgebrochene Runden zählen nicht.
 */
import { parseTime } from "./analysis";
import { materialSkills, activeMaterial } from "./current-material";
import { db, json } from "./db";
import { BEHALTEN_SQL } from "./blockwerk-stand";
import { haeufigsteForm } from "./lernspiele-antwort";
import { hatSchreiben, mitSchreiben, schreibStand, ZUM_SCHREIBEN_JE_RUNDE, type SchreibSpur } from "./antwort-schreiben";
import { IRREGULAR_SKILL } from "./lernspiele-englisch";
import { KARTEN_JE_RUNDE, stufenFuer, waehleKarten } from "./lernspiele-karten";
import { istQuiz } from "./lernspiele-quiz";
import { SPIEL_THEMEN, spielbareThemen, THEMA_KARTEN_MIN, themaPasst, themenFuerStufe, themenKandidaten } from "./lernspiele-themen";
import { WORTFELDER, wortfeldArtikel, wortfeldPraeteritum, type Wortfeld } from "./lernspiele-wortfelder";
import { gemischt, istSpielArt, SPIEL_FACH, SPIEL_FORM, sterneFuer, type BestenZeile, type Bestenliste, type SpielAntwort, type SpielArt, type SpielForm, type SpielKarte, type SpielThema, type SpielVorschlag } from "./lernspiele-typen";
import { PAARE_MIN, vokabelKandidaten, vokabelKey, vokabelStufen, waehleVokabeln, type VokabelKandidat } from "./lernspiele-vokabeln";
import { tagAddieren, wienerDatum } from "./planung/zeit";
import * as repo from "./repo";
import { THEMEN } from "./themen";
import { leseListe } from "./vokabeln";
import { EIGENE_VOKABELN } from "./vokabeln-pruefen";
import { BILDER, darfMitspielen, erlaubnis, profilVon, sorgeFuerProfil } from "./spielprofil";
import { istFrisch, satzKandidaten, satzSkill, spielSatz, EIGENER_STOFF } from "./spielkarten";
import { FEHLER_SKILL, fehlerKandidaten, offeneFehlerZahl } from "./fehlerprotokoll";
import { listenVon, vokabelQuelle } from "./vokabellisten";
import { stufeFuer, type GlasThemaInfo } from "./glasklar";
import { GLAS_THEMEN, glasKandidaten, glasStufen, glasThema, sortenVon, STOFF_THEMA, stoffKandidaten, themaVonKey, waehleGlasKarten, type GlasKandidat } from "./glasklar-themen";
import { leseKarten } from "./spielkarten-text";
import { WOERTER_JE_STUFE } from "./wortschloss";
import { STOFF_WORT, stoffWoerter, VOKABEL_WORT, vokabelWoerter, waehleWortKarten, WORT_THEMEN, wortKandidaten, wortThemaVonKey, type WortKandidat } from "./wortschloss-themen";
import { VOKABEL_THEMEN } from "./vokabeln-themen";
import { fallKarten, MERKMALE, neuerFall, PHANTOM_SKILL } from "./phantombild";
import { BIOTEST_SKILL, biotestKarten, biotestStand as biotestStandAus } from "./biotest";
import { eintrag as bioEintrag, eintragKarten } from "./biolabor";
import { europaKarte } from "./europa";
import { levelStand as oeLevelStandAus, OE_SKILL, oeRunde, oeStand as oeStandAus, type OeWunsch } from "./oesterreich";
import { BIO_SKILL, bioRunde, bioStand, levelStand, themenStand, vonKey as bioVonKey, type BioAuswahl, type BioModus } from "./biolabor";
import { EUROPA_SKILL, europaRunde, europaStand as europaStandAus, grosserTest, LAENDER, LAENDER_JE_RUNDE, rennenKarten, sitzt, TYPISCHE_PAARE, verwechseltMit, verwechslerKarten, verwechslungen, vonKey as europaVonKey, waehleLaender, type EuropaThema, type LandStand, type Paar, type Region, type Teil, type TeilStand } from "./europa";
import { BLAETTER_JE_RUNDE, BLATT_SKILL, blattKarten, blattStand, PFLANZEN, vonKey, waehleBlaetter, type BlattModus, type BlattStand } from "./blaetter";
import { STANDARD_VORLAGE, unbekannte, VORLAGE_GESCHAFFT, VORLAGE_MAX, VORLAGE_STUFEN, vorlageRunde } from "./phantom-vorlage";
import { WORTARTEN_SKILL } from "./wortarten";
import { KONJUGIEREN_SKILL } from "./verben-beugen";
import { STIL_GRUPPEN, STIL_OBERSTUFE_AB, STIL_SKILLS, STIL_UNTERSTUFE, STILMITTEL, stilmittelBis, stilmittelKandidaten, stilmittelVonKarte, type StilGruppe, type StilmittelId } from "./stilmittel";

/** Die Fähigkeit, die ein Spiel übt, und welche Fähigkeiten im Stoff zu ihm führen. */
export const SPIEL_SKILL: Record<SpielArt, string> = {
  artikel: "deutsch.grammatik.artikel",
  // Volksschule: Nomen, Verb, Adjektiv (lib/wortarten-spiel.ts) und die Personalformen der Verben (lib/verben-beugen.ts)
  wortarten: WORTARTEN_SKILL,
  konjugieren: KONJUGIEREN_SKILL,
  praepositionen: "deutsch.grammatik.praepositionen",
  deklination: "deutsch.grammatik.adjektivdeklination",
  faelle: "deutsch.grammatik.faelle",
  dasdass: "deutsch.recht.dasdass",
  satzteile: "deutsch.satz.hauptsatz-gliedsatz",
  perfekt: "deutsch.grammatik.perfekt",
  praeteritum: "deutsch.grammatik.praeteritum",
  // Satzbau übt, wo das Verb steht: die Umstellprobe der Satzglieder (Volksschule: satzbauSkill)
  satzbau: "deutsch.satz.satzglieder",
  // Wortschatz: die Fähigkeit hängt am Wortfeld der Runde (themenPlan); ohne Runde die Wortfelder allgemein
  wortschatz: "deutsch.wortschatz.wortfelder",
  // Vokabel-Paare: die eigenen Listen; spielt jemand eine Themenliste, hängt die Fähigkeit an der Runde (vokabelPlan)
  vokabeln: EIGENE_VOKABELN,
  irregular: IRREGULAR_SKILL,
  // Themenspiele: die Fähigkeit hängt an der Runde (themenPlan); hier steht nur, was ohne Runde gilt
  zeiten: "englisch.tenses.mixed",
  grammatik: "englisch.grammar",
  rechnen: "mathe.kopfrechnen",
  strahl: "mathe.zahlenstrahl",
  // Dein Stoff: die Fähigkeit hängt am Satz Spielkarten (lib/spielkarten.ts)
  stoff: EIGENER_STOFF,
  // Glasklar: die Fähigkeit hängt am Thema der Runde (glasPlan); diese hier hat niemand im Lernstand
  glas: "spiel.glasklar",
  // Wortschloss: ebenso am Thema der Runde (wortThemen)
  wort: "spiel.wortschloss",
  // Phantombild und „Text lernen“ (lib/phantombild.ts): die Personenbeschreibung
  phantom: PHANTOM_SKILL,
  vorlage: PHANTOM_SKILL,
  // Blätter bestimmen (lib/blaetter.ts): Biologie, keine Fähigkeit aus dem Lehrplan
  blatt: BLATT_SKILL,
  // Europa (lib/europa.ts): Geografie, keine Fähigkeit aus dem Lehrplan
  europa: EUROPA_SKILL,
  // Biolabor (lib/biolabor.ts): Biologie, keine Fähigkeit aus dem Lehrplan
  bio: BIO_SKILL,
  // Bio Test De La Salle (lib/biotest.ts): Biologie, keine Fähigkeit aus dem Lehrplan
  biotest: BIOTEST_SKILL,
  // Österreich erobern (lib/oesterreich.ts): Geografie, keine Fähigkeit aus dem Lehrplan
  oesterreich: OE_SKILL,
  // Quiz: die Fähigkeit hängt am Thema der Runde (themenPlan); diese hier hat niemand im Lernstand
  quizmathe: "spiel.quiz.mathe",
  quizdeutsch: "spiel.quiz.deutsch",
  quizenglisch: "spiel.quiz.englisch",
  // Stilmittel: Unterstufe „Sprachliche Bilder“, Oberstufe je Karte die Gruppe (stilPlan, lib/stilmittel.ts)
  stilmittel: STIL_UNTERSTUFE,
  // Meine Fehler: das Fehlerprotokoll des Schülers (lib/fehlerprotokoll.ts), zählt für keine Fähigkeit im Lernstand
  fehler: FEHLER_SKILL,
};
/** Ab welcher Schulstufe ein Spiel zum Weiterüben angeboten wird (der Stoff selbst kann es früher bringen). */
const SPIEL_AB: Record<SpielArt, number> = { artikel: 1, wortarten: 2, konjugieren: 2, praepositionen: 3, deklination: 5, faelle: 5, dasdass: 5, satzteile: 5, perfekt: 4, praeteritum: 4, satzbau: 3, wortschatz: 3, vokabeln: 3, irregular: 6, zeiten: 5, grammatik: 5, rechnen: 1, strahl: 1, stoff: 1, glas: 99, wort: 99, quizmathe: 1, quizdeutsch: 1, quizenglisch: 3, stilmittel: 6, fehler: 99, phantom: 99, vorlage: 99, blatt: 99, europa: 99, bio: 99, biotest: 99, oesterreich: 99 };
/** Fähigkeiten im Stoff und die Spiele dazu, das passendste zuerst. Unterfähigkeiten („….ersatzprobe“) zählen mit. */
const FUEHRT_ZU: Record<string, SpielArt[]> = {
  "deutsch.grammatik.artikel": ["artikel"],
  "deutsch.grammatik.praepositionen": ["praepositionen"],
  // „Die vier Fälle“: Fälle bestimmen und der Fall nach der Präposition
  "deutsch.grammatik.faelle": ["faelle", "praepositionen"],
  "deutsch.grammatik.adjektivdeklination": ["deklination"],
  "deutsch.recht.dasdass": ["dasdass"],
  "deutsch.satz.hauptsatz-gliedsatz": ["satzteile", "satzbau"],
  "deutsch.satz.satzreihe-gefuege": ["satzteile", "satzbau"],
  "deutsch.satz.satzglieder": ["satzbau"],
  "deutsch.vs.sprache.satzglieder": ["satzbau"],
  "deutsch.grammatik.zeiten": ["perfekt", "praeteritum"],
  "deutsch.grammatik.perfekt": ["perfekt"],
  "deutsch.grammatik.praeteritum": ["praeteritum"],
  // jede Themenliste des Vokabeltrainers und die eigenen Listen
  ...Object.fromEntries([...Object.keys(VOKABEL_THEMEN), EIGENE_VOKABELN].map((id) => [id, ["vokabeln"] as SpielArt[]])),
  // Englisch: die unregelmäßigen Verben
  [IRREGULAR_SKILL]: ["irregular"],
  "englisch.tenses.pastsimple.irregular": ["irregular"],
  // die Themenspiele: jede Zeit, jedes Grammatik-Thema, jedes Thema von „Kopfrechnen“, „Zahlenstrahl“ und vom Quiz;
  // führt eine Fähigkeit zu mehreren, stehen alle da
  ...(Object.entries(SPIEL_THEMEN) as [SpielArt, SpielThema[]][]).reduce<Record<string, SpielArt[]>>((acc, [art, themen]) => {
    for (const id of themen.flatMap((t) => [t.skill, ...(t.auch ?? [])])) acc[id] = [...new Set([...(acc[id] ?? []), art])];
    return acc;
  }, {}),
  // Schreib-Themen (Gruselgeschichte, Märchen …): „Wortschatz“ mit dem Wortfeld, dazu „der, die, das“ und „Präteritum“
  // mit seinen Nomen und Verben (wortfeldAusStoff)
  ...Object.fromEntries(
    WORTFELDER.flatMap((w) => [w.skill, ...(w.auch ?? [])].map((id) => [id, (["wortschatz", "artikel", ...(w.verben.length ? ["praeteritum"] : [])] as SpielArt[])])),
  ),
  "deutsch.schreiben.erzaehlung": ["wortschatz"],
  "deutsch.vs.schreiben.erzaehlen": ["wortschatz"],
  "deutsch.wortschatz.wortfelder": ["wortschatz"],
  // Stilmittel: das eigene Spiel zuerst, das Deutsch-Quiz mit den Begriffen dazu
  ...Object.fromEntries(STIL_SKILLS.map((id) => [id, ["stilmittel", "quizdeutsch"] as SpielArt[]])),
  // Volksschule: Wortarten bestimmen und die Personalformen; nach den Quiz-Themen, damit das eigene Spiel vorne steht
  [WORTARTEN_SKILL]: ["wortarten", "quizdeutsch"],
  "deutsch.wortarten.nomen": ["wortarten", "artikel"],
  [KONJUGIEREN_SKILL]: ["konjugieren", "quizdeutsch"],
  "deutsch.vs.sprache.verbformen": ["konjugieren", "praeteritum", "perfekt"],
};

export const spieleZuSkills = (ids: string[]): SpielArt[] => [
  ...new Set(ids.flatMap((id) => Object.entries(FUEHRT_ZU).flatMap(([skill, arten]) => (id === skill || id.startsWith(`${skill}.`) ? arten : [])))),
];

const PRUEFUNG_TAGE = 21;
const EINHEIT_TAGE = 14;
const UNSICHER = 0.6;

/**
 * Welche Spiele gerade zum Stoff passen, das wichtigste zuerst; jedes Spiel einmal. `lernstand` ist der Lernstand
 * je Fähigkeit (lib/service.ts analyzeStudent), `heute` das Wiener Datum.
 */
export function spielVorschlaege(student: repo.Student, o: { heute: string; lernstand?: Map<string, number | null> }): SpielVorschlag[] {
  const out: SpielVorschlag[] = [];
  const add = (arten: SpielArt[], grund: string, quelle: SpielVorschlag["quelle"]) => {
    // ein Quiz ohne spielbare Themen gibt es nicht (noch keine Fragen in diesem Fach)
    for (const art of arten) if (!out.some((v) => v.art === art) && (!istQuiz(art) || spielbareThemen(art).length)) out.push({ art, grund, quelle });
  };

  // das Fehlerprotokoll (lib/fehlerprotokoll.ts): die eigenen Fehler, 5 Minuten am Anfang, solange welche offen sind
  if (offeneFehlerZahl(student.id) > 0) add(["fehler"], "Dein Fehlerprotokoll", "stoff");
  // eigene Spielkarten (lib/spielkarten.ts): die Lehrkraft hat sie für genau diesen Stoff geschrieben, darum zuerst
  const satz = spielSatz(student.id);
  const frisch = satz && istFrisch(satz, o.heute);
  if (satz && frisch) add(["stoff"], `Dein Stoff: ${satz.titel}`, "stoff");
  for (const q of stoffQuellen(student, o.heute)) add(spieleZuSkills(q.ids), q.grund, q.quelle);
  // eine eigene Vokabelliste ist aktueller Stoff: die Lehrkraft hat sie für genau diese Wörter angelegt
  if (eigeneVokabeln(student.id).length >= PAARE_MIN) add(["vokabeln"], "Deine Vokabelliste", "stoff");

  for (const art of Object.keys(SPIEL_SKILL) as SpielArt[]) {
    if (art === "glas" || art === "wort" || art === "fehler" || art === "phantom" || art === "vorlage" || art === "blatt" || art === "europa" || art === "bio" || art === "biotest" || art === "oesterreich" || istQuiz(art)) continue;
    const m = o.lernstand?.get(art === "satzbau" ? satzbauSkill(student) : art === "stilmittel" ? stilPlan(student, o.heute).skillId : SPIEL_SKILL[art]);
    if (m != null && m < UNSICHER) add([art], "Da bist du noch unsicher", "lernstand");
  }

  if (student.subjects.includes("Deutsch") || out.some((v) => SPIEL_FACH[v.art] === "Deutsch")) {
    // die übrigen zum Weiterüben; Artikel für die Kleinen zuerst, Endungen erst ab der Unterstufe
    const reihe: SpielArt[] = student.grade <= 4 ? ["wortarten", "konjugieren", "artikel", "satzbau", "praepositionen", "perfekt", "praeteritum", "wortschatz"] : ["praepositionen", "deklination", "faelle", "dasdass", "satzteile", "satzbau", "stilmittel", "perfekt", "praeteritum", "wortschatz", "artikel"];
    // ab der Oberstufe ist die Grammatik der Unterstufe kein Stoff mehr: das Quiz mit den Themen der Schulstufe und die
    // Stilmittel (Textanalyse, Interpretation) zuerst
    if (student.grade >= 9) add(["quizdeutsch", "stilmittel"], "Zum Üben", "fach");
    add(
      reihe.filter((art) => student.grade >= SPIEL_AB[art]),
      "Zum Üben",
      "fach",
    );
    add(["quizdeutsch"], "Zum Üben", "fach");
  }
  if (student.subjects.includes("Englisch")) {
    if (student.grade >= 9) add(["quizenglisch"], "Zum Üben", "fach");
    add(
      (["vokabeln", "irregular", "zeiten", "grammatik", "quizenglisch"] as SpielArt[]).filter((art) => student.grade >= SPIEL_AB[art]),
      "Zum Üben",
      "fach",
    );
  }
  if (student.subjects.includes("Mathematik")) add(student.grade >= 9 ? ["quizmathe", "rechnen", "strahl"] : ["rechnen", "quizmathe", "strahl"], "Zum Üben", "fach");
  // ältere Spielkarten bleiben zum Wiederholen
  if (satz && !frisch) add(["stoff"], "Zum Wiederholen", "fach");
  return out;
}

/**
 * Der Stoff des Schülers als Fähigkeiten, das Dringendste zuerst: Prüfungen der nächsten 21 Tage, der aktuelle Stoff
 * im Profil, die letzte Einheit (14 Tage).
 */
function stoffQuellen(student: repo.Student, heute: string): { ids: string[]; grund: string; quelle: SpielVorschlag["quelle"] }[] {
  const out: { ids: string[]; grund: string; quelle: SpielVorschlag["quelle"] }[] = [];
  const bis = tagAddieren(heute, PRUEFUNG_TAGE);
  const pruefungen = repo
    .listTests(student.id)
    .filter((t) => (t.status ?? "geplant") === "geplant" && t.date >= heute && t.date <= bis)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const t of pruefungen) {
    const tage = Math.round((Date.parse(t.date) - Date.parse(heute)) / 86_400_000);
    const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
    out.push({ ids: t.skill_ids, grund: `${t.title || t.kind || "Prüfung"} ${wann}`, quelle: "pruefung" });
  }
  for (const m of activeMaterial(student.id)) out.push({ ids: materialSkills(m, student).ids, grund: "Dein aktueller Stoff", quelle: "stoff" });
  const seit = tagAddieren(heute, -EINHEIT_TAGE);
  const letzte = repo
    .listLessons(student.id)
    .filter((l) => l.kind === "stunde" && l.starts_at.slice(0, 10) >= seit)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  if (letzte) out.push({ ids: letzte.skill_ids, grund: "Aus deiner letzten Einheit", quelle: "einheit" });
  return out;
}

// ---------- Vokabel-Paare: welche Wörter ----------

/** Die spielbaren Wörter der eigenen Listen (alle Listen, jedes Paar einmal). */
const eigeneVokabeln = (studentId: number): VokabelKandidat[] => vokabelKandidaten(vokabelQuelle(studentId).eintraege, EIGENE_VOKABELN);

const istVolksschule = (student: Pick<repo.Student, "grade" | "school_type">) => student.school_type === "Volksschule" || student.grade <= 4;
/** Die Themenlisten für die Schulart, in der Reihenfolge des Vokabeltrainers. */
export const vokabelThemen = (volksschule: boolean): string[] => Object.keys(VOKABEL_THEMEN).filter((id) => id.includes(".vs.") === volksschule);
/** „Wortschatz: Familie“ → „Familie“ */
export const themaName = (skillId: string) => (THEMEN.find((t) => t.id === skillId)?.name ?? "Vokabeln").replace(/^Wortschatz:\s*/, "");

/** So gut muss eine Runde sein, damit sie für „Thema geschafft“ zählt, und so viele solche Runden braucht es. */
const THEMA_ANTEIL = 0.8;
const THEMA_RUNDEN = 2;

export type VokabelPlan = {
  /** die Fähigkeit der Runde: die eigenen Listen oder das Thema */
  skillId: string;
  eigene: boolean;
  /** für den Schüler: „Deine Liste „Unit 3““ oder „Thema: Familie“ */
  titel: string;
  pool: VokabelKandidat[];
  /** eigene Listen: die Wörter der neuesten Liste kommen zuerst */
  vorrang?: Set<string>;
};

/**
 * Welche Wörter die nächste Runde „Vokabel-Paare“ hat. Hat der Schüler eigene Listen (mindestens vier Wörter), spielt
 * er sie; die neueste zuerst. Sonst eine Themenliste: ein Thema aus seinem Stoff, sonst das erste Thema seiner
 * Schulart, das er noch nicht geschafft hat (zwei Runden mit mindestens 80 %). Sind alle geschafft, das Thema, das am
 * längsten her ist.
 */
export function vokabelPlan(student: repo.Student, heute: string): VokabelPlan {
  const eigene = eigeneVokabeln(student.id);
  if (eigene.length >= PAARE_MIN) {
    const listen = listenVon(student.id);
    const neueste = listen[0];
    return {
      skillId: EIGENE_VOKABELN,
      eigene: true,
      titel: listen.length === 1 ? `Deine Liste „${neueste.title}“` : "Deine Vokabellisten",
      pool: eigene,
      vorrang: listen.length > 1 ? new Set(leseListe(neueste.text).eintraege.map(vokabelKey)) : undefined,
    };
  }
  const ausStoff = stoffQuellen(student, heute)
    .flatMap((q) => q.ids)
    .map((id) => Object.keys(VOKABEL_THEMEN).find((thema) => id === thema || id.startsWith(`${thema}.`)))
    .find((id): id is string => Boolean(id));
  const skillId = ausStoff ?? naechstesThema(student);
  return { skillId, eigene: false, titel: `Thema: ${themaName(skillId)}`, pool: vokabelKandidaten(VOKABEL_THEMEN[skillId], skillId) };
}

const naechstesThema = (student: repo.Student): string => naechstesOffene(student.id, "vokabeln", vokabelThemen(istVolksschule(student)));

/**
 * Das erste Thema der Liste, das noch nicht geschafft ist (zwei Runden mit mindestens 80 %); sind alle geschafft, das
 * Thema, das am längsten her ist.
 */
function naechstesOffene(studentId: number, art: SpielArt, themen: string[]): string {
  const runden = db()
    .prepare("SELECT id, skill_id, richtig, anzahl FROM spielrunden WHERE student_id = ? AND art = ? AND beendet_at IS NOT NULL AND anzahl > 0")
    .all(studentId, art) as { id: number; skill_id: string; richtig: number; anzahl: number }[];
  const gut = (thema: string) => runden.filter((r) => r.skill_id === thema && r.richtig / r.anzahl >= THEMA_ANTEIL).length;
  const offen = themen.find((thema) => gut(thema) < THEMA_RUNDEN);
  if (offen) return offen;
  const zuletzt = (thema: string) => Math.max(0, ...runden.filter((r) => r.skill_id === thema).map((r) => r.id));
  return [...themen].sort((a, b) => zuletzt(a) - zuletzt(b))[0];
}

// ---------- Themenspiele (English Tenses, English Grammar, Kopfrechnen, Zahlenstrahl): welches Thema ----------

export type ThemenPlan = { skillId: string; /** für den Schüler: „Thema: Past Simple“ */ titel: string };

/**
 * Welches Thema die nächste Runde eines Themenspiels hat: ein Thema aus dem Stoff des Schülers (Prüfung, aktueller
 * Stoff, letzte Einheit), sonst das erste Thema seiner Schulstufe, das er noch nicht geschafft hat (das Neueste zuerst).
 * null für Spiele ohne Themen.
 */
export function themenPlan(student: repo.Student, art: SpielArt, heute: string): ThemenPlan | null {
  if (!SPIEL_THEMEN[art]) return null;
  const themen = spielbareThemen(art);
  const ausStoff = stoffQuellen(student, heute)
    .flatMap((q) => q.ids)
    .map((id) => themen.find((t) => themaPasst(t, id)))
    .find((t): t is SpielThema => Boolean(t));
  const reihe = themenFuerStufe(art, student.grade, student.school_type);
  const thema = ausStoff ?? (reihe.length ? (reihe.find((t) => t.skill === naechstesOffene(student.id, art, reihe.map((t) => t.skill))) ?? reihe[0]) : undefined);
  if (!thema) return null;
  return { skillId: thema.skill, titel: `Thema: ${thema.name}` };
}

// ---------- Wortfelder: „der, die, das“ und „Präteritum“ mit den Wörtern des Schreib-Themas ----------

/**
 * Die Karten des Wortfelds aus dem Stoff für „der, die, das“ oder „Präteritum“ (niko 2026-11-12: „gruselgeschichte muss
 * der schüler lernen und dann bei den lernspielen sind es wörter die er für eine gruselgeschichte braucht“): das erste
 * Schreib-Thema im Stoff (Prüfung, aktueller Stoff, letzte Einheit) mit genug Wörtern. null: das gewöhnliche Spiel.
 */
export function wortfeldPlan(student: repo.Student, art: SpielArt, heute: string): { feld: Wortfeld; pool: ReturnType<typeof wortfeldArtikel>; titel: string } | null {
  if (art !== "artikel" && art !== "praeteritum") return null;
  const karten = art === "artikel" ? wortfeldArtikel : wortfeldPraeteritum;
  for (const id of stoffQuellen(student, heute).flatMap((q) => q.ids)) {
    const feld = WORTFELDER.find((w) => themaPasst(w, id));
    if (!feld) continue;
    const pool = karten(feld.skill);
    if (pool.length >= THEMA_KARTEN_MIN) return { feld, pool, titel: `Wörter für: ${feld.name}` };
  }
  return null;
}

/** Woher die Karten der nächsten Runde kommen, für den Schüler („Thema: Familie“, „Deine Liste …“); leer bei festen Spielen. */
export function spielWoher(student: repo.Student, art: SpielArt, heute: string): string | undefined {
  if (art === "vokabeln") return vokabelPlan(student, heute).titel;
  if (art === "stoff") return spielSatz(student.id)?.titel;
  if (art === "fehler") {
    const n = offeneFehlerZahl(student.id);
    return n === 1 ? "Noch 1 Fehler offen" : `Noch ${n} Fehler offen`;
  }
  if (art === "stilmittel") return stilPlan(student, heute).titel;
  return wortfeldPlan(student, art, heute)?.titel ?? themenPlan(student, art, heute)?.titel;
}

/** Die Kisten einer Karte des Themas, für den Anfang des Spiels (damit dort nicht „some, any“ steht, wenn es um if-Sätze geht). */
export function spielVorschau(student: repo.Student, art: SpielArt, heute: string): string[] | undefined {
  if (art === "stoff") {
    const satz = spielSatz(student.id);
    const wahl = satz ? satzKandidaten(satz).filter((k) => k.karte.form !== "reihe") : [];
    return wahl.map((k) => k.karte.faecher).sort((x, y) => x.join("").length - y.join("").length)[0];
  }
  if (art === "fehler") return fehlerKandidaten(student.id).map((k) => k.karte.faecher).sort((x, y) => x.join("").length - y.join("").length)[0];
  const plan = themenPlan(student, art, heute);
  if (!plan) return undefined;
  // von den ersten Karten die mit den kürzesten Aufschriften: drei kleine Kisten in einer Zeile
  const laenge = (f: string[]) => f.join("").length;
  return themenKandidaten(plan.skillId)
    .slice(0, 24)
    .map((k) => k.karte.faecher)
    .sort((x, y) => laenge(x) - laenge(y))[0];
}

/**
 * Wie die Karten der nächsten Runde beantwortet werden, wenn es am Thema hängt (lib/lernspiele-antwort.ts): bei
 * „Kopfrechnen“ der Ziffernblock, wo das Ergebnis eine Zahl ist, sonst die Kisten. Für den Anfang des Spiels.
 */
export function spielAntwort(student: repo.Student, art: SpielArt, heute: string): SpielForm | undefined {
  if (SPIEL_FORM[art]) return SPIEL_FORM[art];
  if (art === "stoff") {
    const satz = spielSatz(student.id);
    return satz ? haeufigsteForm(art, satzKandidaten(satz).map((k) => k.karte)) : undefined;
  }
  const plan = themenPlan(student, art, heute);
  if (!plan) return undefined;
  const stufen = stufenFuer(art, student.grade, null);
  const pool = themenKandidaten(plan.skillId);
  const passend = pool.filter((k) => stufen.includes(k.stufe));
  return haeufigsteForm(art, (passend.length ? passend : pool).map((k) => k.karte));
}

/** Satzbau in der Volksschule hängt an der Fähigkeit der Volksschule, sonst an der Umstellprobe der Unterstufe. */
const satzbauSkill = (student: Pick<repo.Student, "grade" | "school_type">) => (istVolksschule(student) ? "deutsch.vs.sprache.satzglieder" : SPIEL_SKILL.satzbau);

/** Die Fähigkeit, an der die nächste Runde eines Spiels hängt (für den Stand auf der Kachel und im Spiel). */
export function skillFuerSpiel(student: repo.Student, art: SpielArt, heute: string): string {
  if (art === "vokabeln") return vokabelPlan(student, heute).skillId;
  if (art === "satzbau") return satzbauSkill(student);
  if (art === "stilmittel") return stilPlan(student, heute).skillId;
  if (art === "fehler") return FEHLER_SKILL;
  if (art === "stoff") {
    const satz = spielSatz(student.id);
    return satz ? satzSkill(satz) : EIGENER_STOFF;
  }
  return themenPlan(student, art, heute)?.skillId ?? SPIEL_SKILL[art];
}

/** Karten für ein Duell „Vokabel-Paare“: eine Themenliste für die jüngere Schulstufe, für beide dieselbe. */
export function duellVokabeln(schulstufe: number, volksschule: boolean, rng: () => number = Math.random): SpielKarte[] {
  const themen = vokabelThemen(volksschule);
  const thema = themen[Math.floor(rng() * themen.length)];
  return waehleVokabeln(vokabelKandidaten(VOKABEL_THEMEN[thema], thema), { stufen: vokabelStufen(schulstufe, volksschule, null), rng });
}

/** Karten für ein Duell in einem Themenspiel: ein Thema, das für die jüngere Schulstufe schon dran war, für beide dasselbe. */
export function duellThema(art: SpielArt, schulstufe: number, rng: () => number = Math.random): SpielKarte[] {
  const themen = themenFuerStufe(art, schulstufe);
  const thema = themen[Math.floor(rng() * themen.length)];
  return waehleKarten(art, { pool: themenKandidaten(thema.skill), stufen: stufenFuer(art, schulstufe, null), rng });
}

// ---------- Glasklar: welches Thema (lib/glasklar-themen.ts) ----------

/** Ein Thema von Glasklar für diesen Schüler; `grund`: warum es gerade passt („Dein aktueller Stoff“). */
export type GlasWahl = GlasThemaInfo & { skill: string; grund?: string };

/** Die Spielkarten der Lehrkraft, wenn sie sich zu Gläsern sortieren lassen (sonst null). */
function glasStoff(studentId: number): { satz: NonNullable<ReturnType<typeof spielSatz>>; pool: GlasKandidat[] } | null {
  const satz = spielSatz(studentId);
  if (!satz) return null;
  const pool = stoffKandidaten(leseKarten(satz.text).karten, satzSkill(satz));
  return pool.length ? { satz, pool } : null;
}

/** Alle Begriffe eines Themas für diesen Schüler. */
function glasPool(student: repo.Student, thema: string): GlasKandidat[] {
  return thema === STOFF_THEMA ? (glasStoff(student.id)?.pool ?? []) : glasKandidaten(thema, student.grade);
}

/**
 * Die Themen von Glasklar, das passendste zuerst: die Spielkarten der Lehrkraft (wenn sie Gläser ergeben, in den ersten
 * 30 Tagen), Themen aus dem Stoff (Prüfung, aktueller Stoff, letzte Einheit), dann die Themen der Fächer des Schülers
 * für seine Schulstufe (das Neueste zuerst), ältere Spielkarten zum Schluss. Leer: Glasklar gibt es für ihn nicht.
 */
export function glasThemen(student: repo.Student, heute: string): GlasWahl[] {
  const out: GlasWahl[] = [];
  const add = (w: GlasWahl) => {
    if (!out.some((x) => x.id === w.id)) out.push(w);
  };
  const thema = (t: (typeof GLAS_THEMEN)[number], grund?: string): GlasWahl => ({ id: t.id, name: t.name, fach: t.fach, skill: t.skill, sorten: sortenVon(t.id, glasKandidaten(t.id, student.grade)).slice(0, 4), grund });
  const stoff = glasStoff(student.id);
  const stoffWahl = (grund: string): GlasWahl | null => (stoff ? { id: STOFF_THEMA, name: stoff.satz.titel || "Dein Stoff", fach: "Dein Stoff", skill: satzSkill(stoff.satz), sorten: sortenVon(STOFF_THEMA, stoff.pool).slice(0, 4), grund } : null);
  const frisch = stoff && istFrisch(stoff.satz, heute);
  if (frisch) add(stoffWahl(`Dein Stoff: ${stoff.satz.titel}`)!);
  for (const q of stoffQuellen(student, heute))
    for (const id of q.ids) for (const t of GLAS_THEMEN) if (themaPasst(t, id) && (t.fach !== "Englisch" || student.grade >= 5)) add(thema(t, q.grund));
  const passt = (t: (typeof GLAS_THEMEN)[number]) => t.ab <= student.grade && (t.bis ?? Infinity) >= student.grade;
  for (const fach of ["Deutsch", "Mathematik", "Englisch"] as const) {
    if (!student.subjects.includes(fach)) continue;
    const reihe = GLAS_THEMEN.map((t, i) => ({ t, i }))
      .filter(({ t }) => t.fach === fach && passt(t))
      .sort((a, b) => b.t.ab - a.t.ab || a.i - b.i);
    for (const { t } of reihe) add(thema(t));
  }
  if (stoff && !frisch) add(stoffWahl("Zum Wiederholen")!);
  return out;
}

/** Das Thema eines Glasklar-Spiels (die erste Runde trägt es in ihren Karten). */
function glasLaufThema(studentId: number, lauf: number): string | null {
  const z = db().prepare("SELECT karten FROM spielrunden WHERE id = ? AND student_id = ? AND art = 'glas'").get(lauf, studentId) as { karten: string } | undefined;
  return z ? themaVonKey(json<SpielKarte[]>(z.karten, [])[0]?.key ?? "") : null;
}

// ---------- Wortschloss: welches Thema (lib/wortschloss-themen.ts) ----------

/** Ein Thema von Wortschloss für diesen Schüler: `beispiel` zeigt, wie ein Hinweis aussieht; `grund`: warum es passt. */
export type WortWahl = { id: string; name: string; fach: string; skill: string; beispiel: string; grund?: string };
/** So viele Wörter braucht ein Thema, damit sich ein Spiel lohnt. */
const WORT_POOL_MIN = WOERTER_JE_STUFE + 2;

/** Die Spielkarten der Lehrkraft mit einem Wort als Antwort (sonst null). */
function wortStoff(studentId: number): { satz: NonNullable<ReturnType<typeof spielSatz>>; pool: WortKandidat[] } | null {
  const satz = spielSatz(studentId);
  if (!satz) return null;
  const pool = stoffWoerter(leseKarten(satz.text).karten, satzSkill(satz));
  return pool.length >= WORT_POOL_MIN ? { satz, pool } : null;
}

/** Vokabeln für Wortschloss: wie bei „Vokabel-Paare“ die eigene Liste oder eine Themenliste. */
function wortVokabeln(student: repo.Student, heute: string): { titel: string; skill: string; pool: WortKandidat[] } | null {
  if (!student.subjects.includes("Englisch") && eigeneVokabeln(student.id).length < PAARE_MIN) return null;
  const plan = vokabelPlan(student, heute);
  const pool = vokabelWoerter(plan.pool, plan.skillId);
  return pool.length >= WORT_POOL_MIN ? { titel: plan.titel, skill: plan.skillId, pool } : null;
}

/** Alle Wörter eines Themas für diesen Schüler. */
function wortPool(student: repo.Student, thema: string, heute: string): WortKandidat[] {
  if (thema === STOFF_WORT) return wortStoff(student.id)?.pool ?? [];
  if (thema === VOKABEL_WORT) return wortVokabeln(student, heute)?.pool ?? [];
  return wortKandidaten(thema);
}

/**
 * Die Themen von Wortschloss, das passendste zuerst: die Spielkarten der Lehrkraft (in den ersten 30 Tagen), die
 * eigene Vokabelliste, Themen aus dem Stoff, dann die Themen der Fächer für die Schulstufe (das Neueste zuerst), ältere
 * Spielkarten zum Schluss. Leer: Wortschloss gibt es für ihn nicht.
 */
export function wortThemen(student: repo.Student, heute: string): WortWahl[] {
  const out: WortWahl[] = [];
  const add = (w: WortWahl | null) => {
    if (w && !out.some((x) => x.id === w.id)) out.push(w);
  };
  const bsp = (pool: WortKandidat[]) => (pool[0] ? `${pool[0].karte.wort} → ${pool[0].karte.richtig}` : "");
  const thema = (t: (typeof WORT_THEMEN)[number], grund?: string): WortWahl => ({ id: t.id, name: t.name, fach: t.fach, skill: t.skill, beispiel: t.kurz, grund });
  const stoff = wortStoff(student.id);
  const stoffWahl = (grund: string): WortWahl | null => (stoff ? { id: STOFF_WORT, name: stoff.satz.titel || "Dein Stoff", fach: "Dein Stoff", skill: satzSkill(stoff.satz), beispiel: bsp(stoff.pool), grund } : null);
  const vok = wortVokabeln(student, heute);
  const vokWahl = (grund?: string): WortWahl | null => (vok ? { id: VOKABEL_WORT, name: vok.titel.startsWith("Thema: ") ? `Vokabeln: ${vok.titel.slice(7)}` : vok.titel, fach: "Englisch", skill: vok.skill, beispiel: bsp(vok.pool), grund } : null);
  const frisch = stoff && istFrisch(stoff.satz, heute);
  if (frisch) add(stoffWahl(`Dein Stoff: ${stoff.satz.titel}`));
  if (vok && vok.skill === EIGENE_VOKABELN) add(vokWahl("Deine Vokabelliste"));
  for (const q of stoffQuellen(student, heute))
    for (const id of q.ids) for (const t of WORT_THEMEN) if (themaPasst(t, id) && (t.fach !== "Englisch" || student.grade >= 5)) add(thema(t, q.grund));
  const passt = (t: (typeof WORT_THEMEN)[number]) => t.ab <= student.grade && (t.bis ?? Infinity) >= student.grade;
  for (const fach of ["Deutsch", "Englisch"] as const) {
    if (!student.subjects.includes(fach)) continue;
    if (fach === "Englisch") add(vokWahl());
    const reihe = WORT_THEMEN.map((t, i) => ({ t, i }))
      .filter(({ t }) => t.fach === fach && passt(t))
      .sort((a, b) => b.t.ab - a.t.ab || a.i - b.i);
    for (const { t } of reihe) add(thema(t));
  }
  if (stoff && !frisch) add(stoffWahl("Zum Wiederholen"));
  return out;
}

/** Das Thema eines Wortschloss-Spiels (die erste Runde trägt es in ihren Karten). */
function wortLaufThema(studentId: number, lauf: number): string | null {
  const z = db().prepare("SELECT karten FROM spielrunden WHERE id = ? AND student_id = ? AND art = 'wort'").get(lauf, studentId) as { karten: string } | undefined;
  return z ? wortThemaVonKey(json<SpielKarte[]>(z.karten, [])[0]?.key ?? "") : null;
}

// ---------- Phantombild (lib/phantombild.ts) und „Text lernen“ (lib/phantom-vorlage.ts) ----------

/** In diesen Schulstufen gibt es Phantombild für jeden mit Deutsch; sonst nur, wenn die Personenbeschreibung Stoff ist. */
export const PHANTOM_STUFEN = { ab: 4, bis: 8 } as const;

/**
 * Gibt es Phantombild für diesen Schüler, und warum gerade? null: nicht. `grund` steht auf der Kachel, wenn die
 * Personenbeschreibung gerade Stoff ist (Schularbeit, aktueller Stoff, letzte Einheit).
 */
export function phantomWahl(student: repo.Student, heute: string): { grund?: string } | null {
  for (const q of stoffQuellen(student, heute)) if (q.ids.some((id) => id === PHANTOM_SKILL || id.startsWith(`${PHANTOM_SKILL}.`))) return { grund: q.grund };
  const deutsch = student.subjects.includes("Deutsch");
  return deutsch && student.grade >= PHANTOM_STUFEN.ab && student.grade <= PHANTOM_STUFEN.bis ? {} : null;
}

const VORLAGE_SCHLUESSEL = "phantom_vorlage";
/** Die Vorlage zum Auswendiglernen: die der Lehrkraft, sonst die von Claude (lib/phantom-vorlage.ts). */
export function phantomVorlage(): { text: string; eigene: boolean } {
  const z = db().prepare("SELECT value FROM app_settings WHERE key = ?").get(VORLAGE_SCHLUESSEL) as { value: string } | undefined;
  return z?.value?.trim() ? { text: z.value, eigene: true } : { text: STANDARD_VORLAGE, eigene: false };
}
/** Speichert die Vorlage der Lehrkraft; leer: wieder die von Claude. Unbekannte Platzhalter werden nicht gespeichert. */
export function speichereVorlage(text: string): { ok: true } | { fehler: string } {
  const t = text.replace(/\r/g, "").trim();
  if (t.length > VORLAGE_MAX) return { fehler: `Die Vorlage ist zu lang (höchstens ${VORLAGE_MAX} Zeichen).` };
  const falsch = unbekannte(t);
  if (falsch.length) return { fehler: `Diese Platzhalter gibt es nicht: ${falsch.map((f) => `[${f}]`).join(", ")}.` };
  if (!t) db().prepare("DELETE FROM app_settings WHERE key = ?").run(VORLAGE_SCHLUESSEL);
  else db().prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(VORLAGE_SCHLUESSEL, t);
  return { ok: true };
}

/** Die höchste Stufe von „Text lernen“, die der Schüler geschafft hat (80 % beim ersten Versuch); 0: noch keine. */
export function vorlageGeschafft(studentId: number): number {
  const rows = db().prepare("SELECT karten, richtig, anzahl FROM spielrunden WHERE student_id = ? AND art = 'vorlage' AND beendet_at IS NOT NULL AND anzahl > 0").all(studentId) as { karten: string; richtig: number; anzahl: number }[];
  let best = 0;
  for (const r of rows) {
    if (r.richtig / r.anzahl < VORLAGE_GESCHAFFT) continue;
    const stufe = json<SpielKarte[]>(r.karten, [])[0]?.vorlage?.stufe ?? 0;
    if (stufe > best) best = stufe;
  }
  return Math.min(VORLAGE_STUFEN, best);
}

/** Merkmale, die in den letzten Fällen falsch waren („haarfarbe:rot“), damit sie wieder drankommen. */
function phantomVorrang(studentId: number): string[] {
  return offeneFehler(studentId, "phantom")
    .map((k) => /^phantom:([a-z]+):([a-z_]+)$/.exec(k))
    .filter((m): m is RegExpExecArray => !!m && MERKMALE.some((x) => x.id === m[1]))
    .map((m) => `${m[1]}:${m[2]}`);
}

// ---------- Blätter bestimmen (lib/blaetter.ts) ----------

/** So weit voraus zählt ein Biologie-Test, so weit zurück eine Biologie-Einheit. */
const BIO_TAGE = 60;
const istBio = (fach: string | null | undefined) => (fach ?? "").trim().toLocaleLowerCase("de-AT").startsWith("bio");

/**
 * Gibt es „Blätter bestimmen“ für diesen Schüler, und warum gerade? Für alle mit Biologie: im Profil, als geplanter Test
 * in den nächsten 60 Tagen (dann steht die Kachel oben, mit dem Test als Grund) oder als Einheit in den letzten 60
 * Tagen. Der Test-Schüler von „Spiele testen“ hat es immer. null: nicht.
 */
export function blaetterWahl(student: repo.Student, heute: string): { grund?: string } | null {
  const bis = tagAddieren(heute, BIO_TAGE);
  const test = repo
    .listTests(student.id)
    .filter((t) => (t.status ?? "geplant") === "geplant" && istBio(t.subject) && t.date >= heute && t.date <= bis)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (test) {
    const tage = Math.round((Date.parse(test.date) - Date.parse(heute)) / 86_400_000);
    const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
    return { grund: `${test.title || test.kind || "Biologie-Test"} ${wann}` };
  }
  if (student.spiele_test || student.subjects.some(istBio)) return {};
  const seit = tagAddieren(heute, -BIO_TAGE);
  return repo.listLessons(student.id).some((l) => istBio(l.subject) && l.starts_at.slice(0, 10) >= seit) ? {} : null;
}

/** Der Stand je Blatt aus allen beendeten Runden „Blätter bestimmen“ (lib/blaetter.ts blattStand). */
export function blaetterStand(studentId: number): Map<number, BlattStand> {
  const rows = db().prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = 'blatt' AND beendet_at IS NOT NULL ORDER BY id").all(studentId) as { antworten: string }[];
  return blattStand(rows.map((r) => ({ antworten: json<GespeicherteAntwort[]>(r.antworten, []) })));
}
/** Die Nummern der Blätter, die sicher sitzen. */
export const sichereBlaetter = (studentId: number): number[] => [...blaetterStand(studentId)].filter(([, s]) => s.sicher).map(([nr]) => nr).sort((a, b) => a - b);
/** Die Nummern der Blätter, die schon einmal dran waren. */
export const geseheneBlaetter = (studentId: number): number[] => [...blaetterStand(studentId).keys()].sort((a, b) => a - b);

// ---------- Biolabor (lib/biolabor.ts) ----------

/** Wörter im Test oder im Stoff, die zum Biolabor passen (Genetik, Nervensystem, Hormone). */
const BIO_STOFF = /genetik|vererb|mendel|dna|chromosom|gentechnik|blutgrupp|nerv|gehirn|hirn|sympathikus|hormon|reflex|der mensch/i;

/**
 * Gibt es das „Biolabor“ für diesen Schüler, und warum gerade? Es ist der Stoff der 4. Klasse (8. Schulstufe): für
 * Schüler mit Biologie ab der 7. Schulstufe (Profil, Biologie-Einheit in den letzten 60 Tagen) und für jeden mit einem
 * geplanten Biologie-Test in den nächsten 60 Tagen, der in diese Stufe fällt oder Genetik oder das Nervensystem als
 * Stoff hat (dann steht die Kachel ganz oben, mit dem Test als Grund). Der Test-Schüler von „Spiele testen“ hat es
 * immer. null: nicht.
 */
export function bioWahl(student: repo.Student, heute: string): { grund?: string } | null {
  const stufe = student.grade || 8;
  const bis = tagAddieren(heute, BIO_TAGE);
  const test = repo
    .listTests(student.id)
    .filter((t) => (t.status ?? "geplant") === "geplant" && istBio(t.subject) && t.date >= heute && t.date <= bis)
    .filter((t) => stufe >= 7 || BIO_STOFF.test([t.title ?? "", t.topic, ...(t.topics ?? []), t.notes].join(" ")))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (test) {
    const tage = Math.round((Date.parse(test.date) - Date.parse(heute)) / 86_400_000);
    const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
    return { grund: `${test.title || test.kind || "Biologie-Test"} ${wann}` };
  }
  if (student.spiele_test) return {};
  if (stufe < 7) return null;
  if (student.subjects.some(istBio)) return {};
  const seit = tagAddieren(heute, -BIO_TAGE);
  return repo.listLessons(student.id).some((l) => istBio(l.subject) && l.starts_at.slice(0, 10) >= seit) ? {} : null;
}

/** Der Stand je Eintrag aus allen beendeten Runden „Biolabor“. */
export function bioStandVon(studentId: number) {
  const rows = db().prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = 'bio' AND beendet_at IS NOT NULL ORDER BY id").all(studentId) as { antworten: string }[];
  return bioStand(rows.map((r) => ({ antworten: json<GespeicherteAntwort[]>(r.antworten, []) })));
}
/** Die Einträge, die sicher sitzen. */
export const bioSicher = (studentId: number): string[] => [...bioStandVon(studentId)].filter(([, s]) => s.sicher).map(([id]) => id);
/** Je Thema: sicher, gesehen, alle. */
export const bioThemenStand = (studentId: number) => themenStand(bioStandVon(studentId));
/** Die Labor-Mission: die besten Sterne je Level (lib/biolabor.ts levelStand). */
export function bioLevelStand(studentId: number): Record<number, number> {
  const rows = db().prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = 'bio' AND beendet_at IS NOT NULL ORDER BY id").all(studentId) as { antworten: string }[];
  return levelStand(rows.map((r) => ({ antworten: json<GespeicherteAntwort[]>(r.antworten, []) })));
}

// ---------- Bio Test 4.Klasse Vorbereitung De La Salle (lib/biotest.ts) ----------

/** Die Schule im Profil: De La Salle (Wien). */
const DE_LA_SALLE = /la\s*salle/i;

/**
 * Gibt es „Bio Test 4.Klasse Vorbereitung De La Salle“ für diesen Schüler, und warum gerade? Für Schüler mit der Schule
 * „De La Salle“ im Profil (niko 2026-11-23: die Übungen einer Lehrkraft dort) und für den Test-Schüler von „Spiele
 * testen“. Mit einem geplanten Biologie-Test in den nächsten 60 Tagen steht die Kachel ganz oben, mit dem Test als
 * Grund. null: nicht.
 */
export function biotestWahl(student: repo.Student, heute: string): { grund?: string } | null {
  if (!DE_LA_SALLE.test(student.school ?? "") && !student.spiele_test) return null;
  const bis = tagAddieren(heute, BIO_TAGE);
  const test = repo
    .listTests(student.id)
    .filter((t) => (t.status ?? "geplant") === "geplant" && istBio(t.subject) && t.date >= heute && t.date <= bis)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!test) return {};
  const tage = Math.round((Date.parse(test.date) - Date.parse(heute)) / 86_400_000);
  const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
  return { grund: `${test.title || test.kind || "Biologie-Test"} ${wann}` };
}

/** Je Stelle („übung:stelle“): sicher und zuletzt falsch, aus allen beendeten Runden. */
export function biotestStand(studentId: number): { sicher: string[]; falsch: string[] } {
  const rows = db().prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = 'biotest' AND beendet_at IS NOT NULL ORDER BY id").all(studentId) as { antworten: string }[];
  const st = biotestStandAus(rows.map((r) => ({ antworten: json<GespeicherteAntwort[]>(r.antworten, []) })));
  return { sicher: [...st].filter(([, x]) => x.sicher).map(([id]) => id), falsch: [...st].filter(([, x]) => x.zuletztFalsch).map(([id]) => id) };
}

// ---------- Europa (lib/europa.ts) ----------

/** Geografie: „Geografie“, „Geographie“, „GW“, „GWK“, „GWB“ (Geografie und wirtschaftliche Bildung), „Erdkunde“. */
const istGeo = (fach: string | null | undefined) => /^(geo|gw[bk]?\b|erdkunde)/i.test((fach ?? "").trim());

/**
 * „Europa“ gibt es für alle (Länder, Hauptstädte und Flaggen braucht jeder). Steht ein Geografie-Test in den nächsten
 * 60 Tagen an, kommt die Kachel ganz nach oben, mit dem Test als Grund.
 */
export function europaWahl(student: repo.Student, heute: string): { grund?: string } {
  const bis = tagAddieren(heute, BIO_TAGE);
  const test = repo
    .listTests(student.id)
    .filter((t) => (t.status ?? "geplant") === "geplant" && istGeo(t.subject) && t.date >= heute && t.date <= bis)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!test) return {};
  const tage = Math.round((Date.parse(test.date) - Date.parse(heute)) / 86_400_000);
  const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
  return { grund: `${test.title || test.kind || "Geografie-Test"} ${wann}` };
}

type EuropaZeile = { karten: string; antworten: string };
const europaRunden = (studentId: number) =>
  db().prepare("SELECT karten, antworten FROM spielrunden WHERE student_id = ? AND art = 'europa' AND beendet_at IS NOT NULL ORDER BY id").all(studentId) as EuropaZeile[];

/** Der Stand je Teil eines Landes aus allen beendeten Runden „Europa“ (auch Rennen und Duelle). */
export function europaStandVon(studentId: number): Map<string, TeilStand> {
  return europaStandAus(europaRunden(studentId).map((r) => ({ antworten: json<GespeicherteAntwort[]>(r.antworten, []) })));
}
/** Je Land die Teile, die sicher sitzen (alle drei: erobert). */
export const europaSitzt = (studentId: number): LandStand => sitzt(europaStandVon(studentId));
/** Die Länder, die schon einmal dran waren. */
export const europaGesehen = (studentId: number): string[] => [...new Set([...europaStandVon(studentId).keys()].map((k) => europaVonKey(k)?.code).filter((c): c is string => !!c))];

/** Was der Schüler verwechselt (die letzten 30 Runden), die häufigsten zuerst. */
export function europaVerwechsler(studentId: number): Paar[] {
  const rows = europaRunden(studentId).slice(-30);
  return verwechslungen(
    rows.map((r) => ({ karten: json<SpielKarte[]>(r.karten, []), antworten: json<GespeicherteAntwort[]>(r.antworten, []) })),
    europaStandVon(studentId),
  );
}

/** Die Rennen eines Schülers: bester Stand je Thema (richtige Antworten in 60 Sekunden). */
export function europaRekorde(studentId: number, ohne?: number): Record<Teil, number> {
  const rows = db()
    .prepare("SELECT id, karten, richtig FROM spielrunden WHERE student_id = ? AND art = 'europa' AND endlos = id AND beendet_at IS NOT NULL")
    .all(studentId) as { id: number; karten: string; richtig: number }[];
  const out: Record<Teil, number> = { lage: 0, hauptstadt: 0, flagge: 0 };
  for (const r of rows) {
    if (r.id === ohne) continue;
    const e = json<SpielKarte[]>(r.karten, [])[0]?.europa;
    if (e?.modus === "rennen" && e.thema && e.thema !== "alles") out[e.thema] = Math.max(out[e.thema], r.richtig);
  }
  return out;
}

/** Das Thema eines Rennens (null: die Runde ist kein Rennen). */
export function europaRennenThema(studentId: number, rundeId: number): Teil | null {
  const z = db().prepare("SELECT karten FROM spielrunden WHERE id = ? AND student_id = ? AND art = 'europa'").get(rundeId, studentId) as { karten: string } | undefined;
  const e = json<SpielKarte[]>(z?.karten ?? "[]", [])[0]?.europa;
  return e?.modus === "rennen" && e.thema && e.thema !== "alles" ? e.thema : null;
}

/** Was eine Runde „Europa“ braucht: Modus, beim Test und Rennen das Thema, und die Region (sonst ganz Europa). */
export type EuropaWunsch = { modus: "ueben" | "test" | "gross" | "rennen" | "verwechsler"; thema?: EuropaThema; region?: Region };

function europaKarten(student: repo.Student, w: EuropaWunsch, rng: () => number): SpielKarte[] {
  const codes = LAENDER.filter((l) => !w.region || l.region === w.region).map((l) => l.code);
  const stand = europaStandVon(student.id);
  if (w.modus === "gross") return grosserTest(codes, w.thema ?? "alles", rng);
  if (w.modus === "rennen") return rennenKarten(w.thema && w.thema !== "alles" ? w.thema : "lage", rng, codes);
  if (w.modus === "verwechsler") {
    const eigene = europaVerwechsler(student.id);
    // ohne eigene Verwechslungen (oder zu wenige): die typischen dazu
    const paare = [...eigene, ...TYPISCHE_PAARE.filter((p) => !eigene.some((e) => e.teil === p.teil && [e.a, e.b].sort().join() === [p.a, p.b].sort().join())).map((p) => ({ ...p, mal: 0 }))];
    return verwechslerKarten(paare, rng);
  }
  const wiederholen = offeneFehler(student.id, "europa", 3)
    .map((k) => europaVonKey(k.replace(/~\d+$/, ""))?.code)
    .filter((c): c is string => !!c);
  const laender = waehleLaender(stand, { anzahl: LAENDER_JE_RUNDE, wiederholen, codes, rng });
  return europaRunde(laender, w.modus, rng, verwechseltMit(europaVerwechsler(student.id)));
}

// ---------- Runden ----------

type Zeile = {
  id: number;
  student_id: number;
  art: string;
  skill_id: string;
  grund: string;
  karten: string;
  antworten: string;
  anzahl: number;
  richtig: number;
  created_at: string;
  beendet_at: string | null;
  endlos: number | null;
  bloecke: number | null;
};

type GespeicherteAntwort = SpielAntwort & { richtig: boolean };

/** Keys der Karten, die in den letzten beendeten Runden zuerst falsch waren und seither nicht richtig. */
export function offeneFehler(studentId: number, art: SpielArt, runden = 5): string[] {
  const rows = db()
    .prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = ? AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT ?")
    .all(studentId, art, runden) as { antworten: string }[];
  const erledigt = new Set<string>();
  const offen: string[] = [];
  for (const r of rows) {
    for (const a of json<GespeicherteAntwort[]>(r.antworten, [])) {
      if (a.richtig) erledigt.add(a.key);
      else if (!erledigt.has(a.key) && !offen.includes(a.key)) offen.push(a.key);
    }
  }
  // was in einer gerade laufenden Runde liegt (Endlos und die Bretter holen die nächste Runde, bevor die laufende fertig
  // ist), kommt dort ohnehin dran: nicht gleich in der nächsten noch einmal (niko 2026-11-22: „dieselbe Frage kommt wieder“)
  const laufend = db()
    .prepare("SELECT karten FROM spielrunden WHERE student_id = ? AND art = ? AND beendet_at IS NULL AND created_at >= datetime('now', '-2 hours')")
    .all(studentId, art) as { karten: string }[];
  const drin = new Set(laufend.flatMap((r) => json<SpielKarte[]>(r.karten, []).map((k) => k.key)));
  return offen.filter((key) => !drin.has(key));
}

/** So viele Runden zurück merkt sich ein Spiel, welche Karten dran waren (Blockwerk und Endlos hängen viele Runden aneinander). */
export const GESEHEN_RUNDEN = 40;

/**
 * Karten der letzten Runden, die neueste zuerst, jede einmal: kommen erst wieder, wenn alle anderen dran waren, und dann
 * die am längsten nicht gesehenen zuerst (außer als Fehler). niko 2026-11-16: „die fragen wiederholen sich mit der zeit“.
 */
export function zuletztGespielt(studentId: number, art: SpielArt): string[] {
  const rows = db().prepare("SELECT karten FROM spielrunden WHERE student_id = ? AND art = ? ORDER BY id DESC LIMIT ?").all(studentId, art, GESEHEN_RUNDEN) as { karten: string }[];
  return [...new Set(rows.flatMap((r) => json<SpielKarte[]>(r.karten, []).map((k) => k.key)))];
}

/**
 * Spiele mit eigenem Feld, die schon „wie im Test“ schreiben können (Europa, Blätter bestimmen, Biolabor): beim Üben
 * kommt dort eine Karte, die beim letzten Mal richtig war, zum Schreiben (`zumSchreibenEigen`).
 */
const EIGENES_SCHREIBEN: SpielArt[] = ["europa", "blatt", "bio"];

/** Wie eine Karte der eigenen Felder beantwortet wurde: geschrieben oder mit Auswahl. */
function eigeneForm(k: SpielKarte): SpielForm | undefined {
  return k.europa?.antwort === "schreiben" || k.blatt?.modus === "schreiben" || k.bio?.art === "schreiben" ? "schreiben" : "kacheln";
}

/**
 * Üben in Europa, Blätter bestimmen und Biolabor: was beim letzten Mal richtig war, kommt jetzt zum Selbstschreiben wie
 * im Test (Hauptstadt und Land zur Flagge schreiben, den Namen der Pflanze, den Begriff). Andere Karten bleiben.
 */
function zumSchreibenEigen(studentId: number, art: SpielArt, karten: SpielKarte[], rng: () => number): SpielKarte[] {
  const { schreiben } = schreibenFuer(studentId, art, eigeneForm);
  if (!schreiben.size) return karten;
  return karten.map((k) => {
    if (!schreiben.has(k.key) || eigeneForm(k) === "schreiben") return k;
    if (k.europa && k.europa.modus === "ueben") {
      const frage = k.europa.teil === "hauptstadt" ? { frage: "stadt" as const, antwort: "schreiben" as const } : k.europa.teil === "flagge" ? { frage: "flaggeLand" as const, antwort: "schreiben" as const } : k.europa.frage === "welches" ? { frage: "welches" as const, antwort: "schreiben" as const } : null;
      if (!frage) return k;
      const neu = europaKarte(k.europa.land, k.europa.teil, "ueben", rng, { frage });
      return neu ?? k;
    }
    if (k.blatt && k.blatt.modus === "kacheln") return { ...k, faecher: [k.richtig], blatt: { ...k.blatt, modus: "schreiben" } };
    if (k.bio && k.bio.art === "kacheln") {
      const e = bioEintrag(k.bio.eintrag);
      const neu = e ? eintragKarten(e, "test", rng).find((x) => x.key === k.key && x.bio?.art === "schreiben") : undefined;
      return neu?.bio ? { ...neu, bio: { ...neu.bio, modus: k.bio.modus } } : k;
    }
    return k;
  });
}

/** So viele beendete Runden zurück sucht `schreibenFuer` den letzten Stand jeder Karte. */
const SCHREIB_RUNDEN = 80;

/**
 * Welche Karten dieses Spiels zum Selbstschreiben kommen (lib/antwort-schreiben.ts): die, deren letzte Antwort richtig
 * war, und davon die, die noch nie geschrieben richtig waren (sie werden vorgezogen). Ohne die Karten, die gerade in
 * einer laufenden Runde liegen.
 */
export function schreibenFuer(studentId: number, art: SpielArt, formVon: (k: SpielKarte) => SpielForm | undefined = (k) => k.form): { schreiben: Set<string>; offen: string[] } {
  if (!hatSchreiben(art) && !EIGENES_SCHREIBEN.includes(art)) return { schreiben: new Set(), offen: [] };
  const rows = db()
    .prepare("SELECT karten, antworten FROM spielrunden WHERE student_id = ? AND art = ? AND beendet_at IS NOT NULL AND anzahl > 0 ORDER BY id DESC LIMIT ?")
    .all(studentId, art, SCHREIB_RUNDEN) as { karten: string; antworten: string }[];
  const runden: SchreibSpur[][] = rows.reverse().map((r) => {
    const form = new Map(json<SpielKarte[]>(r.karten, []).map((k) => [k.key, formVon(k)]));
    return json<GespeicherteAntwort[]>(r.antworten, []).map((a) => ({ key: a.key, form: form.get(a.key), richtig: a.richtig }));
  });
  const st = schreibStand(runden);
  const laufend = db()
    .prepare("SELECT karten FROM spielrunden WHERE student_id = ? AND art = ? AND beendet_at IS NULL AND created_at >= datetime('now', '-2 hours')")
    .all(studentId, art) as { karten: string }[];
  const drin = new Set(laufend.flatMap((r) => json<SpielKarte[]>(r.karten, []).map((k) => k.key)));
  return { schreiben: st.schreiben, offen: st.offen.filter((k) => !drin.has(k)) };
}

/** Startet eine Runde: wählt die Karten und merkt sie sich, damit das Ergebnis nur gegen sie geprüft wird. */
export function starteRunde(
  student: repo.Student,
  art: SpielArt,
  o: {
    grund?: SpielVorschlag["quelle"];
    lernstand?: number | null;
    rng?: () => number;
    heute?: string;
    /** Endlos-Modus: „neu“ beginnt ein Endlos-Spiel, eine Zahl setzt es fort (die id seiner ersten Runde) */
    endlos?: "neu" | number;
    /** Blockwerk: mit `endlos: "neu"` beginnt ein Blockwerk-Spiel statt eines Endlos-Spiels (die Runden hängen gleich aneinander) */
    bloecke?: boolean;
    /** Funkelfeld: wie `bloecke`, aber das Drei-in-einer-Reihe-Brett (components/lernen/FunkelFeld.tsx) */
    funkel?: boolean;
    /** Torlauf: wie `bloecke`, aber der Lauf durch Tore (components/lernen/TorLauf.tsx) */
    tor?: boolean;
    /** Glasklar: das gewünschte Thema (beim Fortsetzen bleibt es beim Thema des Spiels) */
    glasThema?: string;
    /** Wortschloss: ebenso */
    wortThema?: string;
    /** „Text lernen“: die gewünschte Stufe (1 bis 5; beim Fortsetzen die nächste) */
    vorlageStufe?: number;
    /** Blätter bestimmen: mit Kacheln oder geschrieben wie im Test, und ob alle Blätter (sonst `BLAETTER_JE_RUNDE`) */
    blatt?: { modus: BlattModus; alle?: boolean };
    /** Europa: Modus, Thema und Region (lib/europa.ts) */
    europa?: EuropaWunsch;
    /** Biolabor: Themen, Üben oder wie im Test, großer Test (lib/biolabor.ts) */
    bio?: { auswahl: BioAuswahl; modus: BioModus; gross?: boolean; schreiben?: boolean };
    /** Bio Test De La Salle: eine Übung, ganz oder nur diese Stellen (lib/biotest.ts) */
    biotest?: { uebung: string; nur?: string[] };
    /** Schwer (lib/antwort-schreiben.ts): jede Karte, die sich schreiben lässt, wird selbst geschrieben */
    schwer?: boolean;
    /** Torlauf: nur Auswahl (die Antworten sind Tore); auch beim Fortsetzen eines Torlaufs */
    ohneSchreiben?: boolean;
    /** Österreich erobern: ein Level, alle Begriffe oder die Fehler (lib/oesterreich.ts) */
    oe?: OeWunsch;
  } = {},
): { rundeId: number; karten: SpielKarte[]; endlos?: number; stufe?: number } {
  // nicht beendete Runden von gestern und früher räumen sich selbst weg, außer ein angefangenes Blockwerk-Spiel
  // (lib/blockwerk-stand.ts: es bleibt zum Weiterspielen)
  db().prepare(`DELETE FROM spielrunden WHERE student_id = ? AND beendet_at IS NULL AND duell_id IS NULL AND created_at < datetime('now', '-1 day') AND NOT (endlos IS NOT NULL AND ${BEHALTEN_SQL})`).run(student.id);
  let karten: SpielKarte[];
  // Selbstschreiben: was beim letzten Mal richtig war; zwei, die mit Auswahl richtig waren, kommen gleich wieder
  // (nach den Fehlern). Ein Torlauf (auch fortgesetzt) bleibt bei der Auswahl.
  const imTorlauf = o.ohneSchreiben || o.tor || (typeof o.endlos === "number" && !!db().prepare("SELECT 1 FROM spielrunden WHERE id = ? AND student_id = ? AND tor IS NOT NULL").get(o.endlos, student.id));
  const schreibPlan = imTorlauf ? null : schreibenFuer(student.id, art);
  const mitVorgezogen = (fehler: string[]) => (schreibPlan && !o.schwer ? [...fehler, ...schreibPlan.offen.filter((k) => !fehler.includes(k)).slice(0, ZUM_SCHREIBEN_JE_RUNDE)] : fehler);
  // Glasklar und Wortschloss: die wievielte Stufe (eine Runde je Stufe)
  let stufe: number | undefined;
  if (art === "glas") {
    const heute = o.heute ?? wienerDatum();
    const weiter = typeof o.endlos === "number" ? endlosLauf(student.id, art, o.endlos) : null;
    const themen = glasThemen(student, heute);
    const gewuenscht = weiter ? glasLaufThema(student.id, weiter) : o.glasThema;
    // ein Thema, das nicht (mehr) passt, wird durch das erste ersetzt; beim Fortsetzen bleibt es, solange es Begriffe hat
    const thema = (weiter && gewuenscht) || themen.find((t) => t.id === gewuenscht)?.id || themen[0]?.id;
    stufe = weiter ? (db().prepare("SELECT COUNT(*) AS n FROM spielrunden WHERE student_id = ? AND endlos = ?").get(student.id, weiter) as { n: number }).n + 1 : 1;
    karten = [];
    if (thema) {
      const pool = glasPool(student, thema);
      const groesse = stufeFuer(stufe);
      // reicht eine Sorte nicht für vier Begriffe (eigene Spielkarten), werden die Gläser niedriger
      for (let hoehe = groesse.hoehe; hoehe >= 3 && new Set(karten.map((k) => k.richtig)).size < 2; hoehe--) {
        karten = waehleGlasKarten(pool, {
          reihenfolge: sortenVon(thema, pool),
          sorten: groesse.sorten,
          hoehe,
          stufen: glasStufen(thema, student.grade, o.lernstand ?? null),
          wiederholen: offeneFehler(student.id, art),
          zuletzt: zuletztGespielt(student.id, art),
          rng: o.rng,
        });
      }
      if (new Set(karten.map((k) => k.richtig)).size < 2) karten = [];
    }
  } else if (art === "wort") {
    const heute = o.heute ?? wienerDatum();
    const weiter = typeof o.endlos === "number" ? endlosLauf(student.id, art, o.endlos) : null;
    const gewuenscht = weiter ? wortLaufThema(student.id, weiter) : o.wortThema;
    const thema = (weiter && gewuenscht) || wortThemen(student, heute).find((t) => t.id === gewuenscht)?.id || wortThemen(student, heute)[0]?.id;
    stufe = weiter ? (db().prepare("SELECT COUNT(*) AS n FROM spielrunden WHERE student_id = ? AND endlos = ?").get(student.id, weiter) as { n: number }).n + 1 : 1;
    karten = thema ? waehleWortKarten(wortPool(student, thema, heute), { stufe, wiederholen: offeneFehler(student.id, art), zuletzt: zuletztGespielt(student.id, art), rng: o.rng }) : [];
  } else if (art === "phantom") {
    // Phantombild: ein Fall je Stufe, die Stufen eines Spiels zählen weiter
    const weiter = typeof o.endlos === "number" ? endlosLauf(student.id, art, o.endlos) : null;
    stufe = weiter ? (db().prepare("SELECT COUNT(*) AS n FROM spielrunden WHERE student_id = ? AND endlos = ?").get(student.id, weiter) as { n: number }).n + 1 : 1;
    const rng = o.rng ?? Math.random;
    karten = fallKarten(neuerFall(rng, phantomVorrang(student.id)), stufe, rng);
  } else if (art === "vorlage") {
    // Text lernen: die Stufe wählt der Schüler (bis eine über der geschafften), beim Fortsetzen die nächste
    const weiter = typeof o.endlos === "number" ? endlosLauf(student.id, art, o.endlos) : null;
    const offen = Math.min(VORLAGE_STUFEN, vorlageGeschafft(student.id) + 1);
    if (weiter) {
      const letzte = db().prepare("SELECT karten FROM spielrunden WHERE student_id = ? AND endlos = ? ORDER BY id DESC LIMIT 1").get(student.id, weiter) as { karten: string } | undefined;
      stufe = Math.min(VORLAGE_STUFEN, (json<SpielKarte[]>(letzte?.karten ?? "[]", [])[0]?.vorlage?.stufe ?? 0) + 1);
    } else stufe = Math.min(offen, Math.max(1, Math.round(o.vorlageStufe ?? offen)));
    const rng = o.rng ?? Math.random;
    karten = vorlageRunde(phantomVorlage().text, neuerFall(rng), stufe, rng);
  } else if (art === "blatt") {
    // Blätter bestimmen: zuerst die zuletzt falschen, dann die noch nicht sicheren
    const rng = o.rng ?? Math.random;
    const wiederholen = offeneFehler(student.id, art, 3)
      .map((k) => vonKey(k)?.nr)
      .filter((nr): nr is number => nr !== undefined);
    const nrs = waehleBlaetter(blaetterStand(student.id), { anzahl: o.blatt?.alle ? PFLANZEN.length : BLAETTER_JE_RUNDE, wiederholen, rng });
    karten = blattKarten(nrs, o.blatt?.modus ?? "kacheln", rng);
    if ((o.blatt?.modus ?? "kacheln") === "kacheln") karten = zumSchreibenEigen(student.id, art, karten, rng);
  } else if (art === "europa") {
    karten = europaKarten(student, o.europa ?? { modus: "ueben" }, o.rng ?? Math.random);
    if ((o.europa?.modus ?? "ueben") === "ueben") karten = zumSchreibenEigen(student.id, art, karten, o.rng ?? Math.random);
  } else if (art === "bio") {
    // Biolabor: zuerst die zuletzt falschen, dann die noch nicht sicheren
    const wiederholen = [...new Set(offeneFehler(student.id, art, 3).map((k) => bioVonKey(k)).filter((id): id is string => !!id))];
    karten = bioRunde(bioStandVon(student.id), { auswahl: o.bio?.auswahl ?? "alle", modus: o.bio?.modus ?? "ueben", gross: o.bio?.gross, schreiben: o.bio?.schreiben, wiederholen, rng: o.rng ?? Math.random });
    if ((o.bio?.modus ?? "ueben") === "ueben" && !o.bio?.gross && !o.bio?.schreiben) karten = zumSchreibenEigen(student.id, art, karten, o.rng ?? Math.random);
  } else if (art === "biotest") {
    karten = o.biotest ? biotestKarten(o.biotest.uebung, o.biotest.nur) : [];
  } else if (art === "oesterreich") {
    karten = o.oe ? oeRunde(oeStandVon(student.id), o.oe, o.rng ?? Math.random) : [];
  } else if (art === "vokabeln") {
    const plan = vokabelPlan(student, o.heute ?? wienerDatum());
    karten = waehleVokabeln(plan.pool, {
      // eigene Listen haben keine Stufen: alle Wörter sind Stoff
      stufen: plan.eigene ? undefined : vokabelStufen(student.grade, istVolksschule(student), o.lernstand ?? null),
      wiederholen: offeneFehler(student.id, art),
      zuletzt: zuletztGespielt(student.id, art),
      vorrang: plan.vorrang,
      rng: o.rng,
    });
  } else if (art === "stilmittel") {
    karten = stilmittelRunde(student, o.heute ?? wienerDatum(), { lernstand: o.lernstand ?? null, rng: o.rng });
  } else if (art === "stoff") {
    // Dein Stoff: der aktuelle Satz Spielkarten, alle Karten gleich wichtig
    const satz = spielSatz(student.id);
    karten = satz
      ? waehleKarten(art, { pool: satzKandidaten(satz), stufen: [1], wiederholen: mitVorgezogen(offeneFehler(student.id, art)), zuletzt: zuletztGespielt(student.id, art), rng: o.rng })
      : [];
  } else if (art === "fehler") {
    // Meine Fehler: nur die, die noch nicht zweimal hintereinander richtig waren
    karten = waehleKarten(art, { pool: fehlerKandidaten(student.id), stufen: [1], wiederholen: mitVorgezogen(offeneFehler(student.id, art)), zuletzt: zuletztGespielt(student.id, art), rng: o.rng });
  } else {
    const heute = o.heute ?? wienerDatum();
    const plan = themenPlan(student, art, heute);
    karten = waehleKarten(art, {
      pool: plan ? themenKandidaten(plan.skillId) : wortfeldPlan(student, art, heute)?.pool,
      stufen: stufenFuer(art, student.grade, o.lernstand ?? null),
      wiederholen: mitVorgezogen(offeneFehler(student.id, art)),
      zuletzt: zuletztGespielt(student.id, art),
      rng: o.rng,
    });
  }
  if (schreibPlan) karten = mitSchreiben(art, karten, { schwer: o.schwer, schreiben: schreibPlan.schreiben });
  const r = db()
    .prepare("INSERT INTO spielrunden (student_id, art, skill_id, grund, karten, anzahl) VALUES (?, ?, ?, ?, ?, ?)")
    .run(
      student.id,
      art,
      art === "stilmittel" ? stilRundenSkill(student, karten, o.heute ?? wienerDatum()) : (karten[0]?.skill ?? (art === "satzbau" ? satzbauSkill(student) : SPIEL_SKILL[art])),
      o.grund ?? "fach",
      JSON.stringify(karten),
      karten.length,
    );
  const rundeId = Number(r.lastInsertRowid);
  if (o.endlos === undefined) return { rundeId, karten, stufe };
  // ein Endlos-Spiel setzt nur fort, wer es begonnen hat, und nur im selben Spiel
  const lauf = o.endlos === "neu" ? rundeId : endlosLauf(student.id, art, o.endlos) ?? rundeId;
  db().prepare("UPDATE spielrunden SET endlos = ? WHERE id = ?").run(lauf, rundeId);
  // Blockwerk und Glasklar: die erste Runde trägt die Punkte (später `laufPunkte`); eine Fortsetzung erbt das von ihr
  if (lauf === rundeId && o.bloecke) db().prepare("UPDATE spielrunden SET bloecke = 0 WHERE id = ?").run(rundeId);
  if (lauf === rundeId && o.funkel && !o.bloecke) db().prepare("UPDATE spielrunden SET funkel = 0 WHERE id = ?").run(rundeId);
  if (lauf === rundeId && o.tor && !o.bloecke && !o.funkel) db().prepare("UPDATE spielrunden SET tor = 0 WHERE id = ?").run(rundeId);
  if (lauf === rundeId && art === "glas") db().prepare("UPDATE spielrunden SET glas = 0 WHERE id = ?").run(rundeId);
  if (lauf === rundeId && art === "wort") db().prepare("UPDATE spielrunden SET wort = 0 WHERE id = ?").run(rundeId);
  if (lauf === rundeId && art === "phantom") db().prepare("UPDATE spielrunden SET phantom = 0 WHERE id = ?").run(rundeId);
  return { rundeId, karten, endlos: lauf, stufe };
}

/** Die id eines Endlos-Spiels dieses Schülers in diesem Spiel (null, wenn es es nicht gibt). */
function endlosLauf(studentId: number, art: SpielArt, lauf: number): number | null {
  const z = db().prepare("SELECT id FROM spielrunden WHERE id = ? AND student_id = ? AND art = ? AND endlos = id").get(lauf, studentId, art) as { id: number } | undefined;
  return z?.id ?? null;
}

/**
 * Endlos-Modus (niko 2026-11-12: „ein endless mode für spiele“): gespielt wird in gewöhnlichen Runden zu zwölf Karten,
 * die nahtlos aufeinander folgen, bis drei Herzen weg sind. Jede Runde zählt im Lernstand wie sonst; die letzte zählt
 * nur mit den Karten, die beantwortet wurden (`beendeRunde` mit `teil`). Der Stand eines Endlos-Spiels sind alle
 * Karten, die beim ersten Versuch richtig waren; der Rekord ist der beste Stand in diesem Spiel.
 */
export function endlosStand(studentId: number, lauf: number): number {
  const z = db().prepare("SELECT COALESCE(SUM(richtig), 0) AS n FROM spielrunden WHERE student_id = ? AND endlos = ? AND beendet_at IS NOT NULL").get(studentId, lauf) as { n: number };
  return z.n;
}

/** Der beste Stand eines Endlos-Spiels in diesem Spiel; `ohne`: dieses Endlos-Spiel nicht mitzählen. 0 = noch keines. */
export function endlosRekord(studentId: number, art: SpielArt, ohne?: number): number {
  const z = db()
    .prepare(
      // Blockwerk-, Funkelfeld- und Torlauf-Spiele hängen ihre Runden genauso aneinander, sind aber keine Endlos-Spiele
      "SELECT COALESCE(MAX(n), 0) AS rekord FROM (SELECT SUM(richtig) AS n FROM spielrunden WHERE student_id = ? AND art = ? AND endlos IS NOT NULL AND endlos != ? AND beendet_at IS NOT NULL AND endlos NOT IN (SELECT id FROM spielrunden WHERE student_id = ? AND (bloecke IS NOT NULL OR funkel IS NOT NULL OR tor IS NOT NULL)) GROUP BY endlos)",
    )
    .get(studentId, art, ohne ?? -1, studentId) as { rekord: number };
  return z.rekord;
}

/**
 * Blockwerk (lib/blockwerk.ts), Funkelfeld (lib/funkelfeld.ts), Glasklar (lib/glasklar.ts) und Wortschloss
 * (lib/wortschloss.ts) zählen ihre Punkte auf dem Gerät und melden sie am Ende; der Server merkt sie sich an der ersten
 * Runde (Spalte `bloecke`, `funkel`, `glas` oder `wort`). Eine Fortsetzung oder ein zweites Ende kann sie nicht kleiner machen.
 */
export type PunkteSpiel = "bloecke" | "funkel" | "glas" | "wort" | "tor" | "phantom";
export const PUNKTE_SPIELE: PunkteSpiel[] = ["bloecke", "funkel", "glas", "wort", "tor", "phantom"];
/** Die Spalte ist nie eine Eingabe: nur diese Namen kommen in die Abfragen. */
const spalte = (spiel: PunkteSpiel) => (spiel === "glas" ? "glas" : spiel === "funkel" ? "funkel" : spiel === "wort" ? "wort" : spiel === "tor" ? "tor" : spiel === "phantom" ? "phantom" : "bloecke");

export function laufPunkte(studentId: number, lauf: number, punkte: number, spiel: PunkteSpiel) {
  const c = spalte(spiel);
  db().prepare(`UPDATE spielrunden SET ${c} = MAX(COALESCE(${c}, 0), ?) WHERE id = ? AND student_id = ? AND ${c} IS NOT NULL`).run(punkte, lauf, studentId);
}
export const bloeckePunkte = (studentId: number, lauf: number, punkte: number) => laufPunkte(studentId, lauf, punkte, "bloecke");

/** Ist dieser Lauf ein Blockwerk- oder Glasklar-Spiel? */
export function laufIst(studentId: number, lauf: number, spiel: PunkteSpiel): boolean {
  return !!db().prepare(`SELECT 1 FROM spielrunden WHERE id = ? AND student_id = ? AND ${spalte(spiel)} IS NOT NULL`).get(lauf, studentId);
}
export const istBlockwerk = (studentId: number, lauf: number) => laufIst(studentId, lauf, "bloecke");

/** Der beste Stand des Schülers (Blockwerk über alle Spiele, Glasklar über alle Themen); `ohne`: dieses Spiel nicht mitzählen. */
export function punkteRekord(studentId: number, spiel: PunkteSpiel, ohne?: number): number {
  const c = spalte(spiel);
  const z = db().prepare(`SELECT COALESCE(MAX(${c}), 0) AS rekord FROM spielrunden WHERE student_id = ? AND ${c} IS NOT NULL AND id != ?`).get(studentId, ohne ?? -1) as { rekord: number };
  return z.rekord;
}
export const bloeckeRekord = (studentId: number, ohne?: number) => punkteRekord(studentId, "bloecke", ohne);

/** So viele Plätze zeigt eine Bestenliste. */
export const BESTENLISTE_PLAETZE = 10;

/**
 * Die Bestenliste für alle (niko 2026-11-16: „mach einen highscore also leaderboard für alle“), je Spiel (Blockwerk,
 * Glasklar): je Schüler sein bester Stand, die Besten zuerst. Jeder steht nur mit Spitzname und Tierbild drin
 * (lib/spielprofil.ts); wer Punkte hat, aber noch keinen Spitznamen, bekommt hier einen (niko 2026-11-16: „es soll
 * generell erlaubt sein“). Nur wen der Lehrer ausgeschaltet hat, sehen die anderen nicht; er selbst sieht sich als „Du“.
 */
export function punkteBestenliste(student: Pick<repo.Student, "id" | "grade">, spiel: PunkteSpiel, anzahl = BESTENLISTE_PLAETZE): Bestenliste {
  const c = spalte(spiel);
  const ohneName = db()
    .prepare(
      `SELECT DISTINCT s.id, s.grade FROM spielrunden r JOIN students s ON s.id = r.student_id
       WHERE r.${c} > 0 AND COALESCE(s.wettspiel, '') != 'nein' AND NOT EXISTS (SELECT 1 FROM spielprofile sp WHERE sp.student_id = s.id)`,
    )
    .all() as { id: number; grade: number }[];
  for (const s of ohneName) sorgeFuerProfil(s);
  const rows = db()
    .prepare(
      `SELECT r.student_id AS id, MAX(r.${c}) AS punkte, MIN(r.id) AS zuerst, sp.name, sp.bild, s.grade, s.wettspiel
       FROM spielrunden r JOIN students s ON s.id = r.student_id LEFT JOIN spielprofile sp ON sp.student_id = r.student_id
       WHERE r.${c} > 0 GROUP BY r.student_id ORDER BY punkte DESC, zuerst ASC`,
    )
    .all() as { id: number; punkte: number; name: string | null; bild: string | null; grade: number; wettspiel: string | null }[];
  const sichtbar = (z: (typeof rows)[number]) => !!z.name && darfMitspielen(z.wettspiel);
  const eigenes = profilVon(student.id);
  const darf = erlaubnis(student).darf;
  const liste = rows
    .filter((z) => z.id === student.id || sichtbar(z))
    .map((z, i): BestenZeile => {
      const ich = z.id === student.id;
      const zeigen = ich ? (darf && eigenes ? eigenes.name : "Du") : z.name!;
      return { platz: i + 1, name: zeigen, bild: (ich && !(darf && eigenes) ? "🙂" : BILDER[z.bild ?? ""]) ?? "🙂", punkte: z.punkte, ich };
    });
  return { zeilen: liste.slice(0, anzahl), ich: liste.find((z) => z.ich) ?? null, profil: !darf ? "erlaubnis" : eigenes ? "da" : "anlegen" };
}
export const bloeckeBestenliste = (student: Pick<repo.Student, "id" | "grade">, anzahl = BESTENLISTE_PLAETZE) => punkteBestenliste(student, "bloecke", anzahl);

/**
 * Startet eine Runde mit vorgegebenen Karten (Duell, lib/duelle.ts): beide Spieler bekommen dieselben Karten. Zählt im
 * Lernstand wie jede andere Runde.
 */
export function starteRundeMitKarten(studentId: number, art: SpielArt, karten: SpielKarte[], duellId: number): number {
  const r = db()
    .prepare("INSERT INTO spielrunden (student_id, art, skill_id, grund, karten, anzahl, duell_id) VALUES (?, ?, ?, 'duell', ?, ?, ?)")
    .run(studentId, art, karten[0]?.skill ?? SPIEL_SKILL[art], JSON.stringify(karten), karten.length, duellId);
  return Number(r.lastInsertRowid);
}

export type RundenErgebnis = { richtig: number; anzahl: number; sterne: 1 | 2 | 3; nochmal: SpielKarte[] };

/**
 * Beendet eine Runde mit der ersten Wahl je Karte. Gezählt wird nur gegen die gespeicherten Karten; fehlt eine
 * Antwort, zählt die Karte als falsch. Eine Runde lässt sich nur einmal beenden (ein zweiter Aufruf liefert das
 * gespeicherte Ergebnis, damit ein doppelter Tipp nichts doppelt zählt).
 *
 * `teil` (nur die letzte Runde eines Endlos-Spiels): es zählen nur die Karten, die beantwortet wurden; ist keine
 * beantwortet, fällt die Runde weg.
 */
export function beendeRunde(studentId: number, rundeId: number, antworten: SpielAntwort[], o: { teil?: boolean } = {}): RundenErgebnis | null {
  const z = db().prepare("SELECT * FROM spielrunden WHERE id = ? AND student_id = ?").get(rundeId, studentId) as Zeile | undefined;
  if (!z) return null;
  let karten = json<SpielKarte[]>(z.karten, []);
  if (z.beendet_at) {
    const alt = json<GespeicherteAntwort[]>(z.antworten, []);
    const falsch = new Set(alt.filter((a) => !a.richtig).map((a) => a.key));
    return { richtig: z.richtig, anzahl: z.anzahl, sterne: sterneFuer(z.richtig, z.anzahl), nochmal: karten.filter((k) => falsch.has(k.key)) };
  }
  const wahl = new Map<string, string>();
  for (const a of antworten) if (typeof a?.key === "string" && typeof a?.wahl === "string" && !wahl.has(a.key)) wahl.set(a.key, a.wahl);
  if (o.teil && z.endlos !== null) {
    karten = karten.filter((k) => wahl.has(k.key));
    if (!karten.length) {
      // die erste Runde trägt das Endlos-Spiel: sie bleibt (leer), damit der Stand der anderen zählt
      if (z.endlos === z.id) db().prepare("UPDATE spielrunden SET karten = '[]', anzahl = 0, beendet_at = datetime('now') WHERE id = ?").run(rundeId);
      else db().prepare("DELETE FROM spielrunden WHERE id = ?").run(rundeId);
      return { richtig: 0, anzahl: 0, sterne: 1, nochmal: [] };
    }
    db().prepare("UPDATE spielrunden SET karten = ?, anzahl = ? WHERE id = ?").run(JSON.stringify(karten), karten.length, rundeId);
  }
  const gespeichert: GespeicherteAntwort[] = karten.map((k) => ({ key: k.key, wahl: wahl.get(k.key) ?? "", richtig: wahl.get(k.key) === k.richtig }));
  const richtig = gespeichert.filter((a) => a.richtig).length;
  db().prepare("UPDATE spielrunden SET antworten = ?, richtig = ?, beendet_at = datetime('now') WHERE id = ?").run(JSON.stringify(gespeichert), richtig, rundeId);
  return { richtig, anzahl: karten.length, sterne: sterneFuer(richtig, karten.length), nochmal: karten.filter((k) => !wahl.has(k.key) || wahl.get(k.key) !== k.richtig) };
}

/** Fähigkeit, Spiel und Endlos-Spiel einer Runde dieses Schülers (null, wenn es sie nicht gibt). */
export function rundenSkill(studentId: number, rundeId: number): { skillId: string; art: SpielArt; endlos: number | null } | null {
  const z = db().prepare("SELECT skill_id, art, endlos FROM spielrunden WHERE id = ? AND student_id = ?").get(rundeId, studentId) as { skill_id: string; art: SpielArt; endlos: number | null } | undefined;
  return z ? { skillId: z.skill_id, art: z.art, endlos: z.endlos } : null;
}

/** Wiener Datum einer Zeit aus SQLite (UTC). */
const tagVon = (s: string) => wienerDatum(new Date(parseTime(s)));

/** Tage am Stück mit mindestens einer beendeten Runde, bis heute (oder bis gestern, wenn heute noch keine war). */
export function serie(studentId: number, heute: string): number {
  const tage = new Set(
    (db().prepare("SELECT beendet_at FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT 400").all(studentId) as { beendet_at: string }[]).map((r) =>
      tagVon(r.beendet_at),
    ),
  );
  let tag = tage.has(heute) ? heute : tagAddieren(heute, -1);
  let n = 0;
  while (tage.has(tag)) {
    n++;
    tag = tagAddieren(tag, -1);
  }
  return n;
}

/** Beendete Runden als Belege für den Lernstand (lib/analysis.ts collectEvidence). */
export function spielBelege(studentId: number): { skillId: string; score: number; at: string }[] {
  return (
    db().prepare("SELECT art, skill_id, richtig, anzahl, beendet_at, karten, antworten FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL AND anzahl > 0").all(studentId) as {
      art: string;
      skill_id: string;
      richtig: number;
      anzahl: number;
      beendet_at: string;
      karten: string;
      antworten: string;
    }[]
  ).flatMap((r) => (r.art === "stilmittel" ? stilBelege(r) : [{ skillId: r.skill_id, score: r.richtig / r.anzahl, at: r.beendet_at }]));
}

/** Eine Runde „Stilmittel“ mit Karten aus mehreren Gruppen (Oberstufe) zählt je Fähigkeit ihrer Karten. */
function stilBelege(r: { skill_id: string; richtig: number; anzahl: number; beendet_at: string; karten: string; antworten: string }) {
  const skillVon = new Map(json<SpielKarte[]>(r.karten, []).map((k) => [k.key, k.skill ?? r.skill_id]));
  const je = new Map<string, { richtig: number; anzahl: number }>();
  for (const a of json<GespeicherteAntwort[]>(r.antworten, [])) {
    const skill = skillVon.get(a.key) ?? r.skill_id;
    const z = je.get(skill) ?? { richtig: 0, anzahl: 0 };
    z.anzahl++;
    if (a.richtig) z.richtig++;
    je.set(skill, z);
  }
  if (!je.size) return [{ skillId: r.skill_id, score: r.richtig / r.anzahl, at: r.beendet_at }];
  return [...je.entries()].map(([skillId, z]) => ({ skillId, score: z.richtig / z.anzahl, at: r.beendet_at }));
}

// ---------- Stilmittel (lib/stilmittel.ts) ----------

/** So viele Karten einer Runde kommen aus dem Schwerpunkt, wenn der Stoff einen hat. */
const STIL_FOKUS_KARTEN = 8;

/**
 * Woran die nächste Runde „Stilmittel“ hängt: ist eine Fähigkeit zu Stilmitteln im Stoff (Prüfung, aktueller Stoff,
 * letzte Einheit), kommen zwei Drittel der Karten aus ihr (`fokus`), sonst alle Stilmittel der Schulstufe gemischt.
 * `skillId` ist die Fähigkeit für den Stand auf der Kachel: Unterstufe „Sprachliche Bilder“, Oberstufe die Gruppe im Stoff,
 * sonst die Gedankenfiguren (die größte Gruppe).
 */
export function stilPlan(student: repo.Student, heute: string): { skillId: string; fokus: StilmittelId[] | null; titel?: string } {
  const os = student.grade >= STIL_OBERSTUFE_AB;
  const bekannt = stilmittelBis(student.grade);
  for (const id of stoffQuellen(student, heute).flatMap((q) => q.ids)) {
    const passt = (s: string) => id === s || id.startsWith(`${s}.`);
    const gruppe = (Object.keys(STIL_GRUPPEN) as StilGruppe[]).find((g) => passt(STIL_GRUPPEN[g].skill));
    if (os && gruppe) {
      const fokus = bekannt.filter((s) => STILMITTEL[s].gruppe === gruppe);
      return { skillId: STIL_GRUPPEN[gruppe].skill, fokus, titel: `Thema: ${STIL_GRUPPEN[gruppe].name}` };
    }
    if (passt(STIL_UNTERSTUFE)) return { skillId: os ? STIL_GRUPPEN.bilder.skill : STIL_UNTERSTUFE, fokus: ["vergleich", "metapher", "personifikation"], titel: "Thema: Sprachliche Bilder" };
  }
  return { skillId: os ? STIL_GRUPPEN.gedanken.skill : STIL_UNTERSTUFE, fokus: null };
}

/** Die Karten einer Runde „Stilmittel“: mit Schwerpunkt acht aus ihm und vier gemischte, sonst zwölf gemischte. */
export function stilmittelRunde(student: repo.Student, heute: string, o: { lernstand: number | null; rng?: () => number }): SpielKarte[] {
  const plan = stilPlan(student, heute);
  const pool = stilmittelKandidaten(student.grade);
  const gemeinsam = { stufen: stufenFuer("stilmittel", student.grade, o.lernstand), wiederholen: offeneFehler(student.id, "stilmittel"), zuletzt: zuletztGespielt(student.id, "stilmittel"), rng: o.rng };
  if (!plan.fokus) return waehleKarten("stilmittel", { ...gemeinsam, pool });
  const fokus = new Set<string>(plan.fokus);
  const drin = pool.filter((k) => fokus.has(stilmittelVonKarte(k.karte) ?? ""));
  const haupt = waehleKarten("stilmittel", { ...gemeinsam, pool: drin, anzahl: STIL_FOKUS_KARTEN });
  const rest = waehleKarten("stilmittel", { ...gemeinsam, pool: pool.filter((k) => !fokus.has(stilmittelVonKarte(k.karte) ?? "")), anzahl: KARTEN_JE_RUNDE - haupt.length });
  return gemischt([...haupt, ...rest], o.rng ?? Math.random);
}

/** Die Fähigkeit einer Runde „Stilmittel“: der Schwerpunkt, sonst die Fähigkeit der meisten Karten. */
function stilRundenSkill(student: repo.Student, karten: SpielKarte[], heute: string): string {
  const plan = stilPlan(student, heute);
  if (plan.fokus) return plan.skillId;
  const n = new Map<string, number>();
  for (const k of karten) if (k.skill) n.set(k.skill, (n.get(k.skill) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? plan.skillId;
}

export type SpielUebersicht = {
  runden: { art: SpielArt; richtig: number; anzahl: number; tag: string }[];
  /** Was zuletzt öfter falsch war, mit der richtigen Lösung („die Haustür“) */
  fehler: { loesung: string; mal: number }[];
};

/** Für den Lehrer im Profil: die letzten Runden der letzten 30 Tage und die häufigsten Fehler. */
export function spielUebersicht(studentId: number, heute: string): SpielUebersicht {
  const rows = db()
    .prepare("SELECT * FROM spielrunden WHERE student_id = ? AND beendet_at IS NOT NULL ORDER BY id DESC LIMIT 60")
    .all(studentId) as Zeile[];
  const seit = tagAddieren(heute, -30);
  const frisch = rows.filter((r) => tagVon(r.beendet_at!) >= seit && istSpielArt(r.art));
  const zaehler = new Map<string, number>();
  for (const r of frisch) {
    const karten = new Map(json<SpielKarte[]>(r.karten, []).map((k) => [k.key, k]));
    for (const a of json<GespeicherteAntwort[]>(r.antworten, [])) {
      const k = karten.get(a.key);
      if (!a.richtig && k) zaehler.set(k.loesung, (zaehler.get(k.loesung) ?? 0) + 1);
    }
  }
  return {
    runden: frisch.map((r) => ({ art: r.art as SpielArt, richtig: r.richtig, anzahl: r.anzahl, tag: tagVon(r.beendet_at!) })),
    fehler: [...zaehler.entries()]
      .map(([loesung, mal]) => ({ loesung, mal }))
      .sort((a, b) => b.mal - a.mal)
      .slice(0, 6),
  };
}

// ---------- Österreich erobern (lib/oesterreich.ts) ----------

/** Wörter im Test oder im Stoff, die zu „Österreich erobern“ passen. */
const OE_STOFF = /österreich|oesterreich|bundesl|hauptst|bevölkerung|bevoelkerung|demograph|demograf|altersauf|volksz|registerz|landflucht/i;
/** Ohne eingetragenen Test: so lange gibt es das Spiel für die 3. Klasse mit Geografie (Test am 26.11.2026). */
const OE_OHNE_TEST_BIS = "2026-11-26";

/**
 * Gibt es „Österreich erobern“ für diesen Schüler, und warum gerade? Gebaut für den GWB-Test einer 3. Klasse AHS am
 * 26.11.2026 (niko 2026-11-24). Mit einem geplanten Geografie-Test (GW, GWB, Geografie) bis zum Testtag, der in die
 * 7. Schulstufe fällt oder Österreich/Bevölkerung als Stoff hat: ganz oben, mit dem Test als Grund. Ohne Test bis
 * 26.11.2026 (Testtag) für die 7. Schulstufe mit Geografie im Profil oder einer Geografie-Einheit in den letzten 30 Tagen. Danach
 * verschwindet es wieder. Der Test-Schüler von „Spiele testen“ hat es immer. null: nicht.
 */
export function oesterreichWahl(student: repo.Student, heute: string): { grund?: string } | null {
  const stufe = student.grade || 0;
  const bis = tagAddieren(heute, BIO_TAGE);
  const test = repo
    .listTests(student.id)
    .filter((t) => (t.status ?? "geplant") === "geplant" && istGeo(t.subject) && t.date >= heute && t.date <= bis)
    .filter((t) => stufe === 7 || OE_STOFF.test([t.title ?? "", t.topic, ...(t.topics ?? []), t.notes].join(" ")))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (test) {
    const tage = Math.round((Date.parse(test.date) - Date.parse(heute)) / 86_400_000);
    const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
    return { grund: `${test.title || test.kind || "Geografie-Test"} ${wann}` };
  }
  if (student.spiele_test) return {};
  if (stufe !== 7 || heute > OE_OHNE_TEST_BIS) return null;
  if (student.subjects.some(istGeo)) return {};
  const seit = tagAddieren(heute, -30);
  return repo.listLessons(student.id).some((l) => istGeo(l.subject) && l.starts_at.slice(0, 10) >= seit) ? {} : null;
}

const oeRunden = (studentId: number) =>
  (db().prepare("SELECT antworten FROM spielrunden WHERE student_id = ? AND art = 'oesterreich' AND beendet_at IS NOT NULL ORDER BY id").all(studentId) as { antworten: string }[]).map((r) => ({
    antworten: json<GespeicherteAntwort[]>(r.antworten, []),
  }));
/** Der Stand je Eintrag aus allen beendeten Runden „Österreich erobern“. */
export const oeStandVon = (studentId: number) => oeStandAus(oeRunden(studentId));
/** Sichere und zuletzt falsche Einträge, die besten Sterne je Level. */
export function oesterreichStand(studentId: number): { sicher: string[]; falsch: string[]; level: Record<number, number> } {
  const runden = oeRunden(studentId);
  const st = oeStandAus(runden);
  return { sicher: [...st].filter(([, x]) => x.sicher).map(([id]) => id), falsch: [...st].filter(([, x]) => x.zuletztFalsch).map(([id]) => id), level: oeLevelStandAus(runden) };
}
