"""Reference implementation of the house scoring rules.  python3 score_reference.py A37FE2"""
import csv, sys, os
from collections import Counter
HEX = "0123456789ABCDEF"
CONFIG = {
    "word_cap": 5,                 # max total points from words (None = no cap)
    "allow_number_swaps": True,    # False = only A-F letters can be used in words
    "p_1031": 5, "p_primes": 3, "p_16": 10, "p_palindrome": 5, "p_palindrome_pair": 2, "p_d0b0ce": 20, "p_d0b0ce_anagram": 10,
    "run_points": {3: 1, 4: 2, 5: 3, 6: 5},
    "word_points": {3: 1, 4: 1, 5: 2, 6: 3},   # points per word, by length
    "spooky_bonus": 2,             # extra point for a word flagged Spooky
}
def _words():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hex_words.csv")
    out = []
    for r in csv.DictReader(open(path)):
        out.append((r["Word"], r["Spelled in hex"], int(r["Length"]), r["Spooky"].strip().lower().startswith("y")))
    return out
WORDS = _words()
def _prime(n):
    return n > 1 and all(n % i for i in range(2, int(n ** .5) + 1))
def _longest_run(s):
    v = sorted({HEX.index(c) for c in s}); best = cur = 1
    for a, b in zip(v, v[1:]):
        cur = cur + 1 if b == a + 1 else 1
        best = max(best, cur)
    return best
def _fits(spelled, have):
    need = Counter(spelled)
    return all(have[c] >= n for c, n in need.items())
def score(code, cfg=CONFIG):
    s = "".join(c for c in code.upper() if c in HEX)
    assert len(s) == 6
    p = [s[0:2], s[2:4], s[4:6]]
    rows = []   # (rule, points)
    if p[0] == p[1] == p[2]:
        return {"code": s, "total": -5, "rows": [("3 of the same", -5)], "words": [], "ended": True}
    dbl = [x[0] == x[1] for x in p]; nd = sum(dbl)
    eq = [(i, j) for i, j in ((0, 1), (0, 2), (1, 2)) if p[i] == p[j]]
    fam = (0, None)
    if eq:
        fam = (4, "Two identical doubles") if dbl[eq[0][0]] else (2, "Pair of the same")
    if nd == 3 and fam[0] < 3: fam = (3, "Three doubles")
    elif nd == 2 and fam[0] < 2: fam = (2, "Two doubles")
    elif nd == 1 and fam[0] < 1: fam = (1, "One double")
    if fam[0]: rows.append((fam[1], fam[0]))
    if s.count("6") == 3: rows.append(("Exactly three 6s", -1))
    n69 = p.count("69")
    if n69 == 1: rows.append(("One 69", 1))
    elif n69 >= 2: rows.append(("Two or more 69s", -5))
    if "67" in p: rows.append(("67", -1))
    if p[0][0] == p[1][0] == p[2][0]: rows.append(("Same first character", -1))
    # all digits, and every card is a prime number (07 counts as 7)
    if s.isdigit() and all(_prime(int(x)) for x in p): rows.append(("Primes only", cfg["p_primes"]))
    if "13" in p or "31" in p: rows.append(("13 or 31", 1))
    if "16" in p: rows.append(("16", cfg["p_16"]))
    if "1031" in s: rows.append(("1031", cfg["p_1031"]))
    if s == s[::-1]: rows.append(("Palindrome", cfg["p_palindrome"]))
    elif any(p[i] != p[i][::-1] and p[j] == p[i][::-1] for i, j in [(0, 1), (0, 2), (1, 2)]):
        rows.append(("Palindrome pair", cfg["p_palindrome_pair"]))
    if p == ["D0", "B0", "CE"]: rows.append(("D0B0CE", cfg["p_d0b0ce"]))
    elif sorted(s) == sorted("D0B0CE"): rows.append(("D0B0CE anagram", cfg["p_d0b0ce_anagram"]))
    run = _longest_run(s)
    if run >= 3: rows.append((f"Run of {run}", cfg["run_points"][run]))
    cnt = Counter(s)
    # exactly 4 of a character: +2; exactly 3 (not 6s): +1; 5 of a character scores nothing
    if 4 in cnt.values(): rows.append(("4 of the same character", 2))
    elif any(v == 3 for c, v in cnt.items() if c != "6"): rows.append(("3 of the same character", 1))
    have = Counter(s); words = []
    for w, sp, L, spooky in WORDS:
        if not cfg["allow_number_swaps"] and any(c.isdigit() for c in sp): continue
        if _fits(sp, have):
            pts = cfg["word_points"].get(L, 0) + (cfg["spooky_bonus"] if spooky else 0)
            if pts: words.append((w, pts))
    wp = sum(x[1] for x in words)
    if cfg["word_cap"] is not None: wp = min(wp, cfg["word_cap"])
    if wp: rows.append(("Words", wp))
    return {"code": s, "total": sum(r[1] for r in rows), "rows": rows, "words": words, "ended": False}
if __name__ == "__main__":
    r = score(sys.argv[1]); print(r["code"], r["total"])
    for k, v in r["rows"]: print(f"  {v:+d}  {k}")
    if r["words"]: print("  words:", ", ".join(w for w, _ in r["words"]))
