import { labToRgb, type Lab } from "./color";

const SVG = "http://www.w3.org/2000/svg";
const SIZE = 300;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * The a* b* plane at the target's lightness, with a dot for each color and an arrow
 * from the actual color to the target. Beside it, a lightness bar with both L* values.
 */
export function colorSpacePlot(target: Lab, actual: Lab, targetCss: string, actualCss: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "plot";

  // Zoom so both dots fit, but never closer than ±30 so small differences still read as small.
  const reach = Math.max(Math.abs(target.a), Math.abs(target.b), Math.abs(actual.a), Math.abs(actual.b));
  const range = Math.min(128, Math.max(30, reach * 1.3));
  const toX = (a: number) => ((a + range) / (2 * range)) * SIZE;
  const toY = (b: number) => ((range - b) / (2 * range)) * SIZE;

  const plane = document.createElement("div");
  plane.className = "plane";
  const canvas = document.createElement("canvas");
  const cells = 75;
  canvas.width = canvas.height = cells;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(cells, cells);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const a = ((x + 0.5) / cells) * 2 * range - range;
      const b = range - ((y + 0.5) / cells) * 2 * range;
      const rgb = labToRgb({ mode: "lab65", l: target.l, a, b });
      const i = (y * cells + x) * 4;
      // Colors a screen cannot show are left dark.
      const [r, g, bl] = rgb ?? [18, 14, 24];
      img.data.set([r, g, bl, 255], i);
    }
  }
  ctx.putImageData(img, 0, 0);
  plane.append(canvas);

  const svg = el("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, width: SIZE, height: SIZE, role: "img" });
  svg.setAttribute("aria-label", "Target and your color on the a* b* color plane");
  const defs = el("defs", {});
  const marker = el("marker", { id: "arrowhead", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
  marker.append(el("path", { d: "M0,0 L10,5 L0,10 z", class: "arrow-head" }));
  defs.append(marker);
  svg.append(defs);

  svg.append(el("line", { x1: toX(0), y1: 0, x2: toX(0), y2: SIZE, class: "axis" }));
  svg.append(el("line", { x1: 0, y1: toY(0), x2: SIZE, y2: toY(0), class: "axis" }));
  const label = (text: string, x: number, y: number, anchor: string) => {
    const t = el("text", { x, y, "text-anchor": anchor, class: "axis-label" });
    t.textContent = text;
    svg.append(t);
  };
  label("+a* red", SIZE - 6, toY(0) - 6, "end");
  label("−a* green", 6, toY(0) - 6, "start");
  label("+b* yellow", toX(0) + 6, 14, "start");
  label("−b* blue", toX(0) + 6, SIZE - 8, "start");

  const [x1, y1, x2, y2] = [toX(actual.a), toY(actual.b), toX(target.a), toY(target.b)];
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len > 26) {
    // Stop the arrow at the edge of the target dot.
    const k = (len - 11) / len;
    svg.append(el("line", { x1, y1, x2: x1 + (x2 - x1) * k, y2: y1 + (y2 - y1) * k, class: "arrow", "marker-end": "url(#arrowhead)" }));
  }
  svg.append(el("circle", { cx: x1, cy: y1, r: 8, fill: actualCss, class: "dot dot-actual" }));
  svg.append(el("circle", { cx: x2, cy: y2, r: 9, fill: targetCss, class: "dot dot-target" }));
  plane.append(svg);

  // Lightness bar: 0 (black) at the bottom, 100 (white) at the top.
  const bar = document.createElement("div");
  bar.className = "lbar";
  const mark = (l: number, cls: string, text: string, css: string) => {
    const m = document.createElement("div");
    m.className = `lmark ${cls}`;
    m.style.bottom = `${Math.min(100, Math.max(0, l))}%`;
    m.style.setProperty("--dot", css);
    m.title = `${text} L* ${l.toFixed(0)}`;
    bar.append(m);
  };
  const clampL = (l: number) => Math.min(100, Math.max(0, l));
  if (Math.abs(target.l - actual.l) >= 3) {
    const arrow = document.createElement("div");
    arrow.className = `larrow ${target.l > actual.l ? "larrow-up" : "larrow-down"}`;
    // Leave room so the arrowhead stops just short of the target mark.
    const low = clampL(Math.min(target.l, actual.l));
    const gap = target.l > actual.l ? 0 : 10;
    arrow.style.bottom = `calc(${low}% + ${gap}px)`;
    arrow.style.height = `max(0px, calc(${Math.abs(clampL(target.l) - clampL(actual.l))}% - 10px))`;
    bar.append(arrow);
  }
  mark(actual.l, "lmark-actual", "Yours", actualCss);
  mark(target.l, "lmark-target", "Target", targetCss);

  const legend = document.createElement("div");
  legend.className = "plot-legend";
  legend.innerHTML = `
    <span><i class="key key-target" style="background:${targetCss}"></i>Target</span>
    <span><i class="key key-actual" style="background:${actualCss}"></i>Your brew</span>
    <span class="muted">Arrow points the way to go. Bar on the right is lightness.</span>`;

  const row = document.createElement("div");
  row.className = "plot-row";
  row.append(plane, bar);
  wrap.append(row, legend);
  return wrap;
}
