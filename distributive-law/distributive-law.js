"use strict";

/*
 * The page for the Distributive Law: drawing and input only; the rules are in
 * distributive-law-core.js. A canvas draws the board of squares; a piece is cut
 * by pressing in the gap between two columns or two rows, or with the keyboard:
 * move the marked square with the arrow keys and press C (cut after its column)
 * or R (cut below its row), or use the two buttons. The list underneath is the
 * applet's drop-down of everything written so far, newest first.
 */

(function () {
  const Core = DistributiveLawCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const exprEl = document.getElementById("expr");
  const histEl = document.getElementById("history");
  const nxIn = document.getElementById("nxIn");
  const nyIn = document.getElementById("nyIn");
  const parBox = document.getElementById("parBox");
  const cutCol = document.getElementById("cutCol");
  const cutRow = document.getElementById("cutRow");
  const resetBtn = document.getElementById("resetBtn");
  const W = canvas.width, H = canvas.height, PAD = 14;

  let state = Core.start({});
  let cur = { c: 0, r: 0 };

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state); // a finished block stays finished
    if (kind) statusEl.classList.add(kind);
  }
  const show = (e) => e.replace(/\*/g, "×").replace(/\+/g, " + ");
  const tok = (st, n, f) => st.getPropertyValue(n).trim() || f;

  function geometry() {
    const cell = Math.min((W - 2 * PAD) / state.nx, (H - 2 * PAD) / state.ny);
    return { cell, x0: (W - cell * state.nx) / 2, y0: (H - cell * state.ny) / 2 };
  }

  function draw() {
    const st = getComputedStyle(document.documentElement);
    const stage = tok(st, "--stage", "#f3f5f8"), ink = tok(st, "--ink", "#1f2430"), accent = tok(st, "--accent", "#5b4ee8"), hl = tok(st, "--highlight", "#ffe08a");
    const g = geometry();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    const pieces = Core.pieces(state);
    const gap = Math.max(2, g.cell * 0.12);
    pieces.forEach((p, i) => {
      const sx = g.x0 + p.x * g.cell, sy = g.y0 + p.y * g.cell;
      // pieces of one shade, told apart by hue; cells are drawn as squares with small gaps
      ctx.fillStyle = `hsl(${(i * 47) % 360}, 65%, 62%)`;
      for (let c = 0; c < p.w; c++) for (let r = 0; r < p.h; r++) {
        ctx.fillRect(sx + c * g.cell + gap / 2, sy + r * g.cell + gap / 2, g.cell - gap, g.cell - gap);
      }
      ctx.strokeStyle = ink; ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, p.w * g.cell - 2, p.h * g.cell - 2);
    });
    const p = Core.pieceAt(state, cur.c, cur.r);
    if (p) {
      ctx.strokeStyle = accent; ctx.lineWidth = 4;
      ctx.strokeRect(g.x0 + cur.c * g.cell + 2, g.y0 + cur.r * g.cell + 2, g.cell - 4, g.cell - 4);
    }
  }

  function updateControls() {
    const p = Core.pieceAt(state, cur.c, cur.r);
    cutCol.disabled = !p || cur.c - p.x + 1 >= p.w;
    cutRow.disabled = !p || cur.r - p.y + 1 >= p.h;
    nxIn.value = String(state.nx); nyIn.value = String(state.ny);
    parBox.checked = state.parentheses;
    exprEl.textContent = show(Core.expression(state)) + " = " + state.nx * state.ny;
    histEl.textContent = "";
    for (const h of state.history) { const li = document.createElement("li"); li.textContent = show(h); histEl.appendChild(li); }
  }

  function render() {
    draw();
    updateControls();
    if (window.Track) window.Track.state(state);
  }

  function cut(axis, c, r, note) {
    const next = Core.move(state, { type: "cut", axis, c, r });
    if (!next) return false;
    state = next;
    render();
    const left = Core.remaining(state);
    say(left === 0 ? "Every piece is one square: the product is written as a sum of " + state.nx * state.ny + " ones." : note || `${left} more cut${left === 1 ? "" : "s"} to single squares.`, Core.result(state));
    return true;
  }

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect(), g = geometry();
    const px = ((e.clientX - rect.left) * W) / rect.width, py = ((e.clientY - rect.top) * H) / rect.height;
    const fx = (px - g.x0) / g.cell, fy = (py - g.y0) / g.cell;
    const tol = Math.max(0.2, (6 * W) / rect.width / g.cell / 2); // the applet is 3 pixels either side of a gap
    if (fx < 0 || fy < 0 || fx > state.nx || fy > state.ny) return;
    const nc = Math.round(fx), nr = Math.round(fy);
    const col = Math.abs(fx - nc) <= tol && nc >= 1 && nc < state.nx, row = Math.abs(fy - nr) <= tol && nr >= 1 && nr < state.ny;
    // the nearer gap wins when both are close
    const useCol = col && (!row || Math.abs(fx - nc) <= Math.abs(fy - nr));
    if (useCol) { cur = { c: nc - 1, r: Math.min(state.ny - 1, Math.max(0, Math.floor(fy))) }; if (!cut("col", cur.c, cur.r)) say("That gap is already a cut."); }
    else if (row) { cur = { c: Math.min(state.nx - 1, Math.max(0, Math.floor(fx))), r: nr - 1 }; if (!cut("row", cur.c, cur.r)) say("That gap is already a cut."); }
    else { cur = { c: Math.min(state.nx - 1, Math.floor(fx)), r: Math.min(state.ny - 1, Math.floor(fy)) }; render(); say("Press in a gap between squares to cut there."); }
  });

  canvas.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowRight") cur.c = Math.min(state.nx - 1, cur.c + 1);
    else if (k === "ArrowLeft") cur.c = Math.max(0, cur.c - 1);
    else if (k === "ArrowDown") cur.r = Math.min(state.ny - 1, cur.r + 1);
    else if (k === "ArrowUp") cur.r = Math.max(0, cur.r - 1);
    else if (k === "c" || k === "C" || k === "Enter") { e.preventDefault(); if (!cut("col", cur.c, cur.r)) say("There is no gap to the right of this square inside its piece."); return; }
    else if (k === "r" || k === "R") { e.preventDefault(); if (!cut("row", cur.c, cur.r)) say("There is no gap below this square inside its piece."); return; }
    else return;
    e.preventDefault(); render();
    say(`Square at column ${cur.c + 1}, row ${cur.r + 1}.`);
  });

  cutCol.addEventListener("click", () => { cut("col", cur.c, cur.r); });
  cutRow.addEventListener("click", () => { cut("row", cur.c, cur.r); });
  function resize() {
    const next = Core.move(state, { type: "size", nx: nxIn.value, ny: nyIn.value });
    if (!next) { say(`Width and height are whole numbers from ${Core.MIN_SIZE} to ${Core.MAX_SIZE}.`); updateControls(); return; }
    state = next; cur = { c: 0, r: 0 }; render(); say(`A new board: ${state.ny} rows of ${state.nx}.`);
  }
  nxIn.addEventListener("change", resize);
  nyIn.addEventListener("change", resize);
  parBox.addEventListener("change", () => { state = Core.move(state, { type: "parentheses", value: parBox.checked }); render(); });
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); cur = { c: 0, r: 0 }; render(); say("Back to one rectangle."); });
  window.addEventListener("themechange", render);

  render();
})();
