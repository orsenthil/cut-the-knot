"use strict";

/*
 * The page for ConditionalProbability: drawing and input only. All of the
 * probability arithmetic lives in conditional-probability-core.js. Two
 * rectangles on a grid of equally likely dots can have their corners dragged
 * or nudged with the arrow keys. The five numbers beside the board are the
 * five labels in the applet: P(A), P(B), P(A^B), P(A|B) and P(B|A).
 */

(function () {
  const Core = ConditionalProbabilityCore;
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const nxInput = document.getElementById("nxInput");
  const nyInput = document.getElementById("nyInput");
  const resetBtn = document.getElementById("resetBtn");

  // Board units. The grid of cells sits inside this rectangle; a cell's
  // width and height change with the two spinner values.
  const OX = 30, OY = 25, GW = 360, GH = 260;
  const toBoard = (p, nx, ny) => ({ x: OX + (p.x / nx) * GW, y: OY + (p.y / ny) * GH });
  const toGrid = (p, nx, ny) => ({ x: ((p.x - OX) / GW) * nx, y: ((p.y - OY) / GH) * ny });
  const val = (s) => Core.format(s).trim();

  let state = Core.start();
  let lastGrid = "";

  const board = Geom.board(document.getElementById("board"));
  const dotsLayer = board.layer("dots");
  const shapesLayer = board.layer("shapes");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const polyA = board.polygon([], "rect-a", shapesLayer);
  const polyB = board.polygon([], "rect-b", shapesLayer);
  const polyI = board.polygon([], "rect-i", shapesLayer);
  const labelA = board.label({ x: 0, y: 0 }, "A", "rect-label label-a", 0, 0, labelsLayer);
  const labelB = board.label({ x: 0, y: 0 }, "B", "rect-label label-b", 0, 0, labelsLayer);

  const handles = [];
  for (const which of ["a", "b"]) {
    for (let k = 0; k < 4; k++) {
      const name = which.toUpperCase() + k;
      handles.push({
        which, k, name,
        node: board.handle(name, { x: OX, y: OY }, {
          r: 9, step: 1,
          cls: "geom-handle " + (which === "a" ? "corner-a" : "corner-b"),
          label: `Rectangle ${which.toUpperCase()} corner ${k + 1}. Drag it, or focus it and use the arrow keys, to change the rectangle`,
          describe: (p) => {
            const g = toGrid(p, state.nx, state.ny);
            return `grid column ${Math.round(g.x)}, row ${Math.round(g.y)}`;
          },
          clamp: (p) => ({
            x: Math.max(OX, Math.min(OX + GW, p.x)),
            y: Math.max(OY, Math.min(OY + GH, p.y)),
          }),
          layer: handlesLayer,
          onMove: (p) => {
            state = Core.withCorner(state, which, k, toGrid(p, state.nx, state.ny));
            render();
          },
        }),
      });
    }
  }

  /** The shared status line. A demo has no win or loss, so no kind is used. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function drawDots(nx, ny) {
    board.clear(dotsLayer);
    const cw = GW / nx, ch = GH / ny;
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= ny; j++) {
        board.point({ x: OX + i * cw, y: OY + j * ch }, "dot", 1.3, dotsLayer);
      }
    }
    lastGrid = nx + "x" + ny;
  }

  function corners(r, nx, ny) {
    return [
      toBoard({ x: r.x, y: r.y }, nx, ny),
      toBoard({ x: r.x, y: r.y + r.h }, nx, ny),
      toBoard({ x: r.x + r.w, y: r.y + r.h }, nx, ny),
      toBoard({ x: r.x + r.w, y: r.y }, nx, ny),
    ];
  }

  function render() {
    const p = Core.compute(state);
    if (lastGrid !== state.nx + "x" + state.ny) drawDots(state.nx, state.ny);

    polyA.set(corners(p.a, p.nx, p.ny));
    polyB.set(corners(p.b, p.nx, p.ny));
    polyI.set(corners(p.i, p.nx, p.ny)).show(p.cells.i > 0);

    labelA.set(toBoard({ x: p.a.x + p.a.w / 2, y: p.a.y + p.a.h / 2 }, p.nx, p.ny), "A");
    labelB.set(toBoard({ x: p.b.x + p.b.w / 2, y: p.b.y + p.b.h / 2 }, p.nx, p.ny), "B");
    labelA.show(p.cells.a > 0);
    labelB.show(p.cells.b > 0);

    for (const h of handles) {
      const c = corners(state[h.which], state.nx, state.ny)[h.k];
      h.node.set(c);
    }

    document.getElementById("out-pa").textContent = val(p.pa);
    document.getElementById("out-pb").textContent = val(p.pb);
    document.getElementById("out-pi").textContent = val(p.pi);
    document.getElementById("out-pab").textContent = val(p.pab);
    document.getElementById("out-pba").textContent = val(p.pba);
    document.getElementById("cells").textContent =
      `${p.nx} × ${p.ny} = ${p.total} equally likely dots · A covers ${p.cells.a} cells, B covers ${p.cells.b}, the overlap ${p.cells.i}`;
    readoutEl.setAttribute("aria-label",
      `P(A) ${val(p.pa)}, P(B) ${val(p.pb)}, P(A and B) ${val(p.pi)}, P(A given B) ${val(p.pab)}, P(B given A) ${val(p.pba)}`);

    const ind = Core.independent(p);
    if (ind === null) {
      say("A or B covers no cells: the conditional probability with it as the condition is not defined (NaN).");
    } else if (ind) {
      say(`A and B are independent: P(A and B) = ${val(p.pi)} equals P(A) × P(B), and both conditional probabilities match.`);
    } else {
      say(`A and B depend on each other: P(A given B) = ${val(p.pab)} is not P(A) = ${val(p.pa)}.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function setGrid(nx, ny) {
    state = Core.withGrid(state, nx, ny);
    nxInput.value = String(state.nx);
    nyInput.value = String(state.ny);
    render();
  }

  nxInput.addEventListener("change", () => setGrid(nxInput.value, state.ny));
  nyInput.addEventListener("change", () => setGrid(state.nx, nyInput.value));
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    nxInput.value = String(state.nx);
    nyInput.value = String(state.ny);
    render();
  });

  // Geom's handles move one viewBox unit per arrow key. Here one press should
  // mean one grid cell (Shift: five), at any Nx/Ny, so the SVG captures the
  // key first and moves the core's integer coordinate itself.
  board.root.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    const hit = handles.find((h) => h.node.node === e.target);
    if (!step || !hit) return;
    e.preventDefault();
    e.stopPropagation();
    const jump = e.shiftKey ? 5 : 1;
    const g = toGrid(hit.node.point, state.nx, state.ny);
    state = Core.withCorner(state, hit.which, hit.k,
      { x: g.x + step[0] * jump, y: g.y + step[1] * jump });
    render();
    hit.node.node.focus();
  }, true);

  board.onTheme(render);
  render();
})();
