/**
 * Mathe-Quiz Oberstufe, Statistik und Wahrscheinlichkeit: Begriffe als Text, Kennzahlen, Binomialverteilung,
 * Erwartungswert und Gegenereignis mit Erzeugern (falsche Antworten = typische Fehler: Varianz statt
 * Standardabweichung, „mindestens einmal“ ohne Gegenereignis, Binomialkoeffizient vergessen …).
 * Format: lib/lernspiele-quiz.ts.
 */
import type { QuizBank } from "../lernspiele-quiz";
import { bruch, eins, ganz, runde, wahl, zahl, type Rng } from "./hilfen";

const fak = (n: number): number => (n <= 1 ? 1 : n * fak(n - 1));
const nk = (n: number, k: number) => Math.round(fak(n) / (fak(k) * fak(n - k)));
const prozent = (p: number, st = 2) => `${zahl(runde(p * 100, st), st)} %`;

const streuung = (rng: Rng) => {
  const m = ganz(rng, 3, 10);
  const d = eins(rng, [[1, 1], [2, 2], [1, 3], [2, 4]] as [number, number][]);
  const xs = [m - d[1], m - d[0], m, m + d[0], m + d[1]];
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  const sd = runde(Math.sqrt(v), 2);
  if (rng() < 0.5) return wahl(`Werte ${xs.join(", ")}: Varianz (durch n) = ___`, zahl(v), [zahl(sd), zahl(runde((v * xs.length) / (xs.length - 1), 2)), zahl(xs.reduce((s, x) => s + Math.abs(x - m), 0) / xs.length)].filter((s) => s !== zahl(v)), `Mittelwert ${m}; Varianz = Mittel der quadrierten Abstände`);
  return wahl(`Werte ${xs.join(", ")}: Standardabweichung (durch n) = ___`, zahl(sd), [zahl(v), zahl(runde(Math.sqrt((v * xs.length) / (xs.length - 1)), 2)), zahl(d[1])].filter((s) => s !== zahl(sd)), "Standardabweichung = √Varianz");
};

const quartile = (rng: Rng) => {
  const xs = Array.from({ length: 7 }, () => ganz(rng, 1, 30)).sort((a, b) => a - b);
  const art = ganz(rng, 0, 2);
  const liste = [...xs].sort(() => rng() - 0.5).join(", ");
  if (art === 0) return wahl(`Werte ${liste}: Median = ___`, zahl(xs[3]), [zahl(runde(xs.reduce((a, b) => a + b, 0) / 7, 2)), zahl(xs[2]), String(liste.split(", ")[3])].filter((s) => s !== zahl(xs[3])), "Erst ordnen, dann der mittlere Wert.");
  if (art === 1) return wahl(`Werte ${liste}: Spannweite = ___`, zahl(xs[6] - xs[0]), [zahl(xs[6]), zahl(xs[5] - xs[1]), zahl(xs[6] + xs[0])].filter((s) => s !== zahl(xs[6] - xs[0])), "Spannweite = größter − kleinster Wert");
  return wahl(`Geordnet: ${xs.join(", ")}. Unteres Quartil q₁ = ___`, zahl(xs[1]), [zahl(xs[0]), zahl(xs[3]), zahl(xs[5])].filter((s) => s !== zahl(xs[1])), "q₁ ist der Median der unteren Hälfte (ohne den Median).");
};

const geoMittel = (rng: Rng) => {
  const [a, b] = eins(rng, [[1.1, 1.21], [1.05, 1.2], [1.1, 0.9], [1.2, 1.3], [1.5, 0.5], [1.02, 1.08]] as [number, number][]);
  if (rng() < 0.4) return wahl(`Wachstumsfaktoren ${zahl(a)} und ${zahl(b)}: durchschnittlicher Faktor (geometrisches Mittel) ≈ ___`, zahl(runde(Math.sqrt(a * b), 4), 4), [zahl(runde((a + b) / 2, 4), 4), zahl(runde(a * b, 4), 4)].filter((s) => s !== zahl(runde(Math.sqrt(a * b), 4), 4)), "Geometrisches Mittel: √(a · b), bei Faktoren statt Summen.");
  const xs = Array.from({ length: 6 }, () => eins(rng, [1, 2, 2, 3, 3, 3, 4, 5]));
  const zaehl = new Map<number, number>();
  xs.forEach((x) => zaehl.set(x, (zaehl.get(x) ?? 0) + 1));
  const max = Math.max(...zaehl.values());
  const modi = [...zaehl.entries()].filter(([, c]) => c === max).map(([x]) => x);
  if (modi.length !== 1) return [];
  return wahl(`Werte ${xs.join(", ")}: Modus = ___`, zahl(modi[0]), [zahl(runde(xs.reduce((a2, b2) => a2 + b2, 0) / 6, 2)), zahl(Math.max(...xs)), zahl(max)].filter((s) => s !== zahl(modi[0])), "Der Modus ist der häufigste Wert.");
};

const gegenereignis = (rng: Rng) => {
  const p = eins(rng, [0.1, 0.2, 0.25, 0.3, 0.4, 0.05, 0.6]);
  if (rng() < 0.5) return wahl(`P(A) = ${zahl(p)}. P(nicht A) = ___`, zahl(runde(1 - p, 4)), [zahl(p), zahl(-p), zahl(runde(1 / p, 2))].filter((s) => s !== zahl(runde(1 - p, 4))), "P(nicht A) = 1 − P(A)");
  const q = eins(rng, [0.1, 0.2, 0.3]);
  return wahl(`A und B schließen sich aus. P(A) = ${zahl(p)}, P(B) = ${zahl(q)}. P(A oder B) = ___`, zahl(runde(p + q, 4)), [zahl(runde(p * q, 4)), zahl(runde(1 - p - q, 4)), zahl(runde(p + q - p * q, 4))].filter((s) => s !== zahl(runde(p + q, 4))), "Unvereinbare Ereignisse: P(A ∪ B) = P(A) + P(B)");
};

const mindestens = (rng: Rng) => {
  const [p, txt] = eins(rng, [[1 / 6, "eine Sechs"], [0.5, "Kopf"], [0.1, "einen Treffer (p = 0,1)"], [0.2, "einen Treffer (p = 0,2)"]] as [number, string][]);
  const n = ganz(rng, 2, 5);
  const r = 1 - (1 - p) ** n;
  return wahl(`${n}-mal versuchen: P(mindestens einmal ${txt}) ≈ ___`, prozent(r), [prozent(Math.min(1, n * p)), prozent((1 - p) ** n), prozent(p ** n)].filter((s) => s !== prozent(r)), "P(mindestens einmal) = 1 − P(keinmal) = 1 − (1 − p)ⁿ");
};

const bedingt = (rng: Rng) => {
  const ab = eins(rng, [10, 12, 15, 20, 24, 30]);
  const a = ab + eins(rng, [10, 15, 20, 30]);
  const n = a + eins(rng, [40, 50, 60, 70]);
  return wahl(`Von ${n} Personen haben ${a} A, davon ${ab} auch B. P(B ∣ A) = ___`, bruch(ab, a), [bruch(ab, n), bruch(a, n), bruch(a - ab, a)].filter((s) => s !== bruch(ab, a)), "P(B ∣ A) = P(A ∩ B)/P(A): nur unter denen mit A zählen.");
};

const binomKoeff = (rng: Rng) => {
  const n = ganz(rng, 3, 8);
  const k = ganz(rng, 1, n - 1);
  if (rng() < 0.3) return wahl(`${n}! = ___`, zahl(fak(n)), [zahl(n * (n - 1)), zahl((n * (n + 1)) / 2), zahl(fak(n - 1))].filter((s) => s !== zahl(fak(n))), "n! = 1 · 2 · 3 · … · n");
  return wahl(`(${n} über ${k}) = ___`, zahl(nk(n, k)), [zahl(n * k), zahl(fak(n) / fak(n - k)), zahl(nk(n, k) + n)].filter((s) => s !== zahl(nk(n, k))), "(n über k) = n!/(k! · (n − k)!): so viele Möglichkeiten, k aus n ohne Reihenfolge zu wählen.");
};

const erwartung = (rng: Rng) => {
  const xs = [ganz(rng, 0, 2), ganz(rng, 3, 5), ganz(rng, 6, 10)];
  const ps = eins(rng, [[0.5, 0.3, 0.2], [0.2, 0.5, 0.3], [0.6, 0.3, 0.1], [0.25, 0.25, 0.5]] as number[][]);
  const e = runde(xs.reduce((s, x, i) => s + x * ps[i], 0), 2);
  return wahl(`X nimmt ${xs.join(", ")} an mit P = ${ps.map((p) => zahl(p)).join(", ")}. E(X) = ___`, zahl(e), [zahl(runde((xs[0] + xs[1] + xs[2]) / 3, 2)), zahl(xs[1]), zahl(runde(e + 1, 2))].filter((s) => s !== zahl(e)), "E(X) = Summe von Wert · Wahrscheinlichkeit");
};

const binomial = (rng: Rng) => {
  const n = ganz(rng, 3, 8);
  const k = ganz(rng, 0, Math.min(n, 4));
  const p = eins(rng, [0.1, 0.2, 0.3, 0.5]);
  const r = nk(n, k) * p ** k * (1 - p) ** (n - k);
  return wahl(`X binomialverteilt, n = ${n}, p = ${zahl(p)}. P(X = ${k}) ≈ ___`, prozent(r), [prozent(p ** k * (1 - p) ** (n - k)), prozent(nk(n, k) * p ** k), prozent(k / n)].filter((s) => s !== prozent(r)), `P(X = k) = (n über k) · pᵏ · (1 − p)ⁿ⁻ᵏ = ${nk(n, k)} · ${zahl(p)}^${k} · ${zahl(runde(1 - p, 2))}^${n - k}`);
};

const binomErwartung = (rng: Rng) => {
  const n = eins(rng, [10, 20, 25, 50, 100, 200]);
  const p = eins(rng, [0.1, 0.2, 0.25, 0.4, 0.5]);
  if (rng() < 0.5) return wahl(`n = ${n}, p = ${zahl(p)}: Erwartungswert ___`, zahl(n * p), [zahl(runde(n * p * (1 - p), 2)), zahl(n * (1 - p)), zahl(runde(Math.sqrt(n * p), 2))].filter((s) => s !== zahl(n * p)), "E(X) = n · p");
  const sd = runde(Math.sqrt(n * p * (1 - p)), 2);
  return wahl(`n = ${n}, p = ${zahl(p)}: Standardabweichung ≈ ___`, zahl(sd), [zahl(runde(n * p * (1 - p), 2)), zahl(n * p), zahl(runde(Math.sqrt(n * p), 2))].filter((s) => s !== zahl(sd)), "σ = √(n · p · (1 − p))");
};

const normal = (rng: Rng) => {
  const mu = eins(rng, [50, 100, 170, 500, 1000]);
  const s = eins(rng, [2, 5, 10, 15, 20]);
  const k = eins(rng, [1, 2, 3]);
  const w = k === 1 ? "68,3 %" : k === 2 ? "95,4 %" : "99,7 %";
  return wahl(`X normalverteilt, μ = ${mu}, σ = ${s}. P(${mu - k * s} ≤ X ≤ ${mu + k * s}) ≈ ___`, w, ["68,3 %", "95,4 %", "99,7 %", "50 %"].filter((x) => x !== w), "μ ± σ: 68,3 %, μ ± 2σ: 95,4 %, μ ± 3σ: 99,7 %");
};

export const MATHE_OBERSTUFE_STOCHASTIK: QuizBank = {
  "mathe.os.statistik.merkmale": `Augenfarbe ist ein ___ Merkmal. = nominales | ordinales | metrisches
Schulnoten sind ein ___ Merkmal. = ordinales | nominales | metrisches
Körpergröße ist ein ___ Merkmal. = metrisches | ordinales | nominales
Bei nominalen Merkmalen kann man ___ = nur gleich oder verschieden sagen | ordnen | Abstände rechnen
Bei ordinalen Merkmalen kann man zusätzlich ___ = ordnen | Mittelwerte bilden | multiplizieren
Den Median gibt es für ___ = ordinale und metrische Merkmale | nur nominale | gar keine
Das arithmetische Mittel ist sinnvoll für ___ = metrische Merkmale | nominale | ordinale
Kleidergröße S, M, L, XL ist ___ = ordinal | nominal | metrisch
Postleitzahlen sind ___ = nominal | metrisch | ordinal
Die Temperatur in °C ist ___ = metrisch | ordinal | nominal
Ein diskretes Merkmal hat ___ = abzählbar viele Werte | jeden Wert in einem Intervall | keine Werte
Die Zeit für einen Lauf ist ___ = stetig | diskret | nominal`,
  "mathe.os.statistik.klassen": `Bei einem Histogramm entspricht die Häufigkeit ___ = der Fläche des Rechtecks | der Höhe allein | der Breite
Klassen sollten ___ = lückenlos aneinander anschließen | sich überlappen | Lücken haben
Die Klassenbreite von [10; 20[ ist ___ = 10 | 20 | 15
Die Klassenmitte von [10; 20[ ist ___ = 15 | 10 | 20
Ein Histogramm ist sinnvoll für ___ = metrische Daten in Klassen | nominale Daten | einzelne Werte
Ungleich breite Klassen: die Höhe ist ___ = Häufigkeit : Klassenbreite | die Häufigkeit | die Breite
Klasse [0; 10[ mit 20 Werten, Breite 10: Höhe (Dichte) ___ = 2 | 20 | 10
Klasse [10; 30[ mit 20 Werten, Breite 20: Höhe (Dichte) ___ = 1 | 20 | 2
Den Mittelwert aus Klassen schätzt man mit ___ = den Klassenmitten | den Klassengrenzen | den Breiten
Gibt es beim Histogramm Lücken zwischen den Balken? = nein | ja
Zu viele Klassen machen das Bild ___ = unruhig | übersichtlicher | genauer gerundet
In [10; 20[ gehört der Wert 20 ___ = nicht dazu | dazu | doppelt`,
  "mathe.os.statistik.streuung": { text: `Die Varianz misst ___ = die Streuung um den Mittelwert | den Mittelwert | den häufigsten Wert
Die Standardabweichung ist ___ = die Wurzel der Varianz | die Varianz zum Quadrat | der Median
Haben alle Werte denselben Wert, ist die Standardabweichung ___ = 0 | 1 | unendlich
Die Stichprobenvarianz dividiert durch ___ = n − 1 | n + 1 | 2n`, erzeuge: streuung },
  "mathe.os.statistik.boxplot": { text: `Zwischen q₁ und q₃ liegen etwa ___ der Werte. = 50 % | 25 % | 75 %
Der Strich in der Box eines Boxplots ist ___ = der Median | der Mittelwert | der Modus
Der Interquartilsabstand ist ___ = q₃ − q₁ | Maximum − Minimum | q₃ + q₁
Die Antennen (Whisker) reichen bis ___ = zum Minimum und Maximum | zu den Quartilen | zum Median
Unter q₁ liegen etwa ___ der Werte. = 25 % | 50 % | 75 %`, erzeuge: quartile },
  "mathe.os.statistik.mittelwerte": { text: `Der Modus ist ___ = der häufigste Wert | der mittlere Wert | der Durchschnitt
Für durchschnittliche Wachstumsraten nimmt man ___ = das geometrische Mittel | das arithmetische Mittel | den Modus
Geometrisches Mittel von 2 und 8: ___ = 4 | 5 | 16
Bei Ausreißern ist ___ robuster als das arithmetische Mittel. = der Median | die Spannweite | die Summe
Für nominale Daten gibt es als Mittelwert nur ___ = den Modus | den Median | das arithmetische Mittel`, erzeuge: geoMittel },
  "mathe.os.statistik.regression": `Die Regressionsgerade minimiert ___ = die Summe der quadrierten Abweichungen | die Summe der Werte | die Anzahl der Punkte
Die Regressionsgerade geht immer durch ___ = den Schwerpunkt (x̄ ∣ ȳ) | den Ursprung | den ersten Punkt
Regressionsgerade y = 2x + 3: bei x = 5 erwartet man ___ = 13 | 10 | 8
Regressionsgerade y = −0,5x + 10: steigt x um 1, ___ = sinkt y um 0,5 | steigt y um 0,5 | sinkt y um 10
Werte außerhalb der Messdaten vorherzusagen heißt ___ = extrapolieren | interpolieren | regressieren
Werte innerhalb der Messdaten zu schätzen heißt ___ = interpolieren | extrapolieren | korrelieren
Die Abweichungen zur Regressionsgeraden heißen ___ = Residuen | Quartile | Klassen
Die Steigung der Regressionsgeraden ist k = ___ = s_xy/s_x² | s_x/s_y | x̄/ȳ
Ein Punkt weit weg von allen anderen heißt ___ = Ausreißer | Median | Schwerpunkt
Die Regressionsgerade berechnet man meist mit ___ = Technologie | Zirkel | Kopfrechnen
Methode der kleinsten Quadrate heißt auch ___ = Gauß’sche Methode | Newton-Verfahren | Simpson-Regel
Ist die Regressionsgerade waagrecht, ist die Kovarianz ___ = 0 | 1 | negativ`,
  "mathe.os.statistik.korrelation": `Der Korrelationskoeffizient r liegt zwischen ___ = −1 und 1 | 0 und 1 | 0 und 100
r nahe 1 heißt ___ = starker positiver linearer Zusammenhang | kein Zusammenhang | negativer Zusammenhang
r nahe −1 heißt ___ = starker negativer linearer Zusammenhang | kein Zusammenhang | positiver Zusammenhang
r nahe 0 heißt ___ = kein linearer Zusammenhang | perfekter Zusammenhang | negativer Zusammenhang
Korrelation beweist ___ = keinen Ursache-Wirkung-Zusammenhang | immer eine Ursache | nichts über Zahlen
Liegen alle Punkte genau auf einer fallenden Geraden, ist r = ___ = −1 | 0 | 1
Liegen alle Punkte genau auf einer steigenden Geraden, ist r = ___ = 1 | 0 | −1
r² heißt ___ = Bestimmtheitsmaß | Varianz | Steigung
r = 0,9 und r = −0,9 sind ___ stark. = gleich | nicht gleich | beide nicht
Eiskonsum und Sonnenbrand korrelieren, weil ___ = beides vom Wetter abhängt | Eis Sonnenbrand macht | Sonnenbrand Eis macht
Eine Scheinkorrelation entsteht durch ___ = eine dritte Größe | Rechenfehler | zu viele Daten
Der Korrelationskoeffizient misst nur ___ Zusammenhänge. = lineare | quadratische | exponentielle`,
  "mathe.os.statistik.gini": `Die Lorenzkurve zeigt ___ = wie ungleich etwas verteilt ist | den Mittelwert | die Zeitreihe
Bei völliger Gleichverteilung ist die Lorenzkurve ___ = die Diagonale | eine waagrechte Gerade | ein Kreis
Der Gini-Koeffizient liegt zwischen ___ = 0 und 1 | −1 und 1 | 0 und 100 %
Gini = 0 heißt ___ = völlig gleich verteilt | völlig ungleich | unbekannt
Gini nahe 1 heißt ___ = sehr ungleich verteilt | gleich verteilt | normal verteilt
Je weiter die Lorenzkurve von der Diagonale weg ist, desto ___ = ungleicher die Verteilung | gleicher | kleiner der Mittelwert
Auf der x-Achse der Lorenzkurve stehen ___ = die Anteile der Personen (kumuliert) | die Einkommen | die Jahre
Auf der y-Achse der Lorenzkurve stehen ___ = die Anteile am Gesamten (kumuliert) | die Personen | die Prozent der Zeit
Die Lorenzkurve verläuft immer ___ der Diagonale. = unter | über | auf
Der Gini-Koeffizient ist das Doppelte der Fläche ___ = zwischen Diagonale und Lorenzkurve | unter der Lorenzkurve | über der Diagonale
Die ärmsten 50 % haben 50 % des Einkommens. Das ist ___ = Gleichverteilung an dieser Stelle | sehr ungleich | unmöglich
Die Lorenzkurve beginnt bei ___ = (0 ∣ 0) | (0 ∣ 1) | (1 ∣ 0)`,
  "mathe.os.statistik.konfidenz-anteil": `Ein Konfidenzintervall gibt an, ___ = einen Bereich für den wahren Anteil | den genauen Anteil | die Stichprobengröße
Ein 95-%-Konfidenzintervall ist ___ als ein 90-%-Intervall. = breiter | schmäler | gleich breit
Eine größere Stichprobe macht das Intervall ___ = schmäler | breiter | gleich
Bei n = 400 und relativer Häufigkeit 0,5 ist σ ≈ ___ = 0,025 | 0,5 | 0,25
95-%-Intervall: h ± ___ · √(h(1 − h)/n) = 1,96 | 1 | 2,58
99-%-Intervall: h ± ___ · √(h(1 − h)/n) = 2,58 | 1,96 | 1,64
Vierfache Stichprobe macht das Intervall ___ = halb so breit | ein Viertel so breit | doppelt so breit
Umfrage: 40 % von 1 000 sind dafür. Ein sinnvolles 95-%-Intervall: ___ = [37 %; 43 %] | [30 %; 50 %] | [39,9 %; 40,1 %]
Die Mitte des Konfidenzintervalls ist ___ = die relative Häufigkeit der Stichprobe | 50 % | der wahre Anteil
Das Konfidenzniveau 95 % heißt: ___ = 95 % solcher Intervalle treffen den wahren Wert | der Wert ist zu 95 % richtig | 95 % der Leute antworten
Wahlumfragen geben oft an: ___ = Schwankungsbreite | Varianz | Median
Halbe Breite heißt ___ = Fehlermarge (Schwankungsbreite) | Mittelwert | Stichprobe`,
  "mathe.os.statistik.konfidenz-mittelwert": `Konfidenzintervall für μ bei bekanntem σ: x̄ ± ___ = z · σ/√n | z · σ · n | σ/n
Für 95 % ist z ≈ ___ = 1,96 | 1,64 | 2,58
Bei unbekanntem σ und kleinem n nimmt man ___ = die t-Verteilung | die Binomialverteilung | den Modus
x̄ = 50, σ = 10, n = 100: σ/√n = ___ = 1 | 10 | 0,1
x̄ = 50, σ = 10, n = 100: 95-%-Intervall ≈ ___ = [48,04; 51,96] | [40; 60] | [49; 51]
Vierfache Stichprobe macht das Intervall ___ = halb so breit | ein Viertel so breit | gleich
Größere Streuung macht das Intervall ___ = breiter | schmäler | gleich
Höheres Konfidenzniveau macht das Intervall ___ = breiter | schmäler | gleich
σ/√n heißt ___ = Standardfehler | Varianz | Median
Das Intervall ist symmetrisch um ___ = x̄ | 0 | σ
Die t-Verteilung ist für großes n fast wie ___ = die Normalverteilung | die Gleichverteilung | die Binomialverteilung
Wer das Intervall halbieren will, braucht ___ = die vierfache Stichprobe | die doppelte | die halbe`,
  "mathe.os.statistik.hypothesentest": `Die Nullhypothese H₀ ist ___ = die Annahme, die man prüft | immer wahr | das Ergebnis
Das Signifikanzniveau α ist ___ = die Wahrscheinlichkeit, H₀ fälschlich abzulehnen | die Wahrscheinlichkeit für H₀ | die Stichprobengröße
Fehler 1. Art: ___ = H₀ abgelehnt, obwohl richtig | H₀ beibehalten, obwohl falsch | gar kein Fehler
Fehler 2. Art: ___ = H₀ beibehalten, obwohl falsch | H₀ abgelehnt, obwohl richtig | Rechenfehler
Üblich ist α = ___ = 5 % | 50 % | 95 %
Liegt das Ergebnis im Ablehnungsbereich, ___ = lehnt man H₀ ab | behält man H₀ | wiederholt man nichts
Ein einseitiger Test prüft ___ = nur eine Richtung | beide Richtungen | gar nichts
H₀: p = 0,5 gegen H₁: p > 0,5 ist ___ = einseitig (rechtsseitig) | zweiseitig | linksseitig
Ein kleineres α macht den Fehler 1. Art ___ = seltener | häufiger | unmöglich
Wird H₀ nicht abgelehnt, ist H₀ damit ___ = nicht bewiesen | bewiesen | widerlegt
Der Annahmebereich enthält ___ = die Ergebnisse, bei denen man H₀ behält | alle Ergebnisse | nur 0
Münze 100-mal, H₀: fair. 51-mal Kopf: ___ = kein Grund, H₀ abzulehnen | H₀ ablehnen | Münze sicher gefälscht`,
  "mathe.os.wahrscheinlichkeit.regeln": { text: `Wahrscheinlichkeiten liegen zwischen ___ = 0 und 1 | −1 und 1 | 0 und 100
P(A oder B) allgemein = ___ = P(A) + P(B) − P(A und B) | P(A) + P(B) | P(A) · P(B)
Das sichere Ereignis hat die Wahrscheinlichkeit ___ = 1 | 0 | 100
Würfel: P(keine Sechs) = ___ = 5/6 | 1/6 | 6/5`, erzeuge: gegenereignis },
  "mathe.os.wahrscheinlichkeit.mehrstufig": { text: `Pfadregel: Wahrscheinlichkeiten entlang eines Pfades ___ = multiplizieren | addieren | subtrahieren
Summenregel: Wahrscheinlichkeiten verschiedener Pfade ___ = addieren | multiplizieren | dividieren
„Mindestens einmal“ rechnet man am einfachsten über ___ = das Gegenereignis „keinmal“ | alle Pfade einzeln | den Mittelwert
Zwei Würfel: P(zwei Sechsen) = ___ = 1/36 | 2/6 | 1/12`, erzeuge: mindestens },
  "mathe.os.wahrscheinlichkeit.bedingt": { text: `P(B ∣ A) liest man ___ = Wahrscheinlichkeit von B unter der Bedingung A | B oder A | B ohne A
A und B unabhängig heißt ___ = P(A ∩ B) ＝ P(A) · P(B) | P(A) ＝ P(B) | P(A ∩ B) ＝ 0
Zwei Würfe einer Münze sind ___ = unabhängig | abhängig | unvereinbar
Ziehen ohne Zurücklegen macht die Züge ___ = abhängig | unabhängig | sicher
Eine Vierfeldertafel hilft bei ___ = bedingten Wahrscheinlichkeiten | Ableitungen | Integralen`, erzeuge: bedingt },
  "mathe.os.wahrscheinlichkeit.bayes": `Der Satz von Bayes dreht ___ = die Bedingung um: aus P(B ∣ A) wird P(A ∣ B) | die Reihenfolge der Würfe um | das Vorzeichen um
P(A ∣ B) = ___ = P(B ∣ A) · P(A)/P(B) | P(B ∣ A) · P(B) | P(A) · P(B)
Ein Test ist bei Kranken zu 99 % positiv, die Krankheit ist selten. Ein positiver Test heißt ___ = man ist nicht unbedingt krank | man ist sicher krank | der Test ist kaputt
Die Wahrscheinlichkeit vor dem Test heißt ___ = A-priori-Wahrscheinlichkeit | Sensitivität | Spezifität
P(positiv ∣ krank) heißt ___ = Sensitivität | Spezifität | Prävalenz
P(negativ ∣ gesund) heißt ___ = Spezifität | Sensitivität | Prävalenz
Der Anteil der Kranken in der Bevölkerung heißt ___ = Prävalenz | Sensitivität | Spezifität
1 % krank, Test erkennt 90 % der Kranken, 10 % falsch positiv. P(krank ∣ positiv) ≈ ___ = 8,3 % | 90 % | 1 %
Je seltener die Krankheit, desto ___ = mehr positive Tests sind falsch | genauer der Test | weniger falsch positive
Bayes rechnet man gut mit ___ = einem Baumdiagramm oder einer Vierfeldertafel | einem Boxplot | einer Regressionsgeraden
P(B) im Nenner bekommt man aus ___ = allen Pfaden zu B zusammen | nur einem Pfad | P(A)
Zweimal positiv getestet: die Wahrscheinlichkeit, krank zu sein, ___ = steigt | sinkt | bleibt gleich`,
  "mathe.os.wahrscheinlichkeit.kombinatorik": { text: `Wie viele Reihenfolgen gibt es für 4 Bücher? = 24 | 16 | 4
0! = ___ = 1 | 0 | nicht definiert
(n über 0) = ___ = 1 | 0 | n
(n über 1) = ___ = n | 1 | n − 1
Lotto „6 aus 45“ zählt man mit ___ = dem Binomialkoeffizienten | n! | 6⁴⁵`, erzeuge: binomKoeff },
  "mathe.os.wahrscheinlichkeit.zufallsvariable": { text: `Eine Zufallsvariable ordnet jedem Ergebnis ___ = eine Zahl zu | eine Wahrscheinlichkeit zu | ein Diagramm zu
Die Summe aller Wahrscheinlichkeiten einer Verteilung ist ___ = 1 | 0 | n
Ein faires Spiel hat den Erwartungswert ___ = 0 (Gewinn) | 1 | 50 %
Würfel: Erwartungswert der Augenzahl ___ = 3,5 | 3 | 6
Die Standardabweichung ist die Wurzel aus ___ = der Varianz | dem Erwartungswert | n`, erzeuge: erwartung },
  "mathe.os.wahrscheinlichkeit.binomial": { text: `Binomialverteilung braucht ___ = n unabhängige Versuche mit gleichem p | ohne Zurücklegen ziehen | stetige Werte
Ziehen mit Zurücklegen ist ___ = binomialverteilt | nicht binomialverteilt | normalverteilt
P(X = k) = ___ = (n über k) · pᵏ · (1 − p)ⁿ⁻ᵏ | pᵏ · (1 − p)ⁿ | n · p · k
Münze 3-mal: P(genau 2-mal Kopf) = ___ = 3/8 | 1/4 | 2/3`, erzeuge: binomial },
  "mathe.os.wahrscheinlichkeit.binomial-bereiche": { text: `P(X ≥ 1) = ___ = 1 − P(X ＝ 0) | P(X ＝ 1) | 1 − P(X ＝ 1)
P(X ≤ 2) = ___ = P(X ＝ 0) + P(X ＝ 1) + P(X ＝ 2) | P(X ＝ 2) | 1 − P(X ＝ 2)
„Höchstens 3“ heißt ___ = X ≤ 3 | X < 3 | X ≥ 3
„Mehr als 3“ heißt ___ = X ≥ 4 | X ≥ 3 | X ≤ 3
Erwartungswert der Binomialverteilung: ___ = n · p | n · p · (1 − p) | √(n · p)`, erzeuge: binomErwartung },
  "mathe.os.wahrscheinlichkeit.dichte": `Bei einer stetigen Zufallsvariable ist P(X = a) = ___ = 0 | 1 | f(a)
Wahrscheinlichkeiten sind bei Dichtefunktionen ___ = Flächen unter der Kurve | Funktionswerte | Steigungen
Die Gesamtfläche unter einer Dichtefunktion ist ___ = 1 | 0 | unendlich
Eine Dichtefunktion ist nie ___ = negativ | größer als 0 | stetig
P(a ≤ X ≤ b) = ___ = ∫ von a bis b f(x) dx | f(b) − f(a) | f(a) · f(b)
Die Verteilungsfunktion F(x) gibt an ___ = P(X ≤ x) | P(X ＝ x) | f′(x)
Gleichverteilung auf [0; 10]: f(x) = ___ = 1/10 | 10 | 1
Gleichverteilung auf [0; 10]: P(2 ≤ X ≤ 5) = ___ = 3/10 | 5/10 | 3
Erwartungswert einer stetigen Zufallsvariable: ___ = ∫ x · f(x) dx | ∫ f(x) dx | f(μ)
Ist P(X ≤ 3) = P(X < 3) bei stetigen Zufallsvariablen? = ja | nein
Wartezeiten modelliert man oft ___ = stetig | diskret | nominal
F ist die ___ von f. = Stammfunktion (Integral) | Ableitung | Umkehrfunktion`,
  "mathe.os.wahrscheinlichkeit.normal": { text: `Die Normalverteilung ist ___ = symmetrisch um μ | schief | nur positiv
P(X ≤ μ) = ___ = 50 % | 100 % | 68 %
Die Standardnormalverteilung hat μ = 0 und σ = ___ = 1 | 0 | 10
Standardisieren: z = ___ = (x − μ)/σ | (x + μ)/σ | x · σ − μ`, erzeuge: normal },
  "mathe.os.wahrscheinlichkeit.normal-umkehr": `Das zu μ symmetrische Intervall mit 95 % ist ___ = μ ± 1,96σ | μ ± σ | μ ± 3σ
Das zu μ symmetrische Intervall mit 99 % ist ___ = μ ± 2,58σ | μ ± 1,96σ | μ ± 2σ
Das zu μ symmetrische Intervall mit 90 % ist ___ = μ ± 1,64σ | μ ± 1,96σ | μ ± σ
μ = 100, σ = 15: 95-%-Intervall ≈ ___ = [70,6; 129,4] | [85; 115] | [55; 145]
μ = 100, σ = 10: das Intervall μ ± σ enthält etwa ___ = 68 % | 95 % | 50 %
Gesucht ist x mit P(X ≤ x) = 0,5: x = ___ = μ | μ + σ | 0
P(X ≤ x) = 0,84 bei μ = 0, σ = 1: x ≈ ___ = 1 | 0,84 | 2
Das 90-%-Quantil liegt ___ = über μ | unter μ | genau bei μ
μ = 50, σ = 5: unter welchem Wert liegen 97,7 %? = 60 | 55 | 65
Umkehraufgaben löst man mit ___ = der inversen Normalverteilung (Technologie) | dem Sinussatz | der Ableitung
Ein Quantil ist ___ = ein Wert, unter dem ein Anteil der Daten liegt | ein Mittelwert | eine Fläche
μ = 0, σ = 1: P(X ≤ −x) = ___ = 1 − P(X ≤ x) | P(X ≤ x) | 0`,
  "mathe.os.wahrscheinlichkeit.glockenkurve": `μ verschiebt die Glockenkurve ___ = nach links oder rechts | nach oben | in die Breite
Größeres σ macht die Glockenkurve ___ = breiter und flacher | schmäler und höher | höher und breiter
Kleineres σ macht die Glockenkurve ___ = schmäler und höher | breiter und flacher | nach rechts
Das Maximum der Glockenkurve liegt bei ___ = μ | σ | 0
Die Wendepunkte der Glockenkurve liegen bei ___ = μ ± σ | μ ± 2σ | μ
Die Fläche unter der Glockenkurve ist immer ___ = 1 | σ | μ
Zwei Kurven mit gleichem μ, aber verschiedenem σ ___ = haben dasselbe Maximum an derselben Stelle x | sind gleich | haben verschiedene Mitten
Eine Glockenkurve ist symmetrisch zur Geraden ___ = x ＝ μ | x ＝ σ | y ＝ 0
Je größer σ, desto ___ das Maximum. = niedriger | höher | gleich
Die Glockenkurve berührt die x-Achse ___ = nie | bei μ ± 3σ | bei 0
Die Normalverteilung heißt auch ___ = Gauß-Verteilung | Poisson-Verteilung | Gleichverteilung
Körpergrößen sind ungefähr ___ = normalverteilt | gleichverteilt | binomialverteilt`,
  "mathe.os.wahrscheinlichkeit.approximation": `Die Binomialverteilung kann man durch die Normalverteilung annähern, wenn ___ = σ² ＝ n · p · (1 − p) > 9 | n < 10 | p ＝ 0
Bei der Näherung nimmt man μ = ___ = n · p | p | n
Bei der Näherung nimmt man σ = ___ = √(n · p · (1 − p)) | n · p | p · (1 − p)
n = 100, p = 0,5: μ = ___ = 50 | 100 | 0,5
n = 100, p = 0,5: σ = ___ = 5 | 25 | 50
Die Stetigkeitskorrektur rechnet bei P(X ≤ k) mit ___ = k + 0,5 | k − 1 | k + 1
Für große n wird die Binomialverteilung ___ = glockenförmig | gleichförmig | steiler
n = 400, p = 0,2: μ = ___ = 80 | 20 | 400
n = 400, p = 0,2: σ = ___ = 8 | 64 | 80
Wann ist die Näherung schlecht? = bei kleinem n und p nahe 0 oder 1 | bei großem n | bei p ＝ 0,5
Die Näherung erlaubt ___ = schnelleres Rechnen ohne viele Summanden | exakte Werte | negative Wahrscheinlichkeiten
n = 100, p = 0,5: P(40 ≤ X ≤ 60) ≈ ___ = 95 % | 68 % | 50 %`,
};
