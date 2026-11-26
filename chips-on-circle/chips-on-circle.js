"use strict";

/*
 * The page for Counting Chips On a Circle: drawing and input only; the
 * logic is in chips-on-circle-core.js. One SVG holds the chips round a
 * circle (click or Enter flips one) and, when reds and greens are equal,
 * the diameter cutting off a balanced half. A second SVG plots, for every
 * starting chip m, reds minus greens on the half circle from m: the walk
 * that has to cross zero.
 */

(function () {
  const Core = ChipsOnCircleCore;
  const svg = document.getElementById("board");
  const plot = document.getElementById("walk");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn");
  const NS = "http://www.w3.org/2000/svg";
  const CX = 200, CY = 200, R = 160;

  let state = Core.start();
  let focusAt = null;

  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const angle = (i) => (2 * Math.PI * i) / state.n;
  const at = (a, r = R) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];

  function render() {
    const { n } = state;
    svg.textContent = "";
    svg.appendChild(el("circle", { cx: CX, cy: CY, r: R }, "ring"));
    const m = Core.diameter(state);
    const half = new Set();
    if (m !== null) {
      for (let k = 0; k < n / 2; k++) half.add((m + k) % n);
      const step = (2 * Math.PI) / n;
      const a0 = m * step - step / 2, a1 = a0 + Math.PI;
      const [x0, y0] = at(a0, R + 28), [x1, y1] = at(a1, R + 28);
      const [p0, q0] = at(a0, R + 22), [p1, q1] = at(a1, R + 22);
      svg.appendChild(el("path", { d: `M${p0},${q0} A${R + 22},${R + 22} 0 0 1 ${p1},${q1}` }, "arc"));
      svg.appendChild(el("line", { x1: x0, y1: y0, x2: x1, y2: y1 }, "diameter"));
    }
    const rr = Math.min(17, (Math.PI * R) / n - 2);
    for (let i = 0; i < n; i++) {
      const [x, y] = at(angle(i));
      const g = el("g", { tabindex: "0", role: "button", transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` }, `chip ${state.red[i] ? "red" : "green"}${half.has(i) ? " in" : ""}`);
      g.dataset.i = String(i);
      g.setAttribute("aria-label", `Chip ${i + 1}, ${state.red[i] ? "red" : "green"}${half.has(i) ? ", in the balanced half" : ""}`);
      g.appendChild(el("circle", { r: rr }));
      svg.appendChild(g);
    }
    if (focusAt !== null) { const f = svg.querySelector(`.chip[data-i="${focusAt}"]`); if (f) f.focus(); focusAt = null; }

    // the walk r(m) - g(m)
    plot.textContent = "";
    const w = Core.walk(state), W = 400, H = 120, top = Math.max(2, ...w.map(Math.abs));
    const X = (k) => 20 + (k * (W - 40)) / n, Y = (v) => H / 2 - (v / top) * (H / 2 - 12);
    plot.appendChild(el("line", { x1: 20, y1: H / 2, x2: W - 20, y2: H / 2 }, "axis"));
    let d = "";
    w.forEach((v, k) => { d += `${k ? "L" : "M"}${X(k).toFixed(1)},${Y(v).toFixed(1)} L${X(k + 1).toFixed(1)},${Y(v).toFixed(1)} `; });
    plot.appendChild(el("path", { d }, "steps"));
    w.forEach((v, k) => { if (v === 0) plot.appendChild(el("circle", { cx: ((X(k) + X(k + 1)) / 2).toFixed(1), cy: Y(0), r: 4 }, "zero")); });

    const c = Core.counts(state);
    if (c.red !== c.green) statusEl.textContent = `Reds: ${c.red}, greens: ${c.green}. The puzzle needs equal numbers: flip one more chip.`;
    else statusEl.textContent = `Reds: ${c.red}, greens: ${c.green}. The half circle from chip ${m + 1} to chip ${((m + n / 2 - 1) % n) + 1} has ${n / 4} of each.`;
    if (window.Track) window.Track.state({ n, red: state.red });
  }

  function flip(i) { const s = Core.flip(state, i); if (s) state = s; render(); }
  svg.addEventListener("click", (e) => { const g = e.target.closest(".chip"); if (g) flip(Number(g.dataset.i)); });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest && e.target.closest(".chip");
    if (!g) return;
    const i = Number(g.dataset.i);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focusAt = i; flip(i); }
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); svg.querySelector(`.chip[data-i="${(i + 1) % state.n}"]`).focus(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); svg.querySelector(`.chip[data-i="${(i + state.n - 1) % state.n}"]`).focus(); }
  });
  function reset() { state = Core.start({ n: nIn.value }); nIn.value = String(state.n); render(); }
  nIn.addEventListener("change", reset);
  document.getElementById("resetBtn").addEventListener("click", reset);

  render();
})();
