// The Welcome reveal: the red, green and blue cards drop into the cauldron one at a time, and the potion
// builds up channel by channel (red, then red + green, then the full color) while it's stirred. The first card
// starts the stirring, the second makes it drip over the rim, and the third sets it bubbling. Then the cauldron
// slides over and the details appear.
//
// The Compare reveal: the brew fills and stirs, settles, then bubbles calmly, sputters, or boils over, and only
// then does the score appear.

const EMPTY = "#1d1724";
const DROP_MS = 1100;
const GAP_MS = 1300;
const SETTLE_MS = 900;

let flying: Animation[] = [];
let timer = 0;
let judgeTimers: number[] = [];

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Stops a brew in progress and clears any cards still in the air. */
export function cancelBrew() {
  flying.forEach((a) => a.cancel());
  flying = [];
  clearTimeout(timer);
}

export function brewReveal(hex: string, cards: HTMLElement[], result: HTMLElement) {
  cancelBrew();
  if (reducedMotion()) return;

  const cauldron = result.querySelector<SVGSVGElement>(".cauldron")!;
  const potion = [...cauldron.querySelectorAll<SVGElement>(".potion")];
  const surface = cauldron.querySelector<SVGElement>(".surface")!;
  const stages = [`#${hex.slice(0, 2)}0000`, `#${hex.slice(0, 4)}00`, `#${hex}`];
  const fill = (color: string) => potion.forEach((p) => (p.style.fill = color));

  result.classList.add("brewing");
  fill(EMPTY);

  cards.forEach((card, i) => {
    const from = card.getBoundingClientRect();
    const to = surface.getBoundingClientRect();
    const fly = document.createElement("div");
    fly.className = `${card.className} flying`;
    fly.innerHTML = `<div class="face">${hex.slice(i * 2, i * 2 + 2)}</div><span class="bar"></span>`;
    Object.assign(fly.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.append(fly);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const spin = (i - 1) * 28;
    const drop = fly.animate(
      [
        { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.25 - 70}px) scale(0.85) rotate(${spin}deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy - 10}px) scale(0.35) rotate(${spin * 2}deg)`, opacity: 1, offset: 0.85 },
        { transform: `translate(${dx}px, ${dy + 6}px) scale(0.18) rotate(${spin * 2}deg)`, opacity: 0 },
      ],
      { duration: DROP_MS, delay: i * GAP_MS, easing: "cubic-bezier(0.4, 0, 0.6, 1)", fill: "forwards" },
    );
    flying.push(drop);
    drop.finished.then(() => {
      fly.remove();
      fill(stages[i]);
      if (i === 0) cauldron.classList.add("stirring");
      if (i === 1) {
        cauldron.classList.add("dripping");
        cauldron.classList.remove("hide-drips");
      }
      if (i === 2) cauldron.classList.remove("hide-bubbles");
      cauldron.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.05, 0.96)" }, { transform: "scale(0.98, 1.02)" }, { transform: "scale(1)" }],
        { duration: 420, easing: "ease-out" },
      );
      if (i === 2) timer = window.setTimeout(() => settle(result, cauldron), SETTLE_MS);
    }, () => fly.remove());
  });
}

// The cauldron glides from the middle to its place beside the details, which then fade in.
function settle(result: HTMLElement, cauldron: SVGSVGElement) {
  const before = cauldron.getBoundingClientRect();
  result.classList.remove("brewing");
  result.classList.add("brewed");
  cauldron.classList.remove("stirring", "dripping");
  const after = cauldron.getBoundingClientRect();
  cauldron.animate(
    [
      {
        transform: `translate(${before.left + before.width / 2 - (after.left + after.width / 2)}px, ${
          before.top + before.height / 2 - (after.top + after.height / 2)}px) scale(${before.width / after.width})`,
      },
      { transform: "none" },
    ],
    { duration: 700, easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
  );
}

/**
 * Compare: the brew cauldron (rendered already holding its final mood) fills in its color while stirring, drips,
 * starts bubbling, and only then shows its mood: calm, sputtering, or boiling over. Then the score appears.
 */
export type Celebration = "heart" | "sparkle" | "mixed" | "skull";

let judging: { result: HTMLElement; brew: SVGSVGElement; mood: string } | null = null;
let flood: HTMLElement | null = null; // the full-screen moment for a result: the Miss flood, or a celebration

/** Ends a Test your brew reveal right away: no flood, the brew in its final state, the score showing. */
export function finishJudging() {
  judgeTimers.forEach((t) => { clearTimeout(t); clearInterval(t); });
  judgeTimers = [];
  flood?.remove();
  flood = null;
  if (!judging) return;
  const { result, brew, mood } = judging;
  brew.classList.remove("stirring", "dripping", "hide-drips", "hide-bubbles", "cauldron-calm", "teetering");
  brew.classList.add(`cauldron-${mood}`);
  brew.querySelectorAll<SVGElement>(".potion").forEach((p) => (p.style.fill = ""));
  result.classList.remove("judging", "spotlight");
  result.classList.add("judged", "name-in");
  judging = null;
}

/**
 * Test your brew, step by step: the target cauldron grows and glows for a moment while yours waits; then yours
 * fills in its color while stirring, drips, starts bubbling, and settles into its mood (calm, sputtering, or
 * boiling over); its name pops in; then the tier's moment plays (a celebration or the Miss flood) and the score
 * shows.
 */
const SPOTLIGHT = 1900;

export function judgeReveal(result: HTMLElement, celebrate?: Celebration, word = "") {
  finishJudging();
  const brew = result.querySelectorAll<SVGSVGElement>(".cauldron")[1];
  if (!brew || reducedMotion()) return result.classList.add("judged", "name-in");
  const mood = brew.dataset.mood!;
  judging = { result, brew, mood };
  const color = brew.querySelector<SVGElement>(".surface")!.getAttribute("fill")!;
  const potion = [...brew.querySelectorAll<SVGElement>(".potion")];
  const later = (ms: number, fn: () => void) => judgeTimers.push(window.setTimeout(fn, SPOTLIGHT + ms));
  const done = () => {
    result.classList.remove("judging");
    result.classList.add("judged");
    judging = null;
  };

  brew.classList.replace(`cauldron-${mood}`, "cauldron-calm");
  potion.forEach((p) => { p.style.transition = "none"; p.style.fill = EMPTY; });
  result.classList.add("judging");
  judgeTimers.push(window.setTimeout(() => result.classList.add("spotlight"), 40));
  later(0, () => result.classList.remove("spotlight"));
  later(400, () => potion.forEach((p) => { p.style.transition = "fill 2.4s ease"; p.style.fill = color; }));
  later(1850, () => {
    brew.classList.add("dripping");
    brew.classList.remove("hide-drips");
  });
  later(2750, () => brew.classList.remove("hide-bubbles"));
  later(3650, () => {
    brew.classList.remove("stirring", "dripping");
    brew.classList.replace("cauldron-calm", `cauldron-${mood}`);
    result.classList.add("name-in");
  });
  if (celebrate) later(3850, () => addCelebration(brew, celebrate));
  later(5000, () => {
    if (celebrate === "skull") floodScreen(brew, color, word, done);
    else if (celebrate) celebrateScreen(brew, celebrate, word, done);
    else done();
  });
}

// Timings for the flood, in ms: streams pour from the rim, the potion rises to fill the screen, "miss" slams in,
// then it all drains away.
const POUR = 500, RISE = 1300, HOLD = 1200, DRAIN = 1000;

function floodScreen(brew: SVGSVGElement, color: string, word: string, done: () => void) {
  const rim = brew.querySelector(".surface")!.getBoundingClientRect();
  flood = document.createElement("div");
  const el = flood;
  el.className = "flood";
  el.style.setProperty("--potion", color);
  // Two sheets of potion pour over the left and right sides of the rim, thick at the lip and narrowing as they fall.
  const top = rim.top + rim.height / 2 - 4;
  const left = rim.left - 70, width = rim.width + 140, h = innerHeight - top;
  const a = 70, b = width - 70;
  const pourL = `M${a + 46} 0 C${a - 10} 2, ${a - 34} 30, ${a - 30} 84 C${a - 24} ${h * 0.45}, ${a - 40} ${h * 0.75}, ${a - 32} ${h}
    L${a - 8} ${h} C${a - 14} ${h * 0.75}, ${a + 2} ${h * 0.45}, ${a - 6} 90 C${a - 8} 50, ${a + 8} 18, ${a + 46} 0 Z`;
  const pourR = `M${b - 46} 0 C${b + 10} 2, ${b + 34} 30, ${b + 30} 84 C${b + 24} ${h * 0.45}, ${b + 40} ${h * 0.75}, ${b + 32} ${h}
    L${b + 8} ${h} C${b + 14} ${h * 0.75}, ${b - 2} ${h * 0.45}, ${b + 6} 90 C${b + 8} 50, ${b - 8} 18, ${b - 46} 0 Z`;
  const streams = `<svg class="pour" style="left:${left}px; top:${top}px; width:${width}px; height:${h}px"
    viewBox="0 0 ${width} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${pourL}"/><path d="${pourR}" style="animation-delay:-0.6s"/></svg>`;
  const floaters = Array.from({ length: 9 }, (_, i) =>
    `<span class="${i % 3 === 0 ? "flood-skull" : "flood-bubble"}" style="left:${8 + i * 10.5}%; animation-delay:${(i * 0.23).toFixed(2)}s"></span>`).join("");
  el.innerHTML = `${streams}
    <div class="flood-liquid">
      <svg class="wave" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 30 Q 75 0 150 30 T 300 30 T 450 30 T 600 30 T 750 30 T 900 30 T 1050 30 T 1200 30 V60 H0 Z"/>
      </svg>
      ${floaters}
    </div>
    <div class="flood-word">${word}</div>`;
  document.body.append(el);
  const liquid = el.querySelector<HTMLElement>(".flood-liquid")!;
  const big = el.querySelector<HTMLElement>(".flood-word")!;

  let draining = false;
  const drain = () => {
    if (draining || flood !== el) return;
    draining = true;
    judgeTimers.forEach(clearTimeout);
    judgeTimers = [];
    done();
    big.animate([{ opacity: 1 }, { opacity: 0, transform: "translate(-50%, -50%) scale(0.9)" }], { duration: 300, fill: "forwards" });
    liquid.animate([{ height: "115vh" }, { height: "0vh" }], { duration: DRAIN, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" })
      .finished.then(() => {
        el.remove();
        if (flood === el) flood = null;
      });
  };
  el.addEventListener("click", drain);

  liquid.animate([{ height: "0vh" }, { height: "115vh" }], { duration: RISE, delay: POUR, easing: "cubic-bezier(0.3, 0, 0.6, 1)", fill: "both" });
  big.animate(
    [
      { opacity: 0, transform: "translate(-50%, -50%) scale(2.4) rotate(-8deg)" },
      { opacity: 1, transform: "translate(-50%, -50%) scale(0.9) rotate(3deg)", offset: 0.6 },
      { opacity: 1, transform: "translate(-50%, -50%) scale(1) rotate(-2deg)" },
    ],
    { duration: 450, delay: POUR + RISE - 150, easing: "ease-out", fill: "both" },
  );
  judgeTimers.push(window.setTimeout(drain, POUR + RISE + HOLD));
}

const CONFETTI = ["#ff4fa3", "#ffe24a", "#35c8ff", "#9b5cff", "#7dff6b", "#ffffff"];

/**
 * A good brew's moment. Perfect: Nerds-candy confetti and hearts burst out of the cauldron and a giant holographic
 * word bounces in. Close enough: a shower of sparkles and a lemon word. Click to skip ahead.
 */
function celebrateScreen(brew: SVGSVGElement, kind: "heart" | "sparkle" | "mixed", word: string, done: () => void) {
  if (kind === "mixed") return undecidedScreen(brew, word, done);
  const perfect = kind === "heart";
  const rim = brew.querySelector(".surface")!.getBoundingClientRect();
  const x = rim.left + rim.width / 2, y = rim.top + rim.height / 2;
  flood = document.createElement("div");
  const el = flood;
  el.className = `celebrate ${perfect ? "celebrate-perfect" : "celebrate-close"}`;
  el.innerHTML = `<div class="celebrate-glow" style="--x:${x}px; --y:${y}px"></div><div class="celebrate-word">${word}!</div>`;
  document.body.append(el);

  const count = perfect ? 70 : 34;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("span");
    const heart = perfect && i % 6 === 0;
    const sparkle = !perfect || i % 5 === 0;
    bit.className = heart ? "bit bit-heart" : sparkle ? "bit bit-spark" : "bit bit-candy";
    if (heart) bit.textContent = "♥";
    else if (sparkle) bit.textContent = i % 2 ? "✦" : "✧";
    const color = CONFETTI[i % CONFETTI.length];
    Object.assign(bit.style, { left: `${x}px`, top: `${y}px`, color, background: heart || sparkle ? "" : color });
    el.append(bit);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * (perfect ? 2.4 : 3);
    const power = (perfect ? 380 : 260) * (0.5 + Math.random());
    const dx = Math.cos(angle) * power, up = Math.sin(angle) * power;
    const spin = (Math.random() - 0.5) * 720;
    bit.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.4) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${up}px)) scale(1) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(calc(-50% + ${dx * 1.4}px), calc(-50% + ${innerHeight - y + 60}px)) scale(0.9) rotate(${spin}deg)`, opacity: 0.9 },
      ],
      { duration: 2400 + Math.random() * 900, delay: Math.random() * 250, easing: "cubic-bezier(0.2, 0.6, 0.4, 1)", fill: "both" },
    );
  }

  const big = el.querySelector<HTMLElement>(".celebrate-word")!;
  big.animate(
    [
      { opacity: 0, transform: "translate(-50%, -50%) scale(0.2) rotate(-10deg)" },
      { opacity: 1, transform: "translate(-50%, -50%) scale(1.15) rotate(4deg)", offset: 0.55 },
      { opacity: 1, transform: "translate(-50%, -50%) scale(1) rotate(-2deg)" },
    ],
    { duration: 650, delay: 250, easing: "cubic-bezier(0.3, 1.4, 0.5, 1)", fill: "both" },
  );

  let ending = false;
  const end = () => {
    if (ending || flood !== el) return;
    ending = true;
    judgeTimers.forEach(clearTimeout);
    judgeTimers = [];
    done();
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" }).finished.then(() => {
      el.remove();
      if (flood === el) flood = null;
    });
  };
  el.addEventListener("click", end);
  judgeTimers.push(window.setTimeout(end, perfect ? 2900 : 2200));
}

/**
 * Convince me, in beats while the cauldron rocks back and forth: "this might work!" with hearts floating up,
 * "haha jk" with skulls, "...unless?" with shy pointing fingers and both, then the verdict itself, big, before it
 * settles into the score below.
 */
const BEATS: { text: string; bits: ("heart" | "skull")[]; at: number }[] = [
  { text: "this might work!", bits: ["heart"], at: 0 },
  { text: "haha jk", bits: ["skull"], at: 2200 },
  { text: `...unless? <span class="fingers"><span>👉</span><span>👈</span></span>`, bits: ["heart", "skull"], at: 4400 },
  { text: "", bits: [], at: 6800 }, // the verdict word
];
const BEAT_END = 8600;

function undecidedScreen(brew: SVGSVGElement, word: string, done: () => void) {
  const rim = brew.querySelector(".surface")!.getBoundingClientRect();
  const x = rim.left + rim.width / 2, y = rim.top + rim.height / 2;
  flood = document.createElement("div");
  const el = flood;
  el.className = "celebrate celebrate-maybe";
  el.innerHTML = `<div class="celebrate-glow" style="--x:${x}px; --y:${y}px"></div><div class="celebrate-word"></div>`;
  document.body.append(el);
  brew.classList.add("teetering");
  const big = el.querySelector<HTMLElement>(".celebrate-word")!;

  const float = (kind: "heart" | "skull", delay: number) => {
    const bit = document.createElement("span");
    bit.className = `bit bit-${kind}`;
    bit.textContent = kind === "heart" ? "♥" : "☠";
    const side = Math.random() < 0.5 ? -1 : 1;
    Object.assign(bit.style, { left: `${x + side * (10 + Math.random() * 70)}px`, top: `${y}px` });
    el.append(bit);
    const sway = side * (40 + Math.random() * 80);
    bit.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0 },
        { transform: `translate(calc(-50% + ${sway * 0.5}px), calc(-50% - 90px)) scale(1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + ${-sway * 0.3}px), calc(-50% - 200px)) scale(1.1)`, opacity: 0.9, offset: 0.65 },
        { transform: `translate(calc(-50% + ${sway}px), calc(-50% - 320px)) scale(1.3)`, opacity: 0 },
      ],
      { duration: 2000, delay, easing: "ease-out", fill: "both" },
    ).finished.then(() => bit.remove(), () => bit.remove());
  };

  BEATS.forEach(({ text, bits, at }, n) => {
    judgeTimers.push(window.setTimeout(() => {
      big.innerHTML = text || word;
      big.dataset.beat = String(n + 1);
      big.animate(
        [
          { opacity: 0, transform: "translate(-50%, -50%) scale(0.5) rotate(-6deg)" },
          { opacity: 1, transform: "translate(-50%, -50%) scale(1.1) rotate(3deg)", offset: 0.6 },
          { opacity: 1, transform: "translate(-50%, -50%) scale(1) rotate(0deg)" },
        ],
        { duration: 450, easing: "cubic-bezier(0.3, 1.4, 0.5, 1)", fill: "both" },
      );
      for (let i = 0; i < 8; i++) float(bits[i % bits.length], i * 150);
    }, at));
  });

  let ending = false;
  const end = () => {
    if (ending || flood !== el) return;
    ending = true;
    judgeTimers.forEach(clearTimeout);
    judgeTimers = [];
    brew.classList.remove("teetering");
    done();
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" }).finished.then(() => {
      el.remove();
      if (flood === el) flood = null;
    });
  };
  el.addEventListener("click", end);
  judgeTimers.push(window.setTimeout(end, BEAT_END));
}

// Sparkles twinkling around a good brew, and for Spot On, hearts of smoke rising out of it.
const SPARKLES: [number, number, number][] = [[26, 40, 18], [212, 30, 22], [60, 4, 14], [186, -6, 16], [8, 120, 14], [228, 110, 18], [120, -24, 20]];
const HEART = "M0 6 C0 -2 -11 -4 -11 4 C-11 11 -2 15 0 20 C2 15 11 11 11 4 C11 -4 0 -2 0 6 Z";

// A skull of green smoke, centered on 0,0
const SKULL = `<circle r="11"/><rect x="-7" y="6" width="14" height="9" rx="3"/>
  <circle class="hole" cx="-4.2" cy="0" r="3.4"/><circle class="hole" cx="4.2" cy="0" r="3.4"/>
  <path class="hole" d="M0 4 l-1.6 3 h3.2 z"/><path class="hole" d="M-3 11 v4 M0 11 v4 M3 11 v4" stroke-width="1.3"/>`;

function addCelebration(cauldron: SVGSVGElement, kind: Celebration) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "celebration");
  if (kind === "mixed") {
    g.innerHTML = `<g transform="translate(104 60)"><path class="heart-smoke" d="${HEART}"/></g>
      <g transform="translate(138 58)"><g class="skull-smoke" style="animation-delay:1.6s">${SKULL}</g></g>`;
    cauldron.append(g);
    return;
  }
  if (kind === "skull") {
    g.innerHTML = [[96, 0], [144, 1.1], [120, 2.2]].map(([x, d]) =>
      `<g transform="translate(${x} 58)"><g class="skull-smoke" style="animation-delay:${d}s">${SKULL}</g></g>`).join("");
    cauldron.append(g);
    return;
  }
  const hearts = kind === "heart"
    ? [0, 1.6].map((d) => `<g transform="translate(120 60)"><path class="heart-smoke" d="${HEART}" style="animation-delay:${d}s"/></g>`).join("")
    : "";
  const sparkles = SPARKLES.map(([x, y, size], i) =>
    `<text class="spark" x="${x}" y="${y}" font-size="${size}" style="animation-delay:${(i * 0.37) % 1.8}s">${i % 2 ? "✧" : "✦"}</text>`).join("");
  g.innerHTML = hearts + sparkles;
  cauldron.append(g);
}

/** Test your brew: the target pours into its cauldron as soon as its code is typed, and its name fades in. */
export function pourTarget(cauldron: SVGSVGElement, caption: Element) {
  if (reducedMotion()) return;
  const color = cauldron.querySelector<SVGElement>(".surface")!.getAttribute("fill")!;
  const potion = [...cauldron.querySelectorAll<SVGElement>(".potion")];
  cauldron.classList.add("hide-drips", "hide-bubbles", "stirring");
  potion.forEach((p) => { p.style.transition = "none"; p.style.fill = EMPTY; });
  caption.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 600, fill: "backwards" });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    potion.forEach((p) => { p.style.transition = "fill 1.4s ease"; p.style.fill = color; });
  }));
  setTimeout(() => cauldron.classList.remove("hide-drips"), 900);
  setTimeout(() => cauldron.classList.remove("hide-bubbles", "stirring"), 1500);
}
