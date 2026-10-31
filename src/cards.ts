// Three card-shaped boxes (red, green, blue) for typing a code in card order. They write into a hidden
// input that the rest of the app reads, and refresh whenever code sets that input's value.

const CARDS = [
  { name: "red", placeholder: "A3" },
  { name: "green", placeholder: "7F" },
  { name: "blue", placeholder: "E2" },
];

const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;

/** Typed keys other than 0-9 and A-F never reach the box. Pastes still go through and get cleaned up. */
export function hexOnly(input: HTMLInputElement) {
  input.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertText" && e.data && /[^0-9a-f]/i.test(e.data)) e.preventDefault();
  });
}

export function cardEntry(hidden: HTMLInputElement) {
  const row = document.createElement("div");
  row.className = "card-entry";
  const boxes = CARDS.map(({ name, placeholder }) => {
    const card = document.createElement("label");
    card.className = `hex-card hex-card-${name}`;
    card.innerHTML = `<input maxlength="6" autocomplete="off" spellcheck="false" placeholder="${placeholder}"
      aria-label="${name[0].toUpperCase()}${name.slice(1)} card" /><span class="bar"></span>`;
    row.append(card);
    return card.querySelector("input")!;
  });
  hidden.before(row);
  hidden.type = "hidden";

  const clean = (s: string) => s.toUpperCase().replace(/[^0-9A-F]/g, "");
  const show = (code: string) => boxes.forEach((b, i) => (b.value = code.slice(i * 2, i * 2 + 2)));

  // Setting the hidden input from anywhere (carrying a code between tabs, Esc) fills the cards too.
  Object.defineProperty(hidden, "value", {
    get: () => nativeValue.get!.call(hidden),
    set: (v: string) => {
      nativeValue.set!.call(hidden, v);
      show(clean(v));
    },
  });

  const publish = () => {
    nativeValue.set!.call(hidden, boxes.map((b) => b.value).join(""));
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  };

  boxes.forEach((box, i) => {
    hexOnly(box);
    box.addEventListener("input", () => {
      // Typing or pasting past two characters flows into the next cards.
      const chars = clean(box.value);
      const rest = boxes.slice(i).map((b, j) => (j === 0 ? chars : b.value)).join("").slice(0, (3 - i) * 2);
      boxes.slice(i).forEach((b, j) => (b.value = rest.slice(j * 2, j * 2 + 2)));
      publish();
      if (chars.length >= 2) {
        const next = boxes.slice(i).find((b) => b.value.length < 2) ?? boxes[2];
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      }
    });
    box.addEventListener("keydown", (e) => {
      const atStart = box.selectionStart === 0 && box.selectionEnd === 0;
      if (i > 0 && atStart && (e.key === "Backspace" || e.key === "ArrowLeft")) {
        e.preventDefault();
        const prev = boxes[i - 1];
        if (e.key === "Backspace") {
          prev.value = prev.value.slice(0, -1);
          publish();
        }
        prev.focus();
        prev.setSelectionRange(prev.value.length, prev.value.length);
      } else if (i < 2 && e.key === "ArrowRight" && box.selectionStart === box.value.length) {
        e.preventDefault();
        boxes[i + 1].focus();
        boxes[i + 1].setSelectionRange(0, 0);
      }
    });
  });
}
