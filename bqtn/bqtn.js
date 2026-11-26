"use strict";

/*
 * The page for BQTN: drawing and input only; the theorem is in bqtn-core.js.
 *
 * An SVG holds a convex polygon with a handle on each corner and one on P,
 * the point that starts the chain. The circles, their touch points and the
 * highlighted pair are drawn with Geom helpers and only their geometry
 * changes on a redraw, so keyboard focus stays on the handle being moved.
 */

(function () {
  const Core = BqtnCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const nInput = document.getElementById("nInput");
  const whichInput = document.getElementById("whichInput");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  let state = Core.start();
  let checked = false;

  const circleLayer = board.layer("circles");
  const sideLayer = board.layer("sides");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  /* Objects are made once at the largest possible N, then shown as needed. */
  const poly = board.polygon(state.points, "polygon", sideLayer);
  const bisector = board.segment(state.points[0], state.points[0], "bisector", sideLayer);
  const circles = [];
  const touchDots = [];
  const labels = [];
  for (let i = 0; i <= Core.MAX_CIRCLES; i++) {
    circles.push(board.circle(state.points[0], 1, "chain-circle", circleLayer));
    touchDots.push(board.point(state.points[0], "touch-dot", 2.6, dotLayer));
  }
  for (let i = 0; i < Core.N_MAX; i++) {
    labels.push(board.label(state.points[0], "", "vlabel", -9, -7, labelLayer));
  }
  const pairLabels = [
    board.label(state.points[0], "", "clabel", 6, -6, labelLayer),
    board.label(state.points[0], "", "clabel", 6, -6, labelLayer),
  ];
  const pLabel = board.label(state.points[0], "P", "plabel", -9, -9, labelLayer);

  /**
   * Shows a line under the board. "done" is how the player's record learns
   * that this illustration has been explored; there is no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const n = state.n;
    const total = 2 * n;
    poly.set(state.points);

    const foot = m.feet[0];
    bisector.show(Boolean(foot) && Number.isFinite(foot.x));
    if (bisector.node.style.display !== "none" && foot) bisector.set(state.points[0], foot);

    for (let i = 0; i < circles.length; i++) {
      const c = m.circles[i];
      const show = Boolean(c) && m.finite && c.r > 0.15 && c.r < 1000;
      circles[i].show(show);
      touchDots[i].show(show);
      if (show) {
        circles[i].set(c.center, c.r);
        circles[i].node.setAttribute("class",
          Core.emphasis(state, i) ? "chain-circle emph" : "chain-circle");
        touchDots[i].set(c.tangent);
      }
    }
    for (let i = 0; i < labels.length; i++) {
      const show = i < n;
      labels[i].show(show);
      if (show) labels[i].set(state.points[i], "A" + (i + 1));
    }

    const allMarked = state.which === total;
    pairLabels[0].show(!allMarked && m.finite);
    pairLabels[1].show(!allMarked && m.finite);
    if (!allMarked && m.finite) {
      const pair = state.which;
      const other = pair + 1;
      pairLabels[0].set(m.circles[pair].center, "C" + (pair + 1));
      pairLabels[1].set(m.circles[other].center, "C" + (other + 1));
    }
    pLabel.show(m.finite && Boolean(m.P));
    if (m.finite) pLabel.set(m.P);

    for (let i = 0; i < vertexHandles.length; i++) {
      vertexHandles[i].show(i < n);
      if (i < n) vertexHandles[i].set(state.points[i]);
    }
    if (m.finite) pHandle.set(m.P);

    if (!m.finite) {
      say("Move the corners apart so the circles can be drawn.", null);
    } else if (checked && m.returns) {
      say("The chain closes: the last of the " + total + " steps returns to circle 1 (C" +
        total + " = C1 on the page). Chain length " + m.period + ".", "done");
    } else if (checked) {
      say("This chain misses the first circle by " + fmt(m.deviation) +
        ". Try an odd number of sides.", null);
    } else {
      say(total + " circles, " + (allMarked ? "all marked" :
        "pair " + (state.which + 1) + " marked") + ". Drag a corner or P, then press Check the chain.", null);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /** P is kept on the bisector segment, as DoubLine.RestrictToSegment does. */
  function clampP(p) {
    const foot = Core.feet(state)[0];
    if (!foot || !Number.isFinite(foot.x)) return inside(p);
    return Core.lerp(foot, state.points[0], Core.parameterAt(state, p));
  }

  const vertexHandles = [];
  for (let i = 0; i < Core.N_MAX; i++) {
    vertexHandles.push(board.handle("A" + (i + 1), state.points[Math.min(i, state.n - 1)], {
      r: 7, step: 3, shift: 9, layer: handleLayer, clamp: inside,
      label: "Corner " + (i + 1) + ". Drag, or focus and use the arrow keys to move it.",
      describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
      onMove: (p) => {
        state = Core.withPoint(state, i, p);
        checked = false;
        render();
      },
    }));
  }
  const pHandle = board.handle("P", Core.startPoint(state), {
    r: 8, step: 2, shift: 8, cls: "geom-handle start-handle", layer: handleLayer,
    label: "Point P, where the chain starts. Drag, or focus and use the arrow keys to move it along the bisector.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    clamp: clampP,
    onMove: (p) => {
      state = Core.withT(state, Core.parameterAt(state, p));
      checked = false;
      render();
    },
  });

  function syncInputs() {
    nInput.value = String(state.n);
    whichInput.max = String(2 * state.n);
    whichInput.value = String(state.which);
  }

  function newGame() {
    state = Core.start({ n: state.n });
    checked = false;
    syncInputs();
    render();
    vertexHandles[0].node.focus();
  }

  function checkChain() {
    checked = true;
    render();
  }

  newBtn.addEventListener("click", newGame);
  checkBtn.addEventListener("click", checkChain);
  nInput.addEventListener("change", () => {
    state = Core.withN(state, Number(nInput.value));
    checked = false;
    syncInputs();
    render();
  });
  whichInput.addEventListener("change", () => {
    state = Core.withWhich(state, Number(whichInput.value));
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "c" || e.key === "C") checkChain();
  });

  board.onTheme(render);
  syncInputs();
  render();
})();
