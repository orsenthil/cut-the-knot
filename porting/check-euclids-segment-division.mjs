#!/usr/bin/env node
"use strict";

/*
 * Logic test for euclids-segment-division/euclids-segment-division-core.js.
 *
 *   node porting/check-euclids-segment-division.mjs
 *
 * Checks the opening picture and every move, then for every N the applet allows
 * (1..20) and many placements of A, B and C checks the page's claim: the lines
 * drawn parallel to B_N C cross BC at the fractions 1/N, 2/N, ..., (N-1)/N,
 * making N equal parts. The crossings are also compared with a second, literal
 * transcription of the applet's Compute(), GeoSDoub.GetParallelTo() and
 * GeoSDoub.Intersect() from its bytecode.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore(
  "euclids-segment-division/euclids-segment-division-core.js",
  "EuclidsSegmentDivisionCore",
);

const near = (a, b, eps = 1e-7) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
const same = (p, q, eps = 1e-7) => near(p.x, q.x, eps) && near(p.y, q.y, eps);
const cross = (p, q) => p.x * q.y - p.y * q.x;

/* ------------------------------------------- the applet's own second version */

// GeoSDoub.Intersect(DoubPoint x4), from javap -c: line/line determinant form.
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
}

// GeoSDoub.GetParallelTo(p, q, r), from javap -c: p + 100 * (q - r).
function appletParallel(p, q, r) {
  return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
}

// EuclidsSegmentDivisionCanvas.Compute(), from javap -c.
function appletCompute(A, B, Cpoint, N) {
  const s = A.x - B.x, t = A.y - B.y;
  const PointsB = new Array(N + 1), PointsD = new Array(N + 1), Parallels = new Array(N - 1);
  PointsB[0] = B;
  PointsB[1] = A;
  for (let i = 2; i < N + 1; i++) PointsB[i] = { x: B.x + i * s, y: B.y + i * t };
  for (let i = 1; i < N; i++) {
    Parallels[i - 1] = [PointsB[i], appletParallel(PointsB[i], PointsB[N], Cpoint)];
  }
  PointsD[0] = B;
  PointsD[N] = Cpoint;
  for (let i = 1; i < N; i++) {
    PointsD[i] = appletIntersect(B, Cpoint, Parallels[i - 1][0], Parallels[i - 1][1]);
  }
  return { PointsB, Parallels, PointsD };
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("opening A", s.A, C.START_A);
  equal("opening B", s.B, C.START_B);
  equal("opening C", s.C, C.START_C);
  check("opening N is the applet's 3", s.n === 3);
  check("a new picture has no result", C.result(s) === null);
  check("names and hint start off, as with the page's Show=0 applet", !s.names && !s.hint);
  const types = new Set(C.legalMoves().map((m) => m.type));
  check("legal moves cover drag, N, both ticks and reset",
    ["point", "n", "names", "hint", "reset"].every((t) => types.has(t)));
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
    C.move(s, { type: "n", value: 0 }).n === 1 && C.move(s, { type: "n", value: 99 }).n === 20);
  check("N accepts the whole applet range",
    Array.from({ length: 20 }, (_, i) => C.move(s, { type: "n", value: i + 1 }).n).every((n, i) => n === i + 1));
  check("bad moves are refused",
    C.move(s, { type: "n", value: NaN }) === null &&
    C.move(s, { type: "point", name: "X", x: 1, y: 1 }) === null &&
    C.move(s, { type: "point", name: "A", x: "x", y: 1 }) === null &&
    C.move(s, { type: "names", value: "yes" }) === null &&
    C.move(s, { type: "nonsense" }) === null &&
    C.move(null, { type: "reset" }) === null);
  check("ticks and reset behave", C.move(s, { type: "names", value: true }).names === true &&
    C.move(s, { type: "hint", value: true }).hint === true &&
    C.move(a, { type: "reset" }).explored === false &&
    C.move(a, { type: "reset" }).names === false);
  check("a dragged point is kept on the board", C.move(s, { type: "point", name: "A", x: -10, y: 999 }).A.x === 0 &&
    C.move(s, { type: "point", name: "A", x: -10, y: 999 }).A.y === C.HEIGHT);
  check("options can set the page's Show=1 picture", (() => {
    const o = C.start({ n: 12, names: true, hint: true });
    return o.n === 12 && o.names && o.hint && o.moves === 0 && C.result(o) === null;
  })());
}

/* ----------------------------------------- 3. every N, many placements */

{
  const rand = rng(20261127);
  const positions = [
    { A: { x: 134, y: 240 }, B: { x: 120, y: 200 }, C: { x: 257, y: 200 } }, // opening
    { A: { x: 40, y: 340 }, B: { x: 120, y: 120 }, C: { x: 300, y: 120 } },   // A low and left
    { A: { x: 330, y: 20 }, B: { x: 120, y: 120 }, C: { x: 300, y: 120 } },   // A high and right
    { A: { x: 100, y: 240 }, B: { x: 210, y: 60 }, C: { x: 210, y: 330 } },   // BC vertical
    { A: { x: 20, y: 60 }, B: { x: 310, y: 190 }, C: { x: 40, y: 30 } },      // sloping BC, reversed
    { A: { x: 385, y: 245 }, B: { x: 10, y: 10 }, C: { x: 390, y: 240 } },    // corners
  ];
  for (let i = 0; i < 12; i++) {
    const b = { x: 10 + 380 * rand(), y: 10 + 380 * rand() };
    const c = { x: 10 + 380 * rand(), y: 10 + 380 * rand() };
    const a = { x: b.x + (rand() - 0.5) * 200, y: b.y + (10 + 100 * rand()) * (rand() < 0.5 ? -1 : 1) };
    if (Math.abs(cross({ x: a.x - b.x, y: a.y - b.y }, { x: c.x - b.x, y: c.y - b.y })) < 1e-3) continue;
    positions.push({ A: a, B: b, C: c });
  }

  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    for (const pos of positions) {
      const { A, B, C: Q } = pos;
      const g = C.construct({ A, B, C: Q, n });
      const v = { x: Q.x - B.x, y: Q.y - B.y };
      const d = { x: A.x - B.x, y: A.y - B.y };
      const ap = appletCompute(A, B, Q, n);

      check("the marks have the applet's length and start with B and A",
        g.marks.length === n + 1 && same(g.marks[0], B) && same(g.marks[1], A));
      check("the marks step by A-B, as Compute() does",
        g.marks.every((p, i) => same(p, { x: B.x + i * d.x, y: B.y + i * d.y })) &&
        g.marks.every((p, i) => same(p, ap.PointsB[i])));
      check("the parallels are GetParallelTo(B_i, B_N, C)",
        g.parallels.length === Math.max(0, n - 1) &&
        g.parallels.every((p, i) => same(p, ap.Parallels[i][1]) && same(p, appletParallel(ap.PointsB[i + 1], ap.PointsB[n], Q))));

      // The page's claim, tested as an exact linear condition with no rounding.
      check("each crossing is the exact fraction i/n of BC",
        g.cuts.every((p, i) => near(n * (p.x - B.x) - i * v.x, 0, 1e-6) &&
          near(n * (p.y - B.y) - i * v.y, 0, 1e-6)));
      check("each crossing is collinear with BC",
        g.cuts.every((p) => Math.abs(cross({ x: p.x - B.x, y: p.y - B.y }, v)) < 1e-6));
      check("the cuts match the applet's GeoSDoub.Intersect()",
        g.valid && g.cuts.every((p, i) => same(p, ap.PointsD[i], 1e-6)));
      check("the n pieces of BC have equal length",
        g.cuts.every((p, i) => i === 0 ||
          near(Math.hypot(p.x - g.cuts[i - 1].x, p.y - g.cuts[i - 1].y), Math.hypot(v.x, v.y) / n, 1e-6)));
      check("fraction(i) is i over n",
        C.fractions(n).every((f, i) => f.num === i && f.den === n && near(f.num / f.den, i / n)));
      check("the cuts do not depend on where A is",
        C.construct({ A: { x: A.x + 47, y: A.y - 63 }, B, C: Q, n }).cuts.every((p, i) => same(p, g.cuts[i])));
      check("a translation of the whole picture translates the cuts",
        C.construct({ A: { x: A.x + 13, y: A.y - 29 }, B: { x: B.x + 13, y: B.y - 29 },
          C: { x: Q.x + 13, y: Q.y - 29 }, n }).cuts
          .every((p, i) => same(p, { x: g.cuts[i].x + 13, y: g.cuts[i].y - 29 })));
      check("N is the number of parts", g.parts === n && g.cuts.length === n + 1);
    }
    check("every allowed N is valid at the opening", (() => {
      const g = C.construct({ ...C.start(), n });
      return g.valid && g.cuts.length === n + 1;
    })());
  }

  // The page specifies "a positive angle to BC": A on BC is outside the claim.
  const flat = C.construct({ A: { x: 200, y: 200 }, B: { x: 100, y: 200 }, C: { x: 300, y: 200 }, n: 5 });
  check("A on BC is flagged as a degenerate construction", !flat.valid);
}

/* ------------------------------------- 4. asking for a number of parts */

{
  const A = { x: 120, y: 280 }, B = { x: 100, y: 80 }, Q = { x: 300, y: 80 };
  for (let parts = C.MIN_N; parts <= C.MAX_N; parts++) {
    const g = C.divideInto(A, B, Q, parts);
    check("divideInto(parts) makes the exact fractions k/parts",
      g !== null && g.parts === parts &&
      g.cuts.every((p, k) => near(parts * (p.x - B.x), k * (Q.x - B.x), 1e-6) &&
        near(parts * (p.y - B.y), k * (Q.y - B.y), 1e-6)));
  }
  check("divideInto refuses parts outside the applet's range",
    C.divideInto(A, B, Q, 0) === null && C.divideInto(A, B, Q, 21) === null && C.divideInto(A, B, Q, NaN) === null);
  const g = C.divideInto(A, B, Q, 4);
  check("four parts use five marks including B and five crossings", g.marks.length === 5 && g.cuts.length === 5);
}

done("euclids-segment-division");
