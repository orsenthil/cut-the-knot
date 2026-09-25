"use strict";

/*
 * The Eye Opener (99 = 100): drag the upper part of a staircase-cut
 * (n-1) x (n+1) rectangle one square right and one step up, and it seems to
 * fill an n x n square. Geometry and the hidden stretch live in
 * eye-opener-core.js; this file draws the board as SVG in grid units, handles
 * dragging and keys, and runs the three pairs of eyes from the original
 * applet, which follow the pointer and pop wide open when the piece fits.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const board = document.getElementById("board");
const statusEl = document.getElementById("status");
const nValue = document.getElementById("nValue");
const lessBtn = document.getElementById("lessBtn");
const moreBtn = document.getElementById("moreBtn");
const resetBtn = document.getElementById("resetBtn");
const revealBtn = document.getElementById("revealBtn");
const eyesEl = document.getElementById("eyes");

let n = 10;
let dx = 0;
let dy = 0;
let fitted = false;
let revealed = false;
let drag = null; // { x, y, dx, dy } at the start of a drag

function svg(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  return node;
}

function points(pts) {
  return pts.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(" ");
}

// ---- drawing ----

let layers = null;

function buildBoard() {
  board.innerHTML = "";
  // room around the pieces for dragging: a square left/right, more above
  const pad = 1.2;
  board.setAttribute("viewBox", `${-pad} ${-1.8} ${n + 1 + 2 * pad} ${n - 1 + 1.8 + 0.7}`);
  layers = {
    lower: svg("polygon", { class: "piece lower" }),
    upper: svg("polygon", { class: "piece upper" }),
    strip: svg("rect", { class: "strip" }),
    grids: svg("g", { class: "grid" }),
  };
  layers.lower.setAttribute("points", points(EyeOpener.lowerPolygon(n)));
  board.append(layers.lower, layers.upper, layers.strip, layers.grids);

  // Both grids are always drawn, exactly as in the applet: the rectangle's
  // (n+1) x (n-1) grid and the target square's n x n grid.
  const grid = (x0, y0, cols, rows) => {
    const g = svg("g");
    g.appendChild(svg("rect", { x: x0, y: y0, width: cols, height: rows }));
    for (let i = 1; i < cols; i++) g.appendChild(svg("line", { x1: x0 + i, y1: y0, x2: x0 + i, y2: y0 + rows }));
    for (let i = 1; i < rows; i++) g.appendChild(svg("line", { x1: x0, y1: y0 + i, x2: x0 + cols, y2: y0 + i }));
    return g;
  };
  layers.grids.append(grid(0, 0, n + 1, n - 1), grid(1, -1, n, n));
}

function render() {
  const c = EyeOpener.cheat(n, dy);
  layers.upper.setAttribute("points", points(EyeOpener.upperPolygon(n, dx, dy, c)));

  // The stretch the applet hides: a strip n squares wide and c tall.
  const showStrip = revealed && c > 0;
  layers.strip.setAttribute("x", dx);
  layers.strip.setAttribute("y", dy - c);
  layers.strip.setAttribute("width", n);
  layers.strip.setAttribute("height", c);
  layers.strip.style.display = showStrip ? "" : "none";

  board.classList.toggle("fitted", fitted);
  eyesEl.classList.toggle("wide", fitted);
  nValue.textContent = n;
  lessBtn.disabled = n <= EyeOpener.MIN_N;
  moreBtn.disabled = n >= EyeOpener.MAX_N;
  revealBtn.setAttribute("aria-pressed", String(revealed));
  renderStatus(c);
}

function renderStatus(c) {
  const rect = `${n - 1} × ${n + 1} = ${n * n - 1}`;
  const square = `${n} × ${n} = ${n * n}`;
  statusEl.className = "";
  if (revealed && c > 0) {
    statusEl.innerHTML =
      `Caught it! While you lift the piece, its top edge quietly grows by <strong>1/${n}</strong> of a square. ` +
      `That strip is ${n} squares long, so it adds ${n} × 1/${n} = <strong>1 whole square</strong>.`;
  } else if (revealed) {
    statusEl.textContent = "Lift the top piece up and watch its top edge closely.";
  } else if (fitted) {
    statusEl.className = "win";
    statusEl.textContent = `It fits: a ${square} square. But we started with ${rect} squares. So ${n * n - 1} = ${n * n}?!`;
  } else {
    statusEl.textContent = `The whole shape is ${rect} squares.`;
  }
}

// ---- moving the piece ----

function moveTo(ndx, ndy) {
  const s = EyeOpener.snap(n, clamp(ndx, -1, 2), clamp(ndy, -1.6, 0.5));
  dx = s.dx;
  dy = s.dy;
  fitted = s.fitted;
  render();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function toUnits(evt) {
  const pt = new DOMPoint(evt.clientX, evt.clientY).matrixTransform(board.getScreenCTM().inverse());
  return { x: pt.x, y: pt.y };
}

board.addEventListener("pointerdown", (evt) => {
  const p = toUnits(evt);
  drag = { x: p.x, y: p.y, dx, dy };
  try {
    board.setPointerCapture(evt.pointerId);
  } catch (e) {
    // capture is a nicety; dragging still works without it
  }
  board.classList.add("dragging");
  evt.preventDefault();
});

board.addEventListener("pointermove", (evt) => {
  if (!drag) return;
  const p = toUnits(evt);
  moveTo(drag.dx + p.x - drag.x, drag.dy + p.y - drag.y);
});

function endDrag() {
  drag = null;
  board.classList.remove("dragging");
}
board.addEventListener("pointerup", endDrag);
board.addEventListener("pointercancel", endDrag);

board.addEventListener("keydown", (evt) => {
  const stepSize = evt.shiftKey ? 1 : 0.1;
  const moves = { ArrowLeft: [-stepSize, 0], ArrowRight: [stepSize, 0], ArrowUp: [0, -stepSize], ArrowDown: [0, stepSize] };
  const m = moves[evt.key];
  if (!m) return;
  evt.preventDefault();
  moveTo(dx + m[0], dy + m[1]);
});

// ---- controls ----

function newGame(newN) {
  n = EyeOpener.clampN(newN);
  dx = 0;
  dy = 0;
  fitted = false;
  buildBoard();
  render();
}

lessBtn.addEventListener("click", () => newGame(n - 1));
moreBtn.addEventListener("click", () => newGame(n + 1));
resetBtn.addEventListener("click", () => newGame(n));
revealBtn.addEventListener("click", () => {
  revealed = !revealed;
  render();
});

// ---- the eyes ----

const eyes = [];

// Three pairs, like the applet: small on the left, big in the middle, small on the right.
function buildEyes() {
  for (const size of ["small", "big", "small"]) {
    const pair = document.createElement("div");
    pair.className = "pair " + size;
    for (let i = 0; i < 2; i++) {
      const eye = svg("svg", { viewBox: "-10 -10 20 20", class: "eye", "aria-hidden": "true" });
      eye.append(
        svg("circle", { class: "white", r: 9 }),
        svg("circle", { class: "iris", r: 4.2 }),
        svg("circle", { class: "pupil", r: 2 }),
        svg("path", { class: "lid", d: "M -9 0 A 9 9 0 0 1 9 0 Z" }),
        svg("circle", { class: "rim", r: 9 })
      );
      pair.appendChild(eye);
      eyes.push(eye);
    }
    eyesEl.appendChild(pair);
  }
}

// Irises look toward the pointer, staying inside the eye.
function look(evt) {
  for (const eye of eyes) {
    const r = eye.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const ang = Math.atan2(evt.clientY - ey, evt.clientX - ex);
    const dist = Math.min(4.8, Math.hypot(evt.clientX - ex, evt.clientY - ey) / 12);
    const x = (Math.cos(ang) * dist).toFixed(2);
    const y = (Math.sin(ang) * dist).toFixed(2);
    for (const part of eye.querySelectorAll(".iris, .pupil")) part.setAttribute("transform", `translate(${x} ${y})`);
  }
}
document.addEventListener("pointermove", look);

buildEyes();
newGame(10);
