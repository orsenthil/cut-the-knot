"use strict";

/*
 * The page for Play Hex Design: drawing and input only. The rules are in
 * play-hex-design-core.js. The board is an SVG rhombus of N x N dots on the
 * triangular grid, row j drawn half a step to the right of row j - 1. Selected
 * dots are filled and, up to N = 12, numbered in the order they were made; the
 * last one is ringed. A misstep flashes the dot it would have made. The arrow
 * keys move a cursor over the dots and Enter or Space clicks.
 */

(function () {
  const Core = PlayHexDesignCore;
  const NS = "http://www.w3.org/2000/svg";
  const board = document.getElementById("board");
  const cursorInfo = document.getElementById("cursorInfo");
  const statusEl = document.getElementById("status");
  const missedEl = document.getElementById("missed");
  const sizeIn = document.getElementById("size");
  const backBtn = document.getElementById("backBtn");

  const STEP = 30, MARGIN = 18, H = Math.sqrt(3) / 2;
  let state = Core.start({ n: Number(sizeIn.value) });
  let cursor = [0, 0];

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const el = (name, attrs) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  const xy = (n, i, j) => [MARGIN + (i + j / 2) * STEP, MARGIN + (n - 1 - j) * H * STEP];

  let dots = [];
  let builtFor = 0;

  /** Builds the dots and grid lines for size n (only when n changes). */
  function build(n) {
    board.replaceChildren();
    const w = 2 * MARGIN + (n - 1) * 1.5 * STEP, h = 2 * MARGIN + (n - 1) * H * STEP;
    board.setAttribute("viewBox", `0 0 ${w} ${h}`);
    board.style.minWidth = `${Math.max(18, n * 2.6)}rem`;
    const lines = el("g", { class: "grid" });
    for (let k = 0; k < n; k++) {
      const seg = (a, b) => { const [x1, y1] = xy(n, ...a), [x2, y2] = xy(n, ...b); lines.append(el("line", { x1, y1, x2, y2 })); };
      seg([0, k], [n - 1, k]); seg([k, 0], [k, n - 1]);
    }
    for (let k = 1; k < 2 * n - 2; k++) {
      // The third direction, i + j = k, inside the rhombus.
      const a = [Math.min(k, n - 1), k - Math.min(k, n - 1)], b = [k - Math.min(k, n - 1), Math.min(k, n - 1)];
      const [x1, y1] = xy(n, ...a), [x2, y2] = xy(n, ...b);
      lines.append(el("line", { x1, y1, x2, y2 }));
    }
    board.append(lines);
    dots = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const [cx, cy] = xy(n, i, j);
      const g = el("g", { class: "dot" });
      g.append(el("circle", { class: "hit", cx, cy, r: STEP / 2 }), el("circle", { class: "mark", cx, cy, r: STEP * 0.3 }));
      const label = el("text", { x: cx, y: cy, "text-anchor": "middle", "dominant-baseline": "central" });
      g.append(label);
      g.addEventListener("click", () => { cursor = [i, j]; play([i, j]); });
      board.append(g);
      dots.push({ i, j, g, label });
    }
    builtFor = n;
  }

  function describe(node) {
    const k = state.moves.findIndex((m) => m[0] === node[0] && m[1] === node[1]);
    const lastNode = Core.last(state);
    const where = `Dot ${node[0] + 1} along, row ${node[1] + 1}`;
    if (k < 0) return `${where}: empty.`;
    return `${where}: selected, number ${k}${lastNode && k === state.moves.length - 1 ? ", the last one" : ""}.`;
  }

  function render() {
    const n = state.n;
    if (builtFor !== n) build(n);
    const order = new Map(state.moves.map((m, k) => [m.join(), k]));
    const lastKey = state.moves.length ? state.moves[state.moves.length - 1].join() : null;
    for (const d of dots) {
      const key = `${d.i},${d.j}`;
      const k = order.get(key);
      d.g.classList.toggle("on", k !== undefined);
      d.g.classList.toggle("last", key === lastKey);
      d.g.classList.toggle("alert", !!state.alert && state.alert.join() === key);
      d.g.classList.toggle("cursor", cursor[0] === d.i && cursor[1] === d.j);
      d.label.textContent = k !== undefined && n <= 12 ? k : "";
    }
    missedEl.textContent = state.missed;
    backBtn.disabled = state.moves.length === 0;
    cursorInfo.textContent = document.activeElement === board ? describe(cursor) : "";
    board.setAttribute("aria-label", `Board of ${n} by ${n} dots, ${state.moves.length} selected. Arrow keys move, Enter clicks.`);

    if (Core.result(state) === "win") say(`All ${n * n} dots are filled, with ${state.missed} misstep${state.missed === 1 ? "" : "s"}.`, "win");
    else if (state.alert) say(`Misstep: that would make dot ${state.alert[0] + 1} along, row ${state.alert[1] + 1}, which is already selected.`);
    else if (state.moves.length === 0) say("Click any dot to start.");
    else say(`${state.moves.length} of ${n * n} dots filled.`);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function play(node) {
    const next = Core.click(state, node);
    if (!next) return;
    state = next;
    render();
  }

  board.addEventListener("keydown", (e) => {
    const n = state.n;
    const moves = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (moves[e.key]) {
      e.preventDefault();
      cursor = [Math.min(n - 1, Math.max(0, cursor[0] + moves[e.key][0])), Math.min(n - 1, Math.max(0, cursor[1] + moves[e.key][1]))];
      render();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      play(cursor);
    }
  });
  board.addEventListener("focus", render);
  board.addEventListener("blur", () => { cursorInfo.textContent = ""; });

  function reset() {
    state = Core.start({ n: Number(sizeIn.value) });
    sizeIn.value = state.n;
    cursor = [0, 0];
    render();
  }
  sizeIn.addEventListener("change", reset);
  document.getElementById("resetBtn").addEventListener("click", reset);
  backBtn.addEventListener("click", () => { state = Core.back(state); render(); });
  render();
})();
