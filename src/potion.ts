import { chroma, hexToRgb, namingHue, rgbToLab, type Lab } from "./color";
import { hueName } from "./feedback";
import type { ScoreResult } from "./score";

let cauldronId = 0;

/** How the brew behaves: calm bubbling, an unsteady sputter, or boiling over and spilling. */
export type Mood = "calm" | "sputter" | "spill";

// Bubbles start on the potion surface and rise out of it. A spilling brew boils harder.
const BUBBLES: Record<Mood, [number, number, number][]> = {
  calm: [[92, 84, 7], [142, 80, 5], [118, 88, 4]],
  sputter: [[84, 86, 8], [150, 80, 6], [116, 90, 5], [132, 84, 3.5]],
  spill: [[78, 86, 10], [150, 78, 8], [112, 92, 6], [170, 88, 5], [100, 76, 7]],
};

/** An iron cauldron filled with the exact potion color. */
export function cauldronSvg(hex: string, size: "hero" | "mid" = "hero", mood: Mood = "calm", classes = ""): string {
  const id = `c${cauldronId++}`;
  const fill = `#${hex}`;
  const bubbles = BUBBLES[mood].map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" class="potion" fill="${fill}"/>`);
  return `
  <svg class="cauldron cauldron-${size} cauldron-${mood} ${classes}" data-mood="${mood}" viewBox="0 0 240 230" role="img" aria-label="Cauldron of ${fill}">
    <defs>
      <radialGradient id="${id}-iron" cx="35%" cy="30%" r="80%">
        <stop offset="0" stop-color="#c9c3d8"/>
        <stop offset="0.5" stop-color="#7a7390"/>
        <stop offset="1" stop-color="#3a3548"/>
      </radialGradient>
      <radialGradient id="${id}-shine" cx="50%" cy="40%" r="60%">
        <stop offset="0" stop-color="#fff" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${mood === "spill" ? `<ellipse cx="120" cy="218" rx="86" ry="8" class="potion puddle" fill="${fill}"/>` : ""}
    <!-- feet -->
    <path d="M58 190 l-12 30 h22 l8 -24z M182 190 l12 30 h-22 l-8 -24z" fill="#5a5470"/>
    <!-- belly -->
    <path d="M30 78 C 18 150, 60 205, 120 205 C 180 205, 222 150, 210 78 Z" fill="url(#${id}-iron)"/>
    <!-- rim and potion surface -->
    <ellipse cx="120" cy="78" rx="100" ry="32" fill="#4b4560" stroke="#d8d2e6" stroke-width="5"/>
    <g class="slosh">
      <ellipse cx="120" cy="80" rx="86" ry="24" class="potion surface" fill="${fill}"/>
      <ellipse cx="120" cy="80" rx="86" ry="24" fill="url(#${id}-shine)"/>
      <!-- stirring swirl, shown while the brew mixes -->
      <g class="swirl" transform="translate(120 80) scale(1 0.27)">
        <path d="M0 0 a9 9 0 0 1 18 0 a18 18 0 0 1 -36 0 a27 27 0 0 1 54 0 a36 36 0 0 1 -72 0 a45 45 0 0 1 90 0"
          fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.4s" repeatCount="indefinite"/>
        </path>
      </g>
    </g>
    <!-- drips running over the rim, in the potion color -->
    <path d="M66 98 C 62 112, 62 128, 68 136 C 74 128, 75 112, 74 100 Z" class="potion drip" fill="${fill}"/>
    <path d="M160 100 C 158 110, 158 118, 163 123 C 168 118, 168 110, 167 99 Z" class="potion drip" fill="${fill}"/>
    <!-- drops that fall from the drips while a brew is mixing -->
    <circle cx="68" cy="138" r="3" class="potion drop" fill="${fill}"/>
    <circle cx="163" cy="125" r="2.5" class="potion drop" style="animation-delay: 0.9s" fill="${fill}"/>
    ${mood === "spill" ? `
    <path d="M30 84 C 24 120, 30 160, 42 182 C 52 160, 50 120, 46 96 Z" class="potion spill" fill="${fill}"/>
    <path d="M108 104 C 104 140, 108 176, 118 202 C 128 176, 132 140, 130 104 Z" class="potion spill" style="animation-delay: 0.8s" fill="${fill}"/>
    <path d="M210 84 C 214 116, 208 150, 194 172 C 192 150, 194 116, 196 96 Z" class="potion spill" style="animation-delay: 1.5s" fill="${fill}"/>` : ""}
    <g class="bubbles">${bubbles.join("")}</g>
  </svg>`;
}

// Potion names are set in lowercase bubble letters, but fully capitalized words keep their capitals (Muni lines
// like the J and the N, BART, SFO, C0FFEE), and so does Muni itself.
const KEEP_CASE = /^([A-Z0-9-]*[A-Z][A-Z0-9-]*|Muni)[,.:]?$/;
const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const wordHtml = (w: string) => (KEEP_CASE.test(w) ? `<span class="caps">${escHtml(w)}</span>` : escHtml(w));

/** A potion name as HTML, escaped, with capitalized words protected from the lowercase styling. */
export const potionName = (name: string) => name.split(" ").map(wordHtml).join(" ");
const bare = (w: string) => w.replace(/[,.:!?]+$/, "").toLowerCase();

/**
 * A brew's name as HTML, word by word, for popping in one word at a time. Words that aren't in the target's name
 * (in order) are marked, so a near miss shows what went wrong: Karl the Fog → *Carl* the Fog.
 */
export function brewNameHtml(brew: string, target: string): string {
  const a = target.split(" ").map(bare), words = brew.split(" "), b = words.map(bare);
  // Longest common subsequence of the two names' words
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const kept = new Set<number>();
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) { kept.add(j); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return words.map((w, i) => `<span class="w${kept.has(i) ? "" : " new"}" style="--i:${i}">${wordHtml(w)}</span>`).join(" ");
}

export interface Potion {
  name: string;
  line: string;
}

type Family =
  | "black" | "white" | "grey" | "pale" | "brown" | "mustard" | "dark red" | "red" | "orange" | "yellow"
  | "lime" | "dark green" | "green" | "teal" | "sky blue" | "dark blue" | "blue" | "lavender"
  | "purple" | "light pink" | "magenta";

// Several potions per color family, picked by the code so each color keeps its own name.
// Each also has a near miss: a brew that comes out Close gets it on the Compare screen (Twin Peaks Drizzle
// becomes Triplet Peaks Drizzle).
const POTIONS: Record<Family, [string, string, string, string][]> = {
  black: [
    ["Essence of Shadow", "Darker than a moonless night. Drink at your own peril.",
      "Essence of Partial Shade", "Not quite shadow. The kind a small tree gives you."],
    ["Sunset Tunnel Shade", "Bottled where the N Judah dives under Duboce Park and the lights flicker.",
      "Sunset Tunnel Shade, Inbound", "Right tunnel, wrong direction. You'll end up at Embarcadero."],
    ["Alcatraz Midnight", "The island's oldest ghosts swear by it.",
      "Alcatraz 11:58", "So close to midnight. The ghosts are still putting on their chains."],
    ["Toronado Last Call", "Poured at 1:59 a.m. Nobody remembers the recipe.",
      "Toronado Second-to-Last Call", "One more round to go. Pace yourself."],
    ["Sutro Baths After Dark", "Skimmed from the ruins when the tide goes out and the fog rolls in.",
      "Sutro Baths at Dusk", "Not quite dark yet. The ghosts are still getting ready."],
  ],
  white: [
    ["Karl the Fog", "Rolls in every evening at six, whether you summoned it or not.",
      "Carl the Fog", "Karl's cousin with a C. Rolls in an hour late and leaves early."],
    ["Ghost's Breath", "Pale and cold, it whispers when you stir it.",
      "Ghost's Morning Breath", "Almost as chilling. Somehow worse."],
    ["Ghost of the Painted Ladies", "Drifts down Alamo Square, looking for its old Victorian.",
      "Ghost of the Painted Ladies' Neighbor", "Haunts the house just out of frame on the postcard."],
    ["Foghorn Whisper", "One sip and you'll hear the Golden Gate moaning all night.",
      "Foghorn Mumble", "Close to a whisper. Still woke up Sausalito."],
    ["Point Bonita Whiteout", "The Headlands lighthouse is in there somewhere. Keep walking toward the light.",
      "Point Bonita Off-White", "Almost a whiteout. You can see the lighthouse. Barely."],
  ],
  grey: [
    ["Graveyard Mist", "Gathered at dawn from the oldest headstones.",
      "Graveyard Drizzle", "Nearly mist. The headstones still got wet."],
    ["Sutro Tower in the Mist", "The tower's three prongs vanish, and so will you.",
      "Sutro Shower in the Mist", "One letter off. The three prongs are now a showerhead."],
    ["Twin Peaks Drizzle", "Collected sideways, which is the only way it falls up there.",
      "Triplet Peaks Drizzle", "One peak too many. Nobody knows where the third came from."],
    ["June Gloom Gruel", "Brewed in summer, tastes like November.",
      "July Gloom Gruel", "One month off... but tastes the same."],
    ["May Gray", "The month the sky forgets to turn on.",
      "May Grey", "Spelled the British way. Nearly identical, slightly posher."],
    ["Fogust", "San Francisco's coldest summer month, stirred into a cup and served with a hoodie.",
      "Fogtember", "One month late. Still wearing the hoodie."],
    ["Mad Dog in the Fog", "A pint from the Haight Street pub where the darts land themselves after closing.",
      "Mildly Annoyed Dog in the Fog", "Not quite mad. Just wants the darts game to end."],
    ["Mount Davidson Mist", "Wraps the cross on the city's highest hill so the eucalyptus can whisper in private.",
      "Mount Davidson Haze", "Almost mist. You can see half the cross."],
    ["Tank Hill Overcast", "The best view in the city, of the inside of a cloud.",
      "Tank Hill Partly Cloudy", "You can see about a third of the view. Progress."],
  ],
  pale: [
    ["Painted Lady Cream", "The trim color nobody can agree on, bottled at last.",
      "Painted Lady Eggshell", "One shade off from cream. The neighbors noticed."],
    ["Sunset Dunes Sand", "Swept off the old Great Highway, where the cars gave way to kites and ghosts.",
      "Sunset Dunes Gravel", "Close to sand. Lumpier. Should've voted no on G!"],
    ["Fort Funston Dune Dust", "Kicked up by a hundred off-leash dogs and one hang glider.",
      "Fort Funston Dog Hair", "Ew. Not quite dust. Kicked up by the same hundred dogs, though."],
    ["Kite Hill Cloud Cream", "Skimmed from the clouds that snag on the little hill above the Castro.",
      "Kite Hill Cloud Half-and-Half", "Not quite cream. Good enough in coffee."],
  ],
  brown: [
    ["Bog Mud Broth", "Thick, earthy, and faintly croaking.",
      "Bog Mud Bouillon", "Concentrated. Add water and it's almost right."],
    ["Duboce Dog Run Mud", "Scooped from the off-leash field after the first rain.",
      "Duboce Dog Run Puddle", "Close to mud. A few more dogs and it'll get there."],
    ["Corona Heights Dust", "Scraped from the red rocks above the Castro at full moon.",
      "Corona Mid-Heights Dust", "Made it about halfway up the rocks."],
    ["Third-Wave Witch Roast", "Pour-over, single-origin, double-cursed.",
      "Second-Wave Witch Roast", "Close, but a little 2005..."],
    ["Seward Slide Cardboard Tea", "Steeped in the cardboard from a hundred concrete slide rides.",
      "Seward Slide Bubble Wrap Tea", "Wrong packing material. Still a fast ride."],
    ["The Grind's Daily Grind", "Haight Street's darkest roast. Wakes the living and most of the dead.",
      "The Grind's Black Swan Smoothie", "I still don't know what spirulina is but it's in there."],
    ["The Page Pour", "A well drink from the dark-wood bar on Page Street, where the pool balls roll at midnight.",
      "The Page Spill", "Nearly made it into the glass."],
    ["Hawk Hill Feather Brew", "Shed by the hawks riding the Headlands wind every fall.",
      "Hawk Hill Seagull Feather Brew", "A hawk from far away. Up close, it wants your fries."],
    ["Glen Canyon Coyote Coffee", "Brewed by the coyotes who run the canyon after dark.",
      "Glen Canyon Chihuahua Coffee", "Almost a coyote. Way more confident."],
  ],
  mustard: [
    ["Bog Toad Bile", "Murky gold, and not for the faint of stomach.",
      "Bog Frog Bile", "One amphibian off. The toad is offended."],
    ["Buena Vista Bramble Brew", "Picked from the thorny hill where the raccoons hold court.",
      "Buena Vista Brew", "Close. The raccoons say it lacks bite."],
    ["Old Muni Seat Varnish", "Faded, sticky, and older than the trains themselves.",
      "Old BART Seat Varnish", "Wrong transit agency. Same mysterious stickiness."],
    ["Fog-Lamp Amber", "Glows like a streetlight drowning in the mist.",
      "Frog-Lamp Amber", "One letter off. Glows, and croaks."],
    ["Woods Lowside Lager", "Poured on Haight Street, where the taproom is named for a forest and haunted by regulars.",
      "Woods Outbound Lager", "Wrong stop on the woods crawl!!"],
    ["Marin Headlands Gold", "Bottled from the dry summer hills just across the bridge.",
      "Marin Headlands Silver", "Second place. The hills are still proud of you."],
    ["Bernal Hilltop Hay", "Dried grass from the hill where the dogs rule and the swing never stops.",
      "Bernal Mid-Hill Hay", "Didn't quite make the top. The swing is still up there."],
  ],
  "dark red": [
    ["Vampire's Vintage", "Aged for centuries in a coffin-wood cask.",
      "Vampire's Franzia", "Same vampire, smaller budget."],
    ["Victorian Parlor Wine", "Served by candlelight in a Lower Haight bay window.",
      "Victorian Parlor Wine Cooler", "Close. Served with a little paper umbrella."],
    ["Fillmore Velvet", "Smooth, low, and played at the old jazz clubs.",
      "Fillmore Velour", "Feels like velvet in the dark, I guess."],
    ["Haight Street Velvet", "Bought from a vintage rack, and it remembers its last owner.",
      "Haight Street Crushed Velvet", "Right rack, wrong texture."],
    ["Beating Brick Elixir", "Pressed from the red brick of an old Duboce Triangle cellar.",
      "Skipping Brick Elixir", "The heartbeat is almost steady. Almost."],
    ["38 Geary Grog to Ocean Beach", "Packed shoulder to shoulder the whole length of Geary.",
      "38 Geary Grog to Salesforce Transit Center", "Right bus, wrong way. The ocean is behind you, and so is your seat."],
  ],
  red: [
    ["Dragon's Blood Draught", "Still warm. Don't ask where we got it.",
      "Komodo Dragon's Blood Draught", "Not quite a dragon. Still bites."],
    ["Cable Car Crimson", "Clangs twice before it hits your stomach.",
      "Cable Car Crimson, Downhill", "Right cable car, wrong way. Nob Hill is behind you and the tourists are cheering."],
    ["Chinatown Lantern Tonic", "Glows red and floats up if you let go of the bottle.",
      "Chinatown Flashlight Tonic", "Almost a lantern. Battery-powered, and pointed the wrong way."],
    ["Castro Marquee Elixir", "Flashes its own name in neon when shaken.",
      "Castro Marquis Elixir", "Sounds the same. Wears a powdered wig."],
    ["Muni Red Rush", "Arrives all at once after you've waited forty minutes.",
      "Muni Red Rush, Out of Service", "Right line, right color. Drives right past you without stopping."],
    ["Golden Gate Rivet Rust", "Chipped from a bridge rivet seven hundred feet above the water.",
      "Bay Bridge Rivet Rust", "Wrong bridge. Right shade of corrosion."],
    ["T Third Tincture", "Rides the T down Third Street to the ballpark and back.",
      "T Third Tincture, Outbound", "Right train, wrong way. The ballpark is behind you, and Sunnydale is ahead."],
    ["Red Line Rum to Richmond", "Rattles under the bay at a hundred decibels. Bring earplugs.",
      "Red Line Rum to Millbrae", "Right line, wrong way. Millbrae is lovely this time of year, probably."],
  ],
  orange: [
    ["International Orange Tonic", "Painted fresh on the Golden Gate every single day.",
      "Domestic Orange Tonic", "Almost International Orange. Never left the country."],
    ["Jack-o'-Lantern Elixir", "Carved, candle-lit, and grinning back at you.",
      "Cantaloupe-o'-Lantern Elixir", "Close. Someone carved the wrong melon."],
    ["California Poppy Philter", "Closes up at night, just like the poppies.",
      "Oregon Poppy Philter", "One state north. Close enough for the poppies."],
    ["Divisadero Sunset", "The one evening a year the fog takes the night off.",
      "Divisadero Sunrise", "Wrong end of the day. Nobody on Divis is awake to see it."],
    ["Bay Lights Ember", "A spark stolen from the Bay Bridge at midnight.",
      "Bay Lights Ash", "The spark went out a few seconds ago. Still warm."],
    ["Molotov's Cocktail", "Lit at Haight and Steiner. Throw it back, not at anything.",
      "Molotov's Mocktail", "All the look, none of the fire."],
    ["J Church Hallelujah", "Rumbles past the top of Dolores Park with a congregation of picnickers.",
      "J Church Hallelujah, Inbound", "Right line, wrong way. You were headed for a Dolores Park picnic and got the Financial District."],
    ["Orange Line Old-Fashioned to Richmond", "Smooth for one stop, then the brakes start screaming.",
      "Orange Line Old-Fashioned to Berryessa", "Right line, wrong way. Welcome to San José, more or less."],
    ["F Market Fizz to Fisherman's Wharf", "Served in a vintage streetcar from Milan, or maybe Melbourne.",
      "F Market Fizz to the Castro", "Right streetcar, wrong way. No sea lions, but great outfits."],
  ],
  yellow: [
    ["Bottled Lightning", "Crackles when shaken. Do not shake.",
      "Bottled Static", "Close to lightning. Mostly makes your hair stand up."],
    ["Dolores Park Sunbeam", "Caught on the one warm Saturday of the year.",
      "Dolores Park Partial Sunbeam", "Shared with three picnic blankets and a dog."],
    ["Mission Mural Gold", "Scraped from a sunburst on a Balmy Alley wall.",
      "Mission Mural Brass", "Almost gold. The sunburst ran a little low on budget."],
    ["Sourdough Butter Elixir", "Melts on contact and leaves you wanting a whole loaf.",
      "Sourdough Margarine Elixir", "Almost butter. Your grandmother would know."],
    ["Cab Light Tincture", "Glows when it's free, which is never.",
      "Rideshare Light Tincture", "Almost a cab. Arriving in 4 minutes, then 9, then canceled."],
    ["Golden State Gleam", "Gold rush, golden hour, Golden Gate. All of it in one sip.",
      "Golden State Glimmer", "Almost a gleam. A gleam on a budget."],
    ["Yellow Line Lemonade to Antioch", "Sweet, sour, and an hour and ten minutes long.",
      "Yellow Line Lemonade to SFO", "Right line, wrong way. Enjoy your flight."],
  ],
  lime: [
    ["Toad Slime Tonic", "Fresh from the marsh, with a ribbit of a finish.",
      "Newt Slime Tonic", "Close to toad. Shorter legs."],
    ["Wiggle Bike Lane Juice", "Painted green and fast enough to beat the Wiggle uphill.",
      "Wobble Bike Lane Juice", "Almost the Wiggle. Took one hill by mistake."],
    ["Duboce Park Lawn Tonic", "Mowed, bottled, and still smells like wet dog.",
      "Duboce Park Astroturf Tonic", "Looks like the lawn. Smells like a soccer cleat."],
    ["Glowstick Grog", "Left over from a Lower Haight warehouse party, and still glowing at noon.",
      "Glowstick Groggy", "Same party, much later. Still glowing, barely."],
    ["Patricia's Green Juice", "Pressed in Hayes Valley, between a food truck and a giant sculpture.",
      "Patrick's Green Juice", "Patricia's twin brother. Similar juice, less kale."],
  ],
  "dark green": [
    ["Swamp Hag's Tonic", "Brewed in the bog where the will-o'-wisps dance.",
      "Marsh Hag's Tonic", "Almost a swamp. Slightly better drainage."],
    ["Eucalyptus Hollow Draught", "Distilled from the tallest trees in Golden Gate Park.",
      "Eucalyptus Holler Draught", "Close. Louder."],
    ["Buena Vista Midnight Woods", "Gathered on the darkest trail in the oldest park in town.",
      "Buena Vista 11:30 Woods", "Not quite midnight. The raccoons are still warming up."],
    ["Lands End Cypress Brew", "Bent by a hundred years of wind off the Pacific.",
      "Lands Almost-End Cypress Brew", "A few steps short of the edge. Probably for the best."],
    ["Sutro Forest Secret", "The fog keeps this forest's secrets. Now you have one.",
      "Sutro Forest Rumor", "Almost a secret. Everyone on Twin Peaks already knows."],
    ["Mount Davidson Eucalyptus", "From the forest under the cross on the city's highest peak.",
      "Mount Sutro Eucalyptus", "Wrong hill, same trees. Easy mistake."],
    ["Presidio Spire Sap", "Tapped from the cypress woods around the Spire.",
      "Presidio Wood Line Sap", "Not quite the Spire. The sculpture down the trail."],
    ["Stern Grove Shadows", "Steeped in the grove where the summer concerts echo after everyone leaves.",
      "Stern Grove Soundcheck", "Not quite the show. Close enough to hear it."],
  ],
  green: [
    ["Goblin Juice", "Fizzy, sour, and mischievous to the last drop.",
      "Gremlin Juice", "Similar creature. Don't get it wet after midnight."],
    ["Telegraph Hill Parrot Punch", "Loud, green, and impossible to catch.",
      "Telegraph Hill Pigeon Punch", "Almost a parrot. Less green, more confident."],
    ["Bison Paddock Brew", "Grazed on by the Golden Gate Park bison. Allegedly.",
      "Buffalo Paddock Brew", "Technically the same animal. The bison insist otherwise."],
    ["Alamo Square Picnic", "Spread on the lawn in front of the Painted Ladies, who are watching you eat.",
      "Alamo Square Snack", "Not quite a picnic. A bag of chips on the lawn."],
    ["M Ocean View Tonic", "Promises an ocean view. Delivers Stonestown.",
      "M Ocean View Tonic, Inbound", "Right train, wrong way. No ocean, no view, just Embarcadero."],
    ["Panhandle Promenade", "Bottled along the long green strip where joggers and ghosts share a lane.",
      "Panhandle Power-Walk", "Close to a promenade. Faster and sweatier."],
    ["Koshland Garden Greens", "Grown in the Lower Haight community garden at Page and Buchanan.",
      "Koshland Garden Weeds", "Grown in the same plot. Nobody planted them."],
    ["McLaren Park Meadow", "Picked in the city's second-biggest park, which nobody believes exists.",
      "McLaren Park Lawn", "Almost a meadow. Mowed once, in 2019."],
    ["Green Line Gimlet to Berryessa", "Crosses the bay, finishes in the South Bay, needs a nap.",
      "Green Line Gimlet to Daly City", "Right line, wrong way. Daly City says hi from inside the fog."],
  ],
  teal: [
    ["Mermaid's Tears", "Salt, sorrow, and a glimmer of the deep.",
      "Manatee's Tears", "Sailors used to mix them up. Sweet, slow, and close enough."],
    ["Sutro Baths Seawater", "Scooped from the ruins where the bathers never left.",
      "Sutro Baths Tap Water", "Close. Less salt, more city pipes."],
    ["Ocean Beach Undertow", "Pulls you in, and won't let go.",
      "Ocean Beach Overtow", "Almost an undertow. Pushes you back to shore, mostly."],
    ["Copper Dome Patina", "Scraped from the roof of City Hall.",
      "Copper Dome Patio", "Almost patina. It's where City Hall eats lunch."],
    ["Bay Kelp Elixir", "Harvested from under the piers where the sea lions bark.",
      "Bay Help Elixir", "One letter off. Mostly a cry for help from the sea lions."],
    ["K Ingleside Express", "Takes the long way to Balboa Park, and gets there eventually.",
      "K Ingleside Express, Inbound", "Right line, wrong way. Balboa Park is somewhere behind you."],
  ],
  "sky blue": [
    ["Rare Sunny Day in the Sunset", "Extremely rare. Drink it before the fog notices.",
      "Rare Sunny Morning in the Sunset", "Sunny until 11. Then the fog remembered."],
    ["Painted Lady Pastel", "Chipped from a Victorian's gingerbread trim.",
      "Painted Lady Pastry", "Almost pastel. Delicious, and somehow blue."],
    ["Crissy Field Breeze", "Blown in off the bay where the kiteboarders fly.",
      "Crissy Field Gust", "Almost a breeze. Took your hat."],
    ["Moraga Steps Mosaic", "Chipped from the tiled stairway up to Grand View Park.",
      "Moraga Steps Jigsaw", "Close to the mosaic. Two tiles missing."],
    ["Clear Day on Hawk Hill", "The rare morning you can see all the way to the Farallones.",
      "Mostly Clear Day on Hawk Hill", "You can see the Farallones. Well, one of them."],
  ],
  "dark blue": [
    ["Midnight Tide", "Pulled from the sea when the moon was hiding.",
      "Midnight Low Tide", "Almost the tide. A few feet short."],
    ["Alcatraz Waters", "Cold, swift, and nobody's ever made it across.",
      "Angel Island Waters", "Wrong island. Same cold, swift water."],
    ["N Judah After Midnight", "The last train home, and it's never on time.",
      "N Judah After Midnight, Inbound", "Right train, wrong way. Heading downtown at 1 a.m. while Ocean Beach waits."],
    ["Bay at Night", "Every light on the water is a wish someone drowned.",
      "Bay at Dusk", "Almost night. The lights are still warming up."],
    ["Lower Haight Blues", "Hummed by the Victorians when the fog is thick.",
      "Upper Haight Blues", "Wrong end of the street. Same sad song."],
  ],
  blue: [
    ["Will-o'-Wisp Draught", "Glows faintly, and tries to lead you astray.",
      "Won't-o'-Wisp Draught", "Glows faintly, but refuses to lead anyone anywhere."],
    ["Pacific Swell Serum", "Bottled at the top of a wave off Ocean Beach.",
      "Pacific Ripple Serum", "Close to a swell. A modest wave."],
    ["Bay Bridge Sparkle", "Twenty-five thousand tiny lights, dissolved.",
      "Bay Bridge Twinkle", "Almost the sparkle. A few thousand lights short."],
    ["Fleet Week Thunder", "Rattles the windows of every flat on the hill.",
      "Fleet Week Rumble", "Almost thunder. The windows only hummed."],
    ["Lake Merced Mirror", "Calm, cold, and reflecting something that isn't there.",
      "Lake Merced Funhouse Mirror", "Reflects you, mostly. A little wavy."],
    ["Stow Lake Specter", "Rented by the hour on the lake where the paddle boats drift on their own.",
      "Stow Lake Duck", "Almost a specter. Just a very pale duck."],
    ["Blue Line Brew to Dublin", "Bottled at the end of the line, where it's sunny and ninety-five.",
      "Blue Line Brew to Daly City", "Right line, wrong way. Swapped ninety-five and sunny for fifty-five and fog."],
  ],
  lavender: [
    ["Lavender Hex", "Smells of dried flowers and old secrets.",
      "Lavender Vex", "Not quite a hex. Mildly annoying."],
    ["Victorian Lilac Tonic", "Steeped behind the stained glass of a Steiner Street parlor.",
      "Edwardian Lilac Tonic", "Off by one era. Fewer doilies."],
    ["Painted Lady Lilac", "The prettiest house on the postcard. The ghost agrees.",
      "Painted Gentleman Lilac", "The Painted Lady's less famous brother."],
    ["Twilight over Twin Peaks", "Bottled in the minute between sunset and fog.",
      "Twilight under Twin Peaks", "Close. You stopped at the parking lot."],
  ],
  purple: [
    ["Witching Hour Brew", "Only bubbles between midnight and three.",
      "Witching Hour-and-a-Half Brew", "Ran a little long. The cauldron needs a nap."],
    ["Castro Twilight Tonic", "Mixed under the rainbow flag as the theater lights come up.",
      "Castro Twilight Zone Tonic", "Close. Something about it is a little off."],
    ["Ube Swirl Elixir", "Sweet, purple, and borrowed from an Excelsior bakery.",
      "Taro Swirl Elixir", "Almost ube. The bakery says it's a common mistake."],
    ["Haight-Ashbury Haze", "Tie-dyed, a little dazed, and very groovy.",
      "Haight-Masonic Haze", "One block off. Slightly less groovy."],
    ["Duboce Dusk", "The park goes violet just before the dog walkers go home.",
      "Duboce Dawn", "Wrong end of the day. Same violet park."],
    ["Valkyries Violet", "Swooped in from Chase Center, faster than anyone expected.",
      "Valkyries Practice Violet", "Close. The shootaround before the real game."],
    ["L Taraval Twilight", "Rides out to the zoo, where the lions roar at the fog.",
      "L Taraval Bus Substitute, Inbound", "Right line, wrong way, and it's a bus. Again. The lions at the zoo are laughing at you."],
  ],
  "light pink": [
    ["Love Potion No. 9", "One sip and you'll swoon. Two and you'll haunt someone.",
      "Love Potion No. 8", "Close. One ingredient short of swooning."],
    ["Painted Lady Blush", "Rosy as a Victorian at golden hour.",
      "Painted Lady Sunburn", "A little past blush. Too long in the Alamo Square sun."],
    ["Cherry Blossom Draught", "Floats down from the Japantown trees every spring.",
      "Plum Blossom Draught", "Almost cherry. The Japantown trees can tell."],
    ["Pink Victorian Valentine", "Sent to the Lower Haight house you've always wanted.",
      "Pink Victorian Galentine", "Close to a valentine. Sent to your friends instead."],
    ["Strawberry Fog", "The fog at sunset, if fog were edible.",
      "Strawberry Mist", "Almost fog. A lighter, fruitier haze."],
  ],
  magenta: [
    ["Hexed Heart Elixir", "It beats faintly in the bottle. Best not to listen.",
      "Jinxed Heart Elixir", "Not quite hexed. It skips a beat now and then."],
    ["Conservatory Fuchsia", "Picked from the jungle under the glass of the Conservatory of Flowers.",
      "Conservatory Gift Shop Fuchsia", "Close. Bought on the way out."],
    ["Pride Parade Punch", "Loud, proud, and marching down Market Street.",
      "Pride After-Party Punch", "Almost the parade. Same glitter, later hour."],
    ["Emporium Neon", "Buzzes like an old bar sign at 2 a.m.",
      "Emporium Fluorescent", "Almost neon. Office lighting."],
    ["Ice Plant Bloom", "Carpets the dunes at Fort Funston in hot pink every spring.",
      "Ice Plant Bud", "Almost blooming. Give it a week."],
    ["22 Fillmore Philter to the Marina", "Climbs the Fillmore hill like it's got something to prove.",
      "22 Fillmore Philter to Dogpatch", "Right bus, wrong way. Went downhill fast, in every sense."],
  ],
};

/** The general color family, from lightness, chroma and hue. */
export function potionFamily(lab: Lab): Family {
  const c = chroma(lab);
  const L = lab.l;
  if (c < 8 || (L < 20 && c < 16)) return L < 22 ? "black" : L > 88 ? "white" : "grey";
  if (L > 82 && c < 22) return "pale";
  const hue = hueName(namingHue(lab));
  switch (hue) {
    case "pink":
    case "magenta":
      return L > 65 ? "light pink" : "magenta";
    case "red":
      return L < 40 ? "dark red" : "red";
    case "orange":
    case "yellow":
      if (L < 55 && c < 60) return "brown";
      if (hue === "yellow" && L < 68) return "mustard";
      return hue;
    case "lime":
      return "lime";
    case "green":
      return L < 45 ? "dark green" : "green";
    case "teal":
    case "sky blue":
      return hue;
    case "blue":
      return L < 35 ? "dark blue" : "blue";
    default:
      return L > 65 ? "lavender" : "purple";
  }
}

// Small string hash (FNV-1a), so a code always picks the same potion.
function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const familyOf = (hex: string) => potionFamily(rgbToLab(hexToRgb(hex)));
const pick = <T>(pool: T[], hex: string) => pool[hash(hex.toUpperCase()) % pool.length];

/** A potion name and description for a code. */
// Secret codes with their own potion, near miss, Welcome hint and cauldron effect.
interface Special {
  potion: [string, string, string, string];
  hint: string;
  effect: "steam";
}
const SPECIALS: Record<string, Special> = {
  C0FFEE: {
    potion: [
      "C0FFEE, Hold the Coffee", "Spells coffee, pours mint. The Grind swears it's the seasonal special.",
      "Decaf C0FFEE", "Close. All of the look, none of the buzz.",
    ],
    hint: "Your code spells C0FFEE! You found the barista's secret brew.",
    effect: "steam",
  },
};
const potionRow = (hex: string) => SPECIALS[hex.toUpperCase()]?.potion ?? pick(POTIONS[familyOf(hex)], hex);

/** The secret effect for a special code, if it has one. */
export const specialEffect = (hex: string) => SPECIALS[hex.toUpperCase()]?.effect;
export const specialHint = (hex: string) => SPECIALS[hex.toUpperCase()]?.hint;

export function potionFor(hex: string): Potion {
  const [name, line] = potionRow(hex);
  return { name, line };
}

/** Coffee-cup steam curling up out of a cauldron. */
export function addSteam(cauldron: SVGSVGElement) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "steam");
  g.innerHTML = [92, 120, 148].map((x, i) =>
    `<path d="M${x} 62 c-7 -10 7 -18 0 -28 c-7 -10 7 -18 0 -28" style="animation-delay:${i * 0.8}s"/>`).join("");
  cauldron.append(g);
}

/**
 * What the brew is called on the Compare screen, by judging tier: Spot On makes the target potion itself,
 * Close makes its near miss, and anything further off is some other potion from the brew's own color family.
 */
export function brewPotion(targetHex: string, actualHex: string, tier: string): Potion {
  const [name, line, nearName, nearLine] = potionRow(targetHex);
  if (tier === "Spot On") return { name, line };
  if (tier === "Close") return { name: nearName, line: nearLine };
  const [other, otherLine] = pick(POTIONS[familyOf(actualHex)].filter((p) => p[0] !== name), actualHex);
  return { name: other, line: otherLine };
}

/** Teasing hints about what the code is worth, without giving the rules away. */
export function pointHints(r: ScoreResult): string[] {
  if (r.ended) return ["A cursed code! Visit the apothecary before you brew."];
  const hints: string[] = [];
  const has = (test: (rule: string) => boolean) => r.rows.some(([rule, pts]) => pts > 0 && test(rule));
  const sorted = (s: string) => [...s].sort().join("");

  if (sorted(r.code) === sorted("D0B0CE")) {
    hints.push("Incredibly lucky! Unscramble your code for the name of the race, then take it to the apothecary to claim your prize.");
  }
  if (r.total >= 10) hints.push("A mighty code! The apothecary will be generous.");

  const spooky = new Set<string>(r.words.filter((w) => w.spooky).map((w) => SPOOKY_KIND[w.word] ?? "other"));
  if (spooky.has("death")) hints.push("Death lurks in your code. Unscramble it, if you dare.");
  if (spooky.has("ghost")) hints.push("A ghost is hiding in your code. Unscramble it and it might say something.");
  if (spooky.has("blood")) hints.push("Your code smells of blood. Unscramble it to find the source.");
  if (spooky.has("other")) hints.push("Something spooky is spelled out in your code...");
  if (r.words.some((w) => !w.spooky)) {
    hints.push("There are words hiding in your code. Unscramble the letters, and don't forget some numbers look like letters!");
  }

  if (has((rule) => /double|Pair of the same/.test(rule))) hints.push("Look twice. Part of your code is seeing double.");
  if (has((rule) => rule.startsWith("Run of"))) hints.push("Some of your characters climb in order, like the Lyon Street Steps.");
  if (has((rule) => /of the same character/.test(rule))) hints.push("One character keeps haunting your code, over and over.");
  if (has((rule) => rule === "Palindrome")) hints.push("Try reading your code backwards in a mirror.");
  if (has((rule) => rule === "Palindrome pair")) hints.push("Two of your cards are looking at each other in a mirror.");
  if (has((rule) => rule === "1031")) hints.push("Your code knows what night it is.");
  if (has((rule) => rule === "16")) hints.push("The warlock has a favorite card, and you're holding it.");
  if (has((rule) => /Primes only|13 or 31|69/.test(rule))) hints.push("The numbers in your code hold a secret. Count carefully.");

  if (r.rows.some(([, pts]) => pts < 0)) hints.push("Careful: something in your code will cost you chips.");
  if (r.total <= 0) {
    hints.push("This code doesn't earn any chips. Trade cards with another witch or complete a challenge to change your luck.");
  }
  return hints;
}

// Which spooky hint a spooky word gets on the Welcome screen.
const SPOOKY_KIND: Record<string, "death" | "ghost" | "blood"> = {
  DEAD: "death", DIE: "death", DIED: "death", BOO: "ghost", BOOED: "ghost", BLOOD: "blood",
};
