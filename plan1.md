# Haunted Paint Finale: App Build Brief

## Overview

Build a laptop app that turns a 6-digit hex code into a color swatch and a paint-mixing difficulty rating (Easy, Medium, Hard, Brutal), with optional staff tools around it.

Context: this is the finale of a Halloween scavenger hunt for about 50 adults who arrive one at a time. Staff are three people, and most players have no phone. Each player has collected three 2-digit hex pairs (red, green, blue) at earlier stations and must mix that color from red, yellow, blue, white and black paint. They earn tokens based on their code, spend them on paint, and can win when their mixed coloir matches their hex code. The app is used by staff at the entrance and must run offline.


**Cards and codes**

- 75 cards per channel (red, green, blue), listed in `hex_pairs.csv`. A player holds one of each and joins them into a 6-digit code such as `A3 7F E2`. Each card has a red, green or blue strip along the bottom: red is the first pair, green the second pair and blue the third pair.
- The set is deliberately weighted toward fun pairs. Every channel has one each of `11`, `22`, `33`, `44`, `55`, `66`, `77`, `88`, `99`, `AA`, `BB`, `CC`, `DD`, `EE` and `FF`, plus one extra `FF`, two `00`, and two copies each of `D0`, `B0`, `CE`, `13`, `31` and `69` (so two `FF` and two `00` per channel). The other 45 cards per channel are random, all different, and never doubles, but 12 of them are drawn from pairs containing a 6, so 15 of 75 cards in each channel contain a 6 and about one code in 50 has three or more. That gives 18 of 75 doubles per channel. `D0`, `B0` and `CE` appear twice so several players can spell D0BOCE.
- Luck is part of the design. Some codes are easy to mix and some nearly impossible, which is why the app rates difficulty at check-in.

**Paint and tokens**

- Paints: red, yellow, blue, white, black. One token is one dab of one color of the player's choice. A tiny swatch only needs a fraction of a dab.
- Players start with 3 tokens, or roll a die (undecided, see the last section). Hard and Brutal players get a bonus.

**Final judging**

Staff photograph the swatch with a phone, read its hex, and compare to the target with CIEDE2000 (ΔE). Tiers: Spot On under 5, Close under 10, Passable under 20.


## Core app: check-in screen

A staff member types a player's code and the screen shows their color and difficulty within a second.

**Input**

- One text field, focused on load. Accept `A37FE2`, `#a37fe2`, `A3 7F E2` and `A3-7F-E2`: strip everything that is not a hex digit, uppercase it, and show it re-spaced as three pairs.
- Valid means exactly 6 hex digits. Otherwise show a short inline error ("Need 6 characters, you have 4") and no result.
- Enter submits. Esc clears the field for the next player.

**Result panel**

- A large swatch of the exact color, the code as `#A37FE2`.
- A difficulty badge (Easy, Medium, Hard, Brutal) with the ΔE number and one line of Halloween flavor text per tier. The badge is rated on the simple recipe (5 parts or fewer), see the next section.
- Suggested starting tokens, from the tier bonus table in the last section.
- Bonus badges the code qualifies for (see Bonus badges).
- A "Check in" button that adds the player to the player list with the next number, and an optional nickname field.

**Staff view**

- A toggle (default off) that reveals the closest paint mix as a second swatch beside the target, with its recipe (for example "2 red : 1 blue : 1 white") and the 10-part recipe and ΔE.
- The recipe must stay hidden from players by default. Handing it over spoils the challenge.

**Look and feel**

- Dark theme, Halloween styling, large type. Keep it plain enough to read quickly.
- A laptop screen is not color-calibrated, so show a small note that the swatch is a guide only. The code is the target.

## Difficulty rating

The rating is the perceptual distance (CIEDE2000, ΔE) between the player's color and the closest color that red, yellow, blue, white and black paint can actually make. Hex is additive screen light and paint is subtractive pigment, so some codes are easy and some cannot be mixed at all.

**Algorithm**

1. Paint colors (sRGB): red `(255, 39, 2)`, yellow `(254, 236, 0)`, blue `(0, 33, 133)`, white `(255, 255, 255)`, black `(20, 16, 16)`. These are estimates of typical craft paint. Keep them in one editable constant, and replace them with phone readings of the real paints if you can.
2. Mixing model: Mixbox, a pigment mixing model (npm `mixbox`, free for non-commercial use). Convert each paint to its latent vector with `rgbToLatent`. A recipe with integer parts `p` has weights `p / sum(p)`. Mix the weighted latents, then convert back with `latentToRgb`. Do not average in RGB, because that gives light mixing, not paint.
3. Recipe library: every combination of the five paints with 1 to 10 total parts, reduced by greatest common divisor so `2:2` and `1:1` count once. That is 2,681 recipes. The simple subset (5 parts or fewer) has 221. Mix and convert to Lab once at startup.
4. Match: convert the target to Lab, compute ΔE2000 against every recipe in the subset, and pick the smallest of `ΔE + 0.02 × total parts`. The small penalty only breaks near-ties toward simpler recipes. Report the real ΔE, not the penalized score.
5. Search exhaustively. An approximate nearest-neighbour lookup missed better recipes in saturated colors and made too many codes look impossible. 2,681 comparisons take about 2 ms in Python.
6. Tier from the simple (5 parts or fewer) result, using the unrounded ΔE:

| Tier | ΔE | Share of codes with the current cards |
| --- | --- | --- |
| Easy | under 5 | 32% |
| Medium | 5 to under 10 | 37% |
| Hard | 10 to under 20 | 29% |
| Brutal | 20 or more | 2% |

Also compute the result for 10 parts or fewer for the staff view. Rated that way the shares are roughly 55%, 22%, 23% and under 1%. The simple recipe is what a player can realistically measure out with tiny dabs, which is why it sets the tier.

**Test cases** (simple recipes, 5 parts or fewer; ΔE within ±0.2 and the same tier is a pass, and different recipes with equal ΔE are fine)

| Code | Simple recipe | ΔE | Tier |
| --- | --- | --- | --- |
| `#A0DB3B` | 3 yellow : 1 blue : 1 white | 0.3 | Easy |
| `#FFFFFF` | 1 white | 0.0 | Easy |
| `#FF0000` | 1 red | 2.1 | Easy |
| `#0552A3` | 2 blue : 1 white : 1 black | 2.2 | Easy |
| `#AB4229` | 2 red : 1 white : 2 black | 3.5 | Easy |
| `#000000` | 1 black | 3.7 | Easy |
| `#FFFF00` | 2 yellow : 1 white | 3.8 | Easy |
| `#4A5EA9` | 1 blue : 1 white : 1 black | 4.6 | Easy |
| `#C8A86A` | 1 red : 1 yellow : 1 blue : 2 white | 5.5 | Medium |
| `#8C7AC6` | 1 red : 2 blue : 2 white | 7.1 | Medium |
| `#448395` | 1 yellow : 3 blue : 1 white | 10.9 | Hard |
| `#00FF00` | 2 yellow : 1 blue : 1 white | 11.5 | Hard |
| `#784BE7` | 4 blue : 1 white | 13.4 | Hard |
| `#0000FF` | 4 blue : 1 white | 14.4 | Hard |
| `#00FFFF` | 1 yellow : 2 blue : 2 white | 19.98 (shows 20.0) | Hard, just under the line |
| `#C000C6` | 1 red : 1 blue : 1 white | 20.3 | Brutal |
| `#E634F4` | 1 red : 1 blue : 2 white | 22.4 | Brutal |
| `#FF00FF` | 1 red : 1 blue : 2 white | 23.7 | Brutal |

`mix_reference.py` produces every number above. Treat it as the specification where this text is ambiguous.

## Bonus badges

At check-in the app checks the code for luck events and shows each one as a badge, so staff can hand out the matching bonus tokens. Odds below are exact for the current card set. Let `s` be the six characters of the code, where A to F are worth 10 to 15.

| Badge | Rule | Odds | Default reward |
| --- | --- | --- | --- |
| Snake eyes | A pair has two identical characters (`77`, `CC`, `00`) | 56% | Badge only |
| Unlucky 13 | `s` contains `13` or `31` anywhere, even across a pair boundary | 15.9% | +1 |
| Double snake eyes | Two or more such pairs | 14.5% | +1 |
| No letters | No A to F at all | 10.7% | +1 |
| Has 00 | A pair is `00` | 7.8% | +1 |
| Has FF | A pair is `FF` | 7.8% | +1 |
| Triple letter | One letter A to F appears 3 or more times | 5.4% | +1 |
| Hidden word | A run of 4 to 6 characters spells a word from `hex_words.csv` (column "Spelled in hex") | 5.1% | +1 |
| 666 | The digit 6 appears 3 or more times | 2.0% | +2 |
| Halloween sum | Character values add to exactly 31 | 1.9% | +2 |
| Triple doubles | All three pairs are doubles | 1.4% | +2 |
| Spooky word | A run of 3 to 6 characters spells a word flagged Spooky (`B00`, `BA7`, `1CE`, `DEAD`) | 1.4% | +2 |
| Mirror pair | One pair reversed equals another pair (`A3` and `3A`), ignoring doubles | 1.3% | +2 |
| All letters | No digits at all | 0.64% | +3 |
| Staircase | Three consecutive characters rise by one in hex order (`345`, `9AB`) | 0.63% | +3 |
| Black and white | The code contains both `00` and `FF` | 0.42% | +3 |
| Palindrome | `s` reads the same backwards | 0.19% | +3 |
| Only 00 and FF | Every pair is `00` or `FF` | 0.015% | +3 |
| Blackout or Whiteout | `000000` or `FFFFFF` | 0.004% | +3, and announce it |

Display rules

- Badges in one family do not stack. Show only the highest of Snake eyes, Double snake eyes and Triple doubles. Show only the highest of Has 00, Has FF, Black and white and Only 00 and FF.
- Cap the total bonus per player at 3 tokens, so luck helps but frugal, skilled mixing still decides the winner. Make the cap a setting.
- Several words can share one hex spelling, so store a list for each spelling. Show the longest matching word first, and list a Spooky match above a plain Hidden word.
- Rewards come from rarity: badge only above 20%, +1 from 5% to 20%, +2 from 1% to 5%, +3 below 1%. Keep rewards and the cap in a config table at the top of the file.

## Staff tools (optional)

These turn the check-in screen into a ledger for the whole evening. Build them after the first three pieces work, and keep each one a separate screen reachable from a top bar.

**Player list**

- One row per checked-in player: number (auto-increment), nickname, code, tier, token balance, badges.
- Plus and minus buttons on the token balance. Save after every change to `localStorage` (or a JSON file next to the app), and offer an Export CSV button as a backup.
- Edit and delete a row, because staff will mistype codes.


**Judging screen**

- Pick a player, then type the hex that staff read from the swatch photo. Show ΔE2000 against their target code and the result tier: Spot On under 5, Close under 10, Passable under 20, otherwise Miss.
- Score = tier points plus unspent tokens. Placeholder values: Spot On 10, Close 6, Passable 3, Miss 0. Keep these in config until decided.
- A leaderboard sorted by score, with the tier and tokens left shown for each player.
- Reminder text for staff: photograph every swatch on the same white card, under the same light, in one spot. Warm lamps and dark rooms shift the reading.

## Data files and reference code

Five files go with this brief. Copy them into the project's data folder and load them at startup (bundle them into the build so the app works offline).

| File | What it holds | Used for |
| --- | --- | --- |
| `hex_pairs.csv` | 75 rows, columns `#`, `Red`, `Green`, `Blue`. This is the current card set (it replaces the first version). | Typo guard at check-in, the spare card draw for the Bus |
| `hex_words.csv` | 2,188 words of 3 to 6 letters. Columns `Word`, `Spelled in hex`, `Length`, `Type`, `Spooky` (38 words flagged `yes`). Leetspeak spellings: O is 0, I and L are 1, S is 5, T is 7, G is 6, Z is 2. | Hidden word and Spooky word badges |
| `mix_reference.py` | Working Python version of the difficulty rating and every badge rule. Run `python3 mix_reference.py FF00FF` to see a result. | The specification for exact behavior and the source of the test numbers |
| `mixable_sample.csv` | 200 random codes with their best simple and 10-part recipes and the resulting paint color. | A larger cross-check against the port |

The fifth file, `house_bowl.csv`, lists the 25 house bowl cards (printed text, the value to enter in the app, copies). Bowl cards never need the typo guard: every value they hold also appears in the regular cards, and the novelty `DU` card is entered as `D0`.

Some notes on the data:

- The 2,188 rows collapse to 2,123 distinct spellings, because some words share one (`FA115` spells both FALLS and FAILS; 61 spellings are shared this way). Keep a list per spelling.
- The word list is machine-filtered from a dictionary, so a few odd entries remain. Staff can prune rows by deleting them from the CSV.


**Suggested approach**

- A static web app (plain HTML and TypeScript, or Vite) opened in a browser, with no server and no database. Persist state to `localStorage` and offer export and import of the player list as JSON or CSV.
- Bundle every dependency into the build, because the venue Wi-Fi cannot be trusted. Do not load anything from a CDN at runtime.
- Mixbox: the `mixbox` npm package. For ΔE2000 use `culori` (`differenceCiede2000`) or `colorjs.io`, and convert sRGB to Lab with D65 white.
- Precompute the 2,681 recipe colors and their Lab values once on load. A lookup should take well under 100 ms.
- Keep tunable values in one config object: paint colors, tier limits, tier token bonuses, badge rewards and the bonus cap, score points, and Bus and potion numbers.

**Acceptance tests**

1. Input handling: `a37fe2`, `#A37FE2`, `A3 7F E2` and `A3-7F-E2` all give the same result. `A37FE` shows an inline error and no result. `A37FEG` shows the same error.
2. Typo guard: a code whose pair is not on any card for that channel shows a yellow warning and still rates normally.
3. Difficulty: every row of the test-case table in the Difficulty section matches (tier exactly, ΔE within ±0.2).
4. Badges, using `mix_reference.py` as the reference:

| Code | Expected badges |
| --- | --- |
| `DEAD42` | Hidden word DEAD, Spooky word DEAD |
| `CA7F00` | Snake eyes, Has 00, Spooky word CAT |
| `1F0F00` | Snake eyes, Has 00, Halloween sum |
| `1CED00` | Snake eyes, Has 00, Hidden word ICED, Spooky words ICE and ICED |
| `200123` | No letters, Staircase, Spooky word ZOO |
| `A71234` | Staircase |
| `FF1313` | Snake eyes, Has FF, Unlucky 13 |
| `3AF312` | Unlucky 13 |
| `FF0000` | Triple doubles, Only 00 and FF (the lower badges in each family are hidden) |

5. Persistence: add three players, reload the page, and all three are still there with their token balances.
6. Offline: disconnect from the network, reload, and everything still works.
7. Speed: from pressing Enter to the result is under 200 ms on an ordinary laptop.

## Open decisions and suggested defaults

The builder should use these defaults and put each one in config, so the organizer can change them without touching code.
