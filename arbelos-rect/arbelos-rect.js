"use strict";

/*
 * The page for Rectangle in Arbelos: drawing and input only; the geometry is in
 * arbelos-rect-core.js. Three semicircles sit on the line AB, the upright CD
 * reaches the big arc, and the lines AD and BD cut the small arcs at E and F.
 * C can be dragged along AB and D along the big arc - both set the same core
 * position - while every other point follows. All elements are created once
 * and updated in place, so dragging or using the arrow keys keeps focus.
 */

(function () {
  const Core = ArbelosRectCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const middleBtn = document.getElementById("middleBtn");
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");
  const namesChk = document.getElementById("namesChk");
  const hint1Chk = document.getElementById("hint1Chk");
  const hint2Chk = document.getElementById("hint2Chk");
  const board = Geom.board(document.getElementById("board"));

  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const hints = board.layer("hints");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  /** A filled upper semicircle of radius r, closed along its diameter. */
  function semi(node, c, r) {
    node.setAttribute("d",
      `M ${c.x - r} ${c.y} A ${r} ${r} 0 0 1 ${c.x + r} ${c.y} Z`);
  }
  function semiShape(cls, layer) {
    const node = board.el("path", null, cls, layer);
    return {
      node: node,
      set: (c, r) => { semi(node, c, r); return node; },
    };
  }

  let state = Core.start({});
  const start = Core.geometry(state);

  const bigFill = semiShape("arbelos-big", fills);
  const cutLeft = semiShape("arbelos-cut", fills);
  const cutRight = semiShape("arbelos-cut", fills);
  const rectFill = board.polygon([start.C, start.E, start.D, start.F], "rect-fill", fills);
  const diameter = board.segment(start.A, start.B, "base", guides);
  const outerArc = board.arc(start.outer, start.R, Math.PI, 2 * Math.PI, "arc", shapes);
  const leftArc = board.arc(start.Oa, start.r1, Math.PI, 2 * Math.PI, "arc", shapes);
  const rightArc = board.arc(start.Ob, start.r2, Math.PI, 2 * Math.PI, "arc", shapes);
  const upright = board.segment(start.C, start.D, "upright", shapes);
  const edgeCE = board.segment(start.C, start.E, "rect-edge", shapes);
  const edgeED = board.segment(start.E, start.D, "rect-edge", shapes);
  const edgeDF = board.segment(start.D, start.F, "rect-edge", shapes);
  const edgeFC = board.segment(start.F, start.C, "rect-edge", shapes);
  const tangent = board.segment(start.E, start.F, "tangent", shapes);

  // The applet's two optional hints: the three inscribed right angles, and
  // the radii and angles that prove EF touches the small circles.
  const markE = board.rightAngle(start.E, start.A, start.C, 8, "right-mark", hints);
  const markD = board.rightAngle(start.D, start.A, start.B, 8, "right-mark", hints);
  const markF = board.rightAngle(start.F, start.C, start.B, 8, "right-mark", hints);
  const radiusA = board.segment(start.Oa, start.A, "radius", hints);
  const radiusE = board.segment(start.Oa, start.E, "radius", hints);
  const radiusB = board.segment(start.Ob, start.B, "radius", hints);
  const radiusF = board.segment(start.Ob, start.F, "radius", hints);
  const angleE = board.angleArc(start.E, start.Oa, start.F, 13, "angle-mark", hints);
  const angleF = board.angleArc(start.F, start.Ob, start.E, 13, "angle-mark", hints);

  const labelA = board.label(start.A, "A", "point-label", -7, 18, labels);
  const labelB = board.label(start.B, "B", "point-label", 0, 18, labels);
  const labelC = board.label(start.C, "C", "point-label", -4, 20, labels);
  const labelD = board.label(start.D, "D", "point-label", 7, -7, labels);
  const labelE = board.label(start.E, "E", "point-label", -13, -5, labels);
  const labelF = board.label(start.F, "F", "point-label", 8, -5, labels);
  const labelOa = board.label(start.Oa, "Oa", "point-label", -8, 18, labels);
  const labelOb = board.label(start.Ob, "Ob", "point-label", -8, 18, labels);

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and is how a game
   * page tells the player's record a play ended. This is an illustration with
   * no win or loss, so it reports the measurements and passes no kind.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => v.toFixed(1);

  function render() {
    const g = Core.geometry(state);

    bigFill.set(g.outer, g.R);
    cutLeft.set(g.Oa, g.r1);
    cutRight.set(g.Ob, g.r2);
    rectFill.set([g.C, g.E, g.D, g.F]);

    diameter.set(g.A, g.B);
    outerArc.set(g.outer, g.R, Math.PI, 2 * Math.PI);
    leftArc.set(g.Oa, g.r1, Math.PI, 2 * Math.PI);
    rightArc.set(g.Ob, g.r2, Math.PI, 2 * Math.PI);
    upright.set(g.C, g.D);
    edgeCE.set(g.C, g.E);
    edgeED.set(g.E, g.D);
    edgeDF.set(g.D, g.F);
    edgeFC.set(g.F, g.C);
    tangent.set(g.E, g.F);

    const showNames = namesChk.checked;
    labelA.set(g.A, "A", -7, 18).show(showNames);
    labelB.set(g.B, "B", 0, 18).show(showNames);
    labelC.set(g.C, "C", -4, 20).show(showNames);
    labelD.set(g.D, "D", 7, -7).show(showNames);
    labelE.set(g.E, "E", -13, -5).show(showNames);
    labelF.set(g.F, "F", 8, -5).show(showNames);
    labelOa.set(g.Oa, "Oa", -8, 18).show(showNames && hint2Chk.checked);
    labelOb.set(g.Ob, "Ob", -8, 18).show(showNames && hint2Chk.checked);

    const h1 = hint1Chk.checked;
    markE.set(g.E, g.A, g.C, 8).show(h1);
    markD.set(g.D, g.A, g.B, 8).show(h1);
    markF.set(g.F, g.C, g.B, 8).show(h1);
    const h2 = hint2Chk.checked;
    radiusA.set(g.Oa, g.A).show(h2);
    radiusE.set(g.Oa, g.E).show(h2);
    radiusB.set(g.Ob, g.B).show(h2);
    radiusF.set(g.Ob, g.F).show(h2);
    angleE.set(g.E, g.Oa, g.F, 13).show(h2);
    angleF.set(g.F, g.Ob, g.E, 13).show(h2);

    cHandle.set(g.C);
    dHandle.set(g.D);

    say("AC " + fmt(g.a) + ", CB " + fmt(g.b) + ", CD " + fmt(g.CD) +
      ". CEDF is a rectangle with EF = CD = " + fmt(g.EF) +
      ", the common tangent. Knife area " + fmt(g.arbelosArea) +
      " = circle on CD " + fmt(g.circleArea) + ".");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  /** Every drag, from C or from D, becomes a new fraction t of AB. */
  function moveTo(point) {
    state = Core.setT(state, Core.fractionAtX(point.x));
    render();
  }

  const cHandle = board.handle("C", start.C, {
    r: 8, step: 4, shift: 20, layer: handles,
    label: "Point C on the line AB. Drag it, or focus it and press the arrow keys to move it.",
    clamp: (q) => ({
      x: Geom.clamp(q.x, Core.RECT.x + Core.MIN_GAP, Core.RECT.x + Core.SIDE - Core.MIN_GAP),
      y: Core.BASE_Y,
    }),
    describe: (p) => "at x " + Math.round(p.x) + " of 400",
    onMove: moveTo,
  });

  const dHandle = board.handle("D", start.D, {
    r: 8, step: 4, shift: 20, layer: handles,
    label: "Point D on the big semicircle. Drag it, or focus it and press the left or right arrow keys to move it.",
    clamp: (q) => Core.geometry(Core.setT(state, Core.fractionAtX(q.x))).D,
    describe: (p) => "at x " + Math.round(p.x) + ", y " + Math.round(p.y),
    onMove: moveTo,
  });

  resetBtn.addEventListener("click", () => { state = Core.start({}); render(); });
  middleBtn.addEventListener("click", () => { state = Core.setT(state, 0.5); render(); });
  leftBtn.addEventListener("click", () => { state = Core.setT(state, 0.1); render(); });
  rightBtn.addEventListener("click", () => { state = Core.setT(state, 0.9); render(); });
  namesChk.addEventListener("change", render);
  hint1Chk.addEventListener("change", render);
  hint2Chk.addEventListener("change", render);
  board.onTheme(() => render());

  render();
})();
