"use strict";

/*
 * Carpets in a Quadrilateral — drawing and input only. The geometry lives in
 * carpets-in-quadri-core.js: four draggable corners A,B,C,D and a handle P on
 * AB; Q, R and S follow from the ratio t = BP/AB. The blue carpet PSQR and the
 * two red triangles ARD and BSC are filled from the core; Hint shows the
 * orange AQB, the pink AQD and BQC, and the heights on AB from Q, D and C.
 * Shapes are created once and only updated on a redraw, so a handle keeps
 * keyboard focus.
 */

(function () {
  const Core = CarpetsInQuadriCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();
  let g = Core.geometry(state);

  /* Layers, back to front. */
  const carpetsLayer = board.layer("carpets");
  const hintLayer = board.layer("hint");
  const guides = board.layer("guides");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const quad = board.polygon([g.A, g.B, g.C, g.D], "quad", guides);
  const cevians = [
    board.segment(g.A, g.Q, "cevian", guides),  // AQ
    board.segment(g.B, g.Q, "cevian", guides),  // BQ
    board.segment(g.C, g.P, "cevian", guides),  // CP
    board.segment(g.D, g.P, "cevian", guides),  // DP
  ];
  const carpet = board.polygon([g.P, g.S, g.Q, g.R], "carpet-blue", carpetsLayer);
  const redTriangles = [
    board.polygon([g.A, g.R, g.D], "carpet-red", carpetsLayer),
    board.polygon([g.B, g.S, g.C], "carpet-red", carpetsLayer),
  ];
  const hintTriangles = [
    board.polygon([g.A, g.Q, g.B], "hint-orange", hintLayer),
    board.polygon([g.A, g.Q, g.D], "hint-pink", hintLayer),
    board.polygon([g.B, g.Q, g.C], "hint-pink", hintLayer),
  ];
  const heights = [
    board.segment(g.Q, g.Qp, "hint-height", hintLayer),
    board.segment(g.D, g.Dp, "hint-height", hintLayer),
    board.segment(g.C, g.Cp, "hint-height", hintLayer),
    board.segment(g.Cp, g.B, "hint-extension", hintLayer),
    board.segment(g.Dp, g.A, "hint-extension", hintLayer),
  ];

  const dotKeys = ["Q", "R", "S"];
  const dotShapes = dotKeys.map((key) => board.point(g[key], "derived-dot", 4, dots));

  const labelKeys = ["A", "B", "C", "D", "P", "Q", "R", "S", "Cp", "Dp", "Qp"];
  const labelText = { Cp: "C'", Dp: "D'", Qp: "Q'" };
  const labelPos = {
    A: [-18, -8], B: [8, -8], C: [8, 16], D: [-18, 16],
    P: [-8, 22], Q: [8, -8], R: [-18, -6], S: [8, -6],
    Cp: [8, -8], Dp: [-18, -8], Qp: [8, 16],
  };
  const labelsFor = {};
  for (const key of labelKeys) {
    const off = labelPos[key];
    labelsFor[key] = board.label(g[key], labelText[key] || key,
      key.length > 1 ? "prime-label" : "point-label", off[0], off[1], labels);
  }

  const cornerKeys = ["A", "B", "C", "D"];
  const handleOptions = {
    step: 5, shift: 15, r: 8, layer: top, clamp: (p) => Core.clampPoint(p),
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
  handles.P = board.handle("P", g.P, {
    step: 5, shift: 15, r: 8, layer: top, cls: "geom-handle p-handle",
    clamp: (p) => Core.projectOnSegment(p, state.A, state.B),
    label: "Point P. Drag it along AB, or focus it and use the arrow keys to change the ratio.",
    onMove: (p) => {
      state = Core.move(state, "P", p);
      render();
    },
  });

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    g = Core.geometry(state);
    for (const key of cornerKeys) handles[key].set(state[key]);
    if (!g) {
      carpet.show(false);
      for (const s of redTriangles.concat(hintTriangles, heights, cevians, dotShapes)) s.show(false);
      quad.show(false);
      for (const key of labelKeys) labelsFor[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }
    handles.P.set(g.P);

    quad.show(true).set([g.A, g.B, g.C, g.D]);
    cevians[0].set(g.A, g.Q);
    cevians[1].set(g.B, g.Q);
    cevians[2].set(g.C, g.P);
    cevians[3].set(g.D, g.P);
    for (const s of cevians) s.show(true);

    carpet.show(!g.noDraw).set([g.P, g.S || g.P, g.Q, g.R || g.Q]);
    for (let i = 0; i < redTriangles.length; i++) {
      redTriangles[i].show(!g.noDraw).set(i === 0 ? [g.A, g.R || g.A, g.D] : [g.B, g.S || g.B, g.C]);
    }

    hintTriangles[0].set([g.A, g.Q, g.B]);
    hintTriangles[1].set([g.A, g.Q, g.D]);
    hintTriangles[2].set([g.B, g.Q, g.C]);
    heights[0].set(g.Q, g.Qp);
    heights[1].set(g.D, g.Dp);
    heights[2].set(g.C, g.Cp);
    heights[3].set(g.Cp, g.B);
    heights[4].set(g.Dp, g.A);
    const showHint = state.options.hint && !g.noDraw;
    for (const s of hintTriangles.concat(heights)) s.show(showHint);

    for (let i = 0; i < dotKeys.length; i++) {
      dotShapes[i].set(g[dotKeys[i]]);
      dotShapes[i].show(!g.noDraw);
    }
    for (const key of labelKeys) {
      labelsFor[key].set(g[key]);
      const prime = key.length > 1;
      labelsFor[key].show(!prime && state.options.names ? true : prime && showHint);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, P: g.P, Q: g.Q, R: g.R, S: g.S,
        t: g.t, r: g.r, names: state.options.names, hint: state.options.hint,
        claims: g.claims, measures: g.measures,
      });
    }
  }

  namesBox.checked = state.options.names;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  hintBox.checked = state.options.hint;
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesBox.checked = state.options.names;
    hintBox.checked = state.options.hint;
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
