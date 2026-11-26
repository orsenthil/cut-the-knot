"use strict";

/*
 * The page for Geometric Series in a Square: drawing and input only; the
 * cutting is in geometric-series-square-core.js. A canvas shows the unit
 * square with every piece outlined and the shaded ones filled. N (1..20)
 * sets how many times it has been cut, as the applet's spinner did; the
 * radio buttons pick the series with ratio 1/2, 1/3 or 1/4, and switching
 * starts again from N = 1, as in the applet.
 */

(function () {
  const Core = GeometricSeriesSquareCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const nOut = document.getElementById("nValue");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const resetBtn = document.getElementById("resetBtn");
  const note = document.getElementById("note");

  let state = Core.start({ kind: 2, n: 1 });

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function draw() {
    const W = canvas.width, M = 12, S = W - 2 * M;
    ctx.fillStyle = css("--stage");
    ctx.fillRect(0, 0, W, W);
    const fill = css("--accent"), ink = css("--ink");
    const pieces = Core.pieces(state);
    ctx.lineWidth = 1;
    for (const p of pieces) {
      const x = M + p.x * S, y = M + p.y * S, w = p.w * S, h = p.h * S;
      if (p.painted) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
      ctx.strokeStyle = ink;
      ctx.strokeRect(x, y, w, h);
    }
    ctx.lineWidth = 2;
    ctx.strokeRect(M, M, S, S);
  }

  function render() {
    draw();
    nOut.textContent = String(state.n);
    lessBtn.disabled = state.n <= Core.MIN_N;
    moreBtn.disabled = state.n >= Core.MAX_N;
    say(Core.sumText(state));
    const k = Core.steps(state), cap = Core.MAX_DRAWN_DEPTH[state.kind];
    note.textContent = k > cap ? `The picture stops cutting after ${cap} steps: the pieces would be far smaller than a dot on the screen. The sum above still counts all ${k}.` : "";
    canvas.setAttribute("aria-label", `A square cut ${k} time${k === 1 ? "" : "s"}; the shaded part is ${Core.sumText(state)}`);
    if (window.Track) window.Track.state(state);
  }

  function setN(n) {
    state = Core.start({ kind: state.kind, n });
    render();
  }

  lessBtn.addEventListener("click", () => setN(state.n - 1));
  moreBtn.addEventListener("click", () => setN(state.n + 1));
  resetBtn.addEventListener("click", () => setN(1));
  document.querySelectorAll('input[name="kind"]').forEach((el) => el.addEventListener("change", () => {
    state = Core.start({ kind: Number(el.value), n: 1 });
    render();
  }));
  window.addEventListener("themechange", draw);

  render();
})();
