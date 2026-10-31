import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { deltaE, hexToRgb, parseCode, rgbToLab } from "../src/color";
import { LIBRARY, SIMPLE, bestMatch, bestPossible, difficulty } from "../src/mix";
import { describeDirection, judge, suggestCorrection } from "../src/feedback";
import { parseWords, score } from "../src/score";
import { brewPotion, pointHints, potionFamily, potionFor, specialEffect, specialHint } from "../src/potion";
import { RULE_SECTIONS } from "../src/rules";
import { addGuess, bestGuess, clearBoard, rankedBoard } from "../src/leaderboard";

const lab = (hex: string) => rgbToLab(hexToRgb(hex));

describe("code input", () => {
  test.each(["a37fe2", "#A37FE2", "A3 7F E2", "A3-7F-E2"])("%s parses", (s) => {
    expect(parseCode(s)).toEqual({ ok: true, hex: "A37FE2" });
  });
  test.each(["A37FE", "A37FEG"])("%s is rejected", (s) => {
    expect(parseCode(s)).toEqual({ ok: false, error: "Need 6 characters, you have 5" });
  });
});

describe("difficulty (plan1 test table)", () => {
  test("recipe library sizes", () => {
    expect(LIBRARY.length).toBe(2681);
    expect(SIMPLE.length).toBe(221);
  });
  test.each([
    ["A0DB3B", 0.3, "Easy"], ["FFFFFF", 0.0, "Easy"], ["FF0000", 2.1, "Easy"], ["0552A3", 2.2, "Easy"],
    ["AB4229", 3.5, "Easy"], ["000000", 3.7, "Easy"], ["FFFF00", 3.8, "Easy"], ["4A5EA9", 4.6, "Easy"],
    ["C8A86A", 5.5, "Medium"], ["8C7AC6", 7.1, "Medium"], ["448395", 10.9, "Hard"], ["00FF00", 11.5, "Hard"],
    ["784BE7", 13.4, "Hard"], ["0000FF", 14.4, "Hard"], ["00FFFF", 19.98, "Hard"], ["C000C6", 20.3, "Brutal"],
    ["E634F4", 22.4, "Brutal"], ["FF00FF", 23.7, "Brutal"],
  ] as const)("#%s → ΔE %f %s", (hex, de, tier) => {
    const d = difficulty(lab(hex));
    expect(Math.abs(d.deltaE - de)).toBeLessThanOrEqual(0.2);
    expect(d.tier.name).toBe(tier);
  });
  test("lookup is fast", () => {
    const t = performance.now();
    for (let i = 0; i < 20; i++) difficulty(lab("A37FE2"));
    expect((performance.now() - t) / 20).toBeLessThan(100);
  });
});

describe("points helper matches score_reference.py", () => {
  const words = parseWords(readFileSync(new URL("./stub_words.csv", import.meta.url), "utf8"));
  const fixture = JSON.parse(readFileSync(new URL("./score_fixture.json", import.meta.url), "utf8"));
  test.each(Object.keys(fixture))("%s", (code) => {
    const r = score(code, undefined, words);
    const found = r.words.map((w) => [w.word, w.points]);
    expect({ total: r.total, rows: r.rows, words: found, ended: r.ended }).toEqual(fixture[code]);
  });
});

describe("compare feedback", () => {
  test("judging tiers", () => {
    expect([judge(4.9).name, judge(5).name, judge(19.9).name, judge(20).name]).toEqual(["Spot On", "Close", "Passable", "Miss"]);
  });
  test("too dark brew is told it's too dark and to add white", () => {
    const target = lab("C08AE0"), actualRgb = hexToRgb("80509A");
    const dir = describeDirection(target, rgbToLab(actualRgb));
    expect(dir.notes.join(" ")).toMatch(/too dark/);
    const d = deltaE(target, rgbToLab(actualRgb));
    const fix = suggestCorrection(target, actualRgb, d)!;
    expect(fix.steps.join(" ")).toMatch(/white/);
    expect(fix.deltaE).toBeLessThan(d);
  });
  test("too yellow green is told to shift toward blue-ish", () => {
    const dir = describeDirection(lab("2E8B57"), lab("7FA030"));
    expect(dir.notes.join(" ")).toMatch(/shift toward (green|teal)/);
  });
});

describe("potions and hints", () => {
  test.each([
    ["000000", "black"], ["FFFFFF", "white"], ["808080", "grey"], ["8B0000", "dark red"], ["FF0000", "red"],
    ["FF8C00", "orange"], ["FFE600", "yellow"], ["6B4423", "brown"], ["A48E0C", "mustard"], ["0B3D0B", "dark green"],
    ["191970", "dark blue"], ["4B0082", "purple"], ["FF69B4", "light pink"], ["DEAD42", "yellow"], ["F4E1D2", "pale"],
  ])("#%s is %s", (hex, family) => {
    expect(potionFamily(lab(hex))).toBe(family);
  });
  test("a code always gets the same potion, and codes vary within a family", () => {
    expect(potionFor("4B0082")).toEqual(potionFor("4b0082"));
    const purples = ["4B0082", "4A0081", "4C0083", "4B0182", "4B0080", "4D0084", "490080", "4B0280"];
    expect(new Set(purples.map((c) => potionFor(c).name)).size).toBeGreaterThan(2);
  });
  test("the brew's name depends on how close it came", () => {
    expect(potionFor("E8E8E8").name).toBe("Karl the Fog");
    expect(brewPotion("E8E8E8", "E9E9E9", "Spot On")).toEqual(potionFor("E8E8E8"));
    expect(brewPotion("E8E8E8", "F4F4F6", "Close").name).toBe("Carl the Fog");
    // further off: some other potion from the brew's own family, never the target's
    for (let i = 0; i < 4096; i++) {
      const hex = (i * 4093).toString(16).padStart(6, "0").slice(-6).toUpperCase();
      const near = brewPotion(hex, hex, "Close");
      expect(near.name && near.line).toBeTruthy();
      expect(near.name).not.toBe(potionFor(hex).name);
      expect(brewPotion(hex, hex, "Passable").name).not.toBe(potionFor(hex).name);
    }
    expect(potionFamily(lab("FFE600"))).toBe("yellow");
    const passable = brewPotion("E8E8E8", "FFE600", "Miss");
    expect(passable.name).toMatch(/Lightning|Dolores|Mural|Sourdough|Cab|Golden/);
  });
  const words = parseWords(
    "Word,Spelled in hex,Length,Spooky\nDEAD,DEAD,4,yes\nBOO,B00,3,yes\nBLOOD,B100D,5,yes\nFACE,FACE,4,\nCAT,CA7,3,yes\n",
  );
  const hints = (code: string) => pointHints(score(code, undefined, words)).join(" | ");
  test("death", () => expect(hints("DEAD42")).toMatch(/Death lurks/));
  test("ghost", () => expect(hints("B00742")).toMatch(/ghost/));
  test("blood", () => expect(hints("B100D2")).toMatch(/blood/));
  test("other spooky", () => expect(hints("CA7942")).toMatch(/spooky/));
  test("plain word", () => expect(hints("FACE42")).toMatch(/words hiding/));
  test.each(["D0B0CE", "B0D0EC", "0DECB0"])("lucky %s", (c) => expect(hints(c)).toMatch(/Incredibly lucky/));
  test("doubles", () => expect(hints("AABB17")).toMatch(/seeing double/));
  test("run", () => expect(hints("A12398")).toMatch(/climb in order/));
  test("palindrome", () => expect(hints("A1BB1A")).toMatch(/backwards/));
  test("palindrome pair", () => expect(hints("24A142")).toMatch(/looking at each other/));
  test.each([["24A142", true], ["4224A1", true], ["A124B2", false], ["33A133", false], ["A1BB1A", false]])(
    "%s has a palindrome pair: %s", (code, yes) => {
      expect(score(code, undefined, []).rows.some(([rule]) => rule === "Palindrome pair")).toBe(yes);
    });
  test("1031", () => expect(hints("1031A9")).toMatch(/what night/));
  test("no points", () => expect(hints("A48E0C")).toMatch(/doesn't earn any chips/));
  test("penalty", () => expect(hints("67A4B2")).toMatch(/cost you chips/));
  test("cursed", () => expect(hints("ABABAB")).toMatch(/cursed/));
});

describe("leaderboard", () => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage;
  const g = (hex: string, d: number) => ({ hex, deltaE: d, tier: judge(d).name, at: 0 });

  test("records guesses per nickname + code, ranks by best guess, and clears", () => {
    clearBoard();
    expect(addGuess("Morticia", "4B0082", g("3A2A6A", 9.7))).toBe(1);
    expect(addGuess("morticia", "4B0082", g("44107A", 3.1))).toBe(2); // nickname match ignores case
    expect(addGuess("Morticia", "4B0082", g("44107A", 3.1))).toBeNull(); // repeat of last guess
    expect(addGuess("Gomez", "FF00FF", g("B0408A", 20.3))).toBe(1);
    const board = rankedBoard();
    expect(board.map((e) => e.nickname)).toEqual(["Morticia", "Gomez"]);
    expect(bestGuess(board[0]).hex).toBe("44107A");
    clearBoard();
    expect(rankedBoard()).toEqual([]);
  });
});

describe("rules tab", () => {
  test.each(RULE_SECTIONS.flatMap((sec) => sec.rules))("$name example $example scores it", (rule) => {
    const r = score(rule.example, undefined, []);
    const row = r.rows.find(([name]) => name === rule.row);
    expect(row).toBeTruthy();
    if (/^[+−-]\d+$/.test(rule.points)) expect(row![1]).toBe(Number(rule.points.replace("−", "-")));
  });
});

describe("secret codes", () => {
  test("C0FFEE has its own potion, near miss and hint", () => {
    expect(potionFor("c0ffee").name).toBe("C0FFEE, Hold the Coffee");
    expect(brewPotion("C0FFEE", "C2FDEC", "Spot On").name).toBe("C0FFEE, Hold the Coffee");
    expect(brewPotion("C0FFEE", "B8F0E0", "Close").name).toBe("Decaf C0FFEE");
    expect(specialHint("C0FFEE")).toMatch(/barista/);
    expect(specialEffect("C0FFEF")).toBeUndefined();
  });
});

describe("best possible mix", () => {
  test.each(["E6A23C", "4B0082", "00FFFF", "FF00FF", "C0FFEE", "8C7AC6"])("#%s is at least as close as any library recipe", (hex) => {
    const lab = rgbToLab(hexToRgb(hex));
    const best = bestPossible(lab);
    expect(best.deltaE).toBeLessThanOrEqual(bestMatch(lab, LIBRARY).deltaE + 1e-9);
    expect(best.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  test("a mixable color can be hit almost exactly", () => {
    expect(bestPossible(lab("E6A23C")).deltaE).toBeLessThan(0.5);
  });
});

describe("the warlock's favorite", () => {
  test("a 16 card scores +10 once and gets its hint", () => {
    expect(score("16A2BC", undefined, []).rows).toContainEqual(["16", 10]);
    expect(score("16A216", undefined, []).rows.filter(([rule]) => rule === "16")).toEqual([["16", 10]]);
    expect(score("A16B2C", undefined, []).rows.some(([rule]) => rule === "16")).toBe(false); // 16 split across cards
    expect(pointHints(score("16A2BC", undefined, [])).join(" ")).toMatch(/warlock/);
  });
});

describe("one double", () => {
  test("a single double card scores +1 and gets the seeing-double hint", () => {
    const r = score("AA17C5", undefined, []);
    expect(r.rows).toContainEqual(["One double", 1]);
    expect(pointHints(r).join(" ")).toMatch(/seeing double/);
  });
  test("only the best of the doubles family counts", () => {
    expect(score("AABB17", undefined, []).rows.filter(([rule]) => /double/i.test(rule))).toEqual([["Two doubles", 2]]);
  });
});

describe("repeated characters", () => {
  test.each([
    ["A1A5A9", "3 of the same character", 1],
    ["A1AA2A", "4 of the same character", 2],
    ["AAAA2A", null, 0],
  ] as const)("%s", (code, rule, pts) => {
    const rows = score(code, undefined, []).rows.filter(([r]) => /of the same character/.test(r));
    expect(rows).toEqual(rule ? [[rule, pts]] : []);
  });
});

describe("primes only", () => {
  test.each([
    ["230753", true], // 23, 7, 53
    ["021113", true], // 2, 11, 13
    ["231453", false], // 14 isn't prime
    ["23A753", false], // has a letter
    ["123456", false], // 12 isn't prime, and numbers alone score nothing now
  ] as const)("%s: %s", (code, yes) => {
    const rows = score(code, undefined, []).rows;
    expect(rows.some(([rule]) => rule === "Primes only")).toBe(yes);
    if (yes) expect(rows).toContainEqual(["Primes only", 3]);
    expect(rows.some(([rule]) => rule === "Numbers only")).toBe(false);
  });
});

describe("same first character", () => {
  test.each([["A1A2A7", true], ["1A1B1C", true], ["A1B2A7", false], ["ABABAB", false]] as const)("%s: %s", (code, yes) => {
    const r = score(code, undefined, []);
    expect(r.rows.some(([rule]) => rule === "Same first character")).toBe(yes);
    if (yes) expect(pointHints(r).join(" ")).toMatch(/cost you chips/);
  });
});
