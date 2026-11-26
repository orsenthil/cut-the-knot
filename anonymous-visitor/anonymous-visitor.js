"use strict";

/*
 * The page for Anonymous Visitor: drawing and input only; the construction
 * lives in anonymous-visitor-core.js. The board shows the isosceles triangle
 * ABD on the base AB, the two equilateral triangles ADF and BDE, the rhombus
 * DFCE and the equilateral triangle ABC. A, B and D are draggable; D is kept
 * on the perpendicular bisector of AB, as in the article. The three checkboxes
 * are the applet's "names", "premise" and "proof" overlays; premise and proof
 * unlock once D has been dragged, just as they did in the Java applet.
 */

(() => {
  const C = AnonymousVisitorCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const premiseBox = document.getElementById("premiseBox");
  const proofBox = document.getElementById("proofBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = C.start();
  let note = "";

  /** Write the line under the board. "done" is how a demo tells the record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });

  // Paint order: soft fills, the proof circles, guides, outlines, labels, handles.
  const fills = board.layer("fills");
  const circlesLayer = board.layer("circles");
  const guides = board.layer("guides");
  const edges = board.layer("edges");
  const labelsLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const origin = { x: 0, y: 0 };
  const triABD = board.polygon([origin, origin, origin], "tri-abd", fills);
  const triADF = board.polygon([origin, origin, origin], "tri-small", fills);
  const triBDE = board.polygon([origin, origin, origin], "tri-small", fills);
  const rhombus = board.polygon([origin, origin, origin, origin], "rhombus", fills);
  const triABC = board.polygon([origin, origin, origin], "tri-abc", fills);

  const proofCircles = Array.from({ length: 5 }, () => board.circle(origin, 1, "proof-circle", circlesLayer));
  const bisector = board.line(origin, origin, "bisector", guides);
  const premiseFE = board.line(origin, origin, "premise-line", guides);
  const premiseDC = board.line(origin, origin, "premise-line", guides);

  const baseAB = board.segment(origin, origin, "base", edges);
  const smallSides = Array.from({ length: 6 }, () => board.segment(origin, origin, "side", edges));
  const rhombEdges = Array.from({ length: 4 }, () => board.segment(origin, origin, "rhomb-edge", edges));
  const abcEdges = Array.from({ length: 3 }, () => board.segment(origin, origin, "abc-edge", edges));
  const ticks = Array.from({ length: 8 }, () => board.segment(origin, origin, "tick", edges));

  const offsets = {
    A: [-18, 20], B: [8, 20], D: [-14, -10],
    F: [-20, -8], E: [8, -8], C: [-8, -12],
  };
  const labels = Object.fromEntries(Object.keys(offsets).map((name) => [name,
    board.label(origin, name, "pt-label", offsets[name][0], offsets[name][1], labelsLayer)]));

  /** A short cross-tick marking equal lengths, for the premise overlay. */
  function tickAt(shape, p, q, size) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const ux = (-dy / len) * size, uy = (dx / len) * size;
    shape.set({ x: mx - ux, y: my - uy }, { x: mx + ux, y: my + uy }).show(true);
  }

  const clamp = (q, name) => C.limit(state, name, q);
  const describe = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)} in the drawing`;
  let handles;
  const onMove = (p, name) => {
    if (!apply({ type: "point", name, x: p.x, y: p.y })) handles[name].set(state[name]);
  };
  handles = {
    A: board.handle("A", state.A, { r: 9, step: 4, shift: 16, layer: handleLayer, clamp, describe, onMove }),
    B: board.handle("B", state.B, { r: 9, step: 4, shift: 16, layer: handleLayer, clamp, describe, onMove }),
    D: board.handle("D", state.D, { r: 9, step: 4, shift: 16, layer: handleLayer, clamp, describe, onMove }),
  };

  function render() {
    const g = C.construct(state);
    triABD.set([g.A, g.B, g.D]);
    triADF.set([g.A, g.D, g.F]);
    triBDE.set([g.B, g.D, g.E]);
    rhombus.set([g.D, g.F, g.C, g.E]);
    triABC.set([g.A, g.B, g.C]);

    [g.A, g.B, g.D, g.E, g.F].forEach((p, i) => proofCircles[i].set(p, g.radius).show(state.proof));

    bisector.set(g.M, add(g.M, g.n));
    premiseFE.set(g.F, g.E).show(state.premise);
    premiseDC.set(g.D, g.C).show(state.premise);

    baseAB.set(g.A, g.B);
    [
      [g.A, g.D], [g.D, g.F], [g.F, g.A],
      [g.B, g.D], [g.D, g.E], [g.E, g.B],
    ].forEach(([p, q], i) => smallSides[i].set(p, q));
    [
      [g.D, g.F], [g.F, g.C], [g.C, g.E], [g.E, g.D],
    ].forEach(([p, q], i) => rhombEdges[i].set(p, q));
    [
      [g.A, g.B], [g.B, g.C], [g.C, g.A],
    ].forEach(([p, q], i) => abcEdges[i].set(p, q));

    if (state.premise) {
      const pairs = [[g.A, g.D], [g.A, g.F], [g.D, g.F], [g.B, g.D], [g.B, g.E], [g.D, g.E], [g.F, g.C], [g.E, g.C]];
      pairs.forEach(([p, q], i) => tickAt(ticks[i], p, q, 4));
    } else {
      ticks.forEach((t) => t.show(false));
    }

    for (const name of Object.keys(labels)) labels[name].set(g[name]).show(state.names);
    handles.A.set(g.A);
    handles.B.set(g.B);
    handles.D.set(g.D);

    namesBox.checked = state.names;
    premiseBox.checked = state.premise;
    proofBox.checked = state.proof;
    premiseBox.disabled = !state.unlocked;
    proofBox.disabled = !state.unlocked;

    say(note || C.status(state), C.result(state));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      A: g.A, B: g.B, D: g.D, C: g.C, F: g.F, E: g.E, M: g.M,
      h: g.h, base: g.s, external: g.external,
      names: state.names, premise: state.premise, proof: state.proof,
    });
  }

  function apply(m, message) {
    const next = C.move(state, m);
    if (!next) return false;
    state = next;
    note = message || "";
    render();
    return true;
  }

  namesBox.addEventListener("change", () => {
    if (!apply({ type: "names", value: namesBox.checked })) render();
  });
  premiseBox.addEventListener("change", () => {
    if (!apply({ type: "premise", value: premiseBox.checked })) render();
  });
  proofBox.addEventListener("change", () => {
    if (!apply({ type: "proof", value: proofBox.checked })) render();
  });
  resetBtn.addEventListener("click", () => apply({ type: "reset" }, "Back to the opening picture."));
  board.onTheme(() => render());

  render();
})();
