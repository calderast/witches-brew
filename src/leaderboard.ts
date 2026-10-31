// Leaderboard persisted in this browser's localStorage: one entry per nickname + code, with every scored guess.

export interface Guess {
  hex: string;
  deltaE: number;
  tier: string;
  at: number; // timestamp
}

export interface Entry {
  nickname: string;
  code: string;
  guesses: Guess[];
}

const KEY = "witches-brew.leaderboard.v1";

export function loadBoard(): Entry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

function saveBoard(board: Entry[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}

/** Records a guess and returns its 1-based number for that player, or null if it repeats their last guess. */
export function addGuess(nickname: string, code: string, guess: Guess): number | null {
  const board = loadBoard();
  const name = nickname.trim();
  let entry = board.find((e) => e.nickname.toLowerCase() === name.toLowerCase() && e.code === code);
  if (!entry) {
    entry = { nickname: name, code, guesses: [] };
    board.push(entry);
  }
  // Pressing Enter twice shouldn't log the same reading twice.
  if (entry.guesses.at(-1)?.hex === guess.hex) return null;
  entry.guesses.push(guess);
  saveBoard(board);
  return entry.guesses.length;
}

export function clearBoard() {
  saveBoard([]);
}

export const bestGuess = (e: Entry) => e.guesses.reduce((a, b) => (b.deltaE < a.deltaE ? b : a));

/** Best (lowest ΔE) first. */
export function rankedBoard(): Entry[] {
  return loadBoard()
    .filter((e) => e.guesses.length)
    .sort((a, b) => bestGuess(a).deltaE - bestGuess(b).deltaE);
}
