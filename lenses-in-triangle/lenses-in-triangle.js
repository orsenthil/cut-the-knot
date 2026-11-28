"use strict";

/*
 * The page for Lenses In Triangle: drawing and input only. The geometry lives
 * in lenses-in-triangle-core.js. The stage holds an equilateral triangle with
 * its apex up, a big circle tangent to the base, and the lens made by its two
 * arcs. The dot at the circle's lowest point is the handle: drag it along
 * the base, or step it with the scrollbar and the arrow buttons.
 */

(function () {
  const Core = LensesInTriangleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const distInput = document.getElementById("distInput");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");
  const hintBox = document.getElementById("hintBox");
  const namesBox = document.getElementById("namesBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});
  let side = 240;

  /** The line under the picture. This illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers are created in paint order: guides, fills, lines, text, handles. */
  const guides = board.layer("guides");
  const fills = board.layer("fills");
  const lines = board.layer("lines");
  const text = board.layer("text");
  const tops = board.layer("handles");

  const lowerArc = board.el("path", null, "lens-lower", fills);
  const upperArc = board.el("path", null, "lens-upper", fills);
  const triangle = board.el("path", null, "triangle", lines);
  const bigCircle = board.el("circle", null, "rolling-circle", lines);
  const chord = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "chord", lines);
  const hint1 = board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "hint-line", guides);
  const hint2 = board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "hint-line", guides);
  const hint3 = board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "hint-line", guides);
  const baseLine = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "base-line", guides);
  const centreDot = board.point({ x: 0, y: 0 }, "centre-dot", 4, tops);
  const labelA = board.label({ x: 0, y: 0 }, "A", "pt-label", -12, -12, text);
  const labelB = board.label({ x: 0, y: 0 }, "B", "pt-label", -14, 18, text);
  const labelC = board.label({ x: 0, y: 0 }, "C", "pt-label", 8, 18, text);
  const labelD = board.label({ x: 0, y: 0 }, "D", "pt-label", -14, -8, text);
  const labelE = board.label({ x: 0, y: 0 }, "E", "pt-label", 8, -8, text);
  const labelBp = board.label({ x: 0, y: 0 }, "B'", "pt-label", -18, 8, text);
  const labelCp = board.label({ x: 0, y: 0 }, "C'", "pt-label", 8, 8, text);
  const arcLabel = board.label({ x: 0, y: 0 }, "60\u00b0", "arc-label", 0, -8, text);

  /* The board uses a viewBox of 360 by 300. A sits near the top. */
  const ORIGIN = { x: 180, y: 38 };
  let geom = Core.geometry(state, side, ORIGIN);

  function arcPath(g) {
    const lower = Core.arcPoints(g.O, g.r, Core.shortArc(g.O, g.D, g.E), 48);
    const upper = Core.arcPoints(g.O2, g.r, Core.shortArc(g.O2, g.D, g.E), 48);
    // Close the lens: lower arc D -> E, then upper arc E -> D.
    const parts = [lower, upper.slice().reverse()];
    let d = "";
    let first = true;
    for (const pts of parts) for (const p of pts) {
      d += (first ? "M " : " L ") + p.x.toFixed(2) + " " + p.y.toFixed(2);
      first = false;
    }
    return d + " Z";
  }

  /** Keep the centre handle on the base, inside the scrollbar's range. */
  const clampCentre = (p) => {
    const h = (Math.sqrt(3) * side) / 2;
    const value = ((p.x - ORIGIN.x) / side) * 100;
    return {
      x: ORIGIN.x + (Core.setDist(state, value).dist * side) / 100,
      y: ORIGIN.y + h,
    };
  };
  const centreHandle = board.handle("O", { x: geom.O.x, y: geom.O.y + (Math.sqrt(3) * side) / 2 }, {
    r: 11, step: 4, cls: "geom-handle", layer: tops,
    label: "Circle centre. Drag it along the triangle's base, or focus it and use the left and right arrow keys to roll the circle.",
    describe: (p) => `${Math.round(((p.x - ORIGIN.x) / side) * 100)} percent along the base`,
    clamp: clampCentre,
    onMove: (p) => {
      state = Core.setDist(state, ((p.x - ORIGIN.x) / side) * 100);
      render();
    },
  });

  function setSeg(node, p, q) {
    const el = node.node || node;
    el.setAttribute("x1", p.x.toFixed(2));
    el.setAttribute("y1", p.y.toFixed(2));
    el.setAttribute("x2", q.x.toFixed(2));
    el.setAttribute("y2", q.y.toFixed(2));
  }
  function setLabel(node, p, value, dx, dy) {
    node.set(p, value, dx, dy);
  }
  function setDot(node, p, radius) {
    node.set(p, radius);
  }
  function setPath(node, d) {
    node.setAttribute("d", d);
  }

  function render() {
    geom = Core.geometry(state, side, ORIGIN);
    const g = geom;

    setPath(triangle, `M ${g.A.x} ${g.A.y} L ${g.B.x} ${g.B.y} L ${g.C.x} ${g.C.y} Z`);
    bigCircle.setAttribute("cx", g.O.x.toFixed(2));
    bigCircle.setAttribute("cy", (g.O.y + g.h).toFixed(2));
    bigCircle.setAttribute("r", g.r.toFixed(2));
    setSeg(chord, g.D, g.E);
    setSeg(baseLine, { x: g.B.x, y: g.B.y }, { x: g.C.x, y: g.C.y });
    setPath(lowerArc, arcPath(g));
    // A second path gives the reflected arc its own lighter fill.
    const upper = Core.arcPoints(g.O2, g.r, Core.shortArc(g.O2, g.D, g.E), 48);
    let ud = `M ${g.D.x.toFixed(2)} ${g.D.y.toFixed(2)}`;
    for (const p of upper) ud += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    setPath(upperArc, ud);

    hint1.set(g.A, g.Bp);
    hint2.set(g.A, g.Cp);
    hint3.set(g.Bp, g.Cp);
    hint1.show(state.hint);
    hint2.show(state.hint);
    hint3.show(state.hint);

    const tip = { x: g.O.x, y: g.O.y + g.h };
    setDot(centreDot, tip, 4);
    centreHandle.set(tip);
    setLabel(labelA, g.A, "A");
    setLabel(labelB, g.B, "B");
    setLabel(labelC, g.C, "C");
    setLabel(labelD, g.D, "D");
    setLabel(labelE, g.E, "E");
    setLabel(labelBp, g.Bp, "B'");
    setLabel(labelCp, g.Cp, "C'");
    labelBp.show(state.hint);
    labelCp.show(state.hint);
    const labelNodes = [labelA, labelB, labelC, labelD, labelE];
    for (const node of labelNodes) node.show(state.names);
    // The angle at the centre is the one the page asks about.
    setLabel(arcLabel, { x: (g.O.x + (g.D.x + g.E.x) / 2) / 2, y: (g.O.y + (g.D.y + g.E.y) / 2) / 2 + g.h },
      `${g.sweep < 0 ? -g.sweep : g.sweep}\u00b0`, 0, -8);
    arcLabel.show(true);

    distInput.value = String(state.dist);
    hintBox.checked = state.hint;
    namesBox.checked = state.names;
    say(Core.describe(g));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  distInput.addEventListener("change", () => {
    state = Core.setDist(state, distInput.value);
    render();
  });
  minusBtn.addEventListener("click", () => { state = Core.stepDist(state, -1); render(); });
  plusBtn.addEventListener("click", () => { state = Core.stepDist(state, 1); render(); });
  hintBox.addEventListener("change", () => { state = Core.toggleHint(state); render(); });
  namesBox.addEventListener("change", () => { state = Core.toggleNames(state); render(); });
  resetBtn.addEventListener("click", () => { state = Core.start({}); render(); });

  board.onTheme(render);
  render();
})();
