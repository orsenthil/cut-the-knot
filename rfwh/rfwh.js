"use strict";

/*
 * Browser port of RFWH.jar ("Rooster, Hen, Farmer and Wife" by Alexander
 * Bogomolny, cut-the-knot.org). Ported from the decompiled RFWHCanvas.java
 * pursuit logic: two humans (Farmer, Wife) drag one square at a time onto an
 * empty square; once the human side has moved, each hunted animal (Rooster,
 * Hen) tries to flee to a square that isn't adjacent to a human, but is
 * forced into a human's square if every escape square is covered.
 *
 * Differences from the original applet (see conversation notes):
 *  - Each mode is a clean "these humans chase these animals" pairing; the
 *    original also silently required tagging an off-screen, never-moving
 *    animal in single-pair modes, which was unreachable through normal play.
 *  - The decorative eyes that tracked the mouse cursor are omitted.
 */

const CELL = 60;
const PIECE_META = {
  rooster: { src: "images/rooster.gif" },
  hen: { src: "images/hen.gif" },
  farmer: { src: "images/farmer.gif" },
  wife: { src: "images/wife.gif" },
};

const MODES = {
  rf: { humans: ["farmer"], animals: ["rooster"], label: "Farmer & Rooster" },
  wh: { humans: ["wife"], animals: ["hen"], label: "Wife & Hen" },
  rw: { humans: ["wife"], animals: ["rooster"], label: "Rooster & Wife" },
  fh: { humans: ["farmer"], animals: ["hen"], label: "Farmer & Hen" },
  all: { humans: ["farmer", "wife"], animals: ["rooster", "hen"], label: "All of them" },
};

const PIECE_LABEL = { rooster: "Rooster", hen: "Hen", farmer: "Farmer", wife: "Wife" };

const ARROW_DELTA = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const selectedInfoEl = document.getElementById("selected-info");
const resetButton = document.getElementById("reset");

const images = {};
let imagesLoaded = 0;
const totalImages = Object.keys(PIECE_META).length;
for (const [name, meta] of Object.entries(PIECE_META)) {
  const img = new Image();
  img.onload = () => {
    imagesLoaded++;
    if (imagesLoaded === totalImages) draw();
  };
  img.src = meta.src;
  images[name] = img;
}

let state = null;

function initialLayout(n) {
  const mid = Math.floor(n / 2);
  return {
    rooster: { x: mid, y: 0 },
    farmer: { x: mid, y: 2 },
    wife: { x: mid, y: n - 3 },
    hen: { x: mid, y: n - 1 },
  };
}

function newGame(modeKey, n) {
  const mode = MODES[modeKey];
  const layout = initialLayout(n);
  const pieces = {};
  for (const name of [...mode.humans, ...mode.animals]) {
    pieces[name] = { ...layout[name] };
  }
  state = {
    modeKey,
    mode,
    n,
    pieces,
    caught: new Set(),
    movedThisRound: new Set(),
    moves: 0,
    finished: false,
    drag: null,
    selected: null,
  };
  canvas.width = n * CELL;
  canvas.height = n * CELL;
  statusEl.textContent = "";
  statusEl.classList.remove("win");
  autoSelect();
  draw();
}

// Picks the first human still eligible to move this round, so keyboard
// control works right away without requiring a click first.
function autoSelect() {
  const movable = state.mode.humans.find(
    (h) => !state.movedThisRound.has(h) && !state.finished
  );
  selectPiece(movable || null);
}

function selectPiece(name) {
  state.selected = name;
  if (!name) {
    selectedInfoEl.textContent = "";
  } else if (state.finished) {
    selectedInfoEl.innerHTML = "";
  } else {
    selectedInfoEl.innerHTML = `Selected: <strong>${PIECE_LABEL[name]}</strong> &mdash; move with <kbd>&uarr;</kbd><kbd>&darr;</kbd><kbd>&larr;</kbd><kbd>&rarr;</kbd>`;
  }
}

function inBounds(p, n) {
  return p.x >= 0 && p.y >= 0 && p.x < n && p.y < n;
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function occupiedCells(excludeName) {
  const cells = [];
  for (const [name, pos] of Object.entries(state.pieces)) {
    if (name === excludeName) continue;
    if (state.caught.has(name)) continue; // caught animals free their square
    cells.push(pos);
  }
  return cells;
}

function isLegalSquare(p, excludeName) {
  if (!inBounds(p, state.n)) return false;
  return !occupiedCells(excludeName).some((c) => sameCell(c, p));
}

function isDangerous(p) {
  for (const h of state.mode.humans) {
    if (state.caught.has(h)) continue;
    if (manhattan(p, state.pieces[h]) === 1) return true;
  }
  return false;
}

// Mirrors RFWHCanvas.MoveOne(): a fixed preference order (not board-size
// aware, exactly like the original), trying to flee to a safe square first
// and only stepping into danger when cornered.
function candidateMoves(pos) {
  const c = [];
  c.push(pos.x < 4 ? { x: pos.x + 1, y: pos.y } : { x: pos.x - 1, y: pos.y });
  c.push(pos.x > 3 ? { x: pos.x + 1, y: pos.y } : { x: pos.x - 1, y: pos.y });
  c.push(pos.y < 4 ? { x: pos.x, y: pos.y + 1 } : { x: pos.x, y: pos.y - 1 });
  c.push(pos.y > 3 ? { x: pos.x, y: pos.y + 1 } : { x: pos.x, y: pos.y - 1 });
  return c;
}

function moveAnimal(name) {
  const pos = state.pieces[name];
  const candidates = candidateMoves(pos).filter((p) => isLegalSquare(p, name));
  if (candidates.length === 0) return;
  const safe = candidates.find((p) => !isDangerous(p));
  state.pieces[name] = safe || candidates[0];
}

function checkCaptures() {
  for (const animal of state.mode.animals) {
    if (state.caught.has(animal)) continue;
    for (const human of state.mode.humans) {
      if (sameCell(state.pieces[animal], state.pieces[human])) {
        state.caught.add(animal);
        break;
      }
    }
  }
}

function roundReady() {
  // A human only needs to keep moving while its paired animal is free:
  // farmer <-> rooster, wife <-> hen (matches the original's WhoMoves rule).
  for (const human of state.mode.humans) {
    const pairedAnimal =
      human === "farmer" ? "rooster" : human === "wife" ? "hen" : null;
    const mustMove =
      !pairedAnimal ||
      !state.mode.animals.includes(pairedAnimal) ||
      !state.caught.has(pairedAnimal);
    if (mustMove && !state.movedThisRound.has(human)) return false;
  }
  return true;
}

function runAnimalTurn() {
  for (const animal of state.mode.animals) {
    if (!state.caught.has(animal)) moveAnimal(animal);
  }
  checkCaptures();
  state.movedThisRound.clear();
  const allCaught = state.mode.animals.every((a) => state.caught.has(a));
  if (allCaught) {
    state.finished = true;
    statusEl.textContent = `Caught! Finished in ${state.moves} moves.`;
    statusEl.classList.add("win");
  }
  autoSelect();
}

function tryMoveHuman(name, dest) {
  if (state.finished) return false;
  if (state.movedThisRound.has(name)) return false;
  const pos = state.pieces[name];
  if (manhattan(pos, dest) !== 1) return false;
  if (!inBounds(dest, state.n)) return false;
  for (const other of state.mode.humans) {
    if (other !== name && sameCell(state.pieces[other], dest)) return false;
  }
  state.pieces[name] = dest;
  state.moves++;
  state.movedThisRound.add(name);
  checkCaptures();
  if (state.finished) return true;
  const allCaught = state.mode.animals.every((a) => state.caught.has(a));
  if (allCaught) {
    state.finished = true;
    statusEl.textContent = `Caught! Finished in ${state.moves} moves.`;
    statusEl.classList.add("win");
    selectPiece(null);
    return true;
  }
  if (roundReady()) {
    runAnimalTurn();
  } else {
    autoSelect();
  }
  return true;
}

function cellOrigin(p) {
  return { x: p.x * CELL, y: p.y * CELL };
}

function cellFromPoint(px, py) {
  return { x: Math.floor(px / CELL), y: Math.floor(py / CELL) };
}

function draw() {
  const n = state.n;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#c0dcc0" : "#a9c7a9";
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      ctx.strokeStyle = "#333";
      ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  if (state.selected && !state.drag) {
    const origin = cellOrigin(state.pieces[state.selected]);
    ctx.strokeStyle = "#2a5db0";
    ctx.lineWidth = 3;
    ctx.strokeRect(origin.x + 1.5, origin.y + 1.5, CELL - 3, CELL - 3);
    ctx.lineWidth = 1;
  }
  for (const [name, pos] of Object.entries(state.pieces)) {
    if (state.drag && state.drag.name === name) continue;
    drawPiece(name, pos);
  }
  if (state.drag) {
    const { name, px, py } = state.drag;
    const img = images[name];
    ctx.drawImage(img, px - img.width / 2, py - img.height / 2);
  }
  ctx.fillStyle = "#222";
  ctx.font = "bold 14px Georgia, serif";
  ctx.fillText(`Moves: ${state.moves}`, 6, canvas.height - 8);
}

function drawPiece(name, pos) {
  const img = images[name];
  const origin = cellOrigin(pos);
  const cx = origin.x + CELL / 2;
  const cy = origin.y + CELL / 2;
  ctx.save();
  if (state.caught.has(name)) ctx.globalAlpha = 0.55;
  ctx.drawImage(img, cx - img.width / 2, cy - img.height / 2);
  ctx.restore();
}

function pointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    px: evt.clientX - rect.left,
    py: evt.clientY - rect.top,
  };
}

function hitTestHuman(px, py) {
  for (const human of state.mode.humans) {
    if (state.movedThisRound.has(human)) continue;
    const pos = state.pieces[human];
    const origin = cellOrigin(pos);
    if (px >= origin.x && px < origin.x + CELL && py >= origin.y && py < origin.y + CELL) {
      return human;
    }
  }
  return null;
}

canvas.addEventListener("pointerdown", (evt) => {
  if (state.finished) return;
  const { px, py } = pointerPos(evt);
  const name = hitTestHuman(px, py);
  if (!name) return;
  selectPiece(name);
  state.drag = { name, px, py, from: { ...state.pieces[name] } };
  canvas.classList.add("dragging");
  canvas.setPointerCapture(evt.pointerId);
  canvas.focus();
  draw();
});

canvas.addEventListener("keydown", (evt) => {
  const delta = ARROW_DELTA[evt.key];
  if (!delta || !state.selected) return;
  evt.preventDefault();
  const pos = state.pieces[state.selected];
  const dest = { x: pos.x + delta.x, y: pos.y + delta.y };
  tryMoveHuman(state.selected, dest);
  draw();
});

canvas.addEventListener("pointermove", (evt) => {
  if (!state.drag) return;
  const { px, py } = pointerPos(evt);
  state.drag.px = px;
  state.drag.py = py;
  draw();
});

canvas.addEventListener("pointerup", (evt) => {
  if (!state.drag) return;
  const { px, py } = pointerPos(evt);
  const dest = cellFromPoint(px, py);
  const { name } = state.drag;
  const moved = tryMoveHuman(name, dest);
  state.drag = null;
  canvas.classList.remove("dragging");
  draw();
});

canvas.addEventListener("pointercancel", () => {
  state.drag = null;
  canvas.classList.remove("dragging");
  draw();
});

function currentSelection() {
  const modeKey = document.querySelector('input[name="mode"]:checked').value;
  const n = parseInt(document.querySelector('input[name="size"]:checked').value, 10);
  return { modeKey, n };
}

for (const input of document.querySelectorAll('input[name="mode"], input[name="size"]')) {
  input.addEventListener("change", () => {
    const { modeKey, n } = currentSelection();
    newGame(modeKey, n);
  });
}

resetButton.addEventListener("click", () => {
  const { modeKey, n } = currentSelection();
  newGame(modeKey, n);
});

newGame("all", 8);
