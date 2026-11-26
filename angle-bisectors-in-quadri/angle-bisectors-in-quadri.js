"use strict";

/*
 * Angle Bisectors in a Quadrilateral — drawing and input only.  The geometry
 * is in angle-bisectors-in-quadri-core.js: four draggable corners A,B,C,D,
 * the bisectors of angles CAD, CBD at X and of ACB, ADB at Y, and the
 * collinear points U = AX ∩ DY, V = BX ∩ CY, G = AC ∩ BD.  Shapes are
 * created once and only updated on a redraw, so a handle keeps keyboard
 * focus.  The circle appears exactly when the applet would draw it.
 */

(function () {
  const Core = AngleBisectorsInQuadriCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = {
    angles: document.getElementById("angles"),
    names: document.getElementById("names"),
    extra: document.getElementById("extra"),
  };

  let state = Core.start();

  /* Layers, back to front. */
  const back = board.layer("back");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const circle = board.circle(state.A, 1, "circum", back);
  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", guides);
  const diagonals = [
    board.segment(state.A, state.C, "diag", guides),
    board.segment(state.B, state.D, "diag", guides),
  ];
  const bisectors = [
    board.line(state.A, state.X || state.B, "bisector", guides),
    board.line(state.B, state.X || state.A, "bisector", guides),
    board.line(state.C, state.Y || state.D, "bisector", guides),
    board.line(state.D, state.Y || state.C, "bisector", guides),
  ];
  const arcs = [
    board.angleArc(state.A, state.D, state.C, 18, "angle-mark", marks),
    board.angleArc(state.B, state.D, state.C, 18, "angle-mark", marks),
    board.angleArc(state.C, state.A, state.B, 18, "angle-mark", marks),
    board.angleArc(state.D, state.A, state.B, 18, "angle-mark", marks),
  ];
  const xyDots = [board.point(state.A, "construction-point", 4, dots),
    board.point(state.B, "construction-point", 4, dots)];
  const uvGDots = [board.point(state.A, "extra-point", 4, dots),
    board.point(state.B, "extra-point", 4, dots),
    board.point(state.C, "extra-point", 4, dots)];
  const labelKeys = ["A", "B", "C", "D", "X", "Y", "U", "V", "G"];
  const labels = {};
  for (const key of labelKeys) {
    labels[key] = board.label(state.A, key, "point-label", 8, -8, names);
  }

  const handleOptions = {
    step: 5, shift: 15, r: 9, layer: top,
    clamp: (p) => Core.clamp(p),
    label: "Corner. Drag it, or focus it and use the arrow keys to move the quadrilateral.",
  };
  const handles = {};
  for (const key of ["A", "B", "C", "D"]) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to move the quadrilateral.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    }));
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of ["A", "B", "C", "D"]) handles[key].set(state[key]);

    if (!g) {
      circle.show(false);
      quad.show(false);
      for (const s of diagonals.concat(bisectors, arcs, xyDots, uvGDots)) s.show(false);
      for (const key of labelKeys) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ A: state.A, B: state.B, C: state.C, D: state.D, options: state.options });
      return;
    }

    quad.show(true).set([g.A, g.B, g.C, g.D]);
    diagonals[0].set(g.A, g.C);
    diagonals[1].set(g.B, g.D);
    bisectors[0].set(g.A, g.X);
    bisectors[1].set(g.B, g.X);
    bisectors[2].set(g.C, g.Y);
    bisectors[3].set(g.D, g.Y);
    circle.show(g.appletCyclic).set(g.circle.c, g.circle.r);
    for (const s of diagonals.concat(bisectors)) s.show(true);

    arcs[0].set(g.A, g.D, g.C, 18);
    arcs[1].set(g.B, g.D, g.C, 18);
    arcs[2].set(g.C, g.A, g.B, 18);
    arcs[3].set(g.D, g.A, g.B, 18);
    for (const a of arcs) a.show(state.options.angles);

    xyDots[0].set(g.X);
    xyDots[1].set(g.Y);
    for (const d of xyDots) d.show(true);
    uvGDots[0].set(g.U);
    uvGDots[1].set(g.V);
    uvGDots[2].set(g.G);
    for (const d of uvGDots) d.show(state.options.extra);

    labels.A.set(g.A); labels.B.set(g.B); labels.C.set(g.C); labels.D.set(g.D);
    labels.X.set(g.X); labels.Y.set(g.Y);
    labels.U.set(g.U); labels.V.set(g.V); labels.G.set(g.G);
    for (const key of ["A", "B", "C", "D", "X", "Y"]) labels[key].show(state.options.names);
    for (const key of ["U", "V", "G"]) labels[key].show(state.options.names && state.options.extra);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D,
        X: g.X, Y: g.Y, U: g.U, V: g.V, G: g.G,
        circle: g.circle, options: state.options, claims: g.claims,
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
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
