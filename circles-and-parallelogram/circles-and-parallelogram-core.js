"use strict";

/*
 * Two Circles in a Parallelogram, from Alexander Bogomolny's applet
 * CirclesAndParallelogram (a Mathematical Droodle on cut-the-knot.org).
 *
 * ABCD is a parallelogram, M lies on AB, N on CD, and K can slide along MN.
 * The circumcircles of AMK and CNK meet again at P. The surprise is that P
 * always lies on the diagonal AC, that the line KP makes a fixed angle with
 * AC as K slides, and that the line joining the two circle centres keeps both
 * its direction and its length. In the tangent case P and K coincide and the
 * common tangent keeps that same angle.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CirclesAndParallelogramCore. The position is
 * plain data, so it can be saved and handed to the tutor. The geometry helpers
 * below are transcribed from the applet's GeoSDoub and from its own Compute,
 * PerpBisector and GetCircle methods (including the |det| < 1 guard and the
 * 0.1 slop in NearestPoint). Functions return new positions.
 */
const CirclesAndParallelogramCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const MARGIN = 12;
  const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };       // 200, 150
  const HALF = Math.floor(Math.min(CENTER.x, CENTER.y) / 2); // 75
  const MIN_SIDE = 20;
  const POINTS = ["A", "B", "C", "D", "M", "N", "K"];
  const OPTIONS = ["showNames", "showCenterLine", "showHint"];
  const OPPOSITE = { A: "C", C: "A", B: "D", D: "B" };
  const SIDE_MATE = { A: "B", B: "A", C: "D", D: "C" };

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

  /** GeoSDoub.NearestPoint(p, a, b): projection onto line(a,b), with 0.1 slop. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return copy(p);
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors. */
  function circumcenter(p0, p1, p2) {
    const m1 = midpoint(p0, p1), m2 = midpoint(p1, p2);
    const n1 = { x: m1.x + (p1.y - p0.y), y: m1.y - (p1.x - p0.x) };
    const n2 = { x: m2.x + (p2.y - p1.y), y: m2.y - (p2.x - p1.x) };
    return intersect(m1, n1, m2, n2);
  }

  /** CirclesAndParallelogramCanvas.GetCircle: centre is the circumcenter,
   *  radius the mean of its three distances (the applet's own definition). */
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

  /** CirclesAndParallelogramCanvas.PerpBisector: a line through the midpoint
   *  in the direction (p.y - q.y, -(p.x - q.x)). */
  function perpBisector(p, q) {
    const m = midpoint(p, q);
    return { p: m, q: { x: m.x + (p.y - q.y), y: m.y - (p.x - q.x) } };
  }

  function lineAngle(v) {
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return NaN;
    let a = Math.atan2(v.y, v.x);
    if (a < 0) a += Math.PI;
    if (a >= Math.PI) a -= Math.PI;
    return a;
  }

  /** The (undirected) angle two lines make: P swaps sides of K as K slides,
   *  so the angle of the lines is wanted, not that of two directed vectors. */
  function angleBetween(u, v) {
    const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
    if (!nu || !nv) return NaN;
    return Math.acos(clamp(Math.abs(u.x * v.x + u.y * v.y) / (nu * nv), -1, 1));
  }

  /** Keep K on line MN: the applet cuts it with the horizontal line y = K.y. */
  function snapK(M, N, p) {
    const hit = intersect(M, N, p, { x: p.x + 200, y: p.y });
    return finite(hit) ? { x: hit.x, y: p.y } : copy(p);
  }

  function defaultStart() {
    const A = { x: CENTER.x - HALF, y: CENTER.y + HALF };
    const B = { x: CENTER.x + Math.round(HALF * 1.5), y: CENTER.y + HALF };
    const C = { x: CENTER.x + HALF, y: CENTER.y - HALF };
    const D = { x: CENTER.x - Math.round(HALF * 1.5), y: CENTER.y - HALF };
    const M = { x: (A.x + 2 * B.x) / 3, y: A.y };
    const N = { x: (5 * C.x + D.x) / 6, y: C.y };
    const K = { x: (2 * M.x + N.x) / 3, y: (2 * M.y + N.y) / 3 };
    return { A, B, C, D, M, N, K };
  }

  /** The position a new exploration starts from. Individual points may be
   *  overridden (the logic test uses this to reach arbitrary drawings). */
  function start(options) {
    const o = options || {};
    const d = defaultStart();
    const s = { moves: 0, explored: false };
    for (const key of POINTS) {
      s[key] = o[key] && finite(o[key]) ? copy(o[key]) : copy(d[key]);
    }
    if (!o.K) s.K = snapK(s.M, s.N, s.K);
    for (const key of OPTIONS) s[key] = o[key] === undefined ? false : !!o[key];
    return s;
  }

  /** The seven draggable points. */
  function legalMoves() {
    return POINTS.slice();
  }

  /** Drag one point. Corners move their diagonal partner by reflection in the
   *  center, as UpdatePoints does, and keep the two horizontal sides level;
   *  M and N stay on their sides; K is snapped back onto MN. */
  function movePoint(s, name, p) {
    if (POINTS.indexOf(name) < 0 || !p || !finite(p)) return s;
    const q = clampToBoard(p);
    const pts = {};
    for (const key of POINTS) pts[key] = copy(s[key]);

    if (name === "A" || name === "B" || name === "C" || name === "D") {
      pts[name] = q;
      const opp = OPPOSITE[name];
      pts[opp] = { x: 2 * CENTER.x - q.x, y: 2 * CENTER.y - q.y };
      pts[SIDE_MATE[name]] = { x: pts[SIDE_MATE[name]].x, y: q.y };
      pts[SIDE_MATE[opp]] = { x: pts[SIDE_MATE[opp]].x, y: pts[opp].y };
      pts.M = { x: pts.M.x, y: pts.A.y };
      pts.N = { x: pts.N.x, y: pts.C.y };
    } else if (name === "M") {
      pts.M = { x: q.x, y: pts.A.y };
    } else if (name === "N") {
      pts.N = { x: q.x, y: pts.C.y };
    } else {
      pts.K = snapK(pts.M, pts.N, q);
    }
    if (name !== "K") pts.K = snapK(pts.M, pts.N, pts.K);

    /* The applet allows any drag, but a point far outside the canvas or a
       collapsed parallelogram cannot be drawn; refuse those, as the other
       geometry ports do. */
    const bad = POINTS.some((key) => !finite(pts[key]) ||
      pts[key].x < MARGIN - 1e-9 || pts[key].x > WIDTH - MARGIN + 1e-9 ||
      pts[key].y < MARGIN - 1e-9 || pts[key].y > HEIGHT - MARGIN + 1e-9) ||
      Math.abs(pts.A.y - pts.B.y) > 1e-9 ||
      Math.abs(pts.C.y - pts.D.y) > 1e-9 ||
      Math.abs(pts.A.x + pts.C.x - pts.B.x - pts.D.x) > 1e-9 ||
      Math.abs(pts.B.x - pts.A.x) < MIN_SIDE ||
      Math.abs(pts.A.y - pts.C.y) < MIN_SIDE;
    if (bad) return s;
    return Object.assign({}, s, pts, { moves: s.moves + 1, explored: true });
  }

  /** The three checkboxes from the applet's panel. */
  function setOption(s, key, value) {
    if (OPTIONS.indexOf(key) < 0) return s;
    return Object.assign({}, s, { [key]: !!value, explored: true });
  }

  /** Restore the opening drawing, keeping the display options. */
  function reset(s) {
    return start({
      showNames: s.showNames, showCenterLine: s.showCenterLine, showHint: s.showHint,
    });
  }

  /** Everything the page draws, recomputed from the seven points. */
  function compute(s) {
    const { A, B, C, D, M, N, K } = s;
    const base = {
      A, B, C, D, M, N, K,
      AC: { p: A, q: C }, MN: { p: M, q: N },
      circleAMK: null, circleCNK: null, P: null,
      perpA: null, perpC: null, centerLine: null,
      acResidual: NaN, kpAngle: NaN, centerAngle: NaN, centerLength: NaN,
      tangentAngle: NaN, tangent: false, degenerate: true,
    };
    /* CirclesAndParallelogramCanvas.Compute's four guards. */
    const foot = nearestPoint(A, C, D);
    if (!finite(foot) || dist(A, B) < 1 || dist(A, C) < 1 ||
        dist(A, D) < 1 || dist(A, foot) < 1) return base;

    const circleAMK = getCircle(A, M, K);
    const circleCNK = getCircle(C, N, K);
    const hits = intersectCircles(circleAMK, circleCNK);
    /* The applet picks the intersection at least one unit from K, which is
       the one that is not K. */
    const P = hits.length
      ? (dist(K, hits[0]) >= 1 ? hits[0] : (hits[1] || hits[0]))
      : null;
    const perpA = perpBisector(A, M);
    const perpC = perpBisector(C, N);
    const centersOK = finite(circleAMK) && finite(circleCNK) &&
      Number.isFinite(circleAMK.r) && Number.isFinite(circleCNK.r);
    const centerLine = centersOK
      ? { p: copy(circleAMK), q: copy(circleCNK) } : null;
    const degenerate = !centersOK || !finite(P);
    if (degenerate) {
      return Object.assign(base, {
        circleAMK, circleCNK, perpA, perpC, centerLine,
      });
    }
    const kpDir = sub(P, K);
    const acDir = sub(C, A);
    const tanDir = { x: -(K.y - circleAMK.y), y: K.x - circleAMK.x };
    return Object.assign(base, {
      circleAMK, circleCNK, P, perpA, perpC, centerLine,
      acResidual: cross(A, C, P),
      kpAngle: angleBetween(kpDir, acDir),
      centerAngle: lineAngle(sub(circleCNK, circleAMK)),
      centerLength: dist(circleAMK, circleCNK),
      tangentAngle: angleBetween(tanDir, acDir),
      tangent: dist(P, K) < 0.5,
      degenerate: false,
    });
  }

  /** The line under the drawing. An illustration has no winner to announce. */
  function describe(s) {
    const g = compute(s);
    if (g.degenerate || !g.P) {
      return "Move the points apart so that both circles can be drawn.";
    }
    const r = (v) => Math.round(v);
    const deg = r(g.kpAngle * 180 / Math.PI);
    return `The circles meet again at P on the diagonal AC, ${r(dist(g.P, g.K))} units from K. ` +
      `KP meets AC at ${deg}°. Slide K: the angle and the centre line stay the same.`;
  }

  /** No win, loss or finish: this is a demonstration the player explores. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, MARGIN, CENTER, HALF, POINTS, OPTIONS,
    copy, finite, clamp, clampToBoard, sqDist, dist, sub, cross, midpoint,
    intersect, nearestPoint, circumcenter, getCircle,
    intersectCircles, intersectCirclesX, intersectCirclesY,
    perpBisector, lineAngle, angleBetween, snapK,
    start, legalMoves, movePoint, setOption, reset, compute, describe, result,
  };
})();
