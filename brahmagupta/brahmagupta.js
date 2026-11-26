"use strict";

/*
 * The page for Brahmagupta: drawing and input only. The geometry is in
 * brahmagupta-core.js. The board is the applet's own 500x400 canvas: a circle
 * with two draggable points A and D. Their mirror points B and C, the crossing
 * T of the diagonals, the midpoint Q and the foot E are drawn from the core.
 * Drag either handle, or focus it and use the arrow keys; Reset starts over.
 */

(function () {
  const Core = BrahmaguptaCore;
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start();
  const initial = Core.configuration(state);

  const board = Geom.board(document.getElementById("board"));
  const circleLayer = board.layer("circle");
  const quadLayer = board.layer("quad");
  const diagonalLayer = board.layer("diagonals");
  const lineLayer = board.layer("construction");
  const marksLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const circle = board.circle(Core.CENTER, Core.RADIUS, "circumcircle", circleLayer);
  const quad = board.polygon([], "quad", quadLayer);
  const diagonalAC = board.segment(initial.A, initial.C, "diagonal", diagonalLayer);
  const diagonalBD = board.segment(initial.B, initial.D, "diagonal", diagonalLayer);
  const bisector = board.line(initial.E, initial.Q, "bisector", lineLayer);
  const pointT = board.point(initial.T, "construction-point", 4.5, marksLayer);
  const pointQ = board.point(initial.Q, "construction-point", 4.5, marksLayer);
  const pointE = board.point(initial.E, "construction-point", 4.5, marksLayer);
  const rightMark = board.rightAngle(initial.E, initial.Q, initial.D, 9, "right-mark", marksLayer);

  const letters = {};
  for (const name of ["A", "B", "C", "D", "T", "Q", "E"]) {
    letters[name] = board.label(initial[name], name, "point-label", -5, -9, labelLayer);
  }
  const sideLabels = {};
  for (const name of ["a", "b", "c", "d"]) {
    sideLabels[name] = board.label(initial.A, name, "side-label", 0, 0, labelLayer);
  }

  /** A line under the game. This illustration has no win or loss, so the
   *  three progress-tracker classes are never used here. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (n) => n.toFixed(1);
  const showPoint = (shape, p) => {
    if (p) shape.set(p).show(true);
    else shape.show(false);
  };
  const showLabel = (shape, p, dx, dy) => {
    if (p) shape.set(p, undefined, dx, dy).show(true);
    else shape.show(false);
  };

  function render() {
    const g = Core.configuration(state);
    const m = Core.formula(g);
    const ordered = Core.ordered(state);

    circle.set(g.center, g.r);
    quad.set([g.A, g.B, g.C, g.D]);
    diagonalAC.set(g.A, g.C);
    diagonalBD.set(g.B, g.D);
    if (g.T && g.E) bisector.set(g.E, g.Q).show(true);
    else bisector.show(false);
    showPoint(pointT, g.T);
    showPoint(pointQ, g.Q);
    showPoint(pointE, g.E);
    if (g.T && g.E) rightMark.set(g.E, g.Q, g.D, 9).show(true);
    else rightMark.show(false);

    const offsets = { A: [-16, -8], B: [-16, 16], C: [-16, 18], D: [8, -8],
      T: [8, -8], Q: [-18, 18], E: [8, -8] };
    for (const name of Object.keys(offsets)) showLabel(letters[name], g[name], offsets[name][0], offsets[name][1]);

    const sides = [["a", g.A, g.B], ["b", g.B, g.C], ["c", g.C, g.D], ["d", g.D, g.A]];
    for (const [name, p, q] of sides) {
      showLabel(sideLabels[name], Core.midpoint(p, q), 5, -6);
    }

    aHandle.set(g.A);
    dHandle.set(g.D);

    readoutEl.textContent =
      `a = ${fmt(m.a)}, b = ${fmt(m.b)}, c = ${fmt(m.c)}, d = ${fmt(m.d)}  ·  ` +
      `s = ${fmt(m.s)}  ·  area = ${fmt(m.measured)}  ·  formula = ${fmt(m.S)}`;

    if (!g.T || !g.E) {
      say("Two of the points have met. Drag one away to see the construction again.");
    } else if (!ordered) {
      say("The four corners have crossed over. Drag A or D until they go around the circle in order.");
    } else {
      say("The line from T through the middle Q of BC meets AD at E at a right angle, and the area matches Brahmagupta's formula.");
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const onCircle = (q) => Core.project(state, q);
  const aHandle = board.handle("A", state.A, {
    r: 13, step: 6, shift: 3, cls: "geom-handle handle-a", layer: handleLayer,
    label: "Point A. Drag it around the circle, or focus it and use the arrow keys to move it.",
    describe: (p) => `x ${Math.round(p.x)}, y ${Math.round(p.y)}`,
    clamp: onCircle,
    onMove: (p) => { state = Core.withPoint(state, "A", p); render(); },
  });
  const dHandle = board.handle("D", state.D, {
    r: 13, step: 6, shift: 3, cls: "geom-handle handle-d", layer: handleLayer,
    label: "Point D. Drag it around the circle, or focus it and use the arrow keys to move it.",
    describe: (p) => `x ${Math.round(p.x)}, y ${Math.round(p.y)}`,
    clamp: onCircle,
    onMove: (p) => { state = Core.withPoint(state, "D", p); render(); },
  });

  newBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  // The classes are styled by CSS, but this keeps any computed drawing in
  // step with the theme before the first paint and when the OS theme flips.
  board.onTheme(render);

  render();
})();
