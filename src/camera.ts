// The Camera tab: a live camera view with a sampling ring. The reading is the average color inside the ring,
// averaged in linear light, ignoring the brightest and darkest tenth of pixels (glare and shadow). "Set white"
// takes the ring's reading of a white card as the reference, and corrects later readings for the room's light.

import { rgbToHex } from "./color";
import type { RGB } from "./config";

const TRIM = 0.1;
const SAMPLE_EVERY_MS = 120;

// sRGB <-> linear light
const LINEAR = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const encode = (v: number) => {
  const x = Math.min(1, Math.max(0, v));
  return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255);
};

/** Trimmed mean of an image region, in linear light. */
function averageLinear(data: Uint8ClampedArray): [number, number, number] {
  const n = data.length / 4;
  const order = Array.from({ length: n }, (_, i) => i);
  const lum = (i: number) => 0.2126 * LINEAR[data[i * 4]] + 0.7152 * LINEAR[data[i * 4 + 1]] + 0.0722 * LINEAR[data[i * 4 + 2]];
  const keys = order.map(lum);
  order.sort((a, b) => keys[a] - keys[b]);
  const from = Math.floor(n * TRIM), to = Math.max(from + 1, Math.ceil(n * (1 - TRIM)));
  const sum = [0, 0, 0];
  for (let k = from; k < to; k++) {
    const i = order[k] * 4;
    sum[0] += LINEAR[data[i]];
    sum[1] += LINEAR[data[i + 1]];
    sum[2] += LINEAR[data[i + 2]];
  }
  const count = to - from;
  return [sum[0] / count, sum[1] / count, sum[2] / count];
}

export interface Camera {
  start(): void;
  stop(): void;
}

export function mountCamera(root: HTMLElement, useAsBrew: (hex: string) => void): Camera {
  root.innerHTML = `
    <div class="cam-layout">
      <div class="cam-view">
        <video playsinline muted></video>
        <div class="cam-ring" aria-hidden="true"></div>
        <p class="cam-message" role="status"></p>
      </div>
      <div class="cam-panel">
        <div class="cam-swatch"></div>
        <div class="code-big cam-hex">------</div>
        <p class="cam-status muted small">Point the ring at the paint. Click the picture to move it.</p>
        <label class="cam-size">Ring size <input type="range" min="16" max="160" value="60" /></label>
        <div class="cam-buttons">
          <button type="button" class="ghost" data-cam="white">set white</button>
          <button type="button" class="ghost" data-cam="freeze">freeze</button>
          <button type="button" data-cam="use">use as my brew</button>
        </div>
        <label class="cam-device" hidden>Camera <select></select></label>
      </div>
    </div>`;

  const video = root.querySelector("video")!;
  const view = root.querySelector<HTMLElement>(".cam-view")!;
  const ring = root.querySelector<HTMLElement>(".cam-ring")!;
  const message = root.querySelector<HTMLElement>(".cam-message")!;
  const swatch = root.querySelector<HTMLElement>(".cam-swatch")!;
  const hexOut = root.querySelector<HTMLElement>(".cam-hex")!;
  const status = root.querySelector<HTMLElement>(".cam-status")!;
  const size = root.querySelector<HTMLInputElement>(".cam-size input")!;
  const freezeBtn = root.querySelector<HTMLButtonElement>('[data-cam="freeze"]')!;
  const whiteBtn = root.querySelector<HTMLButtonElement>('[data-cam="white"]')!;
  const deviceRow = root.querySelector<HTMLElement>(".cam-device")!;
  const deviceSelect = deviceRow.querySelector("select")!;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  let stream: MediaStream | null = null;
  let timer = 0;
  let frozen = false;
  let white: [number, number, number] | null = null; // linear reading of the white card
  let spot = { x: 0.5, y: 0.5 }; // ring center, as a fraction of the picture
  let lastLinear: [number, number, number] = [0, 0, 0];
  let hex = "";

  const placeRing = () => {
    ring.style.left = `${spot.x * 100}%`;
    ring.style.top = `${spot.y * 100}%`;
    ring.style.width = ring.style.height = `${size.value}px`;
  };
  placeRing();
  size.addEventListener("input", placeRing);
  view.addEventListener("click", (e) => {
    const r = video.getBoundingClientRect();
    spot = { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
    placeRing();
  });

  const sample = () => {
    if (frozen || !video.videoWidth) return;
    const scale = video.videoWidth / video.clientWidth;
    const side = Math.max(4, Math.round(Number(size.value) * scale));
    const cx = Math.round(spot.x * video.videoWidth), cy = Math.round(spot.y * video.videoHeight);
    const x = Math.max(0, Math.min(video.videoWidth - side, cx - side / 2));
    const y = Math.max(0, Math.min(video.videoHeight - side, cy - side / 2));
    canvas.width = side;
    canvas.height = side;
    ctx.drawImage(video, x, y, side, side, 0, 0, side, side);
    lastLinear = averageLinear(ctx.getImageData(0, 0, side, side).data);
    const corrected = white ? lastLinear.map((v, i) => v / white![i]) : lastLinear;
    const rgb = corrected.map(encode) as RGB;
    hex = rgbToHex(rgb);
    swatch.style.background = `#${hex}`;
    hexOut.textContent = `#${hex}`;
  };

  whiteBtn.addEventListener("click", () => {
    if (white) {
      white = null;
      whiteBtn.textContent = "set white";
      status.textContent = "White reset. Readings are straight from the camera.";
      return;
    }
    const [r, g, b] = lastLinear;
    if (Math.min(r, g, b) < 0.05) {
      status.textContent = "That's too dark to be the white card. Point the ring at the white card and try again.";
      return;
    }
    white = [r, g, b];
    whiteBtn.textContent = "reset white";
    status.textContent = "White set. Readings are corrected for this light. Keep the card and paint in the same light.";
  });
  freezeBtn.addEventListener("click", () => {
    frozen = !frozen;
    freezeBtn.textContent = frozen ? "unfreeze" : "freeze";
    view.classList.toggle("frozen", frozen);
    if (frozen) video.pause();
    else void video.play();
  });
  root.querySelector('[data-cam="use"]')!.addEventListener("click", () => hex && useAsBrew(hex));

  const open = async (deviceId?: string) => {
    stop();
    message.textContent = "Starting the camera...";
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      message.textContent = "";
      frozen = false;
      freezeBtn.textContent = "freeze";
      view.classList.remove("frozen");
      timer = window.setInterval(sample, SAMPLE_EVERY_MS);
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      deviceRow.hidden = cams.length < 2;
      const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
      deviceSelect.innerHTML = cams.map((c, i) =>
        `<option value="${c.deviceId}"${c.deviceId === current ? " selected" : ""}>${c.label || `Camera ${i + 1}`}</option>`).join("");
    } catch (err) {
      const name = (err as DOMException)?.name;
      message.textContent = name === "NotAllowedError"
        ? "Camera access was blocked. Allow the camera for this page in the browser's address bar, then come back to this tab."
        : name === "NotFoundError"
          ? "No camera found. Plug one in and come back to this tab."
          : "The camera couldn't start. Check that no other app is using it, then come back to this tab.";
    }
  };
  deviceSelect.addEventListener("change", () => void open(deviceSelect.value));

  function stop() {
    clearInterval(timer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  return {
    start: () => {
      if (!stream) void open();
    },
    stop,
  };
}
