import mixbox from "mixbox";
import { CONFIG, type RGB } from "./config";
import { chroma, deltaE, hue, namingHue, rgbToLab, type Lab } from "./color";
import { PAINTS, mixLatents } from "./mix";

// Typical OKLCH hue angles for naming directions around the color wheel.
const HUE_NAMES: [number, string][] = [
  [355, "pink"], [25, "red"], [58, "orange"], [105, "yellow"], [125, "lime"],
  [148, "green"], [192, "teal"], [225, "sky blue"], [262, "blue"], [305, "purple"], [330, "magenta"],
];

/** Name for an OKLCH hue angle (see namingHue). */
export function hueName(h: number): string {
  let best = HUE_NAMES[0];
  for (const entry of HUE_NAMES) {
    if (angleDiff(entry[0], h) ** 2 < angleDiff(best[0], h) ** 2) best = entry;
  }
  return best[1];
}

/** Signed shortest difference to - from, in degrees (-180..180]. */
const angleDiff = (to: number, from: number) => ((to - from + 540) % 360) - 180;

export interface Direction {
  dL: number; // target minus actual
  dC: number;
  dH: number; // degrees, target minus actual
  notes: string[];
}

/** Plain-language description of how the actual color differs from the target. */
export function describeDirection(target: Lab, actual: Lab): Direction {
  const dL = target.l - actual.l;
  const cT = chroma(target), cA = chroma(actual);
  const dC = cT - cA;
  const dH = angleDiff(hue(target), hue(actual));
  const notes: string[] = [];

  if (Math.abs(dL) >= 3) {
    const amount = Math.abs(dL) >= 15 ? "much" : Math.abs(dL) >= 7 ? "" : "a bit";
    notes.push(`${amount} too ${dL > 0 ? "dark" : "light"}`.trim());
  }
  if (Math.abs(dC) >= 4) {
    const amount = Math.abs(dC) >= 20 ? "much" : Math.abs(dC) >= 10 ? "" : "a bit";
    notes.push(`${amount} too ${dC > 0 ? "dull and grey" : "vivid"}`.trim());
  }
  // Hue only means something when both colors have some color in them.
  const hueWeight = Math.min(cT, cA) * Math.abs(dH) * (Math.PI / 180);
  if (Math.min(cT, cA) >= 6 && hueWeight >= 3) {
    // Lab decides whether hue is off; OKLCH names which way.
    const hA = namingHue(actual), hT = namingHue(target);
    const step = angleDiff(hT, hA);
    const from = hueName(hA);
    const toward = hueName(hA + Math.sign(step) * Math.min(Math.abs(step), 45));
    notes.push(
      toward === from
        ? `slightly off in hue, shift toward ${hueName(hT)}`
        : `too ${from}, shift toward ${toward}`,
    );
  } else if (cT >= 6 && cA < 6) {
    notes.push(`needs more color (target is ${hueName(namingHue(target))})`);
  }
  if (!notes.length) notes.push("no clear direction, it's very close");
  return { dL, dC, dH, notes };
}

const AMOUNTS: [number, string][] = [
  [0.05, "a hint of"],
  [0.15, "a touch of"],
  [0.35, "a dab of"],
  [0.7, "a good dab of"],
];

export interface Correction {
  steps: string[]; // e.g. ["a touch of white", "a hint of red"]
  rgb: RGB;
  deltaE: number;
}

/**
 * Tries adding small amounts of up to two paints to the current swatch (Mixbox mixing)
 * and returns the addition that brings it closest to the target.
 */
export function suggestCorrection(target: Lab, actualRgb: RGB, currentDeltaE: number): Correction | null {
  const base = mixbox.rgbToLatent(...actualRgb);
  const paints = PAINTS.map((p) => mixbox.rgbToLatent(...CONFIG.paints[p]));
  let best: Correction | null = null;
  let bestCost = Infinity;

  const consider = (adds: [number, number][]) => {
    const rgb = mixLatents([base, ...adds.map(([i]) => paints[i])], [1, ...adds.map(([, a]) => AMOUNTS[a][0])]);
    const d = deltaE(target, rgbToLab(rgb));
    // Prefer fewer, smaller additions unless they are clearly worse.
    const cost = d + 0.3 * adds.length + adds.reduce((s, [, a]) => s + 0.1 * a, 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = { steps: adds.map(([i, a]) => `${AMOUNTS[a][1]} ${PAINTS[i]}`), rgb, deltaE: d };
    }
  };

  for (let i = 0; i < PAINTS.length; i++) {
    for (let a = 0; a < AMOUNTS.length; a++) {
      consider([[i, a]]);
      for (let j = i + 1; j < PAINTS.length; j++) {
        for (let b = 0; b < AMOUNTS.length; b++) consider([[i, a], [j, b]]);
      }
    }
  }
  const found = best as Correction | null;
  // Only worth suggesting if it is a real improvement.
  if (!found || found.deltaE > currentDeltaE - 1) return null;
  return found;
}

export function judge(d: number) {
  return CONFIG.judging.find((t) => d < t.below)!;
}
