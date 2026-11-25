"use strict";

/*
 * The page for Napoleon's Theorem and the Petr-Douglas-Neumann Theorem: drawing
 * and input only. One SVG (500 by 360): the base polygon (dark) with draggable
 * corners, and the polygons made from it, in colours, the last thickest. The rules are in
 * napoleon-polygons-core.js.
 */

(function () {
  const Core = NapoleonCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const el = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const COLOURS = ["#e5624d", "#3fb27f", "#4a86e8", "#f0b247", "#c77dd6", "#41b6b6", "#8ab33f"];

  let state = Core.start();
  let drag = -1, focusIdx = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function node(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    svg.appendChild(e);
    return e;
  }
  const path = (pts) => "M" + pts.map((p) => p.x.toFixed(1) + " " + p.y.toFixed(1)).join("L") + "Z";

  function render() {
    const n = state.n, polys = Core.polygons(state), steps = Core.stepsFor(n, state.m);
    el("nOut").textContent = n; el("mOut").textContent = state.m; el("n").value = n;
    el("m").max = n - 1; el("m").value = state.m;
    svg.textContent = "";
    // the triangles on the sides at each step
    if (state.showTriangles) {
      let prev = state.points;
      polys.forEach((poly, i) => {
        const colour = COLOURS[i % COLOURS.length];
        for (let j = 0; j < n; j++) {
          const a = prev[(j + n - 1) % n], b = prev[j], c = poly[j];
          node("path", { d: path([a, b, c]), class: "tri", stroke: colour });
        }
        prev = poly;
      });
    }
    polys.forEach((poly, i) => node("path", { d: path(poly), class: "poly" + (i === polys.length - 1 ? " last" : ""), stroke: COLOURS[i % COLOURS.length] }));
    node("path", { d: path(state.points), class: "base" });
    state.points.forEach((p, i) => {
      node("circle", { cx: p.x, cy: p.y, r: 22, class: "hit", "data-i": i });
      node("circle", { cx: p.x, cy: p.y, r: 7, class: "vert", tabindex: 0, role: "slider", "data-i": i, "aria-label": `Corner ${i + 1} at ${Math.round(p.x)}, ${Math.round(p.y)}. Arrow keys move it.` });
    });
    if (focusIdx !== null) { const f = svg.querySelector(`.vert[data-i="${focusIdx}"]`); if (f) f.focus(); }
    const last = polys[polys.length - 1];
    if (last) {
      const f = state.m === 0 ? 0 : n - state.m, g = Core.regularity(last, f);
      readout.textContent = state.m === 0
        ? `Nothing is left out: after ${steps.length} steps the polygon has shrunk to a point (the centre of gravity), size ${g.radius.toExponential(1)}.`
        : `${steps.length} steps (${steps.join(", ")}); the last polygon is a regular ${n}-gon${f !== 1 && f !== n - 1 ? " (a star, turning " + Math.min(f, n - f) + " times)" : ""}: its corners differ from a perfect one by ${g.dev.toExponential(1)}.`;
      say(state.m === 0 ? "" : "The last polygon is regular, however you drag the corners.", state.m === 0 ? null : "done");
    }
    if (window.Track) window.Track.state({ n, m: state.m, points: state.points, showTriangles: state.showTriangles });
  }

  const toBoard = (e) => { const r = svg.getBoundingClientRect(); return { x: ((e.clientX - r.left) * Core.WIDTH) / r.width, y: ((e.clientY - r.top) * Core.HEIGHT) / r.height }; };
  svg.addEventListener("pointerdown", (e) => {
    const i = e.target.getAttribute && e.target.getAttribute("data-i");
    if (i === null || i === undefined) return;
    drag = Number(i); focusIdx = drag; svg.setPointerCapture(e.pointerId); e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => { if (drag < 0) return; const p = toBoard(e), s = Core.movePoint(state, drag, p.x, p.y); if (s) { state = s; render(); } });
  const release = () => { drag = -1; };
  svg.addEventListener("pointerup", release); svg.addEventListener("pointercancel", release);
  svg.addEventListener("keydown", (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("vert")) return;
    const i = Number(t.getAttribute("data-i")), step = e.shiftKey ? 20 : 4;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault(); focusIdx = i;
    const s = Core.movePoint(state, i, state.points[i].x + d[0], state.points[i].y + d[1]); if (s) { state = s; render(); }
  });
  el("n").addEventListener("input", () => { state = Core.setN(state, el("n").value); focusIdx = null; render(); });
  el("m").addEventListener("input", () => { state = Core.setM(state, el("m").value); render(); });
  el("tri").addEventListener("change", () => { state = Core.setTriangles(state, el("tri").checked); render(); });
  el("resetBtn").addEventListener("click", () => { state = Core.setN(state, state.n); focusIdx = null; render(); });
  render();
})();
