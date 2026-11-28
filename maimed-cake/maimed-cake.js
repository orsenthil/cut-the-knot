"use strict";

/*
 * Maimed Cake — drawing and input only; all the geometry lives in
 * maimed-cake-core.js. The four handles are A, B, C and Z, as in the applet:
 * A, B and C slide along their sides while the opposite corner follows, and
 * Z slides inside the cake. Everything is created once and only updated on a
 * redraw, so a handle keeps focus while the cut moves under it.
 */

(function () {
  const Core = MaimedCakeCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const paraBox = document.getElementById("para");
  const hintBox = document.getElementById("hint");
  const namesBox = document.getElementById("names");
  const newBtn = document.getElementById("newBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});
  const W = Core.WIDTH, H = Core.HEIGHT, M = 14;

  /* Layers, back to front. */
  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const edges = board.layer("edges");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const dummy = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  const fill1 = board.polygon(dummy, "piece-one", fills);
  const fill2 = board.polygon(dummy, "piece-two", fills);
  const nibbled = board.polygon(dummy, "nibbled", fills);

  const guideU = board.segment(state.A, state.D, "guide", guides);
  const guideR = board.segment(state.C, state.D, "guide", guides);
  const guideK = board.segment(state.A, state.B, "guide", guides);
  const guideL = board.segment(state.Z, state.Z, "guide", guides);
  const approx = board.segment(state.B, state.Z, "approx", guides);

  const frame = board.polygon(dummy, "frame", edges);
  const lshape = board.polygon(dummy, "lshape", edges);
  const cut = board.segment(state.B, state.Z, "cut", edges);
  const cutMarks = [
    board.point(state.P || state.B, "aux-dot", 3, marks),
    board.point(state.B, "aux-dot", 3, marks),
  ];

  const auxDots = {};
  for (const key of ["K", "L", "M", "P", "Q", "R", "U"]) {
    auxDots[key] = board.point(state.B, "aux-dot", 3, marks);
  }
  const pointLabels = {};
  for (const key of ["A", "B", "C", "D", "Z", "K", "L", "M", "P", "Q", "R", "U"]) {
    pointLabels[key] = board.label(state.B, key, "point-label", 5, -7, labels);
  }

  /* Keep the pointer and every dependent corner inside the board. */
  function clampHandle(q, name) {
    const x = Geom.clamp(q.x, M, W - M);
    const y = Geom.clamp(q.y, M, H - M);
    let min = M, max = W - M;
    if (name === "A") { min = state.B.x + state.D.x - (W - M); max = state.B.x + state.D.x - M; }
    else if (name === "B") { min = state.A.x + state.D.x - (W - M); max = state.A.x + state.D.x - M; }
    else if (name === "C") { min = state.D.x + state.B.x - (W - M); max = state.D.x + state.B.x - M; }
    else if (name === "D") { min = M + state.C.x - state.B.x; max = W - M + state.C.x - state.B.x; }
    return { x: Geom.clamp(x, min, max), y };
  }

  const handles = {};
  for (const key of ["A", "B", "C", "Z"]) {
    handles[key] = board.handle(key, state[key], {
      r: 9, step: 4, shift: 12, layer: top,
      clamp: clampHandle,
      label: key === "Z"
        ? "Point Z, the corner of the missing piece. Drag it, or use the arrow keys to move it."
        : `Corner ${key} of the cake. Drag it, or use the arrow keys to slide it along its side.`,
      onMove: (p, name) => {
        const next = Core.movePoint(state, name, p);
        if (next === state) { handles[name].set(state[name]); return; }
        state = next;
        render();
      },
    });
  }

  /** #status is read by the player's record; a demo has no winner. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.compute(state);
    for (const key of ["A", "B", "C", "Z"]) handles[key].set(state[key]);

    const ok = g.valid;
    fill1.show(ok).set(ok ? g.piece1 : dummy);
    fill2.show(ok).set(ok ? g.piece2 : dummy);
    nibbled.set([g.U, g.Z, g.R, g.D]);
    frame.set([g.A, g.B, g.C, g.D]);
    lshape.set(g.cake);
    cut.show(ok).set(g.P, g.Q);

    guideU.set(g.U, g.D);
    guideR.set(g.R, g.D);
    guideK.set(g.K, g.B);
    guideL.set(g.L, g.M);
    approx.set(g.B, g.Z);
    for (const el of [guideU, guideR, guideK, guideL, approx]) el.show(state.showHint && ok);

    cutMarks[0].show(ok).set(g.P);
    cutMarks[1].show(ok).set(g.Q);
    for (const key of Object.keys(auxDots)) {
      auxDots[key].show(ok && state.showHint).set(g[key]);
    }

    for (const key of Object.keys(pointLabels)) {
      const show = state.showNames && ok && ["A", "B", "C", "D", "Z"].includes(key) ||
        state.showNames && state.showHint && ok;
      pointLabels[key].show(show).set(g[key]);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    /* The picture, in board units, for the player's record and the tutor. */
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, Z: g.Z,
        U: g.U, R: g.R, M: g.M, K: g.K, L: g.L, P: g.P, Q: g.Q,
        below: g.below, para: g.para,
        areas: [g.piece1Area, g.piece2Area], cakeArea: g.cakeArea,
        showHint: state.showHint, showNames: state.showNames,
      });
    }
  }

  paraBox.checked = state.para;
  paraBox.addEventListener("change", () => {
    state = Core.setOption(state, "para", paraBox.checked);
    render();
  });
  hintBox.checked = state.showHint;
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "showHint", hintBox.checked);
    render();
  });
  namesBox.checked = state.showNames;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "showNames", namesBox.checked);
    render();
  });
  newBtn.addEventListener("click", () => {
    state = Core.randomize(state);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  /* SVG colours are classes, but the shared hook keeps theme redraws together. */
  board.onTheme(render);
  render();
})();
