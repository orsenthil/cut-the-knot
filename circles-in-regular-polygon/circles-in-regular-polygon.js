"use strict";

/*
 * The page for Circles In Regular Polygon: drawing and input only.  The
 * construction and the five claims live in circles-in-regular-polygon-core.js.
 *
 * The board shows the regular polygon, the diagonals from the selected vertex
 * A, and whichever of the applet's eight "Show ..." layers are ticked.  A is
 * a draggable handle constrained to the circumcircle, so dragging it turns
 * the whole regular polygon without breaking it.  Shapes are created once and
 * only updated on a redraw, so the handle keeps keyboard focus.
 */

(() => {
  const C = CirclesInRegularPolygonCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nValue = document.getElementById("nValue");
  const nMinus = document.getElementById("nMinus");
  const nPlus = document.getElementById("nPlus");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = Object.fromEntries(C.OPTION_KEYS.map((key) =>
    [key, document.getElementById(key + "Check")]));

  let state = C.start();
  const startV = C.layout(state.n, state.angle);

  /* Layers, back to front. */
  const fill = board.layer("fill");
  const rings = board.layer("rings");
  const guides = board.layer("guides");
  const markers = board.layer("markers");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const polygon = board.polygon(startV, "poly-fill", fill);
  const diagonals = [];
  const bisectors = [];
  const incircles = [];
  const incenterDots = [];
  const centroidDots = [];
  const footDots = [];
  for (let i = 0; i < C.N_MAX + 1; i++) {
    diagonals.push(board.segment(startV[0], startV[0], "diagonal", guides));
  }
  for (let i = 0; i < C.N_MAX; i++) {
    bisectors.push(board.segment(startV[0], startV[0], "bisector", guides));
    incircles.push(board.circle(startV[0], 1, "incircle", rings));
    incenterDots.push(board.point(startV[0], "incenter-dot", 3.4, markers));
    centroidDots.push(board.point(startV[0], "centroid-dot", 3.6, markers));
    footDots.push(board.point(startV[0], "foot-dot", 3.2, markers));
  }
  const iRing = board.circle(C.CENTER, 1, "i-circle", rings);
  const cRing = board.circle(C.CENTER, 1, "c-circle", rings);
  const tRing = board.circle(C.CENTER, 1, "t-circle", rings);
  const aRing = board.circle(C.CENTER, 1, "a-circle", rings);
  const aLabel = board.label(startV[0], "A", "point-label", -18, -12, labels);

  /* Keep the selected vertex on the circumcircle: a rigid rotation. */
  function onCircle(p) {
    const dx = p.x - C.CENTER.x, dy = p.y - C.CENTER.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return { x: C.CENTER.x, y: C.CENTER.y - C.RADIUS };
    return {
      x: C.CENTER.x + C.RADIUS * dx / d,
      y: C.CENTER.y + C.RADIUS * dy / d,
    };
  }
  const describe = (p) => `at x ${Math.round(p.x)}, y ${Math.round(p.y)} in the drawing`;
  const aHandle = board.handle("A", startV[0], {
    r: 9, step: 5, shift: 15, layer: handlesLayer,
    clamp: onCircle, describe,
    label: "Vertex A. Drag it around the circle, or focus it and use the arrow keys to turn the polygon.",
    onMove: (p) => {
      state = C.setAngle(state, Math.atan2(p.y - C.CENTER.y, p.x - C.CENTER.x));
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
    const g = C.geometry(state);
    const o = state.options;
    nValue.textContent = String(state.n);
    nMinus.disabled = state.n <= C.N_MIN;
    nPlus.disabled = state.n >= C.N_MAX;
    for (const key of C.OPTION_KEYS) boxes[key].checked = !!o[key];

    if (!g) {
      say("The picture cannot be drawn from this polygon.");
      if (window.Track) window.Track.state(C.snapshot(state));
      return;
    }

    polygon.set(g.vertices);
    for (let i = 0; i < diagonals.length; i++) {
      if (i < g.n - 1) diagonals[i].show(true).set(g.vertices[0], g.vertices[i + 1]);
      else diagonals[i].show(false);
    }
    for (let i = 0; i < C.N_MAX; i++) {
      if (i < g.triangles.length) {
        const t = g.triangles[i];
        incircles[i].show(o.incircles).set(t.incircle.center, t.incircle.radius);
        incenterDots[i].show(o.incenters).set(t.incircle.center);
        centroidDots[i].show(o.centroids).set(t.centroid);
        footDots[i].show(o.bisectors).set(t.bisectorFoot);
        bisectors[i].show(o.bisectors).set(g.vertices[0], t.bisectorFoot);
      } else {
        for (const s of [incircles[i], incenterDots[i], centroidDots[i],
          footDots[i], bisectors[i]]) s.show(false);
      }
    }
    iRing.show(o.iCircle).set(g.iCircle.center, g.iCircle.radius);
    cRing.show(o.cCircle).set(g.cCircle.center, g.cCircle.radius);
    if (g.tCircle) tRing.show(o.tCircle).set(g.tCircle.center, g.tCircle.radius);
    else tRing.show(false);
    aRing.show(o.aCircle).set(g.aCircle.center, g.aCircle.radius);

    aHandle.set(g.vertices[0]);
    aLabel.show(true).set(g.vertices[0]);
    say(C.describe(state), state.explored ? "done" : null);

    /* The position, in board units, for the player's record and the tutor. */
    if (window.Track) window.Track.state(C.snapshot(state));
  }

  nMinus.addEventListener("click", () => {
    state = C.setN(state, state.n - 1);
    render();
  });
  nPlus.addEventListener("click", () => {
    state = C.setN(state, state.n + 1);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = C.reset(state);
    render();
  });
  for (const key of C.OPTION_KEYS) {
    boxes[key].addEventListener("change", () => {
      state = C.setOption(state, key, boxes[key].checked);
      render();
    });
  }

  /* Class-styled SVG needs no repaint on a theme flip; keep the shared hook. */
  board.onTheme(render);
  render();
})();
