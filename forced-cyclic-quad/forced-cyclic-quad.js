"use strict";

/*
 * Forced Cyclic Quadrilateral — drawing and input only.  The geometry is in
 * forced-cyclic-quad-core.js: four draggable corners on a circle, the two rays
 * turned by the add-on angle, their meetings E and F with the base line BC,
 * and the circle forced through A, E, F and D.  Every SVG object is created
 * once and only updated on a redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = ForcedCyclicQuadCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const angleInput = document.getElementById("angle");
  const boxes = {
    names: document.getElementById("names"),
    premise: document.getElementById("premise"),
    statement: document.getElementById("statement"),
  };

  let state = Core.start();

  /* Layers, back to front. */
  const back = board.layer("circles");
  const guides = board.layer("guides");
  const solid = board.layer("solid");
  const dashed = board.layer("dashed");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const givenCircle = board.circle(Core.CENTER, Core.RADIUS, "given-circle", back);
  const newCircle = board.circle(Core.CENTER, 1, "new-circle", back);
  const baseLine = board.line(Core.CENTER, Core.CENTER, "base-line", guides);

  /* The eight solid edges the applet draws. */
  const edgeKeys = [
    ["A", "E"], ["A", "B"], ["A", "C"], ["A", "D"],
    ["D", "F"], ["D", "C"], ["D", "B"], ["E", "F"],
  ];
  const solidEdges = edgeKeys.map(() => board.segment(Core.CENTER, Core.CENTER, "edge", solid));
  const dashedEdges = [
    board.segment(Core.CENTER, Core.CENTER, "hidden-edge", dashed),
    board.segment(Core.CENTER, Core.CENTER, "hidden-edge", dashed),
  ];
  const eDot = board.point(Core.CENTER, "extra-point", 4, dots);
  const fDot = board.point(Core.CENTER, "extra-point", 4, dots);

  const premiseArcs = [
    board.angleArc(Core.CENTER, Core.CENTER, Core.CENTER, 14, "premise-arc", marks),
    board.angleArc(Core.CENTER, Core.CENTER, Core.CENTER, 14, "premise-arc", marks),
  ];
  const statementArcs = [
    board.angleArc(Core.CENTER, Core.CENTER, Core.CENTER, 20, "statement-arc", marks),
    board.angleArc(Core.CENTER, Core.CENTER, Core.CENTER, 20, "statement-arc", marks),
  ];

  const labelOffsets = {
    A: [-13, -9], B: [7, -9], C: [8, -9], D: [8, 14], E: [-14, -9], F: [8, 14],
  };
  const labels = {};
  for (const name of ["A", "B", "C", "D", "E", "F"]) {
    const [dx, dy] = labelOffsets[name];
    labels[name] = board.label(Core.CENTER, name, "point-label", dx, dy, names);
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, Core.pointAt(state.angles[name]), {
      step: 3, shift: 9, r: 9, layer: top,
      clamp: (p) => Core.clamp(p),
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to slide it around the circle.`,
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
    const p = g.valid ? g : Core.points(state);
    for (const name of Core.NAMES) handles[name].set(p[name]);
    angleInput.value = String(state.angle);

    givenCircle.set(Core.CENTER, Core.RADIUS);
    if (!g.valid) {
      newCircle.show(false);
      baseLine.show(false);
      for (const s of solidEdges.concat(dashedEdges, premiseArcs, statementArcs,
        [eDot, fDot])) s.show(false);
      for (const name of Object.keys(labels)) labels[name].show(false);
      say(g.reason, state.explored ? "done" : null);
      if (window.Track) window.Track.state({ points: p, angle: state.angle, valid: false });
      return;
    }

    newCircle.show(true).set(g.circle.c, g.circle.r);
    baseLine.show(true).set(g.B, g.C);
    const byName = { A: g.A, B: g.B, C: g.C, D: g.D, E: g.E, F: g.F };
    solidEdges.forEach((s, i) => s.show(true).set(byName[edgeKeys[i][0]], byName[edgeKeys[i][1]]));
    dashedEdges[0].show(true).set(g.A, g.F);
    dashedEdges[1].show(true).set(g.D, g.E);

    eDot.show(true).set(g.E);
    fDot.show(true).set(g.F);

    premiseArcs[0].show(state.options.premise).set(g.A, g.B, g.E, 14);
    premiseArcs[1].show(state.options.premise).set(g.D, g.C, g.F, 14);
    statementArcs[0].show(state.options.statement).set(g.A, g.C, g.F, 20);
    statementArcs[1].show(state.options.statement).set(g.D, g.B, g.E, 20);

    for (const name of ["A", "B", "D", "E", "F"]) {
      labels[name].show(state.options.names).set(byName[name], name,
        labelOffsets[name][0], labelOffsets[name][1]);
    }
    labels.C.show(state.options.names && Core.dist(g.B, g.C) > 10)
      .set(g.C, "C", labelOffsets.C[0], labelOffsets.C[1]);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, E: g.E, F: g.F,
        circle: g.circle, angle: state.angle, options: state.options,
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

  angleInput.min = String(Core.ANGLE_MIN);
  angleInput.max = String(Core.ANGLE_MAX);
  angleInput.step = "0.1";
  angleInput.addEventListener("change", () => {
    state = Core.setAngle(state, angleInput.value);
    render();
  });
  document.getElementById("less").addEventListener("click", () => {
    state = Core.nudgeAngle(state, -0.1);
    render();
  });
  document.getElementById("more").addEventListener("click", () => {
    state = Core.nudgeAngle(state, 0.1);
    render();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = Core.reset(state);
    for (const key of Object.keys(boxes)) boxes[key].checked = state.options[key];
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
