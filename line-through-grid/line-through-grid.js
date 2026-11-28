"use strict";

/*
 * The page for Line Through Grid: drawing and input only. The rules and the
 * crossed-square formula live in line-through-grid-core.js. An SVG holds the
 * M-by-N grid, the diagonal and one shaded cell for each square the diagonal
 * crosses. Two number boxes set M and N (the applet's 1..50 spinners); the
 * arrow keys on a focused number box step one at a time. A row of preset
 * buttons opens the small rectangles the page suggests, including the cases
 * where the diagonal goes through lattice points. No win and no loss: it is
 * an illustration, and each setting is reported on the status line.
 */

(function () {
  const Core = LineThroughGridCore;
  const Geom = window.Geom;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const mInput = document.getElementById("mInput");
  const nInput = document.getElementById("nInput");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start({ M: Number(mInput.value), N: Number(nInput.value) });
  let cellsKey = "";
  let cellShapes = [];
  let gridShapes = [];

  /* Paint order: shaded cells, grid lines, diagonal, corners, labels, handles. */
  const cellsLayer = board.layer("cells");
  const gridLayer = board.layer("grid");
  const diagonalLayer = board.layer("diagonal");
  const cornersLayer = board.layer("corners");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const WIDTH = 360, HEIGHT = 240, PAD = 22;
  const diagonal = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "diagonal", diagonalLayer);
  const cornerA = board.point({ x: 0, y: 0 }, "corner", 3, cornersLayer);
  const cornerB = board.point({ x: 1, y: 1 }, "corner", 3, cornersLayer);
  const sizeLabel = board.label({ x: WIDTH / 2, y: HEIGHT - 5 }, "", "size-label", 0, 0, labelsLayer);

  /** The board rectangle, the same centring as the applet's Reset method. */
  function frame() {
    const usableW = WIDTH - 2 * PAD, usableH = HEIGHT - 2 * PAD - 8;
    const step = Math.min(usableW / state.N, usableH / state.M);
    const w = step * state.N, h = step * state.M;
    const x = (WIDTH - w) / 2, y = (HEIGHT - 8 - h) / 2 + 2;
    return { x, y, w, h, step };
  }

  const cornerPoint = (f, col, row) => ({ x: f.x + col * f.step, y: f.y + row * f.step });

  /**
   * Report the count on the shared status line. "done" tells the player's
   * record that a setting has been explored; this illustration has no win or
   * loss, so the text is just a report.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Rebuild only when the grid changes; handles keep their DOM nodes. */
  function ensureShapes() {
    const key = state.M + ":" + state.N;
    if (key === cellsKey) return;
    cellsKey = key;
    board.clear(cellsLayer);
    board.clear(gridLayer);
    cellShapes = [];
    gridShapes = [];
    const f = frame();
    for (const cell of Core.crossedCells(state)) {
      cellShapes.push(board.polygon([
        cornerPoint(f, cell.column, cell.row),
        cornerPoint(f, cell.column + 1, cell.row),
        cornerPoint(f, cell.column + 1, cell.row + 1),
        cornerPoint(f, cell.column, cell.row + 1),
      ], "crossed-cell", cellsLayer));
    }
    for (let i = 1; i < state.N; i++) {
      const p = cornerPoint(f, i, 0), q = cornerPoint(f, i, state.M);
      gridShapes.push(board.segment(p, q, "grid-line", gridLayer));
    }
    for (let j = 1; j < state.M; j++) {
      const p = cornerPoint(f, 0, j), q = cornerPoint(f, state.N, j);
      gridShapes.push(board.segment(p, q, "grid-line", gridLayer));
    }
    board.el("rect", { x: f.x, y: f.y, width: f.w, height: f.h }, "grid-frame", gridLayer);
  }

  function render() {
    ensureShapes();
    const f = frame();
    diagonal.set(cornerPoint(f, 0, 0), cornerPoint(f, state.N, state.M));
    cornerA.set(cornerPoint(f, 0, 0));
    cornerB.set(cornerPoint(f, state.N, state.M));
    sizeLabel.set({ x: WIDTH / 2, y: HEIGHT - 3 }, `${state.M} × ${state.N}`);
    mInput.value = String(state.M);
    nInput.value = String(state.N);

    const n = Core.crossed(state);
    const g = Core.gcd(state.M, state.N);
    const nodes = Core.interiorNodes(state);
    const extra = nodes === 0
      ? "The diagonal misses the inside corner points, so the simple rule works."
      : `It passes through ${nodes} inside corner point${nodes === 1 ? "" : "s"}, so ${nodes} square${nodes === 1 ? " drops" : "s drop"} out.`;
    say(`${state.M} by ${state.N}: the diagonal crosses ${n} squares. ${extra}`, "done");

    placeHandles();
    if (window.Track) window.Track.state(Core.position(state));
  }

  function setSize(which, value) {
    const next = Core.move(state, { type: which, value });
    if (!next) return;
    state = next;
    render();
  }

  mInput.addEventListener("change", () => setSize("M", Number(mInput.value)));
  nInput.addEventListener("change", () => setSize("N", Number(nInput.value)));
  mInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); setSize("M", state.M + (e.key === "ArrowUp" ? 1 : -1)); }
  });
  nInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); setSize("N", state.N + (e.key === "ArrowUp" ? 1 : -1)); }
  });

  /* Presets mirror the small rectangles in the page's solution. */
  const examples = [
    [2, 3], [2, 5], [3, 5], [2, 4], [3, 6], [4, 6], [6, 11], [50, 50],
  ];
  const presetLayer = document.getElementById("presets");
  for (const [M, N] of examples) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${M} × ${N}`;
    btn.setAttribute("aria-label", `Show a ${M} by ${N} rectangle`);
    btn.addEventListener("click", () => { setSize("M", M); setSize("N", N); });
    presetLayer.appendChild(btn);
  }

  /* Handles on the left and bottom edge let a player drag either size. */
  const dragFrom = { M: null, N: null };
  const sizeM = board.handle("M", { x: 0, y: 0 }, {
    r: 9, step: 1, cls: "geom-handle m-handle", layer: handlesLayer,
    label: "Rows M. Drag up to add rows, or focus and use the arrow keys.",
    describe: () => `currently ${state.M} rows`,
    onMove: (p) => {
      const base = dragFrom.M;
      if (!base) return;
      setSize("M", base.size + Math.round((base.y - p.y) / Math.max(1, base.step)));
    },
  });
  const sizeN = board.handle("N", { x: 0, y: 0 }, {
    r: 9, step: 1, cls: "geom-handle n-handle", layer: handlesLayer,
    label: "Columns N. Drag right to add columns, or focus and use the arrow keys.",
    describe: () => `currently ${state.N} columns`,
    onMove: (p) => {
      const base = dragFrom.N;
      if (!base) return;
      setSize("N", base.size + Math.round((p.x - base.x) / Math.max(1, base.step)));
    },
  });

  // A drag starts from the current size and the handle's position; keyboard
  // arrows change the matching size directly and keep focus on the handle.
  for (const [handle, which] of [[sizeM, "M"], [sizeN, "N"]]) {
    handle.node.addEventListener("pointerdown", () => {
      const f = frame(), pos = handle.point;
      dragFrom[which] = {
        size: state[which], step: f.step,
        x: pos.x, y: pos.y,
      };
    });
    handle.node.addEventListener("keydown", (e) => {
      const up = e.key === "ArrowUp" || e.key === "ArrowRight";
      const down = e.key === "ArrowDown" || e.key === "ArrowLeft";
      if (!up && !down) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dragFrom[which] = null;
      setSize(which, state[which] + (up ? 1 : -1));
      handle.node.focus();
    }, true);
  }

  function placeHandles() {
    const f = frame();
    sizeM.set({ x: f.x - 8, y: f.y + f.h * 0.25 });
    sizeN.set({ x: f.x + f.w * 0.75, y: f.y + f.h + 8 });
  }

  document.getElementById("board").addEventListener("pointerup", () => { dragFrom.M = null; dragFrom.N = null; });
  document.getElementById("board").addEventListener("pointercancel", () => { dragFrom.M = null; dragFrom.N = null; });

  newBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
  });

  /* The SVG has no colours of its own; a theme flip only needs a redraw. */
  board.onTheme(() => render());
  render();
})();
