"use strict";

/* Browser UI for Rouse Ball's fallacy: draggable points and a hint toggle. */
(() => {
  const C = RouseBallFallacyCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const hintCheck = document.getElementById("hintCheck");
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
    const g = C.geometry(state);
    svg.appendChild(el("polygon", {
      points: `${state.A.x},${state.A.y} ${state.D.x},${state.D.y} ${state.C.x},${state.C.y} ${g.E.x},${g.E.y}`,
      class: "quad",
    }));
    svg.appendChild(el("line", { x1: state.C.x, y1: state.C.y, x2: g.E.x, y2: g.E.y, class: "edge" }));
    svg.appendChild(el("line", { x1: state.A.x, y1: state.A.y, x2: state.D.x, y2: state.D.y, class: "edge" }));
    if (Number.isFinite(g.O.x)) {
      svg.appendChild(el("line", { x1: g.E.x, y1: g.E.y, x2: g.O.x, y2: g.O.y, class: "ray" }));
      svg.appendChild(el("circle", { cx: g.O.x, cy: g.O.y, r: 6, class: "point-o" }));
    }
    for (const [name, p] of [["A", state.A], ["D", state.D], ["C", state.C], ["E", g.E]]) {
      svg.appendChild(el("circle", { cx: p.x, cy: p.y, r: 6, class: "point" }));
      const t = el("text", { x: p.x + 9, y: p.y - 8, class: "label" });
      t.textContent = name;
      svg.appendChild(t);
    }
    for (const [name, p] of [["A", state.A], ["D", state.D], ["C", state.C], ["E", state.E]]) {
      const h = el("g", { class: "handle", "data-name": name, tabindex: "0", role: "button" });
      h.setAttribute("aria-label", `Point ${name}, drag to move`);
      h.appendChild(el("circle", { cx: p.x, cy: p.y, r: 14, class: "hit" }));
      h.addEventListener("pointerdown", (ev) => { drag = name; h.setPointerCapture(ev.pointerId); });
      h.addEventListener("pointermove", (ev) => {
        if (drag !== name) return;
        const box = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        state = C.setPoint(state, name, { x: (ev.clientX - box.left) * vb.width / box.width, y: (ev.clientY - box.top) * vb.height / box.height });
        render();
        const hh = svg.querySelector(`.handle[data-name="${name}"]`);
        if (hh) hh.focus();
      });
      h.addEventListener("pointerup", () => { drag = null; });
      svg.appendChild(h);
    }

    const a = g.proofAngles;
    status.textContent = hintCheck.checked
      ? `All congruences hold: CO = EO, DO = AO. But the "proof" subtracts ${a.ADO.toFixed(0)}° from ${a.CDO.toFixed(0)}° — the angle DAE is still ${g.angleDAE.toFixed(0)}°, not 90°. The subtraction is the error: the ray EO leaves the quadrilateral.`
      : `CO = EO, DO = AO and DC = AE, so the triangles match. Yet the obtuse angle DAE is ${g.angleDAE.toFixed(0)}°. What is wrong?`;
    if (window.Track) window.Track.state({ A: state.A, D: state.D, C: state.C, E: state.E, angleDAE: g.angleDAE });
  }

  hintCheck.addEventListener("change", render);
  resetBtn.addEventListener("click", () => { state = C.start(); render(); });
  state = C.start();
  render();
})();
