"use strict";

/*
 * Given Common Chord — drawing and input only. The construction is in
 * given-common-chord-core.js. The board holds six handles: A and B slide along
 * the top row to set the length a, C1/C3 are the two circle centres and
 * R1/R3 are rim points that set their radii. Dragging a circle itself moves its
 * centre and rim together, as in the applet. The two candidate lines through
 * P, the auxiliary circles for the hint and the feet under O1 and O2 are all
 * rebuilt from the core on every redraw, so keyboard focus on a handle survives
 * a change to any other part of the picture.
 */

(function () {
  const Core = GivenCommonChordCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const hintBox = document.getElementById("hint");
  const namesBox = document.getElementById("names");
  const resetBtn = document.getElementById("resetBtn");
  const lineRadios = Array.from(document.querySelectorAll('input[name="whichLine"]'));

  let state = Core.start({});

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const chords = board.layer("chords");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const lenBar = board.segment(state.A, state.B, "len-bar", guides);
  const lenLabel = board.label(state.A, "a", "point-label", 0, -14, labels);
  const auxOO = board.circle(state.C1, 1, "aux-circle", guides);
  const auxL = board.circle(state.C1, 1, "aux-circle-l", guides);
  const diameter = board.segment(state.C1, state.C3, "diameter", guides);
  const feetBar = board.segment(state.C1, state.C3, "feet-bar", guides);

  const circle1 = board.circle(state.C1, 1, "circle-one", shapes);
  const circle2 = board.circle(state.C3, 1, "circle-two", shapes);
  /* Transparent hit areas: clicking inside a circle drags it as a whole. */
  const hit1 = board.circle(state.C1, 1, "circle-hit", shapes);
  const hit2 = board.circle(state.C3, 1, "circle-hit", shapes);

  const chord0 = board.line(state.C1, state.C1, "chord-one", chords);
  const chord1 = board.line(state.C3, state.C3, "chord-two", chords);

  const dots = {};
  for (const key of ["P", "Q", "M0", "M1", "N0", "N1", "T0", "T1", "C0", "C1"]) {
    dots[key] = board.point(state.C1, key.startsWith("T") || key.startsWith("C")
      ? "hint-dot" : "cut-dot", key.startsWith("T") || key.startsWith("C") ? 4 : 5, marks);
  }
  const names = {};
  const offsets = {
    A: [-6, -16], B: [-6, -16], C1: [-26, -12], R1: [-30, -12],
    C3: [-26, -12], R3: [8, -12], P: [-24, -12], Q: [-24, 20],
    M0: [-30, -10], M1: [8, -8], T0: [8, -8], T1: [8, 18],
  };
  for (const key of Object.keys(offsets)) {
    names[key] = board.label(state.C1, key, "point-label",
      offsets[key][0], offsets[key][1], labels);
  }

  const clampPoint = (p, name) => (name === "A" || name === "B")
    ? Core.clampToBoard({ x: p.x, y: Core.ROW }) : Core.clampToBoard(p);
  const handles = {};
  for (const key of Core.HANDLES) {
    handles[key] = board.handle(key, state[key], {
      r: 13, step: 2, shift: 10, layer: top, clamp: clampPoint,
      label: `${key === "A" || key === "B"
        ? `End ${key} of the length segment` : `Point ${key}`}. Drag it, or focus it and use the arrow keys.`,
      onMove: (p, name) => {
        state = Core.movePoint(state, name, p);
        render();
      },
    });
  }

  /* Whole-circle dragging, kept from the applet's MoveableCircle. */
  let circleDrag = null;
  function startCircleDrag(which, node) {
    return (e) => {
      if (circleDrag) return;
      circleDrag = { which: which, last: board.toLocal(e.clientX, e.clientY) };
      if (svg.setPointerCapture) svg.setPointerCapture(e.pointerId);
      node.focus && node.focus();
      e.preventDefault();
    };
  }
  const svg = board.root;
  hit1.node.addEventListener("pointerdown", startCircleDrag(1, hit1.node));
  hit2.node.addEventListener("pointerdown", startCircleDrag(2, hit2.node));
  svg.addEventListener("pointermove", (e) => {
    if (!circleDrag) return;
    const p = board.toLocal(e.clientX, e.clientY);
    state = Core.translateCircle(state, circleDrag.which,
      p.x - circleDrag.last.x, p.y - circleDrag.last.y);
    circleDrag.last = p;
    render();
    e.preventDefault();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    svg.addEventListener(type, () => { circleDrag = null; });
  }

  /** Announcements on the shared status line; no win or loss in a drawing. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.compute(state);
    for (const key of Core.HANDLES) handles[key].set(state[key]);

    lenBar.set(state.A, state.B);
    lenLabel.set({ x: (state.A.x + state.B.x) / 2, y: state.A.y }, "a", 0, -16);

    circle1.set(state.C1, g.r1);
    circle2.set(state.C3, g.r2);
    hit1.set(state.C1, g.r1);
    hit2.set(state.C3, g.r2);

    chord0.show(!g.noSolution && g.solutionCount > 0 && g.whichLine !== 1)
      .set(g.lines[0] ? g.lines[0].p : state.C1,
        g.lines[0] ? g.lines[0].q : state.C1);
    chord1.show(!g.noSolution && g.solutionCount > 0 && g.whichLine !== 0)
      .set(g.lines[1] ? g.lines[1].p : state.C3,
        g.lines[1] ? g.lines[1].q : state.C3);

    auxOO.show(state.showHint && !g.noDraw && !!g.cOO)
      .set(g.cOO || state.C1, g.cOO ? g.cOO.r : 1);
    auxL.show(state.showHint && !g.noDraw && !!g.cL)
      .set(g.cL || state.C1, g.cL ? g.cL.r : 1);
    diameter.show(state.showHint && !g.noDraw).set(state.C1, state.C3);
    const feetOK = !!(g.feet[0] && g.feet[1]);
    feetBar.show(state.showHint && feetOK)
      .set(feetOK ? g.feet[0] : state.C1, feetOK ? g.feet[1] : state.C3);

    const line0Shown = !g.noSolution && g.whichLine !== 1;
    const line1Shown = !g.noSolution && g.whichLine !== 0;
    dots.P.show(!g.noDraw && !!g.P).set(g.P || state.C1);
    dots.Q.show(!g.noDraw && !!g.Q).set(g.Q || state.C1);
    dots.M0.show(line0Shown && !!g.M[0]).set(g.M[0] || state.C1);
    dots.M1.show(line0Shown && !!g.M[1]).set(g.M[1] || state.C1);
    dots.N0.show(line1Shown && !!g.N[0]).set(g.N[0] || state.C3);
    dots.N1.show(line1Shown && !!g.N[1]).set(g.N[1] || state.C3);
    dots.T0.show(state.showHint && !!g.T[0]).set(g.T[0] || state.C1);
    dots.T1.show(state.showHint && g.solutionCount === 2 && !!g.T[1])
      .set(g.T[1] || state.C1);
    dots.C0.show(state.showHint && feetOK).set(g.feet[0] || state.C1);
    dots.C1.show(state.showHint && feetOK).set(g.feet[1] || state.C3);

    for (const key of Core.HANDLES) names[key].set(state[key]);
    names.P.show(state.showNames && !!g.P).set(g.P || state.C1);
    names.Q.show(state.showNames && !!g.Q).set(g.Q || state.C1);
    names.M0.show(state.showNames && line0Shown && !!g.M[0]).set(g.M[0] || state.C1);
    names.M1.show(state.showNames && line0Shown && !!g.M[1]).set(g.M[1] || state.C1);
    names.T0.show(state.showNames && state.showHint && !!g.T[0]).set(g.T[0] || state.C1);
    names.T1.show(state.showNames && state.showHint && g.solutionCount === 2 && !!g.T[1])
      .set(g.T[1] || state.C1);

    say(Core.describe(state), state.explored ? "done" : null);

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C1: state.C1, R1: state.R1,
        C3: state.C3, R3: state.R3, L: state.L, whichLine: state.whichLine,
        showHint: state.showHint, showNames: state.showNames,
        P: g.P, Q: g.Q, T: g.T, M: g.M, N: g.N,
        chord1: g.chord1, chord2: g.chord2,
        solutionCount: g.solutionCount, noSolution: g.noSolution,
      });
    }
  }

  for (const radio of lineRadios) {
    radio.checked = Number(radio.value) === state.whichLine;
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state = Core.setWhichLine(state, Number(radio.value));
      render();
    });
  }
  hintBox.checked = state.showHint;
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "showHint", hintBox.checked);
    render();
  });
  namesBox.checked = state.showNames;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "showNames", namesBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    lineRadios.forEach((r) => { r.checked = Number(r.value) === state.whichLine; });
    hintBox.checked = state.showHint;
    namesBox.checked = state.showNames;
    render();
  });

  // SVG colours are classes, so a theme flip needs no recompute; redraw anyway
  // to keep the hook that the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
