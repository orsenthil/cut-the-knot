"use strict";

/*
 * Conjugality — the isogonal and isotomic conjugates of points on the side
 * lines of a triangle, from Alexander Bogomolny's applet Conjugality.
 *
 * Three points P[0], P[1], P[2], one on each side line of triangle ABC, are
 * dragged by the player. Each has two partners on its own side line: the
 * isotomic one is the mirror image in the midpoint of that side, and the
 * isogonal one is where the cevian reflected in the angle bisector at the
 * opposite corner meets that side line. The page's claim is that if the three
 * P points lie on one line, their three partners do too.
 *
 * The key idea in the code is that both partners are involutions of a side
 * line. In signed lengths along the sides the isotomic partner inverts every
 * ratio, while the isogonal partner multiplies it by (AB/AC)^2; the product
 * of those squares around a triangle is 1, so Menelaus' product -1 survives
 * both maps.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, ConjugalityCore. A position is plain data
 * (numbers, strings, arrays and objects), so it can be saved for the tutor.
 * Functions never change the position they are given.
 */
const ConjugalityCore = (() => {
  // ConjugalityCanvas.IsInteresting uses these two fixed screen-space tests.
  const COLLINEAR_AREA = 300;   // |twice signed area of PQR| < 300
  const CONCURRENT_GAP = 2;     // the two cevian crossings within 2 units
  const NAMES = ["A0", "A1", "A2", "P0", "P1", "P2"];
  const MODES = ["isotomic", "isogonal"];

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross3 = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const onSegmentLine = (a, b, t) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  /** The endpoints of side line p, in the applet's cyclic order. */
  const sideEnds = (A, p) => [A[(p + 1) % 3], A[(p + 2) % 3]];

  /** GeoSDoub.FindOrientation: 1 when a,b,c turn left, -1 otherwise. */
  const orientation = (a, b, c) => (cross3(a, b, c) > 0 ? 1 : -1);

  /**
   * GeoSDoub.ComputeSignedAngle. Note that the angle is at the FIRST point:
   * ComputeAngle uses SqDist(a,b)+SqDist(a,c)-SqDist(b,c), i.e. the angle
   * bac, and then gives it the sign of FindOrientation(a,b,c).
   */
  function signedAngle(a, b, c) {
    const ab = dist(a, b), ac = dist(a, c);
    if (!ab || !ac) return NaN;
    const cos = (ab * ab + ac * ac - dist(b, c) * dist(b, c)) / (2 * ab * ac);
    return orientation(a, b, c) * Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /** GeoSDoub.Rotate with its fourth argument the sign of the rotation. */
  function rotate(pivot, point, theta, sign) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const dx = point.x - pivot.x, dy = point.y - pivot.y;
    return {
      x: pivot.x + c * dx - sign * s * dy,
      y: pivot.y + sign * s * dx + c * dy,
    };
  }

  /** GeoSDoub.Intersect: null where Java would make a point with NaN coords. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return null;
    return {
      x: (b1 * c2 - b2 * c1) / det,
      y: (c1 * a2 - c2 * a1) / det,
    };
  }

  /** GeoSDoub.FindAngleBisector: internal bisector foot on the opposite line. */
  function angleBisector(a, b, c) {
    const ab = dist(a, b), ac = dist(a, c);
    if (!ab || !ac) return null;
    const cos = (ab * ab + ac * ac - dist(b, c) * dist(b, c)) / (2 * ab * ac);
    const half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2;
    return intersect(a, rotate(a, b, half, orientation(a, b, c)), b, c);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  /**
   * ConjugalityCanvas.DrawReflection, without the drawing. The mark is what
   * the applet stores in M[p]: the side midpoint (isotomic) or the angle
   * bisector foot (isogonal). `point` is Rf[p], written in place by the applet.
   */
  function reflect(p, A, P, mode) {
    const [Ai, Aj] = sideEnds(A, p);
    const Ak = A[p], Pk = P[p];
    if (!Ai || !Aj || !Ak || !Pk) return { point: null, mark: null, angle: NaN };
    if (mode === "isotomic") {
      const m = midpoint(Ai, Aj);
      return {
        point: { x: 2 * m.x - Pk.x, y: 2 * m.y - Pk.y },
        mark: m,
        angle: NaN,
      };
    }
    const theta = signedAngle(Ak, Ai, Pk);
    const turned = rotate(Ak, Aj, theta, -1);
    const point = intersect(Ak, turned, Ai, Aj);
    const mark = angleBisector(Ak, Ai, Aj);
    // For the applet's angle hint it keeps whichever angle is smaller.
    const other = point ? signedAngle(Ak, Ai, point) : NaN;
    const angle = Number.isFinite(other) && Math.abs(other) < Math.abs(theta)
      ? other : theta;
    return { point, mark, angle };
  }

  /** Rebuild the three side points from their line parameters. */
  function withSides(s) {
    const A = s.A.map((p) => ({ x: p.x, y: p.y }));
    const t = [0, 1, 2].map((p) => (s.t[p] === undefined ? 0.25 : s.t[p]));
    return {
      width: s.width, height: s.height,
      A, t,
      P: [0, 1, 2].map((p) => {
        const [a, b] = sideEnds(A, p);
        return onSegmentLine(a, b, t[p]);
      }),
      mode: s.mode === "isogonal" ? "isogonal" : "isotomic",
      showNames: Boolean(s.showNames),
      showHint: Boolean(s.showHint),
    };
  }

  /**
   * The starting diagram. The applet puts the corners at angles
   * (2*pi/3)*i + (pi/5)*random - 2*pi/5 on a circle of radius min(w,h)/4.
   * Here the random draw is 0.5 unless a caller supplies its own generator,
   * so a page load and a test are reproducible.
   */
  function start(options) {
    const o = options || {};
    if (o.points) return withSides(o.points);
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 400 : o.height;
    const radius = Math.min(width, height) / 4;
    const random = o.rng || (() => 0.5);
    const A = [0, 1, 2].map((i) => {
      const angle = (2 * Math.PI / 3) * i + (Math.PI / 5) * random() - 2 * Math.PI / 5;
      return {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 - radius * Math.sin(angle),
      };
    });
    const t = (o.t || [0.3, 0.25, 0.2]).slice();
    return withSides({
      width, height, A, t,
      mode: o.mode || "isotomic",
      showNames: Boolean(o.showNames),
      showHint: Boolean(o.showHint),
    });
  }

  /** Project a dragged point onto its side line and store its parameter. */
  function parameterOn(a, b, p) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return 0;
    return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  }

  /** Move a vertex, or slide P[p] along its side line (not just the segment). */
  function movePoint(s, name, p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return withSides(s);
    const next = {
      width: s.width, height: s.height,
      A: s.A.map((q) => ({ x: q.x, y: q.y })),
      t: s.t.slice(), mode: s.mode,
      showNames: s.showNames, showHint: s.showHint,
    };
    if (/^A[012]$/.test(name)) {
      next.A[Number(name[1])] = { x: p.x, y: p.y };
    } else if (/^P[012]$/.test(name)) {
      const k = Number(name[1]);
      const [a, b] = sideEnds(next.A, k);
      next.t[k] = parameterOn(a, b, p);
    } else {
      return withSides(s);
    }
    return withSides(next);
  }

  /** Set the whole triple of line parameters at once (used by the test). */
  function withParameters(s, t) {
    return withSides({ ...s, t: t.slice() });
  }

  /** Multiply the three signed side ratios around the triangle. */
  function ratioProduct(s) {
    return s.t.reduce((acc, t) => acc * (t / (1 - t)), 1);
  }

  /** Twice the signed area of three points (shoelace sum). */
  function doubleArea(p) {
    if (p.some((q) => !q)) return NaN;
    return p[0].x * (p[1].y - p[2].y) +
      p[1].x * (p[2].y - p[0].y) +
      p[2].x * (p[0].y - p[1].y);
  }

  /** ConjugalityCanvas.Between: is p1 on the line through p2 and p3? */
  function between(p1, p2, p3) {
    if (!p1 || !p2 || !p3 || !Number.isFinite(p1.x)) return false;
    return dist(p1, p2) + dist(p1, p3) - dist(p2, p3) < 2;
  }

  /** ConjugalityCanvas.ShowLine: draw only the middle part of a triple. */
  function lineSegment(p, q, r) {
    if (between(p, q, r)) return [q, r];
    if (between(q, p, r)) return [p, r];
    return [q, p];
  }

  /** ConjugalityCanvas.IsInteresting, transcribed exactly (including 300/2). */
  function isInteresting(s) {
    const P = withSides(s).P;
    let area = 0;
    for (let i = 0; i < 3; i++) {
      const p = P[i], q = P[(i + 1) % 3];
      if (!Number.isFinite(p.x) || !Number.isFinite(q.x)) return 0;
      area += p.x * q.y - p.y * q.x;
    }
    if (Math.abs(area) < COLLINEAR_AREA) return 1;
    const A = s.A;
    const x = intersect(A[0], P[0], A[1], P[1]);
    const y = intersect(A[0], P[0], A[2], P[2]);
    if (!x || !y) return 0;
    return Math.abs(dist(x, y)) < CONCURRENT_GAP ? 2 : 0;
  }

  /** Everything the page draws, derived from a position. */
  function compute(s) {
    const state = withSides(s);
    const refs = [0, 1, 2].map((p) => reflect(p, state.A, state.P, state.mode));
    const Rf = refs.map((r) => r.point);
    const M = refs.map((r) => r.mark);
    return {
      A: state.A, P: state.P, Rf, M,
      angles: refs.map((r) => r.angle),
      mode: state.mode,
      kind: isInteresting(state),
      areaP: doubleArea(state.P),
      areaRf: doubleArea(Rf),
      ratio: ratioProduct(state),
      // Textbook tests, independent of the applet's screen-space thresholds.
      collinear: Math.abs(doubleArea(state.P)) < 1e-6,
      reflectedCollinear: Rf.every(Boolean) &&
        Math.abs(doubleArea(Rf)) < 1e-6,
      concurrent: Math.abs(ratioProduct(state) - 1) < 1e-9,
    };
  }

  /** What the page's theorem says about one configuration. */
  function claims(s) {
    const d = compute(s);
    if (!d.collinear) {
      return { collinear: false, verified: false, ratio: d.ratio, areaRf: d.areaRf };
    }
    return {
      collinear: true,
      verified: d.reflectedCollinear,
      ratio: d.ratio,
      areaRf: d.areaRf,
    };
  }

  const legalMoves = () => NAMES.slice();

  function move(s, m) {
    if (!m || !m.name || !m.point) return null;
    if (!legalMoves().includes(m.name)) return null;
    return movePoint(s, m.name, m.point);
  }

  /** An illustration has no winner; "done" means a line or a meeting was found. */
  function result(s) {
    return isInteresting(s) ? "done" : null;
  }

  return {
    start, withSides, withParameters, movePoint, move, legalMoves, result,
    compute, claims, reflect, isInteresting, lineSegment, between,
    ratioProduct, doubleArea, parameterOn, sideEnds, midpoint, rotate,
    signedAngle, orientation, intersect, angleBisector, onSegmentLine,
    dist, NAMES, MODES, COLLINEAR_AREA, CONCURRENT_GAP,
  };
})();
