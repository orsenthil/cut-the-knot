"use strict";

/*
 * The page for Circle Center By Ruler: drawing and input only; all the geometry
 * is in circle-center-by-ruler-core.js. An SVG shows the two crossing circles,
 * the ruler lines that turn one chosen point into B, C, A' and C', the two
 * intersections P and Q, and the diameter through them. M, N, A and B' are
 * draggable (or arrow-key movable) points, as in the applet; the three
 * checkboxes show names, the circle's centre O, and the equal-angle hint.
 */

(function () {
  const Core = CircleCenterByRulerCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const centerBtn = document.getElementById("centerBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  let state = Core.start();
  let checked = false;
  let checkPassed = false;

  const circlesLayer = board.layer("circles");
  const linesLayer = board.layer("lines");
  const marksLayer = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const circleA = board.circle(state.A, 1, "circle-a", circlesLayer);
  const circleB = board.circle(state.A, 1, "circle-b", circlesLayer);

  const strongLines = [
    board.line(state.A, state.Bp, "line-strong", linesLayer),
    board.line(state.Bp, state.A, "line-strong", linesLayer),
  ];
  const midLines = [
    board.line(state.A, state.Bp, "line-mid", linesLayer),
    board.line(state.Bp, state.A, "line-mid", linesLayer),
    board.line(state.A, state.Bp, "line-mid", linesLayer),
    board.line(state.Bp, state.A, "line-mid", linesLayer),
  ];
  const chordLines = [
    board.line(state.A, state.Bp, "line-soft", linesLayer),
    board.line(state.Bp, state.A, "line-soft", linesLayer),
  ];
  const diameterLine = board.line(state.A, state.Bp, "line-diameter", linesLayer);

  const crossDots = ["B", "C", "Ap", "Cp"].map(() => board.point(state.A, "cross-dot", 3.5, marksLayer));
  const pivotDots = ["P", "Q"].map(() => board.point(state.A, "pivot-dot", 4.5, marksLayer));
  const centerDot = board.point(state.A, "center-dot", 4, marksLayer);
  const hintArcs = [
    board.angleArc(state.A, state.Bp, state.A, 14, "hint-arc", marksLayer),
    board.angleArc(state.A, state.Bp, state.A, 18, "hint-arc alt", marksLayer),
    board.angleArc(state.A, state.Bp, state.A, 14, "hint-arc", marksLayer),
    board.angleArc(state.A, state.Bp, state.A, 18, "hint-arc alt", marksLayer),
  ];

  const labelOffsets = {
    A: [-16, -9], B: [-16, -9], C: [-16, -9], Ap: [-16, -9],
    Bp: [-16, -9], Cp: [-16, -9], M: [-16, -9], N: [-16, -9],
    P: [-16, -9], Q: [-16, -9], O: [7, -8],
  };
  const labels = {};
  for (const [name, off] of Object.entries(labelOffsets)) {
    labels[name] = board.label(state.A, name === "Ap" ? "A′" : name === "Bp" ? "B′" : name === "Cp" ? "C′" : name,
      "glabel" + (name === "O" ? " center-label" : ""), off[0], off[1], labelsLayer);
  }
  const allShapes = [
    circleA, circleB, ...strongLines, ...midLines, ...chordLines, diameterLine,
    ...crossDots, ...pivotDots, centerDot, ...hintArcs, ...Object.values(labels),
  ];

  /**
   * Shows the line under the diagram. "done" marks an explored illustration;
   * there is no win or loss. The shared record reads the status class.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.compute(state);
    for (const shape of allShapes) shape.show(g.valid);

    if (!g.valid) {
      say("Move M and N apart, and keep the points away from each other.", null);
    } else {
      const p = g.points;
      circleA.set(p.O, g.circles.A.radius);
      circleB.set(g.circles.B.center, g.circles.B.radius);

      strongLines[0].set(g.lines.AB[0], g.lines.AB[1]);
      strongLines[1].set(g.lines.BC[0], g.lines.BC[1]);
      const mids = [g.lines.ApBp, g.lines.BpCp, g.lines.AA, g.lines.CC];
      for (let i = 0; i < mids.length; i++) midLines[i].set(mids[i][0], mids[i][1]);
      chordLines[0].set(g.lines.AC[0], g.lines.AC[1]);
      chordLines[1].set(g.lines.ApCp[0], g.lines.ApCp[1]);
      diameterLine.set(g.lines.PQ[0], g.lines.PQ[1]);

      const crosses = [p.B, p.C, p.Ap, p.Cp];
      for (let i = 0; i < crosses.length; i++) crossDots[i].set(crosses[i]);
      pivotDots[0].set(p.P);
      pivotDots[1].set(p.Q);
      centerDot.set(p.O);
      centerDot.show(state.showStatement);
      labels.O.show(state.showStatement);

      const arcSets = [
        [p.M, p.A, p.Ap], [p.N, p.C, p.Cp],
        [p.M, p.B, p.Bp], [p.N, p.B, p.Bp],
      ];
      for (let i = 0; i < arcSets.length; i++) {
        const [v, a, b] = arcSets[i];
        hintArcs[i].set(v, a, b, i < 2 ? 14 : 18);
        hintArcs[i].show(state.showHint);
      }

      for (const [name, shape] of Object.entries(labels)) {
        shape.set(p[name], undefined, labelOffsets[name][0], labelOffsets[name][1]);
        shape.show(state.showNames || name === "O" && state.showStatement);
      }

      const m = Core.measurements(state);
      if (checked && checkPassed) {
        say("AA′ = CC′ and AC = A′C′. P, Q and the centre O lie on one straight line.", "done");
      } else if (checked) {
        say("Move the points apart and check again.", null);
      } else {
        say(`AC = ${fmt(m.chordAC)}, A′C′ = ${fmt(m.chordApCp)}. Drag M, N, A or B′, or press Check the claims.`, null);
      }
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    checkPassed = false;
    render();
  }

  const clamp = (p) => inside(p);
  const handleOpts = (name) => ({
    r: 7, step: 3, shift: 12, layer: handlesLayer, clamp,
    label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint(name, p),
  });

  const hM = board.handle("M", state.M, handleOpts("M"));
  const hN = board.handle("N", state.N, handleOpts("N"));
  const hA = board.handle("A", state.A, handleOpts("A"));
  const hBp = board.handle("Bp", state.Bp, handleOpts("Bp"));
  const handles = { M: hM, N: hN, A: hA, Bp: hBp };

  function reset() {
    state = Core.start({
      showNames: state.showNames,
      showStatement: state.showStatement,
      showHint: state.showHint,
    });
    checked = false;
    checkPassed = false;
    for (const [name, h] of Object.entries(handles)) h.set(state[name]);
    render();
    hA.node.focus();
  }

  function toggle(name, btn, onText, offText) {
    state = Core.withOption(state, name, !state[name]);
    btn.setAttribute("aria-pressed", String(state[name]));
    btn.textContent = state[name] ? onText : offText;
    render();
  }

  function checkClaims() {
    const cl = Core.claims(state);
    checked = true;
    checkPassed = cl.all;
    render();
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () => toggle("showNames", namesBtn, "Hide names", "Show names"));
  centerBtn.addEventListener("click", () => toggle("showStatement", centerBtn, "Hide center O", "Show center O"));
  hintBtn.addEventListener("click", () => toggle("showHint", hintBtn, "Hide equal angles", "Show equal angles"));
  checkBtn.addEventListener("click", checkClaims);
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") checkClaims();
  });

  board.onTheme(render);
  render();
})();
