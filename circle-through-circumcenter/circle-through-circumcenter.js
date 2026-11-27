"use strict";

/*
 * Circle Through Circumcenter — the drawing and input, with all the geometry
 * in circle-through-circumcenter-core.js.  A, B and C are draggable; the
 * circumcircle, the circle through B, O and C, the chord PQ and the line AO
 * are redrawn from the core on every move.  The four checkboxes reproduce the
 * applet's "show" options, and Reset restores its starting triangle.
 */

(function () {
  const Core = CircleThroughCircumcenterCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const premisesBox = document.getElementById("premises");
  const statementBox = document.getElementById("statement");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front: circles, guides, angle marks, dots, names, then
   * the handles that stay on top and keep keyboard focus. */
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const circum = board.circle(state.A, 100, "circum", circles);
  const secondCircle = board.circle(state.A, 100, "second-circle", circles);
  const sides = [
    board.segment(state.A, state.B, "side", guides),
    board.segment(state.B, state.C, "side", guides),
    board.segment(state.C, state.A, "side", guides),
  ];
  const aoLine = board.line(state.A, state.A, "ao", guides);
  const chord = board.segment(state.A, state.A, "chord", guides);
  const radii = [
    board.segment(state.A, state.A, "premise", guides),
    board.segment(state.A, state.A, "premise", guides),
    board.segment(state.A, state.A, "premise", guides),
  ];
  const corner = board.rightAngle(state.A, state.A, state.B, 13, "corner", marks);
  // The article's angle chase: ∠BCA = ∠BCQ = ∠BPQ = ∠APQ, and ∠BAO.
  const hintArcs = [
    board.angleArc(state.C, state.B, state.A, 22, "hint-equal", marks),
    board.angleArc(state.C, state.B, state.A, 22, "hint-equal", marks),
    board.angleArc(state.A, state.A, state.B, 24, "hint-equal", marks),
    board.angleArc(state.A, state.B, state.A, 26, "hint-complement", marks),
    board.angleArc(state.A, state.A, state.B, 30, "hint-centre", marks),
  ];
  const derived = {
    O: board.point(state.A, "circumcenter", 5, dots),
    P: board.point(state.A, "second-point", 4, dots),
    Q: board.point(state.A, "second-point", 4, dots),
    J: board.point(state.A, "second-point", 3.5, dots),
    X: board.point(state.A, "cross-point", 4, dots),
  };
  const labels = {};
  for (const key of ["A", "B", "C", "P", "Q", "O", "J", "X"]) {
    const dx = key === "B" || key === "P" ? -16 : 8;
    const dy = key === "A" ? -12 : (key === "O" || key === "X" ? 18 : -10);
    labels[key] = board.label(state.A, key, "point-label", dx, dy, names);
  }

  const options = {
    step: 5, shift: 15, r: 9, layer: top,
    clamp: (p) => Core.clamp(p),
    label: "Drag this corner, or focus it and use the arrow keys to move the triangle.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  };
  const handles = {
    A: board.handle("A", state.A, Object.assign({}, options, { onMove: (p, name) => {
      state = Core.move(state, name, p);
      render();
    } })),
    B: board.handle("B", state.B, Object.assign({}, options, { onMove: (p, name) => {
      state = Core.move(state, name, p);
      render();
    } })),
    C: board.handle("C", state.C, Object.assign({}, options, { onMove: (p, name) => {
      state = Core.move(state, name, p);
      render();
    } })),
  };

  /** `#status` is how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);
    sides[0].set(state.A, state.B);
    sides[1].set(state.B, state.C);
    sides[2].set(state.C, state.A);

    if (!g) {
      // A right angle at A puts B, O and C on one line: no circle through them.
      circum.show(false);
      secondCircle.show(false);
      aoLine.show(false);
      chord.show(false);
      for (const s of radii) s.show(false);
      corner.show(false);
      for (const a of hintArcs) a.show(false);
      for (const key of Object.keys(derived)) derived[key].show(false);
      for (const key of ["P", "Q", "O", "J", "X"]) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    circum.set(g.circumcircle.c, g.circumcircle.r);
    secondCircle.set(g.circle.c, g.circle.r);
    aoLine.set(g.A, g.O);
    chord.set(g.P, g.Q);
    for (const key of Object.keys(derived)) derived[key].set(g[key]);
    for (const key of Object.keys(derived)) derived[key].show(true);

    // Premises: the centre joined to the midpoints of the three sides.
    const mids = [Core.midpoint(g.B, g.C), Core.midpoint(g.C, g.A), Core.midpoint(g.A, g.B)];
    for (let i = 0; i < 3; i++) {
      radii[i].set(g.O, mids[i]);
      radii[i].show(state.options.premises);
    }

    // The right angle at X, between XP and XA.
    corner.set(g.X, g.P, g.A, 13);
    corner.show(state.options.statement);

    hintArcs[0].set(g.C, g.B, g.Q, 22);
    hintArcs[1].set(g.P, g.A, g.Q, 22);
    hintArcs[2].set(g.P, g.B, g.Q, 24);
    hintArcs[3].set(g.A, g.B, g.O, 26);
    hintArcs[4].set(g.O, g.A, g.B, 30);
    for (const a of hintArcs) a.show(state.options.hint);

    for (const key of ["A", "B", "C", "P", "Q", "O", "J", "X"]) {
      labels[key].set(g[key]);
      labels[key].show(state.options.names);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, O: g.O, P: g.P, Q: g.Q, J: g.J, X: g.X,
        circumcircle: g.circumcircle, circle: g.circle, options: state.options,
      });
    }
  }

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("names", namesBox);
  toggle("hint", hintBox);
  toggle("premises", premisesBox);
  toggle("statement", statementBox);
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
