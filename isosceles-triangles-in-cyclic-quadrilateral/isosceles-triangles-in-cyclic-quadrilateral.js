"use strict";

/*
 * Parallel Lines in a Cyclic Quadrilateral — drawing and input only.  All the
 * geometry (G = AC ∩ BD, M with AM = AD, N with BN = BC, and the checks on the
 * page's claims) lives in isosceles-triangles-in-cyclic-quadrilateral-core.js.
 *
 * The board is one SVG: a circle, the quadrilateral A-B-C-D and the two chords
 * meeting at G.  Four focusable handles slide along the circle.  Four
 * checkboxes reproduce the applet's "Show premise / statement / hint / names";
 * the ticks, grey lines, angle arcs and labels are created once and only
 * updated on a redraw, so keyboard focus stays on the moved handle.
 */

(function () {
  const Core = IsoscelesTrianglesInCyclicQuadrilateralCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const box = {};
  for (const name of Core.OPTIONS) box[name] = document.getElementById(`show-${name}`);

  let state = Core.start();
  const initial = Core.geometry(state);

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const premise = board.layer("premise");
  const statement = board.layer("statement");
  const hint = board.layer("hint");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const circle = board.circle(Core.CIRCLE.center, Core.CIRCLE.radius, "circle", guides);
  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", guides);
  const chords = [
    board.segment(state.A, state.C, "chord", guides),
    board.segment(state.B, state.D, "chord", guides),
  ];
  const statementLines = [
    board.line(initial.A, initial.B, "statement-line", statement),
    board.line(initial.M, initial.N, "statement-line", statement),
  ];
  const hintLines = [
    board.segment(initial.M, initial.D, "hint-line", hint),
    board.segment(initial.N, initial.C, "hint-line", hint),
  ];
  const arcs = initial.arcs.map((arc, i) =>
    board.angleArc(arc.vertex, arc.p, arc.q, arc.r,
      i < 2 ? "angle-arc equal" : "angle-arc vertical", hint));

  /* LineID(2,4,4) marks AM and AD with two ticks and BN and BC with one. */
  const tickSpecs = Core.compute(state.A, state.B, state.C, state.D).premiseTicks;
  const tickShapes = [];
  for (const spec of tickSpecs) {
    for (let i = 0; i < spec.count; i++) tickShapes.push(board.segment(state.A, state.B, "tick", premise));
  }

  const mDot = board.point(initial.M, "special-dot", 4, dots);
  const nDot = board.point(initial.N, "special-dot", 4, dots);
  const gDot = board.point(initial.G, "g-dot", 4, dots);

  const labelOffsets = {
    A: [9, -8], B: [-16, -8], C: [8, 17], D: [-16, 17],
    M: [-18, -7], N: [8, -7], G: [8, 17],
  };
  const labelsFor = {};
  for (const name of ["A", "B", "C", "D", "M", "N", "G"]) {
    const off = labelOffsets[name];
    labelsFor[name] = board.label(state.A, name, "point-label", off[0], off[1], labels);
  }

  const handleOptions = {
    step: 5, shift: 15, r: 9, layer: top,
    clamp: (p, name) => Core.clampPoint(p, state[name]),
  };
  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name], Object.assign({}, handleOptions, {
      label: `Point ${name}. Drag it around the circle, or focus it and use the arrow keys.`,
      onMove: (p, key) => {
        state = Core.move(state, key, p);
        render();
      },
    }));
  }

  /** Narration under the board; "done" tells Track this demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** One LineID tick: a short segment perpendicular to p->q. */
  function setTick(shape, spec, index) {
    const dx = spec.q.x - spec.p.x;
    const dy = spec.q.y - spec.p.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) { shape.show(false); return; }
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const along = 4 * (2 * index - (spec.count - 1));
    const cx = (spec.p.x + spec.q.x) / 2 + along * ux;
    const cy = (spec.p.y + spec.q.y) / 2 + along * uy;
    shape.set({ x: cx - 4 * nx, y: cy - 4 * ny }, { x: cx + 4 * nx, y: cy + 4 * ny });
    shape.show(true);
  }

  function render() {
    const g = Core.geometry(state);
    for (const name of Core.NAMES) handles[name].set(state[name]);
    circle.show(true);
    if (!g) {
      quad.show(false);
      for (const s of chords.concat(statementLines, hintLines, arcs, tickShapes)) s.show(false);
      for (const d of [mDot, nDot, gDot]) d.show(false);
      for (const name in labelsFor) labelsFor[name].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ A: state.A, B: state.B, C: state.C, D: state.D, options: state.options });
      return;
    }

    quad.show(true).set([g.A, g.B, g.C, g.D]);
    const gOk = Number.isFinite(g.G.x);
    for (let i = 0; i < chords.length; i++) {
      if (gOk) chords[i].show(true).set(g.chords[i][0], g.chords[i][1]);
      else chords[i].show(false);
    }
    for (let i = 0; i < statementLines.length; i++) {
      statementLines[i].show(state.options.statement)
        .set(g.statementLines[i][0], g.statementLines[i][1]);
    }
    for (let i = 0; i < hintLines.length; i++) {
      hintLines[i].show(state.options.hint).set(g.hintLines[i][0], g.hintLines[i][1]);
    }
    for (let i = 0; i < arcs.length; i++) {
      const arc = g.arcs[i];
      const ok = gOk && i >= 2;
      if (state.options.hint && ok && Number.isFinite(arc.vertex.x)) {
        arcs[i].show(true).set(arc.vertex, arc.p, arc.q, arc.r);
      } else arcs[i].show(false);
    }
    let tickIndex = 0;
    for (const spec of g.premiseTicks) {
      for (let i = 0; i < spec.count; i++) {
        const shape = tickShapes[tickIndex++];
        if (state.options.premise) setTick(shape, spec, i);
        else shape.show(false);
      }
    }

    mDot.show(true).set(g.M);
    nDot.show(true).set(g.N);
    gDot.show(gOk && !state.options.premise).set(g.G);

    for (const name of Core.NAMES) labelsFor[name].show(state.options.names).set(g[name]);
    labelsFor.M.show(state.options.names).set(g.M);
    labelsFor.N.show(state.options.names).set(g.N);
    const showG = state.options.names && gOk;
    labelsFor.G.show(showG).set(g.nameCenter);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, M: g.M, N: g.N, G: gOk ? g.G : null,
        options: Object.assign({}, state.options),
        claims: g.claims, measures: { parallelError: g.measures.parallelError, mn: g.measures.mn },
      });
    }
  }

  for (const name of Core.OPTIONS) {
    box[name].checked = state.options[name];
    box[name].addEventListener("change", () => {
      state = Core.setOption(state, name, box[name].checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    for (const name of Core.OPTIONS) box[name].checked = state.options[name];
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
