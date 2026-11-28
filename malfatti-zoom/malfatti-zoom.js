"use strict";

/*
 * The page for Malfatti Zoom: drawing and input only. The geometry is in
 * malfatti-zoom-core.js. The board has three draggable triangle vertices; the
 * incenter, the three small incircles, their second tangents, the point L and
 * the three Malfatti circles are drawn from the core and redrawn in place so a
 * handle keeps its keyboard focus. Every option of the Java panel is a real
 * control here, with the same labels and defaults.
 */

(function () {
  const Core = MalfattiZoomCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));

  const layers = {
    bisectors: board.layer("bisectors"),
    triangle: board.layer("triangle"),
    small: board.layer("small"),
    tangents: board.layer("tangents"),
    circles: board.layer("circles"),
    marks: board.layer("marks"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  const sub = ["\u2081", "\u2082", "\u2083"];
  let state = Core.start({});

  /* Shapes are created once and only their geometry changes on a redraw. */
  const sideShapes = [0, 1, 2].map(() => board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "triangle-side", layers.triangle));
  const bisectorShapes = [0, 1, 2].map(() => board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "bisector", layers.bisectors));
  const smallCircles = [0, 1, 2].map(() => board.circle({ x: 0, y: 0 }, 1, "small-incircle", layers.small));
  const tangentShapes = [0, 1, 2].map(() => board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "second-tangent", layers.tangents));
  const malfattiCircles = [0, 1, 2].map(() => board.circle({ x: 0, y: 0 }, 1, "malfatti-circle", layers.circles));
  const lMark = board.point({ x: 0, y: 0 }, "mark mark-l", 4, layers.marks);
  const dMarks = [0, 1, 2].map(() => board.point({ x: 0, y: 0 }, "mark mark-d", 3.5, layers.marks));
  const pMarks = [0, 1, 2].map(() => board.point({ x: 0, y: 0 }, "mark mark-p", 3.5, layers.marks));
  const auxMarks = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => board.point({ x: 0, y: 0 }, "mark mark-aux", 2.5, layers.marks));
  const lLabel = board.label({ x: 0, y: 0 }, "L", "point-label", 7, -7, layers.labels);
  const dLabels = [0, 1, 2].map((k) => board.label({ x: 0, y: 0 }, "D" + sub[k], "point-label", 5, -6, layers.labels));
  const pLabels = [0, 1, 2].map((k) => board.label({ x: 0, y: 0 }, "P" + sub[k], "point-label", 5, 14, layers.labels));
  const auxLabels = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => board.label({ x: 0, y: 0 }, "", "point-label small-label", 4, -5, layers.labels));
  const vertexLabels = [0, 1, 2].map((k) => board.label({ x: 0, y: 0 }, "A" + sub[k], "point-label vertex-label", -6, -10, layers.labels));

  /**
   * The shared status line. This is a demonstration with no win or loss, so
   * the text just reports what the picture shows; the signature keeps `kind`
   * for the shared status classes used across the site.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const handles = [0, 1, 2].map((k) => board.handle("A" + sub[k], state.A[k], {
    r: 9, step: 2, shift: 12, layer: layers.handles, cls: "geom-handle vertex-handle",
    label: "Vertex A" + sub[k] + ". Drag it, or focus it and use the arrow keys (Shift for bigger steps) to change the triangle.",
    clamp: (q) => ({ x: Geom.clamp(q.x, 12, 348), y: Geom.clamp(q.y, 12, 348) }),
    onMove: (point) => {
      const t = Core.zoom(state);
      const boardPoint = Core.untransformPoint(point, t);
      state = Core.moveVertex(state, k, boardPoint);
      render();
    },
  }));

  function render() {
    const g = Core.geometry(state);
    const t = Core.zoom(state);
    const T = (p) => Core.transformPoint(p, t);
    if (!g) {
      sideShapes.forEach((s, k) => s.show(false));
      [bisectorShapes, smallCircles, tangentShapes, malfattiCircles].forEach((group) =>
        group.forEach((s) => s.show(false)));
      [lMark, lLabel, ...dMarks, ...pMarks, ...auxMarks, ...dLabels, ...pLabels,
        ...auxLabels, ...vertexLabels].forEach((s) => s.show(false));
      say("Move a vertex to make a proper triangle.");
      if (window.Track) window.Track.state(Core.position(state));
      return;
    }

    const A = g.A.map(T);
    for (let k = 0; k < 3; k++) {
      sideShapes[k].show(true).set(A[k], A[(k + 1) % 3]);
      const bi = T(g.I), av = T(A[k]);
      bisectorShapes[k].show(state.showBisectors).set(bi, av);
      const small = Core.transformCircle(g.incircles[k], t);
      smallCircles[k].show(state.showIncircles).set(small.center, small.radius);
      tangentShapes[k].show(state.showSecondTangents).set(T(g.DE[k].a), T(g.DE[k].b));
      const big = Core.transformCircle(g.circles[k], t);
      malfattiCircles[k].show(true).set(big.center, big.radius);

      const d = T(g.D[k]);
      dMarks[k].show(state.showNames && (state.showIncircles || state.showSecondTangents)).set(d);
      dLabels[k].show(state.showNames && (state.showIncircles || state.showSecondTangents)).set(d);
      const p = T(g.P[k]);
      pMarks[k].show(state.showNames && state.showSecondTangents).set(p);
      pLabels[k].show(state.showNames && state.showSecondTangents).set(p);
      handles[k].show(true).set(A[k]);
      vertexLabels[k].show(state.showNames).set(A[k]);
    }

    const L = T(g.L);
    lMark.show(state.showNames && state.showSecondTangents).set(L);
    lLabel.show(state.showNames && state.showSecondTangents).set(L);
    const aux = [];
    for (let k = 0; k < 3; k++) {
      aux.push(T(g.E[k]), T(g.F[k]), T(g.G[k]));
    }
    const showAux = state.showNames && state.showSecondTangents && state.showIncircles;
    for (let k = 0; k < aux.length; k++) {
      const letter = k % 3 === 0 ? "E" : k % 3 === 1 ? "F" : "G";
      const index = sub[Math.floor(k / 3)];
      auxMarks[k].show(showAux).set(aux[k]);
      auxLabels[k].show(showAux).set(aux[k], letter + index);
    }

    let worst = 0;
    for (let k = 0; k < 3; k++) {
      const c = g.circles[k];
      worst = Math.max(worst,
        Math.abs(Core.distToLine(c.center, g.A[k], g.A[(k + 1) % 3]) - c.radius),
        Math.abs(Core.distToLine(c.center, g.A[(k + 2) % 3], g.A[k]) - c.radius));
    }
    const zoomLabel = (Core.ZOOMS.find((z) => z.key === state.zoom) || Core.ZOOMS[0]).label;
    const touch = worst < 1e-6
      ? "The three blue circles touch each other and two sides each."
      : worst < 1
        ? "The circles touch to within " + worst.toFixed(3) + " units."
        : "Here the one-pixel tangent test chose a bisector, so the circles miss by " +
          worst.toFixed(1) + " units.";
    say(touch + " View: " + zoomLabel + ".");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function setLayer(key, on) {
    state = { ...state, [key]: on };
    render();
  }

  function setZoom(key) {
    const t = Core.zoom(state); // the *current* view the handle dots are drawn in
    // Keep the triangle where the player put it: convert its displayed
    // positions back to board coordinates before changing the scale.
    const boardA = handles.map((h) => Core.untransformPoint(h.point, t));
    state = { ...state, zoom: key, A: boardA };
    render();
    document.querySelectorAll("[data-zoom]").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.zoom === key ? "true" : "false");
    });
  }

  const boxes = [
    ["namesChk", "showNames"],
    ["bisectorsChk", "showBisectors"],
    ["incirclesChk", "showIncircles"],
    ["tangentsChk", "showSecondTangents"],
  ];
  for (const [id, key] of boxes) {
    const el = document.getElementById(id);
    el.checked = !!state[key];
    el.addEventListener("change", () => setLayer(key, el.checked));
  }
  document.querySelectorAll("[data-zoom]").forEach((b) => {
    b.addEventListener("click", () => setZoom(b.dataset.zoom));
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(() => render(), false);
  render();
})();
