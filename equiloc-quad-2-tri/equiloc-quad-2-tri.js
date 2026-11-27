"use strict";

/*
 * Equiloc Quad 2Tri — drawing and input only. The geometry is in
 * equiloc-quad-2-tri-core.js: A and B are fixed on the circle, S slides round
 * it, and C and D slide along the lines B-S and A-S. The four midpoints K, L,
 * M, N form the rhombus in the middle. Every SVG shape is created once and
 * only updated on a redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = EquilocQuad2TriCore;
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
  const rhombusSides = [0, 1, 2, 3].map(() =>
    board.segment(state.A, state.B, "rhombus-side", shapes));
  const baseDots = [0, 1].map(() => board.point(state.A, "base-dot", 3, shapes));
  const midDots = [0, 1, 2, 3].map(() => board.point(state.A, "mid-dot", 4, shapes));

  /* The applet's Show construction box: A-K, K-C, B-L, L-D, C-N, D-N,
   * A-M, M-B, and the two equal sides BC and AD. */
  const constructionLines = [0, 1, 2, 3, 4, 5, 6, 7].map(() =>
    board.segment(state.A, state.B, "construction-line", construction));
  const equalSides = [0, 1].map(() =>
    board.segment(state.A, state.B, "construction-side", construction));
  /* The applet's hint re-strokes the four sides of the rhombus. */
  const hintSides = [0, 1, 2, 3].map(() =>
    board.segment(state.A, state.B, "hint-side", hints));

  const labelKeys = ["A", "B", "C", "D", "S", "K", "L", "M", "N"];
  const labels = {};
  for (const key of labelKeys) {
    labels[key] = board.label(state.A, key, "point-label", 8, -8, labelsLayer);
  }

  const handleOptions = {
    r: 9, step: 5, shift: 15, layer: handlesLayer,
    label: "Point. Drag it, or focus it and use the arrow keys to move it.",
  };
  const descriptions = {
    S: "Point S. Drag it around the circle, or focus it and use the arrow keys.",
    C: "Point C. Drag it along the line from B to S, or focus it and use the arrow keys.",
    D: "Point D. Drag it along the line from A to S, or focus it and use the arrow keys.",
  };
  const handles = {};
  for (const key of ["S", "C", "D"]) {
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

  function render() {
    for (const key of ["S", "C", "D"]) handles[key].set(state[key]);
    const g = Core.geometry(state);

    if (!g) {
      guideCircle.set(state.circle.c, state.circle.r).show(true);
      for (const s of secants.concat(rhombusSides, [quad], baseDots, midDots,
        constructionLines, equalSides, hintSides)) s.show(false);
      for (const key of labelKeys) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    guideCircle.set(g.circle.c, g.circle.r).show(true);
    secants[0].set(g.B, g.S).show(true);
    secants[1].set(g.A, g.S).show(true);
    quad.set([g.A, g.B, g.C, g.D]).show(true);

    const sideKeys = ["KM", "ML", "LN", "NK"];
    rhombusSides.forEach((shape, i) => {
      const pair = g.sides[sideKeys[i]];
      shape.set(pair[0], pair[1]).show(true);
    });
    [g.A, g.B].forEach((p, i) => baseDots[i].set(p).show(true));
    [g.K, g.L, g.M, g.N].forEach((p, i) => midDots[i].set(p).show(true));

    g.construction.slice(0, 8).forEach((pair, i) => {
      constructionLines[i].set(pair[0], pair[1]).show(state.options.construction);
    });
    equalSides[0].set(g.B, g.C).show(state.options.construction);
    equalSides[1].set(g.A, g.D).show(state.options.construction);

    sideKeys.forEach((key, i) => {
      const pair = g.sides[key];
      hintSides[i].set(pair[0], pair[1]).show(state.options.hint);
    });

    for (const key of labelKeys) {
      labels[key].set(g[key]).show(state.options.names);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // Board units, not pixels: the record and the tutor read this position.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, S: g.S,
        K: g.K, L: g.L, M: g.M, N: g.N,
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
