"use strict";

/*
 * Max Common Chord 2 — Alexander Bogomolny's applet MaxCommonChord2, showing
 * Hubert Shutrick's synthetic properties of the 1975 USAMO chord problem.
 *
 * Two circles meet at P and Q.  A chord AB through P has its ends on the two
 * circles.  E and F are the circle centres; O is the circumcentre of E, F, Q;
 * C(O) is the circle through E, F and Q.  L and M are its second meetings with
 * the two circles and S = AL ∩ BM.  The invariant behind the whole page is
 * that S is the centre of the circumcircle of A, B, Q and always lies on C(O).
 * Consequently SA = SB = SQ.  When AQ is a diameter of the first circle, so
 * is BQ a diameter of the second and AB is the longest chord through P.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, MaxCommonChord2Core, so the page loads it
 * with a plain <script> and porting/check-max-common-chord-2.mjs loads it in
 * Node.  Positions are plain data in the applet's 640 by 460 viewBox units.
 *
 * The arithmetic is a direct transcription of the bytecode:
 *   Canvas.init():   P=(W/2, 2H/5+H/5), Q=(W/2, 3H/5+H/5),
 *                    A=(3W/10, H/2+H/5), B=(17W/20, 3H/5+H/5),
 *                    CircleE = GetCircle(A,P,Q), CircleF = GetCircle(B,P,Q),
 *                    Fix(B, CircleF, A).
 *   GetCircle():     centre = GeoSDoub.FindCircumcenter(a,b,c); radius =
 *                    (dist(centre,a)+dist(centre,b)+dist(centre,c))/3.
 *   Compute():       CircleEQF = GetCircle(E,F,Q),
 *                    CircleAB = GetCircle(A,B,Q),
 *                    R = Other(Intersect(CircleAB, PQ), Q),
 *                    L = Other(Intersect(CircleEQF, CircleE), Q),
 *                    M = Other(Intersect(CircleEQF, CircleF), Q),
 *                    S = Intersect(line(A,L), line(B,M)),
 *                    Finished = |2*dist(Q,E) - dist(Q,A)| < 0.01.
 *   Fix(target,circle,other): intersect the circle with the line other-P and
 *                    move target to the intersection returned by Other(.,P).
 *   Drag A/B:        in "circles" mode rebuild that circle from A/P/Q (or
 *                    B/P/Q); in "chord" mode project the dragged point back
 *                    onto the existing circle; then Fix the other endpoint.
 * The four checkboxes of the panel are shown as two display boxes and a pair
 * of Adjust buttons; Show hint and Show names start unchecked, Adjust circles
 * starts checked.  All the guards (|denominator| < 1, the 2-pixel and 1-pixel
 * distance tests, the 0.01 finish test) are kept exactly.
 */
const MaxCommonChord2Core = (() => {
  const VIEW = { width: 640, height: 460 };
  const RAW_START = {
    P: { x: VIEW.width / 2, y: (VIEW.height * 2) / 5 + VIEW.height / 5 },
    Q: { x: VIEW.width / 2, y: (VIEW.height * 3) / 5 + VIEW.height / 5 },
    A: { x: (VIEW.width * 3) / 10, y: VIEW.height / 2 + VIEW.height / 5 },
    B: { x: (VIEW.width * 17) / 20, y: (VIEW.height * 3) / 5 + VIEW.height / 5 },
  };
  const HANDLES = ["P", "Q", "A", "B"];
  const OPTIONS = ["names", "hint"];
  const FINISH_TOL = 0.01;
  const PAD = 12;

  const pt = (x, y) => ({ x: x, y: y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const mul = (p, k) => pt(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const tol = () => 1e-7 * VIEW.width;

  /* GeoSDoub.Intersect(DoubPoint×4): |determinant| < 1 gives (NaN,NaN). */
  function intersect(a, b, c, d) {
    const a1 = b.y - a.y, b1 = a.x - b.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = d.y - c.y, b2 = c.x - d.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (!(Math.abs(den) >= 1)) return pt(NaN, NaN);
    return pt((c1 * b2 - c2 * b1) / den, (a1 * c2 - a2 * c1) / den);
  }

  /* GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const m1 = pt((p.x + q.x) / 2, (p.y + q.y) / 2);
    const m2 = pt((q.x + r.x) / 2, (q.y + r.y) / 2);
    const v1 = pt(m1.x + q.y - p.y, m1.y - (q.x - p.x));
    const v2 = pt(m2.x + r.y - q.y, m2.y - (r.x - q.x));
    return intersect(m1, v1, m2, v2);
  }

  /* GetCircle: circumcentre with the *average* of the three distances as radius. */
  function circle(p, q, r) {
    const c = circumcenter(p, q, r);
    return { x: c.x, y: c.y, radius: (dist(c, p) + dist(c, q) + dist(c, r)) / 3 };
  }

  /* GeoSDoub.Intersect(DoubLine, DoubCircle): slope form, with root ordering. */
  function circleLine(c, p, q) {
    if (Math.abs(p.y - q.y) > 1) {
      const m = (p.x - q.x) / (p.y - q.y);
      const b = q.x - m * q.y;
      const aa = m * m + 1;
      const bb = m * (b - c.x) - c.y;
      const cc = (b - c.x) * (b - c.x) + c.y * c.y - c.radius * c.radius;
      const disc = bb * bb - aa * cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
      return [pt(m * t1 + b, t1), pt(m * t2 + b, t2)];
    }
    if (Math.abs(p.x - q.x) > 1) {
      const m = (p.y - q.y) / (p.x - q.x);
      const b = q.y - m * q.x;
      const aa = m * m + 1;
      const bb = m * (b - c.y) - c.x;
      const cc = (b - c.y) * (b - c.y) + c.x * c.x - c.radius * c.radius;
      const disc = bb * bb - aa * cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
      return [pt(t1, m * t1 + b), pt(t2, m * t2 + b)];
    }
    return null;
  }

  /* GeoSDoub.Intersect(DoubCircle, DoubCircle): radical-axis slope form. */
  function circleCircle(c1, c2) {
    if (Math.abs(c1.x - c2.x) > 1) {
      const m = -(c1.y - c2.y) / (c1.x - c2.x);
      const b = (c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y
        - c1.radius * c1.radius + c2.radius * c2.radius) / (2 * (c1.x - c2.x));
      const aa = b - c1.x;
      const bb = m * aa - c1.y;
      const cc = aa * aa + c1.y * c1.y - c1.radius * c1.radius;
      const disc = bb * bb - (m * m + 1) * cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const den = m * m + 1;
      const t1 = (-bb + root) / den, t2 = (-bb - root) / den;
      return [pt(m * t1 + b, t1), pt(m * t2 + b, t2)];
    }
    if (Math.abs(c1.y - c2.y) > 1) {
      const m = -(c1.x - c2.x) / (c1.y - c2.y);
      const b = (c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y
        - c1.radius * c1.radius + c2.radius * c2.radius) / (2 * (c1.y - c2.y));
      const aa = b - c1.y;
      const bb = m * aa - c1.x;
      const cc = aa * aa + c1.x * c1.x - c1.radius * c1.radius;
      const disc = bb * bb - (m * m + 1) * cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const den = m * m + 1;
      const t1 = (-bb + root) / den, t2 = (-bb - root) / den;
      return [pt(t1, m * t1 + b), pt(t2, m * t2 + b)];
    }
    return [pt(c1.x, c1.y), pt(c1.x, c1.y)];
  }

  /* Canvas.Other(points, reference): points[1] only if points[0] is within
   * one unit of the reference; otherwise points[0], the far intersection. */
  function other(points, reference) {
    if (!points || !points[0] || !points[1]) return null;
    return dist(points[0], reference) < 1 ? points[1] : points[0];
  }

  /* Canvas.Fix(target, circle, otherPoint): keep the chord through P. */
  function fix(target, c, otherPoint, P) {
    if (dist(otherPoint, P) < 1) return null;
    const chosen = other(circleLine(c, otherPoint, P), P);
    return chosen ? pt(chosen.x, chosen.y) : null;
  }

  /* CTKMoveableDoub.UpdateLocation under STAY_ON_CIRCLE: radial projection. */
  function project(p, c) {
    const d = dist(p, c);
    if (!(d > 0) || !Number.isFinite(d)) return pt(p.x, p.y);
    return pt(c.x + ((p.x - c.x) * c.radius) / d, c.y + ((p.y - c.y) * c.radius) / d);
  }

  function clamp(p) {
    return pt(Math.min(VIEW.width - PAD, Math.max(PAD, p.x)),
      Math.min(VIEW.height - PAD, Math.max(PAD, p.y)));
  }

  function start() {
    const state = {
      P: pt(RAW_START.P.x, RAW_START.P.y),
      Q: pt(RAW_START.Q.x, RAW_START.Q.y),
      A: pt(RAW_START.A.x, RAW_START.A.y),
      B: pt(RAW_START.B.x, RAW_START.B.y),
      options: { names: false, hint: false },
      adjust: "circles",
      explored: false,
    };
    /* init() finishes B on CircleF along line A-P. */
    const cF = circle(state.B, state.P, state.Q);
    const fixed = fix(state.B, cF, state.A, state.P);
    if (fixed) state.B = fixed;
    return state;
  }

  function reset(state) {
    const next = start();
    next.options = Object.assign({}, state.options);
    next.adjust = state.adjust;
    next.explored = !!state.explored;
    return next;
  }

  function move(state, name, p) {
    if (HANDLES.indexOf(name) < 0 || !finite(p)) return state;
    const next = Object.assign({}, state);
    next[name] = clamp(p);
    next.explored = true;
    if (name === "A" || name === "B") {
      // "Adjust chord" glides the pointer onto the circle drawn before this
      // drag, not onto the circle rebuilt from the pointer position.
      const c = circle(state[name], state.P, state.Q);
      if (state.adjust === "chord") next[name] = project(next[name], c);
      const otherName = name === "A" ? "B" : "A";
      const otherCircle = circle(next[otherName], next.P, next.Q);
      const fixed = fix(next[otherName], otherCircle, next[name], next.P);
      if (fixed) next[otherName] = fixed;
    }
    return next;
  }

  function setOption(state, name, on) {
    if (OPTIONS.indexOf(name) < 0) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }), explored: true,
    });
  }

  function setAdjust(state, mode) {
    if (mode !== "circles" && mode !== "chord") return state;
    return Object.assign({}, state, { adjust: mode, explored: true });
  }

  /** Put A at the point of CircleE opposite Q, then keep AB through P. */
  function optimal(state) {
    const c = circle(state.A, state.P, state.Q);
    if (!finite(c)) return state;
    return move(state, "A", pt(2 * c.x - state.Q.x, 2 * c.y - state.Q.y));
  }

  const angle = (p, v, q) => {
    const a = dist(v, p), b = dist(v, q), c = dist(p, q);
    if (a < 1e-12 || b < 1e-12) return NaN;
    const k = (a * a + b * b - c * c) / (2 * a * b);
    return Math.acos(Math.max(-1, Math.min(1, k)));
  };

  /** Canvas.Compute(), plus the measurements that check the page's claims. */
  function compute(state) {
    const { P, Q, A, B } = state;
    if (![A, P, Q, B].every(finite)) return null;
    if (dist(A, P) < 2 || dist(A, Q) < 2 || dist(B, P) < 2 || dist(B, Q) < 2 || dist(P, Q) < 1) return null;

    const E = circle(A, P, Q);
    const F = circle(B, P, Q);
    const O = circle(E, F, Q);
    const ABQ = circle(A, B, Q);
    const R = other(circleLine(ABQ, P, Q), Q);
    if (!R || dist(P, R) < 1) return null;
    const L = other(circleCircle(O, E), Q);
    const M = other(circleCircle(O, F), Q);
    if (!L || !M) return null;
    const S = intersect(A, L, B, M);
    const LSQ = finite(S) ? circle(L, S, Q) : null;
    const ok = [E, F, O, ABQ, R, L, M, S].every((v) => finite(v))
      && Number.isFinite(E.radius) && Number.isFinite(F.radius)
      && Number.isFinite(O.radius) && Number.isFinite(ABQ.radius);

    const sa = ok ? dist(S, A) : NaN;
    const sb = ok ? dist(S, B) : NaN;
    const sq = ok ? dist(S, Q) : NaN;
    const ap = dist(A, P), pb = dist(P, B), ab = dist(A, B);
    const saSb = Math.abs(sa - sb), saSq = Math.abs(sa - sq), sbSq = Math.abs(sb - sq);
    const sOnO = ok ? Math.abs(dist(S, O) - O.radius) : NaN;
    const centerOnO = ok ? Math.abs(dist(ABQ, O) - O.radius) : NaN;
    const sIsCenter = ok ? dist(S, ABQ) : NaN;
    const cyclic = ok && LSQ && finite(LSQ) ? Math.abs(dist(M, LSQ) - LSQ.radius) : NaN;
    const bisect = ok ? Math.abs(angle(L, Q, P) - angle(P, Q, M)) : NaN;
    const crossErr = Math.abs(cross(sub(A, P), sub(B, P))) / Math.max(1e-12, VIEW.width);
    const diameterErr = ok ? Math.abs(2 * dist(Q, E) - dist(Q, A)) : NaN;
    const bDiameterErr = ok ? Math.abs(2 * dist(Q, F) - dist(Q, B)) : NaN;
    const t = tol();

    const measures = {
      sa: sa, sb: sb, sq: sq, ap: ap, pb: pb, ab: ab,
      apPb: ap * pb, saSb: saSb, saSq: saSq, sbSq: sbSq,
      sOnO: sOnO, centerOnO: centerOnO, sIsCenter: sIsCenter,
      cyclic: cyclic, bisect: bisect, crossErr: crossErr,
      diameterErr: diameterErr, bDiameterErr: bDiameterErr,
    };
    const claims = {
      valid: ok,
      throughP: ok && crossErr <= t,
      sOnO: ok && sOnO <= t,
      centerOnO: ok && centerOnO <= t,
      sIsCenter: ok && sIsCenter <= t,
      lsmqCyclic: ok && cyclic <= t,
      equalRadii: ok && saSb <= t && saSq <= t && sbSq <= t,
      bisector: ok && bisect <= t,
      finished: ok && diameterErr < FINISH_TOL,
      bothDiameters: ok && diameterErr < FINISH_TOL && bDiameterErr < FINISH_TOL,
    };
    return {
      E: E, F: F, O: O, ABQ: ABQ, LSQ: LSQ,
      P: P, Q: Q, A: A, B: B, R: R, L: L, M: M, S: S,
      measures: measures, claims: claims, tol: t, finishTol: FINISH_TOL,
    };
  }

  function geometry(state) {
    return compute(state);
  }

  /* A picture, not a game: no win and no loss. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = compute(state);
    if (!g) return "Move the four dots so each circle has two separate points and the chord through P is long enough.";
    if (!g.claims.valid) return "These positions make one of the circles impossible to draw. Move A or B to try again.";
    if (g.claims.finished) {
      let text = "AQ is now a diameter: SA, SB and SQ are equal, and AB is the longest chord through P.";
      if (state.options.hint) text += " The arcs show the equal angles that prove it.";
      if (state.options.names) text += " The points are labelled A, B, P, Q, L, M, S, E, F and O.";
      return text;
    }
    let text = "S lies on the third circle and is the centre of the circle through A, B and Q.";
    if (state.options.hint) text += " The arcs show the equal angles at Q and S.";
    if (state.options.names) text += " The points are labelled A, B, P, Q, L, M, S, E, F and O.";
    return text;
  }

  function position(state) {
    const g = compute(state);
    return {
      P: state.P, Q: state.Q, A: state.A, B: state.B,
      options: Object.assign({}, state.options), adjust: state.adjust,
      E: g ? g.E : null, F: g ? g.F : null, O: g ? g.O : null,
      S: g ? g.S : null, L: g ? g.L : null, M: g ? g.M : null,
      finished: g ? g.claims.finished : false,
    };
  }

  return {
    VIEW: VIEW, RAW_START: RAW_START, HANDLES: HANDLES, OPTIONS: OPTIONS,
    FINISH_TOL: FINISH_TOL,
    point: pt, add: add, sub: sub, mul: mul, dot: dot, cross: cross, dist: dist,
    finite: finite, intersect: intersect, circumcenter: circumcenter, circle: circle,
    circleLine: circleLine, circleCircle: circleCircle, other: other, fix: fix,
    project: project, clamp: clamp, angle: angle,
    start: start, reset: reset, move: move, setOption: setOption,
    setAdjust: setAdjust, optimal: optimal, compute: compute, geometry: geometry,
    result: result, describe: describe, position: position,
  };
})();
