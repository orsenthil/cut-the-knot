"use strict";

/*
 * The page for Adjacent Incircles: drawing and input only. The geometry is in
 * adjacent-incircles-core.js. The board has one apex and up to ten points on a
 * horizontal base line; every point is a focusable handle, so a player can
 * drag with a pointer or nudge with the arrow keys. The circles are redrawn in
 * place so a handle keeps its keyboard focus.
 */

(function () {
  const Core = AdjacentIncirclesCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");
  const equalBtn = document.getElementById("equalBtn");
  const resetBtn = document.getElementById("resetBtn");
  const namesChk = document.getElementById("namesChk");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const raysLayer = board.layer("rays");
  const circlesLayer = board.layer("circles");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({ n: Number(nInput.value) });
  let cacheKey = "";
  let rays = [];
  let circles = [];
  let labels = [];

  /**
   * The shared status line. "done" tells the player's record that a play has
   * ended; this is a picture with no win or loss, so the text is just a report.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Show only the shapes this value of n (and this equality) needs. */
  function ensureShapes(equal) {
    const key = state.n + ":" + equal;
    if (key === cacheKey) return;
    cacheKey = key;
    board.clear(guides);
    board.clear(raysLayer);
    board.clear(circlesLayer);
    board.clear(labelsLayer);
    rays = [];
    circles = [];
    labels = [];

    board.segment({ x: state.left, y: state.baseY }, { x: state.right, y: state.baseY }, "base-line", guides);
    for (let i = 0; i < state.n; i++) {
      rays.push(board.segment(state.apex, state.points[i], "ray", raysLayer));
      labels.push(board.label(state.points[i], "", "point-label", -5, -12, labelsLayer));
    }
    const levels = equal ? state.n - 1 : 1;
    for (let k = 1; k <= levels; k++) {
      const cls = k === 1 ? "incircle level1" : k === 2 ? "incircle level2" :
        k === 3 ? "incircle level3" : "incircle level-more";
      for (let i = 0; i + k < state.n; i++) {
        circles.push({ level: k, index: i, shape: board.circle(state.apex, 1, cls, circlesLayer) });
      }
    }
  }

  const baseNames = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"];
  const handles = baseNames.map((name, i) => board.handle(name, state.points[i] || state.apex, {
    r: 8, step: 2, shift: 10, layer: handlesLayer,
    label: "Point " + name + " on the base line. Drag it, or focus it and use the arrow keys to move it along the line.",
    clamp: (q) => ({ x: Geom.clamp(q.x, state.left + 2, state.right - 2), y: state.baseY }),
    onMove: (point) => {
      const i = baseNames.indexOf(name);
      if (i < 0 || i >= state.n) return;
      state = {
        ...state,
        points: state.points.map((p, k) => (k === i ? { x: point.x, y: point.y } : p)),
      };
      render();
    },
  }));
  const apexHandle = board.handle("A", state.apex, {
    r: 9, step: 2, shift: 10, cls: "geom-handle apex-handle", layer: handlesLayer,
    label: "Point A, the apex. Drag it, or focus it and use the arrow keys to move it.",
    clamp: (q) => ({
      x: Geom.clamp(q.x, 18, state.width - 18),
      y: Geom.clamp(q.y, 22, state.baseY - 22),
    }),
    onMove: (point) => {
      state = { ...state, apex: { x: point.x, y: point.y } };
      render();
    },
  });

  function render() {
    const equal = Core.equalFirstLevel(state);
    ensureShapes(equal);

    for (let i = 0; i < state.n; i++) rays[i].set(state.apex, state.points[i]);
    for (const item of circles) {
      const group = Core.circles(state, item.level);
      const c = group[item.index];
      item.shape.set(c.center, c.radius);
    }
    for (let i = 0; i < state.n; i++) {
      labels[i].set(state.points[i], state.showNames ? "M" + (i + 1) : "", -5, -12);
    }
    for (let i = 0; i < handles.length; i++) {
      handles[i].show(i < state.n);
      if (i < state.n) handles[i].set(state.points[i]);
    }
    apexHandle.set(state.apex);

    const rs = Core.radii(state, 1).map((r) => r.toFixed(1)).join(", ");
    const extra = equal
      ? " They match, so the wider triangles' circles match too."
      : " They differ; drag the points or press Make incircles equal.";
    say("Level 1 circle radii: " + rs + "." + extra);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function setCount(n) {
    const clamped = Geom.clamp(Math.round(n), Core.N_MIN, Core.N_MAX);
    nInput.value = String(clamped);
    state = Core.reset({ ...state, n: clamped }, {});
    render();
  }

  minusBtn.addEventListener("click", () => setCount(state.n - 1));
  plusBtn.addEventListener("click", () => setCount(state.n + 1));
  nInput.addEventListener("change", () => setCount(Number(nInput.value)));
  equalBtn.addEventListener("click", () => {
    state = Core.makeEqual(state, 1.6);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state, {});
    render();
  });
  namesChk.addEventListener("change", () => {
    state = { ...state, showNames: namesChk.checked };
    render();
  });

  board.onTheme(() => render());
  render();
})();
