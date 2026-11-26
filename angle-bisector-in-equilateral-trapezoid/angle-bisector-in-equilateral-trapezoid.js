"use strict";

/*
 * The page for Angle Bisector in an Equilateral Trapezoid: drawing and input
 * only; the theorem and the construction live in the core. An SVG holds the
 * isosceles trapezoid on its circumcircle, the point G inside BCD, the second
 * crossings P and Q, the horizontal through G meeting BD and BC at R and S,
 * and the circle through P, Q, R, S when the two halves of angle CBD match.
 * A, B, C, D and G are draggable; the two radio modes reproduce the applet's
 * "Move points" (vertices glide on the circle) and "Adjust circle" (vertices
 * move freely) boxes, and the hint box is unlocked exactly as in the applet.
 */

(function () {
  const Core = AngleBisectorInEquilateralTrapezoidCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const bisectorBtn = document.getElementById("bisectorBtn");
  const offBtn = document.getElementById("offBtn");
  const hintBox = document.getElementById("hint");
  const namesBox = document.getElementById("names");
  const modeInputs = document.querySelectorAll('input[name="mode"]');

  let state = Core.start({});

  /* Back to front: shapes first, then the point names, then the handles so
   * keyboard focus stays on the dot that was moved. */
  const fill = board.layer("fill");
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const quad = board.layer("quad");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const trapezoidShape = board.polygon([state.A, state.B, state.C, state.D], "trapezoid", fill);
  const circum = board.circle(state.A, 1, "circumcircle", circles);
  const pqrsCircle = board.circle(state.A, 1, "pqrs-circle", circles);

  const sides = [
    board.segment(state.A, state.B, "side", guides),
    board.segment(state.B, state.C, "side", guides),
    board.segment(state.C, state.D, "side", guides),
    board.segment(state.D, state.A, "side", guides),
  ];
  const diagonal = board.segment(state.B, state.D, "diagonal", guides);
  const rayA = board.segment(state.A, state.G, "ray", guides);
  const rayB = board.segment(state.B, state.G, "ray", guides);
  const parallel = board.line(state.G, state.A, "parallel", guides);
  const hintLines = [
    board.segment(state.B, state.C, "hint-line", guides),
    board.segment(state.B, state.D, "hint-line", guides),
    board.segment(state.Q || state.A, state.C, "hint-line", guides),
  ];
  const quadShape = board.polygon([state.A, state.B, state.C, state.D], "pqrs", quad);

  const dots = {};
  for (const name of ["P", "Q", "R", "S", "T"]) {
    dots[name] = board.point(state.G, name === "T" ? "hint-dot" : "constructed-dot", 4, marks);
  }
  const halfArcs = [
    board.angleArc(state.B, state.C, state.G, 24, "half-arc", marks),
    board.angleArc(state.B, state.G, state.D, 24, "half-arc alt", marks),
  ];

  const offsets = {
    A: [-14, 22], B: [8, 22], C: [10, -10], D: [-16, -10], G: [8, -8],
    P: [-16, -8], Q: [8, -8], R: [8, 16], S: [-16, 16], T: [8, 16],
  };
  const text = {};
  for (const name of ["A", "B", "C", "D", "G", "P", "Q", "R", "S", "T"]) {
    text[name] = board.label(state.G, name, "pt-label", 8, -8, labels);
  }

  /** `#status` is also how the player's record sees a finished exploration. */
  function say(textLine, kind) {
    statusEl.textContent = textLine;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function place(name, p, show) {
    const label = text[name];
    label.show(Boolean(show && p));
    if (show && p) label.set(p, name, offsets[name][0], offsets[name][1]);
  }

  function render() {
    const g = Core.geometry(state);
    const cl = Core.claims(state);
    for (const name of ["A", "B", "C", "D", "G"]) {
      if (handles[name]) handles[name].set(state[name]);
    }
    if (!g.valid) {
      trapezoidShape.show(false);
      pqrsCircle.show(false);
      circum.show(false);
      for (const s of sides) s.show(false);
      diagonal.show(false); rayA.show(false); rayB.show(false); parallel.show(false);
      quadShape.show(false);
      for (const s of hintLines) s.show(false);
      for (const a of halfArcs) a.show(false);
      for (const name of Object.keys(dots)) dots[name].show(false);
      for (const name of Object.keys(text)) text[name].show(false);
      hintBox.disabled = true;
      say(Core.describe(state), null);
      if (window.Track) window.Track.state({ state, valid: false });
      return;
    }

    trapezoidShape.show(true);
    trapezoidShape.set([g.A, g.B, g.C, g.D]);
    circum.show(true);
    circum.set(g.circle.c, g.circle.r);
    pqrsCircle.show(cl.cyclic);
    if (cl.cyclic) {
      const qcircle = Core.circleOf3(g.P, g.Q, g.R);
      pqrsCircle.set(qcircle.c, qcircle.r);
    }
    sides[0].set(g.A, g.B);
    sides[1].set(g.B, g.C);
    sides[2].set(g.C, g.D);
    sides[3].set(g.D, g.A);
    diagonal.set(g.B, g.D);
    rayA.set(g.A, g.P);
    rayB.set(g.B, g.Q);
    parallel.set(g.rsA, g.rsB);
    quadShape.show(true);
    quadShape.set([g.P, g.Q, g.R, g.S]);

    // The applet's ShowHint: available only once Q is over the circle centre,
    // which is where BG actually halves angle CBD.
    const showHint = cl.finished && state.options.hint;
    hintBox.disabled = !cl.finished;
    hintLines[0].set(g.B, g.C);
    hintLines[1].set(g.B, g.D);
    hintLines[2].set(g.Q, g.C);
    for (const s of hintLines) s.show(showHint);
    halfArcs[0].set(g.B, g.C, g.G, 24);
    halfArcs[1].set(g.B, g.G, g.D, 24);
    for (const a of halfArcs) a.show(showHint);
    dots.P.set(g.P); dots.Q.set(g.Q); dots.R.set(g.R); dots.S.set(g.S);
    dots.T.set(g.T);
    dots.T.show(showHint);
    for (const name of ["P", "Q", "R", "S"]) dots[name].show(true);
    place("T", g.T, showHint);
    for (const name of ["A", "B", "C", "D", "G"]) place(name, g[name], state.options.names);
    for (const name of ["P", "Q", "R", "S"]) place(name, g[name], state.options.names);

    say(Core.describe(state), cl.bisects ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, G: g.G,
        P: g.P, Q: g.Q, R: g.R, S: g.S, T: g.T,
        circle: g.circle, options: state.options,
      });
    }
  }

  const clamp = (p, name) =>
    state.options.mode === "free" ? Core.clampToBoard(p) : p;
  const describe = (p, name) => `at ${Math.round(p.x)}, ${Math.round(p.y)} in the drawing`;
  const onMove = (p, name) => {
    state = Core.withPoint(state, name, p);
    render();
  };
  const handleOptions = {
    r: 9, step: 4, shift: 12, layer: top, clamp, describe, onMove,
  };
  const handles = {
    A: board.handle("A", state.A, Object.assign({}, handleOptions, {
      label: "Vertex A. Drag it, or focus it and use the arrow keys to move the trapezoid.",
    })),
    B: board.handle("B", state.B, Object.assign({}, handleOptions, {
      label: "Vertex B. Drag it, or focus it and use the arrow keys to move the trapezoid.",
    })),
    C: board.handle("C", state.C, Object.assign({}, handleOptions, {
      label: "Vertex C. Drag it, or focus it and use the arrow keys to move the trapezoid.",
    })),
    D: board.handle("D", state.D, Object.assign({}, handleOptions, {
      label: "Vertex D. Drag it, or focus it and use the arrow keys to move the trapezoid.",
    })),
    G: board.handle("G", state.G, Object.assign({}, handleOptions, {
      label: "Point G. Drag it inside triangle BCD, or focus it and use the arrow keys.",
    })),
  };

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
    handles.G.node.focus();
  });
  bisectorBtn.addEventListener("click", () => {
    state = Core.placeOnBisector(state, 0.55);
    render();
    handles.G.node.focus();
  });
  offBtn.addEventListener("click", () => {
    state = Core.placeOffBisector(state);
    render();
    handles.G.node.focus();
  });
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  for (const input of modeInputs) {
    input.addEventListener("change", () => {
      if (input.checked) state = Core.setOption(state, "mode", input.value);
      render();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "r" || e.key === "R") resetBtn.click();
    if (e.key === "b" || e.key === "B") bisectorBtn.click();
    if (e.key === "o" || e.key === "O") offBtn.click();
  });

  board.onTheme(render);
  render();
})();
