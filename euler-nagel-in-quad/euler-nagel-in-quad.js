"use strict";

/*
 * The page for Euler Nagel In Quad: drawing and input only.  The geometry is
 * in euler-nagel-in-quad-core.js.  Four corner handles move the quadrilateral;
 * the six tick boxes are the applet's six Checkboxes, with the same names.
 * Every SVG object is created once and only updated on a redraw, so a focused
 * handle keeps its keyboard focus when the picture changes.
 */

(function () {
  const Core = EulerNagelInQuadCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const frame = board.layer("frame");
  const euler = board.layer("euler");
  const families = board.layer("families");
  const centers = board.layer("centers");
  const main = board.layer("main");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", frame);
  const diagonals = [
    board.segment(state.A, state.C, "diag", frame),
    board.segment(state.B, state.D, "diag", frame),
  ];
  const eulerLines = [0, 1, 2, 3].map(() => board.line(state.A, state.B, "euler", euler));

  /* The four centre quadrilaterals: the triangle that omits A is index 0. */
  const familiesByOption = [
    { option: "orthocenters", key: "HH", cls: "h" },
    { option: "ninePoints", key: "NN", cls: "n" },
    { option: "centroids", key: "GG", cls: "g" },
    { option: "circumcenters", key: "OO", cls: "o" },
  ];
  const familyShapes = familiesByOption.map((f) => ({
    option: f.option,
    key: f.key,
    lines: [
      board.segment(state.A, state.B, `family-${f.cls}`, families),
      board.segment(state.A, state.B, `family-${f.cls}`, families),
    ],
    dots: [0, 1, 2, 3].map(() => board.point(state.A, `dot-${f.cls}`, 4, centers)),
  }));

  const resultLine = board.line(state.A, state.B, "result-line", main);
  const resultDots = [
    board.point(state.A, "dot-h-big", 7, main),
    board.point(state.A, "dot-n-big", 7, main),
    board.point(state.A, "dot-g-big", 7, main),
    board.point(state.A, "dot-o-big", 7, main),
  ];

  const cornerKeys = ["A", "B", "C", "D"];
  const cornerOffsets = { A: [-16, -8], B: [8, -8], C: [8, 17], D: [-16, 17] };
  const cornerLabels = {};
  for (const key of cornerKeys) {
    const off = cornerOffsets[key];
    cornerLabels[key] = board.label(state[key], key, "point-label", off[0], off[1], labels);
  }
  const resultOffsets = [[-28, -10], [8, -10], [8, 18], [-28, 18]];
  const resultLabels = ["H'", "N'", "G'", "O'"].map((text, i) =>
    board.label(state.A, text, `center-label label-${["h", "n", "g", "o"][i]}`,
      resultOffsets[i][0], resultOffsets[i][1], labels));

  const handles = {};
  for (const key of cornerKeys) {
    handles[key] = board.handle(key, state[key], {
      r: 9, step: 5, shift: 15, layer: top,
      clamp: (p) => Core.clamp(p),
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to move the quadrilateral.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const finite = (p) => Core.finite(p);

  function render() {
    const g = Core.geometry(state);
    for (const key of cornerKeys) handles[key].set(state[key]);

    if (!g || !g.valid) {
      quad.show(false);
      for (const s of diagonals) s.show(false);
      for (const s of eulerLines) s.show(false);
      for (const f of familyShapes) {
        for (const s of f.lines) s.show(false);
        for (const d of f.dots) d.show(false);
      }
      resultLine.show(false);
      for (const d of resultDots) d.show(false);
      for (const key of cornerKeys) cornerLabels[key].show(false);
      for (const l of resultLabels) l.show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) {
        window.Track.state({
          corners: [state.A, state.B, state.C, state.D],
          options: state.options,
        });
      }
      return;
    }

    quad.show(true).set([g.A, g.B, g.C, g.D]);
    diagonals[0].set(g.A, g.C).show(state.options.diagonals);
    diagonals[1].set(g.B, g.D).show(state.options.diagonals);

    for (let i = 0; i < eulerLines.length; i++) {
      const ends = g.eulerLines[i];
      const ok = state.options.eulerLines && finite(ends[0]) && finite(ends[1]);
      if (ok) eulerLines[i].set(ends[0], ends[1]);
      eulerLines[i].show(ok);
    }

    for (const f of familyShapes) {
      const points = g[f.key];
      const on = !!state.options[f.option];
      f.lines[0].show(false);
      f.lines[1].show(false);
      if (on && finite(points[0]) && finite(points[2])) {
        f.lines[0].set(points[0], points[2]).show(true);
      }
      if (on && finite(points[1]) && finite(points[3])) {
        f.lines[1].set(points[1], points[3]).show(true);
      }
      for (let i = 0; i < 4; i++) {
        const ok = on && finite(points[i]);
        if (ok) f.dots[i].set(points[i]);
        f.dots[i].show(ok);
      }
    }

    resultLine.set(g.H, g.O).show(true);
    const results = [g.H, g.N, g.G, g.O];
    for (let i = 0; i < 4; i++) {
      resultDots[i].set(results[i]).show(true);
      resultLabels[i].set(results[i]).show(true);
    }
    for (const key of cornerKeys) {
      const off = cornerOffsets[key];
      cornerLabels[key].set(state[key], key, off[0], off[1]).show(true);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    /* The position, in board units, for the player's record and the tutor. */
    if (window.Track) {
      window.Track.state({
        corners: [g.A, g.B, g.C, g.D],
        H: g.H, N: g.N, G: g.G, O: g.O,
        triangleCenters: { H: g.HH, N: g.NN, G: g.GG, O: g.OO },
        cyclicCenters: g.cyclicCenters,
        claims: g.claims,
        options: state.options,
      });
    }
  }

  const checkboxIds = {
    circumcenters: "circumcenters",
    orthocenters: "orthocenters",
    centroids: "centroids",
    ninePoints: "ninePoints",
    diagonals: "diagonals",
    eulerLines: "eulerLines",
  };
  for (const key of Object.keys(checkboxIds)) {
    const box = document.getElementById(checkboxIds[key]);
    box.checked = !!state.options[key];
    box.addEventListener("change", () => {
      state = Core.setOption(state, key, box.checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    for (const key of Object.keys(checkboxIds)) {
      document.getElementById(checkboxIds[key]).checked = !!state.options[key];
    }
    render();
  });

  /* SVG colours are CSS classes, so a theme flip needs no recompute; redraw
   * anyway to keep the hook the shared Geom helper provides. */
  board.onTheme(render);
  render();
})();
