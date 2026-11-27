"use strict";

/*
 * The page for CID: drawing and input only; the construction and the claims
 * are in cid-core.js. An SVG holds the big isosceles triangle, the zigzag
 * chain of equal-length steps cut into it, and three draggable corners. The
 * original applet had a spinner for the denominator 180/apex and a "show
 * point enumeration" checkbox; both are kept as buttons here.
 */

(function () {
  const Core = CidCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");
  const namesBtn = document.getElementById("namesBtn");
  const checkBtn = document.getElementById("checkBtn");
  const nOut = document.getElementById("nOut");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  let state = Core.start({});
  let checked = false;

  const slicesLayer = board.layer("slices");
  const chainLayer = board.layer("chain");
  const marksLayer = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /**
   * Shows the line under the picture. "done" is only used when the player
   * presses Check the pattern; there is no win or loss in an illustration.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** A short stroke across a step, the applet's equal-length tick. */
  function tick(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * 5, ny = (dx / len) * 5;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    board.segment({ x: mx - nx, y: my - ny }, { x: mx + nx, y: my + ny }, "tick", marksLayer);
  }

  function render() {
    const points = Core.compute(state);
    const tris = Core.triangles(state);
    const gamma = Core.topAngle(state);

    board.clear(slicesLayer);
    board.clear(chainLayer);
    board.clear(marksLayer);

    // The two legs of the original triangle; its base is the first step.
    board.segment(state.A, state.B, "outer", chainLayer);
    board.segment(state.A, state.C, "outer", chainLayer);

    tris.forEach((t, i) => {
      board.polygon(t.points, i % 2 ? "slice alt" : "slice", slicesLayer);
    });
    for (let i = 1; i < points.length; i++) {
      board.segment(points[i - 1], points[i], "step", chainLayer);
      tick(points[i - 1], points[i]);
    }
    points.forEach((p, i) => {
      if (i < 2) return; // B and C are the draggable handles themselves
      board.point(p, "chain-dot", 3.2, marksLayer);
    });

    board.label(state.A, "A", "glabel", -19, -12, marksLayer);
    board.label(state.B, "B", "glabel", -20, 20, marksLayer);
    board.label(state.C, "C", "glabel", 8, 20, marksLayer);
    if (state.showNames) {
      points.forEach((p, i) => {
        board.label(p, String(i), "num-label", -4 + (i % 2 ? 5 : -5), 14, marksLayer);
      });
    }
    board.angleArc(state.A, state.B, state.C, 26, "angle-arc", marksLayer);

    hA.set(state.A);
    hB.set(state.B);
    hC.set(state.C);

    nOut.textContent = `N = ${state.n}   ·   apex ${fmt(gamma)}°`;
    minusBtn.disabled = state.n <= Core.MIN_N;
    plusBtn.disabled = state.n >= Core.MAX_N;

    const bases = tris.map((t) => Math.round(t.baseAngle));
    const c = Core.claims(state);
    if (checked && c.equalSteps && c.isosceles && c.arithmetic) {
      say(`Checked: every step is the same length, and the base angles step by ${fmt(gamma)}°.`, "done");
    } else if (tris.length === 0) {
      say(`With N = ${state.n} the apex is ${fmt(gamma)}°: choose N = 3 or more to make a slice.`);
    } else if (state.n % 2 === 0) {
      say(`Apex ${fmt(gamma)}°: ${tris.length} slice${tris.length === 1 ? "" : "s"}, base angles ${bases.join("°, ")}°. The chain stops short of the top.`);
    } else {
      say(`Apex ${fmt(gamma)}°: ${tris.length} slice${tris.length === 1 ? "" : "s"}, base angles ${bases.join("°, ")}° (steps of ${fmt(gamma)}°).`);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const clampHandle = (p) => inside(p);
  const hA = board.handle("A", state.A, {
    r: 9, step: 4, shift: 16, layer: handlesLayer, clamp: clampHandle,
    label: "Corner A, the apex. Drag, or focus and use the arrow keys",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("A", p),
  });
  const hB = board.handle("B", state.B, {
    r: 9, step: 4, shift: 16, layer: handlesLayer, clamp: clampHandle,
    label: "Corner B, a base corner. Drag, or focus and use the arrow keys",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("B", p),
  });
  const hC = board.handle("C", state.C, {
    r: 9, step: 4, shift: 16, layer: handlesLayer, clamp: clampHandle,
    label: "Corner C, a base corner. Drag, or focus and use the arrow keys",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("C", p),
  });

  function setN(n) {
    state = Core.withOption(state, "n", n);
    checked = false;
    render();
  }

  function newGame() {
    state = Core.start({ showNames: state.showNames });
    checked = false;
    render();
    hA.node.focus();
  }

  function checkPattern() {
    checked = true;
    render();
  }

  function toggleNames() {
    state = Core.withOption(state, "showNames", !state.showNames);
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide point numbers" : "Show point numbers";
    render();
  }

  newBtn.addEventListener("click", newGame);
  minusBtn.addEventListener("click", () => setN(state.n - 1));
  plusBtn.addEventListener("click", () => setN(state.n + 1));
  namesBtn.addEventListener("click", toggleNames);
  checkBtn.addEventListener("click", checkPattern);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") newGame();
  });

  board.onTheme(render);
  render();
})();
