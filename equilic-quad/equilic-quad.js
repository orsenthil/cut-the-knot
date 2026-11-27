"use strict";

/*
 * Equilic Quad — drawing and input only.  The geometry and the drags are in
 * equilic-quad-core.js: A and B are fixed on the circle, S slides round it,
 * and C and D slide along the lines B-S and A-S.  Three 60-degree turns give
 * the tips P, Q and R, which stay in one line with S.  Every SVG shape is
 * created once and only updated on a redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = EquilicQuadCore;
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
  /* The applet's six dark-orange triangle sides. */
  const triangleSides = [];
  for (let i = 0; i < 6; i++) {
    triangleSides.push(board.segment(state.A, state.B, "triangle-side", shapes));
  }
  const collinearLine = board.line(state.A, state.B, "collinear-line", shapes);
  const segmentPR = board.segment(state.P || state.A, state.R || state.B, "segment-pr", shapes);
  const apexDots = [0, 1, 2].map(() => board.point(state.A, "apex-dot", 4, shapes));
  const baseDots = [0, 1].map(() => board.point(state.A, "base-dot", 3, shapes));

  /* The Show construction box: angle marks and the two equal-side ticks. */
  const angleTriples = [
    ["P", "A", "C"], ["Q", "D", "C"], ["R", "D", "B"],
    ["A", "P", "C"], ["B", "R", "D"], ["D", "C", "Q"],
    ["C", "D", "Q"], ["S", "A", "B"],
  ];
  const angleArcs = angleTriples.map(() => board.angleArc(state.A, state.B, state.C, 16, "angle-mark", construction));
  const ticks = [0, 1, 2, 3].map(() => board.segment(state.A, state.B, "side-tick", construction));
  const hintSides = [
    board.segment(state.A, state.B, "hint-side", hints),
    board.segment(state.A, state.B, "hint-side", hints),
  ];

  const labelKeys = ["A", "B", "C", "D", "S", "P", "Q", "R"];
  const labels = {};
  for (const key of labelKeys) {
    labels[key] = board.label(state.A, key, "point-label", 8, -8, labelsLayer);
  }

  const handleOptions = {
    r: 9, step: 5, shift: 15, layer: handlesLayer,
    label: "Point. Drag it, or focus it and use the arrow keys to move it.",
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

  /** Two short strokes across a side, for the applet's equal-length marks. */
  function setTick(shape, a, b, along, on) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n, uy = dy / n;
    const mx = (a.x + b.x) / 2 + ux * along, my = (a.y + b.y) / 2 + uy * along;
    shape.show(on).set({ x: mx - uy * 6, y: my + ux * 6 }, { x: mx + uy * 6, y: my - ux * 6 });
  }

  function render() {
    for (const key of ["S", "C", "D"]) handles[key].set(state[key]);
    const g = Core.geometry(state);

    if (!g) {
      guideCircle.set(state.circle.c, state.circle.r).show(true);
      for (const s of secants.concat(triangleSides, [quad, collinearLine, segmentPR],
        apexDots, baseDots, angleArcs, ticks, hintSides)) s.show(false);
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
      [g.A, g.P], [g.C, g.P], [g.C, g.Q], [g.D, g.Q], [g.D, g.R], [g.B, g.R],
    ];
    sides.forEach((pair, i) => triangleSides[i].set(pair[0], pair[1]).show(true));
    if (g.extended) collinearLine.set(g.extended[0], g.extended[1]).show(true);
    else collinearLine.show(false);
    segmentPR.set(g.P, g.R).show(true);
    [g.P, g.Q, g.R].forEach((p, i) => apexDots[i].set(p).show(true));
    [g.A, g.B].forEach((p, i) => baseDots[i].set(p).show(true));

    const triples = {
      P: [g.A, g.C], Q: [g.D, g.C], R: [g.D, g.B],
      A: [g.P, g.C], B: [g.R, g.D], D: [g.C, g.Q], C: [g.D, g.Q], S: [g.A, g.B],
    };
    angleArcs.forEach((arc, i) => {
      const [key, p, q] = angleTriples[i];
      const only = triples[key];
      arc.set(g[key], only[0], only[1], 16).show(state.options.construction);
    });
    setTick(ticks[0], g.A, g.D, -5, state.options.construction);
    setTick(ticks[1], g.A, g.D, 5, state.options.construction);
    setTick(ticks[2], g.B, g.C, -5, state.options.construction);
    setTick(ticks[3], g.B, g.C, 5, state.options.construction);

    hintSides[0].set(g.A, g.Q).show(state.options.hint);
    hintSides[1].set(g.B, g.Q).show(state.options.hint);

    for (const key of labelKeys) labels[key].set(g[key]);
    for (const key of ["A", "B", "C", "D", "S", "P"]) labels[key].show(state.options.names);
    labels.Q.show(state.options.names && Core.dist(g.D, g.Q) > 10);
    labels.R.show(state.options.names && Core.dist(g.C, g.R) > 10
      && Core.dist(g.P, g.R) > 10);

    say(Core.describe(state), state.explored ? "done" : null);

    // Board units, not pixels: the record and the tutor read this position.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, S: g.S,
        P: g.P, Q: g.Q, R: g.R, length: state.length,
        circle: g.circle, options: state.options,
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
