"use strict";

/*
 * Joseph Keech in Bride's Chair, after Alexander Bogomolny's JKeech applet.
 *
 * ABC is a right triangle with the right angle at C. Squares ACDE and BCKL
 * stand on its two legs; AL crosses AC at F and BE crosses BC at H. Keech's
 * 1783 claim is CF = CH, both equal to the side of the square HCFZ with Z on
 * AB. His added note draws the circle through H, C, F, Z: its second meeting
 * G with AB sees F and H under four angles of 45 degrees.
 *
 * The key idea in the code is a quarter turn. GeoSDoub.Rotate(centre, point,
 * angle, dir) turns one point about another in screen coordinates (y grows
 * downwards), with the sign deciding the direction. Each square corner and
 * the right-angled C come from such turns; the rest is line intersection with
 * the applet's own |determinant| > 1 test. Dragging A or B rebuilds C with
 * ComputeC (keeping the angle at A), while dragging C keeps the point on the
 * circumcircle it started on, just as the Java mouse listeners do.
 *
 * This file is only the geometry: no document, no window, no storage. It
 * defines one global, JkeechCore, and every position is plain JSON data.
 */
const JkeechCore = (() => {
  const WIDTH = 450;        // the applet's WIDTH parameter on the original page
  const HEIGHT = 400;       // the applet's HEIGHT parameter
  const START_ANGLE = Math.PI / 6; // JKeechCanvas.AngleA = 30 degrees
  const QUARTER = Math.PI / 2;
  const OPTION_KEYS = ["showNames", "showStatement", "showExtra"];

  const point = (x, y) => ({ x, y });
  const copy = (p) => point(p.x, p.y);
  const sub = (a, b) => point(a.x - b.x, a.y - b.y);
  const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const dist = (a, b) => Math.sqrt(sqDist(a, b));
  const midpoint = (a, b) => point((a.x + b.x) / 2, (a.y + b.y) / 2);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub.Rotate, transcribed from its bytecode. */
  function rotate(centre, p, angle, dir) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const d = dir === undefined ? 1 : dir;
    const dx = p.x - centre.x, dy = p.y - centre.y;
    return point(centre.x + cos * dx - d * sin * dy,
                 centre.y + d * sin * dx + cos * dy);
  }

  /** GeoSDoub.Intersect of two lines: NaN when |determinant| <= 1. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) <= 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / den, (a2 * c1 - a1 * c2) / den);
  }

  /** GeoSDoub.ComputeAngle: the angle at v. No clamp, like Java's Math.acos. */
  function computeAngle(v, p, q) {
    const top = (sqDist(v, p) + sqDist(v, q) - sqDist(p, q)) / 2;
    return Math.acos(top / (dist(v, p) * dist(v, q)));
  }

  /** GeoSDoub.FindOrientation: +1 or -1, from the applet's polynomial. */
  function orientation(a, b, c) {
    const s = c.x * (b.y - a.y) + c.y * (a.x - b.x) + a.x * b.y - b.x * a.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.GetParallelTo(a,b,c): a plus 100 times b-c. */
  function parallel(a, b, c) {
    return point(a.x + 100 * (b.x - c.x), a.y + 100 * (b.y - c.y));
  }

  /** GeoSDoub.FindCircumcenter, then GetCircle's average of three radii. */
  function circleThrough(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const u = point(m1.x + b.y - a.y, m1.y - b.x + a.x);
    const v = point(m2.x + c.y - b.y, m2.y - c.x + b.x);
    const centre = intersect(m1, u, m2, v);
    if (!finite(centre)) return null;
    const r = (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3;
    return { c: centre, r };
  }

  /** GeoSDoub.Intersect(DoubCircle,DoubLine), via IntersectX or IntersectY. */
  function circleLine(circle, a, b) {
    if (!circle || !finite(a) || !finite(b)) return null;
    let m, intercept, q, p, constant, disc, roots;
    if (Math.abs(a.y - b.y) > 1) {
      m = (b.x - a.x) / (b.y - a.y);
      intercept = b.x - m * b.y;
      q = 1 + m * m;
      p = m * (intercept - circle.c.x) - circle.c.y;
      constant = circle.c.y ** 2 + (intercept - circle.c.x) ** 2 - circle.r ** 2;
      disc = p * p - q * constant;
      if (disc < 0) return null;
      roots = [(-p + Math.sqrt(disc)) / q, (-p - Math.sqrt(disc)) / q];
      return roots.map((t) => point(m * t + intercept, t));
    }
    if (Math.abs(a.x - b.x) > 1) {
      m = (b.y - a.y) / (b.x - a.x);
      intercept = b.y - m * b.x;
      q = 1 + m * m;
      p = m * (intercept - circle.c.y) - circle.c.x;
      constant = circle.c.x ** 2 + (intercept - circle.c.y) ** 2 - circle.r ** 2;
      disc = p * p - q * constant;
      if (disc < 0) return null;
      roots = [(-p + Math.sqrt(disc)) / q, (-p - Math.sqrt(disc)) / q];
      return roots.map((t) => point(t, m * t + intercept));
    }
    return null;
  }

  /** The applet's Other: hits[1] when hits[0] is within a pixel of Z. */
  function other(hits, z) {
    if (!hits || hits.length < 2 || !finite(z)) return null;
    return dist(hits[0], z) < 1 ? hits[1] : hits[0];
  }

  /** ComputeC: rebuild C from A, B and the angle at A, with a right angle at C. */
  function computeC(a, b, angleA) {
    const p = rotate(a, b, angleA, -1);
    const q = rotate(b, a, QUARTER - angleA, 1);
    return intersect(a, p, b, q);
  }

  /** The starting figure, from JKeechCanvas.init() at 450 x 400. */
  function start(options) {
    const o = options || {};
    const w = o.width || WIDTH;
    const h = o.height || HEIGHT;
    const d = w / 3;
    const A = point(d, (h * 11) / 16);
    const B = point(w - d, (h * 11) / 16);
    const angleA = o.angleA === undefined ? START_ANGLE : o.angleA;
    const C = computeC(A, B, angleA);
    const state = {
      A, B, C, angleA,
      selected: null,
      glideCircle: null,
      showNames: false,
      showStatement: false,
      showExtra: false,
      explored: false,
    };
    for (const key of OPTION_KEYS) {
      if (Object.prototype.hasOwnProperty.call(o, key)) state[key] = !!o[key];
    }
    if (o.A) state.A = copy(o.A);
    if (o.B) state.B = copy(o.B);
    if (o.C) state.C = copy(o.C);
    return state;
  }

  /** Plain JSON for Track.state and the tutor. */
  function snapshot(state) {
    return {
      A: copy(state.A), B: copy(state.B), C: copy(state.C),
      angleA: state.angleA,
      selected: state.selected,
      glideCircle: state.glideCircle
        ? { c: copy(state.glideCircle.c), r: state.glideCircle.r } : null,
      showNames: !!state.showNames,
      showStatement: !!state.showStatement,
      showExtra: !!state.showExtra,
      explored: !!state.explored,
    };
  }

  /**
   * Compute(), line for line. Every point the old canvas draws is returned;
   * `active` is false when its intersection guards produced NaN.
   */
  function geometry(state) {
    const { A, B, C } = state;
    const base = {
      active: false, A: copy(A), B: copy(B), C: copy(C),
      L: null, K: null, D: null, E: null, F: null, H: null, Z: null,
      M: null, circle: null, hits: null, G: null,
      CF: 0, CH: 0, FZ: 0, HZ: 0, radius: 0,
      square: null, angles: null, foot: null,
    };
    if (!finite(C)) return base;

    const L = rotate(B, C, QUARTER, 1);
    const K = rotate(C, B, QUARTER, -1);
    const D = rotate(C, A, QUARTER, 1);
    const E = rotate(A, C, QUARTER, -1);
    const F = intersect(A, L, B, C);
    const H = intersect(B, E, A, C);
    const Z = intersect(H, parallel(H, B, C), F, parallel(F, A, C));
    const M = midpoint(F, H);
    const radius = (dist(M, C) + dist(M, Z)) / 2;
    const circle = { c: M, r: radius };
    const hits = circleLine(circle, A, B);
    const G = other(hits, Z);
    const CF = dist(C, F), CH = dist(C, H);
    const FZ = dist(F, Z), HZ = dist(H, Z);

    // The foot of the altitude from C, for the extra-angle claim.
    const u = sub(B, A), len2 = u.x * u.x + u.y * u.y;
    const t = len2 ? ((C.x - A.x) * u.x + (C.y - A.y) * u.y) / len2 : NaN;
    const foot = point(A.x + u.x * t, A.y + u.y * t);
    const angles = finite(G) && finite(F) && finite(H)
      ? {
        FGB: computeAngle(G, F, B), FGC: computeAngle(G, F, C),
        HGC: computeAngle(G, H, C), HGA: computeAngle(G, H, A),
      }
      : null;
    const active = [L, K, D, E, F, H, Z, M].every(finite) &&
      Number.isFinite(radius) && radius > 0;
    return {
      active, A: copy(A), B: copy(B), C: copy(C),
      L, K, D, E, F, H, Z, M, circle, hits, G,
      CF, CH, FZ, HZ, radius,
      square: [
        [copy(C), copy(F), copy(Z), copy(H)],
        [copy(A), copy(C), copy(D), copy(E), copy(A)],
        [copy(B), copy(C), copy(K), copy(L), copy(B)],
      ],
      angles, foot,
    };
  }

  /** The point C is pulled back onto the circle it was grabbed on. */
  function glide(p, circle) {
    if (!circle || !finite(p)) return p;
    const d = dist(circle.c, p);
    if (!Number.isFinite(d) || d < 1e-12) return copy(circle.c);
    const k = circle.r / d;
    return point(circle.c.x + (p.x - circle.c.x) * k,
                 circle.c.y + (p.y - circle.c.y) * k);
  }

  /** mousePressed: grabbing C restricts it to the circumcircle of A, B, C. */
  function grab(state, name) {
    const next = snapshot(state);
    next.selected = name;
    next.glideCircle = name === "C" ? circleThrough(state.A, state.B, state.C) : null;
    return next;
  }

  function release(state) {
    return Object.assign(snapshot(state), { glideCircle: null });
  }

  /**
   * One drag or option change. A and B keep the angle at A and rebuild C;
   * C keeps the circle it was grabbed on. UpgradePoints then swaps A and B
   * when the orientation turns over, exactly as the applet does.
   */
  function move(state, action) {
    if (!state || !action) return state;
    if (action.type === "reset") return start({});
    if (action.type === "option") {
      if (OPTION_KEYS.indexOf(action.key) < 0) return state;
      const next = snapshot(state);
      next[action.key] = !!action.value;
      next.explored = true;
      return next;
    }
    if (action.type === "select") {
      if (["A", "B", "C"].indexOf(action.name) < 0) return state;
      return Object.assign(snapshot(state), { selected: action.name });
    }
    if (action.type === "release") return release(state);
    if (action.type === "grab") return grab(state, action.name);
    if (action.type !== "vertex" || ["A", "B", "C"].indexOf(action.name) < 0) return state;

    const raw = point(action.x, action.y);
    if (!finite(raw)) return state;
    const next = snapshot(state);
    let p = point(clamp(raw.x, 0, WIDTH), clamp(raw.y, 0, HEIGHT));
    if (action.name === "C") {
      p = glide(p, state.glideCircle);
      next.C = p;
      const angle = computeAngle(next.A, next.B, p);
      if (Number.isFinite(angle)) next.angleA = angle;
    } else {
      next[action.name] = p;
      const c = computeC(next.A, next.B, next.angleA);
      if (!finite(c)) return state;
      next.C = c;
    }
    // UpgradePoints: if the triangle turned over, swap the names A and B.
    if (orientation(next.A, next.B, next.C) === 1) {
      const tmp = next.A;
      next.A = next.B;
      next.B = tmp;
    }
    next.selected = action.name;
    next.explored = true;
    return next;
  }

  /** A demonstration: it is "done" once the player has moved something. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  return {
    WIDTH, HEIGHT, START_ANGLE, OPTION_KEYS,
    point, copy, sub, sqDist, dist, midpoint, finite, clamp,
    rotate, intersect, computeAngle, orientation, parallel,
    circleThrough, circleLine, other, computeC, glide,
    start, snapshot, geometry, grab, release, move, result,
  };
})();
