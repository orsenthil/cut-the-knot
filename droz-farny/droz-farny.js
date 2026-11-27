"use strict";

/*
 * The page for the Droz-Farny line theorem: drawing and input only; all the
 * geometry is in droz-farny-core.js. The 400 by 300 SVG board holds a triangle
 * whose corners A, B, C can be dragged, plus a point P that chooses a line
 * through the orthocenter H; a second line through H is perpendicular to it.
 * They cut the three sidelines in six points whose midpoints line up. The
 * fourteen checkboxes are the applet's own panel; the Reset button restores
 * its opening figure. Handles keep focus across a redraw, so arrow keys work.
 */

(function () {
  const Core = DrozFarnyCore;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const shapes = board.layer("shapes");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start();

  /**
   * Shows a line under the picture. `kind` is "win", "lose" or "done"; those
   * classes are how the player's record learns that a play has ended. This is
   * an illustration with no win or loss, so no kind is ever passed here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fallback = { x: -999, y: -999 };
  const place = (p) => (Core.finite(p) ? p : fallback);
  const showSegment = (shape, p, q, on) => {
    const visible = !!on && Core.finite(p) && Core.finite(q);
    shape.show(visible);
    if (visible) shape.set(p, q);
  };
  const showLine = (shape, p, q, on) => {
    const visible = !!on && Core.finite(p) && Core.finite(q);
    shape.show(visible);
    if (visible) shape.set(p, q);
  };
  const showPoint = (shape, p, on) => {
    const visible = !!on && Core.finite(p);
    shape.show(visible);
    if (visible) shape.set(p);
  };
  const showCircle = (shape, circle, on) => {
    const visible = !!on && circle && Core.finite(circle.centre) && Number.isFinite(circle.r);
    shape.show(visible);
    if (visible) shape.set(circle.centre, circle.r);
  };

  /* Every object is created once and only its attributes change, so a focused
     handle keeps its focus across a redraw. */
  const edgeAB = board.segment(state.A, state.B, "tri-edge", shapes);
  const edgeBC = board.segment(state.B, state.C, "tri-edge", shapes);
  const edgeCA = board.segment(state.C, state.A, "tri-edge", shapes);
  const firstLine = board.line(state.P, state.H || state.P, "given-line", shapes);
  const secondLine = board.line(state.P, state.P, "second-line", shapes);

  const altitudeA = board.line(state.A, state.A, "altitude", guides);
  const altitudeB = board.line(state.B, state.B, "altitude", guides);
  const altitudeC = board.line(state.C, state.C, "altitude", guides);
  const reflectA = board.segment(state.A, state.A, "reflect-line", guides);
  const reflectB = board.segment(state.B, state.B, "reflect-line", guides);
  const reflectC = board.segment(state.C, state.C, "reflect-line", guides);

  const premise = [
    board.segment(state.A, state.A, "premise", guides),
    board.segment(state.A, state.A, "premise", guides),
    board.segment(state.A, state.A, "premise", guides),
    board.segment(state.A, state.A, "premise", guides),
    board.segment(state.A, state.A, "premise", guides),
    board.segment(state.A, state.A, "premise", guides),
  ];
  const midlineA = board.segment(state.A, state.A, "midline", shapes);
  const midlineB = board.segment(state.A, state.A, "midline", shapes);

  const circumcircle = board.circle(state.A, 1, "proof-circle", circles);
  const circleX = board.circle(state.A, 1, "proof-circle circle-x", circles);
  const circleY = board.circle(state.A, 1, "proof-circle circle-y", circles);
  const circleZ = board.circle(state.A, 1, "proof-circle circle-z", circles);

  const dotH = board.point(state.A, "ortho-dot", 4, dots);
  const dotKa = board.point(state.A, "reflect-dot", 3.5, dots);
  const dotKb = board.point(state.A, "reflect-dot", 3.5, dots);
  const dotKc = board.point(state.A, "reflect-dot", 3.5, dots);
  const dotM = board.point(state.A, "aux-dot", 4, dots);
  const dotQ = board.point(state.A, "aux-dot", 4, dots);
  const cuts = {};
  const midDots = {};
  for (const cut of ["X", "Xp", "Y", "Yp", "Z", "Zp"]) {
    cuts[cut] = board.point(state.A, "cut-dot", 3, dots);
  }
  for (const mid of ["Ma", "Mb", "Mc"]) {
    midDots[mid] = board.point(state.A, "mid-dot", 4.5, dots);
  }

  const text = {};
  for (const name of ["A", "B", "C", "H", "X", "Xp", "Y", "Yp", "Z", "Zp",
    "Ma", "Mb", "Mc", "M", "Q"]) {
    text[name] = board.label(state.A, name, "point-label", 6, -6, labels);
  }
  const labelOffsets = {
    A: [-14, -8], B: [-15, 16], C: [7, -8], H: [6, 16],
    X: [-18, -8], Xp: [-18, 16], Y: [-16, -8], Yp: [-16, 16],
    Z: [-16, -8], Zp: [-16, 16],
    Ma: [6, -8], Mb: [6, -8], Mc: [6, -8], M: [6, -8], Q: [6, 16],
  };
  const shownName = { X: "X", Xp: "X'", Y: "Y", Yp: "Y'", Z: "Z", Zp: "Z'",
    Ma: "Ma", Mb: "Mb", Mc: "Mc", M: "M", Q: "Q" };

  const clamp = (name) => (q) => Core.clampPoint(state, name, q);
  const onMove = (name) => (p) => {
    state = Core.move(state, name, p);
    render();
  };
  const handles = {};
  for (const name of ["A", "B", "C", "P"]) {
    handles[name] = board.handle(name, state[name], {
      r: 8,
      step: 3,
      shift: 12,
      cls: name === "P" ? "geom-handle point-handle" : "geom-handle vertex-handle",
      label: "Point " + name + (name === "P"
        ? " choosing the first line through the orthocenter"
        : " of the triangle") + ". Drag it, or focus it and use the arrow keys.",
      clamp: clamp(name),
      onMove: onMove(name),
      layer: handlesLayer,
    });
  }

  function render() {
    const f = Core.compute(state);
    const names = state.ShowNames;
    const extraCircles = (state.XXpH ? 1 : 0) + (state.YYpH ? 1 : 0) + (state.ZZpH ? 1 : 0);
    const reflectionLines = (state.AReflL ? 1 : 0) + (state.BReflL ? 1 : 0) + (state.CReflL ? 1 : 0);

    showSegment(edgeAB, f.A, f.B, true);
    showSegment(edgeBC, f.B, f.C, true);
    showSegment(edgeCA, f.C, f.A, true);
    showLine(firstLine, f.P, f.H, Core.finite(f.H));
    showLine(secondLine, f.H, f.second.q, Core.finite(f.H) && Core.finite(f.second.q));

    showLine(altitudeA, f.A, f.Ha, state.ShowAltitudes);
    showLine(altitudeB, f.B, f.Hb, state.ShowAltitudes);
    showLine(altitudeC, f.C, f.Hc, state.ShowAltitudes);
    showSegment(reflectA, f.H, f.Ka, state.AReflL);
    showSegment(reflectB, f.H, f.Kb, state.BReflL);
    showSegment(reflectC, f.H, f.Kc, state.CReflL);

    const halves = [[f.Ma, f.X], [f.Ma, f.Xp], [f.Mb, f.Y], [f.Mb, f.Yp], [f.Mc, f.Z], [f.Mc, f.Zp]];
    premise.forEach((shape, i) => showSegment(shape, halves[i][0], halves[i][1], state.ShowHint));
    showSegment(midlineA, f.Ma, f.Mb, state.ShowLine);
    showSegment(midlineB, f.Mb, f.Mc, state.ShowLine);

    showCircle(circumcircle, f.Circle, state.ABC);
    showCircle(circleX, f.Ca, state.XXpH);
    showCircle(circleY, f.Cb, state.YYpH);
    showCircle(circleZ, f.Cc, state.ZZpH);

    showPoint(dotH, f.H, true);
    showPoint(dotKa, f.Ka, state.AReflP);
    showPoint(dotKb, f.Kb, state.BReflP);
    showPoint(dotKc, f.Kc, state.CReflP);
    showPoint(dotM, f.M, extraCircles > 1);
    showPoint(dotQ, f.Q, reflectionLines > 1);
    for (const cut of ["X", "Xp", "Y", "Yp", "Z", "Zp"]) {
      showPoint(cuts[cut], f[cut], true);
    }
    for (const mid of ["Ma", "Mb", "Mc"]) {
      showPoint(midDots[mid], f[mid], true);
    }

    for (const name in text) {
      const visible = names && (name === "M" ? extraCircles > 1
        : name === "Q" ? reflectionLines > 1 : true);
      const p = f[name];
      const [dx, dy] = labelOffsets[name];
      text[name].show(visible && Core.finite(p));
      if (visible && Core.finite(p)) text[name].set(p, shownName[name] || name, dx, dy);
    }

    for (const name of ["A", "B", "C", "P"]) handles[name].set(state[name]);
    for (const [id, key] of optionControls) document.getElementById(id).checked = state[key];

    say(Core.describe(f));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const optionControls = [
    ["namesBox", "ShowNames"], ["altBox", "ShowAltitudes"],
    ["premBox", "ShowHint"], ["lineBox", "ShowLine"],
    ["xxBox", "XXpH"], ["yyBox", "YYpH"], ["zzBox", "ZZpH"], ["abcBox", "ABC"],
    ["hrefABBox", "CReflP"], ["hrefBCBox", "AReflP"], ["hrefACBox", "BReflP"],
    ["xyzABBox", "CReflL"], ["xyzBCBox", "AReflL"], ["xyzACBox", "BReflL"],
  ];
  for (const [id, key] of optionControls) {
    document.getElementById(id).addEventListener("change", (e) => {
      state = Core.option(state, key, e.target.checked);
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
