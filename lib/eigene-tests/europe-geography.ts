/**
 * „Test: Europe – Geography“ (niko 2026-11-22, aus seinem claude.ai-Artifact für Max): Englisch, vier Teile, 82 Punkte,
 * empfohlene Zeit 40 Minuten. Fragen, Optionen und Lösungen sind wörtlich übernommen; die Karte liegt in
 * public/spiele/tests/europe-geography/karte.webp (unter spiele/, weil die Schüler-App ohne Anmeldung nur dort Bilder laden darf, proxy.ts). Format: lib/eigene-tests.ts.
 */
import type { EigenerTest } from "../eigene-tests";

const GRENZE = ["Aegean Sea", "Black Sea", "Bosporus", "Caspian Sea", "Caucasus", "Danube", "Dardanelles", "Sea of Marmara", "Ural Mountains", "Ural River", "Adriatic Sea", "Carpathians"];

export const EUROPE_GEOGRAPHY: EigenerTest = {
  key: "europe-geography",
  titel: "Test: Europe – Geography",
  untertitel: "Boundaries · Geology · Landscapes · Population",
  fach: "Geografie",
  sprache: "en",
  minuten: 40,
  bild: { src: "/spiele/tests/europe-geography/karte.webp", alt: "Map of Europe with the Europe–Asia border, numbers 1 to 9 and islands A, B, C", breite: 1600, hoehe: 1216 },
  teile: [
    {
      id: "A",
      titel: "Part A – European boundaries",
      fragen: [
        {
          id: "A1",
          art: "auswahl",
          bild: true,
          titel: "Look at the map. Name the parts of the Europe–Asia border (1–9).",
          optionen: GRENZE,
          items: [
            ["1", "Ural Mountains"],
            ["2", "Ural River"],
            ["3", "Caspian Sea"],
            ["4", "Caucasus"],
            ["5", "Black Sea"],
            ["6", "Bosporus"],
            ["7", "Sea of Marmara"],
            ["8", "Dardanelles"],
            ["9", "Aegean Sea"],
          ],
        },
        {
          id: "A2",
          art: "auswahl",
          titel: "Look at the zoom box on the map. Which Greek islands are A, B and C? (They are geographically part of Asia.)",
          optionen: ["Corfu", "Crete", "Cyprus", "Lesbos", "Rhodes", "Samos"],
          items: [
            ["A", "Lesbos"],
            ["B", "Samos"],
            ["C", "Rhodes"],
          ],
        },
        {
          id: "A3",
          art: "mc",
          titel: "Look at the “?” on the map. Why is the border between Europe and North America not so easy?",
          optionen: ["Because Greenland belongs to Denmark.", "Because Iceland lies directly on the Mid-Atlantic Ridge.", "Because the Atlantic Ocean has no natural border.", "Because Iceland is not a member of the EU."],
          richtig: 1,
        },
        {
          id: "A4",
          art: "mc",
          titel: "Why is the border between Europe and Asia only a “convention”?",
          optionen: ["Because the Ural Mountains are too low to be a real border.", "Because Russia and Turkey do not accept it.", "Because in fact there is only one continent: Eurasia.", "Because the border moves every year."],
          richtig: 2,
        },
        {
          id: "A5",
          art: "mehrfach",
          titel: "Which countries lie on both continents (Europe and Asia)? Tick three.",
          optionen: ["Russia", "Ukraine", "Turkey", "Greece", "Kazakhstan", "Iran"],
          richtige: [0, 2, 4],
        },
        {
          id: "A6",
          art: "auswahl",
          titel: "These territories belong to European countries. On which continent do they lie?",
          optionen: ["Africa", "Asia", "North America", "South America"],
          items: [
            ["Madeira (Portugal)", "Africa"],
            ["Canary Islands (Spain)", "Africa"],
            ["Réunion (France)", "Africa"],
            ["Falkland Islands (Great Britain)", "South America"],
            ["French Guiana (France)", "South America"],
          ],
        },
        {
          id: "A7",
          art: "mehrfach",
          titel: "The border between Europe and Africa is easy – except for some islands. Which ones? Tick three.",
          optionen: ["Sicily", "Malta", "Sardinia", "Lampedusa", "Crete", "Pantelleria"],
          richtige: [1, 3, 5],
        },
        {
          id: "A8",
          art: "luecken",
          titel: "Fill in the gap.",
          text: "In French Guiana, the European Space Agency launches its {0} rockets.",
          luecken: [["Ariane"]],
        },
        {
          id: "A9",
          art: "offen",
          punkte: 2,
          titel: "Natural borders are located at rivers, mountain ranges or seas. Why can even “natural” borders be criticised? Answer in 1–2 sentences.",
          muster:
            "Even natural borders are only an **agreement** (a convention) made by people. Nature does not “decide” where a continent ends – e.g. the border lines in the Caspian Sea and the Black Sea are highly controversial.",
        },
      ],
    },
    {
      id: "B",
      titel: "Part B – Geology",
      fragen: [
        {
          id: "B1",
          art: "auswahl",
          titel: "Put the parts of European geology in the right order: 1 = oldest, 4 = youngest.",
          optionen: ["1", "2", "3", "4"],
          items: [
            ["Variscan Orogeny", "3"],
            ["Baltic Shield / East European Platform", "1"],
            ["Alpine Orogeny", "4"],
            ["Caledonian Orogeny", "2"],
          ],
        },
        {
          id: "B2",
          art: "luecken",
          titel: "Fill in the gaps.",
          text: "The oldest parts of European geology are about {0} billion years old. They are found at the Baltic {1} and the East European {2}. In these areas there are a lot of raw materials, for example oil, gas, coal and {3}.",
          luecken: [["3", "three"], ["Shield"], ["Platform"], ["ores", "ore", "iron ore", "erze"]],
        },
        {
          id: "B3",
          art: "mc",
          titel: "What is the English term for “Rumpfgebirge”?",
          optionen: ["fold mountain range", "fault residual plateau", "average mountains", "basin and foreland"],
          richtig: 1,
        },
        {
          id: "B4",
          art: "auswahl",
          titel: "In which mountain building were these mountains formed?",
          optionen: ["Caledonian Orogeny", "Variscan Orogeny", "Alpine Orogeny"],
          items: [
            ["Alps", "Alpine Orogeny"],
            ["Mountains in Scandinavia and on the British Isles", "Caledonian Orogeny"],
            ["Central Germany, North Bohemia", "Variscan Orogeny"],
            ["Caucasus, Balkan Mountains", "Alpine Orogeny"],
          ],
        },
        {
          id: "B5",
          art: "rf",
          titel: "True or false?",
          items: [
            ["The Alpine Orogeny started about 100 million years ago and is already finished.", false],
            ["The Caledonian mountains are strongly eroded because they are very old.", true],
            ["Europe got its “face” mainly during the glacial periods, when large parts were covered with ice.", true],
          ],
        },
      ],
    },
    {
      id: "C",
      titel: "Part C – Landscapes of Europe",
      fragen: [
        {
          id: "C1",
          art: "auswahl",
          titel: "Which landscape type is described?",
          optionen: ["Hill countries and plates", "Average mountains", "High mountains", "Basins and forelands", "Plains"],
          items: [
            ["Lowerings of the Earth's crust that look like bowls, framed by mountains, mild climate.", "Basins and forelands"],
            ["At least 2000 m high, large differences in relief, fissured look.", "High mountains"],
            ["Strongly eroded, little difference in relief – e.g. on the Baltic Shield; skerries in Scandinavia.", "Hill countries and plates"],
            ["Filled with sediments up to 6000 m thick; rivers form meanders.", "Plains"],
            ["1500–1800 m high, gentle forms, often wooded.", "Average mountains"],
          ],
        },
        {
          id: "C2",
          art: "luecken",
          titel: "Fill in the numbers.",
          text: "Average mountains are {0} – {1} m high. High mountains reach at least {2} m.",
          luecken: [
            ["1500", "1.500", "1,500"],
            ["1800", "1.800", "1,800"],
            ["2000", "2.000", "2,000"],
          ],
        },
        {
          id: "C3",
          art: "mc",
          titel: "Why were the average mountains (Mittelgebirge) not shaped as sharply as the high mountains?",
          optionen: ["Because they were not covered with ice in the ice age.", "Because they are made of sand.", "Because they are younger than the Alps.", "Because there is no rain there."],
          richtig: 0,
        },
        {
          id: "C4",
          art: "mc",
          titel: "What problem do areas like the Waldviertel have?",
          optionen: ["Too many tourists come every winter.", "After mining ended, many young people leave the region.", "The rivers there form too many meanders.", "They are flooded by the sea."],
          richtig: 1,
        },
        {
          id: "C5",
          art: "mc",
          titel: "How did the high mountain regions get richer?",
          optionen: ["Through coal mining in the 19th century.", "Through big farms in the valleys.", "Through tourism, especially after the Second World War.", "Through oil and gas."],
          richtig: 2,
        },
        {
          id: "C6",
          art: "mc",
          titel: "What are skerries (Schären)?",
          optionen: ["Little rock humps in the seawater, formed by glaciers.", "Deep valleys in the Alps.", "Rivers with many bends.", "Volcanoes on Iceland."],
          richtig: 0,
        },
        {
          id: "C7",
          art: "offen",
          punkte: 2,
          titel: "Explain why basins are very suitable for agriculture. Answer in 1–2 sentences.",
          muster: "Basins are filled with **sediments** (fertile soil) of seas or rivers. They are **framed by mountains** and lie **lower**, so they have a **mild climate**.",
        },
        {
          id: "C8",
          art: "offen",
          punkte: 2,
          titel: "Why do rivers in plains form meanders? Answer in 1–2 sentences.",
          muster: "Plains have only a **very little downward slope**, so rivers flow slowly and wind back and forth (meanders).",
        },
      ],
    },
    {
      id: "D",
      titel: "Part D – Population of Europe",
      fragen: [
        {
          id: "D1",
          art: "rf",
          titel: "True or false?",
          items: [
            ["Europe is the second-smallest continent by surface area.", true],
            ["Europe is the second most populous continent.", false],
            ["Europe is the second most densely populated continent.", true],
            ["Europe's population is growing fast – about 3 % per year.", false],
            ["Fertility rates in most European countries are below the replacement level.", true],
            ["The population of the EU is expected to peak in 2040.", true],
          ],
        },
        {
          id: "D2",
          art: "luecken",
          titel: "Fill in the numbers.",
          text: "Europe covers about {0} million km². In 2016, about {1} million people lived in Europe. Russia's population is expected to drop from 143 million to {2} million by 2050. Europe will lose {3} million people of working age by 2050.",
          luecken: [["10.18", "10,18", "10.2", "10,2", "10"], ["738"], ["107"], ["30"]],
        },
        {
          id: "D3",
          art: "mehrfach",
          titel: "Which of the top 10 most populous countries are NOT declining? Tick three.",
          optionen: ["Germany", "France", "Italy", "United Kingdom", "Spain", "Kazakhstan"],
          richtige: [1, 3, 5],
        },
        {
          id: "D4",
          art: "mc",
          titel: "Which country has the sharpest expected population decline according to the text?",
          optionen: ["Germany (−19 %)", "Lithuania (−20 %)", "Bulgaria (−27 %)", "Latvia (−26 %)"],
          richtig: 2,
        },
        {
          id: "D5",
          art: "auswahl",
          titel: "Least populous countries: match the country to its population.",
          optionen: ["about 800", "33,000", "331,000", "876,000"],
          items: [
            ["Vatican City", "about 800"],
            ["San Marino", "33,000"],
            ["Iceland", "331,000"],
            ["Cyprus", "876,000"],
          ],
        },
        {
          id: "D6",
          art: "mc",
          titel: "Why is Russia's population “hard to determine”?",
          optionen: ["Because Russia has no census.", "Because Russian and CIA estimates differ by 3 million.", "Because half of Russia lies in Asia.", "Because the population grows too fast."],
          richtig: 1,
        },
        {
          id: "D7",
          art: "offen",
          punkte: 3,
          titel: "Explain in 2–3 sentences why Europe's population is getting older and smaller.",
          muster:
            "Fertility rates are **below replacement level** (fewer than about 2.1 children per woman) – many women have fewer children in favour of a **career**. At the same time people live longer: the number of people in their **80s and 90s** rises dramatically, while Europe loses **working-age** people (30 million by 2050).",
        },
      ],
    },
  ],
};
