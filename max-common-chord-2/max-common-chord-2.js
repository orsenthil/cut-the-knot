"use strict";

/*
 * Max Common Chord 2 — drawing and input only.  All the geometry, the two
 * drag modes and the checks on the page's claims are in
 * max-common-chord-2-core.js.
 *
 * The board is one SVG in the applet's own 640 by 460 coordinates.  P, Q, A
 * and B are focusable handles.  The two circles, the third circle through E,
 * F and Q, and the points L, M, S are drawn once and only updated on a
 * redraw, so keyboard focus stays on the handle that moved.  "Show hint"
 * reproduces the applet's five angle arcs; reaching AQ as a diameter draws
 * the equal-tick segments SA and SB, just as the applet's Finished() does.
 */

(function () {
  const Core = MaxCommonChord2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const optimalBtn = document.getElementById("optimalBtn");
  const resetBtn = document.getElementById("resetBtn");
  const namesBox = document.getElementById("show-names");
  const hintBox = document.getElementById("show-hint");
  const adjustBoxes = Array.from(document.querySelectorAll('input[name="adjust"]'));

  let state = Core.start();

  /* Layers, back to front. */
  const circles = board.layer("circles");
  const lines = board.layer("lines");
  const hint = board.layer("hint");
  const optimal = board.layer("optimal");
  const ticks = board.layer("ticks");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const startGeometry = Core.compute(state);
  const atStart = (name) => state[name] || startGeometry[name];
  const circleE = board.circle(startGeometry.E, startGeometry.E.radius, "circle-e", circles);
  const circleF = board.circle(startGeometry.F, startGeometry.F.radius, "circle-f", circles);
  const circleO = board.circle(startGeometry.O, startGeometry.O.radius, "circle-o", circles);
  const circleABQ = board.circle(startGeometry.ABQ, startGeometry.ABQ.radius, "circle-abq", circles);

  const chord = board.segment(state.A, state.B, "chord", lines);
  const axis = board.line(state.P, state.Q, "axis", lines);
  const aux = [
    board.segment(state.A, atStart("L"), "aux", lines),
    board.segment(state.B, atStart("M"), "aux", lines),
  ];
  const hintLines = [
    board.segment(state.Q, atStart("M"), "hint-line", hint),
    board.segment(state.Q, atStart("L"), "hint-line", hint),
  ];
  const diameterLines = [
    board.segment(state.Q, state.A, "diameter", optimal),
    board.segment(state.Q, state.B, "diameter", optimal),
    board.segment(state.Q, atStart("S"), "diameter", optimal),
    board.segment(atStart("E"), atStart("O"), "diameter", optimal),
    board.segment(atStart("F"), atStart("O"), "diameter", optimal),
  ];

  /* ShowHint(): angles ABS and PQM (two arcs), BAS and PQL (one), ASB (three). */
  const arcSpecs = [
    { p: "B", v: "A", q: "S", r: 26, cls: "angle-arc two" },
    { p: "Q", v: "M", q: "P", r: 26, cls: "angle-arc two" },
    { p: "A", v: "B", q: "S", r: 34, cls: "angle-arc one" },
    { p: "Q", v: "L", q: "P", r: 34, cls: "angle-arc one" },
    { p: "S", v: "A", q: "B", r: 40, cls: "angle-arc three" },
  ];
  const arcs = arcSpecs.map((s) => board.angleArc(
    atStart(s.v), atStart(s.p), atStart(s.q), s.r, s.cls, hint));

  /* LineID(2,4,4) marks SA and SB with two ticks each at the optimum. */
  const tickShapes = [];
  for (let i = 0; i < 4; i++) tickShapes.push(board.segment(atStart("S"), state.A, "tick", ticks));

  const specialDots = {
    L: board.point(startGeometry.L, "special-dot", 4, dots),
    M: board.point(startGeometry.M, "special-dot", 4, dots),
    S: board.point(startGeometry.S, "special-dot", 5, dots),
  };
  const centerDots = {
    E: board.point(startGeometry.E, "center-dot", 4, dots),
    F: board.point(startGeometry.F, "center-dot", 4, dots),
    O: board.point(startGeometry.O, "special-dot", 4, dots),
  };
  const offset = {
    P: [12, -12], Q: [12, 20], A: [-24, -10], B: [14, -10],
    L: [12, -12], M: [-26, -12], S: [12, 20],
    E: [-26, 20], F: [12, 20], O: [12, -12],
  };
  const labelShapes = {};
  for (const name of ["P", "Q", "A", "B", "L", "M", "S", "E", "F", "O"]) {
    labelShapes[name] = board.label(state[name] || startGeometry[name], name,
      "point-label", offset[name][0], offset[name][1], labels);
  }

  const handles = {};
  for (const name of Core.HANDLES) {
    handles[name] = board.handle(name, state[name], {
      r: 16, step: 6, shift: 24, layer: handlesLayer,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      clamp: (q) => Core.clamp(q),
      onMove: (q, key) => {
        state = Core.move(state, key, q);
        render();
      },
    });
  }

  /** Narration under the board; "done" tells Track this demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** One LineID tick: a short segment across the middle of p->q. */
  function setTick(shape, p, q, index) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) { shape.show(false); return; }
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const along = 6 * (2 * index - 1);
    const cx = (p.x + q.x) / 2 + along * ux, cy = (p.y + q.y) / 2 + along * uy;
    shape.set({ x: cx - 6 * nx, y: cy - 6 * ny }, { x: cx + 6 * nx, y: cy + 6 * ny }).show(true);
  }

  function hideEverything() {
    for (const shape of [circleE, circleF, circleO, circleABQ, chord, axis]
      .concat(aux, hintLines, diameterLines, arcs, tickShapes)) shape.show(false);
    for (const name in specialDots) specialDots[name].show(false);
    for (const name in centerDots) centerDots[name].show(false);
    for (const name in labelShapes) labelShapes[name].show(false);
  }

  function render() {
    const g = Core.compute(state);
    for (const name of Core.HANDLES) handles[name].set(state[name]);
    if (!g || !g.claims.valid) {
      hideEverything();
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(Core.position(state));
      return;
    }

    circleE.show(true).set(g.E, g.E.radius);
    circleF.show(true).set(g.F, g.F.radius);
    circleO.show(true).set(g.O, g.O.radius);
    circleABQ.show(g.claims.finished).set(g.ABQ, g.ABQ.radius);
    chord.show(true).set(g.A, g.B);
    axis.show(true).set(g.P, g.Q);
    aux[0].show(true).set(g.A, g.L);
    aux[1].show(true).set(g.B, g.M);
    for (let i = 0; i < hintLines.length; i++) {
      hintLines[i].show(state.options.hint).set(g.Q, i ? g.L : g.M);
    }
    for (let i = 0; i < diameterLines.length; i++) {
      const ends = [
        [g.Q, g.A], [g.Q, g.B], [g.Q, g.S], [g.E, g.O], [g.F, g.O],
      ][i];
      diameterLines[i].show(g.claims.finished).set(ends[0], ends[1]);
    }
    const pts = { P: g.P, Q: g.Q, A: g.A, B: g.B, L: g.L, M: g.M, S: g.S };
    for (let i = 0; i < arcs.length; i++) {
      const s = arcSpecs[i];
      if (state.options.hint && finitePoint(pts[s.p]) && finitePoint(pts[s.v]) && finitePoint(pts[s.q])) {
        arcs[i].show(true).set(pts[s.v], pts[s.p], pts[s.q], s.r);
      } else arcs[i].show(false);
    }
    setTick(tickShapes[0], g.S, g.A, 0);
    setTick(tickShapes[1], g.S, g.A, 1);
    setTick(tickShapes[2], g.S, g.B, 0);
    setTick(tickShapes[3], g.S, g.B, 1);
    for (const shape of tickShapes) if (!g.claims.finished) shape.show(false);

    specialDots.L.show(true).set(g.L);
    specialDots.M.show(true).set(g.M);
    specialDots.S.show(true).set(g.S);
    centerDots.E.show(true).set(g.E);
    centerDots.F.show(true).set(g.F);
    centerDots.O.show(true).set(g.O);
    const all = {
      P: g.P, Q: g.Q, A: g.A, B: g.B, L: g.L, M: g.M, S: g.S,
      E: g.E, F: g.F, O: g.O,
    };
    for (const name in labelShapes) {
      labelShapes[name].show(state.options.names).set(all[name]);
    }

    say(Core.describe(state), state.explored ? "done" : null);
    if (window.Track) window.Track.state(Core.position(state));
  }

  function finitePoint(q) {
    return !!q && Number.isFinite(q.x) && Number.isFinite(q.y);
  }

  namesBox.checked = state.options.names;
  hintBox.checked = state.options.hint;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  for (const box of adjustBoxes) {
    box.checked = box.value === state.adjust;
    box.addEventListener("change", () => {
      if (!box.checked) return;
      state = Core.setAdjust(state, box.value);
      render();
    });
  }
  optimalBtn.addEventListener("click", () => {
    state = Core.optimal(state);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesBox.checked = state.options.names;
    hintBox.checked = state.options.hint;
    for (const box of adjustBoxes) box.checked = box.value === state.adjust;
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
