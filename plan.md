# Code Score Checker: App Brief

## Overview

Add a score checker to the laptop check-in app. Staff type a 6-digit hex code and the app shows what the code is worth under the house scoring rules, with a line-by-line breakdown so a player can see why.

**Input:** one text field, same cleaning as the color checker: strip everything that is not a hex digit, uppercase, and show it as three pairs. Anything other than exactly 6 hex digits shows an inline error and no score.

**Output:** a total (can be negative), then one row per rule that fired with its points, then the words found. Show a note when the 3-of-the-same rule ended the scoring.

**Context:** each player holds three 2-digit pairs, one each from the red, green and blue sets, and may swap cards with other players. The score is only a function of the six characters. It does not depend on which set a card came from.

Build in this order, and stop where time runs out: (1) the non-word rules, (2) the breakdown screen, (3) words, (4) the settings file.

## Scoring rules

Let `s` be the six characters and the pairs be `p1 p2 p3`. A pair is a double when its two characters match. Apply the rules in this order.

**1. Override.** If `p1 = p2 = p3` (`55 55 55`, `12 12 12`), the total is −5. Stop. Nothing else applies.

**2. Doubles family.** Score only the highest that applies:

| Rule | Points | Test |
| --- | --- | --- |
| Two identical doubles | +4 | two pairs are equal and are doubles (`00 00 5B`) |
| Three doubles | +3 | all three pairs are doubles, not all equal (`00 77 EE`) |
| Two doubles | +2 | exactly two pairs are doubles (`00 77 4A`) |
| Pair of the same | +2 | two pairs are equal, not doubles (`12 12 A3`) |

**3. Everything below adds up** (positive and negative) and is scored independently:

| Rule | Points | Test |
| --- | --- | --- |
| Exactly three 6s | −1 | the digit 6 occurs exactly 3 times in `s` |
| One 69 | +1 | exactly one pair equals `69` |
| Two or more 69s | −5 | two or more pairs equal `69` (instead of One 69) |
| 67 | −1 | any pair equals `67` (once) |
| Numbers only | digital root of the digits (1 to 9) | all six characters are digits 0 to 9. Add the digits. While the total has more than one digit, add its digits. Score the result |
| Primes only | +2 | for each pair, drop the letters and read the remaining digits as one number. It must be prime. All three pairs must pass. `17` yes, `15` no, `A2` yes (2), `F6` no (6), `05` yes (5). A pair with no digits, like `AB`, fails |
| 13 or 31 | +1 | any pair equals `13` or `31` (once) |
| 1031 | +5 | the characters `1031` appear in a row anywhere in `s` (`10 31 AA`, `A1 03 1B`, `AA 10 31`) |
| Palindrome | +3 | `s` reads the same backwards (`12 33 21`) |
| D0B0CE | +10 | `p1 = D0`, `p2 = B0`, `p3 = CE` in that order |
| Run | length 3: +1, 4: +3, 5: +5, 6: +8 | take the distinct characters of `s`, sort them by hex value (0 to F), and find the longest chain where each is one more than the last. No wraparound from F to 0. Only the longest chain scores |
| 4 or more of the same character | +3 | any character, including 6, appears 4 or more times in `s` |
| 3 of the same character | +1 | any character other than 6 appears exactly 3 times, and the rule above did not fire (never both) |

## Word scoring

Players rearrange the characters they hold to spell words. Use `hex_words.csv` (the same file as the color checker brief): columns `Word`, `Spelled in hex`, `Length`, `Type`, `Spooky`.

- **Matching:** a word is found when every character of its `Spelled in hex` value can be taken from the six characters, using each character at most as many times as it appears. The word does not need to use all six. Order does not matter.
- **Points per word:** +1 if `Length` is 4 or more, plus +1 if `Spooky` is yes. A spooky word of 4 or more letters earns both. A spooky 3-letter word earns only the spooky point. Words of 3 letters that are not spooky score nothing.
- **Distinct words:** each row of the file counts once, so `FACE` and `CAFE` are two words, and two words that share a spelling both count.
- **Number swaps:** the file already spells words with digits for letters (O is 0, I and L are 1, S is 5, T is 7, G is 6, Z is 2). With the setting `allow_number_swaps` on, all rows can match. With it off, only words whose spelling contains no digit can match (`FACE`, `DEAD`, `DECADE`).
- **Cap:** the total from all words is limited to `word_cap` points. Default 3. Without a cap, a single code can match dozens of words.
- **Display:** list the matched words next to the total, up to 12, longest first, spooky ones marked. Show the points each word earns. Show the cap when it clips the total.

## Screen and data

**Screen.** Same single field as the color checker, so the two can share one page: type a code and see the color, the difficulty and the score together. Below the field:

- A large total, colored green above 0, grey at 0 and red below 0.
- A table with one row per rule that fired: rule name and points. Show the rule that ended the scoring when the override fired.
- The matched words, with the word total and any cap.
- A small "what counts" help panel that lists the rules, so staff can answer a player.

**Files.** Put these next to the app:

- `hex_words.csv`: the word list (already in the color checker brief).
- `score_reference.py`: a Python reference implementation. Treat it as the specification where this text is ambiguous, and port it faithfully.

**Settings** in one config object at the top of the code, so staff can change them without editing the logic:

| Setting | Default | Meaning |
| --- | --- | --- |
| `word_cap` | 3 | Maximum points from words (none = no cap) |
| `allow_number_swaps` | true | Let digits stand in for letters in words |
| `numbers_only_cap` | none | Maximum points from Numbers only (3 is a likely choice) |
| `p_1031` | 5 | Points for 1031 |
| `p_palindrome` | 3 | Points for a palindrome |
| `p_d0b0ce` | 10 | Points for D0B0CE |
| `run_points` | 3: 1, 4: 3, 5: 5, 6: 8 | Points by run length |

**Not built:** no accounts, no network, nothing stored. It must run offline.

## Test cases

The total for a code is the "Score without words" plus the words column. These were produced by `score_reference.py` with the default settings (`word_cap` 3, `allow_number_swaps` on, no Numbers only cap). "Letters only" is the same with `allow_number_swaps` off. The app must match every row.

| Code | Score without words | Rules that fire | Words (defaults) | Words (letters only) |
| --- | --- | --- | --- | --- |
| `00 77 EE` | +3 | Three doubles +3 | +3 | +0 |
| `00 7A 4A` | 0 | none | +0 | +0 |
| `12 12 A3` | +3 | Pair of the same +2; Run of 3 +1 | +1 | +0 |
| `55 55 55` | −5 | 3 of the same −5 | +0 | +0 |
| `12 12 12` | −5 | 3 of the same −5 | +0 | +0 |
| `99 99 99` | −5 | 3 of the same −5 | +0 | +0 |
| `66 6A 12` | −1 | Exactly three 6s −1 | +1 | +0 |
| `66 69 A3` | 0 | Exactly three 6s −1; One 69 +1 | +0 | +0 |
| `69 69 12` | +3 | Pair of the same +2; Two or more 69s −5; Numbers only +6 | +0 | +0 |
| `69 A3 7F` | +1 | One 69 +1 | +0 | +0 |
| `67 A3 7F` | +1 | 67 −1; Primes only +2 | +2 | +0 |
| `12 34 56` | +11 | Numbers only +3; Run of 6 +8 | +0 | +0 |
| `17 2A 3B` | +3 | Primes only +2; Run of 3 +1 | +3 | +0 |
| `13 A3 7F` | +3 | Primes only +2; 13 or 31 +1 | +2 | +0 |
| `10 31 AA` | +6 | 13 or 31 +1; 1031 +5 | +3 | +0 |
| `A1 03 1B` | +5 | 1031 +5 | +3 | +0 |
| `12 33 21` | +7 | Numbers only +3; Palindrome +3; Run of 3 +1 | +0 | +0 |
| `D0 B0 CE` | +13 | D0B0CE +10; Run of 4 +3 | +3 | +0 |
| `54 3A F0` | +1 | Run of 3 +1 | +1 | +0 |
| `A3 CB 7D` | +3 | Run of 4 +3 | +2 | +0 |
| `34 56 7A` | +5 | Run of 5 +5 | +3 | +0 |
| `9A BC DE` | +8 | Run of 6 +8 | +3 | +3 |
| `A1 A2 AB` | +1 | 3 of the same character +1 | +3 | +0 |
| `A1 A2 AA` | +3 | 4 or more of the same character +3 | +0 | +0 |
| `00 00 5B` | +7 | Two identical doubles +4; 4 or more of the same character +3 | +3 | +0 |
| `FA CE 00` | 0 | none | +2 | +2 |
| `DE AD 42` | 0 | none | +3 | +3 |
| `A3 7F E2` | +2 | Primes only +2 | +3 | +0 |

**Input handling:** `a37fe2`, `#A37FE2`, `A3 7F E2` and `A3-7F-E2` all give the same result. `A37FE` (5 digits) and `A37FEG` show an inline error and no score.
