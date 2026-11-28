"use strict";

/*
 * Inscribed Quadri — drawing and input only.  The geometry lives in
 * inscribed-quadri-core.js: four handles constrained to one circle, the four
 * triangles they make, their orthocentres, nine-point centres and centroids,
 * and the centre line H-N-G-O.  The nine checkboxes are the applet's own;
 * every SVG object is created once and only updated on a redraw, so a handle
 * keeps keyboard focus while a corner moves.
 */

(function () {
  const Core = InscribedQuadriCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = {
    orthocenters: document.getElementById("optOrthocenters"),
    ninePoints: document.getElementById("optNinePoints"),
    centroids: document.getElementById("optCentroids"),
    eulerLines: document.getElementById("optEulerLines"),
    homothety: document.getElementById("optHomothety"),
    quadrilaterals: document.getElementById("optQuadrilaterals"),
    ninePointCircles: document.getElementById("optNinePointCircles"),
    maltitudes: document.getElementById("optMaltitudes"),
    simsons: document.getElementById("optSimsons"),
  };

  let state = Core.start();

  /* Layers, back to front. */
  const base = board.layer("base");
  const eulerLayer = board.layer("euler");
  const homothetyLayer = board.layer("homothety");
  const familyLayer = board.layer("families");
  const maltitudeLayer = board.layer("maltitudes");
  const simsonLayer = board.layer("simsons");
  const circleLayer = board.layer("nine-circles");
  const lineLayer = board.layer("centre-line");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const circum = board.circle(Core.CENTER, Core.RADIUS, "circum", base);
  const quad = board.polygon(Core.START_ANGLES.map(Core.onCircle), "quad", base);
  const eulers = [0, 1, 2, 3].map(() => board.line(Core.CENTER, Core.CENTER, "euler", eulerLayer));
  const homotheties = { H: [], N: [], G: [] };
  for (const family of ["H", "N", "G"]) {
    homotheties[family] = [0, 1, 2, 3].map(() => board.segment(Core.CENTER, Core.CENTER, `homo-${family}`, homothetyLayer));
  }
  const families = { H: [], N: [], G: [] };
  for (const family of ["H", "N", "G"]) {
    families[family] = [0, 1, 2, 3].map(() => board.segment(Core.CENTER, Core.CENTER, `family-${family}`, familyLayer));
  }
  const maltitudes = [0, 1, 2, 3].map(() => board.segment(Core.CENTER, Core.CENTER, "maltitude", maltitudeLayer));
  const simsons = [0, 1, 2, 3].map(() => board.line(Core.CENTER, Core.CENTER, "simson", simsonLayer));
  const nineCircles = [0, 1, 2, 3].map(() => board.circle(Core.CENTER, 1, "nine-circle", circleLayer));
  const centreLine = board.segment(Core.CENTER, Core.CENTER, "centre-line", lineLayer);
  const orthDots = [0, 1, 2, 3].map(() => board.point(Core.CENTER, "dot-orth", 4, dotLayer));
  const nineDots = [0, 1, 2, 3].map(() => board.point(Core.CENTER, "dot-nine", 4, dotLayer));
  const centDots = [0, 1, 2, 3].map(() => board.point(Core.CENTER, "dot-centroid", 4, dotLayer));
  const oDot = board.point(Core.CENTER, "dot-o", 4, dotLayer);
  const hDot = board.point(Core.CENTER, "dot-h", 6, dotLayer);
  const nDot = board.point(Core.CENTER, "dot-n", 4, dotLayer);
  const gDot = board.point(Core.CENTER, "dot-g", 4, dotLayer);
  const cornerLabels = Core.NAMES.map((name) => board.label(Core.CENTER, name, "point-label", 0, 0, labelLayer));

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, Core.onCircle(Core.START_ANGLES[Core.NAMES.indexOf(name)]), {
      step: 3, shift: 12, r: 9, layer: handleLayer,
      clamp: (p) => Core.projectToCircle(p),
      label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move it round the circle.`,
      describe: (p) => `At ${Math.round(Core.angleOf(p) * 180 / Math.PI)} degrees on the circle.`,
      onMove: (p, which) => {
        state = Core.move(state, which, p);
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
    for (const name of Core.NAMES) {
      handles[name].set(Core.onCircle(state.angles[Core.NAMES.indexOf(name)]));
    }
    circum.show(true);

    if (!g) {
      quad.show(false);
      const all = eulers.concat(maltitudes, simsons, nineCircles, orthDots, nineDots,
        centDots, [centreLine, oDot, hDot, nDot, gDot], cornerLabels);
      for (const s of all) s.show(false);
      for (const family of ["H", "N", "G"]) {
        for (const s of homotheties[family].concat(families[family])) s.show(false);
      }
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ angles: state.angles.slice(), options: Object.assign({}, state.options), points: null });
      return;
    }

    quad.show(true).set(g.points);
    for (let i = 0; i < 4; i++) {
      eulers[i].set(g.eulerLines[i].from, g.eulerLines[i].to).show(state.options.eulerLines && g.eulerLines[i].ok);
      maltitudes[i].set(g.maltitudes[i].from, g.maltitudes[i].to).show(state.options.maltitudes);
      const s = g.simsons[i];
      simsons[i].set(s ? s.ends[0] : Core.CENTER, s ? s.ends[1] : Core.CENTER).show(state.options.simsons && !!s);
      nineCircles[i].set(g.nineCircles[i].center, g.nineCircles[i].radius).show(state.options.ninePointCircles);
      for (const family of ["H", "N", "G"]) {
        homotheties[family][i].set(g.homothetyLines[family][i][0], g.homothetyLines[family][i][1])
          .show(state.options.homothety);
        families[family][i].set(g.quads[family][i], g.quads[family][(i + 1) % 4])
          .show(state.options.quadrilaterals);
      }
      orthDots[i].set(g.orthocenters[i]).show(state.options.orthocenters);
      nineDots[i].set(g.nineCenters[i]).show(state.options.ninePoints);
      centDots[i].set(g.centroids[i]).show(state.options.centroids);
      const at = g.points[i], dx = at.x - Core.CENTER.x, dy = at.y - Core.CENTER.y;
      const n = Math.hypot(dx, dy) || 1;
      cornerLabels[i].set(at, Core.NAMES[i], (dx / n) * 14 - 4, (dy / n) * 14 + 4).show(true);
    }
    centreLine.set(g.H, g.O).show(true);
    oDot.set(g.O).show(true);
    hDot.set(g.H).show(true);
    nDot.set(g.N).show(true);
    gDot.set(g.G).show(true);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D,
        H: g.H, N: g.N, G: g.G, O: g.O, circumradius: g.circumradius,
        orthocenters: g.orthocenters, nineCenters: g.nineCenters, centroids: g.centroids,
        nineCircles: g.nineCircles.map((c) => ({ center: c.center, radius: c.radius })),
        eulerLines: g.eulerLines.map((l) => [l.from, l.to]),
        maltitudes: g.maltitudes.map((l) => [l.from, l.to]),
        simsonLines: g.simsons.map((s) => (s ? s.ends : null)),
        options: Object.assign({}, state.options),
        claims: g.claims, measures: g.measures,
      });
    }
  }

  for (const key of Object.keys(boxes)) {
    boxes[key].checked = state.options[key];
    boxes[key].addEventListener("change", () => {
      state = Core.setOption(state, key, boxes[key].checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    for (const key of Object.keys(boxes)) boxes[key].checked = state.options[key];
    render();
  });

  board.onTheme(render);
  render();
})();
