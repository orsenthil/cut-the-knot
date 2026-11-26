"use strict";

/*
 * The page for Building Bridge: drawing and input only; the translation and the
 * shortest-road calculation are in building-bridge-core.js. An SVG holds the
 * river, the two towns A and B, and a draggable bridge point C on the upper
 * bank. The solid road follows A -> C -> C' -> B; the dashed construction shows
 * the translated towns B' and A' and the best bridge where AB' crosses the bank.
 */

(function () {
  const Core = BuildingBridgeCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const hintBtn = document.getElementById("hintBtn");
  const snapBtn = document.getElementById("snapBtn");

  const view = board.viewBox;
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");
  const inX = (x) => Geom.clamp(x, view.x + 12, view.x + view.width - 12);

  let state = Core.start();
  let showHint = true;

  const water = board.layer("water");
  const banks = board.layer("banks");
  const guides = board.layer("guides");
  const roads = board.layer("roads");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Objects are created once; only their geometry changes on a redraw. */
  const river = board.polygon([
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  ], "river", water);
  const upper = board.segment(state.A, state.C, "bank", banks);
  const lower = board.segment(state.A, state.C, "bank", banks);
  const guideA = board.segment(state.A, state.B, "guide", guides);
  const guideB = board.segment(state.A, state.B, "guide", guides);
  const bestBridge = board.segment(state.C, state.C, "best-bridge", guides);
  const bestDot = board.point(state.C, "best-dot", 4, guides);
  const roadA = board.segment(state.A, state.C, "road", roads);
  const roadBridge = board.segment(state.C, state.C, "bridge", roads);
  const roadB = board.segment(state.C, state.B, "road", roads);
  const bPrimeDot = board.point(state.B, "prime-dot", 4, marks);
  const aPrimeDot = board.point(state.A, "prime-dot", 4, marks);
  const mateDot = board.point(state.C, "mate-dot", 4, marks);
  const labels = [
    board.label(state.A, "A", "glabel", -18, -10, marks),
    board.label(state.B, "B", "glabel", 10, 20, marks),
    board.label(state.C, "C", "glabel", 9, -10, marks),
    board.label(state.C, "C'", "glabel mate-label", 9, 16, marks),
    board.label(state.B, "B'", "glabel prime-label", -26, -8, marks),
    board.label(state.A, "A'", "glabel prime-label", -26, 20, marks),
  ];

  /**
   * Shows a line under the picture. "done" means the shortest bridge has been
   * found — the record reads that class. An illustration has no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const s = state;
    const t = Core.translated(s);
    const b = Core.best(s);
    const mate = Core.bridgeMate(s, s.C);
    const width = view.x + view.width;

    river.set([
      { x: view.x, y: s.yU }, { x: width, y: s.yU },
      { x: width, y: s.yL }, { x: view.x, y: s.yL },
    ]);
    upper.set({ x: view.x, y: s.yU }, { x: width, y: s.yU });
    lower.set({ x: view.x, y: s.yL }, { x: width, y: s.yL });

    roadA.set(s.A, s.C);
    roadBridge.set(s.C, mate);
    roadB.set(mate, s.B);
    mateDot.set(mate);

    const valid = Number.isFinite(b.KU.x) && Number.isFinite(b.KL.x);
    guideA.show(valid && showHint);
    guideB.show(valid && showHint);
    bestBridge.show(valid && showHint);
    bestDot.show(valid && showHint);
    bPrimeDot.show(valid && showHint);
    aPrimeDot.show(valid && showHint);
    labels[4].show(valid && showHint);
    labels[5].show(valid && showHint);
    if (valid) {
      guideA.set(s.A, t.Bprime);
      guideB.set(t.Aprime, s.B);
      bestBridge.set(b.KU, b.KL);
      bestDot.set(b.KU);
      bPrimeDot.set(t.Bprime);
      aPrimeDot.set(t.Aprime);
      labels[4].set(t.Bprime);
      labels[5].set(t.Aprime);
    }

    labels[0].set(s.A);
    labels[1].set(s.B);
    labels[2].set(s.C);
    labels[3].set(mate);

    hA.set(s.A);
    hB.set(s.B);
    hC.set(s.C);

    if (!valid) {
      say("Move each town off the bank it is sitting on.", null);
    } else if (Core.atBest(s)) {
      say("Shortest road found! The bridge is where the dashed line from A to B' crosses the bank.", "done");
    } else {
      say(`Road ${fmt(Core.roadLength(s, s.C))} units; shortest ${fmt(Core.minRoad(s))}. Drag C, or press Snap to shortest.`, null);
    }
    if (window.Track) window.Track.state(state);
  }

  const clampA = (p) => ({ x: inX(p.x), y: Geom.clamp(p.y, view.y + 8, state.yU) });
  const clampB = (p) => ({ x: inX(p.x), y: Geom.clamp(p.y, state.yL, view.y + view.height - 8) });
  const clampC = (p) => ({ x: inX(p.x), y: state.yU });

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    render();
  }

  const hA = board.handle("A", state.A, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampA,
    label: "Town A. Drag, or focus and use the arrow keys to move it above the river",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("A", p),
  });
  const hB = board.handle("B", state.B, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampB,
    label: "Town B. Drag, or focus and use the arrow keys to move it below the river",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("B", p),
  });
  const hC = board.handle("C", state.C, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampC,
    label: "Bridge point C, on the upper bank. Drag along the bank, or use the arrow keys",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("C", p),
  });

  function reset() {
    state = Core.start();
    render();
    hC.node.focus();
  }

  function toggleHint() {
    showHint = !showHint;
    hintBtn.setAttribute("aria-pressed", String(showHint));
    hintBtn.textContent = showHint ? "Hide hint lines" : "Show hint lines";
    render();
  }

  function snap() {
    const KU = Core.best(state).KU;
    if (!Number.isFinite(KU.x)) return;
    move("C", { x: inX(KU.x), y: state.yU });
    hC.node.focus();
  }

  newBtn.addEventListener("click", reset);
  hintBtn.addEventListener("click", toggleHint);
  snapBtn.addEventListener("click", snap);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    else if (key === "h") toggleHint();
    else if (key === "s") snap();
  });

  board.onTheme(render);
  render();
})();
