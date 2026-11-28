"use strict";

/*
 * Drawing and input for the inversion/isosceles illustration. Every number
 * comes from inversion-in-circle-and-isosceles-core.js; this file only makes
 * SVG shapes once and moves them in place, so dragging B or using the arrow
 * keys never loses keyboard focus. B is the single handle; the four toggles
 * and six step buttons repeat the applet's checkboxes, with the fifth step
 * added as in the original first solution. There is no win or loss.
 */

(() => {
  const Core = InversionInCircleAndIsoscelesCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const inverse = board.layer("inverse");
  const angles = board.layer("angles");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = Core.start({});
  const first = Core.geometry(state);

  const sCircle = board.circle(first.O, first.R, "s-circle", circles);
  const gCircle = board.circle(first.mid.center, first.mid.radius, "g-circle", circles);
  const wCircle = board.circle(first.small.center, first.small.radius, "w-circle", circles);
  const diameter = board.segment(first.A, first.C, "diameter", guides);
  const sideBE = board.line(first.B, first.E, "side", guides);
  const sideCE = board.segment(first.C, first.E, "side", guides);
  const perpendicular = board.line(first.B, first.small.center, "perpendicular", guides);
  const pointQ = board.point(first.small.center, "point-q", 3.5, guides);
  const pointP = board.point(first.mid.center, "point-p", 3.5, guides);
  const pointO = board.point(first.O, "point-o", 3.5, guides);
  const pointE = board.point(first.E, "point-e", 3.5, guides);

  const invCircle = board.circle(first.inversion.center,
    first.inversion.radius, "inv-circle", inverse);
  const imageS = board.circle({ x: 0, y: 0 }, 1, "image-circle", inverse);
  const imageW = board.circle({ x: 0, y: 0 }, 1, "image-circle", inverse);
  const imageCE = board.circle({ x: 0, y: 0 }, 1, "image-side", inverse);
  const imageG = board.line({ x: 0, y: 0 }, { x: 0, y: 1 }, "image-line", inverse);
  const imageBE = board.line(first.B, first.E, "image-line", inverse);
  const invB = board.point(first.B, "image-point", 3.5, inverse);
  const invAp = board.point(first.B, "image-point", 3.5, inverse);
  const invCp = board.point(first.B, "image-point", 3.5, inverse);
  const invEp = board.point(first.B, "image-point", 3.5, inverse);
  const invU = board.point(first.B, "image-point", 3.5, inverse);
  const invV = board.point(first.B, "image-point", 3.5, inverse);
  const invL = board.point(first.B, "image-point", 3.5, inverse);

  const labelA = board.label(first.A, "A", "point-label", -12, 18, labels);
  const labelB = board.label(first.B, "B", "point-label", -4, 18, labels);
  const labelC = board.label(first.C, "C", "point-label", 4, 18, labels);
  const labelE = board.label(first.E, "E", "point-label", 6, -5, labels);
  const labelO = board.label(first.O, "O", "point-label", -13, 18, labels);
  const labelP = board.label(first.mid.center, "P", "point-label", -13, 18, labels);
  const labelQ = board.label(first.small.center, "Q", "point-label", 6, -4, labels);
  const labelAp = board.label(first.A, "A'", "point-label", -16, -5, labels);
  const labelCp = board.label(first.C, "C'", "point-label", 5, -5, labels);
  const labelEp = board.label(first.E, "E'", "point-label", 6, -5, labels);
  const labelU = board.label(first.A, "U", "point-label", -14, 16, labels);
  const labelV = board.label(first.B, "V", "point-label", 6, -5, labels);
  const labelL = board.label(first.B, "L", "point-label", -14, -5, labels);

  /* The five proof-step overlays, created once like every other shape. */
  const stepGroups = [];
  for (let i = 1; i <= 5; i++) {
    stepGroups.push({
      arcs: [1, 2, 3].map(() => board.angleArc(first.B, first.A, first.C, 10, "angle", angles)),
      rights: [1, 2].map(() => board.rightAngle(first.B, first.A, first.C, 7, "right-angle", angles)),
      segs: [1, 2, 3, 4].map(() => board.segment(first.A, first.C, "proof-line", angles)),
    });
  }

  const bHandle = board.handle("B", first.B, {
    r: 9, step: 2, shift: 10, layer: handles,
    label: "Point B on the diameter AC. Drag it, or focus it and press the arrow keys to move it.",
    describe: (p) => "x = " + p.x.toFixed(1),
    clamp: (q) => ({
      x: Math.max(Core.CX - Core.R + Core.MIN_T * 2 * Core.R,
        Math.min(Core.CX + Core.R - Core.MIN_T * 2 * Core.R, q.x)),
      y: Core.CY,
    }),
    onMove: (p) => {
      state = Core.setT(state, Core.fractionAtX(p.x));
      render();
    },
  });

  const toggles = ["names", "premise", "statement", "inversion"].map((name) => ({
    name: name,
    button: document.getElementById(name + "Btn"),
    on: false,
  }));
  const stepButtons = [];
  for (let i = 0; i <= 5; i++) {
    stepButtons.push(document.getElementById("step" + i + "Btn"));
  }
  let step = 0;

  /** The shared status line. This is an illustration, so no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const f = (v) => v.toFixed(1);

  function showArc(group, index, on, vertex, p, q, radius) {
    const arc = group.arcs[index];
    arc.show(on);
    if (on) arc.set(vertex, p, q, radius);
  }
  function showRight(group, index, on, vertex, p, q, size) {
    const mark = group.rights[index];
    mark.show(on);
    if (on) mark.set(vertex, p, q, size);
  }
  function showSeg(group, index, on, p, q) {
    const seg = group.segs[index];
    seg.show(on);
    if (on) seg.set(p, q);
  }

  function render() {
    const g = Core.geometry(state);
    const v = Core.inversion(state);
    const m = Core.measurements(state);
    const B = g.B, Q = g.small.center;
    const named = toggles[0].on;
    const premise = toggles[1].on;
    const statement = toggles[2].on;
    const inverted = toggles[3].on || step > 0;

    sCircle.set(g.O, g.R);
    gCircle.set(g.mid.center, g.mid.radius);
    wCircle.set(Q, g.radius);
    diameter.set(g.A, g.C);
    sideBE.set(B, g.E);
    sideCE.set(g.C, g.E);
    perpendicular.set(B, Q);
    perpendicular.show(statement || step > 0);
    pointQ.set(Q);
    pointP.set(g.mid.center);
    pointO.set(g.O);
    pointE.set(g.E);

    invCircle.set(B, g.inversion.radius);
    invCircle.show(inverted);
    imageS.show(inverted);
    imageW.show(inverted);
    imageCE.show(inverted);
    imageG.show(inverted);
    imageBE.show(inverted);
    if (inverted) {
      imageS.set(v.bigImage.center, v.bigImage.radius);
      imageW.set(v.smallImage.center, v.smallImage.radius);
      imageCE.set(v.ceImage.center, v.ceImage.radius);
      imageG.set(v.midImage.a, v.midImage.b);
      imageBE.set(B, g.E);
    }
    [invB, invAp, invCp, invEp, invU, invV, invL].forEach((p) => p.show(inverted));
    if (inverted) {
      invB.set(B); invAp.set(v.Ap); invCp.set(v.Cp); invEp.set(v.Ep);
      invU.set(v.U); invV.set(v.V); invL.set(v.L);
    }

    labelA.set(g.A, "A", -12, 18);
    labelB.set(B, "B", -4, 18);
    labelC.set(g.C, "C", 4, 18);
    labelE.set(g.E, "E", 6, -5);
    labelO.set(g.O, "O", -13, 18);
    labelP.set(g.mid.center, "P", -13, 18);
    labelQ.set(Q, "Q", 6, -4);
    [labelA, labelB, labelC, labelE, labelO, labelP, labelQ].forEach((l) => l.show(named));
    [labelAp, labelCp, labelEp, labelU, labelV, labelL].forEach((l) => l.show(named && inverted));
    if (named && inverted) {
      labelAp.set(v.Ap, "A'", -16, -5);
      labelCp.set(v.Cp, "C'", 5, -5);
      labelEp.set(v.Ep, "E'", 6, -5);
      labelU.set(v.U, "U", -14, 16);
      labelV.set(v.V, "V", 6, -5);
      labelL.set(v.L, "L", -14, -5);
    }
    bHandle.set(B);

    // Premise: the two equal sides BE, CE and the tangencies of W.
    const contactG = {
      x: g.mid.center.x + (g.small.center.x - g.mid.center.x) *
        g.mid.radius / Core.dist(g.mid.center, g.small.center),
      y: g.mid.center.y + (g.small.center.y - g.mid.center.y) *
        g.mid.radius / Core.dist(g.mid.center, g.small.center),
    };
    const contactS = {
      x: g.O.x + (Q.x - g.O.x) * g.R / Core.dist(g.O, Q),
      y: g.O.y + (Q.y - g.O.y) * g.R / Core.dist(g.O, Q),
    };
    showArc(stepGroups[0], 0, premise, B, g.E, g.C, 13);
    showArc(stepGroups[0], 1, premise, g.E, g.B, g.C, 13);
    showArc(stepGroups[0], 2, premise, g.C, g.B, g.E, 13);
    showSeg(stepGroups[0], 0, premise, contactG, contactS);
    showRight(stepGroups[0], 0, statement, B, g.A, Q, 9);

    // Step 1: C'BE' is the same isosceles shape as EBC after inversion.
    showArc(stepGroups[1], 0, step >= 1, B, v.Cp, v.Ep, 13);
    showArc(stepGroups[1], 1, step >= 1, v.Cp, B, v.Ep, 9);
    showArc(stepGroups[1], 2, step >= 1, v.Ep, B, v.Cp, 9);
    showSeg(stepGroups[1], 0, step >= 1, B, v.Cp);
    // Step 2: S' has diameter A'C' and the image of G touches it at A'.
    showRight(stepGroups[2], 0, step >= 2, v.Ep, v.Ap, v.Cp, 7);
    showRight(stepGroups[2], 1, step >= 2, v.Ap, v.Cp, v.midImage.a, 7);
    showSeg(stepGroups[2], 0, step >= 2, v.Ap, v.Cp);
    // Step 3: U, and the equal angles in A'UE'.
    showArc(stepGroups[3], 0, step >= 3, v.U, v.Ap, v.Ep, 11);
    showArc(stepGroups[3], 1, step >= 3, v.Ep, v.U, v.Ap, 10);
    showArc(stepGroups[3], 2, step >= 3, B, v.U, v.Ap, 10);
    showSeg(stepGroups[3], 0, step >= 3, v.U, v.Ap);
    showSeg(stepGroups[3], 1, step >= 3, v.U, v.Ep);
    // Step 4: V sits on the bisector at U and BV = BU.
    showArc(stepGroups[4], 0, step >= 4, v.V, v.U, B, 12);
    showArc(stepGroups[4], 1, step >= 4, v.U, v.V, B, 12);
    showArc(stepGroups[4], 2, step >= 4, B, v.V, v.U, 12);
    showSeg(stepGroups[4], 0, step >= 4, v.V, B);
    showSeg(stepGroups[4], 1, step >= 4, v.V, v.U);
    showSeg(stepGroups[4], 2, step >= 5, v.L, v.V);
    showSeg(stepGroups[4], 3, step >= 5, v.L, B);

    const words = [
      "The small circle W sits in the gap. Drag B to change the picture.",
      "After inversion at B, the triangle C'BE' is isosceles, just like EBC.",
      "S' is the circle on A'C' as diameter, and G' touches it at A'.",
      "U is where G' meets E'B; the triangle A'UE' is isosceles.",
      "V is the centre of W'; it lies on the bisector at U and BV = BU.",
      "With L the centre of S': LV = LB + BV = R' + r', so W' touches S'.",
    ][step];
    say("B at x = " + f(B.x) + "; Q is " + f(m.offset) + " units off the line through B. " +
      "W touches S (" + f(m.sGap) + "), G (" + f(m.gGap) + ") and BE (" + f(m.lineGap) + "). " + words);

    // Board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  toggles.forEach((toggle) => {
    toggle.button.setAttribute("aria-pressed", "false");
    toggle.button.addEventListener("click", () => {
      toggle.on = !toggle.on;
      toggle.button.setAttribute("aria-pressed", String(toggle.on));
      render();
    });
  });
  stepButtons.forEach((button, i) => {
    button.setAttribute("aria-pressed", String(i === 0));
    button.addEventListener("click", () => {
      step = i;
      stepButtons.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
      render();
    });
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = Core.start({});
    step = 0;
    toggles.forEach((toggle) => {
      toggle.on = false;
      toggle.button.setAttribute("aria-pressed", "false");
    });
    stepButtons.forEach((b, j) => b.setAttribute("aria-pressed", String(j === 0)));
    render();
  });

  board.onTheme(() => render());
  render();
})();
