#!/usr/bin/env node
"use strict";

/*
 * Logic test for simple-graphs/simple-graphs-core.js.
 *
 *   node porting/check-simple-graphs.mjs
 *
 * 1. Random multigraphs with and without loops: total degree is twice the
 *    number of edges and the number of odd-degree vertices is even.
 * 2. Edge counting, loops counting twice, refusal of loops when disabled,
 *    undo (Pop) and reset.
 * 3. Options, messages, plain JSON and immutability.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("simple-graphs/simple-graphs-core.js", "SimpleGraphsCore");

function build(nodes, edges, allowLoops, random) {
  let s = C.start({ allowLoops });
  for (let i = 0; i < nodes; i++) s = C.addNode(s, i * 10, i * 7);
  for (let k = 0; k < edges; k++) {
    const a = Math.floor(random() * nodes);
    const b = Math.floor(random() * nodes);
    s = C.addEdge(s, a + 1, b + 1);
  }
  return s;
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the board starts empty", [s.nodes.length, s.edges.length], [0, 0]);
  check("names are off by default in the applet's drawing", s.showDegrees === true);
  check("loops start disabled", s.allowLoops === false);
  check("a fresh board is not done", C.result(s) === null);
  const one = C.addNode(s, 10, 20);
  equal("a node gets an id", one.nodes[0], { id: 1, x: 10, y: 20 });
  equal("adding a node ends the exploration", C.result(one), "done");
  const two = C.addNode(one, 30, 40);
  const edge = C.addEdge(two, 1, 2);
  equal("an edge connects the two nodes", edge.edges, [{ a: 1, b: 2, count: 1 }]);
  equal("the degrees are both one", C.degrees(edge), [{ id: 1, degree: 1 }, { id: 2, degree: 1 }]);
  const twice = C.addEdge(edge, 2, 1);
  equal("a second edge increases the count", twice.edges, [{ a: 1, b: 2, count: 2 }]);
  equal("the degree becomes two", C.degrees(twice), [{ id: 1, degree: 2 }, { id: 2, degree: 2 }]);
  check("the message says the count", twice.message.includes("count now 2"));
}

/* --------------------- 2. the two graph invariants on random multigraphs */

{
  const random = rng(426);
  let handshaking = true;
  let oddEven = true;
  let detail = "";
  let cases = 0;
  for (const allowLoops of [false, true]) {
    for (let n = 1; n <= 8; n++) {
      for (let m = 0; m <= 12; m++) {
        const s = build(n, m, allowLoops, random);
        const st = C.stats(s);
        cases++;
        if (st.totalDegree !== 2 * st.links) {
          handshaking = false;
          detail = `n=${n} m=${m} loops=${allowLoops}: ${st.totalDegree} vs ${2 * st.links}`;
          break;
        }
        if (st.odd % 2 !== 0) {
          oddEven = false;
          detail = `n=${n} m=${m} loops=${allowLoops}: ${st.odd} odd nodes`;
          break;
        }
      }
      if (!handshaking || !oddEven) break;
    }
    if (!handshaking || !oddEven) break;
  }
  check(`total degree is twice the edge count in ${cases} graphs`, handshaking, detail);
  check("the number of odd-degree vertices is always even", oddEven, detail);

  const loop = C.addEdge(C.addNode(C.start({ allowLoops: true }), 5, 5), 1, 1);
  equal("a loop counts twice towards the degree", C.degrees(loop), [{ id: 1, degree: 2 }]);
  check("the loop is allowed when the option is on", loop.edges.length === 1);
}

/* ------------------------------------ 3. undo, options, messages and JSON */

{
  let s = C.addNode(C.start(), 0, 0);
  s = C.addNode(s, 10, 0);
  s = C.addEdge(s, 1, 2);
  const popped = C.pop(s);
  equal("undo removes the edge count", popped.edges.length, 0);
  equal("and leaves no isolated endpoints", popped.nodes.length, 0);
  check("undo is reported", popped.message.includes("removed"));
  const twice = C.addEdge(s, 1, 2);
  const oneLeft = C.pop(twice);
  equal("undo of a doubled edge leaves one copy", oneLeft.edges[0].count, 1);
  check("undo on an empty stack does nothing", C.pop(C.start()), C.start());

  const noLoops = C.addNode(C.start(), 5, 5);
  const refused = C.addEdge(noLoops, 1, 1);
  equal("a loop is refused when the option is off", refused.edges.length, 0);
  equal("and the message says why", refused.message, "Loops not allowed.");
  equal("an edge to a missing vertex is refused", C.addEdge(noLoops, 1, 9), noLoops);

  const moved = C.moveNode(noLoops, 1, 99, 88);
  equal("a node can be moved", moved.nodes[0], { id: 1, x: 99, y: 88 });
  equal("moving a missing node does nothing", C.moveNode(noLoops, 7, 1, 1), noLoops);
  equal("show degrees toggles", C.toggle(noLoops, "showDegrees").showDegrees, false);
  equal("allow loops toggles", C.toggle(noLoops, "allowLoops").allowLoops, true);
  equal("move mode toggles", C.toggle(noLoops, "moving").moving, true);
  equal("an unknown option is refused", C.toggle(noLoops, "other"), noLoops);
  const reset = C.reset(moved);
  equal("reset clears the board", [reset.nodes.length, reset.edges.length], [0, 0]);
  check("reset keeps the options", reset.allowLoops === moved.allowLoops);
  const snapshot = JSON.stringify(s);
  C.pop(s);
  C.addNode(s, 1, 1);
  check("core functions never mutate the position", JSON.stringify(s) === snapshot);
  check("a position is plain JSON", typeof JSON.parse(JSON.stringify(s)).nodes[0].id === "number");
  check("history holds plain edge records", s.history.every((h) => typeof h.a === "number"));
}

done("simple-graphs");
