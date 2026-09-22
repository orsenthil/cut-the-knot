"use strict";

/*
 * Browser port of chocolate.jar ("Breaking Chocolate Bars" by Alexander
 * Bogomolny, cut-the-knot.org). A rows x cols bar starts as one piece.
 * Clicking any internal grid line of a piece splits it there (ported from
 * chocosquare.IsHit in the decompiled chocosquare.java, which scans a
 * piece's internal lines for a hit). The bar is finished when every piece
 * is a single square; it always takes exactly rows*cols - 1 breaks.
 */

const CELL = 46;

const board = document.getElementById("board");
const rowsInput = document.getElementById("rowsInput");
const colsInput = document.getElementById("colsInput");
const resetBtn = document.getElementById("resetBtn");
const countSelect = document.getElementById("countSelect");
const counterEl = document.getElementById("counter");
const doneEl = document.getElementById("done");

let rows, cols;
let pieces;
let breaks;
let finished;

function isUnit(p) {
  return p.r1 === p.r2 && p.c1 === p.c2;
}

function newBar() {
  rows = Math.min(8, Math.max(1, parseInt(rowsInput.value, 10) || 4));
  cols = Math.min(8, Math.max(1, parseInt(colsInput.value, 10) || 5));
  rowsInput.value = rows;
  colsInput.value = cols;
  pieces = [{ r1: 0, c1: 0, r2: rows - 1, c2: cols - 1 }];
  breaks = 0;
  finished = rows === 1 && cols === 1;
  doneEl.textContent = "";
  render();
}

function breakPiece(index, orientation, at) {
  if (finished) return;
  const p = pieces[index];
  let a, b;
  if (orientation === "h") {
    a = { r1: p.r1, c1: p.c1, r2: at, c2: p.c2 };
    b = { r1: at + 1, c1: p.c1, r2: p.r2, c2: p.c2 };
  } else {
    a = { r1: p.r1, c1: p.c1, r2: p.r2, c2: at };
    b = { r1: p.r1, c1: at + 1, r2: p.r2, c2: p.c2 };
  }
  pieces.splice(index, 1, a, b);
  breaks++;
  if (pieces.every(isUnit)) {
    finished = true;
    const total = rows * cols;
    doneEl.textContent = `Finished in ${breaks} breaks — exactly ${total} × 1 − 1 = ${total - 1}, like every ${rows}×${cols} bar.`;
  }
  render();
}

function render() {
  board.style.width = cols * CELL + "px";
  board.style.height = rows * CELL + "px";
  board.innerHTML = "";

  pieces.forEach((p, idx) => {
    const w = (p.c2 - p.c1 + 1) * CELL;
    const h = (p.r2 - p.r1 + 1) * CELL;
    const piece = document.createElement("div");
    piece.className = "piece";
    piece.style.left = p.c1 * CELL + "px";
    piece.style.top = p.r1 * CELL + "px";
    piece.style.width = w + "px";
    piece.style.height = h + "px";
    piece.style.backgroundImage =
      `repeating-linear-gradient(to right, transparent 0 ${CELL - 1}px, rgba(0,0,0,0.55) ${CELL - 1}px ${CELL}px), ` +
      `repeating-linear-gradient(to bottom, transparent 0 ${CELL - 1}px, rgba(0,0,0,0.55) ${CELL - 1}px ${CELL}px)`;
    board.appendChild(piece);

    if (isUnit(p) || finished) return;

    const HIT = 16;
    for (let r = p.r1; r < p.r2; r++) {
      const seam = document.createElement("button");
      seam.type = "button";
      seam.className = "seam h";
      seam.style.left = p.c1 * CELL + "px";
      seam.style.top = (r + 1) * CELL - HIT / 2 + "px";
      seam.style.width = w + "px";
      seam.style.height = HIT + "px";
      seam.setAttribute("aria-label", "Break here");
      seam.addEventListener("click", () => breakPiece(idx, "h", r));
      board.appendChild(seam);
    }
    for (let c = p.c1; c < p.c2; c++) {
      const seam = document.createElement("button");
      seam.type = "button";
      seam.className = "seam v";
      seam.style.left = (c + 1) * CELL - HIT / 2 + "px";
      seam.style.top = p.r1 * CELL + "px";
      seam.style.width = HIT + "px";
      seam.style.height = h + "px";
      seam.setAttribute("aria-label", "Break here");
      seam.addEventListener("click", () => breakPiece(idx, "v", c));
      board.appendChild(seam);
    }
  });

  counterEl.hidden = countSelect.value !== "me";
  counterEl.textContent = `Breaks so far: ${breaks}`;
}

for (const input of [rowsInput, colsInput]) input.addEventListener("change", newBar);
resetBtn.addEventListener("click", newBar);
countSelect.addEventListener("change", render);

newBar();
