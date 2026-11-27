"use strict";

/*
 * Tangent Circles and an Isosceles Triangle — drawing and input only; the
 * geometry lives in circles-and-regular-triangle-core.js. The SVG holds one
 * draggable point B on the fixed diameter AC. Circle S has that diameter,
 * circle G has diameter AB, E sits on S over the midpoint of BC, and circle
 * W is tucked between S, G and the side BE. The four tick boxes reproduce
 * the applet's "names", "premise", "statement" and "colors" checkboxes.
 * Every SVG object is made once and only updated on a redraw, so the B
 * handle keeps keyboard focus while the rest of the picture moves.
 */

(function () {
  const Core = CirclesAndRegularTriangleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const boxes = {
    showNames: document.getElementById("names"),
    showPremise: document.getElementById("premise"),
    showStatement: document.getElementById("statement"),
    showColors: document.getElementById("colors"),
  };
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const fills = board.layer("fills");
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const g0 = Core.compute(state);
  const tri = board.polygon([g0.B, g0.C, g0.E], "tri", fills);
  const big = board.circle(g0.O, g0.big.r, "circle-big", circles);
  const mid = board.circle(g0.P, g0.mid.r, "circle-mid", circles);
  const small = board.circle(g0.Q, g0.small.r, "circle-small", circles);

  const diameter = board.segment(g0.A, g0.C, "diameter", guides);
  const sideBE = board.segment(g0.B, g0.E, "side", guides);
  const sideCE = board.segment(g0.C, g0.E, "side", guides);
  const radiusBig = board.segment(g0.O, g0.Q, "radius", guides);
  const radiusMid = board.segment(g0.P, g0.Q, "radius", guides);

  const qbLine = board.segment(g0.Q, g0.B, "qb", marks);
  const rightA = board.rightAngle(g0.B, g0.A, g0.Q, 10, "right-angle", marks);
  const rightC = board.rightAngle(g0.B, g0.C, g0.Q, 10, "right-angle", marks);
  const angleB = board.angleArc(g0.B, g0.E, g0.C, 15, "angle-mark", marks);
  const angleC = board.angleArc(g0.C, g0.E, g0.B, 15, "angle-mark", marks);
  const dotBig = board.point(g0.tangencyBig, "tangency-dot", 4, marks);
  const dotMid = board.point(g0.tangencyMid, "tangency-dot", 4, marks);
  const dotQ = board.point(g0.Q, "center-dot", 3.5, marks);
  const dotP = board.point(g0.P, "center-dot", 3.5, marks);
  const dotO = board.point(g0.O, "center-dot", 3.5, marks);

  const labelOffset = {
    A: [-17, -9], B: [-6, 19], C: [8, -9], O: [7, 18],
    E: [-6, -12], P: [-22, -9], Q: [9, -8],
  };
  const labelsFor = {};
  for (const key of ["A", "B", "C", "O", "E", "P", "Q"]) {
    labelsFor[key] = board.label(g0[key] || g0.O, key, "point-label",
      labelOffset[key][0], labelOffset[key][1], labels);
  }

  /* B is the only point the applet lets the player move: its y is fixed. */
  const handleB = board.handle("B", state.B, {
    step: 2, shift: 8, r: 8, layer: top,
    label: "Point B on the diameter AC. Drag it, or focus it and use the arrow keys to move it along the diameter.",
    clamp: (p) => ({
      x: Core.clamp(p.x, Core.MARGIN, Core.WIDTH - Core.MARGIN),
      y: Core.CENTER.y,
    }),
    onMove: (p) => {
      state = Core.movePoint(state, "B", p);
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
    const g = Core.compute(state);
    const ok = !g.noDraw && !!g.E && !!g.Q && Number.isFinite(g.small.r);
    handleB.set(state.B);

    tri.show(ok && state.showColors).set([g.B, g.C, g.E || g.O]);
    big.show(ok).set(g.O, g.big.r);
    mid.show(ok).set(g.P, ok ? g.mid.r : 1);
    small.show(ok).set(g.Q, ok ? g.small.r : 1);

    diameter.set(g.A, g.C);
    diameter.show(ok);
    sideBE.show(ok).set(g.B, g.E || g.B);
    sideCE.show(ok).set(g.C, g.E || g.C);

    radiusBig.show(ok && state.showPremise).set(g.O, g.Q || g.O);
    radiusMid.show(ok && state.showPremise).set(g.P, g.Q || g.P);

    qbLine.show(ok && state.showStatement).set(g.Q || g.B, g.B);
    rightA.show(ok && state.showStatement).set(g.B, g.A, g.Q || g.B, 10);
    rightC.show(ok && state.showStatement).set(g.B, g.C, g.Q || g.B, 10);
    angleB.show(ok && state.showPremise).set(g.B, g.E || g.C, g.C, 15);
    angleC.show(ok && state.showPremise).set(g.C, g.E || g.B, g.B, 15);
    dotBig.show(ok && state.showPremise).set(g.tangencyBig || g.O);
    dotMid.show(ok && state.showPremise).set(g.tangencyMid || g.P);
    dotQ.show(ok && state.showStatement).set(g.Q || g.O);
    dotP.show(ok && state.showPremise).set(g.P);
    dotO.show(ok && state.showPremise).set(g.O);

    for (const key of ["A", "B", "C", "O"]) labelsFor[key].set(g[key]);
    if (ok) {
      labelsFor.E.set(g.E);
      labelsFor.P.set(g.P);
      labelsFor.Q.set(g.Q);
    }
    for (const key of ["A", "B", "C"]) labelsFor[key].show(state.showNames);
    labelsFor.E.show(ok && state.showNames);
    labelsFor.O.show(ok && state.showPremise);
    labelsFor.P.show(ok && state.showPremise);
    labelsFor.Q.show(ok && (state.showNames || state.showStatement));

    say(Core.describe(state), state.explored ? "done" : null);

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, O: g.O, D: g.D, E: g.E,
        P: g.P, Q: g.Q, big: g.big, mid: g.mid, small: g.small,
        qbAngle: g.qbAngle, noDraw: g.noDraw,
      });
    }
  }

  for (const key of Core.OPTIONS) {
    const box = boxes[key];
    box.checked = state[key];
    box.addEventListener("change", () => {
      state = Core.setOption(state, key, box.checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    for (const key of Core.OPTIONS) boxes[key].checked = state[key];
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
