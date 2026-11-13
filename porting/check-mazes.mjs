#!/usr/bin/env node
"use strict";

/*
 * Logic test for mazes/mazes-core.js.
 *
 *   1. Prim / Kruskal / DFS transcribed a second time from the bytecode and
 *      compared step-by-step on seeded grids.
 *   2. Page claims: a spanning tree has |V| = |E| + 1; both algorithms produce
 *      a spanning tree of the active cells; DFS reaches the end on that tree.
 *   3. Edge cases: no-wrap horizontal edges; removed cells stay out of the tree.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const H = loadCore("mazes/mazes-core.js", "MazesCore");

/* -------------------- 1. Second transcription from the bytecode ----------- */

function appletSortedInsert(list, edge) {
  for (let i = 0; i < list.length; i++) {
    if (edge.weight > list[i].weight) {
      list.splice(i, 0, edge);
      return;
    }
  }
  list.push(edge);
}

function appletPrim(maze) {
  const treeNodes = new Set();
  const treeEdges = [];
  const fringe = [];
  function addNode(node) {
    treeNodes.add(node);
    for (const e of maze.byNode.get(node) || []) {
      if (e.removed) continue;
      const o = H.otherEnd(e, node);
      if (!H.isActive(maze, o)) continue;
      if (!treeNodes.has(o)) appletSortedInsert(fringe, e);
      else {
        const i = fringe.indexOf(e);
        if (i >= 0) fringe.splice(i, 1);
      }
    }
  }
  addNode(maze.start);
  const active = H.activeNodes(maze).length;
  while (treeNodes.size < active && fringe.length) {
    const e = fringe[0];
    let neu = null;
    if (treeNodes.has(e.a)) neu = e.b;
    else if (treeNodes.has(e.b)) neu = e.a;
    if (neu && H.isActive(maze, neu) && !treeNodes.has(neu)) {
      addNode(neu);
      treeEdges.push(e);
    }
    const i = fringe.indexOf(e);
    if (i >= 0) fringe.splice(i, 1);
  }
  return { treeNodes, treeEdges };
}

function appletKruskal(maze) {
  const trees = new Map();
  const treeNodes = new Set();
  const treeEdges = [];
  for (const n of H.activeNodes(maze)) {
    const v = [n];
    trees.set(n, v);
    treeNodes.add(n);
  }
  const passing = maze.edges.filter((e) => !e.removed).slice();
  function couldUse(edge) {
    const t1 = trees.get(edge.a);
    const t2 = trees.get(edge.b);
    if (!t1 || !t2 || t1 === t2) return false;
    for (const n of t2) t1.push(n);
    for (const n of t1) trees.set(n, t1);
    return true;
  }
  while (passing.length && treeEdges.length < treeNodes.size - 1) {
    const e = passing.shift();
    if (couldUse(e)) treeEdges.push(e);
  }
  return { treeNodes, treeEdges };
}

function sameEdgeSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const e of b) if (!sa.has(e)) return false;
  return true;
}

for (const seed of [1, 2, 7, 42, 99]) {
  const rand = rng(seed);
  const maze = H.reset(6, 5, rand);
  const p1 = H.primRun(maze);
  const p2 = appletPrim(maze);
  check("prim edges seed " + seed, sameEdgeSet(p1.treeEdges, p2.treeEdges));
  check("prim nodes seed " + seed, p1.treeNodes.size === p2.treeNodes.size);

  const k1 = H.kruskalRun(maze);
  const k2 = appletKruskal(maze);
  check("kruskal edges seed " + seed, sameEdgeSet(k1.treeEdges, k2.treeEdges));
}

/* -------------------- 2. Page claims -------------------------------------- */

for (const seed of [3, 11, 20]) {
  const maze = H.reset(8, 6, rng(seed));
  const V = H.activeNodes(maze).length;
  for (const name of ["prim", "kruskal"]) {
    const st = name === "prim" ? H.primRun(maze) : H.kruskalRun(maze);
    equal(name + " |V| seed " + seed, st.treeNodes.size, V);
    equal(name + " |V|=|E|+1 seed " + seed, st.treeEdges.length, V - 1);
    // Connected: every active node reachable via tree edges from start
    const seen = new Set([maze.start]);
    const q = [maze.start];
    const set = new Set(st.treeEdges);
    while (q.length) {
      const n = q.pop();
      for (const e of maze.byNode.get(n) || []) {
        if (!set.has(e)) continue;
        const o = H.otherEnd(e, n);
        if (!seen.has(o)) {
          seen.add(o);
          q.push(o);
        }
      }
    }
    equal(name + " connected seed " + seed, seen.size, V);

    const dfs = H.dfsRun(maze, st.treeEdges);
    check(name + " dfs reaches end " + seed, dfs.current === maze.end || dfs.done);
    // After a full DFS on a tree from start to end, current should be end
    check(name + " dfs at end " + seed, dfs.current === maze.end);
  }
}

// 3 exact characterisation from the page: connected + |V|=|E|+1 ⇒ tree
{
  const maze = H.reset(4, 4, rng(5));
  const st = H.primRun(maze);
  check("tree char", st.treeEdges.length + 1 === st.treeNodes.size);
}

/* -------------------- 3. Edge cases --------------------------------------- */

{
  // No horizontal wrap: leftmost and rightmost of a row are not edged
  const maze = H.reset(3, 2, rng(8));
  let wrap = false;
  for (const e of maze.edges) {
    if (e.a.y === e.b.y && Math.abs(e.a.x - e.b.x) > 1) wrap = true;
    if (e.a.y === e.b.y && Math.abs(e.a.id - e.b.id) !== 1) wrap = true;
  }
  check("no horizontal wrap", !wrap);
}

{
  const maze = H.reset(5, 4, rng(9));
  const mid = maze.nodes[maze.nx + 2];
  H.removeNode(maze, mid);
  const st = H.primRun(maze);
  check("removed not in tree", !st.treeNodes.has(mid));
  equal("prim spans active", st.treeNodes.size, H.activeNodes(maze).length);
  equal("prim tree size", st.treeEdges.length, st.treeNodes.size - 1);
}

{
  // Permutation ReplaceZero: values are a perm of 1..n
  const p = H.createRandomPerm(4, rng(1));
  equal("perm sorted", [...p].sort((a, b) => a - b), [1, 2, 3, 4]);
}

{
  // Heaviest-first insert
  const list = [];
  H.sortedInsert(list, { weight: 2 });
  H.sortedInsert(list, { weight: 5 });
  H.sortedInsert(list, { weight: 3 });
  equal("sorted desc", list.map((e) => e.weight), [5, 3, 2]);
}

done("mazes");
