"use strict";

/*
 * Browser UI for the isosceles-triangle fallacy. The geometry and the checks
 * are in isosceles-fallacy-core.js.
 *
 * Drag A, B or C to reshape the triangle. "Honest drawing" shows the real
 * construction, where P lies on the circumcircle and one foot falls outside
 * its side; the default "misleading drawing" reproduces the applet's faked
 * picture, where both feet look as if they are inside.
 */

(() => {
  const C = IsoscelesFallacyCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const namesCheck = document.getElementById("namesCheck");
  const hintCheck = document.getElementById("hintCheck");
  const modeCheck = document.getElementById("modeCheck");
  const resetBtn = document.getElementById("resetBtn");

  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;
  let drag = null;

  const el = (name, attrs) => {
    const n = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const point = (p, cls, label) => {
    const g = el("g", { class: "pt-group" });
    g.appendChild(el("circle", { cx: p.x, cy: p.y, r: 6, class: "pt " + cls }));
    if (label) {
      const t = el("text", { x: p.x + 9, y: p.y - 8, class: "pt-label" });
      t.textContent = label;
      g.appendChild(t);
    }
    return g;
  };
  const line = (a, b, cls) => el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: cls });

  function render() {
    svg.replaceChildren();
    const g = C.geometry(state);
    if (g.drawable) {
      svg.appendChild(el("circle", { cx: g.O.x, cy: g.O.y, r: g.R, class: "circumcircle" }));
      svg.appendChild(line(state.A, g.P, "aux"));
      svg.appendChild(line(state.B, g.P, "aux"));
      svg.appendChild(line(state.C, g.P, "bisector"));
      svg.appendChild(line(g.midpointAB, g.P, "bisector"));
      svg.appendChild(line(g.P, g.U, "perp"));
      svg.appendChild(line(g.P, g.V, "perp"));
      svg.appendChild(el("polygon", {
        points: `${state.A.x},${state.A.y} ${state.B.x},${state.B.y} ${state.C.x},${state.C.y}`,
        class: "triangle",
      }));
      svg.appendChild(point(g.M, "m", state.showNames ? "M" : ""));
      svg.appendChild(point(g.P, "p", state.showNames ? "P" : ""));
      svg.appendChild(point(g.U, "u", state.showNames ? "U" : ""));
      svg.appendChild(point(g.V, "v", state.showNames ? "V" : ""));
    }
    for (const [name, cls] of [["A", "vertex"], ["B", "vertex"], ["C", "vertex"]]) {
      const v = state[name];
      const group = el("g", { class: "handle", "data-name": name, tabindex: "0", role: "button" });
      group.setAttribute("aria-label", `Vertex ${name}, drag to move`);
      group.appendChild(el("circle", { cx: v.x, cy: v.y, r: 13, class: "hit" }));
      group.appendChild(el("circle", { cx: v.x, cy: v.y, r: 7, class: "pt " + cls }));
      if (state.showNames) {
        const t = el("text", { x: v.x - 14, y: v.y - 12, class: "pt-label" });
        t.textContent = name;
        group.appendChild(t);
      }
      group.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        drag = name;
        group.setPointerCapture(ev.pointerId);
      });
      group.addEventListener("pointermove", (ev) => {
        if (drag !== name) return;
        const rect = svg.getBoundingClientRect();
        const view = svg.viewBox.baseVal;
        const p = {
          x: (ev.clientX - rect.left) * view.width / rect.width,
          y: (ev.clientY - rect.top) * view.height / rect.height,
        };
        state = C.moveVertex(state, name, p);
        render();
        const handle = svg.querySelector(`.handle[data-name="${name}"]`);
        if (handle) handle.focus();
      });
      group.addEventListener("pointerup", () => { drag = null; });
      svg.appendChild(group);
    }

    if (state.showHint) {
      const t = el("text", { x: 12, y: 22, class: "hint" });
      t.textContent = state.mode === "right"
        ? "P is on the circumcircle: one foot lies beyond its side."
        : "The picture is shifted so both feet look inside — that is the trick.";
      svg.appendChild(t);
    }

    if (state.mode === "right") {
      status.textContent = g.uOnSide !== g.vOnSide
        ? "Honest drawing: P is on the circumcircle and one foot falls outside its side — so AC = AU + CU is false."
        : "Honest drawing: P is on the circumcircle of ABC.";
    } else {
      status.textContent = g.uOnSide && g.vOnSide
        ? "Misleading drawing: both feet look inside the sides, so the fake proof seems to work."
        : "Misleading drawing — drag the vertices to see how the picture cheats.";
    }
    if (window.Track) {
      window.Track.state({ A: state.A, B: state.B, C: state.C, mode: state.mode, pOnCircle: g.pOnCircle });
    }
  }

  namesCheck.addEventListener("change", () => {
    state = { ...state, showNames: namesCheck.checked };
    render();
  });
  hintCheck.addEventListener("change", () => {
    state = { ...state, showHint: hintCheck.checked };
    render();
  });
  modeCheck.addEventListener("change", () => {
    state = C.setMode(state, modeCheck.checked ? "right" : "faulty");
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = C.start();
    namesCheck.checked = state.showNames;
    hintCheck.checked = state.showHint;
    modeCheck.checked = false;
    render();
  });

  state = C.start();
  namesCheck.checked = state.showNames;
  render();
})();
