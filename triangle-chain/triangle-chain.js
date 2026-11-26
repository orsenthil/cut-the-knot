"use strict";

/*
 * The page for Counting Triangles II: drawing and input only; the rules are
 * in triangle-chain-core.js. An SVG shows the big triangle cut into n^2
 * small ones. Click a triangle to count it: the first anywhere, then each
 * next to the last. Counted triangles show their numbers, refused clicks an
 * X. Show hint paints them like a chessboard. Keyboard: arrows move between
 * triangles, Enter counts.
 */

(function () {
  const Core = TriangleChainCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn");
  const hintBox = document.getElementById("hintBox");
  const removeBtn = document.getElementById("removeBtn");
  const NS = "http://www.w3.org/2000/svg";
  const W = 400, TOP = 14, SIDE = 372;

  let state = Core.start();
  let cursor = { k: 0, p: 0 }, hadFocus = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  function el(name, attrs, cls, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** Corners of triangle (k, p). */
  function corners(t) {
    const n = state.n, a = SIDE / n, h = (a * Math.sqrt(3)) / 2;
    const x0 = W / 2 - ((t.k + 1) * a) / 2, y0 = TOP + t.k * h;
    const j = Math.floor(t.p / 2);
    if (t.p % 2 === 0) return [[x0 + j * a, y0 + h], [x0 + (j + 1) * a, y0 + h], [x0 + j * a + a / 2, y0]];
    return [[x0 + j * a + a / 2, y0], [x0 + (j + 1) * a + a / 2, y0], [x0 + (j + 1) * a, y0 + h]];
  }

  function render() {
    svg.textContent = "";
    svg.style.minWidth = `${Math.max(15, state.n * 2.2)}rem`; // a triangle stays a fingertip wide; a big board slides
    const labels = new Map();
    state.stack.forEach((t, i) => {
      const key = `${t.k},${t.p}`;
      if (t.x) { if (!labels.has(key)) labels.set(key, "X"); }
      else labels.set(key, String(Core.chain({ ...state, stack: state.stack.slice(0, i + 1) }).length));
    });
    const last = Core.last(state);
    for (const t of Core.triangles(state.n)) {
      const key = `${t.k},${t.p}`, c = corners(t);
      const counted = Core.chain(state).some((q) => q.k === t.k && q.p === t.p);
      const cls = ["tri", hintBox.checked ? (Core.isUp(t) ? "up" : "down") : "", counted ? "counted" : "", last && last.k === t.k && last.p === t.p ? "last" : ""].join(" ");
      const g = el("g", { tabindex: cursor.k === t.k && cursor.p === t.p ? "0" : "-1", role: "button" }, "cell");
      g.dataset.k = String(t.k); g.dataset.p = String(t.p);
      g.setAttribute("aria-label", `Row ${t.k + 1}, triangle ${t.p + 1}${labels.has(key) ? `, ${labels.get(key) === "X" ? "refused" : `counted as ${labels.get(key)}`}` : ""}`);
      g.appendChild(el("polygon", { points: c.map((q) => q.join(",")).join(" ") }, cls));
      if (labels.has(key)) {
        const cx = (c[0][0] + c[1][0] + c[2][0]) / 3, cy = (c[0][1] + c[1][1] + c[2][1]) / 3;
        g.appendChild(el("text", { x: cx, y: cy + 5, "font-size": Math.max(10, 150 / state.n) }, labels.get(key) === "X" ? "mark x" : "mark", labels.get(key)));
      }
      svg.appendChild(g);
    }
    if (hadFocus) { const f = svg.querySelector('[tabindex="0"]'); if (f) f.focus(); }
    removeBtn.disabled = !state.stack.length;
    const n = state.n, k = Core.count(state);
    if (Core.result(state) === "win") say(`${k} triangles: the most anyone can count when n = ${n}.`, "win");
    else if (state.stack.length && state.stack[state.stack.length - 1].x) say(`That triangle is not next to triangle ${k}, or it is counted already. Remove last and try another.`);
    else say(k ? `${k} counted. The most possible for n = ${n} is ${Core.best(n)} of the ${n * n}.` : `Click any triangle to start counting.`);
    if (window.Track) window.Track.state({ n, stack: state.stack });
  }

  function hit(k, p) {
    const s = Core.click(state, k, p);
    if (s) state = s;
    cursor = { k, p };
    render();
  }
  svg.addEventListener("click", (e) => {
    const g = e.target.closest(".cell");
    if (!g) return;
    hadFocus = false;
    hit(Number(g.dataset.k), Number(g.dataset.p));
  });
  svg.addEventListener("keydown", (e) => {
    let { k, p } = cursor;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hadFocus = true; hit(k, p); return; }
    if (e.key === "ArrowLeft") p = Math.max(0, p - 1);
    else if (e.key === "ArrowRight") p = Math.min(2 * k, p + 1);
    else if (e.key === "ArrowUp") { if (k > 0) { k--; p = Math.min(Math.max(0, p - 1), 2 * k); } }
    else if (e.key === "ArrowDown") { if (k < state.n - 1) { k++; p = Math.min(p + 1, 2 * k); } }
    else return;
    e.preventDefault();
    cursor = { k, p }; hadFocus = true;
    render();
  });
  function reset() {
    state = Core.start({ n: nIn.value });
    nIn.value = String(state.n);
    cursor = { k: 0, p: 0 };
    render();
  }
  nIn.addEventListener("change", reset);
  document.getElementById("resetBtn").addEventListener("click", reset);
  removeBtn.addEventListener("click", () => { const s = Core.removeLast(state); if (s) { state = s; render(); } });
  hintBox.addEventListener("change", render);

  render();
})();
