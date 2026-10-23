/**
 * Kurze Erklärung mit Beispiel je Fähigkeit: die Musterantwort der „Erkläre …“-Aufgaben (lib/generators.ts freeTask)
 * und der Kern der Erklärung für den Lehrer (lib/loesungsdaten.ts). Ohne Dateizugriff, auch im Browser lesbar.
 */
import { ERKLAERUNG } from "./themen";

export const EXPLAIN: Record<string, string> = {
  "mathe.brueche.kuerzen": "Zähler und Nenner durch dieselbe Zahl (am besten den ggT) dividieren. Der Wert bleibt gleich. Beispiel: 12/18 = 2/3 (durch 6).",
  "mathe.brueche.erweitern": "Zähler und Nenner mit derselben Zahl multiplizieren. Der Wert bleibt gleich. Beispiel: 3/4 = 9/12 (mal 3).",
  "mathe.brueche.addieren": "Brüche auf einen gemeinsamen Nenner bringen, dann die Zähler addieren, der Nenner bleibt. Am Ende kürzen. Beispiel: 1/2 + 1/3 = 3/6 + 2/6 = 5/6.",
  "mathe.brueche.subtrahieren": "Gemeinsamen Nenner suchen, erweitern, Zähler subtrahieren, Nenner bleibt, kürzen. Beispiel: 3/4 − 1/6 = 9/12 − 2/12 = 7/12.",
  "mathe.brueche.multiplizieren": "Zähler mal Zähler und Nenner mal Nenner, danach kürzen. Beispiel: 2/3 · 3/4 = 6/12 = 1/2.",
  "mathe.brueche.dividieren": "Mit dem Kehrwert des zweiten Bruchs multiplizieren. Beispiel: 3/4 : 1/2 = 3/4 · 2/1 = 6/4 = 3/2.",
  "mathe.negativ.addieren": "Plus einer negativen Zahl ist wie Minus; Minus einer negativen Zahl ist wie Plus. Beispiel: 5 − (−3) = 8.",
  "mathe.negativ.multiplizieren": "Gleiche Vorzeichen ergeben Plus, verschiedene ergeben Minus. Beispiel: (−4) · (−3) = 12.",
  "mathe.prozent.prozentwert": "Prozentwert = Grundwert · Prozentsatz / 100. Beispiel: 20 % von 80 € = 16 €.",
  "mathe.prozent.prozentsatz": "Prozentsatz = Prozentwert / Grundwert · 100. Beispiel: 15 von 60 = 25 %.",
  "mathe.prozent.grundwert": "Grundwert = Prozentwert · 100 / Prozentsatz. Beispiel: 30 % sind 12 € → 40 €.",
  "mathe.gleichungen.einfach": "Auf beiden Seiten dasselbe rechnen, bis x allein steht. Beispiel: 3x + 4 = 19 → 3x = 15 → x = 5.",
  "mathe.gleichungen.klammern": "Zuerst die Klammer auflösen, dann wie gewohnt umformen. Beispiel: 2(x + 3) = 14 → 2x + 6 = 14 → x = 4.",
  "mathe.gleichungen.text": "Gesuchte Größe x nennen, Text in eine Gleichung übersetzen, lösen und Antwortsatz schreiben.",
  "mathe.potenzen.regeln": "Gleiche Basis: multiplizieren → Exponenten addieren, dividieren → subtrahieren, Potenz einer Potenz → multiplizieren.",
  "deutsch.beistrich.aufzaehlung": "Gleichrangige Glieder einer Aufzählung trennt man mit Beistrich, außer vor „und“ / „oder“.",
  "deutsch.beistrich.nebensatz": "Nebensätze (z. B. mit weil, dass, wenn, ob, der/die/das) werden vom Hauptsatz durch Beistrich getrennt.",
  "deutsch.beistrich.infinitiv": "Infinitivgruppen mit um/ohne/anstatt … zu oder mit Hinweiswort werden mit Beistrich abgetrennt.",
  "deutsch.recht.dasdass": "„das“ ist Artikel oder Pronomen (Ersatzprobe: dieses/welches), „dass“ ist eine Konjunktion, die einen Nebensatz einleitet.",
  "deutsch.recht.gross": "Nomen und nominalisierte Wörter schreibt man groß. Signalwörter: das, beim, zum, viel, etwas, alles, nichts.",
  "deutsch.recht.sss": "Nach kurzem Vokal ss, nach langem Vokal oder Zwielaut ß, bei stimmhaftem s nur s.",
  "deutsch.grammatik.faelle": "Mit der Frageprobe: Wer/was? (Nominativ), Wessen? (Genitiv), Wem? (Dativ), Wen/was? (Akkusativ).",
  "deutsch.grammatik.zeiten": "Zeitformen erkennt man an Hilfsverben und Verbformen: z. B. Perfekt = haben/sein (Präsens) + Partizip II.",
  "deutsch.grammatik.artikel": "Der Artikel (der/die/das) gehört zum Genus des Nomens und wird am besten gleich mitgelernt. Merkhilfe: Farbton plus Buchstabe m/f/n.",
  "deutsch.grammatik.adjektivdeklination": "Die Endung des Adjektivs hängt vom Begleiter (bestimmt oder unbestimmt), vom Genus, vom Kasus und vom Numerus ab: nach bestimmtem Artikel meist -e oder -en.",
  "deutsch.grammatik.praepositionen": "Jede Präposition verlangt einen Fall: mit, nach, bei, von, zu, aus, seit den Dativ; durch, für, gegen, ohne, um den Akkusativ. Frageprobe: Wem? (Dativ) oder Wen/was? (Akkusativ).",
  "deutsch.grammatik.praeteritum": "Das Präteritum ist die einfache Vergangenheitsform (ich ging, er fuhr). Starke Verben ändern den Vokal, schwache bilden -te.",
  "deutsch.grammatik.perfekt": "Das Perfekt = haben oder sein im Präsens + Partizip II (ich habe gelernt, wir sind gefahren). Bewegungs- und Zustandsverben nehmen „sein“.",
  "deutsch.satz.hauptsatz-gliedsatz": "Der Hauptsatz kann allein stehen (gebeugtes Verb an zweiter Stelle). Der Gliedsatz kann nicht allein stehen, wird oft von einer Konjunktion eingeleitet und hat das gebeugte Verb am Ende.",
  "deutsch.text.verstehen": "Text genau lesen, Schlüsselwörter markieren, die Antwort im Text belegen.",
  "englisch.tenses.presentsimple": "Für Gewohnheiten und Fakten. Bei he/she/it kommt -s ans Verb. Fragen mit do/does.",
  "englisch.tenses.pastsimple": "Für abgeschlossene Handlungen in der Vergangenheit (yesterday, last week, ago). Regelmäßig -ed, sonst 2. Form.",
  "englisch.tenses.presentperfect": "have/has + 3. Form. Für Erfahrungen und Dinge mit Bezug zur Gegenwart (ever, never, already, yet, since, for).",
  "englisch.vocab.irregular": "Unregelmäßige Verben haben eigene Formen, z. B. go – went – gone. Sie müssen gelernt werden.",
  "englisch.grammar.comparatives": "Kurze Adjektive: -er (taller), lange Adjektive: more (more interesting), Ausnahmen: good – better, bad – worse.",
  "englisch.reading.comprehension": "Read the text carefully, underline key words and find the sentence that answers the question.",
  // the topics of lib/themen/ (Mathematik, Deutsch, Englisch)
  ...ERKLAERUNG,
};
