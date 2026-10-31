# Witch's Brew

Offline laptop app for the Haunted Paint Halloween party: players type their three hex cards to brew a potion, test how close their paint mix came, and climb the leaderboard.

## Run it

Needs [Node.js](https://nodejs.org) 18 or newer.

```sh
npm ci            # install exact dependency versions
npm run dev       # open the printed localhost link
```

For the party, build once and serve the build. It runs with no internet:

```sh
npm run build
npm run preview   # open the printed localhost link
```

Open it through `localhost`, not by double-clicking `dist/index.html`. The browser blocks the app's scripts from a local file, and the Camera tab only works on `localhost`.

```sh
npm test          # scoring, potions and color math
```

## Tabs

- **welcome**: enter the three cards (red, green, blue) and brew the potion.
- **points guide**: every scoring rule a code qualifies for.
- **test your brew**: type the target code and the hex read from a photo of the paint, and get a verdict.
- **color**: one color shown large, with how close any mix of the five paints can get.
- **camera**: read a hex straight from the laptop camera (use "set white" on the white card first).
- **leaderboard**: best guess per player. It's saved in this browser only.
- **rules**: what every code can be worth.

## Changing things

- Scoring points, judging cutoffs and paint colors: [src/config.ts](src/config.ts). `score_reference.py` is the Python version of the scoring; the tests check the two agree.
- Word lists: `data/*words*.csv` (columns `Word`, `Spelled in hex`, `Length`, `Spooky`).
- Potion names: [src/potion.ts](src/potion.ts).

Pigment mixing uses Mixbox (`mixbox`, CC BY-NC 4.0, free for non-commercial use).
