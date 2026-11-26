"use strict";

/*
 * The page for Stick Broken Into Three Pieces: drawing and input only; the
 * logic is in stick-in-three-core.js. One SVG: the equilateral triangle with
 * its middle triangle shaded, the point P (drag it, or arrow keys) and its
 * three perpendiculars; below, the stick cut into those three lengths, and
 * the triangle they make when they can. The buttons break sticks at random
 * in the chosen way and count how often a triangle comes out.
 */

(function () {
  const Core = StickInThreeCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const tallyEl = document.getElementById("tally");
  const methodSel = document.getElementById("method");
  const namesBox = document.getElementById("namesBox");
  const NS = "http://www.w3.org/2000/svg";
  const S3 = Math.sqrt(3);
  const SIDE = 340, H = (SIDE * S3) / 2, OX = 30, OY = 20;
  // V[i] is the corner opposite side i; piece i is P's distance to side i.
  const V = [[OX + SIDE / 2, OY], [OX, OY + H], [OX + SIDE, OY + H]];
  const STICK_Y = OY + H + 40, FORM_Y = STICK_Y + 40;
  const NAMES = ["A", "B", "C"];

  let state = Core.start();
  let dragging = false;

  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const pt = (w) => [0, 1].map((k) => w[0] * V[0][k] + w[1] * V[1][k] + w[2] * V[2][k]);
  const mid = (A, B) => [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const poly = (pts) => pts.map((p) => p.map((x) => x.toFixed(1)).join(",")).join(" ");

  /** Barycentric weights of a point of the picture. */
  function weights(x, y) {
    const [A, B, C] = V;
    const det = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
    const a = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / det;
    const b = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / det;
    return [a, b, 1 - a - b];
  }

  function render() {
    svg.textContent = "";
    const p = state.pieces, P = pt(p);
    svg.appendChild(el("polygon", { points: poly(V) }, "big"));
    svg.appendChild(el("polygon", { points: poly([mid(V[1], V[2]), mid(V[2], V[0]), mid(V[0], V[1])]) }, "medial"));
    // feet of the perpendiculars: the foot on side i has weight 0 at corner i
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3, k = (i + 2) % 3;
      const w = [0, 0, 0];
      w[j] = p[j] + p[i] / 2; w[k] = p[k] + p[i] / 2;
      const F = pt(w);
      svg.appendChild(el("line", { x1: P[0], y1: P[1], x2: F[0], y2: F[1] }, `piece p${i}`));
      if (namesBox.checked) {
        const L = el("text", { x: F[0] + (F[0] - P[0] > 0 ? 6 : -6) + (i === 0 ? 0 : 0), y: F[1] + (i === 0 ? 18 : 0) }, "name small", `P${"abc"[i]}`);
        if (i !== 0) L.setAttribute("text-anchor", i === 1 ? "end" : "start");
        svg.appendChild(L);
      }
    }
    if (namesBox.checked) V.forEach((Q, i) => svg.appendChild(el("text", { x: Q[0] + [0, -8, 8][i], y: Q[1] + [-4, 16, 16][i] }, `name v${i}`, NAMES[i])));
    const dot = el("circle", { cx: P[0], cy: P[1], r: 11, tabindex: "0", role: "slider", "aria-label": "Point P: drag it, or use the arrow keys", "aria-valuetext": `pieces ${p.map((x) => x.toFixed(2)).join(", ")}` }, "handle");
    svg.appendChild(dot);
    if (namesBox.checked) svg.appendChild(el("text", { x: P[0] + 14, y: P[1] - 10 }, "name", "P"));

    // the stick, as long as the height, laid flat
    let x = OX + (SIDE - H) / 2;
    for (let i = 0; i < 3; i++) {
      svg.appendChild(el("line", { x1: x, y1: STICK_Y, x2: x + p[i] * H, y2: STICK_Y }, `piece stick p${i}`));
      x += p[i] * H;
    }
    svg.appendChild(el("line", { x1: OX + SIDE / 2, y1: STICK_Y - 12, x2: OX + SIDE / 2, y2: STICK_Y + 12 }, "half"));

    const T = Core.triangle(p);
    if (T) {
      const sc = H, cx = OX + SIDE / 2 - (p[2] * sc) / 2, base = FORM_Y + 130;
      const Q = T.map(([u, v]) => [cx + u * sc, base - v * sc]);
      for (let i = 0; i < 3; i++) svg.appendChild(el("line", { x1: Q[(i + 1) % 3][0], y1: Q[(i + 1) % 3][1], x2: Q[(i + 2) % 3][0], y2: Q[(i + 2) % 3][1] }, `piece p${i}`));
    } else {
      const e = Core.excess(p);
      svg.appendChild(el("text", { x: OX + SIDE / 2, y: FORM_Y + 60 }, "nope", `The longest piece is ${e.by < 1e-9 ? "half" : "more than half"} the stick: no triangle.`));
    }

    statusEl.textContent = T
      ? `P is inside the middle triangle: every piece is less than half the stick, so they make a triangle.`
      : `P is outside the middle triangle: one piece is at least half the stick, so the other two cannot reach.`;
    tallyEl.textContent = state.tries
      ? `${state.hits} triangles from ${state.tries} sticks: ${(state.hits / state.tries).toFixed(3)}. The exact chance is ${Core.EXACT[state.method].toFixed(4)}.`
      : `Break some sticks to see how often a triangle comes out.`;
    if (window.Track) window.Track.state({ pieces: p.map((v) => Math.round(v * 1e4) / 1e4), method: state.method, tries: state.tries, hits: state.hits });
  }

  function toSvg(e) {
    const m = svg.getScreenCTM().inverse();
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [q.x, q.y];
  }
  function moveTo(x, y) {
    state = Core.moveTo(state, weights(x, y));
    render();
  }
  svg.addEventListener("pointerdown", (e) => {
    if (!e.target.classList.contains("handle") && !e.target.classList.contains("big") && !e.target.classList.contains("medial")) return;
    e.preventDefault();
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    moveTo(...toSvg(e));
    const h = svg.querySelector(".handle"); if (h) h.focus({ preventScroll: true });
  });
  svg.addEventListener("pointermove", (e) => { if (dragging) moveTo(...toSvg(e)); });
  svg.addEventListener("pointerup", () => { dragging = false; });
  svg.addEventListener("pointercancel", () => { dragging = false; });
  svg.addEventListener("keydown", (e) => {
    if (!e.target.classList.contains("handle")) return;
    const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key];
    if (!d) return;
    e.preventDefault();
    const P = pt(state.pieces);
    moveTo(P[0] + d[0], P[1] + d[1]);
    svg.querySelector(".handle").focus();
  });

  methodSel.addEventListener("change", () => { state = Core.setMethod(state, methodSel.value) || state; render(); });
  document.getElementById("one").addEventListener("click", () => { state = Core.breakSticks(state, 1); render(); });
  document.getElementById("many").addEventListener("click", () => { state = Core.breakSticks(state, 1000); render(); });
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start({ method: methodSel.value, seed: state.seed }); render(); });
  namesBox.addEventListener("change", render);

  render();
})();
