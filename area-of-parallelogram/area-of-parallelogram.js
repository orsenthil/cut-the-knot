"use strict";

/*
 * Area Of Parallelogram — drawing and input only; the geometry is in
 * area-of-parallelogram-core.js. Four draggable corners keep ABCD a
 * parallelogram. The blue triangles ABF and DCG are the pieces the applet
 * cuts and pastes to make the rectangle AFGD; in its Figure 2 the feet fall
 * outside the base and a pink overlap triangle is subtracted instead.
 * Every SVG object is created once and only updated on a redraw, so a handle
 * keeps keyboard focus while its neighbours move.
 */

(function () {
  const Core = AreaOfParallelogramCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const cutBox = document.getElementById("cut");
  const namesBox = document.getElementById("names");
  const newBtn = document.getElementById("newBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const edges = board.layer("edges");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const para = board.polygon([state.A, state.B, state.C, state.D], "para", fills);
  const blue1 = board.polygon([state.A, state.B, state.A], "blue", fills);
  const blue2 = board.polygon([state.D, state.C, state.D], "blue", fills);
  const pink1 = board.polygon([state.C, state.A, state.A], "pink", fills);
  const pink2 = board.polygon([state.B, state.D, state.D], "pink", fills);

  const rect = board.polygon([state.A, state.B, state.C, state.D], "rect", edges);
  const base = board.segment(state.B, state.C, "base", edges);
  const topSide = board.segment(state.D, state.A, "top", edges);
  const sides = [
    board.segment(state.A, state.B, "side", edges),
    board.segment(state.C, state.D, "side", edges),
  ];
  const heights = [
    board.segment(state.A, state.B, "height", guides),
    board.segment(state.D, state.C, "height", guides),
  ];

  const feet = [
    board.point(state.B, "foot", 3.5, labels),
    board.point(state.D, "foot", 3.5, labels),
  ];
  const labelPos = {
    A: [-15, -10], B: [7, 17], C: [8, 17], D: [-15, -10],
    F: [-8, 17], G: [-8, 17],
  };
  const labelsFor = {};
  for (const key of ["A", "B", "C", "D", "F", "G"]) {
    labelsFor[key] = board.label(state.A, key, "point-label",
      labelPos[key][0], labelPos[key][1], labels);
  }

  const handleOptions = {
    step: 5, shift: 15, r: 9, layer: top,
    clamp: (p) => Core.clampToBoard(p),
    label: "Corner. Drag it, or focus it and use the arrow keys to move the parallelogram.",
  };
  const handles = {};
  for (const key of ["A", "B", "C", "D"]) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to move the parallelogram.`,
      onMove: (p, name) => {
        state = Core.movePoint(state, name, p);
        render();
      },
    }));
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.compute(state);
    for (const key of ["A", "B", "C", "D"]) handles[key].set(state[key]);

    para.set([g.A, g.B, g.C, g.D]);
    blue1.set([g.A, g.B, g.F]);
    blue2.set([g.D, g.C, g.G]);

    const kOK = g.kBetween && Number.isFinite(g.K.x) && Number.isFinite(g.K.y);
    const lOK = g.lBetween && Number.isFinite(g.L.x) && Number.isFinite(g.L.y);
    pink1.show(kOK).set(kOK ? [g.C, g.K, g.F] : [g.C, g.C, g.C]);
    pink2.show(lOK).set(lOK ? [g.B, g.L, g.G] : [g.B, g.B, g.B]);

    rect.show(state.showCut).set([g.A, g.F, g.G, g.D]);
    base.set(g.B, g.C);
    topSide.set(g.D, g.A);
    sides[0].set(g.A, g.B);
    sides[1].set(g.C, g.D);
    heights[0].set(g.A, g.F);
    heights[1].set(g.D, g.G);

    feet[0].set(g.F);
    feet[1].set(g.G);
    for (const key of ["A", "B", "C", "D", "F", "G"]) labelsFor[key].set(g[key]);
    for (const key of ["F", "G"]) labelsFor[key].show(state.showNames);
    for (const key of ["A", "B", "C", "D"]) labelsFor[key].show(state.showNames);

    say(Core.describe(state), state.explored ? "done" : null);

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, F: g.F, G: g.G,
        K: kOK ? g.K : null, L: lOK ? g.L : null,
        base: g.base, height: g.height, area: g.area,
        figure: g.figure, showCut: state.showCut,
      });
    }
  }

  cutBox.checked = state.showCut;
  cutBox.addEventListener("change", () => {
    state = Core.setOption(state, "showCut", cutBox.checked);
    render();
  });
  namesBox.checked = state.showNames;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "showNames", namesBox.checked);
    render();
  });
  newBtn.addEventListener("click", () => {
    state = Core.randomize(state);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
