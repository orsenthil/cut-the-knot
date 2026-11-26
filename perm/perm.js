"use strict";

/*
 * The page for Various Ways to Define a Permutation: drawing and input only.
 * Two rows of numbered circles; a table shows f(i) under i, "Lines" joins i to
 * f(i), "Upside down" puts the upper row in the order that makes the lines
 * vertical (the inverse). Pressing a number marks where it goes. The cycles
 * and the table of inversions are written under the picture. The maths is in
 * perm-core.js.
 */

(function () {
  const Core = PermCore;
  const svg = document.getElementById("board");
  const facts = document.getElementById("facts");
  const statusEl = document.getElementById("status");
  const viewSel = document.getElementById("viewSel"), nIn = document.getElementById("nIn"), newBtn = document.getElementById("newBtn");
  const NS = "http://www.w3.org/2000/svg";

  let state = Core.start({ n: Core.DEFAULT_N });
  let pick = null;

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

  function render() {
    svg.textContent = "";
    const n = state.n, f = state.f, W = 400, top = 30, bottom = 150;
    const dx = (W - 20) / n, r = Math.min(14, dx / 2 - 1);
    const x = (k) => 10 + dx * (k + 0.5);
    // upper row: natural order; in the upside-down view it is f^-1 so that every line is vertical
    const upper = state.view === "upside" ? Core.inverse(f) : f.map((_, i) => i + 1);
    const lower = state.view === "upside" ? upper.map((_, i) => i + 1) : f;
    if (state.view !== "table") {
      // link i (upper) to f(i) (lower)
      for (let k = 0; k < n; k++) {
        const i = upper[k];
        const lowerIdx = state.view === "upside" ? k : f[i - 1] - 1;
        const marked = pick === i;
        el("line", { x1: x(k).toFixed(1), y1: top, x2: x(lowerIdx).toFixed(1), y2: bottom, class: "link", "stroke-opacity": marked || pick === null ? 1 : 0.35, "stroke-width": marked ? 4 : 2 });
      }
    }
    const drawRow = (row, y, isUpper) => row.forEach((v, k) => {
      const g = el("g", {});
      const showTable = state.view === "table";
      const c = el("circle", { cx: x(k).toFixed(1), cy: y, r: r.toFixed(1), class: "node", tabindex: "0", role: "button", "aria-label": isUpper ? `Number ${v} goes to ${f[v - 1]}` : `Place ${k + 1} holds ${v}`, style: pick === v ? "fill: var(--highlight); stroke: var(--accent); stroke-width: 3" : "" }, g);
      const t = el("text", { x: x(k).toFixed(1), y }, g);
      t.textContent = String(v);
      const choose = () => { pick = pick === v ? null : v; render(); };
      c.addEventListener("click", choose);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
      return showTable;
    });
    drawRow(upper, top, true);
    drawRow(lower, bottom, false);
    const inv = Core.inversions(f);
    facts.innerHTML = "";
    const line = (label, text) => {
      const b = document.createElement("b"); b.textContent = label + " ";
      facts.append(b, document.createTextNode(text), document.createElement("br"));
    };
    line("List:", `{${f.join(", ")}}`);
    line("Cycles:", Core.cycleText(f));
    line("Inversions:", `(${inv.join(", ")})`);
    if (pick !== null) say(`${pick} goes to ${f[pick - 1]}, and ${Core.inverse(f)[pick - 1]} goes to ${pick}.`);
    else say("");
    viewSel.value = state.view;
    nIn.value = String(n);
    if (window.Track) window.Track.state({ n, f, view: state.view });
  }

  newBtn.addEventListener("click", () => { pick = null; state = Core.start({ n: nIn.value, view: viewSel.value }); render(); });
  nIn.addEventListener("change", () => { pick = null; state = Core.start({ n: nIn.value, view: viewSel.value }); render(); });
  viewSel.addEventListener("change", () => { state = Object.assign({}, state, { view: viewSel.value }); render(); });

  render();
})();
