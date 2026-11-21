"use strict";

/*
 * The page for Figurate Numbers in the Multiplication Table: drawing and input only; the
 * identities are in figurate-core.js. A canvas shows the 14 x 14 multiplication table; the cell
 * under the pointer (or a press, or the arrow keys, or the n box) picks n, and the cells of the
 * chosen identity light up with their sum and the formula under the table.
 */

(function () {
  const Core = FigurateCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const textEl = document.getElementById("identity");
  const nIn = document.getElementById("nIn");
  const modeInputs = [...document.querySelectorAll('input[name="mode"]')];
  const resetBtn = document.getElementById("resetBtn");
  const N = Core.SIZE, W = canvas.width, H = canvas.height, PAD = 8;
  const cell = (Math.min(W, H) - 2 * PAD) / (N + 1);

  let state = Core.start({});

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }
  const tok = (st, n, f) => st.getPropertyValue(n).trim() || f;
  const cx = (c) => PAD + c * cell, cy = (r) => PAD + r * cell;

  function draw() {
    const st = getComputedStyle(document.documentElement);
    const stage = tok(st, "--stage", "#f3f5f8"), ink = tok(st, "--ink", "#1f2430"), muted = tok(st, "--muted", "#5d6472"), accent = tok(st, "--accent", "#5b4ee8"), hl = tok(st, "--highlight", "#ffe08a");
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    const lit = new Set(Core.cells(state.mode, state.n).map(([c, r]) => c + "," + r));
    ctx.font = `${Math.max(9, cell * 0.42)}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) {
      if (r === 0 && c === 0) continue;
      const x = cx(c), y = cy(r);
      if (r === 0 || c === 0) { ctx.fillStyle = muted; ctx.fillText(String(r === 0 ? c : r), x + cell / 2, y + cell / 2); continue; }
      const on = lit.has(c + "," + r);
      if (on) { ctx.fillStyle = accent; ctx.globalAlpha = 0.85; ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2); ctx.globalAlpha = 1; }
      ctx.strokeStyle = muted; ctx.globalAlpha = 0.4; ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1); ctx.globalAlpha = 1;
      ctx.fillStyle = on ? "#ffffff" : ink; ctx.fillText(String(c * r), x + cell / 2, y + cell / 2);
    }
  }

  function render() {
    draw();
    nIn.value = String(state.n);
    for (const m of modeInputs) m.checked = m.value === state.mode;
    if (state.n > 0) {
      const id = Core.identity(state.mode, state.n);
      textEl.textContent = `Sum of the lit cells: ${id.sum}. ${id.text}`;
    } else textEl.textContent = "Move the pointer over the table, press a cell, or use the arrow keys.";
    if (window.Track) window.Track.state(state);
  }

  function apply(m) { const next = Core.move(state, m); if (!next) return false; state = next; render(); say(""); return true; }

  const cellAt = (e) => { const r = canvas.getBoundingClientRect(); const x = ((e.clientX - r.left) * W) / r.width, y = ((e.clientY - r.top) * H) / r.height; return [Math.floor((x - PAD) / cell), Math.floor((y - PAD) / cell)]; };
  canvas.addEventListener("pointermove", (e) => { const [c, r] = cellAt(e); const n = Core.hoverIndex(state.mode, c, r); if (n !== state.n) apply({ type: "hover", col: c, row: r }); });
  canvas.addEventListener("pointerdown", (e) => { const [c, r] = cellAt(e); apply({ type: "hover", col: c, row: r }); });
  canvas.addEventListener("keydown", (e) => {
    let n = state.n;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") n = Math.min(Core.SIZE, n + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") n = Math.max(0, n - 1);
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = Core.SIZE;
    else return;
    e.preventDefault(); apply({ type: "n", value: n });
  });
  nIn.addEventListener("change", () => { if (!apply({ type: "n", value: nIn.value })) { say(`n is a whole number from 0 to ${Core.SIZE}.`); nIn.value = String(state.n); } });
  for (const m of modeInputs) m.addEventListener("change", () => { if (m.checked) apply({ type: "mode", value: m.value }); });
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); render(); say("Back to the start."); });
  window.addEventListener("themechange", render);

  render();
})();
