"use strict";

/*
 * The page for Addition and Subtraction of Functions: drawing and input only.
 * One SVG, x from -5 to 5 and y from -14 to 14. Pressing near the black or the
 * green curve takes the nearest control point and moves it up and down; the
 * small squares (when "Show points" is on) are the control points. The rules
 * and the curves are in adding-functions-core.js.
 */

(function () {
  const Core = FunctionsCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const opAdd = document.getElementById("opAdd"), opSub = document.getElementById("opSub");
  const shadeBox = document.getElementById("shadeBox"), ptsBox = document.getElementById("ptsBox");
  const probe = document.getElementById("probe"), newBtn = document.getElementById("newBtn");
  const keyRColor = document.getElementById("keyRColor"), keyRText = document.getElementById("keyRText");
  const NS = "http://www.w3.org/2000/svg";
  const W = 500, H = 340, PX = 20, SX = (W - 2 * PX) / 10, SY = H / (2 * Core.YLIMIT);
  const sx = (x) => PX + (x + 5) * SX, sy = (y) => H / 2 - y * SY;
  const mx = (px) => (px - PX) / SX - 5, my = (py) => (H / 2 - py) / SY;

  let state = Core.start();
  let drag = null;       // { which, index }

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

  function path(fn) {
    let d = "";
    for (let i = 0; i <= 200; i++) { const x = -5 + i / 20; d += (i ? "L" : "M") + sx(x).toFixed(1) + " " + sy(fn(x)).toFixed(1); }
    return d;
  }

  function render() {
    svg.textContent = "";
    const c = Core.curves(state);
    el("line", { x1: 0, y1: sy(0), x2: W, y2: sy(0), class: "axis" });
    if (state.shade) {
      let d = `M${sx(-5).toFixed(1)} ${sy(0)}`;
      for (let i = 0; i <= 200; i++) { const x = -5 + i / 20; d += `L${sx(x).toFixed(1)} ${sy(c.result(x)).toFixed(1)}`; }
      d += `L${sx(5).toFixed(1)} ${sy(0)}Z`;
      el("path", { d, class: "shade " + state.op });
    }
    el("path", { d: path(c.f), class: "c f" });
    el("path", { d: path(c.g), class: "c g" });
    el("path", { d: path(c.result), class: "c " + state.op });
    const px = Number(probe.value), r = Core.readings(state, px);
    el("line", { x1: sx(px), y1: 0, x2: sx(px), y2: H, class: "probe" });
    el("circle", { cx: sx(px), cy: sy(r.f), r: 4, class: "dot f" });
    el("circle", { cx: sx(px), cy: sy(r.g), r: 4, class: "dot g" });
    el("circle", { cx: sx(px), cy: sy(r.result), r: 5, class: "dot r" });
    if (state.points) {
      ["f", "g"].forEach((w) => state[w].forEach((y, i) => {
        el("rect", { x: sx(i - 5) - 5, y: sy(y) - 5, width: 10, height: 10, rx: 2, class: "knot " + w, tabindex: 0, role: "slider", "data-w": w, "data-i": i,
          "aria-label": `${w} point ${i + 1}, height ${y.toFixed(1)}. Up and down arrows change it.` });
      }));
    }
    const sign = state.op === "sub" ? "−" : "+";
    keyRText.textContent = state.op === "sub" ? "f − g" : "f + g";
    keyRColor.style.background = state.op === "sub" ? "var(--bad)" : "#3b6fe0";
    readout.textContent = `x = ${px.toFixed(2)}   f(x) = ${r.f.toFixed(2)}   g(x) = ${r.g.toFixed(2)}\n(f ${sign} g)(x) = ${r.f.toFixed(2)} ${sign} ${r.g.toFixed(2)} = ${r.result.toFixed(2)}`;
    opAdd.checked = state.op === "add"; opSub.checked = state.op === "sub";
    shadeBox.checked = state.shade; ptsBox.checked = state.points;
    if (window.Track) window.Track.state({ ...state, probe: px });
  }

  function set(next) { if (next) { state = next; render(); } }
  const toModel = (e) => { const b = svg.getBoundingClientRect(); return { x: mx(((e.clientX - b.left) * W) / b.width), y: my(((e.clientY - b.top) * H) / b.height) }; };

  svg.addEventListener("pointerdown", (e) => {
    const k = e.target.getAttribute && e.target.getAttribute("data-w");
    const p = toModel(e);
    drag = k ? { which: k, index: Number(e.target.getAttribute("data-i")) } : Core.grab(state, p.x, p.y, 1.2);
    if (!drag) return;
    svg.setPointerCapture(e.pointerId);
    set(Core.setHeight(state, drag.which, drag.index, p.y));
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => { if (drag) set(Core.setHeight(state, drag.which, drag.index, toModel(e).y)); });
  const end = () => { drag = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", (e) => {
    const w = e.target.getAttribute && e.target.getAttribute("data-w");
    const d = { ArrowUp: 0.5, ArrowDown: -0.5, PageUp: 2, PageDown: -2 }[e.key];
    if (!w || !d) return;
    e.preventDefault();
    const i = Number(e.target.getAttribute("data-i"));
    set(Core.setHeight(state, w, i, state[w][i] + d));
    const f = svg.querySelector(`[tabindex][data-w="${w}"][data-i="${i}"]`);
    if (f) f.focus();
  });

  opAdd.addEventListener("change", () => set(Core.setOp(state, "add")));
  opSub.addEventListener("change", () => set(Core.setOp(state, "sub")));
  shadeBox.addEventListener("change", () => set(Core.setShade(state, shadeBox.checked)));
  ptsBox.addEventListener("change", () => set(Core.setPoints(state, ptsBox.checked)));
  probe.addEventListener("input", render);
  newBtn.addEventListener("click", () => { state = Core.start(); render(); });
  render();
})();
