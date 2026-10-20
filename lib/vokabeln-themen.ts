/**
 * Themenlisten des Vokabeltrainers: English and German words for the vocabulary topics of the Volksschule
 * and the Unterstufe, each with an example sentence. Own choice and own order of common everyday words
 * (the first are the most common), own sentences; nothing is taken from a school book. British English
 * first, American English as an alternative where it is another word (rubber; eraser), Austrian German
 * first where it differs (der Jänner; der Januar, die Hausübung; die Hausaufgabe).
 *
 * Every list has three blocks: the first words (level 0), more words (1) and harder ones (2); the levels of
 * an exercise use them as described in lib/vokabeln.ts. The lines are written like a teacher's own list and
 * read by the same parser. Together the lists are the Lexikon: a word that another list gives as a
 * translation also counts (die Bank: bank and bench).
 *
 * A word may stand in its sentence in another form (cats, played). Those sentences are checked by hand so
 * that only the form in the sentence fits the gap ("My brother collects stamps.": "collect" is wrong).
 */
import type { Difficulty, TaskType } from "./curriculum";
import type { Rng } from "./schulbuch-zahlen";
import type { TaskDraft } from "./tasks";
import { baueLexikon, kategorieFuerTyp, leseListe, vokabelAufgabe, type Quelle, type Vokabel } from "./vokabeln";

type Liste = { bloecke: [string, string, string] };

const LISTEN: Record<string, Liste> = {
  // ---------- Volksschule ----------
  "englisch.vs.vocab.zahlen-farben": {
    bloecke: [
      `
one = eins | I have got one brother.
two = zwei | There are two apples on the table.
red = rot | My new bike is red.
three = drei | We have got three cats at home.
blue = blau | The sky is blue today.
four = vier | A dog has got four legs.
five = fünf | I can see five birds in the tree.
green = grün | Frogs are green.
six = sechs | My little sister is six years old.
yellow = gelb | The sun is yellow.
seven = sieben | There are seven days in a week.
eight = acht | A spider has got eight legs.
nine = neun | My brother is nine.
ten = zehn | I have got ten fingers.
black = schwarz | Our cat is black.
white = weiß | Snow is white.
`,
      `
eleven = elf | There are eleven players in a football team.
twelve = zwölf | There are twelve months in a year.
brown = braun | Bears are brown.
orange = orange | My favourite colour is orange.
pink = rosa; pink | Her dress is pink.
purple = lila; violett | Grapes can be purple.
grey = grau | Elephants are grey.
thirteen = dreizehn | My cousin is thirteen years old.
fifteen = fünfzehn | The bus comes in fifteen minutes.
twenty = zwanzig | There are twenty children in my class.
`,
      `
fourteen = vierzehn | Lena is fourteen today.
sixteen = sechzehn | My big sister is sixteen.
seventeen = siebzehn | There are seventeen girls in our school choir.
eighteen = achtzehn | My cousin Tom is eighteen.
nineteen = neunzehn | Our street has got nineteen houses.
thirty = dreißig | There are thirty days in June.
forty = vierzig | My dad is forty years old.
fifty = fünfzig | My grandma has got fifty books.
a hundred; one hundred; hundred = hundert; einhundert | My great-grandpa is almost a hundred years old.
`,
    ],
  },
  "englisch.vs.vocab.familie": {
    bloecke: [
      `
mum = die Mama; die Mutter; die Mami | My mum is a nurse.
dad = der Papa; der Vater; der Papi | My dad likes cooking.
mother = die Mutter; die Mama | Her mother has got long hair.
father = der Vater; der Papa | His father plays the guitar.
sister = die Schwester | My sister is seven.
brother = der Bruder | I have got one brother.
grandma = die Oma; die Großmutter; die Omi | My grandma lives in Graz.
grandpa = der Opa; der Großvater; der Opi | My grandpa has got a red car.
baby = das Baby | The baby is sleeping.
family = die Familie | This is my family.
`,
      `
aunt = die Tante | My aunt has got a big dog.
uncle = der Onkel | My uncle lives in Linz.
parents = die Eltern | My parents work in a shop.
cousin = der Cousin; die Cousine | My cousin is ten years old.
grandmother = die Großmutter; die Oma | Her grandmother bakes great cakes.
grandfather = der Großvater; der Opa | His grandfather was a farmer.
son = der Sohn | Mr Miller has got one son.
daughter = die Tochter | Their daughter is a good swimmer.
`,
      `
grandparents = die Großeltern | My grandparents live on a farm.
twins = die Zwillinge | Anna and Lea are twins.
husband = der Ehemann; der Mann | Her husband is a teacher.
wife = die Ehefrau; die Frau | His wife works at the hospital.
child = das Kind | Every child in the class has got a book.
`,
    ],
  },
  "englisch.vs.vocab.schule": {
    bloecke: [
      `
pen = der Kuli; der Kugelschreiber; die Füllfeder; der Füller | I write with a blue pen.
pencil = der Bleistift | Can I borrow your pencil?
rubber; eraser = der Radiergummi | I need a rubber.
ruler = das Lineal | My ruler is thirty centimetres long.
book = das Buch | Open your book at page ten.
schoolbag = die Schultasche | My schoolbag is very heavy.
teacher = der Lehrer; die Lehrerin | Our teacher is very nice.
desk = der Schreibtisch; das Pult; der Tisch | My desk is next to the window.
chair = der Sessel; der Stuhl | Please sit on your chair.
board = die Tafel | The teacher writes on the board.
classroom = das Klassenzimmer; die Klasse | Our classroom is on the first floor.
`,
      `
coloured pencil = der Buntstift | I need a green coloured pencil.
paper = das Papier | Can I have some paper, please?
glue = der Kleber; der Klebstoff | We need glue for our poster.
scissors = die Schere | Can I use your scissors?
pencil case = das Federpennal; die Federschachtel; das Federmäppchen | My pencil case is full.
sharpener = der Spitzer | Where is my sharpener?
exercise book = das Heft | Write the words in your exercise book.
homework = die Hausübung; die Hausaufgabe; die Hausaufgaben | We have got a lot of homework today.
break = die Pause | We play football in the break.
lesson = die Stunde; die Unterrichtsstunde | Our English lesson starts at nine.
pupil = der Schüler; die Schülerin | There are twenty pupils in our class.
`,
      `
to listen = zuhören | Please listen to the story.
to open = öffnen; aufmachen | Open your books, please.
to close = schließen; zumachen | Close the door, please.
to sit down = sich hinsetzen; sich setzen | Sit down, please.
to stand up = aufstehen | Stand up and come to the board.
to write = schreiben | Write your name on the paper.
to read = lesen | Read the text on page twelve.
`,
    ],
  },
  "englisch.vs.vocab.tiere": {
    bloecke: [
      `
dog = der Hund | My dog loves long walks.
cat = die Katze | The cat is sleeping on the sofa.
horse = das Pferd | I can ride a horse.
cow = die Kuh | The cow gives us milk.
pig = das Schwein | The pig is pink and fat.
bird = der Vogel | A little bird is singing.
fish = der Fisch | Our fish swims in a big bowl.
mouse = die Maus | The mouse is small and grey.
rabbit = das Kaninchen; der Hase | My rabbit eats carrots.
duck = die Ente | The duck is swimming on the lake.
`,
      `
sheep = das Schaf | The sheep is eating grass.
hen = das Huhn; die Henne | The hen lays an egg every day.
lion = der Löwe | The lion is the king of the animals.
elephant = der Elefant | An elephant has got big ears.
monkey = der Affe | The monkey is climbing a tree.
tiger = der Tiger | A tiger has got black stripes.
snake = die Schlange | The snake is long and green.
frog = der Frosch | The frog can jump very high.
bear = der Bär | The bear is looking for honey.
pet = das Haustier | Have you got a pet?
budgie = der Wellensittich | Our budgie is blue and green.
`,
      `
giraffe = die Giraffe | A giraffe has got a very long neck.
zebra = das Zebra | The zebra has got black and white stripes.
crocodile = das Krokodil | The crocodile has got big teeth.
hamster = der Hamster | My hamster sleeps all day.
tortoise; turtle = die Schildkröte | The tortoise is very slow.
guinea pig = das Meerschweinchen | My guinea pig is called Coco.
owl = die Eule | The owl hunts at night.
bee = die Biene | A bee is sitting on the flower.
butterfly = der Schmetterling | The butterfly has got colourful wings.
spider = die Spinne | The spider is in the corner of my room.
`,
    ],
  },
  "englisch.vs.vocab.zeit": {
    bloecke: [
      `
Monday = der Montag | We have English on Monday.
Tuesday = der Dienstag | On Tuesday I go swimming.
Wednesday = der Mittwoch | Wednesday is my favourite day.
Thursday = der Donnerstag | My piano lesson is on Thursday.
Friday = der Freitag | On Friday we have PE.
Saturday = der Samstag | On Saturday we visit grandma.
Sunday = der Sonntag | We sleep long on Sunday.
spring = der Frühling; das Frühjahr | Flowers grow in spring.
summer = der Sommer | It's hot in summer.
autumn; fall = der Herbst | The leaves are brown in autumn.
winter = der Winter | It's cold in winter.
`,
      `
January = der Jänner; der Januar | My birthday is in January.
February = der Februar; der Feber | February is a short month.
March = der März | In March the snow melts.
April = der April | It often rains in April.
May = der Mai | My birthday is in May.
June = der Juni | We go to the lake in June.
July = der Juli | In July we have holidays.
August = der August | August is very hot.
September = der September | School starts in September.
October = der Oktober | In October the leaves turn red.
November = der November | November is often grey and foggy.
December = der Dezember | Christmas is in December.
`,
      `
day = der Tag | A day has got twenty-four hours.
week = die Woche | A week has got seven days.
month = der Monat | My cousin visits us every month.
year = das Jahr | A year has got twelve months.
weekend = das Wochenende | What do you do at the weekend?
birthday = der Geburtstag | Happy birthday, Mia!
today = heute | Today is Monday.
tomorrow = morgen | Tomorrow we go to the zoo.
yesterday = gestern | Yesterday it was sunny.
`,
    ],
  },
  "englisch.vs.vocab.koerper-kleidung": {
    bloecke: [
      `
head = der Kopf | My head hurts.
eye = das Auge | My left eye is red.
nose = die Nase | The clown has got a red nose.
mouth = der Mund | Open your mouth, please.
ear = das Ohr | The rabbit has got long ears.
hand = die Hand | Put up your hand.
foot = der Fuß | My left foot hurts.
leg = das Bein | A chair has got four legs.
hair = die Haare; das Haar | She has got long hair.
arm = der Arm | I broke my arm.
T-shirt = das T-Shirt; das Leiberl | I wear a red T-shirt.
dress = das Kleid | Mia has got a new dress.
shoe = der Schuh | Where is my other shoe?
`,
      `
trousers; pants = die Hose | My trousers are blue.
skirt = der Rock | Her skirt is green.
jumper; sweater; pullover = der Pullover; der Pulli | My jumper is warm.
jacket = die Jacke | Put on your jacket.
cap = die Kappe | My brother always wears a cap.
hat = der Hut | The farmer wears a big hat.
sock = die Socke; der Socken | I can't find my other sock.
scarf = der Schal | My scarf is long and warm.
glove = der Handschuh | I lost a glove at school.
finger = der Finger | I cut my finger.
tooth = der Zahn | My tooth hurts.
knee = das Knie | I hurt my knee.
`,
      `
shoulder = die Schulter | My shoulder hurts.
neck = der Hals; der Nacken | The giraffe has got a long neck.
back = der Rücken | My back hurts.
stomach; tummy = der Bauch | My stomach hurts.
face = das Gesicht | Wash your face, please.
shorts = die kurze Hose; die Shorts | In summer I wear shorts.
raincoat = der Regenmantel | Take your raincoat, it's raining.
pyjamas = der Pyjama | My pyjamas have got stars on them.
toe = die Zehe; der Zeh | My big toe hurts.
`,
    ],
  },
  "englisch.vs.vocab.essen": {
    bloecke: [
      `
apple = der Apfel | I eat an apple every day.
banana = die Banane | I have got a banana in my schoolbag.
bread = das Brot | We buy bread at the bakery.
milk = die Milch | I drink milk for breakfast.
water = das Wasser | Can I have some water, please?
cake = der Kuchen | Grandma makes a chocolate cake.
egg = das Ei | I have an egg for breakfast.
cheese = der Käse | Mice like cheese.
ice cream = das Eis | I love strawberry ice cream.
juice = der Saft | I drink orange juice.
pizza = die Pizza | We eat pizza on Fridays.
`,
      `
orange = die Orange | This orange is very sweet.
pear = die Birne | The pear is yellow and green.
strawberry = die Erdbeere | This strawberry is red and sweet.
carrot = die Karotte; die Möhre | My rabbit eats a carrot every day.
tomato = die Tomate; der Paradeiser | Put a tomato on the pizza.
potato = die Kartoffel; der Erdapfel | I peel a potato for the soup.
sausage = die Wurst; das Würstel | I like a hot sausage with mustard.
chocolate = die Schokolade | I love chocolate.
biscuit; cookie = der Keks | Can I have a biscuit, please?
lemonade = die Limonade | The lemonade is cold.
tea = der Tee | My mum drinks tea.
`,
      `
grape = die Weintraube; die Traube | Give me a grape, please.
cherry = die Kirsche | This cherry is very dark.
breakfast = das Frühstück | Breakfast is at seven.
lunch = das Mittagessen | We have lunch at school.
dinner = das Abendessen | Dinner is ready!
soup = die Suppe | The soup is very hot.
honey = der Honig | Bears love honey.
salad = der Salat | I make a salad with tomatoes.
sandwich = das Sandwich; das belegte Brot | I have a cheese sandwich for lunch.
sweets; candy = die Süßigkeiten; die Zuckerl | Don't eat too many sweets.
`,
    ],
  },
  "englisch.vs.vocab.zuhause": {
    bloecke: [
      `
house = das Haus | We live in a yellow house.
room = das Zimmer | My room is small but nice.
bed = das Bett | My cat sleeps on my bed.
table = der Tisch | The plates are on the table.
door = die Tür | Please close the door.
window = das Fenster | Open the window, please.
kitchen = die Küche | Mum is in the kitchen.
ball = der Ball | Let's play with the ball.
doll = die Puppe | My doll has got blond hair.
toy = das Spielzeug | This toy car is my favourite.
`,
      `
bathroom = das Badezimmer; das Bad | The bathroom is upstairs.
living room = das Wohnzimmer | We watch TV in the living room.
garden = der Garten | We have got a big garden.
sofa; couch = das Sofa; die Couch | The cat is sleeping on the sofa.
lamp = die Lampe | The lamp is on my desk.
cupboard = der Kasten; der Schrank | My clothes are in the cupboard.
teddy bear = der Teddybär | I sleep with my teddy bear.
kite = der Drachen | The kite is flying high.
computer game = das Computerspiel | My brother plays a computer game.
board game = das Brettspiel | We play a board game on Sunday.
`,
      `
stairs = die Stiege; die Treppe | The stairs are very steep.
floor = der Boden; der Fußboden | My toys are on the floor.
wall = die Wand; die Mauer | There is a picture on the wall.
roof = das Dach | The cat is on the roof.
puzzle = das Puzzle | This puzzle has got a hundred pieces.
skateboard = das Skateboard | I ride my skateboard in the park.
bike; bicycle = das Fahrrad; das Rad | I ride my bike to school.
swing = die Schaukel | The swing is in the garden.
slide = die Rutsche | The slide in the park is very long.
`,
    ],
  },

  // ---------- Unterstufe ----------
  "englisch.vocab.freizeit": {
    bloecke: [
      `
hobby = das Hobby | My favourite hobby is drawing.
to play = spielen | We play football after school.
football; soccer = der Fußball | Football is very popular in Austria.
to swim = schwimmen | I can swim very fast.
to read = lesen | I read a book every week.
to dance = tanzen | My sister loves to dance.
to sing = singen | We sing in the school choir.
to ride a bike = Rad fahren; Fahrrad fahren | I ride a bike to school.
to draw = zeichnen | I like to draw animals.
music = die Musik | I listen to music every evening.
friend = der Freund; die Freundin | My best friend lives next door.
team = die Mannschaft; das Team | Our team won the match.
`,
      `
to collect = sammeln | My brother collects stamps.
to meet = treffen; sich treffen | I meet my friends in the park.
to go shopping = einkaufen gehen | We go shopping on Saturday.
to practise = üben | I practise the piano every day.
match = das Match; das Spiel | The match starts at three.
game = das Spiel | Chess is a difficult game.
to win = gewinnen | I hope we win today.
to lose = verlieren | Nobody likes to lose.
club = der Verein; der Klub; der Club | I am in a tennis club.
instrument = das Instrument | Do you play an instrument?
guitar = die Gitarre | My dad plays the guitar.
free time = die Freizeit | What do you do in your free time?
`,
      `
to go skiing = Ski fahren; Schi fahren | We go skiing in February.
to go for a walk = spazieren gehen | We often go for a walk with our dog.
to climb = klettern | We climb in the mountains in summer.
competition = der Wettbewerb | She won a singing competition.
to relax = sich entspannen; entspannen | On Sundays I relax at home.
to join = beitreten; mitmachen | I want to join the drama club.
stadium = das Stadion | The stadium is full of fans.
fan = der Fan | My uncle is a big football fan.
cinema = das Kino | Let's go to the cinema tonight.
`,
    ],
  },
  "englisch.vocab.tagesablauf": {
    bloecke: [
      `
to get up = aufstehen | I get up at half past six.
to wake up = aufwachen | I wake up at six o'clock.
to have breakfast = frühstücken | We have breakfast in the kitchen.
to brush your teeth; to brush (my) teeth = sich die Zähne putzen; die Zähne putzen; Zähne putzen | Don't forget to brush your teeth!
to get dressed = sich anziehen | I get dressed after breakfast.
to go to school = in die Schule gehen; zur Schule gehen | I go to school by bus.
to have lunch = zu Mittag essen; Mittag essen | We have lunch at one o'clock.
to do (my) homework = die Hausübung machen; Hausübung machen; die Hausaufgaben machen; Hausaufgaben machen | After lunch I do my homework.
to go to bed = ins Bett gehen; schlafen gehen | I go to bed at nine.
to have a shower; to take a shower = duschen; sich duschen | I have a shower every morning.
to watch TV = fernsehen; fernschauen | I watch TV in the evening.
to come home = nach Hause kommen; heimkommen | I come home at four o'clock.
`,
      `
alarm clock = der Wecker | My alarm clock rings at six.
in the morning = am Morgen; in der Früh; morgens | I feel tired in the morning.
in the afternoon = am Nachmittag; nachmittags | I play tennis in the afternoon.
in the evening = am Abend; abends | We have dinner in the evening.
at night = in der Nacht; nachts | Owls hunt at night.
always = immer | I always walk to school.
usually = normalerweise; meistens | I usually get up at seven.
often = oft | We often play cards.
sometimes = manchmal | Sometimes I'm late for school.
never = nie; niemals | I never drink coffee.
half past seven = halb acht | The film starts at half past seven.
quarter past eight = Viertel nach acht | School starts at quarter past eight.
`,
      `
to tidy up = aufräumen | I tidy up my room on Saturdays.
to get ready = sich fertig machen | I get ready for school.
to set the table = den Tisch decken | Can you set the table, please?
to do the washing-up = abwaschen; das Geschirr abwaschen; abspülen | After dinner I do the washing-up.
to feed = füttern | I feed the dog every evening.
daily routine = der Tagesablauf | My daily routine is boring.
to hurry = sich beeilen | We have to hurry.
to fall asleep = einschlafen | I usually fall asleep at ten.
`,
    ],
  },
  "englisch.vocab.wohnen": {
    bloecke: [
      `
flat; apartment = die Wohnung | We live in a flat on the third floor.
house = das Haus | Their house has got a big garden.
bedroom = das Schlafzimmer | My bedroom is next to the bathroom.
bathroom = das Badezimmer; das Bad | The bathroom is upstairs.
kitchen = die Küche | We eat in the kitchen.
living room = das Wohnzimmer | The TV is in the living room.
garden = der Garten | My dad works in the garden.
floor = der Stock; das Stockwerk; die Etage | We live on the second floor.
stairs = die Stiege; die Treppe | Go up the stairs.
wardrobe = der Kleiderkasten; der Kleiderschrank | My clothes are in the wardrobe.
bed = das Bett | My bed is very comfortable.
`,
      `
fridge = der Kühlschrank | The milk is in the fridge.
cooker; stove = der Herd | Don't touch the cooker.
shelf = das Regal | My books are on the shelf.
carpet = der Teppich | There is a blue carpet in my room.
curtain = der Vorhang | Can you close the curtain?
mirror = der Spiegel | There is a mirror in the bathroom.
cellar; basement = der Keller | Our bikes are in the cellar.
attic = der Dachboden | Old toys are in the attic.
neighbour = der Nachbar; die Nachbarin | Our neighbour has got a cat.
pillow = der Polster; das Kissen | My pillow is soft.
blanket = die Decke; die Bettdecke | I need a warm blanket.
`,
      `
to move = umziehen | We move to Vienna next month.
to rent = mieten | They rent a small flat.
furniture = die Möbel | We need new furniture.
dishwasher = der Geschirrspüler; die Spülmaschine | Put the plates in the dishwasher.
washing machine = die Waschmaschine | The washing machine is in the bathroom.
balcony = der Balkon | We have breakfast on the balcony.
upstairs = oben; im oberen Stock | My room is upstairs.
downstairs = unten; im unteren Stock | The kitchen is downstairs.
heating = die Heizung | The heating is on.
rubbish bin; bin; trash can = der Mistkübel; der Mülleimer | Put the paper in the rubbish bin.
`,
    ],
  },
  "englisch.vocab.essen": {
    bloecke: [
      `
breakfast = das Frühstück | What do you have for breakfast?
lunch = das Mittagessen | Lunch is at half past twelve.
dinner = das Abendessen | We have dinner at seven.
vegetables = das Gemüse | We buy fresh vegetables at the market.
fruit = das Obst | I eat a lot of fruit.
meat = das Fleisch | My brother doesn't eat meat.
chicken = das Hähnchen; das Hendl; das Huhn | We have chicken and rice today.
rice = der Reis | Rice is popular in Asia.
potato = die Kartoffel; der Erdapfel | A potato grows under the ground.
salt = das Salz | Can you pass me the salt, please?
sugar = der Zucker | I don't take sugar in my tea.
plate = der Teller | Put the plate on the table.
glass = das Glas | Can I have a glass of water?
`,
      `
knife = das Messer | Be careful, the knife is sharp.
fork = die Gabel | You eat spaghetti with a fork.
spoon = der Löffel | I need a spoon for my soup.
cup = die Tasse; das Häferl | Would you like a cup of tea?
to cook = kochen | My dad likes to cook.
to bake = backen | Let's bake a cake for mum.
to cut = schneiden | Cut the tomatoes into small pieces.
to taste = schmecken; kosten | The soup tastes good.
hungry = hungrig | I'm hungry. Let's eat!
thirsty = durstig | Can I have some water? I'm thirsty.
delicious = köstlich; lecker | This cake is delicious.
menu = die Speisekarte | Can I see the menu, please?
waiter = der Kellner; die Kellnerin | The waiter brings our drinks.
`,
      `
bill; check = die Rechnung | Can we have the bill, please?
to order = bestellen | I'd like to order a pizza.
tip = das Trinkgeld | We give the waiter a tip.
recipe = das Rezept | This is my grandma's recipe.
ingredient = die Zutat | Flour is an important ingredient.
flour = das Mehl | We need flour and eggs.
to fry = braten | Fry the onions in a pan.
pan = die Pfanne | The pan is very hot.
pot = der Topf | Put the potatoes in the pot.
bowl = die Schüssel; die Schale | Put the salad in a bowl.
vegetarian = der Vegetarier; die Vegetarierin; vegetarisch | My sister is a vegetarian.
spicy = scharf | This curry is very spicy.
sweet = süß | These apples are very sweet.
`,
    ],
  },
  "englisch.vocab.kleidung": {
    bloecke: [
      `
clothes = die Kleidung; das Gewand; die Kleider | I need new clothes for the party.
T-shirt = das T-Shirt; das Leiberl | This T-shirt is too small.
trousers; pants = die Hose | My trousers are dirty.
jeans = die Jeans | I wear jeans every day.
dress = das Kleid | She wears a long dress.
skirt = der Rock | Her skirt is very short.
jacket = die Jacke | It's cold. Take a jacket.
shoe = der Schuh | This shoe is too small.
trainers; sneakers = die Turnschuhe; die Sportschuhe | I need new trainers for PE.
shop; store = das Geschäft; der Laden; der Shop | The shop opens at nine.
to buy = kaufen | I want to buy a new bag.
money = das Geld | I haven't got enough money.
`,
      `
to try on = anprobieren | Can I try on these jeans?
size = die Größe | What size are you?
expensive = teuer | This jacket is too expensive.
cheap = billig; günstig | These shoes are cheap.
price = der Preis | What's the price of this cap?
to pay = zahlen; bezahlen | Can I pay by card?
to cost = kosten | How much does this T-shirt cost?
shopping centre; mall = das Einkaufszentrum | We meet at the shopping centre.
changing room = die Umkleidekabine | The changing room is over there.
sale = der Abverkauf; der Ausverkauf; der Sale | There is a sale at the sports shop.
bag = die Tasche; die Tüte; das Sackerl | Do you need a bag?
`,
      `
customer = der Kunde; die Kundin | The customer wants to pay.
shop assistant = der Verkäufer; die Verkäuferin | The shop assistant is very friendly.
receipt = der Kassenbon; der Kassazettel; die Quittung | Keep the receipt.
to fit = passen | These shoes don't fit.
to look for = suchen | I'm looking for a red scarf.
cash = das Bargeld | Do you pay in cash?
credit card = die Kreditkarte | Can I pay with a credit card?
pocket money = das Taschengeld | I get ten euros pocket money a week.
to save = sparen | I save money for a new bike.
uniform = die Uniform | Many British pupils wear a school uniform.
fashion = die Mode | She is interested in fashion.
belt = der Gürtel | These trousers need a belt.
`,
    ],
  },
  "englisch.vocab.stadt": {
    bloecke: [
      `
town = die Stadt; die Kleinstadt | I live in a small town.
city = die Stadt; die Großstadt | Vienna is a big city.
street = die Straße | Our street is very quiet.
road = die Straße | Be careful when you cross the road.
bus stop = die Bushaltestelle; die Haltestelle | The bus stop is near my school.
station = der Bahnhof | The train leaves the station at ten.
bank = die Bank | I take money from the bank.
bench = die Bank; die Parkbank | Let's sit on the bench.
park = der Park | We play football in the park.
hospital = das Krankenhaus; das Spital | My aunt works at the hospital.
church = die Kirche | The church is next to the school.
library = die Bücherei; die Bibliothek | I borrow books from the library.
supermarket = der Supermarkt | Mum buys food at the supermarket.
`,
      `
left = links | Turn left at the bank.
right = rechts | The museum is on the right.
straight on = geradeaus | Go straight on to the traffic lights.
traffic lights = die Ampel | Stop at the traffic lights.
corner = die Ecke; das Eck | The café is on the corner.
crossroads; junction = die Kreuzung | Turn right at the crossroads.
bridge = die Brücke | The bridge goes over the river.
museum = das Museum | The museum is closed on Mondays.
post office = die Post; das Postamt | I send a parcel at the post office.
pavement; sidewalk = der Gehsteig; der Gehweg; der Bürgersteig | Walk on the pavement, not on the road.
car = das Auto | My mum drives a small car.
bus = der Bus | I go to school by bus.
train = der Zug | The train to Salzburg is late.
underground; subway = die U-Bahn | We take the underground to the city centre.
`,
      `
to cross = überqueren | Look left and right before you cross the street.
to turn = abbiegen | Turn left at the church.
traffic = der Verkehr | There is a lot of traffic in the morning.
tram = die Straßenbahn; die Bim | Take the tram to the museum.
roundabout = der Kreisverkehr | Take the second exit at the roundabout.
car park; parking lot = der Parkplatz | The car park is behind the supermarket.
entrance = der Eingang | Where is the entrance?
exit = der Ausgang | The exit is on the left.
opposite = gegenüber | The bank is opposite the station.
next to = neben | The café is next to the bakery.
between = zwischen | The shop is between the bank and the bakery.
far = weit | Is it far to the station?
map = der Stadtplan; die Karte | Let's look at the map.
`,
    ],
  },
  "englisch.vocab.gefuehle": {
    bloecke: [
      `
happy = glücklich; froh | I'm happy because it's my birthday.
sad = traurig | Why are you sad?
angry = wütend; böse; sauer | My dad is angry with me.
tired = müde | I'm tired after the long walk.
scared; afraid = ängstlich; verängstigt | My little brother is scared of the dark.
bored = gelangweilt | I'm bored. Let's do something.
excited = aufgeregt; gespannt | We are excited about the trip.
nervous = nervös; aufgeregt | I'm nervous before a test.
friendly = freundlich; nett | Our neighbour is very friendly.
funny = lustig; witzig | My uncle tells funny jokes.
nice = nett; schön | Your sister is really nice.
`,
      `
surprised = überrascht | I was surprised to see you.
curious = neugierig | My little brother is very curious.
proud = stolz | I'm proud of my little sister.
shy = schüchtern | The new girl is very shy.
lazy = faul | Don't be so lazy!
clever; smart = klug; schlau; gescheit | Your brother is very clever.
kind = freundlich; nett | It was very kind of you to help me.
honest = ehrlich | Always be honest with your friends.
polite = höflich | It's polite to say thank you.
rude = unhöflich; frech | Don't be rude to your teacher.
brave = mutig; tapfer | The brave firefighter saved the cat.
`,
      `
jealous = eifersüchtig; neidisch | My sister is jealous of my new phone.
disappointed = enttäuscht | I was disappointed with my mark.
embarrassed = verlegen | I was so embarrassed when I fell.
lonely = einsam | The old man feels lonely.
confident = selbstbewusst; selbstsicher | She is a confident speaker.
patient = geduldig | You have to be patient with little children.
reliable = zuverlässig | Tom is a reliable friend.
generous = großzügig | My grandpa is very generous.
mood = die Laune; die Stimmung | My dad is in a good mood today.
feeling = das Gefühl | I have a bad feeling about this.
to cry = weinen | The baby cries a lot.
to laugh = lachen | We laughed a lot yesterday.
`,
    ],
  },
  "englisch.vocab.gesundheit": {
    bloecke: [
      `
head = der Kopf | My head hurts.
stomach = der Magen; der Bauch | My stomach hurts after lunch.
back = der Rücken | I have pain in my back.
tooth = der Zahn | My tooth hurts when I eat ice cream.
doctor = der Arzt; die Ärztin | I have to go to the doctor.
ill; sick = krank | I'm ill today and I can't go to school.
to hurt = wehtun; schmerzen | My leg hurts.
headache = das Kopfweh; die Kopfschmerzen | I've got a headache.
cold = die Erkältung; die Verkühlung; der Schnupfen | I've got a cold.
medicine = die Medizin; das Medikament | Take this medicine three times a day.
`,
      `
fever; temperature = das Fieber | My little brother has got a fever.
cough = der Husten | I've got a bad cough.
to sneeze = niesen | I sneeze a lot in spring.
sore throat = das Halsweh; die Halsschmerzen | I've got a sore throat.
nurse = die Krankenpflegerin; der Krankenpfleger; die Krankenschwester | The nurse gives me a plaster.
plaster = das Pflaster | Put a plaster on your finger.
to break = brechen | Be careful or you will break your arm.
hospital = das Krankenhaus; das Spital | He is in hospital with a broken leg.
healthy = gesund | Fruit and vegetables are healthy.
to rest = sich ausruhen | You should rest in bed.
`,
      `
injury = die Verletzung | It's only a small injury.
to bleed = bluten | My nose is bleeding.
pain = der Schmerz; die Schmerzen | I feel a sharp pain in my knee.
to feel sick = mir ist schlecht; mir ist übel | I feel sick after the boat trip.
ambulance = die Rettung; der Krankenwagen | Call an ambulance!
emergency = der Notfall | In an emergency you call 144.
to recover = sich erholen; gesund werden | I hope you recover soon.
appointment = der Termin | I have an appointment at four.
dentist = der Zahnarzt; die Zahnärztin | I go to the dentist twice a year.
pill = die Tablette | Take one pill after dinner.
allergic = allergisch | I'm allergic to cats.
blood = das Blut | Blood is red.
`,
    ],
  },
  "englisch.vocab.natur": {
    bloecke: [
      `
weather = das Wetter | The weather is nice today.
sun = die Sonne | The sun is shining.
rain = der Regen | I love the sound of rain.
snow = der Schnee | The children play in the snow.
wind = der Wind | The wind is very strong today.
cloud = die Wolke | There isn't a cloud in the sky.
sunny = sonnig | It's sunny and warm.
rainy = regnerisch | It's a rainy day.
cold = kalt | It's very cold in January.
hot = heiß | It's hot in August.
warm = warm | The water is nice and warm.
`,
      `
cloudy = bewölkt; wolkig | It's cloudy, but it isn't raining.
windy = windig | It's very windy at the lake.
foggy = neblig | It's foggy in the morning.
storm = der Sturm; das Unwetter; das Gewitter | The storm is very loud.
thunderstorm = das Gewitter | We stayed inside during the thunderstorm.
sky = der Himmel | The sky is grey today.
forest; wood = der Wald | We go for a walk in the forest.
mountain = der Berg | We climb a mountain in summer.
lake = der See | We swim in the lake.
river = der Fluss | The Danube is a long river.
tree = der Baum | There is a bird in the tree.
flower = die Blume | This flower smells nice.
`,
      `
environment = die Umwelt | We must protect the environment.
to protect = schützen | We must protect the forests.
to recycle = recyceln; wiederverwerten | We recycle glass and paper.
rubbish; trash = der Müll; der Abfall | Don't leave rubbish in the park.
pollution = die Verschmutzung; die Umweltverschmutzung | Air pollution is a big problem.
temperature = die Temperatur | The temperature is low today.
degree = der Grad | It's minus five degrees today.
island = die Insel | We spent our holidays on an island.
coast = die Küste | We drove along the coast.
climate = das Klima | The climate is changing.
to waste = verschwenden | Don't waste water.
energy = die Energie | Turn off the lights to save energy.
`,
    ],
  },
  "englisch.vocab.reisen": {
    bloecke: [
      `
holiday; vacation = der Urlaub; die Ferien | We go on holiday in July.
trip = die Reise; der Ausflug | Our school trip was great.
journey = die Reise; die Fahrt | The journey to Italy takes six hours.
suitcase = der Koffer | My suitcase is very heavy.
ticket = die Fahrkarte; der Fahrschein; das Ticket | I need a ticket to Graz.
plane; aeroplane = das Flugzeug | The plane lands at ten.
airport = der Flughafen | We go to the airport by taxi.
hotel = das Hotel | Our hotel is near the beach.
beach = der Strand | We play volleyball on the beach.
sea = das Meer; die See | The sea is warm in August.
passport = der Reisepass; der Pass | Don't forget your passport!
`,
      `
to travel = reisen | I love to travel.
to pack = packen; einpacken | I pack my bag the night before.
luggage; baggage = das Gepäck | Our luggage is in the car.
tent = das Zelt | We sleep in a tent.
campsite = der Campingplatz | The campsite is next to a lake.
abroad = im Ausland; ins Ausland | My cousin works abroad.
to book = buchen | We book our hotel online.
guide = der Reiseleiter; die Reiseleiterin; der Fremdenführer; der Guide | The guide shows us the old town.
sightseeing = die Besichtigung; das Sightseeing | We go sightseeing in London.
souvenir = das Andenken; das Souvenir | I buy a souvenir for my grandma.
postcard = die Ansichtskarte; die Postkarte | I write a postcard to my friend.
`,
      `
to arrive = ankommen | The train arrives at six.
to leave = abfahren; verlassen | The bus leaves at eight.
delay = die Verspätung | There is a delay of twenty minutes.
platform = der Bahnsteig; das Gleis | The train leaves from platform three.
flight = der Flug | The flight takes two hours.
to check in = einchecken | We have to check in two hours early.
accommodation = die Unterkunft | The accommodation was clean and cheap.
single room = das Einzelzimmer | I'd like a single room, please.
view = die Aussicht; der Blick | The view from the mountain is amazing.
border = die Grenze | We crossed the border to Italy.
currency = die Währung | The currency in Britain is the pound.
`,
    ],
  },
  "englisch.vocab.berufe": {
    bloecke: [
      `
job = der Beruf; die Arbeit; der Job | What's your mum's job?
teacher = der Lehrer; die Lehrerin | My aunt is a teacher.
doctor = der Arzt; die Ärztin | The doctor works at the hospital.
nurse = die Krankenpflegerin; der Krankenpfleger; die Krankenschwester | The nurse helps the doctor.
police officer = der Polizist; die Polizistin | The police officer stops the car.
firefighter = der Feuerwehrmann; die Feuerwehrfrau | The firefighter is very brave.
farmer = der Bauer; die Bäuerin; der Landwirt | The farmer has got a lot of cows.
cook; chef = der Koch; die Köchin | The cook makes great pasta.
shop assistant = der Verkäufer; die Verkäuferin | The shop assistant is very helpful.
bus driver = der Busfahrer; die Busfahrerin | The bus driver says hello every morning.
vet = der Tierarzt; die Tierärztin | We take our dog to the vet.
`,
      `
hairdresser = der Friseur; die Friseurin; der Frisör; die Frisörin | The hairdresser cuts my hair.
mechanic = der Mechaniker; die Mechanikerin | The mechanic repairs our car.
pilot = der Pilot; die Pilotin | The pilot flies the plane.
baker = der Bäcker; die Bäckerin | The baker gets up at three o'clock.
waiter = der Kellner; die Kellnerin | The waiter brings the menu.
secretary = der Sekretär; die Sekretärin | The secretary answers the phone.
engineer = der Ingenieur; die Ingenieurin | My uncle is an engineer.
scientist = der Wissenschaftler; die Wissenschaftlerin | The scientist works in a lab.
plumber = der Installateur; die Installateurin | The plumber repairs the shower.
to work = arbeiten | My parents work in a big hotel.
office = das Büro | My mum's office is in the city centre.
`,
      `
to earn = verdienen | She earns a lot of money.
salary = das Gehalt | His salary is very good.
boss = der Chef; die Chefin | My dad's boss is very strict.
colleague = der Kollege; die Kollegin | Her new colleague is very nice.
company = die Firma; das Unternehmen | He works for a big company.
to apply for = sich bewerben um; sich bewerben | I want to apply for a job in a hotel.
interview = das Vorstellungsgespräch; das Interview | I have an interview tomorrow.
experience = die Erfahrung | She has a lot of experience.
part-time = Teilzeit; in Teilzeit | My mum works part-time.
unemployed = arbeitslos | He is unemployed at the moment.
career = die Karriere; die Laufbahn | She wants a career in music.
apprenticeship = die Lehre; die Lehrstelle | My brother is doing an apprenticeship as a mechanic.
`,
    ],
  },
  "englisch.vocab.medien": {
    bloecke: [
      `
mobile phone; mobile; cell phone = das Handy; das Mobiltelefon | My mobile phone is in my bag.
computer = der Computer | I use the computer for my homework.
laptop = der Laptop | My laptop is very fast.
tablet = das Tablet | I read e-books on my tablet.
internet = das Internet | Can you find it on the internet?
email; e-mail = die E-Mail; das E-Mail; die Mail | I write an email to my teacher.
message = die Nachricht | I got a message from my friend.
screen = der Bildschirm | Don't sit too close to the screen.
keyboard = die Tastatur | My keyboard is broken.
website = die Website; die Webseite | Our school has got a new website.
video = das Video | We watch a funny video.
`,
      `
to download = herunterladen | You can download the app for free.
to send = schicken; senden | Send me a text tonight.
to search = suchen | I search for information online.
password = das Passwort | Never tell anybody your password.
app = die App | This app is great for learning words.
to charge = aufladen | I have to charge my phone.
battery = der Akku; die Batterie | My battery is almost empty.
headphones = die Kopfhörer | I listen to music with my headphones.
camera = die Kamera | This camera takes great photos.
to click = klicken | Click on the blue button.
link = der Link | Send me the link, please.
`,
      `
to post = posten | She posts photos every day.
online = online | We had our lesson online.
social media = die sozialen Medien | Many teenagers use social media every day.
news = die Nachrichten | My dad watches the news at eight.
newspaper = die Zeitung | My grandpa reads the newspaper every morning.
advertisement; advert; ad = die Werbung; die Anzeige | There is an advert for the new phone.
channel = der Sender; der Kanal | Which channel is the film on?
to delete = löschen | Delete the old photos.
to print = drucken; ausdrucken | Can you print this page for me?
screen time = die Bildschirmzeit | My screen time is too long.
podcast = der Podcast | I listen to a podcast on the way to school.
user = der Nutzer; die Nutzerin; der Benutzer; die Benutzerin | Every user needs a password.
`,
    ],
  },
  "englisch.vocab.false-friends": {
    bloecke: [
      `
to become = werden | I want to become a vet.
to get; to receive = bekommen; erhalten | I get pocket money every week.
also = auch | I also like pizza.
so = also; deshalb | It was raining, so we stayed at home.
handy = praktisch | This app is really handy.
mobile phone = das Handy | I left my mobile phone at home.
chef = der Koch; die Köchin | My uncle is a chef in a hotel.
boss = der Chef; die Chefin | My boss is very nice.
gift = das Geschenk | This book is a gift from my aunt.
poison = das Gift | This mushroom contains poison.
`,
      `
sensible = vernünftig | It's sensible to wear a helmet.
sensitive = sensibel; empfindlich | My skin is very sensitive.
kind = nett; freundlich | It's very kind of you.
child = das Kind | Every child needs love.
where = wo | Where do you live?
who = wer | Who is that girl?
fast = schnell | My brother runs very fast.
almost = fast | I'm almost ready.
rock = der Felsen | The children are sitting on a big rock.
skirt = der Rock | Her skirt is blue.
map = die Landkarte; die Karte | Look at the map of Europe.
folder = die Mappe; der Ordner | Put the worksheets in your folder.
`,
      `
eventually = schließlich; letztendlich; am Ende | Eventually we found the hotel.
possibly = eventuell; möglicherweise | We will possibly come tomorrow.
actually = eigentlich; tatsächlich | Actually, I don't like pizza very much.
currently = derzeit; zurzeit; aktuell | My dad is currently in Spain.
brave = mutig; tapfer | The brave girl saved her friend.
well-behaved = brav | Our dog is very well-behaved.
meaning = die Bedeutung | What's the meaning of this word?
opinion = die Meinung | In my opinion the film is boring.
bald = glatzköpfig; kahl | My uncle is bald.
soon = bald | See you soon!
art = die Kunst | Art is my favourite subject.
kind; sort = die Art; die Sorte | What kind of music do you like?
`,
    ],
  },
};

/** The words of every topic list, with their level (block 0, 1 or 2). */
export const VOKABEL_THEMEN: Record<string, Vokabel[]> = Object.fromEntries(
  Object.entries(LISTEN).map(([id, l]) => [
    id,
    l.bloecke.flatMap((text, stufe) =>
      leseListe(text).eintraege.map((e) => ({
        ...e,
        stufe: stufe as 0 | 1 | 2,
      })),
    ),
  ]),
);
/** The raw lines (for the tests: every line reads without an error or a hint). */
export const VOKABEL_THEMEN_TEXT: Record<string, string[]> = Object.fromEntries(Object.entries(LISTEN).map(([id, l]) => [id, l.bloecke]));

/** All topic lists together: what else a word may mean. */
export const LEXIKON = baueLexikon(Object.values(VOKABEL_THEMEN));

export const istVokabelThema = (id: string | null | undefined): id is string => Boolean(id && VOKABEL_THEMEN[id]);

const quelle = (id: string): Quelle => ({
  eintraege: VOKABEL_THEMEN[id],
  thema: true,
  lexikon: LEXIKON,
  vs: id.includes(".vs."),
});

/**
 * A task of the builder for a vocabulary topic (or a Teilfähigkeit of one). Null: not a vocabulary topic, or
 * a free answer was asked for (lib/generators.ts makes it).
 */
export function vokabelFuerSlot(
  slot: {
    skillId: string;
    generatorSkillId?: string;
    difficulty: Difficulty;
    category: string | null;
  },
  rng: Rng,
): TaskDraft | null {
  const id = istVokabelThema(slot.skillId) ? slot.skillId : istVokabelThema(slot.generatorSkillId) ? slot.generatorSkillId : null;
  if (!id) return null;
  const out = vokabelAufgabe(quelle(id), {
    category: slot.category,
    difficulty: slot.difficulty,
    rng,
  });
  if (!out) return null;
  return {
    ...out.task,
    skillId: slot.skillId,
    skillIds: [...new Set([slot.skillId, id])],
    category: out.category,
  };
}

/** A task in an answer format (generateBuiltIn: recommendations, Überprüfungen). "mixed": written, multiple choice or a gap. */
export function vokabelFuerTyp(skillId: string, taskType: TaskType | "mixed", difficulty: Difficulty, rng: Rng): TaskDraft {
  const out = vokabelAufgabe(quelle(skillId), {
    category: kategorieFuerTyp(taskType, rng),
    difficulty,
    rng,
  })!;
  return { ...out.task, skillId, skillIds: [skillId], category: out.category };
}

/** Generators for lib/generators.ts (GEN): every vocabulary topic has built-in tasks. */
export const VOKABEL_GENERATOREN: Record<string, (rng: Rng, difficulty: Difficulty) => TaskDraft> = Object.fromEntries(
  Object.keys(LISTEN).map((id) => [id, (rng: Rng, difficulty: Difficulty) => vokabelFuerTyp(id, "mixed", difficulty, rng)]),
);
