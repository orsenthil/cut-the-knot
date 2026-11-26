"use strict";

/*
 * The page for Concyclic Points in Arbelos: drawing and input only; the
 * geometry is in arbelos-concyclic-core.js. Three semicircles make the
 * shoemaker's knife, the inscribed circle touches them at E, F and D, and
 * the two circles about M and N pass through the four points each claimed on
 * the page. C is a focusable handle: drag it or use the arrow keys, and every
 * shape is redrawn in place so the focus stays on the handle.
 */

(function () {
  const Core = ArbelosConcyclicCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const middleBtn = document.getElementById("middleBtn");
  const namesChk = document.getElementById("namesChk");
  const extraChk = document.getElementById("extraChk");
  const board = Geom.board(document.getElementById("board"));

  const fills = board.layer("fills");
  const arcs = board.layer("arcs");
  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  /** A filled upper semicircle, closed along its diameter. */
  function semiPath(node, c, r) {
    node.setAttribute("d",
      `M ${c.x - r} ${c.y} A ${r} ${r} 0 0 1 ${c.x + r} ${c.y} Z`);
  }
  function semiShape(cls, layer) {
    const node = board.el("path", null, cls, layer);
    return {
      node: node,
      set: (c, r) => { semiPath(node, c, r); return node; },
    };
  }

  let state = Core.start({});
  const first = Core.geometry(state);

  const bigFill = semiShape("knife-big", fills);
  const cutLeft = semiShape("knife-cut", fills);
  const cutRight = semiShape("knife-cut", fills);
  const incFill = board.circle(first.P, first.incircle.radius, "incircle-fill", fills);

  const bigArc = board.arc(first.bigCenter, first.R, Math.PI, 2 * Math.PI, "outline", arcs);
  const leftArc = board.arc(first.O1, first.r1, Math.PI, 2 * Math.PI, "outline", arcs);
  const rightArc = board.arc(first.O2, first.r2, Math.PI, 2 * Math.PI, "outline", arcs);
  const base = board.segment(first.A, first.B, "diameter", guides);
  const leftRadius = board.segment(first.M, first.C, "radius-line", guides);
  const rightRadius = board.segment(first.N, first.C, "radius-line", guides);
  const mirrorLine = board.segment(first.L, first.L1, "mirror-line", guides);

  const circleM = board.circle(first.circleM.center, first.circleM.radius, "claim-circle", circles);
  const circleN = board.circle(first.circleN.center, first.circleN.radius, "claim-circle-2", circles);
  const circleL1 = board.circle(first.circleL1.center, first.circleL1.radius, "extra-circle", circles);

  const dotE = board.point(first.E, "tangent-dot", 4, dots);
  const dotF = board.point(first.F, "tangent-dot", 4, dots);
  const dotD = board.point(first.D, "tangent-dot", 4, dots);
  const dotM = board.point(first.M, "center-dot", 4, dots);
  const dotN = board.point(first.N, "center-dot", 4, dots);

  const labelA = board.label(first.A, "A", "point-label", -11, 16, labels);
  const labelB = board.label(first.B, "B", "point-label", 3, 16, labels);
  const labelC = board.label(first.C, "C", "point-label", -4, 16, labels);
  const labelD = board.label(first.D, "D", "point-label", 6, -6, labels);
  const labelE = board.label(first.E, "E", "point-label", -13, -5, labels);
  const labelF = board.label(first.F, "F", "point-label", 6, -5, labels);
  const labelM = board.label(first.M, "M", "point-label", -13, -6, labels);
  const labelN = board.label(first.N, "N", "point-label", 6, -6, labels);
  const labelL1 = board.label(first.L1, "L1", "point-label", 6, 14, labels);

  const cHandle = board.handle("C", first.C, {
    r: 9, step: 4, shift: 20, layer: handles,
    label: "Point C on the diameter AB. Drag it, or focus it and press the arrow keys to move it.",
    describe: (p) => `x ${Math.round(p.x)}, y ${Math.round(p.y)}`,
    clamp: (q) => ({
      x: Geom.clamp(q.x, Core.A.x + Core.EDGE, Core.B.x - Core.EDGE),
      y: Core.BASE_Y,
    }),
    onMove: (p) => {
      state = Core.setT(state, Core.fractionAtX(p.x));
      render();
    },
  });

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and is how a
   * game tells the player's record a play ended; this is a picture with no
   * win or loss, so it reports the distances and passes no kind.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => v.toFixed(1);

  function render() {
    const g = Core.geometry(state);

    bigFill.set(g.bigCenter, g.R);
    cutLeft.set(g.O1, g.r1);
    cutRight.set(g.O2, g.r2);
    incFill.set(g.P, g.incircle.radius);

    bigArc.set(g.bigCenter, g.R, Math.PI, 2 * Math.PI);
    leftArc.set(g.O1, g.r1, Math.PI, 2 * Math.PI);
    rightArc.set(g.O2, g.r2, Math.PI, 2 * Math.PI);
    base.set(g.A, g.B);
    leftRadius.set(g.M, g.C);
    rightRadius.set(g.N, g.C);
    mirrorLine.set(g.L, g.L1);
    mirrorLine.show(extraChk.checked);

    circleM.set(g.circleM.center, g.circleM.radius);
    circleN.set(g.circleN.center, g.circleN.radius);
    circleL1.set(g.circleL1.center, g.circleL1.radius);
    circleL1.show(extraChk.checked);

    dotE.set(g.E); dotF.set(g.F); dotD.set(g.D);
    dotM.set(g.M); dotN.set(g.N);

    labelA.set(g.A, "A", -11, 16);
    labelB.set(g.B, "B", 3, 16);
    labelC.set(g.C, "C", -4, 16);
    labelD.set(g.D, "D", 6, -6);
    labelE.set(g.E, "E", -13, -5);
    labelF.set(g.F, "F", 6, -5);
    labelM.set(g.M, "M", -13, -6);
    labelN.set(g.N, "N", 6, -6);
    labelL1.set(g.L1, "L1", 6, 14);
    for (const lab of [labelA, labelB, labelC, labelD, labelE, labelF, labelM, labelN, labelL1]) {
      lab.show(namesChk.checked);
    }
    cHandle.set(g.C);

    say("AC " + fmt(g.a) + ", CB " + fmt(g.b) + ". A, C, F, D lie on the circle about M (" +
      fmt(g.circleM.radius) + "); B, C, E, D lie on the circle about N (" + fmt(g.circleN.radius) +
      "). The inscribed circle has radius " + fmt(g.incircle.radius) + ".");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
  });
  middleBtn.addEventListener("click", () => {
    state = Core.setT(state, 0.5);
    render();
  });
  namesChk.addEventListener("change", render);
  extraChk.addEventListener("change", render);
  board.onTheme(() => render());

  render();
})();
