"use strict";

/*
 * The page for Besteman 2: drawing and input only; the geometry is in
 * besteman-2-core.js. An SVG shows the segment AC with A and B draggable
 * (B is where circle A's radius comes from), the two circles, their lower
 * intersection D, the bisector DP, and the N equal-part dots. The viewBox
 * widens when N or a dragged point puts C off the board, so no rule changes
 * when the picture grows; the board scrolls sideways inside the stage.
 */

(function () {
  const Core = Besteman2Core;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const nInput = document.getElementById("nInput");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");

  const board = Geom.board(svg);
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  let state = Core.start();
  let checked = false;
  let viewW = 400;

  /* Objects are created once; only their geometry changes on a redraw. */
  const base = board.segment(state.A, state.B, "base-seg", shapes);
  const circleA = board.circle(state.A, 1, "construct-circle", shapes);
  const circleC = board.circle(state.A, 1, "construct-circle alt", shapes);
  const sideAD = board.segment(state.A, state.A, "tri-side", shapes);
  const sideDC = board.segment(state.A, state.A, "tri-side", shapes);
  const bisector = board.segment(state.A, state.A, "bisector", shapes);
  const dotD = board.point(state.A, "aux-dot", 4, marks);
  const dotP = board.point(state.A, "p-dot", 4.5, marks);
  const dots = [];
  for (let i = 0; i < Core.MAX_N; i++) dots.push(board.point(state.A, "part-dot", 3.2, marks));
  const labels = {
    A: board.label(state.A, "A", "glabel", -19, 21, marks),
    B: board.label(state.B, "B", "glabel", -19, -10, marks),
    C: board.label(state.A, "C", "glabel", 9, 6, marks),
    D: board.label(state.A, "D", "glabel", -19, -9, marks),
    P: board.label(state.A, "P", "glabel", 7, -10, marks),
  };
  const arcs = [
    board.angleArc(state.A, state.A, state.A, 20, "half-arc", marks),
    board.angleArc(state.A, state.A, state.A, 20, "half-arc alt", marks),
  ];

  /** Show the status line. "done" is how the record sees a finished explore. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => (Number.isFinite(v) ? (Math.round(v * 100) / 100).toString() : "—");

  function render() {
    const c = Core.construction(state);
    const N = state.N;

    // Keep the whole segment in view without moving any point. The SVG's
    // CSS min-width keeps the handles finger-sized when the board gets wide.
    const wanted = c ? Math.max(400, c.C.x + 45, c.D.x + 45) : 400;
    viewW = Math.max(400, Math.min(2400, Math.ceil(wanted)));
    svg.setAttribute("viewBox", `0 0 ${viewW} 250`);
    svg.style.minWidth = `${Math.round(viewW > 440 ? viewW * 0.9 : 320)}px`;

    const inside = (p) => ({
      x: Geom.clamp(p.x, 6, viewW - 6),
      y: Geom.clamp(p.y, 6, 244),
    });

    base.show(Boolean(c));
    circleA.show(Boolean(c));
    circleC.show(Boolean(c));
    sideAD.show(Boolean(c));
    sideDC.show(Boolean(c));
    bisector.show(Boolean(c));
    dotD.show(Boolean(c));
    dotP.show(Boolean(c));

    if (c) {
      base.set(c.A, c.C);
      circleA.set(c.A, c.rA);
      circleC.set(c.C, c.rC);
      sideAD.set(c.A, c.D);
      sideDC.set(c.C, c.D);
      bisector.set(c.D, c.P);
      dotD.set(c.D);
      dotP.set(c.P);

      const arcRadius = Math.min(26, Math.max(12, c.AB * 0.42));
      arcs[0].set(c.D, c.A, c.P, arcRadius);
      arcs[1].set(c.D, c.P, c.C, arcRadius);
      arcs[0].show(state.showHint);
      arcs[1].show(state.showHint);

      labels.A.set(c.A);
      labels.B.set(c.B);
      labels.C.set(c.C);
      labels.D.set(c.D);
      labels.P.set(c.P);
      for (const key in labels) labels[key].show(state.showNames);

      dots.forEach((dot, i) => {
        dot.show(i < N);
        if (i < N) dot.set(c.marks[i]);
      });
    } else {
      arcs[0].show(false);
      arcs[1].show(false);
      for (const key in labels) labels[key].show(false);
      dots.forEach((dot) => dot.show(false));
    }

    hA.set(state.A);
    hB.set(state.B);

    if (window.Track) window.Track.state(state);

    if (!c) {
      say("Drag A and B apart to draw the two circles.", null);
    } else if (checked) {
      say(`Checked: AP/PC = AD/CD = 1/${N - 1}; AP = AC/${N} = ${fmt(c.AP)}, so the ${N} dots divide AC equally.`, "done");
    } else {
      say(`N = ${N}: AD = AB = ${fmt(c.AD)} and CD = ${N - 1}×AB. The bisector puts AP = AC/${N} = ${fmt(c.AP)}. Press Check the claims.`, null);
    }
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const clampPoint = (p) => ({
    x: Geom.clamp(p.x, 6, viewW - 6),
    y: Geom.clamp(p.y, 6, 244),
  });

  const hA = board.handle("A", state.A, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampPoint,
    label: "Point A. Drag, or focus and use the arrow keys to move it",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("A", p),
  });
  const hB = board.handle("B", state.B, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampPoint,
    label: "Point B. Drag, or focus and use the arrow keys to move it",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("B", p),
  });

  function setN(n) {
    state = Core.setN(state, n);
    nInput.value = String(state.N);
    checked = false;
    render();
  }

  function newGame() {
    state = Core.start({ N: state.N, showNames: state.showNames, showHint: state.showHint });
    checked = false;
    nInput.value = String(state.N);
    render();
    hA.node.focus();
  }

  function checkClaims() {
    const cl = Core.claims(state);
    checked = cl.nonDegenerate && cl.bisectorRatio && cl.pageSecond && cl.equalAngles && cl.equalParts;
    render();
    if (!checked) say("Move A and B apart, then check again.", null);
  }

  function toggle(button, key) {
    state = { ...state, [key]: !state[key] };
    button.setAttribute("aria-pressed", String(state[key]));
    button.textContent = key === "showNames"
      ? (state[key] ? "Hide names" : "Show names")
      : (state[key] ? "Hide equal angles" : "Show equal angles");
    render();
  }

  newBtn.addEventListener("click", newGame);
  checkBtn.addEventListener("click", checkClaims);
  namesBtn.addEventListener("click", () => toggle(namesBtn, "showNames"));
  hintBtn.addEventListener("click", () => toggle(hintBtn, "showHint"));
  lessBtn.addEventListener("click", () => setN(state.N - 1));
  moreBtn.addEventListener("click", () => setN(state.N + 1));
  nInput.addEventListener("change", () => setN(nInput.value));
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") newGame();
    else if (e.key === "c" || e.key === "C") checkClaims();
    else if (e.key === "h" || e.key === "H") toggle(hintBtn, "showHint");
    else if (e.key === "+" || e.key === "=") setN(state.N + 1);
    else if (e.key === "-" || e.key === "_") setN(state.N - 1);
  });

  board.onTheme(render);
  nInput.value = String(state.N);
  render();
})();
