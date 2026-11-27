"use strict";

/*
 * Euler 60, from Alexander Bogomolny's applet Euler60.
 *
 * Drag the three corners of a triangle. When any angle comes within 0.01
 * radians of 60 degrees the applet "wakes up": the Euler line (circumcenter
 * to orthocenter) is drawn and the three little eyes open. The checkboxes
 * show the centroid, circumcenter and orthocenter.
 *
 * The key facts are: the Euler line of a triangle with a 60 degree angle is
 * perpendicular to that angle's bisector, and it meets the two sides at
 * equal distances BP = BQ = (AB + BC)/3 from the 60 degree corner. When the
 * two sides differ by no more than a factor of two those points lie on the
 * sides and AP + CQ = PQ.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, Euler60Core, so the page loads it with a
 * plain <script> and porting/check-euler-60.mjs loads it in Node. All
 * geometry here reproduces GeoSDoub's formulas in the original bytecode,
 * including its NaN answer for parallel lines.
 */
const Euler60Core = (() => {
  const SIXTY = Math.PI / 3;
  const TOLERANCE = 0.01; // CheckIfFinished: abs(angle - PI/3) < 0.01
  const LINE_MIN = 0.5;   // Draw(g,p,q,...): line only when Dist(O,H) > 0.5

  const point = (x, y) => ({ x, y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const scale = (p, k) => point(p.x * k, p.y * k);
  const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

  /* GeoSDoub.Intersect(p1,p2,p3,p4), transcribed from the bytecode. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y;
    const b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y;
    const b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / den, (c1 * a2 - c2 * a1) / den);
  }

  /* GeoSDoub.ComputeAngle(p, vertex, q): the angle at `vertex`. */
  function angle(p, vertex, q) {
    const numerator =
      sqDist(p, vertex) + sqDist(vertex, q) - sqDist(p, q);
    const cosine = numerator / 2 / dist(vertex, p) / dist(vertex, q);
    return Math.acos(cosine);
  }

  /* GeoSDoub.FindAltitude(p, q, r) is the foot of the altitude from p. */
  function altitudeFoot(p, q, r) {
    const rotated = point(p.x + r.y - q.y, p.y - (r.x - q.x));
    return intersect(p, rotated, q, r);
  }

  /* GeoSDoub.FindCircumcenter, via perpendicular bisectors of AB and BC. */
  function circumcenter(a, b, c) {
    const m1 = scale(add(a, b), 0.5);
    const m2 = scale(add(b, c), 0.5);
    const q1 = point(m1.x + b.y - a.y, m1.y - (b.x - a.x));
    const q2 = point(m2.x + c.y - b.y, m2.y - (c.x - b.x));
    return intersect(m1, q1, m2, q2);
  }

  /* Euler60Canvas.GetOrthocenter: two altitude feet, then intersect. */
  function orthocenter(a, b, c) {
    const footA = altitudeFoot(a, b, c);
    const footB = altitudeFoot(b, c, a);
    return intersect(a, footA, b, footB);
  }

  /* Euler60Canvas.MidPoint(a,b,c), despite its name: the centroid. */
  function centroid(a, b, c) {
    return point((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
  }

  /* Euler60Canvas.init: the triangle the applet opens with. */
  function start(options = {}) {
    const width = options.width === undefined ? 400 : options.width;
    const height = options.height === undefined ? 300 : options.height;
    const halfW = width / 2;
    const halfH = height / 2;
    const unit = Math.trunc(Math.min(width, height) / 4); // Java int division
    const c = point(halfW + 2 * unit * Math.cos(0.5), halfH + 2 * unit * Math.sin(0.5));
    const b = point(width - c.x, c.y);
    const a = point((9 * b.x + c.x) / 10, halfH + unit * Math.sin(-1.6));
    return {
      A: a, B: b, C: c,
      show: { centroid: false, circumcenter: false, orthocenter: false },
      width, height,
    };
  }

  /** Move one corner; everything else (including the checkboxes) is kept. */
  function move(state, name, p) {
    if (!["A", "B", "C"].includes(name)) return state;
    return {
      ...state,
      [name]: point(Number(p.x), Number(p.y)),
    };
  }

  function toggle(state, name) {
    if (!["centroid", "circumcenter", "orthocenter"].includes(name)) return state;
    return { ...state, show: { ...state.show, [name]: !state.show[name] } };
  }

  /*
   * CheckIfFinished, in the applet's own order B, C, A. Its S,T,U fields are
   * also literal: when the angle at T is 60 degrees the applet puts S on the
   * *previous* corner, so the three little arcs are drawn one corner early.
   * That harmless off-by-one is kept here.
   */
  function sixty(state) {
    const { A, B, C } = state;
    const tests = [
      ["B", angle(A, B, C), A, B, C],
      ["C", angle(B, C, A), B, C, A],
      ["A", angle(C, A, B), C, A, B],
    ];
    for (const [name, value, s, t, u] of tests) {
      if (Math.abs(value - SIXTY) < TOLERANCE) {
        return { name, value, S: s, T: t, U: u };
      }
    }
    return null;
  }

  /** Geometry the page draws. `line` is null exactly when the applet draws none. */
  function geometry(state) {
    const { A, B, C } = state;
    const G = centroid(A, B, C);
    const O = circumcenter(A, B, C);
    const H = orthocenter(A, B, C);
    const angles = {
      B: angle(A, B, C),
      C: angle(B, C, A),
      A: angle(C, A, B),
    };
    const sixtyVertex = sixty(state);
    return {
      G, O, H, angles,
      finished: !!sixtyVertex,
      sixty: sixtyVertex,
      line: dist(O, H) > LINE_MIN && finite(O) && finite(H) ? { p: O, q: H } : null,
      lineVisible: dist(O, H) > LINE_MIN && finite(O) && finite(H),
    };
  }

  /*
   * Where the Euler line meets the two sides at a 60 degree corner. This is
   * the construction in the page's problem (P on ST, Q on SU, equilateral
   * STQ cut off), computed from the result BP = BQ = (ST + SU)/3.
   */
  function cut(state, vertex = null) {
    const found = sixty(state);
    if (!found && !vertex) return null;
    const name = vertex || found.name;
    const S = state[name];
    const keys = ["A", "B", "C"].filter((k) => k !== name);
    const T = state[keys[0]];
    const U = state[keys[1]];
    const lenT = dist(S, T);
    const lenU = dist(S, U);
    if (!(lenT > 0) || !(lenU > 0)) return null;
    const t = (lenT + lenU) / 3;
    return {
      name: found.name,
      P: point(S.x + (T.x - S.x) * (t / lenT), S.y + (T.y - S.y) * (t / lenT)),
      Q: point(S.x + (U.x - S.x) * (t / lenU), S.y + (U.y - S.y) * (t / lenU)),
      BP: t, BQ: t, PQ: t,
      AP: Math.abs(lenT - t),
      CQ: Math.abs(lenU - t),
      onSegments: t <= lenT && t <= lenU,
      sides: [lenT, lenU],
    };
  }

  /*
   * Convenience for the illustration (not in the Java applet): put a 60
   * degree angle at one corner while keeping the neighbouring side fixed.
   * `ratio` is the length of the other side divided by the fixed one;
   * screen y grows downwards, so the new side turns counter-clockwise.
   */
  function withSixty(state, vertex, ratio) {
    const keys = ["A", "B", "C"].filter((k) => k !== vertex);
    const S = state[vertex];
    const T = state[keys[0]];
    const base = dist(S, T);
    const length = base * ratio;
    const ux = (T.x - S.x) / base;
    const uy = (T.y - S.y) / base;
    const other = point(
      S.x + length * (ux * Math.cos(SIXTY) - uy * Math.sin(SIXTY)),
      S.y + length * (ux * Math.sin(SIXTY) + uy * Math.cos(SIXTY)),
    );
    const next = { ...state, [keys[1]]: other };
    return next;
  }

  return {
    SIXTY, TOLERANCE, LINE_MIN,
    point, dist, sqDist, angle, intersect, centroid,
    circumcenter, orthocenter, altitudeFoot,
    start, move, toggle, sixty, geometry, cut, withSixty,
  };
})();
