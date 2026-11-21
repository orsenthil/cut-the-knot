"use strict";

/*
 * The page for Counting Squares in a Square: drawing and input only; the rules
 * are in counting-squares-in-square-core.js. One canvas (400 by 400, scaled by
 * CSS) shows the N x N grid with a margin of one and a half cells all round,
 * and the draggable M x M square, which starts in the lower right corner. Cells
 * its upper left cell has reached are painted. Drag with a pointer, or focus
 * the canvas and use the arrow keys (one cell a step); two number boxes change
 * N and M; a line below says how many places have been painted of the total.
 */

(function () {
  const Core = CountingSquaresInSquareCore;
  const board = document.getElementById("board");
  const ctx = board.getContext("2d");
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const nIn = document.getElementById("nIn");
  const mIn = document.getElementById("mIn");
  const resetBtn = document.getElementById("resetBtn");
  const W = board.width;
  const ORANGE = "#e08a2e";

  let state = Core.start();
  let grab = null; // pointer offset inside the square while dragging

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const colour = (styles, name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  const cell = () => W / (state.n + 2 * Core.MARGIN); // pixels per cell
  const toPx = (u) => (u + Core.MARGIN) * cell();

  function draw() {
    const styles = getComputedStyle(document.documentElement);
    const stage = colour(styles, "--stage", "#f3f5f8");
    const ink = colour(styles, "--ink", "#1f2430");
    const muted = colour(styles, "--muted", "#5d6472");
    const accent = colour(styles, "--accent", "#5b4ee8");
    const A = cell();
    const n = state.n, m = state.m, s = Core.side(state);
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, W, W);

    // The N x N square with its grid.
    ctx.fillStyle = "rgba(127,127,127,0.10)";
    ctx.fillRect(toPx(0), toPx(0), n * A, n * A);
    // Painted places: the cell the moving square's upper left cell passed over.
    ctx.fillStyle = ORANGE;
    for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) {
      if (state.painted[i * s + j]) ctx.fillRect(toPx(i) + 1, toPx(j) + 1, A - 2, A - 2);
    }
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      ctx.moveTo(toPx(k), toPx(0)); ctx.lineTo(toPx(k), toPx(n));
      ctx.moveTo(toPx(0), toPx(k)); ctx.lineTo(toPx(n), toPx(k));
    }
    ctx.stroke();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(toPx(0), toPx(0), n * A, n * A);

    // The moving square, with its upper left cell marked.
    const x = toPx(state.pos.x), y = toPx(state.pos.y);
    ctx.fillStyle = "rgba(91,78,232,0.18)";
    ctx.fillRect(x, y, m * A, m * A);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, m * A, m * A);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 2, y + 2, A - 4, A - 4);
  }

  function updateText() {
    nIn.value = String(state.n);
    mIn.value = String(state.m);
    const s = Core.side(state);
    const places = s * s;
    const p = Core.paintedCount(state);
    readoutEl.textContent = places
      ? `${state.m} × ${state.m} squares in a ${state.n} × ${state.n} square: ${places} ${places === 1 ? "place" : "places"} (${s} × ${s}). Painted so far: ${p} of ${places}.`
      : `A ${state.m} × ${state.m} square does not fit in a ${state.n} × ${state.n} square: there are no places.`;
  }

  function render() {
    draw();
    updateText();
    if (window.Track) window.Track.state(state);
  }

  function apply(mv, note) {
    const next = Core.move(state, mv);
    if (!next) return false;
    state = next;
    render();
    const kind = Core.result(state);
    const s = Core.side(state);
    say(kind ? `Every place is painted: ${s * s} = (${state.n} − ${state.m} + 1)². All sizes together: ${Core.total(state.n)} squares.` : note || `Painted ${Core.paintedCount(state)} of ${s * s}.`, kind);
    return true;
  }

  function toUnits(e) {
    const rect = board.getBoundingClientRect();
    const f = W / rect.width;
    return { x: ((e.clientX - rect.left) * f) / cell() - Core.MARGIN, y: ((e.clientY - rect.top) * f) / cell() - Core.MARGIN };
  }

  board.addEventListener("pointerdown", (e) => {
    const p = toUnits(e);
    if (p.x < state.pos.x || p.x > state.pos.x + state.m || p.y < state.pos.y || p.y > state.pos.y + state.m) return;
    grab = { x: p.x - state.pos.x, y: p.y - state.pos.y };
    board.setPointerCapture(e.pointerId);
    board.focus();
    e.preventDefault();
  });
  board.addEventListener("pointermove", (e) => {
    if (!grab) return;
    const p = toUnits(e);
    apply({ type: "drag", x: p.x - grab.x, y: p.y - grab.y });
  });
  const stop = () => { grab = null; };
  board.addEventListener("pointerup", stop);
  board.addEventListener("pointercancel", stop);

  board.addEventListener("keydown", (e) => {
    const d = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[e.key.toLowerCase()];
    if (!d) return;
    e.preventDefault();
    apply({ type: "drag", x: Math.round(state.pos.x) + d[0], y: Math.round(state.pos.y) + d[1] });
  });

  const typed = (type) => (e) => {
    const v = Math.trunc(Number(e.target.value));
    if (!apply({ type, value: v }, type === "n" ? "N changed." : "M changed.")) say("That value is not allowed.");
    updateText();
  };
  nIn.addEventListener("change", typed("n"));
  mIn.addEventListener("change", typed("m"));
  resetBtn.addEventListener("click", () => { apply({ type: "reset" }); say("Back to the starting corner."); });
  window.addEventListener("themechange", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);

  render();
})();
