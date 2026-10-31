// The mouse is a magic wand (the cursor itself is in style.css) that leaves a trail of candy-colored sparkles.

const COLORS = ["#ffe24a", "#ff4fa3", "#35c8ff", "#7dff6b", "#fff7c2", "#9b5cff"];
const MAX_SPARKS = 40;

export function magicWand() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(pointer: fine)").matches) return;
  let last = 0;
  let live = 0;
  addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - last < 35 || live >= MAX_SPARKS) return;
    last = now;
    const spark = document.createElement("span");
    spark.className = "wand-spark";
    spark.textContent = Math.random() < 0.5 ? "✦" : "✧";
    Object.assign(spark.style, {
      left: `${e.clientX}px`,
      top: `${e.clientY}px`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      fontSize: `${8 + Math.random() * 10}px`,
    });
    document.body.append(spark);
    live++;
    const dx = (Math.random() - 0.5) * 30;
    const dy = 10 + Math.random() * 26;
    spark.animate(
      [
        { transform: "translate(-50%, -50%) scale(1) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2) rotate(90deg)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 300, easing: "ease-out" },
    ).finished.then(() => {
      spark.remove();
      live--;
    });
  }, { passive: true });
}
