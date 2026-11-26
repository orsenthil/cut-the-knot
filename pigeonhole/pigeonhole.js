"use strict";

/*
 * The page for The Puzzlers' Pigeonhole: drawing and input only. A 12 x 9 grid
 * of corners with draggable dots (pointer drag snaps to a free corner; arrow
 * keys move a focused dot). The first pair with a corner halfway between
 * them is drawn in red with that corner marked. The maths is in
 * pigeonhole-core.js.
 */

(function () {
  const Core = PigeonholeCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const nSel = document.getElementById("nSel"), newBtn = document.getElementById("newBtn"), safeBtn = document.getElementById("safeBtn");
  const NS = "http://www.w3.org/2000/svg";
  const STEP = 40, PAD = 20;

  let state = Core.start({ n: 5 });
  let dragging = -1, focusIndex = -1;

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

  const X = (x) => PAD + x * STEP, Y = (y) => PAD + y * STEP;

  function toNode(evt) {
    const r = svg.getBoundingClientRect();
    const px = ((evt.clientX - r.left) / r.width) * 480, py = ((evt.clientY - r.top) / r.height) * 360;
    return { x: Math.round((px - PAD) / STEP), y: Math.round((py - PAD) / STEP) };
  }

  function render() {
    svg.textContent = "";
    for (let x = 0; x < Core.COLS; x++) for (let y = 0; y < Core.ROWS; y++) el("circle", { cx: X(x), cy: Y(y), r: 2.5, class: "node" });
    const pr = Core.findPair(state.points);
    let mid = null;
    if (pr) {
      const a = state.points[pr[0]], b = state.points[pr[1]];
      el("line", { x1: X(a.x), y1: Y(a.y), x2: X(b.x), y2: Y(b.y), class: "seg" });
      mid = Core.midpoint(a, b);
      if (mid) el("rect", { x: X(mid.x) - 6, y: Y(mid.y) - 6, width: 12, height: 12, class: "mid" });
    }
    state.points.forEach((p, i) => {
      const hit = pr && (pr[0] === i || pr[1] === i);
      const c = el("circle", { cx: X(p.x), cy: Y(p.y), r: 11, class: "dot" + (hit ? " hit" : ""), tabindex: "0", role: "button", "aria-label": `Dot ${i + 1} at column ${p.x + 1}, row ${p.y + 1}. Arrow keys move it.` });
      c.addEventListener("pointerdown", (e) => { dragging = i; focusIndex = i; c.setPointerCapture(e.pointerId); e.preventDefault(); });
      c.addEventListener("pointermove", (e) => {
        if (dragging !== i) return;
        const q = toNode(e);
        if (q.x === state.points[i].x && q.y === state.points[i].y) return;
        const next = Core.move(state, i, q.x, q.y);
        if (next) { state = next; render(); document.querySelectorAll("#board .dot")[i].focus({ preventScroll: true }); }
      });
      c.addEventListener("pointerup", () => { dragging = -1; });
      c.addEventListener("keydown", (e) => {
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!d) return;
        e.preventDefault();
        const next = Core.move(state, i, state.points[i].x + d[0], state.points[i].y + d[1]);
        if (next) { state = next; render(); document.querySelectorAll("#board .dot")[i].focus({ preventScroll: true }); }
      });
    });
    nSel.value = String(state.n);
    if (pr) {
      const a = state.points[pr[0]], b = state.points[pr[1]], m = Core.midpoint(a, b), extra = Core.between(a, b).length;
      say(`Dots ${pr[0] + 1} and ${pr[1] + 1} have the corner (${m.x + 1}, ${m.y + 1}) exactly halfway between them` + (extra > 1 ? `; the segment has ${extra} corners strictly between the two dots.` : "."), "done");
    } else {
      say("No two dots have a corner halfway between them: each dot is in a different one of the four parity boxes.", "done");
    }
    if (window.Track) window.Track.state({ n: state.n, points: state.points });
  }

  nSel.addEventListener("change", () => { state = Core.setN(state, Number(nSel.value)); render(); });
  newBtn.addEventListener("click", () => { state = Core.start({ n: Number(nSel.value) }); render(); });
  safeBtn.addEventListener("click", () => { state = { n: 4, points: Core.safeFour() }; render(); });
  render();
})();
