"use strict";

/*
 * Page layer for the Color Graph demo. All the rules and the colouring
 * arithmetic live in ColorGraphCore (color-graph-core.js); this file only
 * draws the graph and takes input.
 *
 * The play area is one canvas: edges are lines between the nodes' relative
 * positions and nodes are labelled circles. In "Colour graph" mode a click on
 * a circle paints it with the picked colour, and a second click on the same
 * circle cycles to the next colour (the applet's own rule). In "Define graph"
 * mode the tool buttons decide what a click or a drag does: add/delete a node,
 * join two nodes, delete an edge, or drag a node. A row of graph thumbnails
 * picks one of the applet's six sample graphs, and a row of ten swatches is
 * its palette.
 */

(() => {
  const Core = ColorGraphCore;
  const canvas = document.getElementById("graphCanvas");
  const ctx = canvas.getContext("2d");
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const infoEl = document.getElementById("graphInfo");
  const pickerEl = document.getElementById("graphPicker");
  const paletteEl = document.getElementById("palette");
  const toolsEl = document.getElementById("tools");
  const newBtn = document.getElementById("newBtn");
  const resetBtn = document.getElementById("resetBtn");
  const colorModeBtn = document.getElementById("colorModeBtn");
  const defineModeBtn = document.getElementById("defineModeBtn");

  // Ten distinct mid-tone swatches. These are the game's own objects, so they
  // keep their real colours in both themes; the chrome around them uses tokens.
  const PALETTE = [
    "#d75c5c", "#4c8ed7", "#54ad5c", "#d8a436", "#9a6fd2",
    "#41adad", "#dd7b40", "#7d8b99", "#c76b9c", "#8bab4a",
  ];
  const PAD = 16;
  const TOOLS = [
    ["addNode", "Add a node", "toolAddNodeBtn"],
    ["addEdge", "Add an edge", "toolAddEdgeBtn"],
    ["removeNode", "Delete a node", "toolDeleteNodeBtn"],
    ["removeEdge", "Delete an edge", "toolDeleteEdgeBtn"],
    ["dragNode", "Drag nodes", "toolDragBtn"],
  ];

  let tokens = {};
  let state = Core.start({});
  let focusIndex = 0;
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let dragging = null;
  let movedWhileDown = false;

  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name) => cs.getPropertyValue(name).trim();
    tokens = {
      stage: get("--stage"),
      ink: get("--ink"),
      text: get("--text"),
      muted: get("--muted"),
      border: get("--border"),
      accent: get("--accent"),
      good: get("--good"),
      bad: get("--bad"),
      highlight: get("--highlight"),
    };
  }
  refreshTokens();
  window.addEventListener("themechange", () => {
    refreshTokens();
    draw();
  });

  /** Shows a line under the game. "done" tells the record a play has ended. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** A plain-English sentence about the current colouring. */
  function describe(prefix) {
    const used = Core.colorsUsed(state);
    const chi = Core.chromaticNumber(state.graph);
    const bad = Core.conflicts(state).length;
    const head = prefix ? prefix + " " : "";
    if (Core.result(state) === "done") {
      return `${head}A proper colouring with ${used} colours. The fewest possible is ${chi}. Well done!`;
    }
    if (bad) {
      return `${head}${bad} ${bad === 1 ? "pair" : "pairs"} of neighbours share a colour. ` +
        `That is not a proper colouring yet — ${used} ${used === 1 ? "colour" : "colours"} used.`;
    }
    return `${head}${used} ${used === 1 ? "colour" : "colours"} used so far, with no neighbours sharing. ` +
      `The fewest possible is ${chi}.`;
  }

  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, Math.round(rect.width));
    cssH = Math.max(1, Math.round(rect.height));
    dpr = window.devicePixelRatio || 1;
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function nodeRadius() {
    return Math.max(9, Math.min(16, (cssW - 2 * PAD) / 30));
  }

  function pointOf(node) {
    return {
      x: PAD + node.x * (cssW - 2 * PAD),
      y: PAD + node.y * (cssH - 2 * PAD),
    };
  }

  function contrast(fill) {
    const hex = fill.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#141821" : "#ffffff";
  }

  function draw() {
    sizeCanvas();
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, cssW, cssH);

    const nodes = new Map(state.graph.nodes.map((n) => [n.label, n]));
    const r = nodeRadius();
    const badEdges = new Set(Core.conflicts(state).map((e) => e.slice().sort().join("|")));

    // Edges: a conflict is drawn in the "bad" colour, the rest in the ink.
    ctx.lineWidth = 2;
    for (const [a, b] of state.graph.edges) {
      const na = nodes.get(a);
      const nb = nodes.get(b);
      if (!na || !nb) continue;
      const pa = pointOf(na);
      const pb = pointOf(nb);
      ctx.strokeStyle = badEdges.has([a, b].sort().join("|")) ? tokens.bad : tokens.ink;
      ctx.globalAlpha = badEdges.size ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Nodes: uncoloured nodes use the stage background; the cursor and the
    // pending node of an edge get a ring, so keyboard play is visible too.
    state.graph.nodes.forEach((n, i) => {
      const p = pointOf(n);
      const c = state.colors[n.label];
      const fill = Number.isInteger(c) && c >= 0 && c < PALETTE.length ? PALETTE[c] : tokens.stage;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = i === focusIndex ? tokens.accent : (fill === tokens.stage ? tokens.border : tokens.ink);
      ctx.lineWidth = i === focusIndex ? 2.5 : 1.5;
      ctx.stroke();
      if (n.label === state.pendingNode) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = tokens.accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = fill === tokens.stage ? tokens.text : contrast(fill);
      ctx.font = `600 ${Math.max(11, Math.round(r * 0.95))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label, p.x, p.y + 0.5);
    });
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function buildButtons() {
    Core.SAMPLE_GRAPHS.forEach((g, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "graph" + i;
      b.className = "chip";
      b.textContent = String(i + 1);
      b.setAttribute("aria-label", "Select " + g.name);
      b.addEventListener("click", () => {
        state = Core.move(state, { type: "selectGraph", graphIndex: i });
        state = Core.move(state, { type: "setMode", mode: "color" });
        focusIndex = 0;
        say(describe(`${g.name} selected.`), Core.result(state));
        render();
      });
      pickerEl.appendChild(b);
    });

    PALETTE.forEach((color, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "color" + i;
      b.className = "swatch";
      b.style.setProperty("--swatch", color);
      b.setAttribute("aria-label", "Pick colour " + (i + 1));
      b.setAttribute("aria-pressed", i === state.selectedColor ? "true" : "false");
      b.addEventListener("click", () => {
        state = Core.move(state, { type: "setColor", color: i });
        say(describe(`Colour ${i + 1} picked.`), Core.result(state));
        render();
      });
      paletteEl.appendChild(b);
    });

    TOOLS.forEach(([tool, label, id]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = id;
      b.className = "chip";
      b.textContent = label;
      b.setAttribute("aria-label", label);
      b.addEventListener("click", () => {
        state = Core.move(state, { type: "setTool", tool });
        say(state.mode === "define" ? `Tool: ${label.toLowerCase()}.` : "Switch to Define graph to use the tools.", null);
        render();
      });
      toolsEl.appendChild(b);
    });
  }

  function render() {
    toolsEl.hidden = state.mode !== "define";
    colorModeBtn.setAttribute("aria-pressed", state.mode === "color" ? "true" : "false");
    defineModeBtn.setAttribute("aria-pressed", state.mode === "define" ? "true" : "false");
    for (let i = 0; i < PALETTE.length; i++) {
      paletteEl.children[i].classList.toggle("selected", i === state.selectedColor);
      paletteEl.children[i].setAttribute("aria-pressed", i === state.selectedColor ? "true" : "false");
    }
    for (let i = 0; i < Core.SAMPLE_GRAPHS.length; i++) {
      const active = state.graph.name === Core.SAMPLE_GRAPHS[i].name;
      pickerEl.children[i].classList.toggle("selected", active);
      pickerEl.children[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
    TOOLS.forEach(([tool, , id], i) => {
      const b = document.getElementById(id);
      const active = state.defineTool === tool;
      b.classList.toggle("selected", active);
      b.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const used = Core.colorsUsed(state);
    infoEl.textContent = state.graph.nodes.length === 0
      ? `${state.graph.name} · a blank graph — add nodes and edges in the Define tab`
      : `${state.graph.name} · ${state.graph.nodes.length} nodes · ` +
        `${used} ${used === 1 ? "colour" : "colours"} used · fewest possible ${Core.chromaticNumber(state.graph)}`;
    draw();
    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        graph: state.graph.name,
        nodes: state.graph.nodes.length,
        edges: state.graph.edges.length,
        colors: state.colors,
        colorsUsed: Core.colorsUsed(state),
        chromaticNumber: Core.chromaticNumber(state.graph),
        proper: Core.isProper(state),
        mode: state.mode,
        moves: state.moves,
      });
    }
  }

  function apply(next, prefix) {
    if (!next) return false;
    state = next;
    say(describe(prefix), Core.result(state));
    render();
    return true;
  }

  function nearestNode(x, y) {
    const r = nodeRadius() + 5;
    let best = null;
    let bestD = r * r;
    for (let i = 0; i < state.graph.nodes.length; i++) {
      const p = pointOf(state.graph.nodes[i]);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = { label: state.graph.nodes[i].label, index: i };
      }
    }
    return best;
  }

  function nearestEdge(x, y) {
    let best = null;
    let bestD = 12 * 12;
    for (const [a, b] of state.graph.edges) {
      const na = state.graph.nodes.find((n) => n.label === a);
      const nb = state.graph.nodes.find((n) => n.label === b);
      if (!na || !nb) continue;
      const pa = pointOf(na);
      const pb = pointOf(nb);
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - pa.x) * dx + (y - pa.y) * dy) / len2));
      const d = (x - (pa.x + t * dx)) ** 2 + (y - (pa.y + t * dy)) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = [a, b];
      }
    }
    return best;
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    return {
      x: ((e.clientX - rect.left) * scale) / dpr,
      y: ((e.clientY - rect.top) * scale) / dpr,
    };
  }

  function clickAt(x, y) {
    const hit = nearestNode(x, y);
    if (state.mode === "color") {
      if (!hit) return;
      focusIndex = hit.index;
      apply(Core.move(state, { type: "click", node: hit.label }), "");
      return;
    }
    if (state.defineTool === "addNode") {
      if (hit) return;
      apply(Core.move(state, {
        type: "click",
        x: (x - PAD) / (cssW - 2 * PAD),
        y: (y - PAD) / (cssH - 2 * PAD),
      }), "A node was added.");
      return;
    }
    if (state.defineTool === "removeEdge") {
      const edge = nearestEdge(x, y);
      if (!edge) return;
      apply(Core.move(state, { type: "removeEdge", a: edge[0], b: edge[1] }), "An edge was removed.");
      return;
    }
    if (!hit) return;
    focusIndex = hit.index;
    if (state.defineTool === "addEdge") {
      apply(Core.move(state, { type: "click", node: hit.label }),
        state.pendingNode === null ? "First node picked — pick the second." : "An edge was added.");
    } else if (state.defineTool === "removeNode") {
      apply(Core.move(state, { type: "click", node: hit.label }), "A node was removed.");
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.focus();
    if (state.mode !== "define" || state.defineTool !== "dragNode") return;
    const p = canvasPoint(e);
    const hit = nearestNode(p.x, p.y);
    if (!hit) return;
    dragging = hit.label;
    movedWhileDown = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const p = canvasPoint(e);
    movedWhileDown = true;
    const next = Core.move(state, {
      type: "moveNode",
      node: dragging,
      x: (p.x - PAD) / (cssW - 2 * PAD),
      y: (p.y - PAD) / (cssH - 2 * PAD),
    });
    if (next) {
      state = next;
      draw();
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (dragging) {
      dragging = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      say(describe("A node was dragged."), null);
      render();
      return;
    }
    if (movedWhileDown) {
      movedWhileDown = false;
      return;
    }
    const p = canvasPoint(e);
    clickAt(p.x, p.y);
  });
  canvas.addEventListener("pointercancel", () => { dragging = null; });

  canvas.addEventListener("keydown", (e) => {
    const before = focusIndex;
    const n = state.graph.nodes.length;
    let handled = true;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") focusIndex = n ? (focusIndex + 1) % n : 0;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") focusIndex = n ? (focusIndex - 1 + n) % n : 0;
    else if (e.key === "Home") focusIndex = 0;
    else if (e.key === "End") focusIndex = Math.max(0, n - 1);
    else if (e.key === "Enter" || e.key === " ") {
      if (n) {
        const label = state.graph.nodes[before].label;
        apply(Core.move(state, { type: "click", node: label }), "");
      }
    } else if (e.key === "Escape") {
      apply(Core.move(state, { type: "clear" }), "All colours cleared.");
    } else if (/^[0-9]$/.test(e.key)) {
      const color = e.key === "0" ? 9 : Number(e.key) - 1;
      apply(Core.move(state, { type: "setColor", color }), `Colour ${color + 1} picked.`);
    } else if ((e.key === "Delete" || e.key === "Backspace") && state.mode === "define" && n) {
      apply(Core.move(state, { type: "removeNode", node: state.graph.nodes[before].label }), "A node was removed.");
    } else {
      handled = false;
    }
    if (handled) {
      e.preventDefault();
      draw();
    }
  });

  newBtn.addEventListener("click", () => {
    state = Core.move(Core.move(state, { type: "newGraph" }), { type: "setMode", mode: "define" });
    focusIndex = 0;
    say("A blank graph. Add nodes, then join two nodes to make an edge.", Core.result(state));
    render();
  });
  resetBtn.addEventListener("click", () => {
    apply(Core.move(state, { type: "clear" }), "All colours cleared.");
  });
  colorModeBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "setMode", mode: "color" });
    say("Colour graph: pick a colour, then click a node. Click it again to cycle.", null);
    render();
  });
  defineModeBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "setMode", mode: "define" });
    say("Define graph: choose a tool, then click or drag on the picture.", null);
    render();
  });
  window.addEventListener("resize", draw);

  buildButtons();
  say("Graph 1 selected. Pick a colour and click a node; make every neighbour different.", null);
  render();
  stageEl.setAttribute("aria-label", "Graph drawing area");
})();
