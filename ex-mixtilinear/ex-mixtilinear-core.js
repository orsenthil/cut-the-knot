"use strict";

/*
 * Ex Mixtilinear — the two circles in Bogomolny's applet ExMixtilinear.
 *
 * Drag the corners A, B, C of a triangle and the point K on the line BC. For
 * each choice of K there are two circles touching the ray AK, the line BC and
 * the circumcircle of ABC from outside. The applet draws them and shows that
 * the line through each circle's two points of contact always passes through
 * the excenter E opposite A; when K is the incircle's contact point with BC,
 * both circles have the radius of the A-excircle.
 *
 * The one idea the code relies on: the centre of a circle tangent to the two
 * lines AK and BC lies on the external angle bisector at K, so it is K + t·u
 * for a known unit vector u. Writing d0 for its distance to line AK per unit
 * t, the tangency equation |K + t·u − O| = R + d0·t becomes one quadratic in
 * t whose positive root gives the circle. This is exactly the applet's
 * GetExMilti; the check script transcribes that bytecode a second way and
 * compares the two over many triangles and many positions of K.
 *
 * No document, no window, no storage: one global, plain-data positions, and
 * functions that never change the object they are given.
 */
const ExMixtilinearCore = (() => {
  const EPS = 1e-10;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const norm = (p) => Math.hypot(p.x, p.y);
  const unit = (p) => (norm(p) < EPS ? null : scale(p, 1 / norm(p)));
  const mid = (p, q) => scale(add(p, q), 0.5);
  const reflect = (p, q) => sub(scale(q, 2), p); // 2q − p, ExtendBeyond in the applet
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Foot of the perpendicular from p onto the infinite line through a and b. */
  function foot(p, a, b) {
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 < EPS) return { ...a };
    const t = dot(sub(p, a), d) / len2;
    return add(a, scale(d, t));
  }

  /** Distance from p to the infinite line through a and b. */
  function distToLine(p, a, b) {
    const len = dist(a, b);
    if (len < EPS) return Infinity;
    return Math.abs(cross(sub(b, a), sub(p, a))) / len;
  }

  /** Intersection of the infinite lines a→b and c→d; null if parallel. */
  function intersection(a, b, c, d) {
    const u = sub(b, a), v = sub(d, c);
    const den = cross(u, v);
    if (Math.abs(den) < EPS) return null;
    const t = cross(sub(c, a), v) / den;
    return add(a, scale(u, t));
  }

  function sides(p) {
    return { a: dist(p.B, p.C), b: dist(p.C, p.A), c: dist(p.A, p.B) };
  }

  function circumcircle(A, B, C) {
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    if (Math.abs(d) < EPS) return null;
    const a2 = dot(A, A), b2 = dot(B, B), c2 = dot(C, C);
    const center = {
      x: (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d,
      y: (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d,
    };
    return finite(center) ? { center, radius: dist(center, A) } : null;
  }

  function incenter(A, B, C) {
    const { a, b, c } = sides({ A, B, C });
    const sum = a + b + c;
    if (sum < EPS) return null;
    return scale(add(add(scale(A, a), scale(B, b)), scale(C, c)), 1 / sum);
  }

  /** The excenter opposite A: weight −a at A, +b at B, +c at C. */
  function excenter(A, B, C) {
    const { a, b, c } = sides({ A, B, C });
    const den = -a + b + c;
    if (Math.abs(den) < EPS) return null;
    return scale(add(add(scale(A, -a), scale(B, b)), scale(C, c)), 1 / den);
  }

  /**
   * The circle tangent to AK, BC and the circumcircle, on the side of AK
   * away from A and next to `vertex` (B gives one circle, C the other).
   * Transcribed from ExMixtilinearCanvas.GetExMilti.
   */
  function tangentCircle(A, O, R, B, C, K, vertex) {
    const cc = circumcircle(A, B, C);
    const ccCenter = cc ? cc.center : O;
    const ccRadius = cc ? cc.radius : R;
    if (!finite(K) || !finite(ccCenter)) return null;

    // W is A reflected in K; the centre lies on the bisector of ∠(vertex,K,W).
    const W = reflect(A, K);
    const dirVertex = unit(sub(vertex, K));
    const dirW = unit(sub(W, K));
    if (!dirVertex || !dirW) return null;
    const u = unit(add(dirVertex, dirW)); // the internal bisector of the two rays
    if (!u) return null;

    // Distance from K+u to the line KW, i.e. the radius gained per unit t.
    const d0 = Math.abs(cross(sub(W, K), u)) / dist(W, K);
    const delta = sub(K, ccCenter);
    // |K + t·u − O| = R + d0·t  →  (1−d0²)t² + 2(delta·u − R d0)t + (|delta|²−R²) = 0.
    const qa = 1 - d0 * d0;
    const qb = dot(delta, u) - ccRadius * d0;
    const qc = dot(delta, delta) - ccRadius * ccRadius;
    const disc = qb * qb - qa * qc;
    // QuadraticEquation.Solve2 refuses a coefficient smaller than 0.01; the
    // applet then simply leaves that circle undrawn (near-parallel AK and BC).
    if (!Number.isFinite(disc) || disc < 0 || Math.abs(qa) < 0.01) return null;
    const root = Math.sqrt(disc);
    let t = (-qb + root) / qa;
    if (!(t > 0)) t = (-qb - root) / qa;
    if (!Number.isFinite(t)) return null;

    const center = add(K, scale(u, t));
    const radius = d0 * t;
    if (!finite(center) || !Number.isFinite(radius)) return null;
    return {
      center,
      radius,
      bc: foot(center, B, C),
      ak: foot(center, A, K),
    };
  }

  /** The applet's starting triangle and K, for a 400×500-style drawing area. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: { ...o.points.A }, B: { ...o.points.B },
        C: { ...o.points.C }, K: { ...o.points.K },
        showNames: o.showNames !== false, showHint: !!o.showHint,
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const u = Math.min(width, height) / 10;
    const B = { x: width / 2 - u, y: height / 4 + u };
    const C = { x: width / 2 + (3 * u) / 2, y: height / 4 + (3 * u) / 2 };
    const A = { x: width / 2 + u / 2, y: height / 4 - u };
    // BC.CreateMidPoint(0.3) = (1−0.3)B + 0.3C.
    const K = add(scale(B, 0.7), scale(C, 0.3));
    return { A, B, C, K, showNames: o.showNames !== false, showHint: !!o.showHint };
  }

  /** Move a named handle; K is restricted to the line BC, as in the applet. */
  function move(state, m) {
    if (!m || !["A", "B", "C", "K"].includes(m.point)) return null;
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
    const next = { ...state, [m.point]: { x: m.x, y: m.y } };
    if (m.point === "K") next.K = foot(next.K, next.B, next.C);
    return next;
  }

  /** Put K at the incircle's contact point — the applet's "eyes open" spot. */
  function snapToIncircle(state) {
    const touch = incenter(state.A, state.B, state.C);
    if (!touch) return state;
    const ai = foot(touch, state.B, state.C);
    return { ...state, K: ai };
  }

  /** Everything the drawing needs; every field is plain data. */
  function figure(state) {
    const { A, B, C, K } = state;
    const cc = circumcircle(A, B, C);
    const I = incenter(A, B, C);
    const E = excenter(A, B, C);
    const ra = E ? distToLine(E, B, C) : null;
    const Ai = I ? foot(I, B, C) : null;
    const cB = cc ? tangentCircle(A, cc.center, cc.radius, B, C, K, B) : null;
    const cC = cc ? tangentCircle(A, cc.center, cc.radius, C, B, K, C) : null;
    const V = E ? foot(E, B, C) : null;
    const W = E && V ? reflect(V, E) : null;
    let H = null, O = null;
    if (W && cB && cB.bc && cB.ak) {
      // H = BC ∩ the line through W parallel to the contact chord of cB.
      const parallel = add(W, sub(cB.ak, cB.bc));
      H = intersection(W, parallel, B, C);
      if (H) O = mid(W, H);
    }
    const finished = !!(ra && cB && cC &&
      Math.abs(cB.radius / ra - 1) < 0.01 && Math.abs(cC.radius / ra - 1) < 0.01);
    return {
      circumcircle: cc, incenter: I, incircleTouch: Ai,
      excenter: E, exradius: ra, circles: [cB, cC],
      V, W, H, O, finished,
    };
  }

  /** The demo has no win or loss; "done" is the applet's equal-radii signal. */
  function result(state) {
    return figure(state).finished ? "done" : null;
  }

  /** Plain-data position for the player's record and the tutor. */
  function position(state) {
    return {
      A: { ...state.A }, B: { ...state.B }, C: { ...state.C }, K: { ...state.K },
      showNames: !!state.showNames, showHint: !!state.showHint,
    };
  }

  return {
    start, move, snapToIncircle, figure, result, position,
    foot, distToLine, intersection, mid, add, sub, scale, dot, cross,
    dist, unit, circumcircle, incenter, excenter, tangentCircle,
  };
})();
