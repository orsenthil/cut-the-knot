#!/usr/bin/env node
"use strict";

/*
 * Logic test for al-nayrizi-construction/al-nayrizi-construction-core.js.
 *
 *   node porting/check-al-nayrizi-construction.mjs
 *
 * Checks the start picture and every move, then for every N the applet allows
 * (1..20) and many point placements checks the exact rational crossings against
 * the construction. The crossings are also compared with a second, literal
 * transcription of Compute() and GeoSDoub.Intersect() from the applet's
 * bytecode. Finally the article's claim is tested: N marks give N + 1 parts,
 * not the N parts the prose says (its own illustration shows N + 1).
 */

import { loadCore, check, equal, rng } from "./lib/load-core.mjs";
import { done } from "./lib/load-core.mjs";

const C = loadCore("al-nayrizi-construction/al-nayrizi-construction-core.js", "AlNayriziConstructionCore");

const near = (a, b, eps = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
const same = (p, q, eps = 1e-7) => near(p.x, q.x, eps) && near(p.y, q.y, eps);
const cross = (p, q) => p.x * q.y - p.y * q.x;

/* ------------------------------------------- the applet's own second version */

// GeoSDoub.Intersect, transcribed from javap line by line (line/line determinant).
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
}

// AlNayriziConstructionCanvas.Compute(), transcribed from the bytecode.
function appletCompute(A, B, Cpoint, N) {
  const s = A.x - B.x, t = A.y - B.y;
  const PointsB = new Array(N + 1), PointsC = new Array(N + 1), PointsD = new Array(N + 2);
  PointsB[0] = B;
  PointsB[1] = A;
  for (let i = 2; i < N + 1; i++) PointsB[i] = { x: B.x + i * s, y: B.y + i * t };
  PointsC[0] = Cpoint;
  for (let i = 1; i < N + 1; i++) PointsC[i] = { x: Cpoint.x - i * s, y: Cpoint.y - i * t };
  PointsD[0] = B;
  PointsD[N + 1] = Cpoint;
  for (let i = 1; i < N + 1; i++) {
    PointsD[i] = appletIntersect(B, Cpoint, PointsB[i], PointsC[N - i + 1]);
  }
  return { PointsB, PointsC, PointsD };
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("opening A", s.A, C.START_A);
  equal("opening B", s.B, C.START_B);
  equal("opening C", s.C, C.START_C);
  check("opening N is the applet's 3", s.n === 3);
  check("a new picture has no result", C.result(s) === null);
  check("names and hint start off", !s.names && !s.hint);
  const types = new Set(C.legalMoves().map((m) => m.type));
  check("legal moves cover drag, N, both ticks and reset",
    ["point", "marks", "names", "hint", "reset"].every((t) => types.has(t)));
}

/* --------------------------------------------------- 2. every legal move */

{
  const s = C.start();
  const a = C.move(s, { type: "point", name: "A", x: 200, y: 40 });
  check("dragging A moves only A", same(a.A, { x: 200, y: 40 }) && same(a.B, s.B) && same(a.C, s.C));
  const b = C.move(s, { type: "point", name: "B", x: 150, y: 120 });
  check("dragging B levels BC at the new y", b.B.y === 120 && b.C.y === 120 && b.C.x === s.C.x);
  const c = C.move(s, { type: "point", name: "C", x: 90, y: 60 });
  check("dragging C levels BC at the new y", c.B.y === 60 && c.C.y === 60 && c.B.x === s.B.x);
  check("dragging does not change N", a.n === 3 && b.n === 3 && c.n === 3);
  check("a move counts and explores", a.moves === 1 && a.explored && C.result(a) === "done");
  check("the original position is untouched", s.moves === 0 && !s.explored);
  check("N is clamped to the applet's 1..20",
    C.move(s, { type: "marks", value: 0 }).n === 1 && C.move(s, { type: "marks", value: 99 }).n === 20);
  check("N accepts the whole applet range",
    Array.from({ length: 20 }, (_, i) => C.move(s, { type: "marks", value: i + 1 }).n).every((n, i) => n === i + 1));
  check("bad moves are refused",
    C.move(s, { type: "marks", value: NaN }) === null &&
    C.move(s, { type: "point", name: "X", x: 1, y: 1 }) === null &&
    C.move(s, { type: "point", name: "A", x: "x", y: 1 }) === null &&
    C.move(s, { type: "names", value: "yes" }) === null &&
    C.move(s, { type: "nonsense" }) === null &&
    C.move(null, { type: "reset" }) === null);
  check("ticks and reset behave", C.move(s, { type: "names", value: true }).names === true &&
    C.move(s, { type: "hint", value: true }).hint === true &&
    C.move(a, { type: "reset" }).explored === false &&
    C.move(a, { type: "reset" }).names === false);
  check("a point is kept on the board", C.move(s, { type: "point", name: "A", x: -10, y: 999 }).A.x === 0 &&
    C.move(s, { type: "point", name: "A", x: -10, y: 999 }).A.y === C.HEIGHT);
}

/* ----------------------------------------- 3. every N, many placements */

{
  const rand = rng(20261126);
  const positions = [
    { A: { x: 134, y: 108 }, B: { x: 120, y: 83 }, C: { x: 257, y: 83 } }, // opening
    { A: { x: 40, y: 220 }, B: { x: 120, y: 120 }, C: { x: 300, y: 120 } }, // A left and low
    { A: { x: 330, y: 20 }, B: { x: 120, y: 120 }, C: { x: 300, y: 120 } }, // A right and high
    { A: { x: 120, y: 230 }, B: { x: 210, y: 60 }, C: { x: 210, y: 210 } }, // vertical BC
    { A: { x: 20, y: 60 }, B: { x: 310, y: 190 }, C: { x: 40, y: 30 } },   // sloping BC, reversed
    { A: { x: 385, y: 245 }, B: { x: 10, y: 10 }, C: { x: 390, y: 240 } }, // corners
  ];
  for (let i = 0; i < 12; i++) {
    const b = { x: 10 + 380 * rand(), y: 10 + 230 * rand() };
    const c = { x: 10 + 380 * rand(), y: 10 + 230 * rand() };
    const a = { x: b.x + (rand() - 0.5) * 200, y: b.y + (10 + 80 * rand()) * (rand() < 0.5 ? -1 : 1) };
    if (Math.abs(cross({ x: a.x - b.x, y: a.y - b.y }, { x: c.x - b.x, y: c.y - b.y })) < 1e-3) continue;
    positions.push({ A: a, B: b, C: c });
  }

  let claimTrue = 0;
  for (let n = C.MIN_MARKS; n <= C.MAX_MARKS; n++) {
    for (const pos of positions) {
      const { A, B, C: Q } = pos;
      const g = C.construct({ A, B, C: Q, n });
      const v = { x: Q.x - B.x, y: Q.y - B.y };
      const d = { x: A.x - B.x, y: A.y - B.y };
      const ap = appletCompute(A, B, Q, n);

      check("mark arrays have the applet's lengths",
        g.marksB.length === n + 1 && g.marksC.length === n + 1 && g.cuts.length === n + 2 && g.crossLines.length === n);
      check("the marks start at B and C and use A as B_1",
        same(g.marksB[0], B) && same(g.marksB[1], A) && same(g.marksC[0], Q));
      check("marks step by A-B on one ray and backwards on the other",
        g.marksB.every((p, i) => same(p, { x: B.x + i * d.x, y: B.y + i * d.y })) &&
        g.marksC.every((p, i) => same(p, { x: Q.x - i * d.x, y: Q.y - i * d.y })));
      check("all crossing lines have the same direction",
        g.crossLines.every(([p, q]) => same({ x: q.x - p.x, y: q.y - p.y }, { x: v.x - (n + 1) * d.x, y: v.y - (n + 1) * d.y })));
      // An independent rational condition: den * (D_k - B) = k * (C - B).
      check("each cut is the exact rational point k/(N+1) along BC",
        g.cuts.every((p, k) => near((n + 1) * (p.x - B.x) - k * v.x, 0, 1e-6) &&
          near((n + 1) * (p.y - B.y) - k * v.y, 0, 1e-6)));
      check("each cut is collinear with BC and lies between its ends",
        g.cuts.every((p, k) => Math.abs(cross({ x: p.x - B.x, y: p.y - B.y }, v)) < 1e-6 && k >= 0 && k <= n + 1));
      check("the N+1 pieces of BC are equal",
        g.cuts.every((p, k) => k === 0 || near(Math.hypot(p.x - g.cuts[k - 1].x, p.y - g.cuts[k - 1].y), Math.hypot(v.x, v.y) / (n + 1), 1e-6)));
      check("fraction(k) is k over N+1",
        C.fractions(n).every((f, k) => f.num === k && f.den === n + 1 && near(f.num / f.den, k / (n + 1))));
      check("the crossings do not depend on where A is",
        C.construct({ A: { x: A.x + 47, y: A.y - 63 }, B, C: Q, n }).cuts.every((p, k) => same(p, g.cuts[k])));
      check("a translation of the whole picture translates the cuts",
        C.construct({ A: { x: A.x + 13, y: A.y - 29 }, B: { x: B.x + 13, y: B.y - 29 }, C: { x: Q.x + 13, y: Q.y - 29 }, n })
          .cuts.every((p, k) => same(p, { x: g.cuts[k].x + 13, y: g.cuts[k].y - 29 })));
      // The second transcription: the marks and intersections the applet draws.
      check("the marks match the applet's own Compute()",
        ap.PointsB.every((p, i) => same(p, g.marksB[i])) && ap.PointsC.every((p, i) => same(p, g.marksC[i])));
      check("the crossings match the applet's own GeoSDoub.Intersect()",
        ap.PointsD.every((p, k) => same(p, g.cuts[k], 1e-6)));
      check("the applet's crossing lines join B_i to C_(N-i+1)",
        g.crossLines.every(([p, q], i) => same(p, ap.PointsB[i + 1]) && same(q, ap.PointsC[n - i])));

      // The article says the lines cut BC into N parts. They make N + 1.
      if (same(g.cuts[n], Q, 1e-9)) claimTrue++;
      check("the article's 'N parts' claim is false for these marks", !same(g.cuts[n], Q, 1e-9));
    }
    check("N marks make N+1 pieces for every allowed N",
      C.construct({ A: C.START_A, B: C.START_B, C: C.START_C, n }).parts === n + 1);
  }
  check("the page's prose claim never holds in the applet's range", claimTrue === 0);
}

/* ------------------------------------- 4. asking for a number of parts */

{
  const A = { x: 120, y: 200 }, B = { x: 100, y: 80 }, Q = { x: 300, y: 80 };
  for (let parts = 2; parts <= 21; parts++) {
    const g = C.divideInto(A, B, Q, parts);
    check("divideInto(parts) makes the exact fractions k/parts",
      g !== null && g.parts === parts &&
      g.cuts.every((p, k) => near(parts * (p.x - B.x), k * (Q.x - B.x), 1e-6) &&
        near(parts * (p.y - B.y), k * (Q.y - B.y), 1e-6)));
  }
  check("divideInto refuses parts outside the applet's range",
    C.divideInto(A, B, Q, 1) === null && C.divideInto(A, B, Q, 22) === null && C.divideInto(A, B, Q, NaN) === null);
  const g = C.divideInto(A, B, Q, 4);
  check("four parts use the opening three marks", g.marksB.length === 4 && g.cuts.length === 5);
}

done("al-nayrizi-construction");
