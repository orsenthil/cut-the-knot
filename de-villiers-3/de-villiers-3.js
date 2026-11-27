"use strict";

/*
 * deVilliers3 — drawing and input only. The geometry lives in
 * de-villiers-3-core.js: four dots on one circle, the tangents there, the
 * external angle bisectors of the tangent quadrilateral (X,Y,Z,W), the
 * perpendiculars through them (A',B',C',D') and the perpendicular bisectors
 * of its sides (A1,B1,C1,D1). Shapes are made once and only updated on a
 * redraw, so a handle keeps keyboard focus. Every colour is a site token.
 */

(function () {
  const Core = DeVilliers3Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = {};
  for (const key of Core.OPTION_KEYS) boxes[key] = document.getElementById(key);

  let state = Core.start();

  /* Back to front: guides first, handles last. */
  const back = board.layer("back");
  const quads = board.layer("quads");
  const rays = board.layer("rays");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const circle = board.circle(state.points.A, 50, "main-circle", back);
  const innerCircle = board.circle(state.points.A, 1, "inner-circle", back);
  const quad = board.polygon([state.points.A, state.points.B, state.points.C, state.points.D], "quad", quads);
  const tangentQuad = board.polygon([state.points.A, state.points.B, state.points.C, state.points.D],
    "tangent-quad", quads);
  const primeQuad = board.polygon([state.points.A, state.points.B, state.points.C, state.points.D],
    "prime-quad", quads);
  const bisQuad = board.polygon([state.points.A, state.points.B, state.points.C, state.points.D],
    "bis-quad", quads);

  const tangents = [0, 1, 2, 3].map(() => board.line(state.points.A, state.points.B, "tangent", rays));
  const external = [0, 1, 2, 3].map(() => board.segment(state.points.A, state.points.B, "ext-bisector", rays));
  const perps = [0, 1, 2, 3].map(() => board.line(state.points.A, state.points.B, "perp-line", rays));
  const sideBis = [0, 1, 2, 3].map(() => board.line(state.points.A, state.points.B, "side-bisector", rays));
  const diagonals = [0, 1].map(() => board.line(state.points.A, state.points.B, "diagonal", rays));
  const radii = [0, 1, 2, 3, 4, 5, 6, 7].map(() =>
    board.segment(state.points.A, state.points.B, "radius", rays));
  const arcs = [0, 1, 2, 3].map(() => board.angleArc(state.points.A, state.points.B, state.points.C, 13,
    "angle-mark", marks));

  const xyzDots = [0, 1, 2, 3].map(() => board.point(state.points.A, "xyz-dot", 4, dots));
  const primeDots = [0, 1, 2, 3].map(() => board.point(state.points.A, "prime-dot", 4, dots));
  const bisDots = [0, 1, 2, 3].map(() => board.point(state.points.A, "bis-dot", 4, dots));
  const centers = [0, 1].map(() => board.point(state.points.A, "center-dot", 5, dots));

  const labelKeys = [
    "A", "B", "C", "D", "X", "Y", "Z", "W",
    "A'", "B'", "C'", "D'", "A1", "B1", "C1", "D1", "M", "M'",
  ];
  const labelsByName = {};
  const labelOffsets = {
    A: [8, -7], B: [8, 14], C: [8, 14], D: [8, -7],
    X: [8, -6], Y: [-18, -6], Z: [-18, 14], W: [8, 14],
    "A'": [-22, -7], "B'": [-22, 14], "C'": [8, 14], "D'": [8, -7],
    A1: [-22, -7], B1: [-22, 14], C1: [8, 14], D1: [8, -7],
    M: [8, -12], "M'": [-24, 14],
  };
  for (const key of labelKeys) {
    const off = labelOffsets[key] || [7, -7];
    labelsByName[key] = board.label(state.points.A, key, "point-label", off[0], off[1], labels);
  }

  const handleOptions = {
    step: 3, shift: 12, r: 8, layer: top,
    clamp: (p) => Core.project(p),
    label: "Corner. Drag it around the circle, or focus it and use the arrow keys.",
  };
  const handles = {};
  for (const key of Core.KEYS) {
    handles[key] = board.handle(key, state.points[key], Object.assign({}, handleOptions, {
      label: `Corner ${key}. Drag it around the circle, or focus it and use the arrow keys to move it.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    }));
  }

  /** The shared status line is how the player's record sees an explored demo. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    for (const key of Core.KEYS) handles[key].set(state.points[key]);
    const g = Core.geometry(state);
    const o = state.options;

    circle.show(o.circles).set(Core.CIRCLE.c, Core.CIRCLE.r);
    quad.show(true).set([state.points.A, state.points.B, state.points.C, state.points.D]);
    for (const s of [tangentQuad, primeQuad, bisQuad]) s.show(false);
    for (const s of tangents.concat(external, perps, sideBis, diagonals, radii, arcs)) s.show(false);
    for (const s of xyzDots.concat(primeDots, bisDots, centers)) s.show(false);
    for (const key of labelKeys) labelsByName[key].show(false);

    if (!g) {
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    tangentQuad.show(true).set(g.tangentVertices);
    primeQuad.show(true).set(g.prime);
    bisQuad.show(true).set(g.pbTangent.vertices);

    for (let i = 0; i < 4; i++) {
      tangents[i].set(g.tangents[i].p, g.tangents[i].q).show(true);
      // The eight short rays from the tangent corners towards X,Y,Z,W.
      external[i].set(g.tangentVertices[i], g.external[i]).show(o.angles);
      perps[i].set(g.lines[i].p, g.lines[i].q).show(o.perps);
      const b = g.pbTangent.bisectors[i];
      sideBis[i].set(b.p, b.q).show(o.bisectors);
      xyzDots[i].set([g.X, g.Y, g.Z, g.W][i]).show(true);
      primeDots[i].set(g.prime[i]).show(true);
      bisDots[i].set(g.pbTangent.vertices[i]).show(true);
    }
    diagonals[0].set(g.X, g.Z).show(o.diagonals);
    diagonals[1].set(g.Y, g.W).show(o.diagonals);

    for (let i = 0; i < 4; i++) {
      radii[i].set(Core.CIRCLE.c, [state.points.A, state.points.B, state.points.C, state.points.D][i])
        .show(o.radii);
      radii[i + 4].set(g.center, [g.X, g.Y, g.Z, g.W][i]).show(o.radii);
      arcs[i].set(g.tangentVertices[i], g.tangentVertices[(i + 3) % 4],
        g.tangentVertices[(i + 1) % 4], 13).show(o.angles);
    }
    centers[0].set(Core.CIRCLE.c).show(o.centers);
    centers[1].set(g.center).show(o.centers);
    innerCircle.show(o.circles).set(g.center, g.radius);

    const named = {
      A: state.points.A, B: state.points.B, C: state.points.C, D: state.points.D,
      X: g.X, Y: g.Y, Z: g.Z, W: g.W,
      "A'": g.prime[0], "B'": g.prime[1], "C'": g.prime[2], "D'": g.prime[3],
      A1: g.pbTangent.vertices[1], B1: g.pbTangent.vertices[2],
      C1: g.pbTangent.vertices[3], D1: g.pbTangent.vertices[0],
      M: Core.CIRCLE.c, "M'": g.center,
    };
    for (const key of labelKeys) {
      if (o.names) {
        const off = labelOffsets[key];
        labelsByName[key].set(named[key], key, off[0], off[1]).show(true);
      }
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  for (const key of Core.OPTION_KEYS) {
    boxes[key].checked = state.options[key];
    boxes[key].addEventListener("change", () => {
      state = Core.setOption(state, key, boxes[key].checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours come from CSS classes, so a theme flip needs no recompute;
  // redraw anyway to keep the shared Geom hook.
  board.onTheme(render);
  render();
})();
