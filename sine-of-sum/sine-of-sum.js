"use strict";

/*
 * The page for Sine of the Sum Formula: drawing and input only; the
 * geometry is in sine-of-sum-core.js. One SVG holds both figures side by
 * side: on the left the unit rhombus in its rectangle with the four cut-off
 * triangles, on the right the same rectangle with the triangles moved into
 * two corners and the two empty rectangles marked. The rhombus's right and
 * left vertices can be dragged up and down (their heights are sin(alpha)
 * and sin(beta)) or moved with the arrow keys.
 */

(function () {
  const Core = SineOfSumCore;
  const svgL = document.getElementById("boardL");
  const svgR = document.getElementById("boardR");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const labelsBox = document.getElementById("labelsBox");
  const anglesBox = document.getElementById("anglesBox");
  const NS = "http://www.w3.org/2000/svg";
  const S = 130, BASE = 285, LX = 50, RX = 50; // pixels per unit, the rectangles' bottom, their left edges (one SVG each)

  let state = Core.start();
  let drag = null;
  let refocus = null;

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
  const pt = (ox) => (p) => `${ox + p[0] * S},${BASE - p[1] * S}`;
  const poly = (ox, pts, cls) => el("polygon", { points: pts.map(pt(ox)).join(" ") }, cls);
  const label = (x, y, text, anchor = "middle") => el("text", { x, y, "text-anchor": anchor }, "lbl", text);

  function render() {
    const f = Core.figures(state);
    const L = f.left, R = f.right;
    svgL.textContent = "";
    svgR.textContent = "";
    let svg = svgL;
    // left figure
    svg.appendChild(poly(LX, [[0, 0], [L.W, 0], [L.W, L.H], [0, L.H]], "rect"));
    for (const t of L.triangles) svg.appendChild(poly(LX, t.pts, `tri ${t.kind}`));
    svg.appendChild(poly(LX, L.rhombus, "rhombus"));
    svg = svgR;
    // right figure
    svg.appendChild(poly(RX, [[0, 0], [R.W, 0], [R.W, R.H], [0, R.H]], "rect"));
    for (const e of R.empty) svg.appendChild(poly(RX, e.pts, "empty"));
    for (const t of R.triangles) svg.appendChild(poly(RX, t.pts, `tri ${t.kind}`));
    const X = (ox, x) => ox + x * S, Y = (y) => BASE - y * S;
    for (const e of R.empty) {
      const cx = (e.pts[0][0] + e.pts[2][0]) / 2, cy = (e.pts[0][1] + e.pts[2][1]) / 2;
      svg.appendChild(label(X(RX, cx), Y(cy) + 5, e.name === "sin a cos b" ? "sin α cos β" : "cos α sin β"));
    }
    svg = svgL;
    if (labelsBox.checked) {
      const { ca, sa, cb, sb } = f;
      svg.appendChild(label(X(LX, cb / 2), BASE + 16, "cos β"));
      svg.appendChild(label(X(LX, cb + ca / 2), BASE + 16, "cos α"));
      svg.appendChild(label(X(LX, L.W) + 4, Y(sa / 2) + 5, "sin α", "start"));
      svg.appendChild(label(X(LX, L.W) + 4, Y(sa + sb / 2) + 5, "sin β", "start"));
      svg.appendChild(label(X(LX, 0) - 4, Y(sb / 2) + 5, "sin β", "end"));
      svg.appendChild(label(X(LX, 0) - 4, Y(sb + sa / 2) + 5, "sin α", "end"));
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      for (let i = 0; i < 4; i++) {
        const m = mid(L.rhombus[i], L.rhombus[(i + 1) % 4]);
        svg.appendChild(label(X(LX, m[0]), Y(m[1]) + 5, "1"));
      }
    }
    if (anglesBox.checked) {
      const b = L.rhombus[0];
      svg.appendChild(label(X(LX, b[0]) + 30, BASE - 6, "α", "start"));
      svg.appendChild(label(X(LX, b[0]) - 30, BASE - 6, "β", "end"));
      const r = L.rhombus[1];
      svg.appendChild(label(X(LX, r[0]) - 28, Y(r[1]) + 5, "α+β", "end"));
    }
    // handles
    for (const [which, p] of [["alpha", L.rhombus[1]], ["beta", L.rhombus[3]]]) {
      const h = el("circle", { cx: X(LX, p[0]), cy: Y(p[1]), r: 9, tabindex: "0", role: "slider",
        "aria-label": which === "alpha" ? "Right vertex: its height is sin alpha" : "Left vertex: its height is sin beta",
        "aria-valuemin": "1", "aria-valuemax": "89", "aria-valuenow": String(state[which]), "aria-valuetext": `${state[which]} degrees` }, "handle");
      h.dataset.which = which;
      h.addEventListener("keydown", onKey);
      svg.appendChild(h);
      if (refocus === which) h.focus();
    }
    refocus = null;
    const v = Core.values(state);
    readout.textContent = `α = ${state.alpha}°, β = ${state.beta}°:  sin(α+β) = ${v.sinSum.toFixed(4)} = ${v.sinAcosB.toFixed(4)} + ${v.cosAsinB.toFixed(4)}`;
    if (window.Track) window.Track.state(state);
  }

  function onKey(e) {
    const which = e.target.dataset.which;
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (!which || d === undefined) return;
    e.preventDefault();
    state = which === "alpha" ? Core.setAngles(state, state.alpha + d, state.beta) : Core.setAngles(state, state.alpha, state.beta + d);
    refocus = which;
    render();
  }

  const svg = svgL;
  svg.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".handle");
    if (!t) return;
    drag = t.dataset.which;
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = svg.getBoundingClientRect();
    const y = (BASE - ((e.clientY - r.top) * 310) / r.height) / S; // height in units
    const deg = (Math.asin(Math.max(0, Math.min(1, y))) * 180) / Math.PI;
    state = drag === "alpha" ? Core.setAngles(state, deg, state.beta) : Core.setAngles(state, state.alpha, deg);
    render();
  });
  const end = () => { if (drag) { drag = null; say("The rhombus changed, and so did the rectangles; the two areas still agree."); } };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  labelsBox.addEventListener("change", () => { state = { ...state, labels: labelsBox.checked }; render(); });
  anglesBox.addEventListener("change", () => { state = { ...state, angles: anglesBox.checked }; render(); });
  window.addEventListener("themechange", render);

  render();
  say("Drag the rhombus's right or left corner up and down.");
})();
