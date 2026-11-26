"use strict";

/*
 * The page for Carpet With a Hole: drawing and input only; all the geometry is
 * in carpet-with-hole-core.js. The SVG shows the two staircase pieces of the
 * cut carpet, the cell grid, the hole and (once a piece slides) the square.
 * A Geom point handle on each piece is the drag/arrow-key proxy for the
 * applet's whole-polygon mover: moving a handle slides that whole piece, and
 * the core snaps it into place when it reaches the square-forming offset.
 */

(function () {
  const Core = CarpetWithHoleCore;
  const board = Geom.board("board");
  const statusEl = document.getElementById("status");
  const gridBox = document.getElementById("gridBox");
  const resetBtn = document.getElementById("resetBtn");
  const nxButtons = Array.from(document.querySelectorAll(".nxBtn"));

  const gridLayer = board.layer("grid");
  const shapeLayer = board.layer("shapes");
  const outlineLayer = board.layer("outlines");
  const marks = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start();
  let g = Core.compute(state);

  /** #status tells the player's record when an illustration has been explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Make the largest pool of grid lines once; each redraw shows only what N needs.
  const maxGrid = 3 * Math.max.apply(null, Core.NX_OPTIONS) - 9;
  const grid = [];
  const origin = { x: 0, y: 0 };
  for (let i = 0; i < maxGrid; i++) grid.push(board.segment(origin, origin, "grid-line", gridLayer));

  const pieces = [
    board.polygon(g.p1, "piece piece-left", shapeLayer),
    board.polygon(g.p2, "piece piece-right", shapeLayer),
  ];
  const carpetRect = board.el("rect", null, "carpet-outline", outlineLayer);
  const holeRect = board.el("rect", null, "hole-outline", outlineLayer);
  const squareRect = board.el("rect", null, "square-outline", outlineLayer);
  const cornerDots = ["L", "R"].map(() => board.point(g.p1[0], "corner-dot", 3.5, marks));
  const pieceLabels = [
    board.label(g.p1[0], "piece A", "piece-label", 0, 0, labelLayer),
    board.label(g.p2[0], "piece B", "piece-label", 0, 0, labelLayer),
  ];

  const handleOpts = (name) => ({
    r: 11, step: 3, shift: 15, layer: handleLayer,
    cls: "geom-handle piece-handle " + (name === "L" ? "handle-left" : "handle-right"),
    label: name === "L"
      ? "Piece A. Drag it, or focus it and use the arrow keys, to slide this piece into the square"
      : "Piece B. Drag it, or focus it and use the arrow keys, to slide this piece into the square",
    describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) +
      (g.assembled ? ". The square is made." : ". Not in place yet."),
    clamp: (q) => ({
      x: Core.clamp(q.x, 6, state.width - 6),
      y: Core.clamp(q.y, 6, state.height - 6),
    }),
  });
  const handles = {
    L: board.handle("L", g.p1[0], Object.assign({}, handleOpts("L"), {
      onMove: (p) => apply({ type: "drag", name: "L", point: p }),
    })),
    R: board.handle("R", g.p2[0], Object.assign({}, handleOpts("R"), {
      onMove: (p) => apply({ type: "drag", name: "R", point: p }),
    })),
  };

  function anchor(name) {
    return name === "L"
      ? { x: g.mx + state.shiftL.x, y: g.my + state.shiftL.y }
      : { x: g.mx + 2 * g.a + state.shiftR.x, y: g.my + state.shiftR.y };
  }

  function draw() {
    const visible = !g.whole;
    for (let i = 0; i < 2; i++) {
      pieces[i].set(i === 0 ? g.p1 : g.p2).show(visible);
      const at = i === 0 ? anchor("L") : anchor("R");
      const mid = { x: at.x + 1.5 * g.a, y: at.y + (i === 0 ? 0.5 : 2.5) * g.a };
      pieceLabels[i].set(mid).show(visible);
      cornerDots[i].set(at).show(visible);
    }

    for (let i = 0; i < maxGrid; i++) {
      const part = g.grid[i];
      grid[i].show(state.showGrid && !g.assembled && !!part);
      if (part) grid[i].set(part[0], part[1]);
    }

    const setRect = (node, r) => {
      node.setAttribute("x", r.x); node.setAttribute("y", r.y);
      node.setAttribute("width", r.w); node.setAttribute("height", r.h);
    };
    setRect(carpetRect, g.rect);
    carpetRect.style.display = g.whole ? "" : "none";
    setRect(holeRect, g.hole);
    holeRect.style.display = state.showGrid && !g.assembled ? "" : "none";
    setRect(squareRect, g.square);
    squareRect.style.display = g.assembled ? "" : "none";

    handles.L.set(anchor("L"));
    handles.R.set(anchor("R"));
  }

  /** Redraw, speak the picture and save the position for the record and tutor. */
  function render() {
    g = Core.compute(state);
    draw();
    say(Core.describe(state), state.explored ? "done" : null);
    nxButtons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.nx) === state.nx)));
    gridBox.checked = state.showGrid;
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; a refused one leaves the picture as it was. */
  function apply(m) {
    const next = Core.move(state, m);
    if (next) state = next;
    render();
    return !!next;
  }

  nxButtons.forEach((b) => b.addEventListener("click", () =>
    apply({ type: "nx", value: Number(b.dataset.nx) })));
  gridBox.addEventListener("change", () =>
    apply({ type: "grid", value: gridBox.checked }));
  resetBtn.addEventListener("click", () => apply({ type: "reset" }));

  // Colours come from CSS tokens, but keep the drawing in step with a theme flip.
  board.onTheme(() => draw());

  render();
})();
