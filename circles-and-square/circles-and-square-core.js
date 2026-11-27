"use strict";

/*
 * Two Circles in a Square, from Alexander Bogomolny's applet CirclesAndSquare.
 *
 * ABCD is a square, M lies on the top side AD, N on the bottom side BC, and K
 * can slide along MN. The circumcircles of AMK and CNK meet again at P. The
 * surprise is that P always lies on the diagonal AC: the angle APK is the
 * supplement of AMK (a cyclic quadrilateral), AMK equals KNC (alternate
 * angles across the parallel sides AD and BC), so APK plus KPC is a straight
 * angle. The same argument works for rectangles and parallelograms.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CirclesAndSquareCore. The position is plain
 * data, so it can be saved and handed to the tutor. The geometry helpers are
 * transcribed from the applet's GeoSDoub (Intersect, NearestPoint,
 * FindCircumcenter, Intersect(circle,circle)) and from its canvas's
 * GetCircle and Draw; functions return new positions.
 */
const CirclesAndSquareCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const MARGIN = 12;
  const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
  const HALF = Math.floor(Math.min(CENTER.x, CENTER.y) / 2); // 75, as in init()
  const MIN_SIDE = 20;
  const POINTS = ["A", "B", "C", "D", "M", "N", "K"];
  const OPTIONS = ["showNames"];
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

  /** Canvas.GetCircle: centre is the circumcenter, radius the mean of the
   *  three distances (the applet's own definition). */
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

  /** The angle at vertex v between v->p and v->q, in [0, PI]. */
  function angleAt(v, p, q) {
    const u = sub(p, v), w = sub(q, v);
    const nu = Math.hypot(u.x, u.y), nw = Math.hypot(w.x, w.y);
    if (!nu || !nw) return NaN;
    return Math.acos(clamp((u.x * w.x + u.y * w.y) / (nu * nw), -1, 1));
  }

  /** Keep K on line MN: the applet cuts it with the horizontal line y = K.y. */
  function snapK(M, N, p) {
    const hit = intersect(M, N, p, { x: p.x + 200, y: p.y });
    return finite(hit) ? { x: hit.x, y: p.y } : copy(p);
  }

  function defaultStart() {
    const A = { x: CENTER.x - HALF, y: CENTER.y - HALF };
    const B = { x: CENTER.x - HALF, y: CENTER.y + HALF };
    const C = { x: CENTER.x + HALF, y: CENTER.y + HALF };
    const D = { x: CENTER.x + HALF, y: CENTER.y - HALF };
    const M = { x: (A.x + 2 * D.x) / 3, y: A.y };
    const N = { x: (5 * B.x + C.x) / 6, y: B.y };
    const K = { x: (2 * M.x + N.x) / 3, y: (2 * M.y + N.y) / 3 };
    return { A, B, C, D, M, N, K };
  }

  /** The position a new exploration starts from. Individual points may be
   *  overridden (the logic test uses this to reach rectangles, parallelograms
   *  and other configurations of the same theorem). */
  function start(options) {
    const o = options || {};
    const d = defaultStart();
    const s = { moves: 0, explored: false };
    for (const key of POINTS) {
      s[key] = o[key] && finite(o[key]) ? copy(o[key]) : copy(d[key]);
    }
    if (!o.K) s.K = snapK(s.M, s.N, s.K);
    s.showNames = o.showNames === undefined ? false : !!o.showNames;
    return s;
  }

  /** The seven draggable points. */
  function legalMoves() {
    return POINTS.slice();
  }

  /** Drag one point. A corner reflects its opposite corner about the centre
   *  and keeps the sides horizontal and vertical (UpdatePoints), M and N stay
   *  on AD and BC, and K is snapped back onto MN. */
  function movePoint(s, name, p) {
    if (POINTS.indexOf(name) < 0 || !p || !finite(p)) return s;
    const q = clampToBoard(p);
    const pts = {};
    for (const key of POINTS) pts[key] = copy(s[key]);

    if (name === "A" || name === "B" || name === "C" || name === "D") {
      /* CTKMoveableDoub.UpdateLocation projects a corner onto its diagonal. */
      const onDiagonal = name === "A" || name === "C" ? [s.A, s.C] : [s.B, s.D];
      const snap = nearestPoint(q, onDiagonal[0], onDiagonal[1]);
      pts[name] = snap;
      const opp = OPPOSITE[name];
      pts[opp] = { x: 2 * CENTER.x - snap.x, y: 2 * CENTER.y - snap.y };
      pts[SIDE_MATE[name]] = { x: snap.x, y: pts[opp].y };
      pts[SIDE_MATE[opp]] = { x: pts[opp].x, y: snap.y };
      pts.M = { x: pts.M.x, y: pts.A.y };
      pts.N = { x: pts.N.x, y: pts.B.y };
    } else if (name === "M") {
      pts.M = { x: q.x, y: pts.A.y };
    } else if (name === "N") {
      pts.N = { x: q.x, y: pts.B.y };
    } else {
      pts.K = snapK(pts.M, pts.N, q);
    }
    if (name !== "K") pts.K = snapK(pts.M, pts.N, pts.K);

    /* The applet allows any drag, but a collapsed square or a point off the
       board cannot be drawn; refuse those, as the other geometry ports do. */
    const bad = POINTS.some((key) => !finite(pts[key]) ||
      pts[key].x < MARGIN - 1e-9 || pts[key].x > WIDTH - MARGIN + 1e-9 ||
      pts[key].y < MARGIN - 1e-9 || pts[key].y > HEIGHT - MARGIN + 1e-9) ||
      Math.abs(pts.A.y - pts.D.y) > 1e-9 ||
      Math.abs(pts.B.y - pts.C.y) > 1e-9 ||
      Math.abs(pts.A.x - pts.B.x) > 1e-9 ||
      Math.abs(pts.D.x - pts.C.x) > 1e-9 ||
      Math.abs(pts.D.x - pts.A.x) < MIN_SIDE ||
      Math.abs(pts.A.y - pts.B.y) < MIN_SIDE;
    if (bad) return s;
    return Object.assign({}, s, pts, { moves: s.moves + 1, explored: true });
  }

  /** The applet's only checkbox. */
  function setOption(s, key, value) {
    if (OPTIONS.indexOf(key) < 0) return s;
    return Object.assign({}, s, { [key]: !!value, explored: true });
  }

  /** Restore the opening drawing, keeping the display option. */
  function reset(s) {
    return start({ showNames: s.showNames });
  }

  /** Everything the page draws, recomputed from the seven points. */
  function compute(s) {
    const { A, B, C, D, M, N, K } = s;
    const base = {
      A, B, C, D, M, N, K,
      AC: { p: A, q: C }, MN: { p: M, q: N },
      circleAMK: null, circleCNK: null, P: null,
      acResidual: NaN, angleAMK: NaN, angleKNC: NaN, angleAPK: NaN,
      tangent: false, degenerate: true,
    };
    /* Draw's guard: with a collapsed side the circles are not computed. */
    if (POINTS.some((key) => !finite(s[key])) || dist(A, B) <= 1) return base;

    const circleAMK = getCircle(A, M, K);
    const circleCNK = getCircle(C, N, K);
    const hits = intersectCircles(circleAMK, circleCNK);
    /* Draw picks the crossing at least one unit from K, i.e. not K itself. */
    const P = hits.length
      ? (dist(K, hits[0]) >= 1 ? hits[0] : (hits[1] || hits[0]))
      : null;
    if (!P || !finite(P)) {
      return Object.assign(base, { circleAMK, circleCNK });
    }
    return Object.assign(base, {
      circleAMK, circleCNK, P,
      acResidual: cross(A, C, P),
      angleAMK: angleAt(M, A, K),
      angleKNC: angleAt(N, K, C),
      angleAPK: angleAt(P, A, K),
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
    return `The circles meet again at P on the diagonal AC, ${r(dist(g.P, g.K))} units from K. ` +
      `The angles at M and N are equal, so the two angles at P make a straight line.`;
  }

  /** No win, loss or finish: this is a demonstration the player explores. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, MARGIN, CENTER, HALF, MIN_SIDE, POINTS, OPTIONS,
    copy, finite, clamp, clampToBoard, sqDist, dist, sub, cross, midpoint,
    intersect, nearestPoint, circumcenter, getCircle,
    intersectCircles, intersectCirclesX, intersectCirclesY,
    angleAt, snapK, start, legalMoves, movePoint, setOption, reset,
    compute, describe, result,
  };
})();
