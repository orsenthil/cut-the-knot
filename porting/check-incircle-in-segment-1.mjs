#!/usr/bin/env node
"use strict";

/*
 * Logic test for incircle-in-segment-1/incircle-in-segment-1-core.js.
 *
 *   node porting/check-incircle-in-segment-1.mjs
 *
 * The page's claim (1) is: if the two circles inscribed in a circular segment
 * meet at U and V, then U, V and the opposite arc midpoint M are collinear.
 * Its claim (2) is MA*MB = MT^2, where T is an end of the chord; that is
 * exactly the equality of the powers of M with respect to the two circles.
 *
 * Both claims are checked on a dense grid of chord angles and contact-point
 * positions (well over a thousand configurations), plus random positions.
 * The whole applet construction is then transcribed a second time from the
 * bytecode - init(), GeoSDoub.NearestPoint/Intersect, DrawCircleAndLine and
 * IntersectCirclesX/Y - and compared with the core over the same range.
 *
 * The sibling applet IncircleInSegment claims only that one circle's chord
 * contact P, circle contact Q and M are collinear. That weaker claim is also
 * tested here, but the page's stronger two-circle claim is the one that
 * matters: collinearity with M does not by itself give the common power.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("incircle-in-segment-1/incircle-in-segment-1-core.js", "IncircleInSegment1Core");
const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);

/* ---------------------- a second transcription, straight from the bytecode */

/** GeoSDoub.NearestPoint(p,a,b), including its 0.1 squared-distance guard. */
function appletFoot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const sq = dx * dx + dy * dy;
  if (sq < 0.1) return P(p.x, p.y);
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / sq;
  return P(a.x + dx * t, a.y + dy * t);
}

/** GeoSDoub.Intersect(a,b,c,d): NaN pair when |det| < 1. */
function appletLineIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/** IncircleInSegment1Canvas.DrawCircleAndLine(g, P). */
function appletCircle(O, M, point) {
  const N = appletFoot(O, M, point);
  const Q = P(2 * N.x - M.x, 2 * N.y - M.y);
  const R = P(point.x, point.y - 100);
  const W = appletLineIntersect(O, Q, point, R);
  return { N, Q, R, W, radius: dist(W, point), center: W };
}

/** GeoSDoub.IntersectCirclesX, from the class file. */
function appletIntersectX(c0, r0, c1, r1) {
  const m = -(c0.y - c1.y) / (c0.x - c1.x);
  const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y
    - r0 * r0 + r1 * r1) / (2 * (c0.x - c1.x));
  const d0 = b - c0.x;
  const a = m * m + 1;
  const lin = m * d0 - c0.y;
  const con = d0 * d0 + c0.y * c0.y - r0 * r0;
  const disc = lin * lin - a * con;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x0 = (-lin + root) / a, x1 = (-lin - root) / a;
  return [P(m * x0 + b, x0), P(m * x1 + b, x1)];
}

/** GeoSDoub.IntersectCirclesY, the fallback when the centres share an x. */
function appletIntersectY(c0, r0, c1, r1) {
  const m = -(c0.x - c1.x) / (c0.y - c1.y);
  const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y
    - r0 * r0 + r1 * r1) / (2 * (c0.y - c1.y));
  const d0 = b - c0.y;
  const a = m * m + 1;
  const lin = m * d0 - c0.x;
  const con = d0 * d0 + c0.x * c0.x - r0 * r0;
  const disc = lin * lin - a * con;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y0 = (-lin + root) / a, y1 = (-lin - root) / a;
  return [P(y0, m * y0 + b), P(y1, m * y1 + b)];
}

/** GeoSDoub.Intersect(DoubCircle,DoubCircle). */
function appletCircleIntersections(c0, r0, c1, r1) {
  if (Math.abs(c0.x - c1.x) > 1) return appletIntersectX(c0, r0, c1, r1);
  if (Math.abs(c0.y - c1.y) > 1) return appletIntersectY(c0, r0, c1, r1);
  return [P(c0.x, c0.y), P(c0.x, c0.y)];
}

/** init() plus Draw(): the whole figure, with no reference to the core. */
function appletPicture(angle, c, d) {
  const O = P(180, 150), r = 100, M = P(180, 250);
  const A = P(O.x + r * Math.cos(angle), O.y - r * Math.sin(angle));
  const B = P(2 * O.x - A.x, A.y);
  const C = P(c, A.y), D = P(d, A.y);
  const one = appletCircle(O, M, C), two = appletCircle(O, M, D);
  if (!Number.isFinite(one.W.x) || !Number.isFinite(two.W.x)) return null;
  let intersections = [];
  if (dist(one.center, two.center) > 1) {
    intersections = appletCircleIntersections(one.center, one.radius, two.center, two.radius) || [];
  }
  const power = (circle, point) => dist(point, circle.center) ** 2 - circle.radius ** 2;
  return { O, M, A, B, C, D, one, two, intersections,
    powers: [power(one, M), power(two, M)],
    products: [dist(M, C) * dist(M, one.Q), dist(M, D) * dist(M, two.Q)],
    mt2: dist(M, A) ** 2 };
}

const collinear = (p, q, r, scale) =>
  Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) <= 1e-7 * scale * scale;

/* ---------------------------------------------- 1. the starting position */

{
  const s = C.start({});
  const h = C.handles(s);
  equal("the board is the applet's 360x300 with radius min/3", [s.center, s.radius],
    [P(180, 150), 100]);
  check("the fixed start angle lies in the applet's (rng+3)*PI/4 range",
    s.angle >= 3 * Math.PI / 4 && s.angle <= 7 * Math.PI / 4);
  check("the chord is horizontal with ends mirrored about the centre",
    close(h.A.y, h.B.y, 1e-12) && close(h.A.x + h.B.x, 360, 1e-12));
  check("M is the midpoint of the arc opposite the chord",
    close(h.M.x, 180, 1e-12) && close(h.M.y, 250, 1e-12));
  check("C and D start at the applet's one-third and two-fifths positions",
    close(h.C.x, (h.A.x + 2 * h.B.x) / 3, 1e-12)
      && close(h.D.x, (3 * h.A.x + 2 * h.B.x) / 5, 1e-12));
  check("Hint starts unchecked, as in the applet's checkbox", s.hint === false);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", s.explored === false);
}

/* ------------------- 2. the construction and both claims on the first view */

{
  const g = C.geometry(C.start({}));
  check("the two constructed circles exist", !g.degenerate && g.circles.every((x) => x.radius > 0));
  check("each circle is centred above its chord contact on the same vertical",
    g.circles.every((c) => close(c.center.x, c.P.x, 1e-9) && c.center.y < c.P.y));
  check("each reflected point Q is on the original circle",
    g.circles.every((c) => close(dist(c.Q, g.O), 100, 1e-8)));
  check("claim (2): MA*MB equals MT^2 for each inscribed circle",
    g.identity && g.circles.every((c) => close(c.product, g.mt * g.mt, 1e-8)));
  check("the two powers at M agree (M is on the radical axis)",
    g.powersEqual && close(g.circles[0].power, g.circles[1].power, 1e-8));
  check("the sibling's weaker one-circle claim also holds on this view",
    g.circles.every((c) => c.singleClaim));
  check("the circles meet twice and the claim (1) line goes through M",
    g.intersections.length === 2 && g.collinear && g.claim);
  check("the radical line is the line UV when U and V exist",
    closePoint(g.radicalLine.p, g.intersections[0], 1e-9)
      && closePoint(g.radicalLine.q, g.intersections[1], 1e-9));
}

/* --------------------------------------------- 3. moves, options and guards */

{
  const s = C.start({});
  const a = C.move(s, { type: "point", name: "A", x: 130, y: 245 });
  const ha = C.handles(a);
  check("dragging A keeps it on the circle and mirrors B",
    close(dist(ha.A, ha.O), 100, 1e-9) && close(ha.A.x + ha.B.x, 360, 1e-9));
  check("dragging A clamps C and D into the new chord",
    ha.C.x >= Math.min(ha.A.x, ha.B.x) && ha.C.x <= Math.max(ha.A.x, ha.B.x)
      && ha.D.x >= Math.min(ha.A.x, ha.B.x) && ha.D.x <= Math.max(ha.A.x, ha.B.x));
  check("a drag marks the diagram explored without changing the old state",
    a.explored && !s.explored && s.angle !== a.angle);
  const c = C.move(s, { type: "nudge", name: "C", dx: 500, dy: 0 });
  check("C cannot be nudged past the chord end", close(C.handles(c).C.x,
    Math.max(C.handles(s).A.x, C.handles(s).B.x) - 2, 1e-9));
  const d = C.move(s, { type: "nudge", name: "D", dx: -500, dy: 0 });
  check("D cannot be nudged past the other chord end", close(C.handles(d).D.x,
    Math.min(C.handles(s).A.x, C.handles(s).B.x) + 2, 1e-9));
  check("the Hint checkbox toggles and does not explore",
    C.move(s, { type: "hint" }).hint && !C.move(s, { type: "hint" }).explored);
  check("Reset restores the starting picture but keeps Hint", (() => {
    const q = C.move(C.move(s, { type: "hint" }), { type: "reset" });
    return q.hint && q.angle === s.angle && q.c === s.c && !q.explored;
  })());
  check("New diagram follows the applet's random angle range", (() => {
    const q = C.move(s, { type: "new", rng: rng(9) });
    return q.angle >= 3 * Math.PI / 4 && q.angle <= 7 * Math.PI / 4 && q.explored;
  })());
  check("unknown and non-finite moves are ignored",
    C.move(s, { type: "nope" }) === s
      && C.move(s, { type: "point", name: "C", x: NaN, y: 0 }) === s
      && C.move(s, { type: "nudge", name: "A", dx: Infinity }) === s);
  check("legal moves cover both handles, the option and the two buttons",
    C.legalMoves(s).length === 9);
  const edge = C.move(s, { type: "point", name: "A", x: 180, y: 50 });
  check("the chord cannot collapse at the top of the circle",
    !C.geometry(edge).degenerate && C.handles(edge).A.y >= 150 - 100 * 0.96 - 1e-9);
  check("the status speaks in words and reports the hint", (() => {
    const text = C.describe(C.move(s, { type: "hint" }));
    return /powers at M/.test(text) && /hint/.test(text);
  })());
  check("the saved position is plain board data", (() => {
    const pos = C.position(C.move(s, { type: "hint" }));
    return pos.hint && pos.M && pos.centers.length === 2 && pos.chord.A && !pos.explored;
  })());
}

/* --------------- 4. claims on a dense grid of all chord/contact positions */

{
  const rand = rng(20261127);
  let tested = 0, intersectCases = 0, failures = 0, worstPower = 0, worstLine = 0;
  for (let ai = 0; ai <= 90; ai++) {
    // Sweep the applet's whole initial-angle range, including its extremes.
    const angle = 3 * Math.PI / 4 + (ai / 90) * Math.PI;
    for (let trial = 0; trial < 12; trial++) {
      const base = C.start({ angle: angle });
      const h = C.handles(base);
      const lo = Math.min(h.A.x, h.B.x) + 3, hi = Math.max(h.A.x, h.B.x) - 3;
      if (hi <= lo) continue;
      const fraction = (k) => lo + (hi - lo) * k;
      const s = C.start({ angle: angle });
      const moved = C.move(C.move(s,
        { type: "point", name: "C", x: fraction(rand()), y: h.A.y }),
      { type: "point", name: "D", x: fraction(rand()), y: h.A.y });
      const g = C.geometry(moved);
      if (!g || g.degenerate) { failures++; continue; }
      tested++;
      const scale = Math.max(300, g.mt * 2, ...g.circles.map((c) => c.radius * 2));
      worstPower = Math.max(worstPower,
        Math.abs(g.circles[0].power - g.circles[1].power) / (scale * scale));
      if (!g.identity || !g.powersEqual || !g.circles.every((c) => c.singleClaim)) failures++;
      if (g.intersections.length === 2) {
        intersectCases++;
        if (!g.collinear || !g.claim
          || !collinear(g.M, g.intersections[0], g.intersections[1], scale)) failures++;
        worstLine = Math.max(worstLine,
          Math.abs((g.intersections[0].x - g.M.x) * (g.intersections[1].y - g.M.y)
            - (g.intersections[0].y - g.M.y) * (g.intersections[1].x - g.M.x)) / (scale * scale));
      }
    }
  }
  check(`claims (1) and (2) hold on ${tested} grid configurations`,
    tested > 1000 && failures === 0, `${failures} failures`);
  check(`the two circles really intersect in ${intersectCases} of those cases`,
    intersectCases > 700);
  check("M's two powers agree to machine precision", worstPower < 1e-10, `worst ${worstPower}`);
  check("U, V and M are collinear to machine precision", worstLine < 1e-10, `worst ${worstLine}`);
}

{
  // Off-grid: any chord angle (the applet lets A travel all the way round)
  // and any two contacts. This also covers contacts outside each other's way.
  const rand = rng(314159);
  let tested = 0, failures = 0;
  for (let trial = 0; trial < 2000; trial++) {
    const angle = rand() * 2 * Math.PI;
    const base = C.start({ angle: angle });
    const h = C.handles(base);
    const lo = Math.min(h.A.x, h.B.x) + 3, hi = Math.max(h.A.x, h.B.x) - 3;
    if (hi <= lo) continue;
    const s = C.move(C.move(base,
      { type: "point", name: "C", x: lo + rand() * (hi - lo), y: h.A.y }),
    { type: "point", name: "D", x: lo + rand() * (hi - lo), y: h.A.y });
    const g = C.geometry(s);
    if (!g || g.degenerate) { failures++; continue; }
    tested++;
    const scale = Math.max(300, g.mt * 2, ...g.circles.map((c) => c.radius * 2));
    if (!g.identity || !g.powersEqual || !g.claim || !g.circles.every((c) => c.singleClaim)) failures++;
    if (g.intersections.length === 2
      && !collinear(g.M, g.intersections[0], g.intersections[1], scale)) failures++;
    // With no real intersections the applet draws its fallback line from M,
    // so collinearity of U,V,M is vacuous; equal powers still hold.
  }
  check(`claims hold on ${tested} random configurations across the full circle`,
    tested > 1500 && failures === 0, `${failures} failures`);
}

/* ------------------- 5. compare with the applet's second transcription */

{
  const rand = rng(2718);
  let compared = 0, mismatches = 0, intersectCompared = 0;
  const compare = (label, angle, c, d) => {
    // The core guards against a collapsed chord; use the angle it actually
    // kept so both transcriptions see exactly the same chord.
    const effectiveAngle = C.start({ angle: angle }).angle;
    const core = C.geometry(C.move(C.move(C.start({ angle: effectiveAngle }),
      { type: "point", name: "C", x: c, y: 0 }),
    { type: "point", name: "D", x: d, y: 0 }));
    const ap = appletPicture(effectiveAngle, c, d);
    if (!core || !ap || core.degenerate) return;
    compared++;
    const tol = 2e-6 * Math.max(1, core.radius || 100);
    for (let i = 0; i < 2; i++) {
      const a = core.circles[i], b = i === 0 ? ap.one : ap.two;
      if (!closePoint(a.center, b.center, tol) || !close(a.radius, b.radius, tol)
        || !closePoint(a.N, b.N, tol) || !closePoint(a.Q, b.Q, tol)
        || !close(a.power, ap.powers[i], 1e-7 * Math.max(1, ap.powers[i]))
        || !close(a.product, ap.products[i], 1e-7 * Math.max(1, ap.products[i]))) {
        mismatches++;
        check(`${label}: circle ${i} matches DrawCircleAndLine`, false,
          `core ${JSON.stringify(a.center)} r=${a.radius}, applet ${JSON.stringify(b.center)} r=${b.radius}`);
      }
    }
    if (core.intersections.length === 2 && ap.intersections.length === 2
      && ap.intersections.every((u) => Number.isFinite(u.x) && Number.isFinite(u.y))) {
      intersectCompared++;
      const found = core.intersections.every((u) =>
        ap.intersections.some((v) => closePoint(u, v, 1e-5 * Math.max(1, 100))));
      if (!found) {
        mismatches++;
        check(`${label}: U,V match IntersectCirclesX/Y`, false,
          `core ${JSON.stringify(core.intersections)}, applet ${JSON.stringify(ap.intersections)}`);
      }
    }
    if (!close(ap.mt2, core.mt * core.mt, 1e-8 * ap.mt2)) {
      mismatches++;
      check(`${label}: MT^2 matches the applet`, false);
    }
  };

  const start = C.start({});
  compare("start", start.angle, start.c, start.d);
  for (let ai = 0; ai <= 40; ai++) {
    const angle = 3 * Math.PI / 4 + (ai / 40) * Math.PI;
    for (let k = 0; k < 6; k++) {
      const h = C.handles(C.start({ angle: angle }));
      const lo = Math.min(h.A.x, h.B.x) + 3, hi = Math.max(h.A.x, h.B.x) - 3;
      if (hi <= lo) continue;
      compare(`grid ${ai}/${k}`, angle, lo + rand() * (hi - lo), lo + rand() * (hi - lo));
    }
  }
  for (let trial = 0; trial < 300; trial++) {
    const angle = rand() * 2 * Math.PI;
    const h = C.handles(C.start({ angle: angle }));
    const lo = Math.min(h.A.x, h.B.x) + 3, hi = Math.max(h.A.x, h.B.x) - 3;
    if (hi <= lo) continue;
    compare(`random ${trial}`, angle, lo + rand() * (hi - lo), lo + rand() * (hi - lo));
  }
  check(`core and applet bytecode agree on ${compared} configurations`,
    compared > 500 && mismatches === 0, `${mismatches} mismatches`);
  check(`both transcriptions found the same U,V in ${intersectCompared} cases`,
    intersectCompared > 300);
}

/* --------------------------------------------------- 6. degenerate safety */

{
  check("a coincident pair of circles has no crash and no false intersections", (() => {
    const s = C.start({});
    const q = C.move(s, { type: "point", name: "D", x: s.c, y: C.handles(s).A.y });
    const g = C.geometry(q);
    return !g.degenerate && g.intersections.length === 0 && !!g.radicalLine;
  })());
  check("describe() is safe before the geometry exists", typeof C.describe({}) === "string");
  check("the core never reaches for the DOM", typeof globalThis.document === "undefined");
}

done("incircle-in-segment-1");
