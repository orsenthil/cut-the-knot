"use strict";

/*
 * ABOnCircumcircle — the drawing and input, with all the geometry in
 * ab-on-circumcircle-core.js.  A, B and C are draggable; the circumcircle,
 * the three bisectors, their second meetings D, E, F with the circle, the
 * incenter I and M = AD ∩ EF are redrawn from the core on every move.  The
 * two checkboxes reproduce the applet's "show" options, and Reset restores
 * its starting triangle.
 */

(function () {
  const Core = AbOnCircumcircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const statementBox = document.getElementById("statement");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front: circle, triangle, bisectors, angle marks, dots,
   * names, then the handles that stay on top and keep keyboard focus. */
  const back = board.layer("back");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const circum = board.circle({ x: 200, y: 150 }, 100, "circum", back);
  const sides = [
    board.segment(state.A, state.B, "side", guides),
    board.segment(state.B, state.C, "side", guides),
    board.segment(state.C, state.A, "side", guides),
  ];
  const bisectors = [
    board.segment(state.A, state.A, "bisector", guides),
    board.segment(state.B, state.B, "bisector", guides),
    board.segment(state.C, state.C, "bisector", guides),
  ];
  const chordEF = board.segment(state.A, state.B, "chord", guides);
  const corners = [
    board.rightAngle(state.A, state.A, state.B, 13, "corner", marks),
    board.rightAngle(state.A, state.A, state.B, 13, "corner", marks),
    board.rightAngle(state.A, state.A, state.B, 13, "corner", marks),
    board.rightAngle(state.A, state.A, state.B, 13, "corner", marks),
  ];
  // The article's angle chase, exactly as it is written on the old page.
  const angles = [
    board.angleArc(state.A, state.A, state.B, 18, "angle-b", marks),  // ∠CFE
    board.angleArc(state.A, state.A, state.B, 18, "angle-b", marks),  // ∠CBE
    board.angleArc(state.A, state.A, state.B, 24, "angle-half", marks), // ∠CAI
    board.angleArc(state.A, state.A, state.B, 24, "angle-half", marks), // ∠ACI
    board.angleArc(state.A, state.A, state.B, 30, "angle-fim", marks),  // ∠IFM
    board.angleArc(state.A, state.A, state.B, 30, "angle-fim", marks),  // ∠FIM
  ];
  const dotD = board.point(state.A, "arc-point", 4, dots);
  const dotE = board.point(state.A, "arc-point", 4, dots);
  const dotF = board.point(state.A, "arc-point", 4, dots);
  const dotM = board.point(state.A, "cross-point", 4, dots);
  const dotI = board.point(state.A, "incenter", 4, dots);

  const labels = {};
  for (const key of ["A", "B", "C", "D", "E", "F", "M", "I"]) {
    const dx = key === "D" || key === "E" || key === "F" ? 8 : -14;
    const dy = key === "I" ? 18 : -12;
    labels[key] = board.label(state.A, key, "point-label", dx, dy, names);
  }

  const options = {
    label: "Point A. Drag it, or focus it and use the arrow keys to move the triangle.",
    step: 5, shift: 15, r: 9, layer: top,
    clamp: (p) => Core.clamp(p),
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

    if (!g) {
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    circum.set(g.circle.c, g.circle.r);
    sides[0].set(g.A, g.B);
    sides[1].set(g.B, g.C);
    sides[2].set(g.C, g.A);
    bisectors[0].set(g.A, g.D);
    bisectors[1].set(g.B, g.E);
    bisectors[2].set(g.C, g.F);
    chordEF.set(g.E, g.F);

    dotD.set(g.D);
    dotE.set(g.E);
    dotF.set(g.F);
    dotM.set(g.M);
    dotI.set(g.I);
    for (const key of ["A", "B", "C", "D", "E", "F", "M", "I"]) labels[key].set(g[key]);
    for (const key of Object.keys(labels)) labels[key].show(state.options.names);

    // Right-angle corners at M: ∠AME, ∠AMF, ∠DME and ∠DMF.
    corners[0].set(g.M, g.A, g.E, 13);
    corners[1].set(g.M, g.A, g.F, 13);
    corners[2].set(g.M, g.D, g.E, 13);
    corners[3].set(g.M, g.D, g.F, 13);
    for (const c of corners) c.show(state.options.statement);

    // The hint: equal inscribed angles, then the triangle FIM.
    angles[0].set(g.F, g.C, g.E, 18);
    angles[1].set(g.B, g.C, g.E, 18);
    angles[2].set(g.A, g.C, g.I, 24);
    angles[3].set(g.C, g.A, g.I, 24);
    angles[4].set(g.F, g.I, g.M, 30);
    angles[5].set(g.I, g.F, g.M, 30);
    for (const a of angles) a.show(state.options.hint);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, E: g.E, F: g.F,
        I: g.I, M: g.M, circle: g.circle, options: state.options,
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
  toggle("statement", statementBox);
  toggle("hint", hintBox);
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
