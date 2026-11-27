"use strict";

/*
 * Circles On AChord — the drawing and input, with all the geometry in
 * circles-on-a-chord-core.js.  O is the only draggable point: it slides up
 * and down the centre line of the big circle, and the row of touching
 * circles, the dashed and dotted "extra" circles and the chord PQ are all
 * rebuilt from it.  The controls reproduce the old applet's four checkboxes
 * and its N spinner (3 to 7).  Screen y grows downwards, as in the applet.
 */

(function () {
  const Core = CirclesOnAChordCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nOut = document.getElementById("nOut");
  const lessBtn = document.getElementById("lessN");
  const moreBtn = document.getElementById("moreN");
  const resetBtn = document.getElementById("resetBtn");
  const namesBox = document.getElementById("names");
  const circlesBox = document.getElementById("circles");
  const hintBox = document.getElementById("hint");
  const extraBox = document.getElementById("extra");

  let state = Core.start({});

  /* Layers, back to front: the big circle and the row, the chord and its
   * construction, the fixed dots and their names, then the handle on top. */
  const back = board.layer("back");
  const chords = board.layer("chords");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const bigCircle = board.circle(Core.CENTER, Core.RADIUS, "big-circle", back);
  const dashCircle = board.circle(Core.CENTER, Core.RADIUS, "dash-circle", back);
  const extraCircles = Core.geometry(state).dots.map(() =>
    board.circle(Core.CENTER, 1, "dot-circle", back));
  const row = [];
  for (let i = 0; i < 2 * Core.N_MAX; i++) {
    row.push(board.point(Core.CENTER, "row-dot", 2.5, back));
  }
  const smallCircles = [];
  for (let i = 0; i < Core.N_MAX; i++) {
    smallCircles.push(board.circle(Core.CENTER, 1, "small-circle", back));
  }

  const baseline = board.segment(Core.CENTER, Core.CENTER, "baseline", chords);
  const tangent = board.segment(Core.CENTER, Core.CENTER, "chord-pq", chords);
  const radius = board.segment(Core.CENTER, Core.CENTER, "radius", chords);
  const touchDot = board.point(Core.CENTER, "touch-dot", 4, dots);

  const marks = {};
  for (const key of ["A", "B", "P", "Q", "O"]) {
    marks[key] = board.point(Core.CENTER, "fixed-dot", 3.5, dots);
  }
  const labels = {};
  for (const key of ["A", "B", "P", "Q", "O", "W"]) {
    labels[key] = board.label(Core.CENTER, key, "point-label", 6, -7, names);
  }

  const handleO = board.handle("O", state.O, {
    step: 3, shift: 9, r: 9, layer: top,
    label: "Point O, the middle of the row of circles. Drag it up or down, or focus it and use the arrow keys.",
    describe: (p) => `at height ${Math.round(p.y)}. The chord PQ keeps the same length formula.`,
    clamp: (p) => Core.clampO(p),
    onMove: (p) => {
      state = Core.withO(state, p);
      render();
    },
  });

  /** `#status` is how the player's record sees an explored picture. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const opt = state.options;
    handleO.set(g.O);
    nOut.textContent = String(state.N);

    bigCircle.set(g.big.c, g.big.r);
    dashCircle.set(g.O, g.rho);
    dashCircle.show(opt.extra && g.doDraw);
    for (let i = 0; i < extraCircles.length; i++) {
      extraCircles[i].set(g.O, g.dots[i] ? g.dots[i].r : 1);
      extraCircles[i].show(opt.extra && g.doDraw);
    }
    for (let i = 0; i < row.length; i++) {
      row[i].set(g.row[i] || g.O);
      row[i].show(opt.extra && g.doDraw);
    }
    for (let i = 0; i < smallCircles.length; i++) {
      const c = g.circles[i];
      smallCircles[i].set(c ? c.c : g.O, c ? c.r : 1);
      smallCircles[i].show(opt.circles && g.doDraw && i < state.N);
    }

    baseline.set(g.A || g.O, g.B || g.O);
    baseline.show(g.doDraw);
    tangent.set(g.P || g.O, g.Q || g.O);
    tangent.show(g.doDraw);
    radius.set(g.big.c, g.tangent ? g.tangent.W : g.big.c);
    radius.show(opt.hint && g.doDraw);
    touchDot.set(g.tangent ? g.tangent.W : g.O);
    touchDot.show(opt.hint && g.doDraw);

    for (const key of ["A", "B", "P", "Q", "O"]) {
      marks[key].set(g[key] || g.O);
      marks[key].show(g.doDraw || key === "O");
    }
    labels.A.set(g.A || g.O);
    labels.B.set(g.B || g.O);
    labels.P.set(g.P || g.O);
    labels.Q.set(g.Q || g.O);
    labels.O.set(g.O);
    labels.W.set(g.tangent ? g.tangent.W : g.O);
    for (const key of ["A", "B", "P", "Q", "O", "W"]) {
      labels[key].show(opt.names && g.doDraw && (key !== "W" || opt.hint));
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        N: state.N, O: g.O, radius: g.r, rho: g.rho, chord: g.chord,
        big: g.big, A: g.A, B: g.B, P: g.P, Q: g.Q, options: opt,
      });
    }
  }

  lessBtn.addEventListener("click", () => {
    state = Core.setN(state, state.N - 1);
    render();
  });
  moreBtn.addEventListener("click", () => {
    state = Core.setN(state, state.N + 1);
    render();
  });
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  circlesBox.addEventListener("change", () => {
    state = Core.setOption(state, "circles", circlesBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  extraBox.addEventListener("change", () => {
    state = Core.setOption(state, "extra", extraBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start({ N: state.N });
    namesBox.checked = state.options.names;
    circlesBox.checked = state.options.circles;
    hintBox.checked = state.options.hint;
    extraBox.checked = state.options.extra;
    render();
  });

  // Colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
