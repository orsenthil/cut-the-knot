"use strict";

/*
 * Browser port of FlipThem.jar ("Flipping Items Simultaneously" by
 * Alexander Bogomolny, cut-the-knot.org). N triangles start pointing up;
 * clicking any M of them (one click at a time) flips all M at once. Goal:
 * get every triangle pointing down. Ported from the decompiled
 * FlipThemCanvas.java: a triangle toggles "selected" on click, and the
 * moment the selection count reaches M, every selected triangle flips and
 * the selection clears.
 */

const board = document.getElementById("board");
const statusEl = document.getElementById("status");
const nInput = document.getElementById("nInput");
const mInput = document.getElementById("mInput");
const resetButton = document.getElementById("reset");

let state = null;

function clampInputs() {
  let n = parseInt(nInput.value, 10);
  let m = parseInt(mInput.value, 10);
  if (Number.isNaN(n)) n = 7;
  if (Number.isNaN(m)) m = 4;
  n = Math.min(20, Math.max(4, n));
  m = Math.min(n - 1, Math.max(2, m));
  nInput.value = n;
  mInput.value = m;
  return { n, m };
}

function newGame() {
  const { n, m } = clampInputs();
  state = {
    n,
    m,
    up: new Array(n).fill(true),
    selected: new Array(n).fill(false),
    moves: 0,
    finished: false,
  };
  statusEl.textContent = "";
  statusEl.classList.remove("win");
  render();
}

function toggle(i) {
  if (state.finished) return;
  state.selected[i] = !state.selected[i];
  const count = state.selected.filter(Boolean).length;
  if (count === state.m) {
    for (let j = 0; j < state.n; j++) {
      if (state.selected[j]) {
        state.up[j] = !state.up[j];
        state.selected[j] = false;
      }
    }
    state.moves++;
  }
  checkWin();
  render();
}

function checkWin() {
  if (state.up.every((v) => !v)) {
    state.finished = true;
    statusEl.textContent = `All flipped in ${state.moves} move${state.moves === 1 ? "" : "s"}!`;
    statusEl.classList.add("win");
  }
}

function render() {
  board.innerHTML = "";
  for (let i = 0; i < state.n; i++) {
    const tri = document.createElement("div");
    tri.className = "tri" + (state.up[i] ? "" : " down") + (state.selected[i] ? " selected" : "");
    tri.tabIndex = 0;
    tri.setAttribute("role", "button");
    tri.setAttribute(
      "aria-label",
      `Triangle ${i + 1}, pointing ${state.up[i] ? "up" : "down"}${state.selected[i] ? ", selected" : ""}`
    );
    const shape = document.createElement("div");
    shape.className = "shape";
    tri.appendChild(shape);
    tri.addEventListener("click", () => toggle(i));
    tri.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        toggle(i);
      }
    });
    board.appendChild(tri);
  }
}

for (const input of [nInput, mInput]) {
  input.addEventListener("change", newGame);
}
resetButton.addEventListener("click", newGame);

newGame();
