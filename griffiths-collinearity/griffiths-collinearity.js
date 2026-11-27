"use strict";

/*
 * Pedal Collinearities — the drawing and the input. The core holds the
 * geometry: a triangle ABC and a movable line that meets its sides at P, Q,
 * R. The stage shows those points, the perpendiculars they generate and the
 * three pedal circles. A, B, C, the two ends of the line and its middle are
 * focusable handles; the arrow keys move them, and the three checkboxes are
 * the applet's Show perpendiculars / circles / names. There is nothing to win.
 */

(function () {
  const Core = GriffithsCollinearityCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const circlesBox = document.getElementById("circles");
  const perpsBox = document.getElementById("perps");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  // Back to front: circles, the two lines, the triangle, the nine
  // perpendiculars, marked points, labels and finally the handles, so a
  // handle keeps keyboard focus when everything else is redrawn.
  const circlesLayer = board.layer("circles");
  const guideLayer = board.layer("guides");
  const sidesLayer = board.layer("sides");
  const perpsLayer = board.layer("perps");
  const marksLayer = board.layer("marks");
  const namesLayer = board.layer("names");
  const handlesLayer = board.layer("handles");

  const OFF = { x: -100, y: -100 };
  const pedalCircles = Array.from({ length: 3 }, () =>
    board.circle(OFF, 1, "pedal-circle", circlesLayer));
  const axis = board.line(OFF, { x: -99, y: -99 }, "axis-line", guideLayer);
  const transversal = board.line(OFF, { x: -99, y: -99 }, "transversal", guideLayer);
  const triangle = board.polygon([OFF, OFF, OFF], "side", sidesLayer);
  const perps = Array.from({ length: 9 }, () =>
    board.segment(OFF, OFF, "perp", perpsLayer));
  const feetDots = Array.from({ length: 3 }, () =>
    board.point(OFF, "feet-dot", 4, marksLayer));
  const centreDots = Array.from({ length: 3 }, () =>
    board.point(OFF, "centre-dot", 3.5, marksLayer));
  const commonDots = Array.from({ length: 2 }, () =>
    board.point(OFF, "common-dot", 5, marksLayer));
  const labels = {};
  for (const name of ["A", "B", "C", "P", "Q", "R"]) {
    labels[name] = board.label(OFF, name, "point-label", 9, -9, namesLayer);
  }

  /** #status is how the player's record sees that the picture was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const opts = state.options;
    const vertices = { A: state.A, B: state.B, C: state.C };
    for (const [name, p] of Object.entries(vertices)) uiHandles[name].set(p);
    uiHandles.line1.set(state.line[0]);
    uiHandles.line2.set(state.line[1]);
    uiHandles.lineMid.set(Core.midpoint(state.line[0], state.line[1]));

    triangle.set([g.A, g.B, g.C]);
    transversal.set(state.line[0], state.line[1]);

    for (let i = 0; i < 3; i++) {
      const c = g.circles[i];
      if (c) pedalCircles[i].set(c.c, c.r).show(opts.circles);
      else pedalCircles[i].show(false);
      feetDots[i].set(g.feet[i] || OFF);
      centreDots[i].set(c ? c.c : OFF).show(Boolean(c) && opts.circles);
    }
    if (g.axis && opts.circles) axis.set(g.axis[0], g.axis[1]).show(true);
    else axis.show(false);

    for (let i = 0; i < 9; i++) {
      const row = g.intersection[Math.floor(i / 3)];
      const p = row && row[i % 3];
      if (p) perps[i].set(g.feet[Math.floor(i / 3)] || OFF, p).show(opts.perps);
      else perps[i].show(false);
    }

    for (let i = 0; i < 2; i++) {
      commonDots[i].set(g.common[i] || OFF).show(Boolean(g.common[i]) && opts.circles);
    }

    const marked = { A: g.A, B: g.B, C: g.C, P: g.feet[0], Q: g.feet[1], R: g.feet[2] };
    for (const name of Object.keys(labels)) {
      labels[name].set(marked[name] || OFF).show(opts.names && Boolean(marked[name]));
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, line: g.line, feet: g.feet,
        centres: g.circles.map((c) => c && c.c), common: g.common,
        axis: g.axis, options: opts,
      });
    }
  }

  const handleOptions = {
    step: 5, shift: 15, r: 10, layer: handlesLayer,
    clamp: (p) => Core.clampPoint(p),
  };
  const uiHandles = {};
  for (const name of ["A", "B", "C"]) {
    uiHandles[name] = board.handle(name, state[name], Object.assign({}, handleOptions, {
      label: `Point ${name} of the triangle. Drag it, or focus it and use the arrow keys to move it.`,
      onMove: (p) => { state = Core.move(state, name, p); render(); },
    }));
  }
  uiHandles.line1 = board.handle("line1", state.line[0], Object.assign({}, handleOptions, {
    label: "First end of the crossing line. Drag or use arrow keys near the border to rotate the line.",
    onMove: (p) => { state = Core.move(state, "line1", p); render(); },
  }));
  uiHandles.line2 = board.handle("line2", state.line[1], Object.assign({}, handleOptions, {
    label: "Second end of the crossing line. Drag or use arrow keys near the border to rotate the line.",
    onMove: (p) => { state = Core.move(state, "line2", p); render(); },
  }));
  uiHandles.lineMid = board.handle("lineMid", Core.midpoint(state.line[0], state.line[1]),
    Object.assign({}, handleOptions, {
      r: 8,
      label: "Middle of the crossing line. Drag or use arrow keys to slide the whole line.",
      onMove: (p) => { state = Core.move(state, "lineMid", p); render(); },
    }));

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("names", namesBox);
  toggle("circles", circlesBox);
  toggle("perps", perpsBox);
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // Colours are CSS classes; this keeps the hook for any theme-dependent work.
  board.onTheme(render);
  render();
})();
