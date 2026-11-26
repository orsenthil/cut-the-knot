#!/usr/bin/env node
"use strict";

/*
 * Logic test for arbelos-bui/arbelos-bui-core.js.
 *
 *   node porting/check-arbelos-bui.mjs
 *
 * Sweeps the dividing point C over 240 positions and varies A and B over nine
 * placements (2,160 configurations), checking the article's three claims on
 * each: both new circles have radius r1*r2/(r1+r2), their centres are
 * equidistant from O, and G1H1 + G2H2 = 2r.  It also checks the arbelos area
 * result linked from the article, then rebuilds the whole construction a
 * second way, straight from ArbelosBuiCanvas.Compute() in the bytecode, and
 * compares every point and radius with the core on the non-degenerate cases
 * (the applet's one-unit shortcut for "the other intersection" misbehaves
 * when a semicircle is only a few units across).
 */

import { loadCore, check, done } from "./lib/load-core.mjs";

const C = loadCore("arbelos-bui/arbelos-bui-core.js", "ArbelosBuiCore");
const P = (x, y) => ({ x: x, y: y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const max = (a, b) => Math.max(a, b);

/* ------------------------- the applet's own method, transcribed separately */

/* GeoSDoub.Intersect(DoubLine, DoubCircle): drop a perpendicular from the
 * centre to the line, then step h along the line in both directions. */
function intersectLineCircle(v, w, circle) {
  const dx = w.x - v.x, dy = w.y - v.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const t = (circle.c.x - v.x) * ux + (circle.c.y - v.y) * uy;
  const foot = P(v.x + t * ux, v.y + t * uy);
  const d2 = (circle.c.x - foot.x) ** 2 + (circle.c.y - foot.y) ** 2;
  const h = Math.sqrt(Math.max(0, circle.r * circle.r - d2));
  return [P(foot.x + h * ux, foot.y + h * uy), P(foot.x - h * ux, foot.y - h * uy)];
}

/* ArbelosBuiCanvas.FindEF: keep the intersection at least one unit from the
 * second argument, which is A, C or B lying on the circle. */
function findEF(circle, D, vertex) {
  const pts = intersectLineCircle(D, vertex, circle);
  return dist(pts[0], vertex) >= 1 ? pts[0] : pts[1];
}

/* ArbelosBuiCanvas.Compute(), method for method from the bytecode. */
function appletCompute(A, B, Cpt) {
  const O = mid(A, B), R = dist(O, A);
  const big = { c: O, r: R };
  const O1 = mid(A, Cpt), r1 = dist(O1, Cpt), c1 = { c: O1, r: r1 };
  const O2 = mid(B, Cpt), r2 = dist(O2, Cpt), c2 = { c: O2, r: r2 };

  const findD = (bigCircle, small) => {
    const aux = P(small.c.x + A.y - B.y, small.c.y - A.x + B.x);
    const pts = intersectLineCircle(aux, small.c, bigCircle);
    return pts[0].y < A.y ? pts[0] : pts[1];
  };
  const D1 = findD(big, c1), D2 = findD(big, c2);
  const E1 = findEF(c1, D1, A), F1 = findEF(c1, D1, Cpt);
  const E2 = findEF(c2, D2, Cpt), F2 = findEF(c2, D2, B);
  const K1 = mid(E1, F1), K2 = mid(E2, F2);
  const rho = dist(E1, F1) / 2;
  const k1 = { c: K1, r: rho }, k2 = { c: K2, r: rho };
  const G1 = findEF(k1, E1, D1), H1 = findEF(k1, F1, D1);
  const G2 = findEF(k2, E2, D2), H2 = findEF(k2, F2, D2);
  return {
    O: O, O1: O1, O2: O2, big: big, c1: c1, c2: c2,
    D1: D1, D2: D2, E1: E1, E2: E2, F1: F1, F2: F2,
    K1: K1, K2: K2, G1: G1, H1: H1, G2: G2, H2: H2, rho: rho,
  };
}

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("a new drawing has the three draggable points",
    [s.A, s.B, s.C].every((p) => p && Number.isFinite(p.x) && p.y === C.BASE_Y));
  check("the applet starts at A=20, B=380", s.A.x === 20 && s.B.x === 380);
  check("C starts at 0.3*A + 0.7*B", near(s.C.x, 0.3 * s.A.x + 0.7 * s.B.x, 1e-12));
  check("the three show options start as names only",
    s.options.names === true && s.options.proposition === false && s.options.hint === false);
  check("an illustration has no result", C.result(s) === null);
  check("the legal handles are exactly A, B and C",
    JSON.stringify(C.legalMoves(s)) === JSON.stringify(["A", "B", "C"]));

  const moved = C.move(s, "C", P(190, 90));
  check("dragging C changes it but keeps it on the baseline",
    moved.C.x === 190 && moved.C.y === C.BASE_Y && !s.explored && moved.explored);
  check("dragging C left of A is stopped by the gap",
    C.move(s, "C", P(-500, 0)).C.x === s.A.x + C.GAP + 1);
  check("dragging C right of B is stopped by the gap",
    C.move(s, "C", P(9999, 0)).C.x === s.B.x - C.GAP - 1);
  check("dragging A past C is stopped by the gap",
    C.move(s, "A", P(9999, 0)).A.x === s.C.x - C.GAP - 1);
  check("dragging B past the edge is stopped",
    C.move(s, "B", P(9999, 0)).B.x === C.VIEW.width - C.GAP - 1);
  check("an unknown handle is refused", C.move(s, "Z", P(1, 1)) === s);
  check("a non-finite drag is refused", C.move(s, "C", P(NaN, 1)) === s);

  const ticked = C.setOption(s, "proposition", true);
  check("toggling an option keeps the old state immutable",
    ticked.options.proposition && !s.options.proposition);
  check("reset keeps the chosen options", C.reset(ticked).options.proposition === true);
  check("reset restores the starting C", C.reset(moved).C.x === s.C.x);
}

/* --------------------------------- 2. the article's claims, over 2880 cases */

const cases = [];
for (const ax of [20, 45, 90]) {
  for (const bx of [320, 360, 380]) {
    for (let i = 0; i < 240; i++) {
      const f = 0.02 + i * 0.96 / 239;
      const cx = ax + (bx - ax) * f;
      cases.push({ A: P(ax, C.BASE_Y), B: P(bx, C.BASE_Y), C: P(cx, C.BASE_Y) });
    }
  }
}

let live = 0, finite = 0, sums = 0, parallel = 0, radius = 0, twinLength = 0;
let dOnCircle = 0, dBisects = 0, equidistant = 0, pythagoras = 0;
let chords = 0, chordSum = 0, areas = 0, areaRatio = 0, bounded = 0;
let agree = 0, comparable = 0, degenerate = 0;
let claimErr = 0, appletErr = 0;

for (const pos of cases) {
  const g = C.geometry(pos);
  const x = appletCompute(pos.A, pos.B, pos.C);
  if (!g) continue;
  live++;
  const e = (a, b) => { claimErr = max(claimErr, Math.abs(a - b)); return near(a, b); };

  const vals = [g.r1, g.r2, g.R, g.rho, g.k1o, g.k2o, g.span1, g.span2];
  const pts = [g.D1, g.D2, g.E1, g.E2, g.F1, g.F2, g.K1, g.K2, g.G1, g.G2, g.H1, g.H2];
  if (vals.every(Number.isFinite) && pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) finite++;

  if (e(g.r1 + g.r2, g.R)) sums++;
  if (e(g.E1.y - g.F1.y, 0) && e(g.E2.y - g.F2.y, 0)) parallel++;
  if (e(g.rho, g.r1 * g.r2 / (g.r1 + g.r2)) && e(g.rho, x.rho)) radius++;
  if (e(dist(g.E1, g.F1), 2 * g.rho) && e(dist(g.E2, g.F2), 2 * g.rho)) twinLength++;
  if (e(dist(g.O, g.D1), g.R) && e(dist(g.O, g.D2), g.R)) dOnCircle++;
  if (e(dist(g.D1, pos.A), dist(g.D1, pos.C)) && e(dist(g.D2, pos.C), dist(g.D2, pos.B))) dBisects++;
  if (e(g.k1o, g.k2o)) equidistant++;
  const pyth = g.R * g.R - g.r1 * g.r2 * (2 * g.r1 + g.r2) * (g.r1 + 2 * g.r2) / (g.R * g.R);
  if (e(g.k1o * g.k1o, pyth) && e(g.k2o * g.k2o, pyth)) pythagoras++;
  if (e(g.span1, 2 * g.rho * g.rho / g.r1) && e(g.span2, 2 * g.rho * g.rho / g.r2)) chords++;
  if (e(g.span1 + g.span2, 2 * g.rho)) chordSum++;
  if (e(g.arbelosArea, Math.PI * g.r1 * g.r2) && e(g.twinArea, Math.PI * g.rho * g.rho)) areas++;
  if (e(g.arbelosArea / g.twinArea, g.R * g.R / (g.r1 * g.r2))) areaRatio++;
  if (g.rho <= g.R / 4 + 1e-9) bounded++;

  /* The applet's FindEF picks by "at least one unit from the vertex".  For a
   * semicircle of radius below about six, E or F itself is under a unit away,
   * so that shortcut returns the vertex instead of the far intersection. */
  if (g.r1 >= 6 && g.r2 >= 6) {
    comparable++;
    const names = ["O", "O1", "O2", "D1", "D2", "E1", "E2", "F1", "F2",
                   "K1", "K2", "G1", "G2", "H1", "H2"];
    const worst = max(...names.map((n) => dist(g[n], x[n])), Math.abs(g.rho - x.rho));
    appletErr = max(appletErr, worst);
    if (worst < 1e-6) agree++;
  } else {
    degenerate++;
  }
}

{
  check(`all ${cases.length} configurations produce a drawing`, live === cases.length, `${live}/${cases.length}`);
  check("every computed coordinate and length is finite", finite === live, `${finite}/${live}`);
  check("r1 + r2 equals the big radius", sums === live, `${sums}/${live}`);
  check("E1F1 and E2F2 stay parallel to the baseline", parallel === live, `${parallel}/${live}`);
  check("both new circles have radius r1*r2/(r1+r2)", radius === live, `${radius}/${live}`);
  check("E1F1 and E2F2 are both diameters of length 2r", twinLength === live, `${twinLength}/${live}`);
  check("D1 and D2 lie on the big circle", dOnCircle === live, `${dOnCircle}/${live}`);
  check("D1 and D2 lie on the perpendicular bisectors", dBisects === live, `${dBisects}/${live}`);
  check("K1O = K2O", equidistant === live, `${equidistant}/${live}`);
  check("K1O² matches the page's Pythagorean formula", pythagoras === live, `${pythagoras}/${live}`);
  check("G1H1 = 2r²/r1 and G2H2 = 2r²/r2", chords === live, `${chords}/${live}`);
  check("G1H1 + G2H2 = 2r", chordSum === live, `${chordSum}/${live}`);
  check("arbelos area = πr1r2 and twin area = πr²", areas === live, `${areas}/${live}`);
  check("arbelos area / twin area = R²/(r1r2)", areaRatio === live, `${areaRatio}/${live}`);
  check("the twin radius never exceeds R/4", bounded === live, `${bounded}/${live}`);
  check(`the article's claims hold to ${claimErr.toExponential(1)}`, claimErr < 1e-6);
  check(`core matches the applet's Compute() on all ${comparable} usable cases`,
    agree === comparable && comparable > 2000, `${agree}/${comparable}`);
  check(`the second transcription agrees to ${appletErr.toExponential(1)}`, appletErr < 1e-6);
  check(`the tiny-semicircle cases (${degenerate}) still satisfy the claims`,
    degenerate > 0 && chords === live && chordSum === live);
}

/* ------------------------------------- 3. status text and a changed drawing */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("the status speaks the radius and the equal distances",
    /radius 37\.8/.test(C.describe(s)) && /from O/.test(C.describe(s)));
  const moved = C.move(s, "C", P(100, 200));
  check("moving C changes r1 and r2", C.geometry(moved).r1 !== g.r1 && C.geometry(moved).r2 !== g.r2);
  check("the moved drawing still has radius r1r2/R",
    near(C.geometry(moved).rho,
         C.geometry(moved).r1 * C.geometry(moved).r2 / C.geometry(moved).R));
  check("the status changes with the drawing", C.describe(moved) !== C.describe(s));
}

done("arbelos-bui");
