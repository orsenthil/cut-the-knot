"use strict";

/*
 * Centroids In Polygon — drawing and input only.  The geometry (the centroid
 * of the other vertices, the common point G and the 1/(1-N) homothety) is in
 * centroids-in-polygon-core.js.
 *
 * The board holds up to twenty draggable vertices, the original N-gon, the
 * centroid polygon Q, every joining line, and the (N-1)-gon picked by Cycle.
 * Shapes are made once and only updated on a redraw, so a handle keeps focus
 * across keyboard moves.  Hint is available only as in the applet: a 4-gon
 * with a vertex picked by Cycle.
 */

(function () {
  const Core = CentroidsInPolygonCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nValue = document.getElementById("nValue");
  const nMinus = document.getElementById("nMinus");
  const nPlus = document.getElementById("nPlus");
  const cycleBtn = document.getElementById("cycleBtn");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const polygons = board.layer("polygons");
  const spokesLayer = board.layer("spokes");
  const highlightLayer = board.layer("highlight");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const polyP = board.polygon(state.points, "poly-p", polygons);
  const polyQ = board.polygon(state.points, "poly-q", polygons);
  const spokes = [];
  const qDots = [];
  for (let i = 0; i < Core.N_MAX; i++) {
    spokes.push(board.segment(state.points[0], state.points[0], "spoke", spokesLayer));
    qDots.push(board.point(state.points[0], "q-dot", 3, dots));
  }
  const polyCycle = board.polygon(state.points, "poly-cycle", highlightLayer);
  const cycleLine = board.segment(state.points[0], state.points[0], "spoke-cycle", highlightLayer);
  const cycleDot = board.point(state.points[0], "cycle-dot", 6, dots);
  const hintLines = [
    board.segment(state.points[0], state.points[0], "hint-line", highlightLayer),
    board.segment(state.points[0], state.points[0], "hint-line", highlightLayer),
    board.segment(state.points[0], state.points[0], "hint-line", highlightLayer),
  ];
  const gDot = board.point(state.points[0], "g-dot", 6, dots);

  const gLabel = board.label(state.points[0], "G", "point-label g-label", -18, -10, labels);
  const pLabel = board.label(state.points[0], "", "point-label p-label", 8, -10, labels);
  const qLabel = board.label(state.points[0], "", "point-label q-label", 8, -10, labels);

  const handles = [];
  for (let i = 0; i < Core.N_MAX; i++) {
    handles.push(board.handle(String(i), state.points[0], {
      r: 8, step: 5, shift: 15, layer: handlesLayer,
      clamp: (p) => Core.clampPoint(p),
      label: `Vertex ${i + 1}. Drag it, or focus it and use the arrow keys to move the polygon.`,
      onMove: (p, name) => {
        state = Core.movePoint(state, Number(name), p);
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
    nValue.textContent = String(state.n);
    nMinus.disabled = state.n <= Core.N_MIN;
    nPlus.disabled = state.n >= Core.N_MAX;
    hintBox.disabled = !Core.hintEnabled(state);
    hintBox.checked = state.hint;

    for (let i = 0; i < Core.N_MAX; i++) {
      handles[i].set(state.points[i % state.n]);
      handles[i].show(i < state.n);
    }

    if (!g) {
      for (const s of [polyP, polyQ, polyCycle, cycleLine, cycleDot, gDot,
        gLabel, pLabel, qLabel].concat(spokes, qDots, hintLines)) s.show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(Core.snapshot(state));
      return;
    }

    polyP.show(true).set(g.P);
    polyQ.show(true).set(g.Q);
    for (let i = 0; i < Core.N_MAX; i++) {
      if (i < state.n) {
        spokes[i].show(true).set(g.P[i], g.Q[i]);
        qDots[i].show(true).set(g.Q[i]);
      } else {
        spokes[i].show(false);
        qDots[i].show(false);
      }
    }
    gDot.show(true).set(g.G);
    gLabel.show(true).set(g.G);

    const h = g.highlighted;
    if (h) {
      polyCycle.show(true).set(h.polygon);
      // DrawPolys draws the fat line only when Hint is on; otherwise this
      // spoke is already drawn with all the others by DrawPara.
      cycleLine.show(g.hint).set(h.vertex, h.centroid);
      cycleDot.show(true).set(h.centroid);
      pLabel.show(true).set(h.vertex, `P${h.index + 1}`);
      qLabel.show(true).set(h.centroid, `Q${h.index + 1}`);
      for (let i = 0; i < hintLines.length; i++) {
        if (i < h.hintLines.length) hintLines[i].show(true).set(h.hintLines[i][0], h.hintLines[i][1]);
        else hintLines[i].show(false);
      }
    } else {
      for (const s of [polyCycle, cycleLine, cycleDot, pLabel, qLabel].concat(hintLines)) s.show(false);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    /* The position, in board units, for the player's record and the tutor. */
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  nMinus.addEventListener("click", () => {
    state = Core.setN(state, state.n - 1);
    render();
  });
  nPlus.addEventListener("click", () => {
    state = Core.setN(state, state.n + 1);
    render();
  });
  cycleBtn.addEventListener("click", () => {
    state = Core.cycle(state);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setHint(state, hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // Class-styled SVG needs no repaint on a theme flip; keep the shared hook.
  board.onTheme(render);
  render();
})();
