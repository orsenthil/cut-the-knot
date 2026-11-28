"use strict";

/*
 * The page for Hubert Shutrick's dissection: drawing and input only. The
 * geometry lives in huberts-dissection-core.js. The SVG board holds triangle
 * ABC, its midpoint M of BC and Bm of AC, the two cut lines, the three pieces
 * and, at 180°, the rhombus N'N''MM'. Corners A, B and C are Geom handles, so
 * a pointer or the arrow keys can move them; the range input turns the pieces
 * through the applet's 0..185 degrees and the two checkboxes reproduce its
 * "names" and "hint" switches. Shapes are created once and only re-set on a
 * redraw, so a handle keeps its keyboard focus.
 */

(function () {
  const Core = HubertsDissectionCore;
  const statusEl = document.getElementById("status");
  const angleInput = document.getElementById("angle");
  const angleOut = document.getElementById("angleOut");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board("board");

  const layers = {
    fills: board.layer("fills"),
    guides: board.layer("guides"),
    sides: board.layer("sides"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** Status line; a demo has no winner, so it never takes win/lose classes. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const seed = state.A;
  const fillA = board.polygon([seed, seed, seed, seed], "piece piece-a", layers.fills);
  const fillB = board.polygon([seed, seed, seed], "piece piece-b", layers.fills);
  const fillFixed = board.polygon([seed, seed, seed], "piece piece-fixed", layers.fills);

  const cuts = [
    board.segment(seed, seed, "cut", layers.guides),
    board.segment(seed, seed, "cut", layers.guides),
  ];
  const median = board.segment(seed, seed, "median", layers.guides);
  const movingEdges = [
    board.polygon([seed, seed, seed, seed], "moving-edge", layers.sides),
    board.polygon([seed, seed, seed], "moving-edge", layers.sides),
  ];
  const rhombus = board.polygon([seed, seed, seed, seed], "rhombus", layers.sides);
  const triangleEdges = [
    board.segment(seed, seed, "side", layers.sides),
    board.segment(seed, seed, "side", layers.sides),
    board.segment(seed, seed, "side", layers.sides),
  ];
  const dots = [
    board.point(seed, "construction-dot", 4.5, layers.dots),
    board.point(seed, "construction-dot", 4.5, layers.dots),
    board.point(seed, "construction-dot", 4.5, layers.dots),
  ];
  // The hint's five (or six) spokes, from ShowHint() in the applet.
  const hints = [];
  for (let i = 0; i < 6; i++) hints.push(board.line(seed, seed, "hint", layers.guides));

  const labelKeys = {
    A: [-15, -12], B: [8, -12], C: [8, -10], M: [-18, 20], Bm: [-26, -12],
    N: [7, 18], Mm: [-22, 20], Np: [-28, -12], Bp: [8, -12],
    Npp: [8, -12], Ap: [8, -12],
  };
  const labels = {};
  for (const key of Object.keys(labelKeys)) {
    labels[key] = board.label(seed, key, "point-label",
      labelKeys[key][0], labelKeys[key][1], layers.labels);
  }

  const handles = {};
  for (const name of ["A", "B", "C"]) {
    handles[name] = board.handle(name, state[name], {
      r: 11,
      step: 4,
      shift: 5,
      cls: "geom-handle corner-handle",
      layer: layers.handles,
      label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move the triangle.`,
      describe: (p) => `at board position ${Math.round(p.x)}, ${Math.round(p.y)}.`,
      clamp: (p) => Core.clampPoint(p),
      onMove: (p, which) => apply({ type: "point", name: which, point: p }),
    });
  }

  function dist(p, q) { return Core.dist(p, q); }

  function draw() {
    const g = geometry;
    for (const name of ["A", "B", "C"]) handles[name].set(state[name]);

    triangleEdges[0].set(g.A, g.B);
    triangleEdges[1].set(g.B, g.C);
    triangleEdges[2].set(g.C, g.A);

    const good = g.good;
    fillA.show(good);
    fillB.show(good);
    fillFixed.show(good);
    cuts[0].show(good);
    cuts[1].show(good);
    for (const edge of movingEdges) edge.show(false);
    rhombus.show(false);
    median.show(!good);
    dots[2].show(false);

    if (good) {
      fillA.set(g.movingA);
      fillB.set(g.movingB);
      fillFixed.set(g.fixed);
      cuts[0].set(g.M, g.N);
      cuts[1].set(g.Bm, g.M);
      dots[0].set(g.M).show(true);
      dots[1].set(g.Bm).show(true);
      dots[2].set(g.N).show(true);
      if (state.angle > 0 && state.angle < 180) {
        movingEdges[0].set(g.movingA).show(true);
        movingEdges[1].set(g.movingB).show(true);
      }
      if (state.angle === 180) rhombus.set(g.rhombus).show(true);
    } else {
      median.set(g.A, g.M);
      dots[0].set(g.M).show(true);
      dots[1].set(g.Bm).show(true);
    }

    // ShowHint: B-M, M-C, C-Bm, Bm-A, and M-N plus B-A when the cut exists.
    const spokes = [
      [g.B, g.M], [g.M, g.C], [g.C, g.Bm], [g.Bm, g.A],
      good ? [g.M, g.N] : [g.A, g.M],
      good ? [g.B, g.A] : [g.C, g.M],
    ];
    spokes.forEach((spoke, i) => {
      hints[i].set(spoke[0], spoke[1]).show(state.showHint);
    });

    // ShowNames reproduces the applet's spacing tests before drawing a name.
    for (const key of Object.keys(labels)) labels[key].show(false);
    if (state.showNames) {
      labels.A.set(g.A).show(true);
      labels.B.set(g.B).show(true);
      labels.C.set(g.C).show(true);
      labels.M.set(g.M).show(true);
      labels.Bm.set(g.Bm).show(true);
      if (good) {
        if (dist(g.M, g.Mm) > 10) labels.Mm.set(g.Mm).show(true);
        if (dist(g.A, g.N) > 10 && dist(g.B, g.N) > 10) labels.N.set(g.N).show(true);
        if (dist(g.C, g.Ap) > 10 && dist(g.A, g.Ap) > 10) labels.Ap.set(g.Ap).show(true);
        if (dist(g.C, g.Bp) > 10 && dist(g.B, g.Bp) > 10) labels.Bp.set(g.Bp).show(true);
        if (dist(g.N, g.Np) > 10) labels.Np.set(g.Np).show(true);
        if (dist(g.N, g.Npp) > 10) labels.Npp.set(g.Npp).show(true);
      }
    }
  }

  /** Redraw, speak the picture and save the position for the record and tutor. */
  function render() {
    geometry = Core.compute(state);
    draw();
    say(Core.describe(state, geometry), Core.result(state));
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C,
        angle: state.angle, showNames: state.showNames, showHint: state.showHint,
        good: geometry.good, pieces: geometry.good ? geometry.rhombus : null,
      });
    }
  }

  /** Apply one core move; a refused move leaves the picture as it was. */
  function apply(m) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    return true;
  }

  function syncControls() {
    angleInput.value = String(state.angle);
    angleOut.textContent = `${state.angle}°`;
    namesBox.checked = state.showNames;
    hintBox.checked = state.showHint;
  }

  angleInput.addEventListener("input", () => {
    angleOut.textContent = `${angleInput.value}°`;
    apply({ type: "angle", value: Number(angleInput.value) });
  });
  namesBox.addEventListener("change", () => apply({ type: "option", key: "showNames", value: namesBox.checked }));
  hintBox.addEventListener("change", () => apply({ type: "option", key: "showHint", value: hintBox.checked }));
  resetBtn.addEventListener("click", () => {
    apply({ type: "reset" });
    syncControls();
  });

  // SVG colours are CSS classes, so a theme flip needs no geometry change.
  board.onTheme(() => draw());
  syncControls();
  render();
})();
