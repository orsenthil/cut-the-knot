#!/usr/bin/env node
"use strict";

/*
 * Logic test for inscribed-square-2/inscribed-square-2-core.js.
 *
 *   node porting/check-inscribed-square-2.mjs
 *
 * Checks the opening figure, an exact hand-computed triangle, a grid of more
 * than a thousand triangles, and 4,000 rotated random triangles. For each it
 * tests the page's claims: PP'Q'Q is a square, its side is base x altitude /
 * (base + altitude), the two squares are homothetic from C with that scale,
 * their centres and C are collinear, and the Vecten point lies on that line.
 * It also checks the inward solution and its side base x altitude / |base -
 * altitude|, including the degenerate case altitude = base. Finally it writes
 * the applet's Draw() a second time, straight from the bytecode (FormSquare,
 * Perp, GeoSDoub.Intersect), and compares all eight constructed points with
 * the core on every random triangle.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("inscribed-square-2/inscribed-square-2-core.js", "InscribedSquare2Core");
const TOL = 1e-8;
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const closePoint = (a, b, tol = TOL) => C.finite(a) && C.finite(b) && C.dist(a, b) <= tol;
const p = (x, y) => ({ x, y });
const tri = (A, B, Cc) => ({ A, B, C: Cc, showNames: true, showHint: false });

function interior(q, u, v) {
  const d = C.sub(v, u);
  const t = C.dot(C.sub(q, u), d) / C.dot(d, d);
  return t > -1e-7 && t < 1 + 1e-7;
}

/* ---------------------------------------------------- 1. the opening figure */

{
  const s = C.start();
  equal("the opening points use the applet's fractions of the canvas",
    [s.A, s.B, s.C],
    [p(135, 140), p(225, 140), p(202.5, 120 - 45 * Math.sin(Math.PI / 3) - 10)]);
  check("names start on, extra info off, as in the archived explanation applet",
    s.showNames && !s.showHint);
  const f = C.compute(s), m = C.metrics(f);
  check("the opening construction is finite", m.valid);
  check("the Vecten square starts below AB, away from C", f.CA.y > f.A.y && f.CB.y > f.B.y);
  check("the opening P and Q lie on AB", near(f.P.y, s.A.y) && near(f.Q.y, s.B.y));
  check("the opening red square has four equal sides", m.equalSides < TOL, `${m.equalSides}`);
  check("the opening red square has right angles and a parallel top",
    m.rightAngles < TOL && m.parallelTop < TOL);
  check("the opening squares are homothetic from C", m.homothety < TOL &&
    m.collinear < TOL, `${m.homothety}, ${m.collinear}`);
  check("the opening side matches base x altitude / (base + altitude)",
    near(m.side, C.outwardSide(s), 1e-8), `${m.side} vs ${C.outwardSide(s)}`);
  check("the status line reports a side and a scale", /PQ is .*units long.*times scale/.test(C.describe(f)));
}

/* -------------------------------------- 2. an exact hand-computed triangle */

{
  // A=(0,0), B=(4,0), C=(2,-3). The altitude is 3, so the side is 4*3/(4+3)
  // = 12/7; P=(8/7,0), Q=(20/7,0) and the top is at y=-12/7.
  const s = tri(p(0, 0), p(4, 0), p(2, -3));
  const f = C.compute(s), m = C.metrics(f);
  check("exact: CA and CB are a quarter turn of AB", closePoint(f.CA, p(0, 4)) &&
    closePoint(f.CB, p(4, 4)));
  check("exact: P = CCa meet AB", closePoint(f.P, p(8 / 7, 0)));
  check("exact: Q = CCb meet AB", closePoint(f.Q, p(20 / 7, 0)));
  check("exact: PP' meets AC at height 12/7", closePoint(f.PP, p(8 / 7, -12 / 7)));
  check("exact: QQ' meets BC at height 12/7", closePoint(f.QQ, p(20 / 7, -12 / 7)));
  check("exact: the Vecten centre is (2,2)", closePoint(f.c1, p(2, 2)));
  check("exact: the inscribed square centre is (2,-6/7)", closePoint(f.c2, p(2, -6 / 7)));
  check("exact: all four sides are 12/7", near(m.side, 12 / 7) && m.equalSides < TOL);
  check("exact: the homothety scale is 3/7", near(distRatio(f), 3 / 7) &&
    near(m.homothety, 0));

  // The inward Vecten square gives a second solution: base (8,0) to (-4,0),
  // side 4*3/|4-3| = 12, with its top well past the apex C.
  const g = C.compute(s, -1), gm = C.metrics(g);
  check("inward exact: P and Q are on the extended sidelines",
    closePoint(g.P, p(8, 0)) && closePoint(g.Q, p(-4, 0)));
  check("inward exact: the second square has side 12", near(gm.side, 12) &&
    gm.equalSides < TOL);
  check("inward exact: its top is beyond the apex", g.PP.y < s.C.y);
  check("inward exact: the predicted inward side is 12", near(C.inwardSide(s), 12));
}

function distRatio(f) {
  return C.dist(f.C, f.c2) / C.dist(f.C, f.c1);
}

/* -------------------------- 3. a grid of triangles, the page's main claim */

{
  let cases = 0, inside = 0, worstSquare = 0, worstFormula = 0;
  let worstHomothety = 0, worstCollinear = 0, worstVecten = 0, worstVectenPoint = 0;
  for (let Li = 2; Li <= 10; Li++) {
    const L = Li;
    for (let ci = -2; ci <= 6; ci++) {
      const c = (L * ci) / 4;
      for (let hi = 1; hi <= 12; hi++) {
        const h = (L * hi) / 4;
        const s = tri(p(0, 0), p(L, 0), p(c, -h));
        const f = C.compute(s), m = C.metrics(f);
        if (!m.valid) continue;
        cases++;
        worstSquare = Math.max(worstSquare, m.equalSides, m.rightAngles, m.parallelTop);
        worstVecten = Math.max(worstVecten, m.vecten);
        worstFormula = Math.max(worstFormula, Math.abs(m.side - C.outwardSide(s)) / L);
        worstHomothety = Math.max(worstHomothety, m.homothety);
        worstCollinear = Math.max(worstCollinear, m.collinear);
        if (0 < c && c < L) {
          inside++;
          if (!interior(f.P, s.A, s.B) || !interior(f.Q, s.A, s.B) ||
              !interior(f.PP, s.A, s.C) || !interior(f.QQ, s.B, s.C)) {
            throw new Error(`the square left the triangle at L=${L}, c=${c}, h=${h}`);
          }
        }
        // Vecten point: outward squares on AC (clockwise) and BC meet at X;
        // the page says C, c1 and X are collinear.
        if (0 < c && c < L) {
          const ac = C.squareOn(s.A, s.C, -1), bc = C.squareOn(s.B, s.C, 1);
          const midAC = C.midpoint(s.A, ac.cb), midBC = C.midpoint(s.B, bc.cb);
          const X = C.intersect(s.A, midBC, s.B, midAC);
          if (C.finite(X)) {
            worstVectenPoint = Math.max(worstVectenPoint,
              Math.abs(C.cross(C.sub(f.C, X), C.sub(f.c1, X))) /
              (C.dist(f.C, X) * C.dist(f.c1, X)));
          }
        }
      }
    }
  }
  // Java's own |determinant| < 1 test rejects the smallest triangles, so we
  // count what survives rather than pretending every grid point is usable.
  check(`the grid ran ${cases} non-degenerate triangles`, cases > 700);
  check(`all ${inside} grid triangles with the apex over AB keep the square inside`, inside > 250);
  check(`grid: PP'Q'Q is a square (max error ${worstSquare})`, worstSquare < TOL);
  check(`grid: ACaCbB is a square (max error ${worstVecten})`, worstVecten < TOL);
  check(`grid: side = L*h/(L+h) (max scaled error ${worstFormula})`, worstFormula < TOL);
  check(`grid: homothety scale = side/base (max ${worstHomothety})`, worstHomothety < TOL);
  check(`grid: C, c1 and c2 are collinear (max ${worstCollinear})`, worstCollinear < TOL);
  check(`grid: C, c1 and the Vecten point are collinear (max ${worstVectenPoint})`,
    worstVectenPoint < TOL);
}

/* ------------------------- 4. the inward solution and its degenerate case */

{
  let cases = 0, worstSquare = 0, worstFormula = 0, worstBeyond = -Infinity;
  for (let L = 2; L <= 10; L += 1) for (let ci = 1; ci <= 3; ci++) {
    const c = (L * ci) / 4;
    for (let hi = 1; hi <= 9; hi++) {
      const h = (L * hi) / 5; // hi = 5 is h = L, the parallel/degenerate case
      if (Math.abs(h - L) < 1e-9) continue;
      const s = tri(p(0, 0), p(L, 0), p(c, -h));
      const f = C.compute(s, -1), m = C.metrics(f);
      if (!m.valid) continue;
      cases++;
      worstSquare = Math.max(worstSquare, m.equalSides, m.rightAngles, m.parallelTop);
      worstFormula = Math.max(worstFormula, Math.abs(m.side - C.inwardSide(s)) / L);
      if (h < L) worstBeyond = Math.max(worstBeyond, h - Math.abs(f.PP.y));
    }
  }
  check(`the inward grid ran ${cases} triangles`, cases >= 9 * 3 * 7);
  check(`inward grid: it is still a square (max ${worstSquare})`, worstSquare < TOL);
  check(`inward grid: side = L*h/|L-h| (max scaled ${worstFormula})`, worstFormula < TOL);
  check(`inward grid: when h < L the top lies past the apex (max ${worstBeyond})`,
    worstBeyond < -1e-9);
  const flat = C.compute(tri(p(0, 0), p(4, 0), p(2, -4)), -1);
  check("inward h = L: the lines are parallel, so the applet's NaN is kept",
    !C.metrics(flat).valid);
  check("a flat triangle gives the 'lines do not meet' status",
    /lines do not meet/.test(C.describe(flat)));
}

/* ------------------- 5. 4,000 rotated triangles against the second reading */

/*
 * A literal re-transcription of InscribedSquare2Canvas.Draw() and its helpers:
 *   FormSquare(A,B,CA,CB) = Rotate(A,B,PI/2,+1), Rotate(B,A,PI/2,-1)
 *   Perp(P,A,B) = P + (A.y-B.y, B.x-A.x)
 *   GeoSDoub.Intersect(p,q,r,s) = determinant form, NaN when |den| < 1
 * followed by P, PP, Q, QQ, c1, c2 in the bytecode's own order.
 */
function appletRotate(base, tip, theta, sign) {
  const co = Math.cos(theta), si = Math.sin(theta);
  return {
    x: base.x + co * (tip.x - base.x) - sign * si * (tip.y - base.y),
    y: base.y + sign * si * (tip.x - base.x) + co * (tip.y - base.y),
  };
}
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}
function appletPerp(P, A, B) {
  return { x: P.x + A.y - B.y, y: P.y + B.x - A.x };
}
function appletDraw(s) {
  const CA = appletRotate(s.A, s.B, 1.5707963267948966, 1);
  const CB = appletRotate(s.B, s.A, 1.5707963267948966, -1);
  const P = appletIntersect(s.A, s.B, s.C, CA);
  const PP = appletIntersect(P, appletPerp(P, s.A, s.B), s.A, s.C);
  const Q = appletIntersect(s.A, s.B, s.C, CB);
  const QQ = appletIntersect(Q, appletPerp(Q, s.A, s.B), s.B, s.C);
  const c1 = appletIntersect(s.A, CB, s.B, CA);
  const c2 = appletIntersect(P, QQ, Q, PP);
  return { CA, CB, P, PP, Q, QQ, c1, c2 };
}

{
  const rnd = rng(5762);
  let cases = 0, comparable = 0, skipped = 0, worstCore = 0;
  let worstApplet = 0, worstFormula = 0, worstCollinear = 0;
  for (let i = 0; i < 4000; i++) {
    // A random base anywhere, at any angle; C on the side opposite the
    // outward Vecten square, so this is the inscribed square of the page.
    const base = p(60 + rnd() * 240, 60 + rnd() * 120);
    const L = 30 + rnd() * 140;
    const theta = rnd() * 2 * Math.PI;
    const u = p(Math.cos(theta), Math.sin(theta));
    const n = p(u.y, -u.x);
    const A = p(base.x - u.x * L / 2, base.y - u.y * L / 2);
    const B = p(base.x + u.x * L / 2, base.y + u.y * L / 2);
    const t = -0.4 + rnd() * 1.8;
    const h = 0.05 * L + rnd() * 3 * L;
    const Cc = p(base.x + u.x * t * L + n.x * h, base.y + u.y * t * L + n.y * h);
    const s = tri(A, B, Cc);
    const f = C.compute(s), m = C.metrics(f);
    const a = appletDraw(s);
    if (!m.valid || !Object.values(a).every(C.finite)) { skipped++; continue; }
    cases++;
    worstCore = Math.max(worstCore, m.equalSides, m.rightAngles, m.parallelTop);
    worstFormula = Math.max(worstFormula, Math.abs(m.side - C.outwardSide(s)) / L);
    worstCollinear = Math.max(worstCollinear, m.collinear);
    for (const name of Object.keys(a)) {
      worstApplet = Math.max(worstApplet, C.dist(f[name], a[name]) / L);
      comparable++;
    }
  }
  check(`4,000 random rotated triangles were used (${skipped} degenerate skipped)`, cases + skipped === 4000);
  check(`the core matches the bytecode's Draw() on ${comparable} points (max ${worstApplet})`,
    comparable === cases * 8 && worstApplet < 1e-8);
  check(`rotated triangles: PP'Q'Q is a square (max ${worstCore})`, worstCore < 1e-8);
  check(`rotated triangles: side = L*h/(L+h) (max scaled ${worstFormula})`, worstFormula < 1e-8);
  check(`rotated triangles: the two centres line up with C (max ${worstCollinear})`,
    worstCollinear < 1e-8);
}

/* -------------------------------- 6. dragging and the two checkboxes */

{
  const s = C.start();
  const moved = C.move(s, "B", p(40, 90));
  check("dragging B leaves A and C unchanged", C.dist(moved.A, s.A) === 0 &&
    C.dist(moved.C, s.C) === 0 && closePoint(moved.B, p(40, 90)));
  check("dragging an unknown point is refused", C.move(s, "Z", p(1, 1)) === s);
  check("dragging to a non-finite point is refused", C.move(s, "A", p(NaN, 1)) === s);
  const out = C.move(s, "C", p(-900, 9999));
  check("dragged points stay on the board", out.C.x === C.MARGIN &&
    out.C.y === C.HEIGHT - C.MARGIN);
  const o = C.option(C.option(s, "showNames", false), "showHint", true);
  check("the two checkboxes are independent", !o.showNames && o.showHint);
  check("an unknown checkbox is refused", C.option(s, "hint", true) === s);
  check("the original position is never changed", s.showNames === true &&
    C.dist(s.B, p(225, 140)) === 0);
  check("moving C below AB is reported honestly",
    /outside the triangle/.test(C.describe(C.compute(tri(p(0, 0), p(4, 0), p(2, 3))))));
}

done("inscribed-square-2");
