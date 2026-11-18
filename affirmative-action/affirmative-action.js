"use strict";

/*
 * Browser UI for the Affirmative Action problem: draw the graph and let the
 * player flip node colours, add nodes and edges, and search for an integrated
 * colouring. The rules and the proof check are in affirmative-action-core.js.
 *
 * Black and white circles are the two colours; a line joining different
 * colours is balanced. Click a node to flip it. Drag from one node to another
 * to add an edge, or into empty space (with "Add element") to add a node.
 */

(() => {
  const C = AffirmativeActionCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const clearBtn = document.getElementById("clearBtn");
  const popBtn = document.getElementById("popBtn");
  const maxBtn = document.getElementById("maxBtn");
  const addCheck = document.getElementById("addCheck");
  const degreesCheck = document.getElementById("degreesCheck");

  const SVG_NS = "http://www.w3.org/2000/svg";
  const STEP = 60;
  const PAD = 40;
  const RADIUS = 15;

  let graph = null;
  let drag = null;
  let note = "";

  const px = (node) => PAD + node.x * STEP;
  const py = (node) => PAD + node.y * STEP;
  const el = (name, attrs) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  function render() {
    svg.replaceChildren();
    for (const [u, v] of graph.edges) {
      const a = graph.nodes[u];
      const b = graph.nodes[v];
      if (!a || !b) continue;
      svg.appendChild(el("line", {
        x1: px(a), y1: py(a), x2: px(b), y2: py(b),
        class: "edge" + (a.color !== b.color ? " balanced" : ""),
      }));
    }

    graph.nodes.forEach((node, index) => {
      const group = el("g", { class: "node-group", "data-index": String(index), tabindex: "0", role: "button" });
      group.setAttribute("aria-label", `Node ${index + 1}, ${node.color === C.BLACK ? "black" : "white"}, click to flip`);
      group.appendChild(el("circle", {
        cx: px(node), cy: py(node), r: RADIUS,
        class: "node " + (node.color === C.BLACK ? "black" : "white"),
      }));
      if (degreesCheck.checked) {
        const { same, other } = C.neighbourCounts(graph, index);
        const text = el("text", { x: px(node), y: py(node) + 5, class: "degree-text" });
        text.textContent = `${other}/${same}`;
        group.appendChild(text);
      }
      group.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        drag = { from: index, x: ev.clientX, y: ev.clientY };
        group.setPointerCapture(ev.pointerId);
      });
      group.addEventListener("pointerup", (ev) => {
        if (!drag) return;
        const moved = Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 6;
        if (!moved) {
          note = "";
          graph = C.flip(graph, drag.from);
        } else {
          const target = document.elementFromPoint(ev.clientX, ev.clientY);
          const otherGroup = target && target.closest(".node-group");
          if (otherGroup && Number(otherGroup.dataset.index) !== drag.from) {
            note = "";
            graph = C.addEdge(graph, drag.from, Number(otherGroup.dataset.index));
          } else if (addCheck.checked) {
            const point = svgPoint(ev);
            const added = C.addNode(graph, (point.x - PAD) / STEP, (point.y - PAD) / STEP, C.WHITE);
            graph = C.addEdge(added, drag.from, added.nodes.length - 1);
            note = "New node joined to the one you dragged from.";
          }
        }
        drag = null;
        render();
      });
      group.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          note = "";
          graph = C.flip(graph, index);
          render();
          svg.querySelector(`.node-group[data-index="${index}"]`).focus();
        }
      });
      svg.appendChild(group);
    });

    const bad = C.nonIntegrated(graph);
    const balanced = C.balancedEdges(graph);
    if (note) status.textContent = note;
    else if (!graph.nodes.length) status.textContent = "The board is empty. Tick Add element and click to place nodes.";
    else status.textContent = `${graph.nodes.length} nodes, ${graph.edges.length} edges, ${balanced} balanced. ` +
      (bad.length ? `${bad.length} node${bad.length === 1 ? " is" : "s are"} not integrated.` : "Every node is integrated!");

    popBtn.disabled = graph.edges.length === 0 && graph.nodes.length === 0;
    maxBtn.disabled = graph.nodes.length === 0;

    if (window.Track) {
      window.Track.state({
        nodes: graph.nodes.map((n) => ({ ...n })), edges: graph.edges.map((e) => [...e]),
        balanced, notIntegrated: bad,
      });
    }
  }

  function svgPoint(ev) {
    const rect = svg.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    return {
      x: (ev.clientX - rect.left) * view.width / rect.width,
      y: (ev.clientY - rect.top) * view.height / rect.height,
    };
  }

  svg.addEventListener("pointerdown", (ev) => {
    if (ev.target !== svg || !addCheck.checked) return;
    const point = svgPoint(ev);
    graph = C.addNode(graph, (point.x - PAD) / STEP, (point.y - PAD) / STEP, C.WHITE);
    note = "A new white node appeared. Click it to change its colour.";
    render();
  });

  resetBtn.addEventListener("click", () => {
    graph = C.start();
    note = "";
    render();
  });
  clearBtn.addEventListener("click", () => {
    graph = C.empty();
    note = "";
    render();
  });
  popBtn.addEventListener("click", () => {
    graph = C.removeLast(graph);
    note = "Removed the last action.";
    render();
  });
  maxBtn.addEventListener("click", () => {
    const result = C.maximize(graph);
    graph = result.graph;
    note = result.integrated
      ? `Found an integrated colouring with ${result.balanced} balanced edges.`
      : "No integrated colouring found.";
    render();
  });
  degreesCheck.addEventListener("change", render);

  graph = C.start();
  render();
})();
