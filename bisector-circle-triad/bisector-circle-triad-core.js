"use strict";

/*
 * Bisector Circle Triad — the construction behind Bogomolny's "Three
 * Congruent Circles by Reflection II" (a theorem of Quang Tuan Bui).
 *
 * Reflect each vertex of a triangle in the two angle bisectors through the
 * other vertices. The circumcircles of A Cb Bc, B Ac Ca and C Ba Ab then have
 * the same radius; reflecting the six images a second time gives three more
 * circles of that same radius. The key identity is that, with L the incenter
 * and O the circumcenter, every one of those circles has radius |LO|, and
 * their centers all lie on the circle centered at L with radius R.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, BisectorCircleTriadCore, so the page loads
 * it with a plain <script> and porting/check-bisector-circle-triad.mjs loads
 * it in Node. All functions take plain data and return new objects.
 */
const BisectorCircleTriadCore = (() => {
  const EPS = 1e-9;

  /* The applet's seven Checkboxes. Only "ShowNames" is given a default of 1. */
  const OPTION_KEYS = ["names", "bisectors", "reflections", "small", "triangles", "big", "isogonal"];
  const DEFAULT_OPTIONS = {
    names: true, bisectors: false, reflections: false, small: false,
    triangles: false, big: false, isogonal: false,
  };

  function options(given) {
    const out = { ...DEFAULT_OPTIONS };
    if (given) for (const key of OPTION_KEYS) if (key in given) out[key] = Boolean(given[key]);
    return out;
  }

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const vec = (p, q) => ({ x: q.x - p.x, y: q.y - p.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const same = (p, q, tol) =>
    Boolean(p) && Boolean(q) && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;

  /** The position the applet's init() gives a 400x300 canvas. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return { A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C } };
    }
    const w = o.width === undefined ? 400 : o.width;
    const h = o.height === undefined ? 300 : o.height;
    return {
      A: { x: (2 * w) / 5, y: h / 3 },
      B: { x: w / 3, y: (2 * h) / 3 },
      C: { x: (3 * w) / 4, y: (2 * h) / 3 },
    };
  }

  function sides(s) {
    return { a: distance(s.B, s.C), b: distance(s.C, s.A), c: distance(s.A, s.B) };
  }

  function doubleArea(s) {
    return Math.abs(cross(s.A, s.B, s.C));
  }

  function isDegenerate(s) {
    const l = sides(s);
    const scale = Math.max(l.a, l.b, l.c);
    return scale < EPS || doubleArea(s) < 1e-9 * scale * scale;
  }

  /* The incenter, as side-length barycentric weights: (aA+bB+cC)/(a+b+c). */
  function incenter(s) {
    if (isDegenerate(s)) return null;
    const { a, b, c } = sides(s);
    const sum = a + b + c;
    return {
      x: (a * s.A.x + b * s.B.x + c * s.C.x) / sum,
      y: (a * s.A.y + b * s.B.y + c * s.C.y) / sum,
    };
  }

  /* Where the internal bisector at a vertex meets the opposite side. */
  function bisectorFoot(s, vertex) {
    if (isDegenerate(s)) return null;
    const { a, b, c } = sides(s);
    if (vertex === "A") return { x: (b * s.B.x + c * s.C.x) / (b + c), y: (b * s.B.y + c * s.C.y) / (b + c) };
    if (vertex === "B") return { x: (a * s.A.x + c * s.C.x) / (a + c), y: (a * s.A.y + c * s.C.y) / (a + c) };
    if (vertex === "C") return { x: (a * s.A.x + b * s.B.x) / (a + b), y: (a * s.A.y + b * s.B.y) / (a + b) };
    return null;
  }

  /** GeoSDoub.NearestPoint: the foot on the infinite line xy; reflect p in it. */
  function reflect(p, x, y) {
    const d = sub(y, x);
    const len2 = dot(d, d);
    if (len2 <= EPS * EPS) return { x: 2 * x.x - p.x, y: 2 * x.y - p.y };
    const t = dot(sub(p, x), d) / len2;
    return { x: 2 * (x.x + t * d.x) - p.x, y: 2 * (x.y + t * d.y) - p.y };
  }

  /** The applet's Translate(center, p, q): move p to q, carrying center along. */
  function translate(center, p, q) {
    return add(center, sub(q, p));
  }

  /*
   * GeoSDoub.FindCircumcenter: intersect the perpendicular bisectors of PQ and
   * QR. DoubCircle then takes the mean of the three distances as its radius.
   */
  function circumcircle(p, q, r) {
    if (!p || !q || !r) return null;
    const a1 = q.x - p.x, b1 = q.y - p.y;
    const c1 = (q.x * q.x + q.y * q.y - p.x * p.x - p.y * p.y) / 2;
    const a2 = r.x - q.x, b2 = r.y - q.y;
    const c2 = (r.x * r.x + r.y * r.y - q.x * q.x - q.y * q.y) / 2;
    const det = a1 * b2 - a2 * b1;
    const scale = Math.max(distance(p, q), distance(q, r), distance(r, p));
    if (!Number.isFinite(det) || Math.abs(det) <= EPS * scale * scale) return null;
    const center = {
      x: (c1 * b2 - c2 * b1) / det,
      y: (a1 * c2 - a2 * c1) / det,
    };
    const radius = (distance(center, p) + distance(center, q) + distance(center, r)) / 3;
    if (!Number.isFinite(radius)) return null;
    return { center, radius };
  }

  /** Shortest distance to the infinite line xy, for describing reflections. */
  function distToLine(p, x, y) {
    const len = distance(x, y);
    return len < EPS ? Infinity : Math.abs(cross(x, y, p)) / len;
  }

  /** Line through p and q clipped to a rectangle, for drawing the bisectors. */
  function clipToBox(p, q, box) {
    const dx = q.x - p.x, dy = q.y - p.y;
    if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return [p, q];
    const ts = [];
    if (Math.abs(dx) > EPS) {
      ts.push((box.x - p.x) / dx, (box.x + box.width - p.x) / dx);
    }
    if (Math.abs(dy) > EPS) {
      ts.push((box.y - p.y) / dy, (box.y + box.height - p.y) / dy);
    }
    const lo = Math.max(0, Math.min(...ts));
    const hi = Math.min(1, Math.max(...ts));
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [p, q];
    return [
      { x: p.x + dx * lo, y: p.y + dy * lo },
      { x: p.x + dx * hi, y: p.y + dy * hi },
    ];
  }

  /* GeoSDoub.Intersect on two lines, in the applet's ax+by+c=0 form. */
  function lineIntersection(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /* The same intersection with unit directions: the applet's |det| < 1 test
     loses the point on nearly equilateral triangles, where Oa is close to A. */
  function lineIntersectionStable(p1, p2, p3, p4) {
    const d1 = sub(p2, p1), d2 = sub(p4, p3);
    const n1 = Math.hypot(d1.x, d1.y), n2 = Math.hypot(d2.x, d2.y);
    if (n1 <= EPS || n2 <= EPS) return null;
    const u = { x: d1.x / n1, y: d1.y / n1 };
    const v = { x: d2.x / n2, y: d2.y / n2 };
    const det = u.x * v.y - u.y * v.x;
    if (Math.abs(det) < 1e-12) return null;
    const w = sub(p3, p1);
    const t = (w.x * v.y - w.y * v.x) / det;
    return add(p1, { x: u.x * t, y: u.y * t });
  }

  /** Everything in Compute() and Draw() of the original applet. */
  function compute(s, box) {
    if (isDegenerate(s)) return { valid: false, A: s.A, B: s.B, C: s.C };
    const abc = circumcircle(s.A, s.B, s.C);
    if (!abc) return { valid: false, A: s.A, B: s.B, C: s.C };
    const O = abc.center, R = abc.radius;
    const L = incenter(s);
    const La = bisectorFoot(s, "A"), Lb = bisectorFoot(s, "B"), Lc = bisectorFoot(s, "C");

    const Ab = reflect(s.A, s.B, Lb);
    const Ac = reflect(s.A, s.C, Lc);
    const Ba = reflect(s.B, s.A, La);
    const Bc = reflect(s.B, s.C, Lc);
    const Ca = reflect(s.C, s.A, La);
    const Cb = reflect(s.C, s.B, Lb);

    const A1b = reflect(Ab, s.C, Lc);
    const A1c = reflect(Ac, s.B, Lb);
    const B1a = reflect(Ba, s.C, Lc);
    const B1c = reflect(Bc, s.A, La);
    const C1a = reflect(Ca, s.B, Lb);
    const C1b = reflect(Cb, s.A, La);

    const X = translate(O, s.B, C1a);
    const Y = translate(O, s.C, A1b);
    const Z = translate(O, s.A, B1c);

    const circleA = circumcircle(s.A, Cb, Bc);
    const circleB = circumcircle(s.B, Ac, Ca);
    const circleC = circumcircle(s.C, Ba, Ab);
    const circle1A = circumcircle(s.A, C1b, B1c);
    const circle1B = circumcircle(s.B, A1c, C1a);
    const circle1C = circumcircle(s.C, B1a, A1b);
    const circleL = circumcircle(X, Y, Z);
    const circle1 = circle1A && circle1B && circle1C
      ? circumcircle(circle1A.center, circle1B.center, circle1C.center)
      : null;

    /*
     * IsogonalConjugate(). DoubCircle extends DoubPoint: its x,y are the
     * circle's center, so GeoSDoub.Intersect(A, CircleA, B, CircleB) is the
     * intersection of the lines A-Oa and B-Ob (not of the circles).
     */
    const sA = circleA && circleB ? lineIntersectionStable(s.A, circleA.center, s.B, circleB.center) : null;
    const sB = circleB && circleC ? lineIntersectionStable(s.B, circleB.center, s.C, circleC.center) : null;
    const sC = circleC && circleA ? lineIntersectionStable(s.C, circleC.center, s.A, circleA.center) : null;
    const P = sA && sB && sC
      ? { x: (sA.x + sB.x + sC.x) / 3, y: (sA.y + sB.y + sC.y) / 3 }
      : null;

    const bis = {
      A: box ? clipToBox(s.A, La, box) : [s.A, La],
      B: box ? clipToBox(s.B, Lb, box) : [s.B, Lb],
      C: box ? clipToBox(s.C, Lc, box) : [s.C, Lc],
    };

    return {
      valid: true, A: s.A, B: s.B, C: s.C, O, R, L,
      r: doubleArea(s) / (sides(s).a + sides(s).b + sides(s).c),
      feet: { La, Lb, Lc },
      reflected: { Ab, Ac, Ba, Bc, Ca, Cb },
      primed: { A1b, A1c, B1a, B1c, C1a, C1b },
      X, Y, Z,
      circles: {
        abc, A: circleA, B: circleB, C: circleC,
        A1: circle1A, B1: circle1B, C1: circle1C,
        L: circleL, one: circle1,
      },
      bisectors: bis,
      P,
    };
  }

  /*
   * Every statement on the article, checked numerically at this triangle.
   * Tolerances are relative to the circumradius, so the tests work for both
   * the 400x300 applet canvas and a phone-sized board.
   */
  function claims(s) {
    const d = compute(s);
    if (!d.valid) {
      return {
        circumcircle: false, reflections: false, translations: false,
        mainTriad: false, sixCircles: false, radiusLO: false,
        OXYZconcyclic: false, centersOnCircle: false, isogonalOnCircumcircle: false,
      };
    }
    const tol = 1e-6 * Math.max(d.R, 1);
    const equalNums = (...xs) => xs.every((x) => Number.isFinite(x) && Math.abs(x - xs[0]) <= tol);
    const r = d.circles.A && d.circles.B && d.circles.C
      ? [d.circles.A.radius, d.circles.B.radius, d.circles.C.radius] : [];
    const r1 = d.circles.A1 && d.circles.B1 && d.circles.C1
      ? [d.circles.A1.radius, d.circles.B1.radius, d.circles.C1.radius] : [];
    const LO = distance(d.L, d.O);
    const { Ab, Ac, Ba, Bc, Ca, Cb } = d.reflected;
    const { A1b, A1c, B1a, B1c, C1a, C1b } = d.primed;
    const eqVec = (u, v) => same(vec(u.p, u.q), vec(v.p, v.q), tol);
    const centers = [
      d.circles.A, d.circles.B, d.circles.C,
      d.circles.A1, d.circles.B1, d.circles.C1,
    ];
    return {
      circumcircle: equalNums(
        distance(d.O, s.A), distance(d.O, s.B), distance(d.O, s.C),
      ),
      reflections: [
        [s.A, Ab, s.B, d.feet.Lb], [s.A, Ac, s.C, d.feet.Lc],
        [s.B, Ba, s.A, d.feet.La], [s.B, Bc, s.C, d.feet.Lc],
        [s.C, Ca, s.A, d.feet.La], [s.C, Cb, s.B, d.feet.Lb],
      ].every(([p, q, x, y]) =>
        same(reflect(q, x, y), p, tol) && same(reflect(p, x, y), q, tol)),
      translations:
        eqVec({ p: s.B, q: C1a }, { p: s.C, q: B1a }) &&
        eqVec({ p: s.C, q: A1b }, { p: s.A, q: C1b }) &&
        eqVec({ p: s.A, q: B1c }, { p: s.B, q: A1c }) &&
        same(d.X, translate(d.O, s.B, C1a), tol) &&
        same(d.Y, translate(d.O, s.C, A1b), tol) &&
        same(d.Z, translate(d.O, s.A, B1c), tol),
      mainTriad: r.length === 3 && equalNums(...r),
      sixCircles: r.length === 3 && r1.length === 3 && equalNums(...r, ...r1),
      radiusLO: r.length === 3 && equalNums(...r, LO),
      OXYZconcyclic: Boolean(d.X && d.Y && d.Z) && equalNums(
        LO, distance(d.L, d.X), distance(d.L, d.Y), distance(d.L, d.Z),
      ),
      centersOnCircle: centers.every((c) => c && Math.abs(distance(d.L, c.center) - d.R) <= tol),
      isogonalOnCircumcircle: Boolean(d.P) && Math.abs(distance(d.P, d.O) - d.R) <= tol,
    };
  }

  /** A new position with one vertex moved; the other two stay put. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    OPTION_KEYS, DEFAULT_OPTIONS, options,
    start, sides, doubleArea, isDegenerate, distance, cross, dot, vec, add, sub,
    incenter, bisectorFoot, reflect, translate, circumcircle, distToLine,
    clipToBox, lineIntersection, lineIntersectionStable, compute, claims, withPoint, result,
  };
})();
