"use strict";

/*
 * de Villiers 2 — drawing and input only.  All geometry is in
 * de-villiers-2-core.js: four corners on a circle, the tangents at them, the
 * quadrilateral those tangents make, the perpendicular bisectors of its sides,
 * and the second quadrilateral those bisectors make.  Shapes are made once and
 * only updated on a redraw, so a handle keeps keyboard focus.  The four Show
 * boxes follow the applet: they are disabled until Primary or Secondary is on.
 */

(function () {
  const Core = DeVilliers2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const boxes = {
    names: document.getElementById("names"),
    angles: document.getElementById("angles"),
    diagonals: document.getElementById("diagonals"),
    joints: document.getElementById("joints"),
    primary: document.getElementById("primary"),
    secondary: document.getElementById("secondary"),
  };
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();
  const showKeys = ["names", "angles", "diagonals", "joints"];

  /* Layers, back to front. */
  const back = board.layer("circle");
  const guides = board.layer("guides");
  const mainLayer = board.layer("main");
  const stepLayer = board.layer("step");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const circum = board.circle(state.circle.c, state.circle.r, "circum", back);

  /* Eight light tangent rays from a corner to the two nearby intersections. */
  const raySpecs = [
    [0, 0], [0, 3], [1, 1], [1, 0], [2, 2], [2, 1], [3, 3], [3, 2],
  ];
  const rays = raySpecs.map(() => board.segment(state.A, state.B, "tangent-ray", guides));
  const mainPoly = board.polygon([state.A, state.B, state.C, state.D], "main-poly", mainLayer);
  const mainDiags = [
    board.line(state.A, state.B, "diag-main", guides),
    board.line(state.A, state.B, "diag-main", guides),
  ];
  const origDiags = [
    board.line(state.A, state.B, "diag-original", guides),
    board.line(state.A, state.B, "diag-original", guides),
  ];
  const bisectors = [0, 1, 2, 3].map(() => board.line(state.A, state.B, "bisector", guides));
  const midDots = [0, 1, 2, 3].map(() => board.point(state.A, "mid-dot", 2.6, marks));
  const mainDots = [0, 1, 2, 3].map(() => board.point(state.A, "main-dot", 3.4, marks));
  const stepDots = [0, 1, 2, 3].map(() => board.point(state.A, "step-dot", 3.4, marks));

  const mainBisectors = [0, 1, 2, 3].map(() => board.line(state.A, state.B, "angle-main", guides));
  const stepBisectors = [0, 1, 2, 3].map(() => board.line(state.A, state.B, "angle-step", guides));
  const stepPoly = board.polygon([state.A, state.B, state.C, state.D], "step-poly", stepLayer);
  const stepDiags = [
    board.line(state.A, state.B, "diag-step", guides),
    board.line(state.A, state.B, "diag-step", guides),
  ];
  const mainIncircle = board.circle(state.circle.c, state.circle.r, "incircle", mainLayer);
  const stepIncircle = board.circle(state.circle.c, state.circle.r, "incircle", stepLayer);
  const mainFeet = [0, 1, 2, 3].map(() => board.point(state.A, "touch-dot", 3, marks));
  const stepFeet = [0, 1, 2, 3].map(() => board.point(state.A, "touch-dot", 3, marks));

  const labelKeys = ["A", "B", "C", "D"];
  const cornerLabels = labelKeys.map((key, i) => board.label(state[key], key, "point-label", 8, -8, labels));
  const mainLabels = labelKeys.map((key) => board.label(state.A, key + "₁", "point-label", 7, -8, labels));
  const stepNames = ["D₁", "A₁", "B₁", "C₁"]; // GetIterate names them this way
  const stepLabels = stepNames.map((key) => board.label(state.A, key, "point-label", 7, 14, labels));

  const handles = {};
  for (const key of labelKeys) {
    handles[key] = board.handle(key, state[key], {
      r: 11, step: 3, shift: 9, layer: top,
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to slide it around the circle.`,
      clamp: (p) => Core.onCircle(p, state.circle),
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

  function angleBisectorLines(quad, shapes) {
    for (let i = 0; i < 4; i++) {
      const foot = Core.bisectorFoot(quad[i], quad[(i + 1) % 4], quad[(i + 3) % 4]);
      if (foot) shapes[i].set(quad[i], foot).show(true);
      else shapes[i].show(false);
    }
  }

  function render() {
    const g = Core.geometry(state);
    const enabled = Core.showEnabled(state);
    const o = state.options;
    for (const key of showKeys) {
      boxes[key].disabled = !enabled;
      boxes[key].checked = o[key];
    }
    boxes.primary.checked = o.primary;
    boxes.secondary.checked = o.secondary;
    for (const key of labelKeys) {
      handles[key].set(state[key]);
      cornerLabels[labelKeys.indexOf(key)].set(state[key]);
    }

    if (!g) {
      for (const shape of [circum, mainPoly, stepPoly, mainIncircle, stepIncircle]
        .concat(rays, mainDiags, origDiags, bisectors, midDots, mainDots, stepDots,
          mainBisectors, stepBisectors, stepDiags, mainFeet, stepFeet,
          cornerLabels, mainLabels, stepLabels)) shape.show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ A: state.A, B: state.B, C: state.C, D: state.D, options: o });
      return;
    }

    const m = g.main, s = g.step;
    circum.show(true).set(g.circle.c, g.circle.r);
    for (let i = 0; i < rays.length; i++) {
      const [corner, vertex] = raySpecs[i];
      rays[i].set(state[labelKeys[corner]], m[vertex]).show(true);
    }
    mainPoly.show(true).set(m);
    mainDots.forEach((dot, i) => dot.set(m[i]).show(true));
    stepPoly.show(true).set(s);
    stepDots.forEach((dot, i) => dot.set(s[i]).show(true));

    g.bisectors.forEach((line, i) => {
      bisectors[i].set(line.p1, line.p2).show(true);
      midDots[i].set(line.p1).show(true);
    });

    mainDiags[0].set(m[0], m[2]).show(o.diagonals && o.primary);
    mainDiags[1].set(m[1], m[3]).show(o.diagonals && o.primary);
    origDiags[0].set(state.A, state.C).show(o.joints && o.primary);
    origDiags[1].set(state.B, state.D).show(o.joints && o.primary);
    stepDiags[0].set(s[0], s[2]).show(o.diagonals && o.secondary);
    stepDiags[1].set(s[1], s[3]).show(o.diagonals && o.secondary);

    if (o.angles && o.primary) angleBisectorLines(m, mainBisectors);
    else mainBisectors.forEach((shape) => shape.show(false));
    if (o.angles && o.secondary) angleBisectorLines(s, stepBisectors);
    else stepBisectors.forEach((shape) => shape.show(false));

    mainIncircle.show(false); // the applet never draws an incircle in primary mode
    mainFeet.forEach((dot) => dot.show(false));
    if (o.joints && o.secondary) {
      stepIncircle.set(g.stepIncircle.c, g.stepIncircle.r).show(true);
      stepFeet.forEach((dot, i) => dot.set(g.stepIncircle.feet[i]).show(true));
    } else {
      stepIncircle.show(false);
      stepFeet.forEach((dot) => dot.show(false));
    }

    cornerLabels.forEach((label, i) => label.set(state[labelKeys[i]]).show(true));
    mainLabels.forEach((label, i) => label.set(m[i]).show(o.names && o.primary));
    stepLabels.forEach((label, i) => label.set(s[i]).show(o.names && o.secondary));

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C, D: state.D,
        circle: g.circle, main: m, step: s,
        options: o, claims: g.claims, measures: g.measures,
      });
    }
  }

  for (const key of showKeys) {
    boxes[key].addEventListener("change", () => {
      if (boxes[key].disabled) return;
      state = Core.setOption(state, key, boxes[key].checked);
      render();
    });
  }
  for (const key of ["primary", "secondary"]) {
    boxes[key].addEventListener("change", () => {
      state = Core.setOption(state, key, boxes[key].checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
