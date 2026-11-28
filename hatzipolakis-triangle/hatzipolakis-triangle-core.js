"use strict";

/*
 * Hatzipolakis Triangle — the geometry behind Bogomolny's applet
 * HatzipolakisTriangle.
 *
 * In triangle ABC, D, E, F are the midpoints of BC, CA, AB; X, Y, Z are the
 * points where the incircle touches those sides; M and N are the feet of the
 * perpendiculars from A onto the bisectors BI and CI. The applet's page says
 * M, N, E, F are collinear and that X, Y, M and X, Z, N are straight lines.
 *
 * The one idea the code relies on: in the right triangle ABM the midpoint F
 * of the hypotenuse AB is the circumcentre, so FM = AF = BF = AB/2 and FM is
 * parallel to BC. Hence M lies on the midline EF; the tangent lengths then
 * give EM = |AB - BC|/2 = EY, which makes X, Y, M straight. Mirror the picture
 * in the bisector at C for N and Z.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, HatzipolakisTriangleCore, so the page loads it with a
 * plain <script> and porting/check-hatzipolakis-triangle.mjs loads it in Node.
 * All functions take plain data and return new objects; nothing passed in is
 * changed. The position is the three draggable vertices in board units.
 */
const HatzipolakisTriangleCore = (() => {
  const EPS = 1e-9;
  const WIDTH = 400;
  const HEIGHT = 300;
  /** HatzipolakisTriangleCanvas.Compute() refuses any triangle with a side under 2. */
  const MIN_SIDE = 2;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const unit = (p) => {
    const n = Math.hypot(p.x, p.y);
    return n < EPS ? { x: 1, y: 0 } : { x: p.x / n, y: p.y / n };
  };

  /** ax + by + c = 0 through p and q. */
  function line(p, q) {
    return { a: p.y - q.y, b: q.x - p.x, c: p.x * q.y - q.x * p.y };
  }

  function distToLine(p, l) {
    const n = Math.hypot(l.a, l.b);
    return n < EPS ? Infinity : Math.abs(l.a * p.x + l.b * p.y + l.c) / n;
  }

  /** GeoSDoub.NearestPoint(P, Q, R): the foot on the infinite line QR. */
  function foot(p, q, r) {
    const v = sub(r, q);
    const den = dot(v, v);
    if (den < 0.1) return { x: q.x, y: q.y }; // the applet returns Q here
    return add(q, mul(v, dot(sub(p, q), v) / den));
  }

  function intersectLines(l, m) {
    const det = l.a * m.b - m.a * l.b;
    if (Math.abs(det) < EPS) return null;
    return {
      x: (l.b * m.c - m.b * l.c) / det,
      y: (l.c * m.a - m.c * l.a) / det,
    };
  }

  /** Side-length-weighted incenter, the same point as GeoSDoub.FindIncenter. */
  function incenter(a, b, c) {
    const la = dist(b, c), lb = dist(c, a), lc = dist(a, b);
    const sum = la + lb + lc;
    if (sum < EPS) return null;
    return {
      x: (la * a.x + lb * b.x + lc * c.x) / sum,
      y: (la * a.y + lb * b.y + lc * c.y) / sum,
    };
  }

  /** The (smaller) angle at v between the rays to p and q, in radians. */
  function angleAt(v, p, q) {
    const u = sub(p, v), w = sub(q, v);
    const n = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
    if (n < EPS) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(u, w) / n)));
  }

  /** Angle between two infinite lines, always in [0, PI/2]. */
  function lineAngle(l, m) {
    const n = Math.hypot(l.a, l.b) * Math.hypot(m.a, m.b);
    if (n < EPS) return 0;
    const v = Math.abs(l.a * m.a + l.b * m.b) / n;
    return Math.acos(Math.max(-1, Math.min(1, v)));
  }

  /**
   * The starting diagram, placed as HatzipolakisTriangleCanvas.init places it
   * on its canvas: A = (3W/4, H/7), B = (W/5, 4H/5), C = (5W/11, 6H/7), with
   * Java's integer division for each coordinate.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    return {
      A: { x: Math.trunc(width * 3 / 4), y: Math.trunc(height / 7) },
      B: { x: Math.trunc(width / 5), y: Math.trunc(height * 4 / 5) },
      C: { x: Math.trunc(width * 5 / 11), y: Math.trunc(height * 6 / 7) },
      width: width,
      height: height,
    };
  }

  /** A new position with one of A, B, C moved; never changes the old one. */
  function withPoint(s, name, p) {
    const next = {
      A: { x: s.A.x, y: s.A.y },
      B: { x: s.B.x, y: s.B.y },
      C: { x: s.C.x, y: s.C.y },
      width: s.width,
      height: s.height,
    };
    if (next[name]) next[name] = { x: p.x, y: p.y };
    return next;
  }

  /**
   * HatzipolakisTriangleCanvas.Compute(), with points instead of AWT objects.
   * I is the incenter; X, Y, Z its feet on BC, CA, AB (the tangency points);
   * D, E, F the midpoints; M = Ab the foot A -> BI, N = Ac the foot A -> CI.
   * The six other feet and the three named lines are kept because the applet
   * computes them too. The incircle radius is GetInTouchFrom's average of the
   * three distances from I, which is the inradius for a proper triangle.
   */
  function construction(s) {
    const A = s.A, B = s.B, C = s.C;
    const sides = { a: dist(B, C), b: dist(C, A), c: dist(A, B) };
    const bad = {
      ok: false, sides: sides, I: null, D: null, E: null, F: null,
      X: null, Y: null, Z: null, M: null, N: null, radius: null,
      Ab: null, Ac: null, Ba: null, Bc: null, Ca: null, Cb: null,
      AB: null, BC: null, CA: null, AI: null, BI: null, CI: null,
      XY: null, YZ: null, ZX: null, EF: null, cabart: null,
    };
    if (sides.a < MIN_SIDE || sides.b < MIN_SIDE || sides.c < MIN_SIDE) return bad;

    const I = incenter(A, B, C);
    if (!I || !Number.isFinite(I.x) || !Number.isFinite(I.y)) return bad;
    const X = foot(I, B, C), Y = foot(I, C, A), Z = foot(I, A, B);
    const D = midpoint(B, C), E = midpoint(C, A), F = midpoint(A, B);
    const M = foot(A, I, B), N = foot(A, I, C);
    const radius = (dist(I, X) + dist(I, Y) + dist(I, Z)) / 3;

    /* In Cabart's proof D is reused for the point where AM meets BC. */
    const cabart = intersectLines(line(A, M), line(B, C));

    return {
      ok: true, sides: sides, I: I, D: D, E: E, F: F,
      X: X, Y: Y, Z: Z, M: M, N: N, radius: radius,
      Ab: M, Ac: N,
      Ba: foot(B, A, C), Bc: foot(B, C, A),
      Ca: foot(C, A, B), Cb: foot(C, B, A),
      AB: line(A, B), BC: line(B, C), CA: line(C, A),
      AI: line(A, I), BI: line(B, I), CI: line(C, I),
      XY: line(X, Y), YZ: line(Y, Z), ZX: line(Z, X), EF: line(E, F),
      cabart: cabart,
    };
  }

  /** Lengths used by the status line and by the logic test. */
  function measurements(s) {
    const c = construction(s);
    if (!c.ok) return { ok: false, scale: 1 };
    const scale = Math.max(c.sides.a, c.sides.b, c.sides.c);
    return {
      ok: true,
      scale: scale,
      sides: c.sides,
      radius: c.radius,
      FM: dist(c.F, c.M), AF: dist(s.A, c.F), BF: dist(s.B, c.F),
      EN: dist(c.E, c.N), AE: dist(s.A, c.E), CE: dist(s.C, c.E),
      EM: dist(c.E, c.M), EY: dist(c.E, c.Y),
      FN: dist(c.F, c.N), FZ: dist(c.F, c.Z),
      angleXCE: angleAt(s.C, c.X, c.E),
      angleCEM: angleAt(c.E, s.C, c.M),
      angleXYC: angleAt(s.C, c.Y, c.X),
      angleEYM: angleAt(c.E, c.Y, c.M),
    };
  }

  /** Every claim on the cut-the-knot page, checked at this configuration. */
  function claims(s) {
    const c = construction(s);
    const m = measurements(s);
    const falseClaims = {
      mnEfCollinear: false, xyMCollinear: false, xzNCollinear: false,
      rightAtM: false, rightAtN: false,
      fmHalfAB: false, fmEqualsAF: false, fmEqualsBF: false,
      enHalfAC: false, emEqualsEy: false, fnEqualsFz: false,
      lengthChain: false, tangentLengths: false,
      cabartMidpoint: false, angleXceEqualsCem: false,
      angleXycEqualsEym: false, claimLinesParallel: false,
    };
    if (!c.ok) return falseClaims;

    const tol = 1e-6 * m.scale;
    const near = (u, v) => Math.abs(u - v) <= tol;
    const on = (p, l) => distToLine(p, l) <= tol;
    const tangentOnAC = dist(s.A, c.Y), tangentOnAB = dist(s.A, c.Z);
    const tangentFromC = [dist(s.C, c.X), dist(s.C, c.Y)];
    const tangentFromB = [dist(s.B, c.X), dist(s.B, c.Z)];
    const midCabart = c.cabart ? midpoint(s.A, c.cabart) : null;

    return {
      /* The two numbered claims on the page. */
      mnEfCollinear: on(c.M, c.EF) && on(c.N, c.EF),
      xyMCollinear: on(c.X, c.XY) && on(c.M, c.XY),
      xzNCollinear: on(c.Z, c.ZX) && on(c.N, c.ZX),
      /* The steps of the page's proof. */
      rightAtM: Math.abs(dot(sub(s.A, c.M), sub(s.B, c.M))) <= tol * m.scale,
      rightAtN: Math.abs(dot(sub(s.A, c.N), sub(s.C, c.N))) <= tol * m.scale,
      fmHalfAB: near(m.FM, c.sides.c / 2),
      fmEqualsAF: near(m.FM, m.AF),
      fmEqualsBF: near(m.FM, m.BF),
      enHalfAC: near(m.EN, c.sides.b / 2),
      emEqualsEy: near(m.EM, m.EY),
      fnEqualsFz: near(m.FN, m.FZ),
      /* The signed chain EM = AB/2 - BC/2 = EY holds in length as |AB-BC|/2. */
      lengthChain: near(m.EM, Math.abs(c.sides.c - c.sides.a) / 2),
      tangentLengths: near(tangentOnAC, tangentOnAB) &&
        near(tangentFromC[0], tangentFromC[1]) &&
        near(tangentFromB[0], tangentFromB[1]),
      /* Cabart reuses the letter D for AM ∩ BC; M is the midpoint of A and it. */
      cabartMidpoint: Boolean(midCabart) && dist(c.M, midCabart) <= tol &&
        on(c.cabart, c.BC),
      /* The page compares angles; as angles between lines these always match,
         and the final pair matches as ordinary angles too. */
      angleXceEqualsCem: Math.abs(m.angleXCE - m.angleCEM) <= 1e-7 ||
        Math.abs(m.angleXCE + m.angleCEM - Math.PI) <= 1e-7,
      angleXycEqualsEym: Math.abs(m.angleXYC - m.angleEYM) <= 1e-7,
      claimLinesParallel: Math.abs(cross(c.E, c.F, c.M)) <= tol * m.scale,
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, WIDTH, HEIGHT, MIN_SIDE,
    add, sub, mul, dot, cross, dist, midpoint, unit,
    line, distToLine, foot, intersectLines, incenter, angleAt, lineAngle,
    start, withPoint, construction, measurements, claims, result,
  };
})();
