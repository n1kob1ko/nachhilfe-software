/**
 * „Chemie-Test · 5. Klasse“ (niko 2026-11-25, Probetest als PDF für Yanxin): Volumsmessung, Dichte, Filtration,
 * Kristallisation, signifikante Stellen, Verdünnungsreihe; 30 Aufgaben, 79 Punkte, Notenschlüssel vom Blatt
 * (70 / 59 / 50 / 40 P.). Fragen, Punkte und Lösungen sind wörtlich vom Blatt übernommen. Offene Fragen bewertet der
 * Schüler mit der Musterlösung selbst (die Lehrkraft kann ändern); Zahlenergebnisse prüft die App.
 *
 * Abweichungen vom Blatt, weil die App sie sonst nicht prüfen kann: 12 (Richtig/Falsch) zählt je Aussage 0,5 P. wie in der
 * Lösung; 20 ist geteilt in die Reihenfolge (Auswahl aus vier Reihenfolgen, 2 P.) und die Frage dazu (offen, 2 P.); 22, 23, 25, 26, 28 und 29
 * sind Lücken für die Zahlen (Komma oder Punkt, mit oder ohne Einheit).
 */
import type { EigenerTest } from "../eigene-tests";

/** Erlaubte Schreibweisen einer Zahl: mit Komma oder Punkt, ohne oder mit Einheit (Leerzeichen zählen nicht). */
function zahl(wert: string, ...einheiten: string[]): string[] {
  const formen = [wert, wert.replace(",", ".")];
  return [...new Set([...formen, ...formen.flatMap((f) => einheiten.map((e) => `${f} ${e}`))])];
}

export const CHEMIE_PROBETEST_5: EigenerTest = {
  key: "chemie-probetest-5",
  titel: "Chemie-Test · 5. Klasse",
  untertitel: "Volumsmessung · Dichte · Filtration · Kristallisation · Signifikante Stellen · Verdünnungsreihe",
  fach: "Chemie",
  sprache: "de",
  minuten: 50,
  notenschluessel: [70, 59, 50, 40],
  teile: [
    {
      id: "A",
      titel: "A – Volumsmessung",
      fragen: [
        {
          id: "1",
          art: "offen",
          punkte: 2,
          titel: "Nenne vier verschiedene Volumenmessgeräte.",
          muster: "**Pipette** (Messpipette, Vollpipette, Kolbenhubpipette), **Messzylinder** (Mensur), **Bürette**, **Messkolben**. (je 0,5 P.)",
        },
        {
          id: "2",
          art: "offen",
          punkte: 4,
          titel: "Auf einem Messkolben steht: „250 mL 20 °C ± 0,15 mL In“. Erkläre, was die vier Angaben bedeuten.",
          muster:
            "250 mL = **Nenninhalt** mit Maßeinheit · 20 °C = **Justiertemperatur** (nur bei dieser Temperatur ist die Messung genau) · ± 0,15 mL = **Fehlertoleranz** (gilt nur für wasserähnliche Flüssigkeiten) · In = **auf Einguss kalibriert**.",
        },
        {
          id: "3",
          art: "offen",
          punkte: 4,
          titel: "Erkläre den Unterschied zwischen „auf Ex kalibriert“ und „auf In kalibriert“. Nenne zu beiden ein passendes Gerät.",
          muster:
            "Ex = **auf Auslauf kalibriert**: Das Volumen, das aus dem Gerät herauskommt, ist exakt (in der Pipette war etwas mehr, Tropfen bleiben an der Wand). Beispiel: **Pipette**. In = **auf Einguss kalibriert**: Das Volumen, das im Gerät ist, ist exakt; nicht zum Ausgießen gedacht. Beispiel: **Messkolben**.",
        },
        {
          id: "4",
          art: "offen",
          punkte: 1,
          titel: "Was versteht man unter der Nachlaufzeit einer Pipette?",
          muster: "Die **Wartezeit** (z. B. 15 s), bis das exakte Volumen tatsächlich aus der Pipette **ausgeronnen** ist.",
        },
        {
          id: "5",
          art: "offen",
          punkte: 2,
          titel: "Geräteklassen: Welche Klasse ist genauer, A oder B? Was ist das Besondere an Klasse AS?",
          muster: "**A ist genauer** (Fehler unter 0,2 %, B bis 2 %). AS: **schnellerer Nachlauf** als A, aber trotzdem genau (Fehler ≤ 0,2 %).",
        },
      ],
    },
    {
      id: "B",
      titel: "B – Dichte",
      fragen: [
        {
          id: "6",
          art: "offen",
          punkte: 3,
          titel: "Was gibt die Dichte an? Schreib die Formel auf und nenne die Einheiten von m, V und ρ.",
          muster: "Die Dichte gibt an, **wie viel 1 cm³ eines Stoffes wiegt**. **ρ = m / V**. m in **g**, V in **cm³ oder mL**, ρ in **g/cm³ oder g/mL**.",
        },
        {
          id: "7",
          art: "offen",
          punkte: 1,
          titel: "Warum gibt man die Dichte meistens für 20 °C an?",
          muster: "Das **Volumen ist temperaturabhängig**, damit ist auch die Dichte temperaturabhängig (Angabe für Raumtemperatur).",
        },
        {
          id: "8",
          art: "offen",
          punkte: 3,
          titel: "Ein Metallstück wiegt 54,0 g. Im Messzylinder steigt der Wasserspiegel von 30,0 mL auf 50,0 mL. Berechne das Volumen und die Dichte des Metallstücks.",
          muster: "V = 50,0 mL − 30,0 mL = **20,0 mL = 20,0 cm³** (Volumen des verdrängten Wassers). ρ = 54,0 g / 20,0 cm³ = **2,70 g/cm³**.",
        },
        {
          id: "9",
          art: "offen",
          punkte: 4,
          titel:
            "Dichte einer Flüssigkeit mit dem Messkolben: Leerer, trockener Messkolben (100 mL) mit Stoppel: 42,5 g. Bis zur Marke gefüllt mit Stoppel: 121,4 g. a) Berechne die Masse der Flüssigkeit und ihre Dichte. b) Warum muss der Messkolben am Anfang trocken sein?",
          muster:
            "a) m = 121,4 g − 42,5 g = **78,9 g**; ρ = 78,9 g / 100 mL = **0,789 g/mL**. b) **Wasserreste** würden mitgewogen werden bzw. die Flüssigkeit verdünnen – das Ergebnis wäre falsch.",
        },
        {
          id: "10",
          art: "offen",
          punkte: 4,
          titel:
            "Dichte mit der Vollpipette: Trockenes Becherglas: 65,20 g. Nach dem Pipettieren von 25,0 mL Lösung: 95,45 g. a) Berechne die Dichte der Lösung. b) Warum spült man die Vollpipette vorher mit der Lösung?",
          muster:
            "a) m = 95,45 g − 65,20 g = **30,25 g**; ρ = 30,25 g / 25,0 mL = **1,21 g/mL** (3 signifikante Stellen wegen 25,0 mL). b) Damit **keine Wasserreste** in der Pipette die Lösung verdünnen.",
        },
        {
          id: "11",
          art: "offen",
          punkte: 1,
          titel: "Wozu drückt man beim Wiegen die Tara-Taste?",
          muster: "Die Waage stellt sich **mit dem Wägegefäß auf 0** – man misst danach **nur die Masse der Substanz**.",
        },
      ],
    },
    {
      id: "C",
      titel: "C – Filtration",
      fragen: [
        {
          id: "12",
          art: "rf",
          punkte: 3,
          titel: "Richtig oder falsch? (je 0,5 P.)",
          items: [
            ["a) Der Filterrand soll über den Trichterrand hinausragen.", false],
            ["b) Der Flüssigkeitsspiegel darf nicht über den Filterrand steigen.", true],
            ["c) Der Trichterhals soll in die Lösung im Becherglas eintauchen.", false],
            ["d) Den Flüssigkeitsstrahl lenkt man mit einem Glasstab.", true],
            ["e) Papierfilter eignen sich gut für konzentrierte Säuren und Laugen.", false],
            ["f) Man soll möglichst heiß filtrieren.", true],
          ],
        },
        {
          id: "13",
          art: "offen",
          punkte: 2,
          titel: "Nenne zwei Dinge, auf die man beim Einlegen des Filters achten muss.",
          muster: "Oberer Rand soll **luftdicht anliegen**; Filter mit Lösungsmittel **befeuchten**; es soll sich eine **hängende Flüssigkeitssäule** bilden. (2 davon)",
        },
        {
          id: "14",
          art: "offen",
          punkte: 2,
          titel: "Was bedeutet Dekantieren?",
          muster: "Den Niederschlag **absitzen lassen** und zuerst die **überstehende Lösung vorsichtig abgießen**.",
        },
        {
          id: "15",
          art: "offen",
          punkte: 1,
          titel: "Warum gibt man beim Filtrieren zuerst die Lösung mit wenig Niederschlag in den Filter?",
          muster: "Sonst **verstopfen die Filterporen** sofort und das Filtrieren dauert sehr lange.",
        },
        {
          id: "16",
          art: "offen",
          punkte: 2,
          titel: "Warum darf der Filter beim Waschen eines Niederschlags nie trocken laufen?",
          muster: "Der Niederschlag **trocknet im Filter aus und wird rissig**. Das Waschwasser **fließt dann über die Risse ab**, ohne den Niederschlag zu waschen (wirkungslos).",
        },
      ],
    },
    {
      id: "D",
      titel: "D – Kristallisation",
      fragen: [
        {
          id: "17",
          art: "offen",
          punkte: 1,
          titel: "Wann scheidet sich ein gelöster Stoff (z. B. NaCl) aus einer Lösung ab?",
          muster: "Wenn die **Löslichkeitsgrenze erreicht** ist – dann löst sich kein Salz mehr und der Stoff wird abgeschieden.",
        },
        {
          id: "18",
          art: "offen",
          punkte: 3,
          titel: "Nenne drei Möglichkeiten, wie man eine Kristallisation erreichen kann.",
          muster:
            "1) **Einengen** = Abdampfen des Lösungsmittels · 2) **Abkühlen** einer heiß gesättigten Lösung · 3) **Zugabe einer Flüssigkeit, in der der Stoff schlechter löslich ist**.",
        },
        {
          id: "19",
          art: "offen",
          punkte: 1,
          titel: "Was ist die Mutterlauge?",
          muster: "Die **Lösung, aus der der Stoff auskristallisiert**.",
        },
        {
          id: "20a",
          art: "mc",
          punkte: 2,
          titel: "Umkristallisieren: In welcher Reihenfolge macht man die Schritte?",
          optionen: [
            "Verunreinigungen heiß abfiltrieren → Heiß gesättigte Lösung herstellen → Kristallisieren durch Abkühlen oder Einengen",
            "Heiß gesättigte Lösung herstellen → Kristallisieren durch Abkühlen oder Einengen → Verunreinigungen heiß abfiltrieren",
            "Heiß gesättigte Lösung herstellen → Verunreinigungen heiß abfiltrieren → Kristallisieren durch Abkühlen oder Einengen",
            "Kristallisieren durch Abkühlen oder Einengen → Verunreinigungen heiß abfiltrieren → Heiß gesättigte Lösung herstellen",
          ],
          richtig: 2,
        },
        {
          id: "20b",
          art: "offen",
          punkte: 2,
          titel: "Wozu dient das Umkristallisieren, und warum verliert man dabei immer etwas vom Stoff?",
          muster: "Es dient zur **Reinigung von Substanzen**. Ein Teil der Substanz **bleibt in der Lösung gelöst**.",
        },
      ],
    },
    {
      id: "E",
      titel: "E – Signifikante Stellen",
      fragen: [
        {
          id: "21",
          art: "offen",
          punkte: 2,
          titel: "Was sind signifikante Stellen? (Definition)",
          muster: "Die Stellen eines Wertes, die **mit Sicherheit bekannt** sind, **plus eine Stelle, die geschätzt** wird.",
        },
        {
          id: "22",
          art: "luecken",
          titel: "Wie viele signifikante Stellen haben diese Werte?",
          text: "a) 0,052 g → {0}\nb) 3,040 mL → {1}\nc) 120,5 g → {2}\nd) 0,00700 g → {3}\ne) 7,0 mL → {4}",
          luecken: [["2"], ["4"], ["4"], ["3"], ["2"]],
        },
        {
          id: "23",
          art: "luecken",
          titel: "Runde auf 3 signifikante Stellen.",
          text: "a) 2,346 → {0}\nb) 12,849 → {1}\nc) 0,07254 → {2}\nd) 5,995 → {3}",
          luecken: [zahl("2,35"), zahl("12,8"), zahl("0,0725"), zahl("6,00")],
        },
        {
          id: "24",
          art: "offen",
          punkte: 3,
          titel: "Erkläre, warum 1,40 g nicht dasselbe ist wie 1,4 g. Gib für beide den Bereich an, in dem der wahre Wert liegt.",
          muster: "1,40: **1,395 ≤ x < 1,405** · 1,4: **1,35 ≤ x < 1,45**. 1,40 hat **3 signifikante Stellen** und ist viel genauer als 1,4 (2 signifikante Stellen).",
        },
        {
          id: "25",
          art: "luecken",
          punkte: 2,
          titel: "Eine Probe wurde dreimal gewogen: 0,1250 g, 0,1249 g und 0,1261 g. Berechne den Mittelwert und gib ihn sinnvoll gerundet an.",
          text: "Mittelwert = {0} g",
          luecken: [zahl("0,1253", "g")],
        },
        {
          id: "26",
          art: "luecken",
          punkte: 4,
          titel: "Berechne und runde sinnvoll.",
          text: "a) 43,68 g + 18,738 g = {0} g\nb) Dichte: m = 12,35 g, V = 4,8 mL → ρ = {1} g/mL",
          luecken: [zahl("62,42", "g"), zahl("2,6", "g/mL", "g/cm³")],
        },
      ],
    },
    {
      id: "F",
      titel: "F – Verdünnungsreihe",
      fragen: [
        {
          id: "27",
          art: "offen",
          punkte: 3,
          titel: "Was bedeutet eine Verdünnung „1 auf 10“? Warum ist die Schreibweise „1:10“ oder „1:9“ problematisch?",
          muster: "**1 Teil Substanz A + 9 Teile Substanz B** (insgesamt 10 Teile). „1:10“ könnte man auch als 1 Teil + 10 Teile verstehen – die Schreibweise ist **nicht eindeutig**.",
        },
        {
          id: "28",
          art: "luecken",
          titel: "Du hast 2 mL KMnO₄-Lösung. Wie viel Wasser brauchst du für eine Verdünnung „1 auf 10“? Wie groß ist das Gesamtvolumen?",
          text: "Wasser: {0} mL\nGesamtvolumen: {1} mL",
          luecken: [zahl("18", "mL"), zahl("20", "mL")],
        },
        {
          id: "29",
          art: "luecken",
          titel: "Du brauchst insgesamt 5 mL einer „1 auf 10“-Verdünnung. Wie viel KMnO₄-Lösung und wie viel Wasser nimmst du?",
          text: "KMnO₄-Lösung: {0} mL\nWasser: {1} mL",
          luecken: [zahl("0,5", "mL"), zahl("4,5", "mL")],
        },
        {
          id: "30",
          art: "offen",
          punkte: 4,
          titel:
            "„1 auf 2“-Verdünnungsreihe: In Eprouvette 1 gibst du 1 mL KMnO₄ + 1 mL H₂O, dann 1 mL davon in Eprouvette 2 mit 1 mL H₂O, usw. a) Welcher Anteil der Stammlösung ist in Eprouvette 3? (Bruch) b) Was musst du tun, bevor du die Lösung weiter verdünnst? Warum? c) Welche Gesamtverdünnung ergibt sich, wenn man zweimal „1 auf 10“ verdünnt?",
          muster:
            "a) 1/2 → 1/4 → **1/8**. b) Den Inhalt der Eprouvette **gut schütteln**, damit die Lösung **gleichmäßig durchmischt** ist. c) **„1 auf 100“** (1/10 · 1/10).",
        },
      ],
    },
  ],
};
