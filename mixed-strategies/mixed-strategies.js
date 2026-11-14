"use strict";

/*
 * UI for the Mixed Strategies applet. Each original CTKNumber was changed by
 * clicking beside its vertical centre: left subtracts 1 and right adds 1.
 * The SVG turns the applet's two payoff lines into a responsive plot.
 */
(() => {
  const M = MixedStrategiesCore;
  const matrixEl = document.getElementById("matrix");
  const arrowsEl = document.getElementById("arrows");
  const resultEl = document.getElementById("result");
  const plot = document.getElementById("plot");
  const resetBtn = document.getElementById("resetBtn");
  const SVG = "http://www.w3.org/2000/svg";
  let state = M.create();
  let suppressClick = false;

  const node = (name, attrs, text) => {
    const el = document.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (text) el.textContent = text;
    return el;
  };

  function drawPlot(matrix, mixed) {
    const [[a, b], [c, d]] = matrix;
    const values = [a, b, c, d];
    if (mixed) values.push(mixed.value.n / mixed.value.d);
    const min = Math.min(...values, 0) - 1;
    const max = Math.max(...values, 0) + 1;
    const left = 38, right = 316, top = 15, bottom = 195;
    const x = (p) => left + p * (right - left);
    const y = (value) => bottom - ((value - min) / (max - min)) * (bottom - top);
    plot.replaceChildren();
    for (let value = Math.ceil(min); value <= Math.floor(max); value++) {
      plot.appendChild(node("line", { x1: left, y1: y(value), x2: right, y2: y(value), class: "grid" }));
      plot.appendChild(node("text", { x: 5, y: y(value) + 4, class: "plot-label" }, String(value)));
    }
    plot.appendChild(node("line", { x1: left, y1: bottom, x2: right, y2: bottom, class: "axis" }));
    plot.appendChild(node("line", { x1: left, y1: top, x2: left, y2: bottom, class: "axis" }));
    plot.appendChild(node("path", { d: `M ${x(0)} ${y(a)} L ${x(1)} ${y(c)}`, class: "line-a" }));
    plot.appendChild(node("path", { d: `M ${x(0)} ${y(b)} L ${x(1)} ${y(d)}`, class: "line-b" }));
    plot.appendChild(node("text", { x: x(0), y: 217, class: "plot-label", "text-anchor": "middle" }, "row 1"));
    plot.appendChild(node("text", { x: x(1), y: 217, class: "plot-label", "text-anchor": "middle" }, "row 2"));
    if (mixed) {
      const p = mixed.p.n / mixed.p.d;
      const value = mixed.value.n / mixed.value.d;
      plot.appendChild(node("circle", { cx: x(p), cy: y(value), r: 5, class: "dot" }));
    }
  }

  function render() {
    const analysis = M.analyse(state.matrix);
    matrixEl.replaceChildren();
    state.matrix.flat().forEach((value, cell) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "payoff";
      button.textContent = String(value);
      button.setAttribute("aria-label", `Payoff ${cell + 1}: ${value}. Click left to subtract one or right to add one.`);
      const change = (event) => {
        if (suppressClick) { suppressClick = false; return; }
        const rect = button.getBoundingClientRect();
        M.adjust(state, cell, event.clientX >= rect.left + rect.width / 2 ? 1 : -1);
        render();
      };
      button.addEventListener("click", change);
      button.addEventListener("pointermove", (event) => {
        if (event.buttons !== 1) return;
        const rect = button.getBoundingClientRect();
        suppressClick = true;
        M.adjust(state, cell, event.clientX >= rect.left + rect.width / 2 ? 1 : -1);
        render();
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); M.adjust(state, cell, 1); render(); }
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); M.adjust(state, cell, -1); render(); }
      });
      matrixEl.appendChild(button);
    });
    const arrowLabels = M.arrows(state.matrix).map(({ from, to }) => {
      const sameRow = Math.floor(from / 2) === Math.floor(to / 2);
      return sameRow
        ? `row ${Math.floor(from / 2) + 1}: ${from % 2 + 1} → ${to % 2 + 1}`
        : `column ${from % 2 + 1}: ${Math.floor(from / 2) + 1} ${from < to ? "↓" : "↑"} ${Math.floor(to / 2) + 1}`;
    });
    arrowsEl.textContent = `Arrows: ${arrowLabels.join(" · ")}. ${analysis.saddles.length
      ? `Saddle point${analysis.saddles.length === 1 ? "" : "s"}: ${analysis.saddles.map((s) => `row ${s.row + 1}, column ${s.col + 1}`).join("; ")}.`
      : "No saddle point."}`;
    if (analysis.mixed) {
      const { p, q, value } = analysis.mixed;
      resultEl.innerHTML = `<strong>Stable mixture</strong><br>Row 1: ${M.fractionText(p)} · Column 1: ${M.fractionText(q)} · Value: ${M.fractionText(value)}`;
    } else if (analysis.saddles.length) {
      resultEl.textContent = "A saddle point gives both players a safe single choice.";
    } else {
      resultEl.textContent = "No stable mixture with both choices in use for this table.";
    }
    drawPlot(state.matrix, analysis.mixed);
  }

  resetBtn.addEventListener("click", () => { state = M.create(); render(); });
  window.addEventListener("themechange", render);
  render();
})();
