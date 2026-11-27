"use strict";

/*
 * The page for Circles Lined On Tri Sides: drawing and input only; the geometry
 * is in circles-lined-on-tri-sides-core.js. The board shows the right triangle,
 * its incircle and the chain of equal circles along both legs. Two draggable
 * dots on the rails below choose N and M (1..8), just as the applet's two
 * number spinners did. The "Show statement" button reveals the applet's small
 * blue copy of the incircle with its row of small circles.
 */

(function () {
  const Core = CirclesLinedOnTriSidesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const statementBtn = document.getElementById("statementBtn");
  const checkBtn = document.getElementById("checkBtn");

  const size = { width: Core.WIDTH, height: Core.HEIGHT };
  const rail = { N: 316, M: 344 };
  const railX0 = 40;
  const railStep = 40;
  const railPoint = (name, value) => ({ x: railX0 + (value - 1) * railStep, y: rail[name] });
  const railValue = (p) => Math.max(Core.MIN, Math.min(Core.MAX,
    Math.round((p.x - railX0) / railStep) + 1));
  const fmt = (v) => (Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : "—");

  let state = Core.start({});
  let checked = false;

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Rails, ticks and their numbers are fixed; only the handles move. */
  for (const name of ["N", "M"]) {
    board.segment({ x: railX0 - 8, y: rail[name] }, { x: railX0 + 7 * railStep + 8, y: rail[name] },
      "rail", guides);
    for (let v = 1; v <= Core.MAX; v++) {
      const x = railX0 + (v - 1) * railStep;
      board.segment({ x, y: rail[name] - 5 }, { x, y: rail[name] + 5 }, "rail-tick", guides);
      board.label({ x, y: rail[name] - 10 }, String(v), "rail-num", 0, 0, guides);
    }
    board.label({ x: 8, y: rail[name] + 5 }, name, "rail-name", 0, 0, guides);
  }

  const triangle = board.polygon([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], "tri-side", shapes);
  const rightMark = board.rightAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 11, "right-mark", marks);
  const incircle = board.circle({ x: 0, y: 0 }, 1, "incircle", shapes);
  const incenterDot = board.point({ x: 0, y: 0 }, "incenter-dot", 3.2, marks);
  const cornerDot = board.point({ x: 0, y: 0 }, "corner-dot", 3.2, marks);
  const auxCircle = board.circle({ x: 0, y: 0 }, 1, "aux-circle", shapes);
  const auxLabel = board.label({ x: 0, y: 0 }, "R", "glabel aux-label", 0, 0, marks);

  /* How many circles can ever be needed, over the applet's whole 1..8 range. */
  let maxChain = 0;
  let maxAux = 0;
  for (let N = Core.MIN; N <= Core.MAX; N++) {
    for (let M = Core.MIN; M <= Core.MAX; M++) {
      if (N === M) continue;
      const g = Core.compute(Core.withOptions(state, { N, M }), size);
      maxChain = Math.max(maxChain, g.L1 + g.L2 + 1);
      maxAux = Math.max(maxAux, g.coef);
    }
  }
  const chain = [];
  for (let i = 0; i < maxChain; i++) chain.push(board.circle({ x: 0, y: 0 }, 1, "chain-circle", shapes));
  const auxChain = [];
  for (let i = 0; i < maxAux; i++) auxChain.push(board.circle({ x: 0, y: 0 }, 1, "aux-chain", shapes));

  /** The status line; "done" means a claim was checked, never a win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const a = Core.arrangement(state, size);
    const empty = a.doNotDraw;
    triangle.show(!empty);
    rightMark.show(!empty);
    incircle.show(!empty);
    incenterDot.show(!empty);
    cornerDot.show(!empty);
    chain.forEach((c) => c.show(false));
    auxCircle.show(false);
    auxLabel.show(false);
    auxChain.forEach((c) => c.show(false));

    if (!empty) {
      const g = a.geometry;
      triangle.set([a.left, a.vertex, a.top]);
      rightMark.set(a.vertex, a.left, a.top, 11);
      incircle.set(g.incircle, g.incircle.r);
      incenterDot.set(g.incircle);
      cornerDot.set(a.vertex);
      a.circles.forEach((c, i) => {
        if (chain[i]) chain[i].set(c, c.r).show(true);
      });

      if (state.showStatement) {
        auxCircle.set(g.auxCircle, g.auxCircle.r).show(true);
        auxLabel.set({ x: g.auxCircle.x + g.auxCircle.r + 12, y: g.auxCircle.y }, "R", 0, 4);
        auxLabel.show(true);
        g.statementCircles.forEach((c, i) => {
          if (auxChain[i]) auxChain[i].set(c, c.r).show(true);
        });
      }
    }

    if (empty) {
      say(`N and M are both ${state.N}, so there is no triangle. Move one of the dots.`);
    } else {
      const g = a.geometry;
      const base = `N = ${state.N}, M = ${state.M}: legs ${g.L1} and ${g.L2}, hypotenuse ${g.L3}. ` +
        `${a.circles.length} equal circles fit on the legs; the large circle is ` +
        `${fmt(g.R / g.r)} small radii across.`;
      if (checked) say(`Checked for ${state.N} and ${state.M}: every circle touches its neighbours and the sides, and ${base}`, "done");
      else say(base);
    }
    if (window.Track) window.Track.state(state);
  }

  function setNumber(name, value) {
    state = Core.withOptions(state, { [name]: value });
    checked = false;
    render();
  }

  function reset() {
    state = Core.start({});
    checked = false;
    hN.set(railPoint("N", state.N));
    hM.set(railPoint("M", state.M));
    render();
    hN.node.focus();
  }

  function toggleStatement() {
    state = Core.withOptions(state, { showStatement: !state.showStatement });
    statementBtn.setAttribute("aria-pressed", String(state.showStatement));
    statementBtn.textContent = state.showStatement ? "Hide the R picture" : "Show the R picture";
    render();
  }

  function checkClaims() {
    const c = Core.claims(state);
    const values = Object.entries(c).filter(([name]) => name !== "doNotDraw").map(([, ok]) => ok);
    checked = !c.doNotDraw && values.every(Boolean);
    render();
    if (!checked) say("Choose two different numbers, then check again.");
  }

  const clampRail = (name) => (p) => railPoint(name, railValue(p));
  const hN = board.handle("N", railPoint("N", state.N), {
    r: 9, step: railStep, shift: railStep, layer: handlesLayer,
    clamp: clampRail("N"),
    label: "Number N. Drag left or right to choose from 1 to 8, or focus and press the arrow keys.",
    describe: (p) => `equals ${railValue(p)}`,
    onMove: (p) => setNumber("N", railValue(p)),
  });
  const hM = board.handle("M", railPoint("M", state.M), {
    r: 9, step: railStep, shift: railStep, layer: handlesLayer,
    clamp: clampRail("M"),
    label: "Number M. Drag left or right to choose from 1 to 8, or focus and press the arrow keys.",
    describe: (p) => `equals ${railValue(p)}`,
    onMove: (p) => setNumber("M", railValue(p)),
  });

  resetBtn.addEventListener("click", reset);
  statementBtn.addEventListener("click", toggleStatement);
  checkBtn.addEventListener("click", checkClaims);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "s" || e.key === "S") toggleStatement();
    if (e.key === "c" || e.key === "C") checkClaims();
  });

  board.onTheme(render);
  render();
})();
