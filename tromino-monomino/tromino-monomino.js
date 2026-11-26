"use strict";

/*
 * The page for Straight Tromino on a Chessboard: drawing and input only;
 * the rules are in tromino-monomino-core.js. An SVG board of N x M squares
 * with chess names on the edges. Click (or Enter on) a free square, then a
 * free square two away in its row or column, to lay a tromino over the
 * three. Trominoes show as sticks or as pieces; Show colours paints
 * Golomb's three colours.
 */

(function () {
  const Core = TrominoMonominoCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn"), mIn = document.getElementById("mIn");
  const colourBox = document.getElementById("colourBox");
  const removeBtn = document.getElementById("removeBtn");
  const NS = "http://www.w3.org/2000/svg";
  const PAD = 22, CELL = 40;

  let state = Core.start();
  let pick = null, cursor = [0, 0], hadFocus = false, note = "";

  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const square = () => document.querySelector('input[name="shape"]:checked').value === "nn";
  const sticks = () => document.querySelector('input[name="show"]:checked').value === "sticks";

  function render() {
    const { n, m } = state;
    svg.setAttribute("viewBox", `0 0 ${PAD + m * CELL + 4} ${n * CELL + PAD + 4}`);
    svg.style.maxWidth = `${Math.max(16, m * 2.6)}rem`;
    svg.textContent = "";
    const occ = Core.occupied(state);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const k = i * m + j, x = PAD + j * CELL, y = i * CELL;
      const g = el("g", { tabindex: cursor[0] === i && cursor[1] === j ? "0" : "-1", role: "button" }, "cell");
      g.dataset.i = String(i); g.dataset.j = String(j);
      g.setAttribute("aria-label", `${Core.name(state, i, j)}${occ.has(k) ? ", covered" : ", free"}${pick && pick[0] === i && pick[1] === j ? ", picked" : ""}`);
      const cls = ["sq", colourBox.checked ? `c${Core.colourA(i, j)}` : (i + j) % 2 ? "dark" : "light", pick && pick[0] === i && pick[1] === j ? "picked" : "", Core.finished(state) && !occ.has(k) ? "mono" : ""].join(" ");
      g.appendChild(el("rect", { x, y, width: CELL, height: CELL }, cls));
      svg.appendChild(g);
    }
    for (let j = 0; j < m; j++) svg.appendChild(el("text", { x: PAD + j * CELL + CELL / 2, y: n * CELL + 17 }, "coord", j < 26 ? String.fromCharCode(97 + j) : ""));
    for (let i = 0; i < n; i++) svg.appendChild(el("text", { x: PAD / 2, y: i * CELL + CELL / 2 + 5 }, "coord", String(n - i)));
    for (const p of state.pieces) {
      const [i1, j1, i2, j2] = p;
      const xa = PAD + Math.min(j1, j2) * CELL, ya = Math.min(i1, i2) * CELL;
      if (sticks()) svg.appendChild(el("line", { x1: PAD + j1 * CELL + CELL / 2, y1: i1 * CELL + CELL / 2, x2: PAD + j2 * CELL + CELL / 2, y2: i2 * CELL + CELL / 2 }, "stick"));
      else svg.appendChild(el("rect", { x: xa + 4, y: ya + 4, width: (Math.abs(j1 - j2) + 1) * CELL - 8, height: (Math.abs(i1 - i2) + 1) * CELL - 8, rx: 8 }, "piece"));
    }
    if (hadFocus) { const f = svg.querySelector('.cell[tabindex="0"]'); if (f) f.focus(); }
    removeBtn.disabled = !state.pieces.length;

    const t = Core.target(state), k = state.pieces.length;
    if (Core.finished(state)) {
      const left = Core.free(state).map(([i, j]) => Core.name(state, i, j));
      say(`All ${t} trominoes are down. ${left.length ? `${left.length === 1 ? "The monomino goes" : "Monominoes go"} on ${left.join(" and ")}.` : "The board is covered."}`, "win");
    } else say(note || (pick ? `${Core.name(state, ...pick)} picked: now a free square two away in its row or column.` : `${k} of ${t} trominoes placed. Pick a free square.`));
    note = "";
    if (window.Track) window.Track.state({ n, m, pieces: state.pieces });
  }
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function hit(i, j) {
    cursor = [i, j];
    const occ = Core.occupied(state);
    if (Core.finished(state)) { render(); return; }
    if (!pick) {
      if (occ.has(i * state.m + j)) note = `${Core.name(state, i, j)} is already covered.`;
      else pick = [i, j];
    } else if (pick[0] === i && pick[1] === j) pick = null;
    else {
      const s = Core.place(state, pick[0], pick[1], i, j);
      if (s) { state = s; pick = null; }
      else { note = `A tromino from ${Core.name(state, ...pick)} to ${Core.name(state, i, j)} does not fit. Pick again.`; pick = null; }
    }
    render();
  }
  svg.addEventListener("click", (e) => {
    const g = e.target.closest(".cell");
    if (!g) return;
    hadFocus = false;
    hit(Number(g.dataset.i), Number(g.dataset.j));
  });
  svg.addEventListener("keydown", (e) => {
    let [i, j] = cursor;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hadFocus = true; hit(i, j); return; }
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    i = Math.max(0, Math.min(state.n - 1, i + d[0])); j = Math.max(0, Math.min(state.m - 1, j + d[1]));
    cursor = [i, j]; hadFocus = true;
    render();
  });

  function reset() {
    const n = nIn.value;
    state = Core.start({ n, m: square() ? n : mIn.value });
    nIn.value = String(state.n); mIn.value = String(state.m);
    mIn.disabled = square();
    pick = null; cursor = [0, 0];
    render();
  }
  [nIn, mIn].forEach((x) => x.addEventListener("change", reset));
  document.querySelectorAll('input[name="shape"]').forEach((r) => r.addEventListener("change", reset));
  document.querySelectorAll('input[name="show"]').forEach((r) => r.addEventListener("change", render));
  colourBox.addEventListener("change", render);
  document.getElementById("resetBtn").addEventListener("click", reset);
  removeBtn.addEventListener("click", () => { const s = Core.removeLast(state); if (s) { state = s; pick = null; render(); } });

  reset();
})();
