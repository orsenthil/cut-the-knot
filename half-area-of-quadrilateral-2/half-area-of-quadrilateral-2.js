"use strict";

/*
 * Dividing Evenly a Quadrilateral II — drawing and input only.  The geometry
 * lives in half-area-of-quadrilateral-2-core.js: four draggable corners, the
 * parallel to AC through B or D, its meeting point E with the opposite side,
 * the midpoint M of BE or DE, and the area-bisecting segment CM.  The Hint
 * shows the parallel through K, the midpoint of BD, which lands on M.  Shapes
 * are created once and only updated on a redraw, so a handle keeps focus.
 */

(function () {
  const Core = HalfAreaOfQuadrilateral2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const hintBox = document.getElementById("hint");
  const namesBox = document.getElementById("names");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const cut = board.layer("cut");
  const hint = board.layer("hint");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const quadFill = board.polygon([state.A, state.B, state.C, state.D], "half-quad", fills);
  const triFill = board.polygon([state.B, state.C, state.D], "half-tri", fills);
  const sides = board.polygon([state.A, state.B, state.C, state.D], "quad", guides);
  const diagonal = board.line(state.A, state.C, "diag", guides);
  const parallelLine = board.line(state.B, state.D, "parallel", guides);
  const bisector = board.segment(state.C, state.A, "bisector", cut);
  const hintSide = board.segment(state.A, state.B, "hint-side", hint);
  const hintParallel = board.segment(state.A, state.B, "hint-parallel", hint);
  const hintKLine = board.line(state.A, state.B, "hint-kline", hint);
  const eDot = board.point(state.A, "aux-dot", 5, dots);
  const mDot = board.point(state.A, "mid-dot", 6, dots);
  const kDot = board.point(state.A, "k-dot", 4, dots);

  const labelKeys = ["A", "B", "C", "D", "E", "M", "K"];
  const offsets = {
    A: [-22, -10], B: [-22, 22], C: [10, 6], D: [-22, -10],
    E: [9, -8], M: [9, 20], K: [9, -8],
  };
  const labelsFor = {};
  for (const key of labelKeys) {
    const off = offsets[key];
    labelsFor[key] = board.label(state.A, key, "point-label", off[0], off[1], labels);
  }

  const handles = {};
  for (const key of ["A", "B", "C", "D"]) {
    handles[key] = board.handle(key, state[key], {
      step: 5, shift: 15, r: 9, layer: top,
      clamp: (p) => Core.clamp(p),
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to move the quadrilateral`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
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

  function render() {
    const g = Core.geometry(state);
    for (const key of ["A", "B", "C", "D"]) handles[key].set(state[key]);

    if (!g) {
      quadFill.show(false);
      triFill.show(false);
      for (const s of [sides, diagonal, parallelLine, bisector, hintSide,
        hintParallel, hintKLine, eDot, mDot, kDot]) s.show(false);
      for (const key of labelKeys) labelsFor[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) {
        window.Track.state({
          A: state.A, B: state.B, C: state.C, D: state.D,
          showNames: state.options.showNames, hint: state.options.hint,
        });
      }
      return;
    }

    quadFill.show(true).set(g.Quadri);
    triFill.show(true).set(g.Tri);
    sides.show(true).set([g.A, g.B, g.C, g.D]);
    diagonal.show(true).set(g.A, g.C);
    parallelLine.show(true).set(g.E, g.BorD);
    bisector.show(true).set(g.C, g.M);

    hintSide.set(g.M, g.BorD);
    hintParallel.set(g.M, g.E);
    hintKLine.set(g.K, Core.add(g.K, Core.sub(g.A, g.C)));
    for (const s of [hintSide, hintParallel, hintKLine]) s.show(state.options.hint);

    eDot.show(true).set(g.E);
    mDot.show(true).set(g.M);
    kDot.show(state.options.hint).set(g.K);

    for (const key of ["A", "B", "C", "D"]) {
      labelsFor[key].show(state.options.showNames).set(g[key]);
    }
    labelsFor.E.show(true).set(g.E);
    labelsFor.M.show(true).set(g.M);
    labelsFor.K.show(state.options.hint).set(g.K);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, E: g.E, M: g.M, K: g.K,
        BorD: g.BorD, side: g.side,
        showNames: state.options.showNames, hint: state.options.hint,
        claims: g.claims, measures: g.measures,
      });
    }
  }

  namesBox.checked = state.options.showNames;
  hintBox.checked = state.options.hint;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "showNames", namesBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesBox.checked = state.options.showNames;
    hintBox.checked = state.options.hint;
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
