#!/usr/bin/env node
"use strict";

/*
 * Logic test for tesseract/tesseract-core.js.
 *
 *   node porting/check-tesseract.mjs
 *
 * 1. The page's counts: 16 vertices, 32 edges, 24 squares, 8 cubes, the
 *    coefficients of (2x + 1)^4, and in general (2x + 1)^n; the
 *    construction doubles the vertices each step.
 * 2. The view: every combination of the six rotations is orthogonal with
 *    determinant 1, so the picture is the tesseract turned, not distorted.
 * 3. The cross-section: every point lies on the hyperplane and on the
 *    tesseract; h = 1/2 gives a cube (8 corners, 12 edges); x+y+z+h = 2
 *    gives an octahedron (6 corners, 12 edges); a plane missing the
 *    tesseract gives nothing.
 * 4. The reper puzzle, by breadth-first search from every square: every
 *    square has 8 different neighbours; gliding there and back restores the
 *    reper; the fewest moves that reverse it is 3, achieved exactly by going
 *    round one of the square's 4 edges (the page's solution); confined to
 *    the 6 squares of any one boundary cube it can never be reversed (a
 *    cube's surface is two-sided).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("tesseract/tesseract-core.js", "TesseractCore");

equal("(2x + 1)^4: 16 vertices, 32 edges, 24 squares, 8 cubes, 1 tesseract", C.faceCounts(4).join(","), "16,32,24,8,1");
equal("the model has 16 vertices, 32 edges, 24 squares", `${C.VERTS.length} ${C.EDGES.length} ${C.SQUARES.length}`, "16 32 24");
check("square names are all different, e.g. X01H", new Set(C.SQUARES.map((s) => s.name)).size === 24 && C.squareIndex("X01H") >= 0);
equal("(2x + 1)^n for n = 0..3", [0, 1, 2, 3].map((n) => C.faceCounts(n).join(" ")).join(" | "), "1 | 2 1 | 4 4 1 | 8 12 6 1");
equal("construction: 1, 2, 4, 8, 16 vertices and 0, 1, 4, 12, 32 edges",
  [0, 1, 2, 3, 4].map((k) => `${C.construction(k, 1).pts.length}/${C.construction(k, 1).edges.length}`).join(" "), "1/0 2/1 4/4 8/12 16/32");

{
  const R = rng(2);
  let ortho = true;
  for (let k = 0; k < 500; k++) {
    const ang = {}; for (const key of ["xy", "yz", "xz", "xh", "yh", "zh"]) ang[key] = -180 + 360 * R();
    const M = C.rotation(ang);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const dot = M[i].reduce((t, a, q) => t + a * M[j][q], 0);
      if (Math.abs(dot - (i === j ? 1 : 0)) > 1e-12) ortho = false;
    }
    if (Math.abs(C.det(M) - 1) > 1e-9) ortho = false;
  }
  check("every combination of the six rotations is a proper rotation (500 random)", ortho);
}

{
  const onPlane = (P, p) => Math.abs(P.A * p[0] + P.B * p[1] + P.C * p[2] + P.D * p[3] - P.E) < 1e-9;
  const inside = (p) => p.every((x) => x >= -1e-12 && x <= 1 + 1e-12);
  const R = rng(5);
  let ok = true;
  for (let k = 0; k < 500; k++) {
    const P = { A: -2 + 4 * R(), B: -2 + 4 * R(), C: -2 + 4 * R(), D: -2 + 4 * R(), E: -2 + 4 * R() };
    for (const [p, q] of C.section(P).segments) if (!onPlane(P, p) || !onPlane(P, q) || !inside(p) || !inside(q)) ok = false;
  }
  check("every point of the cross-section is on the hyperplane and in the tesseract", ok);
  const cube = C.section({ A: 0, B: 0, C: 0, D: 1, E: 0.5 });
  equal("h = 1/2 cuts a cube: 8 corners, 12 edges", `${cube.points.length} ${cube.segments.length}`, "8 12");
  const oct = C.section({ A: 1, B: 1, C: 1, D: 1, E: 2 });
  const corners = new Set(oct.segments.flatMap(([p, q]) => [p.join(), q.join()]));
  equal("x + y + z + h = 2 cuts an octahedron: 6 corners, 12 edges", `${corners.size} ${oct.segments.length}`, "6 12");
  equal("a plane missing the tesseract cuts nothing", C.section({ A: 1, B: 1, C: 1, D: 1, E: 5 }).segments.length, 0);
  equal("the applet's starting plane cuts a solid", C.section(C.PLANE).segments.length > 0, true);
}

{
  let eight = true, backAgain = true, three = true, aroundEdge = true, cubeSafe = true;
  const key = (s) => `${s.moving}|${JSON.stringify(s.reper)}`;
  for (let i = 0; i < 24; i++) {
    const nb = C.neighbours(i).map((n) => n.to);
    if (new Set(nb).size !== 8 || nb.includes(i)) eight = false;
    const s = C.startPuzzle({ square: i });
    for (let j = 0; j < 8; j++) {
      const t = C.glide(s, j);
      const back = C.glideTo(t, C.SQUARES[i].name);
      if (JSON.stringify(back.reper) !== JSON.stringify(s.reper)) backAgain = false;
    }
    // BFS for the first reversal; collect every shortest solution
    let layer = [s], seen = new Set([key(s)]), d = 0, sols = [];
    while (layer.length && !sols.length) {
      d++;
      const next = [];
      for (const t of layer) for (let j = 0; j < 8; j++) {
        const u = C.glide(t, j);
        if (C.solved(u)) { sols.push(u.history.concat([u.moving])); continue; }
        const k = key(u);
        if (!seen.has(k)) { seen.add(k); next.push(u); }
      }
      layer = next;
    }
    if (d !== 3) three = false;
    // each shortest solution goes round one edge: its three squares share an edge
    const edgesUsed = new Set();
    for (const path of sols) {
      const sq = path.slice(0, 3).map((k) => C.SQUARES[k]);
      const common = C.EDGES.filter(([a, b]) => sq.every((S) => C.corners(S).some((v) => v.join() === C.VERTS[a].join()) && C.corners(S).some((v) => v.join() === C.VERTS[b].join())));
      if (common.length !== 1) aroundEdge = false; else edgesUsed.add(common[0].join());
    }
    if (edgesUsed.size !== 4) aroundEdge = false;
    // confined to a boundary cube containing the square: never reversed
    const S = C.SQUARES[i];
    for (const k of Object.keys(S.fixed).map(Number)) {
      const inCube = (T) => T.fixed[k] === S.fixed[k] && Object.keys(T.fixed).map(Number).includes(k);
      let q = [s]; const seen2 = new Set([key(s)]);
      while (q.length) {
        const nq = [];
        for (const t of q) C.neighbours(t.moving).forEach((n, j) => {
          if (!inCube(C.SQUARES[n.to])) return;
          const u = C.glide(t, j);
          if (C.solved(u)) cubeSafe = false;
          if (!seen2.has(key(u))) { seen2.add(key(u)); nq.push(u); }
        });
        q = nq;
      }
    }
  }
  check("every square has 8 different neighbours", eight);
  check("gliding there and back restores the reper", backAgain);
  check("from every square the fewest moves that reverse the reper is 3", three);
  check("the shortest ways go round each of the square's 4 edges, and only those", aroundEdge);
  check("inside one boundary cube the reper can never be reversed", cubeSafe);
}

{
  let s = C.startPuzzle({ square: C.squareIndex("XY00") });
  equal("the repers agree at the start", C.orientation(s), 1);
  for (const n of ["X10H", "X1Z0", "XY00"]) s = C.glideTo(s, n);
  equal("round the edge y = 1, z = 0, h = 0: reversed", C.orientation(s), -1);
  equal("and that is a win", C.result(s), "win");
  check("a square that is not a neighbour is refused", C.glideTo(C.startPuzzle({ square: 0 }), "XY11") === null);
  equal("Repeat starts again on the same square", C.repeat(s).moving, C.squareIndex("XY00"));
  const t = C.startPuzzle({ square: 3 });
  const before = JSON.stringify(t);
  C.glide(t, 0);
  equal("a move leaves the old position alone", JSON.stringify(t), before);
}

done("tesseract");
