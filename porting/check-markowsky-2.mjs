#!/usr/bin/env node
"use strict";

/*
 * Logic test for markowsky-2/markowsky-2-core.js.
 *
 *   node porting/check-markowsky-2.mjs
 *
 * The page asks us to prove two things about three points A, B, C on a
 * parabola: M_A lies on PQ, M_B on PR and M_C on QR; and PQ, PR, QR are
 * parallel to the tangents at A, B, C. Section 2 checks both claims over a
 * grid of tens of thousands of parameter triples and thousands of random
 * ones, using exact (unrounded) coordinates derived independently of the
 * applet's code.
 *
 * Section 3 is a second, literal transcription of the applet's own
 * ComputeWhatNot, ComputeTangent1/2/3, Parabola, Compute and
 * GeoSDoub.Intersect from the bytecode. It is compared point by point with
 * the core over the slider grid, random settings, adjacent slider values and
 * the parallel cases where Intersect returns NaN. Section 4 measures how far
 * the applet's whole-pixel y values move its answer away from the exact
 * theorem, and reports that honestly instead of hiding it.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("markowsky-2/markowsky-2-core.js", "Markowsky2Core");
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const nearPoint = (p, q, tol) => !!p && !!q &&
  near(p.x, q.x, tol) && near(p.y, q.y, tol);

/* ------------------------------------------------------------ 1. the setup */

{
  equal("the applet's archived board size", [C.DEFAULT_WIDTH, C.DEFAULT_HEIGHT], [560, 500]);
  equal("the applet's fields", [C.A, C.DT, C.DH, C.TANGENT_STEP], [40, 2, 40, 50]);
  equal("the scrollbar range", [C.MIN_T, C.MAX_T], [-250, 260]);
  equal("the three starting scrollbar values", C.INITIAL_T, { A: 80, B: 180, C: 10 });
  equal("only names and tangents have checkboxes", C.OPTION_NAMES, ["names", "tangents"]);

  const s = C.start({});
  equal("a fresh diagram starts with the applet's parameters", s.t, { A: 80, B: 180, C: 10 });
  equal("both overlays start unchecked", s.options, { names: false, tangents: false });
  check("an illustration cannot be won or lost",
    C.result(s) === null && C.result(C.setT(s, "A", 0)) === null);

  // Parabola(t) uses Java int division twice: (t*t)/4, then /a.
  equal("Parabola truncates at each integer division",
    [0, 1, 10, 80, 180, -250, 260].map(C.parabola),
    [0, 0, 0, 40, 202, 390, 422]);
  check("Compute(height, t) subtracts a, the parabola and Dh",
    C.computeY(500, 80) === 380 && C.computeY(500, 180) === 218 &&
    C.computeY(500, 10) === 420);

  const moved = C.setT(s, "B", 42);
  check("moving a scrollbar keeps the other two and does not change the old state",
    moved.t.A === 80 && moved.t.C === 10 && s.t.B === 180);
  check("scrollbars clamp to the applet's range and round to integers",
    C.setT(s, "A", -999).t.A === -250 && C.setT(s, "A", 9999).t.A === 260 &&
    C.setT(s, "A", 12.7).t.A === 13);
  check("an unknown scrollbar or checkbox is ignored",
    C.setT(s, "Z", 9) === s && C.setOption(s, "hint", true) === s);
  const shownNames = C.setOption(moved, "names", true);
  check("a checkbox changes only the option",
    shownNames.options.names && !shownNames.options.tangents &&
    shownNames.t.B === 42 && moved.options.names === false);
  const reset = C.reset(shownNames);
  check("Reset restores the three scrollbars and keeps the overlays",
    reset.t.A === 80 && reset.t.B === 180 && reset.t.C === 10 &&
    reset.options.names === true && reset.options.tangents === false);

  // ComputeWhatNot returns before touching any field when two sliders agree.
  const valid = C.compute(s, null);
  const paused = C.compute(C.setT(s, "B", 80), valid);
  check("equal slider values leave the last drawing in place",
    paused.blocked && paused.valid && paused.points.P === valid.points.P);
  const fresh = C.compute(C.start({ tA: 7, tB: 7, tC: 7 }), null);
  check("a first frame with equal values has nothing drawn", !fresh.valid && fresh.blocked);
  const basic = C.compute(s, null);
  check("a valid frame has all fifteen named points",
    Object.keys(basic.points).length === 15 && basic.parabolaPoints.length > 100);
  check("A', B', C' keep y = 20 while sharing x with A, B, C",
    basic.points.A1.y === 20 && basic.points.A1.x === basic.points.A.x &&
    basic.points.B1.y === 20 && basic.points.C1.y === 20);
  check("the three tangent endpoints are 50 units to the right",
    nearPoint({ x: basic.points.AT.x, y: basic.points.AT.y },
      { x: basic.points.A.x + 50, y: basic.points.A.y - 50 * (80 / 80) }, 1e-9));
}

/* ---------------------------- 2. the two claims on the page, independently -- */

/**
 * The exact parabola through the vertex (0, 0) in local coordinates:
 * y = -t²/(4a). Chord AB meets the vertical x = r at
 * (tA*tB - (tA+tB)*r)/(4a); tangent at t is -t*x/(2a) + t²/(4a). None of
 * this uses the core or the applet's intersection routine.
 */
const EXACT = (() => {
  const exact = (t, height) => ({ x: 280 + t, y: height - 80 - (t * t) / 160 });
  const chordY = (t1, t2, x, height) =>
    height - 80 + (t1 * t2 - (t1 + t2) * x) / 160;
  const tangentY = (t, x, height) => height - 80 - (t * x) / 80 + (t * t) / 160;
  function diagram(tA, tB, tC, height) {
    const P = { x: 280 + tC, y: chordY(tA, tB, tC, height) };
    const Q = { x: 280 + tB, y: chordY(tC, tA, tB, height) };
    const R = { x: 280 + tA, y: chordY(tB, tC, tA, height) };
    const MA = { x: 280 + (tB + tC) / 2, y: height - 80 - (tB * tC) / 160 };
    const MB = { x: 280 + (tC + tA) / 2, y: height - 80 - (tC * tA) / 160 };
    const MC = { x: 280 + (tA + tB) / 2, y: height - 80 - (tA * tB) / 160 };
    return { P, Q, R, MA, MB, MC, exact, tangentY };
  }
  const cross = (u, v, w) =>
    (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
  const distance = (u, v, w) =>
    Math.abs(cross(u, v, w)) / Math.hypot(v.x - u.x, v.y - u.y);
  const slope = (p, q) => (q.y - p.y) / (q.x - p.x);
  return { diagram, distance, slope };
})();

{
  const random = rng(20261128);
  let cases = 0;
  let collinear = true, parallel = true, pointsAgree = true, tangentMeet = true;
  let worstCollinear = 0, worstParallel = 0;

  function examine(tA, tB, tC) {
    const height = 500;
    const d = EXACT.diagram(tA, tB, tC, height);
    cases++;
    const c = Math.max(
      EXACT.distance(d.P, d.Q, d.MA),
      EXACT.distance(d.P, d.R, d.MB),
      EXACT.distance(d.Q, d.R, d.MC),
    );
    const slopeError = Math.max(
      Math.abs(EXACT.slope(d.P, d.Q) + tA / 80),
      Math.abs(EXACT.slope(d.P, d.R) + tB / 80),
      Math.abs(EXACT.slope(d.Q, d.R) + tC / 80),
    );
    worstCollinear = Math.max(worstCollinear, c);
    worstParallel = Math.max(worstParallel, slopeError);
    collinear = collinear && c < 1e-9;
    parallel = parallel && slopeError < 1e-9;
    // Each M is also the intersection of the two tangents, computed directly.
    tangentMeet = tangentMeet &&
      near(d.MA.y, d.tangentY(tB, d.MA.x - 280, height), 1e-9) &&
      near(d.MA.y, d.tangentY(tC, d.MA.x - 280, height), 1e-9) &&
      near(d.MB.y, d.tangentY(tC, d.MB.x - 280, height), 1e-9) &&
      near(d.MC.y, d.tangentY(tA, d.MC.x - 280, height), 1e-9);
    // The P, Q, R formulas must also be the intersections shown in the applet.
    // With two parameters one unit apart the pixel rounding is amplified, so
    // compare the well-separated settings here; section 4 measures the rest.
    // Outside the two parameters a chord is extrapolated, which magnifies a
    // one-pixel rounding; compare only where the vertical meets the segment.
    const between = (u, v, w) => (u > v && u < w) || (u > w && u < v);
    const s = C.start({ tA, tB, tC });
    const core = C.compute(s, null);
    if (Math.abs(tA - tB) >= 10 && between(tC, tA, tB)) {
      pointsAgree = pointsAgree &&
        (!C.finite(core.points.P) || nearPoint(core.points.P, d.P, 2));
    }
    if (Math.abs(tC - tA) >= 10 && between(tB, tC, tA)) {
      pointsAgree = pointsAgree &&
        (!C.finite(core.points.Q) || nearPoint(core.points.Q, d.Q, 2));
    }
    if (Math.abs(tB - tC) >= 10 && between(tA, tB, tC)) {
      pointsAgree = pointsAgree &&
        (!C.finite(core.points.R) || nearPoint(core.points.R, d.R, 2));
    }
  }

  for (let tA = -250; tA <= 260; tA += 15) {
    for (let tB = -250; tB <= 260; tB += 15) {
      for (let tC = -250; tC <= 260; tC += 15) {
        if (tA === tB || tB === tC || tC === tA) continue;
        examine(tA, tB, tC);
      }
    }
  }
  for (let i = 0; i < 3000; i++) {
    const t = () => Math.floor(random() * 511) - 250;
    const tA = t(), tB = t(), tC = t();
    if (tA === tB || tB === tC || tC === tA) continue;
    examine(tA, tB, tC);
  }
  check("the exact claims were tried on tens of thousands of triples", cases > 20000);
  check("M_A, M_B and M_C lie on PQ, PR and QR exactly", collinear);
  check("PQ, PR and QR are parallel to the tangents at A, B and C", parallel);
  check("the worst exact collinearity deviation is below 1e-9", worstCollinear < 1e-9);
  check("the worst exact slope deviation is below 1e-9", worstParallel < 1e-9);
  check("each M really is the meeting point of the two tangents", tangentMeet);
  check("for separated parameters P, Q and R match the applet within two pixels",
    pointsAgree);
}

/* ------------------ 3. a second transcription straight from the bytecode -- */

const A = {
  parabola(t) {
    // public int Parabola(int): iload_1 * iload_1 / 4 / a.
    const product = t * t;
    return Math.trunc(Math.trunc(product / 4) / 40);
  },
  computeY(height, t) {
    // private int Compute(int, int): height - a - Parabola(t) - Dh.
    return height - 40 - this.parabola(t) - 40;
  },
  point(t, width, height) {
    return { x: Math.trunc(width / 2) + t, y: this.computeY(height, t) };
  },
  tangent(t, width, height, point) {
    // ComputeTangent1/2/3: cx + t + 50 and point.y - 50 * t/(2*a).
    const slope = t / (2.0 * 40);
    return {
      p: { x: point.x, y: point.y },
      q: { x: Math.trunc(width / 2) + t + 50, y: point.y - 50 * slope },
    };
  },
  intersect(p, q, r, s) {
    // GeoSDoub.Intersect: local slots 4..20 and the |den| < 1 test.
    const a1 = p.y - q.y;
    const b1 = q.x - p.x;
    const c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y;
    const b2 = s.x - r.x;
    const c2 = r.x * s.y - r.y * s.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
  },
  whatNot(s) {
    const { width, height, t } = s;
    if (Math.abs(t.A - t.B) < 0.1 || Math.abs(t.B - t.C) < 0.1 ||
        Math.abs(t.C - t.A) < 0.1) return { blocked: true, points: {} };
    const aPoint = this.point(t.A, width, height);
    const bPoint = this.point(t.B, width, height);
    const cPoint = this.point(t.C, width, height);
    const aFoot = { x: aPoint.x, y: 20 };
    const bFoot = { x: bPoint.x, y: 20 };
    const cFoot = { x: cPoint.x, y: 20 };
    const tangentA = this.tangent(t.A, width, height, aPoint);
    const tangentB = this.tangent(t.B, width, height, bPoint);
    const tangentC = this.tangent(t.C, width, height, cPoint);
    return {
      blocked: false,
      points: {
        A: aPoint, B: bPoint, C: cPoint,
        A1: aFoot, B1: bFoot, C1: cFoot,
        AT: tangentA.q, BT: tangentB.q, CT: tangentC.q,
        P: this.intersect(aPoint, bPoint, cPoint, cFoot),
        Q: this.intersect(cPoint, aPoint, bPoint, bFoot),
        R: this.intersect(bPoint, cPoint, aPoint, aFoot),
        MA: this.intersect(bPoint, tangentB.q, cPoint, tangentC.q),
        MB: this.intersect(cPoint, tangentC.q, aPoint, tangentA.q),
        MC: this.intersect(aPoint, tangentA.q, bPoint, tangentB.q),
      },
    };
  },
};

function samePoints(mine, theirs) {
  const names = Object.keys(theirs.points);
  if (mine.blocked !== theirs.blocked) return false;
  if (Object.keys(mine.points).length !== names.length) return false;
  for (const name of names) {
    const p = mine.points[name], q = theirs.points[name];
    if (!C.finite(p) && !C.finite(q)) continue; // both are Intersect's NaN point
    if (!nearPoint(p, q, 1e-9)) return false;
  }
  return true;
}

{
  let cases = 0, agree = true, nanCases = 0;
  for (let tA = C.MIN_T; tA <= C.MAX_T; tA += 20) {
    for (let tB = C.MIN_T; tB <= C.MAX_T; tB += 20) {
      for (let tC = C.MIN_T; tC <= C.MAX_T; tC += 20) {
        if (tA === tB || tB === tC || tC === tA) continue;
        const s = C.start({ tA, tB, tC });
        const mine = C.compute(s, null), theirs = A.whatNot(s);
        cases++;
        agree = agree && samePoints(mine, theirs);
        if (!C.finite(mine.points.MA)) nanCases++;
      }
    }
  }
  check("the slider grid has thousands of distinct triples", cases > 15000);
  check("the core matches the literal bytecode transcription everywhere", agree);

  // Adjacent slider values and the extreme ends, where the determinant is
  // small enough that Intersect returns NaN.
  let edgeCases = 0, edgeAgree = true;
  for (let tA = C.MIN_T; tA <= C.MAX_T; tA++) {
    const tB = tA === C.MAX_T ? C.MIN_T : tA + 1;
    for (const tC of [C.MIN_T, -10, 0, 10, C.MAX_T]) {
      if (tB === tC || tC === tA) continue;
      const s = C.start({ tA, tB, tC });
      const mine = C.compute(s, null), theirs = A.whatNot(s);
      edgeCases++;
      edgeAgree = edgeAgree && samePoints(mine, theirs);
      if (!C.finite(mine.points.MA)) nanCases++;
    }
  }
  check("every adjacent slider pair was compared too", edgeCases > 2000);
  check("adjacent and extreme values agree with the bytecode", edgeAgree);
  for (const triple of [[-250, 253, -249], [-249, 253, -248], [250, -253, 249]]) {
    const s = C.start({ tA: triple[0], tB: triple[1], tC: triple[2] });
    const mine = C.compute(s, null), theirs = A.whatNot(s);
    nanCases += Object.keys(mine.points).some((k) => !C.finite(mine.points[k])) ? 1 : 0;
    edgeAgree = edgeAgree && samePoints(mine, theirs);
  }
  check("the parallel/NaN branch of Intersect was exercised", nanCases > 0);
  check("the NaN cases agree with the bytecode too", edgeAgree);

  const random = rng(77123);
  let randomAgree = true;
  for (let i = 0; i < 2500; i++) {
    const t = () => C.MIN_T + Math.floor(random() * (C.MAX_T - C.MIN_T + 1));
    const s = C.start({ tA: t(), tB: t(), tC: t(), width: 400 + Math.floor(random() * 400) });
    randomAgree = randomAgree && samePoints(C.compute(s, null), A.whatNot(s));
  }
  check("2500 random boards agree with the bytecode", randomAgree);

  for (const pair of [[7, 7], [7, 7.02], [7, -7]]) {
    const [u, v] = pair;
    const s = C.start({ tA: u, tB: v, tC: 42 });
    const mine = C.compute(s, A.whatNot(C.start({ tA: 1, tB: 2, tC: 3 })));
    check("the 0.1 guard agrees at " + u + ", " + v,
      mine.blocked === A.whatNot(s).blocked);
  }
}

/* ------------- 4. what the whole-pixel y values do to the page's theorem -- */

{
  let cases = 0, underTwo = 0;
  let worst = 0, worstSlope = 0, worstWide = 0, wide = 0;
  for (let tA = C.MIN_T; tA <= C.MAX_T; tA += 10) {
    for (let tB = C.MIN_T; tB <= C.MAX_T; tB += 10) {
      for (let tC = C.MIN_T; tC <= C.MAX_T; tC += 10) {
        if (tA === tB || tB === tC || tC === tA) continue;
        const g = C.compute(C.start({ tA, tB, tC }), null);
        const { P, Q, R, MA, MB, MC } = g.points;
        if (![P, Q, R, MA, MB, MC].every(C.finite)) continue;
        cases++;
        const d = EXACT.distance;
        const error = Math.max(d(P, Q, MA), d(P, R, MB), d(Q, R, MC));
        const slopes = Math.max(
          Math.abs(EXACT.slope(P, Q) + tA / 80),
          Math.abs(EXACT.slope(P, R) + tB / 80),
          Math.abs(EXACT.slope(Q, R) + tC / 80),
        );
        worst = Math.max(worst, error);
        worstSlope = Math.max(worstSlope, slopes);
        if (error < 2) underTwo++;
        if (Math.min(Math.abs(tA - tB), Math.abs(tB - tC), Math.abs(tC - tA)) >= 50) {
          wide++;
          worstWide = Math.max(worstWide, error);
        }
      }
    }
  }
  check("the whole range was measured at step 10", cases > 130000);
  check("under the applet's pixel rounding 87% of cases stay within 2 units",
    underTwo / cases > 0.86);
  check("the worst rounded collinearity error stays below 20 board units", worst < 20);
  check("the worst rounded slope error stays below 0.2", worstSlope < 0.2);
  check("well-separated points stay within 4 units", wide > 50000 && worstWide < 4);

  const saved = C.position(C.start({}), C.compute(C.start({}), null));
  check("the saved position is plain board data for the tutor",
    saved.width === 560 && saved.height === 500 && saved.t.A === 80 &&
    Object.keys(saved.points).length === 15 && saved.parabolaPoints.length > 100 &&
    saved.options.names === false);
  check("saving a position does not change the state", C.start({}).t.B === 180);
}

done("markowsky-2");
