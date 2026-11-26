"use strict";

/*
 * The page for Sierpinski's Gasket and Dihedral Symmetry: drawing and input
 * only; the steps are in sierpinski-dihedral-core.js. A canvas shows the
 * N x N grid, the top-left cell first; a cell that is not 0 (mod M) is
 * coloured by its value, and Show numbers writes the values in (grids up to
 * 32). The buttons take one step, several, or run to the far corner.
 */

(function () {
  const Core = SierpinskiDihedralCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nInput");
  const mIn = document.getElementById("mInput");
  const numBox = document.getElementById("numBox");
  const stepBtns = document.getElementById("stepBtns");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const dark = () => {
    const bg = css("--bg");
    const v = parseInt(bg.replace("#", "").slice(0, 2), 16);
    return Number.isFinite(v) && v < 128;
  };
  /** Value v (1..M-1) to a colour: spread round the hue circle; M = 2 uses the accent. */
  function colour(v) {
    if (state.m === 2) return css("--accent");
    const hue = (250 + (v - 1) * 360 / (state.m - 1)) % 360;
    return `hsl(${hue}, 70%, ${dark() ? 62 : 52}%)`;
  }

  function draw() {
    const W = canvas.width, n = state.n;
    const cell = (W - 20) / n;
    const ox = (W - cell * n) / 2;
    ctx.fillStyle = css("--surface");
    ctx.fillRect(0, 0, W, W);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = Core.at(state, i, j);
      if (!v) continue;
      ctx.fillStyle = colour(v);
      ctx.fillRect(ox + j * cell, ox + i * cell, cell, cell);
    }
    if (n <= 64) {
      ctx.strokeStyle = css("--border-strong");
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        ctx.moveTo(ox + k * cell, ox); ctx.lineTo(ox + k * cell, ox + n * cell);
        ctx.moveTo(ox, ox + k * cell); ctx.lineTo(ox + n * cell, ox + k * cell);
      }
      ctx.stroke();
    }
    if (numBox.checked && n <= Core.MAX_NUMBERS_N) {
      ctx.fillStyle = css("--accent-text");
      ctx.font = `600 ${Math.max(9, Math.floor(cell * 0.5))}px ${css("--font")}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const v = Core.at(state, i, j);
        if (v) ctx.fillText(String(v), ox + (j + 0.5) * cell, ox + (i + 0.5) * cell);
      }
    }
  }

  function render() {
    draw();
    numBox.disabled = state.n > Core.MAX_NUMBERS_N;
    if (state.n > Core.MAX_NUMBERS_N) numBox.checked = false;
    const rule = state.add ? "Add" : "Replace";
    say(`Step ${state.steps}. ${Core.lit(state)} of ${state.n * state.n} cells are not 0 modulo ${state.m} (${rule}, ${state.prongs} prongs).`);
    canvas.setAttribute("aria-label", `A ${state.n} by ${state.n} grid after ${state.steps} steps; ${Core.lit(state)} cells are coloured.`);
    if (window.Track) window.Track.state({ n: state.n, m: state.m, add: state.add, prongs: state.prongs, steps: state.steps });
  }

  const clampIn = (el, r) => { const v = Math.max(r.min, Math.min(r.max, Math.round(Number(el.value)))); el.value = String(Number.isFinite(v) ? v : r.def); return Number(el.value); };

  stepBtns.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const k = Number(b.dataset.steps);
    state = k === 1 ? Core.step(state) : Core.steps(state, k);
    render();
  });
  resetBtn.addEventListener("click", () => { state = Core.start({ n: state.n, m: state.m, add: state.add, prongs: state.prongs }); render(); });
  document.querySelectorAll('input[name="algo"]').forEach((el) => el.addEventListener("change", () => { state = Core.setAdd(state, el.value === "add"); render(); }));
  document.querySelectorAll('input[name="prongs"]').forEach((el) => el.addEventListener("change", () => { state = Core.setProngs(state, Number(el.value)); render(); }));
  nIn.addEventListener("change", () => { state = Core.setN(state, clampIn(nIn, Core.N_RANGE)); render(); });
  mIn.addEventListener("change", () => { state = Core.setM(state, clampIn(mIn, Core.M_RANGE)); render(); });
  numBox.addEventListener("change", draw);
  window.addEventListener("themechange", draw);

  render();
})();
