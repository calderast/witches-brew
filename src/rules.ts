// Everything a code can be worth, for the Rules tab. Points come from CONFIG so this stays in step with scoring.
import { CONFIG } from "./config";

export interface Rule {
  name: string;
  detail: string;
  example: string;
  points: string;
  row: string; // the rule name score() reports, so tests can check each example triggers it
}

const s = CONFIG.score;
const pts = (n: number) => (n > 0 ? `+${n}` : String(n));

export const RULE_SECTIONS: { title: string; note?: string; rules: Rule[] }[] = [
  {
    title: "Lucky codes",
    rules: [
      { name: "D0B0CE", detail: "The exact code, in order", example: "D0B0CE", points: pts(s.pD0B0CE), row: "D0B0CE" },
      { name: "D0B0CE anagram", detail: "The same six characters in any other order", example: "B0D0EC",
        points: pts(s.pD0B0CEAnagram), row: "D0B0CE anagram" },
      { name: "1031", detail: "Halloween, anywhere in the code", example: "A1031F", points: pts(s.p1031), row: "1031" },
      { name: "16", detail: "A 16 card. It's the warlock's favorite", example: "16A2BC", points: pts(s.p16), row: "16" },
      { name: "Palindrome", detail: "The whole code reads the same backwards", example: "A1BB1A", points: pts(s.pPalindrome), row: "Palindrome" },
      { name: "Palindrome pair", detail: "Two cards are mirror images, like 24 and 42 (not on top of a whole palindrome)",
        example: "24A142", points: pts(s.pPalindromePair), row: "Palindrome pair" },
    ],
  },
  {
    title: "Pairs and doubles",
    note: "Only the best one of these counts.",
    rules: [
      { name: "Two identical doubles", detail: "The same double card twice", example: "AA12AA", points: "+4", row: "Two identical doubles" },
      { name: "Three doubles", detail: "Every card is a double", example: "AA55CC", points: "+3", row: "Three doubles" },
      { name: "Pair of the same", detail: "Two cards match", example: "A37FA3", points: "+2", row: "Pair of the same" },
      { name: "Two doubles", detail: "Two cards are doubles", example: "AABB17", points: "+2", row: "Two doubles" },
      { name: "One double", detail: "One card is a double, like AA or 77", example: "AA17C5", points: "+1", row: "One double" },
    ],
  },
  {
    title: "Patterns",
    rules: [
      ...([3, 4, 5, 6] as const).map((n) => ({
        name: `Run of ${n}`,
        detail: `${n} characters that count up in a row (0–9 then A–F), in any order`,
        example: ["1A2B3F", "12A34F", "12345F", "123456"][n - 3],
        points: pts(s.runPoints[n]),
        row: `Run of ${n}`,
      })),
      { name: "4 of the same", detail: "One character exactly four times (five scores nothing)", example: "A1AA2A", points: "+2",
        row: "4 of the same character" },
      { name: "3 of the same", detail: "One character exactly three times (not 6)", example: "A1A5A9", points: "+1",
        row: "3 of the same character" },
    ],
  },
  {
    title: "Numbers",
    rules: [
      { name: "Primes only", detail: "No letters, and every card is a prime number (07 counts as 7)", example: "230753",
        points: pts(s.pPrimes), row: "Primes only" },
      { name: "13 or 31", detail: "A 13 or 31 card", example: "13A2BC", points: "+1", row: "13 or 31" },
      { name: "One 69", detail: "Exactly one 69 card", example: "69A1B2", points: "+1", row: "One 69" },
    ],
  },
  {
    title: "Bad luck",
    rules: [
      { name: "Cursed", detail: "All three cards the same. Scoring stops here", example: "ABABAB", points: "−5", row: "3 of the same" },
      { name: "Two or more 69s", detail: "Too much of a good thing", example: "6969A1", points: "−5", row: "Two or more 69s" },
      { name: "Exactly three 6s", detail: "Three 6s anywhere in the code", example: "6A6B6C", points: "−1", row: "Exactly three 6s" },
      { name: "67", detail: "A 67 card", example: "67A1B2", points: "−1", row: "67" },
      { name: "Same start", detail: "All three cards start with the same character", example: "A1A2A7", points: "−1", row: "Same first character" },
    ],
  },
];

// Which digits stand in for letters in the word lists.
export const NUMBER_SWAPS = "0 = O, 1 = I or L, 2 = Z, 5 = S, 6 = G, 7 = T";
