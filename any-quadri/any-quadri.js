"use strict";

/*
 * Any Quadri — drawing and input only.  The geometry lives in
 * any-quadri-core.js: four draggable corners A,B,C,D, the midpoints K,L,M,N of
 * the sides and E,F of the diagonals, the three bimedians KM, LN and EF, and
 * the common midpoint G.  The Hint shows the parallelogram ENFL that proves
 * the two segments NL and EF bisect each other.  Shapes are created once and
 * only updated on a redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = AnyQuadriCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const bimed = board.layer("bimedians");
  const hint = board.layer("hint");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", guides);
  const diagonals = [
    board.segment(state.A, state.C, "diag", guides),
    board.segment(state.B, state.D, "diag", guides),
  ];
  const bimedians = [
    board.segment(state.A, state.B, "bimedian", bimed), // KM
    board.segment(state.A, state.B, "bimedian", bimed), // LN
  ];
  const newton = board.segment(state.A, state.B, "newton", bimed); // EF
  const hintLines = [
    board.segment(state.A, state.B, "hint-side", hint),  // N-E
    board.segment(state.A, state.B, "hint-side", hint),  // L-F
    board.segment(state.A, state.B, "hint-diag", hint),  // N-L
  ];

  const midKeys = ["K", "L", "M", "N", "E", "F"];
  const midDots = midKeys.map((key) => board.point(state.A, "midpoint", 4, dots));
  const centerDot = board.point(state.A, "centroid", 5, dots);

  const cornerKeys = ["A", "B", "C", "D"];
  const labelKeys = cornerKeys.concat(midKeys, ["G"]);
  const labelPos = {
    A: [-16, -9], B: [8, -9], C: [8, 17], D: [-16, 17],
    K: [-6, -8], L: [8, -6], M: [8, 15], N: [-16, 4],
    E: [8, -8], F: [-16, -8], G: [8, -8],
  };
  const labelsFor = {};
  for (const key of labelKeys) {
    const off = labelPos[key];
    labelsFor[key] = board.label(state.A, key, "point-label", off[0], off[1], labels);
  }

  const handleOptions = {
    step: 5, shift: 15, r: 9, layer: top,
    clamp: (p) => Core.clamp(p),
    label: "Corner. Drag it, or focus it and use the arrow keys to move the quadrilateral.",
  };
  const handles = {};
  for (const key of cornerKeys) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to move the quadrilateral.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
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
    const g = Core.geometry(state);
    for (const key of cornerKeys) handles[key].set(state[key]);

    if (!g) {
      quad.show(false);
      for (const s of diagonals.concat(bimedians, [newton], hintLines, centerDot)) s.show(false);
      for (const d of midDots) d.show(false);
      for (const key of labelKeys) labelsFor[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) {
        window.Track.state({ A: state.A, B: state.B, C: state.C, D: state.D, hint: state.options.hint });
      }
      return;
    }

    quad.show(true).set([g.A, g.B, g.C, g.D]);
    diagonals[0].set(g.A, g.C);
    diagonals[1].set(g.B, g.D);
    for (const s of diagonals) s.show(true);
    bimedians[0].set(g.K, g.M);
    bimedians[1].set(g.L, g.N);
    newton.set(g.E, g.F);
    for (const s of bimedians.concat([newton])) s.show(true);

    for (let i = 0; i < hintLines.length; i++) {
      hintLines[i].set(g.hintLines[i][0], g.hintLines[i][1]);
    }
    for (const s of hintLines) s.show(state.options.hint);

    for (let i = 0; i < midKeys.length; i++) {
      midDots[i].set(g[midKeys[i]]);
      midDots[i].show(true);
    }
    centerDot.set(g.G);
    centerDot.show(true);

    for (const key of cornerKeys) {
      labelsFor[key].set(g[key]);
      labelsFor[key].show(true);
    }
    for (const key of midKeys) {
      labelsFor[key].set(g[key]);
      labelsFor[key].show(state.options.hint);
    }
    labelsFor.G.set(g.G);
    labelsFor.G.show(true);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D,
        K: g.K, L: g.L, M: g.M, N: g.N, E: g.E, F: g.F, G: g.G,
        hint: state.options.hint, claims: g.claims, measures: g.measures,
      });
    }
  }

  hintBox.checked = state.options.hint;
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    hintBox.checked = state.options.hint;
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
