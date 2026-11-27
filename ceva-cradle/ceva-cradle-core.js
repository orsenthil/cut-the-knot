"use strict";

/*
 * CevaCradle — the geometry behind Bogomolny's "Cevian Cradle".
 *
 * A triangle ABC has a point X on BC, Y on CA and Z on AB. Pick any point O
 * and draw AO, BO, CO. They meet the sides of the little triangle XYZ at
 * D = AO ∩ YZ, E = BO ∩ XZ, F = CO ∩ XY. The applet's page claims
 *
 *   (AZ/ZB)(BX/XC)(CY/YA) = (ZD/DY)(YF/FX)(XE/EZ),
 *
 * for every position of O: O cancels out of the identity. So the cevians
 * AX, BY, CZ of ABC concur exactly when XD, YE, ZF of XYZ concur.
 *
 * The one idea the code relies on is that the left product depends only on
 * where X, Y, Z sit on the sides, while the right product can be rewritten
 * with the sine form of Ceva's theorem for the three lines through O; the two
 * sine products are reciprocal and cancel. All points here are board units.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CevaCradleCore, so the page loads it with a plain
 * <script> and porting/check-ceva-cradle.mjs loads it in Node. Functions take a
 * position and return new data; nothing passed in is changed.
 */
const CevaCradleCore = (() => {
  const TOL = 0.01;      // CevaCradleCanvas.CheckCeva tolerance
  const NEAR = 1;        // Compute returns early if O is this close to A, B or C

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDistance = (p, q) => {
    const dx = p.x - q.x, dy = p.y - q.y;
    return dx * dx + dy * dy;
  };
  const dot = (ax, ay, bx, by) => ax * bx + ay * by;

  /** DoubLine.CreateMidPoint: m1*t + m2*(1-t), t is the weight of the first end. */
  const onLine = (m1, m2, t) => ({
    x: m1.x * t + m2.x * (1 - t),
    y: m1.y * t + m2.y * (1 - t),
  });

  const midpoint3 = (p, q, r) => ({
    x: (p.x + q.x + r.x) / 3,
    y: (p.y + q.y + r.y) / 3,
  });

  /**
   * GeoSDoub.Intersect: solve two lines in ax+by+c=0 form. The applet calls a
   * determinant below 1 "parallel" and returns a NaN point; null means that
   * here. Keeping the same threshold matters when a line is almost parallel
   * to a side of XYZ.
   */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.NearestPoint(p,a,b): the foot of the perpendicular to line ab. */
  function nearestPoint(p, a, b) {
    if (sqDistance(a, p) < 0.1) return { x: a.x, y: a.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return { x: a.x, y: a.y };
    const t = dot(dx, dy, p.x - a.x, p.y - a.y) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** DoubLine.UpdateMidPoint(p): find and clamp t, then put the point on the line. */
  function parameterOn(m1, m2, p) {
    const dx = m1.x - m2.x, dy = m1.y - m2.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return 0;
    let t = -dot(dx, dy, m2.x - p.x, m2.y - p.y) / len2;
    t = Math.max(0, Math.min(1, t));
    return t;
  }

  /** The initial diagram, placed exactly as CevaCradleCanvas.init places it. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      const s = clone(o.points);
      return withSides(s);
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const cx = width / 2;
    const cy = (height * 11) / 20;
    const r = Math.min(width, height) / 2;
    const fromCircle = (angle) => ({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
    const s = {
      width: width, height: height,
      A: fromCircle(Math.PI / 8),
      B: fromCircle((4 * Math.PI) / 5),
      C: fromCircle((11 * Math.PI) / 9),
    };
    s.tx = 0.6;   // DoubLine.CreateMidPoint(CoefX) on BC
    s.ty = 0.5;   // on CA
    s.tz = 0.5;   // on AB
    return withSides(s);
  }

  function clone(s) {
    const out = {};
    for (const k of ["A", "B", "C", "X", "Y", "Z", "O"]) {
      if (s[k]) out[k] = { x: s[k].x, y: s[k].y };
    }
    for (const k of ["width", "height", "tx", "ty", "tz"]) {
      if (s[k] !== undefined) out[k] = s[k];
    }
    return out;
  }

  /** Rebuild the three side points from their stored line parameters. */
  function withSides(s) {
    const out = clone(s);
    out.X = onLine(out.B, out.C, out.tx === undefined ? 0.5 : out.tx);
    out.Y = onLine(out.C, out.A, out.ty === undefined ? 0.5 : out.ty);
    out.Z = onLine(out.A, out.B, out.tz === undefined ? 0.5 : out.tz);
    if (!out.O) {
      out.O = {
        x: (out.A.x + out.B.x + out.C.x) / 3 - 30,
        y: (out.A.y + out.B.y + out.C.y) / 3 - 10,
      };
    }
    return out;
  }

  /**
   * Move one named point. X, Y and Z keep their parameter on their side;
   * moving a vertex carries the two side points that use it with it, exactly
   * as UpgradePoints / KeepPointOnLine do in the applet.
   */
  function movePoint(s, name, p) {
    const next = clone(s);
    if (!next[name] || !p) return next;
    next[name] = { x: p.x, y: p.y };
    if (name === "X") {
      next.tx = parameterOn(next.B, next.C, p);
      next.X = onLine(next.B, next.C, next.tx);
    } else if (name === "Y") {
      next.ty = parameterOn(next.C, next.A, p);
      next.Y = onLine(next.C, next.A, next.ty);
    } else if (name === "Z") {
      next.tz = parameterOn(next.A, next.B, p);
      next.Z = onLine(next.A, next.B, next.tz);
    } else if (name === "A") {
      next.Z = onLine(next.A, next.B, next.tz);
      next.Y = onLine(next.C, next.A, next.ty);
    } else if (name === "B") {
      next.Z = onLine(next.A, next.B, next.tz);
      next.X = onLine(next.B, next.C, next.tx);
    } else if (name === "C") {
      next.Y = onLine(next.C, next.A, next.ty);
      next.X = onLine(next.B, next.C, next.tx);
    }
    return next;
  }

  /** Everything CevaCradleCanvas.Compute makes from the current position. */
  function compute(s) {
    const empty = {
      valid: false, D: null, E: null, F: null, G: null, H: null,
      left: null, right: null, finished: false, M: null, N: null,
    };
    // The applet returns without recomputing when O sits on a corner.
    if (!s.O || !s.A || !s.B || !s.C || !s.X || !s.Y || !s.Z) return empty;
    if (distance(s.O, s.A) < NEAR || distance(s.O, s.B) < NEAR || distance(s.O, s.C) < NEAR) return empty;

    const D = intersect(s.A, s.O, s.Y, s.Z);
    const E = intersect(s.B, s.O, s.Z, s.X);
    const F = intersect(s.C, s.O, s.X, s.Y);
    const G = nearestPoint(s.Y, s.A, s.O);
    const H = nearestPoint(s.Z, s.A, s.O);

    const left =
      (distance(s.A, s.Z) / distance(s.Z, s.B)) *
      (distance(s.B, s.X) / distance(s.X, s.C)) *
      (distance(s.C, s.Y) / distance(s.Y, s.A));
    const right = D && E && F
      ? (distance(s.Z, D) / distance(D, s.Y)) *
        (distance(s.Y, F) / distance(F, s.X)) *
        (distance(s.X, E) / distance(E, s.Z))
      : NaN;

    // CheckCeva: both products must be within 0.01 of 1.
    const finished = Math.abs(left - 1) < TOL && Math.abs(right - 1) < TOL;
    let M = null, N = null;
    if (finished) {
      M = midpoint3(
        intersect(s.A, s.X, s.B, s.Y),
        intersect(s.B, s.Y, s.C, s.Z),
        intersect(s.C, s.Z, s.A, s.X),
      );
      N = midpoint3(
        intersect(D, s.X, E, s.Y),
        intersect(E, s.Y, F, s.Z),
        intersect(F, s.Z, D, s.X),
      );
    }
    return {
      valid: true, D: D, E: E, F: F, G: G, H: H,
      left: left, right: right, finished: finished, M: M, N: N,
    };
  }

  /** The claims of the applet's page, checked at this one configuration. */
  function claims(s) {
    const m = compute(s);
    if (!m.valid || !m.D || !m.E || !m.F) {
      return { constructed: false, identity: false, concurrentTogether: false, feetCorrect: false };
    }
    const on = (p, a, b) => Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) < 1e-6;
    const scale = Math.max(1, Math.abs(m.left), Math.abs(m.right));
    return {
      constructed: on(m.D, s.A, s.O) && on(m.D, s.Y, s.Z) &&
        on(m.E, s.B, s.O) && on(m.E, s.Z, s.X) &&
        on(m.F, s.C, s.O) && on(m.F, s.X, s.Y),
      identity: Math.abs(m.left - m.right) < 1e-7 * scale,
      concurrentTogether: (Math.abs(m.left - 1) < TOL) === (Math.abs(m.right - 1) < TOL),
      feetCorrect: on(m.G, s.A, s.O) && on(m.H, s.A, s.O) &&
        dot(s.Y.x - m.G.x, s.Y.y - m.G.y, s.O.x - s.A.x, s.O.y - s.A.y) < 1e-6 &&
        dot(s.Z.x - m.H.x, s.Z.y - m.H.y, s.O.x - s.A.x, s.O.y - s.A.y) < 1e-6,
    };
  }

  const legalMoves = (/* state */) => ["A", "B", "C", "X", "Y", "Z", "O"];

  function move(s, m) {
    if (!m || !m.name || !m.point) return null;
    if (!legalMoves().includes(m.name)) return null;
    return movePoint(s, m.name, m.point);
  }

  /** An illustration has no winner; "done" marks a concurrent pair. */
  function result(s) {
    return compute(s).finished ? "done" : null;
  }

  return {
    start, clone, withSides, movePoint, compute, claims,
    intersect, nearestPoint, onLine, distance, parameterOn,
    legalMoves, move, result, TOL, NEAR,
  };
})();
