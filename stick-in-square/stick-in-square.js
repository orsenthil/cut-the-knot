"use strict";

/*
 * The page for Stick Broken Into Three Pieces (Cartesian): drawing and input
 * only; the logic is in stick-in-square-core.js. One SVG: the unit square
 * with the pink triangles (and, in the two-step mode, the green ones), the
 * point P = (x, y) to drag, its distances to the left side and the bottom,
 * the stick on the right broken at those heights, and the triangle the
 * pieces make when they can. Random experiments are drawn as dots.
 */

(function () {
  const Core = StickInSquareCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const tallyEl = document.getElementById("tally");
  const namesBox = document.getElementById("namesBox");
  const NS = "http://www.w3.org/2000/svg";
  const L = 20, T = 20, S = 300;            // the square
  const SX = 360;                            // the stick, bottom at T + S
  const FY = T + S + 30;                     // the triangle area below
  const COLOURS = ["p0", "p1", "p2"];

  let state = Core.start();
  let dots = [];
  let dragging = false;

  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const X = (x) => L + x * S, Y = (y) => T + S - y * S;
  const poly = (pts) => pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");
  const mode = () => document.querySelector('input[name="mode"]:checked').value;

  function render() {
    svg.textContent = "";
    svg.appendChild(el("rect", { x: L, y: T, width: S, height: S }, "square"));
    if (state.mode === "two") {
      svg.appendChild(el("polygon", { points: poly([[0, 0], [0.5, 0], [0.5, 0.5]]) }, "green"));
      svg.appendChild(el("polygon", { points: poly([[1, 1], [0.5, 1], [0.5, 0.5]]) }, "green"));
    }
    svg.appendChild(el("polygon", { points: poly([[0, 0.5], [0.5, 0.5], [0.5, 1]]) }, "pink"));
    svg.appendChild(el("polygon", { points: poly([[0.5, 0], [0.5, 0.5], [1, 0.5]]) }, "pink"));
    const g = el("g", {}, "dots");
    for (const [x, y, ok] of dots) g.appendChild(el("circle", { cx: X(x).toFixed(1), cy: Y(y).toFixed(1), r: 1.6 }, ok ? "dot hit" : "dot"));
    svg.appendChild(g);

    const { x, y } = state;
    svg.appendChild(el("line", { x1: X(x), y1: Y(y), x2: L, y2: Y(y) }, "foot"));
    svg.appendChild(el("line", { x1: X(x), y1: Y(y), x2: X(x), y2: T + S }, "foot"));
    // the stick: pieces from the bottom up
    const p = Core.pieces(x, y);
    let at = 0;
    p.forEach((len, i) => {
      svg.appendChild(el("line", { x1: SX, y1: Y(at), x2: SX, y2: Y(at + len) }, `piece stick ${COLOURS[i]}`));
      at += len;
    });
    svg.appendChild(el("line", { x1: SX - 12, y1: Y(0.5), x2: SX + 12, y2: Y(0.5) }, "half"));
    for (const [v, name] of [[x, "B₁"], [y, "B₂"]]) {
      svg.appendChild(el("line", { x1: SX - 9, y1: Y(v), x2: SX + 9, y2: Y(v) }, "tick"));
      if (namesBox.checked) svg.appendChild(el("text", { x: SX + 13, y: Y(v) + 5 }, "name small start", name));
    }
    if (namesBox.checked) {
      svg.appendChild(el("text", { x: X(x) + 12, y: Y(y) - 10 }, "name start", "P"));
      svg.appendChild(el("text", { x: L - 6, y: Y(y) + 5 }, "name small end", "P₂"));
      svg.appendChild(el("text", { x: X(x), y: T + S + 17 }, "name small", "P₁"));
    }
    svg.appendChild(el("circle", { cx: X(x), cy: Y(y), r: 10, tabindex: "0", role: "slider", "aria-label": "Point P: drag it, or use the arrow keys", "aria-valuetext": `breaks at ${x.toFixed(2)} and ${y.toFixed(2)}` }, "handle"));

    const tri = Core.triangle(p);
    if (tri) {
      const sc = S, cx = L + S / 2 - (p[2] * sc) / 2, base = FY + 140;
      const Q = tri.map(([u, v]) => [cx + u * sc, base - v * sc]);
      for (let i = 0; i < 3; i++) svg.appendChild(el("line", { x1: Q[(i + 1) % 3][0], y1: Q[(i + 1) % 3][1], x2: Q[(i + 2) % 3][0], y2: Q[(i + 2) % 3][1] }, `piece ${COLOURS[i]}`));
    } else svg.appendChild(el("text", { x: L + S / 2, y: FY + 70 }, "nope", "One piece is at least half the stick: no triangle."));

    const r = Core.region(x, y);
    statusEl.textContent = r === "pink"
      ? "P is in a pink triangle: every piece is under half the stick, so they make a triangle."
      : r === "green" && state.mode === "two"
        ? "P is in a green triangle: here the shorter piece was broken second, which the two-step experiment never does."
        : "P is outside the pink triangles: one piece is at least half the stick.";
    tallyEl.textContent = state.tries
      ? `${state.hits} triangles from ${state.tries} sticks: ${(state.hits / state.tries).toFixed(3)}. The exact chance is ${Core.EXACT[state.mode].toFixed(4)}.`
      : "Break some sticks to see where the points land.";
    if (window.Track) window.Track.state({ x: Math.round(x * 1e4) / 1e4, y: Math.round(y * 1e4) / 1e4, mode: state.mode, tries: state.tries, hits: state.hits });
  }

  function toSvg(e) {
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [(q.x - L) / S, (T + S - q.y) / S];
  }
  function moveTo(x, y) { state = Core.moveTo(state, x, y); render(); }
  svg.addEventListener("pointerdown", (e) => {
    const [x, y] = toSvg(e);
    if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) return;
    e.preventDefault();
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    moveTo(x, y);
    const h = svg.querySelector(".handle"); if (h) h.focus({ preventScroll: true });
  });
  svg.addEventListener("pointermove", (e) => { if (dragging) moveTo(...toSvg(e)); });
  svg.addEventListener("pointerup", () => { dragging = false; });
  svg.addEventListener("pointercancel", () => { dragging = false; });
  svg.addEventListener("keydown", (e) => {
    if (!e.target.classList.contains("handle")) return;
    const d = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] }[e.key];
    if (!d) return;
    e.preventDefault();
    moveTo(state.x + d[0], state.y + d[1]);
    svg.querySelector(".handle").focus();
  });

  function breakSticks(n) {
    const r = Core.run(state, n);
    state = r.state;
    dots = dots.concat(r.dots).slice(-3000);
    render();
  }
  document.querySelectorAll('input[name="mode"]').forEach((b) => b.addEventListener("change", () => { state = Core.setMode(state, mode()) || state; dots = []; render(); }));
  document.getElementById("one").addEventListener("click", () => breakSticks(1));
  document.getElementById("many").addEventListener("click", () => breakSticks(1000));
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start({ mode: state.mode, seed: state.seed, x: state.x, y: state.y }); dots = []; render(); });
  namesBox.addEventListener("change", render);

  render();
})();
