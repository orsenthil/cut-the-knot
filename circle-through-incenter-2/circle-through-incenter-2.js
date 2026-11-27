"use strict";

/*
 * Circle Through the Incenter and Antiparallels — the drawing and input. All
 * the geometry lives in circle-through-incenter-2-core.js. A, B and C are
 * draggable; the circle through A, the incenter I and B is redrawn, along
 * with its second cuts X (on AC), Y (on BC) and J (on the bisector CI). The
 * four checkboxes reproduce the applet's Show options; Reset restores its
 * opening triangle. The status line reports what the picture shows.
 */

(function () {
  const Core = CircleThroughIncenter2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const statementBox = document.getElementById("statement");
  const premisesBox = document.getElementById("premises");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front: the circle and lines, then the triangle and its
   * marks, the angle arcs, the special points, labels, and the handles that
   * keep keyboard focus. */
  const back = board.layer("back");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const circle = board.circle(state.A, 100, "circle", back);
  const extAC = board.line(state.A, state.C, "ext", back);
  const extBC = board.line(state.B, state.C, "ext", back);
  const bisector = board.line(state.C, state.A, "bisector", back);

  const sides = [
    board.segment(state.A, state.B, "side", guides),
    board.segment(state.B, state.C, "side", guides),
    board.segment(state.C, state.A, "side", guides),
  ];
  const measureAX = board.segment(state.A, state.A, "measure", guides);
  const measureBY = board.segment(state.B, state.B, "measure", guides);
  const premiseAI = board.segment(state.A, state.A, "premise", guides);
  const premiseBI = board.segment(state.B, state.B, "premise", guides);
  const chord = board.segment(state.A, state.B, "chord", guides);

  // The premises: AI and BI are bisectors; the marked angles come in pairs.
  const arcAtC = board.angleArc(state.A, state.C, state.A, 20, "angle-a", marks);
  const arcAIB = board.angleArc(state.A, state.A, state.B, 25, "angle-b", marks);
  const arcBIC = board.angleArc(state.B, state.A, state.C, 20, "angle-a", marks);
  const arcBAI = board.angleArc(state.B, state.A, state.A, 25, "angle-b", marks);

  // The hint: the antiparallel chord XY gives equal angles at X.
  const arcYXB = board.angleArc(state.A, state.A, state.B, 17, "hint-a", marks);
  const arcAXB = board.angleArc(state.A, state.A, state.B, 24, "hint-b", marks);

  const cutX = board.point(state.A, "cut", 4.5, dots);
  const cutY = board.point(state.B, "cut", 4.5, dots);
  const inCenter = board.point(state.A, "incenter", 4, dots);
  const auxJ = board.point(state.A, "aux", 3.5, dots);

  const labelMap = {};
  const offsets = {
    A: [-15, -12], B: [-15, 19], C: [9, -11],
    X: [-16, -12], Y: [-16, 20], I: [8, 19], J: [8, -11],
  };
  for (const key of ["A", "B", "C", "X", "Y", "I", "J"]) {
    labelMap[key] = board.label(state.A, key, "point-label",
      offsets[key][0], offsets[key][1], labels);
  }

  /* Draggable, focusable corners: pointer, touch and arrow keys all go
   * through the same core move and clamp. */
  const handles = {};
  for (const name of ["A", "B", "C"]) {
    handles[name] = board.handle(name, state[name], {
      r: 9, step: 5, shift: 15, layer: top,
      clamp: (p) => Core.clamp(p),
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      describe: (p) => `${name} at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  }

  /** The status line is also how the player's record sees a finished look. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const always = [circle, extAC, extBC, bisector, ...sides, cutX, cutY, inCenter];

  function render() {
    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);

    const g = Core.geometry(state);
    for (const thing of always) thing.show(!!g);
    for (const thing of [measureAX, measureBY, premiseAI, premiseBI, chord,
      arcAtC, arcAIB, arcBIC, arcBAI, arcYXB, arcAXB, auxJ]) thing.show(false);
    for (const key of Object.keys(labelMap)) labelMap[key].show(false);

    if (g) {
      circle.set(g.circle.c, g.circle.r);
      extAC.set(g.A, g.C);
      extBC.set(g.B, g.C);
      bisector.set(g.C, g.I);
      sides[0].set(g.A, g.B);
      sides[1].set(g.B, g.C);
      sides[2].set(g.C, g.A);
      cutX.set(g.X);
      cutY.set(g.Y);
      inCenter.set(g.I);

      if (state.options.statement) {
        measureAX.set(g.A, g.X);
        measureBY.set(g.B, g.Y);
        measureAX.show(true);
        measureBY.show(true);
      }
      if (state.options.premises) {
        premiseAI.set(g.A, g.I);
        premiseBI.set(g.B, g.I);
        premiseAI.show(true);
        premiseBI.show(true);
        arcAtC.set(g.A, g.C, g.I, 20);
        arcAIB.set(g.A, g.I, g.B, 25);
        arcBIC.set(g.B, g.I, g.C, 20);
        arcBAI.set(g.B, g.A, g.I, 25);
        for (const arc of [arcAtC, arcAIB, arcBIC, arcBAI]) arc.show(true);
      }
      if (state.options.hint) {
        chord.set(g.X, g.Y);
        chord.show(true);
        arcYXB.set(g.Y, g.X, g.B, 17);
        arcAXB.set(g.A, g.X, g.B, 24);
        arcYXB.show(true);
        arcAXB.show(true);
        auxJ.set(g.J);
        auxJ.show(true);
      }
      if (state.options.names) {
        for (const key of ["A", "B", "C", "X", "Y", "I"]) {
          labelMap[key].set(g[key]);
          labelMap[key].show(true);
        }
        if (state.options.hint) {
          labelMap.J.set(g.J);
          labelMap.J.show(true);
        }
      }
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state(g
        ? { A: g.A, B: g.B, C: g.C, I: g.I, J: g.J, X: g.X, Y: g.Y,
            circle: g.circle, options: state.options }
        : { A: state.A, B: state.B, C: state.C, options: state.options });
    }
  }

  for (const [box, key] of [[namesBox, "names"], [statementBox, "statement"],
    [premisesBox, "premises"], [hintBox, "hint"]]) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, key, box.checked);
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
