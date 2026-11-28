"use strict";

/*
 * The drawing and input for Many Circles.  All the construction is in
 * many-circles-core.js; this file only puts the circles, the polygon, the
 * crossing points and the draggable centres and corners on an SVG board.
 * The spinner reproduces the applet's 3..10 circles and Reset gives the first
 * corner a new random place on the rightmost circle.
 */

(function () {
  const Core = ManyCirclesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const countEl = document.getElementById("count");
  const resetBtn = document.getElementById("resetBtn");

  /** A rare random start lands on a crossing, which the Java geometry cannot
   *  finish either; pick another angle so the picture is always complete. */
  function freshState(n) {
    let s = Core.start({ n: n });
    for (let tries = 0; tries < 50; tries++) {
      let complete = true;
      for (let i = 0; i < s.n; i++) {
        if (!s.vertices[i] || !Number.isFinite(s.vertices[i].x)) complete = false;
      }
      if (complete) return s;
      s = Core.start({ n: n });
    }
    return s;
  }

  let state = freshState(Number(countEl.value));

  /* Layers, back to front: the circles, the polygon, the construction lines,
   * the crossing dots and labels, then the handles that keep keyboard focus. */
  const circleLayer = board.layer("circles");
  const polygonLayer = board.layer("polygon");
  const guideLayer = board.layer("guides");
  const marksLayer = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const MAX = Core.MAX_N;
  const circleShapes = [];
  const guideShapes = [];
  const crossingShapes = [];
  for (let i = 0; i < MAX; i++) {
    circleShapes.push(board.circle({ x: 0, y: 0 }, 1, "mc-circle", circleLayer));
    guideShapes.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "mc-guide", guideLayer));
    crossingShapes.push(board.point({ x: 0, y: 0 }, "mc-cross", 3.2, marksLayer));
  }
  const polygon = board.polygon([state.vertices[0]], "mc-polygon", polygonLayer);
  const origin = board.point(Core.O, "mc-origin", 3.4, marksLayer);
  const originLabel = board.label(Core.O, "O", "mc-label", 7, -7, labelsLayer);

  let centerHandles = [];
  let vertexHandles = [];

  /** New handles for a new circle count; old ones leave the tab order. */
  function buildHandles(n) {
    // Remove rather than hide: hidden SVG handles would still be found by a
    // keyboard search and would keep stale nodes in the tab order.
    for (const h of centerHandles.concat(vertexHandles)) h.node.remove();
    centerHandles = [];
    vertexHandles = [];
    for (let i = 0; i < n; i++) {
      centerHandles.push(board.handle("c" + i, state.centers[i], {
        r: 8, step: 4, shift: 12, layer: handleLayer,
        cls: "geom-handle center-handle",
        label: "Centre of circle " + (i + 1) + ". Drag it, or use the arrow keys.",
        clamp: (q) => Core.projectCenter(state, q),
        describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
        onMove: (p) => { state = Core.moveCenter(state, i, p); render(); },
      }));
      vertexHandles.push(board.handle("v" + i, state.vertices[i], {
        r: 8, step: 4, shift: 12, layer: handleLayer,
        cls: "geom-handle vertex-handle",
        label: "Corner " + (i + 1) + " on circle " + (i + 1) +
          ". Drag it, or use the arrow keys; it stays on its circle.",
        clamp: (q) => Core.onCircle(state.centers[i], state.circles[i].r, q),
        describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
        onMove: (p) => { state = Core.moveVertex(state, i, p); render(); },
      }));
    }
  }

  /** `#status` is how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    polygon.set(state.vertices);
    origin.set(Core.O);
    originLabel.set(Core.O, "O");
    for (let i = 0; i < MAX; i++) {
      const live = i < state.n;
      circleShapes[i].show(live);
      guideShapes[i].show(live);
      crossingShapes[i].show(live);
      if (!live) continue;
      circleShapes[i].set(state.circles[i].c, state.circles[i].r);
      guideShapes[i].set(state.vertices[i], state.intersections[i]);
      crossingShapes[i].set(state.intersections[i]);
    }
    for (let i = 0; i < state.n; i++) {
      centerHandles[i].set(state.centers[i]);
      vertexHandles[i].set(state.vertices[i]);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  countEl.addEventListener("change", () => {
    const n = Math.max(Core.MIN_N, Math.min(Core.MAX_N, Math.trunc(Number(countEl.value) || Core.MIN_N)));
    countEl.value = String(n);
    const explored = state.explored;
    state = freshState(n);
    state.explored = explored;
    buildHandles(state.n);
    render();
  });

  function resetState() {
    let s = Core.reset(state);
    for (let tries = 0; tries < 50; tries++) {
      let complete = true;
      for (let i = 0; i < s.n; i++) {
        if (!s.vertices[i] || !Number.isFinite(s.vertices[i].x)) complete = false;
      }
      if (complete) break;
      s = Core.reset(s);
    }
    return s;
  }

  resetBtn.addEventListener("click", () => {
    state = resetState();
    render();
  });

  board.onTheme(render);
  buildHandles(state.n);
  render();
})();
