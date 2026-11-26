"use strict";

/*
 * The page for Areas In Square: drawing and input only; all the geometry is in
 * areas-in-square-core.js. The SVG holds a square ABCD, E on the left side,
 * the two crossing lines AC and BE, and the four coloured regions I-IV.
 * Two Geom handles do the exploring: E slides along AD (which sets N) and C
 * resizes the square. Every object is made once and merely re-set on a redraw,
 * so a handle keeps its keyboard focus. The two checkboxes and N box reproduce
 * the applet's controls, and Reset restores the opening picture.
 */

(function () {
  const Core = AreasInSquareCore;
  const board = Geom.board("board");
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const colorsBox = document.getElementById("colorsBox");
  const dissectionBox = document.getElementById("dissectionBox");
  const resetBtn = document.getElementById("resetBtn");

  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const edges = board.layer("edges");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = Core.start();
  let g = Core.compute(state);

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const regions = [0, 1, 2, 3].map((i) =>
    board.polygon(g.regions[i], "region region-" + (i + 1), fills));
  const square = board.polygon([g.A, g.B, g.C, g.D], "square", edges);
  const cuts = [
    board.segment(g.A, g.C, "cut", edges),
    board.segment(g.B, g.E, "cut", edges),
  ];
  const cornerDots = ["A", "B", "C", "D", "E", "M"].map((name) =>
    board.point(g[name], name === "M" ? "cross-dot" : "corner-dot", 3.5, marks));

  // ShowDissection draws 6N-5 lines; make the largest pool once and show only
  // as many as the current N needs.
  const maxLines = 6 * Core.N_MAX - 5;
  const grid = [];
  for (let i = 0; i < maxLines; i++) grid.push(board.segment(g.A, g.A, "dissect", guides));

  const cornerOffsets = {
    A: [-14, 17], B: [8, 17], C: [8, -8], D: [-14, -8],
    E: [-15, 4], M: [8, -8],
  };
  const cornerLabels = {};
  for (const name of Object.keys(cornerOffsets)) {
    cornerLabels[name] = board.label(g[name], name, "point-label",
      cornerOffsets[name][0], cornerOffsets[name][1], labels);
  }
  const regionOffsets = [[-2, 6], [-4, 16], [6, 0], [-4, -6]];
  const regionLabels = [0, 1, 2, 3].map((i) => {
    const r = g.regions[i];
    const at = {
      x: r.reduce((s, p) => s + p.x, 0) / r.length,
      y: r.reduce((s, p) => s + p.y, 0) / r.length,
    };
    return board.label(at, ["I", "II", "III", "IV"][i], "region-label",
      regionOffsets[i][0], regionOffsets[i][1], labels);
  });

  const eHandle = board.handle("E", g.E, {
    r: 10, step: 5, shift: 15, layer: handles, cls: "geom-handle move-handle",
    label: "Point E on side AD. Drag it up or down, or focus it and use the arrow keys, to change N",
    describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) +
      ". N is " + state.n.toFixed(2) + ".",
    clamp: (q) => {
      const s = Core.compute(state);
      return {
        x: s.A.x,
        y: Core.clamp(q.y, s.A.y - s.side / Core.N_MIN, s.A.y - s.side / Core.N_MAX),
      };
    },
    onMove: (p) => apply({ type: "point", name: "E", point: p }),
  });
  const cHandle = board.handle("C", g.C, {
    r: 10, step: 5, shift: 15, layer: handles, cls: "geom-handle resize-handle",
    label: "Corner C. Drag it, or focus it and use the arrow keys, to resize the square",
    describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
    clamp: (q) => ({
      x: Core.clamp(q.x, Core.MARGIN, state.width - Core.MARGIN),
      y: Core.clamp(q.y, Core.MARGIN, state.height - Core.MARGIN),
    }),
    onMove: (p) => apply({ type: "point", name: "C", point: p }),
  });

  function draw() {
    for (let i = 0; i < 4; i++) regions[i].set(g.regions[i]).show(state.showColors);
    square.set([g.A, g.B, g.C, g.D]);
    cuts[0].set(g.A, g.C);
    cuts[1].set(g.B, g.E);
    for (let i = 0; i < 6; i++) cornerDots[i].set(g[["A", "B", "C", "D", "E", "M"][i]]);

    for (let i = 0; i < maxLines; i++) {
      const part = g.dissection[i];
      // The N² grid is a proof for whole N; a dragged N between two integers
      // has no whole-number grid to draw.
      grid[i].show(state.showDissection && Number.isInteger(state.n) && !!part);
      if (part) grid[i].set(part[0], part[1]);
    }
    for (const name of Object.keys(cornerLabels)) cornerLabels[name].set(g[name]);
    for (let i = 0; i < 4; i++) {
      const r = g.regions[i];
      regionLabels[i].set({
        x: r.reduce((s, p) => s + p.x, 0) / r.length,
        y: r.reduce((s, p) => s + p.y, 0) / r.length,
      });
    }
    eHandle.set(g.E);
    cHandle.set(g.C);
  }

  /** Redraw, speak the picture and save the position for the record and tutor. */
  function render() {
    g = Core.compute(state);
    draw();
    say(Core.describe(state), state.explored ? "done" : null);
    nInput.value = state.n.toFixed(2).replace(/\.?0+$/, "");
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m) {
    const next = Core.move(state, m);
    if (!next) {
      render();
      return false;
    }
    state = next;
    render();
    return true;
  }

  nInput.addEventListener("change", () => {
    const value = Number(nInput.value);
    if (!apply({ type: "n", value })) nInput.value = String(state.n);
  });
  colorsBox.addEventListener("change", () =>
    apply({ type: "option", key: "showColors", value: colorsBox.checked }));
  dissectionBox.addEventListener("change", () =>
    apply({ type: "option", key: "showDissection", value: dissectionBox.checked }));
  resetBtn.addEventListener("click", () => {
    apply({ type: "reset" });
    colorsBox.checked = state.showColors;
    dissectionBox.checked = state.showDissection;
  });

  // Classes are styled with CSS tokens, so a theme flip needs no new colours.
  board.onTheme(() => draw());

  render();
})();
