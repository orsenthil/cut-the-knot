"use strict";

/*
 * The page for Equilateral Triangles: drawing and input only. The geometry
 * lives in equilateral-triangles-core.js. The board is a 400x300 SVG using the
 * applet's own coordinates: O is the centre of the circle, A1,A2,A3 are the
 * three blue handles, each with its partner B1,B2,B3 a 60-degree turn away.
 * The filled green shapes are the three equilateral triangles; the outlined
 * one joins the midpoints B1A2, B2A3 and B3A1.
 */

(function () {
  const Core = EquilateralTrianglesCore;
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const newBtn = document.getElementById("newBtn");
  const restrictBox = document.getElementById("restrictBox");

  let state = Core.start();

  const board = Geom.board(document.getElementById("board"));
  const circleLayer = board.layer("circle");
  const fillLayer = board.layer("fills");
  const edgeLayer = board.layer("edges");
  const midLayer = board.layer("midpoint");
  const dotLayer = board.layer("dots");
  const handleLayer = board.layer("handles");
  const labelLayer = board.layer("labels");

  const zero = Core.pt(0, 0);
  const guide = board.circle(state.center, state.radius, "guide-circle", circleLayer);
  const centerDot = board.point(state.center, "center-dot", 4, dotLayer);
  const fills = [0, 1, 2].map((i) => board.polygon([], "tri-fill tri-fill-" + i, fillLayer));
  const edges = [0, 1, 2].map(() => [0, 1, 2].map(() =>
    board.segment(zero, zero, "tri-edge", edgeLayer)));
  const midFill = board.polygon([], "mid-fill", midLayer);
  const midEdges = [0, 1, 2].map(() => board.segment(zero, zero, "mid-edge", midLayer));
  const midDots = [0, 1, 2].map(() => board.point(zero, "mid-dot", 4, dotLayer));
  const labels = [0, 1, 2].map((i) => board.label(zero, "A" + (i + 1), "handle-label", 11, -10, labelLayer));

  /**
   * Shows a line under the game. `kind` is "win", "lose" or "done"; this is a
   * demo with no such ending, so it is never used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const c = Core.configuration(state);
    const s = Core.sides(c);
    const fmt = (n) => n.toFixed(1);

    guide.set(c.center, c.radius).show(state.restrict);
    centerDot.set(c.center);
    fills.forEach((shape, i) => shape.set(c.triangles[i]));
    edges.forEach((trio, i) => trio.forEach((line, k) => line.set(c.triangles[i][k], c.triangles[i][(k + 1) % 3])));
    midFill.set(c.M);
    midEdges.forEach((line, i) => line.set(c.M[i], c.M[(i + 1) % 3]));
    midDots.forEach((dot, i) => dot.set(c.M[i]));
    handles.forEach((handle, i) => {
      handle.set(c.A[i]);
      labels[i].set(c.A[i], "A" + (i + 1), 11, -10);
    });

    readoutEl.textContent = `Green triangle sides: ${fmt(s[0])}, ${fmt(s[1])}, ${fmt(s[2])}.`;
    say(state.restrict
      ? "The three blue points stay on the circle. Drag one, or focus it and use the arrow keys, and watch the green triangle stay equilateral."
      : "The points are free of the circle now. The green triangle is still equilateral.");

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const handles = [0, 1, 2].map((i) => board.handle("A" + (i + 1), state.points[i], {
    r: 13, step: 3, shift: 5, cls: "geom-handle point-handle",
    label: "Point A" + (i + 1) + ". Drag it, or focus it and use the arrow keys, to move this triangle's corner",
    describe: (p) => "board position " + Math.round(p.x) + ", " + Math.round(p.y),
    clamp: (p) => ({ x: Geom.clamp(p.x, 12, 388), y: Geom.clamp(p.y, 12, 288) }),
    layer: handleLayer,
    onMove: (p) => {
      state = Core.withPoint(state, i, p);
      render();
    },
  }));

  newBtn.addEventListener("click", () => {
    state = Core.start({ restrict: restrictBox.checked });
    render();
  });
  restrictBox.addEventListener("change", () => {
    state = Core.withRestrict(state, restrictBox.checked);
    render();
  });

  // The shapes are styled with CSS classes, so a theme flip needs no new
  // colours; redrawing keeps every shape in step with the saved position.
  board.onTheme(render);

  render();
})();
