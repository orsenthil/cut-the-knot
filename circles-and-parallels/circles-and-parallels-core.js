"use strict";

/*
 * Circles And Parallels, from Alexander Bogomolny's applet CirclesAndParallels
 * (a Mathematical Droodle on cut-the-knot.org, after Honsberger and Prasolov).
 *
 * P slides on the side AB of triangle ABC. PN is drawn parallel to BC and PM
 * parallel to AC, so N lies on AC and M on BC. The circumcircles of APN and
 * BPM meet at P and again at Q. The surprise is that as P slides, the line PQ
 * always passes through one fixed point X: the apex of an isosceles triangle
 * on AB whose base angles equal angle C, equivalently the meeting point of the
 * tangents to the circumcircle of ABC at A and at B.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CirclesAndParallelsCore, so the page loads it with a
 * plain <script> and porting/check-circles-and-parallels.mjs loads it in Node.
 * The position is plain data, so it can be saved and handed to the tutor.
 *
 * The geometry helpers are transcribed from the applet's GeoSDoub and from its
 * own Compute / Other / GetCircle / Perp methods. Two details are kept exactly:
 * Intersect returns NaN when |det| < 1, and GetCircle takes the mean of the
 * three distances from the circumcenter as its radius. In the tangent case the
 * page's remark wins over the applet: the real common tangent (perpendicular
 * to the line of the two centres) passes through X, while the applet's
 * PerpLine(P, A) does not; both lines are returned so the test can show this.
 */
const CirclesAndParallelsCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const MARGIN = 12;
  const COEF = 0.7;                 // applet's opening position along AB
  const NEAR = 1.5;                 // applet's NoDraw guard around A and B
  const MIN_SIDE = 20;
  const MIN_AREA = 400;
  const POINTS = ["A", "B", "C", "P"];
  const OPTIONS = ["showNames", "showHint"];

  const copy = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampToBoard = (p) => ({
    x: clamp(p.x, MARGIN, WIDTH - MARGIN),
    y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
  });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  /** GeoSDoub.Intersect of two lines; NaN when |determinant| < 1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.GetParallelTo(p, a, b) = p + 100 * (a - b). */
  function parallelTo(p, a, b) {
    return { x: p.x + 100 * (a.x - b.x), y: p.y + 100 * (a.y - b.y) };
  }

  /** GeoSDoub.FindCircumcenter: two perpendicular bisectors, then Intersect. */
  function circumcenter(p0, p1, p2) {
    const m1 = midpoint(p0, p1), m2 = midpoint(p1, p2);
    const n1 = { x: m1.x + (p1.y - p0.y), y: m1.y - (p1.x - p0.x) };
    /* The second bisector uses the chord p1->p2: its direction is
       (p2.y - p1.y, -(p2.x - p1.x)). */
    const n2 = { x: m2.x + (p2.y - p1.y), y: m2.y - (p2.x - p1.x) };
    return intersect(m1, n1, m2, n2);
  }

  /** CirclesAndParallelsCanvas.GetCircle: centre is Circumcenter, radius the
   *  mean of its three distances (the applet's own definition). */
  function getCircle(p0, p1, p2) {
    const o = circumcenter(p0, p1, p2);
    const r = (dist(o, p0) + dist(o, p1) + dist(o, p2)) / 3;
    return { x: o.x, y: o.y, r };
  }

  /* GeoSDoub.IntersectCirclesX and IntersectCirclesY, from the bytecode. */
  function intersectCirclesX(c0, c1) {
    const m = -(c0.y - c1.y) / (c0.x - c1.x);
    const b = (
      c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y -
      c0.r * c0.r + c1.r * c1.r
    ) / 2 / (c0.x - c1.x);
    const h = b - c0.x;
    const a = m * m + 1;
    const k = m * h - c0.y;
    const c = h * h + c0.y * c0.y - c0.r * c0.r;
    const disc = k * k - a * c;
    if (!(disc >= 0)) return [];
    const root = Math.sqrt(disc);
    const y1 = (-k + root) / a, y2 = (-k - root) / a;
    return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
  }

  function intersectCirclesY(c0, c1) {
    const m = -(c0.x - c1.x) / (c0.y - c1.y);
    const b = (
      c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x -
      c0.r * c0.r + c1.r * c1.r
    ) / 2 / (c0.y - c1.y);
    const h = b - c0.y;
    const a = m * m + 1;
    const k = m * h - c0.x;
    const c = h * h + c0.x * c0.x - c0.r * c0.r;
    const disc = k * k - a * c;
    if (!(disc >= 0)) return [];
    const root = Math.sqrt(disc);
    const x1 = (-k + root) / a, x2 = (-k - root) / a;
    return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
  }

  /** GeoSDoub.Intersect(DoubCircle, DoubCircle). */
  function intersectCircles(c0, c1) {
    if (!c0 || !c1 || !finite(c0) || !finite(c1) ||
        !Number.isFinite(c0.r) || !Number.isFinite(c1.r)) return [];
    if (Math.abs(c0.x - c1.x) > 1) return intersectCirclesX(c0, c1);
    if (Math.abs(c0.y - c1.y) > 1) return intersectCirclesY(c0, c1);
    return [copy(c0), copy(c0)];
  }

  /** GeoSDoub.ComputeAngle: vertex is the FIRST argument (cotangent rule). */
  function computeAngle(p0, p1, p2) {
    const v = (sqDist(p0, p1) + sqDist(p0, p2) - sqDist(p1, p2)) /
      (2 * dist(p0, p1) * dist(p0, p2));
    return Math.acos(clamp(v, -1, 1));
  }

  /** GeoSDoub.FindOrientation: +1 for a left turn, -1 otherwise. */
  function findOrientation(p0, p1, p2) {
    return cross(p0, p1, p2) > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(center, point, angle, sign). */
  function rotate(p0, p1, angle, sign) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return {
      x: p0.x + c * (p1.x - p0.x) - sign * s * (p1.y - p0.y),
      y: p0.y + sign * s * (p1.x - p0.x) + c * (p1.y - p0.y),
    };
  }

  /** DoubCircle.Tangent(p): a second point on the tangent at p. */
  function tangentPoint(c, p) {
    return { x: p.x + (c.y - p.y), y: p.y - (c.x - p.x) };
  }

  /** CirclesAndParallelsCanvas.Perp(p, q): p + (q.y - p.y, -(q.x - p.x)). */
  function perp(p, q) {
    return { x: p.x + (q.y - p.y), y: p.y - (q.x - p.x) };
  }

  function along(A, B, t) {
    return { x: A.x * t + B.x * (1 - t), y: A.y * t + B.y * (1 - t) };
  }

  function projection(A, B, p) {
    const d = sqDist(A, B);
    return d < 1e-12 ? COEF : dot(sub(p, B), sub(A, B)) / d;
  }

  function defaultStart() {
    /* The applet uses width/5 for both coordinates of A — kept as a quirk. */
    const A = { x: WIDTH / 5, y: WIDTH / 5 };
    const B = { x: 3 * WIDTH / 5, y: HEIGHT - 2 * (HEIGHT / 5) };
    const C = { x: WIDTH - WIDTH / 5, y: HEIGHT / 5 };
    return { A, B, C, P: along(A, B, COEF), coefP: COEF };
  }

  /** The position a new exploration starts from. Individual points and the
   *  slider coefficient may be overridden (the logic test uses this). */
  function start(options) {
    const o = options || {}, d = defaultStart();
    const s = { moves: 0, explored: false };
    for (const key of POINTS) {
      s[key] = o[key] && finite(o[key]) ? copy(o[key]) : copy(d[key]);
    }
    s.coefP = Number.isFinite(o.coefP) ? o.coefP : d.coefP;
    if (o.P && finite(o.P)) {
      s.coefP = projection(s.A, s.B, s.P);
      s.P = along(s.A, s.B, s.coefP);      // RestrictToLine: P stays on AB
    } else {
      s.P = along(s.A, s.B, s.coefP);
    }
    for (const key of OPTIONS) s[key] = o[key] === undefined ? false : !!o[key];
    return s;
  }

  /** The four draggable points. */
  function legalMoves() {
    return POINTS.slice();
  }

  /** Drag a point. A and B carry P with them at the same fraction of AB, P
   *  snaps onto line AB and updates that fraction, C moves freely. */
  function movePoint(s, name, p) {
    if (POINTS.indexOf(name) < 0 || !p || !finite(p)) return s;
    const q = clampToBoard(p);
    const pts = {};
    for (const key of POINTS) pts[key] = copy(s[key]);
    let coef = s.coefP;

    if (name === "A" || name === "B") {
      pts[name] = q;
      pts.P = along(pts.A, pts.B, coef);
    } else if (name === "P") {
      coef = projection(s.A, s.B, q);
      pts.P = along(s.A, s.B, coef);
    } else {
      pts.C = q;
    }

    /* The applet allows any drag (it just stops drawing when P is within 1.5
       of A or B), but a point off the board or a collapsed triangle cannot be
       drawn here; refuse those, as the other geometry ports do. */
    const bad = POINTS.some((key) => !finite(pts[key]) ||
      pts[key].x < MARGIN - 1e-9 || pts[key].x > WIDTH - MARGIN + 1e-9 ||
      pts[key].y < MARGIN - 1e-9 || pts[key].y > HEIGHT - MARGIN + 1e-9) ||
      dist(pts.A, pts.B) < MIN_SIDE ||
      Math.abs(cross(pts.A, pts.B, pts.C)) < MIN_AREA;
    if (bad) return s;
    return Object.assign({}, s, pts, { coefP: coef, moves: s.moves + 1, explored: true });
  }

  /** The two display options from the applet's panel. */
  function setOption(s, key, value) {
    if (OPTIONS.indexOf(key) < 0) return s;
    return Object.assign({}, s, { [key]: !!value, explored: true });
  }

  /** Restore the opening drawing, keeping the display options. */
  function reset(s) {
    return start({ showNames: s.showNames, showHint: s.showHint });
  }

  /** Everything the page draws, recomputed from the four points. */
  function compute(s) {
    const { A, B, C, P } = s;
    const base = {
      A, B, C, P, N: null, M: null, circleAPN: null, circleBPM: null,
      Q: null, line: null, appletLine: null, X: null, Xtan: null,
      circum: null, ta: null, tb: null, rA: null, rB: null,
      onLine: NaN, appletOnLine: NaN, tangent: false, noDraw: false, degenerate: true,
    };
    /* CirclesAndParallelsCanvas.Compute's NoDraw guard. */
    if (dist(P, A) < NEAR || dist(P, B) < NEAR) return Object.assign(base, { noDraw: true });

    const N = intersect(parallelTo(P, B, C), P, A, C);
    const M = intersect(parallelTo(P, A, C), P, B, C);
    if (!finite(N) || !finite(M)) return Object.assign(base, { N, M });

    const circleAPN = getCircle(A, P, N);
    const circleBPM = getCircle(B, P, M);
    const hits = intersectCircles(circleAPN, circleBPM);
    /* Canvas.Other: the intersection at least one unit from P, i.e. not P. */
    const Q = hits.length ? (dist(hits[0], P) >= 1 ? hits[0] : (hits[1] || hits[0])) : null;

    /* Canvas.Compute's X: equal base angles at A and B, outwardly on AB. */
    const angle = computeAngle(C, A, B);
    const o = findOrientation(C, A, B);
    const rA = rotate(A, B, angle, -o);
    const rB = rotate(B, A, angle, o);
    const X = intersect(A, rA, B, rB);

    /* The same point as the intersection of the tangents at A and B to the
       circumcircle of ABC, drawn by the applet's hint. */
    const circum = getCircle(A, B, C);
    const ta = tangentPoint(circum, A);
    const tb = tangentPoint(circum, B);
    const Xtan = intersect(A, ta, B, tb);

    const tangent = !!Q && dist(P, Q) < 1;
    const degenerate = !Q || !finite(X) || !finite(Xtan) ||
      !finite(circleAPN) || !finite(circleBPM) ||
      !Number.isFinite(circleAPN.r) || !Number.isFinite(circleBPM.r);

    /* Canvas.Compute's fallback in the tangent case is PerpLine(P, A), which
       misses X. The page says the common tangent is the line that satisfies
       the theorem, so that is what the port draws; the applet's line is kept
       for the test to compare. */
    const appletLine = tangent ? { p: P, q: perp(P, A) }
      : (Q ? { p: P, q: Q } : null);
    let line = appletLine;
    if (tangent) {
      const v = sub(circleBPM, circleAPN);
      if (finite(v) && Math.hypot(v.x, v.y) > 1e-9) {
        line = { p: P, q: { x: P.x - v.y, y: P.y + v.x } };
      }
    }
    const distanceTo = (l) => l && finite(l.q)
      ? cross(l.p, l.q, X) / Math.hypot(l.q.x - l.p.x, l.q.y - l.p.y)
      : NaN;

    return Object.assign(base, {
      N, M, circleAPN, circleBPM, Q, line, appletLine, X, Xtan,
      circum, ta, tb, rA, rB, tangent, degenerate,
      onLine: distanceTo(line), appletOnLine: distanceTo(appletLine),
    });
  }

  /** The line under the drawing. An illustration has no winner to announce. */
  function describe(s) {
    const g = compute(s);
    if (g.noDraw) return "Move P away from A and B so both circles can be drawn.";
    if (g.degenerate) return "Move the points apart so the circles and X can be drawn.";
    const x = Math.round(g.X.x), y = Math.round(g.X.y);
    if (g.tangent) {
      return `The circles touch at P. Their common tangent still goes through X at (${x}, ${y}).`;
    }
    return `The circles meet again at Q; the line PQ passes through X at (${x}, ${y}). Slide P: X stays put.`;
  }

  /** No win, loss or finish: this is a demonstration the player explores. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, MARGIN, COEF, NEAR, MIN_SIDE, MIN_AREA, POINTS, OPTIONS,
    copy, finite, clamp, clampToBoard, sqDist, dist, sub, dot, cross, midpoint,
    intersect, parallelTo, circumcenter, getCircle,
    intersectCircles, intersectCirclesX, intersectCirclesY,
    computeAngle, findOrientation, rotate, tangentPoint, perp, along, projection,
    start, legalMoves, movePoint, setOption, reset, compute, describe, result,
  };
})();
