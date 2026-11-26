"use strict";

/*
 * The page for Two Perpendiculars From a Point to a Line: drawing and input
 * only; the geometry is in two-perpendiculars-core.js. One SVG with the
 * triangle ABC (drag a corner, or the triangle), the circles on AB and AC,
 * and either the two "perpendiculars" AD, AE (fallacy 1) or the point K
 * with lines to A, B, C (fallacy 2). "Honest drawing" turns the applet's
 * cheat off, and the points merge.
 */

(function () {
  const Core = TwoPerpendicularsCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const honestBox = document.getElementById("honestBox");
  const NS = "http://www.w3.org/2000/svg";

  let state = Core.start();
  let drag = null;

  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, typeof attrs[k] === "number" ? attrs[k].toFixed(2) : attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const seg = (P, Q, cls) => svg.appendChild(el("line", { x1: P[0], y1: P[1], x2: Q[0], y2: Q[1] }, cls));
  const dot = (P, cls) => svg.appendChild(el("circle", { cx: P[0], cy: P[1], r: 4 }, cls));
  function name(P, text, away) {
    if (!namesBox.checked || !P) return;
    const d = [P[0] - away[0], P[1] - away[1]], L = Math.hypot(...d) || 1;
    svg.appendChild(el("text", { x: P[0] + (d[0] / L) * 16, y: P[1] + (d[1] / L) * 16 + 5 }, "name", text));
  }
  /** Right-angle mark at Q between QP and QR. */
  function corner(P, Q, R) {
    const u = (X) => { const v = [X[0] - Q[0], X[1] - Q[1]], L = Math.hypot(...v) || 1; return [(v[0] / L) * 10, (v[1] / L) * 10]; };
    const a = u(P), b = u(R);
    svg.appendChild(el("path", { d: `M${Q[0] + a[0]},${Q[1] + a[1]} L${Q[0] + a[0] + b[0]},${Q[1] + a[1] + b[1]} L${Q[0] + b[0]},${Q[1] + b[1]}` }, "corner"));
  }

  function render() {
    svg.textContent = "";
    const s = state, f = Core.figure(s), { A, B, C } = s;
    const centroid = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
    svg.appendChild(el("polygon", { points: [A, B, C].map((p) => p.join(",")).join(" ") }, "tri"));
    svg.appendChild(el("circle", { cx: f.cB[0], cy: f.cB[1], r: f.rB }, "circ"));
    svg.appendChild(el("circle", { cx: f.cC[0], cy: f.cC[1], r: f.rC }, "circ"));
    dot(f.cB, "centre"); dot(f.cC, "centre");
    const first = s.fallacy === 1 && s.cheat;
    if (first) {
      if (f.D) { seg(A, f.D, "perp"); dot(f.D, "pt"); }
      if (f.E) { seg(A, f.E, "perp"); dot(f.E, "pt"); }
      if (hintBox.checked && f.D && f.E) { corner(A, f.D, B); corner(A, f.E, C); }
      name(f.D, "D", A); name(f.E, "E", A);
    } else if (f.K) {
      seg(B, f.K, "perp"); seg(C, f.K, "perp"); seg(A, f.K, "perp"); dot(f.K, "pt");
      if (hintBox.checked) { corner(A, f.K, B); corner(A, f.K, C); }
      name(f.K, s.cheat ? "K" : "K = D = E", A);
    }
    for (const [P, n] of [[A, "A"], [B, "B"], [C, "C"]]) {
      svg.appendChild(el("circle", { cx: P[0], cy: P[1], r: 9, tabindex: "0", role: "slider", "aria-label": `Point ${n}: drag it, or use the arrow keys` }, "handle")).dataset.p = n;
      name(P, n, centroid);
    }

    let text;
    if (!s.cheat) text = "Drawn honestly, D, E and K are one point: the foot of the only perpendicular from A to BC.";
    else if (first) text = "AD and AE both look perpendicular to BC: two perpendiculars from one point to one line?";
    else text = "Angles AKB and AKC both look right, so B, K, C look like a second straight line through B and C. What is wrong?";
    if (hintBox.checked && s.cheat && f.D && f.E && f.K) {
      text += first
        ? ` Measured: angle ADB = ${Core.angle(A, f.D, B).toFixed(1)}°, angle AEC = ${Core.angle(A, f.E, C).toFixed(1)}°.`
        : ` Measured: angle BKC = ${Core.angle(B, f.K, C).toFixed(1)}°, not 180°.`;
    }
    statusEl.textContent = text;
    if (window.Track) window.Track.state({ A: s.A.map((v) => Math.round(v * 10) / 10), B: s.B.map((v) => Math.round(v * 10) / 10), C: s.C.map((v) => Math.round(v * 10) / 10), cheat: s.cheat, fallacy: s.fallacy });
  }

  const toSvg = (e) => { const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };
  svg.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (t.classList.contains("handle")) drag = { which: t.dataset.p };
    else if (t.classList.contains("tri")) drag = { which: "all", last: toSvg(e) };
    else return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const [x, y] = toSvg(e);
    let s;
    if (drag.which === "all") { s = Core.move(state, "all", x - drag.last[0], y - drag.last[1]); drag.last = [x, y]; }
    else s = Core.move(state, drag.which, x, y);
    if (s) { state = s; render(); }
  });
  const end = () => { drag = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", (e) => {
    const p = e.target.dataset && e.target.dataset.p;
    const d = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[e.key];
    if (!p || !d) return;
    e.preventDefault();
    const s = Core.move(state, p, state[p][0] + d[0], state[p][1] + d[1]);
    if (s) { state = s; render(); svg.querySelector(`.handle[data-p="${p}"]`).focus(); }
  });

  document.querySelectorAll('input[name="fallacy"]').forEach((r) => r.addEventListener("change", () => { state = Core.set(state, "fallacy", Number(r.value)); render(); }));
  honestBox.addEventListener("change", () => { state = Core.set(state, "cheat", !honestBox.checked); render(); });
  namesBox.addEventListener("change", render);
  hintBox.addEventListener("change", render);
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start({ cheat: state.cheat, fallacy: state.fallacy }); render(); });

  render();
})();
