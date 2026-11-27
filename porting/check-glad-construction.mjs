#!/usr/bin/env node
"use strict";

/*
 * Logic test for glad-construction/glad-construction-core.js.
 *
 *   node porting/check-glad-construction.mjs
 *
 * The cut-the-knot Explanation says: if n*AP = AD for P on side AD of a
 * parallelogram ABCD, and Q = AC ∩ BP, then (n+1)*AQ = AC; the corollary
 * projects Q onto AD to cut off 1/(n+1) of it. The applet applies this with
 * A bottom-left, B bottom-right, D top-left and the projection onto AB:
 * P_k = AB/(k+2), E_k = AC/(k+2), so the last point cuts off exactly 1/N.
 *
 * This test compares the core with a second, literal transcription of
 * GladConstructionCanvas.DrawConstruction, Draw and GeoSDoub (Intersect and
 * GetParallelTo) from the applet bytecode for every N from 2 to 20 and many
 * parallelograms. It also checks the page's lemma and corollary as independent
 * rational identities, the drag constraints of mouseReleased, every control
 * and its range, and that the sequence is 1/2, 1/3, ..., 1/N (not the
 * Fibonacci variant also described in the Explanation).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("glad-construction/glad-construction-core.js", "GladConstructionCore");

const near = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const same = (p, q, tol = 1e-6) =>
  Number.isFinite(p?.x) && Number.isFinite(p?.y) && Number.isFinite(q?.x) && Number.isFinite(q?.y) &&
  Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const cross = (p, q) => p.x * q.y - p.y * q.x;
const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/* --------------------------- the applet, transcribed a second time -------- */

// GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), javap offsets
// 0..177. The applet returns a point of NaNs when |det| < 1.
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

// GeoSDoub.GetParallelTo(p, q, r), javap offsets 0..43.
function appletParallel(p, q, r) {
  return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
}

// GladConstructionCanvas.Draw() plus DrawConstruction(), javap offsets 0..204.
// Draw(): P[0] = Midpoint(A,B), E[0] = Intersect(D,B,A,C).
// DrawConstruction(): for i = 1..N-1 draw E[i-1]P[i-1], then P[i-2]D when
// i > 1, and if i < N-1 compute E[i] = Intersect(P[i-1],D,A,C) and
// P[i] = Intersect(A,B,E[i],GetParallelTo(E[i],B,C)).
function appletDraw(A, B, C, D, N) {
  const P = new Array(N - 1), E = new Array(N - 1);
  const stepLines = [], rayLines = [];
  P[0] = midpoint(A, B);
  E[0] = appletIntersect(D, B, A, C);
  for (let i = 1; i < N; i++) {
    stepLines.push([E[i - 1], P[i - 1]]);
    if (i > 1) rayLines.push([P[i - 2], D]);
    if (i < N - 1) {
      E[i] = appletIntersect(P[i - 1], D, A, C);
      const q = appletParallel(E[i], B, C);
      P[i] = appletIntersect(A, B, E[i], q);
    }
  }
  return { P, E, stepLines, rayLines };
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("opening A is init()'s (width/7, height - height/7)", s.A, { x: 57, y: 215 });
  equal("opening B is (width - width/7, height - height/7)", s.B, { x: 343, y: 215 });
  equal("opening C is (width - width/7, height/7)", s.C, { x: 343, y: 35 });
  equal("opening D is (width/7, height/7)", s.D, { x: 57, y: 35 });
  check("opening N is the applet's 3", s.n === 3);
  check("names start off and a fresh picture has no result", !s.names && C.result(s) === null);
  const types = new Set(C.legalMoves().map((m) => m.type));
  check("legal moves cover all four corners, N, names and reset",
    ["point", "parts", "names", "reset"].every((t) => types.has(t)) &&
    new Set(C.legalMoves().filter((m) => m.type === "point").map((m) => m.name)).size === 4);
}

/* ------------------------------------------------------------ 2. the moves */

{
  const s = C.start();
  const a = C.move(s, { type: "point", name: "A", x: 100, y: 180 });
  check("dragging A moves B with it, as in mouseReleased",
    same(a.A, { x: 100, y: 180 }) && same(a.B, { x: 343 + (100 - 57), y: 180 }) &&
    same(a.C, s.C) && same(a.D, s.D));
  const b = C.move(s, { type: "point", name: "B", x: 300, y: 120 });
  check("dragging B moves A with it",
    same(b.B, { x: 300, y: 120 }) && same(b.A, { x: 57 + (300 - 343), y: 120 }) &&
    same(b.C, s.C) && same(b.D, s.D));
  const c = C.move(s, { type: "point", name: "C", x: 300, y: 60 });
  check("dragging C moves D with it",
    same(c.C, { x: 300, y: 60 }) && same(c.D, { x: 57 - (343 - 300), y: 60 }) &&
    same(c.A, s.A) && same(c.B, s.B));
  const d = C.move(s, { type: "point", name: "D", x: 90, y: 50 });
  check("dragging D moves C with it",
    same(d.D, { x: 90, y: 50 }) && same(d.C, { x: 343 - (57 - 90), y: 50 }) &&
    same(d.A, s.A) && same(d.B, s.B));
  check("every drag preserves the parallelogram and horizontal sides",
    [a, b, c, d].every((q) => q.A.y === q.B.y && q.C.y === q.D.y &&
      near(q.A.x - q.D.x, q.B.x - q.C.x, 1e-9)));
  check("dragging does not change N and counts as exploring",
    [a, b, c, d].every((q) => q.n === 3 && q.moves === 1 && q.explored && C.result(q) === "done"));
  check("the original position is untouched", s.moves === 0 && !s.explored && s.n === 3);
  check("a dragged point is clamped to the canvas",
    same(C.move(s, { type: "point", name: "A", x: -10, y: 999 }).A, { x: 0, y: C.HEIGHT }));
  check("N is clamped to the applet's 2..20",
    C.move(s, { type: "parts", value: 1 }).n === 2 && C.move(s, { type: "parts", value: 99 }).n === 20);
  check("N accepts every whole value in the applet's range",
    Array.from({ length: 19 }, (_, i) => C.move(s, { type: "parts", value: i + 2 }).n)
      .every((n, i) => n === i + 2));
  check("fractional N is rounded as PVNumeric.getLong would", C.move(s, { type: "parts", value: 7.6 }).n === 8);
  check("names and reset behave",
    C.move(s, { type: "names", value: true }).names === true &&
    C.move(a, { type: "reset" }).explored === false &&
    C.move(a, { type: "reset" }).n === 3 &&
    C.move({ ...a, n: 7, names: true }, { type: "reset" }).n === 7 &&
    C.move({ ...a, n: 7, names: true }, { type: "reset" }).names === true);
  check("bad moves are refused",
    C.move(s, { type: "parts", value: NaN }) === null &&
    C.move(s, { type: "parts", value: "seven" }) === null &&
    C.move(s, { type: "point", name: "X", x: 1, y: 1 }) === null &&
    C.move(s, { type: "point", name: "A", x: "x", y: 1 }) === null &&
    C.move(s, { type: "names", value: "yes" }) === null &&
    C.move(s, { type: "nonsense" }) === null &&
    C.move(null, { type: "reset" }) === null);
}

/* ------------------------------ 3. every N, many parallelograms ---------- */

{
  const rand = rng(20261127);
  const fixed = [
    { A: { x: 57, y: 215 }, B: { x: 343, y: 215 }, C: { x: 343, y: 35 }, D: { x: 57, y: 35 } }, // opening
    { A: { x: 40, y: 225 }, B: { x: 360, y: 225 }, C: { x: 360, y: 25 }, D: { x: 40, y: 25 } }, // wide
    { A: { x: 100, y: 200 }, B: { x: 180, y: 200 }, C: { x: 200, y: 50 }, D: { x: 120, y: 50 } }, // slanted
    { A: { x: 60, y: 240 }, B: { x: 320, y: 240 }, C: { x: 270, y: 60 }, D: { x: 10, y: 60 } }, // slanted other way
  ];
  for (let i = 0; i < 10; i++) {
    const ax = 30 + 60 * rand(), ay = 185 + 55 * rand();
    const w = 90 + 170 * rand();
    const h = 45 + 95 * rand();
    const slant = (rand() - 0.5) * 70;
    fixed.push({
      A: { x: ax, y: ay }, B: { x: ax + w, y: ay },
      C: { x: ax + w + slant, y: ay - h }, D: { x: ax + slant, y: ay - h },
    });
  }

  let finiteIntersections = 0;
  for (const p of fixed) {
    check("sampled parallelogram is inside the applet's canvas",
      [p.A, p.B, p.C, p.D].every((q) => q.x >= 0 && q.x <= C.WIDTH && q.y >= 0 && q.y <= C.HEIGHT) &&
      p.A.y === p.B.y && p.C.y === p.D.y && near(p.A.x - p.D.x, p.B.x - p.C.x, 1e-9));

    const opts = { A: p.A, B: p.B, C: p.C, D: p.D };
    for (let n = C.MIN_PARTS; n <= C.MAX_PARTS; n++) {
      const s = C.start({ ...opts, n });
      const g = C.construct(s);
      const applet = appletDraw(s.A, s.B, s.C, s.D, n);

      check("the arrays have the applet's N-1 points",
        g.Es.length === n - 1 && g.Ps.length === n - 1 &&
        applet.E.length === n - 1 && applet.P.length === n - 1 &&
        g.stepLines.length === n - 1 && g.rayLines.length === n - 2);
      check("E_0 is DB ∩ AC and P_0 is the midpoint of AB",
        same(g.Es[0], appletIntersect(s.D, s.B, s.A, s.C), 1e-6) &&
        same(g.Ps[0], midpoint(s.A, s.B), 1e-6) &&
        same(g.Es[0], midpoint(s.A, s.C), 1e-6));
      check("the projection segments match the applet's E_i P_i lines",
        g.stepLines.every(([u, v], i) => same(u, applet.stepLines[i][0], 1e-6) &&
          same(v, applet.stepLines[i][1], 1e-6)));
      check("the construction rays match the applet's P_i D lines",
        g.rayLines.every(([u, v], i) => same(u, applet.rayLines[i][0], 1e-6) &&
          same(v, applet.rayLines[i][1], 1e-6)));

      // The second transcription is only meaningful where the applet's
      // GeoSDoub.Intersect does not declare near-parallel lines (|det| < 1).
      const finite = applet.E.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)) &&
        applet.P.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
      if (finite) {
        finiteIntersections++;
        check("every crossing matches the applet's own Intersect/GetParallelTo",
          g.Es.every((q, i) => same(q, applet.E[i], 1e-5)) &&
          g.Ps.every((q, i) => same(q, applet.P[i], 1e-5)));
      }

      // The Explanation's lemma and corollary, as rational identities.
      check("E_k is 1/(k+2) of the diagonal AC, for every k",
        g.Es.every((E, k) => {
          const den = k + 2;
          return near(den * (E.x - s.A.x), s.C.x - s.A.x, 1e-5) &&
            near(den * (E.y - s.A.y), s.C.y - s.A.y, 1e-5) &&
            near(cross({ x: E.x - s.A.x, y: E.y - s.A.y }, { x: s.C.x - s.A.x, y: s.C.y - s.A.y }), 0, 1e-5);
        }));
      check("P_k is 1/(k+2) of AB, so the last mark is exactly 1/N",
        g.Ps.every((P, k) => {
          const den = k + 2;
          return near(den * (P.x - s.A.x), s.B.x - s.A.x, 1e-5) &&
            near(den * (P.y - s.A.y), s.B.y - s.A.y, 1e-5) &&
            near(P.y, s.A.y, 1e-9);
        }) &&
        near(g.Ps[n - 2].x - s.A.x, (s.B.x - s.A.x) / n, 1e-5));
      check("each P_k is the parallel projection of E_k onto AB",
        g.Es.every((E, k) => {
          const q = appletParallel(E, s.B, s.C);
          const foot = appletIntersect(s.A, s.B, E, q);
          return Number.isFinite(foot.x) && same(foot, g.Ps[k], 1e-5);
        }));
      check("each E_k is AC crossed with the ray from P_(k-1) to D",
        g.Es.every((E, k) => k === 0
          ? same(E, appletIntersect(s.D, s.B, s.A, s.C), 1e-5)
          : same(E, appletIntersect(g.Ps[k - 1], s.D, s.A, s.C), 1e-5)));
      check("the applet's claim holds for this configuration",
        Object.values(C.claims(s)).every(Boolean));
      check("the marks are the unit fractions, ending at 1/N",
        g.Ps.every((_, k) => near((k + 2) * (g.Ps[k].x - s.A.x), s.B.x - s.A.x, 1e-5)) &&
        !g.Ps.some((_, k) => k > 0 && near((g.Ps[k].x - s.A.x) / (s.B.x - s.A.x), 1 / 2 + 1 / 4, 1e-5)));
    }
    check("moving the top side without changing its slant does not move the marks",
      C.construct({ ...opts, n: 11, D: { x: p.D.x + 20, y: p.D.y + 8 }, C: { x: p.C.x + 20, y: p.C.y + 8 } })
        .Ps.every((P, k) => same(P, C.construct({ ...opts, n: 11 }).Ps[k], 1e-5)));
    check("sliding the whole picture slides the marks by the same amount",
      C.construct({ ...opts, n: 9, A: { x: p.A.x + 11, y: p.A.y - 7 }, B: { x: p.B.x + 11, y: p.B.y - 7 },
        C: { x: p.C.x + 11, y: p.C.y - 7 }, D: { x: p.D.x + 11, y: p.D.y - 7 } })
        .Ps.every((P, k) => same(P, { x: C.construct({ ...opts, n: 9 }).Ps[k].x + 11,
          y: C.construct({ ...opts, n: 9 }).Ps[k].y - 7 }, 1e-5)));
  }
  check("all sampled intersections were finite in GeoSDoub's sense", finiteIntersections === fixed.length * 19);
}

/* ---------------------------------------- 4. the page's other description */

{
  const s = C.start();
  for (let n = C.MIN_PARTS; n <= C.MAX_PARTS; n++) {
    const g = C.construct({ ...s, n });
    // The Explanation also describes a Fibonacci variant that swaps which
    // side carries the previous mark. This applet does not do that: its
    // denominators are 2, 3, 4, ..., N, not 2, 3, 5, 8, ...
    const denominators = g.Ps.map((_, k) => k + 2);
    check("the applet walks 1/2, 1/3, ..., 1/N, not the Fibonacci fractions",
      denominators.length === n - 1 &&
      denominators.every((d, i) => d === i + 2) &&
      (n < 5 || denominators[3] === 5)); // 1/5 here, 1/8 in the variant
  }
  check("the default picture shows the midpoint and the third-point",
    C.construct(s).Ps.length === 2 && near(C.construct(s).Ps[1].x - s.A.x, (s.B.x - s.A.x) / 3));
  check("N = 2 needs just the diagonal intersection and the midpoint",
    C.construct({ ...s, n: 2 }).Ps.length === 1 &&
    C.construct({ ...s, n: 2 }).rayLines.length === 0);
}

done("glad-construction");
