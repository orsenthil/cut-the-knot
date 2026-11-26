"use strict";

/*
 * Building Bridges — the illustration behind Bogomolny's "Building Bridges".
 *
 * Two towns A and B sit on opposite sides of two rivers. Each river is a strip
 * between two parallel banks; a road may cross it only along a bridge that is
 * perpendicular to those banks. The picture finds the shortest such road.
 *
 * The one idea the code relies on is translation. Each bridge is a fixed
 * vector: d0 carries a point of the upper bank of the first river to its lower
 * bank, d1 does the same for the second river. Sliding A forward by d0 gives
 * A', and sliding B back by d1 gives B'. Because the bridge lengths never
 * change, the problem is to join A' to B' by the shortest land path; a straight
 * segment does that. Its crossings with the far bank of each river are the
 * bridge positions, and the three land pieces of the road are parallel:
 *
 *     AC || C'C'' || C'''B.
 *
 * This follows BuildingBridgesCanvas.ComputePoints literally: the bridge
 * vectors come from projecting each upper bank's midpoint onto its partner
 * bank, AA = A + d0, BB = B - d1, and the line through A parallel to AA - BB
 * cuts the near bank of the first river while the line through B parallel to
 * it cuts the far bank of the second. The mate of each crossing is its
 * perpendicular projection on the other bank.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BuildingBridgesCore, so the page loads it with a plain
 * <script> and porting/check-building-bridges.mjs loads it in Node. All
 * functions take plain data and return new objects; nothing passed in changes.
 */
const BuildingBridgesCore = (() => {
  const EPS = 1e-9;
  const WIDTH = 30; // the applet separates a river's banks by 30 units

  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const scale = (a, t) => ({ x: a.x * t, y: a.y * t });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const same = (a, b, tol) => finite(a) && finite(b) && dist(a, b) <= tol;

  /** CTKGeometryPlus.Perp(p, q, p) normalised to `width`: the bank-to-bank vector. */
  function perpendicular(p, q, width) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) return { x: 0, y: width };
    return { x: (-dy / len) * width, y: (dx / len) * width };
  }

  /** GeoSDoub.NearestPoint(p, a, b), including the applet's short-distance guard. */
  function nearestOnLine(p, a, b) {
    if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.Intersect in its own ax+by+c form; null when the lines are parallel. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** ComputeBridge(upper, lower): upper midpoint carried to the lower bank. */
  function bridgeVector(river) {
    const mid = midpoint(river.upper.a, river.upper.b);
    const foot = nearestOnLine(mid, river.lower.a, river.lower.b);
    return sub(foot, mid);
  }

  /** The starting diagram, from BuildingBridgesCanvas.init with a fixed random. */
  function start(options) {
    const o = options || {};
    if (o.position) {
      const s = o.position;
      return {
        width: s.width, height: s.height, random: s.random,
        A: { ...s.A }, B: { ...s.B },
        rivers: s.rivers.map((r) => ({
          upper: { a: { ...r.upper.a }, b: { ...r.upper.b } },
          lower: { a: { ...r.lower.a }, b: { ...r.lower.b } },
          coef: r.coef,
        })),
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const random = o.random === undefined ? 0.5 : o.random;
    const half = height / 2;
    const sixth = height / 6;
    const A = { x: width / 4, y: height * (random / 6 + 0.2) };
    const B = { x: (3 * width) / 4, y: sixth * (random + 4.8) };
    const river = (i) => {
      const offsetY = (i === 0 ? -1 : 1) * sixth * random;
      const a = { x: 10, y: half + offsetY };
      const b = { x: width - 10, y: half + offsetY };
      const off = perpendicular(a, b, WIDTH);
      return {
        upper: { a, b },
        lower: { a: add(a, off), b: add(b, off) },
        // The applet draws C at a random point in [0.3, 0.7] of the bank.
        // Two different values keep its two bridge attempts distinct here.
        coef: i === 0 ? 0.35 : 0.65,
      };
    };
    return { width, height, random, A, B, rivers: [river(0), river(1)] };
  }

  /** The whole construction: bridge vectors, translations and bridge ends. */
  function geometry(s) {
    const r0 = s.rivers[0], r1 = s.rivers[1];
    const d0 = bridgeVector(r0), d1 = bridgeVector(r1);
    const Aprime = add(s.A, d0);
    const Bprime = sub(s.B, d1);
    // AA - BB in the bytecode; its direction is the same as A' -> B'.
    const v = sub(Aprime, Bprime);
    const KU0 = intersect(r0.upper.a, r0.upper.b, s.A, add(s.A, v));
    const KL0 = finite(KU0) ? nearestOnLine(KU0, r0.lower.a, r0.lower.b) : null;
    const KL1 = intersect(r1.lower.a, r1.lower.b, s.B, sub(s.B, v));
    const KU1 = finite(KL1) ? nearestOnLine(KL1, r1.upper.a, r1.upper.b) : null;
    return { d0, d1, Aprime, Bprime, v, KU0, KL0, KL1, KU1 };
  }

  /** Whether the diagram describes the puzzle the page states. */
  function valid(s, g) {
    const m = g || geometry(s);
    if (!m || ![m.KU0, m.KL0, m.KL1, m.KU1].every(finite)) return false;
    if (Math.hypot(m.d0.x, m.d0.y) < 1 || Math.hypot(m.d1.x, m.d1.y) < 1) return false;
    const r0 = s.rivers[0], r1 = s.rivers[1];
    const before = (p, bank, d) => dot(sub(p, bank.a), d) < -EPS;
    const after = (p, bank, d) => dot(sub(p, bank.b), d) > EPS;
    // A is on the near side of the first river, B beyond the second one,
    // and the rivers themselves must not have been dragged over each other.
    return before(s.A, r0.upper, m.d0)
      && before(s.A, r0.lower, m.d0)
      && after(s.B, r1.lower, m.d1)
      && after(s.B, r1.upper, m.d1)
      && after(r1.upper.a, r0.lower, m.d0)
      && after(r1.upper.b, r0.lower, m.d0);
  }

  /** The player's two bridges, C C' and C'' C''', at their chosen bank points. */
  function attempt(s, g) {
    const m = g || geometry(s);
    const C0 = lerp(s.rivers[0].upper.a, s.rivers[0].upper.b, s.rivers[0].coef);
    const C1 = lerp(s.rivers[1].upper.a, s.rivers[1].upper.b, s.rivers[1].coef);
    return { C0, Cp0: add(C0, m.d0), C1, Cp1: add(C1, m.d1) };
  }

  /** The five pieces of a route from A to B: land, bridge, land, bridge, land. */
  function route(s, g) {
    const m = g || geometry(s);
    return [s.A, m.KU0, m.KL0, m.KU1, m.KL1, s.B];
  }

  function pathLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
    return total;
  }

  /** The claimed minimum: the straight A'B' plus the two fixed bridges. */
  function shortestLength(s, g) {
    const m = g || geometry(s);
    return dist(m.Aprime, m.Bprime) + dist(m.d0, { x: 0, y: 0 }) + dist(m.d1, { x: 0, y: 0 });
  }

  /** The route through the player's own two bridges. */
  function attemptLength(s, g) {
    const m = g || geometry(s);
    const a = attempt(s, m);
    return pathLength([s.A, a.C0, a.Cp0, a.C1, a.Cp1, s.B]);
  }

  /** Each claim on the applet's page, checked at this diagram. */
  function claims(s, g) {
    const m = g || geometry(s);
    const no = {
      bridgesPerpendicular: false, bridgeWidths: false, translationsTowardRivers: false,
      bridgeEndsOnBanks: false, landSegmentsParallel: false,
      shortestRouteParallel: false, shortestLengthFormula: false, attemptNoShorter: false,
    };
    if (!valid(s, m)) return no;
    const size = Math.max(1, dist(s.A, s.B), Math.abs(m.v.x), Math.abs(m.v.y));
    const tol = 1e-6 * size;
    const r0 = s.rivers[0], r1 = s.rivers[1];
    const dir0 = sub(r0.upper.b, r0.upper.a);
    const dir1 = sub(r1.upper.b, r1.upper.a);
    const onLine = (p, a, b) => Math.abs(cross(sub(b, a), sub(p, a))) / dist(a, b) <= tol;
    const parallel = (u, w) => Math.abs(cross(u, w)) <= tol * Math.hypot(w.x, w.y);
    return {
      // Bridges are perpendicular to both banks of their own river.
      bridgesPerpendicular: parallel(m.d0, { x: -dir0.y, y: dir0.x })
        && parallel(m.d1, { x: -dir1.y, y: dir1.x }),
      // Both bridges have the applet's fixed width of 30 units.
      bridgeWidths: Math.abs(dist(m.d0, { x: 0, y: 0 }) - WIDTH) < tol
        && Math.abs(dist(m.d1, { x: 0, y: 0 }) - WIDTH) < tol,
      // A' and B' are translated towards the river nearest to each town.
      translationsTowardRivers: same(m.Aprime, add(s.A, m.d0), tol)
        && same(m.Bprime, sub(s.B, m.d1), tol)
        && dot(sub(m.Aprime, s.A), m.d0) > 0
        && dot(sub(m.Bprime, s.B), m.d1) < 0,
      // The bridge ends sit on the right banks, one width apart.
      bridgeEndsOnBanks:
        onLine(m.KU0, r0.upper.a, r0.upper.b) && onLine(m.KL0, r0.lower.a, r0.lower.b)
        && onLine(m.KL1, r1.lower.a, r1.lower.b) && onLine(m.KU1, r1.upper.a, r1.upper.b)
        && same(add(m.KU0, m.d0), m.KL0, tol)
        && same(sub(m.KL1, m.d1), m.KU1, tol),
      // The exact claim on the page: AC || C'C'' || C'''B.
      landSegmentsParallel:
        parallel(sub(m.KU0, s.A), m.v)
        && parallel(sub(m.KU1, m.KL0), m.v)
        && parallel(sub(s.B, m.KL1), m.v),
      // The two crossing lines really go through A and B in that direction.
      shortestRouteParallel:
        onLine(s.A, m.KU0, add(m.KU0, m.v))
        && onLine(s.B, m.KL1, sub(m.KL1, m.v)),
      // Total length = straight A'B' + the two bridge widths.
      shortestLengthFormula: Math.abs(pathLength(route(s, m)) - shortestLength(s, m)) < tol,
      // No choice of bridge positions for the player's attempt beats it.
      attemptNoShorter: attemptLength(s, m) >= shortestLength(s, m) - tol,
    };
  }

  /** Where a dragged point lands on a bank, as CTKMoveableDoub.RestrictToLine does. */
  function onBank(s, index, p) {
    const u = s.rivers[index].upper;
    return nearestOnLine(p, u.a, u.b);
  }

  /** A new state with one named point moved; every other point is unchanged. */
  function withPoint(s, name, p) {
    const next = {
      width: s.width, height: s.height, random: s.random,
      A: { ...s.A }, B: { ...s.B },
      rivers: s.rivers.map((r) => ({
        upper: { a: { ...r.upper.a }, b: { ...r.upper.b } },
        lower: { a: { ...r.lower.a }, b: { ...r.lower.b } },
        coef: r.coef,
      })),
    };
    if (name === "A" || name === "B") {
      next[name] = { x: p.x, y: p.y };
      return next;
    }
    if (name === "M0" || name === "M1") {
      const i = Number(name[1]), r = next.rivers[i];
      const oldMid = midpoint(r.upper.a, r.upper.b);
      const delta = sub(p, oldMid);
      r.upper.a = add(r.upper.a, delta);
      r.upper.b = add(r.upper.b, delta);
      r.lower.a = add(r.lower.a, delta);
      r.lower.b = add(r.lower.b, delta);
      return next;
    }
    const match = /^([UL])([01])([ab])$/.exec(name);
    if (name === "C0" || name === "C1") {
      const i = Number(name[1]), r = next.rivers[i];
      const dx = r.upper.b.x - r.upper.a.x, dy = r.upper.b.y - r.upper.a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 < EPS ? r.coef : ((p.x - r.upper.a.x) * dx + (p.y - r.upper.a.y) * dy) / len2;
      r.coef = clamp(t, -0.25, 1.25);
      return next;
    }
    if (!match) return next;
    const i = Number(match[2]), r = next.rivers[i], side = match[1], part = match[3];
    // Dragging one bank keeps its partner parallel at the same width, exactly
    // as OneInPair.UpdateLocation does for a rotation of either line.
    if (side === "U") {
      r.upper[part] = { x: p.x, y: p.y };
      const off = perpendicular(r.upper.a, r.upper.b, WIDTH);
      r.lower.a = add(r.upper.a, off);
      r.lower.b = add(r.upper.b, off);
    } else {
      r.lower[part] = { x: p.x, y: p.y };
      const off = perpendicular(r.lower.a, r.lower.b, WIDTH);
      r.upper.a = sub(r.lower.a, off);
      r.upper.b = sub(r.lower.b, off);
    }
    return next;
  }

  /** An illustration has no win, loss or finish. */
  function result(/* state */) {
    return null;
  }

  return {
    WIDTH, add, sub, scale, dot, cross, dist, midpoint, lerp, clamp, finite,
    perpendicular, nearestOnLine, intersect, bridgeVector, start, geometry, valid,
    attempt, route, pathLength, shortestLength, attemptLength, claims, onBank,
    withPoint, result,
  };
})();
