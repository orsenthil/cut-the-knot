"use strict";

/*
 * The page for Butterfly: drawing and input only; the theorem is in
 * butterfly-core.js. An SVG holds N concentric circles, the horizontal
 * classifier through the draggable nexus M, and two spikes through M whose ends
 * A and C are draggable on the outer circle. The wings A_i D_p(i) and C_i B_p(i)
 * are drawn for every circle; their crossings X_i and Y_i sit on the classifier.
 */

(function () {
  const Core = ButterflyCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nRange = document.getElementById("nRange");
  const nOut = document.getElementById("nOut");
  const permuteBtn = document.getElementById("permuteBtn");
  const checkBtn = document.getElementById("checkBtn");
  const newBtn = document.getElementById("newBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");

  let state = Core.start({ n: Number(nRange.value) || 2 });
  let checked = false;

  const circlesLayer = board.layer("circles");
  const guidesLayer = board.layer("guides");
  const wingsLayer = board.layer("wings");
  const marksLayer = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Built once, up to the applet's maximum of ten circles, then reused. */
  const circles = Array.from({ length: 10 }, () =>
    board.circle(state.center, 1, "bf-circle", circlesLayer));
  const classifier = board.line(state.M, { x: state.M.x + 200, y: state.M.y }, "bf-classifier", guidesLayer);
  const spikes = [
    board.line(state.M, state.A, "bf-spike", guidesLayer),
    board.line(state.M, state.C, "bf-spike", guidesLayer),
  ];
  const wings = Array.from({ length: 20 }, () =>
    board.segment(state.center, state.center, "bf-wing", wingsLayer));
  const wingsAlt = Array.from({ length: 20 }, () =>
    board.segment(state.center, state.center, "bf-wing alt", wingsLayer));
  const xDots = Array.from({ length: 10 }, () =>
    board.point(state.center, "bf-x", 4, marksLayer));
  const yDots = Array.from({ length: 10 }, () =>
    board.point(state.center, "bf-y", 4, marksLayer));
  const chordEnds = [0, 1].map(() => board.point(state.center, "bf-chord", 3.5, marksLayer));
  const rightMark = board.rightAngle(state.M, state.center, { x: state.M.x + 200, y: state.M.y },
    9, "bf-right", marksLayer);
  const labels = [
    board.label(state.M, "M", "glabel", -18, -10, marksLayer),
    board.label(state.center, "O", "glabel", 8, -8, marksLayer),
    board.label(state.A, "A", "glabel", -20, -8, marksLayer),
    board.label(state.C, "C", "glabel", 8, 6, marksLayer),
  ];

  /**
   * The status line also tells the player's record that a demo has been
   * explored: "done" is the only result an illustration can have.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const cl = Core.claims(state);

    circles.forEach((c, i) => {
      c.show(i < state.n);
      if (i < state.n) c.set(state.center, state.radii[i]);
    });
    classifier.set(m.classifier.p, m.classifier.q);
    spikes[0].set(state.M, state.A);
    spikes[1].set(state.M, state.C);

    for (let i = 0; i < 10; i++) {
      const on = i < state.n && m.defined;
      const j = i < state.n ? state.perm[i] - 1 : 0;
      wings[i].show(on && Boolean(m.A[i] && m.D[j]));
      wingsAlt[i].show(on && Boolean(m.C[i] && m.B[j]));
      xDots[i].show(on && Boolean(m.X[i]));
      yDots[i].show(on && Boolean(m.Y[i]));
      if (on) {
        if (m.A[i] && m.D[j]) wings[i].set(m.A[i], m.D[j]);
        if (m.C[i] && m.B[j]) wingsAlt[i].set(m.C[i], m.B[j]);
        if (m.X[i]) xDots[i].set(m.X[i]);
        if (m.Y[i]) yDots[i].set(m.Y[i]);
      }
    }

    const ends = Core.lineCircle(state.M, m.classifier.q, state.center, state.radii[0]);
    chordEnds.forEach((dot, i) => {
      dot.show(cl.defined && Boolean(ends[i]));
      if (ends[i]) dot.set(ends[i]);
    });
    rightMark.show(cl.defined && cl.aligned);
    if (cl.aligned) rightMark.set(state.M, state.center, m.classifier.q, 9);

    labels[0].set(state.M);
    labels[1].set(state.center);
    labels[2].set(state.A);
    labels[3].set(state.C);
    hA.set(state.A);
    hC.set(state.C);
    hM.set(state.M);

    if (!cl.defined) {
      say("Move the coloured points until both spikes cross every circle.", null);
    } else if (!cl.aligned) {
      say("M is off to one side. Put it above or below O so every chord is cut in half.", null);
    } else if (checked) {
      say(state.n === 1
        ? `Checked: MX = MY = ${fmt(m.mx[0])}. M is the midpoint of XY.`
        : `Checked: both sums of 1/MX and 1/MY are ${fmt(m.sumX)}.`, "done");
    } else if (state.n === 1) {
      say(`One circle: MX = ${fmt(m.mx[0])} and MY = ${fmt(m.my[0])}. Press Check the claim.`, null);
    } else {
      say(`Sum of 1/MX = ${fmt(m.sumX)}; sum of 1/MY = ${fmt(m.sumY)}. Press Check the claim.`, null);
    }
    if (window.Track) window.Track.state(state);
  }

  function syncHandles() {
    hA.set(state.A);
    hC.set(state.C);
    hM.set(state.M);
    nOut.value = String(state.n);
    nRange.value = String(state.n);
  }

  function moveM(p) {
    state = Core.withPoint(state, "M", inside(p));
    checked = false;
    render();
  }
  function moveSpike(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const hM = board.handle("M", state.M, {
    r: 8, step: 3, shift: 12, layer: handlesLayer,
    label: "Nexus M. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: inside,
    onMove: moveM,
  });
  const hA = board.handle("A", state.A, {
    r: 8, step: 3, shift: 12, layer: handlesLayer,
    label: "Spike end A on the outer circle. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p) => Core.onOuterCircle(state, inside(p)),
    onMove: (p) => moveSpike("A", p),
  });
  const hC = board.handle("C", state.C, {
    r: 8, step: 3, shift: 12, layer: handlesLayer,
    label: "Spike end C on the outer circle. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p) => Core.onOuterCircle(state, inside(p)),
    onMove: (p) => moveSpike("C", p),
  });

  function newGame() {
    state = Core.start({ n: state.n, seed: state.seed + 1 });
    checked = false;
    syncHandles();
    render();
    hM.node.focus();
  }
  function permute() {
    state = Core.permute(state);
    checked = false;
    render();
  }
  function checkClaim() {
    const cl = Core.claims(state);
    checked = Boolean(cl.defined && cl.aligned &&
      (state.n === 1 ? cl.midpoint : cl.reciprocal));
    render();
  }

  nRange.addEventListener("input", () => {
    state = Core.withN(state, Number(nRange.value));
    checked = false;
    syncHandles();
    render();
  });
  permuteBtn.addEventListener("click", permute);
  checkBtn.addEventListener("click", checkClaim);
  newBtn.addEventListener("click", newGame);
  document.addEventListener("keydown", (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "p" || e.key === "P") permute();
    if (e.key === "c" || e.key === "C") checkClaim();
  });

  board.onTheme(render);
  syncHandles();
  render();
})();
