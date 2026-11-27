"use strict";

/*
 * Circles And Parallels — drawing and input only; the geometry is in
 * circles-and-parallels-core.js. The SVG holds four draggable points: A, B and
 * C of the triangle and P on the side AB. PN is parallel to BC, PM to AC, and
 * the two circumcircles meet again at Q. The line PQ always passes through
 * the fixed point X, drawn with a dark dot. The optional hint shows the
 * circumcircle of ABC and the two tangents whose intersection is X. Every SVG
 * object is made once and only updated on a redraw, so a handle keeps keyboard
 * focus while the rest of the picture moves.
 */

(function () {
  const Core = CirclesAndParallelsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const edges = board.layer("edges");
  const lines = board.layer("lines");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const tri = board.polygon([state.A, state.B, state.C], "tri", fills);
  const pnLine = board.line(state.P, state.P, "parallel", guides);
  const pmLine = board.line(state.P, state.P, "parallel", guides);
  const circum = board.circle(state.A, 1, "circum", circles);
  const circleA = board.circle(state.A, 1, "circle-a", circles);
  const circleB = board.circle(state.B, 1, "circle-b", circles);
  const abSide = board.segment(state.A, state.B, "side", edges);
  const bcSide = board.segment(state.B, state.C, "side", edges);
  const caSide = board.segment(state.C, state.A, "side", edges);
  const chord = board.line(state.P, state.P, "chord", lines);
  const taLine = board.line(state.A, state.A, "tangent-line", lines);
  const tbLine = board.line(state.B, state.B, "tangent-line", lines);
  const qDot = board.point(state.P, "q-dot", 4.5, marks);
  const xDot = board.point(state.P, "x-dot", 5.5, marks);

  const labelOffset = { A: [-16, -9], B: [8, -8], C: [7, 16], P: [-6, 18], Q: [-16, -9], X: [8, -9] };
  const labelsFor = {};
  for (const key of ["A", "B", "C", "P", "Q", "X"]) {
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

    tri.set([g.A, g.B, g.C]);
    abSide.set(g.A, g.B);
    bcSide.set(g.B, g.C);
    caSide.set(g.C, g.A);

    const nOK = Core.finite(g.N) && !g.noDraw;
    const mOK = Core.finite(g.M) && !g.noDraw;
    pnLine.show(nOK).set(g.P, nOK ? g.N : g.P);
    pmLine.show(mOK).set(g.P, mOK ? g.M : g.P);

    const ok1 = Number.isFinite(g.circleAPN.r) && !g.noDraw;
    const ok2 = Number.isFinite(g.circleBPM.r) && !g.noDraw;
    circleA.show(ok1).set(g.circleAPN, ok1 ? g.circleAPN.r : 1);
    circleB.show(ok2).set(g.circleBPM, ok2 ? g.circleBPM.r : 1);
    const okC = Number.isFinite(g.circum.r);
    circum.show(state.showHint && okC).set(g.circum, okC ? g.circum.r : 1);

    const lineOK = !!g.line && Core.finite(g.line.q) && !g.degenerate;
    chord.show(lineOK).set(g.P, lineOK ? g.line.q : g.P);
    const hintOK = state.showHint && !g.degenerate;
    taLine.show(hintOK && Core.finite(g.ta)).set(g.A, hintOK ? g.ta : g.A);
    tbLine.show(hintOK && Core.finite(g.tb)).set(g.B, hintOK ? g.tb : g.B);

    const qOK = !!g.Q && Core.finite(g.Q) && !g.degenerate;
    const xOK = Core.finite(g.X);
    qDot.show(qOK).set(qOK ? g.Q : g.P);
    xDot.show(xOK).set(xOK ? g.X : g.P);

    for (const key of ["A", "B", "C", "P"]) labelsFor[key].set(state[key]);
    if (qOK) labelsFor.Q.set(g.Q);
    if (xOK) labelsFor.X.set(g.X);
    for (const key of ["A", "B", "C", "P"]) labelsFor[key].show(state.showNames);
    labelsFor.Q.show(state.showNames && qOK);
    labelsFor.X.show(state.showNames && xOK);

    say(Core.describe(state), state.explored ? "done" : null);

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, P: g.P, N: g.N, M: g.M, Q: g.Q, X: g.X,
        coefP: state.coefP, circleAPN: g.circleAPN, circleBPM: g.circleBPM,
        onLine: g.onLine, tangent: g.tangent, noDraw: g.noDraw,
      });
    }
  }

  namesBox.checked = state.showNames;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "showNames", namesBox.checked);
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
