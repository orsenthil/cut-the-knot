"use strict";

/*
 * Diameters And Chords — Alexander Bogomolny's geometry illustration, from the
 * applet DiametersAndChords.  A circle has three diameters BBt, CCt, MtNt and
 * two chords BAb and CAc.  M and N are where those chords cross MtNt; Kb is
 * the second point where NBt meets the circle and Kc the second point where
 * MCt meets it.  The page asks us to prove Ab = Ac exactly when Kb = Kc — a
 * consequence of Pascal's theorem applied to the hexagon A B Bt Kb Ct C.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, DiametersAndChordsCore, so the page loads
 * it with a plain <script> and the logic test loads it in Node.  The position
 * is plain data, so the player's record and the tutor can take it as it is.
 *
 * The old applet uses a 500x450 canvas with centre (250,270) and radius
 * min(500,450)/3; the SVG here is the same picture scaled to 400x360, so the
 * centre is (200,216) and the radius is 120.  Screen y grows downwards, so a
 * point at mathematical angle t is (cx + r cos t, cy - r sin t).  All six
 * draggable points are restricted to the circle and Mt, Nt are always
 * antipodal (the applet's RestrictToCircle and RedefineN/RedefineM).
 */
const DiametersAndChordsCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 360 };
  const CIRCLE = { c: { x: 200, y: 216 }, r: 120 };
  // CreatePointOnCircle's angles in DiametersAndChordsCanvas.init().
  const START_ANGLES = {
    Ab: 1.727875959474386,
    Ac: Math.PI / 2,
    B: 3.7699111843077517,
    C: 5.235987755982989,
    Mt: 3.0925052683774528,
  };
  const NAMES = ["Ab", "Ac", "B", "C", "Mt", "Nt"];
  const TWO_PI = 2 * Math.PI;

  const point = (x, y) => ({ x, y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const wrap = (t) => ((t % TWO_PI) + TWO_PI) % TWO_PI;

  /** CreatePointOnCircle: note the minus sign, because screen y points down. */
  function pointOnCircle(t, circle) {
    const c = (circle || CIRCLE).c, r = (circle || CIRCLE).r;
    return point(c.x + r * Math.cos(t), c.y - r * Math.sin(t));
  }

  /** The angle t of a point on the circle, as atan2(cy - y, x - cx). */
  function angleOf(p, circle) {
    const c = (circle || CIRCLE).c;
    return wrap(Math.atan2(c.y - p.y, p.x - c.x));
  }

  /** CTKMoveableDoub.RestrictToCircle: slide a dragged point onto the circle. */
  function project(p, circle) {
    const c = (circle || CIRCLE).c;
    if (!finite(p)) return pointOnCircle(0, circle);
    const dx = p.x - c.x, dy = p.y - c.y, n = Math.hypot(dx, dy);
    if (n < 1e-9) return pointOnCircle(0, circle);
    const k = (circle || CIRCLE).r / n;
    return point(c.x + dx * k, c.y + dy * k);
  }

  const clamp = (p) => project(p, CIRCLE);

  /* GeoSDoub.Intersect(DoubLine, DoubCircle), transcribed from CTKGeometry:
   * x = m y + q when |dy| > 1, else y = m x + q when |dx| > 1.  The one-pixel
   * test and the null result on a negative discriminant are the applet's own
   * behaviour, not rounding choices. */
  function lineCircle(a, b, circle) {
    const c = (circle || CIRCLE).c, r = (circle || CIRCLE).r;
    const dy = a.y - b.y, dx = a.x - b.x;
    if (Math.abs(dy) > 1) {
      const m = dx / dy, q = b.x - m * b.y;
      const A = 1 + m * m;
      const Bh = m * (q - c.x) - c.y;
      const C = c.y * c.y + (q - c.x) * (q - c.x) - r * r;
      const D = Bh * Bh - A * C;
      if (D < 0) return null;
      const s = Math.sqrt(D);
      const t1 = (-Bh + s) / A, t2 = (-Bh - s) / A;
      return [point(m * t1 + q, t1), point(m * t2 + q, t2)];
    }
    if (Math.abs(dx) > 1) {
      const m = dy / dx, q = b.y - m * b.x;
      const A = 1 + m * m;
      const Bh = m * (q - c.y) - c.x;
      const C = c.x * c.x + (q - c.y) * (q - c.y) - r * r;
      const D = Bh * Bh - A * C;
      if (D < 0) return null;
      const s = Math.sqrt(D);
      const t1 = (-Bh + s) / A, t2 = (-Bh - s) / A;
      return [point(t1, m * t1 + q), point(t2, m * t2 + q)];
    }
    return null; // the applet's Intersect() returns null for a tiny line
  }

  /** DiametersAndChordsCanvas.Other: of two circle hits, take the FARTHER one. */
  function other(hits, known) {
    if (!hits || !hits[0] || !hits[1]) return null;
    const d0 = dist(hits[0], known), d1 = dist(hits[1], known);
    // Java's dcmpg sends NaN to "keep hits[0]", as this comparison does.
    return d0 < d1 ? hits[1] : hits[0];
  }

  /** GeoSDoub.Intersect(DoubPoint x4): NaN when |det| < 1, as in the applet. */
  function lineIntersection(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  function antipode(p, circle) {
    return other(lineCircle(p, (circle || CIRCLE).c, circle), p);
  }

  function secondHit(known, through, circle) {
    if (!finite(known) || !finite(through)) return null;
    const hits = lineCircle(known, through, circle);
    if (!hits || !finite(hits[0])) return null;
    return other(hits, known);
  }

  /** Compute(), transcribed in the same order as the applet's bytecode. */
  function geometryFromAngles(angles, previous) {
    const Ab = pointOnCircle(angles.Ab, CIRCLE);
    const Ac = pointOnCircle(angles.Ac, CIRCLE);
    const B = pointOnCircle(angles.B, CIRCLE);
    const C = pointOnCircle(angles.C, CIRCLE);
    const Mt = pointOnCircle(angles.Mt, CIRCLE);

    const Bt = antipode(B, CIRCLE);
    const Ct = antipode(C, CIRCLE);
    const Nt = antipode(Mt, CIRCLE); // RedefineN(), also used for the start

    const M = Nt ? lineIntersection(Ab, B, Mt, Nt) : point(NaN, NaN);
    const N = Nt ? lineIntersection(Ac, C, Mt, Nt) : point(NaN, NaN);

    // Compute() leaves the old Kb/Kc in place when the intersection is null
    // or has a NaN first point.  `previous` carries those stale values.
    let Kb = previous ? previous.Kb : null;
    let Kc = previous ? previous.Kc : null;
    const kb = Bt ? secondHit(Bt, N, CIRCLE) : null;
    if (kb) Kb = kb;
    const kc = Ct ? secondHit(Ct, M, CIRCLE) : null;
    if (kc) Kc = kc;

    const L = lineIntersection(Ab, B, Ac, C);
    const aDistance = dist(Ab, Ac);
    const kDistance = Kb && Kc ? dist(Kb, Kc) : NaN;
    // Finished in the applet: dist(Ab, Ac) < 1 (one screen pixel).
    const finished = aDistance < 1;

    return {
      circle: CIRCLE, Ab, Ac, B, C, Mt, Nt, Bt, Ct, M, N, Kb, Kc, L,
      angles: { Ab: angles.Ab, Ac: angles.Ac, B: angles.B, C: angles.C, Mt: angles.Mt,
        Nt: Nt ? angleOf(Nt, CIRCLE) : NaN },
      aDistance, kDistance, finished,
      aCoincide: aDistance < 1,
      kCoincide: Number.isFinite(kDistance) && kDistance < 1,
      aExact: aDistance < 1e-6,
      kExact: Number.isFinite(kDistance) && kDistance < 1e-6,
    };
  }

  function start(options) {
    const o = options || {};
    const angles = Object.assign({}, START_ANGLES);
    if (o.angles) for (const name of NAMES) {
      if (Number.isFinite(o.angles[name])) angles[name] = wrap(o.angles[name]);
    }
    const state = {
      angles,
      options: {
        names: o.names === undefined ? true : !!o.names,
        hint: o.hint === undefined ? true : !!o.hint,
      },
      explored: !!o.explored,
    };
    state.geometry = geometryFromAngles(state.angles, null);
    return state;
  }

  /** A position made from raw angles, for tests and the position reader. */
  function fromAngles(angles, options) {
    return start(Object.assign({}, options || {}, { angles }));
  }

  /** Move a draggable point; Mt and Nt stay opposite, as in UpgradePoints. */
  function movePoint(state, name, p) {
    if (NAMES.indexOf(name) < 0 || !finite(p)) return state;
    const angles = Object.assign({}, state.angles);
    angles[name] = angleOf(project(p, CIRCLE), CIRCLE);
    if (name === "Mt" || name === "Nt") {
      const pair = name === "Mt" ? "Nt" : "Mt";
      angles[pair] = angles[name] + Math.PI;
    }
    const next = Object.assign({}, state, { angles, explored: true });
    next.geometry = geometryFromAngles(angles, state.geometry);
    return next;
  }

  /** Rotate one point to an angle, without going through screen coordinates. */
  function setAngle(state, name, t) {
    if (NAMES.indexOf(name) < 0 || !Number.isFinite(t)) return state;
    return movePoint(state, name, pointOnCircle(wrap(t), CIRCLE));
  }

  function setOption(state, name, value) {
    if (name !== "names" && name !== "hint") return state;
    const next = Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!value }), explored: true,
    });
    return next;
  }

  function reset(state) {
    return start({ names: state.options.names, hint: state.options.hint, explored: state.explored });
  }

  /** A demo: there is no win or loss, only an explored diagram. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  function geometry(state) {
    return state.geometry;
  }

  function describe(state) {
    const g = state.geometry;
    const a = g.aDistance.toFixed(1), k = Number.isFinite(g.kDistance) ? g.kDistance.toFixed(1) : "-";
    if (g.aCoincide) {
      return g.kCoincide
        ? "The two A points meet, and so do the two K points — just as the theorem says."
        : `The two A points meet (${a} apart); the K points are ${k} apart.`;
    }
    if (g.kCoincide) {
      return `The K points look together (${k} apart), but the A points are ${a} apart.`;
    }
    return `A points ${a} apart; K points ${k} apart. Drag a point, or use the arrow keys, to explore.`;
  }

  return {
    VIEW, CIRCLE, START_ANGLES, NAMES,
    point, dist, finite, wrap, pointOnCircle, angleOf, project, clamp,
    lineCircle, other, lineIntersection, antipode, secondHit,
    geometryFromAngles, start, fromAngles, movePoint, setAngle, setOption,
    reset, result, geometry, describe,
  };
})();
