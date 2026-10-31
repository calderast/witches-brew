import { converter, differenceCiede2000 } from "culori";
import type { Lab65 as Lab } from "culori";
import type { RGB } from "./config";

export type { Lab };

const toLab = converter("lab65");
const toRgb = converter("rgb");
const de2000 = differenceCiede2000();

export type ParsedCode = { ok: true; hex: string } | { ok: false; error: string };

/** Accepts A37FE2, #a37fe2, A3 7F E2, A3-7F-E2: keeps only hex digits, uppercased. */
export function parseCode(input: string): ParsedCode {
  const hex = input.toUpperCase().replace(/[^0-9A-F]/g, "");
  if (hex.length !== 6) {
    return { ok: false, error: `Need 6 characters, you have ${hex.length}` };
  }
  return { ok: true, hex };
}

export const spaced = (hex: string) => `${hex.slice(0, 2)} ${hex.slice(2, 4)} ${hex.slice(4, 6)}`;

export function hexToRgb(hex: string): RGB {
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
}

export function rgbToHex([r, g, b]: RGB): string {
  return [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function rgbToLab([r, g, b]: RGB): Lab {
  return toLab({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
}

export const deltaE = (a: Lab, b: Lab) => de2000(a, b);

/** Lab back to sRGB, or null when the color is outside the screen gamut. */
export function labToRgb(lab: Lab): RGB | null {
  const c = toRgb(lab);
  const eps = 0.001;
  if ([c.r, c.g, c.b].some((v) => v < -eps || v > 1 + eps)) return null;
  return [c.r, c.g, c.b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)) as RGB;
}

export const chroma = (lab: Lab) => Math.hypot(lab.a, lab.b);
export const hue = (lab: Lab) => ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;

const toOklch = converter("oklch");
/** OKLCH hue in degrees. Better than Lab hue for naming colors, which bunches blues and purples together. */
export const namingHue = (lab: Lab) => toOklch(lab).h ?? 0;
