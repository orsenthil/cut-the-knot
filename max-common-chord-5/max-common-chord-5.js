"use strict";

/*
 * The page for Max Common Chord 5: drawing and input only; the geometry is in
 * max-common-chord-5-core.js. Two circles meet at P and Q, the chord AB goes
 * through P, and W is where AE meets BF. The stage shows C(E), C(F), the two
 * circumcircles claimed by the page and four focusable point handles. Every
 * shape is updated in place, so dragging with a pointer or moving a handle
 * with the arrow keys keeps keyboard focus where the player left it.
 */

(function () {
  const Core = MaxCommonChord5Core;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const chordBtn = document.getElementById("chordBtn");
  const circlesBtn = document.getElementById("circlesBtn");
  const namesChk = document.getElementById("namesChk");
  const hint1Chk = document.getElementById("hint1Chk");
  const hint2Chk = document.getElementById("hint2Chk");

  const board = Geom.board(document.getElementById("board"));
  const circlesLayer = board.layer("circles");
  const guidesLayer = board.layer("guides");
  const anglesLayer = board.layer("angles");
  const dotsLayer = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});
  let mode = "chord"; // the applet starts with "Adjust chord" checked
  const first = Core.geometry(state);

  const circleE = board.circle(first.E, first.E.r, "given-circle", circlesLayer);
  const circleF = board.circle(first.F, first.F.r, "given-circle-2", circlesLayer);
  const circleEQF = board.circle(first.EQF, first.EQF.r, "claim-circle", circlesLayer);
  const circleABQ = board.circle(first.ABQ, first.ABQ.r, "claim-circle-2", circlesLayer);

  const chord = board.segment(state.A, state.B, "chord", guidesLayer);
  const axis = board.segment(state.P, state.Q, "axis", guidesLayer);
  const lineAE = board.segment(state.A, first.E, "spoke", guidesLayer);
  const lineBF = board.segment(state.B, first.F, "spoke", guidesLayer);
  const lineEP = board.segment(first.E, state.P, "hint-line", guidesLayer);
  const lineFP = board.segment(first.F, state.P, "hint-line", guidesLayer);

  const arcAPE = board.angleArc(state.A, state.P, first.E, 15, "angle-mark", anglesLayer);
  const arcBPF = board.angleArc(state.B, state.P, first.F, 19, "angle-mark-2", anglesLayer);
  const arcEWF = board.angleArc(first.E, first.W, first.F, 16, "angle-mark-3", anglesLayer);
  const arcAQB = board.angleArc(state.A, state.Q, state.B, 14, "angle-mark-4", anglesLayer);

  const dotE = board.point(first.E, "center-dot", 4, dotsLayer);
  const dotF = board.point(first.F, "center-dot", 4, dotsLayer);
  const dotW = board.point(first.W, "common-dot", 5, dotsLayer);

  const labelP = board.label(state.P, "P", "point-label", -12, -7, labelsLayer);
  const labelQ = board.label(state.Q, "Q", "point-label", -12, 17, labelsLayer);
  const labelA = board.label(state.A, "A", "point-label", -12, 17, labelsLayer);
  const labelB = board.label(state.B, "B", "point-label", 5, -7, labelsLayer);
  const labelE = board.label(first.E, "E", "point-label", 6, -7, labelsLayer);
  const labelF = board.label(first.F, "F", "point-label", 6, 17, labelsLayer);
  const labelW = board.label(first.W, "W", "point-label", 7, -7, labelsLayer);

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and tells the
   * player's record that a play ended. This is an illustration with no win
   * or loss, so say() is called without a kind.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const handleOpts = (name, description) => ({
    r: 12,
    step: 4,
    shift: 20,
    layer: handlesLayer,
    label: "Point " + name + ". " + description + " Drag it, or focus it and use the arrow keys.",
    describe: (p) => "at x " + Math.round(p.x) + ", y " + Math.round(p.y),
    clamp: (p) => Core.clampPoint(p),
    onMove: (p) => {
      state = Core.move(state, name, p, mode);
      render();
    },
  });

  const hP = board.handle("P", state.P, handleOpts("P", "One crossing of the two circles."));
  const hQ = board.handle("Q", state.Q, handleOpts("Q", "The other crossing of the two circles."));
  const hA = board.handle("A", state.A, handleOpts("A", "A point on the first circle."));
  const hB = board.handle("B", state.B, handleOpts("B", "A point on the second circle."));

  const fmt = (v) => Number(v).toFixed(1);

  /** Redraw everything from one position. Also saves it for the tutor. */
  function render() {
    const g = Core.geometry(state);
    const ok = g.valid && !!g.W && Number.isFinite(g.W.x);

    chord.set(state.A, state.B);
    axis.set(state.P, state.Q);
    if (ok) {
      circleE.set(g.E, g.E.r);
      circleF.set(g.F, g.F.r);
      circleEQF.set(g.EQF, g.EQF.r);
      circleABQ.set(g.ABQ, g.ABQ.r);
      lineAE.set(state.A, g.E);
      lineBF.set(state.B, g.F);
      lineEP.set(g.E, state.P);
      lineFP.set(g.F, state.P);
      arcAPE.set(state.A, state.P, g.E, 15);
      arcBPF.set(state.B, state.P, g.F, 19);
      arcEWF.set(g.E, g.W, g.F, 16);
      arcAQB.set(state.A, state.Q, state.B, 14);
      dotE.set(g.E); dotF.set(g.F); dotW.set(g.W);
      labelE.set(g.E, "E", 6, -7);
      labelF.set(g.F, "F", 6, 17);
      labelW.set(g.W, "W", 7, -7);
    }
    for (const c of [circleE, circleF, circleEQF, circleABQ]) c.show(ok);
    for (const line of [lineAE, lineBF]) line.show(ok);
    const hints = ok && hint1Chk.checked;
    lineEP.show(hints);
    lineFP.show(hints);
    arcAPE.show(hints);
    arcBPF.show(hints);
    arcEWF.show(hints);
    arcAQB.show(ok && hint2Chk.checked);
    dotE.show(ok); dotF.show(ok); dotW.show(ok);

    labelP.set(state.P, "P", -12, -7);
    labelQ.set(state.Q, "Q", -12, 17);
    labelA.set(state.A, "A", -12, 17);
    labelB.set(state.B, "B", 5, -7);
    for (const lab of [labelP, labelQ, labelA, labelB]) lab.show(namesChk.checked);
    for (const lab of [labelE, labelF, labelW]) lab.show(ok && namesChk.checked);

    hP.set(state.P); hQ.set(state.Q); hA.set(state.A); hB.set(state.B);

    if (!ok) {
      say("Move the points apart so the circles can be drawn again.");
    } else if (!g.throughP) {
      say("AB no longer goes through P. Drag A or B to put the chord back before checking the claim.");
    } else {
      say("E, Q, W, F lie on one circle and A, Q, W, B on another; both pass through Q and W. " +
        "Angle EPF is " + fmt(g.angleEPF) + "° and angle EWF is " + fmt(g.angleEWF) +
        "° (the same angle between the two lines, or its supplement).");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function setMode(next) {
    mode = next;
    chordBtn.setAttribute("aria-pressed", String(mode === "chord"));
    circlesBtn.setAttribute("aria-pressed", String(mode === "circles"));
    render();
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    setMode("chord");
  });
  chordBtn.addEventListener("click", () => setMode("chord"));
  circlesBtn.addEventListener("click", () => setMode("circles"));
  for (const chk of [namesChk, hint1Chk, hint2Chk]) chk.addEventListener("change", render);
  board.onTheme(() => render());

  render();
})();
