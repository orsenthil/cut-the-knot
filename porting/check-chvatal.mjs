#!/usr/bin/env node
"use strict";

/*
 * Logic test for chvatal/chvatal-core.js.
 *
 *   node porting/check-chvatal.mjs
 *
 * 1. A second, literal transcription of the applet's Triangulation.Populate
 *    and GetLeastFrequentColor (Sides hashtables, edge removal, the four
 *    "common neighbour" branches, colour = 3 - a - b) is compared with the
 *    core's colouring on EVERY triangulation of every convex polygon of 4
 *    to 9 vertices (Catalan's number of them: 2, 5, 14, 42, 132, 429).
 * 2. Every claim the cut-the-knot page makes is checked exhaustively: n-3
 *    diagonals and n-2 triangles in a triangulation; all three colours in
 *    every triangle; the three colour classes partition n so the least one
 *    has at most floor(n/3) vertices; a diagonal always exists; and the
 *    comb's worst case is achievable (a triangulation whose least class is
 *    exactly floor(n/3)).
 * 3. The applet's six messages, option ranges, end state and move edge
 *    cases, including the finished board ("Please reset the board.").
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("chvatal/chvatal-core.js", "ChvatalCore");

/* ---------------------- a literal second transcription of the applet's code */

// Triangulation(): Sides[i] is a hashtable neighbour -> Point(neighbour, i),
// V[i] is a Vertex(Index=i, Color=-1) seeded V[0]=0, V[1]=1.
function refTriangulate(n, points, diagonals) {
  const Sides = [];
  for (let i = 0; i < n; i++) Sides.push(new Map());
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Sides[i].set(j, { x: j, y: i });
    Sides[j].set(i, { x: i, y: j });
  }
  for (const d of diagonals) {
    const a = d.a;
    const b = d.b;
    Sides[a].set(b, { x: b, y: a });
    Sides[b].set(a, { x: a, y: b });
  }
  const V = [];
  for (let i = 0; i < n; i++) V.push({ Index: i, Color: -1 });
  V[0].Color = 0;
  V[1].Color = 1;
  const T = [];

  function Populate(a, b) {
    // Point p1 = (Point)Sides[a].remove(b); Point p2 = (Point)Sides[b].remove(a)
    Sides[a].delete(b);
    Sides[b].delete(a);
    let k = -1;
    const e1 = Array.from(Sides[a].entries());
    for (const s1 of e1) {
      const e2 = Array.from(Sides[b].entries());
      for (const s2 of e2) {
        // The bytecode assigns k only on a match; a non-matching pair falls
        // through to the k==-1 test with k still holding its last value.
        if (s1[1].y === s2[1].y) k = s1[1].y;
        else if (s1[1].y === s2[1].x) k = s1[1].y;
        else if (s1[1].x === s2[1].y) k = s1[1].x;
        else if (s1[1].x === s2[1].x) k = s1[1].x;
        if (k !== -1) {
          T.push([V[a].Index, V[b].Index, V[k].Index]);
          V[k].Color = 3 - V[a].Color - V[b].Color;
        }
      }
    }
    if (k !== -1) {
      Populate(a, k);
      Populate(b, k);
    }
  }
  Populate(0, 1);

  const counts = [0, 0, 0];
  for (const v of V) counts[v.Color]++;
  let best = 0; // GetLeastFrequentColor: best starts at 0, then 1 and 2
  for (let c = 1; c < 3; c++) if (counts[c] < counts[best]) best = c;
  const guards = [];
  for (let i = 0; i < n; i++) if (V[i].Color === best) guards.push(i);
  return { colors: V.map((v) => v.Color), triangles: T, counts, leastColor: best, guards };
}

/** Perfectly regular convex points, so every non-crossing diagonal is valid. */
/**
 * The applet's T drawing vector can list the same triangle more than once
 * (its Populate keeps a sticky k and adds a triangle for non-common neighbours
 * too). That only redraws the same triangle, so the core keeps distinct ones;
 * compare the two as sets.
 */
function triangleSet(triangles) {
  return triangles.map((t) => t.slice().sort((a, b) => a - b).join("-"))
    .filter((v, i, arr) => arr.indexOf(v) === i).sort();
}

function regularPoints(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    pts.push({ x: Math.round(160 + 70 * Math.cos(t)), y: Math.round(100 + 70 * Math.sin(t)) });
  }
  return pts;
}

/** Every maximal non-crossing diagonal set of a convex n-gon, each once. */
function allTriangulations(points) {
  const n = points.length;
  const pairs = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) if (!C.adjacent(a, b, n)) pairs.push({ a, b });
  }
  const out = [];
  // Choose an increasing-index subset, so a set is generated in exactly one
  // order rather than (n-3)! times.
  function rec(start, diags) {
    if (diags.length === n - 3) {
      out.push(diags.map((d) => ({ a: d.a, b: d.b })));
      return;
    }
    for (let i = start; i < pairs.length; i++) {
      const st = { n, points, diagonals: diags, finished: false };
      if (C.validateDiagonal(st, pairs[i].a, pairs[i].b) !== null) continue;
      rec(i + 1, diags.concat([pairs[i]]));
    }
  }
  rec(0, []);
  return out;
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the new board has 5 vertices by default", s.n, 5);
  equal("the new board has no diagonals", s.diagonals.length, 0);
  equal("the new board starts in draw mode", s.mode, "draw");
  equal("the new board has no message", s.message, null);
  equal("a demo has no win or loss at the start", C.result(s), null);
  equal("1 diagonal completes a quadrilateral", C.neededDiagonals(4), 1);
  equal("37 diagonals complete a 40-gon", C.neededDiagonals(40), 37);
  equal("the six applet messages are kept verbatim", C.MSG, [
    "A diagonal of zero length? Indeed!",
    "Diagonals should not cross.",
    "Diagonals should not cross sides.",
    "Please reset the board.",
    "Sides should not cross.",
    "Outside diagonals make no sense.",
  ]);
  check("the position is plain JSON", JSON.parse(JSON.stringify(s)).n === 5);
  const before = JSON.stringify(s);
  C.move(s, { type: "diagonal", a: 0, b: 2 });
  equal("moves do not mutate the position", JSON.stringify(s), before);
  equal("unknown moves are refused", C.move(s, { type: "nonsense" }), null);
  equal("the N spinner clamps below 4", C.clampN(2), 4);
  equal("the N spinner clamps above 40", C.clampN(99), 40);
  equal("the N spinner keeps integers", C.clampN(7.6), 8);
}

/* ------------------ 2. the core against the applet's own colouring method */

{
  let triangulations = 0;
  for (let n = 4; n <= 9; n++) {
    const points = regularPoints(n);
    const sets = allTriangulations(points);
    for (const diags of sets) {
      const analysis = C.triangulate(n, points, diags);
      const ref = refTriangulate(n, points, diags);
      const tag = `n=${n} diags=${diags.map((d) => d.a + "-" + d.b).join(" ")}`;
      equal(`colours match the applet ${tag}`, analysis.colors, ref.colors);
      equal(`triangles match the applet ${tag}`, triangleSet(analysis.triangles), triangleSet(ref.triangles));
      equal(`colour counts match the applet ${tag}`, analysis.counts, ref.counts);
      equal(`least colour matches the applet ${tag}`, analysis.leastColor, ref.leastColor);
      equal(`guard set matches the applet ${tag}`, analysis.guards, ref.guards);
      triangulations++;
    }
  }
  // Catalan numbers 2 + 5 + 14 + 42 + 132 + 429 for n = 4..9.
  equal("every triangulation of 4..9-gons was compared", triangulations, 624);
}

/* ---------------------------------- 3. every claim the cut-the-knot page makes */

{
  // A triangulation has n-3 diagonals and n-2 triangles.
  let triangulations = 0;
  for (let n = 4; n <= 9; n++) {
    const points = regularPoints(n);
    for (const diags of allTriangulations(points)) {
      const a = C.triangulate(n, points, diags);
      const tag = `n=${n} ${diags.map((d) => d.a + "-" + d.b).join(" ")}`;
      equal(`n-3 diagonals ${tag}`, diags.length, n - 3);
      equal(`n-2 triangles ${tag}`, a.triangles.length, n - 2);
      equal(`all vertices coloured ${tag}`, a.complete, true);
      check(`every triangle has three distinct colours ${tag}`,
        a.triangles.every((t) => new Set(t.map((i) => a.colors[i])).size === 3));
      equal(`the colour classes partition n ${tag}`, a.counts.reduce((x, y) => x + y, 0), n);
      check(`the least class is at most floor(n/3) ${tag}`, a.guardCount <= C.floorThird(n));
      equal(`the least colour really is the smallest class ${tag}`,
        a.guardCount, Math.min.apply(null, a.counts));
      check(`every triangle contains a guard ${tag}`,
        a.triangles.every((t) => t.some((i) => a.colors[i] === a.leastColor)));
      triangulations++;
    }
  }
  equal("claim checks covered every triangulation", triangulations, 624);
}

{
  // "Any simple polygon has at least one interior diagonal" (the ear claim),
  // and the bound holds all the way up to the applet's maximum of 40.
  for (let n = 4; n <= 40; n++) {
    const s = C.start({ n, seed: n });
    check(`a fresh ${n}-gon has a legal diagonal`, C.legalMoves(s).length > 0);
    let st = s;
    for (let i = 2; i <= n - 2; i++) st = C.move(st, { type: "diagonal", a: 0, b: i });
    equal(`fan completes the ${n}-gon`, st.finished, true);
    equal(`fan uses n-3 diagonals for ${n}`, st.diagonals.length, n - 3);
    check(`fan's guards obey floor(n/3) for ${n}`, st.analysis.guardCount <= C.floorThird(n));
    equal(`fan colouring agrees with the reference for ${n}`,
      st.analysis.colors, refTriangulate(n, st.points, st.diagonals).colors);
    equal(`no legal diagonal remains on a finished ${n}-gon`, C.legalMoves(st).length, 0);
  }
}

{
  // The page's comb example: floor(n/3) is achievable as a worst case, i.e.
  // there is a triangulation whose *least* colour class is exactly floor(n/3).
  // Search the convex triangulations for such a balanced colouring.
  for (let n = 6; n <= 9; n++) {
    const points = regularPoints(n);
    const best = Math.max.apply(null, allTriangulations(points).map(
      (diags) => C.triangulate(n, points, diags).guardCount));
    check(`a ${n}-gon can need floor(n/3) guards`, best === C.floorThird(n));
  }
  // A comb with n = 3k vertices needs k guards: each tooth must be watched.
  for (const k of [2, 3, 4]) {
    equal(`a comb with ${3 * k} vertices needs ${k} guards`, C.floorThird(3 * k), k);
  }
}

/* --------------------------- 4. messages, edge cases and end states */

{
  const s = C.start({ n: 5, seed: 1, points: regularPoints(5) });
  equal("same vertex gives the zero-length message", C.validateDiagonal(s, 2, 2), C.MSG[0]);
  equal("neighbours give the sides message", C.validateDiagonal(s, 0, 1), C.MSG[2]);
  equal("wrapping neighbours give the sides message", C.validateDiagonal(s, 0, 4), C.MSG[2]);
  equal("a valid diagonal is accepted", C.validateDiagonal(s, 0, 2), null);

  let st = C.move(s, { type: "diagonal", a: 2, b: 0 });
  equal("the diagonal is stored with its ends ordered", st.diagonals[0], { a: 0, b: 2 });
  // The applet's Crosses() skips stored diagonals that share an endpoint, so
  // a repeated diagonal slips through: a harmless quirk the core keeps.
  equal("a repeated diagonal is accepted like the applet", C.validateDiagonal(st, 0, 2), null);
  st = C.move(st, { type: "diagonal", a: 2, b: 4 });
  equal("non-crossing diagonals are both kept", st.diagonals.length, 2);
  equal("finishing a pentagon sets done", C.result(st), "done");
  equal("analysis exists once finished", st.analysis.complete, true);
  equal("a finished board refuses another diagonal", C.validateDiagonal(st, 1, 3), C.MSG[3]);
  const refused = C.move(st, { type: "diagonal", a: 1, b: 3 });
  equal("the refusal carries the applet's message", refused.message, C.MSG[3]);
  equal("the refusal leaves the board alone", refused.diagonals.length, 2);
  equal("a finished board has no legal moves", C.legalMoves(st).length, 0);

  st = C.move(st, { type: "pop" });
  equal("Pop removes one diagonal", st.diagonals.length, 1);
  equal("Pop clears the finished state", C.result(st), null);
  equal("Pop clears the analysis", st.analysis, null);
  st = C.move(st, { type: "pop" });
  st = C.move(st, { type: "pop" });
  equal("Pop on an empty board is harmless", st.diagonals.length, 0);
}

{
  // Crossing diagonals, mode switching, vertex dragging and the N spinner.
  let st = C.start({ n: 6, seed: 2, points: regularPoints(6) });
  st = C.move(st, { type: "diagonal", a: 0, b: 3 });
  equal("a crossing diagonal is refused", C.validateDiagonal(st, 1, 4), C.MSG[1]);
  const crossed = C.move(st, { type: "diagonal", a: 1, b: 4 });
  equal("the crossed diagonal is not stored", crossed.diagonals.length, 1);
  equal("the crossing message is shown", crossed.message, C.MSG[1]);

  st = C.move(st, { type: "mode", mode: "move" });
  equal("mode can be switched", st.mode, "move");
  equal("a bad mode is refused", C.move(st, { type: "mode", mode: "sideways" }), null);
  st = C.move(st, { type: "setPoint", index: 3, x: 200, y: 100 });
  check("dragging a vertex keeps a numeric position", Number.isFinite(st.points[3].x));
  equal("a bad vertex index is refused", C.move(st, { type: "setPoint", index: 9, x: 1, y: 1 }), null);

  st = C.move(st, { type: "setN", n: 40 });
  equal("the N spinner can be raised to 40", st.n, 40);
  st = C.move(st, { type: "setN", n: 1 });
  equal("the N spinner clamps to 4", st.n, 4);
  st = C.move(st, { type: "reset" });
  equal("Reset clears diagonals", st.diagonals.length, 0);
  equal("Reset keeps the vertex count", st.n, 4);

  // A crossed (bow-tie) polygon is caught by FullTest's first side test.
  const bow = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 }];
  const bad = C.start({ n: 4, points: bow });
  const wrecked = C.move(bad, { type: "setPoint", index: 0, x: 0, y: 0 });
  equal("FullTest reports a broken polygon", wrecked.message, C.MSG[4]);
}

done("chvatal");
