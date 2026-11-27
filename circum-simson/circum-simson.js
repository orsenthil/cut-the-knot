"use strict";

/*
 * The page for Circum Simson: drawing and input only; the theorem is in
 * circum-simson-core.js. The SVG holds a circle with four draggable points —
 * the triangle A, B, C and the point P. Its antipode Q is drawn for us. From
 * P and Q, perpendiculars drop onto the sides; their feet lie on two Simson
 * lines that cross at right angles, and the crossing point M runs around the
 * nine-point circle as P is dragged.
 */

(function () {
  const Core = CircumSimsonCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const perpsBox = document.getElementById("perpsBox");
  const simsonsBox = document.getElementById("simsonsBox");
  const midpointsBox = document.getElementById("midpointsBox");
  const anglesBox = document.getElementById("anglesBox");
  const traceBox = document.getElementById("traceBox");
  const clearBtn = document.getElementById("clearBtn");
  const newBtn = document.getElementById("newBtn");
  const MAX_TRACE = 160;

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");
  let state = Core.start();

  /* Layers, in paint order. Handles live last so a redraw keeps their focus. */
  const auxLayer = board.layer("aux");
  const circlesLayer = board.layer("circles");
  const sidesLayer = board.layer("sides");
  const perpsLayer = board.layer("perps");
  const simsonsLayer = board.layer("simsons");
  const traceLayer = board.layer("trace");
  const marksLayer = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const circumcircle = board.circle(state.circle, state.circle.r, "circum-circle", circlesLayer);
  const nineCircle = board.circle(state.circle, 1, "nine-circle", circlesLayer);
  const auxCircles = [0, 1, 2].map(() => board.circle(state.circle, 1, "aux-circle", auxLayer));
  const auxChords = [0, 1, 2].map(() => board.segment(state.A, state.B, "aux-chord", auxLayer));
  const sides = [
    board.segment(state.A, state.B, "tri-side", sidesLayer),
    board.segment(state.B, state.C, "tri-side", sidesLayer),
    board.segment(state.C, state.A, "tri-side", sidesLayer),
  ];
  const medial = [
    board.segment(state.A, state.B, "medial", sidesLayer),
    board.segment(state.B, state.C, "medial", sidesLayer),
    board.segment(state.C, state.A, "medial", sidesLayer),
  ];
  const perpP = [0, 1, 2].map(() => board.segment(state.P, state.A, "perp-p", perpsLayer));
  const perpQ = [0, 1, 2].map(() => board.segment(state.P, state.A, "perp-q", perpsLayer));
  const footDotsP = [0, 1, 2].map(() => board.point(state.A, "foot-dot", 4, marksLayer));
  const footDotsQ = [0, 1, 2].map(() => board.point(state.A, "foot-dot q", 3.5, marksLayer));
  const rightMarks = [0, 1, 2].map(() => board.rightAngle(state.A, state.B, state.C, 7, "right-mark", marksLayer));
  const angleMarks = [0, 1].map(() => board.angleArc(state.A, state.B, state.C, 13, "angle-arc", marksLayer));
  const simsonLines = [
    board.line(state.A, state.B, "simson p", simsonsLayer),
    board.line(state.A, state.B, "simson q", simsonsLayer),
  ];
  const mDot = board.point(state.A, "m-dot", 5, marksLayer);
  const midDots = [0, 1, 2].map(() => board.point(state.A, "mid-dot", 4, marksLayer));
  const centerDot = board.point(state.circle, "center-dot", 3.5, marksLayer);
  const qDot = board.point(state.A, "q-dot", 5, marksLayer);
  const traceDots = [];
  for (let i = 0; i < MAX_TRACE; i++) {
    traceDots.push(board.point(state.A, "trace-dot", 3.5, traceLayer));
    traceDots[i].show(false);
  }

  const labels = [
    board.label(state.A, "A", "glabel", -18, -9, labelsLayer),
    board.label(state.B, "B", "glabel", -18, 18, labelsLayer),
    board.label(state.C, "C", "glabel", 8, 8, labelsLayer),
    board.label(state.P, "P", "glabel point-label", 9, -10, labelsLayer),
    board.label(state.A, "Q", "glabel q-label", 9, -10, labelsLayer),
    board.label(state.A, "M", "glabel m-label", 8, -9, labelsLayer),
  ];
  const footLabels = [0, 1, 2].map(() => board.label(state.A, "P", "glabel foot-label", 6, -7, labelsLayer));
  const qFootLabels = [0, 1, 2].map(() => board.label(state.A, "Q", "glabel foot-label", 6, 14, labelsLayer));
  const midLabels = [0, 1, 2].map(() => board.label(state.A, "A'", "glabel mid-label", -20, -8, labelsLayer));
  const centerLabel = board.label(state.circle, "O", "glabel mid-label", -17, -9, labelsLayer);

  /**
   * The line under the picture. An illustration has no win or loss: `kind` is
   * never "win" or "lose" here. The record reads the position through
   * Track.state instead of through a result.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const d = Core.compute(state);
    const A = state.A, B = state.B, C = state.C, P = state.P;
    const feetP = [d.Pa, d.Pb, d.Pc];
    const feetQ = [d.Qa, d.Qb, d.Qc];
    const ends = [[B, C], [C, A], [A, B]];
    const finite = [d.M, ...feetP, ...feetQ, d.lineP[0], d.lineQ[0]]
      .every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    circumcircle.set(state.circle, state.circle.r);
    for (let i = 0; i < 3; i++) sides[i].set([A, B, C][i], [B, C, A][i]);

    /* Optional overlays, each made once and only updated on a redraw. */
    const nineOk = Number.isFinite(d.ninePoint.x) && d.ninePoint.r < board.viewBox.width;
    nineCircle.show(state.showLines || state.showMidpoints || state.showCircle);
    if (nineOk) nineCircle.set(d.ninePoint, d.ninePoint.r);
    else nineCircle.show(false);

    for (let i = 0; i < 3; i++) {
      const circ = d.auxCircles[i];
      const ok = state.showAngles && Number.isFinite(circ.x) && circ.r < board.viewBox.width;
      auxCircles[i].show(ok);
      if (ok) auxCircles[i].set(circ, circ.r);
    }
    const chords = [[P, C], [C, d.Q], [d.Q, B]];
    for (let i = 0; i < 3; i++) {
      auxChords[i].show(state.showAngles);
      if (state.showAngles) auxChords[i].set(chords[i][0], chords[i][1]);
    }

    for (let i = 0; i < 3; i++) {
      medial[i].show(state.showMidpoints);
      if (state.showMidpoints) medial[i].set([d.Am, d.Bm, d.Cm][i], [d.Bm, d.Cm, d.Am][i]);
      const perpOk = state.showPerps && finite;
      perpP[i].show(perpOk);
      perpQ[i].show(perpOk);
      footDotsP[i].show(perpOk);
      footDotsQ[i].show(perpOk);
      rightMarks[i].show(perpOk);
      if (perpOk) {
        perpP[i].set(P, feetP[i]);
        perpQ[i].set(d.Q, feetQ[i]);
        footDotsP[i].set(feetP[i]);
        footDotsQ[i].set(feetQ[i]);
        rightMarks[i].set(feetP[i], P, ends[i][0], 7);
      }
    }
    angleMarks[0].show(state.showAngles && finite);
    angleMarks[1].show(state.showAngles && finite);
    if (state.showAngles && finite) {
      angleMarks[0].set(d.Pa, P, d.Pb, 13);
      angleMarks[1].set(d.Qa, d.Q, d.Qb, 13);
    }

    for (let i = 0; i < 2; i++) {
      simsonLines[i].show(state.showLines && finite);
      if (state.showLines && finite) {
        const ends = i === 0 ? d.lineP : d.lineQ;
        simsonLines[i].set(ends[0], ends[1]);
      }
    }
    mDot.show(state.showLines && finite);
    if (state.showLines && finite) mDot.set(d.M);

    qDot.show(finite);
    if (finite) qDot.set(d.Q);
    for (let i = 0; i < 3; i++) {
      midDots[i].show(state.showMidpoints && finite);
      if (state.showMidpoints && finite) midDots[i].set([d.Am, d.Bm, d.Cm][i]);
    }
    centerDot.show(state.showMidpoints);
    if (state.showMidpoints) centerDot.set(state.circle);

    for (let i = 0; i < MAX_TRACE; i++) {
      const p = state.trace[i];
      const on = Boolean(p && Number.isFinite(p.x) && state.showCircle);
      traceDots[i].show(on);
      if (on) traceDots[i].set(p);
    }

    labels[0].set(A); labels[1].set(B); labels[2].set(C);
    labels[3].set(P); labels[4].set(d.Q); labels[5].set(d.M);
    for (let i = 0; i < 5; i++) labels[i].show(state.showNames && (i !== 4 || finite));
    labels[5].show(state.showNames && state.showLines && finite);
    for (let i = 0; i < 3; i++) {
      footLabels[i].set(feetP[i]);
      qFootLabels[i].set(feetQ[i]);
      footLabels[i].show(state.showNames && state.showPerps && finite);
      qFootLabels[i].show(state.showNames && state.showPerps && finite);
      const mid = [d.Am, d.Bm, d.Cm][i];
      midLabels[i].set(mid);
      midLabels[i].show(state.showNames && state.showMidpoints && finite);
    }
    centerLabel.set(state.circle);
    centerLabel.show(state.showNames && state.showMidpoints);

    hA.set(A); hB.set(B); hC.set(C); hP.set(P);

    const angle = Core.simsonAngle(state) * 180 / Math.PI;
    if (!finite) {
      say("Move the points apart so the two Simson lines meet.", null);
    } else {
      let line = `The two lines cross at ${fmt(angle)}°; M is ${fmt(Core.ninePointError(state) * state.circle.r)} units from the nine-point circle.`;
      if (state.showCircle) line += " Drag a blue point to trace that circle.";
      say(line, null);
    }

    traceBox.disabled = !state.showLines;
    clearBtn.disabled = state.trace.length === 0;

    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, p);
    if (state.showCircle) state = Core.withTrace(state);
    // The applet keeps only a short trail; cap ours so a long drag stays light.
    if (state.trace.length > MAX_TRACE) {
      state = { ...state, trace: state.trace.slice(-MAX_TRACE) };
    }
    render();
  }

  const handleOptions = (name) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer,
    clamp: (p) => Core.projectOnCircle(p, state.circle),
    label: `Point ${name} on the circumcircle. Drag it, or focus it and use the arrow keys to slide it round`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint(name, p),
  });
  const hA = board.handle("A", state.A, handleOptions("A"));
  const hB = board.handle("B", state.B, handleOptions("B"));
  const hC = board.handle("C", state.C, handleOptions("C"));
  const hP = board.handle("P", state.P, handleOptions("P"));

  /* The applet starts a fresh trace whenever a new drag is pressed. */
  board.root.addEventListener("pointerdown", (e) => {
    if (e.target && e.target.classList && e.target.classList.contains("geom-handle")) {
      state = Core.clearTrace(state);
      render();
    }
  });

  function syncControls() {
    namesBox.checked = state.showNames;
    perpsBox.checked = state.showPerps;
    simsonsBox.checked = state.showLines;
    midpointsBox.checked = state.showMidpoints;
    anglesBox.checked = state.showAngles;
    traceBox.checked = state.showCircle;
    traceBox.disabled = !state.showLines;
  }

  function newGame() {
    state = Core.start({
      showNames: state.showNames,
      showPerps: state.showPerps,
      showLines: state.showLines,
      showMidpoints: state.showMidpoints,
      showAngles: state.showAngles,
      showCircle: state.showLines && state.showCircle,
    });
    syncControls();
    render();
    hP.node.focus();
  }

  const optionId = {
    showNames: namesBox, showPerps: perpsBox, showLines: simsonsBox,
    showMidpoints: midpointsBox, showAngles: anglesBox, showCircle: traceBox,
  };
  for (const [name, input] of Object.entries(optionId)) {
    input.addEventListener("change", () => {
      let value = input.checked;
      // The applet greys out "Trace circle" until the Simson lines are shown.
      if (name === "showCircle" && value && !state.showLines) value = false;
      if (name === "showLines" && !value) state = Core.withOption(state, "showCircle", false);
      state = Core.withOption(state, name, value);
      syncControls();
      render();
    });
  }
  clearBtn.addEventListener("click", () => {
    state = Core.clearTrace(state);
    render();
  });
  newBtn.addEventListener("click", newGame);
  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "r" || e.key === "R") newGame();
  });

  board.onTheme(render);
  syncControls();
  render();
})();
