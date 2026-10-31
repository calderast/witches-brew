# Witch's Brew

Offline laptop app for the Haunted Paint finale. Three screens:

- **Welcome**: type a code and see the target swatch plus how hard it is to mix (Easy, Medium, Hard, Brutal).
- **Points**: every house scoring rule the code qualifies for (a port of `score_reference.py`).
- **Compare**: type the hex read off the phone photo of a swatch. Shows ΔE2000, the judging tier, which way the color is off, a suggested paint fix, and a plot of both colors.

## Run

```sh
npm install
npm run dev        # local dev server
npm run build      # builds dist/, which then needs no network
npm run preview    # serve the built dist/
npm test
```

## Data

- `data/*words*.csv`: word lists for the Words rule (currently `words_all_regular.csv` and `words_common_leetspeak.csv`). Every matching file is loaded and merged. Each needs the columns `Word`, `Spelled in hex`, `Length` and `Spooky`. Rebuild after changing them.
- Paint colors, tier limits, judging tiers and scoring settings are all in [src/config.ts](src/config.ts).

Difficulty uses Mixbox pigment mixing (`mixbox`, CC BY-NC 4.0, free for non-commercial use) and CIEDE2000 from `culori`.
