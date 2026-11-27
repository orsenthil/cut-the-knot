"use strict";

/*
 * The drawing and input for Dave Richeson's Japanese theorem.  All geometry
 * lives in dave-richeson-core.js.  The SVG holds the circumcircle, the
 * polygon's sides, the random diagonals, one incircle per triangle, and up
 * to thirty focusable point handles; changing N shows more or fewer of the
 * same elements, so keyboard focus survives every redraw.
 *
 * Blue circles are positively oriented triangles, red ones negative, just as
 * in the applet.  There is nothing to win: the status line reports the
 * signed sum that the theorem keeps fixed.
 */

(() => {
  const Core = DaveRichesonCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const resetBtn = document.getElementById("resetBtn");
  const triBtn = document.getElementById("triangulateBtn");

  const seed = () => (Math.random() * 4294967296) >>> 0 || 1;
  let state = Core.start({ n: Number(nInput.value) || Core.DEFAULT_N, seed: seed() });

  /* Back to front: the circle, the polygon, its diagonals, the incircles,
   * then the handles that stay on top and keep keyboard focus. */
  const circleLayer = board.layer("circle");
  const sideLayer = board.layer("sides");
  const diagonalLayer = board.layer("diagonals");
  const incircleLayer = board.layer("incircles");
  const handleLayer = board.layer("handles");

  const circum = board.circle(Core.CENTER, Core.RADIUS, "circum", circleLayer);
  const sides = Array.from({ length: Core.MAX_N }, () =>
    board.segment(Core.CENTER, Core.CENTER, "side", sideLayer));
  const diagonals = Array.from({ length: Core.MAX_N - 3 }, () =>
    board.segment(Core.CENTER, Core.CENTER, "diagonal", diagonalLayer));
  const circles = Array.from({ length: Core.MAX_N - 2 }, () =>
    board.circle(Core.CENTER, 0, "incircle", incircleLayer));

  const handles = Array.from({ length: Core.MAX_N }, (_, i) =>
    board.handle(`V${i + 1}`, Core.pointAt(0), {
      r: 11, step: 4, shift: 12, layer: handleLayer,
      label: `Vertex ${i + 1}. Drag it around the circle, or focus it and use the arrow keys.`,
      clamp: (p) => Core.project(p),
      onMove: (p, name) => {
        state = Core.moveVertex(state, Number(name.slice(1)) - 1, p);
        render();
      },
    }));

  /** `#status` is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    circum.set(g.circle.c, g.circle.r);

    for (let i = 0; i < sides.length; i++) {
      sides[i].show(i < state.n);
      if (i < state.n) sides[i].set(state.points[i], state.points[(i + 1) % state.n]);
    }
    for (let i = 0; i < diagonals.length; i++) {
      const d = state.diagonals[i];
      diagonals[i].show(!!d);
      if (d) diagonals[i].set(state.points[d[0]], state.points[d[1]]);
    }
    for (let i = 0; i < circles.length; i++) {
      const c = g.circles[i];
      circles[i].show(!!c);
      if (!c) continue;
      circles[i].node.setAttribute("class",
        c.sign > 0 ? "incircle incircle-pos" : "incircle incircle-neg");
      circles[i].set({ x: c.x, y: c.y }, c.r);
    }
    for (let i = 0; i < handles.length; i++) {
      handles[i].show(i < state.n);
      if (i < state.n) handles[i].set(state.points[i]);
    }

    if (Number(nInput.value) !== state.n) nInput.value = String(state.n);
    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        n: state.n,
        points: state.points,
        triangles: state.triangles,
        diagonals: state.diagonals,
        sum: g.sum,
        blue: g.blue,
        red: g.red,
      });
    }
  }

  nInput.addEventListener("change", () => {
    state = Core.setN(state, nInput.value);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.setN(state, state.n);
    render();
  });
  triBtn.addEventListener("click", () => {
    state = Core.triangulate(state);
    render();
  });

  // SVG colours are CSS classes; redraw on a theme flip as Geom asks.
  board.onTheme(render);
  render();
})();
