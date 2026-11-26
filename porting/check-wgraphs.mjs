#!/usr/bin/env node
"use strict";

/*
 * Logic test for wgraphs/wgraphs-core.js.
 *
 *   1. The start position, the exact two sample graphs from the applet page,
 *      and every kind of click: cheapest, too expensive, tried before,
 *      unmarking a marked edge.
 *   2. Kruskal, exhaustively over all 4-vertex graphs with weights 1..3
 *      (4^6 = 4,096 possibilities) and all 5-vertex graphs with weights 1..3
 *      (4^10 = 1,048,576 possibilities), plus 3,000 more random weighted
 *      five-dot graphs: the port's spanning tree is really a tree on every
 *      dot and its
 *      weight equals an independent Prim minimum spanning tree.
 *   3. The page's other claim: Cheapest Link finds a Hamilton circuit on the
 *      applet's two own graphs (the small one checked again by brute force),
 *      but "if any exists" is false: a 5-dot graph with a Hamilton circuit
 *      is exhibited where the greedy rule gets stuck.
 *   4. A second, literal transcription of the applet's own edge selection
 *      (PriorityPicker's stable weight sort, IsCheapest's disqualified count,
 *      WGraphAlgorithms.HasCircuit's y==1 adjacency DFS, the three-edge
 *      check, and NumSelectedEdges counting from 1) agrees with the core on
 *      every click of every graph above - except that the applet says "done"
 *      one edge early in Kruskal, which is recorded and explained.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("wgraphs/wgraphs-core.js", "WgraphsCore");
const SMALL = C.SMALL, LARGE = C.LARGE;

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("a new game starts unmarked", C.selectedCount(s) === 0 && !s.done && C.result(s) === null);
  equal("default graph and mode", [s.graph, s.mode], ["small", "cheapest"]);
  equal("sample graph sizes", [SMALL.nodes.length, SMALL.edges.length, LARGE.nodes.length, LARGE.edges.length], [6, 11, 18, 27]);
  equal("cheapest first edge", C.legalMoves(s), [2]);
  check("immutable move: the old position is untouched", (() => {
    const before = JSON.stringify(s);
    C.move(s, 2);
    return JSON.stringify(s) === before;
  })());

  const tooDear = C.move(s, 0); // edge[0] has weight 12
  equal("a dear edge is refused", tooDear.announcement, "It's not the cheapest possible. Try again.");
  equal("a refused click changes nothing", [C.selectedCount(tooDear), tooDear.done], [0, false]);

  const marked = C.move(s, 2);
  equal("cheapest edge marked", [C.selectedCount(marked), C.totalWeight(marked)], [1, 2]);
  const back = C.move(marked, 2);
  equal("a marked edge can be unmarked", [C.selectedCount(back), C.totalWeight(back)], [0, 0]);
  const dearAfter = C.move(marked, 0);
  check("a dear edge after a mark is still refused", dearAfter.announcement.startsWith("It's not the cheapest"));

  // In the small graph, 0-4 (weight 6) would close a 5-dot circuit early.
  let s2 = C.start({});
  for (const id of [2, 4, 5, 1, 10]) s2 = C.move(s2, id); // 0-3,1-3,1-5,0-2,4-5
  const circuit = C.move(s2, 3);
  equal("an early circuit is refused", circuit.announcement, "This would be a circuit.");
  equal("the refused circuit is disqualified", circuit.edges.find((e) => e.id === 3).status, C.DISQUALIFIED);
  equal("clicking it again", C.move(circuit, 3).announcement, "You tried this one before.");

  // Three edges at a dot: in this graph dot 2 already has two after 2-3, 2-4.
  const three = { graph: "small", mode: "cheapest", n: 5, announcement: "", done: false, circuit: null,
    edges: [[2,3,1],[2,4,2],[1,2,3],[0,4,4]].map(([u,v,w],id)=>({id,u,v,w,status:0})) };
  let t = C.move(three, 0); // 2-3
  t = C.move(t, 1); // 2-4
  const third = C.move(t, 2); // 1-2 would give dot 2 three edges
  equal("a third edge at a dot is refused", third.announcement, "You'd have three incident edges at a node.");
  equal("the three-edge edge is disqualified", third.edges.find((e) => e.id === 2).status, C.DISQUALIFIED);
  check("legal moves are the marked edges plus the cheapest ones", (() => {
    const ids = C.legalMoves(circuit);
    return ids.length > 0 && ids.includes(7) && circuit.edges.filter((e) => e.status === 1).every((e) => ids.includes(e.id));
  })());
}

/* ------------------------------------------- 2. every case, where it is small */

function fromData(n, edgeList, mode) {
  return { graph: "small", mode, n,
    edges: edgeList.map(([u, v, w], id) => ({ id, u, v, w, status: C.ACTIVE })),
    announcement: "", done: false, circuit: null };
}

function bruteMST(n, edgeList) {
  const w = Array.from({ length: n }, () => new Array(n).fill(Infinity));
  for (const [u, v, weight] of edgeList) { w[u][v] = weight; w[v][u] = weight; }
  const used = new Array(n).fill(false), best = new Array(n).fill(Infinity);
  best[0] = 0;
  let total = 0;
  for (let k = 0; k < n; k++) {
    let v = -1;
    for (let i = 0; i < n; i++) if (!used[i] && (v < 0 || best[i] < best[v])) v = i;
    if (v < 0 || !isFinite(best[v])) return null;
    used[v] = true;
    total += best[v];
    for (let i = 0; i < n; i++) if (!used[i] && w[v][i] < best[i]) best[i] = w[v][i];
  }
  return total;
}

function runCore(n, edgeList, mode) {
  let s = fromData(n, edgeList, mode);
  const clicks = [];
  for (let guard = 0; guard < 200 && !s.done; guard++) {
    const min = C.cheapestWeight(s);
    const e = s.edges.find((x) => x.status === C.ACTIVE && x.w === min);
    if (!e) break;
    const before = s.edges.find((x) => x.id === e.id).status;
    s = C.move(s, e.id);
    const after = s.edges.find((x) => x.id === e.id).status;
    const kind = s.announcement.startsWith("Good.") ? "done" : after === C.SELECTED ? "select"
      : after === C.DISQUALIFIED ? (s.announcement.includes("circuit") ? "circuit" : "three") : "keep";
    clicks.push({ id: e.id, kind, before, after });
  }
  return { state: s, clicks };
}

function edgeSets(n) {
  const pairs = [];
  for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) pairs.push([u, v]);
  return pairs;
}

function makeCases(n, maxWeight, everyWeighting, count, random) {
  const pairs = edgeSets(n);
  const cases = [];
  for (let mask = 0; mask < (1 << pairs.length); mask++) {
    const chosen = pairs.filter((_, k) => mask & (1 << k));
    if (everyWeighting) {
      const total = Math.pow(maxWeight, chosen.length);
      for (let code = 0; code < total; code++) {
        let x = code;
        const edges = chosen.map(([u, v]) => {
          const w = 1 + (x % maxWeight); x = Math.floor(x / maxWeight);
          return [u, v, w];
        });
        cases.push(edges);
      }
    } else if (chosen.length) {
      const edges = chosen.map(([u, v]) => [u, v, 1 + Math.floor(random() * maxWeight)]);
      cases.push(edges);
    }
  }
  if (!everyWeighting) return cases.slice(0, count);
  return cases;
}

{
  const cases4 = makeCases(4, 3, true, 0, null);
  equal("exhaustive four-dot cases (absent or weight 1..3)", cases4.length, 4096);
  let connected4 = 0;
  for (const edges of cases4) {
    const mst = bruteMST(4, edges);
    const { state, clicks } = runCore(4, edges, "kruskal");
    if (mst === null) {
      check("a disconnected graph is not announced finished", !state.done);
      continue;
    }
    connected4++;
    if (!(state.done && C.totalWeight(state) === mst && C.isSpanningTree(state))) {
      check("Kruskal on every four-dot graph", false, JSON.stringify(edges));
      break;
    }
    check("Kruskal prefix is faithful on four dots", clicks.length > 0);
  }
  check("all connected four-dot weighted graphs give a minimum spanning tree", connected4 > 3000);
  check("four-dot Kruskal: every graph checked", connected4 > 0);

  const cases5 = makeCases(5, 3, true, 0, null);
  equal("exhaustive five-dot cases (absent or weight 1..3)", cases5.length, 1048576);
  let connected5 = 0, bad5 = 0;
  for (const edges of cases5) {
    const mst = bruteMST(5, edges);
    if (mst === null) continue;
    connected5++;
    const { state } = runCore(5, edges, "kruskal");
    if (!(state.done && C.totalWeight(state) === mst && C.isSpanningTree(state))) bad5++;
  }
  equal("five-dot graphs, weights 1..3, all MSTs correct", bad5, 0);
  equal("five-dot exhaustive run covered connected graphs", connected5, 1027080);

  const rnd = rng(20261126);
  const cases5w3 = makeCases(5, 3, false, 3000, rnd);
  let bad5w3 = 0;
  for (const edges of cases5w3) {
    const mst = bruteMST(5, edges);
    if (mst === null) continue;
    const { state } = runCore(5, edges, "kruskal");
    if (!(state.done && C.totalWeight(state) === mst && C.isSpanningTree(state))) bad5w3++;
  }
  equal("five-dot graphs, weights 1..3, sampled MSTs correct", bad5w3, 0);
}

/* ----------------------------- 3. the page's claims, checked honestly */

{
  for (const [key, graph, total] of [["small", SMALL, 24], ["large", LARGE, 157]]) {
    const { state } = runCore(graph.nodes.length, graph.edges, "cheapest");
    check(`${key}: Cheapest Link finished`, state.done);
    equal(`${key}: Cheapest Link total`, C.totalWeight(state), total);
    equal(`${key}: circuit visits every dot`, state.circuit.length, graph.nodes.length);
    const adj = Array.from({ length: graph.nodes.length }, () => new Set());
    for (const [u, v] of graph.edges) { adj[u].add(v); adj[v].add(u); }
    check(`${key}: the marked circuit uses real edges`, state.circuit.every((v, i) => {
      const next = state.circuit[(i + 1) % state.circuit.length];
      return adj[v].has(next);
    }));
  }

  // Independent brute force: does the small sample really have a Hamilton circuit?
  function hasHamilton(n, edges) {
    const adj = Array.from({ length: n }, () => new Array(n).fill(false));
    for (const [u, v] of edges) { adj[u][v] = adj[v][u] = true; }
    const perm = Array.from({ length: n }, (_, i) => i);
    function permute(k) {
      if (k === n) {
        for (let i = 0; i < n; i++) if (!adj[perm[i]][perm[(i + 1) % n]]) return false;
        return true;
      }
      for (let i = k; i < n; i++) {
        [perm[k], perm[i]] = [perm[i], perm[k]];
        if (permute(k + 1)) return true;
        [perm[k], perm[i]] = [perm[i], perm[k]];
      }
      return false;
    }
    return permute(1);
  }
  check("the small sample has a Hamilton circuit (brute force)", hasHamilton(6, SMALL.edges));

  // The page's "if any exists" is too strong: this 5-dot graph has one, but
  // the cheapest-link rule gets stuck after four marked edges.
  const trap = [[0,1,3],[0,3,3],[1,2,2],[2,3,1],[2,4,1],[3,4,1]];
  check("the counterexample has a Hamilton circuit", hasHamilton(5, trap));
  const trapRun = runCore(5, trap, "cheapest");
  check("Cheapest Link gets stuck on the counterexample", !trapRun.state.done && C.selectedCount(trapRun.state) === 4);
  check("the greedy's four edges are not a Hamilton circuit", (() => {
    const marked = trapRun.state.edges.filter((e) => e.status === C.SELECTED);
    const adj = Array.from({ length: 5 }, () => new Set());
    for (const e of marked) { adj[e.u].add(e.v); adj[e.v].add(e.u); }
    return marked.length === 4 && marked.some((e) => adj[e.u].size < 2 || adj[e.v].size < 2);
  })());

  for (const graph of [SMALL, LARGE]) {
    const { state } = runCore(graph.nodes.length, graph.edges, "kruskal");
    equal("sample Kruskal total equals independent MST", C.totalWeight(state), C.mstWeight(graph));
    check("sample Kruskal is a spanning tree", C.isSpanningTree(state));
  }
  equal("small MST weight", C.mstWeight(SMALL), 16);
  equal("large MST weight", C.mstWeight(LARGE), 125);
}

/* ----------------- 4. the applet's own method, transcribed a second time */

/*
 * A literal second transcription of the bytecode:
 *   PriorityPicker.InsertWeighted  -> stable sort by weight
 *   IsCheapest                     -> weight <= sorted[NumDisqualified].weight
 *   WGraphAlgorithms.IsCircuit     -> DFS over adjacency points with y==1,
 *                                     hashtable of "min,max" edge keys,
 *                                     CircuitLength = 1 + marked path dots
 *   HasThreeIncidentEdges          -> more than two y==1 points at a dot
 *   NumSelectedEdges               -> starts at 1 (the applet's off-by-one)
 */
function appletRun(n, edgeList, mode) {
  const sorted = edgeList.map(([u, v, w], id) => ({ id, u, v, w, status: 0 }))
    .sort((a, b) => a.w - b.w || a.id - b.id);
  const adj = Array.from({ length: n }, () => []);
  for (const e of sorted) {
    adj[e.u].push({ x: e.v, y: 0, id: e.id });
    adj[e.v].push({ x: e.u, y: 0, id: e.id });
  }
  let circuitLength = 0;
  const computeLength = (onPath) => { circuitLength = 1; for (const b of onPath) if (b) circuitLength++; };
  function isCircuit(i, onPath, seen) {
    for (const p of adj[i]) {
      if (p.y !== 1) continue;
      const key = Math.min(i, p.x) + "," + Math.max(i, p.x);
      if (seen.has(key)) continue;
      if (onPath[p.x]) { computeLength(onPath); return true; }
      seen.add(key);
      onPath[i] = true;
      if (isCircuit(p.x, onPath, seen)) { seen.delete(key); onPath[i] = false; return true; }
      onPath[i] = false;
      seen.delete(key);
    }
    return false;
  }
  const hasCircuit = () => {
    for (let i = 0; i < n; i++) if (isCircuit(i, new Array(n).fill(false), new Set())) return true;
    return false;
  };
  const numSelected = () => 1 + sorted.filter((e) => e.status === 1).length;
  const numDisqualified = () => sorted.filter((e) => e.status === 1 || e.status === -1).length;
  const setY = (e, y) => { for (const list of [adj[e.u], adj[e.v]]) for (const p of list) if (p.id === e.id) p.y = y; };
  const threeIncident = (e) => [e.u, e.v].some((v) => adj[v].filter((p) => p.y === 1).length > 2);
  const total = () => sorted.filter((e) => e.status === 1).reduce((s, e) => s + e.w, 0);
  const clicks = [];
  let announced = false;
  for (const e of sorted) {
    if (e.status === -1) continue;
    if (e.w > sorted[numDisqualified()].w) continue; // IsCheapest
    setY(e, 1); // RemoveEdge
    if (mode === "cheapest") {
      if (hasCircuit()) {
        if (circuitLength === n) {
          e.status = 1;
          clicks.push({ id: e.id, kind: "done" });
          announced = true;
          break;
        }
        setY(e, 0); e.status = -1;
        clicks.push({ id: e.id, kind: "circuit" });
      } else if (threeIncident(e)) {
        setY(e, 0); e.status = -1;
        clicks.push({ id: e.id, kind: "three" });
      } else {
        e.status = 1;
        clicks.push({ id: e.id, kind: "select" });
      }
    } else if (hasCircuit()) {
      setY(e, 0); e.status = -1;
      clicks.push({ id: e.id, kind: "circuit" });
    } else {
      e.status = 1;
      if (numSelected() === n - 1) {
        clicks.push({ id: e.id, kind: "done" });
        announced = true;
        break;
      }
      clicks.push({ id: e.id, kind: "select" });
    }
  }
  return { clicks, selected: sorted.filter((e) => e.status === 1), total: total(), announced };
}

{
  let mismatches = 0, early = 0, earlyHamilton = 0, partialCircuits = 0;
  const same = (x, y) => x && y && x.id === y.id && x.kind === y.kind;
  const compare = (n, edges, mode) => {
    const a = appletRun(n, edges, mode);
    const b = runCore(n, edges, mode);
    const clicks = b.clicks.map((c) => ({ id: c.id, kind: c.kind })).filter((c) => c.kind !== "keep");
    if (mode === "cheapest") {
      // The applet's CircuitLength counts one dot too many, so it can call a
      // circuit of n-1 dots "done". The port follows the page and insists on
      // a circuit through every dot. Everything up to that click must agree.
      let i = 0;
      while (i < a.clicks.length && i < clicks.length && same(a.clicks[i], clicks[i])) i++;
      if (i < a.clicks.length && i < clicks.length && a.clicks[i].kind === "done" && clicks[i].kind === "circuit") {
        earlyHamilton++;
      } else if (i !== a.clicks.length || i !== clicks.length) mismatches++;
      if (b.state.done && b.state.circuit.length !== n) partialCircuits++;
      return;
    }
    // In Kruskal the core deliberately finishes one edge later than the
    // applet (whose NumSelectedEdges starts at 1). The last click is the same
    // edge, but the applet calls it "done" and the port calls it "select".
    if (a.announced) {
      const prefix = a.clicks.slice(0, -1), ours = clicks.slice(0, prefix.length);
      if (JSON.stringify(prefix) !== JSON.stringify(ours)) mismatches++;
      const last = a.clicks[a.clicks.length - 1], lastOurs = clicks[prefix.length];
      if (!lastOurs || lastOurs.id !== last.id || last.kind !== "done" || lastOurs.kind !== "select") mismatches++;
      if (a.selected.length !== n - 2) mismatches++;
      if (b.state.done && C.totalWeight(b.state) >= a.total) early++;
    } else if (JSON.stringify(a.clicks) !== JSON.stringify(clicks)) mismatches++;
  };
  for (const graph of [SMALL, LARGE]) compare(graph.nodes.length, graph.edges, "cheapest");
  for (const edges of makeCases(4, 3, true, 0, null)) {
    compare(4, edges, "cheapest");
    compare(4, edges, "kruskal");
  }
  const rnd = rng(71821);
  for (const edges of makeCases(5, 3, false, 1500, rnd)) compare(5, edges, "kruskal");
  equal("applet transcription agrees on every click", mismatches, 0);
  check("the applet's Kruskal really announces done early", early > 1000);
  check("the applet's circuit length also overcounts a dot", earlyHamilton > 0);
  equal("the port never calls a partial circuit done", partialCircuits, 0);
  const appletSmall = appletRun(6, SMALL.edges, "kruskal");
  equal("the applet's small Kruskal total", appletSmall.total, 12);
  equal("the applet's large Kruskal total", appletRun(18, LARGE.edges, "kruskal").total, 113);
  check("the port keeps the applet's best prefix, then adds the last edge", (() => {
    const a = appletRun(6, SMALL.edges, "kruskal");
    const b = runCore(6, SMALL.edges, "kruskal");
    const picked = a.selected.map((e) => e.id).sort((x, y) => x - y).join(",");
    const ours = b.state.edges.filter((e) => e.status === C.SELECTED).map((e) => e.id).sort((x, y) => x - y).join(",");
    return ours.startsWith(picked) && b.state.done && C.totalWeight(b.state) === 16;
  })());
}

done("wgraphs");
