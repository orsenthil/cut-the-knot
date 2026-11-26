"use strict";

/*
 * The page for Carpets In Square: drawing and input only; all the geometry is
 * in carpets-in-square-core.js. The SVG shows the square ABCD, M sliding down
 * the left side AB and N sliding along the bottom side BC, the four lines
 * AN, DN, DM and CM, and the coloured carpets they enclose. Every object is
 * created once and merely re-set on a redraw, so a handle keeps its focus.
 */

(function () {
  const Core = CarpetsInSquareCore;
  const board = Geom.board("board");
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const resetBtn = document.getElementById("resetBtn");

  const fills = board.layer("fills");
  const edges = board.layer("edges");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = Core.start();
  let g = Core.compute(state);

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const blue = board.polygon(g.blue, "carpet carpet-blue", fills);
  const reds = [
    board.polygon(g.reds[0], "carpet carpet-red", fills),
    board.polygon(g.reds[1], "carpet carpet-red", fills),
    board.polygon(g.reds[2], "carpet carpet-red", fills),
  ];
  const square = board.polygon(g.square, "square", edges);
  const cuts = g.lines.map(() => board.segment(g.A, g.A, "cut", edges));
  const corners = ["A", "B", "C", "D"].map((name) =>
    board.point(g[name], "corner-dot", 3.5, marks));
  const crossings = ["P", "Q", "R"].map(() =>
    board.point(g.A, "cross-dot", 3.5, marks));

  const positions = {
    A: [-17, -9], B: [-17, 18], C: [8, 18], D: [8, -9],
    M: [-19, 4], N: [4, 21], P: [6, -8], Q: [7, -8], R: [7, -8],
  };
  const pointLabels = {};
  for (const name of Object.keys(positions)) {
    pointLabels[name] = board.label(g[name], name, "point-label",
      positions[name][0], positions[name][1], labels);
  }

  const mHandle = board.handle("M", g.M, {
    r: 11, step: 5, shift: 15, layer: handles, cls: "geom-handle move-handle",
    label: "Point M on side AB. Drag it up or down, or focus it and use the arrow keys, to slide it along the left side",
    describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
    clamp: (q) => {
      const s = Core.compute(state);
      return { x: s.A.x, y: Core.clamp(q.y, s.A.y, s.B.y) };
    },
    onMove: (p) => apply({ type: "point", name: "M", point: p }),
  });
  const nHandle = board.handle("N", g.N, {
    r: 11, step: 5, shift: 15, layer: handles, cls: "geom-handle move-handle",
    label: "Point N on side BC. Drag it left or right, or focus it and use the arrow keys, to slide it along the bottom side",
    describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
    clamp: (q) => {
      const s = Core.compute(state);
      return { x: Core.clamp(q.x, s.B.x, s.C.x), y: s.B.y };
    },
    onMove: (p) => apply({ type: "point", name: "N", point: p }),
  });

  function draw() {
    // Draw() in the applet leaves out the two fills that need Q when its
    // Intersect returned NaN (M at A with N at C).
    if (g.finite) {
      blue.set(g.blue);
      for (let i = 0; i < 3; i++) reds[i].set(g.reds[i]);
    }
    blue.show(g.finite);
    for (let i = 0; i < 3; i++) reds[i].show(g.finite);
    square.set(g.square);
    for (let i = 0; i < cuts.length; i++) cuts[i].set(g.lines[i][0], g.lines[i][1]);
    for (let i = 0; i < 4; i++) corners[i].set(g[["A", "B", "C", "D"][i]]);
    for (let i = 0; i < 3; i++) {
      crossings[i].show(g.finite).set(g[["P", "Q", "R"][i]]);
    }

    // ShowNames' own rules: hide a label that would sit on top of its handle,
    // and hide P,Q,R while NoDraw or a NaN crossing leaves the carpets out.
    const dist = Geom.distance;
    const names = state.showNames;
    pointLabels.A.show(names).set(g.A);
    pointLabels.B.show(names).set(g.B);
    pointLabels.C.show(names).set(g.C);
    pointLabels.D.show(names).set(g.D);
    pointLabels.M.show(names && dist(g.A, g.M) > 10 && dist(g.B, g.M) > 10).set(g.M);
    pointLabels.N.show(names && dist(g.B, g.N) > 10 && dist(g.C, g.N) > 10).set(g.N);
    pointLabels.P.show(names && g.finite && !g.noDraw && dist(g.P, g.M) > 10).set(g.P);
    pointLabels.Q.show(names && g.finite && !g.noDraw &&
      dist(g.Q, g.M) > 10 && dist(g.R, g.N) > 10).set(g.Q);
    pointLabels.R.show(names && g.finite && !g.noDraw && dist(g.R, g.N) > 10).set(g.R);

    mHandle.set(g.M);
    nHandle.set(g.N);
  }

  /** Redraw, speak the picture and save the position for the record and tutor. */
  function render() {
    g = Core.compute(state);
    draw();
    say(Core.describe(state), state.explored ? "done" : null);
    namesBox.checked = state.showNames;
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    return true;
  }

  namesBox.addEventListener("change", () =>
    apply({ type: "option", key: "showNames", value: namesBox.checked }));
  resetBtn.addEventListener("click", () => apply({ type: "reset" }));

  // Classes are styled with CSS tokens, so a theme flip needs no new colours.
  board.onTheme(() => draw());

  render();
})();
