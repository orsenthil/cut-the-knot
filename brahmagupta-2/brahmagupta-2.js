"use strict";

/*
 * The page for Brahmagupta 2: drawing and input only; the geometry is in
 * brahmagupta-2-core.js. The board holds the four draggable corners A, B, C, D
 * on their circle, the quadrilateral, the four maltitudes (always drawn), and
 * the optional diagonals, hint, names and proof overlays of the applet's four
 * checkboxes. Show proof forces the other three overlays off, as it does in
 * the applet, and restores them when it is switched off again.
 */

(function () {
  const Core = Brahmagupta2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const diagonalsBtn = document.getElementById("diagonalsBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const proofBtn = document.getElementById("proofBtn");

  const fmt = (n) => (Number.isFinite(n) ? n.toFixed(4) : "—");

  let state = Core.start();
  let showDiagonals = false;
  let showNames = true;
  let showHint = false;
  let showProof = false;
  let saved = null;

  /* Painted back to front, so handles stay on top and keep their focus. */
  const shapes = board.layer("shapes");
  const diagonalLayer = board.layer("diagonals");
  const hintLayer = board.layer("hint");
  const maltitudeLayer = board.layer("maltitudes");
  const proofLayer = board.layer("proof");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const circumcircle = board.circle(Core.center(state), Core.radius(state), "circumcircle", shapes);
  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", shapes);

  const diagonals = [
    board.line(state.A, state.B, "diagonal", diagonalLayer),
    board.line(state.B, state.C, "diagonal", diagonalLayer),
  ];
  const hints = [
    board.line(state.A, state.B, "hint-line", hintLayer),
    board.line(state.B, state.C, "hint-line", hintLayer),
    board.line(state.A, state.B, "hint-line", hintLayer),
  ];
  const proofLines = [
    board.line(state.A, state.B, "proof-line", proofLayer),
    board.line(state.A, state.B, "proof-line", proofLayer),
    board.line(state.A, state.B, "proof-line", proofLayer),
    board.line(state.A, state.B, "proof-line", proofLayer),
    board.line(state.A, state.B, "proof-line", proofLayer),
    board.line(state.A, state.B, "proof-line", proofLayer),
  ];

  const maltitudes = [0, 1, 2, 3].map(() =>
    board.line(state.A, state.B, "maltitude", maltitudeLayer));
  const midDots = [0, 1, 2, 3].map(() =>
    board.point(state.A, "mid-dot", 3.5, marks));
  const footDots = [0, 1, 2, 3].map(() =>
    board.point(state.A, "foot-dot", 3.5, marks));
  const Tdot = board.point(state.A, "t-dot", 5.5, marks);
  const Kdot = board.point(state.A, "k-dot", 4.5, marks);
  const Odot = board.point(state.A, "o-dot", 4.5, marks);
  const rightMark = board.rightAngle(state.A, state.B, state.C, 8, "right-mark", marks);

  const vertexLabels = ["A", "B", "C", "D"].map((name) =>
    board.label(state[name], name, "glabel vertex-label", -12, -9, labelsLayer));
  const namedOffsets = {
    P: [-13, -7], Q: [-13, 16], R: [7, 16], S: [7, -7],
    E: [7, 14], F: [7, -7], G: [-13, -7], H: [-13, 15],
    T: [7, -8], K: [7, 15], O: [7, -8],
  };
  const pointLabels = {};
  for (const name of Object.keys(namedOffsets)) {
    const [dx, dy] = namedOffsets[name];
    pointLabels[name] = board.label(state.A, name, "glabel", dx, dy, labelsLayer);
  }

  /**
   * Shows a line under the picture. A demo has nothing to win or lose, so
   * "win" and "lose" are never used; "done" marks the proof view as explored.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const f = Core.figure(state);
    const cl = Core.claims(state);
    const names = showNames || showProof;
    const guides = showHint && !showProof;
    const proof = showProof;

    circumcircle.set(f.O, f.r);
    quad.set([state.A, state.B, state.C, state.D]);

    diagonals[0].set(state.A, state.C);
    diagonals[1].set(state.B, state.D);
    for (const line of diagonals) line.show(showDiagonals);

    hints[0].set(f.P, f.R);
    hints[1].set(f.Q, f.S);
    hints[2].set(f.O, f.T);
    for (const line of hints) line.show(guides);

    proofLines[0].set(f.P, f.R);
    proofLines[1].set(f.Q, f.S);
    proofLines[2].set(f.O, f.R);
    proofLines[3].set(f.O, f.T);
    proofLines[4].set(f.P, f.T);
    proofLines[5].set(f.O, f.E);
    for (const line of proofLines) line.show(proof);

    f.maltitudes.forEach((m, i) => maltitudes[i].set(m.through, m.foot));
    f.maltitudes.forEach((m, i) => {
      midDots[i].set(m.through);
      footDots[i].set(m.foot);
    });

    Tdot.set(f.T);
    Kdot.set(f.K).show(guides || proof);
    Odot.set(f.O).show(guides || proof);
    rightMark.set(f.E, f.P, state.D, 8).show(proof);

    for (const [i, name] of ["A", "B", "C", "D"].entries()) {
      vertexLabels[i].set(state[name]).show(names);
    }
    for (const name of Object.keys(pointLabels)) {
      pointLabels[name].set(f[name]).show(names);
    }
    for (const h of [hA, hB, hC, hD]) h.set(state[h.name]);

    if (proof) {
      say("Proof: OR and PE are parallel, and PE is perpendicular to CD, so all four maltitudes pass through T.", "done");
    } else {
      say(`The four maltitudes meet at T; the biggest miss is ${fmt(cl.maltitudeMiss)} units. T = (A+B+C+D)/2 - O.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveCorner(name, p) {
    state = Core.withPoint(state, name, p);
    render();
  }

  const cornerOptions = (name) => ({
    r: 9,
    step: 3,
    shift: 9,
    layer: handlesLayer,
    label: `Corner ${name}. Drag it, or focus it and use the arrow keys, to move it round the circle.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  });
  const hA = board.handle("A", state.A, { ...cornerOptions("A"), onMove: (p) => moveCorner("A", p) });
  const hB = board.handle("B", state.B, { ...cornerOptions("B"), onMove: (p) => moveCorner("B", p) });
  const hC = board.handle("C", state.C, { ...cornerOptions("C"), onMove: (p) => moveCorner("C", p) });
  const hD = board.handle("D", state.D, { ...cornerOptions("D"), onMove: (p) => moveCorner("D", p) });

  function syncButtons() {
    const set = (button, on, onText, offText) => {
      button.setAttribute("aria-pressed", String(on));
      button.textContent = on ? offText : onText;
    };
    set(diagonalsBtn, showDiagonals, "Show diagonals", "Hide diagonals");
    set(namesBtn, showNames, "Show names", "Hide names");
    set(hintBtn, showHint, "Show hint", "Hide hint");
    set(proofBtn, showProof, "Show proof", "Hide proof");
    for (const button of [diagonalsBtn, namesBtn, hintBtn]) button.disabled = showProof;
  }

  function reset() {
    state = Core.start();
    showDiagonals = false;
    showNames = true;
    showHint = false;
    showProof = false;
    saved = null;
    syncButtons();
    render();
    hA.node.focus();
  }

  function toggleProof() {
    if (showProof) {
      showProof = false;
      showDiagonals = saved.diagonals;
      showNames = saved.names;
      showHint = saved.hint;
      saved = null;
    } else {
      saved = { diagonals: showDiagonals, names: showNames, hint: showHint };
      showProof = true;
      showDiagonals = false;
      showNames = false;
      showHint = false;
    }
    syncButtons();
    render();
    proofBtn.focus();
  }

  resetBtn.addEventListener("click", reset);
  diagonalsBtn.addEventListener("click", () => {
    if (showProof) return;
    showDiagonals = !showDiagonals;
    syncButtons();
    render();
  });
  namesBtn.addEventListener("click", () => {
    if (showProof) return;
    showNames = !showNames;
    syncButtons();
    render();
  });
  hintBtn.addEventListener("click", () => {
    if (showProof) return;
    showHint = !showHint;
    syncButtons();
    render();
  });
  proofBtn.addEventListener("click", toggleProof);

  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    else if (key === "d" && !showProof) diagonalsBtn.click();
    else if (key === "n" && !showProof) namesBtn.click();
    else if (key === "h" && !showProof) hintBtn.click();
    else if (key === "p") toggleProof();
  });

  board.onTheme(render);
  syncButtons();
  render();
})();
