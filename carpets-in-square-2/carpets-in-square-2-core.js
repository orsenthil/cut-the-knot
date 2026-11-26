"use strict";

/*
 * Carpets In Square 2 — the second square carpet theorem, from Alexander
 * Bogomolny's applet CarpetsInSquare2 ("Two Rectangles in a Rectangle").
 *
 * The picture is a rectangle ABCD. F sits on BC; H = 2O-F is its reflection
 * in the centre O of ABCD. The circle with centre O through F meets the bottom
 * side AB at E (left) and I (right); G = 2O-E and J = 2O-I are their
 * reflections on the top side. EFGH and IFJH are then two rectangles that
 * share the diagonal FH. Their other sides cross at K (top) and L (bottom).
 * In the applet's normal picture six red triangles and the blue quadrilateral
 * HKFL have equal area; with "hint" ticked four other red triangles and the
 * blue quadrilateral IFGH have equal area. The two rectangles together have
 * exactly the area of ABCD — the carpets theorem in this special case.
 *
 * init(), Compute() and Draw() in CarpetsInSquare2Canvas are transcribed
 * here: the 4/5 rectangle, F = B*0.3 + C*0.7, Across(P) = 2O-P, the circle
 * intersection with line AB, K = Intersect(F,J,H,G), L = Intersect(F,E,H,I),
 * and the two sets of coloured polygons. The check script transcribes those
 * methods a second time from the bytecode and compares every point and area.
 *
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, CarpetsInSquare2Core; every function takes a plain position and
 * returns a new one.
 */
const CarpetsInSquare2Core = (() => {
  const WIDTH = 450;
  const HEIGHT = 400;
  const F_FRACTION = 0.3; // DoubLine(B,C).CreateMidPoint(0.3) in init()
  const EPS = 1e-9;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const close = (a, b, tol = 1e-7) =>
    Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const across = (p, o) => ({ x: 2 * o.x - p.x, y: 2 * o.y - p.y });

  /** Signed shoelace area; the regions are drawn clockwise, so we take abs. */
  function area(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
  }
  const size = (points) => Math.abs(area(points));

  const sum = (values) => values.reduce((a, b) => a + b, 0);

  /** GeoSDoub.Intersect(p1,p2,p3,p4): NaN if |d| < 1, as in the applet. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }

  /** The opening picture: the applet's 450x400 canvas, its 4/5 rectangle. */
  function start(options) {
    const o = options || {};
    const width = o.width == null ? WIDTH : o.width;
    const height = o.height == null ? HEIGHT : o.height;
    const wx = Math.floor(4 * width / 5);
    const wy = Math.floor(4 * height / 5);
    const left = (width - wx) / 2;
    const top = (height - wy) / 2;
    const f = o.f == null ? F_FRACTION : o.f;
    return {
      width, height, left, top,
      right: left + wx, bottom: top + wy,
      fy: top + wy * f, // DoubLine(B,C).CreateMidPoint(f): B*f + C*(1-f)
      showNames: o.showNames == null ? true : !!o.showNames,
      hint: o.hint == null ? true : !!o.hint, // the archived page passes ShowNames=1
      explored: false,
    };
  }

  /** Where A may be dragged: the applet's guard, and a circle that meets AB. */
  function maxLeft(state) {
    const oy = (state.top + state.bottom) / 2;
    const halfHeight = Math.abs(state.bottom - oy);
    const fdy = state.fy - oy;
    const need = Math.sqrt(Math.max(0, halfHeight * halfHeight - fdy * fdy));
    return (state.left + state.right) / 2 - Math.max(halfHeight, need + EPS);
  }

  /**
   * The whole figure for a position, in board units. `valid` is false when
   * the circle no longer reaches AB — the applet sets NoDraw in that case.
   */
  function compute(state) {
    const A = { x: state.left, y: state.bottom };
    const B = { x: state.right, y: state.bottom };
    const C = { x: state.right, y: state.top };
    const D = { x: state.left, y: state.top };
    const O = {
      x: (A.x + C.x) / 2,
      y: (A.y + C.y) / 2,
    };
    const F = { x: state.right, y: state.fy };
    const H = across(F, O);

    // GeoSDoub.Intersect(DoubCircle(O,|OF|), DoubLine(A,B)). AB is horizontal,
    // so IntersectY's m is 0, b is B.y and the roots are O.x +/- sqrt(disc).
    const r2 = (F.x - O.x) ** 2 + (F.y - O.y) ** 2;
    const dy = B.y - O.y;
    const disc = r2 - dy * dy;
    const valid = disc >= 0 && Number.isFinite(disc);
    const root = valid ? Math.sqrt(disc) : NaN;
    // Compute() names the smaller x E and the larger one I.
    const E = { x: O.x - root, y: B.y };
    const I = { x: O.x + root, y: B.y };
    const G = across(E, O);
    const J = across(I, O);
    const K = intersect(F, J, H, G);
    const L = intersect(F, E, H, I);

    const redNormal = [[H, D, J], [J, K, G], [G, C, F],
      [F, B, I], [I, L, E], [A, E, H]];
    const blueNormal = [H, K, F, L];
    const redHint = [[H, D, G], [H, A, I], [I, B, F], [C, F, G]];
    const blueHint = [H, G, F, I];
    const rectEFGH = [E, F, G, H];
    const rectIFJH = [I, F, J, H];
    const quadIFGH = [I, F, G, H];
    const quadEFJH = [E, F, J, H];

    const squareArea = (state.right - state.left) * (state.bottom - state.top);
    const redNormalAreas = redNormal.map(size);
    const redHintAreas = redHint.map(size);
    const blueNormalArea = size(blueNormal);
    const blueHintArea = size(blueHint);

    return {
      A, B, C, D, O, F, H, E, I, G, J, K, L, valid, disc,
      radius: Math.sqrt(r2),
      redNormal, blueNormal, redHint, blueHint,
      rectEFGH, rectIFJH, quadIFGH, quadEFJH,
      redNormalAreas, redHintAreas, blueNormalArea, blueHintArea,
      rectEFGHArea: size(rectEFGH), rectIFJHArea: size(rectIFJH),
      squareArea,
      rectangleSum: size(rectEFGH) + size(rectIFJH),
      redNormalTotal: sum(redNormalAreas),
      redHintTotal: sum(redHintAreas),
      circleDistances: [E, F, G, I, J].map((p) => dist(p, O)),
      longSides: [dist(C, G), dist(D, J), dist(B, I)],
    };
  }

  /** Every claim on the cut-the-knot page, checked on the current figure. */
  function claims(g) {
    return {
      valid: g.valid && Number.isFinite(g.K.x) && Number.isFinite(g.K.y) &&
        Number.isFinite(g.L.x) && Number.isFinite(g.L.y),
      redEqualsBlueNormal: close(g.redNormalTotal, g.blueNormalArea),
      redEqualsBlueHint: close(g.redHintTotal, g.blueHintArea),
      blueIsHalfNormal: close(g.blueHintArea, g.squareArea / 2),
      rectanglesAddUp: close(g.rectangleSum, g.squareArea),
      IFGHHalf: close(size(g.quadIFGH), g.squareArea / 2),
      EFJHHalf: close(size(g.quadEFJH), g.squareArea / 2),
      commonCircle: g.circleDistances.every((d) => close(d, g.radius)),
      equalSides: g.longSides.every((d) => close(d, g.longSides[0])),
      OIsMidpoint: close(g.O.x, (g.A.x + g.C.x) / 2) &&
        close(g.O.y, (g.A.y + g.C.y) / 2) &&
        close(g.O.x, (g.F.x + g.H.x) / 2) &&
        close(g.O.y, (g.F.y + g.H.y) / 2),
      positiveAreas: g.redNormalAreas.concat(g.redHintAreas,
        [g.blueNormalArea, g.blueHintArea]).every((v) => v > EPS),
    };
  }

  /**
   * One move. `point A` follows mouseDragged in the applet: A is fixed to the
   * bottom side; past the centre it snaps back to the mirror of B, in the
   * forbidden diagonal band it steps 3 units left, otherwise the whole
   * rectangle is mirrored about the fixed centre O. `point F` slides F along
   * BC; the applet blanks an out-of-range figure, here we clamp it to BC.
   */
  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "reset") return start({ width: state.width, height: state.height });
    if (m.type === "option") {
      const keys = ["showNames", "hint"];
      if (!keys.includes(m.key) || typeof m.value !== "boolean") return null;
      return Object.assign({}, state, { [m.key]: m.value, explored: true });
    }
    if (m.type === "point") {
      if (!m.point || !Number.isFinite(m.point.x) || !Number.isFinite(m.point.y)) return null;
      if (m.point.x < 0 || m.point.x > state.width ||
          m.point.y < 0 || m.point.y > state.height) return null;
      const ox = (state.left + state.right) / 2;
      const oy = (state.top + state.bottom) / 2;
      if (m.name === "A") {
        let x = m.point.x;
        if (x > ox) x = 2 * ox - state.right;
        else if (Math.abs(x - ox) < Math.abs(state.bottom - oy)) x -= 3;
        x = clamp(x, 0, 2 * ox);
        return Object.assign({}, state, {
          left: x, right: 2 * ox - x, explored: true,
        });
      }
      if (m.name === "F") {
        const y = clamp(m.point.y, state.top, state.bottom);
        return Object.assign({}, state, { fy: y, explored: true });
      }
    }
    return null;
  }

  /** There is nothing to win or lose: this is an illustration. */
  function result(state) {
    return null;
  }

  /** A status sentence with the two page claims, in plain words. */
  function describe(state) {
    const g = compute(state);
    if (!g.valid) return "The two rectangles do not meet the bottom side here. Move F or A back.";
    const n = (v) => Math.round(v).toLocaleString("en-US");
    return state.hint
      ? `Red ${n(g.redHintTotal)} = blue ${n(g.blueHintArea)}. Rectangle EFGH + IFJH = ${n(g.rectangleSum)}, the area of ABCD.`
      : `Red ${n(g.redNormalTotal)} = blue ${n(g.blueNormalArea)}. Rectangle EFGH + IFJH = ${n(g.rectangleSum)}, the area of ABCD.`;
  }

  return {
    WIDTH, HEIGHT, F_FRACTION, EPS,
    clamp, close, dist, across, area, size, sum, intersect,
    start, maxLeft, compute, claims, move, result, describe,
  };
})();
