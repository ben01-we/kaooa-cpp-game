// Rules tests for the web edition. Run from the project folder:
//   node --test web/game.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY, CROW, VULTURE, ONGOING, CROWS_WIN, VULTURE_WINS, DRAW,
  POINTS, LINES, EDGES, areAdjacent,
  createGame, getLegalMoves, applyMove, applyRepetition, positionKey,
  chooseMove, randomMove, serializeMatch, parseMatch,
} from "./game.js";

// Point labels on screen are index + 1.
const P = (label) => label - 1;

function position({ crows = [], vulture = -1, turn = CROW, placed = crows.length, captured = 0 }) {
  const state = createGame();
  for (const c of crows) state.board[P(c)] = CROW;
  if (vulture > 0) state.board[P(vulture)] = VULTURE;
  return { ...state, turn, placed, captured };
}

// Small seeded generator so random games are repeatable.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isLegal = (state, move) =>
  getLegalMoves(state).some((m) => m.from === move.from && m.to === move.to && m.over === move.over);

test("board geometry has 10 points, 5 straight lines and 15 edges", () => {
  assert.equal(POINTS.length, 10);
  assert.equal(LINES.length, 5);
  for (const line of LINES) assert.equal(line.length, 4);
  assert.equal(EDGES.length, 15);
  // Same numbering as the desktop board.
  assert.deepEqual(LINES.map((l) => l.map((i) => i + 1)), [
    [1, 7, 6, 3], [2, 6, 8, 4], [3, 8, 9, 5], [4, 9, 10, 1], [5, 10, 7, 2],
  ]);
  for (let i = 0; i < 10; i++) {
    const degree = EDGES.filter(([a, b]) => a === i || b === i).length;
    assert.equal(degree, i < 5 ? 2 : 4, `point ${i + 1} neighbours`);
  }
  assert.ok(areAdjacent(P(1), P(7)) && !areAdjacent(P(1), P(6)));
});

test("a new game starts with crows placing on any of the 10 points", () => {
  const s = createGame();
  assert.deepEqual(s, { board: Array(10).fill(EMPTY), turn: CROW, placed: 0, captured: 0, winner: ONGOING });
  const moves = getLegalMoves(s);
  assert.equal(moves.length, 10);
  assert.ok(moves.every((m) => m.from === -1 && m.over === -1));
});

test("the vulture enters after the first crow, then moves on later turns", () => {
  let s = applyMove(createGame(), { from: -1, to: P(1) });
  assert.equal(s.turn, VULTURE);
  const entries = getLegalMoves(s);
  assert.equal(entries.length, 9);
  assert.ok(entries.every((m) => m.from === -1));

  s = applyMove(s, { from: -1, to: P(8) });
  s = applyMove(s, { from: -1, to: P(2) });
  const moves = getLegalMoves(s);
  assert.ok(moves.length > 0 && moves.every((m) => m.from === P(8) && areAdjacent(P(8), m.to)));
});

test("crows place all seven pieces before moving", () => {
  const random = seeded(7);
  let s = createGame();
  while (s.placed < 7 && !s.winner) {
    if (s.turn === CROW) assert.ok(getLegalMoves(s).every((m) => m.from === -1), "crow must place");
    s = applyMove(s, randomMove(s, random));
  }
  if (!s.winner && s.turn === CROW) assert.ok(getLegalMoves(s).every((m) => m.from >= 0));
  assert.throws(() => applyMove(s, { from: -1, to: s.board.indexOf(EMPTY) }));
});

test("captures jump one crow in a straight line onto an empty point", () => {
  const s = position({ crows: [7, 5], vulture: 1, turn: VULTURE });
  const moves = getLegalMoves(s);
  assert.deepEqual(moves, [{ from: P(1), to: P(6), over: P(7) }]);
  const next = applyMove(s, moves[0]);
  assert.equal(next.board[P(7)], EMPTY);
  assert.equal(next.board[P(6)], VULTURE);
  assert.equal(next.captured, 1);
});

test("a capture is compulsory when available", () => {
  const s = position({ crows: [7], vulture: 1, turn: VULTURE });
  // Point 10 is an empty neighbour, but the jump over 7 must be taken.
  assert.ok(getLegalMoves(s).every((m) => m.over >= 0));
  assert.throws(() => applyMove(s, { from: P(1), to: P(10) }), /Illegal move/);
});

test("the vulture wins with its fourth capture", () => {
  const s = position({ crows: [7, 2, 3], vulture: 1, turn: VULTURE, placed: 7, captured: 3 });
  const next = applyMove(s, { from: P(1), to: P(6), over: P(7) });
  assert.equal(next.captured, 4);
  assert.equal(next.winner, VULTURE_WINS);
  assert.equal(getLegalMoves(next).length, 0);
});

test("the crows win by trapping the vulture (forced line from a real match)", () => {
  let s = position({ crows: [5, 2, 9, 6, 8, 4, 3], vulture: 7 });
  const script = [
    [9, 10], [7, 1],
    [4, 9], [1, 7],
    [8, 4], [7, 1],
    [2, 7],
  ];
  for (const [from, to] of script) {
    if (s.turn === VULTURE) assert.equal(getLegalMoves(s).length, 1, "vulture move is forced");
    s = applyMove(s, { from: P(from), to: P(to) });
  }
  assert.equal(s.winner, CROWS_WIN);
});

test("the strategic computer finds a one-move trap", () => {
  const s = position({ crows: [5, 2, 9, 6, 10, 4, 3], vulture: 1 });
  const move = chooseMove(s, 1);
  assert.equal(applyMove(s, move).winner, CROWS_WIN);
});

test("a position repeated three times is a draw", () => {
  const random = seeded(3);
  // Find a real mid-game position with a four-move cycle back to itself.
  for (let game = 0; game < 200; game++) {
    let s = createGame();
    for (let n = 0; n < 40 && !s.winner; n++) s = applyMove(s, randomMove(s, random));
    if (s.winner || s.placed < 7) continue;
    for (const a of getLegalMoves(s)) {
      const s1 = applyMove(s, a);
      if (s1.winner || a.over >= 0) continue;
      for (const b of getLegalMoves(s1)) {
        const s2 = applyMove(s1, b);
        if (s2.winner || b.over >= 0) continue;
        const back = getLegalMoves(s2).find((m) => m.from === a.to && m.to === a.from);
        if (!back) continue;
        const s3 = applyMove(s2, back);
        const home = getLegalMoves(s3).find((m) => m.from === b.to && m.to === b.from);
        if (!home || s3.winner) continue;

        const cycle = [a, b, back, home];
        let current = s;
        const history = [];
        for (let lap = 0; lap < 2; lap++) {
          for (const move of cycle) {
            assert.equal(current.winner, ONGOING, "no early result");
            const next = applyRepetition(history, applyMove(current, move));
            history.push(current);
            current = next;
          }
        }
        assert.equal(positionKey(current), positionKey(s));
        assert.equal(current.winner, DRAW);
        return;
      }
    }
  }
  assert.fail("no repeatable position found");
});

test("invalid moves are rejected without changing the state", () => {
  const s = applyMove(applyMove(createGame(), { from: -1, to: P(1) }), { from: -1, to: P(7) });
  const before = JSON.stringify(s);
  const bad = [
    { from: -1, to: P(1) },       // occupied point
    { from: P(1), to: P(2) },     // crows are still placing
    { from: -1, to: 42 },         // off the board
    null,
  ];
  for (const move of bad) assert.throws(() => applyMove(s, move), /Illegal move/);
  assert.equal(JSON.stringify(s), before);

  const moving = position({ crows: [5, 2, 9, 6, 8, 4, 3], vulture: 7 });
  assert.throws(() => applyMove(moving, { from: P(5), to: P(1) }), "not connected");
  const finished = { ...moving, winner: CROWS_WIN };
  assert.equal(getLegalMoves(finished).length, 0);
  assert.throws(() => applyMove(finished, { from: P(9), to: P(10) }), "game over");
});

test("500 seeded random games keep every piece accounted for", () => {
  const random = seeded(2024);
  let turns = 0;
  for (let game = 0; game < 500; game++) {
    let s = createGame();
    for (let n = 0; n < 180 && !s.winner; n++) {
      const moves = getLegalMoves(s);
      assert.ok(moves.length > 0, "ongoing game has moves");
      const move = moves[Math.floor(random() * moves.length)];
      assert.equal(s.board[move.to], EMPTY, "destination empty");
      s = applyMove(s, move);
      const crows = s.board.filter((b) => b === CROW).length;
      const vultures = s.board.filter((b) => b === VULTURE).length;
      assert.equal(crows + s.captured, s.placed, "piece conservation");
      assert.ok(s.placed <= 7 && vultures <= 1);
      turns++;
    }
  }
  assert.ok(turns > 5000);
});

test("the computer returns legal moves at depths 1, 3 and 5, and null when the game is over", () => {
  const opening = applyMove(createGame(), { from: -1, to: P(1) });
  for (const depth of [1, 3, 5]) assert.ok(isLegal(opening, chooseMove(opening, depth)));
  assert.ok(isLegal(opening, chooseMove(opening, 99)), "depth is clamped");

  let s = createGame();
  for (let n = 0; n < 70 && !s.winner; n++) {
    const move = chooseMove(s);
    assert.ok(isLegal(s, move), "computer move legal");
    s = applyMove(s, move);
  }
  assert.equal(chooseMove({ ...createGame(), winner: DRAW }), null);
  assert.equal(randomMove({ ...createGame(), winner: DRAW }), null);
});

test("saved matches round-trip and invalid saves are rejected", () => {
  const random = seeded(11);
  let state = createGame();
  const history = [];
  for (let n = 0; n < 12 && !state.winner; n++) {
    const next = applyRepetition(history, applyMove(state, randomMove(state, random)));
    history.push(state);
    state = next;
  }
  const text = serializeMatch({ state, history, mode: 1 });
  const loaded = parseMatch(text);
  assert.ok(loaded);
  assert.equal(loaded.mode, 1);
  assert.deepEqual(loaded.state, state);
  assert.deepEqual(loaded.history, history);

  assert.equal(parseMatch("not json"), null);
  assert.equal(parseMatch("{}"), null);
  const data = JSON.parse(text);
  assert.equal(parseMatch(JSON.stringify({ ...data, mode: 5 })), null);
  const tampered = structuredClone(data);
  const last = tampered.states.at(-1);
  last.captured = last.captured === 0 ? 1 : 0; // a transition that could not happen
  assert.equal(parseMatch(JSON.stringify(tampered)), null);
  const skipped = structuredClone(data);
  skipped.states.splice(1, 1); // missing move
  assert.equal(parseMatch(JSON.stringify(skipped)), null);
});
