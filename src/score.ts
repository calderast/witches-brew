// Port of score_reference.py (house scoring rules). Keep behavior identical to the Python.
import { CONFIG } from "./config";

const HEX = "0123456789ABCDEF";

export interface Word {
  word: string;
  spelled: string;
  length: number;
  spooky: boolean;
}

export interface ScoreResult {
  code: string;
  total: number;
  rows: [string, number][];
  words: FoundWord[]; // in word-list order, like the Python
  ended: boolean;
}

export interface FoundWord {
  word: string;
  points: number;
  spooky: boolean;
}

/** Minimal CSV parser (handles quoted fields). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().replace(/^﻿/, ""));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

export function parseWords(text: string): Word[] {
  return parseCsv(text).map((r) => ({
    word: r["Word"],
    spelled: r["Spelled in hex"].toUpperCase(),
    length: parseInt(r["Length"], 10),
    spooky: r["Spooky"].toLowerCase().startsWith("y"),
  }));
}

// Every data/*words*.csv is loaded and merged. With none, the Words rule is skipped.
const wordFiles = import.meta.glob("../data/*words*.csv", { query: "?raw", import: "default", eager: true });
const wordTexts = Object.values(wordFiles) as string[];
export const WORDS: Word[] | null = wordTexts.length ? dedupe(wordTexts.flatMap(parseWords)) : null;

function dedupe(words: Word[]): Word[] {
  const seen = new Set<string>();
  return words.filter((w) => {
    const key = `${w.word}|${w.spelled}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

const isPrime = (n: number) => {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
};

function longestRun(s: string): number {
  const v = [...new Set([...s].map((c) => HEX.indexOf(c)))].sort((a, b) => a - b);
  let best = 1, cur = 1;
  for (let i = 1; i < v.length; i++) {
    cur = v[i] === v[i - 1] + 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
  }
  return best;
}

function counts(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of s) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
}

const fits = (spelled: string, have: Map<string, number>) =>
  [...counts(spelled)].every(([c, n]) => (have.get(c) ?? 0) >= n);

export function score(code: string, cfg = CONFIG.score, words: Word[] | null = WORDS): ScoreResult {
  const s = [...code.toUpperCase()].filter((c) => HEX.includes(c)).join("");
  if (s.length !== 6) throw new Error("code must have 6 hex digits");
  const p = [s.slice(0, 2), s.slice(2, 4), s.slice(4, 6)];
  const rows: [string, number][] = [];

  if (p[0] === p[1] && p[1] === p[2]) {
    return { code: s, total: -5, rows: [["3 of the same", -5]], words: [], ended: true };
  }

  const dbl = p.map((x) => x[0] === x[1]);
  const nd = dbl.filter(Boolean).length;
  const eq = ([[0, 1], [0, 2], [1, 2]] as const).filter(([i, j]) => p[i] === p[j]);
  let fam: [number, string | null] = [0, null];
  if (eq.length) fam = dbl[eq[0][0]] ? [4, "Two identical doubles"] : [2, "Pair of the same"];
  if (nd === 3 && fam[0] < 3) fam = [3, "Three doubles"];
  else if (nd === 2 && fam[0] < 2) fam = [2, "Two doubles"];
  else if (nd === 1 && fam[0] < 1) fam = [1, "One double"];
  if (fam[0]) rows.push([fam[1]!, fam[0]]);

  if ([...s].filter((c) => c === "6").length === 3) rows.push(["Exactly three 6s", -1]);
  const n69 = p.filter((x) => x === "69").length;
  if (n69 === 1) rows.push(["One 69", 1]);
  else if (n69 >= 2) rows.push(["Two or more 69s", -5]);
  if (p.includes("67")) rows.push(["67", -1]);
  if (p[0][0] === p[1][0] && p[1][0] === p[2][0]) rows.push(["Same first character", -1]);

  // All digits, and every card is a prime number (07 counts as 7)
  if (/^\d+$/.test(s) && p.every((x) => isPrime(parseInt(x, 10)))) rows.push(["Primes only", cfg.pPrimes]);
  if (p.includes("13") || p.includes("31")) rows.push(["13 or 31", 1]);
  if (p.includes("16")) rows.push(["16", cfg.p16]);
  if (s.includes("1031")) rows.push(["1031", cfg.p1031]);
  const mirror = (x: string) => x[1] + x[0];
  if (s === [...s].reverse().join("")) rows.push(["Palindrome", cfg.pPalindrome]);
  else if (([[0, 1], [0, 2], [1, 2]] as const).some(([i, j]) => p[i] !== mirror(p[i]) && p[j] === mirror(p[i]))) {
    rows.push(["Palindrome pair", cfg.pPalindromePair]);
  }
  if (p.join(",") === "D0,B0,CE") rows.push(["D0B0CE", cfg.pD0B0CE]);
  else if ([...s].sort().join("") === [..."D0B0CE"].sort().join("")) rows.push(["D0B0CE anagram", cfg.pD0B0CEAnagram]);

  const run = longestRun(s);
  if (run >= 3) rows.push([`Run of ${run}`, cfg.runPoints[run]]);

  const cnt = counts(s);
  // Exactly 4 of a character: +2; exactly 3 (not 6s): +1; 5 of a character scores nothing.
  if ([...cnt.values()].includes(4)) rows.push(["4 of the same character", 2]);
  else if ([...cnt].some(([c, v]) => c !== "6" && v === 3)) rows.push(["3 of the same character", 1]);

  const found: FoundWord[] = [];
  for (const w of words ?? []) {
    if (!cfg.allowNumberSwaps && /\d/.test(w.spelled)) continue;
    if (fits(w.spelled, cnt)) {
      const pts = (cfg.wordPoints[w.length] ?? 0) + (w.spooky ? cfg.spookyBonus : 0);
      if (pts) found.push({ word: w.word, points: pts, spooky: w.spooky });
    }
  }
  let wp = found.reduce((a, w) => a + w.points, 0);
  if (cfg.wordCap !== null) wp = Math.min(wp, cfg.wordCap);
  if (wp) rows.push(["Words", wp]);

  return { code: s, total: rows.reduce((a, [, n]) => a + n, 0), rows, words: found, ended: false };
}
