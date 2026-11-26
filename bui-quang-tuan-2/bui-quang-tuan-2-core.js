"use strict";

/*
 * Bui Quang Tuan 2 — the second six-circles theorem, as a draggable diagram.
 *
 * A circle is fitted into angle A1, tangent to side A1A2. Its tangent point
 * T12 on that side is carried to the next circle, fitted into angle A2, then
 * A3, A1, A2, A3: six circles close up with C7 = C1. The six tangent points
 * lie on one circle centred at the incenter I, and the cevians from the
 * vertices to the incircle's touch points meet at the Gergonne point. If the
 * alternating circles C1, C3, C5 (or C2, C4, C6) share a point, it is Ge.
 *
 * The one idea the code relies on: each next circle is found by intersecting
 * the perpendicular to a side through the old circle's tangent point with the
 * angle bisector at the next vertex. That puts the new centre on the bisector
 * and keeps both circles tangent to the side at the same point. P, the centre
 * of C1, slides along the bisector at A1; the other five circles follow.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BuiQuangTuan2Core, so the page loads it with a plain
 * <script> and porting/check-bui-quang-tuan-2.mjs loads it in Node. Positions
 * are plain data and functions return new positions rather than changing them.
 */
const BuiQuangTuan2Core = (() => {
  const EPS = 1e-9;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const sqDist = (p, q) => dot(sub(p, q), sub(p, q));
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const length = (p) => Math.hypot(p.x, p.y);
  const valid = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const lerp = (p, q, t) => add(p, mul(sub(q, p), t));
  /** DoubLine.CreateMidPoint(t): A*t + B*(1-t) — t is the weight of A. */
  const midPoint = (a, b, t) => add(mul(a, t), mul(b, 1 - t));

  /** GeoSDoub.Intersect of two lines through pairs of points; 1 is its det cut-off. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.NearestPoint(P, A, B): the foot of the perpendicular on AB. */
  function nearest(p, a, b) {
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 <= 0.1) return p;
    const t = dot(sub(p, a), d) / len2;
    return add(a, mul(d, t));
  }

  const distToLine = (p, a, b) => dist(p, nearest(p, a, b));

  /** The point where the internal angle bisector at `apex` meets the far side. */
  function angleBisector(apex, p, q) {
    const u = sub(p, apex), v = sub(q, apex);
    const lu = length(u), lv = length(v);
    if (lu < EPS || lv < EPS) return { x: NaN, y: NaN };
    const dir = add(mul(u, 1 / lu), mul(v, 1 / lv));
    if (length(dir) < EPS) return { x: NaN, y: NaN };
    return intersect(apex, add(apex, mul(dir, 100)), p, q);
  }

  /** GeoSDoub.FindCircumcenter, by two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = mul(add(a, b), 0.5), m2 = mul(add(b, c), 0.5);
    const d1 = sub(b, a), d2 = sub(c, b);
    const p1 = add(m1, { x: d1.y, y: -d1.x });
    const p2 = add(m2, { x: d2.y, y: -d2.x });
    return intersect(m1, p1, m2, p2);
  }

  const circle = (c, r) => ({ c, r });
  /** The applet's DoubCircle.GetCircle uses the mean of the three distances. */
  const through = (a, b, c) => {
    const centre = circumcenter(a, b, c);
    if (!valid(centre)) return null;
    return circle(centre, (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3);
  };
  const power = (cir, p) => sqDist(p, cir.c) - cir.r * cir.r;

  /** Side k joins V[k] to V[k+1]; the tangent points follow the chain. */
  function sidesOf(V) {
    return [0, 1, 2].map((k) => [V[k], V[(k + 1) % 3]]);
  }

  /**
   * The whole construction from three vertices and a parameter t on the
   * bisector at A1. t is the weight of A1 (0.7 in the applet's Reset).
   */
  function figure(V, t) {
    const sides = sidesOf(V);
    const bis = [0, 1, 2].map((k) => angleBisector(V[k], V[(k + 2) % 3], V[(k + 1) % 3]));
    const L0 = bis[0];
    const P = valid(L0) ? midPoint(V[0], L0, t) : { x: NaN, y: NaN };

    const circles = [];
    const T = [];
    let first = valid(P) ? circle(P, distToLine(P, sides[0][0], sides[0][1])) : null;
    if (first && Number.isFinite(first.r)) circles.push(first);
    let seventh = null;
    for (let i = 0; i < 6 && first; i++) {
      const k = i % 3;
      const foot = nearest(first.c, sides[k][0], sides[k][1]);
      T.push(foot);
      const k1 = (k + 1) % 3;
      const centre = intersect(foot, first.c, V[k1], bis[k1]);
      const next = valid(centre) ? circle(centre, dist(centre, foot)) : null;
      if (i < 5) {
        if (!next) break;
        circles.push(next);
        first = next;
      } else {
        seventh = next;
      }
    }

    // Big is the circle through T12, T34, T45: its centre is the incenter I.
    const big = T.length >= 4 ? through(T[0], T[2], T[3]) : null;

    // M[k] is the touch point of the incircle on the side opposite V[k].
    const M = big ? [nearest(big.c, V[1], V[2]),
                     nearest(big.c, V[2], V[0]),
                     nearest(big.c, V[0], V[1])] : null;
    const incircle = M && M.every(valid) ? through(M[0], M[1], M[2]) : null;

    let Ge = null, crossings = null;
    if (M && M.every(valid)) {
      crossings = [intersect(V[1], M[1], V[2], M[2]),
                   intersect(V[2], M[2], V[0], M[0]),
                   intersect(V[0], M[0], V[1], M[1])];
      if (crossings.every(valid)) {
        Ge = mul(add(add(crossings[0], crossings[1]), crossings[2]), 1 / 3);
      }
    }

    // The incenter itself, from the side lengths (independent of the chain).
    const a = dist(V[1], V[2]), b = dist(V[2], V[0]), c = dist(V[0], V[1]);
    const perim = a + b + c;
    const I = perim > EPS
      ? mul(add(add(mul(V[0], a), mul(V[1], b)), mul(V[2], c)), 1 / perim)
      : { x: NaN, y: NaN };

    return { V, sides, bis, L0, P, circles, T, seventh, big, M, incircle, crossings, Ge, I };
  }

  /**
   * A new diagram. Reset puts A1 at the middle, A2 a third across and low,
   * A3 five sixths across; t = 0.7 along the bisector of angle A1.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const t = o.t === undefined ? 0.7 : o.t;
    const V = o.V ? o.V.map((p) => ({ x: p.x, y: p.y })) : [
      { x: width / 2, y: height / 2 },
      { x: width / 3, y: 5 * height / 7 },
      { x: 5 * width / 6, y: 4 * height / 7 },
    ];
    const state = { V, t, width, height };
    const f = figure(V, t);
    state.P = f.P;
    return state;
  }

  /**
   * Move a handle. Moving a vertex rebuilds the angle bisectors and puts P
   * back at the same fraction t along the new bisector (the applet's
   * CreateBisector). Moving P changes t by projection onto that bisector.
   */
  function withPoint(state, name, p) {
    const q = { x: p.x, y: p.y };
    if (!valid(q)) return state;
    const V = state.V.map((v) => ({ x: v.x, y: v.y }));
    let t = state.t;
    if (name === "A1" || name === "A2" || name === "A3") {
      V[name === "A1" ? 0 : name === "A2" ? 1 : 2] = q;
    } else if (name === "P") {
      const f0 = figure(V, t);
      if (!valid(f0.L0)) return state;
      // DoubLine.UpdateMidPoint: t = -dot(A-B, B-P)/|A-B|^2, A=V[0], B=L0.
      const d = sub(V[0], f0.L0);
      const len2 = dot(d, d);
      if (len2 > EPS) t = -dot(d, sub(f0.L0, q)) / len2;
    } else {
      return state;
    }
    const next = { V, t, width: state.width, height: state.height };
    const f = figure(V, t);
    next.P = f.P;
    return next;
  }

  /** All measurements the page draws or talks about. */
  function measurements(state) {
    const f = figure(state.V, state.t);
    const scale = Math.max(dist(state.V[0], state.V[1]),
                            dist(state.V[1], state.V[2]),
                            dist(state.V[2], state.V[0]), 1);
    return { ...f, scale, valid: Boolean(f.P && f.big && f.Ge && f.circles.length === 6) };
  }

  /** Which pairs of alternating circles have a common point, and where. */
  function tripleCentres(f) {
    const out = {};
    for (const [name, ids] of Object.entries({ odd: [0, 2, 4], even: [1, 3, 5] })) {
      const [c1, c2, c3] = ids.map((i) => f.circles[i]);
      if (!c1 || !c2 || !c3) { out[name] = null; continue; }
      // Intersection of the radical axes of (c1,c2) and (c1,c3).
      const raw = {
        a1: 2 * (c2.c.x - c1.c.x), b1: 2 * (c2.c.y - c1.c.y),
        c1: power(c1, { x: 0, y: 0 }) - power(c2, { x: 0, y: 0 }),
        a2: 2 * (c3.c.x - c1.c.x), b2: 2 * (c3.c.y - c1.c.y),
        c2: power(c1, { x: 0, y: 0 }) - power(c3, { x: 0, y: 0 }),
      };
      const det = raw.a1 * raw.b2 - raw.a2 * raw.b1;
      out[name] = Math.abs(det) < 1e-9 ? null : {
        x: (raw.b1 * raw.c2 - raw.b2 * raw.c1) / det,
        y: (raw.c1 * raw.a2 - raw.c2 * raw.a1) / det,
      };
    }
    return out;
  }

  /** The page's claims, tested at this position. `tol` scales with the board. */
  function claims(state) {
    const f = figure(state.V, state.t);
    const scale = Math.max(dist(state.V[0], state.V[1]),
                            dist(state.V[1], state.V[2]),
                            dist(state.V[2], state.V[0]), 1);
    const tol = 1e-7 * scale;
    const near = (u, v) => Math.abs(u - v) <= tol;
    // A dragged point lands within a fraction of a viewBox unit, which is
    // enough to leave a tiny power behind; allow that in the "if" test only.
    const nearPower = (u, v) => Math.abs(u - v) <= 1e-4 * scale;
    const close = (p, q) => valid(p) && valid(q) && dist(p, q) <= tol;
    if (!f.P || !f.big || !f.Ge || f.circles.length !== 6 || !f.seventh) return null;

    const closes = close(f.seventh.c, f.circles[0].c) && near(f.seventh.r, f.circles[0].r);
    const concyclic = f.T.length === 6 &&
      f.T.every((p) => near(dist(p, f.big.c), f.big.r)) && close(f.big.c, f.I);
    const touch = f.M && f.incircle &&
      f.M.every((p) => near(dist(p, f.incircle.c), f.incircle.r));
    const cevians = f.crossings.every(valid) &&
      close(f.crossings[0], f.crossings[1]) && close(f.crossings[1], f.crossings[2]) &&
      f.crossings.every((p) => close(p, f.Ge));

    // The page says A1M1, A2M2, A3M3 are the radical axes of (C2,C6),
    // (C4,C6), (C2,C4). Test both endpoints of each claimed line.
    const axisTests = [
      [1, 5, 0, 0],  // C2 vs C6, axis A1–M1
      [3, 5, 1, 1],  // C4 vs C6, axis A2–M2
      [1, 3, 2, 2],  // C2 vs C4, axis A3–M3
    ];
    const radicalAxes = f.M && axisTests.every(([ia, ib, vi, mi]) => {
      const A = f.circles[ia], B = f.circles[ib];
      return near(power(A, f.V[vi]), power(B, f.V[vi])) &&
             near(power(A, f.M[mi]), power(B, f.M[mi]));
    });
    const c2 = f.circles[1], c4 = f.circles[3], c6 = f.circles[5];
    const radicalCenter = c2 && c4 && c6 &&
      near(power(c2, f.Ge), power(c4, f.Ge)) &&
      near(power(c4, f.Ge), power(c6, f.Ge));

    const tri = tripleCentres(f);
    const triple = {};
    for (const key of ["odd", "even"]) {
      const x = tri[key];
      const ids = key === "odd" ? [0, 2, 4] : [1, 3, 5];
      const concurrent = x && ids.every((i) => nearPower(power(f.circles[i], x), 0));
      triple[key] = {
        concurrent: Boolean(concurrent),
        atGe: Boolean(concurrent && close(x, f.Ge)),
        centre: x,
      };
    }
    return { closes, concyclic, touch: Boolean(touch), cevians,
             radicalAxes: Boolean(radicalAxes), radicalCenter: Boolean(radicalCenter),
             triple, tol };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    start, withPoint, figure, measurements, claims, tripleCentres, result,
    add, sub, mul, dot, cross, dist, sqDist, length, lerp, midPoint, valid,
    intersect, nearest, distToLine, angleBisector, circumcenter, circle, power, sidesOf,
  };
})();
