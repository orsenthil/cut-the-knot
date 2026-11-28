"use strict";

/*
 * The page for In And Circumcenter D: drawing and input only; all the geometry
 * is in in-and-circumcenter-d-core.js. A 450 by 450 SVG board holds triangle
 * ABC, its incircle and circumcircle, the circle centred at I through O, the
 * points D and E on the two sides, and the parallel chords ON and OM. Drag A,
 * B or C with a pointer, or focus a handle and use the arrow keys (Shift for a
 * bigger step). The four checkboxes are the applet's Show names, statement,
 * premise and hint; Reset restores the opening triangle.
 */

(function () {
  const Core = InAndCircumcenterDCore;
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const statementBox = document.getElementById("statementBox");
  const premiseBox = document.getElementById("premiseBox");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const fills = board.layer("fills");
  const shapes = board.layer("shapes");
  const premise = board.layer("premise");
  const angles = board.layer("angles");
  const dotLayer = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start();

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those classes are how the player's record learns that a play has ended.
   * This is an illustration, so no kind is ever used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Build every element once; redrawing only changes its attributes, so a
  // focused handle keeps its focus when a keyboard arrow moves a point.
  const incircle = board.circle(state.A, 1, "incircle", circles);
  const circumcircle = board.circle(state.A, 1, "circumcircle", circles);
  const ioCircle = board.circle(state.A, 1, "io-circle", circles);

  const hintI = board.line(state.A, state.A, "hint-line", guides);
  const hintO = board.line(state.A, state.A, "hint-line", guides);
  const hintN = board.line(state.A, state.A, "hint-line", guides);
  const hintM = board.line(state.A, state.A, "hint-line", guides);

  const fillCDE = board.polygon([state.A, state.A, state.A], "tri-fill", fills);
  const fillONM = board.polygon([state.A, state.A, state.A], "tri-fill-alt", fills);

  const edgeAB = board.segment(state.A, state.B, "tri-edge", shapes);
  const edgeBC = board.segment(state.B, state.C, "tri-edge", shapes);
  const edgeCA = board.segment(state.C, state.A, "tri-edge", shapes);
  const segDE = board.segment(state.A, state.B, "result-line", shapes);
  const segON = board.segment(state.A, state.B, "chord", shapes);
  const segOM = board.segment(state.A, state.B, "chord", shapes);
  const segMN = board.segment(state.A, state.B, "chord", shapes);

  const preAB = board.segment(state.A, state.B, "premise-line", premise);
  const preAE = board.segment(state.A, state.A, "premise-line", premise);
  const preBD = board.segment(state.B, state.B, "premise-line", premise);

  const arcC = board.angleArc(state.A, state.B, state.C, 26, "angle-arc", angles);
  const arcO = board.angleArc(state.A, state.B, state.C, 26, "angle-arc", angles);

  const dots = {
    D: board.point(state.A, "aux-dot", 4.5, dotLayer),
    E: board.point(state.A, "aux-dot", 4.5, dotLayer),
    I: board.point(state.A, "center-dot incenter", 4, dotLayer),
    O: board.point(state.A, "center-dot circumcenter", 4, dotLayer),
    M: board.point(state.A, "chord-dot", 4.5, dotLayer),
    N: board.point(state.A, "chord-dot", 4.5, dotLayer),
    Ip: board.point(state.A, "hint-dot", 3.5, dotLayer),
    Op: board.point(state.A, "hint-dot", 3.5, dotLayer),
    L: board.point(state.A, "hint-dot", 3.5, dotLayer),
  };

  const text = {};
  for (const name of ["A", "B", "C", "D", "E", "I", "O", "M", "N", "Ip", "Op", "L"]) {
    text[name] = board.label(state.A, name, "point-label", 8, -8, labels);
  }
  const labelAt = {
    A: [-13, 17], B: [8, 17], C: [-14, -8],
    D: [7, -8], E: [-15, -8], I: [7, -8], O: [7, 17],
    M: [8, -7], N: [-16, -7], Ip: [-16, 15], Op: [7, -8], L: [-16, 15],
  };

  const handles = {};
  for (const name of ["A", "B", "C"]) {
    handles[name] = board.handle(name, state[name], {
      r: 9,
      step: 2,
      shift: 10,
      cls: "geom-handle vertex-handle",
      label: "Point " + name + " of the triangle. Drag it, or focus it and use the arrow keys.",
      clamp: (q) => Core.clampPoint(state, name, q),
      onMove: (p) => {
        state = Core.withPoint(state, name, p);
        render();
      },
      layer: handlesLayer,
    });
  }

  function render() {
    const f = Core.geometry(state);
    const all = [
      incircle, circumcircle, ioCircle, hintI, hintO, hintN, hintM,
      fillCDE, fillONM, edgeAB, edgeBC, edgeCA, segDE, segON, segOM, segMN,
      preAB, preAE, preBD, arcC, arcO,
    ];
    for (const shape of all) shape.show(f.valid);
    for (const name in dots) dots[name].show(f.valid);
    if (!f.valid) {
      for (const name in text) text[name].show(false);
      say(Core.describe(f));
      if (window.Track) window.Track.state(state);
      return;
    }

    incircle.set(f.I, f.rIn);
    circumcircle.set(f.O, f.rCirc);
    ioCircle.set(f.I, f.io);

    hintI.set(f.I, f.Ip);
    hintO.set(f.O, f.Op);
    hintN.set(f.O, f.N);
    hintM.set(f.O, f.M);

    fillCDE.set([f.C, f.D, f.E]);
    fillONM.set([f.O, f.N, f.M]);

    edgeAB.set(f.A, f.B);
    edgeBC.set(f.B, f.C);
    edgeCA.set(f.C, f.A);
    segDE.set(f.D, f.E);
    segON.set(f.O, f.N);
    segOM.set(f.O, f.M);
    segMN.set(f.N, f.M);

    preAB.set(f.A, f.B);
    preAE.set(f.A, f.E);
    preBD.set(f.B, f.D);

    arcC.set(f.C, f.D, f.E, 26);
    arcO.set(f.O, f.N, f.M, 26);

    const at = {
      A: f.A, B: f.B, C: f.C,
      D: f.D, E: f.E, I: f.I, O: f.O, M: f.M, N: f.N,
      Ip: f.Ip, Op: f.Op, L: f.L || f.I,
    };
    for (const name in dots) dots[name].set(at[name]);

    for (const name in text) {
      const hintOnly = name === "Ip" || name === "Op" || name === "L";
      text[name].show(state.showNames && (!hintOnly || state.showHint))
        .set(at[name], name, labelAt[name][0], labelAt[name][1]);
    }

    for (const name of ["A", "B", "C"]) handles[name].set(state[name]);

    preAB.show(state.showPremise);
    preAE.show(state.showPremise);
    preBD.show(state.showPremise);
    hintI.show(state.showHint);
    hintO.show(state.showHint);
    hintN.show(state.showHint);
    hintM.show(state.showHint);
    dots.Ip.show(state.showHint);
    dots.Op.show(state.showHint);
    dots.L.show(state.showHint && Boolean(f.L));
    arcC.show(state.showStatement);
    arcO.show(state.showStatement);
    fillCDE.show(state.showStatement);
    fillONM.show(state.showStatement);

    namesBox.checked = state.showNames;
    statementBox.checked = state.showStatement;
    premiseBox.checked = state.showPremise;
    hintBox.checked = state.showHint;

    say(Core.describe(f));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  for (const [box, key] of [
    [namesBox, "showNames"], [statementBox, "showStatement"],
    [premiseBox, "showPremise"], [hintBox, "showHint"],
  ]) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, key, box.checked);
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(render);
  render();
})();
