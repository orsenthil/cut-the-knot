"use strict";

/*
 * Euclid I.43 — drawing and input only; the geometry is in
 * euclid-i43-core.js. The four corners A, B, C and D slide along their own
 * horizontal rows, and the numbered dots slide along the diagonal AC. For
 * each active dot the core supplies the four coloured pieces the applet
 * filled, plus the faint lines through the dot parallel to the two sides.
 * Every SVG object is made once and only updated on a redraw, so a handle
 * keeps its keyboard focus when the picture moves.
 */

(function () {
  const Core = EuclidI43Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");
  const nInput = document.getElementById("nInput");
  const resetBtn = document.getElementById("resetBtn");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start();

  /* Back to front. */
  const pieces = board.layer("pieces");
  const cuts = board.layer("cuts");
  const edges = board.layer("edges");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  /* The applet fills four quadrilaterals for each divisor point, in this
     order: red at A, green below, green above, blue at C. */
  const quads = [];
  const cutAB = [], cutAD = [], tagLabels = [];
  for (let i = 0; i < Core.MAX; i++) {
    quads.push([
      board.polygon([state.A, state.B, state.A], "piece piece-a", pieces),
      board.polygon([state.A, state.B, state.A], "piece piece-m", pieces),
      board.polygon([state.A, state.B, state.A], "piece piece-m", pieces),
      board.polygon([state.A, state.B, state.A], "piece piece-c", pieces),
    ]);
    cutAB.push(board.segment(state.A, state.C, "cut", cuts));
    cutAD.push(board.segment(state.A, state.D, "cut", cuts));
    tagLabels.push(board.label(state.A, `K${i + 1}`, "point-label", 6, -7, labels));
  }

  const outline = board.polygon([state.A, state.B, state.C, state.D], "outline", edges);
  const diagonal = board.segment(state.A, state.C, "diagonal", edges);

  const clampPoint = (p) => ({
    x: Core.clamp(p.x, Core.EDGE, Core.WIDTH - Core.EDGE),
    y: Core.clamp(p.y, Core.EDGE, Core.HEIGHT - Core.EDGE),
  });

  const cornerOptions = {
    step: 4, shift: 12, r: 9, layer: top, clamp: clampPoint,
    label: "Corner. Drag it, or focus it and press the arrow keys, to change the parallelogram.",
  };
  const corners = {};
  for (const key of ["A", "B", "C", "D"]) {
    corners[key] = board.handle(key, state[key], Object.assign({}, cornerOptions, {
      label: `Corner ${key}. Drag it, or focus it and press the arrow keys, to slide this corner.`,
      onMove: (p, name) => {
        state = Core.moveCorner(state, name, p);
        render();
      },
    }));
  }

  const divisors = [];
  for (let i = 0; i < Core.MAX; i++) {
    divisors.push(board.handle(`K${i + 1}`, state.A, {
      step: 3, shift: 9, r: 7, layer: top, clamp: clampPoint,
      label: `Divisor point ${i + 1}. Drag it, or focus it and press the arrow keys, to move it along the diagonal.`,
      onMove: (p, name) => {
        state = Core.moveDivider(state, Number(name.slice(1)) - 1, p);
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

    for (const key of ["A", "B", "C", "D"]) corners[key].set(state[key]);
    outline.set([g.A, g.B, g.C, g.D]);
    diagonal.set(g.A, g.C);

    for (let i = 0; i < Core.MAX; i++) {
      const on = i < state.N;
      for (let k = 0; k < 4; k++) {
        const pick = g.quads[4 * i + k];
        quads[i][k].show(on).set(on ? pick.points : [state.A, state.A, state.A]);
      }
      divisors[i].show(on);
      if (on) divisors[i].set(g.dividers[i]);
      tagLabels[i].show(on);
      if (on) tagLabels[i].set(g.dividers[i]);

      const red = g.quads[4 * i];
      const greenBelow = g.quads[4 * i + 1];
      const greenAbove = g.quads[4 * i + 2];
      if (on) {
        cutAB[i].show(true).set(red.points[3], greenBelow.points[2]);
        cutAD[i].show(true).set(greenBelow.points[0], greenAbove.points[0]);
      } else {
        cutAB[i].show(false);
        cutAD[i].show(false);
      }
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function applyN(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) {
      nInput.value = state.N;
      return;
    }
    state = Core.setN(state, v);
    nInput.value = String(state.N);
    render();
  }

  minusBtn.addEventListener("click", () => applyN(state.N - 1));
  plusBtn.addEventListener("click", () => applyN(state.N + 1));
  nInput.addEventListener("input", () => applyN(nInput.value));
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    nInput.value = String(state.N);
    render();
  });
  newBtn.addEventListener("click", () => {
    state = Core.randomize(state);
    nInput.value = String(state.N);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
