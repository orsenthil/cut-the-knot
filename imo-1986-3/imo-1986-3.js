"use strict";

/* Browser UI: five editable numbers on a pentagon; click a negative to step. */
(() => {
  const C = Imo1986_3Core;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const stepBtn = document.getElementById("stepBtn");
  const solveBtn = document.getElementById("solveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const potentialEl = document.getElementById("potential");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;

  function render() {
    svg.replaceChildren();
    const pts = Array.from({ length: 5 }, (_, i) => ({
      x: 150 + 110 * Math.cos(-Math.PI / 2 + 2 * Math.PI * i / 5),
      y: 130 + 110 * Math.sin(-Math.PI / 2 + 2 * Math.PI * i / 5),
    }));
    for (let i = 0; i < 5; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 5];
      svg.appendChild(Object.assign(document.createElementNS(SVG_NS, "line"), { }));
      const line = svg.lastChild;
      line.setAttribute("x1", a.x);
      line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x);
      line.setAttribute("y2", b.y);
      line.setAttribute("class", "edge");
    }
    state.values.forEach((value, i) => {
      const p = pts[i];
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "vertex" + (value < 0 ? " negative" : ""));
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `Vertex ${i + 1}: ${value}${value < 0 ? ", click to apply the operation" : ""}`);
      g.appendChild(Object.assign(document.createElementNS(SVG_NS, "circle"), {}));
      const circle = g.lastChild;
      circle.setAttribute("cx", p.x);
      circle.setAttribute("cy", p.y);
      circle.setAttribute("r", 24);
      const t = document.createElementNS(SVG_NS, "text");
      t.setAttribute("x", p.x);
      t.setAttribute("y", p.y + 5);
      t.textContent = String(value);
      g.appendChild(t);
      const go = () => {
        const next = C.step(state, i);
        if (!next) return;
        state = next;
        render();
        const again = svg.querySelectorAll(".vertex")[i];
        if (again) again.focus();
      };
      g.addEventListener("click", go);
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } });
      svg.appendChild(g);
    });

    const negatives = C.negativeIndices(state.values);
    stepBtn.disabled = negatives.length === 0;
    stepBtn.textContent = negatives.length ? `Step at vertex ${negatives[0] + 1}` : "No negative numbers";
    solveBtn.disabled = negatives.length === 0;
    potentialEl.textContent = `Sum = ${state.values.reduce((a, b) => a + b, 0)} · f = ${C.potential(state.values)} · steps = ${state.steps}`;
    status.textContent = negatives.length === 0
      ? `Finished after ${state.steps} steps. Every number is now nonnegative.`
      : `Click a negative number to flip it and add it to its two neighbours. ${negatives.length} negative left.`;
    if (window.Track) window.Track.state({ values: state.values.slice(), steps: state.steps, potential: C.potential(state.values) });
  }

  stepBtn.addEventListener("click", () => {
    const negatives = C.negativeIndices(state.values);
    if (!negatives.length) return;
    state = C.step(state, negatives[0]);
    render();
  });
  solveBtn.addEventListener("click", () => {
    state = C.solve(state.values);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = C.start();
    render();
  });

  state = C.start();
  render();
})();
