/**
 * Lernspiel „Wortarten“ für die Volksschule (niko 2026-11-25: „spiel für volksschule wortarten bestimmen. also verben
 * adjektive nomen“): ein kurzer Satz, ein Wort ist markiert, darunter drei Kacheln Nomen, Verb, Adjektiv.
 *
 * Die Sätze stehen unten, jedes fragbare Wort mit Etikett („Hund:n“). Nur markierte Wörter werden gefragt, die übrigen
 * (Artikel, Pronomen, Präpositionen, Adverbien wie „gern“ oder „heute“) stehen nur da. So kommt nie ein Wort, das in
 * der Volksschule keine der drei Wortarten ist.
 *
 * - `n` Nomen, `nn` ein Name (Lisa, Wien), `nv` ein Verb als Nomen („das Laufen“, „beim Spielen“)
 * - `v` Verb, dahinter `=Grundform` („schläft:v=schlafen“)
 * - `a` Adjektiv, vor einem Nomen oder nach „ist“ („Der Hund ist müde.“); `aw` sagt, wie jemand etwas tut („Er läuft
 *   schnell.“). Wie in den Übungen (lib/wortarten.ts `adj.adv`) bleibt das in der Schule ein Adjektiv. Mit Endung steht
 *   die Grundform dahinter („kleine:a=klein“).
 * - eine Ziffer nach dem Etikett setzt die Stufe (0 leicht bis 3 schwer), sonst gilt die des Etiketts: 0 für n, v, a;
 *   1 für Namen; 2 für `aw`; 3 für `nv`. Gefühle und Gedanken („Angst“, „Idee“) stehen als `n2`.
 *
 * Rein (keine Datenbank). Docs: docs/lernspiele.md „Wortarten (Volksschule)“.
 */
import type { Stufe } from "./banken-regeln";
import type { SpielKarte } from "./lernspiele-typen";

export const WORTART_FAECHER = ["Nomen", "Verb", "Adjektiv"] as const;
export type SpielWortart = (typeof WORTART_FAECHER)[number];

type Etikett = "n" | "nn" | "nv" | "v" | "a" | "aw";
const ETIKETT: Record<Etikett, { wa: SpielWortart; stufe: Stufe }> = {
  n: { wa: "Nomen", stufe: 0 },
  nn: { wa: "Nomen", stufe: 1 },
  nv: { wa: "Nomen", stufe: 3 },
  v: { wa: "Verb", stufe: 0 },
  a: { wa: "Adjektiv", stufe: 0 },
  aw: { wa: "Adjektiv", stufe: 2 },
};

/**
 * Die Sätze, zuerst ganz einfache (Tiere, Familie, Schule), dann längere. Ein Wort, das zwei Wortarten sein kann
 * („morgen“, „gern“, „viel“), bleibt unmarkiert.
 */
export const WORTART_SAETZE: string[] = [
  // Stufe 0: kurz, alles zum Anfassen
  "Der Hund:n bellt:v=bellen.",
  "Die Katze:n schläft:v=schlafen.",
  "Der Vogel:n singt:v=singen.",
  "Das Baby:n lacht:v=lachen.",
  "Die Sonne:n scheint:v=scheinen.",
  "Der Fisch:n schwimmt:v=schwimmen.",
  "Mama:n kocht:v=kochen Suppe:n.",
  "Papa:n liest:v=lesen die Zeitung:n.",
  "Die Kinder:n spielen:v=spielen im Garten:n.",
  "Der Bauer:n füttert:v=füttern die Kühe:n.",
  "Ich esse:v=essen einen Apfel:n.",
  "Wir malen:v=malen ein Bild:n.",
  "Du trinkst:v=trinken Milch:n.",
  "Die Ente:n schwimmt:v=schwimmen auf dem Teich:n.",
  "Der Frosch:n springt:v=springen ins Wasser:n.",
  "Die Oma:n strickt:v=stricken einen Schal:n.",
  "Der Lehrer:n schreibt:v=schreiben an die Tafel:n.",
  "Das Pferd:n frisst:v=fressen Heu:n.",
  "Die Biene:n fliegt:v=fliegen zur Blume:n.",
  "Wir bauen:v=bauen eine Sandburg:n.",
  "Der Opa:n gießt:v=gießen die Blumen:n.",
  "Die Maus:n knabbert:v=knabbern am Käse:n.",
  "Ich putze:v=putzen meine Zähne:n.",
  "Der Zug:n fährt:v=fahren in den Bahnhof:n.",
  "Die Kinder:n singen:v=singen ein Lied:n.",
  "Der Igel:n sucht:v=suchen Futter:n.",
  "Ich packe:v=packen meine Schultasche:n.",
  "Die Kuh:n gibt:v=geben Milch:n.",
  // Adjektive vor dem Nomen
  "Der kleine:a=klein Hund:n bellt:v=bellen.",
  "Die Katze:n trinkt:v=trinken warme:a=warm Milch:n.",
  "Ein großer:a=groß Vogel:n sitzt:v=sitzen auf dem Dach:n.",
  "Tom:nn malt:v=malen ein buntes:a=bunt Bild:n.",
  "Lisa:nn liest:v=lesen ein spannendes:a=spannend Buch:n.",
  "Das rote:a=rot Auto:n parkt:v=parken vor dem Haus:n.",
  "Die gelben:a=gelb Blumen:n blühen:v=blühen.",
  "Oma:n backt:v=backen einen süßen:a=süß Kuchen:n.",
  "Der alte:a=alt Baum:n hat:v=haben viele Äste:n.",
  "Ein kleines:a=klein Mädchen:n pflückt:v=pflücken Blumen:n.",
  "Der dicke:a=dick Kater:n liegt:v=liegen auf dem Sofa:n.",
  "Wir essen:v=essen frische:a=frisch Erdbeeren:n.",
  "Die mutige:a=mutig Feuerwehrfrau:n rettet:v=retten die Katze:n.",
  "Der Igel:n frisst:v=fressen einen dicken:a=dick Wurm:n.",
  "Paul:nn trägt:v=tragen eine warme:a=warm Mütze:n.",
  "Die müden:a=müde Kinder:n schlafen:v=schlafen.",
  "Ein lustiger:a=lustig Clown:n kommt:v=kommen in die Schule:n.",
  "Mia:nn hat:v=haben einen neuen:a=neu Ball:n.",
  "Der starke:a=stark Wind:n weht:v=wehen über das Feld:n.",
  "Im Herbst:n fallen:v=fallen die bunten:a=bunt Blätter:n.",
  "Die Kinder:n bauen:v=bauen einen großen:a=groß Schneemann:n.",
  "Der Junge:n isst:v=essen ein saftiges:a=saftig Stück:n Melone:n.",
  "Die Lehrerin:n erzählt:v=erzählen eine lustige:a=lustig Geschichte:n.",
  "Papa:n repariert:v=reparieren das kaputte:a=kaputt Fahrrad:n.",
  "Ben:nn findet:v=finden einen schönen:a=schön Stein:n.",
  // Adjektive nach „ist“ und „sind“
  "Der Hund:n ist:v1=sein müde:a.",
  "Die Suppe:n ist:v1=sein heiß:a.",
  "Die Tomaten:n sind:v1=sein reif:a.",
  "Das Wasser:n ist:v1=sein kalt:a.",
  "Mein Zimmer:n ist:v1=sein ordentlich:a.",
  "Der Elefant:n ist:v1=sein riesig:a.",
  "Die Maus:n ist:v1=sein winzig:a.",
  "Der Himmel:n ist:v1=sein blau:a.",
  "Die Straße:n ist:v1=sein nass:a.",
  "Die Kinder:n sind:v1=sein fröhlich:a.",
    "Das Kissen:n ist:v1=sein weich:a.",
  // Adjektive, die sagen, wie jemand etwas tut
  "Das Auto:n fährt:v=fahren schnell:aw.",
  "Die Schnecke:n kriecht:v=kriechen langsam:aw.",
  "Der Hund:n bellt:v=bellen laut:aw.",
  "Die Kinder:n flüstern:v=flüstern leise:aw.",
  "Lea:nn schreibt:v=schreiben ordentlich:aw.",
  "Der Fuchs:n schleicht:v=schleichen leise:aw durch den Wald:n.",
  "Das Baby:n lacht:v=lachen fröhlich:aw.",
  "Die Sonne:n scheint:v=scheinen hell:aw.",
  "Der Hase:n springt:v=springen hoch:aw über den Zaun:n.",
  "Max:nn rechnet:v=rechnen genau:aw.",
  "Die Kinder:n laufen:v=laufen schnell:aw nach Hause:n.",
  "Die Katze:n schnurrt:v=schnurren zufrieden:aw.",
  "Der Kuchen:n schmeckt:v=schmecken lecker:aw.",
  "Die Rose:n duftet:v=duften gut:aw.",
  // Namen und Orte, längere Sätze
  "Lisa:nn wohnt:v=wohnen in Graz:nn.",
  "Tom:nn und Anna:nn fahren:v=fahren nach Wien:nn.",
  "Im Sommer:n schwimmen:v=schwimmen wir im See:n.",
  "Am Montag:n turnen:v=turnen wir im Turnsaal:n.",
  "Nach der Schule:n macht:v=machen Mia:nn ihre Hausübung:n.",
  "Heute regnet:v=regnen es den ganzen:a=ganz Tag:n.",
  "Unser Hund:n wartet:v=warten vor der Tür:n.",
  "Die Klasse:n fährt:v=fahren mit dem Bus:n in den Zoo:n.",
  "Im Winter:n fahren:v=fahren wir mit dem Schlitten:n.",
  "Meine Schwester:n hört:v=hören gern Musik:n.",
  "Der Bäcker:n verkauft:v=verkaufen frisches:a=frisch Brot:n.",
  "Am Abend:n liest:v=lesen Papa:n eine Geschichte:n.",
  "In der Pause:n essen:v=essen wir unsere Jause:n.",
  "Die Kinder:n freuen:v=freuen sich auf die Ferien:n.",
  // Stufe 3: ein Verb wird zum Nomen, Gefühle und Gedanken
  "Das Lachen:nv macht:v=machen Spaß:n2.",
  "Beim Spielen:nv vergisst:v=vergessen Tom:nn die Zeit:n.",
  "Das Schwimmen:nv ist:v1=sein gesund:a.",
  "Beim Lesen:nv ist:v1=sein Lea:nn ganz still:a.",
  "Das Singen:nv gefällt:v=gefallen den Kindern:n.",
  "Zum Malen:nv braucht:v=brauchen Ben:nn Farben:n.",
  "Die Freude:n2 ist:v1=sein groß:a.",
  "Der Junge:n hat:v=haben große:a=groß Angst:n2 vor dem Gewitter:n.",
  "Mia:nn hat:v=haben eine tolle:a=toll Idee:n2.",
  "Die Kinder:n haben:v=haben viel Spaß:n2.",
  "Beim Turnen:nv schwitzt:v=schwitzen Paul:nn.",
  "Das Klettern:nv macht:v=machen Mia:nn großen:a=groß Spaß:n2.",
  "Zum Schreiben:nv nimmt:v=nehmen Lea:nn einen Bleistift:n.",
  "Das Bellen:nv weckt:v=wecken das Baby:n.",
  "Beim Essen:nv redet:v=reden man nicht.",
  "Das Rechnen:nv fällt:v=fallen Tom:nn leicht:a.",
  "Nach dem Baden:nv ist:v1=sein Ben:nn müde:a.",
  "Das Zeichnen:nv ist:v1=sein mein Hobby:n.",
  "Beim Laufen:nv hüpft:v=hüpfen der Hund:n fröhlich:aw.",
  "Das Träumen:nv ist:v1=sein schön:a.",
  "Die Kinder:n haben:v=haben Mut:n2.",
  "Lisa:nn hat:v=haben große:a=groß Freude:n2 mit dem Geschenk:n.",
  "Der Junge:n spürt:v=spüren keine Müdigkeit:n2.",
  "Die Lehrerin:n hat:v=haben viel Geduld:n2.",
  // Stufe 2: Adjektive, die sagen, wie etwas geschieht
  "Der Wind:n weht:v=wehen kräftig:aw.",
  "Die Kinder:n turnen:v=turnen geschickt:aw.",
  "Der Bus:n kommt:v=kommen pünktlich:aw.",
  "Opa:n erzählt:v=erzählen spannend:aw.",
  "Die Vögel:n zwitschern:v=zwitschern laut:aw.",
  "Mia:nn malt:v=malen sorgfältig:aw.",
  "Der Löwe:n brüllt:v=brüllen wild:aw.",
  "Die Kerze:n brennt:v=brennen hell:aw.",
  "Ben:nn antwortet:v=antworten richtig:aw.",
  "Das Eis:n schmilzt:v=schmelzen schnell:aw in der Sonne:n.",
  "Die Kinder:n warten:v=warten geduldig:aw auf den Bus:n.",
  "Der Hund:n schläft:v=schlafen ruhig:aw in seinem Korb:n.",
  "Tom:nn spricht:v=sprechen deutlich:aw.",
  "Die Ente:n watschelt:v=watscheln langsam:aw zum Teich:n.",
];

/** Ein fragbares Wort eines Satzes. */
type Teil = { vor: string; wort: string; nach: string; wa: SpielWortart; etikett: Etikett; stufe: Stufe; grundform: string };

const TOKEN = /^(.+?):(nn|nv|n|v|aw|a)([0-3])?(?:=([^.,!?]+))?([.,!?]*)$/;

/** Ein Satz der Liste: der Text ohne Etiketten und die fragbaren Wörter mit Stelle. */
export function leseWortartSatz(src: string): { text: string; teile: Teil[] } {
  const stuecke = src.split(/\s+/);
  const woerter: { w: string; punkt: string; tag: { etikett: Etikett; stufe: Stufe; grundform: string } | null }[] = stuecke.map((s) => {
    if (!s.includes(":")) return { w: s, punkt: "", tag: null };
    const m = TOKEN.exec(s);
    if (!m) throw new Error(`Wortarten-Spiel: „${s}“ hat kein gültiges Etikett`);
    const etikett = m[2] as Etikett;
    return { w: m[1], punkt: m[5], tag: { etikett, stufe: (m[3] !== undefined ? Number(m[3]) : ETIKETT[etikett].stufe) as Stufe, grundform: m[4] ?? m[1] } };
  });
  const text = woerter.map((x) => x.w + x.punkt).join(" ");
  const teile: Teil[] = [];
  woerter.forEach((x, i) => {
    if (!x.tag) return;
    const vor = woerter
      .slice(0, i)
      .map((y) => y.w + y.punkt)
      .join(" ");
    const nach = x.punkt + woerter.slice(i + 1).map((y) => ` ${y.w}${y.punkt}`).join("");
    teile.push({ vor: vor ? `${vor} ` : "", wort: x.w, nach, wa: ETIKETT[x.tag.etikett].wa, etikett: x.tag.etikett, stufe: x.tag.stufe, grundform: x.tag.grundform });
  });
  return { text, teile };
}

/** Was nach einem Fehler erscheint: die Probe, mit der man die Wortart findet, für genau dieses Wort. */
export function wortartRegel(t: Pick<Teil, "wort" | "etikett" | "grundform">): string {
  const w = `„${t.wort}“`;
  switch (t.etikett) {
    case "n":
      return `${w} ist ein Nomen (Namenwort). Probe: Man kann „der“, „die“ oder „das“ davorsetzen, und man schreibt es groß.`;
    case "nn":
      return `${w} ist ein Name. Namen von Menschen, Tieren und Orten sind Nomen und werden großgeschrieben.`;
    case "nv":
      return `${w} ist hier ein Nomen: Mit „das“, „beim“ oder „zum“ davor wird ein Verb zum Nomen und wird großgeschrieben.`;
    case "v":
      return `${w} ist ein Verb (Zeitwort). Probe: ich …, du …, er … – das Wort verändert sich mit der Person. Grundform: ${t.grundform}.`;
    case "a":
      return `${w} ist ein Adjektiv (Wiewort). Es sagt, wie jemand oder etwas ist: ${t.grundform}. Probe: Man kann „sehr“ davorsetzen.`;
    case "aw":
      return `${w} sagt hier, wie etwas geschieht (Wie? – ${t.grundform}). Auch dann ist es ein Adjektiv (Wiewort). Probe: Man kann „sehr“ davorsetzen.`;
  }
}

export const wortartKey = (text: string, wort: string, nr: number) => `wortarten:${text}|${wort}#${nr}`;

/** Alle Karten, je fragbares Wort eine; Karten aus demselben Satz kommen nicht zusammen in eine Runde (`gruppe`). */
export function wortartKandidaten(): { karte: SpielKarte; stufe: Stufe; gruppe: string }[] {
  return WORTART_SAETZE.flatMap((src) => {
    const { text, teile } = leseWortartSatz(src);
    return teile.map((t, nr) => ({
      karte: {
        key: wortartKey(text, t.wort, nr),
        vor: t.vor,
        mitte: t.wort,
        nach: t.nach,
        form: "kacheln",
        faecher: [...WORTART_FAECHER],
        richtig: t.wa,
        loesung: `„${t.wort}“: ${t.wa}`,
        regel: wortartRegel(t),
        kurz: t.wort,
      },
      // ein Satz mit Adjektiv, das sagt, wie jemand etwas tut, ist für alle Wörter darin etwas schwerer
      stufe: Math.max(t.stufe, teile.some((x) => x.etikett === "aw") && t.etikett !== "aw" ? 1 : 0) as Stufe,
      gruppe: `wortarten:${text}`,
    }));
  });
}
