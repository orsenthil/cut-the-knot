"use strict";

/*
 * The page for Evelyn N: drawing and input only.  All of the geometry and the
 * option ranges live in evelyn-n-core.js.
 *
 * The board shows the polygon, its sides, the angle bisectors and the chain
 * of circles the applet computes.  Corners and the yellow point on the first
 * bisector are Geom handles, so a pointer or the arrow keys can move them.
 * Shapes are created once and only updated on a redraw, so a handle keeps
 * keyboard focus after every move.
 */

(() => {
  const C = EvelynNCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nValue = document.getElementById("nValue");
  const nMinus = document.getElementById("nMinus");
  const nPlus = document.getElementById("nPlus");
  const resetBtn = document.getElementById("resetBtn");
  const whichInput = document.getElementById("whichInput");
  const whichMinus = document.getElementById("whichMinus");
  const whichPlus = document.getElementById("whichPlus");

  let state = C.start();

  /* Layers, back to front. */
  const fillLayer = board.layer("fill");
  const guideLayer = board.layer("guides");
  const circleLayer = board.layer("circles");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const polygon = board.polygon(state.vertices, "poly-fill", fillLayer);
  const sides = board.polygon(state.vertices, "poly-side", guideLayer);
  const bisectors = [];
  const circles = [];
  for (let i = 0; i < C.N_MAX; i++) {
    bisectors.push(board.segment(state.vertices[0], state.vertices[0], "bisector", guideLayer));
  }
  for (let i = 0; i < 2 * C.N_MAX; i++) {
    circles.push(board.circle(state.vertices[0], 1, "chain-circle", circleLayer));
  }
  const pLabel = board.label(state.vertices[0], "P", "board-label", 9, -9, labelLayer);

  const clampToBoard = (q) => ({
    x: Geom.clamp(q.x, 8, C.VIEW.width - 8),
    y: Geom.clamp(q.y, 8, C.VIEW.height - 8),
  });
  const cornerHandles = [];
  for (let i = 0; i < C.N_MAX; i++) {
    cornerHandles.push(board.handle("corner" + (i + 1), state.vertices[0], {
      r: 8, step: 4, shift: 12, layer: handleLayer, clamp: clampToBoard,
      label: "Corner " + (i + 1) + ". Drag it, or focus it and use the arrow keys to move the polygon.",
      onMove: (p) => {
        state = C.moveVertex(state, i, p);
        render();
      },
    }));
  }
  const pHandle = board.handle("P", state.vertices[0], {
    r: 9, step: 4, shift: 12, cls: "geom-handle p-handle", layer: handleLayer,
    clamp: clampToBoard,
    label: "Point P. Drag it, or focus it and use the arrow keys, to change the first circle's radius.",
    onMove: (p) => {
      state = C.movePoint(state, p);
      render();
    },
  });

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = C.geometry(state);
    nValue.textContent = String(state.n);
    nMinus.disabled = state.n <= C.N_MIN;
    nPlus.disabled = state.n >= C.N_MAX;
    whichInput.max = String(2 * state.n);
    whichInput.value = String(state.whichSpinner);
    whichMinus.disabled = state.whichSpinner <= 0;
    whichPlus.disabled = state.whichSpinner >= 2 * state.n;

    if (!g) {
      say("This polygon cannot be drawn.");
      if (window.Track) window.Track.state(C.snapshot(state));
      return;
    }

    polygon.set(g.vertices);
    sides.set(g.vertices);
    for (let i = 0; i < bisectors.length; i++) {
      if (i < g.n) bisectors[i].show(true).set(g.vertices[i], g.bisectors[i]);
      else bisectors[i].show(false);
    }
    for (let i = 0; i < circles.length; i++) {
      const c = g.circles[i];
      if (c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)) {
        circles[i].show(true)
          .node.setAttribute("class", c.red ? "chain-circle emphasized" : "chain-circle");
        circles[i].set(c, Math.abs(c.r));
      } else {
        circles[i].show(false);
      }
    }
    for (let i = 0; i < cornerHandles.length; i++) {
      if (i < g.n) cornerHandles[i].show(true).set(g.vertices[i]);
      else cornerHandles[i].show(false);
    }
    pHandle.set(g.p);
    pLabel.set(g.p);

    say(C.describe(state), state.explored ? "done" : null);
    /* The position, in board units, for the player's record and the tutor. */
    if (window.Track) window.Track.state(C.snapshot(state));
  }

  nMinus.addEventListener("click", () => {
    state = C.setN(state, state.n - 1);
    render();
  });
  nPlus.addEventListener("click", () => {
    state = C.setN(state, state.n + 1);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = C.reset(state);
    render();
  });
  whichMinus.addEventListener("click", () => {
    state = C.setWhich(state, state.whichSpinner - 1);
    render();
  });
  whichPlus.addEventListener("click", () => {
    state = C.setWhich(state, state.whichSpinner + 1);
    render();
  });
  whichInput.addEventListener("input", () => {
    if (whichInput.value === "") return;
    state = C.setWhich(state, Number(whichInput.value));
    render();
  });

  /* Class-styled SVG needs no repaint on a theme flip; keep the shared hook. */
  board.onTheme(render);
  render();
})();
