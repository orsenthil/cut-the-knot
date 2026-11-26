"use strict";

/*
 * The drawing and input for Altitude Mirror 2. The SVG holds a circle with
 * diameter AB and two draggable points, C on the left arc and D on the right.
 * Everything else (the reflections, E, F, the Pascal intersections and the
 * two equal angles) is computed by AltitudeMirror2Core and drawn as shapes.
 */

(function () {
  const Core = AltitudeMirror2Core;
  const B = Core.BOARD;
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const statementBtn = document.getElementById("statementBtn");

  const board = Geom.board(document.getElementById("board"));
  const base = board.layer("base");
  const sides = board.layer("sides");
  const guides = board.layer("guides");
  const hexagon = board.layer("hexagon");
  const rays = board.layer("rays");
  const altitude = board.layer("altitude");
  const dots = board.layer("dots");
  const labels = board.layer("labels");

  /* Built once and updated with .set(...) on every draw: a handle keeps its
   * keyboard focus when its neighbours move. O is just a placeholder point;
   * the first render replaces every coordinate with the real geometry. */
  const O = { x: B.cx, y: B.cy };
  const circle = board.circle(O, B.r, "base-circle", base);
  const diameter = board.segment({ x: B.cx - B.r, y: B.cy }, { x: B.cx + B.r, y: B.cy }, "diameter", base);
  const sideAD = board.line(O, O, "tri-side", sides);
  const sideBC = board.line(O, O, "tri-side", sides);
  const sideAC = board.line(O, O, "tri-weak", sides);
  const sideBD = board.line(O, O, "tri-weak", sides);
  const hex = board.polygon([], "hexagon", hexagon);
  const guideC = board.segment(O, O, "reflection", guides);
  const guideD = board.segment(O, O, "reflection", guides);
  const pascal = board.line(O, O, "pascal-line", guides);
  const rayFC = board.segment(O, O, "ray", rays);
  const rayFD = board.segment(O, O, "ray", rays);
  const eqArcC = board.angleArc(O, O, O, 24, "angle-arc", rays);
  const eqArcD = board.angleArc(O, O, O, 24, "angle-arc", rays);
  const rightC = board.rightAngle(O, O, O, 9, "right-mark", sides);
  const rightD = board.rightAngle(O, O, O, 9, "right-mark", sides);
  const altitudeSeg = board.segment(O, O, "altitude", altitude);

  const dotA = board.point(O, "dot fixed", 4, dots);
  const dotB = board.point(O, "dot fixed", 4, dots);
  const dotE = board.point(O, "dot key", 5, dots);
  const dotF = board.point(O, "dot key", 5, dots);
  const dotCp = board.point(O, "dot mirror", 4, dots);
  const dotDp = board.point(O, "dot mirror", 4, dots);
  const dotEp = board.point(O, "dot mirror", 4, dots);

  const labA = board.label(O, "A", "lbl", -15, 18, labels);
  const labB = board.label(O, "B", "lbl", 6, 18, labels);
  const labC = board.label(O, "C", "lbl", -17, -8, labels);
  const labD = board.label(O, "D", "lbl", 8, -8, labels);
  const labE = board.label(O, "E", "lbl", -16, -8, labels);
  const labF = board.label(O, "F", "lbl", 7, 17, labels);
  const labCp = board.label(O, "C′", "lbl", -20, 16, labels);
  const labDp = board.label(O, "D′", "lbl", 7, 16, labels);
  const labEp = board.label(O, "E′", "lbl", 8, -8, labels);
  const labS = board.label(O, "S", "lbl", -6, -8, labels);

  let state = Core.start({});

  const cHandle = board.handle("C", Core.anglePoint(B.cx, B.cy, B.r, state.c), {
    step: 4, r: 9, layer: dots,
    label: "Point C on the left arc. Drag it, or focus it and use the arrow keys.",
    clamp: (q) => Core.constrain("C", q),
    onMove: (p) => { state = Core.move(state, { which: "C", angle: Math.atan2(B.cy - p.y, p.x - B.cx) }); render(); },
  });
  const dHandle = board.handle("D", Core.anglePoint(B.cx, B.cy, B.r, state.d), {
    step: 4, r: 9, layer: dots,
    label: "Point D on the right arc. Drag it, or focus it and use the arrow keys.",
    clamp: (q) => Core.constrain("D", q),
    onMove: (p) => { state = Core.move(state, { which: "D", angle: Math.atan2(B.cy - p.y, p.x - B.cx) }); render(); },
  });

  /**
   * Shows the line under the diagram. This is a demo, so no win, lose or done
   * class is ever set: the player's record counts a visit once it is explored.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function redraw() {
    const g = Core.geometry(state);
    const m = Core.claims(state);
    if (!g.valid) {
      say("Move C or D to a different place on the circle.");
      return;
    }
    const { A, B: Bp, C, D, Cp, Dp, E, F, Ep } = g;

    circle.set(O, B.r);
    diameter.set(A, Bp);
    sideAD.set(A, D).set(A, E);
    sideBC.set(Bp, C).set(Bp, E);
    sideAC.set(A, C);
    sideBD.set(Bp, D);
    hex.set([A, D, Cp, Bp, C, Dp]);
    guideC.set(C, Cp);
    guideD.set(D, Dp);
    pascal.set(E, Ep);
    rayFC.set(F, C);
    rayFD.set(F, D);
    eqArcC.set(F, C, E, 24);
    eqArcD.set(F, E, D, 24);
    rightC.set(C, A, Bp, 9);
    rightD.set(D, A, Bp, 9);
    altitudeSeg.set(E, F);

    dotA.set(A); dotB.set(Bp); dotE.set(E); dotF.set(F);
    dotCp.set(Cp); dotDp.set(Dp); dotEp.set(Ep);
    labA.set(A); labB.set(Bp); labC.set(C); labD.set(D); labE.set(E); labF.set(F);
    labCp.set(Cp); labDp.set(Dp); labEp.set(Ep);
    if (g.S && g.S.x > 10 && g.S.x < 390 && g.S.y > 10 && g.S.y < 240) {
      labS.set(g.S); labS.show(state.names);
    } else labS.show(false);

    hex.show(state.hint);
    guideC.show(state.hint); guideD.show(state.hint); pascal.show(state.hint);
    dotCp.show(state.hint); dotDp.show(state.hint); dotEp.show(state.hint);
    labCp.show(state.hint && state.names);
    labDp.show(state.hint && state.names);
    labEp.show(state.hint && state.names);
    eqArcC.show(state.statement); eqArcD.show(state.statement);
    sideAC.show(state.hint); sideBD.show(state.hint);
    rightC.show(state.hint); rightD.show(state.hint);
    for (const l of [labA, labB, labC, labD, labE, labF]) l.show(state.names);

    cHandle.set(C);
    dHandle.set(D);

    if (state.statement) {
      say(`The two coloured angles at F are equal: ${(m.angleCFE * 180 / Math.PI).toFixed(1)}° each, so EF bisects angle CFD.`);
    } else {
      say(`EF bisects angle CFD: both halves are ${(m.halfAngle * 180 / Math.PI).toFixed(1)}°.${state.hint ? " E, F and E′ line up on one straight line." : ""}`);
    }
  }

  function render() {
    redraw();
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function refreshButtons() {
    for (const [btn, key] of [[namesBtn, "names"], [hintBtn, "hint"], [statementBtn, "statement"]]) {
      btn.setAttribute("aria-pressed", state[key] ? "true" : "false");
      btn.classList.toggle("pressed", !!state[key]);
    }
  }

  function toggle(key) {
    state = Core.move(state, { which: key });
    refreshButtons();
    render();
  }

  newBtn.addEventListener("click", () => {
    state = Core.move(state, { which: "random", random: Math.random });
    render();
  });
  namesBtn.addEventListener("click", () => toggle("names"));
  hintBtn.addEventListener("click", () => toggle("hint"));
  statementBtn.addEventListener("click", () => toggle("statement"));

  /* Class-based SVG colours need no work on a theme flip, but the shapes are
   * re-set so the board stays in step with the site's theme event. */
  board.onTheme(redraw);
  stageEl.classList.add("geom-stage");
  refreshButtons();
  render();
})();
