"use strict";

/*
 * Browser UI for the Simple Graphs demo. Click empty space to add a vertex;
 * drag from a vertex to another to add an edge. In Move mode a drag repositions
 * a vertex instead. Pop undoes the last edge and Reset clears the board. The
 * SVG is styled with CSS classes; all graph arithmetic is in simple-graphs-core.js.
 */

(() => {
  const C = SimpleGraphsCore;
  const svg = document.getElementById("diagram");
  const statusEl = document.getElementById("status");
  const statsEl = document.getElementById("stats");
  const radius = 12;
  let state = C.start();
  let dragFrom = null;

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function element(name, attrs, className) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (className) node.setAttribute("class", className);
    return node;
  }

  function toViewBox(event) {
    const rect = svg.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (600 / rect.width),
      y: (event.clientY - rect.top) * (400 / rect.height),
    };
  }

  function nearest(at) {
    let best = null;
    let distance = Infinity;
    for (const node of state.nodes) {
      const d = Math.hypot(node.x - at.x, node.y - at.y);
      if (d < distance) { distance = d; best = node; }
    }
    return distance <= radius * 2 ? best : null;
  }

  function render() {
    svg.replaceChildren();
    for (const e of state.edges) {
      const a = state.nodes.find((n) => n.id === e.a);
      const b = state.nodes.find((n) => n.id === e.b);
      if (!a || !b) continue;
      if (e.a === e.b) {
        svg.appendChild(element("circle", {
          cx: a.x, cy: a.y - radius - 9, r: 11 + 2 * e.count,
        }, "loop"));
      } else {
        svg.appendChild(element("line", {
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          "stroke-width": 1.5 + e.count,
        }, "edge"));
      }
    }
    const stats = C.stats(state);
    for (const node of state.nodes) {
      const circle = element("circle", {
        cx: node.x, cy: node.y, r: radius,
        tabindex: 0,
        role: "button",
        "aria-label": `Vertex ${node.id} at ${Math.round(node.x)}, ${Math.round(node.y)}, ` +
          `degree ${stats.degrees.find((d) => d.id === node.id)?.degree ?? 0}.`,
      }, "vertex");
      circle.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        dragFrom = node.id;
      });
      circle.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 10 : 1;
        const moves = {
          ArrowRight: [node.x + step, node.y], ArrowLeft: [node.x - step, node.y],
          ArrowUp: [node.x, node.y - step], ArrowDown: [node.x, node.y + step],
        };
        if (moves[event.key]) {
          event.preventDefault();
          state = C.moveNode(state, node.id, ...moves[event.key]);
          render();
          svg.querySelector(`[data-id="${node.id}"]`)?.focus();
        }
      });
      circle.dataset.id = String(node.id);
      svg.appendChild(circle);
      if (state.showDegrees) {
        const label = element("text", {
          x: node.x + radius + 3, y: node.y - radius - 3, "font-size": 14,
        }, "degree-label");
        label.textContent = String(stats.degrees.find((d) => d.id === node.id)?.degree ?? 0);
        svg.appendChild(label);
      }
    }
    statsEl.textContent =
      `${stats.nodes} vertices, ${stats.links} ${stats.links === 1 ? "edge" : "edges"}, ` +
      `total degree ${stats.totalDegree}, ${stats.even} even, ${stats.odd} odd.`;
    for (const key of ["moving", "showDegrees", "allowLoops"]) {
      document.getElementById(key).checked = state[key];
    }
    document.getElementById("popBtn").disabled = state.history.length === 0;
    say(state.message, C.result(state));

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      window.Track.state({
        nodes: state.nodes.map((n) => ({ ...n })),
        edges: state.edges.map((e) => ({ ...e })),
        history: state.history.slice(),
        showDegrees: state.showDegrees,
        allowLoops: state.allowLoops,
        moving: state.moving,
        stats,
      });
    }
  }

  svg.addEventListener("pointerdown", (event) => {
    const at = toViewBox(event);
    const hit = nearest(at);
    if (state.moving) {
      if (hit) dragFrom = hit.id;
      return;
    }
    if (!hit) {
      state = C.addNode(state, at.x, at.y);
      render();
    }
  });
  svg.addEventListener("pointerup", (event) => {
    if (dragFrom === null) return;
    const at = toViewBox(event);
    const hit = nearest(at);
    const from = dragFrom;
    dragFrom = null;
    if (state.moving) {
      if (hit && hit.id === from) state = C.moveNode(state, from, at.x, at.y);
    } else if (hit) {
      state = C.addEdge(state, from, hit.id);
    }
    render();
  });
  svg.addEventListener("pointerleave", () => { dragFrom = null; });

  for (const key of ["moving", "showDegrees", "allowLoops"]) {
    document.getElementById(key).addEventListener("change", () => {
      state = C.toggle(state, key);
      render();
    });
  }
  document.getElementById("popBtn").addEventListener("click", () => {
    state = C.pop(state);
    render();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = C.reset(state);
    render();
  });

  render();
})();
