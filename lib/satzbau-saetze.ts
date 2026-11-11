/**
 * Die Sätze des Lernspiels „Satzbau“ (lib/lernspiele-karten.ts satzbauKandidaten): eigene Alltagssätze, von Hand
 * geschrieben und geprüft, keine KI und nichts aus einem Schulbuch.
 *
 * Schreibweise: Teile mit „|“ getrennt. Der **erste Teil steht fest** (er ist im Spiel schon gesetzt), die übrigen
 * bringt der Schüler in die richtige Reihenfolge. Damit es genau eine richtige Lösung gibt, gilt für jeden Satz:
 *
 * - Nach dem festen Anfang gibt es nur **eine** Reihenfolge, die ein richtiger Satz ist. Darum steht höchstens ein
 *   freies Satzglied neben Subjekt und Verb („Heute gehen wir ins Kino“), und wo zwei Nomen aufeinandertreffen
 *   könnten, ist das Subjekt ein Pronomen (nach dem Verb steht es immer zuerst).
 * - Keine zwei gleichen Teile in einem Satz, kein Ja/Nein-Fragesatz (er wäre auch als Aussage mit Fragezeichen
 *   möglich), keine Sätze, bei denen Zeit und Ort die Plätze tauschen könnten.
 * - Die Teile stehen so da wie mitten im Satz (klein, außer Nomen und Namen); das Satzzeichen hängt am letzten Teil.
 */

export type SatzbauTyp = "trennbar" | "perfekt" | "modal" | "verbzweit" | "klammer" | "futur" | "gliedsatz" | "gliedsatz-klammer" | "gliedsatz-vorn" | "frage";

/** Was auf der Karte über dem Satz steht. */
export const SATZBAU_MARKE: Record<SatzbauTyp, string> = {
  trennbar: "Trennbares Verb",
  perfekt: "Perfekt",
  modal: "Modalverb",
  verbzweit: "Aussagesatz",
  klammer: "Aussagesatz",
  futur: "Futur",
  gliedsatz: "Gliedsatz",
  "gliedsatz-klammer": "Gliedsatz",
  "gliedsatz-vorn": "Gliedsatz vorne",
  frage: "Frage",
};

/** Die Regel, die nach einem Fehler erscheint. */
export const SATZBAU_REGEL: Record<SatzbauTyp, string> = {
  trennbar: "Trennbares Verb: Der gebeugte Teil steht an zweiter Stelle, die Vorsilbe am Satzende.",
  perfekt: "Perfekt: „haben“ oder „sein“ steht an zweiter Stelle, das Partizip am Satzende.",
  modal: "Das Modalverb steht an zweiter Stelle, die Grundform am Satzende.",
  verbzweit: "Im Aussagesatz steht das Verb an zweiter Stelle. Steht vorne nicht das Subjekt, kommt es gleich nach dem Verb.",
  klammer: "Das gebeugte Verb steht an zweiter Stelle, gleich danach das Subjekt. Partizip, Grundform oder Vorsilbe stehen am Satzende.",
  futur: "Futur: „werden“ steht an zweiter Stelle, die Grundform am Satzende.",
  gliedsatz: "Im Gliedsatz (nach weil, dass, wenn, ob …) steht das gebeugte Verb ganz am Ende.",
  "gliedsatz-klammer": "Im Gliedsatz steht das gebeugte Verb ganz am Ende, auch hinter Partizip oder Grundform.",
  "gliedsatz-vorn": "Steht der Gliedsatz vorne, beginnt der Hauptsatz mit dem Verb. Dann kommt das Subjekt.",
  frage: "In der W-Frage steht das gebeugte Verb gleich nach dem Fragewort, dann das Subjekt. Partizip, Grundform oder Vorsilbe stehen am Ende.",
};

export type SatzbauGruppe = { typ: SatzbauTyp; stufe: 1 | 2 | 3; saetze: string[] };

export const SATZBAU: SatzbauGruppe[] = [
  // ---------- Stufe 1: das Subjekt steht vorne, drei Teile; die Satzklammer ----------
  {
    typ: "trennbar",
    stufe: 1,
    saetze: [
      "Ich | stehe | um sieben Uhr | auf.",
      "Wir | räumen | das Zimmer | auf.",
      "Papa | kauft | im Supermarkt | ein.",
      "Der Zug | fährt | um acht Uhr | ab.",
      "Lena | ruft | ihre Oma | an.",
      "Tom | macht | das Fenster | zu.",
      "Die Kinder | ziehen | ihre Jacken | an.",
      "Ich | packe | meine Schultasche | ein.",
      "Der Film | fängt | um acht Uhr | an.",
      "Mama | holt | mich von der Schule | ab.",
      "Wir | laden | alle Freunde | ein.",
      "Der Lehrer | teilt | die Hefte | aus.",
      "Meine Schwester | geht | am Abend | aus.",
      "Ich | komme | gleich | mit.",
      "Der Bus | kommt | pünktlich | an.",
      "Wir | hören | gut | zu.",
    ],
  },
  {
    typ: "perfekt",
    stufe: 1,
    saetze: [
      "Wir | haben | einen Kuchen | gebacken.",
      "Ich | habe | meine Hausübung | gemacht.",
      "Der Hund | hat | den Ball | geholt.",
      "Lena | ist | nach Hause | gegangen.",
      "Die Kinder | sind | im See | geschwommen.",
      "Du | hast | sehr gut | gespielt.",
      "Opa | hat | die Zeitung | gelesen.",
      "Wir | sind | mit dem Zug | gefahren.",
      "Ich | bin | früh | aufgestanden.",
      "Mama | hat | eine Suppe | gekocht.",
      "Tim | hat | sein Heft | vergessen.",
      "Die Katze | ist | auf den Baum | geklettert.",
      "Wir | haben | lange | gewartet.",
      "Meine Freundin | hat | mir ein Buch | geschenkt.",
      "Ich | habe | den Film | gesehen.",
      "Der Zug | ist | pünktlich | angekommen.",
    ],
  },
  {
    typ: "modal",
    stufe: 1,
    saetze: [
      "Du | musst | dein Zimmer | aufräumen.",
      "Ich | kann | schon gut | schwimmen.",
      "Wir | wollen | ins Kino | gehen.",
      "Lena | darf | heute länger | aufbleiben.",
      "Die Kinder | sollen | leise | sein.",
      "Ich | möchte | ein Eis | essen.",
      "Papa | muss | morgen früh | arbeiten.",
      "Wir | können | dir gern | helfen.",
      "Du | darfst | mein Rad | nehmen.",
      "Tom | will | Pilot | werden.",
      "Ihr | sollt | die Hände | waschen.",
      "Ich | muss | noch Vokabeln | lernen.",
      "Meine Oma | kann | sehr gut | kochen.",
      "Wir | dürfen | im Garten | spielen.",
    ],
  },
  // ---------- Stufe 1: vorne steht etwas anderes, das Verb bleibt an zweiter Stelle ----------
  {
    typ: "verbzweit",
    stufe: 1,
    saetze: [
      "Heute | gehen | wir | ins Kino.",
      "Morgen | schreibe | ich | einen Test.",
      "Am Nachmittag | spielt | er | Fußball.",
      "Im Sommer | fahren | wir | ans Meer.",
      "Nach der Schule | esse | ich | zu Mittag.",
      "Am Wochenende | besucht | sie | ihre Oma.",
      "Jeden Tag | übt | Mia | Klavier.",
      "Dann | gehen | wir | nach Hause.",
      "In der Pause | spielen | wir | im Hof.",
      "Am Abend | liest | Papa | ein Buch.",
      "Zu Mittag | kocht | Oma | Nudeln.",
      "Plötzlich | wird | es | dunkel.",
      "Im Winter | ist | es | oft kalt.",
      "Leider | habe | ich | keine Zeit.",
      "Manchmal | hilft | er | seiner Schwester.",
      "Am Montag | haben | wir | Turnen.",
      "Um acht Uhr | sind | wir | in der Schule.",
      "Vielleicht | kommt | sie | später.",
      "Den Hund | füttere | ich | jeden Morgen.",
      "Dieses Buch | finde | ich | spannend.",
      "Heute Abend | bleibe | ich | zu Hause.",
      "Meiner Oma | schreibe | ich | eine Karte.",
    ],
  },
  // ---------- Stufe 2: vorne etwas anderes und dazu die Satzklammer ----------
  {
    typ: "klammer",
    stufe: 2,
    saetze: [
      // Perfekt
      "Gestern | hat | er | seine Hausübung | vergessen.",
      "Am Samstag | sind | wir | ins Schwimmbad | gegangen.",
      "Letzte Woche | habe | ich | ein neues Rad | bekommen.",
      "In den Ferien | sind | wir | nach Italien | gefahren.",
      "Heute Morgen | hat | sie | den Bus | verpasst.",
      "Am Abend | haben | wir | einen Film | geschaut.",
      "Vor zwei Tagen | hat | es | stark | geregnet.",
      "Zum Geburtstag | hat | er | ein Handy | bekommen.",
      "Im Urlaub | habe | ich | viele Fotos | gemacht.",
      "Nach dem Essen | sind | wir | spazieren | gegangen.",
      "Gestern Abend | bin | ich | früh | eingeschlafen.",
      "Letztes Jahr | hat | sie | Gitarre | gelernt.",
      "Am Sonntag | haben | wir | lange | geschlafen.",
      "Heute | hat | er | sein Zimmer | aufgeräumt.",
      // Modalverb
      "Morgen | muss | ich | früh | aufstehen.",
      "Am Wochenende | wollen | wir | einen Ausflug | machen.",
      "Heute | darf | sie | bei Anna | übernachten.",
      "Im Unterricht | sollen | wir | gut | aufpassen.",
      "Nächstes Jahr | möchte | ich | Spanisch | lernen.",
      "Jetzt | können | wir | endlich | anfangen.",
      "Nach der Schule | muss | er | zum Zahnarzt | gehen.",
      "Heute Abend | will | ich | ein Buch | lesen.",
      "Leider | kann | sie | nicht | kommen.",
      "Morgen | dürfen | wir | länger | aufbleiben.",
      // trennbares Verb
      "Jeden Morgen | steht | er | um sechs Uhr | auf.",
      "Am Abend | ruft | sie | ihre Freundin | an.",
      "Morgen | holen | wir | dich | ab.",
      "Im Winter | ziehe | ich | eine Haube | an.",
      "Am Samstag | kaufen | wir | für die Party | ein.",
      "Heute | lädt | sie | alle Freunde | ein.",
      "Am Freitag | geben | wir | die Bücher | zurück.",
      "Nach dem Essen | räumt | er | den Tisch | ab.",
      "Im Zug | schläft | sie | immer gleich | ein.",
      "Jeden Tag | sieht | er | zu lange | fern.",
    ],
  },
  {
    typ: "futur",
    stufe: 2,
    saetze: [
      "Morgen | wird | es | den ganzen Tag | regnen.",
      "Nächste Woche | werden | wir | einen Test | schreiben.",
      "Im Sommer | werde | ich | meine Tante | besuchen.",
      "Bald | wirst | du | alles | verstehen.",
      "Nächstes Jahr | wird | sie | in Wien | studieren.",
      "Am Montag | werden | wir | ins Museum | gehen.",
    ],
  },
  // ---------- Stufe 2: der Gliedsatz, das Verb am Ende ----------
  {
    typ: "gliedsatz",
    stufe: 2,
    saetze: [
      "Ich bleibe zu Hause, weil | ich | krank | bin.",
      "Er freut sich, weil | er | Geburtstag | hat.",
      "Wir gehen hinein, weil | es | stark | regnet.",
      "Sie lernt viel, weil | sie | morgen einen Test | schreibt.",
      "Ich weiß, dass | du | recht | hast.",
      "Mama sagt, dass | wir | bald | essen.",
      "Er hofft, dass | sie | heute | kommt.",
      "Ich glaube, dass | er | sehr nett | ist.",
      "Wir spielen draußen, wenn | das Wetter | schön | ist.",
      "Ich rufe dich an, wenn | ich | zu Hause | bin.",
      "Sie fragt, ob | er | Zeit | hat.",
      "Ich weiß nicht, ob | sie | noch hier | wohnt.",
      "Er ist müde, weil | er | zu wenig | schläft.",
      "Wir warten, bis | du | fertig | bist.",
      "Sie ist froh, dass | er | wieder gesund | ist.",
      "Ich esse nichts, obwohl | ich | Hunger | habe.",
      "Er lacht, weil | der Witz | so lustig | ist.",
      "Wir bleiben wach, bis | der Film | zu Ende | ist.",
    ],
  },
  {
    typ: "frage",
    stufe: 2,
    saetze: [
      "Wann | kommst | du | nach Hause?",
      "Wo | hast | du | das Buch | gekauft?",
      "Warum | bist | du | so müde?",
      "Wie | geht | es | dir?",
      "Was | hast | du | gestern | gemacht?",
      "Wohin | fahrt | ihr | im Sommer?",
      "Wen | hast | du | eingeladen?",
      "Wann | fängt | der Film | an?",
      "Warum | hast | du | nicht | angerufen?",
      "Wo | wohnst | du | jetzt?",
      "Was | möchtest | du | trinken?",
      "Wie lange | musst | du | noch | lernen?",
      "Mit wem | gehst | du | ins Kino?",
      "Wann | seid | ihr | angekommen?",
      "Welches Buch | liest | du | gerade?",
      "Warum | darf | er | nicht | mitkommen?",
    ],
  },
  // ---------- Stufe 3: Gliedsatz mit zweiteiligem Prädikat, Gliedsatz vorne ----------
  {
    typ: "gliedsatz-klammer",
    stufe: 3,
    saetze: [
      "Er kommt zu spät, weil | er | den Bus | verpasst | hat.",
      "Ich bin froh, dass | du | mir | geholfen | hast.",
      "Sie weiß, dass | sie | mehr | lernen | muss.",
      "Wir bleiben daheim, weil | wir | morgen früh | aufstehen | müssen.",
      "Ich frage, ob | ich | heute länger | bleiben | darf.",
      "Er erzählt, dass | er | in Rom | gewesen | ist.",
      "Sie ist traurig, weil | sie | ihren Schlüssel | verloren | hat.",
      "Ich hoffe, dass | wir | uns bald | sehen | werden.",
      "Er sagt, dass | er | nicht | kommen | kann.",
      "Wir freuen uns, weil | wir | das Spiel | gewonnen | haben.",
      "Ich glaube, dass | sie | schon | gegangen | ist.",
      "Mama fragt, ob | ich | mein Zimmer | aufgeräumt | habe.",
      "Er lernt Deutsch, weil | er | in Wien | arbeiten | will.",
      "Ich weiß nicht, ob | er | den Brief | bekommen | hat.",
      "Sie bleibt im Bett, obwohl | sie | längst | aufstehen | sollte.",
      "Er ist stolz, weil | er | allein | Rad fahren | kann.",
    ],
  },
  {
    typ: "gliedsatz-vorn",
    stufe: 3,
    saetze: [
      "Weil es regnet, | bleiben | wir | zu Hause.",
      "Wenn ich Zeit habe, | komme | ich | zu dir.",
      "Als ich klein war, | hatte | ich | einen Hund.",
      "Obwohl er müde ist, | lernt | er | weiter.",
      "Wenn du willst, | helfe | ich | dir.",
      "Weil sie krank ist, | bleibt | sie | im Bett.",
      "Bevor wir essen, | waschen | wir | die Hände.",
      "Nachdem er gegessen hat, | macht | er | die Hausübung.",
      "Wenn es schneit, | bauen | wir | einen Schneemann.",
      "Dass du kommst, | freut | mich | sehr.",
      "Während sie kocht, | deckt | er | den Tisch.",
      "Sobald ich fertig bin, | rufe | ich | dich | an.",
      "Weil der Bus nicht kam, | sind | wir | zu Fuß | gegangen.",
      "Wenn du fertig bist, | können | wir | endlich | gehen.",
    ],
  },
];
