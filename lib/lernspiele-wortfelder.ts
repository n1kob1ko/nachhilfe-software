/**
 * Wortfelder für die Schreib-Themen (niko 2026-11-12: „gruselgeschichte muss der schüler lernen und dann bei den
 * lernspielen sind es wörter die er für eine gruselgeschichte braucht“). Je Thema drei Listen, von Hand geschrieben:
 *
 * - `saetze`: ein Satz mit dem treffenden Wort in eckigen Klammern, zwei Wörter, die dort nicht passen, und was das
 *   Wort bedeutet. Daraus wird das Spiel „Wortschatz“: der Schüler tippt das treffende Wort in die Lücke.
 * - `nomen`: Nomen des Themas mit Artikel. Steht das Thema im Stoff, spielt „der, die, das“ diese Wörter.
 * - `verben`: ein Satz im Präteritum, das Verb in eckigen Klammern, die Grundform und zwei typische falsche Formen.
 *   Steht das Thema im Stoff, spielt „Präteritum“ diese Sätze. Die Personenbeschreibung hat keine (sie steht im
 *   Präsens).
 *
 * Die falschen Wörter sind im Satz klar falsch (kein zweites Wort, das auch ginge). Nur Reines (keine Datenbank).
 */
import { bankStufe } from "./banken-regeln";
import { artikelItems, type ArtikelItem, type ClozeItem } from "./banks";
import { artikelKarte, praeteritumKarte, type Kandidat } from "./lernspiele-karten";
import { zahlAus, type SpielKarte, type SpielThema } from "./lernspiele-typen";

type Satz = [satz: string, falsch1: string, falsch2: string, bedeutung: string];
type Verb = [satz: string, grundform: string, falsch1: string, falsch2: string];

export type Wortfeld = SpielThema & { nomen: string[]; saetze: Satz[]; verben: Verb[] };

const ERZAEHLUNG = "deutsch.schreiben.erzaehlung";

export const WORTFELDER: Wortfeld[] = [
  {
    skill: `${ERZAEHLUNG}.grusel`,
    name: "Gruselgeschichte",
    ab: 3,
    nomen: [
      "das Gespenst", "der Geist", "die Gänsehaut", "der Schatten", "die Gruft", "der Keller", "die Fledermaus", "der Friedhof",
      "der Nebel", "die Mitternacht", "das Grab", "der Sarg", "die Kerze", "der Vollmond", "die Eule", "der Dachboden",
      "das Skelett", "der Schrei", "die Dunkelheit", "das Gewitter", "das Geräusch", "der Albtraum", "das Spinnennetz", "der Vampir",
    ],
    saetze: [
      ["Die alte Tür [knarrte] laut, als ich sie öffnete.", "kicherte", "tropfte", "knarren: So klingt altes Holz, wenn es sich bewegt."],
      ["Plötzlich [flackerte] die Kerze und ging aus.", "bellte", "kletterte", "flackern: Eine Flamme brennt unruhig, mal hell, mal dunkel."],
      ["Aus dem Keller kam ein [unheimliches] Heulen.", "gemütliches", "leckeres", "unheimlich: so, dass man Angst bekommt, ohne genau zu wissen, warum."],
      ["Mit angehaltenem Atem [lauschte] ich an der Tür.", "kaute", "turnte", "lauschen: ganz still und genau zuhören."],
      ["Ein eisiger Schauer lief mir über den [Rücken].", "Teller", "Rasen", "Ein Schauer läuft einem über den Rücken, wenn man sich fürchtet."],
      ["Vor Angst [zitterten] mir die Knie.", "lachten", "glänzten", "zittern: sich vor Angst oder Kälte schnell hin und her bewegen."],
      ["Draußen [heulte] der Wind um das Haus.", "schmatzte", "nieste", "heulen: laut und lang klingen, wie ein Wolf; so klingt starker Wind."],
      ["Im Mondlicht sah ich eine [schattenhafte] Gestalt am Fenster.", "knusprige", "sonnige", "schattenhaft: nur als dunkler Umriss zu sehen."],
      ["Mein Herz [pochte] so laut, dass ich es hören konnte.", "gähnte", "flog", "pochen: schnell und kräftig schlagen."],
      ["Auf dem Dachboden [raschelte] etwas im Stroh.", "glitzerte", "schwamm", "rascheln: das leise Geräusch von trockenem Laub, Papier oder Stroh."],
      ["Ein [gellender] Schrei zerriss die Stille.", "flauschiger", "süßer", "gellend: sehr laut und schrill."],
      ["Im Dunkeln [tastete] ich nach dem Lichtschalter.", "lachte", "schwamm", "tasten: mit den Händen fühlen, weil man nichts sieht."],
      ["Die Luft im Keller war [modrig] und kalt.", "sonnig", "knusprig", "modrig: riecht feucht und alt, wie nasses Holz."],
      ["Vor Schreck [erstarrte] ich und konnte mich nicht mehr bewegen.", "tanzte", "jubelte", "erstarren: vor Angst plötzlich ganz steif werden."],
      ["Langsam [quietschte] das rostige Tor.", "duftete", "blühte", "quietschen: ein hohes, schrilles Geräusch, zum Beispiel von rostigem Metall."],
      ["Vor Schreck stockte mir der [Atem].", "Kuchen", "Schuh", "Der Atem stockt: Man hört vor Schreck kurz auf zu atmen."],
    ],
    verben: [
      ["Leise [schlich] ich die Treppe hinunter.", "schleichen", "schleichte", "schleicht"],
      ["Ein kalter Schauer [lief] mir über den Rücken.", "laufen", "laufte", "läuft"],
      ["Plötzlich [griff] eine kalte Hand nach meinem Arm.", "greifen", "greifte", "greift"],
      ["Aus dem Keller [drang] ein dumpfes Klopfen.", "dringen", "dringte", "drung"],
      ["Das Gespenst [schwebte] durch die Wand.", "schweben", "schwob", "schwebt"],
      ["Ich [schrie], so laut ich konnte.", "schreien", "schreiete", "schreit"],
      ["Der Wind [riss] das Fenster auf.", "reißen", "reißte", "reißt"],
      ["Die Kerze [erlosch] mit einem Zischen.", "erlöschen", "erlöschte", "erlischt"],
      ["Mein Bruder [hielt] die Taschenlampe ganz fest.", "halten", "haltete", "hält"],
      ["Vor Schreck [fiel] mir die Taschenlampe aus der Hand.", "fallen", "fallte", "fällt"],
      ["Die Turmuhr [schlug] zwölf.", "schlagen", "schlagte", "schlägt"],
      ["Das Licht [verschwand] hinter der nächsten Ecke.", "verschwinden", "verschwindete", "verschwindet"],
      ["Wir [flohen] aus dem dunklen Haus.", "fliehen", "fliehten", "fliehen"],
      ["Etwas [kroch] langsam über den Boden.", "kriechen", "kriechte", "kriecht"],
    ],
  },
  {
    skill: `${ERZAEHLUNG}.abenteuer`,
    name: "Abenteuergeschichte",
    ab: 3,
    nomen: [
      "die Schatzkarte", "der Schatz", "die Höhle", "der Dschungel", "die Expedition", "das Floß", "der Kompass", "die Insel",
      "der Pirat", "das Seil", "die Fackel", "der Rucksack", "die Klippe", "der Wasserfall", "die Hängebrücke", "das Lagerfeuer",
      "das Zelt", "die Spur", "der Sturm", "das Abenteuer", "die Wüste", "der Gipfel", "die Truhe", "das Fernglas",
    ],
    saetze: [
      ["Mit klopfendem Herzen [kletterten] wir die steile Felswand hinauf.", "schwammen", "schliefen", "klettern: sich mit Händen und Füßen nach oben bewegen."],
      ["Die Hängebrücke [schwankte] bei jedem Schritt.", "duftete", "bellte", "schwanken: sich unsicher hin und her bewegen."],
      ["Auf der alten Karte war der Schatz mit einem roten Kreuz [markiert].", "gebacken", "gesungen", "markieren: mit einem Zeichen deutlich kennzeichnen."],
      ["Der Weg durch den Dschungel war [gefährlich] und voller Schlangen.", "gemütlich", "langweilig", "gefährlich: so, dass etwas Schlimmes passieren kann."],
      ["Mutig [wagte] sich Mia in die dunkle Höhle.", "langweilte", "schämte", "sich wagen: trotz Gefahr etwas Mutiges tun."],
      ["Erschöpft [erreichten] wir endlich den Gipfel.", "vergaßen", "verkauften", "erreichen: an einem Ziel ankommen."],
      ["Die Wellen [peitschten] gegen unser kleines Floß.", "tranken", "lasen", "peitschen: heftig und laut gegen etwas schlagen."],
      ["Mit dem Kompass [bestimmten] wir die Richtung.", "kochten", "tanzten", "die Richtung bestimmen: herausfinden, wohin man gehen muss."],
      ["In letzter Sekunde [sprang] Tom über den Graben.", "schlief", "las", "springen: sich mit Schwung vom Boden abstoßen."],
      ["Vor uns lag eine [unbewohnte] Insel.", "hungrige", "flüssige", "unbewohnt: Dort lebt kein Mensch."],
      ["Der Pfad wurde immer [schmäler], bis er ganz verschwand.", "lauter", "süßer", "schmal: wenig breit; schmäler (oder schmaler) heißt: noch weniger breit."],
      ["Die Fackel [erhellte] die feuchten Wände der Höhle.", "verschluckte", "kämmte", "erhellen: hell machen."],
      ["Wir mussten den reißenden Fluss [überqueren].", "frühstücken", "anrufen", "überqueren: von einer Seite auf die andere gelangen."],
      ["Endlich [entdeckten] wir die verborgene Truhe.", "bügelten", "fütterten", "entdecken: etwas finden, das versteckt oder unbekannt war."],
      ["Mein Rucksack war schwer, doch ich [gab] nicht auf.", "aß", "sah", "nicht aufgeben: weitermachen, auch wenn es schwer ist."],
      ["Hinter dem Wasserfall [verbarg] sich ein geheimer Eingang.", "badete", "beschwerte", "sich verbergen: versteckt sein."],
    ],
    verben: [
      ["Wir [stiegen] immer höher auf den Berg.", "steigen", "steigten", "stiegten"],
      ["Der Pirat [vergrub] den Schatz am Strand.", "vergraben", "vergrabte", "vergräbt"],
      ["Mia [fand] eine alte Flaschenpost.", "finden", "findete", "fund"],
      ["Das Floß [trieb] langsam auf das Meer hinaus.", "treiben", "treibte", "treibt"],
      ["Wir [schwammen] zur kleinen Insel hinüber.", "schwimmen", "schwimmten", "schwammten"],
      ["Tom [warf] das Seil über den Ast.", "werfen", "werfte", "wirft"],
      ["Der morsche Ast [brach] unter meinem Gewicht.", "brechen", "brechte", "bricht"],
      ["Wir [zogen] das Boot an Land.", "ziehen", "ziehten", "zogten"],
      ["Die Kinder [liefen], so schnell sie konnten.", "laufen", "lauften", "lieften"],
      ["Im Sand [lag] eine verrostete Kiste.", "liegen", "liegte", "liegt"],
      ["Der Adler [flog] hoch über uns.", "fliegen", "fliegte", "fliegt"],
      ["Wir [banden] das Floß mit Seilen zusammen.", "binden", "bindeten", "bunden"],
      ["Am Abend [saßen] wir um das Lagerfeuer.", "sitzen", "sitzten", "saßten"],
      ["Lea [sprang] mutig über den Bach.", "springen", "springte", "sprung"],
    ],
  },
  {
    skill: `${ERZAEHLUNG}.maerchen`,
    name: "Märchen",
    ab: 3,
    auch: ["deutsch.literatur.maerchen"],
    nomen: [
      "die Prinzessin", "der Prinz", "die Hexe", "der Zauberer", "die Fee", "der Zwerg", "der Drache", "das Schloss",
      "der Brunnen", "der Frosch", "die Krone", "der Zauberstab", "das Lebkuchenhaus", "der Riese", "die Königin", "der König",
      "der Fluch", "der Spiegel", "die Kutsche", "das Einhorn", "der Wolf", "die Stiefmutter", "der Zauberspruch", "der Turm",
    ],
    saetze: [
      ["Es war [einmal] ein armer Müller.", "morgen", "zweimal", "Viele Märchen beginnen mit „Es war einmal …“."],
      ["Die böse Hexe [verzauberte] den Prinzen in einen Frosch.", "verkaufte", "verband", "verzaubern: mit Zauberkraft in etwas anderes verwandeln."],
      ["Die Königstochter war [wunderschön] und klug.", "rostig", "flüssig", "wunderschön: sehr, sehr schön; so werden Königstöchter im Märchen oft beschrieben."],
      ["Der Wolf [verschlang] die Großmutter mit einem Bissen.", "verlas", "vergoss", "verschlingen: gierig und ganz hinunterschlucken."],
      ["Im tiefen Wald stand ein [verwunschenes] Schloss.", "elektrisches", "pünktliches", "verwunschen: verzaubert, mit einem Fluch belegt."],
      ["Die gute Fee [erfüllte] ihr drei Wünsche.", "zerbrach", "verkühlte", "einen Wunsch erfüllen: geschehen lassen, was sich jemand wünscht."],
      ["Und wenn sie nicht gestorben sind, dann [leben] sie noch heute.", "lesen", "schwimmen", "So enden viele Märchen: „… dann leben sie noch heute.“"],
      ["Der tapfere Schneider [besiegte] den Riesen mit einer List.", "bügelte", "fütterte", "besiegen: im Kampf oder Wettstreit gewinnen."],
      ["Der König [versprach] dem Helden die Hand seiner Tochter.", "verschlief", "verbrannte", "versprechen: fest sagen, dass man etwas tun oder geben wird."],
      ["Hundert Jahre lang [schlief] Dornröschen in ihrem Turm.", "kochte", "rannte", "Dornröschen schlief hundert Jahre, bis der Prinz kam."],
      ["Mit einem [Zauberspruch] öffnete sich die Felswand.", "Kochlöffel", "Fahrschein", "Zauberspruch: Worte, die einen Zauber wirken lassen („Sesam, öffne dich!“)."],
      ["Die Stiefmutter war [neidisch] auf Schneewittchens Schönheit.", "pünktlich", "nass", "neidisch: Man gönnt einem anderen nicht, was er hat."],
      ["Der Prinz [erlöste] die Prinzessin von dem bösen Fluch.", "verwechselte", "frisierte", "erlösen: von einem Zauber oder Fluch befreien."],
      ["Im Schloss lebte ein [mächtiger] König.", "gläserner", "flüssiger", "mächtig: hat viel Macht und Kraft."],
      ["Hänsel und Gretel [verirrten] sich im dunklen Wald.", "rasierten", "verlobten", "sich verirren: den Weg nicht mehr finden."],
      ["Das Pferd konnte [sprechen] und gab dem Jungen einen Rat.", "stricken", "bellen", "Im Märchen können Tiere oft sprechen."],
    ],
    verben: [
      ["Der Frosch [sprach] mit menschlicher Stimme.", "sprechen", "sprechte", "spricht"],
      ["Der Wolf [fraß] die sieben Geißlein.", "fressen", "fresste", "frisst"],
      ["Der Drache [spie] Feuer.", "speien", "speite", "speit"],
      ["Gretel [stieß] die Hexe in den Ofen.", "stoßen", "stoßte", "stößt"],
      ["Der König [gab] ein großes Fest.", "geben", "gebte", "gibt"],
      ["Aschenputtel [verlor] ihren Schuh auf der Treppe.", "verlieren", "verlierte", "verliert"],
      ["Rotkäppchen [trug] einen Korb mit Kuchen und Wein.", "tragen", "tragte", "trägt"],
      ["Der Prinz [ritt] auf seinem Pferd zum Schloss.", "reiten", "reitete", "reitet"],
      ["Die Königin [stach] sich mit der Nadel in den Finger.", "stechen", "stechte", "sticht"],
      ["Der Riese [schlief] unter einem großen Baum.", "schlafen", "schlafte", "schläft"],
      ["Die Fee [hob] ihren Zauberstab.", "heben", "hebte", "hebt"],
      ["Die Zwerge [kamen] am Abend nach Hause.", "kommen", "kommten", "kamten"],
      ["Der Müller [log] den König an.", "lügen", "lügte", "lügt"],
      ["Schneewittchen [aß] von dem giftigen Apfel.", "essen", "esste", "isst"],
    ],
  },
  {
    skill: `${ERZAEHLUNG}.krimi`,
    name: "Krimi",
    ab: 5,
    nomen: [
      "der Detektiv", "der Täter", "die Spur", "der Fingerabdruck", "das Alibi", "der Zeuge", "die Zeugin", "das Verhör",
      "die Lupe", "der Dieb", "der Einbruch", "die Beute", "der Tresor", "der Verdacht", "das Motiv", "der Tatort",
      "die Polizei", "das Versteck", "der Beweis", "das Rätsel", "die Ermittlung", "das Indiz", "der Kommissar", "die Fußspur",
    ],
    saetze: [
      ["Die Kommissarin [untersuchte] den Tatort genau.", "bemalte", "bestellte", "untersuchen: genau prüfen, um etwas herauszufinden."],
      ["Am Fenster fand man einen [Fingerabdruck].", "Pfannkuchen", "Sonnenstrahl", "Fingerabdruck: die Spur, die ein Finger hinterlässt; jeder Mensch hat einen anderen."],
      ["Der Verdächtige hatte für die Tatzeit kein [Alibi].", "Frühstück", "Fahrrad", "Alibi: der Beweis, dass jemand zur Tatzeit woanders war."],
      ["Der Dieb [entkam] durch den Hinterausgang.", "erkältete", "empfahl", "entkommen: es schaffen zu fliehen."],
      ["Eine Zeugin hatte einen Mann mit Kapuze [beobachtet].", "gebügelt", "gestrickt", "beobachten: genau und eine Zeit lang hinschauen."],
      ["Die Polizei [verfolgte] die Spur bis zum Hafen.", "verkaufte", "verschluckte", "verfolgen: einer Person oder einer Spur nachgehen."],
      ["Der Detektiv [verhörte] den Gärtner stundenlang.", "frisierte", "fütterte", "verhören: jemanden genau befragen, um die Wahrheit herauszufinden."],
      ["Sein Verhalten war [verdächtig]: Er sah sich ständig um.", "lecker", "pünktlich", "verdächtig: so, dass man glaubt, jemand hat etwas Böses getan."],
      ["Endlich [gestand] der Täter die Tat.", "bestellte", "reparierte", "gestehen: zugeben, dass man etwas getan hat."],
      ["Mit der Lupe [entdeckte] Emil ein winziges Haar.", "kochte", "pflanzte", "entdecken: etwas finden, das man vorher nicht gesehen hat."],
      ["Der Einbrecher hatte den Tresor [aufgebrochen].", "aufgegessen", "aufgeblasen", "aufbrechen: mit Gewalt öffnen."],
      ["Die Beute war in einem alten Koffer [versteckt].", "gekocht", "gesungen", "verstecken: an einen Ort legen, wo es niemand findet."],
      ["Lisa hatte einen [Verdacht]: Der Butler war der Täter.", "Schnupfen", "Kuchen", "Verdacht: die Vermutung, dass jemand etwas getan hat."],
      ["Die Polizei [nahm] den Dieb am Bahnhof fest.", "gab", "las", "festnehmen: jemanden mitnehmen, weil er verdächtig ist."],
      ["Die Spuren im Schnee [führten] direkt zum Gartenhaus.", "sangen", "kochten", "führen: den Weg zu etwas zeigen."],
      ["Der Fall war [rätselhaft], niemand wusste eine Erklärung.", "knusprig", "gemütlich", "rätselhaft: schwer zu verstehen oder zu erklären."],
    ],
    verben: [
      ["Der Dieb [stahl] die wertvolle Kette.", "stehlen", "stehlte", "stiehlt"],
      ["Der Verdächtige [log] bei der Befragung.", "lügen", "lügte", "lügt"],
      ["Der Hund [roch] an der Jacke des Täters.", "riechen", "riechte", "riecht"],
      ["Die Kommissarin [fand] einen wichtigen Hinweis.", "finden", "findete", "fund"],
      ["Der Täter [trug] schwarze Handschuhe.", "tragen", "tragte", "trägt"],
      ["Die Zeugin [beschrieb] den Mann genau.", "beschreiben", "beschreibte", "beschrub"],
      ["Der Täter [floh] mit dem Auto.", "fliehen", "fliehte", "flieht"],
      ["Der Detektiv [verglich] die Fingerabdrücke.", "vergleichen", "vergleichte", "vergleicht"],
      ["Niemand [wusste], wo die Beute war.", "wissen", "wisste", "weiß"],
      ["Der Polizist [rief] laut nach Verstärkung.", "rufen", "rufte", "ruft"],
      ["Der Täter [hinterließ] eine Spur aus Schlamm.", "hinterlassen", "hinterlasste", "hinterlässt"],
      ["Der Kommissar [schloss] die Akte.", "schließen", "schließte", "schließt"],
      ["Der Dieb [verbarg] sich im Keller.", "verbergen", "verbergte", "verbirgt"],
      ["Die Kommissarin [dachte] an den Fingerabdruck.", "denken", "denkte", "denkt"],
    ],
  },
  {
    skill: `${ERZAEHLUNG}.sage`,
    name: "Sage",
    ab: 5,
    auch: ["deutsch.literatur.sage"],
    nomen: [
      "der Ritter", "die Burg", "der Drache", "der Riese", "die Quelle", "der Schatz", "der Teufel", "der Lindwurm",
      "der Basilisk", "das Dorf", "die Brücke", "der Kaiser", "die Höhle", "die Ruine", "der Fluch", "die Strafe",
      "der Held", "das Schwert", "die Glocke", "der Brunnen", "die Nixe", "der Bauer", "das Moor", "die Sage",
    ],
    saetze: [
      ["Der tapfere Ritter [kämpfte] gegen den Lindwurm.", "badete", "frühstückte", "kämpfen: sich mit Kraft gegen einen Gegner wehren."],
      ["Der Sage nach [hauste] in der Höhle ein Drache.", "lernte", "parkte", "hausen: an einem Ort wohnen, meist wild oder ärmlich."],
      ["Der Teufel [verlangte] als Lohn die erste Seele, die über die Brücke ging.", "bügelte", "verschenkte", "verlangen: etwas fordern."],
      ["Seit jenem Tag ist der Ort [verflucht].", "gebügelt", "gepolstert", "verflucht: Ein Fluch liegt darauf und bringt Unglück."],
      ["In der Burgruine soll ein Schatz [verborgen] sein.", "gebacken", "geschminkt", "verborgen: versteckt."],
      ["Die Bauern [fürchteten] sich vor dem Riesen.", "freuten", "kämmten", "sich fürchten: Angst haben."],
      ["Die Sage spielt an einem [bestimmten] Ort: in Wien, am Ende des Mittelalters.", "essbaren", "flüssigen", "Eine Sage nennt einen bestimmten Ort, ein Märchen nicht."],
      ["Zur Strafe wurde der [geizige] Bauer in Stein verwandelt.", "flüssige", "gläserne", "geizig: will nichts hergeben, auch wenn er genug hat."],
      ["Mit seinem Schwert [schlug] der Held dem Drachen den Kopf ab.", "nähte", "malte", "abschlagen: mit einem Schlag abtrennen."],
      ["Noch heute erzählt man sich im Dorf diese [Sage].", "Rechnung", "Steckdose", "Sagen wurden lange mündlich weitererzählt."],
      ["Der Bäckerjunge [wagte] sich in den tiefen Brunnen hinab.", "langweilte", "verliebte", "sich wagen: trotz Angst etwas Gefährliches tun."],
      ["Ein [übernatürliches] Wesen bewachte die Quelle.", "pünktliches", "elektrisches", "übernatürlich: kann mehr, als in der Natur möglich ist (Geister, Riesen, Drachen)."],
      ["Der Riese [schleuderte] einen Felsbrocken ins Tal.", "streichelte", "leckte", "schleudern: mit viel Schwung werfen."],
      ["Der Ritter [schwor], das Dorf zu beschützen.", "kaute", "nieste", "schwören: feierlich versprechen."],
      ["Um Mitternacht [läutete] die Glocke von selbst.", "schwamm", "kochte", "läuten: Eine Glocke klingt."],
      ["Der Lindwurm [bedrohte] die Menschen von Klagenfurt.", "bediente", "bezahlte", "bedrohen: jemandem Angst machen und Gefahr bringen."],
    ],
    verben: [
      ["Der Ritter [schwor] Rache.", "schwören", "schwörte", "schwört"],
      ["Der Drache [trat] aus der Höhle.", "treten", "tretete", "tritt"],
      ["Der Riese [warf] einen Stein ins Tal.", "werfen", "werfte", "wirft"],
      ["Der Held [stieß] sein Schwert in den Felsen.", "stoßen", "stoßte", "stößt"],
      ["Der Bauer [grub] nach dem Schatz.", "graben", "grabte", "gräbt"],
      ["Die Nixe [sang] ein trauriges Lied.", "singen", "singte", "sung"],
      ["Der Teufel [hielt] sein Versprechen.", "halten", "haltete", "hält"],
      ["Ein Blitz [traf] den Turm der Burg.", "treffen", "treffte", "trifft"],
      ["Der Wanderer [trank] aus der verzauberten Quelle.", "trinken", "trinkte", "trunk"],
      ["Der Basilisk [saß] tief unten im Brunnen.", "sitzen", "sitzte", "sitzt"],
      ["Das Wasser [stieg] immer höher.", "steigen", "steigte", "steigt"],
      ["Die Burg [sank] im Moor.", "sinken", "sinkte", "sinkt"],
      ["Die Leute [flohen] aus dem Dorf.", "fliehen", "fliehten", "fliehen"],
      ["Der Ritter [ritt] durch den finsteren Wald.", "reiten", "reitete", "reitet"],
    ],
  },
  {
    skill: "deutsch.beschreiben.person",
    name: "Personenbeschreibung",
    ab: 5,
    nomen: [
      "das Gesicht", "die Stirn", "die Nase", "das Kinn", "die Wange", "das Auge", "die Augenbraue", "die Wimper",
      "die Lippe", "das Ohr", "der Hals", "die Schulter", "der Bart", "die Brille", "die Sommersprosse", "die Narbe",
      "der Zopf", "die Glatze", "die Jacke", "der Pullover", "die Hose", "der Rock", "das Kleid", "der Gürtel",
      "die Mütze", "der Schal", "das Muttermal", "die Locke", "der Scheitel",
    ],
    saetze: [
      ["Sie hat [lockige] Haare, die ihr bis zu den Schultern reichen.", "knusprige", "laute", "lockig: Die Haare fallen in Wellen oder Ringeln."],
      ["Er ist etwa 1,80 Meter groß und [schlank].", "pünktlich", "flüssig", "schlank: dünn und gut gewachsen."],
      ["Auf ihrer Nase sind viele kleine [Sommersprossen].", "Schnürsenkel", "Briefmarken", "Sommersprossen: kleine braune Punkte auf der Haut."],
      ["Er trägt einen [gestreiften] Pullover.", "gekochten", "gefährlichen", "gestreift: mit Streifen gemustert."],
      ["Über seinem rechten Auge hat er eine kleine [Narbe].", "Garage", "Gabel", "Narbe: ein Zeichen auf der Haut, wo eine Wunde verheilt ist."],
      ["Ihre Augen sind [graublau].", "rechteckig", "laut", "Augenfarben: blau, grün, braun, grau oder gemischt wie graublau."],
      ["Der Mann hat [buschige] Augenbrauen.", "flüssige", "hölzerne", "buschig: dicht und kräftig gewachsen."],
      ["Sie trägt ihre Haare zu einem [Zopf] geflochten.", "Teller", "Schrank", "Zopf: geflochtenes Haar."],
      ["Der Junge ist ungefähr zwölf Jahre [alt].", "breit", "schwer", "Das Alter gehört an den Anfang einer Personenbeschreibung."],
      ["Sein Gesicht ist [rundlich], mit vollen Wangen.", "durstig", "pünktlich", "rundlich: fast rund, ein bisschen voll."],
      ["An den Füßen trägt sie [abgetragene] Turnschuhe.", "abgeschriebene", "abgekochte", "abgetragen: schon lange und oft getragen, nicht mehr neu."],
      ["Er hat einen [gepflegten] Bart.", "gebratenen", "gezähmten", "gepflegt: sauber und ordentlich."],
      ["Ihre Haut ist [blass], fast weiß.", "laut", "eckig", "blass: hell, ohne Farbe im Gesicht."],
      ["Auffällig ist seine [schiefe] Nase.", "gebackene", "singende", "schief: nicht gerade."],
      ["Die Frau hat [schulterlange], glatte Haare.", "stundenlange", "meterhohe", "schulterlang: so lang, dass sie bis zu den Schultern reichen."],
      ["Er hat [breite] Schultern und kräftige Arme.", "süße", "gläserne", "breit: viel Platz von einer Seite zur anderen."],
    ],
    verben: [],
  },
];

/** Die Themen des Spiels „Wortschatz“ (lib/lernspiele-themen.ts). */
export const WORTSCHATZ_THEMEN: SpielThema[] = WORTFELDER.map(({ skill, name, ab, auch }) => ({ skill, name, ab, ...(auch ? { auch } : {}) }));

export const wortfeld = (skill: string): Wortfeld | undefined => WORTFELDER.find((w) => w.skill === skill);

/** Der Satz eines Eintrags: vor der Klammer, das Wort, nach der Klammer. */
export function zerlege(satz: string): { vor: string; wort: string; nach: string } | null {
  const m = satz.match(/^([^[\]]*)\[([^[\]]+)\]([^[\]]*)$/);
  return m ? { vor: m[1], wort: m[2], nach: m[3] } : null;
}

/** Eine Karte „Wortschatz“: der Satz mit Lücke, auf Kacheln das treffende Wort und zwei, die nicht passen. */
export function wortschatzKarte(skill: string, [satz, falsch1, falsch2, bedeutung]: Satz): SpielKarte | null {
  const t = zerlege(satz);
  if (!t) return null;
  const ganz = t.vor + t.wort + t.nach;
  const h = zahlAus(ganz);
  const faecher = [falsch1, falsch2];
  faecher.splice(h % 3, 0, t.wort);
  return { key: `wortschatz:${ganz}`, skill, vor: t.vor, nach: t.nach, faecher, richtig: t.wort, loesung: ganz, regel: bedeutung, kurz: t.wort };
}

const cache = new Map<string, Kandidat[]>();
const gemerkt = (key: string, bau: () => Kandidat[]) => {
  const c = cache.get(key);
  if (c) return c;
  const out = bau();
  cache.set(key, out);
  return out;
};

/** Die Karten „Wortschatz“ eines Wortfelds. */
export const wortschatzKandidaten = (skill: string): Kandidat[] =>
  gemerkt(`w:${skill}`, () =>
    (wortfeld(skill)?.saetze ?? []).flatMap((s) => {
      const karte = wortschatzKarte(skill, s);
      return karte ? [{ karte, stufe: 1 as const }] : [];
    }),
  );

/** „das Gespenst“ → { article: "das", word: "Gespenst" } */
export function nomenItem(nomen: string): Pick<ArtikelItem, "article" | "word"> | null {
  const m = nomen.match(/^(der|die|das) (\S+)$/);
  return m ? { article: m[1] as ArtikelItem["article"], word: m[2] } : null;
}

/**
 * Karten „der, die, das“ mit den Nomen eines Wortfelds. Steht das Wort in der Artikel-Bank, nimmt die Karte deren
 * Eintrag (derselbe Schlüssel wie im gewöhnlichen Spiel, Fehler von früher kommen wieder); sonst einen eigenen.
 */
export const wortfeldArtikel = (skill: string): Kandidat[] =>
  gemerkt(`a:${skill}`, () => {
    const bank = artikelItems();
    return (wortfeld(skill)?.nomen ?? []).flatMap((n) => {
      const i = nomenItem(n);
      if (!i) return [];
      const ausBank = bank.find((b) => b.word === i.word && !b.meaning);
      if (ausBank && (ausBank.article !== i.article || ausBank.alsoArticle)) return [];
      const item: ArtikelItem = ausBank ?? { ...i, tags: ["Wortfeld"] };
      return [{ karte: artikelKarte(item, bank), stufe: ausBank ? (bankStufe("artikel", ausBank) ?? 1) : 1 }];
    });
  });

/** Ein Verb des Wortfelds als Eintrag in der Form der Präteritum-Bank („… ___ … (schleichen, Präteritum)“). */
export function verbItem([satz, grundform, falsch1, falsch2]: Verb): ClozeItem | null {
  const t = zerlege(satz);
  if (!t) return null;
  return {
    q: `${t.vor}___${t.nach} (${grundform}, Präteritum)`,
    blanks: [[t.wort]],
    solution: `${grundform}: ${t.wort}`,
    hint: "",
    errors: { [falsch1]: "falsche Form", [falsch2]: "falsche Form" },
  };
}

/** Karten „Präteritum“ mit den Verben eines Wortfelds (dieselben Karten wie aus der Präteritum-Bank). */
export const wortfeldPraeteritum = (skill: string): Kandidat[] =>
  gemerkt(`p:${skill}`, () =>
    (wortfeld(skill)?.verben ?? []).flatMap((v) => {
      const item = verbItem(v);
      const karte = item && praeteritumKarte(item);
      return karte ? [{ karte, stufe: 1 as const }] : [];
    }),
  );
