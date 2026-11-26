"use strict";

/*
 * The page for Steinhaus' Problem: drawing and input only; the check is in
 * steinhaus-problem-core.js. An SVG shows the segment [0, 1] with the next
 * numbered tile waiting in a box at the left. Drag it onto the line; the
 * placed tiles can be dragged again. The line is split into as many equal
 * pieces as there are tiles on it, so you can see which piece each tile is
 * in. Keyboard: Enter on the waiting tile puts it at 0.5; the arrow keys
 * move a tile by 0.005 (with Shift, by 0.05).
 */

(function () {
  const Core = SteinhausProblemCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const removeBtn = document.getElementById("removeBtn");
  const exampleSel = document.getElementById("exampleSel");
  const NS = "http://www.w3.org/2000/svg";
  const X0 = 90, X1 = 690, Y = 150, TW = 30, TH = 30;
  const xOf = (t) => X0 + ((X1 - X0) * t) / 1000;
  const tOf = (x) => ((x - X0) * 1000) / (X1 - X0);

  let state = Core.start();
  let drag = null, focusTile = null;

  Object.keys(Core.EXAMPLES).forEach((k) => { const o = document.createElement("option"); o.value = o.textContent = k; exampleSel.appendChild(o); });

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

  function tile(i, x, y, onLine) {
    const g = el("g", { transform: `translate(${x - TW / 2},${y})`, tabindex: "0", role: "button" }, `tile${onLine ? "" : " waiting"}`);
    g.dataset.i = String(i);
    g.setAttribute("aria-label", onLine ? `Tile ${i + 1} at ${Core.format(state.places[i])}; arrow keys move it` : `Tile ${i + 1}: drag it onto the line, or press Enter to put it at 0.5`);
    g.appendChild(el("rect", { width: TW, height: TH, rx: 6 }));
    g.appendChild(el("text", { x: TW / 2, y: TH / 2 + 6 }, "", String(i + 1)));
    return g;
  }

  const plural = (k) => ({ 2: "halves", 3: "thirds", 4: "quarters" })[k] || `${k}ths`;
  const single = (k) => ({ 2: "half", 3: "third", 4: "quarter" })[k] || `${k}th`;

  function render() {
    svg.textContent = "";
    const n = state.places.length;
    const k = Math.max(1, n);
    for (let j = 0; j < k; j++) svg.appendChild(el("rect", { x: xOf((1000 * j) / k), y: Y - 14, width: xOf((1000 * (j + 1)) / k) - xOf((1000 * j) / k), height: 28 }, `piece${j % 2 ? " odd" : ""}`));
    svg.appendChild(el("line", { x1: X0, y1: Y, x2: X1, y2: Y }, "axis"));
    for (let h = 0; h <= 10; h++) svg.appendChild(el("line", { x1: xOf(h * 100), y1: Y + 14, x2: xOf(h * 100), y2: Y + 22 }, "tick"));
    svg.appendChild(el("text", { x: X0, y: Y + 42 }, "end", "0"));
    svg.appendChild(el("text", { x: X1, y: Y + 42 }, "end", "1"));
    // values above the line, staggered so they do not overlap
    const order = state.places.map((t, i) => [t, i]).sort((a, b) => a[0] - b[0]);
    let lastX = -1e9, level = 0, tlast = -1e9, tlevel = 0;
    const row = [];
    for (const [t, i] of order) {
      const x = xOf(t);
      level = x - lastX < 46 ? (level + 1) % 3 : 0;
      lastX = x;
      tlevel = x - tlast < TW + 4 ? (tlevel + 1) % 3 : 0;
      tlast = x;
      row[i] = tlevel;
      svg.appendChild(el("text", { x, y: Y - 30 - 18 * level }, "value", Core.format(t)));
      svg.appendChild(el("line", { x1: x, y1: Y - 26 - 18 * level, x2: x, y2: Y - 4 }, "lead"));
    }
    // the box with the next tile
    svg.appendChild(el("rect", { x: 10, y: Y + 50, width: 56, height: 50, rx: 8 }, "box"));
    if (n < Core.TILES) svg.appendChild(tile(n, 38, Y + 60, false));
    state.places.forEach((t, i) => svg.appendChild(tile(i, xOf(t), Y + 20 + 34 * row[i], true)));
    if (focusTile !== null) { const f = svg.querySelector(`.tile[data-i="${focusTile}"]`); if (f) f.focus(); }
    removeBtn.disabled = n === 0;
    if (!n) say("Drag tile 1 onto the line.");
    else if (Core.ok(state)) say(n === 1 ? "One number: fine. Now tile 2 must go in the other half." : `All ${n} pass: ${n === 2 ? "tiles 1 and 2 are in different halves" : n === 3 ? "the first 2 are in different halves and all 3 in different thirds" : `the first 2 are in different halves, the first 3 in different thirds, …, all ${n} in different ${plural(n)}`}.${n === 17 ? " That is the most possible!" : ""}`, n >= 10 ? "done" : undefined);
    else {
      const tr = Core.trouble(state);
      const crowd = tr.crowded.map((c) => `tiles ${c.tiles.join(" and ")} are in the same ${single(tr.k)} (number ${c.piece})`).join("; ");
      say(`The first ${tr.k} are not in ${tr.k} different ${plural(tr.k)}: ${crowd || "a number at 1.00 is outside every piece"}.`);
    }
    if (window.Track) window.Track.state({ places: state.places });
  }

  const toX = (e) => { const r = svg.getBoundingClientRect(); return ((e.clientX - r.left) * 700) / r.width; };
  svg.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".tile");
    if (!t) return;
    drag = { i: Number(t.dataset.i), g: t };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.g.setAttribute("transform", `translate(${toX(e) - TW / 2},${Y + 20})`);
  });
  svg.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const x = toX(e), i = drag.i;
    drag = null;
    if (x < X0 - 20 && i === state.places.length) { render(); return; } // dropped back in the box
    const s = Core.place(state, i, tOf(x));
    if (s) state = s;
    focusTile = null;
    render();
  });
  svg.addEventListener("keydown", (e) => {
    const t = e.target.closest && e.target.closest(".tile");
    if (!t) return;
    const i = Number(t.dataset.i);
    if (i === state.places.length) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); state = Core.place(state, i, 500); focusTile = i; render(); }
      return;
    }
    const d = { ArrowLeft: -5, ArrowRight: 5, ArrowDown: -5, ArrowUp: 5 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    state = Core.place(state, i, Math.max(0, Math.min(1000, state.places[i] + d * (e.shiftKey ? 10 : 1))));
    focusTile = i;
    render();
  });
  removeBtn.addEventListener("click", () => { const s = Core.removeLast(state); if (s) { state = s; render(); } });
  document.getElementById("exampleBtn").addEventListener("click", () => { state = Core.start({ places: Core.EXAMPLES[exampleSel.value] }); focusTile = null; render(); });
  document.getElementById("clearBtn").addEventListener("click", () => { state = Core.start(); focusTile = null; render(); });

  render();
})();
