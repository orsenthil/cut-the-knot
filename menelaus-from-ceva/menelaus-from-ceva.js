"use strict";

/*
 * The page for Menelaus From Ceva: drawing and input only. The construction,
 * the six update paths and the Menelaus product live in menelaus-from-ceva-core.js.
 *
 * The SVG holds a triangle with three side-line dots. Six grey cevians run
 * from the corners to those dots and the transversal F-D-E is drawn in the
 * accent colour. Drag a corner or a side dot (or focus it and use the arrow
 * keys) and the dependent dot is rebuilt exactly as the applet rebuilds it,
 * so the three side dots stay on one line. The checkbox draws the extra Ceva
 * lines and their crossings X, Y and Z.
 */

(function () {
  const Core = MenelausFromCevaCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const addOnsBox = document.getElementById("addOns");
  const resetBtn = document.getElementById("newBtn");

  let state = Core.start();

  const guideLayer = board.layer("guides");
  const sidesLayer = board.layer("sides");
  const crossLayer = board.layer("crossings");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const p0 = Core.points(state);
  const sides = [
    board.segment(p0.A, p0.B, "tri-side", sidesLayer),
    board.segment(p0.B, p0.C, "tri-side", sidesLayer),
    board.segment(p0.C, p0.A, "tri-side", sidesLayer),
  ];
  /* GeoSDoub.DrawLine clips each cevian half to the applet's canvas. */
  const halfCevians = [
    board.line(p0.A, p0.E, "guide", guideLayer),
    board.line(p0.C, p0.E, "guide", guideLayer),
    board.line(p0.B, p0.F, "guide", guideLayer),
    board.line(p0.A, p0.F, "guide", guideLayer),
    board.line(p0.B, p0.D, "guide", guideLayer),
    board.line(p0.C, p0.D, "guide", guideLayer),
  ];
  const transversal = [
    board.line(p0.F, p0.E, "transversal", crossLayer),
    board.line(p0.E, p0.D, "transversal", crossLayer),
    board.line(p0.D, p0.F, "transversal", crossLayer),
  ];
  const addOns = [
    board.line(p0.D, p0.A, "guide", guideLayer),
    board.line(p0.C, p0.F, "guide", guideLayer),
    board.line(p0.B, p0.E, "guide", guideLayer),
    board.line(p0.C, p0.C, "proof-line", crossLayer),
    board.line(p0.D, p0.D, "proof-line", crossLayer),
    board.line(p0.C, p0.C, "proof-line", crossLayer),
    board.line(p0.B, p0.B, "proof-line", crossLayer),
    board.line(p0.C, p0.C, "proof-line", crossLayer),
    board.line(p0.D, p0.D, "proof-line", crossLayer),
  ];
  const addOnSets = [
    [addOns[0]], [addOns[1]], [addOns[2]],
    [addOns[3], addOns[4]], [addOns[5], addOns[6]], [addOns[7], addOns[8]],
  ];
  for (const shape of addOns) shape.show(false);

  const xLabel = board.label(p0.A, "X", "pt-label proof-label", -12, -10, labelsLayer);
  const yLabel = board.label(p0.A, "Y", "pt-label proof-label", 9, -10, labelsLayer);
  const zLabel = board.label(p0.A, "Z", "pt-label proof-label", 9, 18, labelsLayer);
  const crossingLabels = [xLabel, yLabel, zLabel];
  for (const label of crossingLabels) label.show(false);

  const offsets = {
    A: [-14, -12], B: [10, -12], C: [-16, 20],
    D: [-16, 21], E: [9, -12], F: [9, -11],
  };
  const labels = {};
  for (const name of Core.HANDLES) {
    labels[name] = board.label(p0[name], name, "pt-label " +
      (Core.SIDE[name] ? "side-label" : "vertex-label"),
      offsets[name][0], offsets[name][1], labelsLayer);
  }

  /** The shared status line. No win or loss: this is an illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const usable = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const setShape = (shape, a, b) => {
    shape.show(usable(a) && usable(b));
    if (usable(a) && usable(b)) shape.set(a, b);
  };

  function render() {
    const p = Core.points(state);
    const ev = Core.evaluate(state);

    setShape(sides[0], p.A, p.B);
    setShape(sides[1], p.B, p.C);
    setShape(sides[2], p.C, p.A);
    const halves = [[p.A, p.E], [p.C, p.E], [p.B, p.F],
      [p.A, p.F], [p.B, p.D], [p.C, p.D]];
    halves.forEach(([a, b], i) => setShape(halfCevians[i], a, b));
    const crossPairs = [[p.F, p.E], [p.E, p.D], [p.D, p.F]];
    crossPairs.forEach(([a, b], i) => setShape(transversal[i], a, b));

    for (const name of Core.HANDLES) {
      const h = handles[name];
      h.show(usable(p[name]));
      if (usable(p[name])) h.set(p[name]);
      labels[name].show(usable(p[name]));
      if (usable(p[name])) labels[name].set(p[name]);
    }

    const show = Boolean(state.showAddOns);
    if (show) {
      const x = ev.crossings.X, y = ev.crossings.Y, z = ev.crossings.Z;
      const proof = [
        [[p.D, p.A]], [[p.C, p.F]], [[p.B, p.E]],
        [[p.C, y], [p.D, y]], [[p.C, z], [p.B, z]], [[x, z], [x, p.D]],
      ];
      proof.forEach((segments, i) => {
        segments.forEach(([a, b], j) => setShape(addOnSets[i][j], a, b));
      });
      [[x, xLabel], [y, yLabel], [z, zLabel]].forEach(([at, label]) => {
        label.show(usable(at));
        if (usable(at)) label.set(at);
      });
    } else {
      for (const shape of addOns) shape.show(false);
      for (const label of crossingLabels) label.show(false);
    }
    addOnsBox.checked = show;

    if (!ev.collinear || !Number.isFinite(ev.ratios.product)) {
      say("The construction has run off the drawing. Press Reset to start again.");
    } else {
      say("F, D and E lie on one line: AF/BF × BD/CD × CE/AE = " +
        Core.format(ev.ratios.product, 3) + ".");
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /** A dot on a side line is snapped there, as CTKMoveableDoub.RestrictToLine does. */
  function onSide(q, name) {
    const side = Core.SIDE[name];
    if (!side) return q;
    return Core.nearestPoint(q, state[side[0]], state[side[1]]);
  }

  const handles = {};
  for (const name of Core.HANDLES) {
    handles[name] = board.handle(name, p0[name], {
      r: Core.SIDE[name] ? 7 : 8, step: 4, shift: 12, layer: handlesLayer,
      cls: "geom-handle " + (Core.SIDE[name] ? "side-handle" : "corner-handle"),
      clamp: onSide,
      label: "Point " + name + (Core.SIDE[name] ? " on a side line" : " of the triangle") +
        ". Drag it, or focus it and use the arrow keys.",
      describe: (q) => "at " + Math.round(q.x) + ", " + Math.round(q.y),
      onMove: (q, which) => {
        const before = state[which];
        state = Core.drag(state, which, { x: q.x - before.x, y: q.y - before.y });
        render();
      },
    });
  }

  function reset() {
    state = Core.start();
    render();
    handles.A.node.focus();
  }
  resetBtn.addEventListener("click", reset);
  addOnsBox.addEventListener("change", () => {
    state = { ...state, showAddOns: addOnsBox.checked };
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
    if (e.key.toLowerCase() === "r") { e.preventDefault(); reset(); }
  });

  board.onTheme(render);
  render();
})();
