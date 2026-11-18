#!/usr/bin/env node
"use strict";

/*
 * Logic test for affirmative-action/affirmative-action-core.js.
 *
 *   1. The board: the 20-node grid, colours, clicks, neighbour counts and edge
 *      editing (including the no-loops rule).
 *   2. The page's claims, exhaustively on every simple graph with at most five
 *      nodes and every colouring: an integrated colouring always exists, and
 *      every colouring with the most balanced edges is integrated. Also check
 *      the local step that makes Propp's proof work.
 *   3. The applet's "balanced edges" count transcribed a second time and
 *      compared on random boards, plus hill-climbing on the 20-node grid.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("affirmative-action/affirmative-action-core.js", "AffirmativeActionCore");

/* ------------------------------------------------------------ 1. the board */

{
  const g = C.start({ rows: 4, cols: 5, random: () => 0 });
  equal("the opening board has twenty nodes", g.nodes.length, 20);
  check("every node starts black for a zero random draw", g.nodes.every((n) => n.color === C.BLACK));
  check("the grid has horizontal and vertical edges", g.edges.length === 4 * 4 + 5 * 3);
  check("no edge is a loop", g.edges.every(([u, v]) => u !== v));

  const flipped = C.flip(g, 0);
  equal("a click flips one node", flipped.nodes[0].color, C.WHITE);
  equal("the other nodes stay", flipped.nodes[1].color, C.BLACK);
  equal("the old board is untouched", g.nodes[0].color, C.BLACK);
  equal("an unknown node is ignored", C.flip(g, 99), g);

  const tiny = { nodes: [{ color: C.WHITE }, { color: C.BLACK }, { color: C.WHITE }], edges: [[0, 1], [0, 2]] };
  const counts = C.neighbourCounts(tiny, 0);
  equal("one white and one black neighbour", counts.same, 1);
  equal("other count", counts.other, 1);
  check("equal counts make the node integrated", C.isIntegratedNode(tiny, 0));
  check("the whole graph is not integrated yet", !C.isIntegrated(tiny));
  equal("one balanced edge (the other joins equal colours)", C.balancedEdges(tiny), 1);

  const added = C.addEdge(tiny, 1, 2);
  equal("a new edge is added", added.edges.length, 3);
  equal("loops are refused", C.addEdge(tiny, 0, 0), tiny);
  const withNode = C.addNode(tiny, 5, 6, C.BLACK);
  equal("a new node is added", withNode.nodes.length, 4);
  equal("removing the last action removes the edge first", C.removeLast(added).edges.length, 2);
  let stripped = added;
  while (stripped.edges.length) stripped = C.removeLast(stripped);
  equal("then it removes the nodes", C.removeLast(stripped).nodes.length, 2);
}

/* ------------------------------------- 2. the claims, on every small graph */

function eachGraph(n, fn) {
  const pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  for (let mask = 0; mask < 2 ** pairs.length; mask++) {
    const edges = pairs.filter((_, k) => mask & (1 << k));
    fn({ nodes: edges.length ? Array.from({ length: n }, () => ({ color: C.WHITE })) : Array.from({ length: n }, () => ({ color: C.WHITE })), edges });
  }
}

{
  let graphs = 0;
  let integratedExists = 0;
  let maxIsIntegrated = 0;
  let localStep = 0;
  for (let n = 1; n <= 5; n++) {
    eachGraph(n, (bare) => {
      graphs++;
      let anyIntegrated = false;
      let best = -1;
      const bestColorings = [];
      for (let mask = 0; mask < 2 ** n; mask++) {
        const graph = {
          nodes: bare.nodes.map((_, i) => ({ color: mask & (1 << i) ? C.BLACK : C.WHITE })),
          edges: bare.edges,
        };
        const ok = C.isIntegrated(graph);
        if (ok) anyIntegrated = true;
        const score = C.balancedEdges(graph);
        if (score > best) {
          best = score;
          bestColorings.length = 0;
          bestColorings.push(graph);
        } else if (score === best) bestColorings.push(graph);
      }
      if (anyIntegrated) integratedExists++;
      if (bestColorings.every((g) => C.isIntegrated(g))) maxIsIntegrated++;

      // Flipping a non-integrated node gains (other - same) balanced edges.
      for (let mask = 0; mask < 2 ** n; mask++) {
        const graph = {
          nodes: bare.nodes.map((_, i) => ({ color: mask & (1 << i) ? C.BLACK : C.WHITE })),
          edges: bare.edges,
        };
        const bad = C.nonIntegrated(graph);
        if (!bad.length) continue;
        const i = bad[0];
        const { same, other } = C.neighbourCounts(graph, i);
        const gain = C.balancedEdges(C.flip(graph, i)) - C.balancedEdges(graph);
        if (gain === same - other && gain > 0) localStep++;
      }
    });
  }
  equal("every graph with at most five nodes was checked", graphs, 1 + 2 + 8 + 64 + 1024);
  equal("every graph admits an integrated colouring", integratedExists, graphs);
  equal("every maximal colouring is integrated", maxIsIntegrated, graphs);
  check("flipping a non-integrated node always gains balanced edges", localStep > 5000, `${localStep} flips`);
}

/* --------------------------- 3. a second count and the 20-node grid */

function appletBalanced(nodes, edges) {
  let count = 0;
  for (const [u, v] of edges) if (nodes[u].color !== nodes[v].color) count++;
  return count;
}

{
  const rnd = rng(1959);
  let compared = 0;
  for (let t = 0; t < 500; t++) {
    const n = 5 + Math.floor(rnd() * 10);
    const nodes = Array.from({ length: n }, () => ({ color: rnd() < 0.5 ? C.BLACK : C.WHITE }));
    const edges = [];
    for (let i = 0; i < n * 2; i++) {
      const u = Math.floor(rnd() * n);
      const v = Math.floor(rnd() * n);
      if (u !== v) edges.push([u, v]);
    }
    const graph = { nodes, edges };
    if (C.balancedEdges(graph) === appletBalanced(nodes, edges)) compared++;
  }
  equal("the balanced-edge count agrees on 500 random graphs", compared, 500);

  let solved = 0;
  for (let t = 0; t < 50; t++) {
    const result = C.maximize(C.start({ random: rnd }), rnd);
    if (result.integrated && result.balanced === C.balancedEdges(result.graph)) solved++;
  }
  equal("hill-climbing finds an integrated colouring on every 20-node grid", solved, 50);
}

done("affirmative-action");
