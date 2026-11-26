"use strict";

/*
 * The page for Arbelos: drawing and input only; the geometry is in
 * arbelos-core.js. A big semicircle sits on the diameter AB, two smaller ones
 * sit on AN and NB, and N is a focusable handle on AB. Every shape is created
 * once and redrawn in place, so dragging or using the arrow keys never loses
 * keyboard focus. The upright PN and the circle on PN are drawn on top: their
 * areas match, however N is moved.
 */

(function () {
  const Core = ArbelosCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const middleBtn = document.getElementById("middleBtn");
  const circleChk = document.getElementById("circleChk");
  const chordChk = document.getElementById("chordChk");
  const board = Geom.board(document.getElementById("board"));

  const fills = board.layer("fills");
  const twinLayer = board.layer("twin");
  const outlines = board.layer("outlines");
  const guides = board.layer("guides");
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
      show: (on) => { node.style.display = on ? "" : "none"; return node; },
    };
  }

  let state = Core.start({});
  const start = Core.geometry(state);

  const bigFill = semiShape("arbelos-big", fills);
  const cutLeft = semiShape("arbelos-cut", fills);
  const cutRight = semiShape("arbelos-cut", fills);
  const twinShape = board.circle(start.circle.center, start.circle.radius, "twin-circle", twinLayer);
  const bigArc = board.arc({ x: start.A.x + start.R, y: Core.BASE_Y }, start.R,
    Math.PI, 2 * Math.PI, "outline", outlines);
  const leftArc = board.arc(start.leftCenter, start.r1, Math.PI, 2 * Math.PI,
    "outline", outlines);
  const rightArc = board.arc(start.rightCenter, start.r2, Math.PI, 2 * Math.PI,
    "outline", outlines);
  const diameter = board.segment(start.A, start.B, "diameter", guides);
  const upright = board.segment(start.N, start.P, "upright", guides);
  const tangentTail = board.segment(start.N,
    { x: start.N.x, y: Core.BASE_Y + start.altitude }, "tangent-tail", guides);
  const rightMark = board.rightAngle(start.N, start.A, start.P, 7, "right-angle", guides);

  const labelA = board.label(start.A, "A", "point-label", -4, 17, labels);
  const labelB = board.label(start.B, "B", "point-label", -4, 17, labels);
  const labelN = board.label(start.N, "N", "point-label", -4, 17, labels);
  const labelP = board.label(start.P, "P", "point-label", 7, -6, labels);

  const nHandle = board.handle("N", start.N, {
    r: 9, step: 4, shift: 20, layer: handles,
    label: "Point N on the diameter AB. Drag it, or focus it and press the arrow keys to move it.",
    clamp: (q) => ({
      x: Geom.clamp(q.x, Core.RECT.x + Core.MIN_GAP, Core.RECT.x + Core.DIAMETER - Core.MIN_GAP),
      y: Core.BASE_Y,
    }),
    onMove: (p) => {
      state = Core.setT(state, Core.fractionAtX(p.x));
      render();
    },
  });

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and is how a
   * game page tells the player's record a play ended; this is a picture with
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
    const center = { x: g.A.x + g.R, y: Core.BASE_Y };

    bigFill.set(center, g.R);
    cutLeft.set(g.leftCenter, g.r1);
    cutRight.set(g.rightCenter, g.r2);
    twinShape.set(g.circle.center, g.circle.radius);
    twinShape.show(circleChk.checked);

    bigArc.set(center, g.R, Math.PI, 2 * Math.PI);
    leftArc.set(g.leftCenter, g.r1, Math.PI, 2 * Math.PI);
    rightArc.set(g.rightCenter, g.r2, Math.PI, 2 * Math.PI);
    diameter.set(g.A, g.B);
    upright.set(g.N, g.P);
    tangentTail.set(g.N, { x: g.N.x, y: Core.BASE_Y + g.altitude });
    tangentTail.show(chordChk.checked);
    rightMark.set(g.N, g.A, g.P, 7);

    labelA.set(g.A, "A", -4, 17);
    labelB.set(g.B, "B", -4, 17);
    labelN.set(g.N, "N", -4, 17);
    labelP.set(g.P, "P", 7, -6);
    nHandle.set(g.N);

    say("AN " + fmt(g.a) + ", NB " + fmt(g.b) + ", upright PN " + fmt(g.altitude) +
      ". Knife area " + fmt(g.arbelosArea) + " = circle on PN " + fmt(g.circleArea) +
      ". Whole tangent t " + fmt(g.chord) + " gives pi×t²/8 = " + fmt(g.fullArea) +
      " for the three circles. Big arc " + fmt(g.bigArc) + " = the two small arcs together.");

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
  circleChk.addEventListener("change", render);
  chordChk.addEventListener("change", render);
  board.onTheme(() => render());

  render();
})();
