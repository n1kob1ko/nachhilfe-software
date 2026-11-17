/**
 * Die Sätze des Lernspiels „Stilmittel“ (niko 2026-11-17: „es sollen sätze kommen und man soll auswählen was das für
 * ein stilmittel ist“), von Hand geschrieben, ohne KI. Je Stilmittel ein Text, eine Zeile ein Satz:
 *
 * - `[…]` markiert die Stelle mit dem Stilmittel (sie ist im Spiel angestrichen). Ohne Klammern ist der ganze Satz
 *   angestrichen (Anapher, Parallelismus, Chiasmus: das Stilmittel ist der Bau des ganzen Satzes).
 * - ` || ` danach: Stilmittel, die in diesem Satz AUCH stecken. Sie kommen nie als falsche Antwort vor (sonst wäre eine
 *   richtige Antwort falsch). Was in einem Stilmittel meistens mitsteckt, steht schon in lib/stilmittel.ts (`auch`).
 * - `# schwer` trennt die klaren Beispiele (Stufe 1) von den schwereren (Stufe 2).
 *
 * Neue Sätze: genau EIN Stilmittel muss eindeutig drinstecken, alle anderen, die man darin finden könnte, gehören
 * hinter ` || `. lib/stilmittel.test.ts prüft die Form (doppelte Sätze, Klammern, Namen).
 */
import type { StilmittelId } from "./stilmittel";

export const STILMITTEL_SAETZE: Record<StilmittelId, string> = {
  vergleich: `Mein Bruder ist [stark wie ein Bär].
Sie lief [schnell wie der Blitz] nach Hause.
Das Wasser im See war [kalt wie Eis].
Seine Augen leuchteten [wie zwei Sterne].
Der Kuchen war [süß wie Honig].
Nach der Wanderung schlief er [wie ein Murmeltier].
Die Wolken sahen aus [wie Zuckerwatte].
Mein Hund ist [treu wie Gold].
Bei der Prüfung war er [stumm wie ein Fisch].
Meine kleine Schwester singt [wie eine Nachtigall].
Mein Zimmer sah aus, [als hätte ein Sturm darin gewütet].
# schwer
Vor Schreck stand er da [wie angewurzelt].
Am Sonntag lag die Stadt [wie ausgestorben] vor uns.
[Wie ein Lauffeuer] verbreitete sich die Nachricht in der Schule.
Die Ferien vergingen [wie im Flug].
Ihre Stimme klang [wie das Läuten kleiner Glocken].`,

  personifikation: `[Der Wind flüstert] in den Bäumen.
[Die Sonne lacht] vom Himmel.
[Die Blumen tanzen] im Wind.
[Die Stadt schläft] noch.
[Die Zeit rennt] davon.
[Das Meer schläft] heute ganz ruhig.
[Der Mond schaut] neugierig durchs Fenster herein.
[Mein Handy weigert sich], noch einmal anzugehen.
[Die Bäume strecken ihre Arme] in den Himmel.
[Der Wecker schreit] mich jeden Morgen an.
[Der alte Stuhl stöhnt] unter mir. || Lautmalerei
# schwer
[Die Nacht legte sich] leise über das Dorf.
[Die Angst kroch] ihm langsam den Rücken hinauf.
[Der Herbst malt] die Blätter bunt an.
[Das Glück lächelte] ihr an diesem Tag zu.
[Der Regen trommelt] ans Fenster. || Lautmalerei`,

  metapher: `Mein Opa ist [ein alter Fuchs], ihn kann man nicht reinlegen.
Unsere Nachbarin hat [ein Herz aus Gold].
Lisa ist [ein richtiger Bücherwurm].
Beim Basteln habe ich [zwei linke Hände].
Unsere Tormannin ist [eine Wand], an ihr kommt keiner vorbei.
Mein Bruder ist [ein echter Angsthase].
Die Mathe-Schularbeit war [eine harte Nuss].
Er war immer [das schwarze Schaf] der Familie.
Heute stehe ich total [auf der Leitung].
Unser Lehrer hat [Adleraugen], ihm entgeht kein Schummelzettel.
Mit seinem Kommentar goss er nur [Öl ins Feuer].
# schwer
Meine Oma genießt ihren [Lebensabend] am Land.
In ihm brannte [das Feuer der Begeisterung].
„[Zeit ist Geld]“, sagt mein Vater jeden Morgen.
Nach dem Streit gab es endlich [einen Silberstreif am Horizont].
Sie [ertrinkt in Arbeit]. || Hyperbel`,

  lautmalerei: `Die Biene [summt] um die Blume.
„[Kikeriki!]“, kräht der Hahn.
Mit einem lauten [Platsch] fiel der Stein ins Wasser.
Das Feuer [knistert] im Kamin.
Die Schlange [zischt] gefährlich.
„[Tick, tack]“, macht die Uhr an der Wand.
Der Hund [knurrt] den Briefträger an.
Mit einem [Peng] platzte der Luftballon.
Der Bach [plätschert] durch den Wald.
Mit einem [Rums] fiel die Tür ins Schloss.
Auf der Weide machen die Kühe [muh].
# schwer
Der Kies [knirschte] unter unseren Schuhen.
Im hohen Gras [zirpen] die Grillen.
Das trockene Laub [raschelt] bei jedem Schritt.
[Klirrend] zerbrach das Glas auf dem Boden.
Der Donner [grollte] über dem Tal.`,

  alliteration: `[Milch macht müde Männer munter].
[Fischers Fritz fischt frische Fische].
Wir gehen bei [Wind und Wetter] spazieren.
Die Familie kam mit [Kind und Kegel] zum Fest.
Im Beet [blühen bunte Blumen].
[Kleine Kinder kichern] im Kindergarten.
Am Sonntag gibt es bei Oma [Kaffee und Kuchen].
Er kämpfte mit [Haut und Haaren] um den Sieg.
[Max mag Mangos] am liebsten.
Die [wilden Wellen warfen] das Boot hin und her.
# schwer
Mit [Mann und Maus] ging das Schiff unter.
Nach dem Marathon war sie [fix und fertig].
Sie liefen über [Stock und Stein] durch den Wald.
Das Fest war [ganz und gar] gelungen.
„[Super, sagenhaft, sensationell]!“, rief der Moderator. || Klimax, Hyperbel, Ellipse`,

  hyperbel: `Ich habe dir das schon [tausendmal] gesagt!
Ich bin so hungrig, ich könnte [einen ganzen Elefanten] essen.
Wir haben [eine Ewigkeit] auf den Bus gewartet.
Mein Rucksack wiegt [eine Tonne].
Bei dem Film bin ich [fast gestorben] vor Lachen.
Vor der Kassa stand eine [kilometerlange] Schlange.
Meine Schwester braucht [hundert Jahre] im Bad.
Die Deutschstunde war heute [todlangweilig].
Er schreit so laut, dass man ihn [in ganz Wien] hört.
Bis zum Wochenende vergehen noch [Jahrhunderte].
# schwer
Nach der Party hatte ich [Berge von] Geschirr zu spülen. || Metapher
Sie weinte [ein Meer von Tränen]. || Metapher
Das Konzert war [der beste Abend meines ganzen Lebens].
Vor lauter Aufregung habe ich [keine Sekunde] geschlafen.
In meinem Zimmer liegen [Millionen] Legosteine herum.`,

  rhetorisch: `[Wer will schon verlieren?]
[Wie oft soll ich dir das noch sagen?]
[Wer hätte das gedacht?]
[Was gibt es Schöneres als Ferien?]
[Wer mag denn keine Schokolade?]
[Wer möchte nicht gesund sein?]
[Was wäre die Welt ohne Musik?]
[Haben wir nicht alle schon einmal geschwindelt?]
[Bin ich etwa dein Diener?] || Ironie
[Seit wann ist Pünktlichkeit eine Schwäche?]
# schwer
„[Sollen wir wirklich zuschauen, wie der Regenwald verschwindet?]“, fragte die Rednerin.
[Wer, wenn nicht wir, soll die Umwelt schützen?]
[Ist es nicht seltsam, wie schnell wir uns an Handys gewöhnt haben?]
[Brauchen wir wirklich noch ein neues Handy?]
„[Wer von uns hat nicht schon einmal Angst gehabt?]“, fragte der Trainer vor dem Finale.`,

  anapher: `Ich hoffe, ich warte, ich glaube an dich.
Wir lachen, wir singen, wir tanzen.
Jeder kann helfen, jeder kann etwas tun.
Das Wasser rauscht', das Wasser schwoll.
Mit dir lache ich, mit dir weine ich.
Alle reden, alle streiten, alle wissen es besser.
Heute lernen wir, heute üben wir, heute schaffen wir es.
Ich will frei sein, ich will laut sein, ich will ich sein.
Wir fordern mehr Radwege. Wir fordern saubere Luft.
Nie wieder Streit, nie wieder Lügen.
# schwer
Er kam zu spät, er vergaß das Heft, er verlor den Schlüssel.
Kein Wort, kein Blick, kein Gruß.
Zu spät, zu laut, zu wenig.
Vielleicht morgen, vielleicht nie. || Antithese
Wer lernt, gewinnt. Wer übt, wird besser.`,

  ironie: `„[Na super!]“, sagt Lea, als es am Wandertag in Strömen regnet.
„[Du bist ja heute wieder pünktlich]“, sagt die Lehrerin zum Schüler, der eine halbe Stunde zu spät kommt.
„[Toll gemacht!]“, sagt Papa, als die Vase am Boden liegt. || Ellipse
„[Das hast du ja wunderbar hinbekommen]“, sagt Mama zum verbrannten Kuchen.
„[Schönes Wetter heute]“, sagt Tom, während draußen ein Sturm tobt. || Ellipse
„[Ich liebe es], um sechs Uhr früh aufzustehen“, gähnt Max.
„[Sehr ordentlich]“, sagt Oma beim Blick in mein chaotisches Zimmer. || Ellipse
„[Danke für die tolle Hilfe]“, sagt Ben zu seinem Bruder, der nur zugeschaut hat. || Ellipse
„[Das ist ja eine schöne Überraschung]“, sagt Lisa, als sie den Fleck auf ihrem neuen Pulli entdeckt.
„[Du bist ja ein echter Frühaufsteher]“, sagt Mama, als ich zu Mittag aus dem Bett komme.
# schwer
Nach der Fünf in Mathe sagt Paul: „[Da werden sich meine Eltern aber freuen.]“
„[Wir haben ja Zeit]“, sagt der Busfahrer, als sich der Stau nicht bewegt.
„[Großartig], jetzt ist auch noch der Akku leer.“ || Ellipse
„[Wie praktisch]“, murmelt Anna, als der Lift genau in den Ferien kaputtgeht. || Ellipse`,

  antithese: `Der Mensch [denkt], Gott [lenkt].
Ich bin [arm], du bist [reich].
Die einen [weinen], die anderen [lachen].
Was gestern [Freude] war, ist heute [Leid].
Er spricht von [Frieden], aber er plant [Krieg].
Sie ist [laut], ihr Bruder ist [leise].
[Jung und Alt] feierten zusammen.
Der eine [gewinnt], der andere [verliert].
Heute [rot], morgen [tot]. || Ellipse
Im Sommer ist es [heiß], im Winter [eiskalt]. || Ellipse
# schwer
„Was dieser [heute baut], reißt jener [morgen ein].“ (Andreas Gryphius)
„[Sein oder Nichtsein], das ist hier die Frage.“ (Shakespeare)
Draußen [Sturm], drinnen [Stille]. || Ellipse
[Klein] ist das Haus, [groß] ist das Herz seiner Bewohner. || Inversion
Auf [Regen] folgt [Sonnenschein].`,

  klimax: `Er war [müde, erschöpft, völlig am Ende].
Das Essen war [gut, sehr gut, einfach himmlisch].
Ich [bitte, flehe, beschwöre] dich!
Es [tropfte, regnete, schüttete].
Er [schmunzelte, lachte, brüllte] vor Lachen.
Sie [flüsterte, sprach, schrie].
Er [ging, rannte, raste] zum Bahnhof.
Das Spiel war [spannend, aufregend, atemberaubend].
Sie war [zufrieden, glücklich, überglücklich].
Zuerst [ärgerte] sie sich, dann [tobte] sie, am Ende [explodierte] sie.
# schwer
Aus [Sekunden] wurden [Minuten], aus [Minuten] wurden [Stunden].
Erst [ein Funke], dann [eine Flamme], dann [ein Feuer].
Es ging um [Hunderte, Tausende, Millionen] Euro.
[Eine Stunde, ein Tag, ein Leben.]`,

  parallelismus: `Der Himmel ist blau, die Sonne ist warm.
Die Kinder spielen im Garten, die Eltern sitzen auf der Terrasse.
Ich lese ein Buch, du hörst Musik.
Mama kocht das Essen, Papa deckt den Tisch.
Lea spielt Klavier, Tim spielt Gitarre.
Der Morgen war kalt, der Abend war warm.
Sie öffnete die Tür, er schloss das Fenster.
Das Auto ist schnell, das Fahrrad ist langsam.
Im Garten blühen Rosen, im Wald wachsen Pilze.
Der Hund bellt laut, die Katze faucht wild. || Lautmalerei
# schwer
Schnell kam die Nacht, leise fiel der Schnee. || Inversion
Wir kamen zu spät, wir fanden keinen Platz.
Die Lehrerin erklärt geduldig, die Klasse hört aufmerksam zu.
Der Zug fährt ab, der Bahnsteig wird leer.
Oben stand die Burg, unten lag das Dorf. || Inversion`,

  ellipse: `[Ende gut, alles gut.]
[Hände hoch!]
[Je früher, desto besser.]
[Kein Wort mehr!]
„[Und dann?]“, fragte Lena gespannt.
[Was nun?]
[Achtung, Stufe!]
„[Wohin so schnell?]“, rief der Nachbar.
[Auf die Plätze, fertig, los!]
„Noch ein Stück Kuchen?“ – „[Gern!]“
# schwer
Er öffnete die Tür. [Niemand da.]
[Mehr Licht!]
„[Alles klar bei dir?]“, schrieb sie ihm.
Wir warteten und warteten. [Keine Spur vom Bus.]
[Je mehr, desto lieber.]`,

  euphemismus: `Opa ist letzte Nacht [für immer eingeschlafen].
Die Firma hat fünfzig Mitarbeiter [freigesetzt].
Mein Onkel sagt, er sei [vollschlank].
Ab Jänner werden die Preise [angepasst].
Unsere Oma ist im Frühling [von uns gegangen].
Wo ist hier [das stille Örtchen]?
Nach dem Spiel sagte der Trainer, die Mannschaft habe [noch Luft nach oben].
Mein Zeugnis ist [ausbaufähig].
Der alte Hund ist schon [in die Jahre gekommen].
Der Dieb meinte, er habe sich das Fahrrad nur [ausgeborgt].
# schwer
Bei dem Angriff gab es auch [Kollateralschäden].
Die Lehrerin nennt meine Schrift [sehr individuell].
Die Regierung spricht von [Nullwachstum].
Das Essen in der Kantine ist [gewöhnungsbedürftig].
Der Hotelprospekt nennt das winzige Zimmer [gemütlich].`,

  oxymoron: `Der Abschied von der Klasse war [bittersüß].
Mein Nachbar ist ein [alter Knabe].
Nach dem Knall herrschte [ohrenbetäubende Stille].
Dass die beiden verliebt sind, ist ein [offenes Geheimnis].
Zwischen den Brüdern herrscht eine echte [Hassliebe].
Mein Onkel ist ein [liebenswertes Ekel].
Das Warten auf die Ferien war eine [süße Qual].
Ihr Blick war ein [stummer Schrei].
Mit seinen zwölf Jahren wirkt er wie ein [junger Greis].
# schwer
Auf die Frage folgte [beredtes Schweigen].
Im Stall stand ein [schwarzer Schimmel].
Die Prüfung war eine [wunderbare Katastrophe].
Er gab ihr einen [freundlichen Fußtritt]. || Ironie`,

  chiasmus: `Die Kunst ist lang, und kurz ist unser Leben.
Wir essen, um zu leben, und leben nicht, um zu essen.
Groß war der Plan, die Mittel waren klein.
Hell war der Tag, die Nacht war dunkel.
Der Weg ist weit, kurz ist die Zeit.
Laut war die Musik, die Gäste waren leise.
Kalt war der Winter, der Sommer war heiß.
Nass war das Gras, die Luft war mild.
Äpfel esse ich gern, ich esse keine Birnen.
# schwer
„[Eng ist die Welt, und das Gehirn ist weit.]“ (Friedrich Schiller)
„[Schön ist hässlich, hässlich schön.]“ (Shakespeare, Macbeth) || Paradoxon, Oxymoron
Spät kam er heim, er ging früh fort.`,

  epipher: `Ich bin müde, du bist müde, alle sind müde.
Er hat gelogen, sie hat gelogen, alle haben gelogen.
Die Bühne ist bereit, das Publikum ist bereit, wir sind bereit.
Ich will Frieden, du willst Frieden, alle wollen Frieden.
Mama lacht, Papa lacht, sogar Oma lacht.
Du bist schuld, er ist schuld, ich bin schuld.
Heute regnet es, morgen regnet es, das ganze Wochenende regnet es.
# schwer
Wir fahren ans Meer, die Nachbarn fahren ans Meer, die ganze Straße fährt ans Meer.
Sie sucht ihr Glück, er sucht sein Glück, jeder sucht sein Glück.
Die Bäume sind gefallen, die Häuser sind gefallen, alle Hoffnung ist gefallen.`,

  litotes: `Das Referat war [nicht schlecht].
Der Mann ist hier [kein Unbekannter].
Das Essen war [nicht übel].
Mein Cousin ist [nicht gerade klein].
Die Aufgabe war [nicht ohne].
Das ist [keine schlechte] Idee.
Die Familie hat [nicht wenig] Geld.
Bei der Party hatten wir [nicht wenig] Spaß.
# schwer
Die Klettertour war [nicht ganz ungefährlich].
Bis zur Schule ist es [nicht gerade nah].
Der Test war [kein Kinderspiel]. || Metapher
Beim Laufen ist er [nicht der Schnellste]. || Euphemismus`,

  inversion: `[Groß war] die Freude.
[Kalt war] die Nacht und dunkel. || Ellipse
[Verloren war] das Spiel schon nach zehn Minuten.
[Ein Held war] er nie.
[Gelacht hat] an diesem Abend keiner.
[Schwer war] der Abschied von der Klasse.
[Unglaublich war], was wir dort sahen.
[Geschafft haben] wir es trotzdem.
# schwer
[Den Schlüssel] fand sie erst am Abend.
[Still ruht] der See.
[Müde waren] wir, aber glücklich. || Ellipse, Antithese`,

  synaesthesie: `Sie trug ein Kleid in [schreiendem Rot].
Der Sänger hat eine [warme Stimme].
Das Zimmer war in [kühles Blau] getaucht.
Die Wand ist in einem [lauten Gelb] gestrichen.
Aus der Küche kam ein [warmer Duft] nach Zimt.
Der Song hatte einen [dunklen Klang].
Er sprach mit [samtweicher Stimme].
Die Flöte spielte [süße Töne].
# schwer
In der Luft lag ein [scharfer Geruch].
Ihr [helles Lachen] füllte den Raum.
Das Bild war in [ruhigen Farben] gemalt.
Der Geiger spielte einen [goldenen Ton].`,

  metonymie: `Ich lese gerade [Goethe].
Wollen wir noch [ein Glas] trinken?
[Das ganze Stadion] jubelte.
Er hat [einen Picasso] im Wohnzimmer hängen.
Ich höre gerne [Mozart].
[Die ganze Schule] freut sich auf die Ferien.
[Das Rathaus] hat die Straße gesperrt.
# schwer
[Das Weiße Haus] gab eine Erklärung ab.
[Brüssel] hat ein neues Gesetz beschlossen.
[Die Krone] unterschrieb den Vertrag.
[Ganz Österreich] fieberte beim Finale mit.`,

  paradoxon: `[Weniger ist mehr.]
„[Ich weiß, dass ich nichts weiß.]“ (Sokrates)
[Eile mit Weile.]
[Je mehr ich lerne, desto weniger weiß ich.]
[Das einzig Beständige ist der Wandel.]
[Ich bin so müde, dass ich nicht schlafen kann.]
[Das ist so schlecht, dass es schon wieder gut ist.]
[Wer langsam fährt, kommt schneller an.]
# schwer
[Wer sein Leben retten will, wird es verlieren.]
[Die einzige Regel ist, dass es keine Regeln gibt.]
[Nichts ist so sicher wie die Unsicherheit.]`,

  wiederholung: `Er lief [und lief und lief], bis er nicht mehr konnte.
Das Wasser stieg [und stieg und stieg].
Sie las den Brief [wieder und wieder].
Er wartete [Stunde um Stunde] am Bahnsteig.
Der Weg führte [weiter und weiter] in den Wald hinein.
Wir gingen [Schritt für Schritt] den Berg hinauf.
[Tag für Tag] saß die alte Frau auf der Bank vor dem Haus.
Der Zug fuhr [weiter, immer weiter] nach Norden. || Klimax
# schwer
Er hatte [Angst, große Angst], dass man ihn erwischen würde. || Klimax
Die Nacht war [still, so still], dass man den eigenen Atem hörte. || Klimax
Er arbeitete [Jahr um Jahr] in derselben Fabrik, ohne je zu klagen.
Das Telefon läutete [noch einmal und noch einmal], doch keiner hob ab.`,

  aufzaehlung: `Im Rucksack lagen [Brot, Käse, Äpfel und eine Flasche Wasser].
Auf dem Markt gab es [Tomaten, Gurken, Paprika und Zwiebeln].
Sie packte [Handtuch, Sonnencreme, Buch und Badeanzug] ein.
In seinem Zimmer lagen [Socken, Hefte, Kabel und leere Flaschen] herum.
Zum Geburtstag kamen [Tante Anna, Onkel Fritz, die Großeltern und zwei Nachbarn].
Im Wald hörten wir [Vögel, Wind, raschelnde Blätter und einen Bach].
Für die Schule braucht er [Stifte, ein Lineal, einen Zirkel und einen Taschenrechner].
Auf dem Tisch standen [Teller, Gläser, Kerzen und Blumen].
# schwer
Er dachte an [die Rechnungen, den Streit mit dem Chef, die kranke Mutter und das kaputte Auto].
[Lachen, Musik, Stimmen, klirrende Gläser] drangen aus dem Saal.
Sie erzählte von [der Reise, dem Hotel, dem Essen und dem Wetter], nur nicht von ihm.
In der Küche stapelten sich [Töpfe, Pfannen, Teller und Tassen].`,

  parataxe: `[Der Zug hielt. Die Türen öffneten sich. Keiner stieg aus.]
[Sie öffnete die Tür. Der Flur war leer. Niemand antwortete.]
[Es war kalt. Der Bus kam nicht. Sie fror.]
[Das Telefon klingelte. Er hob nicht ab. Es klingelte wieder.]
[Der Hund bellte. Ein Fenster ging auf. Dann war es still.]
[Sie rannte los. Der Regen wurde stärker. Ihre Schuhe waren nass.]
[Die Ampel sprang auf Grün. Niemand fuhr los. Hinten hupte jemand.]
[Der Lehrer kam herein. Es wurde still. Alle sahen zu Boden.]
# schwer
[Sie sagte nichts. Er sagte nichts. Der Kaffee wurde kalt.]
[Die Mutter rief. Das Kind kam nicht. Sie rief noch einmal.]
[Der Arzt kam, sah ihn an, schüttelte den Kopf.] || Ellipse
[Er stand am Fenster. Autos fuhren vorbei. Er dachte an sie.]`,

  hypotaxe: `[Obwohl sie wusste, dass er nicht kommen würde, wartete sie.]
[Als er merkte, dass niemand ihm glaubte, weil er schon so oft gelogen hatte, schwieg er.]
Er erzählte, [dass er den Hund, der im Hof bellte, schon seit Jahren kannte].
[Weil es regnete, als wir ankamen, blieben wir im Auto, bis der Regen aufhörte.]
[Nachdem sie den Brief gelesen hatte, den ihr die Mutter geschickt hatte, weinte sie.]
Sie fragte sich, [ob er wohl wusste, wie sehr sie ihn vermisste].
[Wenn du mir sagst, was passiert ist, kann ich dir helfen, damit es nicht wieder geschieht.]
[Der Mann, der jeden Morgen am Kiosk stand, weil er sonst niemanden hatte, mit dem er reden konnte, fehlte heute.]
# schwer
[Dass sie ging, ohne sich zu verabschieden, obwohl sie es versprochen hatte, verstand er nicht.]
[Während die anderen schliefen, saß er wach und dachte darüber nach, ob es richtig gewesen war, dass er geschwiegen hatte.]
[Bevor er antworten konnte, weil ihm die Worte fehlten, die er sich zurechtgelegt hatte, war sie schon fort.]
[Er wusste nicht, ob sie ihn gesehen hatte, als er an dem Haus vorbeiging, in dem sie früher gewohnt hatten.]`,

  symbol: `Am Grab brannte eine [Kerze] als Zeichen der Hoffnung.
Über der Stadt flog eine [weiße Taube], als der Krieg endlich vorbei war.
Nach dem Streit lag ihr [Ehering] auf dem Küchentisch.
Sie trug [Schwarz], seit ihr Mann gestorben war. || Metonymie
Zum Abschied schenkte er ihr eine [rote Rose].
Am Ende der Geschichte steht über dem zerstörten Dorf ein [Regenbogen].
Der alte Mann saß vor der [stehengebliebenen Uhr] seiner verstorbenen Frau.
Die Gefangenen sahen jeden Tag nur die [hohe Mauer] vor ihrem Fenster.
# schwer
Als sie das Elternhaus verließ, fiel hinter ihr die [Tür] ins Schloss.
Mitten im kahlen Winterwald blühte [eine einzige Blume].
Er stand an einer [Weggabelung] und wusste nicht, wohin. || Ellipse
Im ganzen Haus war es dunkel, nur in ihrem Zimmer brannte noch [ein Licht]. || Antithese`,
};
