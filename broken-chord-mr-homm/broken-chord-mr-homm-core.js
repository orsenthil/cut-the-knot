"use strict";

/*
 * BrokenChordMrHomm — Alexander Bogomolny's "The Broken Chord Theorem"
 * (Mr Homm's applet).  A, B and C are draggable corners of a triangle on its
 * circumcircle.  P is the midpoint of the arc ACB; the foot of the
 * perpendicular from P to the longer of the chords AC and BC is M.  The
 * broken line from A through C to B is cut in half at M: when AC is longer,
 * AM = MC + CB (and symmetrically when BC is longer).
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, BrokenChordMrHommCore, so the page loads it
 * with a plain <script> and porting/check-broken-chord-mr-homm.mjs loads it in
 * Node.  Positions are plain objects in SVG viewBox units; every function
 * takes a position and returns a new one.
 *
 * The construction follows the applet's Compute(), FindP(), FindQ() and
 * FindF(): the circumcircle, the perpendicular bisector of AB to pick P on C's
 * side of AB, the foot on the longer chord, the far intersection Q of PM with
 * the circle, then F = AC ∩ BQ.
 */

const BrokenChordMrHommCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const HOME = { x: 200, y: 150, r: 90 }; // min(200,150) * 3/5, as in the applet
  const PAD = 18;

  const point = (x, y) => ({ x, y });
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** Angle at v between the rays v->p and v->q, in radians. */
  function angle(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const den = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!den) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / den)));
  }

  /* GeoSDoub.Intersect(line,circle) picks IntersectX when |dx| > 1 (and then
   * divides by dy), IntersectY when |dy| > 1 (dividing by dx), and gives up
   * when both are at most 1.  A zero divisor also makes its discriminant NaN.
   * The applet refuses to draw on such horizontal/vertical construction lines. */
  function canIntersectCircle(p, q) {
    const dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
    if (dx > 1) return dy !== 0;
    if (dy > 1) return dx !== 0;
    return false;
  }

  /* GeoSDoub.FindOrientation(p,q,r): its sign is the reverse of the usual
   * cross product (q-p)x(r-p).  The applet compares this sign for P and C
   * relative to the directed chord A->B to choose the arc midpoint. */
  function orientation(p, q, r) {
    const v = (r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y);
    return v > 0 ? 1 : -1;
  }

  /** Circumcentre from the determinant form, then the applet's radius: the
   * mean of the three centre-to-corner distances, not the exact radius. */
  function circumcircle(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
    const aa = a.x * a.x + a.y * a.y;
    const bb = b.x * b.x + b.y * b.y;
    const cc = c.x * c.x + c.y * c.y;
    const o = point(
      (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d,
      (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d,
    );
    if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) return null;
    const r = (dist(o, a) + dist(o, b) + dist(o, c)) / 3;
    return r > 1e-9 ? { c: o, r: r } : null;
  }

  /** Where the perpendicular bisector of AB meets the circle on C's side. */
  function arcMidpoint(a, b, c, circle) {
    const mid = midpoint(a, b);
    const v = sub(b, a);
    const n = Math.hypot(v.x, v.y);
    if (n < 1e-9) return null;
    if (!canIntersectCircle(mid, add(mid, point(v.y, -v.x)))) return null;
    const u = point(v.y / n, -v.x / n);
    const w = sub(mid, circle.c); // mid - centre
    const b0 = -dot(w, u);
    const disc = b0 * b0 - (dot(w, w) - circle.r * circle.r);
    if (disc < 0 || !Number.isFinite(disc)) return null;
    const h = Math.sqrt(disc);
    const p1 = add(mid, mul(u, b0 + h));
    const p2 = add(mid, mul(u, b0 - h));
    const want = orientation(c, a, b);
    if (orientation(p1, a, b) === want) return p1;
    if (orientation(p2, a, b) === want) return p2;
    return null;
  }

  /** Foot of the perpendicular from p onto the line a->b (GeoSDoub.NearestPoint). */
  function foot(p, a, b) {
    const v = sub(b, a);
    const len2 = dot(v, v);
    if (!(len2 >= 0.1)) return point(p.x, p.y);
    const t = dot(sub(p, a), v) / len2;
    return add(a, mul(v, t));
  }

  /** Intersection of line(a,b) with line(c,d), or null when parallel. */
  function lineIntersection(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const den = cross(r, s);
    if (!Number.isFinite(den) || Math.abs(den) < 1e-12) return null;
    const t = cross(sub(c, a), s) / den;
    return add(a, mul(r, t));
  }

  /** The other meeting of the line P->M with the circle (the far one from P). */
  function farOnCircle(p, m, circle) {
    const v = sub(m, p);
    if (!canIntersectCircle(p, m)) return null;
    const len2 = dot(v, v);
    if (len2 < 1e-12) return null;
    const t = -2 * dot(sub(p, circle.c), v) / len2;
    return add(p, mul(v, t));
  }

  /** The starting triangle from the applet's init(): angles PI, -0.2 and
   * -0.8975979010256552 about the centre, with screen y pointing down. */
  function start(options) {
    const o = options || {};
    const at = (angle) => point(
      HOME.x + HOME.r * Math.cos(angle),
      HOME.y + HOME.r * Math.sin(angle),
    );
    return {
      A: at(Math.PI),
      B: at(-0.2),
      C: at(-0.8975979010256552),
      options: {
        names: o.names === undefined ? true : !!o.names,
        hint: !!o.hint,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  /** Keep a dragged corner inside the board with room for its name. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  function move(state, name, p) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** All the points of the drawing, from three corners. */
  function compute(a, b, c) {
    if (!(dist(a, b) >= 1)) return null; // the applet's NoDraw test
    const circle = circumcircle(a, b, c);
    if (!circle) return null;
    const p = arcMidpoint(a, b, c, circle);
    if (!p) return null;

    const ac = dist(a, c), bc = dist(b, c);
    // dcmpl: strictly greater chooses AC; equality or NaN chooses BC.
    const longSide = ac > bc ? "AC" : "BC";
    const k = longSide === "AC" ? a : b;
    const l = longSide === "AC" ? b : a;
    const m = foot(p, k, c);
    const q = farOnCircle(p, m, circle);
    if (!q) return null; // FindQ sets NoDraw when the line is too short
    let f = lineIntersection(a, c, b, q);
    if (f && (!Number.isFinite(f.x) || !Number.isFinite(f.y))) f = null;

    return {
      circle: circle, A: a, B: b, C: c, P: p, M: m, K: k, L: l, Q: q, F: f,
      longSide: longSide,
      lengths: {
        AM: dist(a, m), BM: dist(b, m), MC: dist(m, c),
        AC: ac, BC: bc, AB: dist(a, b),
      },
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C);
  }

  /* An illustration, not a game: there is no win and no loss. */
  function result(state) {
    return null;
  }

  /** What the status line says.  With "hint" on, the applet's proof names Q
   * and F; otherwise the status states the theorem with the live lengths. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move A, B and C so they make a triangle with a long side.";
    const n = (v) => v.toFixed(1);
    if (state.options.hint) {
      return `Q and F are drawn: QM halves angle AQF, AQF is isosceles, and so is BCF. `
        + `${g.longSide === "AC" ? "AM" : "BM"} = ${g.longSide === "AC" ? "MC + BC" : "MC + AC"} = `
        + `${n(g.longSide === "AC" ? g.lengths.AM : g.lengths.BM)}.`;
    }
    if (state.options.names) {
      return `The long side is ${g.longSide}. M splits the broken line A-C-B in half: `
        + `${g.longSide === "AC" ? "AM" : "BM"} = ${g.longSide === "AC" ? "MC + BC" : "MC + AC"} `
        + `(${n(g.longSide === "AC" ? g.lengths.AM : g.lengths.BM)}).`;
    }
    return `M cuts the broken line A-C-B in half at ${n(g.lengths.MC)} from C.`;
  }

  return {
    VIEW: VIEW, HOME: HOME, PAD: PAD,
    point: point, sub: sub, add: add, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, angle: angle, orientation: orientation,
    circumcircle: circumcircle, arcMidpoint: arcMidpoint, foot: foot,
    lineIntersection: lineIntersection, farOnCircle: farOnCircle, clamp: clamp,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, result: result, describe: describe,
  };
})();
