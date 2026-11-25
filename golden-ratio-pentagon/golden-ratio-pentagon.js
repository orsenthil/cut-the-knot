"use strict";

/*
 * The page for Golden Ratio in an Irregular Pentagon: drawing and input only.
 * One SVG in screen coordinates. The three big dots X, Z and D are the free
 * points of the applet's construction (drag them, or use the arrow keys when
 * one is focused); everything else is built from them in
 * golden-ratio-pentagon-core.js.
 */

(function () {
  const Core = PentagonCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const earsBox = document.getElementById("earsBox"), namesBox = document.getElementById("namesBox"), newBtn = document.getElementById("newBtn");
  const NS = "http://www.w3.org/2000/svg";

  let state = Core.start();
  let drag = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    svg.appendChild(e);
    return e;
  }

  const poly = (v) => v.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  function label(p, text, dx, dy) { el("text", { x: p.x + dx, y: p.y + dy, "text-anchor": "middle" }, text); }

  function render() {
    svg.textContent = "";
    const b = Core.build(state);
    const v = Core.corners(b), m = Core.measure(v);
    if (earsBox.checked) {
      v.forEach((_, i) => el("polygon", { points: poly([v[i], v[(i + 1) % 5], v[(i + 2) % 5]]), class: "ear e" + (i === 0 ? 1 : 0) }));
    }
    // the diagonals
    for (let i = 0; i < 5; i++) el("line", { x1: v[i].x, y1: v[i].y, x2: v[(i + 2) % 5].x, y2: v[(i + 2) % 5].y, class: "diag" });
    el("polygon", { points: poly(m.inner), class: "inner" });
    el("polygon", { points: poly(v), class: "pent" });
    // the construction's helper lines
    el("line", { x1: b.X.x, y1: b.X.y, x2: b.Z.x, y2: b.Z.y, class: "helper" });
    [b.A, b.B, b.C, b.D, b.E].forEach((p) => el("circle", { cx: p.x, cy: p.y, r: 3.5, class: "dot" }));
    if (namesBox.checked) {
      const c = { x: (v[0].x + v[1].x + v[2].x + v[3].x + v[4].x) / 5, y: (v[0].y + v[1].y + v[2].y + v[3].y + v[4].y) / 5 };
      ["A", "B", "C", "D", "E"].forEach((n, i) => {
        const dx = v[i].x - c.x, dy = v[i].y - c.y, len = Math.hypot(dx, dy) || 1;
        label(v[i], n, (dx / len) * 14, (dy / len) * 14 + 5);
      });
    }
    // the three free points
    ["X", "Z", "D"].forEach((k) => {
      const p = state[k];
      el("circle", { cx: p.x, cy: p.y, r: 20, class: "hit", "data-k": k });
      el("circle", { cx: p.x, cy: p.y, r: 8, class: "free", tabindex: 0, role: "slider", "data-k": k, "aria-label": `Point ${k}. Arrow keys move it.` });
      if (namesBox.checked && k !== "D") label(p, k, 0, -14);
    });
    describe(m);
    if (window.Track) window.Track.state({ ...state, ratio: m.ratio });
  }

  function describe(m) {
    const t = m.ears[0], f = (n) => (Math.round(n * 10) / 10).toString();
    const spread = Math.max(...m.ears) - Math.min(...m.ears);
    readout.textContent = `Each of the five corner triangles has area ${f(t)}${spread < 1e-6 * t ? " (all equal)" : ""}. The pentagon has area ${f(m.area)}, which is ${(m.ratio).toFixed(4)} times one triangle; (5 + √5)/2 = ${Core.AREA_RATIO.toFixed(4)}.`;
    say(Math.abs(m.ratio - Core.AREA_RATIO) < 1e-6 ? "Equal triangles, and the pentagon is always 3.618... of one of them." : "", Math.abs(m.ratio - Core.AREA_RATIO) < 1e-6 ? "done" : "");
  }

  const toModel = (e) => { const r = svg.getBoundingClientRect(); return { x: ((e.clientX - r.left) * Core.W) / r.width, y: ((e.clientY - r.top) * Core.H) / r.height }; };

  svg.addEventListener("pointerdown", (e) => {
    const k = e.target.getAttribute && e.target.getAttribute("data-k");
    if (!k) return;
    drag = k;
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = toModel(e), next = Core.move(state, drag, p.x, p.y);
    if (next) { state = next; render(); }
  });
  const end = () => { drag = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", (e) => {
    const k = e.target.getAttribute && e.target.getAttribute("data-k");
    const d = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[e.key];
    if (!k || !d) return;
    e.preventDefault();
    const next = Core.move(state, k, state[k].x + d[0], state[k].y + d[1]);
    if (next) { state = next; render(); const f = svg.querySelector(`[tabindex][data-k="${k}"]`); if (f) f.focus(); }
  });

  earsBox.addEventListener("change", render);
  namesBox.addEventListener("change", render);
  newBtn.addEventListener("click", () => { state = Core.start(); render(); });
  render();
})();
