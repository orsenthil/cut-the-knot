"use strict";

/*
 * Equiloc Quad 2Tri 120 — drawing and input only. The geometry and the drags
 * are in equiloc-quad-2-tri-120-core.js: A and B are fixed on the circle, S
 * slides round it, and C and D slide along the lines B-S and A-S at the same
 * distance from B and A. Turning C about A by +60° and D about B by -60°
 * gives the two tips P and R, which meet on the blue bisector S-T on the
 * starting arc. Every SVG object is created once and only updated on a
 * redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = EquilocQuad2Tri120Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = {
    names: document.getElementById("names"),
    construction: document.getElementById("construction"),
    hint: document.getElementById("hint"),
  };

  let state = Core.start();

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const construction = board.layer("construction");
  const hints = board.layer("hints");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const guideCircle = board.circle(state.circle.c, state.circle.r, "guide-circle", guides);
  const secants = [
    board.line(state.B, state.S, "secant", guides),
    board.line(state.A, state.S, "secant", guides),
  ];
  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", shapes);
  /* The applet's six orange triangle sides: two triangles on the diagonals. */
  const triangleSides = [];
  for (let i = 0; i < 6; i++) {
    triangleSides.push(board.segment(state.A, state.B, "triangle-side", shapes));
  }
  const bisector = board.segment(state.S, state.T, "bisector", shapes);
  const tipDots = [0, 1, 2].map(() => board.point(state.A, "tip-dot", 4, shapes));
  const baseDots = [0, 1].map(() => board.point(state.A, "base-dot", 3, shapes));

  /* Show construction: matching side ticks, as in the applet's LineID marks. */
  const angleTriples = [
    ["P", "A", "C"], ["A", "C", "P"], ["C", "P", "A"],
    ["R", "B", "D"], ["B", "D", "R"], ["D", "R", "B"],
  ];
  const angleArcs = angleTriples.map(() =>
    board.angleArc(state.A, state.B, state.C, 16, "angle-mark", construction));
  const ticks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(() =>
    board.segment(state.A, state.B, "side-tick", construction));

  const hintSides = [
    board.segment(state.A, state.B, "hint-side", hints),
    board.segment(state.A, state.B, "hint-side", hints),
  ];
  const hintArcs = [0, 1, 2].map(() =>
    board.angleArc(state.A, state.B, state.C, 18, "hint-angle", hints));

  const labelKeys = ["A", "B", "C", "D", "S", "P", "R", "T"];
  const labels = {};
  for (const key of labelKeys) {
    labels[key] = board.label(state.A, key, "point-label", 8, -8, labelsLayer);
  }

  const handleOptions = {
    r: 9, step: 5, shift: 15, layer: handlesLayer,
  };
  const handles = {};
  for (const key of ["S", "C", "D"]) {
    const descriptions = {
      S: "Point S. Drag it around the circle, or focus it and use the arrow keys.",
      C: "Point C. Drag it along the line from B to S, or focus it and use the arrow keys.",
      D: "Point D. Drag it along the line from A to S, or focus it and use the arrow keys.",
    };
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      label: descriptions[key],
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

  /** One, two or three short strokes across a side, for equal-length marks. */
  function setTicks(pieces, a, b, count, on) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n, uy = dy / n;
    pieces.forEach((shape, i) => {
      if (i >= count) { shape.show(false); return; }
      const along = (i - (count - 1) / 2) * 5;
      const mx = (a.x + b.x) / 2 + ux * along, my = (a.y + b.y) / 2 + uy * along;
      shape.show(on).set({ x: mx - uy * 5, y: my + ux * 5 },
        { x: mx + uy * 5, y: my - ux * 5 });
    });
  }

  function render() {
    for (const key of ["S", "C", "D"]) handles[key].set(state[key]);
    const g = Core.geometry(state);

    if (!g) {
      guideCircle.set(state.circle.c, state.circle.r).show(true);
      for (const s of secants.concat(triangleSides, [quad, bisector],
        tipDots, baseDots, angleArcs, ticks, hintSides, hintArcs)) s.show(false);
      for (const key of labelKeys) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    guideCircle.set(g.circle.c, g.circle.r).show(true);
    secants[0].set(g.B, g.S).show(true);
    secants[1].set(g.A, g.S).show(true);
    quad.set([g.A, g.B, g.C, g.D]).show(true);

    const sides = [
      [g.A, g.P], [g.C, g.P], [g.B, g.R], [g.D, g.R], [g.B, g.D], [g.A, g.C],
    ];
    sides.forEach((pair, i) => triangleSides[i].set(pair[0], pair[1]).show(true));
    bisector.set(g.S, g.T).show(true);
    [g.P, g.R, g.T].forEach((p, i) => tipDots[i].set(p).show(true));
    [g.A, g.B].forEach((p, i) => baseDots[i].set(p).show(true));

    angleArcs.forEach((arc, i) => {
      const [key, p, q] = angleTriples[i];
      arc.set(g[key], g[p], g[q], 16).show(state.options.construction);
    });
    /* The applet marks AB and CD once, each triangle's three sides twice or
     * three times. Only six strokes are needed for those groups. */
    setTicks(ticks.slice(0, 2), g.A, g.B, 1, state.options.construction);
    setTicks(ticks.slice(2, 5), g.A, g.C, 2, state.options.construction);
    setTicks(ticks.slice(5, 8), g.B, g.D, 3, state.options.construction);
    setTicks(ticks.slice(8, 10), g.C, g.D, 1, state.options.construction);

    hintSides[0].set(g.A, g.T).show(state.options.hint);
    hintSides[1].set(g.B, g.T).show(state.options.hint);
    const hintTriples = [[g.A, g.B, g.T], [g.B, g.T, g.A], [g.T, g.A, g.B]];
    hintArcs.forEach((arc, i) => {
      const triple = hintTriples[i];
      arc.set(triple[0], triple[1], triple[2], 18).show(state.options.hint);
    });

    for (const key of labelKeys) labels[key].set(g[key]);
    for (const key of ["A", "B", "C", "D", "S", "P"]) labels[key].show(state.options.names);
    labels.R.show(state.options.names && g.showR);
    labels.T.show(state.options.names && state.options.hint);

    say(Core.describe(state), state.explored ? "done" : null);

    // Board units, not pixels: the record and the tutor read this position.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, S: g.S, T: g.T,
        P: g.P, R: g.R, M: g.M, N: g.N,
        length: state.length, circle: g.circle, options: state.options,
        claims: g.claims, measures: g.measures,
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

  // The SVG colours are CSS classes, so a theme flip changes nothing here;
  // redraw anyway to keep the shared hook.
  board.onTheme(render);
  render();
})();
