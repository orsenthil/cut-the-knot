"use strict";

/*
 * The page for the Broken Chord theorem. Drawing and input only; the geometry
 * is in broken-chord-core.js. The SVG shows the circumcircle of ABC, the
 * broken path A-C-B, the foot M of the perpendicular from the arc midpoint P
 * to the longer side, and (with the hint on) the auxiliary circle through
 * A, B and F that makes the proof visible. Drag A, B or C to explore.
 */
(function () {
  const Core = BrokenChordCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  let state = Core.start();
  let checked = false;

  const shapes = board.layer("shapes");
  const proof = board.layer("proof");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const seed = Core.measurements(state);
  const circum = board.circle(seed.circle.c, seed.circle.r, "circum", shapes);
  const sideAC = board.segment(state.A, state.C, "triangle-side", shapes);
  const sideBC = board.segment(state.B, state.C, "triangle-side", shapes);
  const longPart = board.segment(seed.K, seed.M, "long-part", shapes);
  const restOne = board.segment(seed.M, seed.C, "rest-part", shapes);
  const restTwo = board.segment(seed.C, seed.L, "rest-part", shapes);
  const perpendicular = board.segment(seed.P, seed.M, "perp", shapes);
  const specialDots = [
    board.point(seed.M, "special-dot", 4, marks),
    board.point(seed.P, "special-dot", 4, marks),
  ];

  /* The proof of the page: extend the long side to F, draw the circle ABF
     with centre P, and mark the right angle and the doubled angle. */
  const auxCircle = board.circle(seed.circleF.c, seed.circleF.r, "proof-circle", proof);
  const proofLines = [
    board.line(seed.K, seed.P, "proof-line", proof),
    board.line(seed.L, seed.P, "proof-line", proof),
    board.line(seed.K, seed.L, "proof-line", proof),
    board.line(seed.L, seed.F, "proof-line", proof),
    board.line(seed.C, seed.F, "extension-line", proof),
  ];
  const rightMark = board.rightAngle(seed.M, seed.K, seed.P, 11, "right-mark", proof);
  const arcAtP = board.angleArc(seed.P, seed.A, seed.B, 26, "angle-arc", proof);
  const arcAtF = board.angleArc(seed.F, seed.A, seed.B, 20, "angle-arc arc-small", proof);

  const baseLabels = [
    board.label(seed.A, "A", "glabel", -18, 22, marks),
    board.label(seed.B, "B", "glabel", 6, 22, marks),
    board.label(seed.C, "C", "glabel", 6, -8, marks),
    board.label(seed.P, "P", "glabel proof-label", -16, -10, marks),
    board.label(seed.M, "M", "glabel proof-label", 6, -10, marks),
    board.label(seed.F, "F", "glabel proof-label", 7, 0, marks),
  ];

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  /**
   * Shows a line under the picture. "done" marks an explored claim, never a
   * win or a loss; that class is how the player's record sees a finished play.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showDrawing(on) {
    [circum, sideAC, sideBC, longPart, restOne, restTwo, perpendicular]
      .forEach((s) => s.show(on));
    specialDots.forEach((d) => d.show(on));
  }

  function render() {
    const m = Core.measurements(state);
    if (!m) {
      showDrawing(false);
      auxCircle.show(false);
      proofLines.forEach((l) => l.show(false));
      rightMark.show(false);
      arcAtP.show(false);
      arcAtF.show(false);
      baseLabels.forEach((l) => l.show(false));
      say("Spread A, B and C out so the three points make a triangle.", null);
      if (window.Track) window.Track.state(state);
      return;
    }

    showDrawing(true);
    circum.set(m.circle.c, m.circle.r);
    sideAC.set(m.A, m.C);
    sideBC.set(m.B, m.C);
    longPart.set(m.K, m.M);
    restOne.set(m.M, m.C);
    restTwo.set(m.C, m.L);
    perpendicular.set(m.P, m.M);
    specialDots[0].set(m.M);
    specialDots[1].set(m.P);

    baseLabels[0].set(m.A);
    baseLabels[1].set(m.B);
    baseLabels[2].set(m.C);
    baseLabels[3].set(m.P);
    baseLabels[4].set(m.M);
    baseLabels[5].set(m.F, "F", 7, 0);
    baseLabels.forEach((l) => l.show(state.showNames));

    const showProof = state.showHint;
    auxCircle.set(m.circleF.c, m.circleF.r);
    auxCircle.show(showProof);
    proofLines[0].set(m.K, m.P);
    proofLines[1].set(m.L, m.P);
    proofLines[2].set(m.K, m.L);
    proofLines[3].set(m.L, m.F);
    proofLines[4].set(m.C, m.F);
    proofLines.forEach((l) => l.show(showProof));
    rightMark.set(m.M, m.K, m.P, 11);
    rightMark.show(showProof);
    arcAtP.set(m.P, m.A, m.B, 26);
    arcAtF.set(m.F, m.A, m.B, 20);
    arcAtP.show(showProof);
    arcAtF.show(showProof);

    handles.forEach((h) => h.set(state[h.name]));

    const longName = m.AC > m.BC ? "A" : "B";
    const shortName = m.AC > m.BC ? "BC" : "AC";
    const cl = Core.claims(state);
    const allTrue = Object.keys(cl).every((key) => cl[key]);
    if (checked && allTrue) {
      say(`${longName}M = ${fmt(m.AM)} = MC (${fmt(m.MC)}) + ${shortName} (${fmt(m.shortSide)}): the broken line is cut in half.`, "done");
    } else if (showProof) {
      say("The dotted circle through A, B and F has P at its centre. Press Check the claim to read the result.", null);
    } else {
      say(`AC = ${fmt(m.AC)}, BC = ${fmt(m.BC)}. The line from P meets the longer side at M. Drag A, B or C, or press Check the claim.`, null);
    }
    if (window.Track) window.Track.state(state);
  }

  const handles = ["A", "B", "C"].map((name) => board.handle(name, state[name], {
    r: 8, step: 2, shift: 10, layer: handlesLayer,
    label: `Point ${name} of the triangle. Drag it, or focus it and use the arrow keys to move it`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => {
      checked = false;
      state = Core.withPoint(state, name, p);
      render();
    },
  }));

  function reset() {
    state = Core.start({ showNames: state.showNames, showHint: state.showHint });
    checked = false;
    render();
    handles[0].node.focus();
  }
  function toggleNames() {
    state = Core.withOption(state, "showNames", !state.showNames);
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    render();
  }
  function toggleHint() {
    state = Core.withOption(state, "showHint", !state.showHint);
    hintBtn.setAttribute("aria-pressed", String(state.showHint));
    hintBtn.textContent = state.showHint ? "Hide hint" : "Show hint";
    render();
  }
  function checkClaim() {
    checked = true;
    render();
  }

  resetBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", toggleNames);
  hintBtn.addEventListener("click", toggleHint);
  checkBtn.addEventListener("click", checkClaim);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    if (key === "n") toggleNames();
    if (key === "h") toggleHint();
    if (key === "c") checkClaim();
  });

  board.onTheme(render);
  render();
})();
