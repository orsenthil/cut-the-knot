"use strict";

/*
 * The page for Newton's Method: drawing and input only. One SVG; x runs from
 * -5 to 5 and y from -120 to 120, with the x-axis across the middle. Clicking
 * picks the starting x (a second click clears it); each Newton step draws a
 * dashed drop from the axis to the curve, then the tangent down to the axis.
 * The small squares (when shown) are the spline's control points: drag them
 * up and down. The rules are in newtons-method-core.js.
 */

(function () {
  const Core = NewtonCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const x0In = document.getElementById("x0In"), nIn = document.getElementById("nIn");
  const ptsBox = document.getElementById("pts"), clearBtn = document.getElementById("clearBtn"), newBtn = document.getElementById("newBtn");
  const NS = "http://www.w3.org/2000/svg";
  const W = 500, H = 340, PX = 25, SX = (W - 2 * PX) / 10, SY = (H / 2 - 8) / Core.YLIMIT;
  const sx = (x) => W / 2 + x * SX, sy = (y) => H / 2 - y * SY;
  const mx = (px) => (px - W / 2) / SX, my = (py) => (H / 2 - py) / SY;

  let state = Core.start();
  let drag = null;

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

  /** A line through (x, f) with slope d, clipped by the svg frame. */
  function tangentLine(x, f, d, toX) {
    const far = toX === null ? (d >= 0 ? 6 : -6) : toX;
    // from the point of tangency to the axis crossing, or off the picture
    const x2 = toX === null ? x + (d === 0 ? 20 : 12 * Math.sign(d)) : toX;
    return { x1: sx(x), y1: sy(f), x2: sx(x2), y2: sy(f + d * (x2 - x)) };
  }

  function render() {
    svg.textContent = "";
    const cv = Core.curve(state);
    el("line", { x1: 0, y1: sy(0), x2: W, y2: sy(0), class: "axis" });
    let d = "";
    for (let i = 0; i <= 200; i++) { const x = -5 + i / 20; d += (i ? "L" : "M") + sx(x).toFixed(1) + " " + sy(cv.f(x)).toFixed(1); }
    el("path", { d, class: "curve" });

    const steps = Core.steps(state);
    steps.forEach((st, i) => {
      const lastOne = i === steps.length - 1;
      el("line", { x1: sx(st.x), y1: sy(0), x2: sx(st.x), y2: sy(st.fx), class: "drop" });
      const toX = st.status === "ok" ? st.next : null;
      let seg;
      if (toX !== null) seg = { x1: sx(st.x), y1: sy(st.fx), x2: sx(toX), y2: sy(0) };
      else {
        // the tangent never meets the axis inside the picture: draw it to the frame's edge
        const dx = st.slope === 0 ? 5 : Math.sign(-st.fx / st.slope || 1) * 5.5;
        const x2 = st.slope === 0 || !Number.isFinite(st.slope) ? st.x + 5.5 : (st.fx / st.slope > 0 ? -5.5 : 5.5);
        seg = { x1: sx(st.x), y1: sy(st.fx), x2: sx(x2), y2: sy(st.fx + st.slope * (x2 - st.x)) };
      }
      el("line", { ...seg, class: "tangent" + (lastOne ? " last" : "") });
    });
    if (state.x0 !== null) {
      el("circle", { cx: sx(state.x0), cy: sy(0), r: 6, class: "pt start" });
      steps.forEach((st) => { if (st.next !== null) el("circle", { cx: sx(st.next), cy: sy(0), r: 4, class: "pt" }); });
    }

    if (ptsBox.checked) {
      state.ys.forEach((y, i) => {
        const k = "y" + i;
        el("circle", { cx: sx(i - 5), cy: sy(y), r: 20, class: "hit", "data-k": k });
        el("rect", { x: sx(i - 5) - 6, y: sy(y) - 6, width: 12, height: 12, rx: 2, class: "knot", tabindex: 0, role: "slider", "data-k": k,
          "aria-label": `Curve point ${i + 1}, height ${y.toFixed(1)}. Up and down arrows change it.` });
      });
    }

    describe(steps);
    x0In.value = state.x0 === null ? "" : (Math.round(state.x0 * 1000) / 1000).toString();
    nIn.value = String(state.n);
    if (window.Track) window.Track.state(state);
  }

  function describe(steps) {
    if (!steps.length) {
      readout.textContent = "Click the picture to choose a starting x.";
      say("");
      return;
    }
    readout.textContent = steps.map((s, i) => `x${i} = ${s.x.toFixed(6)}   f(x${i}) = ${s.fx.toFixed(4)}`).join("\n")
      + (steps[steps.length - 1].next !== null ? `\nx${steps.length} = ${steps[steps.length - 1].next.toFixed(6)}` : "");
    const last = steps[steps.length - 1];
    if (last.status === "flat") say("The tangent is level: it never meets the axis, so the method cannot go on from here.", "done");
    else if (last.status === "out") say("The next point is off the picture: this tangent meets the axis too far away. The method has wandered off.", "done");
    else if (Math.abs(last.fx) < 1e-9) say(`Done: x = ${last.x.toFixed(6)} is a root (the curve is on the axis).`, "done");
    else say("");
  }

  const toModel = (e) => { const r = svg.getBoundingClientRect(); return { x: mx(((e.clientX - r.left) * W) / r.width), y: my(((e.clientY - r.top) * H) / r.height) }; };

  function set(next) { if (next) { state = next; render(); } }

  svg.addEventListener("pointerdown", (e) => {
    const k = e.target && e.target.getAttribute && e.target.getAttribute("data-k");
    if (k) {
      drag = Number(k.slice(1));
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    set(Core.click(state, toModel(e).x));
  });
  svg.addEventListener("pointermove", (e) => {
    if (drag === null) return;
    const next = Core.setHeight(state, drag, toModel(e).y);
    if (next) { state = next; renderKeepFocus(); }
  });
  const endDrag = () => { drag = null; };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);

  function renderKeepFocus() { render(); }

  svg.addEventListener("keydown", (e) => {
    const k = e.target && e.target.getAttribute && e.target.getAttribute("data-k");
    if (!k) return;
    const dy = { ArrowUp: 2, ArrowDown: -2, PageUp: 10, PageDown: -10 }[e.key];
    if (!dy) return;
    e.preventDefault();
    const i = Number(k.slice(1));
    state = Core.setHeight(state, i, state.ys[i] + dy) || state;
    render();
    const f = svg.querySelector(`[tabindex][data-k="${k}"]`);
    if (f) f.focus();
  });

  x0In.addEventListener("change", () => { const v = parseFloat(x0In.value); set(Number.isFinite(v) ? Core.setStart(state, v) : Core.setStart(state, null)); });
  nIn.addEventListener("change", () => set(Core.setSteps(state, nIn.value)));
  ptsBox.addEventListener("change", render);
  clearBtn.addEventListener("click", () => set(Core.setStart(state, null)));
  newBtn.addEventListener("click", () => set(Core.reset()));

  /* Heron's square roots, the page's worked example */
  const hN = document.getElementById("hN"), hX = document.getElementById("hX"), hS = document.getElementById("hS"), hOut = document.getElementById("heronOut");
  function heron() {
    const N = Math.max(1, Math.min(100000, Number(hN.value) || 2));
    const x0 = Math.max(0.001, Number(hX.value) || 1);
    const k = Math.max(1, Math.min(12, Math.round(Number(hS.value)) || 6));
    const xs = Core.heron(N, x0, k);
    hOut.textContent = "i   x_i\n" + xs.map((x, i) => `${String(i).padEnd(3)} ${x}`).join("\n") + `\n\nsqrt(${N}) = ${Math.sqrt(N)}`;
  }
  [hN, hX, hS].forEach((e) => e.addEventListener("input", heron));
  heron();

  render();
})();
