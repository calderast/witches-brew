import mixbox from "mixbox";
import { CONFIG, type PaintName, type RGB } from "./config";
import { deltaE, rgbToLab, type Lab } from "./color";

export const PAINTS = Object.keys(CONFIG.paints) as PaintName[];

export interface Recipe {
  parts: number[]; // one integer per paint, in PAINTS order
  total: number;
  rgb: RGB;
  lab: Lab;
}

const latents = PAINTS.map((p) => mixbox.rgbToLatent(...CONFIG.paints[p]));

/** Mixes latent vectors with the given weights (any scale) and returns sRGB. */
export function mixLatents(ls: number[][], weights: number[]): RGB {
  const sum = weights.reduce((a, b) => a + b, 0);
  const z = new Array(mixbox.LATENT_SIZE).fill(0);
  ls.forEach((l, i) => {
    const w = weights[i] / sum;
    for (let k = 0; k < z.length; k++) z[k] += w * l[k];
  });
  return [...mixbox.latentToRgb(z)] as RGB;
}

const mixPaints =(parts: number[]) => mixLatents(latents, parts);

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Every combination of the paints with 1..maxParts parts, reduced by GCD. */
function buildLibrary(maxParts: number): Recipe[] {
  const out: Recipe[] = [];
  const parts = new Array(PAINTS.length).fill(0);
  const walk = (i: number, left: number) => {
    if (i === PAINTS.length) {
      const total = parts.reduce((a, b) => a + b, 0);
      if (total === 0 || parts.reduce(gcd) !== 1) return;
      const rgb = mixPaints(parts);
      out.push({ parts: [...parts], total, rgb, lab: rgbToLab(rgb) });
      return;
    }
    for (let n = 0; n <= left; n++) {
      parts[i] = n;
      walk(i + 1, left - n);
    }
    parts[i] = 0;
  };
  walk(0, maxParts);
  return out;
}

export const LIBRARY = buildLibrary(CONFIG.maxParts);
export const SIMPLE = LIBRARY.filter((r) => r.total <= CONFIG.simpleParts);

export interface Match {
  recipe: Recipe;
  deltaE: number;
}

/** Exhaustive search for the closest recipe; the part penalty only breaks near-ties. */
export function bestMatch(target: Lab, library: Recipe[] = SIMPLE): Match {
  let best: Match | null = null;
  let bestScore = Infinity;
  for (const recipe of library) {
    const d = deltaE(target, recipe.lab);
    const score = d + CONFIG.partPenalty * recipe.total;
    if (score < bestScore) {
      bestScore = score;
      best = { recipe, deltaE: d };
    }
  }
  return best!;
}

export function difficulty(target: Lab) {
  const match = bestMatch(target, SIMPLE);
  const tier = CONFIG.tiers.find((t) => match.deltaE < t.below)!;
  return { ...match, tier };
}

export interface BestMix {
  weights: number[]; // fraction of each paint, in PAINTS order, summing to 1
  rgb: RGB;
  deltaE: number;
}

/**
 * The closest any mix of the paints can get to a target, in any proportions. Starts from the few best library
 * recipes and fine-tunes the proportions with a shrinking-step search until no nudge gets any closer.
 */
export function bestPossible(target: Lab, starts = 5): BestMix {
  const score = (w: number[]) => deltaE(target, rgbToLab(mixPaints(w)));
  const seeds = [...LIBRARY]
    .map((r) => ({ r, d: deltaE(target, r.lab) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, starts);
  let best = { w: [] as number[], d: Infinity };
  for (const { r } of seeds) {
    let w = r.parts.map((p) => p / r.total);
    let d = score(w);
    for (let step = 0.08; step > 1e-4; step /= 2) {
      for (let improved = true; improved; ) {
        improved = false;
        for (let i = 0; i < w.length; i++) {
          for (const sign of [1, -1]) {
            const next = w.map((x, j) => (j === i ? Math.max(0, x + sign * step) : x));
            const sum = next.reduce((a, b) => a + b, 0);
            if (sum === 0) continue;
            const normalized = next.map((x) => x / sum);
            const nd = score(normalized);
            if (nd < d - 1e-6) {
              w = normalized;
              d = nd;
              improved = true;
            }
          }
        }
      }
    }
    if (d < best.d) best = { w, d };
  }
  return { weights: best.w, rgb: mixPaints(best.w), deltaE: best.d };
}
