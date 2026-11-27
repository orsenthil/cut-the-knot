"use strict";

/*
 * Equilic Quadrilateral I, A Variation — drawing and input only.
 *
 * The geometry lives in equiloc-quad-1-tri-core.js: A and B are fixed on the
 * circle, S is a free handle, C and D slide on the lines from B and A towards
 * S, and Q is the apex of the isosceles triangle on CD. The "construction"
 * box marks the two equal angles and the equal sides; "hint" draws the two
 * matching triangles ADQ and BCQ. Shapes are created once and only updated on
 * a redraw, so the keyboard focus on a handle survives every change.
 */

(function () {
  const Core = EquilocQuad1TriCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const constructionBox = document.getElementById("construction");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const quadLayer = board.layer("quad");
  const marks = board.layer("marks");
  const hintLayer = board.layer("hint");
  const dots = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const top = board.layer("handles");

  const circleShape = board.circle(Core.CIRCLE.c, Core.CIRCLE.r, "guide-circle", guides);
  const secants = [board.segment(state.A, state.S, "secant", guides),
    board.segment(state.B, state.S, "secant", guides)];
  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", quadLayer);
  const apexSides = [board.segment(state.C, state.Q || state.C, "apex-side", quadLayer),
    board.segment(state.D, state.Q || state.C, "apex-side", quadLayer)];
  const angleAtS = board.angleArc(state.S, state.A, state.B, 24, "angle-mark", marks);
  const angleAtQ = board.angleArc(state.C, state.C, state.D, 22, "angle-mark", marks);
  const hintAngles = [
    board.angleArc(state.C, state.Q || state.C, state.B, 20, "hint-angle", hintLayer),
    board.angleArc(state.D, state.Q || state.C, state.A, 20, "hint-angle", hintLayer),
  ];
  const hintLines = [board.segment(state.A, state.Q || state.A, "hint-line", hintLayer),
    board.segment(state.B, state.Q || state.B, "hint-line", hintLayer)];

  /* Two ticks mark AD and BC, one tick marks QD and QC, as in the applet. */
  function makeTicks(count, layer, cls) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(board.segment(state.A, state.B, cls, layer));
    return out;
  }
  function setTicks(shapes, p, q, size, gap) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    for (let i = 0; i < shapes.length; i++) {
      const t = (i - (shapes.length - 1) / 2) * gap;
      const x = mid.x + ux * t, y = mid.y + uy * t;
      shapes[i].set({ x: x - nx * size, y: y - ny * size },
        { x: x + nx * size, y: y + ny * size });
    }
  }
  const longTicks = [
    makeTicks(2, marks, "side-tick"), makeTicks(2, marks, "side-tick"),
  ];
  const shortTicks = [
    makeTicks(1, marks, "side-tick"), makeTicks(1, marks, "side-tick"),
  ];

  const baseDots = [board.point(state.A, "base-dot", 4, dots),
    board.point(state.B, "base-dot", 4, dots)];
  const apexDot = board.point(state.A, "apex-dot", 5, dots);
  const arcDot = board.point(state.A, "arc-dot", 5, dots);

  const labelKeys = ["A", "B", "C", "D", "S", "Q"];
  const labelOffset = {
    A: [-16, -9], B: [8, -9], C: [8, 17], D: [-16, 17],
    S: [8, -8], Q: [-16, -9],
  };
  const labelsFor = {};
  for (const key of labelKeys) {
    const off = labelOffset[key];
    labelsFor[key] = board.label(state.A, key, "point-label", off[0], off[1], labelsLayer);
  }
  const arcLabel = board.label(state.A, "arc middle", "point-label", 8, 17, labelsLayer);

  const handleOptions = {
    r: 9, step: 5, shift: 15, layer: top,
    clamp: (p) => Core.clamp(p),
  };
  const handles = {};
  for (const key of Core.legalMoves()) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      label: `Point ${key}. Drag it, or focus it and use the arrow keys to move the diagram.`,
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

  function render() {
    const g = Core.compute(state);
    for (const key of ["S", "C", "D"]) handles[key].set(state[key]);

    if (!g) {
      for (const shape of [circleShape, quad, angleAtS, angleAtQ, arcDot, arcLabel]
        .concat(secants, apexSides, hintLines, hintAngles, baseDots, apexDot,
          longTicks[0], longTicks[1], shortTicks[0], shortTicks[1])) shape.show(false);
      for (const key of labelKeys) labelsFor[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) {
        window.Track.state({ S: state.S, C: state.C, D: state.D, length: state.length,
          options: state.options, degenerate: true });
      }
      return;
    }

    circleShape.set(g.circle.c, g.circle.r).show(true);
    secants[0].set(g.A, g.S).show(true);
    secants[1].set(g.B, g.S).show(true);
    quad.set([g.A, g.B, g.C, g.D]).show(true);
    apexSides[0].set(g.C, g.Q || g.C).show(!!g.Q);
    apexSides[1].set(g.D, g.Q || g.D).show(!!g.Q);
    baseDots[0].set(g.A).show(true);
    baseDots[1].set(g.B).show(true);
    apexDot.set(g.Q || g.A).show(!!g.Q);

    angleAtS.set(g.S, g.A, g.B, 24).show(state.options.construction && !!g.Q);
    angleAtQ.set(g.Q || g.A, g.C, g.D, 22).show(state.options.construction && !!g.Q);
    hintAngles[0].set(g.C, g.Q || g.C, g.B, 20).show(state.options.hint && !!g.Q);
    hintAngles[1].set(g.D, g.Q || g.C, g.A, 20).show(state.options.hint && !!g.Q);
    hintLines[0].set(g.A, g.Q || g.A).show(state.options.hint && !!g.Q);
    hintLines[1].set(g.B, g.Q || g.B).show(state.options.hint && !!g.Q);

    const showTicks = !!g.Q && (state.options.construction || state.options.hint);
    setTicks(longTicks[0], g.A, g.D, 5, 7);
    setTicks(longTicks[1], g.B, g.C, 5, 7);
    setTicks(shortTicks[0], g.Q || g.A, g.C, 5, 0);
    setTicks(shortTicks[1], g.Q || g.A, g.D, 5, 0);
    for (const group of longTicks.concat(shortTicks)) {
      for (const tick of group) tick.show(showTicks);
    }

    arcDot.set(g.arc).show(state.options.construction || state.options.hint);
    arcLabel.set(g.arc, "arc middle", 8, -9).show(state.options.construction);

    const showNames = state.options.names;
    for (const key of labelKeys) {
      let on = showNames && !!g.Q;
      if (key === "A" || key === "B" || key === "S") on = showNames;
      if (key === "C" || key === "D") {
        on = on && Core.dist(g[key], g.Q) > 10;
      }
      labelsFor[key].set(g[key] || g.S).show(on);
    }
    labelsFor.Q.show(showNames && !!g.Q);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, S: g.S, C: g.C, D: g.D, Q: g.Q, arc: g.arc,
        angle: g.angle, length: g.length, claims: g.claims,
        measures: g.measures, options: state.options,
      });
    }
  }

  namesBox.checked = state.options.names;
  constructionBox.checked = state.options.construction;
  hintBox.checked = state.options.hint;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  constructionBox.addEventListener("change", () => {
    state = Core.setOption(state, "construction", constructionBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
