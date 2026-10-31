import "./style.css";
import { CONFIG } from "./config";
import { deltaE, hexToRgb, parseCode, rgbToHex, rgbToLab, spaced } from "./color";
import { PAINTS, bestPossible, difficulty } from "./mix";
import { describeDirection, judge, suggestCorrection } from "./feedback";
import { addGuess, bestGuess, clearBoard, rankedBoard } from "./leaderboard";
import { brewReveal, cancelBrew, finishJudging, judgeReveal, pourTarget, reducedMotion, type Celebration } from "./brew";
import { cardEntry, hexOnly } from "./cards";
import { colorSpacePlot } from "./plot";
import { NUMBER_SWAPS, RULE_SECTIONS } from "./rules";
import { mountCamera } from "./camera";
import { mountScene } from "./scene";
import { magicWand } from "./wand";
import { addSteam, brewNameHtml, potionName, brewPotion, cauldronSvg, pointHints, potionFor, specialEffect, specialHint, type Mood, type Potion } from "./potion";
import { WORDS, score } from "./score";

type Tab = "welcome" | "points" | "compare" | "color" | "camera" | "leaderboard" | "rules";
const TABS: Tab[] = ["welcome", "points", "compare", "color", "camera", "leaderboard", "rules"];

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (d: number) => d.toFixed(1);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const tierLabel = (name: string) => CONFIG.judging.find((t) => t.name === name)?.label ?? name;
const tierClass = (name: string) => `judge-${name.toLowerCase().replace(" ", "-")}`;

// The last valid code carries across screens so staff don't retype it.
let currentCode = "";
const EMPTY_POT = "1D1724";

let lastTab: Tab | null = null;

// A camera reading goes into Test your brew as the brew's hex.
const camera = mountCamera($<HTMLElement>("[data-camera]"), (hex) => {
  $<HTMLInputElement>('[data-form="compare"] input[name="actual"]').value = spaced(hex);
  location.hash = "#compare";
});

// The 1000 Oak street scene is at full strength on an unbrewed Welcome screen, fades back on most screens, and is
// hidden on Color so nothing competes with the swatch.
function setScene() {
  const active = (t: Tab) => $(`#${t}`).classList.contains("active");
  const brewed = !!document.querySelector("#welcome .welcome-result:not(.empty)");
  document.body.dataset.scene = active("color") || active("camera") ? "off" : active("welcome") && !brewed ? "full" : "dim";
}

function showTab(tab: Tab) {
  const arriving = tab !== lastTab;
  // Leaving Test your brew mid-reveal skips to the result, so a flood never spills onto another screen.
  if (arriving) finishJudging();
  // The camera only runs while its tab is open.
  if (tab === "camera") camera.start();
  else camera.stop();
  lastTab = tab;
  for (const t of TABS) {
    $(`#${t}`).classList.toggle("active", t === tab);
    $(`[data-tab="${t}"]`).classList.toggle("active", t === tab);
  }
  setScene();
  if (tab === "leaderboard") {
    renderBoard();
    return;
  }
  if (tab === "rules" || tab === "camera") return;
  // Welcome starts fresh every time you come back to it, for the next player.
  if (tab === "welcome") {
    if (arriving) resetWelcome(false);
    return;
  }
  const form = $<HTMLFormElement>(`[data-form="${tab}"]`);
  const carry = form.querySelector<HTMLInputElement>("input.carry")!;
  const shown = parseCode(carry.value);
  const changed = !shown.ok || shown.hex !== currentCode;
  const result = $(`[data-result="${tab}"]`);
  if (currentCode && (changed || !result.hasChildNodes())) {
    carry.value = spaced(currentCode);
    $(`[data-error="${tab}"]`).textContent = "";
    // Points and Color show right away. Compare saves a guess on submit, so it only fills the target.
    if (tab !== "compare") form.requestSubmit();
    else if (changed) renderCompareTarget(currentCode);
  }
  const inputs = [...form.querySelectorAll<HTMLInputElement>("input")];
  (inputs.find((i) => !i.value) ?? inputs[0]).focus({ preventScroll: true });
}

function readCode(tab: Tab, input: HTMLInputElement): string | null {
  const parsed = parseCode(input.value);
  const error = $(`[data-error="${tab}"]`);
  if (!parsed.ok) {
    error.textContent = parsed.error;
    $(`[data-result="${tab}"]`).innerHTML = "";
    return null;
  }
  error.textContent = "";
  input.value = spaced(parsed.hex);
  return parsed.hex;
}

/** The Welcome screen before brewing: an empty cauldron waiting for the cards. */
function renderWelcomeEmpty() {
  $('[data-result="welcome"]').innerHTML = `<div class="result welcome-result empty">${cauldronSvg(EMPTY_POT, "hero", "calm", "hide-drips hide-bubbles")}</div>`;
  $("#welcome").classList.remove("has-potion");
  setScene();
}

/** The color as large as possible, framed once in white and once in black, for judging paint by eye. */
function renderColor(hex: string) {
  const potion = potionFor(hex);
  // Difficulty here is about the pigments themselves: how close any mix of the five paints, in any proportions,
  // can get. Colors past the paints' reach (vivid magentas, cyans) stay hard however carefully they're mixed.
  const best = bestPossible(rgbToLab(hexToRgb(hex)));
  const tier = CONFIG.tiers.find((t) => best.deltaE < t.below)!;
  const recipe = PAINTS.map((paint, i) => [Math.round(best.weights[i] * 100), paint] as const)
    .filter(([pct]) => pct > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([pct, paint]) => `${pct}% ${paint}`)
    .join(" · ");
  $('[data-result="color"]').innerHTML = `
    <div class="result color-info">
      <div>
        <div class="code-big">#${hex}</div>
        <h2 class="potion-name">${potionName(potion.name)}</h2>
        <p class="potion-line">${esc(potion.line)}</p>
      </div>
      <div class="color-difficulty">
        <div class="tier tier-${tier.name.toLowerCase()}"><span class="tier-name">${tier.name}</span><span class="tier-de">ΔE ${fmt(best.deltaE)}</span></div>
        <p class="muted small">The closest any mix of red, yellow, blue, white and black paint can get:
          <strong class="recipe">${recipe}</strong>
          <span class="swatch swatch-mini" style="background:#${rgbToHex(best.rgb)}"></span></p>
      </div>
    </div>
    <div class="result color-ref">
      <div class="ref-swatch ref-white" style="background:#${hex}" role="img" aria-label="#${hex} with a white border"></div>
      <div class="ref-swatch ref-black" style="background:#${hex}" role="img" aria-label="#${hex} with a black border"></div>
    </div>`;
}

function renderWelcome(hex: string) {
  const potion = potionFor(hex);
  const secret = specialHint(hex);
  const hints = [...(secret ? [secret] : []), ...pointHints(score(hex))];
  const out = $('[data-result="welcome"]');
  out.innerHTML = `
    <div class="result welcome-result" data-hex="${hex}">
      ${cauldronSvg(hex, "hero", "calm", reducedMotion() ? "" : "hide-drips hide-bubbles")}
      <div class="details">
        <div class="code-big">#${hex}</div>
        <h2 class="potion-name">${potionName(potion.name)}</h2>
        <p class="potion-line">${potion.line}</p>
        ${hints.length ? `<div class="hints"><h3>Whispers from the cauldron</h3><ul>${hints.map((h) => `<li>${h}</li>`).join("")}</ul></div>` : ""}
      </div>
    </div>`;
  // Once there's a potion, the screen is just the three cards and the result. Enter or Esc starts over.
  $("#welcome").classList.add("has-potion");
  if (specialEffect(hex) === "steam") addSteam(out.querySelector<SVGSVGElement>(".cauldron")!);
  setScene();
  brewReveal(hex, [...document.querySelectorAll<HTMLElement>("#welcome .hex-card")], out.firstElementChild as HTMLElement);
}

/** Clears the cards and empties the cauldron. Coming back from another tab keeps the code for the other screens. */
function resetWelcome(forgetCode = true) {
  cancelBrew();
  $<HTMLInputElement>('[data-form="welcome"] input.carry').value = "";
  $('[data-error="welcome"]').textContent = "";
  if (forgetCode) currentCode = "";
  renderWelcomeEmpty();
  $<HTMLInputElement>("#welcome .hex-card input").focus({ preventScroll: true });
  scrollTo({ top: 0, behavior: "smooth" });
}

function renderPoints(hex: string) {
  const r = score(hex);
  const rows = r.rows
    .map(([rule, pts]) => `<tr><td>${esc(rule)}</td><td class="pts ${pts < 0 ? "neg" : ""}">${signed(pts)}</td></tr>`)
    .join("");
  const sorted = [...r.words].sort(
    (a, b) => b.points - a.points || b.word.length - a.word.length || a.word.localeCompare(b.word),
  );
  const words = sorted.length
    ? `<div class="words">
        <strong>Words found</strong>${CONFIG.score.wordCap !== null ? ` <span class="muted">(word points capped at ${CONFIG.score.wordCap})</span>` : ""}
        <ul class="word-list">${sorted
          .map((w) => `<li><span class="word">${esc(w.word)}</span>${w.spooky ? `<span class="spooky">spooky</span>` : ""}<span class="pts">+${w.points}</span></li>`)
          .join("")}</ul>
      </div>`
    : "";
  const noWords = WORDS
    ? ""
    : `<p class="warn">Word list not loaded. Add a <code>data/*words*.csv</code> file to score the Words rule.</p>`;
  $('[data-result="points"]').innerHTML = `
    <div class="result points-result">
      <div class="points-head">
        <div class="swatch swatch-small" style="background:#${hex}"></div>
        <div class="code-big">#${hex}</div>
        <div class="total ${r.total < 0 ? "neg" : ""}">${signed(r.total)} <span>pts</span></div>
      </div>
      ${r.ended ? `<p class="warn">Three of the same pair: the run ends here.</p>` : ""}
      ${rows ? `<table class="rules"><tbody>${rows}</tbody></table>` : `<p class="muted">No rules triggered. A plain brew.</p>`}
      ${words}
      ${noWords}
    </div>`;
}

// How the brew's cauldron behaves, by judging tier. The target always bubbles calmly.
const MOODS: Record<string, Mood> = { Passable: "sputter", Miss: "spill" };
// Once a brew has settled: hearts of smoke and sparkles for Spot On, sparkles for Close, hearts and skulls taking
// turns for Passable (it can't decide), skulls for a Miss.
const CELEBRATE: Record<string, Celebration> = { "Spot On": "heart", Close: "sparkle", Passable: "mixed", Miss: "skull" };

// Test your brew starts with two empty cauldrons. The target fills in as soon as its code is typed; the brew
// waits for Test. Remembers which target is showing so retyping the same code doesn't pour it again.
let previewTarget: string | null | undefined;

const emptyBrew = () => `<figure>${cauldronSvg(EMPTY_POT, "mid", "calm", "hide-drips hide-bubbles")}
  <figcaption>Your brew<span>?</span><em>Type the hex from the photo, then test.</em></figcaption></figure>`;

function renderCompareTarget(targetHex: string | null) {
  if (targetHex === previewTarget && $('[data-result="compare"]').hasChildNodes()) return;
  previewTarget = targetHex;
  const target = targetHex
    ? `<figure>${cauldronSvg(targetHex, "mid")}${potionCaption("Target", targetHex, potionFor(targetHex))}</figure>`
    : `<figure>${cauldronSvg(EMPTY_POT, "mid", "calm", "hide-drips hide-bubbles")}
        <figcaption>Target<span>?</span><em>Type the code from your cards.</em></figcaption></figure>`;
  const result = document.createElement("div");
  result.className = "result compare-result preview";
  result.innerHTML = `<div class="pair">${target}${emptyBrew()}</div>`;
  if (targetHex && specialEffect(targetHex) === "steam") addSteam(result.querySelector<SVGSVGElement>(".cauldron")!);
  $('[data-result="compare"]').replaceChildren(result);
  if (targetHex) pourTarget(result.querySelector<SVGSVGElement>(".cauldron")!, result.querySelector("figcaption")!);
}

// Your brew's name pops in word by word once it has brewed, with any words that differ from the target's marked.
const brewCaption = (hex: string, p: Potion, targetName: string) =>
  `<figcaption>Your brew #${hex}<span>${brewNameHtml(p.name, targetName)}</span><em>${esc(p.line)}</em></figcaption>`;

const potionCaption = (label: string, hex: string, p: Potion) =>
  `<figcaption>${label} #${hex}<span>${potionName(p.name)}</span><em>${esc(p.line)}</em></figcaption>`;

function renderCompare(targetHex: string, actualHex: string, nickname: string) {
  previewTarget = targetHex;
  const targetRgb = hexToRgb(targetHex);
  const actualRgb = hexToRgb(actualHex);
  const target = rgbToLab(targetRgb);
  const actual = rgbToLab(actualRgb);
  const d = deltaE(target, actual);
  const tier = judge(d);
  const dir = describeDirection(target, actual);
  const best = difficulty(target);
  const spotOn = tier === CONFIG.judging[0];
  const fix = !spotOn ? suggestCorrection(target, actualRgb, d) : null;

  let saved: string;
  if (!nickname) {
    saved = "Add a nickname to save this guess to the leaderboard.";
  } else {
    const n = addGuess(nickname, targetHex, { hex: actualHex, deltaE: d, tier: tier.name, at: Date.now() });
    saved = n === null
      ? `Same reading as ${esc(nickname)}'s last guess, so it wasn't saved again.`
      : `Saved as guess #${n} for ${esc(nickname)}.`;
  }

  const fixHtml =
    spotOn
      ? `<p>Spot on. Leave it be, more paint is more risk.</p>`
      : fix
        ? `<p class="fix">Try adding <strong>${fix.steps.join(" and ")}</strong>.</p>
           <div class="fix-preview">
             <div class="swatch swatch-mini" style="background:#${rgbToHex(fix.rgb)}"></div>
             <span class="muted">Predicted result: ΔE ${fmt(fix.deltaE)} (${tierLabel(judge(fix.deltaE).name)})</span>
           </div>`
        : `<p>No small addition of paint helps much from here.</p>`;

  const caption = potionCaption;
  const result = document.createElement("div");
  result.className = "result compare-result";
  result.innerHTML = `
    <div class="pair">
      <figure>${cauldronSvg(targetHex, "mid")}${caption("Target", targetHex, potionFor(targetHex))}</figure>
      <figure>${cauldronSvg(actualHex, "mid", MOODS[tier.name] ?? "calm", reducedMotion() ? "" : "hide-drips hide-bubbles stirring")}${brewCaption(actualHex, brewPotion(targetHex, actualHex, tier.name), potionFor(targetHex).name)}</figure>
    </div>
    <div class="verdict">
      <div class="judge ${tierClass(tier.name)}">${tierLabel(tier.name)}</div>
      <div class="de-big">ΔE ${fmt(d)}</div>
    </div>
    <div class="reveal-bar">
      <button type="button" class="ghost" data-action="reveal" aria-expanded="false">Show more</button>
      <span class="muted small">${saved}</span>
    </div>
    <div class="more" hidden>
      <div class="feedback">
        <h2>How it's off</h2>
        <ul>${dir.notes.map((n) => `<li>${n[0].toUpperCase()}${n.slice(1)}</li>`).join("")}</ul>
        <p class="muted small">Lightness ${signed(Math.round(dir.dL))} · Colorfulness ${signed(Math.round(dir.dC))}
          · Hue ${signed(Math.round(dir.dH))}° (target minus yours)</p>
        <h2>Paint fix</h2>
        ${fixHtml}
        <p class="muted small">For reference, the closest simple recipe from fresh paint reaches ΔE ${fmt(best.deltaE)}
          (${best.tier.name}) on this target.</p>
      </div>
    </div>`;
  result.querySelector(".more")!.append(colorSpacePlot(target, actual, `#${targetHex}`, `#${actualHex}`));

  const toggle = result.querySelector<HTMLButtonElement>('[data-action="reveal"]')!;
  const more = result.querySelector<HTMLElement>(".more")!;
  toggle.addEventListener("click", () => {
    more.hidden = !more.hidden;
    toggle.textContent = more.hidden ? "Show more" : "Show less";
    toggle.setAttribute("aria-expanded", String(!more.hidden));
  });

  if (specialEffect(targetHex) === "steam") addSteam(result.querySelector<SVGSVGElement>(".cauldron")!);
  $('[data-result="compare"]').replaceChildren(result);
  judgeReveal(result, CELEBRATE[tier.name], tierLabel(tier.name));
}

function renderBoard() {
  const board = rankedBoard();
  const out = $('[data-result="leaderboard"]');
  if (!board.length) {
    out.innerHTML = `<div class="result"><p class="muted">No guesses yet. Scores from the Compare screen land here.</p></div>`;
    return;
  }
  const dot = (hex: string) => `<i class="dot-chip" style="background:#${hex}"></i>`;
  out.innerHTML = `
    <div class="result board">
      <table>
        <thead><tr><th>#</th><th>Nickname</th><th>Code</th><th>Best</th><th>Guesses</th></tr></thead>
        <tbody>${board
          .map((e, i) => {
            const top = bestGuess(e);
            const guesses = e.guesses
              .map((g, n) => `<li class="${g === top ? "is-best" : ""}" title="Guess ${n + 1}: ${tierLabel(g.tier)}">${dot(g.hex)}#${g.hex}<span>ΔE ${fmt(g.deltaE)}</span></li>`)
              .join("");
            return `<tr>
              <td class="rank">${i + 1}</td>
              <td class="nick">${esc(e.nickname)}</td>
              <td class="mono">${dot(e.code)}#${e.code}</td>
              <td><span class="best ${tierClass(top.tier)}">${tierLabel(top.tier)}</span> <span class="mono">ΔE ${fmt(top.deltaE)}</span></td>
              <td><ol class="guesses">${guesses}</ol></td>
            </tr>`;
          })
          .join("")}</tbody>
      </table>
    </div>`;
}

function renderRules() {
  const sc = CONFIG.score;
  const table = (rows: string) => `<table class="rules rule-list"><tbody>${rows}</tbody></table>`;
  const row = (name: string, detail: string, example: string, points: string) => `
    <tr><td><strong>${name}</strong><span class="muted">${detail}</span></td>
      <td class="example">${example}</td><td class="pts ${points.startsWith("−") ? "neg" : ""}">${points}</td></tr>`;
  const sections = RULE_SECTIONS.map(({ title, note, rules }) => `
    <section class="rule-section"><h2>${title}</h2>${note ? `<p class="muted small">${note}</p>` : ""}
      ${table(rules.map((r) => row(r.name, r.detail, spaced(r.example), r.points)).join(""))}</section>`).join("");
  const lengths = Object.entries(sc.wordPoints)
    .map(([len, p]) => row(`${len}-letter word`, "", "", `+${p}`))
    .join("");
  const spooky = (WORDS ?? []).filter((w) => w.spooky).map((w) => w.word);
  const cap = sc.wordCap === null ? "" : `<p class="muted small">Word points are capped at ${sc.wordCap} per code.</p>`;
  $('[data-result="rules"]').innerHTML = `${sections}
    <section class="rule-section"><h2>Words</h2>
      <p class="muted small">Unscramble the six characters into words. Each character can be used once per word.
        Numbers can stand in for letters: ${NUMBER_SWAPS}.</p>
      ${table(lengths + row("Spooky word", spooky.length ? spooky.join(", ") : "", "", `+${sc.spookyBonus} extra`))}
      ${cap}</section>`;
}

function wire() {
  mountScene($<HTMLElement>(".scene"));
  magicWand();
  renderWelcomeEmpty();
  renderCompareTarget(null);
  renderRules();
  document.querySelectorAll<HTMLInputElement>("input.code-input").forEach(hexOnly);
  cardEntry($<HTMLInputElement>('[data-form="welcome"] input.carry'));
  $<HTMLFormElement>('[data-form="welcome"]').addEventListener("submit", (e) => {
    e.preventDefault();
    const brewed = document.querySelector<HTMLElement>("#welcome .welcome-result:not(.empty)");
    const typed = parseCode((e.target as HTMLFormElement).code.value);
    if (brewed && (!typed.ok || brewed.dataset.hex === typed.hex)) return resetWelcome();
    const hex = readCode("welcome", (e.target as HTMLFormElement).code);
    if (hex) { currentCode = hex; renderWelcome(hex); }
    else renderWelcomeEmpty();
  });
  $<HTMLFormElement>('[data-form="color"]').addEventListener("submit", (e) => {
    e.preventDefault();
    const hex = readCode("color", (e.target as HTMLFormElement).code);
    if (hex) { currentCode = hex; renderColor(hex); }
  });
  $<HTMLFormElement>('[data-form="points"]').addEventListener("submit", (e) => {
    e.preventDefault();
    const hex = readCode("points", (e.target as HTMLFormElement).code);
    if (hex) { currentCode = hex; renderPoints(hex); }
  });
  $<HTMLFormElement>('[data-form="compare"]').addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const targetHex = readCode("compare", form.targetCode);
    if (!targetHex) return renderCompareTarget(null);
    currentCode = targetHex;
    if (!form.actual.value.trim()) {
      renderCompareTarget(targetHex);
      form.actual.focus();
      return;
    }
    const actualHex = readCode("compare", form.actual);
    if (!actualHex) {
      previewTarget = undefined;
      return renderCompareTarget(targetHex);
    }
    // Nicknames are always lowercase, so "Steph" and "steph" are the same player on the leaderboard.
    renderCompare(targetHex, actualHex, form.nickname.value.trim().toLowerCase());
  });
  // Typing the target pours it into its cauldron; clearing it empties the cauldron again.
  $<HTMLInputElement>('[data-form="compare"] input[name="targetCode"]').addEventListener("input", (e) => {
    const parsed = parseCode((e.target as HTMLInputElement).value);
    renderCompareTarget(parsed.ok ? parsed.hex : null);
  });

  // A valid code typed on any tab follows you to the others, even before Enter.
  document.querySelectorAll<HTMLInputElement>("input.carry").forEach((input) =>
    input.addEventListener("input", () => {
      const parsed = parseCode(input.value);
      if (parsed.ok) currentCode = parsed.hex;
    }),
  );

  $('[data-action="clear-board"]').addEventListener("click", () => {
    if (confirm("Clear the whole leaderboard? Every nickname and guess will be deleted. This can't be undone.")) {
      clearBoard();
      renderBoard();
    }
  });

  // Esc clears the screen for the next player.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const screen = document.querySelector(".screen.active");
    if (screen?.id === "welcome") return resetWelcome();
    if (screen?.id === "camera") return;
    const inputs = screen?.querySelectorAll<HTMLInputElement>("input");
    if (!screen || !inputs?.length) return;
    inputs.forEach((i) => (i.value = ""));
    screen.querySelector("[data-result]")!.innerHTML = "";
    screen.querySelector("[data-error]")!.textContent = "";
    currentCode = "";
    if (screen.id === "compare") renderCompareTarget(null);
    inputs[0].focus();
  });

  const route = () => {
    const tab = location.hash.slice(1) as Tab;
    showTab(TABS.includes(tab) ? tab : "welcome");
  };
  window.addEventListener("hashchange", route);
  route();
}

wire();
