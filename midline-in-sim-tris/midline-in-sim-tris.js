"use strict";

/*
 * The page for Midline in Similar Triangles: drawing and input only. One SVG,
 * 400 by 300 (the applet's board). The four draggable points A, B, C and L
 * are handles with larger invisible touch areas; arrow keys move a focused one.
 * The rules are in midline-in-sim-tris-core.js.
 */

(function () {
  const Core = MidlineCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const NS = "http://www.w3.org/2000/svg";
  const box = { names: document.getElementById("showNames"), premise: document.getElementById("showPremise"), statement: document.getElementById("showStatement"), hint: document.getElementById("showHint") };

  let state = Core.start(), drag = null, focusName = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }
  const poly = (pts, cls) => el("polygon", { points: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "), class: cls });
  const seg = (p, q, cls) => el("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: cls });

  /** n small arcs at vertex v between the rays to p and q. */
  function angleMark(v, p, q, n, r0 = 16) {
    const a1 = Math.atan2(p.y - v.y, p.x - v.x);
    let d = Math.atan2(q.y - v.y, q.x - v.x) - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 0; k < n; k++) {
      const r = r0 + k * 4;
      const x1 = v.x + r * Math.cos(a1), y1 = v.y + r * Math.sin(a1), x2 = v.x + r * Math.cos(a1 + d), y2 = v.y + r * Math.sin(a1 + d);
      el("path", { d: `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${x2.toFixed(1)} ${y2.toFixed(1)}`, class: "arc" });
    }
  }
  /** n tick marks across the middle of segment pq. */
  function ticks(p, q, n) {
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const ux = (q.x - p.x) / L, uy = (q.y - p.y) / L;
    for (let k = 0; k < n; k++) {
      const o = (k - (n - 1) / 2) * 5;
      const cx = mx + ux * o, cy = my + uy * o;
      el("line", { x1: cx - uy * 5, y1: cy + ux * 5, x2: cx + uy * 5, y2: cy - ux * 5, class: "tick" });
    }
  }
  function label(p, text, dx, dy) { const t = el("text", { x: p.x + dx, y: p.y + dy, "text-anchor": "middle" }); t.textContent = text; }

  function render() {
    svg.textContent = "";
    const c = Core.compute(state);
    if (!c) { say("B and C are on top of each other: nothing to draw."); return; }
    const { A, B, C, K, L, N, D, E, F } = c;
    poly([A, K, B], "base"); poly([B, L, C], "base"); poly([C, N, A], "base");
    poly([A, B, C], "tri");
    seg(K, L, "mid");
    if (box.premise.checked) {
      angleMark(B, A, K, 1); angleMark(C, B, L, 1); angleMark(A, C, N, 1);
      angleMark(A, B, K, 2, 24); angleMark(B, C, L, 2, 24); angleMark(C, A, N, 2, 24);
      ticks(E, L, 2); ticks(E, K, 2); ticks(A, D, 1); ticks(D, B, 1);
    }
    if (box.hint.checked) {
      seg(D, F, "hint"); seg(F, E, "hint"); seg(D, E, "hint");
      angleMark(E, D, F, 1); angleMark(D, F, E, 2);
      ticks(B, F, 3); ticks(C, F, 3);
    }
    if (box.statement.checked) { seg(D, E, "de"); seg(C, N, "cn"); }
    for (const p of [D, E]) el("circle", { cx: p.x, cy: p.y, r: 4, class: "dot" });
    if (box.hint.checked) el("circle", { cx: F.x, cy: F.y, r: 4, class: "dot" });
    if (box.names.checked) {
      for (const [n, p, dx, dy] of [["A", A, 0, 20], ["B", B, 14, -8], ["C", C, -14, -8], ["K", K, 0, -10], ["L", L, 0, -10], ["N", N, 0, -10], ["D", D, 0, 18], ["E", E, 10, -8]]) label(p, n, dx, dy);
      if (box.hint.checked) label(F, "F", 0, 18);
    }
    for (const name of Core.NAMES) {
      const p = state[name];
      el("circle", { cx: p.x, cy: p.y, r: 20, class: "hit", "data-n": name }, svg);
      el("circle", { cx: p.x, cy: p.y, r: 6, class: "handle", tabindex: 0, role: "slider", "data-n": name, "aria-label": `Point ${name}, at ${Math.round(p.x)}, ${Math.round(p.y)}. Arrow keys move it.`, "aria-valuetext": `${Math.round(p.x)}, ${Math.round(p.y)}` }, svg);
    }
    if (focusName) { const h = svg.querySelector(`.handle[data-n="${focusName}"]`); if (h) h.focus(); }
    const cl = Core.claim(c);
    readout.textContent = `DE ∥ CN: ${cl.parallel ? "yes" : "no"}   |DE| / |CN| = ${cl.ratio === null ? "(CN is a point)" : cl.ratio.toFixed(4)}   triangles drawn ${Core.outward(state) ? "outward" : "inward"}`;
    say("", null);
    if (window.Track) window.Track.state({ A: state.A, B: state.B, C: state.C, L: state.L, ratio: cl.ratio, parallel: cl.parallel });
  }

  const toBoard = (e) => { const r = svg.getBoundingClientRect(); return { x: ((e.clientX - r.left) * Core.WIDTH) / r.width, y: ((e.clientY - r.top) * Core.HEIGHT) / r.height }; };
  svg.addEventListener("pointerdown", (e) => {
    const n = e.target.getAttribute && e.target.getAttribute("data-n");
    if (!n) return;
    drag = n; focusName = n; svg.setPointerCapture(e.pointerId); e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => { if (!drag) return; const p = toBoard(e), s = Core.move(state, drag, p.x, p.y); if (s) { state = s; render(); } });
  const release = () => { drag = null; };
  svg.addEventListener("pointerup", release); svg.addEventListener("pointercancel", release);
  svg.addEventListener("keydown", (e) => {
    const n = e.target.getAttribute && e.target.getAttribute("data-n");
    if (!n || !e.target.classList.contains("handle")) return;
    const step = e.shiftKey ? 10 : 2, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault(); focusName = n;
    const s = Core.move(state, n, state[n].x + d[0], state[n].y + d[1]); if (s) { state = s; render(); }
  });
  Object.values(box).forEach((b) => b.addEventListener("change", render));
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start(); focusName = null; render(); });
  render();
})();
