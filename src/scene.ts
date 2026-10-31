// The night-time backdrop: 1000 Oak St, the corner building at Oak and Steiner, drawn from a photo of the block.
// Grey-blue bays over a dark slate garage level, the heavy cornice, the fire escape on the Steiner side, the
// corner streetlight, and the neighbors: charcoal and cream to the left; pink, grey-blue and red Victorians to the
// right. A few windows glow in candy colors, a witch is in one of them, and a ghost sits on the fire escape.

const WARM = ["#ffd98a", "#ffc56b", "#ffe7b0"];
const CANDY = ["#ff4fa3", "#9b5cff", "#35c8ff", "#7dff6b"];

// Small seeded random so the windows light up the same way every time.
let seed = 1031;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function pane(x: number, y: number, w: number, h: number, opts: { arched?: boolean; trim?: string } = {}): string {
  const r = rand();
  const lit = r < 0.5;
  const color = r < 0.36 ? WARM[Math.floor(rand() * WARM.length)] : CANDY[Math.floor(rand() * CANDY.length)];
  const fill = lit ? color : "#18202b";
  const twinkle = lit && rand() < 0.25 ? ` class="twinkle" style="animation-delay:${(rand() * 6).toFixed(1)}s"` : "";
  const trim = opts.trim ?? "#b9c6d0";
  const shape = opts.arched
    ? `<path d="M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z"`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}"`;
  return `${shape} fill="${fill}" fill-opacity="${lit ? 0.8 : 1}" stroke="${trim}" stroke-width="1.6"${twinkle}/>`;
}

// A three-sided bay: narrow angled side panels around a wider front, with windows on each floor.
function bay(x: number, top: number, floors: number[], w = 104): string {
  const side = 18;
  const out = [
    `<rect x="${x}" y="${top}" width="${side}" height="${252 - top}" fill="#4a5c6b"/>`,
    `<rect x="${x + side}" y="${top}" width="${w - side * 2}" height="${252 - top}" fill="#607587"/>`,
    `<rect x="${x + w - side}" y="${top}" width="${side}" height="${252 - top}" fill="#4a5c6b"/>`,
  ];
  for (const fy of floors) {
    out.push(pane(x + 4, fy, side - 8, 32), pane(x + side + 6, fy, (w - side * 2 - 18) / 2, 32));
    out.push(pane(x + w / 2 + 3, fy, (w - side * 2 - 18) / 2, 32), pane(x + w - side + 4, fy, side - 8, 32));
  }
  // Crown over the bay, with dentils and brackets
  out.push(`<path d="M${x - 10} 106 L${x - 2} 88 H${x + w + 2} L${x + w + 10} 106 Z" fill="#8f9eab"/>`);
  for (let i = 0; i < w / 9; i++) out.push(`<rect x="${x + 2 + i * 9}" y="99" width="4" height="5" fill="#5d6c79"/>`);
  out.push(`<rect x="${x - 6}" y="104" width="${w + 12}" height="6" fill="#a8b6c2"/>`);
  return out.join("");
}

function oakStreet(): string {
  const p: string[] = [];
  const floors = [120, 164, 208];

  // Left neighbors: pale flats, the cream Victorian, then the charcoal building next door
  p.push(`<rect x="0" y="150" width="96" height="150" fill="#4a5262"/><rect x="-4" y="144" width="104" height="8" fill="#5c6575"/>`);
  for (const fy of [164, 204, 244]) p.push(pane(14, fy, 22, 28), pane(56, fy, 22, 28));
  p.push(`<rect x="96" y="134" width="112" height="166" fill="#5e5940"/><rect x="92" y="126" width="120" height="10" fill="#77714f"/>`);
  for (const fy of [148, 192, 236]) {
    p.push(pane(110, fy, 20, 30, { trim: "#d8d0a8" }), pane(140, fy, 20, 30, { trim: "#d8d0a8" }), pane(170, fy, 20, 30, { trim: "#d8d0a8" }));
  }
  p.push(`<rect x="208" y="104" width="130" height="196" fill="#262a32"/><rect x="204" y="98" width="138" height="8" fill="#30353f"/>`);
  for (const fy of [116, 158, 200]) {
    p.push(pane(222, fy, 30, 30, { trim: "#3c424e" }), pane(266, fy, 30, 30, { trim: "#3c424e" }), pane(306, fy, 22, 30, { trim: "#3c424e" }));
  }
  p.push(`<rect x="216" y="252" width="110" height="48" fill="#1c2026"/>`);

  // 1000 Oak: grey-blue upper floors over a dark slate garage level
  const L = 340, R = 1066;
  p.push(`<rect x="${L}" y="110" width="${R - L}" height="142" fill="#55697a"/>`);
  p.push(`<rect x="${L}" y="252" width="${R - L}" height="48" fill="#2a3338"/>`);
  p.push(`<rect x="${L - 6}" y="100" width="${R - L + 12}" height="12" fill="#a8b6c2"/>`);
  for (let i = 0; i < (R - L) / 10; i++) p.push(`<rect x="${L + 2 + i * 10}" y="104" width="5" height="5" fill="#6f7f8c"/>`);
  // Flat wall windows between the bays
  for (const wx of [456, 586, 716, 846]) for (const fy of floors) p.push(pane(wx + 6, fy, 14, 32));
  // Bays along Oak, the corner bay, and one on Steiner
  for (const bx of [352, 482, 612, 742, 872]) p.push(bay(bx, 112, floors));
  // Garage doors
  for (const gx of [370, 520, 690, 860]) p.push(`<rect x="${gx}" y="262" width="96" height="38" fill="#222a2e" stroke="#3a454b"/>`);
  // Fire escape on the Steiner side
  const fe = 990;
  for (const fy of floors) p.push(pane(fe + 10, fy - 4, 22, 30), pane(fe + 38, fy - 4, 22, 30));
  for (const y of [156, 200, 244]) {
    p.push(`<path d="M${fe - 8} ${y} H${fe + 66} M${fe - 8} ${y - 14} H${fe + 66}" stroke="#c8d2da" stroke-width="2" opacity="0.8"/>`);
  }
  for (let x = fe - 8; x <= fe + 66; x += 8) {
    p.push(`<path d="M${x} 142 V156 M${x} 186 V200 M${x} 230 V244" stroke="#c8d2da" stroke-width="1" opacity="0.6"/>`);
  }
  p.push(`<path d="M${fe + 4} 156 L${fe + 48} 200 M${fe + 48} 200 L${fe + 4} 244 M${fe + 62} 100 V244" stroke="#c8d2da" stroke-width="2.5" opacity="0.8" fill="none"/>`);
  // Ghost on the fire escape
  p.push(`<g class="ghost"><path d="M${fe + 40} 128 c0 -16 22 -16 22 0 v14 l-4 -3 l-4 3 l-3 -3 l-4 3 l-3 -3 l-4 3 z" fill="#f4eeff" opacity="0.95"/>
    <circle cx="${fe + 47}" cy="126" r="1.8" fill="#140b26"/><circle cx="${fe + 55}" cy="126" r="1.8" fill="#140b26"/></g>`);
  // Witch in a top-floor bay window: cloak, head and a crooked pointy hat
  const wx = 642, B = 152;
  p.push(`<rect x="${wx}" y="120" width="25" height="32" fill="#ffe24a" stroke="#b9c6d0" stroke-width="1.6"/>
    <g fill="#140b26"><path d="M${wx + 3} ${B} q9 -16 18 0 z"/><circle cx="${wx + 12}" cy="${B - 15}" r="3.6"/>
    <ellipse cx="${wx + 12}" cy="${B - 18}" rx="8" ry="1.6"/><path d="M${wx + 7.5} ${B - 18} L${wx + 14} ${B - 30} L${wx + 11.5} ${B - 25} L${wx + 17} ${B - 18} z"/></g>`);

  // Right neighbors: the pink house and the grey-blue one with arched windows, the red one, then grey flats
  const right: [number, number, number, string, string, boolean][] = [
    [1066, 124, 112, "#7a5c60", "#e3cfcf", true],
    [1178, 130, 104, "#506072", "#d6dee6", true],
    [1282, 122, 96, "#7c2b27", "#f0dcd4", false],
    [1378, 132, 100, "#4a5160", "#c9d0d8", false],
    [1478, 118, 130, "#3f4656", "#c9d0d8", false],
  ];
  for (const [x, top, w, fill, trim, arched] of right) {
    p.push(`<rect x="${x}" y="${top}" width="${w}" height="${300 - top}" fill="${fill}"/>`);
    p.push(`<rect x="${x - 4}" y="${top - 8}" width="${w + 8}" height="10" fill="${trim}" opacity="0.55"/>`);
    for (let fy = top + 22; fy < 236; fy += 50) {
      for (let fx = x + 14; fx < x + w - 22; fx += 30) p.push(pane(fx, fy, 20, 34, { arched, trim }));
    }
    p.push(`<rect x="${x + 14}" y="258" width="${w - 28}" height="42" fill="#2a2a30" stroke="${trim}" stroke-opacity="0.4"/>`);
  }
  // Blue recycling bin in front of the pink house
  p.push(`<rect x="1150" y="282" width="16" height="18" rx="2" fill="#2f7fd6"/><rect x="1148" y="279" width="20" height="4" rx="1" fill="#3b8fe8"/>`);

  // Street trees along Oak
  for (const [tx, r] of [[410, 34], [470, 30], [560, 36]] as const) {
    p.push(`<rect x="${tx - 3}" y="250" width="6" height="50" fill="#2b2620"/>`);
    p.push(`<circle cx="${tx}" cy="236" r="${r}" fill="#1f3d2b"/><circle cx="${tx - r / 3}" cy="226" r="${r / 2}" fill="#2a5239"/>`);
  }
  // Corner streetlight with its two banners, and the traffic signal
  p.push(`<path d="M860 300 V120 q0 -12 12 -12 h20" stroke="#8a96a0" stroke-width="5" fill="none"/>
    <ellipse cx="898" cy="110" rx="12" ry="5" fill="#ffd98a"/>
    <circle cx="898" cy="124" r="80" fill="url(#lamp)"/>
    <rect x="838" y="150" width="20" height="44" fill="#2a3a8a"/><rect x="862" y="150" width="20" height="44" fill="#22306e"/>
    <path d="M1030 300 V220" stroke="#8a96a0" stroke-width="3"/><rect x="1022" y="200" width="16" height="30" rx="3" fill="#2a2f35"/>
    <circle cx="1030" cy="222" r="3.5" fill="#57e389"/>`);
  // Telephone wire
  p.push(`<path d="M0 172 Q 420 198 860 128 T 1600 150" stroke="#2c3442" stroke-width="2" fill="none"/>`);
  // Street, crosswalk, and the Wiggle's green bike lane
  p.push(`<rect x="0" y="300" width="1600" height="20" fill="#0e0d18"/>`);
  for (let x = 900; x < 1040; x += 22) p.push(`<rect x="${x}" y="304" width="12" height="16" fill="#cfd6dd" opacity="0.25"/>`);
  p.push(`<path d="M1200 320 L1250 304 H1600 V320 Z" fill="#2e9a58" opacity="0.75"/>`);
  return p.join("");
}

export function mountScene(host: HTMLElement) {
  host.innerHTML = `
    <div class="stars"></div>
    <div class="fog fog-1"></div>
    <svg class="skyline" viewBox="0 0 1600 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><radialGradient id="lamp"><stop offset="0" stop-color="#ffd98a" stop-opacity="0.4"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>
      ${oakStreet()}
    </svg>
    <div class="fog fog-2"></div>`;
}
