#!/usr/bin/env node
"use strict";

/*
 * Logic test for david-radcliffe/david-radcliffe-core.js.
 *
 *   node porting/check-david-radcliffe.mjs
 *
 * Section 3 is a second, independent transcription of the applet's own
 * geometry taken straight from javap: GeoSDoub.Rotate(DoubPoint,DoubPoint,
 * double,int), GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint),
 * DavidRadcliffeCanvas.EqTr and Reset. It is compared with the core's
 * analytic apex for every N in the JSpinner's range (3..30) on three
 * canvas sizes, not just a few samples. The rest of the test checks the
 * page's claims: the inner polygon is regular and smaller except at
 * N = 3 (same size) and N = 6 (a point), a segment between lattice nodes
 * always has two lattice apexes, and the page's second construction
 * (a+c-b) is smaller except at N = 3, 4, 6.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("david-radcliffe/david-radcliffe-core.js", "DavidRadcliffeCore");

const close = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const near = (p, q, eps = 1e-7) => close(p.x, q.x, eps) && close(p.y, q.y, eps);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("default spinner value is 4", s.N, 4);
  equal("spinner range is 3..30", C.RANGES.N, [3, 30]);
  equal("below the range clamps to 3", C.clampOption("N", 1), 3);
  equal("above the range clamps to 30", C.clampOption("N", 100), 30);
  equal("the spinner rounds its value", C.clampOption("N", 7.6), 8);
  equal("nothing is won or lost", C.result(s), null);
  equal("the original position is not mutated", s.N, 4);
  const next = C.withN(s, 9);
  equal("changing N rebuilds the polygon", [next.N, next.V.length, next.U.length], [9, 9, 9]);
  equal("changing N keeps the old state intact", s.N, 4);
  const turned = C.withAngle(s, Math.PI / 7);
  check("rotating keeps the vertex distance from the centre",
    close(dist(turned.V[0], turned.center), dist(s.V[0], s.center)));
  check("rotating keeps the apex distance from the centre",
    close(dist(turned.U[0], turned.center), dist(s.U[0], s.center)));
}

/* --------------------------------- 2. the applet's own method, transcribed */

/* javap: GeoSDoub.Rotate(DoubPoint p, DoubPoint q, double t, int sign) */
function rotateB(p, q, t, sign) {
  const c = Math.cos(t), s = Math.sin(t);
  const x = p.x + c * (q.x - p.x) - sign * s * (q.y - p.y);
  const y = p.y + sign * s * (q.x - p.x) + c * (q.y - p.y);
  return { x, y };
}

/* javap: GeoSDoub.Intersect(p1,q1,p2,q2), including its abs(den) < 1 guard */
function intersectB(p, q, r, s) {
  const a1 = p.y - q.y;
  const b1 = q.x - p.x;
  const c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y;
  const b2 = s.x - r.x;
  const c2 = r.x * s.y - r.y * s.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return {
    x: (b1 * c2 - b2 * c1) / den,
    y: (c1 * a2 - c2 * a1) / den,
  };
}

/* javap: EqTr(A,B): Rotate(B,A,pi/3,-1), Rotate(A,B,pi/3,+1), Intersect */
function eqTrB(a, b) {
  const p = rotateB(b, a, 1.0471975511965976, -1);
  const q = rotateB(a, b, 1.0471975511965976, 1);
  return intersectB(a, p, b, q);
}

/* javap: DavidRadcliffeCanvas.Reset() */
function resetB(N, width, height) {
  const radius = Math.min(width, height) / 2.5;
  const cx = Math.trunc(width / 2), cy = Math.trunc(height / 2);
  const V = [];
  for (let i = 0; i < N; i++) {
    const t = (6.283185307179586 / N) * i;
    V.push({ x: cx + radius * Math.cos(t), y: cy + radius * Math.sin(t) });
  }
  const U = [];
  for (let i = 0; i < N; i++) U.push(eqTrB(V[i], V[(i + 1) % N]));
  return { V, U, cx, cy, radius };
}

{
  const sizes = [[600, 450], [601, 451], [400, 300]];
  for (const [w, h] of sizes) {
    for (let N = 3; N <= 30; N++) {
      const core = C.start({ N, width: w, height: h });
      const bytecode = resetB(N, w, h);
      const same = core.V.every((p, i) => near(p, bytecode.V[i], 1e-9)) &&
        core.U.every((p, i) => near(p, bytecode.U[i], 1e-9)) &&
        core.center.x === bytecode.cx && core.center.y === bytecode.cy &&
        core.radius === bytecode.radius;
      check(`N=${N} at ${w}x${h}: core V and U equal the bytecode Reset/EqTr`, same);
    }
  }
}

/* -------------------------------------------- 3. the page's geometry claims */

{
  const s = C.start({ N: 4 });
  for (let N = 3; N <= 30; N++) {
    const st = C.start({ N });
    const V = st.V, U = st.U;
    let equilateral = true, regular = true;
    let innerRadius = 0, innerSide = 0, firstRadius = dist(U[0], st.center);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const side = dist(V[i], V[j]);
      equilateral = equilateral && close(dist(V[i], U[i]), side) && close(dist(V[j], U[i]), side);
      innerRadius = Math.max(innerRadius, Math.abs(dist(U[i], st.center) - firstRadius));
      innerSide = Math.max(innerSide, Math.abs(dist(U[i], U[j]) - dist(U[0], U[1])));
    }
    regular = innerRadius < 1e-6 * st.radius && innerSide < 1e-6 * st.radius;
    check(`N=${N}: each erected triangle is equilateral on a side`, equilateral);
    check(`N=${N}: the third vertices form a regular N-gon`, regular);
    check(`N=${N}: its scale matches |cos(pi/N)-sqrt(3)sin(pi/N)|`,
      close(firstRadius / st.radius, C.innerScale(N)));
    check(`N=${N}: claims() uses the same scale`, close(C.claims(N).ratio, C.innerScale(N)));
  }
}

{
  check("N=3: the inner triangle is the same size, not smaller",
    C.claims(3).sameSize && close(C.innerScale(3), 1));
  check("N=6: all six apexes fall on the centre point",
    C.claims(6).collapses && C.start({ N: 6 }).U.every((p) => near(p, C.start({ N: 6 }).center)));
  let smaller = 0, notSmaller = [];
  for (let N = 3; N <= 30; N++) {
    const r = C.innerScale(N);
    if (r > 1e-9 && r < 1 - 1e-9) smaller++;
    else notSmaller.push(N);
  }
  equal("all other spinner values really do shrink", notSmaller, [3, 6]);
  check("the descent works for 26 of the 28 applet settings", smaller === 26);
}

/* ------------------------ 4. the lattice property, in exact integer work */

{
  const a = { m: 0, n: 0 };
  let closed = true, distinct = true, matchesFloat = true;
  for (let m = -8; m <= 8; m++) {
    for (let n = -8; n <= 8; n++) {
      const b = { m, n };
      if (m === 0 && n === 0) continue;
      for (const sign of [1, -1]) {
        const apex = C.latticeApex(a, b, sign);
        closed = closed && Number.isInteger(apex.m) && Number.isInteger(apex.n);
        const other = C.latticeApex(a, b, -sign);
        distinct = distinct && (apex.m !== other.m || apex.n !== other.n);
        const P = C.latticePoint(b);
        const delta = { x: P.x - C.latticePoint(a).x, y: P.y - C.latticePoint(a).y };
        const turned = C.rot(delta, sign * Math.PI / 3);
        const floatApex = { x: C.latticePoint(a).x + turned.x, y: C.latticePoint(a).y + turned.y };
        matchesFloat = matchesFloat && near(floatApex, C.latticePoint(apex));
      }
    }
  }
  check("both 60-degree turns keep a lattice segment's apex on the lattice", closed);
  check("the two apexes of a lattice segment are distinct", distinct);
  check("the integer lattice rule agrees with the float geometry", matchesFloat);

  // The two equilateral apexes are exactly the two intersections of the
  // circles of radius |AB| around A and B: there is no third one.
  let onlyTwo = true;
  for (let m = -8; m <= 8 && onlyTwo; m++) {
    for (let n = -8; n <= 8 && onlyTwo; n++) {
      if (m === 0 && n === 0) continue;
      const A = { x: 0, y: 0 }, B = C.latticePoint({ m, n });
      const len = dist(A, B);
      const mid = { x: B.x / 2, y: B.y / 2 };
      const height = Math.sqrt(3) * len / 2;
      const perp = { x: -B.y / len, y: B.x / len };
      const circles = [
        { x: mid.x + height * perp.x, y: mid.y + height * perp.y },
        { x: mid.x - height * perp.x, y: mid.y - height * perp.y },
      ];
      const turns = [1, -1].map((sign) => {
        const v = C.rot({ x: B.x, y: B.y }, sign * Math.PI / 3);
        return { x: A.x + v.x, y: A.y + v.y };
      });
      onlyTwo = (near(circles[0], turns[0]) && near(circles[1], turns[1])) ||
        (near(circles[0], turns[1]) && near(circles[1], turns[0]));
    }
  }
  check("the two apexes are the only equilateral tips on a segment", onlyTwo);

  // A lattice triangle: (0,0), (1,0), (0,1) in lattice coordinates.
  const tri = [{ m: 0, n: 0 }, { m: 1, n: 0 }, { m: 0, n: 1 }];
  const triApex = C.latticeApex(tri[0], tri[1], 1);
  equal("the lattice triangle's new point is the third node", triApex, tri[2]);
  // A lattice hexagon: all six inward apexes are the centre node.
  const hex = [
    { m: 1, n: 0 }, { m: 0, n: 1 }, { m: -1, n: 1 },
    { m: -1, n: 0 }, { m: 0, n: -1 }, { m: 1, n: -1 },
  ];
  const centres = hex.map((p, i) => C.latticeApex(p, hex[(i + 1) % hex.length], 1));
  check("the lattice hexagon's apexes all land at the centre",
    centres.every((p) => p.m === 0 && p.n === 0));
}

/* ------------------------- 5. the page's second (a+c-b) construction */

{
  const centre = { x: 0, y: 0 };
  for (let N = 3; N <= 30; N++) {
    const poly = C.regularPolygon(N, centre, 100, 0.31);
    const next = C.alternativeStep(poly);
    const factor = C.alternativeScale(N);
    let regular = true;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      regular = regular && near(next[i], {
        x: factor * poly[i].x * Math.sign(2 * Math.cos(2 * Math.PI / N) - 1),
        y: factor * poly[i].y * Math.sign(2 * Math.cos(2 * Math.PI / N) - 1),
      }, 1e-9) && close(dist(next[i], centre), factor * 100);
    }
    check(`N=${N}: a+c-b gives a regular N-gon scaled by |2cos(2pi/N)-1|`, regular);
  }
  const exceptions = [];
  for (let N = 3; N <= 30; N++) {
    const f = C.alternativeScale(N);
    if (!(f > 1e-9 && f < 1 - 1e-9)) exceptions.push(N);
  }
  equal("the second construction fails to shrink only at 3, 4 and 6", exceptions, [3, 4, 6]);
}

done("david-radcliffe");
