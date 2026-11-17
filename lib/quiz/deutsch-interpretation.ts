/**
 * Quizkarten für die Textinterpretation (niko, 17.11.2026, Übungsplan Punkt 2 und 3): deuten statt beschreiben, die
 * passende Wirkung, Zitieren und Belegen, sachlicher Ton, Kurzgeschichte und Arbeitsweise. Alle Sätze sind für
 * DreamStudy geschrieben, über erfundene Geschichten; keine KI. Sie kommen zu den Karten der Fähigkeit
 * „Textinterpretation“ (lib/quiz/deutsch-oberstufe-sprache.ts) und laufen so im Deutsch-Quiz, in Blockwerk, Funkelfeld
 * und Torlauf, sobald Textinterpretation im Stoff ist.
 */

const NACH = "Merke: Nacherzählen sagt nur, was passiert. Das gehört in den Inhalt (OP1), nicht in die Deutung.";
const BESCHR = "Merke: Ein Stilmittel oder eine Form nur zu nennen, ist Beschreiben. Erst die Wirkung macht eine Deutung daraus.";
const DEUT = "Merke: Wer sagt, was eine Stelle bewirkt oder bedeutet, deutet: „Dadurch wird deutlich, dass …“";
const D = "deutet | beschreibt nur | erzählt nach";
const B = "beschreibt nur | deutet | erzählt nach";
const E = "erzählt nach | deutet | beschreibt nur";

/** Leichte Karten (Stufe 1). */
export const INTERPRETATION_LEICHT = `Der Satz „Der Vater kommt spät nach Hause und isst allein in der Küche.“ ___ = ${E}
${NACH}
Der Satz „Am Ende steigt Lena in den Zug und winkt nicht zurück.“ ___ = ${E}
${NACH}
Der Satz „Die Großmutter erzählt von früher und schenkt ihrem Enkel eine Uhr.“ ___ = ${E}
${NACH}
Der Satz „Der Chef ruft Herrn Kern zu sich und kündigt ihm.“ ___ = ${E}
${NACH}
Der Satz „Nach dem Streit geht der Junge in sein Zimmer und schließt die Tür.“ ___ = ${E}
${NACH}
Der Satz „Die beiden Brüder treffen sich nach Jahren am Grab ihrer Mutter.“ ___ = ${E}
${NACH}
Der Satz „Tim findet im Bus eine Geldbörse und bringt sie zur Polizei.“ ___ = ${E}
${NACH}
Der Satz „Die Frau wartet den ganzen Abend auf einen Anruf.“ ___ = ${E}
${NACH}
Der Satz „In Z. 12 steht eine Anapher.“ ___ = ${B}
${BESCHR}
Der Satz „Der Text ist in der Er-Form geschrieben.“ ___ = ${B}
${BESCHR}
Der Satz „Die Geschichte hat ein offenes Ende.“ ___ = ${B}
${BESCHR}
Der Satz „Die Autorin verwendet viele kurze Sätze.“ ___ = ${B}
${BESCHR}
Der Satz „In Z. 7 steht die Metapher ‚ein Meer aus Lichtern‘.“ ___ = ${B}
${BESCHR}
Der Satz „Im Text kommen viele Wiederholungen vor.“ ___ = ${B}
${BESCHR}
Der Satz „Der Erzähler ist personal und erzählt aus Lenas Sicht.“ ___ = ${B}
${BESCHR}
Der Satz „Es gibt drei Figuren: Vater, Mutter und Sohn.“ ___ = ${B}
${BESCHR}
Der Satz „Die kurzen Sätze machen die Kälte zwischen Vater und Sohn spürbar.“ ___ = ${D}
${DEUT}
Der Satz „Das offene Ende zwingt die Leser, selbst über Lenas Zukunft nachzudenken.“ ___ = ${D}
${DEUT}
Der Satz „Die Uhr steht für die Zeit, die der Großmutter noch bleibt.“ ___ = ${D}
${DEUT}
Der Satz „Durch die Anapher wird deutlich, wie eintönig sein Alltag ist.“ ___ = ${D}
${DEUT}
Der Satz „Dass die Frau keinen Namen hat, zeigt, dass ihr Schicksal viele betrifft.“ ___ = ${D}
${DEUT}
Der Satz „Die geschlossene Tür zeigt, dass der Junge niemanden an sich heranlässt.“ ___ = ${D}
${DEUT}
Der Satz „Der Regen am Ende spiegelt die Trauer der Brüder wider.“ ___ = ${D}
${DEUT}
Der Satz „Der personale Erzähler lässt uns Lenas Angst unmittelbar miterleben.“ ___ = ${D}
${DEUT}
„Jeden Morgen geht er los. Jeden Morgen wartet er.“ Die Anapher ___ = betont, wie gleich jeder Tag ist | macht den Text spannender | zeigt, dass er früh aufsteht
Nur kurze Hauptsätze: „Sie wartet. Er kommt nicht. Sie geht.“ Das wirkt ___ = knapp und gefühlskalt | gemütlich und heiter | verspielt und lustig
Die Figur hat keinen Namen, sie heißt nur „die Frau“. Das bewirkt: ___ = Sie steht für viele Menschen. | Sie ist unwichtig. | Der Name wurde vergessen.
Rhetorische Frage im Text: „Wer hört schon einem alten Mann zu?“ Sie ___ = macht die Einsamkeit eindringlich | will eine Antwort hören | zeigt, dass er schlecht hört
Vergleich: Die Wohnung ist „still wie ein Grab“. Er ___ = macht Leere und Einsamkeit spürbar | beschreibt nur die Lautstärke | zeigt, dass die Wohnung klein ist
Personifikation: „Die Stadt schläft nie.“ Sie ___ = macht die Stadt lebendig und unruhig | zeigt, dass alle müde sind | ist ein Fehler im Text
Offenes Ende: Man erfährt nicht, ob sie zurückkommt. Das ___ = regt zum Nachdenken an | ist ein Fehler der Autorin | zeigt, dass Seiten fehlen
Antithese: „Draußen Sonne, drinnen Dunkelheit.“ Sie ___ = zeigt den Gegensatz zu seinem Inneren | beschreibt nur das Wetter | macht den Satz kürzer
Klimax: „Er bat, er flehte, er schrie.“ Sie ___ = steigert seine Verzweiflung | zählt seine Wörter | beruhigt die Leser
Ellipse: „Kein Wort. Nur Stille.“ Sie ___ = macht die Sprachlosigkeit spürbar | ist ein Grammatikfehler | macht den Text lustig
Ironie: „Toll, schon wieder Regen“, sagt sie. Das ___ = zeigt ihren Ärger | zeigt, dass sie Regen mag | ist nur eine Wetterangabe
Symbol: Die alte Uhr bleibt am Ende stehen. Sie steht für ___ = das Ende eines Lebens | einen Defekt | die genaue Uhrzeit
Der Großvater spricht in der wörtlichen Rede Dialekt. Das ___ = macht ihn echt und nahbar | zeigt, dass er schlecht spricht | ist nur Dekoration
In einer Geschichte über Versöhnung heißt der Titel „Die Brücke“. Er steht für ___ = die Verbindung zweier Menschen | ein Bauwerk ohne Bedeutung | den Wohnort der Autorin
Ein wörtliches Zitat aus Zeile 12 schreibt man ___ = „…“ (Z. 12) | „…“ (vgl. Z. 12) | (Z. 12) ohne Anführungszeichen
Merke: Wörtlich zitiert: Anführungszeichen und Zeile, ohne „vgl.“.
Eine Stelle aus Z. 37 bis 40 in eigenen Worten belegt man mit ___ = (vgl. Z. 37–40) | „…“ (Z. 37–40) | (Seite 37)
Merke: Sinngemäß, also in eigenen Worten: (vgl. Z. …), ohne Anführungszeichen.
Ein Zitat über Zeile 4 und 5 bekommt die Angabe ___ = (Z. 4f.) | (Z. 4ff.) | (Z. 4, 5ff.)
Ein Zitat über Zeile 10 bis 14 bekommt die Angabe ___ = (Z. 10–14) | (Z. 10f.) | (Z. 10, 14)
Lässt man mitten im Zitat Wörter weg, markiert man das mit ___ = […] | einem Gedankenstrich | gar nicht
In Einleitung und Inhalt stehen ___ = keine Zitate | möglichst viele Zitate | nur lange Zitate
Nach einem Zitat kommt ___ = ein Satz, der es erklärt | sofort das nächste Zitat | der nächste Absatz
Merke: Kein Zitat ohne erklärenden Satz danach: „Dadurch wird deutlich, dass …“
Ist das richtig zitiert? Er fühlt sich „wie ein Gespenst“ (Z. 8). ___ = ja | nein, die Zeile fehlt | nein, „vgl.“ fehlt
Ist das richtig zitiert? Er fühlt sich „wie ein Gespenst“. ___ = nein, die Zeile fehlt | ja | nein, „vgl.“ fehlt
Ist das richtig belegt? Sie hat Angst vor dem Vater (vgl. Z. 20–23). ___ = ja, sinngemäß mit „vgl.“ | nein, es braucht „…“ | nein, „vgl.“ ist falsch
Ein Zitat sollte ___ = kurz sein und in den Satz passen | mindestens drei Zeilen lang sein | allein am Absatzende stehen
Wer in der Geschichte erzählt, ist ___ = der Erzähler, nicht der Autor | immer der Autor | immer die Hauptfigur
Die Geschichte schrieb Ida Brunnhofer. In der Interpretation schreibst du ___ = die Autorin | der Autor | die Erzählerin
Merke: Autor oder Autorin richtig? Schau beim Vornamen nach und bleib im ganzen Text dabei.
Die Kette für einen Absatz in OP2 und OP3 heißt ___ = Behauptung, Zitat, Wirkung, Bedeutung | Zitat, Zitat, Zitat | Inhalt, Meinung, Schluss
Statt „wegen seines großen Egos“ schreibst du ___ = aus Eitelkeit | wegen seinem Ego-Trip | weil er halt so ist
Merke: In einer Interpretation schreibst du sachlich: Eitelkeit, Selbstwertgefühl statt Ego.
Statt „Das ist lächerlich“ schreibst du ___ = Das wirkt übertrieben. | Das ist voll peinlich. | Das ist halt so.
Statt „Er checkt nicht, was los ist“ schreibst du ___ = Er versteht die Lage nicht. | Er kapiert es nicht. | Er hat keinen Plan.
Statt „Sie ist voll fertig“ schreibst du ___ = Sie ist erschöpft. | Sie ist total am Ende. | Sie ist komplett durch.
Statt „Der Typ nervt alle“ schreibst du ___ = Der Mann stört die anderen. | Der Typ geht allen auf die Nerven. | Der Kerl ist mühsam.
Statt „Die Geschichte ist mega traurig“ schreibst du ___ = Die Geschichte wirkt bedrückend. | Die Geschichte ist ur traurig. | Die Geschichte ist krass traurig.
Welcher Satz passt in eine Interpretation? ___ = Der Vater verhält sich abweisend. | Der Vater ist echt mies drauf. | Der Vater ist halt so ein Typ.
Typisch für eine Kurzgeschichte ist ___ = ein unmittelbarer Einstieg | eine lange Einleitung | ein Happy End
Das Ende einer Kurzgeschichte ist meist ___ = offen | glücklich | eine Lehre
Die Figuren einer Kurzgeschichte sind oft ___ = wenige und namenlos | Helden und Könige | sprechende Tiere
Eine Kurzgeschichte zeigt ___ = einen Ausschnitt aus dem Alltag | ein ganzes Leben | eine Sage aus alter Zeit
Die Stelle, an der die Handlung kippt, heißt ___ = Wendepunkt | Einleitung | Rahmen
Die Einleitung nach den Operatoren ist ___ = ein Satz mit Titel, Autor und Thema | eine halbe Seite | eine Nacherzählung
Was vor der Handlung passiert ist, steht im Inhalt im ___ = Perfekt | Futur | Präsens
Im OP4 geht es um ___ = Parallelen zu heute und deine Meinung | die Stilmittel | die Inhaltsangabe
Im OP3 deutest du ___ = alle Figuren aus der Aufgabe | nur die Hauptfigur | nur den Autor
Bei der Schularbeit liest du zuerst ___ = die Aufgabenstellung und den Titel | den Schluss | nur die erste Zeile
Nach dem ersten Lesen sagst du in zwei Sätzen: ___ = Wer? Was passiert am Ende? | Wie viele Zeilen? | Welche Stilmittel?
Für Randnotizen schreibst du pro Absatz ___ = 3 bis 5 Wörter | eine halbe Seite | gar nichts`;

/** Schwere Karten (Stufe 2). */
export const INTERPRETATION_SCHWER = `Der Satz „Die Autorin verwendet eine Metapher, die sehr schön ist.“ ___ = ${B}
Merke: „sehr schön“ ist eine Wertung, keine Wirkung. Was bewirkt die Metapher?
Der Satz „Der Satz in Z. 4 ist sehr kurz, was auffällt.“ ___ = ${B}
${BESCHR}
Der Satz „Der Vater wird als streng dargestellt (vgl. Z. 3–9).“ ___ = ${B}
Merke: Eine Eigenschaft mit Beleg ist erst die Behauptung. Deuten heißt: Was zeigt das, warum ist er so?
Der Satz „Er fragt ‚Warum ich?‘ (Z. 30) und geht weg.“ ___ = ${E}
${NACH}
Der Satz „Mit der Frage ‚Warum ich?‘ (Z. 30) zeigt sich, dass sie sich als Opfer sieht.“ ___ = ${D}
${DEUT}
Der Satz „Die vielen Fragen in Z. 20–25 spiegeln ihre Unsicherheit wider.“ ___ = ${D}
${DEUT}
Der Satz „Dass er die Tür zuschlägt, zeigt, wie hilflos er sich fühlt.“ ___ = ${D}
${DEUT}
Der Satz „Die Geschichte spielt in einer Kleinstadt im Winter.“ ___ = ${B}
${BESCHR}
Ich-Erzähler: Wir erfahren nur, was er denkt und sieht. Das ___ = lässt zweifeln, ob alles stimmt | ist immer die Wahrheit | zeigt alles von außen
Zeitdehnung: Zwei Sekunden Sturz über eine halbe Seite. Das ___ = macht den Moment endlos lang | spart Platz | zeigt, dass er langsam fällt
Der Satz „Es ist nichts“ fällt an drei Stellen. Das zeigt, ___ = dass sehr wohl etwas ist | dass wirklich nichts ist | dass der Text kurz ist
Neutraler Erzähler, nur Dialog, kein Gefühl wird genannt. Das ___ = lässt Gefühle zwischen den Zeilen | zeigt, dass niemand fühlt | ist ein Fehler
Zyklischer Aufbau: Die Geschichte endet mit dem ersten Satz. Das ___ = zeigt, dass sich nichts ändert | ist eine Wiederholung aus Versehen | macht das Ende glücklich
Der Brief bleibt ungeöffnet auf dem Tisch liegen. Als Symbol steht er für ___ = Worte, die nie ankommen | Altpapier | die Post von heute
Ist das richtig zitiert? Sie sagt, sie sei „[…] nie wieder“ hergekommen (Z. 14). ___ = ja, die Auslassung ist markiert | nein, […] ist verboten | nein, „vgl.“ fehlt
Ist das richtig belegt? Er bereut nichts „vgl. Z. 40“. ___ = nein, sinngemäß ohne „…“, in Klammern | ja | ja, so ist es am besten
Wo steht die Zeilenangabe bei einem wörtlichen Zitat? ___ = direkt nach dem Zitat | am Ende des Absatzes | in der Einleitung
Wie viele Belege braucht eine Interpretation mit rund 550 Wörtern? ___ = etwa 5 bis 8 | 1 bis 2 | 20 und mehr
Er ist „traurig“ (Z. 3). Dadurch wird deutlich, dass er traurig ist. Was fehlt? ___ = eine echte Wirkung | ein zweites Zitat | eine Zeilenangabe
Merke: Die Wirkung sagt mehr als das Zitat: warum er traurig ist und was das für den Text bedeutet.
Welcher Satzanfang leitet eine Wirkung ein? ___ = Dadurch wird deutlich, dass … | In Z. 5 steht … | Danach geht er …
Auch so beginnt ein Satz zur Wirkung: ___ = Das unterstreicht, wie … | Dann passiert … | Im Text steht …
Noch ein Satzanfang für die Wirkung: ___ = Auf diese Weise zeigt der Text, … | Am Anfang … | Es gibt …
Statt „Der Autor will, dass wir checken, wie schlimm das ist“ schreibst du ___ = Der Autor macht deutlich, wie schwer … | Der Autor zeigt es uns krass. | Der Autor will, dass wir es raffen.
Statt „Die Mutter ist irgendwie komisch“ schreibst du ___ = Die Mutter wirkt distanziert. | Die Mutter ist halt seltsam. | Die Mutter ist irgendwie eigen.`;
