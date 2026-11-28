"use strict";

/*
 * The page for Malfatti's problem: drawing and input only. The Steiner
 * construction lives in malfatti-core.js. The board has three draggable
 * corners; four checkboxes show the same auxiliary lines and circles the
 * applet offered (names, angle bisectors, incircles, second tangents). Shapes
 * are created once and only updated on a redraw, so a handle keeps keyboard
 * focus. This is an illustration: there is no win and no loss.
 */

(function () {
  const Core = MalfattiCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = {
    names: document.getElementById("names"),
    bisectors: document.getElementById("bisectors"),
    incircles: document.getElementById("incircles"),
    secondTangents: document.getElementById("secondTangents"),
  };

  let state = Core.start();

  /* Back to front: construction, then labels, then the focusable handles. */
  const guides = board.layer("guides");
  const auxLayer = board.layer("aux");
  const tangentsLayer = board.layer("tangents");
  const mainLayer = board.layer("main");
  const dotsLayer = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const triangle = board.polygon([state.A, state.B, state.C], "triangle", guides);
  const bisectors = [
    board.segment(state.A, state.B, "bisector", guides),
    board.segment(state.B, state.C, "bisector", guides),
    board.segment(state.C, state.A, "bisector", guides),
  ];
  const auxCircles = [
    board.circle(state.A, 1, "aux-circle", auxLayer),
    board.circle(state.A, 1, "aux-circle", auxLayer),
    board.circle(state.A, 1, "aux-circle", auxLayer),
  ];
  const tangents = [
    board.line(state.A, state.B, "second-tangent", tangentsLayer),
    board.line(state.A, state.B, "second-tangent", tangentsLayer),
    board.line(state.A, state.B, "second-tangent", tangentsLayer),
  ];
  const malfatti = [
    board.circle(state.A, 1, "malfatti-circle", mainLayer),
    board.circle(state.A, 1, "malfatti-circle", mainLayer),
    board.circle(state.A, 1, "malfatti-circle", mainLayer),
  ];
  const tangencyDots = [
    board.point(state.A, "tangent-dot", 4, dotsLayer),
    board.point(state.A, "tangent-dot", 4, dotsLayer),
    board.point(state.A, "tangent-dot", 4, dotsLayer),
  ];
  const auxDots = [
    board.point(state.A, "aux-dot", 4, dotsLayer),
    board.point(state.A, "aux-dot", 4, dotsLayer),
    board.point(state.A, "aux-dot", 4, dotsLayer),
  ];
  const pointDot = board.point(state.A, "center-dot", 4, dotsLayer);
  const labelKeys = ["A", "B", "C", "L", "M", "P", "T"];
  const offsets = {
    A: [-16, 20], B: [8, 20], C: [-6, -12],
    L: [8, -8], M: [-16, -8], P: [-16, 18], T: [8, -8],
  };
  const labels = {};
  for (const key of labelKeys) {
    labels[key] = board.label(state.A, key, "point-label", offsets[key][0], offsets[key][1], labelsLayer);
  }

  const handles = {};
  for (const key of ["A", "B", "C"]) {
    handles[key] = board.handle(key, state[key], {
      r: 9, step: 5, shift: 15, layer: handlesLayer,
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to change the triangle.`,
      clamp: (p) => Core.clamp(p),
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)} in the drawing`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  }

  /**
   * The shared status line. "done" tells the player's record that the
   * illustration has been explored; there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function place(key, p, show) {
    const label = labels[key];
    label.show(Boolean(show && p && Core.util.finite(p)));
    if (show && p && Core.util.finite(p)) {
      label.set(p, key, offsets[key][0], offsets[key][1]);
    }
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of ["A", "B", "C"]) handles[key].set(state[key]);
    triangle.set([state.A, state.B, state.C]);
    triangle.show(true);

    const drawable = Core.util.finite(g.L) && [g.circleA, g.circleB, g.circleC]
      .every((c) => Core.util.finite(c) && Number.isFinite(c.r));
    if (!drawable) {
      for (const s of bisectors.concat(auxCircles, tangents, malfatti, tangencyDots, auxDots)) s.show(false);
      pointDot.show(false);
      for (const key of labelKeys) place(key, null, false);
      say(Core.describe(state), null);
      if (window.Track) window.Track.state({ A: state.A, B: state.B, C: state.C, options: state.options });
      return;
    }

    bisectors[0].set(g.I, g.A);
    bisectors[1].set(g.I, g.B);
    bisectors[2].set(g.I, g.C);
    for (const b of bisectors) b.show(state.options.bisectors);

    const aux = [g.IAB, g.IBC, g.ICA];
    for (let i = 0; i < 3; i++) {
      auxCircles[i].set(aux[i], aux[i].r);
      auxCircles[i].show(state.options.incircles);
    }
    const feet = [g.Ic, g.M, g.T];
    for (let i = 0; i < 3; i++) {
      auxDots[i].set(feet[i]);
      auxDots[i].show(state.options.incircles || state.options.secondTangents);
    }

    const lines = [g.lineAB, g.lineBC, g.lineCA];
    for (let i = 0; i < 3; i++) {
      const line = lines[i];
      tangents[i].show(Boolean(state.options.secondTangents && line
        && line.every((p) => Core.util.finite(p))));
      if (tangents[i].node.style.display !== "none") tangents[i].set(line[0], line[1]);
    }
    pointDot.set(g.L);
    pointDot.show(state.options.secondTangents);

    const circles = [g.circleA, g.circleB, g.circleC];
    const meets = [g.F, g.D, g.E];
    for (let i = 0; i < 3; i++) {
      malfatti[i].set(circles[i], circles[i].r);
      malfatti[i].show(true);
      tangencyDots[i].set(meets[i]);
      tangencyDots[i].show(true);
    }

    const named = {
      A: g.A, B: g.B, C: g.C, L: g.L, M: g.M, P: g.P, T: g.T,
    };
    for (const key of labelKeys) {
      const extra = key === "L" ? state.options.secondTangents
        : ["M", "P", "T"].includes(key) ? state.options.incircles || state.options.secondTangents : true;
      place(key, named[key], state.options.names && extra);
    }

    say(Core.describe(state), state.explored ? "done" : null);
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
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
