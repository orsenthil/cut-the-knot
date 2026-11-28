"use strict";

/*
 * Haruki — the drawing and input only; every construction is in
 * haruki-core.js.  Two chords AB and CD and a point P sit on one circle.
 * Q and R are where PC and PD cut AB; the two extra circles through P,Q,D
 * and P,R,C meet AB again at E and F.  Drag any of the five named points,
 * or focus one and use the arrow keys; the checkboxes reproduce the applet's
 * names / statement / hint switches.
 */

(function () {
  const Core = HarukiCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const statementBox = document.getElementById("statement");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Back to front: circles, chords, helper rays, the equal lengths, dots,
   * names, then the draggable points which keep keyboard focus. */
  const base = board.layer("base");
  const chords = board.layer("chords");
  const rays = board.layer("rays");
  const lengths = board.layer("lengths");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const handlesLayer = board.layer("handles");

  const mainCircle = board.circle(state.A, 1, "main-circle", base);
  const circleE = board.circle(state.A, 1, "aux-circle aux-e", base);
  const circleF = board.circle(state.A, 1, "aux-circle aux-f", base);
  const chordAB = board.line(state.A, state.B, "chord", chords);
  const chordCD = board.line(state.C, state.D, "chord", chords);
  const rayPC = board.segment(state.P, state.C, "ray", rays);
  const rayPD = board.segment(state.P, state.D, "ray", rays);
  const sideED = board.segment(state.E || state.A, state.D, "aux-side", rays);
  const sideFC = board.segment(state.F || state.A, state.C, "aux-side", rays);
  const segBE = board.segment(state.B, state.A, "equal-length", lengths);
  const segAF = board.segment(state.A, state.B, "equal-length", lengths);
  const dotQ = board.point(state.A, "derived-dot", 4, dots);
  const dotR = board.point(state.A, "derived-dot", 4, dots);
  const dotE = board.point(state.A, "result-dot", 5, dots);
  const dotF = board.point(state.A, "result-dot", 5, dots);
  const hintMarks = [
    board.angleArc(state.A, state.B, state.C, 20, "hint-arc", dots),
    board.angleArc(state.C, state.D, state.A, 20, "hint-arc", dots),
    board.angleArc(state.D, state.B, state.A, 20, "hint-arc", dots),
  ];

  const labels = {};
  for (const key of ["A", "B", "C", "D", "P", "E", "F", "Q", "R"]) {
    labels[key] = board.label(state.A, key, "point-label",
      key === "E" || key === "F" ? -12 : 8, key === "P" ? -12 : -10, names);
  }

  const common = {
    step: 4, shift: 12, r: 10, layer: handlesLayer,
    clamp: (p) => Core.clamp(p),
  };
  const handles = {};
  for (const key of ["A", "B", "C", "D", "P"]) {
    handles[key] = board.handle(key, state[key], Object.assign({}, common, {
      label: `Point ${key} — drag it or use the arrow keys`,
      describe: (p) => `Point ${key} at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, name) => {
        const next = Core.move(state, name, p);
        if (next !== state) {
          state = next;
          render();
        }
      },
    }));
  }

  /**
   * Shows a line under the picture. `kind` is "done" once the player has
   * explored it (there is no win or loss here); those classes are how the
   * player's record learns that a play ended, so use them for that only.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of ["A", "B", "C", "D", "P"]) handles[key].set(state[key]);

    if (!g) {
      for (const obj of [mainCircle, circleE, circleF, chordAB, chordCD,
        rayPC, rayPD, sideED, sideFC, segBE, segAF]) obj.show(false);
      for (const obj of [dotQ, dotR, dotE, dotF]) obj.show(false);
      for (const mark of hintMarks) mark.show(false);
      for (const key of Object.keys(labels)) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    for (const obj of [mainCircle, circleE, circleF, chordAB, chordCD,
      rayPC, rayPD, sideED, sideFC, segBE, segAF]) obj.show(true);
    const main = Core.circle(state.A, state.B, state.C);
    if (main) mainCircle.set(main.c, main.r);
    circleE.set(g.circleE.c, g.circleE.r);
    circleF.set(g.circleF.c, g.circleF.r);
    chordAB.set(g.A, g.B);
    chordCD.set(g.C, g.D);
    rayPC.set(g.P, g.C);
    rayPD.set(g.P, g.D);
    sideED.set(g.E, g.D);
    sideFC.set(g.F, g.C);
    segBE.set(g.B, g.E);
    segAF.set(g.A, g.F);

    dotQ.set(g.Q);
    dotR.set(g.R);
    dotE.set(g.E);
    dotF.set(g.F);
    for (const obj of [dotQ, dotR, dotE, dotF]) obj.show(true);

    // The hint marks the angles at F, P and E; they are equal or supplement.
    hintMarks[0].set(g.F, g.A, g.C, 20);
    hintMarks[1].set(g.P, g.C, g.D, 20);
    hintMarks[2].set(g.E, g.D, g.B, 20);
    for (const mark of hintMarks) mark.show(state.options.hint);

    for (const key of Object.keys(labels)) {
      labels[key].set(g[key]);
      labels[key].show(state.options.names);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, P: g.P,
        Q: g.Q, R: g.R, E: g.E, F: g.F,
        circle: main, options: state.options,
        BE: g.BE, AF: g.AF, ratio: g.ratio,
      });
    }
  }

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("names", namesBox);
  toggle("statement", statementBox);
  toggle("hint", hintBox);
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours come from CSS classes, so a theme flip needs no recompute;
  // redraw anyway for the shared hook and to keep the status in step.
  board.onTheme(render);
  render();
})();
