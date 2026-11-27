"use strict";

/*
 * The page for Frieze: drawing and input only. The arithmetic lives in
 * frieze-core.js. The stage holds a staggered SVG lattice: every dot is a
 * focusable handle, a click on its right half adds one and a click on its left
 * half subtracts one, and Compute fills the remaining diamonds. The board is
 * rebuilt only when the row count changes, so focus survives a normal move.
 */

(function () {
  const Core = FriezeCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const rowsInput = document.getElementById("rowsInput");
  const moduloInput = document.getElementById("moduloInput");
  const simpleBox = document.getElementById("simpleBox");
  const undoBtn = document.getElementById("undoBtn");
  const computeBtn = document.getElementById("computeBtn");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start({});
  let focusAt = { i: 0, j: 0 };
  let lastChanged = null;
  let nodes = [];              // { i, j, handle, label, halo }
  const byCell = new Map();

  // Paint order: guides, highlights, dots, then digits on top of the dots.
  const grid = board.layer("grid");
  const dots = board.layer("dots");
  const handlesLayer = board.layer("handles");
  const digitsLayer = board.layer("digits");

  const CELL = 14;             // one half-column step, in board units
  const MARGIN = 14;

  /** Java's Rect placement: rows step CELL, odd rows shift half a step. */
  function center(i, j) {
    return {
      x: MARGIN + 2 * j * CELL + (i % 2 === 1 ? CELL : 0) + CELL / 2,
      y: MARGIN + i * CELL + CELL / 2,
    };
  }

  function layout() {
    const w = 2 * CELL * state.n + 2 * MARGIN;
    const h = CELL * state.n + 2 * MARGIN;
    board.root.setAttribute("viewBox", `0 0 ${w} ${h}`);
    board.root.style.setProperty("--rows", String(state.n));
  }

  /** The line under the game. A frieze is an illustration: no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function describe(i, j, value) {
    return `Row ${i + 1}, dot ${j + 1}: ${value}. ` +
      `Press the left half or Left arrow to subtract, the right half or Right arrow to add. ` +
      `Up and Down arrows move to another row.`;
  }

  function build() {
    layout();
    board.clear(grid);
    board.clear(dots);
    board.clear(digitsLayer);
    board.clear(handlesLayer);
    nodes = [];
    byCell.clear();

    // The pale diamonds make the four-number rule visible.
    for (let i = 0; i < state.n - 1; i++) {
      for (let j = 0; j < Math.min(Core.rowLength(state.n, i), Core.rowLength(state.n, i + 1)); j++) {
        const a = center(i, j), b = center(i + 1, j);
        board.segment(a, b, "lattice-line", grid);
        if (j + 1 < Core.rowLength(state.n, i)) board.segment(a, center(i + 1, j + 1), "lattice-line", grid);
      }
    }

    for (let i = 0; i < state.n; i++) {
      for (let j = 0; j < Core.rowLength(state.n, i); j++) {
        const p = center(i, j);
        const halo = board.circle(p, CELL * 0.78, "just-changed", dots);
        halo.show(false);
        const label = board.label(p, "", "digit", 0, CELL * 0.3, digitsLayer);
        const name = `d${i}_${j}`;
        const handle = board.handle(name, p, {
          r: CELL * 0.68, step: 0, shift: 0, cls: "dot-handle", layer: handlesLayer,
          label: describe(i, j, state.rows[i][j]),
          clamp: () => p,
          onMove: () => {},
        });
        handle.node.setAttribute("data-cell", `${i},${j}`);
        handle.node.addEventListener("keydown", (e) => keyOnDot(e, i, j), true);
        const cell = { i: i, j: j, handle: handle, label: label, halo: halo, point: p };
        nodes.push(cell);
        byCell.set(`${i},${j}`, cell);
      }
    }
  }

  function keyOnDot(e, i, j) {
    const key = e.key;
    if (key === "ArrowLeft" || key === "-" || key === "_") {
      e.preventDefault(); e.stopImmediatePropagation();
      change(i, j, false);
    } else if (key === "ArrowRight" || key === "+" || key === "=" || key === "Enter" || key === " ") {
      e.preventDefault(); e.stopImmediatePropagation();
      change(i, j, true);
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault(); e.stopImmediatePropagation();
      const ni = Math.max(0, Math.min(state.n - 1, i + (key === "ArrowDown" ? 1 : -1)));
      const nj = Math.min(j, Core.rowLength(state.n, ni) - 1);
      focusAt = { i: ni, j: nj };
      const cell = byCell.get(`${ni},${nj}`);
      if (cell) cell.handle.node.focus();
      render();
    }
  }

  function change(i, j, right) {
    focusAt = { i: i, j: j };
    lastChanged = { i: i, j: j };
    state = Core.click(state, i, j, right);
    render();
  }

  handlesLayer.addEventListener("pointerdown", (e) => {
    const node = e.target.closest && e.target.closest(".dot-handle");
    if (!node) return;
    const cell = nodes.find((x) => x.handle.node === node);
    if (!cell) return;
    e.preventDefault();
    const local = board.toLocal(e.clientX, e.clientY);
    change(cell.i, cell.j, local.x >= cell.point.x);
  });

  function render() {
    for (const cell of nodes) {
      const value = state.rows[cell.i][cell.j];
      const color = Core.colorIndex(value, state.modulo);
      cell.handle.node.setAttribute("class", "dot-handle c" + color);
      cell.handle.node.setAttribute("aria-label", describe(cell.i, cell.j, value));
      cell.handle.set(cell.point);
      cell.label.set(cell.point, state.digits ? String(color) : "");
      cell.halo.show(!!lastChanged && lastChanged.i === cell.i && lastChanged.j === cell.j);
    }
    rowsInput.value = String(state.n);
    moduloInput.value = String(state.modulo);
    simpleBox.checked = state.simple;
    undoBtn.disabled = state.stack.length === 0;

    let filled = 0;
    for (let i = 1; i < state.n - 1; i++) filled += Math.max(0, state.processed[i] - 1);
    const rule = state.op === Core.ADD
      ? (state.simple ? "left + right - middle" : "left + right - middle + 1")
      : (state.simple ? "left × right ÷ middle" : "(left × right + 1) ÷ middle");
    say(`${state.n} rows · modulo ${state.modulo} · ${rule} · ${filled} filled · ${state.stack.length} to undo` +
      (state.done ? " · pattern complete" : ""));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function rebuild() {
    const keep = byCell.get(`${focusAt.i},${focusAt.j}`);
    const hadFocus = !!keep && document.activeElement === keep.handle.node;
    build();
    if (hadFocus) {
      const again = byCell.get(`${focusAt.i},${focusAt.j}`);
      if (again) again.handle.node.focus();
    }
    render();
  }

  function setRows(value) {
    const next = Core.setRows(state, value);
    if (next === state) { render(); return; }
    state = next;
    focusAt = { i: Math.min(focusAt.i, state.n - 1), j: 0 };
    lastChanged = null;
    rebuild();
  }

  function setModulo(value) {
    const next = Core.setModulo(state, value);
    if (next !== state) { state = next; render(); }
    else render();
  }

  function setOp(op) {
    state = Core.setOp(state, op);
    lastChanged = null;
    document.querySelectorAll("[data-op]").forEach((b) => {
      b.setAttribute("aria-pressed", String(Number(b.dataset.op) === state.op));
    });
    render();
  }

  document.querySelectorAll("[data-op]").forEach((btn) => {
    btn.addEventListener("click", () => setOp(Number(btn.dataset.op)));
  });
  document.querySelectorAll("[data-rows-step]").forEach((btn) => {
    btn.addEventListener("click", () => setRows(state.n + Number(btn.dataset.rowsStep)));
  });
  document.querySelectorAll("[data-mod-step]").forEach((btn) => {
    btn.addEventListener("click", () => setModulo(state.modulo + Number(btn.dataset.modStep)));
  });
  rowsInput.addEventListener("change", () => setRows(Number(rowsInput.value)));
  moduloInput.addEventListener("change", () => setModulo(Number(moduloInput.value)));
  simpleBox.addEventListener("change", () => { state = Core.setSimple(state, simpleBox.checked); render(); });
  document.querySelectorAll("[data-digits]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state = Core.setDigits(state, input.value === "numbers");
      render();
    });
  });
  undoBtn.addEventListener("click", () => { state = Core.undo(state); render(); });
  computeBtn.addEventListener("click", () => { state = Core.compute(state); render(); });
  newBtn.addEventListener("click", () => {
    state = Core.start({ rows: state.n, modulo: state.modulo, op: state.op, simple: state.simple, digits: state.digits });
    lastChanged = null;
    render();
  });

  board.onTheme(render);
  build();
  render();
})();
