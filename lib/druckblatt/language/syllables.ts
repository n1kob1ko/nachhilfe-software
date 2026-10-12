/**
 * Silbentrennung (deutsch) fuer die farbige Silbendarstellung.
 *
 * BEWUSSTE VEREINFACHUNG -- bitte vor dem Erweitern lesen:
 * Dies ist eine phonotaktische Heuristik, kein Woerterbuchverfahren. Sie deckt
 * den Wortschatz ab, der in Lesetabellen der Klassen 1-2 vorkommt (kurze,
 * morphologisch einfache Woerter). Sie kann bauartbedingt NICHT:
 *
 *   - Komposita erkennen           ("Haustuer" -> Haus-tuer, wir: Haus-tu-er)
 *   - Morphemgrenzen beachten      ("beobachten" -> be-ob-ach-ten)
 *   - Fremdwoerter korrekt trennen ("Cha-os" statt "Chaos" als eine Silbe)
 *
 * Bekannte Abhilfe fuer den Nutzer: ein Bindestrich im Eingabewort wird als
 * verbindliche Silbengrenze respektiert ("Haus-tuer" trennt korrekt).
 *
 * Ein Woerterbuchverfahren (z. B. Hyphenopoly/TeX-Muster) ist der geplante
 * Ausbaupfad; die Signatur bleibt dabei stabil, weil der Rest des Systems
 * nur `splitIntoSyllables` kennt.
 */

/** Vokale inkl. Umlaute. `y` zaehlt als Vokal ("Ty-po"). */
const VOWEL_LETTERS = 'aeiouäöüy';

/**
 * Vokalgruppen, die einen einzigen Silbenkern bilden.
 * Laengere zuerst -- die Erkennung greift gierig.
 */
const VOWEL_GROUPS = ['eu', 'äu', 'au', 'ei', 'ai', 'ie', 'aa', 'ee', 'oo'];

/**
 * Konsonantenverbindungen, die nie getrennt werden.
 * Nicht enthalten und damit trennbar -- so will es die aktuelle Rechtschreibung:
 *   st -> Fens-ter,  pf -> Ap-fel,  tz -> Kat-ze,  ng -> sin-gen
 */
const CONSONANT_GROUPS = ['sch', 'ch', 'ck', 'ph', 'th', 'qu', 'sh'];

interface Unit {
  /** Original-Schreibweise (Gross-/Kleinschreibung bleibt erhalten). */
  readonly text: string;
  readonly isVowel: boolean;
}

const isVowelLetter = (char: string): boolean => VOWEL_LETTERS.includes(char);

/**
 * Zerlegt ein Wort in unteilbare Einheiten: Vokalgruppen, Konsonantengruppen
 * und Einzelbuchstaben.
 */
function tokenize(word: string): Unit[] {
  const lower = word.toLowerCase();
  const units: Unit[] = [];
  let i = 0;

  while (i < lower.length) {
    const group =
      CONSONANT_GROUPS.find((g) => lower.startsWith(g, i)) ??
      VOWEL_GROUPS.find((g) => lower.startsWith(g, i));

    if (group !== undefined) {
      units.push({ text: word.slice(i, i + group.length), isVowel: isVowelLetter(group[0]!) });
      i += group.length;
      continue;
    }

    const char = lower[i]!;
    units.push({ text: word.slice(i, i + 1), isVowel: isVowelLetter(char) });
    i += 1;
  }

  return units;
}

/**
 * Bestimmt die Trennstellen zwischen aufeinanderfolgenden Silbenkernen.
 *
 * Regel nach Anzahl der Konsonanteneinheiten zwischen zwei Vokalkernen:
 *   0  -> direkt trennen                        (Bau-er)
 *   1  -> Konsonant geht zur zweiten Silbe      (Va-ter, Zu-cker, la-chen)
 *   >1 -> nur der letzte geht zur zweiten Silbe (Fens-ter, Was-ser)
 *
 * Die Faelle 0 und 1 fallen rechnerisch zusammen, deshalb genuegt eine
 * Fallunterscheidung.
 */
function findBoundaries(units: Unit[]): number[] {
  const nuclei = units.flatMap((unit, index) => (unit.isVowel ? [index] : []));
  const boundaries: number[] = [];

  for (let n = 0; n < nuclei.length - 1; n += 1) {
    const current = nuclei[n]!;
    const next = nuclei[n + 1]!;
    const consonantsBetween = next - current - 1;
    boundaries.push(consonantsBetween === 0 ? current + 1 : next - 1);
  }

  return boundaries;
}

function splitSegment(segment: string): string[] {
  if (segment === '') return [];

  const units = tokenize(segment);
  const boundaries = findBoundaries(units);
  if (boundaries.length === 0) return [segment];

  const syllables: string[] = [];
  let start = 0;

  for (const boundary of [...boundaries, units.length]) {
    syllables.push(
      units
        .slice(start, boundary)
        .map((u) => u.text)
        .join(''),
    );
    start = boundary;
  }

  return syllables.filter((s) => s !== '');
}

/**
 * Zerlegt ein Wort in Silben.
 *
 * @returns Die Silben in Lesereihenfolge. Fuer leere Eingaben ein leeres Array;
 *          `syllables.join('')` ergibt immer wieder das Eingabewort.
 */
export function splitIntoSyllables(word: string): string[] {
  const trimmed = word.trim();
  if (trimmed === '') return [];

  /*
   * Explizite Bindestriche sind verbindliche Grenzen -- so kann eine Lehrkraft
   * Komposita von Hand korrigieren, die die Heuristik nicht kennt.
   * Der Bindestrich selbst bleibt am Ende der vorangehenden Silbe stehen,
   * damit die Rekonstruktion des Originalworts verlustfrei bleibt.
   */
  if (trimmed.includes('-')) {
    return trimmed.split(/(?<=-)/).flatMap((segment) => {
      const core = segment.endsWith('-') ? segment.slice(0, -1) : segment;
      const parts = splitSegment(core);
      if (parts.length === 0) return segment === '-' ? ['-'] : [];
      if (!segment.endsWith('-')) return parts;
      return [...parts.slice(0, -1), `${parts[parts.length - 1]!}-`];
    });
  }

  return splitSegment(trimmed);
}

/** Anzahl der Silben eines Wortes. Nuetzlich fuer Schwierigkeitsfilter. */
export const countSyllables = (word: string): number => splitIntoSyllables(word).length;
