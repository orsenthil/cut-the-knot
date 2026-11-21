#!/usr/bin/env node
"use strict";

/*
 * Logic test for euler-hamilton-paths/euler-hamilton-paths-core.js.
 *
 *   1. Degrees, connectivity and the example graphs.
 *   2. Euler's criterion checked against a brute-force search over all
 *      sequences on small graphs; Hamilton existence checked against brute
 *      force too. The path validators accept real paths and reject repeats,
 *      missing edges and incomplete paths.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("euler-hamilton-paths/euler-hamilton-paths-core.js", "EulerHamiltonPathsCore");

function brute(graph, kind) {
  const n = graph.vertices.length;
  const walk = (at, usedEdges, seen) => {
    if (kind === "euler" && usedEdges.size === graph.edges.length) return true;
    if (kind === "hamilton" && seen.size === n) return true;
    for (let v = 0; v < n; v++) {
      const key = `${Math.min(at, v)}-${Math.max(at, v)}`;
      const edge = graph.edges.some(([u, w]) => `${Math.min(u, w)}-${Math.max(u, w)}` === key);
      if (!edge) continue;
      if (kind === "euler" && usedEdges.has(key)) continue;
      if (kind === "hamilton" && seen.has(v)) continue;
      const nextEdges = new Set(usedEdges);
      nextEdges.add(key);
      const nextSeen = new Set(seen);
      nextSeen.add(v);
      if (walk(v, nextEdges, nextSeen)) return true;
    }
    return false;
  };
  for (let s = 0; s < n; s++) {
    if (walk(s, new Set(), new Set([s]))) return true;
  }
  return false;
}

{
  equal("four example graphs", C.GRAPHS.length, 4);
  equal("triangle degrees", C.degrees(C.GRAPHS[0]).join(","), "2,2,2");
  check("triangle connected", C.connected(C.GRAPHS[0]));
  check("triangle has an Euler cycle", C.hasEulerCycle(C.GRAPHS[0]));
  check("star is connected", C.connected(C.GRAPHS[3]));
  check("star has an Euler path (four odd leaves)", !C.hasEulerPath(C.GRAPHS[3]));
  const s = C.start();
  equal("default graph", s.graph, 1);
  equal("default mode", s.mode, "euler");
  equal("click adds a vertex", C.click(s, 2).sequence.join(","), "2");
  equal("a second click appends", C.click(C.click(s, 2), 0).sequence.join(","), "2,0");
}

{
  let euler = 0;
  let hamilton = 0;
  let cases = 0;
  const subsets = [
    [[0, 1], [1, 2], [2, 0]],
    [[0, 1], [1, 2], [2, 3], [3, 0]],
    [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]],
    [[0, 1], [1, 2], [2, 3]],
    [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3]],
  ];
  for (let t = 0; t < subsets.length; t++) {
    const graph = { vertices: [{}, {}, {}, {}], edges: subsets[t] };
    cases++;
    const eulerExpected = C.connected(graph) && brute(graph, "euler");
    if (C.hasEulerPath(graph) === eulerExpected) euler++;
    if (C.hasHamiltonPath(graph) === brute(graph, "hamilton")) hamilton++;
  }
  equal("graphs checked", cases, 5);
  equal("Euler criterion matches brute force", euler, cases);
  equal("Hamilton search matches brute force", hamilton, cases);

  const tri = C.GRAPHS[0];
  check("triangle Euler path accepted", C.checkEuler(tri, [0, 1, 2, 0]).valid);
  check("reusing an edge rejected", !C.checkEuler(tri, [0, 1, 0, 2]).valid);
  check("incomplete Euler path rejected", !C.checkEuler(tri, [0, 1]).valid);
  check("triangle Hamilton path accepted", C.checkHamilton(tri, [0, 1, 2]).valid);
  check("revisiting a vertex rejected", !C.checkHamilton(tri, [0, 1, 2, 0]).valid);
  check("nonexistent edge rejected", !C.checkHamilton(tri, [0, 2, 1]).valid === false);
}

done("euler-hamilton-paths");
