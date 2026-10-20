/**
 * Eigene Texte für die Formate der Englisch-Matura (lib/englisch-matura.ts): Lesetexte mit Aussagen, Fragen,
 * Überschriften, Satzenden und Kurzfragen, Lückentexte für Language in Use und Schreibaufträge mit Mustertexten.
 *
 * Alles hier ist selbst geschrieben, für diese App. Personen, Orte, Schulen und Medien sind erfunden. Nichts ist aus
 * dem Aufgabenpool, aus Maturen, aus Schulbüchern oder vom IQS übernommen, auch nicht verändert; nur die Form der
 * Aufgaben folgt der Matura. Niveau B1 oder B2.
 *
 * Schreibweisen in den Lückentexten: {since|as} ist eine Lücke mit den Wörtern, die passen; bei Word Formation
 * {solution:SOLVE} (Lösung und Grundwort, mehrere Lösungen mit /); bei Editing {been} das Wort, das zu viel ist.
 */

export type Niveau = "B1" | "B2";

export type Lesetext = {
  id: string;
  niveau: Niveau;
  titel: string;
  absaetze: string[];
  /** True or False: der Beleg ist ein ganzer Satz aus dem Text, Wort für Wort. */
  wahrFalsch: { aussage: string; wahr: boolean; beleg: string }[];
  /** Multiple Choice: die erste Antwort ist die richtige (gemischt wird beim Erzeugen). */
  fragen: { frage: string; antworten: [string, string, string, string] }[];
  /** je Absatz die passende Überschrift, in der Reihenfolge der Absätze */
  ueberschriften: string[];
  /** Überschriften, die zu keinem Absatz passen */
  ueberschriftenExtra: string[];
  satzenden: { anfang: string; ende: string }[];
  /** Satzenden, die zu keinem Anfang passen */
  satzendenExtra: string[];
  /** Short Answers: alle Antworten, die sicher stimmen, je höchstens vier Wörter */
  kurz: { frage: string; antworten: string[] }[];
};

export const LESETEXTE: Lesetext[] = [
  {
    id: "repair-cafe",
    niveau: "B1",
    titel: "The Repair Café on Mill Street",
    absaetze: [
      "Every second Saturday, the old bakery on Mill Street in Lindenfeld fills with broken things. People carry in lamps, toasters, bicycles and jackets with missing buttons. They are not there to throw them away. They come to the Repair Café, where volunteers help them fix their things for free.",
      "The idea came from Hanna Petrek, a retired science teacher. Three years ago her coffee machine stopped working, and the shop told her that a repair would cost more than a new machine. “I was sure that the problem was something small,” she says. She opened the machine at her kitchen table and found a loose cable. A week later, she put up a notice in the library and asked if anyone wanted to help her start a repair café.",
      "Today, about fifteen volunteers take part. Most of them are older people who have repaired things all their lives, but there are young helpers, too. Lukas, who is seventeen, joined last year. “At first I was afraid of breaking something,” he admits. “Now I can fix a radio on my own, and I've learned more about electronics than I ever expected.”",
      "A visit is simple. You write your name on a list at the door and wait with a cup of coffee until a volunteer is free. Then you sit down together and look at the problem. The owners are not allowed to leave and come back later: they have to stay and help, so that they learn something too. Not every repair works. About one in three things cannot be fixed, usually because the right parts are no longer sold.",
      "The café does not charge anything, but most visitors leave a small donation. The money pays for tools and coffee. The town council has noticed the project and has offered the café a larger room in the library from next spring. “For many people it's not only about saving money,” Hanna says. “They meet their neighbours, they talk, and they go home a little prouder of what they can do.”",
    ],
    wahrFalsch: [
      { aussage: "The Repair Café is open every weekend.", wahr: false, beleg: "Every second Saturday, the old bakery on Mill Street in Lindenfeld fills with broken things." },
      { aussage: "Hanna Petrek used to work as a teacher.", wahr: true, beleg: "The idea came from Hanna Petrek, a retired science teacher." },
      { aussage: "A shop said that repairing Hanna's coffee machine would be expensive.", wahr: true, beleg: "Three years ago her coffee machine stopped working, and the shop told her that a repair would cost more than a new machine." },
      { aussage: "All the volunteers are retired.", wahr: false, beleg: "Most of them are older people who have repaired things all their lives, but there are young helpers, too." },
      { aussage: "Visitors can leave their things at the café and collect them later.", wahr: false, beleg: "The owners are not allowed to leave and come back later: they have to stay and help, so that they learn something too." },
      { aussage: "Most of the things people bring can be repaired.", wahr: true, beleg: "About one in three things cannot be fixed, usually because the right parts are no longer sold." },
      { aussage: "The café is going to move to a bigger place.", wahr: true, beleg: "The town council has noticed the project and has offered the café a larger room in the library from next spring." },
    ],
    fragen: [
      { frage: "What do people bring to the Repair Café?", antworten: ["Things that do not work any more", "Old things they want to sell", "Food for the volunteers", "Clothes for people in need"] },
      { frage: "Why did Hanna Petrek start the Repair Café?", antworten: ["She fixed her own machine easily after a shop wanted a lot of money.", "She wanted to earn some money after she retired.", "Her neighbours asked her to repair their machines.", "The library was looking for a new project."] },
      { frage: "What does Lukas say about the café?", antworten: ["He has learned a lot about electronics there.", "He wants to become an electrician.", "He was never afraid of making mistakes.", "He mainly helps by making coffee."] },
      { frage: "What happens when you visit the café?", antworten: ["You stay with a volunteer while your thing is repaired.", "You pay before a volunteer looks at the problem.", "You leave your thing and pick it up a week later.", "You have to book a time on the website."] },
      { frage: "Why do many visitors come, according to Hanna?", antworten: ["They enjoy meeting people and feel proud afterwards.", "They want to learn how to become volunteers.", "They cannot afford to buy new things.", "They get free coffee and cake."] },
    ],
    ueberschriften: ["A new life for broken things", "A small problem with a big price", "Helpers of all ages", "How a visit works", "More than saving money"],
    ueberschriftenExtra: ["A shop for second-hand tools", "Why new machines break so quickly"],
    satzenden: [
      { anfang: "The Repair Café takes place in", ende: "a building that used to be a bakery." },
      { anfang: "Hanna found out that her coffee machine", ende: "only had a loose cable." },
      { anfang: "When Lukas started, he was worried that", ende: "he might break something." },
      { anfang: "Some things cannot be repaired because", ende: "the parts they need are not sold any more." },
      { anfang: "The money that visitors give", ende: "is used for tools and coffee." },
      { anfang: "The town council supports the café by", ende: "offering it a larger room." },
    ],
    satzendenExtra: ["paying the volunteers a small wage.", "the volunteers do not have enough time."],
    kurz: [
      { frage: "On which day of the week does the Repair Café open?", antworten: ["Saturday", "Saturdays", "every second Saturday"] },
      { frage: "What was wrong with Hanna's coffee machine?", antworten: ["a loose cable", "the cable was loose"] },
      { frage: "Where did Hanna put up her notice?", antworten: ["in the library", "the library"] },
      { frage: "How old is Lukas?", antworten: ["seventeen", "17", "seventeen years old", "17 years old"] },
      { frage: "What do visitors write on the list at the door?", antworten: ["their name", "their names", "name"] },
      { frage: "What do the donations pay for?", antworten: ["tools and coffee", "coffee and tools"] },
    ],
  },
  {
    id: "phone-ban",
    niveau: "B2",
    titel: "Switched off: a school without phones",
    absaetze: [
      "When Kestrelbrook School announced last autumn that students would have to hand in their phones at the gate every morning, the reaction was loud. Some parents worried that they would not be able to reach their children, and many students called the rule old-fashioned. The head teacher, Dr Amara Lindqvist, was not surprised. “Nobody likes to lose something they use a hundred times a day,” she says. “But we had reached a point where we could not ignore the problem any longer.”",
      "The problem, as the school saw it, was attention. A survey among the 600 students had shown that more than half of them felt tired or distracted during lessons, and many admitted checking their phones under the desk. Teachers reported that breaks had become strangely quiet, with groups of friends sitting side by side, each looking at a screen. To answer the parents' concerns, the school put two telephones in the entrance hall that students may use at any time.",
      "Six months later, the atmosphere has changed. Mia Rosten, who is in her final year, admits that the first weeks were hard. “I kept reaching for my pocket,” she laughs. “Now I hardly think about it during the day.” The library, which used to be almost empty at lunchtime, is suddenly popular again, and the chess club has doubled in size. Several students say they talk to classmates they had never spoken to before.",
      "Not everyone is convinced, though. Mr Pellwood, who teaches history, has noticed that students ask more questions in class, but he is careful not to give the ban all the credit. “We also moved into a new building with better rooms, and we changed the timetable this year,” he points out. Some older students argue that they need their phones for research and to organise their lives, and that learning to use them sensibly is a skill in itself.",
      "The school is now planning the next step. From the summer, teachers will be allowed to let students use their phones in selected lessons, for example to film experiments or to look up information. The students' council will vote on the details in June. What has surprised the head teacher most is a second survey: almost two thirds of the students said that they were sleeping better than before.",
    ],
    wahrFalsch: [
      { aussage: "Most students welcomed the new rule.", wahr: false, beleg: "Some parents worried that they would not be able to reach their children, and many students called the rule old-fashioned." },
      { aussage: "The head teacher had expected people to be unhappy about the rule.", wahr: true, beleg: "The head teacher, Dr Amara Lindqvist, was not surprised." },
      { aussage: "According to a survey, many students found it hard to concentrate in class.", wahr: true, beleg: "A survey among the 600 students had shown that more than half of them felt tired or distracted during lessons, and many admitted checking their phones under the desk." },
      { aussage: "Students cannot contact their families during the school day.", wahr: false, beleg: "To answer the parents' concerns, the school put two telephones in the entrance hall that students may use at any time." },
      { aussage: "Mia found it easy to get used to the rule.", wahr: false, beleg: "Mia Rosten, who is in her final year, admits that the first weeks were hard." },
      { aussage: "Mr Pellwood thinks that the ban is the only reason for the changes in his lessons.", wahr: false, beleg: "Mr Pellwood, who teaches history, has noticed that students ask more questions in class, but he is careful not to give the ban all the credit." },
      { aussage: "Phones will be used in some lessons in the future.", wahr: true, beleg: "From the summer, teachers will be allowed to let students use their phones in selected lessons, for example to film experiments or to look up information." },
    ],
    fragen: [
      { frage: "Why did some parents criticise the new rule?", antworten: ["They were afraid they could not contact their children.", "They thought phones were important for homework.", "They had not been asked before the decision.", "They thought the rule would cost too much money."] },
      { frage: "What did teachers notice before the ban?", antworten: ["Students spent their breaks looking at screens.", "Students were too loud during the breaks.", "Students used the library more and more.", "Students often forgot their phones at home."] },
      { frage: "What has changed since the ban?", antworten: ["More students go to the library at lunchtime.", "The chess club has been closed.", "Students have stopped talking during breaks.", "Lessons have become shorter."] },
      { frage: "What is Mr Pellwood's opinion?", antworten: ["Other changes at the school may also have helped.", "The ban has not changed anything at all.", "Students should be allowed to use phones for research.", "The new building is worse than the old one."] },
      { frage: "What surprised the head teacher most?", antworten: ["Many students say they sleep better now.", "The students' council wants to end the ban.", "Teachers want to use phones in every lesson.", "Parents now fully support the rule."] },
    ],
    ueberschriften: ["An unpopular decision", "Why the school acted", "New habits at lunchtime", "A careful voice", "What comes next"],
    ueberschriftenExtra: ["Parents demand a complete ban", "Teachers use phones to check homework"],
    satzenden: [
      { anfang: "Every morning, students have to", ende: "leave their phones at the school gate." },
      { anfang: "The survey showed that more than half of the students", ende: "felt tired or distracted in lessons." },
      { anfang: "To calm the parents, the school", ende: "set up two telephones in the entrance hall." },
      { anfang: "During her first weeks without a phone, Mia", ende: "kept reaching for her pocket." },
      { anfang: "Some older students believe that", ende: "using phones sensibly is something you have to learn." },
      { anfang: "In June, the students' council", ende: "will vote on the details of the next step." },
    ],
    satzendenExtra: ["bought new computers for every classroom.", "decided to end the ban after six months."],
    kurz: [
      { frage: "Where do students hand in their phones?", antworten: ["at the gate", "the gate", "at the school gate", "the school gate"] },
      { frage: "How many students go to Kestrelbrook School?", antworten: ["600", "600 students", "six hundred", "six hundred students"] },
      { frage: "Which club has doubled in size?", antworten: ["the chess club", "chess"] },
      { frage: "Which subject does Mr Pellwood teach?", antworten: ["history"] },
      { frage: "When will the students' council vote on the details?", antworten: ["in June", "June"] },
      { frage: "How many students say they are sleeping better?", antworten: ["almost two thirds", "two thirds", "nearly two thirds"] },
    ],
  },
  {
    id: "night-train",
    niveau: "B1",
    titel: "A night on the Silver Owl",
    absaetze: [
      "Last month, Jonas Ferrant travelled from Aldmoor to Port Selwick to visit his aunt. A plane would have taken ninety minutes, but he chose the Silver Owl, a night train that needs eleven hours for the same trip. “My friends thought I was crazy,” he says. “But I wanted to try something different.”",
      "Jonas booked a bed in a shared compartment for four people. A private compartment was almost three times as expensive, and he was curious about the other passengers. He shared the small room with a retired couple and a student from Port Selwick. Before they went to sleep, they played cards and talked about their plans for the holidays.",
      "The train left at nine in the evening. Every bed had a blanket, a pillow and a small bottle of water. Jonas had expected a noisy night, but the train was surprisingly quiet. “I could hardly hear a sound,” he says. The only problem was the dining car, which was closed for repairs, so he had to buy his dinner at the station before the journey.",
      "In the morning, the conductor knocked on the door and brought a small breakfast with coffee, bread and jam. The train arrived forty minutes late because of work on the tracks. Jonas did not mind. “On a plane I would have spent the time waiting at the airport anyway,” he says.",
      "Would he do it again? Jonas says yes, and not only because it is better for the environment. A night train produces much less pollution than a plane, but for him the journey itself was the best part. His advice for first-timers: bring earplugs, buy food before you get on and do not expect a hotel. “It is an adventure, not a luxury,” he says.",
    ],
    wahrFalsch: [
      { aussage: "The train journey takes longer than the flight.", wahr: true, beleg: "A plane would have taken ninety minutes, but he chose the Silver Owl, a night train that needs eleven hours for the same trip." },
      { aussage: "Jonas's friends liked his idea.", wahr: false, beleg: "“My friends thought I was crazy,” he says." },
      { aussage: "Jonas paid for a private compartment.", wahr: false, beleg: "Jonas booked a bed in a shared compartment for four people." },
      { aussage: "Jonas shared his compartment with three other people.", wahr: true, beleg: "He shared the small room with a retired couple and a student from Port Selwick." },
      { aussage: "The train was very noisy at night.", wahr: false, beleg: "Jonas had expected a noisy night, but the train was surprisingly quiet." },
      { aussage: "Jonas had dinner in the dining car.", wahr: false, beleg: "The only problem was the dining car, which was closed for repairs, so he had to buy his dinner at the station before the journey." },
      { aussage: "Breakfast was brought to the compartment.", wahr: true, beleg: "In the morning, the conductor knocked on the door and brought a small breakfast with coffee, bread and jam." },
      { aussage: "The train arrived on time.", wahr: false, beleg: "The train arrived forty minutes late because of work on the tracks." },
    ],
    fragen: [
      { frage: "Why did Jonas take the night train?", antworten: ["He wanted to try something new.", "He was afraid of flying.", "There were no flights that day.", "His aunt had given him a ticket."] },
      { frage: "Why did Jonas book a shared compartment?", antworten: ["It was cheaper and he wanted to meet people.", "There were no private compartments left.", "His aunt told him to do it.", "He was travelling with friends."] },
      { frage: "What did Jonas have to do before the journey?", antworten: ["Buy his dinner at the station", "Bring his own blanket", "Book his breakfast", "Buy a bottle of water"] },
      { frage: "How did Jonas feel about the delay?", antworten: ["It did not bother him.", "He was angry with the conductor.", "He was worried about missing his aunt.", "He decided to fly next time."] },
      { frage: "What advice does Jonas give to people taking a night train for the first time?", antworten: ["Take earplugs and your own food.", "Book a private compartment.", "Expect the comfort of a hotel.", "Always travel with friends."] },
    ],
    ueberschriften: ["Eleven hours instead of ninety minutes", "Strangers in a small room", "A quiet night", "Late, but not worried", "Advice for first-timers"],
    ueberschriftenExtra: ["A free dinner for every passenger", "Why trains are faster than planes"],
    satzenden: [
      { anfang: "Jonas travelled to Port Selwick", ende: "to visit a member of his family." },
      { anfang: "Before going to sleep, the people in the compartment", ende: "played cards and talked." },
      { anfang: "Every bed on the train had", ende: "a blanket, a pillow and some water." },
      { anfang: "Jonas could not eat in the dining car because", ende: "it was closed for repairs." },
      { anfang: "The train was late because", ende: "work was being done on the tracks." },
      { anfang: "For Jonas, the best part of the trip was", ende: "the journey itself." },
    ],
    satzendenExtra: ["the quiet airport.", "it had run out of food."],
    kurz: [
      { frage: "How long does the flight from Aldmoor to Port Selwick take?", antworten: ["ninety minutes", "90 minutes", "1.5 hours", "90 min"] },
      { frage: "At what time did the train leave?", antworten: ["nine", "9", "nine in the evening", "9 pm", "9 p.m.", "nine o'clock"] },
      { frage: "What did every bed have besides a blanket and a pillow?", antworten: ["a bottle of water", "water", "bottle of water"] },
      { frage: "Who brought breakfast?", antworten: ["the conductor"] },
      { frage: "How late was the train?", antworten: ["forty minutes", "40 minutes", "40 min"] },
      { frage: "What should first-timers bring, according to Jonas?", antworten: ["earplugs", "earplugs and food"] },
    ],
  },
  {
    id: "city-bees",
    niveau: "B2",
    titel: "Bees on the rooftops",
    absaetze: [
      "On the roof of the police station in Velmouth, between air-conditioning units and a forest of aerials, stand four wooden boxes. They belong to the more than 300 beehives that are now kept in the city, on roofs, balconies and in back gardens. Twenty years ago, there were hardly any. Today, city honey is sold at markets, and the waiting list for the local beekeeping course is longer than ever.",
      "Priya Lanzinger, who runs the Velmouth Beekeepers' Circle, is happy about the interest but also a little worried. “People see a nice hobby and a jar of honey,” she says. “They forget that bees are animals that need care all year round.” Her group therefore insists that newcomers complete a twelve-week course before they are allowed to set up their first hive. In the course, they learn how to check a hive for illness and how to deal with a swarm.",
      "There is also a bigger question. Honeybees are not the only insects that need flowers, and researchers from the city's university have found that too many hives in a small area can be a problem. When thousands of honeybees collect food in the same streets, there may not be enough left for wild bees, many of which are already rare. “Keeping honeybees does not automatically help nature,” one of the researchers explains.",
      "For this reason, the city has started to change its parks. Instead of cutting the grass every week, gardeners now cut some meadows only twice a year, so that wild flowers have time to grow. Residents can collect free packets of flower seeds at the town hall to plant on their balconies. The idea is simple: more flowers mean more food for all kinds of insects.",
      "Tom Greaves, an accountant who keeps two hives on the roof of his garage, has taken the advice to heart. He has filled his garden with lavender and wild herbs and has decided not to add a third hive. “I started for the honey,” he says. “Now I spend more time watching the wild bees than my own.”",
    ],
    wahrFalsch: [
      { aussage: "There are more beehives in Velmouth today than twenty years ago.", wahr: true, beleg: "Twenty years ago, there were hardly any." },
      { aussage: "Priya Lanzinger thinks that keeping bees is easy.", wahr: false, beleg: "“They forget that bees are animals that need care all year round.”" },
      { aussage: "Newcomers must take a course before they can keep bees in the group.", wahr: true, beleg: "Her group therefore insists that newcomers complete a twelve-week course before they are allowed to set up their first hive." },
      { aussage: "The researchers say that more honeybees are always good for nature.", wahr: false, beleg: "“Keeping honeybees does not automatically help nature,” one of the researchers explains." },
      { aussage: "Honeybees can take food away from wild bees.", wahr: true, beleg: "When thousands of honeybees collect food in the same streets, there may not be enough left for wild bees, many of which are already rare." },
      { aussage: "The grass in all parks is still cut every week.", wahr: false, beleg: "Instead of cutting the grass every week, gardeners now cut some meadows only twice a year, so that wild flowers have time to grow." },
      { aussage: "Residents have to pay for the flower seeds.", wahr: false, beleg: "Residents can collect free packets of flower seeds at the town hall to plant on their balconies." },
      { aussage: "Tom Greaves plans to keep more hives.", wahr: false, beleg: "He has filled his garden with lavender and wild herbs and has decided not to add a third hive." },
    ],
    fragen: [
      { frage: "What does the first paragraph say about beekeeping in Velmouth?", antworten: ["It has become much more popular.", "It is only allowed on public buildings.", "It is mainly done by the police.", "It has become too expensive for most people."] },
      { frage: "Why is Priya Lanzinger a little worried?", antworten: ["Some newcomers do not realise how much work bees need.", "There are not enough people on the waiting list.", "City honey does not sell well at markets.", "The beekeeping course is too short."] },
      { frage: "What have researchers from the university found out?", antworten: ["Too many honeybees in one area can harm wild bees.", "Wild bees produce more honey than honeybees.", "Honeybees need fewer flowers than wild bees.", "City bees are healthier than country bees."] },
      { frage: "How is the city trying to help insects?", antworten: ["It lets some meadows grow longer.", "It pays residents to keep hives.", "It has banned beekeeping in parks.", "It plants lavender on every roof."] },
      { frage: "How has Tom Greaves changed?", antworten: ["He is now more interested in wild bees.", "He sells his honey at the market.", "He has given up beekeeping completely.", "He has become an expert on bee illnesses."] },
    ],
    ueberschriften: ["Honey from the city", "Not just a hobby", "A problem for wild bees", "Parks with more flowers", "From honey to wild bees"],
    ueberschriftenExtra: ["Police officers learn to keep bees", "How to sell honey at the market"],
    satzenden: [
      { anfang: "The beehives on the police station", ende: "are among more than 300 in the city." },
      { anfang: "In the twelve-week course, newcomers learn", ende: "how to check a hive for illness." },
      { anfang: "Many wild bees", ende: "are already rare." },
      { anfang: "Gardeners now cut some meadows only twice a year so that", ende: "wild flowers have time to grow." },
      { anfang: "At the town hall, residents can", ende: "collect free packets of seeds." },
      { anfang: "Tom Greaves keeps his two hives", ende: "on the roof of his garage." },
    ],
    satzendenExtra: ["are looked after by police officers.", "sell their honey to the city."],
    kurz: [
      { frage: "How many beehives are there in Velmouth now?", antworten: ["more than 300", "over 300", "300", "more than three hundred"] },
      { frage: "What is the name of Priya Lanzinger's group?", antworten: ["Velmouth Beekeepers' Circle", "the Velmouth Beekeepers' Circle", "Beekeepers' Circle"] },
      { frage: "How long is the beekeeping course?", antworten: ["twelve weeks", "12 weeks"] },
      { frage: "How often are some meadows cut now?", antworten: ["twice a year", "two times a year"] },
      { frage: "Where can residents get free seeds?", antworten: ["at the town hall", "the town hall"] },
      { frage: "What is Tom Greaves's job?", antworten: ["accountant", "an accountant", "he is an accountant"] },
    ],
  },
  {
    id: "podcast",
    niveau: "B1",
    titel: "The girl behind The Quiet Corner",
    absaetze: [
      "Elif Marten was fifteen when she recorded the first episode of her podcast in her bedroom. Her brother had bought a microphone for his band but never used it, so she asked if she could borrow it. Two years later, The Quiet Corner has about 4,000 listeners, most of them teenagers in Brennwald and the towns around it.",
      "Each episode is about thirty minutes long and has one guest. Elif talks to people from her town who do something unusual: a bus driver who writes poems, a girl who repairs old bikes, a grandmother who learned to swim at seventy. “Everybody has a story,” she says. “You just have to ask the right questions.”",
      "Making a podcast is more work than most people think. For the very first episode, Elif recorded the introduction more than twenty times because she did not like her voice. Now she plans every episode carefully. Her best friend designs the logo and posts on social media, and her brother, who studies music, helps her with the sound.",
      "So far, Elif has not earned any money with the podcast. Last month, a bookshop in Brennwald offered to pay for advertising, but she has not said yes yet. “I'm afraid it might make the show less personal,” she explains. “On the other hand, a better microphone would be nice.”",
      "Elif still gets nervous before every interview, but she has learned that good questions help both her and her guests. Last spring, her old primary school invited her to give a talk about podcasting. Her advice for anyone who wants to start: “Start small, use what you have and don't wait until everything is perfect.”",
    ],
    wahrFalsch: [
      { aussage: "Elif bought a microphone for her podcast.", wahr: false, beleg: "Her brother had bought a microphone for his band but never used it, so she asked if she could borrow it." },
      { aussage: "Most of Elif's listeners are young people.", wahr: true, beleg: "Two years later, The Quiet Corner has about 4,000 listeners, most of them teenagers in Brennwald and the towns around it." },
      { aussage: "Every episode has several guests.", wahr: false, beleg: "Each episode is about thirty minutes long and has one guest." },
      { aussage: "Elif liked her voice from the beginning.", wahr: false, beleg: "For the very first episode, Elif recorded the introduction more than twenty times because she did not like her voice." },
      { aussage: "Other people help Elif with the podcast.", wahr: true, beleg: "Her best friend designs the logo and posts on social media, and her brother, who studies music, helps her with the sound." },
      { aussage: "Elif has already accepted money from a bookshop.", wahr: false, beleg: "Last month, a bookshop in Brennwald offered to pay for advertising, but she has not said yes yet." },
      { aussage: "Elif no longer feels nervous before interviews.", wahr: false, beleg: "Elif still gets nervous before every interview, but she has learned that good questions help both her and her guests." },
      { aussage: "Elif was invited to speak at a school.", wahr: true, beleg: "Last spring, her old primary school invited her to give a talk about podcasting." },
    ],
    fragen: [
      { frage: "How did Elif get her microphone?", antworten: ["She borrowed it from her brother.", "She bought it with her own money.", "A bookshop gave it to her.", "She won it in a competition."] },
      { frage: "What kind of guests does Elif invite?", antworten: ["Local people who do unusual things", "Famous musicians", "Teachers from her school", "Other young podcasters"] },
      { frage: "What does Elif's brother do for the podcast?", antworten: ["He helps her with the sound.", "He designs the logo.", "He chooses the guests.", "He posts on social media."] },
      { frage: "Why has Elif not accepted the bookshop's offer yet?", antworten: ["She is worried the show could become less personal.", "The bookshop wants to choose her guests.", "She does not need a better microphone.", "Her parents do not allow it."] },
      { frage: "What is Elif's advice for new podcasters?", antworten: ["Begin with what you have and do not wait.", "Buy the best microphone you can afford.", "Plan at least twenty episodes first.", "Only invite guests you already know."] },
    ],
    ueberschriften: ["A borrowed microphone", "Everybody has a story", "More work than expected", "An offer from a bookshop", "Advice from a young podcaster"],
    ueberschriftenExtra: ["A famous guest visits the studio", "Why her brother stopped making music"],
    satzenden: [
      { anfang: "Elif recorded her first episode", ende: "in her bedroom." },
      { anfang: "The guests on The Quiet Corner", ende: "come from Elif's own town." },
      { anfang: "Elif recorded the introduction many times because", ende: "she did not like her voice." },
      { anfang: "Elif's best friend", ende: "takes care of the logo and social media." },
      { anfang: "The bookshop has offered", ende: "to pay for advertising." },
      { anfang: "Elif's old primary school", ende: "invited her to give a talk." },
    ],
    satzendenExtra: ["to buy her a new microphone.", "their favourite books and films."],
    kurz: [
      { frage: "How old was Elif when she started her podcast?", antworten: ["fifteen", "15", "fifteen years old", "15 years old"] },
      { frage: "How long is an episode?", antworten: ["about thirty minutes", "thirty minutes", "30 minutes", "half an hour"] },
      { frage: "What does the bus driver write?", antworten: ["poems", "poetry"] },
      { frage: "What does Elif's brother study?", antworten: ["music"] },
      { frage: "Which business offered to pay for advertising?", antworten: ["a bookshop", "a bookshop in Brennwald"] },
      { frage: "Who invited Elif to give a talk?", antworten: ["her old primary school", "her primary school", "her old school", "primary school"] },
    ],
  },
  {
    id: "mountain-hut",
    niveau: "B2",
    titel: "A summer above the clouds",
    absaetze: [
      "At 2,300 metres above sea level, the Gratbaum Hut in the Arnalp mountains is not an easy place to work. There is no road, the nearest village is a three-hour walk away, and the weather can change within minutes. Every summer, the hut, which sleeps sixty guests, is run by a team of four, and for the last two years one of them has been a student.",
      "Noah Brandstetter, who studies geography, spent July and August at the hut. In exchange for six to eight weeks of hard work, students get free food, a bed and a small wage. “Nobody does this for the money,” Noah says. His day started at half past five, when he prepared breakfast for hikers who wanted to reach the summit before the clouds came in.",
      "Life at the hut means using as little as possible. Food and gas arrive by cable lift once a week, and water is so precious that showers are limited to two minutes. There is no mobile signal, and the internet connection is used only for emergencies and bookings. “The first week I kept checking my phone,” Noah admits. “By the third week, I had forgotten where I had put it.”",
      "The hardest part, Noah says, was not the work but the weather. One evening in August, a storm hit the mountain, and a family with two small children arrived soaked and exhausted. All the beds were taken, so Noah gave his own bed to the youngest child and slept on a bench in the kitchen. “Situations like that teach you more than any lecture,” he says.",
      "Noah believes the summer has changed him. He has become more patient, he says, and he no longer takes hot water or a full fridge for granted. He is saving his wages for a trip abroad next year, but he will not be gone for long. The owners of the hut have asked him to come back next summer, and he has already said yes.",
    ],
    wahrFalsch: [
      { aussage: "You can drive a car up to the Gratbaum Hut.", wahr: false, beleg: "There is no road, the nearest village is a three-hour walk away, and the weather can change within minutes." },
      { aussage: "The hut is run by a small team.", wahr: true, beleg: "Every summer, the hut, which sleeps sixty guests, is run by a team of four, and for the last two years one of them has been a student." },
      { aussage: "Students who work at the hut earn a lot of money.", wahr: false, beleg: "In exchange for six to eight weeks of hard work, students get free food, a bed and a small wage." },
      { aussage: "Noah's working day began early in the morning.", wahr: true, beleg: "His day started at half past five, when he prepared breakfast for hikers who wanted to reach the summit before the clouds came in." },
      { aussage: "Guests can take long showers at the hut.", wahr: false, beleg: "Food and gas arrive by cable lift once a week, and water is so precious that showers are limited to two minutes." },
      { aussage: "Noah used his phone a lot during the whole summer.", wahr: false, beleg: "“By the third week, I had forgotten where I had put it.”" },
      { aussage: "For Noah, the weather was harder than the work.", wahr: true, beleg: "The hardest part, Noah says, was not the work but the weather." },
      { aussage: "Noah will not work at the hut again.", wahr: false, beleg: "The owners of the hut have asked him to come back next summer, and he has already said yes." },
    ],
    fragen: [
      { frage: "What does the first paragraph say about the hut?", antworten: ["Visitors can only reach it on foot.", "It is open all year round.", "It is run by students only.", "It has room for four guests."] },
      { frage: "Why does Noah say that nobody does the job for the money?", antworten: ["The wage is small.", "Students are not paid at all.", "The food at the hut is expensive.", "The work is easy."] },
      { frage: "How does food get to the hut?", antworten: ["By cable lift", "By helicopter", "By car", "In the hikers' backpacks"] },
      { frage: "What happened during the storm?", antworten: ["Noah gave his bed to a child.", "The family had to sleep outside.", "Noah walked down to the village.", "The hut lost its internet connection."] },
      { frage: "How has the summer changed Noah?", antworten: ["He is more patient now.", "He wants to study something else.", "He has decided to live in the mountains.", "He has spent all his money."] },
    ],
    ueberschriften: ["A hard place to work", "Not for the money", "Living with less", "A night in the storm", "Back next summer"],
    ueberschriftenExtra: ["A new road to the summit", "How to book a bed online"],
    satzenden: [
      { anfang: "The nearest village", ende: "is three hours away on foot." },
      { anfang: "Students who work at the hut", ende: "get food, a bed and a small wage." },
      { anfang: "Noah prepared breakfast for hikers who", ende: "wanted to reach the summit early." },
      { anfang: "Showers at the hut", ende: "may not last longer than two minutes." },
      { anfang: "During the storm, Noah slept", ende: "on a bench in the kitchen." },
      { anfang: "With the money he earned, Noah", ende: "wants to travel abroad." },
    ],
    satzendenExtra: ["are only for the owners of the hut.", "has bought a new phone."],
    kurz: [
      { frage: "How high is the Gratbaum Hut?", antworten: ["2,300 metres", "2300 metres", "2,300 meters", "2300 meters", "2,300 m", "2300 m"] },
      { frage: "How many guests can sleep at the hut?", antworten: ["sixty", "60", "sixty guests", "60 guests"] },
      { frage: "What does Noah study?", antworten: ["geography"] },
      { frage: "How often does the cable lift bring food?", antworten: ["once a week", "once per week", "every week", "weekly"] },
      { frage: "What is the internet used for?", antworten: ["emergencies and bookings", "bookings and emergencies"] },
      { frage: "What is Noah saving his money for?", antworten: ["a trip abroad", "travelling abroad", "traveling abroad"] },
    ],
  },
];

/** Ein Lückentext der Language in Use. */
export type Lueckentext = { id: string; niveau: Niveau; titel: string; text: string };
/** Banked Gap Fill: dazu die Wörter im Kasten, die übrig bleiben. */
export type Wortkasten = Lueckentext & { extra: string[] };
/** Editing: der Text in Zeilen, das überflüssige Wort einer Zeile in {}. */
export type Zeilentext = { id: string; niveau: Niveau; titel: string; zeilen: string[] };

export const OPEN_GAP: Lueckentext[] = [
  {
    id: "instruments",
    niveau: "B1",
    titel: "Borrow a guitar at the library",
    text: "The public library in Halden has a new offer for music lovers. {Since} last March, members can borrow musical instruments in the same way {as|that} they borrow books. The collection includes guitars, keyboards and even a cello. “Many people want to try an instrument, {but|yet} they don't want to spend a lot of money before they know {if|whether} they like it,” says the librarian, Ada Kühne. Each instrument can be borrowed {for} three weeks. Beginners who need help can join a free workshop {on|every} Saturday morning. So far, more {than} two hundred people have used the service, and some of them have already decided to buy {their} own instrument.",
  },
  {
    id: "car-free",
    niveau: "B1",
    titel: "A month without a car",
    text: "Last October, the Harlund family from Westbridge decided {not} to use their car for a whole month. “We wanted to find {out} how difficult it really is,” says Ravi Harlund, the father. The first week was not easy. The children had to get up earlier {because|as|since} the bus to school leaves at seven. {Despite} the rain, the family cycled to the supermarket {and} carried everything home in two big bags. “It took much longer {than} before, but we talked {to|with} each other more,” says thirteen-year-old Mina. By the end of the month, the family {had} saved almost a hundred pounds on petrol. They have not sold their car, but they now use it {only|just} once or twice a week.",
  },
  {
    id: "sleep",
    niveau: "B2",
    titel: "Why teenagers need more sleep",
    text: "Scientists agree that teenagers need between eight and ten hours of sleep a night, but very {few} of them actually get that much. One reason is biological: during puberty, the body releases the sleep hormone melatonin later in the evening, {which} makes it difficult to fall {asleep} before eleven o'clock. {At} the same time, school starts early, so many students are already tired {when|before|as} the first lesson begins. Some schools have therefore decided to start an hour later. The results are encouraging: students are absent less often and their marks have improved. {However|Still|Yet}, not everyone is in favour. Parents who start work early say {that} a later start would make their mornings more complicated. Experts suggest that teenagers should at {least} keep the same bedtime at weekends {as} on school days.",
  },
  {
    id: "tandem",
    niveau: "B2",
    titel: "Learning languages in a tandem",
    text: "When Sofia Kerr moved to Arnstead {to} study engineering, she knew only a few words of the local language. Instead of taking an expensive course, she joined a language tandem, a system {in} which two people teach each other their mother tongues. Her partner, Jan, {who|that} wanted to improve his English, met her twice a week in a café. “The first meetings were a bit awkward because neither of us knew what to do,” Sofia remembers. “But {after|within} a few weeks we were chatting as {if|though} we had known each other for years.” According to language teachers, tandems work best {when|if} both partners prepare topics in advance. They also recommend not correcting every single mistake, {because|as|since} that can make a conversation feel like a test. Sofia now speaks the language well {enough} to follow her lectures, and she and Jan are still good friends.",
  },
  {
    id: "walking",
    niveau: "B1",
    titel: "Walking Wednesdays",
    text: "A school in Pennford has started a project called Walking Wednesdays. Every Wednesday, students are asked {not} to come to school by car. {Instead}, they walk or cycle, and younger children walk together in groups {with} a parent. The idea came from a group of students {who|that} were worried about the traffic outside the school gate. “In the mornings there were so {many} cars that it was dangerous to cross the road,” says Lena, who is fourteen. Since the project started, the number of cars on Wednesdays has gone down {by} almost half. Many families now walk on other days {as} well. The head teacher is pleased: “Students arrive {more} awake, and the air outside the school is cleaner.”",
  },
];

export const BANKED_GAP: Wortkasten[] = [
  {
    id: "food-bank",
    niveau: "B1",
    titel: "Students at the food bank",
    text: "Every Friday afternoon, a group of students from Elmwick College {spend} two hours at the local food bank. They sort {donations}, pack bags and help visitors carry them to their cars. “Before I started, I didn't realise how many families in our town {need} help,” says Tara, who is seventeen. The work can be tiring, {but} the students say it is very {rewarding}. The manager of the food bank, Mr Osei, says he could not {manage} without them. Since the students joined, the number of bags prepared each week has {risen} by thirty percent. Next term, the college wants to {offer} the project to more classes.",
    extra: ["raised", "reward", "needs"],
  },
  {
    id: "bag-ban",
    niveau: "B2",
    titel: "A town without plastic bags",
    text: "When the town of Wexmoor decided to {ban} plastic bags from its shops, many shop owners were {worried}. They expected their customers to complain or to shop elsewhere. A year later, the opposite has {happened}. Most customers now bring their own bags, and some shops have started selling bags {designed} by local artists. The number of bags found in the river has been {reduced} by more than half. “I was {surprised} how quickly people changed their habits,” says the mayor. Other towns in the region are now {considering} a similar rule, and Wexmoor's example is likely to be {followed} soon.",
    extra: ["worry", "banning", "surprising"],
  },
  {
    id: "cooking",
    niveau: "B1",
    titel: "Cooking on the timetable",
    text: "At Brookhill School, cooking lessons have become {compulsory} for all students in Year 8. Once a week, they learn how to {prepare} simple and {healthy} meals. Many students had never used an oven {before}. “At first I burnt everything,” laughs Ben, who is thirteen, “but now I cook dinner for my family {twice} a week.” The lessons have had some {unexpected} effects: students are more willing to try new food, and some say they have {become} more independent. Because the course is so popular, the school wants to {extend} it to Year 9 next year.",
    extra: ["healthily", "unexpectedly", "ago"],
  },
  {
    id: "cinema",
    niveau: "B2",
    titel: "The cinema that refused to die",
    text: "For almost a century, the Palladin Cinema was the heart of Norbrook's town centre. When it {closed} five years ago, many residents feared that the building would be turned into flats. A group of film fans decided to {save} it. Within a year, they had {raised} enough money through concerts, flea markets and online donations to buy the building. The {renovation} took two more years, as the old seats had to be {replaced} and the roof was in a terrible state. Today, the cinema is run {entirely} by volunteers. It shows a mix of new films and {classics}, and on Sunday mornings there are cheap screenings for {families}.",
    extra: ["rose", "renovate", "entire"],
  },
  {
    id: "music",
    niveau: "B1",
    titel: "Why learn an instrument?",
    text: "Learning a musical instrument is not only {fun}. Studies show that it can also have a positive {effect} on the brain. Children who play an instrument often find it easier to {concentrate} at school. However, playing well {requires} a lot of practice, and many beginners give up after a few months. Music teachers {advise} parents to let their children choose the instrument themselves. Another {advantage} of music is that it brings people together, for example in a school band or a choir. Instruments can be {expensive}, so some music schools {lend} them to beginners for a small fee.",
    extra: ["affect", "borrow", "advice"],
  },
];

export const WORD_FORMATION: Lueckentext[] = [
  {
    id: "inventor",
    niveau: "B1",
    titel: "A young inventor",
    text: "Ravi Akande was only fourteen when he found a {solution:SOLVE} to a problem that had annoyed his grandmother for years. She often forgot to water her plants, so Ravi built a small device that checks the soil and gives a {warning:WARN} when it is too dry. He worked very {carefully:CARE}, testing each part many times. His {invention:INVENT} won first prize at a national science fair, and the judges were {impressed:IMPRESS} by how simple it was. {Unfortunately:FORTUNATE}, the parts he used were quite {expensive:EXPENSE}, so Ravi is now trying to build a {cheaper:CHEAP} version.",
  },
  {
    id: "noise",
    niveau: "B2",
    titel: "Noise from the motorway",
    text: "Residents of Altmarsh have been {unhappy:HAPPY} about the noise from the new motorway for months. Some say that it is almost {impossible:POSSIBLE} to sleep with the windows open. After a long {discussion:DISCUSS} with the council, the company responsible for the road agreed to build a noise barrier. The {construction:CONSTRUCT} will take about a year and will cost {considerably:CONSIDER} more than planned. In {addition:ADD}, trees will be planted along the road. Most residents are {satisfied:SATISFY} with the plan, although some doubt that it will lead to real {improvements/improvement:IMPROVE}.",
  },
  {
    id: "gap-year",
    niveau: "B2",
    titel: "A year between school and university",
    text: "A {growing:GROW} number of young people take a gap year before they start university. Some spend the year {travelling/traveling:TRAVEL}, while others work as volunteers. Supporters say that a year away from home makes young people more {independent:DEPEND}, because they have to make their own {decisions:DECIDE}. They also learn to take {responsibility:RESPONSIBLE} for their own lives. Critics point out that it can be {difficult:DIFFICULTY} to return to studying after a long break. Most experts agree that {careful:CARE} planning is {essential:ESSENCE}.",
  },
  {
    id: "fashion",
    niveau: "B2",
    titel: "The real price of cheap clothes",
    text: "Clothes have never been produced as {cheaply:CHEAP} as they are today. Shops offer new collections every few weeks, and the low prices are very {attractive:ATTRACT} to young customers. However, the {production:PRODUCE} of a single T-shirt uses thousands of litres of water. Workers in some countries are paid very little and often work in {dangerous:DANGER} conditions. More and more {consumers:CONSUME} are starting to ask where their clothes come from, and some brands now try to work in a more {environmentally:ENVIRONMENT} friendly way. Buying second-hand clothes is a popular {alternative:ALTERNATE}, and repairing clothes instead of throwing them away is becoming {fashionable:FASHION} again.",
  },
  {
    id: "online-friends",
    niveau: "B1",
    titel: "Friends on the internet",
    text: "For many teenagers, online {friendships:FRIEND} are just as important as the ones at school. Chatting with people who share the same hobbies can be very {helpful:HELP}, especially for young people who feel {lonely/alone:LONE} in their town. However, experts warn that it is not always {easy:EASE} to know who you are really talking to. Some people are {dishonest:HONEST} about their age. Parents should talk {openly:OPEN} with their children about the risks, and young people should never give out {personal:PERSON} information. Most experts agree that the best way is not to ban online friendships but to use the internet {sensibly:SENSE}.",
  },
];

export const EDITING: Zeilentext[] = [
  {
    id: "concert",
    niveau: "B1",
    titel: "My first concert",
    zeilen: [
      "Last summer I went to my first big concert in the",
      "capital. My best friend had {been} bought the tickets months",
      "before, and we had been looking forward to the day ever",
      "since. We took the early train and arrived {to} at the",
      "stadium three hours before {than} the show started. There",
      "were already thousands of people waiting outside. When the",
      "band finally {did} came on stage, everybody started screaming.",
      "The music was so loud that I could {to} feel it in my",
      "stomach. We sang along to every song, even though we",
      "did not know all the words. After the concert {so} we",
      "were too excited to sleep, so we talked about it on the",
      "train all the way {to} home.",
    ],
  },
  {
    id: "new-town",
    niveau: "B1",
    titel: "Moving to a new town",
    zeilen: [
      "When I was twelve, my family moved from a small village",
      "to a big city because {of} my mother had found a new",
      "job there. At first I {was} hated it. I did not know",
      "anybody, and the streets were so busy that I was afraid",
      "to go out {of} alone. My new school was much bigger",
      "than {the} my old one, and I often got lost in the",
      "long corridors. Then a girl from my class asked me to",
      "join {to} the school choir. I had never sung in front",
      "of other people before, but I said yes. Through the choir",
      "I made my first {of} friends, and slowly the city started",
      "to feel like home. Now I cannot imagine living anywhere else.",
    ],
  },
  {
    id: "class-trip",
    niveau: "B2",
    titel: "The class trip that went wrong",
    zeilen: [
      "Our class trip to the coast was supposed to be the",
      "highlight of the school year, but almost {the} everything went",
      "wrong. On the first morning, the bus {was} broke down on the",
      "motorway, and we had to wait for three hours until a",
      "replacement arrived. When we {have} finally reached the youth",
      "hostel, we found out that our booking had been lost. The",
      "manager managed to find beds for all {the} of us, but we",
      "had to sleep in the gym on camping mats. The next day",
      "it rained so {much} heavily that the boat tour was cancelled.",
      "Surprisingly, nobody {was} complained. We played cards, told",
      "stories and laughed more than we had laughed all year.",
      "Looking back, it was the {most} best trip we have ever had.",
    ],
  },
  {
    id: "school-garden",
    niveau: "B2",
    titel: "Our school garden",
    zeilen: [
      "Three years ago, a few students at our school asked if",
      "they could {to} turn an empty corner of the playground into",
      "a garden. The head teacher {was} agreed on one condition:",
      "the students had to look after it themselves, even during",
      "the holidays. Today the garden is one of the {more} most popular",
      "places at school. There are vegetable beds, a small pond",
      "and a bench where students {they} can read in the sun. The",
      "vegetables are used in the school kitchen, and last autumn",
      "we grew so many {of} pumpkins that we sold some at the",
      "school fair. The money {it} paid for new tools and seeds.",
      "Looking after the garden is hard work, but it has taught",
      "us a lot {of} about nature and about working together.",
    ],
  },
  {
    id: "reading",
    niveau: "B1",
    titel: "How I started reading",
    zeilen: [
      "I did not always like reading. When I was younger, I",
      "thought books were {being} boring and preferred to play computer",
      "games. That changed when my aunt {she} gave me a fantasy",
      "novel for my birthday. At first I only read a few pages",
      "because I wanted {for} to be polite. But the story was so",
      "exciting that I finished the whole book in three days.",
      "Since then I have {been} read almost every book in the series.",
      "Reading helps me to relax after a long day at school,",
      "and I have learned {the} many new words. Now I always",
      "carry a book in {the} my bag, just in case I have to wait somewhere.",
    ],
  },
];

/** Ein Schreibauftrag: Situation, was zu schreiben ist, die drei Punkte und ein Mustertext (±10 % der Wortanzahl). */
export type Schreibauftrag = {
  id: string;
  niveau: Niveau;
  textsorte: "article" | "blog-post" | "blog-comment" | "email-informal" | "email-formal" | "report" | "essay" | "leaflet";
  woerter: number;
  /** Beschwerde: für die Fähigkeit „Formal Letter of Complaint“ */
  beschwerde?: boolean;
  situation: string;
  auftrag: string;
  punkte: [string, string, string];
  zusatz?: string;
  muster: string;
};

export const SCHREIBAUFTRAEGE: Schreibauftrag[] = [
  {
    id: "part-time-jobs",
    niveau: "B1",
    textsorte: "article",
    woerter: 250,
    situation: "Your school magazine is planning an issue about teenagers and money. The editor has asked students to write about part-time jobs.",
    auftrag: "Write an article for the school magazine.",
    punkte: ["describe the kinds of jobs students at your school do", "explain the advantages and disadvantages of working while you are still at school", "suggest how students can find a balance between work and school"],
    zusatz: "Give your article a title.",
    muster: `Working for the Weekend

Ask around in any class at our school and you will find that a surprising number of students have a part-time job. Some work as waiters in cafés on Saturdays, others deliver newspapers before school or babysit for neighbours in the evenings. A few even help out in their parents' businesses during the holidays.

So is a job a good idea while you are still at school? There are clear advantages. Earning your own money makes you more independent, and you learn how much things really cost. A job also teaches skills that school cannot always offer, such as dealing with customers, working in a team and being on time. Many students say that their first job gave them confidence and something useful to put on their CV.

However, there is another side. Students who work long hours are often tired in lessons, and some fall behind with their homework. Weekend shifts can also mean less time for friends, sport and simply relaxing, which are important too.

So how can you find the right balance? First, keep your working hours limited, especially before tests. Ten hours a week is plenty for most students. Second, talk openly with your employer about your timetable, because good employers understand that school comes first. Finally, plan your week in advance so that homework does not get forgotten.

A part-time job can be a great experience, as long as it stays part-time. After all, your education is the most important job you have right now.`,
  },
  {
    id: "less-rubbish",
    niveau: "B2",
    textsorte: "article",
    woerter: 250,
    situation: "An international online magazine for young people has invited readers to send in articles with the title “Less rubbish, please!”.",
    auftrag: "Write an article about how your school could produce less waste.",
    punkte: ["describe how much waste is produced at your school and where it comes from", "evaluate what your school has already tried", "suggest ideas that students could put into practice"],
    muster: `Less Rubbish, Please!

At our school, about 800 students and teachers spend most of their day in the same building, and at the end of every day the bins are full. Most of the waste comes from plastic packaging, such as sandwich wrappers and drink bottles, but a lot of paper is thrown away as well, from worksheets to old notebooks.

Over the last few years, our school has tried a few things. Recycling bins were put in every corridor, which was a good start. Unfortunately, many students do not use them properly, so plastic and paper often end up mixed together. Last year the canteen stopped selling drinks in plastic bottles. This has made a real difference, although some students simply bring them from the supermarket instead.

So what else could we do? Here are three ideas that students could start tomorrow. First, bring a lunch box and a refillable bottle. If everyone did this, we would save hundreds of wrappers and bottles every week. Second, teachers could share more worksheets online, and students could use both sides of the paper when they print. Third, why not organise a swap shop for books, sports equipment and clothes? Things that one student no longer needs could be exactly what someone else is looking for.

None of these ideas is difficult or expensive. What we need is for everyone to take part. If each of us makes one small change, our bins will soon be a lot emptier.`,
  },
  {
    id: "screen-free",
    niveau: "B1",
    textsorte: "blog-post",
    woerter: 250,
    situation: "You spent a whole weekend without your phone, your computer and the TV.",
    auftrag: "Write a blog post about the experience.",
    punkte: ["explain why you decided to try it", "describe what you did instead", "reflect on what you learned from it"],
    zusatz: "Give your blog post a title.",
    muster: `My Weekend Offline

Hi everyone! Last weekend I did something I never thought I would do: I switched off my phone, my laptop and the TV from Friday evening until Monday morning. Here's how it went.

Why did I do it? To be honest, I was shocked when my phone told me that I had spent almost five hours a day on it. I felt tired all the time and I couldn't remember the last time I had read a book. So I decided to try a little experiment.

On Saturday morning I woke up and automatically reached for my phone, which was locked in a drawer. The first few hours felt strange and boring. Then I called my best friend on our old home phone, and we went for a long bike ride by the lake. In the afternoon I baked a cake with my little brother, and in the evening my family played board games for the first time in years. On Sunday I finally finished a novel that had been lying on my desk for months.

What did I learn? First of all, I have much more free time than I thought. Without screens, the days felt longer and calmer. I also realised that I don't need to know what everyone else is doing every minute. I won't give up my phone completely, but I'm going to keep one screen-free day every week.

Have you ever tried a digital detox? Tell me about it in the comments!`,
  },
  {
    id: "learning-online",
    niveau: "B2",
    textsorte: "blog-post",
    woerter: 250,
    situation: "You have recently taught yourself a new skill, for example cooking, drawing or playing an instrument, with the help of online videos.",
    auftrag: "Write a blog post for a website for teenagers.",
    punkte: ["describe the skill and how you learned it", "compare learning online with learning from a teacher", "give tips to readers who want to try it too"],
    zusatz: "Give your blog post a title.",
    muster: `How Online Videos Taught Me to Draw

A year ago, I couldn't draw a cat that actually looked like a cat. Today, my friends ask me to design their birthday cards. So what happened? I taught myself to draw, mainly with free videos on the internet.

It all started during a long, rainy holiday. I found a channel where an artist explained the basics, like shapes, shadows and perspective, in short lessons. I watched one video a day and practised for about half an hour. Whenever I got stuck, I paused the video, tried again and compared my drawing with hers.

Is learning online better than learning from a teacher? It depends. The biggest advantage is that you can learn at your own speed and watch difficult parts as often as you like. It's also free, which matters if you are a student. On the other hand, a video can't tell you what you are doing wrong. A real teacher sees your mistakes immediately and can help you before they become habits. I sometimes missed that kind of feedback.

If you want to try it yourself, here are my top tips. Choose one channel and follow its lessons in order instead of jumping around. Practise a little every day rather than a lot once a week. Keep your old drawings, because seeing your progress is the best motivation. Finally, share your work with others, for example in an online group, so that you get the feedback that videos can't give you.

What would you like to learn? Let me know below!`,
  },
  {
    id: "friend-visit",
    niveau: "B1",
    textsorte: "email-informal",
    woerter: 250,
    situation: "Your English-speaking friend Sam is going to visit you for a week in the summer. Sam has written to ask what you are planning.",
    auftrag: "Write an email to Sam.",
    punkte: ["suggest some activities for the week", "explain what Sam should pack", "ask Sam about food and other wishes"],
    muster: `Hi Sam,

Thanks for your email! I'm so excited that you're coming in July. I've already made a plan for the week, but tell me if you'd like to change anything.

On the first day I thought we could just relax and walk around the old town, so that you can recover from the journey. There's a great ice cream shop near the river that you have to try. On Tuesday and Wednesday my parents are taking us to the mountains. We'll stay in a small hut and go hiking, and if the weather is good, we can swim in the lake. Later in the week there's an open-air concert in the park, and I've already bought tickets for us. On the last day we could go shopping, so you can buy some souvenirs for your family.

As for packing, bring comfortable shoes for walking, because the paths in the mountains can be quite rocky. You'll also need a warm jacket, as it gets cold up there at night, even in summer. Don't forget your swimming things and some sun cream. You don't need to bring a towel or a sleeping bag, because we have plenty.

Now I've got a few questions for you. Is there anything you don't eat? My mum wants to cook something typical for you, so let me know if you're a vegetarian or have any allergies. And would you prefer to sleep in my room or in the guest room?

I can't wait to see you!

Best wishes,
Alex`,
  },
  {
    id: "festival-volunteer",
    niveau: "B2",
    textsorte: "email-formal",
    woerter: 250,
    situation: "You have seen an advertisement for volunteers at the Riverside Youth Music Festival, a three-day event in a town near you.",
    auftrag: "Write an email to the organisers to apply.",
    punkte: ["explain why you are interested in helping", "describe skills and experience that would be useful", "ask about the working hours and what volunteers receive"],
    muster: `Dear Sir or Madam,

I am writing to apply for a position as a volunteer at the Riverside Youth Music Festival, which I saw advertised on your website. I am seventeen years old and in my final year at secondary school.

I would very much like to help at the festival for several reasons. Music has always been an important part of my life, and I have attended your festival as a visitor for the last three years. I would now like to see what happens behind the scenes and contribute to an event that means so much to young people in our region.

I believe I have several skills that would be useful. Last year I helped to organise our school's summer concert, where I was responsible for selling tickets and showing guests to their seats. I enjoy working in a team and stay calm in busy situations. I also speak English and Italian fluently, which might be helpful if there are international visitors. Furthermore, I have completed a first aid course.

I would be grateful if you could give me some further information. Could you tell me how many hours volunteers are expected to work each day and whether the shifts include evenings? I would also like to know whether volunteers receive meals or free tickets for the concerts.

I am available on all three days of the festival and would be happy to attend an interview. I look forward to hearing from you.

Yours faithfully,
Robin Ashford`,
  },
  {
    id: "complaint-course",
    niveau: "B2",
    textsorte: "email-formal",
    woerter: 250,
    beschwerde: true,
    situation: "Last month you took part in a two-week English summer course in Dunmore. Several things were not as the brochure had promised.",
    auftrag: "Write an email to the course director, Ms Harper, to complain.",
    punkte: ["describe what the brochure promised", "explain what went wrong", "say what you expect the school to do now"],
    muster: `Dear Ms Harper,

I am writing to complain about the two-week English summer course in Dunmore which I attended in July.

According to your brochure, the course offered small classes of no more than ten students, qualified teachers and single rooms with host families within walking distance of the school. It also promised two excursions every week.

Unfortunately, the reality was very different. My class had eighteen students, which meant that we hardly had any chance to speak. During the first week, our teacher was ill and was replaced by a student who had no teaching experience. Furthermore, I had to share a small room with another student, and my host family lived forty minutes away by bus. As the buses were not reliable, I arrived late several times. Finally, only one excursion took place during the whole course, as the others were cancelled without explanation.

I chose your school because of the excellent reputation described in your brochure, and my parents paid a considerable amount of money for the course. I am therefore extremely disappointed with the service I received.

I would like you to look into these problems and explain why the course was so different from what was advertised. In addition, I expect a partial refund of the course fee, which I believe would be fair. I would also appreciate it if you could make sure that future students do not experience the same problems.

I look forward to your reply.

Yours sincerely,
Kim Sorensen`,
  },
  {
    id: "school-facilities",
    niveau: "B2",
    textsorte: "report",
    woerter: 300,
    situation: "Your head teacher wants to improve the school's facilities and has asked the students' council for a report.",
    auftrag: "Write a report about the facilities at your school.",
    punkte: ["describe the current situation of the common room, the library and the sports facilities", "evaluate which of them need improvement most urgently", "recommend what should be done and give reasons"],
    zusatz: "Give your report a title and use headings.",
    muster: `Report on the School's Facilities

Introduction
The aim of this report is to describe the current state of three areas of our school, namely the common room, the library and the sports facilities, and to recommend which improvements should be made first. The information is based on a survey among 120 students and on interviews with members of the students' council.

The common room
The common room is popular, but it is far too small for the number of students who use it during breaks. There are only twelve chairs, the furniture is old and several lights do not work. Many students said that they prefer to sit in the corridors.

The library
The library has a good collection of books and is a quiet place to study. However, it closes at two o'clock, which means that students who have afternoon lessons cannot use it. In addition, there are only four computers, and they are often too slow for research.

Sports facilities
The gym was renovated two years ago and is in excellent condition. The outdoor sports field, on the other hand, is often muddy and cannot be used for much of the year.

Recommendations
In my view, the common room needs improvement most urgently, since it affects the largest number of students every day. I would recommend replacing the furniture, repairing the lights and, if possible, moving the common room to the empty classroom next to it. The second priority should be the library. Longer opening hours, perhaps until five o'clock, would not be expensive and would help many students. Finally, the school should consider repairing the sports field when the budget allows it.

Conclusion
If these changes are made, the school will become a more comfortable place to learn and relax for everyone.`,
  },
  {
    id: "homework",
    niveau: "B2",
    textsorte: "essay",
    woerter: 350,
    situation: "Your class has been discussing whether homework should be abolished. Your teacher has asked you to write an opinion essay.",
    auftrag: "Write an essay on the question “Should homework be abolished?”.",
    punkte: ["outline the arguments for homework", "discuss the arguments against it", "state and justify your own opinion"],
    muster: `Should Homework Be Abolished?

Hardly any topic causes as many arguments between students, parents and teachers as homework. While some people believe that it is an essential part of learning, others think that it does more harm than good. In this essay, I will look at both sides before giving my own opinion.

There are several good arguments in favour of homework. First of all, practice is necessary to remember what has been learned in class. A new grammar rule or a type of maths problem only really sticks when it is used several times. Secondly, homework teaches young people to organise their time and to work independently, skills which they will need at university and in their jobs. Finally, homework allows parents to see what their children are learning at school and to support them if necessary.

On the other hand, there are strong arguments against homework. Many students already spend six or seven hours a day at school, and after a long day they are simply too tired to learn effectively. Too much homework leaves little time for sport, hobbies, friends and rest, which are just as important for a healthy life. Furthermore, homework can be unfair. Students whose parents can help them or pay for private lessons have a clear advantage over those who have no support at home. As a result, homework can increase the differences between students instead of reducing them.

In my opinion, homework should not be abolished completely, but it should be changed. I believe that short tasks which help students to practise what they have learned are useful, especially before tests. However, teachers should coordinate with each other so that students do not get large amounts of homework from several subjects on the same day. In addition, more time could be given for practice during lessons, where teachers can help students who are struggling.

To sum up, homework has both advantages and disadvantages. Rather than abolishing it, schools should make sure that it is reasonable, purposeful and fair for every student.`,
  },
  {
    id: "reading-comment",
    niveau: "B1",
    textsorte: "blog-comment",
    woerter: 200,
    situation: "You have read a blog post with the title “Teenagers don't read anymore”. The author claims that young people prefer short videos to books.",
    auftrag: "Write a comment on the blog post.",
    punkte: ["say whether you agree with the author", "describe your own reading habits and those of your friends", "suggest how young people could be encouraged to read more"],
    muster: `I read your post with great interest, but I have to say that I only partly agree with you.

It is true that many teenagers spend hours watching short videos, and I am no exception. However, that does not mean that we have stopped reading. In fact, I read every day, although not always books. I read news on my phone, articles about my hobbies and long chats with my friends. In addition, I usually read a novel before I go to sleep, especially fantasy and crime stories. Some of my friends read even more than I do, while others only read what they have to for school. So I think it depends very much on the person.

If you want to encourage young people to read more, I would suggest making reading more social. Book clubs at school, where students choose the books themselves, could be a good start. Libraries could also offer more e-books, because many of us prefer to read on a screen. Finally, it helps when films and series are based on books, since many people want to read the story after they have seen it.

Thanks for starting this discussion!`,
  },
  {
    id: "youth-club",
    niveau: "B1",
    textsorte: "leaflet",
    woerter: 250,
    situation: "Your town is opening a new youth club, and you have been asked to write a leaflet for young people.",
    auftrag: "Write the leaflet.",
    punkte: ["introduce the youth club and the activities it offers", "explain how young people can take part and help to plan the programme", "persuade readers to come to the opening day"],
    zusatz: "Give your leaflet a title and use headings.",
    muster: `Your New Youth Club: The Hangout

What is The Hangout?
From 1 March, our town will finally have a place just for young people between 12 and 18. The Hangout is in the old fire station on Bridge Street, and it is open every afternoon from Monday to Saturday.

What can you do there?
There is something for everyone. You can play table tennis, pool or video games, listen to music or simply chill with your friends on our comfy sofas. If you like being creative, join our art workshop on Tuesdays or use the band practice room, which you can book for free. There is also a quiet room with computers where you can do your homework, and on Thursdays volunteers are there to help with maths and English.

How can you take part?
Membership is free. Just come along, fill in a short form and you will get your membership card. Most importantly, The Hangout is your club, so you decide what happens there. Every month there is a meeting where members plan the programme together. Do you have an idea for a film night, a trip or a sports tournament? Bring it to the meeting and help us make it happen!

Come to our opening day!
Join us on Saturday, 1 March, from 2 pm. There will be free pizza, live music from local bands and a table tennis competition with great prizes. Bring your friends and see for yourself why The Hangout is the place to be.

See you there!`,
  },
];
