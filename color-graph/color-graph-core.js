"use strict";

/*
 * Color Graph — Alexander Bogomolny's applet ColorGraph (cut-the-knot.org).
 *
 * The applet is a graph-colouring workbench. It opens with six sample graphs,
 * shows a palette of ten colours, and lets a player colour the nodes (pick a
 * colour and click a node; click the same node again to cycle to the next
 * colour). A second tab lets the player define graphs: add or delete nodes and
 * edges, and drag nodes around. It reports "Total colors used:" — the number
 * of distinct colours on the nodes. There is no opponent and no win or loss:
 * the page's stated goal is to find a *proper* colouring (neighbours differ)
 * that uses as few colours as possible.
 *
 * The one idea the code relies on is the definition on the applet's page: a
 * k-colouring is an assignment of k colours to the vertices; it is proper when
 * adjacent vertices get different colours; the chromatic number is the least
 * k for which a proper colouring exists. The core keeps the applet's own moves
 * (CycleColor adds one modulo ten, names for new nodes start at "1", an edge
 * exists in either orientation) and adds an exact chromatic-number search so
 * the "fewest colours" claim can be checked, not just asserted.
 *
 * This file is the game's logic and nothing else: no document, no window, no
 * storage. It defines one global, ColorGraphCore, so the page loads it with a
 * plain <script> and porting/check-color-graph.mjs loads it in Node. The
 * position is plain data (numbers, strings, arrays, plain objects), so it can
 * be saved and handed to the tutor as it is. Functions take a position and
 * return a new one; they do not change what they are given.
 */
const ColorGraphCore = (() => {
  // The applet's palette has ten entries (ColorGraphCommon.Colors).
  const NUM_COLORS = 10;

  /*
   * The six graphs the applet reads from the page's <param> tags, transcribed
   * exactly: node labels and relative (x, y) are unchanged, and an edge spec
   * like "A,B,H,I" means the three edges A-B, A-H and A-I (CGParser.ParseEdge
   * takes the first name and joins it to every following name).
   */
  const RAW_GRAPHS = [
    {
      name: "Graph 1",
      nodes: [
        ["A", 0.5, 0.1], ["B", 0.25, 0.3], ["H", 0.5, 0.3], ["I", 0.75, 0.3],
        ["G", 0.15, 0.5], ["D", 0.25, 0.5], ["C", 0.35, 0.5], ["K", 0.65, 0.5],
        ["J", 0.85, 0.5], ["F", 0.18, 0.7], ["E", 0.32, 0.7], ["L", 0.85, 0.7],
      ],
      edges: ["A,B,H,I", "B,G,D,C", "I,J,K", "D,F,E", "J,L"],
    },
    {
      name: "Graph 2",
      nodes: [
        ["A", 0.35, 0.2], ["B", 0.65, 0.2], ["F", 0.2, 0.5], ["G", 0.5, 0.5],
        ["C", 0.8, 0.5], ["E", 0.35, 0.8], ["D", 0.65, 0.8],
      ],
      edges: ["A,B,F,G", "B,C,G", "C,D,G", "D,E,G", "E,F,G", "F,G"],
    },
    {
      name: "Graph 3",
      nodes: [
        ["A", 0.2, 0.2], ["B", 0.5, 0.2], ["C", 0.8, 0.2], ["E", 0.2, 0.8],
        ["D", 0.8, 0.8], ["F", 0.4, 0.5], ["G", 0.6, 0.5],
      ],
      edges: ["A,B,E,F", "B,C,F,G", "C,D,G", "D,E,G", "E,F", "F,G"],
    },
    {
      name: "Graph 4",
      nodes: [
        ["A", 0.25, 0.1], ["B", 0.7, 0.1], ["G", 0.1, 0.25], ["H", 0.35, 0.25],
        ["I", 0.6, 0.25], ["C", 0.85, 0.4], ["F", 0.1, 0.55], ["K", 0.35, 0.55],
        ["J", 0.6, 0.55], ["E", 0.25, 0.7], ["D", 0.7, 0.7],
      ],
      edges: ["A,B,G,H", "B,C,I", "C,D", "D,E,J", "E,K,F", "F,G", "H,I,K,J", "I,K,J", "J,K"],
    },
    {
      name: "Graph 5",
      nodes: [
        ["A", 0.5, 0.1], ["B", 0.8, 0.4], ["C", 0.7, 0.9], ["D", 0.3, 0.9],
        ["E", 0.2, 0.4], ["F", 0.35, 0.47], ["G", 0.6, 0.75], ["H", 0.5, 0.32],
        ["I", 0.4, 0.75], ["J", 0.65, 0.47],
      ],
      edges: ["A,B,E,H", "B,C,J", "C,D,G", "D,E,I", "E,F", "F,G,J", "G,H", "H,I", "I,J"],
    },
    {
      name: "Graph 6",
      nodes: [
        ["A", 0.5, 0.1], ["B", 0.8, 0.4], ["C", 0.7, 0.9], ["D", 0.3, 0.9],
        ["E", 0.2, 0.4], ["H", 0.4, 0.51], ["F", 0.56, 0.65], ["I", 0.5, 0.4],
        ["G", 0.44, 0.65], ["J", 0.6, 0.51], ["K", 0.5, 0.53],
      ],
      edges: ["A,B,E,H,J", "B,C,I,F", "C,D,J,G", "D,E,F,H", "E,I,G", "F,K", "G,K", "I,K", "J,K", "H,K"],
    },
  ];

  /** GraphToColor.EdgeExists: the edge is undirected, so either order matches. */
  function edgeExists(graph, a, b) {
    if (!graph || !graph.edges) return false;
    for (const e of graph.edges) {
      if ((e[0] === a && e[1] === b) || (e[0] === b && e[1] === a)) return true;
    }
    return false;
  }

  /** Build a graph from the page's parameter format. */
  function makeGraph(raw) {
    const graph = {
      name: raw.name,
      nodes: raw.nodes.map(([label, x, y]) => ({ label, x, y })),
      edges: [],
    };
    for (const spec of raw.edges) {
      const names = spec.split(",").map((s) => s.trim());
      for (let i = 1; i < names.length; i++) {
        if (!edgeExists(graph, names[0], names[i])) graph.edges.push([names[0], names[i]]);
      }
    }
    return graph;
  }

  const SAMPLE_GRAPHS = RAW_GRAPHS.map(makeGraph);

  /** A fresh, independent copy — nothing is shared with the stored samples. */
  function cloneGraph(graph) {
    return {
      name: graph.name,
      nodes: graph.nodes.map((n) => ({ label: n.label, x: n.x, y: n.y })),
      edges: graph.edges.map((e) => [e[0], e[1]]),
    };
  }

  /** An empty graph; the applet's "New graph" names them "#1", "#2", ... . */
  function blankGraph(number) {
    return { name: "#" + number, nodes: [], edges: [] };
  }

  function indexOfNode(graph, label) {
    for (let i = 0; i < graph.nodes.length; i++) {
      if (graph.nodes[i].label === label) return i;
    }
    return -1;
  }

  /** label -> labels it shares an edge with (both directions). */
  function adjacency(graph) {
    const adj = new Map();
    for (const n of graph.nodes) adj.set(n.label, []);
    for (const [a, b] of graph.edges) {
      if (!adj.has(a) || !adj.has(b) || a === b) continue;
      adj.get(a).push(b);
      adj.get(b).push(a);
    }
    return adj;
  }

  /** ColorGraphNode.CycleColor: (ColorIndex + 1) % Colors.length. */
  function cycleColor(index) {
    return (index + 1) % NUM_COLORS;
  }

  /** The "Total colors used:" count: distinct colour indices, ignoring -1. */
  function colorsUsed(state) {
    const used = new Set();
    for (const n of state.graph.nodes) {
      const c = state.colors[n.label];
      if (Number.isInteger(c) && c >= 0 && c < NUM_COLORS) used.add(c);
    }
    return used.size;
  }

  /** Edges whose two ends currently share a colour (including a coloured loop). */
  function conflicts(state) {
    const out = [];
    for (const [a, b] of state.graph.edges) {
      const ca = state.colors[a];
      const cb = state.colors[b];
      if (ca !== undefined && cb !== undefined && ca === cb) out.push([a, b]);
    }
    return out;
  }

  /** Proper means no two neighbours have the same colour. */
  function isProper(state) {
    return conflicts(state).length === 0;
  }

  function allColored(state) {
    return state.graph.nodes.length > 0 && state.graph.nodes.every(
      (n) => Number.isInteger(state.colors[n.label]) && state.colors[n.label] >= 0
    );
  }

  /*
   * The page's definition, used as an honest cross-check of chromaticNumber:
   * is there a proper colouring using at most k colours? Backtrack in the
   * graph's own node order and try colours 0 .. k-1.
   */
  function colorable(graph, k) {
    const labels = graph.nodes.map((n) => n.label);
    if (!Number.isInteger(k) || k < 0) return false;
    if (labels.length === 0) return true;
    const adj = adjacency(graph);
    const assign = {};
    function rec(i) {
      if (i === labels.length) return true;
      const v = labels[i];
      const banned = new Set();
      for (const w of adj.get(v)) if (assign[w] !== undefined) banned.add(assign[w]);
      for (let c = 0; c < k; c++) {
        if (banned.has(c)) continue;
        assign[v] = c;
        if (rec(i + 1)) return true;
        delete assign[v];
      }
      return false;
    }
    return rec(0);
  }

  /*
   * The chromatic number: the least positive k with a proper k-colouring.
   * This search orders the vertices by falling degree (a different order from
   * colorable above, so the test can compare two independent searches).
   */
  function chromaticNumber(graph) {
    const labels = graph.nodes.map((n) => n.label);
    if (labels.length === 0) return 0;
    const adj = adjacency(graph);
    const order = labels.slice().sort((a, b) => adj.get(b).length - adj.get(a).length);
    const assign = {};
    function canColor(k) {
      function rec(i) {
        if (i === order.length) return true;
        const v = order[i];
        const banned = new Set();
        for (const w of adj.get(v)) if (assign[w] !== undefined) banned.add(assign[w]);
        for (let c = 0; c < k; c++) {
          if (banned.has(c)) continue;
          assign[v] = c;
          if (rec(i + 1)) return true;
          delete assign[v];
        }
        return false;
      }
      return rec(0);
    }
    for (let k = 1; k <= labels.length; k++) {
      if (canColor(k)) return k;
    }
    return labels.length;
  }

  /** A greedy "good" colouring in the given node order (0 = node order). */
  function greedyColor(graph, order) {
    const nodes = order
      ? order.map((label) => ({ label })).filter((n) => indexOfNode(graph, n.label) >= 0)
      : graph.nodes.slice();
    const adj = adjacency(graph);
    const colors = {};
    for (const n of nodes) {
      const banned = new Set();
      for (const w of adj.get(n.label)) if (colors[w] !== undefined) banned.add(colors[w]);
      let c = 0;
      while (banned.has(c)) c++;
      colors[n.label] = c;
    }
    return colors;
  }

  /** The position a new game starts from. */
  function start(options) {
    const o = options || {};
    let graph;
    let graphCount = SAMPLE_GRAPHS.length;
    if (o.graph) {
      graph = cloneGraph(o.graph);
    } else {
      const n = SAMPLE_GRAPHS.length;
      const idx = o.graphIndex === undefined ? 0 : o.graphIndex;
      graph = cloneGraph(SAMPLE_GRAPHS[((idx % n) + n) % n]);
    }
    return {
      graph,
      colors: {},
      saved: {}, // colours kept per graph when the player switches graphs
      selectedColor: 0, // CGGraphToColorCanvas.ColorIndex starts at 0
      lastNode: null, // CGGraphToColorCanvas.LastSelectedNode
      mode: "color", // "color" or "define"
      defineTool: "addNode",
      pendingNode: null, // first node picked while adding an edge
      nextNodeId: 1, // ColorGraphNode.I starts at 0, then increments on each add
      graphCount,
      moves: 0,
    };
  }

  /** The moves allowed from this position (a demo: always the same set). */
  function legalMoves(state) {
    return [
      "click", "color", "cycle", "setColor", "clear", "selectGraph", "newGraph",
      "setMode", "setTool", "addNode", "removeNode", "addEdge", "removeEdge", "moveNode",
    ];
  }

  function clamp01(v) {
    if (!Number.isFinite(v)) return 0.5;
    return Math.min(1, Math.max(0, v));
  }

  /** Apply a move; return null when the move is not allowed. Never mutate state. */
  function move(state, m) {
    if (!state || !m || !m.type) return null;
    const g = state.graph;
    const step = (changes) => Object.assign({}, state, changes, { moves: state.moves + 1 });

    switch (m.type) {
      case "setColor": {
        const c = m.color;
        if (!Number.isInteger(c) || c < 0 || c >= NUM_COLORS) return null;
        return step({ selectedColor: c });
      }
      case "color": {
        const c = m.color === undefined ? state.selectedColor : m.color;
        if (!Number.isInteger(c) || c < 0 || c >= NUM_COLORS) return null;
        if (indexOfNode(g, m.node) < 0) return null;
        const colors = Object.assign({}, state.colors);
        colors[m.node] = c;
        return step({ colors, lastNode: m.node });
      }
      case "cycle": {
        if (indexOfNode(g, m.node) < 0) return null;
        const current = state.colors[m.node] === undefined ? -1 : state.colors[m.node];
        const c = cycleColor(current);
        const colors = Object.assign({}, state.colors);
        colors[m.node] = c;
        return step({ colors, selectedColor: c, lastNode: m.node });
      }
      case "click": {
        // The applet's CGGraphToColorCanvas listener: clicking the same node
        // twice cycles it; the first click paints it with the picked colour.
        if (state.mode === "color") {
          if (m.node === undefined || indexOfNode(g, m.node) < 0) return null;
          if (m.node === state.lastNode) return move(state, { type: "cycle", node: m.node });
          return move(state, { type: "color", node: m.node, color: state.selectedColor });
        }
        // Define tab: the tool decides what a click does.
        if (state.defineTool === "addNode") {
          if (m.node !== undefined && indexOfNode(g, m.node) >= 0) return null;
          return move(state, { type: "addNode", x: m.x, y: m.y });
        }
        if (state.defineTool === "addEdge") {
          if (m.node === undefined || indexOfNode(g, m.node) < 0) return null;
          if (state.pendingNode === null) return step({ pendingNode: m.node });
          if (state.pendingNode === m.node) return step({ pendingNode: null });
          const next = move(state, { type: "addEdge", a: state.pendingNode, b: m.node });
          return next ? Object.assign({}, next, { pendingNode: null }) : null;
        }
        if (state.defineTool === "removeNode") {
          if (m.node === undefined || indexOfNode(g, m.node) < 0) return null;
          return move(state, { type: "removeNode", node: m.node });
        }
        if (state.defineTool === "removeEdge") {
          if (!m.a || !m.b) return null;
          return move(state, { type: "removeEdge", a: m.a, b: m.b });
        }
        return null; // dragNode: handled by pointer moves, not clicks
      }
      case "clear": {
        return step({ colors: {}, lastNode: null, saved: Object.assign({}, state.saved, { [g.name]: {} }) });
      }
      case "selectGraph": {
        const n = SAMPLE_GRAPHS.length;
        const idx = m.graphIndex;
        if (!Number.isInteger(idx) || idx < 0 || idx >= n) return null;
        const saved = Object.assign({}, state.saved, { [g.name]: state.colors });
        const nextGraph = cloneGraph(SAMPLE_GRAPHS[idx]);
        return step({
          graph: nextGraph,
          colors: saved[nextGraph.name] || {},
          saved,
          lastNode: null,
          pendingNode: null,
        });
      }
      case "newGraph": {
        const saved = Object.assign({}, state.saved, { [g.name]: state.colors });
        const nextGraph = blankGraph(state.graphCount + 1);
        return step({
          graph: nextGraph,
          colors: {},
          saved,
          graphCount: state.graphCount + 1,
          lastNode: null,
          pendingNode: null,
        });
      }
      case "setMode": {
        if (m.mode !== "color" && m.mode !== "define") return null;
        const saved = m.mode === "color" ? state.saved : Object.assign({}, state.saved, { [g.name]: state.colors });
        return step({ mode: m.mode, pendingNode: null, saved });
      }
      case "setTool": {
        const tools = ["addNode", "addEdge", "removeNode", "removeEdge", "dragNode"];
        if (tools.indexOf(m.tool) < 0) return null;
        return step({ defineTool: m.tool, pendingNode: null });
      }
      case "addNode": {
        const label = String(state.nextNodeId);
        const node = { label, x: clamp01(m.x), y: clamp01(m.y) };
        return step({
          graph: { name: g.name, nodes: g.nodes.concat([node]), edges: g.edges.slice() },
          nextNodeId: state.nextNodeId + 1,
        });
      }
      case "removeNode": {
        if (indexOfNode(g, m.node) < 0) return null;
        const colors = Object.assign({}, state.colors);
        delete colors[m.node];
        return step({
          graph: {
            name: g.name,
            nodes: g.nodes.filter((n) => n.label !== m.node),
            edges: g.edges.filter((e) => e[0] !== m.node && e[1] !== m.node),
          },
          colors,
          lastNode: state.lastNode === m.node ? null : state.lastNode,
          pendingNode: state.pendingNode === m.node ? null : state.pendingNode,
        });
      }
      case "addEdge": {
        if (m.a === m.b) return null; // two distinct nodes in sequence
        if (indexOfNode(g, m.a) < 0 || indexOfNode(g, m.b) < 0) return null;
        if (edgeExists(g, m.a, m.b)) return null;
        return step({
          graph: { name: g.name, nodes: g.nodes.slice(), edges: g.edges.concat([[m.a, m.b]]) },
        });
      }
      case "removeEdge": {
        if (!edgeExists(g, m.a, m.b)) return null;
        return step({
          graph: {
            name: g.name,
            nodes: g.nodes.slice(),
            edges: g.edges.filter((e) => !((e[0] === m.a && e[1] === m.b) || (e[0] === m.b && e[1] === m.a))),
          },
        });
      }
      case "moveNode": {
        const i = indexOfNode(g, m.node);
        if (i < 0) return null;
        const nodes = g.nodes.map((n) => n.label === m.node
          ? { label: n.label, x: clamp01(m.x), y: clamp01(m.y) }
          : { label: n.label, x: n.x, y: n.y });
        return step({ graph: { name: g.name, nodes, edges: g.edges.map((e) => [e[0], e[1]]) } });
      }
      default:
        return null;
    }
  }

  /**
   * A demo has no opponent to beat. A play is finished once every node is
   * coloured and no two neighbours share a colour — a proper colouring, which
   * is exactly the goal the applet's page describes.
   */
  function result(state) {
    return allColored(state) && isProper(state) ? "done" : null;
  }

  return {
    NUM_COLORS,
    SAMPLE_GRAPHS,
    edgeExists,
    adjacency,
    cycleColor,
    colorsUsed,
    conflicts,
    isProper,
    allColored,
    colorable,
    chromaticNumber,
    greedyColor,
    start,
    legalMoves,
    move,
    result,
  };
})();
