"use strict";

/*
 * The page for de Villiers 4: drawing and input only.  The turn-and-scale
 * rules, S, E, F and the near-collinearity test are in de-villiers-4-core.js.
 *
 * The SVG has three layers: the quadrilateral and its three base segments,
 * the apexes and the dashed claim, then the point handles.  Every element is
 * created once and only updated in render(), so keyboard focus stays with the
 * handle that was moved.  Colour comes from CSS classes and site tokens.
 */

(function () {
  const Core = DeVilliers4Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const anglesBox = document.getElementById("angles");
  const hintBox = document.getElementById("hint");
  const alignBtn = document.getElementById("alignBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();
  const keys = Core.HANDLES;
  const origin = Core.point(0, 0); // a safe placeholder before the first render

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const triangles = board.layer("triangles");
  const claim = board.layer("claim");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", guides);
  const bases = [
    board.segment(state.A, state.C, "base", guides),
    board.segment(state.D, state.C, "base", guides),
    board.segment(state.D, state.B, "base", guides),
  ];
  const tris = [
    board.polygon([state.A, state.C, state.P], "tri tri-p", triangles),
    board.polygon([state.D, state.C, state.Q], "tri tri-q", triangles),
    board.polygon([state.D, state.B, state.R], "tri tri-r", triangles),
  ];
  const extensions = [
    board.line(origin, state.C, "extension", claim),
    board.line(origin, state.D, "extension", claim),
  ];
  const claimLine = board.line(state.P, state.Q, "claim-line", claim);
  const sDot = board.point(origin, "s-dot", 6, dots);
  const eDot = board.point(origin, "hint-dot", 4, dots);
  const fDot = board.point(origin, "hint-dot", 4, dots);
  const hintLines = [
    board.segment(state.C, origin, "hint-line", guides),
    board.segment(state.A, origin, "hint-line", guides),
  ];
  const angleArcs = [
    board.angleArc(state.P, state.A, state.C, 18, "angle", claim),
    board.angleArc(state.Q, state.D, state.C, 26, "angle", claim),
    board.angleArc(state.R, state.D, state.B, 18, "angle", claim),
    board.angleArc(origin, state.C, state.D, 18, "angle", claim),
  ];

  const labelOffsets = {
    A: [-15, -9], B: [9, -9], C: [9, -9], D: [-15, 17],
    P: [-16, -9], Q: [9, -9], R: [9, 17], S: [9, 17], E: [-16, -9], F: [9, 17],
  };
  const labelsFor = {};
  for (const key of keys.concat(["S", "E", "F"])) {
    const off = labelOffsets[key];
    labelsFor[key] = board.label(state[key] || { x: 0, y: 0 }, key, "point-label",
      off[0], off[1], labels);
  }

  const handlesFor = {};
  for (const key of keys) {
    const isCorner = Core.CORNERS.indexOf(key) >= 0;
    handlesFor[key] = board.handle(key, state[key], {
      r: 9, step: 5, shift: 15, layer: handles,
      clamp: (p) => Core.clamp(p),
      label: `${isCorner ? "Corner" : "Triangle tip"} ${key}. Drag it, or focus it and use the arrow keys to move it.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  }

  /** Say what is on the board.  "done" is how the record sees an explored
   * illustration; there is no win or loss in this droodle. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    if (!g) {
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ broken: true, explored: state.explored });
      return;
    }

    quad.set([g.A, g.B, g.C, g.D]);
    bases[0].set(g.A, g.C);
    bases[1].set(g.D, g.C);
    bases[2].set(g.D, g.B);
    tris[0].set([g.A, g.C, g.P]);
    tris[1].set([g.D, g.C, g.Q]);
    tris[2].set([g.D, g.B, g.R]);

    const showLine = g.showLine;
    extensions[0].set(g.S, g.C);
    extensions[1].set(g.S, g.D);
    claimLine.set(g.P, g.R);
    for (const shape of extensions.concat([claimLine, sDot])) shape.show(showLine);
    sDot.set(g.S);

    const showHint = state.options.hint && showLine;
    for (const shape of hintLines) shape.set(shape === hintLines[0] ? g.C : g.A, g.E);
    for (const shape of hintLines) shape.show(showHint);
    eDot.set(g.E).show(showHint);
    fDot.set(g.F).show(showHint);

    angleArcs[0].set(g.P, g.A, g.C, 18);
    angleArcs[1].set(g.Q, g.D, g.C, 26);
    angleArcs[2].set(g.R, g.D, g.B, 18);
    angleArcs[3].set(g.S, g.C, g.D, 18);
    for (let i = 0; i < angleArcs.length; i++) {
      angleArcs[i].show(state.options.angles && (i < 3 || showLine));
    }

    for (const key of keys) {
      handlesFor[key].set(state[key]);
      labelsFor[key].set(state[key]);
      labelsFor[key].show(state.options.names);
    }
    labelsFor.S.set(g.S).show(state.options.names && showLine);
    labelsFor.E.set(g.E).show(state.options.names && showHint);
    labelsFor.F.set(g.F).show(state.options.names && showHint);

    namesBox.checked = state.options.names;
    anglesBox.checked = state.options.angles;
    hintBox.checked = state.options.hint;
    // The applet disables the hint box until P, Q and R nearly line up, and
    // lets only one of "angles" and "hint" be on at a time.
    hintBox.disabled = state.options.angles || !showLine;
    anglesBox.disabled = state.options.hint;

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, P: g.P, Q: g.Q, R: g.R, S: g.S,
        alpha: g.alpha, coef: g.coef,
        lineUp: g.onLine, showLine: g.showLine,
        angleGap: g.angleGap, theta: g.theta, apexAngle: g.apexAngle,
        options: state.options,
      });
    }
  }

  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  anglesBox.addEventListener("change", () => {
    state = Core.setOption(state, "angles", anglesBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  alignBtn.addEventListener("click", () => {
    state = Core.align(state);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(render);
  render();
})();
