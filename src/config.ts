// Every tunable value lives here so the organizer can change them without touching code.

export type RGB = [number, number, number];
export type PaintName = "red" | "yellow" | "blue" | "white" | "black";

export const CONFIG = {
  // Estimates of typical craft paint (sRGB). Replace with phone readings of the real paints.
  paints: {
    red: [255, 39, 2],
    yellow: [254, 236, 0],
    blue: [0, 33, 133],
    white: [255, 255, 255],
    black: [20, 16, 16],
  } as Record<PaintName, RGB>,

  // Difficulty: recipes of up to `simpleParts` parts set the tier.
  simpleParts: 5,
  maxParts: 10,
  partPenalty: 0.02,
  tiers: [
    { name: "Easy", below: 5, flavor: "A gentle simmer. This brew practically stirs itself." },
    { name: "Medium", below: 10, flavor: "Bubble, bubble. A steady hand will see you through." },
    { name: "Hard", below: 20, flavor: "The cauldron resists. Measure every dab with care." },
    { name: "Brutal", below: Infinity, flavor: "Cursed! No witch alive can brew this exactly. Get close and pray." },
  ],

  // Judging the mixed swatch against the target.
  // `name` is the tier saved with each guess; `label` is what players see.
  judging: [
    { name: "Spot On", label: "perfect", below: 5 },
    { name: "Close", label: "close enough", below: 10 },
    { name: "Passable", label: "convince me", below: 20 },
    { name: "Miss", label: "miss", below: Infinity },
  ],

  // House points rules (port of score_reference.py).
  score: {
    wordCap: 5 as number | null, // max total points from words (null = no cap)
    allowNumberSwaps: true, // false = only A-F letters can be used in words
    p1031: 5,
    pPrimes: 3, // all digits, and every card is a prime number
    p16: 10, // a 16 card: the warlock's favorite
    pPalindrome: 5,
    pPalindromePair: 2, // two cards that mirror each other, like 24 and 42
    pD0B0CE: 20,
    pD0B0CEAnagram: 10, // any other order of the same six characters
    runPoints: { 3: 1, 4: 2, 5: 3, 6: 5 } as Record<number, number>,
    wordPoints: { 3: 1, 4: 1, 5: 2, 6: 3 } as Record<number, number>, // points per word, by length
    spookyBonus: 2, // extra point for a word flagged Spooky
  },
};
