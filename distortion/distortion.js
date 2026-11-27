"use strict";

/*
 * Distortion — the drawing and input for Bogomolny's Distorted Lines Illusion.
 *
 * The SVG shows the 400x300 applet canvas in its own viewBox, with a strip at
 * the foot for the spacing control.  Every circle is an SVG <circle> and
 * every triangle an SVG <polygon> with three straight sides, so any bending
 * the player sees is the illusion described on the cut-the-knot page, not a
 * deformation in the drawing.  All rules live in distortion-core.js.
 */

(function () {
  const Core = DistortionCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const spreadEl = document.getElementById("spread");
  const spreadOut = document.getElementById("spreadOut");
  const triBtn = document.getElementById("triOnCircles");
  const ctBtn = document.getElementById("circlesOnTriangles");
  const resetBtn = document.getElementById("resetBtn");

  // A triangle needs three <polygon> points; 48 is the largest number the
  // applet draws (side 285, spacing 2).  Circles peak at 72 in the other mode.
  const MAX_TRIANGLES = 48;
  const MAX_CIRCLES = 72;
  const TRACK_Y = 318;
  const TRACK_X0 = 40;
  const TRACK_X1 = 360;

  let state = Core.start({
    spread: Number(spreadEl.value),
    mode: Core.MODE_TRIANGLES_ON_CIRCLES,
  });

  /* Back to front: the rings, the triangles, the guide strip, then the
   * handle so that it keeps keyboard focus when the layers are reordered. */
  const rings = board.layer("rings");
  const trianglesLayer = board.layer("triangles");
  const guide = board.layer("guide");
  const handles = board.layer("handles");

  const ringShapes = [];
  for (let i = 0; i < MAX_CIRCLES; i++) {
    ringShapes.push(board.circle({ x: 0, y: 0 }, 1, "ring", rings));
  }
  const triShapes = [];
  for (let i = 0; i < MAX_TRIANGLES; i++) {
    triShapes.push(board.polygon([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
      "triangle", trianglesLayer));
  }
  board.segment({ x: TRACK_X0, y: TRACK_Y }, { x: TRACK_X1, y: TRACK_Y }, "track", guide);
  board.label({ x: TRACK_X0, y: TRACK_Y + 10 }, "2", "track-label", -4, 0, guide);
  board.label({ x: TRACK_X1, y: TRACK_Y + 10 }, "36", "track-label", -6, 0, guide);

  function handlePoint(spread) {
    const t = (spread - Core.SPREAD_MIN) / (Core.SPREAD_MAX - Core.SPREAD_MIN);
    return { x: TRACK_X0 + t * (TRACK_X1 - TRACK_X0), y: TRACK_Y };
  }

  function spreadFromX(x) {
    const t = (x - TRACK_X0) / (TRACK_X1 - TRACK_X0);
    return Core.clampSpread(Core.SPREAD_MIN + t * (Core.SPREAD_MAX - Core.SPREAD_MIN));
  }

  const step = (TRACK_X1 - TRACK_X0) / (Core.SPREAD_MAX - Core.SPREAD_MIN);
  const spacingHandle = board.handle("spacing", handlePoint(state.spread), {
    r: 9, step: step, shift: 5 * step, layer: handles,
    label: "Spacing handle. Drag left or right, or focus it and use the arrow keys, to change the spacing between the crossing lines.",
    clamp: (p) => ({ x: Math.max(TRACK_X0, Math.min(TRACK_X1, p.x)), y: TRACK_Y }),
    onMove: (p) => {
      state = Core.setOption(state, "spread", spreadFromX(p.x));
      render();
    },
  });

  /** `#status` is also how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    // The applet paints circles first in one mode and triangles first in the
    // other: move the two existing layers rather than rebuilding the drawing.
    if (state.mode === Core.MODE_TRIANGLES_ON_CIRCLES) {
      board.root.insertBefore(rings, trianglesLayer);
    } else {
      board.root.insertBefore(trianglesLayer, rings);
    }

    for (let i = 0; i < ringShapes.length; i++) {
      const c = g.circles[i];
      ringShapes[i].show(!!c);
      if (c) ringShapes[i].set({ x: c.cx, y: c.cy }, c.radius);
    }
    for (let i = 0; i < triShapes.length; i++) {
      const t = g.triangles[i];
      triShapes[i].show(!!t);
      if (t) triShapes[i].set(t.vertices);
    }

    spacingHandle.set(handlePoint(state.spread));
    spreadEl.value = String(state.spread);
    spreadOut.textContent = String(state.spread);
    const onCircles = state.mode === Core.MODE_TRIANGLES_ON_CIRCLES;
    triBtn.setAttribute("aria-pressed", onCircles ? "true" : "false");
    ctBtn.setAttribute("aria-pressed", onCircles ? "false" : "true");

    say(Core.describe(state), state.explored ? "done" : null);
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  spreadEl.addEventListener("input", () => {
    state = Core.setOption(state, "spread", Number(spreadEl.value));
    render();
  });
  triBtn.addEventListener("click", () => {
    state = Core.setOption(state, "mode", Core.MODE_TRIANGLES_ON_CIRCLES);
    render();
  });
  ctBtn.addEventListener("click", () => {
    state = Core.setOption(state, "mode", Core.MODE_CIRCLES_ON_TRIANGLES);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours come from CSS classes, but keep the shared redraw hook.
  board.onTheme(render);
  render();
})();
