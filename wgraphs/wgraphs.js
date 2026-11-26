"use strict";

/*
 * The WGraphs page: drawing and input only; the rules are in wgraphs-core.js.
 * The stage holds one SVG whose vertices are dots and whose edges are real
 * ARIA buttons: click, tap, Enter or Space marks the cheapest unmarked edge.
 * Arrow keys walk the edges in weight order. Buttons above the board choose
 * the applet's two algorithms and its two sample graphs; Reset starts over.
 */

(function () {
  const Core = WgraphsCore;
  const stageEl = document.getElementById("stage");
  const svg = document.getElementById("graph");
  const countEl = document.getElementById("count");
  const statusEl = document.getElementById("status");
  const graphIn = document.getElementById("graphIn");
  const cheapestBtn = document.getElementById("cheapestBtn");
  const kruskalBtn = document.getElementById("kruskalBtn");
  const resetBtn = document.getElementById("resetBtn");
  const NS = "http://www.w3.org/2000/svg";

  let state = null;

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs, cls, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render() {
    const graph = Core.GRAPHS[state.graph];
    const xy = (v) => [graph.nodes[v][0] * 320, graph.nodes[v][1] * 200];
    const focused = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.edge;

    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 320 200");
    svg.setAttribute("aria-label", `${graph.label}: ${state.mode === "cheapest" ? "Cheapest Link" : "Kruskal"} on ${graph.nodes.length} dots`);

    const lines = el("g", { class: "wires" });
    const labels = el("g", { class: "weights" });
    for (const edge of state.edges) {
      const [x1, y1] = xy(edge.u), [x2, y2] = xy(edge.v);
      const cls = edge.status === Core.SELECTED ? "edge selected"
        : edge.status === Core.DISQUALIFIED ? "edge disqualified" : "edge";
      const g = el("g", { role: "button", tabindex: "0", "data-edge": edge.id,
        "aria-label": `Edge ${edge.u + 1} to ${edge.v + 1}, weight ${edge.w}, ${edge.status === Core.SELECTED ? "marked" : edge.status === Core.DISQUALIFIED ? "tried" : "unmarked"}` }, cls);
      // A transparent box gives a vertical edge a non-zero bounding box, so
      // it can be clicked and focused like any other edge.
      g.appendChild(el("rect", { x: Math.min(x1, x2) - 7, y: Math.min(y1, y2) - 7,
        width: Math.abs(x2 - x1) + 14, height: Math.abs(y2 - y1) + 14 }, "box"));
      g.appendChild(el("line", { x1, y1, x2, y2 }, "halo"));
      g.appendChild(el("line", { x1, y1, x2, y2 }, "wire"));
      g.appendChild(el("line", { x1, y1, x2, y2 }, "hit"));
      g.addEventListener("click", () => choose(edge.id));
      g.addEventListener("keydown", (ev) => key(ev, edge.id));
      lines.appendChild(g);

      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const big = graph.key === "large";
      const r = big ? 6 : 8;
      const lx = mx - (dy / len) * (r + 2), ly = my + (dx / len) * (r + 2);
      const tag = el("g", { class: "weight-tag" });
      tag.appendChild(el("circle", { cx: lx, cy: ly, r }, "weight-bg"));
      tag.appendChild(el("text", { x: lx, y: ly + (big ? 2.5 : 3) }, big ? "weight tiny" : "weight", String(edge.w)));
      labels.appendChild(tag);
    }
    svg.appendChild(lines);
    svg.appendChild(labels);

    const dots = el("g", { class: "dots" });
    graph.nodes.forEach((_, v) => {
      const [x, y] = xy(v);
      dots.appendChild(el("circle", { cx: x, cy: y, r: graph.key === "large" ? 4.5 : 6 }, "dot"));
      if (graph.key === "small") dots.appendChild(el("text", { x: x + 9, y: y - 7 }, "dot-label", String(v + 1)));
    });
    svg.appendChild(dots);

    const marked = Core.selectedCount(state);
    countEl.textContent = `Marked ${marked} edge${marked === 1 ? "" : "s"} · total weight ${Core.totalWeight(state)}`;
    graphIn.value = state.graph;
    cheapestBtn.setAttribute("aria-pressed", String(state.mode === "cheapest"));
    kruskalBtn.setAttribute("aria-pressed", String(state.mode === "kruskal"));

    if (focused !== undefined) {
      const again = svg.querySelector(`[data-edge="${focused}"]`);
      if (again) again.focus({ preventScroll: true });
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function choose(id) {
    const next = Core.move(state, id);
    if (!next) return;
    state = next;
    render();
    if (state.announcement) say(state.announcement, state.done ? "done" : null);
  }

  function key(ev, id) {
    const edges = state.edges;
    const at = edges.findIndex((e) => e.id === id);
    let target = null;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      choose(id);
      const again = svg.querySelector(`[data-edge="${id}"]`);
      if (again) again.focus({ preventScroll: true });
      return;
    }
    if (ev.key === "ArrowRight" || ev.key === "ArrowDown") target = edges[(at + 1) % edges.length];
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") target = edges[(at - 1 + edges.length) % edges.length];
    else if (ev.key === "Home") target = edges[0];
    else if (ev.key === "End") target = edges[edges.length - 1];
    else return;
    ev.preventDefault();
    const found = svg.querySelector(`[data-edge="${target.id}"]`);
    if (found) found.focus({ preventScroll: true });
  }

  function newGame(options) {
    state = Core.start(options);
    say("Click the cheapest unmarked edge.");
    render();
  }

  function current() {
    return { graph: graphIn.value, mode: kruskalBtn.getAttribute("aria-pressed") === "true" ? "kruskal" : "cheapest" };
  }

  graphIn.addEventListener("change", () => newGame(current()));
  cheapestBtn.addEventListener("click", () => {
    cheapestBtn.setAttribute("aria-pressed", "true");
    kruskalBtn.setAttribute("aria-pressed", "false");
    newGame(current());
  });
  kruskalBtn.addEventListener("click", () => {
    kruskalBtn.setAttribute("aria-pressed", "true");
    cheapestBtn.setAttribute("aria-pressed", "false");
    newGame(current());
  });
  resetBtn.addEventListener("click", () => newGame(current()));

  newGame({ graph: "small", mode: "cheapest" });
})();
