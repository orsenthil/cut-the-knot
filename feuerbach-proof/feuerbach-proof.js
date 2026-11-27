"use strict";

/*
 * The page for Feuerbach's theorem proof: drawing and input only. The
 * construction is in feuerbach-proof-core.js. Three focusable handles A, B, C
 * move the triangle; every line, circle, foot and label is created once and
 * updated in place, so a drag or an arrow-key press never loses focus. The
 * four checkboxes are the applet panel's "names", "circle of inversion",
 * "9-point circle" and "angles". This is a drawing with nothing to win.
 */

(function () {
  const Core = FeuerbachProofCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const namesChk = document.getElementById("namesChk");
  const inversionChk = document.getElementById("inversionChk");
  const nineChk = document.getElementById("nineChk");
  const anglesChk = document.getElementById("anglesChk");
  const board = Geom.board(document.getElementById("board"));

  const lines = board.layer("lines");
  const circles = board.layer("circles");
  const dots = board.layer("dots");
  const angles = board.layer("angles");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({
    showNames: namesChk.checked,
    showAngles: anglesChk.checked,
    showCircle: inversionChk.checked,
    showNPCircle: nineChk.checked,
  });
  const first = Core.geometry(state);

  const sides = [
    board.line(first.A, first.B, "side", lines),
    board.line(first.B, first.C, "side", lines),
    board.line(first.C, first.A, "side", lines),
  ];
  const centerLine = board.line(first.Cb, first.Cc, "centre-line", lines);
  const secondTangent = board.line(first.Bd, first.Cd, "tangent", lines);
  const tangentAtL = board.segment(first.Y, first.X, "tangent-at-l", lines);

  const excircleB = board.circle(first.Cb, first.Cb.r, "excircle excircle-b", circles);
  const excircleC = board.circle(first.Cc, first.Cc.r, "excircle excircle-c", circles);
  const inversion = board.circle(first.Invert, first.Invert.r, "inversion-circle", circles);
  const ninePoint = board.circle(first.CN, first.CN.r, "nine-point-circle", circles);

  const auxNames = ["Bp", "Cp", "P", "S", "K", "L", "M", "Z"];
  const auxPoints = auxNames.map((name) => board.point(first[name], "aux-dot", 3, dots));
  const centerDots = [board.point(first.Cb, "centre-dot", 3.5, dots),
    board.point(first.Cc, "centre-dot", 3.5, dots)];

  const arcL = board.angleArc(first.L, first.X, first.K, 16, "angle-mark", angles);
  const arcM = board.angleArc(first.M, first.K, first.L, 20, "angle-mark", angles);
  const arcB = board.angleArc(first.B, first.A, first.C, 24, "angle-mark", angles);
  const arcA = board.angleArc(first.A, first.Z, first.Bd, 16, "angle-mark second", angles);

  const labelSpecs = [
    ["A", "A", -11, -8], ["B", "B", -11, -8], ["C", "C", 5, -8],
    ["Bp", "B′", 3, 14], ["Cp", "C′", -19, 14], ["P", "P", 3, 14],
    ["S", "S", 5, -6], ["K", "K", -13, -7], ["L", "L", -13, 14],
    ["M", "M", 5, -7], ["Cb", "b", 5, -6], ["Cc", "c", 5, -6],
    ["X", "X", 4, -6], ["Y", "X′", -19, -6],
  ];
  const pointLabels = labelSpecs.map((spec) =>
    board.label(first[spec[0]] || first.A, spec[1], "point-label", spec[2], spec[3], labels));

  /** Keep a dragged or arrow-keyed corner on the board. */
  function clampPoint(q, name) {
    return Core.setPoint(state, name, q)[name];
  }

  function onMove(p, name) {
    state = Core.setPoint(state, name, p);
    render();
  }

  const aHandle = board.handle("A", first.A, {
    r: 9, step: 4, shift: 20, layer: handlesLayer, clamp: clampPoint, onMove: onMove,
    label: "Point A. Drag it, or focus it and press the arrow keys.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
  });
  const bHandle = board.handle("B", first.B, {
    r: 9, step: 4, shift: 20, layer: handlesLayer, clamp: clampPoint, onMove: onMove,
    label: "Point B. Drag it, or focus it and press the arrow keys.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
  });
  const cHandle = board.handle("C", first.C, {
    r: 9, step: 4, shift: 20, layer: handlesLayer, clamp: clampPoint, onMove: onMove,
    label: "Point C. Drag it, or focus it and press the arrow keys.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
  });

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and tells the
   * player's record a play ended; a proof diagram has no result, so no kind
   * is ever passed and the measurements are reported without one.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const shown = g.valid;
    const corners = [g.A, g.B, g.C];

    sides.forEach((shape, i) => {
      shape.show(shown);
      if (shown) shape.set(corners[i], corners[(i + 1) % 3]);
    });
    centerLine.show(shown);
    secondTangent.show(shown);
    tangentAtL.show(shown && state.showAngles);
    if (shown) {
      centerLine.set(g.Cb, g.Cc);
      secondTangent.set(g.Bd, g.Cd);
      tangentAtL.set(g.Y, g.X);
    }

    excircleB.show(shown);
    excircleC.show(shown);
    inversion.show(shown && state.showCircle);
    ninePoint.show(shown && state.showNPCircle);
    if (shown) {
      excircleB.set(g.Cb, g.Cb.r);
      excircleC.set(g.Cc, g.Cc.r);
      inversion.set(g.Invert, g.Invert.r);
      ninePoint.set(g.CN, g.CN.r);
    }

    auxPoints.forEach((shape, i) => {
      shape.show(shown);
      if (shown) shape.set(g[auxNames[i]]);
    });
    centerDots[0].show(shown);
    centerDots[1].show(shown);
    if (shown) {
      centerDots[0].set(g.Cb);
      centerDots[1].set(g.Cc);
    }

    const arcs = [[arcL, g.L, g.X, g.K, 16], [arcM, g.M, g.K, g.L, 20],
      [arcB, g.B, g.A, g.C, 24], [arcA, g.A, g.Z, g.Bd, 16]];
    arcs.forEach(([shape, vertex, p, q, radius]) => {
      shape.show(shown && state.showAngles);
      if (shown) shape.set(vertex, p, q, radius);
    });

    labelSpecs.forEach((spec, i) => {
      // The applet prints X and X′ only with the angle marks; all other
      // names follow the "names" checkbox.
      const needsAngles = spec[0] === "X" || spec[0] === "Y";
      pointLabels[i].show(shown && state.showNames && (!needsAngles || state.showAngles));
      if (shown) pointLabels[i].set(g[spec[0]] || g.A);
    });

    aHandle.set(g.A);
    bHandle.set(g.B);
    cHandle.set(g.C);

    say(Core.describe(state));
    // The position is plain board-unit data; save it for the record and tutor.
    if (window.Track) window.Track.state(state);
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({
      showNames: namesChk.checked,
      showAngles: anglesChk.checked,
      showCircle: inversionChk.checked,
      showNPCircle: nineChk.checked,
    });
    render();
  });

  function toggle(id, flag) {
    document.getElementById(id).addEventListener("change", (e) => {
      state = Core.setFlag(state, flag, e.target.checked);
      render();
    });
  }
  toggle("namesChk", "showNames");
  toggle("inversionChk", "showCircle");
  toggle("nineChk", "showNPCircle");
  toggle("anglesChk", "showAngles");

  // SVG classes already follow the site's theme tokens; redraw so any
  // JavaScript-measured marks are refreshed when the theme flips.
  board.onTheme(() => render());

  render();
})();
