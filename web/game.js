// Kaooa rules engine for the web edition.
// It mirrors game.h from the desktop edition so both editions play identically:
// same point numbering, move order, capture rules, win checks and computer search.

export const EMPTY = 0;
export const CROW = 1;
export const VULTURE = 2;

export const ONGOING = 0;
export const CROWS_WIN = 1;
export const VULTURE_WINS = 2;
export const DRAW = 3;

export const CROW_COUNT = 7;
export const CAPTURES_TO_WIN = 4;
export const MAX_DEPTH = 5;

// ---------------------------------------------------------------------------
// Board geometry: five outer star tips plus the five inner crossings.
// ---------------------------------------------------------------------------

function buildGeometry() {
  const points = [];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    points.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }

  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

  // Each star line joins tip i to tip i+2. Inner points are where lines cross.
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const a = points[i], b = points[(i + 2) % 5];
      const c = points[j], d = points[(j + 2) % 5];
      const r = sub(b, a), s = sub(d, c);
      const den = cross(r, s);
      if (Math.abs(den) < 1e-8) continue;
      const t = cross(sub(c, a), s) / den;
      const u = cross(sub(c, a), r) / den;
      if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) {
        points.push({ x: a.x + t * r.x, y: a.y + t * r.y });
      }
    }
  }

  const lines = [];
  const adjacent = Array.from({ length: 10 }, () => Array(10).fill(false));
  for (let i = 0; i < 5; i++) {
    const a = points[i];
    const r = sub(points[(i + 2) % 5], a);
    const line = [];
    for (let n = 0; n < 10; n++) {
      if (Math.abs(cross(sub(points[n], a), r)) < 1e-6) {
        line.push({ n, along: (points[n].x - a.x) * r.x + (points[n].y - a.y) * r.y });
      }
    }
    line.sort((p, q) => p.along - q.along);
    const ordered = line.map((p) => p.n);
    for (let k = 1; k < ordered.length; k++) {
      adjacent[ordered[k - 1]][ordered[k]] = true;
      adjacent[ordered[k]][ordered[k - 1]] = true;
    }
    lines.push(ordered);
  }

  const edges = [];
  for (let i = 0; i < 10; i++) {
    for (let j = i + 1; j < 10; j++) if (adjacent[i][j]) edges.push([i, j]);
  }

  return { points, lines, adjacent, edges };
}

const geometry = buildGeometry();

/** Unit coordinates of the 10 points (index 0 is the top tip, shown as point 1). */
export const POINTS = Object.freeze(geometry.points.map((p) => Object.freeze(p)));
/** The five straight lines, each listing four point indexes in order. */
export const LINES = Object.freeze(geometry.lines.map((l) => Object.freeze(l)));
/** The 15 connections between neighbouring points. */
export const EDGES = Object.freeze(geometry.edges.map((e) => Object.freeze(e)));

export function areAdjacent(a, b) {
  return geometry.adjacent[a]?.[b] === true;
}

// ---------------------------------------------------------------------------
// Game state and legal moves
// ---------------------------------------------------------------------------

/** Return a fresh state: empty board, crows to place first. */
export function createGame() {
  return {
    board: Array(10).fill(EMPTY), // 0 empty, 1 crow, 2 vulture
    turn: CROW,
    placed: 0,
    captured: 0,
    winner: ONGOING, // 0 ongoing, 1 crows, 2 vulture, 3 draw
  };
}

/**
 * Return every legal move as { from, to, over }.
 * from = -1 means placement; over = -1 means no capture.
 * Captures are compulsory: if the vulture can jump, only jumps are returned.
 */
export function getLegalMoves(state) {
  const out = [];
  const jumps = [];
  if (state.winner) return out;

  const { board, turn } = state;
  const vulture = board.indexOf(VULTURE);

  if ((turn === CROW && state.placed < CROW_COUNT) || (turn === VULTURE && vulture < 0)) {
    for (let i = 0; i < 10; i++) if (board[i] === EMPTY) out.push({ from: -1, to: i, over: -1 });
    return out;
  }

  for (let i = 0; i < 10; i++) {
    if (board[i] !== turn) continue;
    for (let j = 0; j < 10; j++) {
      if (board[j] === EMPTY && geometry.adjacent[i][j]) out.push({ from: i, to: j, over: -1 });
    }
  }

  if (turn === VULTURE) {
    for (const line of geometry.lines) {
      for (let i = 0; i + 2 < line.length; i++) {
        const a = line[i], b = line[i + 1], c = line[i + 2];
        if (board[b] !== CROW) continue;
        if (a === vulture && board[c] === EMPTY) jumps.push({ from: a, to: c, over: b });
        if (c === vulture && board[a] === EMPTY) jumps.push({ from: c, to: a, over: b });
      }
    }
  }

  return jumps.length ? jumps : out;
}

// Apply a move already known to be legal. Returns a new state.
function step(state, move) {
  const board = state.board.slice();
  let placed = state.placed;
  let captured = state.captured;

  if (move.from >= 0) board[move.from] = EMPTY;
  else if (state.turn === CROW) placed++;
  board[move.to] = state.turn;
  if (move.over >= 0) {
    board[move.over] = EMPTY;
    captured++;
  }

  const next = { board, turn: 3 - state.turn, placed, captured, winner: ONGOING };
  if (captured >= CAPTURES_TO_WIN) {
    next.winner = VULTURE_WINS;
  } else if (getLegalMoves({ ...next, turn: VULTURE }).length === 0) {
    next.winner = CROWS_WIN; // the vulture is trapped
  } else if (getLegalMoves(next).length === 0) {
    next.winner = DRAW; // the player to move has no move
  }
  return next;
}

function sameMove(a, b) {
  return a.from === b.from && a.to === b.to && (b.over === undefined || a.over === b.over);
}

/** Find the legal move matching { from, to } (and over, if given), or null. */
export function findLegalMove(state, move) {
  return getLegalMoves(state).find((legal) => sameMove(legal, move)) ?? null;
}

/**
 * Validate a move against getLegalMoves, then return a new state.
 * Invalid moves throw an Error and never modify the existing state.
 */
export function applyMove(state, move) {
  const legal = move ? findLegalMove(state, move) : null;
  if (!legal) throw new Error("Illegal move");
  return step(state, legal);
}

/** A compact key identifying a position (board, side to move and counters). */
export function positionKey(state) {
  return `${state.turn}|${state.placed}|${state.captured}|${state.board.join("")}`;
}

/**
 * Apply the threefold-repetition rule used by both editions.
 * history holds earlier states (not including next).
 */
export function applyRepetition(history, next) {
  if (next.winner) return next;
  const key = positionKey(next);
  let repeats = 1;
  for (const earlier of history) if (positionKey(earlier) === key) repeats++;
  return repeats >= 3 ? { ...next, winner: DRAW } : next;
}

// ---------------------------------------------------------------------------
// Computer opponent: minimax with alpha-beta pruning (same as game.h)
// ---------------------------------------------------------------------------

export function evaluate(state) {
  if (state.winner) {
    return state.winner === VULTURE_WINS ? 10000 : state.winner === CROWS_WIN ? -10000 : 0;
  }
  let freedom = 0;
  for (const m of getLegalMoves({ ...state, turn: VULTURE })) freedom += m.over >= 0 ? 3 : 1;
  return state.captured * 150 + freedom * 12;
}

export function search(state, depth, alpha, beta) {
  if (depth === 0 || state.winner) return evaluate(state);
  const moves = getLegalMoves(state);
  if (moves.length === 0) return 0;
  let best = state.turn === VULTURE ? -20000 : 20000;
  for (const m of moves) {
    const score = search(step(state, m), depth - 1, alpha, beta);
    if (state.turn === VULTURE) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/**
 * Strategic computer move. depth counts plies searched after the candidate
 * move (clamped to 1..5; default 4 matches the desktop edition).
 * Returns null when there is no legal move.
 */
export function chooseMove(state, depth = 4) {
  const options = getLegalMoves(state);
  if (options.length === 0) return null;

  depth = Math.min(MAX_DEPTH, Math.max(1, Math.trunc(Number(depth)) || 1));
  let best = options[0];
  let bestScore = state.turn === VULTURE ? -20001 : 20001;

  for (const candidate of options) {
    const score = search(step(state, candidate), depth, -20000, 20000);
    const improves =
      (state.turn === VULTURE && score > bestScore) || (state.turn === CROW && score < bestScore);
    if (improves) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** Easy computer move: any legal move. random() must return [0, 1). */
export function randomMove(state, random = Math.random) {
  const options = getLegalMoves(state);
  if (options.length === 0) return null;
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}

// ---------------------------------------------------------------------------
// Saved matches: every transition is replayed and checked before loading.
// ---------------------------------------------------------------------------

export const SAVE_FORMAT = "KAOOA_WEB_SAVE_1";

function plainState(s) {
  return { board: s.board.slice(), turn: s.turn, placed: s.placed, captured: s.captured, winner: s.winner };
}

export function serializeMatch({ state, history, mode }) {
  return JSON.stringify({
    format: SAVE_FORMAT,
    mode,
    states: [...history, state].map(plainState),
  });
}

function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isValidShape(s) {
  return (
    s !== null && typeof s === "object" &&
    Array.isArray(s.board) && s.board.length === 10 && s.board.every((b) => isInt(b, 0, 2)) &&
    isInt(s.turn, 1, 2) && isInt(s.placed, 0, CROW_COUNT) &&
    isInt(s.captured, 0, CAPTURES_TO_WIN) && isInt(s.winner, 0, 3)
  );
}

/** Parse and verify a saved match. Returns { state, history, mode } or null. */
export function parseMatch(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || data.format !== SAVE_FORMAT || !isInt(data.mode, 0, 2)) return null;
  const { states } = data;
  if (!Array.isArray(states) || states.length < 1 || states.length > 10000) return null;
  if (!states.every(isValidShape)) return null;

  const verified = [];
  for (let n = 0; n < states.length; n++) {
    const s = plainState(states[n]);
    if (n === 0) {
      if (positionKey(s) !== positionKey(createGame()) || s.winner) return null;
    } else {
      const previous = verified[n - 1];
      const reachable = getLegalMoves(previous).some((m) => {
        const next = applyRepetition(verified.slice(0, n - 1), step(previous, m));
        return positionKey(next) === positionKey(s) && next.winner === s.winner;
      });
      if (!reachable) return null;
    }
    verified.push(s);
  }

  const state = verified.pop();
  return { state, history: verified, mode: data.mode };
}
