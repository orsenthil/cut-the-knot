"use strict";

/*
 * BuiQuangTuan — the Six Circles Theorem as a draggable illustration
 * (Alexander Bogomolny's applet, invented by Bui Quang Tuan).
 *
 * Start with any circle inscribed in angle A3-A1-A2, and call T12 the point
 * where it touches side A1A2. Inscribe the next circle in angle A1-A2-A3 so
 * that it touches A1A2 at the very same T12; write down where it touches
 * A2A3. Keep going round the three corners: after six circles the seventh is
 * the first one again, and the six touching points lie on one circle whose
 * centre is the incenter of the triangle. The page also notes that the six
 * circle centres form a parahexagon (opposite sides parallel and equal).
 *
 * The one idea the code relies on is the applet's own construction. The
 * starting circle is centred at a draggable point P on the bisector of the
 * angle at A1. Each later centre is the crossing of (a) the line from the old
 * centre to its tangency point on the next side and (b) a line built by
 * GeoSDoub.FindAngleBisector at the next corner. Its radius is the distance to
 * that tangency point. Every primitive below is transcribed from the
 * bytecode of GeoSDoub / DoubLine / BuiQuangTuanCanvas, including the
 * 1-unit determinant cutoff in Intersect and the 0.1-unit cutoff in the
 * point-to-line routines.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, BuiQuangTuanCore, so the page loads it with
 * a plain <script> and porting/check-bui-quang-tuan.mjs loads it in Node.
 * Positions are plain data; every function returns a new one.
 */
const BuiQuangTuanCore = (() => {
  const HANDLES = ["A1", "A2", "A3", "P"];
  const DEFAULT_TA = 0.7; // BuiQuangTuanCanvas' m_Ta
  const EPS = 1e-12;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const sqDist = (p, q) => dot(sub(p, q), sub(p, q));
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const valid = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const copy = (p) => ({ x: p.x, y: p.y });

  /** GeoSDoub.Intersect: ax+by+c=0 lines, NaN when |det| < 1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.NearestPoint(P,A,B): drop a perpendicular to line AB. */
  function nearestPoint(p, a, b) {
    if (sqDist(p, a) < 0.1) return copy(p);
    const d = sub(b, a);
    const len2 = dot(d, d);
    const t = len2 === 0 ? 0 : dot(d, sub(p, a)) / len2;
    return add(a, scale(d, t));
  }

  /** GeoSDoub.Dist(P,DoubLine(A,B)), including the applet's 0.1 cutoff. */
  function distToLine(p, a, b) {
    if (sqDist(a, p) < 0.1) return 0;
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 === 0) return Infinity;
    const t = dot(d, sub(p, a)) / len2;
    const foot = add(a, scale(d, t));
    return dist(foot, p);
  }

  /** GeoSDoub.ComputeAngle(A,B,C): the angle at A, by the cosine rule. */
  function computeAngle(a, b, c) {
    const numerator = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / 2;
    return Math.acos(numerator / (dist(a, b) * dist(a, c)));
  }

  /** GeoSDoub.FindOrientation: +1 when its cross product is > 0, else -1. */
  function findOrientation(a, b, c) {
    // Java's dsub order is (first pushed) - (second pushed), so these are
    // A.y-B.y and B.x-A.x, not the other way round.
    const cross = c.x * (a.y - b.y) + c.y * (b.x - a.x) +
                  a.x * b.y - b.x * a.y;
    return cross > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(A,B,angle,orient): rotate B about A. */
  function rotate(a, b, angle, orient) {
    const co = Math.cos(angle), si = Math.sin(angle), o = orient;
    return {
      x: a.x + co * (b.x - a.x) - o * si * (b.y - a.y),
      y: a.y + o * si * (b.x - a.x) + co * (b.y - a.y),
    };
  }

  /** GeoSDoub.FindAngleBisector: a point on the bisector, then meet BC. */
  function angleBisector(a, b, c) {
    const half = computeAngle(a, b, c) / 2;
    const orient = findOrientation(a, b, c);
    const rotated = rotate(a, b, half, orient);
    return intersect(a, rotated, b, c);
  }

  /** GeoSDoub.FindCircumcenter, written exactly as the bytecode writes it. */
  function circumcenter(a, b, c) {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const p1 = { x: m1.x + (b.y - a.y), y: m1.y + (a.x - b.x) };
    const p2 = { x: m2.x + (c.y - b.y), y: m2.y + (b.x - c.x) };
    return intersect(m1, p1, m2, p2);
  }

  /** BuiQuangTuanCanvas.GetFirstCircle: circumcentre, mean radius. */
  function circleThrough(a, b, c) {
    const centre = circumcenter(a, b, c);
    const r = (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3;
    return { c: centre, r };
  }

  /** DoubLine(V0,L0).CreateMidPoint(t): V0*t + L0*(1-t). */
  function pointOnLine(a, b, t) {
    return add(scale(a, t), scale(b, 1 - t));
  }

  /** DoubLine.UpdateMidPoint(P): projection parameter on AB, not clamped. */
  function parameterOnLine(a, b, p) {
    const d = sub(a, b);
    const len2 = dot(d, d);
    return len2 < EPS ? 0 : -dot(d, sub(b, p)) / len2;
  }

  /**
   * The initial diagram. The applet's canvas has the vertices at
   * (w/2, 100), (w/3, 5h/7), (5w/6, 4h/7); P is CreateMidPoint(m_Ta) on the
   * bisector of the angle at A1. Our viewBox is 600x440.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 600 : o.width;
    const height = o.height === undefined ? 440 : o.height;
    const state = {
      // The applet's Reset uses Java int division, so these are floored.
      A1: o.A1 ? copy(o.A1) : { x: Math.floor(width / 2), y: 100 },
      A2: o.A2 ? copy(o.A2) : { x: Math.floor(width / 3), y: Math.floor((5 * height) / 7) },
      A3: o.A3 ? copy(o.A3) : { x: Math.floor((5 * width) / 6), y: Math.floor((4 * height) / 7) },
      ta: o.ta === undefined ? DEFAULT_TA : o.ta,
      width, height,
      P: null,
    };
    state.P = whereIsP(state);
    return state;
  }

  /** The bisector foot at A1 (the applet's L[0]) and the draggable P on it. */
  function bisectorFoot(s) {
    return angleBisector(s.A1, s.A3, s.A2);
  }

  function whereIsP(s) {
    return pointOnLine(s.A1, bisectorFoot(s), s.ta);
  }

  /**
   * Move one handle. Dragging a vertex rebuilds the bisector and puts P back
   * at the same fraction along it (the applet's CreateBisector); dragging P
   * updates m_Ta from its projection on that bisector (UpdateMidPoint). The
   * old state is never changed.
   */
  function withPoint(s, name, p) {
    if (!HANDLES.includes(name)) return s;
    const next = {
      A1: copy(s.A1), A2: copy(s.A2), A3: copy(s.A3),
      P: copy(s.P), ta: s.ta, width: s.width, height: s.height,
    };
    if (name === "P") {
      next.ta = parameterOnLine(next.A1, bisectorFoot(next), p);
      next.P = whereIsP(next);
    } else {
      next[name] = copy(p);
      next.P = whereIsP(next);
    }
    return next;
  }

  /**
   * The six inscribed circles and the seven tangency points, from the
   * applet's ShowCircles / GetNextFirstCircle loop. The seventh circle is
   * computed but not drawn (the applet discards it to avoid drawing C1
   * twice); it is kept here so the C7 = C1 claim can be checked.
   */
  function circles(s) {
    const V = [s.A1, s.A2, s.A3];
    const first = { c: s.P, r: distToLine(s.P, V[0], V[1]) };
    const tangency = [];
    const drawn = [];
    let previous = first;
    let seventh = null;
    for (let k = 0; k < 6; k++) {
      // The applet passes k % 3 into GetNextFirstCircle, which then indexes
      // the three sides and angles with that reduced number.
      const side = k % 3;
      const n = (side + 1) % 3, m = (side + 2) % 3;
      // GeoSDoub.NearestPoint(previous centre, side V[side]V[n]).
      const t = nearestPoint(previous.c, V[side], V[n]);
      tangency.push(t);
      // The next centre meets the line through t and the old centre with the
      // bisector line built at V[n] by FindAngleBisector(V[n], V[k], V[m]).
      const bis = angleBisector(V[n], V[side], V[m]);
      const centre = intersect(t, previous.c, V[n], bis);
      const next = { c: centre, r: dist(centre, t) };
      if (k < 5) {
        drawn.push(next);
        previous = next;
      } else {
        seventh = next;
      }
    }
    // GetFirstCircle(T[0],T[2],T[3]): the article's "concyclic" circle.
    const big = circleThrough(tangency[0], tangency[2], tangency[3]);
    return { first, drawn, seventh, tangency, big };
  }

  /** The incenter, from side lengths — independent of the circle chain. */
  function incenter(s) {
    const a = dist(s.A2, s.A3), b = dist(s.A3, s.A1), c = dist(s.A1, s.A2);
    const total = a + b + c;
    return {
      x: (a * s.A1.x + b * s.A2.x + c * s.A3.x) / total,
      y: (a * s.A1.y + b * s.A2.y + c * s.A3.y) / total,
    };
  }

  /**
   * The page's assertions at this position, each with a scale-aware
   * tolerance. Null when the diagram has degenerated into NaNs.
   */
  function claims(s) {
    const chain = circles(s);
    const values = [s.P, ...chain.drawn.map((o) => o.c), ...chain.tangency,
                    chain.big.c, chain.seventh.c];
    if (!values.every(valid) ||
        !chain.drawn.every((o) => Number.isFinite(o.r) && o.r > 0)) return null;

    const scaleRef = Math.max(1, dist(s.A1, s.A2), dist(s.A1, s.A3));
    const tol = 1e-6 * scaleRef;
    const near = (u, v, limit) => Math.abs(u - v) <= (limit === undefined ? tol : limit);
    const nearPoint = (p, q, limit) => near(p.x, q.x, limit) && near(p.y, q.y, limit);
    const closePoint = (p, q) => dist(p, q) <= tol;
    const centres = [chain.first, ...chain.drawn].map((o) => o.c);

    // Opposite sides of the hexagon of centres are parallel and equal.
    let para = true;
    for (let i = 0; i < 3; i++) {
      const side1 = sub(centres[(i + 1) % 6], centres[i]);
      const side2 = sub(centres[(i + 4) % 6], centres[(i + 3) % 6]);
      // Traversing the hexagon, opposite sides point opposite ways.
      if (!nearPoint(side1, scale(side2, -1))) para = false;
    }

    return {
      // C7 = C1: centre and radius both come back after six steps.
      closes: closePoint(chain.seventh.c, chain.first.c) &&
              near(chain.seventh.r, chain.first.r),
      // C7 touches A1A2 exactly where C1 did. The applet does not draw that
      // seventh circle, so its tangency point is computed from C7 instead.
      tangencyCloses: closePoint(
        nearestPoint(chain.seventh.c, s.A1, s.A2), chain.tangency[0]),
      // The six touching points all lie on the article's circle.
      concyclic: chain.tangency.slice(0, 6).every((t) =>
        near(dist(chain.big.c, t), chain.big.r, 1e-5 * scaleRef)),
      // Its centre really is the incenter of the triangle.
      centreIsIncenter: closePoint(chain.big.c, incenter(s)),
      // The six centres make a parahexagon.
      parahexagon: para,
      valid: true,
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    HANDLES, DEFAULT_TA, start, withPoint, circles, incenter, claims, result,
    // Transcriptions of the applet's primitives, exposed for the logic test.
    intersect, nearestPoint, distToLine, computeAngle, findOrientation,
    rotate, angleBisector, circumcenter, circleThrough, pointOnLine,
    parameterOnLine, bisectorFoot, whereIsP, dist, sqDist,
  };
})();
