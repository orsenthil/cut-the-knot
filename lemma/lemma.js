"use strict";

/*
 * The page for Lemma: drawing and input only; all the geometry is in
 * lemma-core.js. The big semicircle on AB and the inverted one on DE enclose
 * the salinon; the two small semicircles on AD and BE are cut out of it. A
 * blue handle on AO stands for D, and E is its mirror at the other end. The
 * circle on the vertical diameter CF is drawn on top: its area matches the
 * salinon however far D is moved. Every SVG object is made once and updated
 * in place, so dragging or using the arrow keys keeps keyboard focus.
 */

(function () {
  const Core = LemmaCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const symBtn = document.getElementById("symBtn");
  const shadeChk = document.getElementById("shadeChk");
  const board = Geom.board(document.getElementById("board"));

  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const outlines = board.layer("outlines");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  /** A filled semicircle closed along its diameter (Java drawArc/fillArc). */
  function semiPath(node, c, r, upper) {
    const sweep = upper ? 1 : 0;
    node.setAttribute("d", `M ${c.x - r} ${c.y} A ${r} ${r} 0 0 ${sweep} ${c.x + r} ${c.y} L ${c.x + r} ${c.y} L ${c.x - r} ${c.y} Z`);
    return node;
  }
  function semiShape(cls, layer, upper) {
    const node = board.el("path", null, cls, layer);
    return {
      node: node,
      set: (c, r) => semiPath(node, c, r, upper),
      show: (on) => { node.style.display = on ? "" : "none"; },
    };
  }

  let state = Core.start({});
  const first = Core.geometry(state);

  const bigFill = semiShape("salinon-fill", fills, true);
  const bottomFill = semiShape("salinon-fill", fills, false);
  const leftCut = semiShape("salinon-cut", fills, true);
  const rightCut = semiShape("salinon-cut", fills, true);
  const cfCircle = board.circle(first.circle.center, first.circle.radius, "cf-circle", fills);

  const diameter = board.segment(first.A, first.B, "diameter", guides);
  const cfLine = board.segment(first.C, first.F, "cf-line", guides);
  const spokeAC = board.segment(first.A, first.C, "spoke", guides);
  const spokeBC = board.segment(first.B, first.C, "spoke", guides);
  const spokeDF = board.segment(first.D, first.F, "spoke", guides);
  const spokeFE = board.segment(first.F, first.E, "spoke", guides);

  const bigArc = board.arc(first.O, first.bigR, Math.PI, 2 * Math.PI, "outline", outlines);
  const leftArc = board.arc({ x: first.A.x + first.smallR, y: Core.BASE_Y },
    first.smallR, Math.PI, 2 * Math.PI, "outline", outlines);
  const rightArc = board.arc({ x: first.B.x - first.smallR, y: Core.BASE_Y },
    first.smallR, Math.PI, 2 * Math.PI, "outline", outlines);
  const bottomArc = board.arc(first.O, first.deR, 0, Math.PI, "outline", outlines);
  const circleArc = board.circle(first.circle.center, first.circle.radius,
    "cf-outline", outlines);

  const labelA = board.label(first.A, "A", "point-label", -12, 17, labels);
  const labelB = board.label(first.B, "B", "point-label", 4, 17, labels);
  const labelO = board.label(first.O, "O", "point-label", -4, 17, labels);
  const labelD = board.label(first.D, "D", "point-label", -4, 17, labels);
  const labelE = board.label(first.E, "E", "point-label", 4, 17, labels);
  const labelC = board.label(first.C, "C", "point-label", 7, -4, labels);
  const labelF = board.label(first.F, "F", "point-label", 7, 4, labels);

  const dHandle = board.handle("D", first.point, {
    r: 9, step: 2, shift: 10, layer: handles,
    label: "Point D on the line AO. Drag it, or focus it and press the arrow keys to move it.",
    clamp: (q) => ({
      x: Geom.clamp(q.x, Core.RECT.x + Core.MIN_GAP, Core.RECT.x + Core.HALF),
      y: Core.BASE_Y,
    }),
    onMove: (p) => {
      state = Core.setPointX(state, p.x);
      render();
    },
  });

  /** The shared status line. This is a drawing with no win or loss, so no
   * kind is passed: the record counts a demo as finished once explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => v.toFixed(1);

  function render() {
    const g = Core.geometry(state);
    const leftCenter = { x: g.A.x + g.smallR, y: Core.BASE_Y };
    const rightCenter = { x: g.B.x - g.smallR, y: Core.BASE_Y };

    bigFill.set(g.O, g.bigR);
    bottomFill.set(g.O, g.deR);
    leftCut.set(leftCenter, g.smallR);
    rightCut.set(rightCenter, g.smallR);
    cfCircle.set(g.circle.center, g.circle.radius);
    const shaded = shadeChk.checked;
    bigFill.show(shaded);
    bottomFill.show(shaded);
    leftCut.show(shaded);
    rightCut.show(shaded);
    cfCircle.show(shaded);

    diameter.set(g.A, g.B);
    cfLine.set(g.C, g.F);
    spokeAC.set(g.A, g.C);
    spokeBC.set(g.B, g.C);
    spokeDF.set(g.D, g.F);
    spokeFE.set(g.F, g.E);
    bigArc.set(g.O, g.bigR, Math.PI, 2 * Math.PI);
    leftArc.set(leftCenter, g.smallR, Math.PI, 2 * Math.PI);
    rightArc.set(rightCenter, g.smallR, Math.PI, 2 * Math.PI);
    bottomArc.set(g.O, g.deR, 0, Math.PI);
    circleArc.set(g.circle.center, g.circle.radius);

    labelA.set(g.A, "A", -12, 17);
    labelB.set(g.B, "B", 4, 17);
    labelO.set(g.O, "O", -4, 17);
    labelD.set(g.D, "D", -4, 17);
    labelE.set(g.E, "E", 4, 17);
    labelC.set(g.C, "C", 7, -4);
    labelF.set(g.F, "F", 7, 4);
    dHandle.set(g.D);

    say("AD = BE " + fmt(g.L) + ", DE " + fmt(g.de) + ", CF " + fmt(g.cf) +
      ". Salinon area " + fmt(g.salinon) + " = circle on CF " + fmt(g.circleArea) +
      ". EA² + AD² = 2(EO² + OA²): " + fmt(g.ea ** 2 + g.L ** 2) + " = " +
      fmt(2 * (g.oa ** 2 + g.eo ** 2)) + ".");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
  });
  symBtn.addEventListener("click", () => {
    state = Core.setPointX(state, Core.RECT.x + Core.HALF);
    render();
  });
  shadeChk.addEventListener("change", render);
  board.onTheme(() => render());

  render();
})();
