"use strict";

/*
 * Antiparallel — the drawing and input, with all the geometry in
 * antiparallel-core.js. A, B, C and the circle's centre P are draggable;
 * the circle, its two extra cuts D and E, the chord DE and the equal-angle
 * marks are redrawn from the core on every move. P slides along the dashed
 * perpendicular bisector of AB. The two checkboxes reproduce the applet's
 * "names" and "hint" options; Reset restores the starting picture.
 */

(function () {
  const Core = AntiparallelCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front: circle and extended sides, triangle and chord,
   * angle marks, cuts and labels, then the handles that keep keyboard focus. */
  const back = board.layer("back");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const axis = board.line(state.A, state.B, "axis", back);
  const circle = board.circle(state.P, 100, "circle", back);
  const extAC = board.line(state.A, state.C, "ext", back);
  const extBC = board.line(state.B, state.C, "ext", back);
  const sides = [
    board.segment(state.A, state.B, "side", guides),
    board.segment(state.B, state.C, "side", guides),
    board.segment(state.C, state.A, "side", guides),
  ];
  const chord = board.segment(state.D || state.A, state.E || state.B, "chord", guides);

  // The two pairs of equal angles: E with B, and D with A.
  const angleE = board.angleArc(state.A, state.B, state.C, 17, "angle-one", marks);
  const angleB = board.angleArc(state.A, state.B, state.C, 17, "angle-one", marks);
  const angleD = board.angleArc(state.A, state.B, state.C, 24, "angle-two", marks);
  const angleA = board.angleArc(state.A, state.B, state.C, 24, "angle-two", marks);

  const cutD = board.point(state.A, "cut", 4.5, dots);
  const cutE = board.point(state.A, "cut", 4.5, dots);
  const centreDot = board.point(state.P, "centre", 3, dots);
  const labelMap = {};
  for (const key of ["A", "B", "C", "D", "E", "P"]) {
    labelMap[key] = board.label(state.A, key, "point-label",
      key === "D" || key === "E" ? 9 : -14, key === "P" ? 19 : -11, labels);
  }

  const opts = {
    step: 5, shift: 15, r: 9, layer: top,
    clamp: (p) => Core.clamp(p),
    label: "Drag this point, or focus it and use the arrow keys to move it.",
  };
  const handles = {};
  for (const name of ["A", "B", "C"]) {
    handles[name] = board.handle(name, state[name], Object.assign({}, opts, {
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      onMove: (p) => {
        state = Core.move(state, name, p);
        render();
      },
    }));
  }
  handles.P = board.handle("P", state.P, Object.assign({}, opts, {
    label: "Point P, the centre of the circle. Drag it along the dashed line, or focus it and use the arrow keys.",
    clamp: (p) => Core.clamp(Core.projectOnAxis(p, state.A, state.B)),
    onMove: (p) => {
      state = Core.move(state, "P", p);
      render();
    },
  }));

  /** The status line is also how the player's record sees a finished look. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const drawn = [axis, circle, extAC, extBC, chord, cutD, cutE, centreDot,
    angleE, angleB, angleD, angleA];

  function render() {
    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);
    handles.P.set(state.P);

    const g = Core.geometry(state);
    for (const thing of drawn) thing.show(!!g);
    for (const side of sides) side.show(!!g);
    for (const key of Object.keys(labelMap)) labelMap[key].show(!!g && state.options.names);

    if (g) {
      const dir = Core.unit(Core.sub(g.B, g.A));
      const perp = Core.point(-dir.y, dir.x);
      axis.set(g.M, Core.add(g.M, perp));
      circle.set(g.circle.c, g.circle.r);
      extAC.set(g.A, g.C);
      extBC.set(g.B, g.C);
      sides[0].set(g.A, g.B);
      sides[1].set(g.B, g.C);
      sides[2].set(g.C, g.A);
      chord.set(g.D, g.E);
      cutD.set(g.D);
      cutE.set(g.E);
      centreDot.set(g.P);

      // ∠DEC equals ∠ABC and ∠EDC equals ∠BAC, in the reversed order.
      angleE.set(g.E, g.C, g.D, 17);
      angleB.set(g.B, g.A, g.C, 17);
      angleD.set(g.D, g.C, g.E, 24);
      angleA.set(g.A, g.C, g.B, 24);
      for (const [shape, on] of [[angleE, state.options.hint], [angleB, state.options.hint],
        [angleD, state.options.hint], [angleA, state.options.hint]]) shape.show(on);

      labelMap.A.set(g.A);
      labelMap.B.set(g.B);
      labelMap.C.set(g.C);
      labelMap.D.set(g.D);
      labelMap.E.set(g.E);
      labelMap.P.set(g.P);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state(g
        ? { A: g.A, B: g.B, C: g.C, P: g.P, D: g.D, E: g.E,
            circle: g.circle, options: state.options }
        : { A: state.A, B: state.B, C: state.C, P: state.P, options: state.options });
    }
  }

  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
