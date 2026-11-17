/**
 * Mathe-Quiz Volksschule: die Themen, zu denen „Kopfrechnen“ und „Zahlenstrahl“ nichts haben (Zerlegen, Verdoppeln,
 * Geometrie, Daten, Brüche …). Kurze Sätze, kleine Zahlen. Format: lib/lernspiele-quiz.ts.
 */
import type { QuizBank } from "../lernspiele-quiz";
import { eins, ganz, wahl, zahl, type Rng } from "./hilfen";

const zerlegen = (rng: Rng) => {
  const ganzes = ganz(rng, 4, 10);
  const a = ganz(rng, 1, ganzes - 1);
  return wahl(`${ganzes} ist ${a} und ___`, String(ganzes - a), [String(ganzes - a + 1), String(ganzes - a - 1), String(ganzes)], `${a} + ${ganzes - a} = ${ganzes}`);
};

const verdoppeln = (rng: Rng) => {
  if (rng() < 0.5) {
    const a = ganz(rng, 2, 50);
    return wahl(`Das Doppelte von ${a} ist ___`, String(2 * a), [String(a + 2), String(2 * a + 1), String(2 * a - 2)], `Verdoppeln heißt: ${a} + ${a} = ${2 * a}`);
  }
  const a = 2 * ganz(rng, 2, 50);
  return wahl(`Die Hälfte von ${a} ist ___`, String(a / 2), [String(a / 2 + 1), String(a - 2), String(a / 2 - 1)], `Halbieren heißt: ${a / 2} + ${a / 2} = ${a}`);
};

const gerade = (rng: Rng) => {
  const n = ganz(rng, 1, 999);
  const g = n % 2 === 0;
  return wahl(`Ist ${n} gerade oder ungerade?`, g ? "gerade" : "ungerade", [g ? "ungerade" : "gerade"], `Schau auf die letzte Ziffer: ${n % 10} ist ${g ? "gerade" : "ungerade"}. Gerade enden auf 0, 2, 4, 6 oder 8.`);
};

const folgen = (rng: Rng) => {
  const start = ganz(rng, 1, 20);
  const schritt = eins(rng, [2, 3, 4, 5, 10, -2, -3]);
  const s = schritt < 0 ? start + 40 : start;
  const xs = [0, 1, 2, 3].map((i) => s + i * schritt);
  const r = s + 4 * schritt;
  return wahl(`Wie geht es weiter? ${xs.join(", ")}, ___`, String(r), [String(r + schritt), String(r - 1), String(r + 1)], `Immer ${schritt > 0 ? "plus" : "minus"} ${Math.abs(schritt)}.`);
};

const ungleichung = (rng: Rng) => {
  const a = ganz(rng, 5, 60);
  const b = ganz(rng, a + 3, a + 40);
  const r = b - a - 1;
  return wahl(`${a} + ___ < ${b}: Welche Zahl ist die größte, die passt?`, String(r), [String(r + 1), String(r + 2), String(r - 3)], `${a} + ${r + 1} = ${b}, das ist nicht kleiner. Also passt höchstens ${r}.`);
};

const ueberschlag = (rng: Rng) => {
  const a = ganz(rng, 12, 98) * 10 + ganz(rng, 1, 9);
  const b = ganz(rng, 12, 98) * 10 + ganz(rng, 1, 9);
  const r = Math.round(a / 100) * 100 + Math.round(b / 100) * 100;
  return wahl(`Überschlag: ${a} + ${b} ist ungefähr ___`, zahl(r), [zahl(r + 100), zahl(r - 100), zahl(r * 10)], `Auf Hunderter runden: ${Math.round(a / 100) * 100} + ${Math.round(b / 100) * 100} = ${r}`);
};

const halbschriftlich = (rng: Rng) => {
  const z = ganz(rng, 2, 9);
  const e = ganz(rng, 1, 9);
  const m = ganz(rng, 3, 9);
  const zahlAB = 10 * z + e;
  return wahl(`${zahlAB} · ${m} = ${10 * z} · ${m} + ${e} · ${m} = ___`, String(zahlAB * m), [String(10 * z * m + e), String(10 * z * m), String(zahlAB * m + 10)], `${10 * z * m} + ${e * m} = ${zahlAB * m}`);
};

const zweistellig = (rng: Rng) => {
  const d = ganz(rng, 12, 48);
  const q = ganz(rng, 11, 99);
  return wahl(`${d * q} : ${d} = ___`, String(q), [String(q + 1), String(q - 1), String(q * 10)], `Probe: ${q} · ${d} = ${d * q}`);
};

const flaechenmasse = (rng: Rng) => {
  const paare: [string, string, number][] = [
    ["cm²", "mm²", 100],
    ["dm²", "cm²", 100],
    ["m²", "dm²", 100],
    ["a", "m²", 100],
    ["ha", "a", 100],
    ["km²", "ha", 100],
  ];
  const [gross, klein, f] = eins(rng, paare);
  const n = ganz(rng, 2, 9);
  return wahl(`${n} ${gross} = ___ ${klein}`, String(n * f), [String(n * 10), String(n * 1000), String(n)], `Bei Flächenmaßen ist die Umrechnungszahl 100: 1 ${gross} = 100 ${klein}.`);
};

const bruchVonGroesse = (rng: Rng) => {
  const n = eins(rng, [2, 3, 4, 5, 10]);
  const z = ganz(rng, 1, n - 1);
  const was = eins(rng, [
    ["Euro", "€"],
    ["Meter", "m"],
    ["Kilogramm", "kg"],
    ["Stunden", "h"],
    ["Minuten", "min"],
  ]);
  const ganzes = n * ganz(rng, 2, 12);
  const r = (ganzes / n) * z;
  return wahl(`${z}/${n} von ${ganzes} ${was[1]} sind ___`, `${r} ${was[1]}`, [`${ganzes / n} ${was[1]}`, `${ganzes - r} ${was[1]}`, `${r + z} ${was[1]}`], `Erst durch ${n} teilen (${ganzes / n}), dann mal ${z}.`);
};

const proportional = (rng: Rng) => {
  const stueck = ganz(rng, 2, 6);
  const preis = ganz(rng, 2, 9);
  const neu = ganz(rng, 2, 10) * stueck;
  return wahl(`${stueck} Hefte kosten ${stueck * preis} €. Wie viel kosten ${neu} Hefte?`, `${(neu * preis)} €`, [`${neu * preis + preis} €`, `${stueck * preis + neu} €`, `${neu * stueck} €`], `1 Heft kostet ${preis} €, also ${neu} · ${preis} € = ${neu * preis} €.`);
};

export const MATHE_VS: QuizBank = {
  "mathe.vs.zahlen.zerlegen": { erzeuge: (rng) => zerlegen(rng), anzahl: 30 },
  "mathe.vs.zahlen.gerade": {
    text: `Gerade Zahlen enden auf ___ = 0, 2, 4, 6, 8 | 1, 3, 5, 7, 9 | 5 oder 0
Ungerade Zahlen enden auf ___ = 1, 3, 5, 7, 9 | 0, 2, 4, 6, 8 | 0 oder 5
Gerade + gerade ist immer ___ = gerade | ungerade
Ungerade + ungerade ist immer ___ = gerade | ungerade
Merke: Zum Beispiel 3 + 5 = 8.
Gerade + ungerade ist immer ___ = ungerade | gerade
Merke: Zum Beispiel 4 + 3 = 7.
Eine gerade Zahl kann man in zwei gleiche Hälften teilen. = stimmt | stimmt nicht`,
    erzeuge: (rng) => gerade(rng),
    anzahl: 30,
  },
  "mathe.vs.zahlen.folgen": { erzeuge: (rng) => folgen(rng), anzahl: 40 },
  "mathe.vs.addsub.verdoppeln": { erzeuge: (rng) => verdoppeln(rng), anzahl: 40 },
  "mathe.vs.addsub.ungleichungen": {
    text: `Welches Zeichen passt? 7 + 5 ___ 11 = > | < | =
Merke: 7 + 5 = 12, und 12 ist größer als 11.
Welches Zeichen passt? 20 − 8 ___ 13 = < | > | =
Merke: 20 − 8 = 12, und 12 ist kleiner als 13.
Welches Zeichen passt? 6 · 4 ___ 24 = = | < | >
Welches Zeichen passt? 45 + 15 ___ 59 = > | < | =
Welches Zeichen passt? 100 − 37 ___ 64 = < | > | =
Welches Zeichen passt? 9 · 9 ___ 80 = > | < | =`,
    erzeuge: (rng) => ungleichung(rng),
    anzahl: 30,
  },
  "mathe.vs.addsub.vorteile": `Rechne geschickt: 27 + 18 + 3 = 48 | 47 | 38
Merke: Erst 27 + 3 = 30, dann + 18 = 48.
Rechne geschickt: 46 + 99 = 145 | 144 | 155
Merke: + 100 und dann − 1.
Rechne geschickt: 83 − 19 = 64 | 66 | 74
Merke: − 20 und dann + 1.
Rechne geschickt: 15 + 37 + 5 = 57 | 52 | 67
Merke: 15 + 5 = 20, dann + 37 = 57.
Rechne geschickt: 125 + 98 = 223 | 213 | 222
Merke: + 100 und dann − 2.
Rechne geschickt: 64 + 28 + 6 = 98 | 88 | 96
Rechne geschickt: 200 − 99 = 101 | 99 | 111
Rechne geschickt: 38 + 25 + 12 = 75 | 65 | 85
Merke: 38 + 12 = 50, dann + 25.
Rechne geschickt: 71 − 29 = 42 | 52 | 48
Merke: − 30 und dann + 1.
Rechne geschickt: 450 + 199 = 649 | 659 | 639
Beim Plusrechnen darf man die Zahlen vertauschen. = stimmt | stimmt nicht
Merke: 3 + 8 = 8 + 3.
Beim Minusrechnen darf man die Zahlen vertauschen. = stimmt nicht | stimmt
Merke: 8 − 3 ist 5, aber 3 − 8 geht nicht so.`,
  "mathe.vs.muldiv.halbschriftlich": { erzeuge: (rng) => halbschriftlich(rng), anzahl: 40 },
  "mathe.vs.schriftlich.ueberschlag": { erzeuge: (rng) => ueberschlag(rng), anzahl: 40 },
  "mathe.vs.schriftlich.zweistellig": { erzeuge: (rng) => zweistellig(rng), anzahl: 40 },
  "mathe.vs.groessen.schaetzen": `Wie lang ist ein Bleistift ungefähr? = 18 cm | 18 m | 18 mm
Wie schwer ist eine Tafel Schokolade ungefähr? = 100 g | 100 kg | 10 g
Wie hoch ist eine Zimmertür ungefähr? = 2 m | 20 m | 20 cm
Wie viel wiegt ein Erwachsener ungefähr? = 70 kg | 7 kg | 700 kg
Wie lange dauert eine Schulstunde? = 50 Minuten | 50 Sekunden | 5 Stunden
Wie viel passt in eine Tasse? = 1/4 Liter | 4 Liter | 25 Liter
Wie lang ist ein Fußballfeld ungefähr? = 100 m | 10 m | 1 km
Wie schwer ist ein Apfel ungefähr? = 150 g | 15 kg | 1 g
Wie breit ist dein Daumen ungefähr? = 2 cm | 2 dm | 2 m
Wie lange brauchst du zum Zähneputzen? = 3 Minuten | 3 Stunden | 3 Sekunden
Wie viel Wasser passt in eine Badewanne? = 150 Liter | 15 Liter | 1500 Liter
Wie hoch ist ein Haus mit drei Stockwerken ungefähr? = 10 m | 100 m | 1 m
Wie schwer ist ein Auto ungefähr? = 1 500 kg | 150 kg | 15 kg
Wie weit gehst du in einer Stunde ungefähr? = 5 km | 50 km | 500 m`,
  "mathe.vs.groessen.flaechenmasse": {
    text: `Die Fläche eines Fußballfelds misst man am besten in ___ = m² | cm² | mm²
Die Fläche einer Briefmarke misst man am besten in ___ = cm² | m² | km²
Die Fläche von Österreich misst man in ___ = km² | ha | m²
Ein Ar (a) ist ein Quadrat mit 10 m Seitenlänge. Das sind ___ = 100 m² | 10 m² | 1 000 m²
Ein Hektar (ha) sind ___ = 100 a | 10 a | 1 000 a
Wie viele Quadrate mit 1 cm Seite passen in ein Quadrat mit 1 dm Seite? = 100 | 10 | 1 000
Merke: 10 Reihen mit je 10 Quadraten.`,
    erzeuge: (rng) => flaechenmasse(rng),
    anzahl: 24,
  },
  "mathe.vs.geometrie.lage": `Der Ball liegt unter dem Tisch. Wo ist der Tisch? = über dem Ball | unter dem Ball | neben dem Ball
Das Gegenteil von links ist ___ = rechts | oben | vorne
Das Gegenteil von oben ist ___ = unten | rechts | hinten
Das Gegenteil von vorne ist ___ = hinten | unten | links
Mit welcher Hand schreiben die meisten Kinder? = rechts | links
Lisa steht vor Tom. Wer steht hinten? = Tom | Lisa
Das Buch liegt zwischen der Tasche und dem Heft. Was liegt in der Mitte? = das Buch | die Tasche | das Heft
Die Katze sitzt auf dem Dach. Wo ist das Dach? = unter der Katze | über der Katze | neben der Katze
Der Hund ist im Haus. Ist er drinnen oder draußen? = drinnen | draußen
Das Bild hängt über dem Sofa. Was ist unten? = das Sofa | das Bild
Das Fenster ist links von der Tür. Wo ist die Tür? = rechts vom Fenster | links vom Fenster | über dem Fenster
Anna sitzt rechts von Ben. Wo sitzt Ben? = links von Anna | rechts von Anna | hinter Anna
Die Lampe hängt über dem Tisch. Was ist näher am Boden? = der Tisch | die Lampe
Im Regal steht das Glas hinter der Flasche. Was siehst du zuerst? = die Flasche | das Glas
Der Baum steht neben dem Haus. Heißt das: direkt daneben? = ja | nein, darüber`,
  "mathe.vs.geometrie.muster": `Wie geht es weiter? ▲ ● ▲ ● ▲ ___ = ● | ▲ | ■
Wie geht es weiter? ■ ■ ● ■ ■ ● ■ ■ ___ = ● | ■ | ▲
Wie geht es weiter? ● ▲ ■ ● ▲ ■ ● ___ = ▲ | ■ | ●
Wie geht es weiter? ★ ★ ● ★ ★ ● ___ = ★ | ● | ■
Wie geht es weiter? ▲ ▲ ■ ■ ▲ ▲ ■ ___ = ■ | ▲ | ●
Wie geht es weiter? ● ●● ●●● ●●●● ___ = ●●●●● | ●●● | ●●●●●●
Wie geht es weiter? ↑ → ↓ ← ↑ → ___ = ↓ | ← | ↑
Ein Parkett ist ein Muster aus Formen, die ___ = ohne Lücke aneinanderpassen | sich überlappen | weit auseinander liegen
Mit welcher Form kann man eine Fläche lückenlos auslegen? = Quadrat | Kreis
Welche Form legt eine Fläche lückenlos aus, wie bei Bienenwaben? = Sechseck | Kreis
Welche Form passt ohne Lücke aneinander? = gleichseitiges Dreieck | Kreis
Wie geht es weiter? 2, 4, 6, 8, ___ = 10 | 9 | 12
Wie geht es weiter? ■ ▲ ▲ ■ ▲ ▲ ■ ___ = ▲ | ■ | ●
Wie geht es weiter? ○ ● ○ ● ○ ___ = ● | ○ | ■
Wie geht es weiter? ▲ ■ ● ● ■ ▲ ▲ ■ ___ = ● | ▲ | ■
Merke: Das Muster läuft hin und zurück.
Wie geht es weiter? ♥ ♥ ♦ ♥ ♥ ♦ ♥ ___ = ♥ | ♦ | ♣
Bei einem Bandornament wiederholt sich ___ = immer dasselbe Stück | nie etwas | nur die Farbe
Lückenlos auslegen geht mit ___ = Rechtecken | Kreisen | Sternen`,
  "mathe.vs.geometrie.symmetrie": `Wie viele Symmetrieachsen hat ein Quadrat? = 4 | 2 | 1
Wie viele Symmetrieachsen hat ein Rechteck (kein Quadrat)? = 2 | 4 | 1
Wie viele Symmetrieachsen hat ein Kreis? = unendlich viele | 1 | 4
Wie viele Symmetrieachsen hat ein gleichseitiges Dreieck? = 3 | 1 | 6
Ist der Buchstabe A achsensymmetrisch? = ja | nein
Ist der Buchstabe F achsensymmetrisch? = nein | ja
Ist der Buchstabe H achsensymmetrisch? = ja | nein
Ist der Buchstabe R achsensymmetrisch? = nein | ja
Ist der Buchstabe M achsensymmetrisch? = ja | nein
Ist die Ziffer 8 achsensymmetrisch? = ja | nein
Ist die Ziffer 7 achsensymmetrisch? = nein | ja
Ein Spiegelbild ist vom Spiegel ___ = gleich weit weg wie das Original | doppelt so weit weg | näher dran
Ein Schmetterling ist ___ = achsensymmetrisch | nicht symmetrisch
Wenn man eine symmetrische Figur an der Achse faltet, ___ = liegen beide Hälften genau aufeinander | bleibt eine Hälfte größer`,
  "mathe.vs.geometrie.wuerfelgebaeude": `Ein Würfel hat wie viele Flächen? = 6 | 4 | 8
Ein Würfel hat wie viele Ecken? = 8 | 6 | 12
Ein Würfel hat wie viele Kanten? = 12 | 8 | 6
Ein Turm aus 3 Würfeln auf einem Feld: Im Bauplan steht in dem Feld die Zahl ___ = 3 | 1 | 9
Ein Bauplan zeigt das Gebäude ___ = von oben | von vorne | von der Seite
Merke: Die Zahl im Feld sagt, wie viele Würfel übereinander stehen.
Bauplan: 2 Felder mit je 2 Würfeln. Wie viele Würfel sind es? = 4 | 2 | 6
Bauplan: Felder mit 1, 2 und 3. Wie viele Würfel sind es? = 6 | 3 | 5
Bauplan: 4 Felder mit je 1 Würfel. Wie hoch ist das Gebäude? = 1 Würfel | 4 Würfel | 2 Würfel
Bauplan: Felder mit 3, 1, 1 und 2. Wie viele Würfel sind es? = 7 | 4 | 6
Bauplan: Felder mit 2, 2, 2 und 2. Wie viele Würfel sind es? = 8 | 4 | 6
Ein großer Würfel aus 2 · 2 · 2 kleinen Würfeln hat wie viele kleine Würfel? = 8 | 6 | 4
Ein großer Würfel aus 3 · 3 · 3 kleinen Würfeln hat wie viele kleine Würfel? = 27 | 9 | 18`,
  "mathe.vs.geometrie.strecken": `Zwei Geraden, die sich nie schneiden, sind ___ = parallel | normal | gleich lang
Zwei Geraden, die sich im rechten Winkel schneiden, sind ___ = normal | parallel | schief
Merke: Normal heißt auch senkrecht.
Das Zeichen für „parallel“ ist ___ = ∥ | ⊥ | =
Das Zeichen für „normal“ ist ___ = ⊥ | ∥ | ≈
Eine Strecke hat ___ = zwei Endpunkte | keinen Endpunkt | einen Endpunkt
Eine Gerade hat ___ = keinen Endpunkt | zwei Endpunkte | einen Endpunkt
Ein Strahl hat ___ = einen Anfangspunkt | zwei Endpunkte | keinen Punkt
Die Linien in einem Schulheft (Zeilen) sind zueinander ___ = parallel | normal
Die Kanten an einer Ecke eines Blattes stehen zueinander ___ = normal | parallel
Mit dem Geodreieck zeichnet man einen rechten Winkel. Er hat ___ = 90° | 180° | 45°
Wie misst man eine Strecke? = mit dem Lineal | mit dem Zirkel | mit der Waage
Zwei Seiten eines Rechtecks, die gegenüber liegen, sind ___ = parallel | normal
Zwei Seiten eines Rechtecks, die sich an einer Ecke treffen, sind ___ = normal | parallel
Die Strecke von A nach B schreibt man ___ = AB | A + B | A · B
Eine Strecke ist 5 cm lang. Wie lang ist die halbe Strecke? = 2,5 cm | 2 cm | 10 cm`,
  "mathe.vs.geometrie.plaene": `Auf einem Plan im Maßstab 1 : 100 ist 1 cm in Wirklichkeit ___ = 1 m | 100 m | 10 cm
Auf einem Plan im Maßstab 1 : 100 ist ein Zimmer 4 cm lang. In Wirklichkeit sind das ___ = 4 m | 40 m | 400 m
Auf einer Karte im Maßstab 1 : 1 000 ist 1 cm in Wirklichkeit ___ = 10 m | 100 m | 1 m
Ein Plan zeigt alles ___ = verkleinert | vergrößert | in echter Größe
Auf einer Landkarte ist Norden meistens ___ = oben | unten | links
Das Gegenteil von Norden ist ___ = Süden | Osten | Westen
Wenn Norden oben ist, ist Osten ___ = rechts | links | unten
Wenn Norden oben ist, ist Westen ___ = links | rechts | oben
Die Sonne geht im ___ auf. = Osten | Westen | Norden
Die Sonne geht im ___ unter. = Westen | Osten | Süden
Auf einem Plan im Maßstab 1 : 100 ist ein Tisch 2 cm lang. In Wirklichkeit ist er ___ = 2 m | 20 cm | 200 m
Ein Weg ist in Wirklichkeit 300 m lang. Auf dem Plan 1 : 10 000 sind das ___ = 3 cm | 30 cm | 3 mm
Was steht in der Legende einer Karte? = was die Zeichen bedeuten | wer die Karte gemalt hat | das Datum
Ein Grundriss zeigt ein Haus ___ = von oben | von vorne | von innen
Auf dem Stadtplan ist die Schule 4 cm vom Bahnhof entfernt, Maßstab 1 : 10 000. Das sind ___ = 400 m | 40 m | 4 km`,
  "mathe.vs.geometrie.netze": `Ein Würfelnetz besteht aus ___ = 6 Quadraten | 4 Quadraten | 8 Quadraten
Ein Quadernetz besteht aus ___ = 6 Rechtecken | 4 Rechtecken | 5 Rechtecken
Merke: Ein Quader hat 6 Flächen, je zwei gegenüber sind gleich groß.
Wie viele verschiedene Würfelnetze gibt es? = 11 | 6 | 4
Kann man aus 6 Quadraten in einer langen Reihe einen Würfel falten? = nein | ja
Ein Würfelnetz in Kreuzform (4 in einer Reihe, je eines oben und unten) ist ___ = ein Würfelnetz | kein Würfelnetz
Beim Würfel liegen gegenüberliegende Augen zusammen immer auf ___ = 7 | 6 | 12
Merke: 1 liegt gegenüber von 6, 2 gegenüber von 5, 3 gegenüber von 4.
Gegenüber der 1 liegt beim Spielwürfel die ___ = 6 | 2 | 3
Gegenüber der 3 liegt beim Spielwürfel die ___ = 4 | 5 | 6
Gegenüber der 2 liegt beim Spielwürfel die ___ = 5 | 4 | 1
Wie viele Flächen hat ein Quader? = 6 | 4 | 8
Wie viele Ecken hat ein Quader? = 8 | 6 | 12
Wie viele Kanten hat ein Quader? = 12 | 8 | 10
Eine Kugel hat wie viele Ecken? = 0 | 1 | 8
Ein Zylinder hat wie viele Flächen? = 3 | 2 | 6
Merke: zwei Kreise oben und unten und ein Mantel.
Ein Würfelnetz aus 6 Quadraten in Form eines T (4 unten, 2 oben) ist ___ = kein Würfelnetz | ein Würfelnetz`,
  "mathe.vs.geometrie.zusammengesetzt": `Umfang heißt: ___ = alle Seiten zusammengezählt | Länge mal Breite | nur die längste Seite
Flächeninhalt eines Rechtecks = Länge ___ Breite = mal | plus | minus
Ein Rechteck ist 5 cm lang und 3 cm breit. Der Umfang ist ___ = 16 cm | 15 cm | 8 cm
Merke: 5 + 3 + 5 + 3 = 16
Ein Rechteck ist 5 cm lang und 3 cm breit. Der Flächeninhalt ist ___ = 15 cm² | 16 cm² | 8 cm²
Ein Quadrat hat 4 cm Seitenlänge. Der Umfang ist ___ = 16 cm | 8 cm | 16 cm²
Ein Quadrat hat 4 cm Seitenlänge. Der Flächeninhalt ist ___ = 16 cm² | 8 cm² | 16 cm
Ein L aus zwei Rechtecken: 3 cm² und 5 cm². Die ganze Fläche ist ___ = 8 cm² | 15 cm² | 2 cm²
Den Flächeninhalt gibt man in ___ an. = cm², m² … | cm, m … | kg, g …
Den Umfang gibt man in ___ an. = cm, m … | cm², m² … | Liter
Ein Rechteck hat 20 cm² und ist 5 cm lang. Wie breit ist es? = 4 cm | 15 cm | 10 cm
Zwei Quadrate mit je 9 cm² liegen nebeneinander. Die Fläche ist ___ = 18 cm² | 9 cm² | 81 cm²
Ein Rechteck ist 6 m lang und 2 m breit. Der Umfang ist ___ = 16 m | 12 m | 8 m
Ein Rechteck ist 6 m lang und 2 m breit. Der Flächeninhalt ist ___ = 12 m² | 16 m² | 8 m²
Ein Quadrat hat 10 cm Seitenlänge. Der Flächeninhalt ist ___ = 100 cm² | 40 cm² | 20 cm²
Ein Quadrat hat einen Umfang von 20 cm. Eine Seite ist ___ = 5 cm | 10 cm | 4 cm`,
  "mathe.vs.geometrie.raster": `Eine Figur wird doppelt so groß gezeichnet. Eine Seite mit 3 Kästchen wird ___ = 6 Kästchen lang | 5 Kästchen lang | 9 Kästchen lang
Eine Figur wird auf die Hälfte verkleinert. Eine Seite mit 8 Kästchen wird ___ = 4 Kästchen lang | 6 Kästchen lang | 16 Kästchen lang
Beim Vergrößern bleiben die Winkel ___ = gleich | doppelt so groß | kleiner
Ein Quadrat mit 2 Kästchen Seite wird doppelt so groß. Seine neue Seite ist ___ = 4 Kästchen | 3 Kästchen | 8 Kästchen
Ein Quadrat mit 2 Kästchen Seite hat 4 Kästchen Fläche. Doppelt so lange Seiten ergeben ___ = 16 Kästchen | 8 Kästchen | 6 Kästchen
Merke: Doppelt so lange Seiten ergeben die vierfache Fläche.
Eine Figur dreimal so groß: Eine Seite mit 2 Kästchen wird ___ = 6 Kästchen | 5 Kästchen | 4 Kästchen
Ein Rechteck 4 × 2 Kästchen, halb so groß: ___ = 2 × 1 Kästchen | 2 × 2 Kästchen | 4 × 1 Kästchen
Ein Rechteck 3 × 1 Kästchen, doppelt so groß: ___ = 6 × 2 Kästchen | 6 × 1 Kästchen | 5 × 3 Kästchen
Wenn man eine Figur verkleinert, wird sie ___ = kleiner, aber hat dieselbe Form | schmaler, aber gleich hoch | ganz anders
Ein Dreieck im Raster wird doppelt so groß. Seine Ecken sind danach ___ = doppelt so weit voneinander | gleich weit voneinander | halb so weit voneinander
Ein Rechteck 2 × 3 Kästchen hat 6 Kästchen Fläche. Doppelt so groß (Seiten) hat es ___ = 24 Kästchen | 12 Kästchen | 10 Kästchen
Ein Rechteck 6 × 4 Kästchen, halb so groß: ___ = 3 × 2 Kästchen | 3 × 4 Kästchen | 4 × 2 Kästchen
Ein Quadrat mit 3 Kästchen Seite, dreimal so groß: Seite ___ = 9 Kästchen | 6 Kästchen | 27 Kästchen
Ein Quadrat mit 6 Kästchen Seite, ein Drittel so groß: Seite ___ = 2 Kästchen | 3 Kästchen | 18 Kästchen
Vergrößern im Raster: Man zählt die Kästchen jeder Seite und ___ = nimmt sie mal | zählt 1 dazu | zieht 1 ab`,
  "mathe.vs.sach.proportional": { erzeuge: (rng) => proportional(rng), anzahl: 40 },
  "mathe.vs.daten.strichliste": `In einer Strichliste steht ||||. Das sind ___ = 4 | 5 | 3
Fünf Striche schreibt man meistens als ___ = vier Striche und einen quer | fünf Striche nebeneinander | einen Kreis
Zwei Fünferbündel und 3 Striche sind ___ = 13 | 23 | 8
Drei Fünferbündel sind ___ = 15 | 3 | 8
Vier Fünferbündel und 1 Strich sind ___ = 21 | 41 | 9
Wofür ist eine Strichliste gut? = schnell mitzählen | rechnen mit Brüchen | Längen messen
In der Klasse mögen 7 Kinder Pizza und 5 Kinder Nudeln. Wie viele sind es zusammen? = 12 | 2 | 35
In der Klasse mögen 9 Kinder Fußball und 4 Kinder Tennis. Wie viele mehr mögen Fußball? = 5 | 13 | 4
In einer Tabelle stehen die Werte in ___ = Zeilen und Spalten | Kreisen | Pfeilen
Einmal Würfeln: 3 Einser, 5 Zweier, 2 Dreier. Welche Zahl kam am öftesten? = 2 | 1 | 3
Ein Fünferbündel und 4 Striche sind ___ = 9 | 54 | 5
Wie schreibst du 12 in einer Strichliste? = zwei Fünferbündel und 2 Striche | 12 Striche einzeln | ein Bündel und 2 Striche
Eine Tabelle: Äpfel 6, Birnen 4. Wie viele Früchte? = 10 | 2 | 24
Eine Tabelle: Montag 3 Tore, Dienstag 5 Tore. Wie viele Tore mehr am Dienstag? = 2 | 8 | 15
Eine Strichliste zählt Autos: rot ||||| ||, blau |||. Wie viele rote? = 7 | 3 | 10`,
  "mathe.vs.daten.diagramme": `Bei einem Säulendiagramm zeigt die höchste Säule ___ = den größten Wert | den kleinsten Wert | den Durchschnitt
Säulen stehen senkrecht, Balken liegen ___ = waagrecht | senkrecht | schräg
Ein Bildchen im Piktogramm steht für 2 Kinder. 4 Bildchen sind ___ = 8 Kinder | 4 Kinder | 6 Kinder
Ein Bildchen im Piktogramm steht für 5 Autos. 3 Bildchen sind ___ = 15 Autos | 8 Autos | 3 Autos
Ein Bildchen steht für 10 Bücher. 6 Bildchen sind ___ = 60 Bücher | 16 Bücher | 6 Bücher
Ein halbes Bildchen steht für die Hälfte. Ein Bildchen = 4 Kinder, 2½ Bildchen sind ___ = 10 Kinder | 8 Kinder | 9 Kinder
Im Diagramm: Montag 4, Dienstag 7, Mittwoch 5. An welchem Tag am meisten? = Dienstag | Montag | Mittwoch
Im Diagramm: Montag 4, Dienstag 7, Mittwoch 5. Wie viele insgesamt? = 16 | 7 | 15
Im Diagramm: Rot 6, Blau 9, Grün 3. Wie viele mehr Blau als Grün? = 6 | 3 | 12
Was steht bei einem Diagramm an der Achse? = die Werte (Zahlen) | Geschichten | nichts
Ein Bildchen steht für 3 Kinder. 5 Bildchen sind ___ = 15 Kinder | 8 Kinder | 5 Kinder
Die Säule für Mai ist doppelt so hoch wie für April (April 4). Wie hoch ist Mai? = 8 | 6 | 2
Ein Diagramm ohne Beschriftung ist ___ = schwer zu lesen | leichter zu lesen | genauer
Im Balkendiagramm ist der längste Balken ___ = der größte Wert | der kleinste Wert
Im Diagramm: Hund 8, Katze 8, Hase 2. Welche Tiere sind gleich beliebt? = Hund und Katze | Katze und Hase | alle`,
  "mathe.vs.daten.kombinatorik": `2 T-Shirts und 3 Hosen: Wie viele Kombinationen gibt es? = 6 | 5 | 8
3 Eissorten, du nimmst eine Kugel in der Tüte oder im Becher: wie viele Möglichkeiten? = 6 | 5 | 3
Wie viele Arten gibt es, A, B und C in eine Reihe zu stellen? = 6 | 3 | 9
Merke: ABC, ACB, BAC, BCA, CAB, CBA.
Wie viele zweistellige Zahlen kann man aus den Ziffern 1 und 2 bilden (jede einmal)? = 2 | 4 | 1
Merke: 12 und 21.
4 Kinder geben sich alle die Hand. Wie oft wird Hand gegeben? = 6 | 8 | 16
3 Kinder geben sich alle die Hand. Wie oft wird Hand gegeben? = 3 | 6 | 9
2 Vorspeisen, 2 Hauptspeisen, 2 Nachspeisen: Wie viele Menüs? = 8 | 6 | 4
3 Hosen und 3 Pullis: Wie viele Kombinationen? = 9 | 6 | 3
Wie viele Möglichkeiten gibt es, zwei Münzen zu werfen (Kopf/Zahl)? = 4 | 2 | 3
Merke: KK, KZ, ZK, ZZ.
2 Farben für das Dach, 3 Farben für die Wand: Wie viele Häuser? = 6 | 5 | 9
Wie viele Arten gibt es, 2 Kinder auf 2 Plätze zu setzen? = 2 | 4 | 1
Aus den Ziffern 1, 2, 3 (jede einmal): Wie viele dreistellige Zahlen? = 6 | 3 | 9
Aus 3 Obstsorten nimmst du 2 verschiedene: Wie viele Möglichkeiten? = 3 | 6 | 2
Merke: Apfel-Birne, Apfel-Banane, Birne-Banane.
4 Hosen und 2 Pullis: Wie viele Kombinationen? = 8 | 6 | 2
Beim Kombinieren hilft ___ = ein Baumdiagramm oder eine Tabelle | ein Zirkel | ein Maßband`,
  "mathe.vs.daten.wahrscheinlich": `Morgen geht die Sonne auf. = sicher | möglich | unmöglich
Mit einem normalen Würfel eine 7 würfeln. = unmöglich | möglich | sicher
Mit einem Würfel eine 6 würfeln. = möglich | sicher | unmöglich
Mit einem Würfel eine Zahl kleiner als 7 würfeln. = sicher | möglich | unmöglich
Eine Münze zeigt Kopf. = möglich | sicher | unmöglich
In einer Dose sind nur rote Kugeln. Du ziehst eine rote. = sicher | möglich | unmöglich
In einer Dose sind nur rote Kugeln. Du ziehst eine blaue. = unmöglich | möglich | sicher
In einer Dose sind 5 rote und 1 blaue Kugel. Was ziehst du wahrscheinlicher? = rot | blau | beides gleich
Ein Würfel: Ist eine gerade oder eine ungerade Zahl wahrscheinlicher? = beides gleich | gerade | ungerade
Morgen schneit es im August in Wien. = möglich, aber sehr unwahrscheinlich | sicher | wahrscheinlich
Ein Glücksrad hat 3 rote und 1 grünes Feld. Was kommt eher? = rot | grün | beides gleich
Ein Würfel zeigt eine Zahl größer als 4. = möglich | sicher | unmöglich
Im Sack sind 2 rote und 2 blaue Kugeln. Was ist wahrscheinlicher? = beides gleich | rot | blau
Am Montag folgt der Dienstag. = sicher | möglich | unmöglich
Eine Münze landet auf der Kante und bleibt stehen. = sehr unwahrscheinlich | sicher | wahrscheinlich`,
  "mathe.vs.daten.zufallsexperimente": `Ein Zufallsexperiment ist zum Beispiel ___ = Würfeln | Rechnen | Lesen
Beim Münzwurf gibt es wie viele Ergebnisse? = 2 | 1 | 6
Beim Würfeln gibt es wie viele Ergebnisse? = 6 | 2 | 12
Du würfelst 60-mal. Wie oft kommt die 6 ungefähr? = 10-mal | 6-mal | 60-mal
Du wirfst eine Münze 20-mal. Wie oft kommt Kopf ungefähr? = 10-mal | 20-mal | 2-mal
Ist das Ergebnis vorher bekannt? = nein, es ist Zufall | ja, immer
Man schreibt die Ergebnisse oft in eine ___ = Strichliste | Einkaufsliste | Formel
Je öfter man würfelt, desto ___ wird es gleichmäßig. = eher | weniger
Ein Glücksrad mit 4 gleich großen Feldern: Wie oft kommt Feld 1 bei 40 Drehungen ungefähr? = 10-mal | 4-mal | 40-mal
Bei einem Glücksrad mit 2 roten und 2 blauen Feldern ist rot ___ = genauso wahrscheinlich wie blau | sicher | unmöglich
Du würfelst 6-mal. Muss jede Zahl genau einmal kommen? = nein | ja
Welche Zahl kommt beim Würfeln am häufigsten, wenn man sehr oft würfelt? = alle etwa gleich oft | die 6 | die 1
Eine Münze zeigt 3-mal hintereinander Kopf. Beim nächsten Wurf ist Kopf ___ = genauso wahrscheinlich wie vorher | sicher | unmöglich
Was ist kein Zufallsexperiment? = 2 + 2 ausrechnen | Würfeln | Los ziehen
Du ziehst blind aus 9 grünen und 1 gelben Kugel. Was kommt eher? = grün | gelb | gleich oft`,
  "mathe.vs.brueche.bruchteile": `Eine Pizza in 4 gleiche Stücke. Ein Stück ist ___ = ein Viertel | ein Drittel | eine Hälfte
Eine Torte in 2 gleiche Teile. Ein Teil ist ___ = eine Hälfte | ein Viertel | ein Zweitel Kilo
Ein Kuchen in 8 Stücke, du isst 3. Du hast ___ gegessen. = 3/8 | 3/5 | 8/3
Die untere Zahl beim Bruch (Nenner) sagt: ___ = in wie viele Teile geteilt wird | wie viele Teile man nimmt
Die obere Zahl beim Bruch (Zähler) sagt: ___ = wie viele Teile man nimmt | in wie viele Teile geteilt wird
2 von 3 gleichen Teilen sind ___ = 2/3 | 3/2 | 1/3
Ein Ganzes sind ___ Viertel. = 4 | 2 | 1
Ein Ganzes sind ___ Halbe. = 2 | 4 | 1
1/2 schreibt man in Worten ___ = ein Halb | ein Zweitel | ein Doppeltes
3/4 schreibt man in Worten ___ = drei Viertel | drei Vierer | vier Drittel
Eine Schokolade mit 10 Stücken, 5 sind weg. Das ist ___ = die Hälfte | ein Fünftel | ein Zehntel
Ein Viertel einer Stunde sind ___ = 15 Minuten | 25 Minuten | 4 Minuten
Eine halbe Stunde sind ___ = 30 Minuten | 50 Minuten | 20 Minuten
Ein halber Meter sind ___ = 50 cm | 5 cm | 20 cm
Ein Viertelkilo sind ___ = 250 g | 400 g | 25 g`,
  "mathe.vs.brueche.vergleichen": `Was ist mehr: 1/2 oder 1/4 einer Pizza? = 1/2 | 1/4 | gleich viel
Was ist mehr: 1/3 oder 1/2? = 1/2 | 1/3 | gleich viel
Merke: Je mehr Teile, desto kleiner ist jedes Stück.
Was ist mehr: 3/4 oder 1/4? = 3/4 | 1/4 | gleich viel
Was ist mehr: 2/4 oder 1/2? = gleich viel | 2/4 | 1/2
Was ist mehr: 1/10 oder 1/5? = 1/5 | 1/10 | gleich viel
Ein Ganzes sind wie viele Viertel? = 4/4 | 1/4 | 4/1
1/4 + 1/4 = ___ = 1/2 | 2/8 | 1/8
1/2 + 1/4 = ___ = 3/4 | 2/6 | 2/4
Wie viele Viertel sind in einer Hälfte? = 2 | 4 | 1
Was ist weniger: 2/3 oder 1/3? = 1/3 | 2/3 | gleich viel
Was ist mehr: 3/8 oder 5/8? = 5/8 | 3/8 | gleich viel
Was ist mehr: 1/4 oder 1/3? = 1/3 | 1/4 | gleich viel
1/2 und 2/4 sind ___ = gleich viel | verschieden | nicht vergleichbar
Zwei Hälften sind ___ = ein Ganzes | ein Viertel | zwei Ganze
3 Drittel sind ___ = ein Ganzes | drei Ganze | ein Drittel`,
  "mathe.vs.brueche.vongroessen": { erzeuge: (rng) => bruchVonGroesse(rng), anzahl: 40 },
};
