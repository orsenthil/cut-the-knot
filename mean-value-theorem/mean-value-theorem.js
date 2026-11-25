"use strict";

/*
 * The page for Rolle's and the Mean Value Theorems: drawing and input only. One
 * SVG; x runs from 0 to 10 and y from -20 to 12 (the curve's heights). The small
 * squares are the control points (drag them up and down), the blue circles A and
 * B and the red circle X slide along the curve. The rules are in
 * mean-value-theorem-core.js.
 */

(function () {
  const Core = MVTCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const NS = "http://www.w3.org/2000/svg";
  const W = 500, H = 340, PX = 40, SX = (W - 2 * PX) / 10, Y0 = 12, SY = 10;
  const sx = (x) => PX + x * SX, sy = (y) => 10 + (Y0 - y) * SY;
  const mx = (px) => (px - PX) / SX, my = (py) => Y0 - (py - 10) / SY;

  let state = Core.start();
  let drag = null, focusKey = null, found = -1;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    svg.appendChild(e);
    return e;
  }

  function handle(cls, x, y, key, label, r) {
    el("circle", { cx: x, cy: y, r: 22, class: "hit", "data-k": key });
    const h = cls === "knot" ? el("rect", { x: x - 7, y: y - 7, width: 14, height: 14, rx: 3, class: cls, tabindex: 0, role: "slider", "data-k": key, "aria-label": label })
      : el("circle", { cx: x, cy: y, r: r, class: cls, tabindex: 0, role: "slider", "data-k": key, "aria-label": label });
    return h;
  }

  function render() {
    svg.textContent = "";
    const cv = Core.curve(state), rd = Core.readings(state);
    el("line", { x1: sx(0), y1: sy(0), x2: sx(10), y2: sy(0), class: "axis" });
    // the curve
    let d = "";
    for (let i = 0; i <= 200; i++) { const x = i / 20; d += (i ? "L" : "M") + sx(x).toFixed(1) + " " + sy(cv.f(x)).toFixed(1); }
    el("path", { d, class: "curve" });
    const par = rd && rd.parallel;
    if (rd) {
      // the secant, extended a little past its ends
      const a = rd.a, b = rd.b, e = 0.4;
      const m = rd.secant, fa = rd.fa, x1 = Math.max(0, a - e), x2 = Math.min(10, b + e);
      el("line", { x1: sx(x1), y1: sy(fa + m * (x1 - a)), x2: sx(x2), y2: sy(fa + m * (x2 - a)), class: "secant" + (par ? " par" : "") });
      // the tangent at X
      const t = rd.tangent, x = state.x, f = cv.f(x), len = 1.8;
      const dx = len / Math.sqrt(1 + (t * SY) / SX * ((t * SY) / SX)) ;
      el("line", { x1: sx(x - dx), y1: sy(f - t * dx), x2: sx(x + dx), y2: sy(f + t * dx), class: "tangent" + (par ? " par" : "") });
    }
    // the control points
    state.ys.forEach((y, i) => handle("knot", sx(i), sy(y), "y" + i, `Curve point ${i + 1}, height ${y.toFixed(1)}. Up and down arrows change it.`, 0));
    handle("endpt", sx(state.a), sy(cv.f(state.a)), "a", `Point A at x = ${state.a.toFixed(2)}. Left and right arrows move it.`, 7);
    handle("endpt", sx(state.b), sy(cv.f(state.b)), "b", `Point B at x = ${state.b.toFixed(2)}. Left and right arrows move it.`, 7);
    handle("xpt" + (par ? " par" : ""), sx(state.x), sy(cv.f(state.x)), "x", `Tangent point at x = ${state.x.toFixed(2)}. Left and right arrows move it.`, 8);
    const t = el("text", { x: sx(state.a) - 4, y: sy(cv.f(state.a)) + 22, "text-anchor": "middle" }); t.textContent = "A";
    const u = el("text", { x: sx(state.b) + 4, y: sy(cv.f(state.b)) + 22, "text-anchor": "middle" }); u.textContent = "B";
    const v = el("text", { x: sx(state.x), y: sy(cv.f(state.x)) - 14, "text-anchor": "middle" }); v.textContent = "X";
    if (focusKey) { const f = svg.querySelector(`[tabindex][data-k="${focusKey}"]`); if (f) f.focus(); }
    if (rd) {
      readout.textContent = `a = ${rd.a.toFixed(2)}, b = ${rd.b.toFixed(2)}   f(a) = ${rd.fa.toFixed(2)}, f(b) = ${rd.fb.toFixed(2)}\nsecant slope = ${rd.secant.toFixed(3)}   tangent slope at x = ${state.x.toFixed(2)}: ${rd.tangent.toFixed(3)}`;
      if (par) say(`Parallel! The tangent at c = ${state.x.toFixed(3)} has the secant's slope ${rd.secant.toFixed(3)}${rd.rolle ? ", and since f(a) = f(b) this is Rolle's theorem: the slope is 0" : ""}.`, "done");
      else say(rd.inside ? "The tangent and the secant point different ways. Slide X." : "X is outside the interval from A to B: move it in between.");
    } else { readout.textContent = "A and B are at the same place: there is no line."; say(""); }
    if (window.Track) window.Track.state({ ys: state.ys, a: state.a, b: state.b, x: state.x, parallel: !!par });
  }

  const toModel = (e) => { const r = svg.getBoundingClientRect(); return { x: mx(((e.clientX - r.left) * W) / r.width), y: my(((e.clientY - r.top) * H) / r.height) }; };

  svg.addEventListener("pointerdown", (e) => {
    const k = e.target.getAttribute && e.target.getAttribute("data-k");
    if (!k) return;
    drag = k; focusKey = k; found = -1; svg.setPointerCapture(e.pointerId); e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = toModel(e);
    if (drag === "x") state = Core.moveX(state, p.x);
    else if (drag === "a" || drag === "b") state = Core.moveEnd(state, drag, p.x);
    else { const s = Core.setHeight(state, Number(drag.slice(1)), p.y); if (s) state = s; }
    render();
  });
  const release = () => { drag = null; };
  svg.addEventListener("pointerup", release); svg.addEventListener("pointercancel", release);
  svg.addEventListener("keydown", (e) => {
    const k = e.target.getAttribute && e.target.getAttribute("data-k");
    if (!k || !e.target.hasAttribute("tabindex")) return;
    const big = e.shiftKey;
    const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (!dir) return;
    e.preventDefault(); focusKey = k; found = -1;
    if (k === "x") state = Core.moveX(state, state.x + dir * (big ? 0.5 : 0.05));
    else if (k === "a" || k === "b") state = Core.moveEnd(state, k, state[k] + dir * (big ? 0.5 : 0.05));
    else { const s = Core.setHeight(state, Number(k.slice(1)), state.ys[Number(k.slice(1))] + dir * (big ? 2 : 0.25)); if (s) state = s; }
    render();
  });

  document.getElementById("findBtn").addEventListener("click", () => {
    const pts = Core.meanValuePoints(state);
    if (!pts.length) { say("There is no mean-value point: A and B are at the same place."); return; }
    found = (found + 1) % pts.length;
    state = { ...state, x: pts[found] };
    render();
    if (pts.length > 1) say(`Point ${found + 1} of ${pts.length}: c = ${pts[found].toFixed(3)}. Press Find c again for the next one.`, "done");
  });
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start(); focusKey = null; found = -1; render(); });
  render();
})();
