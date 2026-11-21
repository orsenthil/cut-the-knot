#!/usr/bin/env node
"use strict";

/*
 * Logic test for color-graph/color-graph-core.js.
 *
 *   node porting/check-color-graph.mjs
 *
 * Sections:
 *  1. the rules: the start position, the palette of ten, the six sample
 *     graphs, every move kind and the refusal of illegal moves;
 *  2. the applet's own methods transcribed a second time from the bytecode
 *     (CycleColor, EdgeExists/AddEdge, RemoveNode, the "Total colors used:"
 *     count and the way a repeated click cycles a node) compared over every
 *     colour index and every graph in the range;
 *  3. every claim the cut-the-knot page makes: a proper k-colouring, k-colourability,
 *     and that the chromatic number is the least k with a proper k-colouring.
 *     Two independent searches are compared over all 64 graphs on four
 *     vertices, over deterministic random graphs and over the six samples;
 *  4. the edge cases of the rules and the end of a play: conflicts, a full
 *     proper colouring ("done"), switching graphs, and editing a graph.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("color-graph/color-graph-core.js", "ColorGraphCore");

/* ------------------- a second, literal transcription of the applet's methods */

// ColorGraphNode.CycleColor(): ColorIndex = (ColorIndex + 1) % Colors.length
function refCycle(index, paletteSize) {
  return (index + 1) % paletteSize;
}

// GraphToColor.EdgeExists(): undirected, either orientation matches
function refEdgeExists(edges, a, b) {
  return edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
}

// GraphToColor.AddEdge(n1, n2): both nodes present, no duplicate. The Define
// tab's "click two nodes in sequence" never feeds a node to itself (a second
// click on the same node cancels the selection), so a loop is refused too.
function refAddEdge(nodes, edges, a, b) {
  if (a === b || !nodes.includes(a) || !nodes.includes(b)) return false;
  if (refEdgeExists(edges, a, b)) return false;
  edges.push([a, b]);
  return true;
}

// CGGraphToColorCanvas.paint(): int[Colors.length + 1], count indices 1..9
function refColorsUsed(nodes, colors, paletteSize) {
  const tally = new Array(paletteSize + 1).fill(0);
  for (const label of nodes) {
    const c = colors[label] === undefined ? -1 : colors[label];
    tally[c + 1]++;
  }
  let used = 0;
  for (let i = 1; i < tally.length; i++) if (tally[i] !== 0) used++;
  return used;
}

// The page's definition of "proper", written independently of the core.
function refProper(graph, colors) {
  for (const [a, b] of graph.edges) {
    if (colors[a] !== undefined && colors[b] !== undefined && colors[a] === colors[b]) return false;
  }
  return true;
}

/*
 * An independent chromatic-number search: restricted-growth strings. When
 * vertex i is coloured it may use one of the existing colour classes 0..c-1
 * or open the next class c; c never exceeds k. This is a different traversal
 * from the core's falling-degree backtracking.
 */
function refCanColor(graph, k) {
  if (!Number.isInteger(k) || k < 0) return false;
  const labels = graph.nodes.map((n) => n.label);
  if (labels.length === 0) return true;
  const adj = C.adjacency(graph);
  const assign = {};
  function rec(i, classes) {
    if (i === labels.length) return true;
    const v = labels[i];
    const lim = Math.min(classes, k);
    for (let c = 0; c < lim; c++) {
      if (adj.get(v).some((w) => assign[w] === c)) continue;
      assign[v] = c;
      if (rec(i + 1, classes)) return true;
      delete assign[v];
    }
    if (classes < k) {
      assign[v] = classes;
      if (rec(i + 1, classes + 1)) return true;
      delete assign[v];
    }
    return false;
  }
  return rec(0, 0);
}

function refChromatic(graph) {
  for (let k = 1; k <= graph.nodes.length; k++) if (refCanColor(graph, k)) return k;
  return 0;
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("a new game uses the first sample graph", s.graph.name, "Graph 1");
  equal("a new game has no colours on the nodes", s.colors, {});
  equal("a new game picks the first palette colour", s.selectedColor, 0);
  equal("a new game is not over", C.result(s), null);
  equal("a new game uses no colours", C.colorsUsed(s), 0);
  check("every move is legal", C.legalMoves(s).length >= 10);
  check("unknown moves are refused", C.move(s, { type: "nonsense" }) === null);
  check("moves without a type are refused", C.move(s, {}) === null);
  check("the position is plain JSON", JSON.parse(JSON.stringify(s)).graph.name === "Graph 1");

  equal("the palette has ten colours (the page says ten)", C.NUM_COLORS, 10);
  equal("there are six sample graphs (the page says six)", C.SAMPLE_GRAPHS.length, 6);
  equal("sample graph names", C.SAMPLE_GRAPHS.map((g) => g.name),
    ["Graph 1", "Graph 2", "Graph 3", "Graph 4", "Graph 5", "Graph 6"]);
  equal("sample graph sizes", C.SAMPLE_GRAPHS.map((g) => g.nodes.length), [12, 7, 7, 11, 10, 11]);
  equal("sample graph edge counts", C.SAMPLE_GRAPHS.map((g) => g.edges.length), [11, 12, 12, 17, 15, 20]);
  equal("Graph 1 is a tree (12 nodes, 11 edges)", C.SAMPLE_GRAPHS[0].edges.length, C.SAMPLE_GRAPHS[0].nodes.length - 1);

  // Starting again must not share colour maps or graph arrays with the samples.
  const a = C.start({});
  const b = C.start({});
  a.graph.nodes[0].x = 0.99;
  a.graph.edges.pop();
  check("a new game does not share data with the samples", b.graph.nodes[0].x === 0.5 && b.graph.edges.length === 11);
}

/* ----------------------- 2. the applet's methods, over their whole ranges */

{
  for (let i = -1; i <= 30; i++) {
    equal(`CycleColor matches the applet at ${i}`, C.cycleColor(i), refCycle(i, 10));
  }
  equal("an uncoloured node cycles to colour 0", C.cycleColor(-1), 0);
  equal("colour 9 cycles back to 0", C.cycleColor(9), 0);

  for (const g of C.SAMPLE_GRAPHS) {
    const labels = g.nodes.map((n) => n.label);
    // Every pair of nodes: the core's edge test equals the applet's EdgeExists.
    for (const a of labels) {
      for (const b of labels) {
        check(`EdgeExists agrees on ${g.name} ${a}-${b}`, C.edgeExists(g, a, b) === refEdgeExists(g.edges, a, b));
      }
    }
    // Adding an existing edge or a self-loop is refused, as in the applet.
    for (const [a, b] of g.edges) {
      check(`an existing edge is not added twice on ${g.name}`, C.move(C.start({ graph: g }), { type: "addEdge", a, b }) === null);
    }
    check(`a self-loop is refused on ${g.name}`, C.move(C.start({ graph: g }), { type: "addEdge", a: labels[0], b: labels[0] }) === null);

    // The "Total colors used:" count over several colourings of each graph.
    for (const pattern of [0, 1, 2, 3, 7]) {
      const colors = {};
      labels.forEach((label, i) => { colors[label] = (i * pattern) % 10; });
      const state = Object.assign(C.start({ graph: g }), { colors });
      equal(`colours used on ${g.name} pattern ${pattern}`, C.colorsUsed(state), refColorsUsed(labels, colors, 10));
    }
    const empty = C.start({ graph: g });
    equal(`uncoloured ${g.name} uses no colours`, C.colorsUsed(empty), 0);
  }

  // AddEdge against the literal transcription over every pair, every graph.
  for (const g of C.SAMPLE_GRAPHS) {
    const labels = g.nodes.map((n) => n.label);
    let s = C.start({ graph: g, });
    const edges = g.edges.map((e) => [e[0], e[1]]);
    for (const a of labels) {
      for (const b of labels) {
        const want = refAddEdge(labels, edges, a, b);
        const next = C.move(s, { type: "addEdge", a, b });
        check(`AddEdge agrees on ${g.name} ${a}-${b}`, !!next === want);
        if (next) s = next;
      }
    }
    equal(`all ${g.name} edges agree after adding`, s.graph.edges, edges);
  }
}

/* ----------------------------- 3. every claim the page makes */

{
  // "A k-coloring is proper if adjacent vertices are labelled differently."
  const g = C.SAMPLE_GRAPHS[1]; // Graph 2: a 6-cycle with a hub
  const good = { A: 0, B: 1, C: 0, D: 1, E: 0, F: 1, G: 2 };
  check("the page's proper colouring of the wheel is accepted", refProper(g, good) && C.isProper(Object.assign(C.start({ graph: g }), { colors: good })));
  const bad = Object.assign({}, good, { B: 0 }); // A and B are neighbours
  check("neighbours with the same colour are not proper", !refProper(g, bad) && !C.isProper(Object.assign(C.start({ graph: g }), { colors: bad })));
  check("the conflicting edge A-B is named", C.conflicts(Object.assign(C.start({ graph: g }), { colors: bad }))
    .some((e) => e[0] === "A" && e[1] === "B"));
  equal("a proper colouring has no conflicts", C.conflicts(Object.assign(C.start({ graph: g }), { colors: good })), []);
}

{
  // "A graph is k-colorable if it has a proper k-coloring" and
  // "the chromatic number is the least positive integer k such that G is k-colorable."
  const pinned = [2, 3, 4, 4, 3, 4];
  for (let i = 0; i < C.SAMPLE_GRAPHS.length; i++) {
    const g = C.SAMPLE_GRAPHS[i];
    const chi = C.chromaticNumber(g);
    equal(`chromatic number of ${g.name} is ${pinned[i]}`, chi, pinned[i]);
    equal(`chromatic number of ${g.name} matches the independent search`, chi, refChromatic(g));
    check(`${g.name} is ${chi}-colourable`, C.colorable(g, chi) && refCanColor(g, chi));
    check(`${g.name} is not ${chi - 1}-colourable`, !C.colorable(g, chi - 1) && !refCanColor(g, chi - 1));
    check(`${g.name} is k-colourable for every k >= its chromatic number`, Array.from(
      { length: g.nodes.length - chi + 1 }, (_, j) => chi + j
    ).every((k) => C.colorable(g, k) === refCanColor(g, k)));
  }

  // Complete graphs, cycles and bipartite graphs: the definitions hold everywhere.
  const complete = (n) => ({
    name: "K" + n,
    nodes: Array.from({ length: n }, (_, i) => ({ label: String(i), x: i / n, y: 0.5 })),
    edges: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => [String(i), String(j)]))
      .reduce((acc, row) => acc.concat(row), []).filter((e) => e[0] < e[1]),
  });
  const cycle = (n) => ({
    name: "C" + n,
    nodes: Array.from({ length: n }, (_, i) => ({ label: String(i), x: i / n, y: 0.5 })),
    edges: Array.from({ length: n }, (_, i) => [String(i), String((i + 1) % n)]),
  });
  for (let n = 1; n <= 5; n++) {
    const g = complete(n);
    check(`K${n} has ${(n * (n - 1)) / 2} edges`, g.edges.length === (n * (n - 1)) / 2);
    equal(`chromatic number of K${n}`, C.chromaticNumber(g), refChromatic(g));
    equal(`K${n} needs n colours`, C.chromaticNumber(g), n);
  }
  for (let n = 3; n <= 6; n++) {
    equal(`chromatic number of C${n}`, C.chromaticNumber(cycle(n)), refChromatic(cycle(n)));
    equal(`C${n} needs ${n % 2 === 0 ? 2 : 3} colours`, C.chromaticNumber(cycle(n)), n % 2 === 0 ? 2 : 3);
  }
  equal("an empty graph needs no colours", C.chromaticNumber({ name: "empty", nodes: [], edges: [] }), 0);
  equal("a single node needs one colour", C.chromaticNumber({ name: "one", nodes: [{ label: "A", x: 0, y: 0 }], edges: [] }), 1);
}

{
  // All 64 labelled graphs on four vertices, and 120 deterministic random
  // graphs: the core's search agrees with the independent search, and a
  // greedy colouring is always proper (it may use more than the minimum).
  const labels = ["A", "B", "C", "D"];
  const pairs = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) pairs.push([labels[i], labels[j]]);
  let n4 = 0;
  for (let mask = 0; mask < 64; mask++) {
    const g = {
      name: "g" + mask,
      nodes: labels.map((label, i) => ({ label, x: i / 4, y: 0.5 })),
      edges: pairs.filter((_, k) => (mask >> k) & 1),
    };
    equal(`all four-vertex graphs agree at mask ${mask}`, C.chromaticNumber(g), refChromatic(g));
    for (let k = 0; k <= 4; k++) {
      check(`k-colourability agrees at mask ${mask} k=${k}`, C.colorable(g, k) === refCanColor(g, k));
    }
    const greedy = C.greedyColor(g);
    check(`greedy colouring is proper at mask ${mask}`, refProper(g, greedy));
    n4++;
  }
  equal("all graphs on four vertices were tried", n4, 64);

  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
  for (let t = 0; t < 120; t++) {
    const n = 1 + Math.floor(rnd() * 7);
    const g = {
      name: "r" + t,
      nodes: Array.from({ length: n }, (_, i) => ({ label: String(i), x: rnd(), y: rnd() })),
      edges: [],
    };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (rnd() < 0.4) g.edges.push([String(i), String(j)]);
      }
    }
    equal(`random graph ${t} chromatic number`, C.chromaticNumber(g), refChromatic(g));
    check(`random graph ${t} colourability agrees`, Array.from(
      { length: n }, (_, k) => k + 1
    ).every((k) => C.colorable(g, k) === refCanColor(g, k)));
  }
}

/* -------------------------- 4. moves, edge cases and the end of a play */

{
  let s = C.start({ graphIndex: 1 }); // Graph 2, a wheel with chromatic number 3
  const before = JSON.stringify(s);
  check("moves do not mutate the position", C.move(s, { type: "color", node: "A", color: 0 }) !== null && JSON.stringify(s) === before);

  s = C.move(s, { type: "setColor", color: 2 });
  equal("picking a colour changes the picked colour", s.selectedColor, 2);
  check("an out-of-range colour is refused", C.move(s, { type: "setColor", color: 10 }) === null);
  check("a negative colour is refused", C.move(s, { type: "setColor", color: -1 }) === null);

  s = C.move(s, { type: "color", node: "A", color: 0 });
  equal("colouring a node records its colour", s.colors.A, 0);
  equal("one node coloured uses one colour", C.colorsUsed(s), 1);
  equal("a partial colouring is not a finished play", C.result(s), null);

  s = C.move(s, { type: "click", node: "B" });
  equal("the first click paints with the picked colour", s.colors.B, 2);
  s = C.move(s, { type: "click", node: "B" });
  equal("a repeated click cycles the colour", s.colors.B, refCycle(2, 10));
  equal("cycling also updates the picked colour", s.selectedColor, refCycle(2, 10));
  equal("cycling from colour 9 wraps to 0", C.move(C.start({}), { type: "cycle", node: "A" }).colors.A, 0);
  check("colouring a node that is not in the graph is refused", C.move(s, { type: "color", node: "ZZ", color: 1 }) === null);
  check("clicking empty space in colour mode does nothing", C.move(s, { type: "click", node: null }) === null);

  // Two neighbours sharing a colour is a dead end, not a win.
  let bad = C.move(C.start({}), { type: "color", node: "A", color: 0 });
  bad = C.move(bad, { type: "color", node: "B", color: 0 });
  equal("Graph 1's A-B edge is a conflict when both are colour 0", C.conflicts(bad), [["A", "B"]]);
  check("an improper colouring is not proper", !C.isProper(bad));
  equal("an improper colouring is not a finished play", C.result(bad), null);

  // A full, proper colouring finishes the play. Graph 2 is a wheel: the six
  // outer nodes alternate between two colours, the hub takes a third.
  let win = C.start({ graphIndex: 1 });
  const proper = { A: 0, B: 1, C: 0, D: 1, E: 0, F: 1, G: 2 };
  for (const [label, color] of Object.entries(proper)) win = C.move(win, { type: "color", node: label, color });
  check("the seven nodes are all coloured", C.allColored(win));
  check("the colouring is proper", C.isProper(win));
  equal("the play is finished", C.result(win), "done");
  equal("three colours were used, matching the chromatic number", C.colorsUsed(win), C.chromaticNumber(win.graph));
  win = C.move(win, { type: "clear" });
  equal("clearing removes all colours", C.colorsUsed(win), 0);
  equal("clearing reopens the play", C.result(win), null);
}

{
  // Graphs can be switched (colours are kept per graph, as in the applet),
  // and built in the Define tab: add/delete nodes and edges, drag a node.
  let s = C.start({});
  s = C.move(s, { type: "color", node: "A", color: 4 });
  s = C.move(s, { type: "selectGraph", graphIndex: 2 });
  equal("switching graph selects the sample", s.graph.name, "Graph 3");
  equal("a new graph starts uncoloured", C.colorsUsed(s), 0);
  s = C.move(s, { type: "color", node: "A", color: 1 });
  s = C.move(s, { type: "selectGraph", graphIndex: 0 });
  equal("colours are remembered for Graph 1", s.colors.A, 4);
  s = C.move(s, { type: "selectGraph", graphIndex: 2 });
  equal("colours are remembered for Graph 3", s.colors.A, 1);

  s = C.move(s, { type: "newGraph" });
  equal("New graph is named like the applet's", s.graph.name, "#7");
  equal("a new graph has no nodes", s.graph.nodes.length, 0);
  s = C.move(s, { type: "setMode", mode: "define" });
  equal("define mode is selected", s.mode, "define");
  s = C.move(s, { type: "setTool", tool: "addNode" });
  s = C.move(s, { type: "click", x: 0.2, y: 0.3 });
  equal("a click on empty space adds the first node", s.graph.nodes.map((n) => n.label), ["1"]);
  equal("its relative position is recorded", [s.graph.nodes[0].x, s.graph.nodes[0].y], [0.2, 0.3]);
  s = C.move(s, { type: "click", x: 0.8, y: 0.3 });
  equal("the next node gets the next name", s.graph.nodes.map((n) => n.label), ["1", "2"]);
  s = C.move(s, { type: "setTool", tool: "addEdge" });
  s = C.move(s, { type: "click", node: "1" });
  equal("the first node of an edge is pending", s.pendingNode, "1");
  s = C.move(s, { type: "click", node: "1" });
  equal("clicking the same node cancels the edge", s.pendingNode, null);
  s = C.move(s, { type: "click", node: "1" });
  s = C.move(s, { type: "click", node: "2" });
  equal("two nodes in sequence add an edge", s.graph.edges, [["1", "2"]]);
  equal("the pending node is cleared", s.pendingNode, null);
  check("a duplicate edge is refused", C.move(s, { type: "addEdge", a: "1", b: "2" }) === null);
  s = C.move(s, { type: "setTool", tool: "dragNode" });
  s = C.move(s, { type: "moveNode", node: "2", x: 0.7, y: 0.6 });
  equal("a node can be dragged", [s.graph.nodes[1].x, s.graph.nodes[1].y], [0.7, 0.6]);
  s = C.move(s, { type: "color", node: "1", color: 0 });
  s = C.move(s, { type: "setTool", tool: "removeNode" });
  s = C.move(s, { type: "removeNode", node: "1" });
  equal("deleting a node removes it and its edges", [s.graph.nodes.map((n) => n.label), s.graph.edges], [["2"], []]);
  equal("deleting a node removes its colour", s.colors, {});
  equal("the chromatic number of a single node is one", C.chromaticNumber(s.graph), 1);
  s = C.move(s, { type: "setMode", mode: "color" });
  equal("returning to the colour tab clears the tool selection", s.pendingNode, null);
  check("a click on empty space in colour mode adds no node", C.move(s, { type: "click", x: 0.1, y: 0.1 }) === null);
}

done("color-graph");
