"use strict";

/*
 * The page for Universal Coloring: drawing and input only; the rules are in
 * universal-coloring-core.js. The play area is a ring of real buttons (one
 * per dot) that cycle colour when pressed. A second panel, shown with the
 * hint checkbox, is the applet's complete digraph drawn as a chart: row is
 * the colour you come from, column the colour you go to, and a filled cell
 * means that ordered pair occurs among successive dots.
 */

(function () {
  const Core = UniversalColoringCore;
  const wrap = document.getElementById("boardWrap");
  const board = document.getElementById("board");
  const arcsEl = document.getElementById("arcs");
  const hintNote = document.getElementById("hintNote");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn");
  const hintIn = document.getElementById("hintIn");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start();
  let show = "colors";
  let hint = false;
  let dotEls = [];
  let arcCells = [];

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function buildBoard() {
    const size = Math.max(300, Math.ceil(state.n * state.n * 21));
    const radius = size / 2 - 24;
    board.style.width = `${size}px`;
    board.style.height = `${size}px`;
    board.textContent = "";

    const ring = document.createElement("div");
    ring.className = "ring";
    ring.style.width = ring.style.height = `${2 * radius}px`;
    board.appendChild(ring);

    dotEls = [];
    const m = state.n * state.n;
    for (let i = 0; i < m; i++) {
      const angle = (2 * Math.PI * i) / m;
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dot";
      dot.dataset.i = String(i);
      dot.style.left = `${size / 2 + radius * Math.cos(angle)}px`;
      dot.style.top = `${size / 2 + radius * Math.sin(angle)}px`;
      board.appendChild(dot);
      dotEls.push(dot);
    }
    wrap.scrollLeft = 0;
  }

  function buildArcs() {
    const n = state.n;
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.gridTemplateColumns = `repeat(${n + 1}, minmax(0, 1fr))`;
    const corner = document.createElement("span");
    corner.className = "head";
    corner.setAttribute("aria-hidden", "true");
    grid.appendChild(corner);
    for (let b = 0; b < n; b++) {
      const h = document.createElement("span");
      h.className = "head";
      h.textContent = String.fromCharCode(65 + b);
      h.setAttribute("aria-hidden", "true");
      grid.appendChild(h);
    }
    arcCells = [];
    for (let a = 0; a < n; a++) {
      const rowHead = document.createElement("span");
      rowHead.className = "head";
      rowHead.textContent = String.fromCharCode(65 + a);
      rowHead.setAttribute("aria-hidden", "true");
      grid.appendChild(rowHead);
      const row = [];
      for (let b = 0; b < n; b++) {
        const cell = document.createElement("span");
        cell.className = "arc";
        cell.textContent = "\u25cb";
        cell.setAttribute("aria-hidden", "true");
        grid.appendChild(cell);
        row.push(cell);
      }
      arcCells.push(row);
    }
    arcsEl.replaceChildren(grid);
  }

  function render() {
    const n = state.n;
    if (dotEls.length !== n * n) { buildBoard(); buildArcs(); }

    dotEls.forEach((dot, i) => {
      const c = state.dots[i];
      dot.dataset.c = String(c);
      dot.className = `dot c${c}${show === "digits" ? " digits-only" : ""}`;
      dot.textContent = show === "colors" ? "" : String(c);
      dot.setAttribute("aria-label", `Dot ${i + 1} of ${n * n}, colour ${c + 1} of ${n}. Press to change its colour.`);
    });

    const lit = Core.edges(state);
    arcCells.forEach((row, a) => row.forEach((cell, b) => {
      cell.className = lit[a][b] ? "arc on" : "arc";
      cell.textContent = lit[a][b] ? "\u25cf" : "\u25cb";
    }));
    arcsEl.hidden = !hint;
    hintNote.hidden = !hint;
    arcsEl.setAttribute("aria-label", `Pair chart: ordered colour pairs you have made`);
    nIn.value = String(n);

    const info = Core.check(state);
    if (info.complete) {
      say(`All ${info.total} pairs are on the circle. Go either way round and you meet every pair of colours!`, "done");
    } else if (state.clicks === 0) {
      say(`All ${n * n} dots start as colour 1. Click a dot to change it.`);
    } else {
      say(`${info.found} of the ${info.total} ordered pairs so far. ${info.total - info.found} more to make.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function play(m) {
    const next = Core.move(state, m);
    if (!next) return; // not allowed: no dot was pressed
    state = next;
    render();
  }

  function newGame() {
    state = Core.start({ n: state.n });
    render();
  }

  board.addEventListener("click", (e) => {
    const dot = e.target.closest("button.dot");
    if (dot) play(Number(dot.dataset.i));
  });
  board.addEventListener("keydown", (e) => {
    const dot = e.target.closest && e.target.closest("button.dot");
    if (!dot) return;
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const m = state.n * state.n;
    dotEls[(Number(dot.dataset.i) + d + m) % m].focus();
  });

  nIn.addEventListener("change", () => { state = Core.setN(state, nIn.value); render(); });
  hintIn.addEventListener("change", () => { hint = hintIn.checked; render(); });
  document.querySelectorAll('input[name="show"]').forEach((input) => {
    input.addEventListener("change", () => { if (input.checked) { show = input.value; render(); } });
  });
  newBtn.addEventListener("click", newGame);

  render();
})();
