"use strict";

/* Browser UI: click vertices to trace an Euler or Hamilton path on example graphs. */
(() => {
  const C = EulerHamiltonPathsCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const graphSel = document.getElementById("graphSel");
  const modeRadios = [...document.querySelectorAll('input[name="mode"]')];
  const backBtn = document.getElementById("backBtn");
  const clearBtn = document.getElementById("clearBtn");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;

  function render() {
    svg.replaceChildren();
    const graph = C.GRAPHS[state.graph];
    const seq = state.sequence;
    const used = new Set();
    for (let i = 0; i + 1 < seq.length; i++) used.add(`${Math.min(seq[i], seq[i + 1])}-${Math.max(seq[i], seq[i + 1])}`);
    const X = (v) => 50 + graph.vertices[v].x * 280;
    const Y = (v) => 40 + graph.vertices[v].y * 260;

    graph.edges.forEach(([u, v]) => {
      const key = `${Math.min(u, v)}-${Math.max(u, v)}`;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", X(u));
      line.setAttribute("y1", Y(u));
      line.setAttribute("x2", X(v));
      line.setAttribute("y2", Y(v));
      line.setAttribute("class", "edge" + (used.has(key) ? " used" : ""));
      svg.appendChild(line);
    });

    graph.vertices.forEach((_, i) => {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "node" + (seq[seq.length - 1] === i ? " last" : ""));
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `Vertex ${i}, click to add to your path`);
      g.appendChild(Object.assign(document.createElementNS(SVG_NS, "circle"), { }));
      const c = g.lastChild;
      c.setAttribute("cx", X(i));
      c.setAttribute("cy", Y(i));
      c.setAttribute("r", 18);
      const t = document.createElementNS(SVG_NS, "text");
      t.setAttribute("x", X(i));
      t.setAttribute("y", Y(i) + 5);
      t.textContent = String(i);
      g.appendChild(t);
      const go = () => {
        state = C.click(state, i);
        render();
        const again = svg.querySelectorAll(".node")[i];
        if (again) again.focus();
      };
      g.addEventListener("click", go);
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } });
      svg.appendChild(g);
    });

    backBtn.disabled = seq.length === 0;
    graphSel.value = String(state.graph);
    modeRadios.forEach((r) => { r.checked = r.value === state.mode; });

    const verdict = seq.length
      ? (state.mode === "euler" ? C.checkEuler(graph, seq) : C.checkHamilton(graph, seq))
      : null;
    say(verdict ? verdict.why : `Click vertices in order to find a ${state.mode === "euler" ? "path using every edge once" : "path visiting every vertex once"}.`);
    if (window.Track) window.Track.state({ graph: state.graph, mode: state.mode, sequence: seq.slice() });
  }

  function say(text) {
    status.textContent = text;
    status.classList.remove("done");
    if (text.includes("all")) status.classList.add("done");
  }

  graphSel.addEventListener("change", () => {
    state = { graph: Number(graphSel.value), mode: state.mode, sequence: [] };
    render();
  });
  modeRadios.forEach((r) => r.addEventListener("change", () => {
    if (r.checked) { state = { ...state, mode: r.value, sequence: [] }; render(); }
  }));
  backBtn.addEventListener("click", () => {
    state = { ...state, sequence: state.sequence.slice(0, -1) };
    render();
  });
  clearBtn.addEventListener("click", () => {
    state = { ...state, sequence: [] };
    render();
  });

  state = C.start();
  render();
})();
