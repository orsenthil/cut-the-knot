"use strict";

/*
 * Two Circles in a Parallelogram — drawing and input only; the geometry is in
 * circles-and-parallelogram-core.js. The SVG holds seven draggable points: the
 * corners A, B, C and D, M on AB, N on CD, and K on MN. The two circumcircles
 * of AMK and CNK meet again at P on the diagonal AC. The optional hint draws
 * KP and the two perpendicular bisectors on which the circle centres slide.
 * Every SVG object is made once and only updated on a redraw, so a handle
 * keeps keyboard focus while the rest of the picture moves.
 */

(function () {
  const Core = CirclesAndParallelogramCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const centerBox = document.getElementById("centerLine");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const fills = board.layer("fills");
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const edges = board.layer("edges");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const para = board.polygon([state.A, state.B, state.C, state.D], "para", fills);
  const circleA = board.circle(state.A, 1, "circle-a", circles);
  const circleC = board.circle(state.C, 1, "circle-c", circles);

  const acLine = board.line(state.A, state.C, "ac", guides);
  const mnLine = board.line(state.M, state.N, "mn", guides);
  const amLine = board.segment(state.A, state.M, "side-guide", guides);
  const cnLine = board.segment(state.C, state.N, "side-guide", guides);
  const kmLine = board.segment(state.K, state.M, "side-guide", guides);
  const knLine = board.segment(state.K, state.N, "side-guide", guides);
  const bisA = board.line(state.A, state.M, "bisector", guides);
  const bisC = board.line(state.C, state.N, "bisector", guides);

  const sides = [
    board.segment(state.A, state.B, "side", edges),
    board.segment(state.B, state.C, "side", edges),
    board.segment(state.C, state.D, "side", edges),
    board.segment(state.D, state.A, "side", edges),
  ];

  const kpLine = board.segment(state.K, state.K, "kp", marks);
  const centerLine = board.segment(state.A, state.C, "centers", marks);
  const pDot = board.point(state.K, "p-dot", 4, marks);
  const oDot = board.point(state.A, "center-dot", 3.5, marks);
  const qDot = board.point(state.C, "center-dot", 3.5, marks);

  const labelOffset = {
    A: [-16, -9], B: [7, 17], C: [8, -9], D: [-16, 17],
    M: [-6, 18], N: [-6, -10], K: [8, -8], P: [-16, -8],
    O: [7, -7], Q: [7, -7],
  };
  const labelsFor = {};
  for (const key of ["A", "B", "C", "D", "M", "N", "K", "P", "O", "Q"]) {
    labelsFor[key] = board.label(state.A, key, "point-label",
      labelOffset[key][0], labelOffset[key][1], labels);
  }

  const handleOptions = {
    step: 5, shift: 15, r: 8, layer: top,
    clamp: (p) => Core.clampToBoard(p),
  };
  const handles = {};
  for (const key of Core.POINTS) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      label: `Point ${key}. Drag it, or focus it and use the arrow keys to move the diagram.`,
      onMove: (p, name) => {
        state = Core.movePoint(state, name, p);
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
    for (const key of Core.POINTS) handles[key].set(state[key]);

    para.set([g.A, g.B, g.C, g.D]);
    const ok1 = Number.isFinite(g.circleAMK.r) && g.circleAMK.r > 0;
    const ok2 = Number.isFinite(g.circleCNK.r) && g.circleCNK.r > 0;
    circleA.show(ok1).set(g.circleAMK, ok1 ? g.circleAMK.r : 1);
    circleC.show(ok2).set(g.circleCNK, ok2 ? g.circleCNK.r : 1);

    acLine.set(g.A, g.C);
    mnLine.set(g.M, g.N);
    amLine.set(g.A, g.M);
    cnLine.set(g.C, g.N);
    kmLine.set(g.K, g.M);
    knLine.set(g.K, g.N);
    bisA.set(g.perpA.p, g.perpA.q);
    bisC.set(g.perpC.p, g.perpC.q);
    bisA.show(state.showHint && ok1);
    bisC.show(state.showHint && ok2);
    for (let i = 0; i < sides.length; i++) sides[i].set([g.A, g.B, g.C, g.D][i], [g.B, g.C, g.D, g.A][i]);

    const hasP = !!g.P && !g.degenerate && Number.isFinite(g.P.x);
    kpLine.show(state.showHint && hasP).set(g.K, hasP ? g.P : g.K);
    centerLine.show(state.showCenterLine && ok1 && ok2).set(g.circleAMK, g.circleCNK);
    pDot.show(hasP).set(hasP ? g.P : g.K);
    oDot.show(state.showCenterLine && ok1).set(g.circleAMK);
    qDot.show(state.showCenterLine && ok2).set(g.circleCNK);

    for (const key of ["A", "B", "C", "D", "M", "N", "K"]) labelsFor[key].set(state[key]);
    if (hasP) labelsFor.P.set(g.P);
    labelsFor.P.show(state.showNames && hasP);
    if (ok1) labelsFor.O.set(g.circleAMK);
    if (ok2) labelsFor.Q.set(g.circleCNK);
    labelsFor.O.show(state.showNames && state.showCenterLine && ok1);
    labelsFor.Q.show(state.showNames && state.showCenterLine && ok2);
    for (const key of ["A", "B", "C", "D", "M", "N", "K"]) {
      labelsFor[key].show(state.showNames);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, M: g.M, N: g.N, K: g.K,
        P: g.P, circleAMK: g.circleAMK, circleCNK: g.circleCNK,
        kpAngle: g.kpAngle, centerAngle: g.centerAngle, centerLength: g.centerLength,
        tangent: g.tangent, degenerate: g.degenerate,
      });
    }
  }

  namesBox.checked = state.showNames;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "showNames", namesBox.checked);
    render();
  });
  centerBox.checked = state.showCenterLine;
  centerBox.addEventListener("change", () => {
    state = Core.setOption(state, "showCenterLine", centerBox.checked);
    render();
  });
  hintBox.checked = state.showHint;
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "showHint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
