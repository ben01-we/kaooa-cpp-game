// Browser interface for Kaooa. All rules come from game.js; this file only
// draws the board, handles input and schedules the computer's turns.
import {
  EMPTY, CROW, VULTURE, CROWS_WIN, VULTURE_WINS, DRAW, CROW_COUNT, CAPTURES_TO_WIN,
  POINTS, LINES,
  createGame, getLegalMoves, applyMove, applyRepetition,
  chooseMove, randomMove, serializeMatch, parseMatch,
} from "./game.js";

const SVG = "http://www.w3.org/2000/svg";
const CENTER = 300;
const SCALE = 249;
const THINK_DELAY_MS = 450;
const SAVE_KEY = "kaooa-web-save";
const MODES = [
  "You: crows  /  Computer: vulture",
  "You: vulture  /  Computer: crows",
  "Two players  /  Pass & play",
];

const app = {
  state: createGame(),
  history: [],
  mode: 0, // 0 human crows, 1 human vulture, 2 two players
  strategic: true,
  hints: true,
  selected: -1,
  rulesOpen: false,
  note: "Choose an empty point to place your first crow.",
  timer: 0,
  returnFocus: null,
};

const $ = (id) => document.getElementById(id);
const ui = {
  board: $("board"),
  engraving: $("engraving"),
  lines: $("lines"),
  points: $("points"),
  modeLabel: $("mode-label"),
  modeBtn: $("mode-btn"),
  aiBtn: $("ai-btn"),
  title: $("title"),
  phase: $("phase"),
  note: $("note"),
  placed: $("placed"),
  placedDots: $("placed-dots"),
  captured: $("captured"),
  capturedDots: $("captured-dots"),
  newBtn: $("new-btn"),
  saveBtn: $("save-btn"),
  loadBtn: $("load-btn"),
  undoBtn: $("undo-btn"),
  hintsBtn: $("hints-btn"),
  rulesBtn: $("rules-btn"),
  rules: $("rules"),
  rulesClose: $("rules-close"),
};

// ---------------------------------------------------------------------------
// Board drawing
// ---------------------------------------------------------------------------

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (parent) parent.appendChild(node);
  return node;
}

const at = (i) => ({ x: CENTER + POINTS[i].x * SCALE, y: CENTER + POINTS[i].y * SCALE });
const pointNodes = [];

function buildBoard() {
  for (let r = 220; r <= 286; r += 22) el("circle", { class: "ring", cx: CENTER, cy: CENTER, r }, ui.engraving);
  for (let i = 0; i < 60; i++) {
    const a = (i * Math.PI) / 30;
    const inner = i % 5 === 0 ? 281 : 286;
    el("line", {
      class: "tick",
      x1: CENTER + Math.cos(a) * inner, y1: CENTER + Math.sin(a) * inner,
      x2: CENTER + Math.cos(a) * 290, y2: CENTER + Math.sin(a) * 290,
    }, ui.engraving);
  }

  for (const line of LINES) {
    const a = at(line[0]);
    const b = at(line[line.length - 1]);
    for (const cls of ["line-shadow", "line-edge", "line-light"]) {
      el("line", { class: cls, x1: a.x, y1: a.y, x2: b.x, y2: b.y }, ui.lines);
    }
  }

  for (let i = 0; i < 10; i++) {
    const { x, y } = at(i);
    const g = el("g", { class: "point", transform: `translate(${x} ${y})`, role: "button", tabindex: "0", "data-index": i }, ui.points);
    el("circle", { class: "hit", r: 34 }, g);
    el("circle", { class: "socket-shadow", cy: 3, r: 21 }, g);
    el("circle", { class: "socket", r: 18 }, g);
    el("circle", { class: "socket-inner", r: 14 }, g);
    const hint = el("circle", { class: "hint", r: 6 }, g);
    const selectRing = el("circle", { class: "select-ring", r: 28 }, g);
    el("circle", { class: "focus-ring", r: 32 }, g);
    const pieceShadow = el("circle", { class: "piece-shadow", cy: 4, r: 23 }, g);
    const piece = el("circle", { class: "piece", r: 23 }, g);
    const bird = el("use", { class: "bird", href: "#bird", x: -24, y: -14, width: 48, height: 28 }, g);
    const number = el("text", { class: "number", x: 25, y: -12 }, g);
    number.textContent = String(i + 1);
    number.setAttribute("aria-hidden", "true");

    g.addEventListener("click", () => clickPoint(i));
    g.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        clickPoint(i);
      }
    });
    pointNodes.push({ g, hint, selectRing, pieceShadow, piece, bird });
  }

  for (let i = 0; i < CROW_COUNT; i++) ui.placedDots.appendChild(document.createElement("span"));
  for (let i = 0; i < CAPTURES_TO_WIN; i++) ui.capturedDots.appendChild(document.createElement("span"));
}

const show = (node, visible) => { node.style.display = visible ? "" : "none"; };

// ---------------------------------------------------------------------------
// Match flow (mirrors main.cpp in the desktop edition)
// ---------------------------------------------------------------------------

function aiTurn() {
  const { state, mode } = app;
  return mode !== 2 && state.turn === (mode === 0 ? VULTURE : CROW) && !state.winner;
}

function schedule() {
  clearTimeout(app.timer);
  app.timer = 0;
  if (aiTurn() && !app.rulesOpen) app.timer = setTimeout(computerTurn, THINK_DELAY_MS);
}

function computerTurn() {
  app.timer = 0;
  if (app.rulesOpen || !aiTurn()) return;
  const move = app.strategic ? chooseMove(app.state) : randomMove(app.state);
  if (move) play(move);
}

function play(move) {
  const next = applyRepetition(app.history, applyMove(app.state, move));
  app.history.push(app.state);
  app.state = next;
  app.selected = -1;

  const s = app.state;
  if (s.winner) {
    app.note = s.winner === CROWS_WIN ? "The flock has sealed every escape route."
      : s.winner === VULTURE_WINS ? "Four crows captured. The hunter prevails."
      : "This position has repeated or no move remains.";
  } else if (move.over >= 0) {
    app.note = "A crow was captured. Plan your next move.";
  } else if (s.turn === CROW) {
    app.note = s.placed < CROW_COUNT ? "Place a crow on any empty point." : "Select a crow, then a highlighted destination.";
  } else {
    app.note = "Select the vulture, then a destination. Available captures are compulsory.";
  }
  if (s.turn === VULTURE && !s.winner) app.selected = s.board.indexOf(VULTURE);

  schedule();
  render();
}

function clickPoint(i) {
  const s = app.state;
  if (app.rulesOpen || aiTurn() || s.winner) return;

  const moves = getLegalMoves(s);
  const move = moves.find((m) => m.to === i && (m.from === -1 || m.from === app.selected));
  if (move) {
    play(move);
    return;
  }

  if (s.board[i] === s.turn) {
    app.selected = i;
    app.note = moves.some((m) => m.from === i)
      ? "Choose a highlighted point connected to this bird."
      : "That bird has no legal move right now. Choose another.";
  } else if (s.board[i] === EMPTY && app.selected < 0) {
    app.note = "Select one of your birds first, then a highlighted point.";
  } else {
    app.note = "That point is not a legal destination. Follow the star's lines.";
  }
  render();
}

function reset() {
  clearTimeout(app.timer);
  app.state = createGame();
  app.history = [];
  app.selected = -1;
  app.note = "Choose an empty point to place a crow.";
  schedule();
  render();
}

function changeMode() {
  app.mode = (app.mode + 1) % 3;
  reset();
}

function toggleDifficulty() {
  app.strategic = !app.strategic;
  app.note = app.strategic ? "Strategic AI plans five moves ahead." : "Easy AI chooses a random legal move.";
  render();
}

function toggleHints() {
  app.hints = !app.hints;
  app.note = app.hints ? "Move hints enabled." : "Move hints disabled.";
  render();
}

function undo() {
  if (app.history.length === 0) {
    app.note = "There is no move to undo.";
    render();
    return;
  }
  clearTimeout(app.timer);
  app.state = app.history.pop();
  // Against the computer, also roll back its reply so it is your turn again.
  if (app.mode !== 2 && aiTurn() && app.history.length) app.state = app.history.pop();
  app.selected = -1;
  app.note = "Move undone. Choose your next move.";
  schedule();
  render();
}

function saveMatch() {
  try {
    localStorage.setItem(SAVE_KEY, serializeMatch(app));
    app.note = "Saved in this browser. Load it whenever you return.";
  } catch {
    app.note = "Could not save. This browser is blocking site storage.";
  }
  render();
}

function loadMatch() {
  let text = null;
  try {
    text = localStorage.getItem(SAVE_KEY);
  } catch {
    text = null;
  }
  const restored = text ? parseMatch(text) : null;
  if (!restored) {
    app.note = "No valid saved game found. Your current game is unchanged.";
  } else {
    clearTimeout(app.timer);
    app.state = restored.state;
    app.history = restored.history;
    app.mode = restored.mode;
    app.selected = -1;
    app.note = "Saved game restored, including undo history.";
    schedule();
  }
  render();
}

function openRules() {
  if (app.rulesOpen) return;
  app.rulesOpen = true;
  app.returnFocus = document.activeElement;
  clearTimeout(app.timer);
  app.timer = 0;
  ui.rules.hidden = false;
  ui.rulesClose.focus();
  render();
}

function closeRules() {
  if (!app.rulesOpen) return;
  app.rulesOpen = false;
  ui.rules.hidden = true;
  if (app.returnFocus && document.contains(app.returnFocus)) app.returnFocus.focus();
  schedule();
  render();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render() {
  const s = app.state;
  const thinking = aiTurn();

  ui.modeLabel.textContent = MODES[app.mode];
  ui.aiBtn.textContent = app.strategic ? "AI: strategic" : "AI: easy";
  ui.hintsBtn.textContent = app.hints ? "Hints: on" : "Hints: off";
  ui.hintsBtn.setAttribute("aria-pressed", String(app.hints));

  ui.title.textContent = s.winner
    ? s.winner === DRAW ? "A balanced contest" : s.winner === CROWS_WIN ? "The crows win!" : "The vulture wins!"
    : thinking ? "Computer is thinking..." : s.turn === CROW ? "The crows' turn" : "The vulture's turn";

  ui.phase.textContent = s.winner ? "Start a new game or undo a move."
    : s.turn === CROW ? (s.placed < CROW_COUNT ? "Place  /  Build your blockade" : "Move  /  Close the escape routes")
    : "Hunt  /  Capture four crows";
  ui.phase.classList.toggle("hunt", !s.winner && s.turn === VULTURE);
  ui.note.textContent = app.note;

  ui.placed.textContent = `${s.placed} / ${CROW_COUNT}`;
  ui.captured.textContent = `${s.captured} / ${CAPTURES_TO_WIN}`;
  [...ui.placedDots.children].forEach((dot, i) => dot.classList.toggle("on", i < s.placed));
  [...ui.capturedDots.children].forEach((dot, i) => dot.classList.toggle("on", i < s.captured));

  ui.undoBtn.disabled = app.history.length === 0;

  const legal = getLegalMoves(s);
  const canAct = !thinking && !s.winner;
  pointNodes.forEach((node, i) => {
    const content = s.board[i];
    const target = legal.some((m) => m.to === i && (m.from === -1 || m.from === app.selected));
    const hinted = content === EMPTY && app.hints && target && canAct;

    show(node.hint, hinted);
    show(node.selectRing, app.selected === i && content !== EMPTY && canAct);
    for (const part of [node.pieceShadow, node.piece, node.bird]) show(part, content !== EMPTY);
    node.piece.classList.toggle("crow", content === CROW);
    node.piece.classList.toggle("vulture", content === VULTURE);
    node.bird.classList.toggle("vulture", content === VULTURE);

    const who = content === CROW ? "crow" : content === VULTURE ? "vulture" : "empty";
    const extra = app.selected === i && content !== EMPTY ? ", selected" : target && canAct ? ", available move" : "";
    node.g.setAttribute("aria-label", `Point ${i + 1}, ${who}${extra}`);
  });
}

// ---------------------------------------------------------------------------
// Controls and keyboard shortcuts
// ---------------------------------------------------------------------------

function onKeyDown(event) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();

  if (app.rulesOpen) {
    if (key === "escape" || key === "h") {
      event.preventDefault();
      closeRules();
    } else if (key === "tab") {
      event.preventDefault(); // keep focus inside the rules panel
      ui.rulesClose.focus();
    }
    return;
  }

  const actions = {
    h: openRules,
    n: reset,
    s: saveMatch,
    l: loadMatch,
    m: changeMode,
    t: toggleHints,
    u: undo,
  };
  const action = actions[key];
  if (action) {
    event.preventDefault();
    action();
  }
}

function start() {
  buildBoard();
  ui.modeBtn.addEventListener("click", changeMode);
  ui.aiBtn.addEventListener("click", toggleDifficulty);
  ui.newBtn.addEventListener("click", reset);
  ui.saveBtn.addEventListener("click", saveMatch);
  ui.loadBtn.addEventListener("click", loadMatch);
  ui.undoBtn.addEventListener("click", undo);
  ui.hintsBtn.addEventListener("click", toggleHints);
  ui.rulesBtn.addEventListener("click", openRules);
  ui.rulesClose.addEventListener("click", closeRules);
  ui.rules.addEventListener("click", (event) => { if (event.target === ui.rules) closeRules(); });
  document.addEventListener("keydown", onKeyDown);
  render();
}

start();

// Expose read-only state for browser-based checks and debugging.
window.kaooa = {
  get state() { return structuredClone(app.state); },
  get mode() { return app.mode; },
  get rulesOpen() { return app.rulesOpen; },
};
