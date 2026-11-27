"use strict";

/*
 * Coaxal Circles — drawing and input only; every formula lives in
 * coaxal-circles-core.js.  A and B slide along the horizontal line; the blue
 * circles have their centres on that line, the green ones pass through A and
 * B.  The two thin lines are the axes of the pencils.  All SVG elements are
 * created once and only updated, so a handle keeps keyboard focus on a redraw.
 */

(function () {
  const Core = CoaxalCirclesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nEl = document.getElementById("n");
  const oneEl = document.getElementById("familyOne");
  const twoEl = document.getElementById("familyTwo");
  const namesEl = document.getElementById("names");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({
    n: Number(nEl.value),
    familyOne: oneEl.checked,
    familyTwo: twoEl.checked,
    names: namesEl.checked,
  });

  /* Paint order: axes, the two pencils, the midpoint, names, handles. */
  const axes = board.layer("axes");
  const oneLayer = board.layer("family-one");
  const twoLayer = board.layer("family-two");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const axisAB = board.line(state.A, state.B, "axis", axes);
  const axisBisector = board.line(state.A, state.B, "axis-bisector", axes);
  const midDot = board.point(state.A, "mid-dot", 4, marks);

  /* Pre-build the largest number of circles the applet's N spinner allows. */
  const oneShapes = [];
  for (let i = 0; i < 2 * Core.N_MAX; i++) {
    oneShapes.push(board.circle(state.A, 1, "circle-one", oneLayer));
  }
  const twoShapes = [];
  for (let i = 0; i < 2 * Core.N_MAX - 1; i++) {
    twoShapes.push(board.circle(state.A, 1, "circle-two", twoLayer));
  }
  const diameterShape = board.circle(state.A, 1, "circle-diameter", twoLayer);

  const nameA = board.label(state.A, "A", "point-label", -24, -16, labels);
  const nameB = board.label(state.B, "B", "point-label", 12, -16, labels);

  const handleOpts = {
    r: 20, step: 4, shift: 12, layer: top,
    clamp: (p) => Core.clampPoint(p),
  };
  const handles = {};
  for (const key of ["A", "B"]) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOpts, {
      label: `Point ${key}. Drag it, or focus it and use the left and right arrow keys to move it along the line.`,
      describe: (p) => `x ${Math.round(p.x)}`,
      onMove: (p, name) => { state = Core.move(state, name, p); render(); },
    }));
  }

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

    axisAB.set(g.axis.p, g.axis.q);
    axisBisector.set(g.bisector.p, g.bisector.q);
    midDot.set(Core.point(g.Xc, g.y));

    const one = Core.familyOne(state);
    for (let i = 0; i < oneShapes.length; i++) {
      const on = state.options.familyOne && i < one.length;
      if (on) oneShapes[i].set(one[i].c, one[i].r);
      oneShapes[i].show(on);
    }
    const two = Core.familyTwo(state);
    for (let i = 0; i < twoShapes.length; i++) {
      const on = state.options.familyTwo && i < two.length - 1;
      if (on) twoShapes[i].set(two[i].c, two[i].r);
      twoShapes[i].show(on);
    }
    const diameter = two[two.length - 1];
    diameterShape.set(diameter.c, diameter.r);
    diameterShape.show(state.options.familyTwo);

    nameA.show(state.options.names);
    nameB.show(state.options.names);
    nameA.set(state.A);
    nameB.set(state.B);

    nEl.value = String(state.options.n);
    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function readN() {
    state = Core.setOption(state, "n", Number(nEl.value));
    render();
  }
  nEl.addEventListener("change", readN);
  for (const [el, key] of [[oneEl, "familyOne"], [twoEl, "familyTwo"], [namesEl, "names"]]) {
    el.addEventListener("change", () => {
      state = Core.setOption(state, key, el.checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => { state = Core.reset(state); render(); });

  // SVG colours come from CSS classes; the shared hook keeps theme flips in step.
  board.onTheme(render);
  render();
})();
