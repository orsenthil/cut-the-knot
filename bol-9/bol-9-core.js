"use strict";

/*
 * BOL9 — Book of Lemmas, Proposition 9 (Archimedes, two perpendicular chords).
 *
 * In a circle, a horizontal chord AB and a vertical chord CD meet at right
 * angles at O (the centre is not on either chord). Archimedes says
 *
 *     arc AD + arc CB = arc AC + arc DB,
 *
 * and the cut-the-knot article adds that each of the two sums is a semicircle,
 * because both are twice one of the right angles at O.
 *
 * The applet BOL9Canvas keeps the circle fixed (centre (width/2, height/2),
 * radius min(width,height)/2 * 7/12) and lets the player drag the two whole
 * chord lines, always horizontally and vertically. ComputePoints cuts each
 * line by the circle, orders A left of B and C above D, and Arc.SetAngle turns
 * each pair of endpoints into a signed angle about the circle's centre, using
 * the east point Ro as reference. This core reproduces that computation; the
 * logic test transcribes GeoSDoub.IntersectX/Y, FindOrientation,
 * ComputeSignedAngle and MoveToFirstCircle a second time from the bytecode and
 * compares them over hundreds of configurations.
 *
 * A drag in the applet is refused once the intersection of the two chords is
 * within 5 px of the circle; the last accepted position is nudged a tenth of
 * the way towards the centre. Here the requested position is projected back
 * onto that same safe circle (radius r - 5) in one step — the final picture is
 * the same, without relying on how fast the mouse moves.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Bol9Core, so the page loads it with a plain <script>
 * and porting/check-bol-9.mjs loads it in Node. Positions are plain data.
 */
const Bol9Core = (() => {
  const EPS = 1e-9;
  const TAU = 2 * Math.PI;
  const GAP = 5; // the applet stops a drag at radius - 5 pixels

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const near = (a, b, tol) => Math.abs(a - b) <= tol;

  /** The starting diagram. Chord offsets are inside the applet's random range. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const cx = o.cx === undefined ? width / 2 : o.cx;
    const cy = o.cy === undefined ? height / 2 : o.cy;
    const r = o.r === undefined ? Math.min(cx, cy) * 7 / 12 : o.r;
    const limit = Math.max(0, r - GAP - EPS);
    const cdOffset = clamp(o.cdOffset === undefined ? -r / 4 : o.cdOffset, -limit, limit);
    const abOffset = clamp(o.abOffset === undefined ? r / 3 : o.abOffset, -limit, limit);
    return { width, height, cx, cy, r, cdX: cx + cdOffset, abY: cy + abOffset };
  }

  /** Move one chord line; the other stays where it is unless the joint limit bites. */
  function withChord(s, name, value) {
    const next = { width: s.width, height: s.height, cx: s.cx, cy: s.cy, r: s.r, cdX: s.cdX, abY: s.abY };
    if (name === "CD") next.cdX = clamp(value, s.cx - s.r, s.cx + s.r);
    else if (name === "AB") next.abY = clamp(value, s.cy - s.r, s.cy + s.r);
    else return next;

    const limit = Math.max(0, s.r - GAP - EPS);
    let dx = next.cdX - s.cx, dy = next.abY - s.cy;
    const d = Math.hypot(dx, dy);
    if (d > limit) {
      if (name === "CD") next.cdX = s.cx + dx * limit / d;
      else next.abY = s.cy + dy * limit / d;
      dx = next.cdX - s.cx;
      dy = next.abY - s.cy;
      const again = Math.hypot(dx, dy);
      if (again > limit && again > EPS) {
        next.cdX = s.cx + dx * limit / again;
        next.abY = s.cy + dy * limit / again;
      }
    }
    return next;
  }

  /** GeoSDoub.FindOrientation: +1 when c is left of a->b (screen y grows down). */
  function orientation(a, b, c) {
    const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return v > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle: the signed turn from p to q about o. */
  function signedAngle(o, p, q) {
    const ux = p.x - o.x, uy = p.y - o.y;
    const vx = q.x - o.x, vy = q.y - o.y;
    const nu = Math.hypot(ux, uy), nv = Math.hypot(vx, vy);
    if (nu < EPS || nv < EPS) return 0;
    const cos = clamp((ux * vx + uy * vy) / (nu * nv), -1, 1);
    const a = Math.acos(cos);
    return orientation(o, p, q) === 1 ? a : -a;
  }

  /** Arc.MoveToFirstCircle: bring an angle into [0, 2*pi). */
  function firstCircle(angle) {
    let a = angle;
    while (a < 0) a += TAU;
    while (a >= TAU) a -= TAU;
    return a;
  }

  /** The ordinary angle at a vertex, in [0, pi]. */
  function angleAt(v, p, q) {
    const a = { x: p.x - v.x, y: p.y - v.y }, b = { x: q.x - v.x, y: q.y - v.y };
    const na = Math.hypot(a.x, a.y), nb = Math.hypot(b.x, b.y);
    if (na < EPS || nb < EPS) return 0;
    return Math.acos(clamp((a.x * b.x + a.y * b.y) / (na * nb), -1, 1));
  }

  /**
   * One of the applet's four coloured arcs. Arc.SetAngle(p, q) stores
   * Value = signed angle from q to p and Start = signed angle from p to Ro.
   * The measure of the arc is |Value|, independent of where Java starts drawing.
   */
  function arc(o, ro, p, q) {
    const value = signedAngle(o, q, p);
    const start = firstCircle(signedAngle(o, p, ro));
    return {
      start, value, measure: Math.abs(value),
      degrees: Math.abs(value) * 180 / Math.PI,
    };
  }

  /** Everything the page draws and the logic test checks. */
  function geometry(s) {
    const o = { x: s.cx, y: s.cy };
    const ro = { x: s.cx + s.r, y: s.cy };
    const dy = s.abY - s.cy, dx = s.cdX - s.cx;
    const halfAB = Math.sqrt(Math.max(0, s.r * s.r - dy * dy));
    const halfCD = Math.sqrt(Math.max(0, s.r * s.r - dx * dx));
    const degenerate = halfAB < EPS || halfCD < EPS;
    const A = { x: s.cx - halfAB, y: s.abY };
    const B = { x: s.cx + halfAB, y: s.abY };
    const C = { x: s.cdX, y: s.cy + halfCD };
    const D = { x: s.cdX, y: s.cy - halfCD };
    const arcs = {
      BC: arc(o, ro, B, C),
      AD: arc(o, ro, A, D),
      AC: arc(o, ro, A, C),
      BD: arc(o, ro, B, D),
    };
    const O = { x: s.cdX, y: s.abY };
    const angleAOD = angleAt(O, A, D);
    const angleBOD = angleAt(O, B, D);
    return {
      circle: { x: s.cx, y: s.cy, r: s.r }, ro, O, A, B, C, D,
      degenerate, halfAB, halfCD, arcs, angleAOD, angleBOD,
      sumADCB: arcs.AD.measure + arcs.BC.measure,
      sumACDB: arcs.AC.measure + arcs.BD.measure,
      circumference: arcs.AD.measure + arcs.BC.measure + arcs.AC.measure + arcs.BD.measure,
    };
  }

  /** The article's claims, checked numerically at this diagram. */
  function claims(s) {
    const g = geometry(s);
    const tol = 1e-8;
    const no = {
      chordsMeetInside: false, rightAngles: false, adPlusCbIsSemicircle: false,
      acPlusDbIsSemicircle: false, sumsEqual: false, twiceTheAngle: false,
      arcsMakeWholeCircle: false,
    };
    if (g.degenerate) return no;
    return {
      chordsMeetInside: dist(g.O, g.circle) < g.circle.r + tol,
      rightAngles: near(g.angleAOD, Math.PI / 2, tol) && near(g.angleBOD, Math.PI / 2, tol),
      adPlusCbIsSemicircle: near(g.sumADCB, Math.PI, tol),
      acPlusDbIsSemicircle: near(g.sumACDB, Math.PI, tol),
      sumsEqual: near(g.sumADCB, g.sumACDB, tol),
      twiceTheAngle: near(g.sumADCB, 2 * g.angleAOD, tol) && near(g.sumACDB, 2 * g.angleBOD, tol),
      arcsMakeWholeCircle: near(g.circumference, TAU, tol),
    };
  }

  /** An illustration has nothing to win or lose. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, TAU, GAP, clamp, dist, near, start, withChord, orientation,
    signedAngle, firstCircle, angleAt, arc, geometry, claims, result,
  };
})();
