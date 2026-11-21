"use strict";

/* Browser UI for the general polygon construction: draggable centres, editable angles. */
(() => {
  const C = GenConConstructionCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const anglesEl = document.getElementById("angles");
  const resetBtn = document.getElementById("resetBtn");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;
  let drag = null;

  const el = (name, attrs) => {
    const n = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };

  function render() {
    svg.replaceChildren();
    anglesEl.replaceChildren();
    const poly = C.polygon(state.points, state.angles);
    const fp = C.fixedPoint(state.points, state.angles);

    state.points.forEach((p, i) => {
      const g = el("g", { class: "handle", "data-index": String(i), tabindex: "0", role: "button" });
      g.setAttribute("aria-label", `Centre M${i + 1}, drag to move`);
      g.appendChild(el("circle", { cx: p.x, cy: p.y, r: 14, class: "hit" }));
      g.appendChild(el("circle", { cx: p.x, cy: p.y, r: 8, class: "centre" }));
      const t = el("text", { x: p.x + 12, y: p.y - 10, class: "label" });
      t.textContent = `M${i + 1}`;
      g.appendChild(t);
      g.addEventListener("pointerdown", (ev) => { drag = i; g.setPointerCapture(ev.pointerId); });
      g.addEventListener("pointermove", (ev) => {
        if (drag !== i) return;
        const box = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        state = C.movePoint(state, i, { x: (ev.clientX - box.left) * vb.width / box.width, y: (ev.clientY - box.top) * vb.height / box.height });
        render();
        const h = svg.querySelector(`.handle[data-index="${i}"]`);
        if (h) h.focus();
      });
      g.addEventListener("pointerup", () => { drag = null; });
      svg.appendChild(g);

      const label = document.createElement("label");
      label.textContent = `a${i + 1}: `;
      const input = document.createElement("input");
      input.type = "number";
      input.min = "-360";
      input.max = "360";
      input.step = "5";
      input.value = String(state.angles[i]);
      input.setAttribute("aria-label", `Angle at centre ${i + 1}`);
      input.addEventListener("change", () => {
        state = C.setAngle(state, i, Number(input.value));
        render();
      });
      label.appendChild(input);
      anglesEl.appendChild(label);
    });

    if (poly) {
      svg.appendChild(el("polygon", {
        points: poly.slice(0, -1).map((p) => `${p.x},${p.y}`).join(" "),
        class: "polygon",
      }));
      poly.slice(0, -1).forEach((p, i) => {
        svg.appendChild(el("circle", { cx: p.x, cy: p.y, r: 5, class: "vertex" }));
        const t = el("text", { x: p.x + 8, y: p.y + 4, class: "label" });
        t.textContent = `A${i + 1}`;
        svg.appendChild(t);
      });
      if (fp) svg.appendChild(el("circle", { cx: fp.x, cy: fp.y, r: 6, class: "fixed" }));
    }

    status.textContent = poly
      ? `A polygon closes for these ${state.points.length} centres; total angle ${C.totalAngle(state.angles)}°.`
      : `No polygon: the angles add to a multiple of 360° (total ${C.totalAngle(state.angles)}°), so the construction breaks down.`;
    if (window.Track) window.Track.state({ points: state.points, angles: state.angles, total: C.totalAngle(state.angles) });
  }

  resetBtn.addEventListener("click", () => { state = C.start(); render(); });
  state = C.start();
  render();
})();
