"use strict";

/*
 * IMO 2007 Problem 4 — Alexander Bogomolny's applet EqualAreasIMO2007.
 *
 * In triangle ABC the internal bisector of angle BCA meets the circumcircle
 * again at R. P and Q are where that same line meets the perpendicular
 * bisectors of BC and AC; K and L are the midpoints of BC and AC. The page
 * asks to prove that triangles RPK and RQL have equal area.
 *
 * The core reconstructs the applet's own Compute(): GetCircle() (circumcenter
 * plus the average of the three radii), GeoSDoub.FindAngleBisector(C,A,B)
 * (rotate A about C through half the angle at C, then cut AB), the far
 * intersection of line CR with the circle, and GeoSDoub.Intersect(C,R,K,O)
 * and (C,R,L,O) for P and Q. The extra points Kp, Lp, Cp, Kh and Lh are also
 * computed by the applet but never drawn — a harmless leftover kept here for
 * the bytecode comparison in the logic test.
 *
 * Nothing here touches the DOM or storage: it defines one global,
 * EqualAreas2007Core, holding plain data and the geometry of a picture.
 */
const EqualAreas2007Core = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const EDGE = 12;             // a corner cannot be dragged off the board
  const MIN_AREA = 240;        // keep the circumcenter and P,Q well defined
  const OPTION_KEYS = ["showNames", "details"];
  const CORNERS = ["A", "B", "C"];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v) => Math.round(v * 1000) / 1000;
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const twiceArea = (a, b, c) => Math.abs(cross(sub(b, a), sub(c, a)));

  /** GeoSDoub.Intersect(a,b,c,d): the determinant form in the applet. */
  function intersect(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const den = cross(r, s);
    if (Math.abs(den) < 1e-12) return null;
    const t = cross(sub(c, a), s) / den;
    return { x: a.x + r.x * t, y: a.y + r.y * t };
  }

  /** GeoSDoub.FindCircumcenter, then GetCircle's averaged radius. */
  function circle(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    const o = intersect(m1, p, m2, q);
    if (!o || ![o, a, b, c].every(finite)) return null;
    return { center: o, radius: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
  }

  /** Rotate p1 about p0 by ori*angle, as GeoSDoub.Rotate does. */
  function rotate(p0, p1, angle, ori) {
    const c = Math.cos(angle), s = Math.sin(angle) * ori;
    const v = sub(p1, p0);
    return { x: p0.x + c * v.x - s * v.y, y: p0.y + s * v.x + c * v.y };
  }

  /** GeoSDoub.FindAngleBisector(p0,p1,p2): the bisector at p0, cut by p1p2. */
  function angleBisector(p0, p1, p2) {
    const u = sub(p1, p0), v = sub(p2, p0);
    const lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
    if (!lu || !lv) return null;
    const cosine = clamp(dot(u, v) / (lu * lv), -1, 1);
    const theta = Math.acos(cosine);
    const ori = cross(u, v) > 0 ? 1 : -1;
    const d = rotate(p0, p1, theta / 2, ori);
    return intersect(p0, d, p1, p2);
  }

  /** The second intersection of line p,q with the circle; p is on the circle. */
  function otherCirclePoint(p, q, circleData) {
    const d = sub(q, p);
    const len2 = dot(d, d);
    if (len2 < 1e-14) return null;
    const o = circleData.center;
    const t = (2 * dot(sub(o, p), d)) / len2;
    return { x: p.x + t * d.x, y: p.y + t * d.y };
  }

  /** GeoSDoub.NearestPoint: the foot of the perpendicular onto line a,b. */
  function foot(p, a, b) {
    const d = sub(b, a), len2 = dot(d, d);
    if (len2 < 1e-14) return { x: a.x, y: a.y };
    const t = dot(sub(p, a), d) / len2;
    return { x: a.x + t * d.x, y: a.y + t * d.y };
  }

  function area(a, b, c) {
    return twiceArea(a, b, c) / 2;
  }

  /** The opening triangle: the applet's three points on its starting circle. */
  function start(options) {
    const cx = WIDTH / 2, cy = HEIGHT / 2, radius = Math.min(WIDTH, HEIGHT) / 2.4;
    const at = (angle) => ({ x: round(cx + radius * Math.cos(angle)),
                            y: round(cy + radius * Math.sin(angle)) });
    let s = {
      A: at(2.6179938779914944),      // 150°
      B: at(0.5235987755982988),      // 30°
      C: at(4.1887902047863905),      // 240°
      showNames: true,                // the applet's "show" parameter is 1
      details: false,
      moves: 0,
      explored: false,
    };
    const o = options || {};
    for (const name of CORNERS) {
      if (finite(o[name])) s = move(s, { type: "point", name, point: o[name] }) || s;
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") s = { ...s, [key]: o[key] };
    }
    return { ...s, moves: 0, explored: false };
  }

  /** A point handle stays on the board and keeps a non-degenerate triangle. */
  function clampHandle(name, q, state) {
    if (!CORNERS.includes(name) || !finite(q) || !state) return null;
    const p = { x: round(clamp(q.x, EDGE, WIDTH - EDGE)),
                y: round(clamp(q.y, EDGE, HEIGHT - EDGE)) };
    const next = { ...state, [name]: p };
    if (twiceArea(next.A, next.B, next.C) < MIN_AREA) return null;
    return p;
  }

  /** The moves the applet offers: three draggable corners, two ticks, Reset. */
  function legalMoves(state) {
    return [
      ...CORNERS.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  function move(state, m) {
    if (!state || !m || ![state.A, state.B, state.C].every(finite)) return null;
    let next = null;
    if (m.type === "point") {
      const p = clampHandle(m.name, m.point, state);
      if (!p) return null;
      next = { ...state, [m.name]: p };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next || !CORNERS.every((name) => finite(next[name]))) return null;
    return { ...next, moves: state.moves + 1, explored: true };
  }

  /** An illustration has nothing to win: one move counts as explored. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** The whole construction. Degenerate pictures report { degenerate: true }. */
  function compute(state) {
    if (!state || ![state.A, state.B, state.C].every(finite)) return { degenerate: true };
    const { A, B, C } = state;
    if (twiceArea(A, B, C) < MIN_AREA) return { degenerate: true };
    const circleData = circle(A, B, C);
    if (!circleData) return { degenerate: true };
    const O = circleData.center;

    // The applet calls FindAngleBisector(C, A, B), so S lies on AB.
    const S = angleBisector(C, A, B);
    if (!S || !finite(S)) return { degenerate: true };
    const R = otherCirclePoint(C, S, circleData);
    if (!R || !finite(R)) return { degenerate: true };

    const K = midpoint(B, C), L = midpoint(A, C), M = midpoint(A, B);
    // The perpendicular bisectors of BC and AC are the lines KO and LO.
    const P = intersect(C, R, K, O);
    const Q = intersect(C, R, L, O);
    if (!P || !Q || !finite(P) || !finite(Q)) return { degenerate: true };

    const Kp = midpoint(S, B), Lp = midpoint(S, A);
    const Cp = { x: 2 * O.x - C.x, y: 2 * O.y - C.y };
    const Kh = foot(K, C, R), Lh = foot(L, C, R);

    const a = dist(B, C), b = dist(A, C), c = dist(A, B);
    const angleC = Math.acos(clamp(dot(sub(A, C), sub(B, C)) / (a * b), -1, 1));
    const areaRPK = area(R, P, K), areaRQL = area(R, Q, L);
    return {
      degenerate: false,
      A, B, C, O, radius: circleData.radius, circle: circleData,
      S, R, K, L, M, P, Q, Kp, Lp, Cp, Kh, Lh,
      a, b, c, angleC, areaRPK, areaRQL,
      areaGap: Math.abs(areaRPK - areaRQL),
      trigArea: (a * b * Math.tan(angleC / 2)) / 8,
    };
  }

  return {
    WIDTH, HEIGHT, EDGE, MIN_AREA, OPTION_KEYS, CORNERS,
    clamp, dist, area, twiceArea, intersect, circle, rotate, angleBisector,
    otherCirclePoint, foot, clampHandle, start, legalMoves, move, result, compute,
  };
})();
