"use strict";

/*
 * Four NPCircles — the geometry behind Bogomolny's applet on
 * "Four 9-Point Circles in a Quadrilateral" (Curriculum/Geometry/FourNPCircles).
 *
 * Four draggable vertices A, B, C, D make four triangles: BCD, CDA, DAB and
 * ABC. For each triangle we build its nine-point circle (centre halfway
 * between the circumcentre O and the orthocentre H, radius R/2), and the
 * pedal circle of the remaining vertex (the circle through the three feet of
 * perpendiculars from that vertex to the triangle's sides). The page claims
 * that all eight circles go through one point, even when the quadrilateral is
 * not cyclic. This module computes exactly the same eight circles as the
 * applet's FourNPCirclesCanvas: GeoSDoub.FindAltitude / Intersect /
 * FindCircumcenter, FindNinepointscenter, DrawNCircle and ShowPedal, including
 * the average-of-three-distances radii the applet uses instead of R/2.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, FourNpCirclesCore, so the page loads it with
 * a plain <script> and porting/check-four-np-circles.mjs loads it in Node.
 * Positions are plain data; every function returns a new position or value.
 */
const FourNpCirclesCore = (() => {
  const VIEW = { width: 400, height: 300 }; // the SVG viewBox, like the applet's 400×300 canvas
  const ANGLES = [
    0.5235987755982988,   // 30°: A
    2.6179938779914944,  // 150°: B
    3.765191430678208,   // ~215.7°: C
    5.235987755982989,   // 300°: D
  ];
  // The applet's Index table: vertex i is left out of triangle Index[i].
  const INDEX = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]];
  const OPTIONS = [
    "showNineCenters", "showNineCircles", "showMidpoints",
    "showCenterQuad", "showPedalCircles", "showPedalPoints",
  ];
  const NAMES = ["A", "B", "C", "D"];
  const TOL = 1e-6; // relative tolerance for the concurrence residual

  const copy = (p) => ({ x: p.x, y: p.y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const finiteCircle = (c) => finite(c) && Number.isFinite(c.r);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /**
   * GeoSDoub.Intersect(P1,P2,P3,P4): the two lines in ax+by+c=0 form; the
   * applet returns (NaN,NaN) when |det| < 1 (parallel or nearly so).
   */
  function intersect(P1, P2, P3, P4) {
    const a1 = P1.y - P2.y, b1 = P2.x - P1.x;
    const c1 = P1.x * P2.y - P1.y * P2.x;
    const a2 = P3.y - P4.y, b2 = P4.x - P3.x;
    const c2 = P3.x * P4.y - P3.y * P4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindAltitude(P,A,B): foot of the perpendicular from P to AB. */
  function altitude(P, A, B) {
    const direction = { x: P.x + B.y - A.y, y: P.y - B.x + A.x };
    return intersect(P, direction, A, B);
  }

  /** FindOrthocenter: the intersection of two altitudes. */
  function orthocenter(A, B, C) {
    return intersect(A, altitude(A, B, C), B, altitude(B, A, C));
  }

  /** GeoSDoub.FindCircumcenter: perpendicular bisectors of AB and BC. */
  function circumcenter(A, B, C) {
    const mAB = midpoint(A, B), mBC = midpoint(B, C);
    const perpAB = { x: mAB.x + B.y - A.y, y: mAB.y - B.x + A.x };
    const perpBC = { x: mBC.x + C.y - B.y, y: mBC.y - C.x + B.x };
    return intersect(mAB, perpAB, mBC, perpBC);
  }

  /** FindNinepointscenter: the midpoint of the orthocentre and circumcentre. */
  function nineCenter(A, B, C) {
    return midpoint(orthocenter(A, B, C), circumcenter(A, B, C));
  }

  /**
   * DrawNCircle: the nine-point circle of ABC. The applet takes the mean of
   * the centre's distances to the three side midpoints rather than R/2.
   */
  function nineCircle(A, B, C) {
    const center = nineCenter(A, B, C);
    const mids = [midpoint(B, C), midpoint(C, A), midpoint(A, B)];
    const r = mids.reduce((sum, m) => sum + dist(center, m), 0) / 3;
    return { x: center.x, y: center.y, r };
  }

  /**
   * ShowPedal + DrawCircle: the circle through the three feet of the
   * perpendiculars from P onto BC, CA and AB. When P lies on the circumcircle
   * of ABC the feet are collinear, FindCircumcenter returns NaN, and there is
   * no circle (that is the applet's Simson-line case).
   */
  function pedalCircle(A, B, C, P) {
    const feet = [altitude(P, B, C), altitude(P, C, A), altitude(P, A, B)];
    const center = circumcenter(feet[0], feet[1], feet[2]);
    const r = feet.reduce((sum, f) => sum + dist(center, f), 0) / 3;
    return { x: center.x, y: center.y, r, feet };
  }

  /**
   * Find the point common to the circles. Intersect two nine-point circles,
   * then keep the intersection with the smallest largest distance-to-circumference
   * across every finite circle. The claim is that this error is zero.
   */
  function concurrency(nine, pedal) {
    const circles = [...nine, ...pedal];
    const valid = circles.filter(finiteCircle);
    const pairs = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) pairs.push([nine[i], nine[j]]);
    }
    if (valid.length < 3) pairs.length = 0;
    for (let i = 0; i < circles.length; i++) {
      for (let j = i + 1; j < circles.length; j++) pairs.push([circles[i], circles[j]]);
    }
    const scale = Math.max(1, ...valid.map((c) => c.r));
    let best = null;
    for (const [c1, c2] of pairs) {
      if (!finiteCircle(c1) || !finiteCircle(c2)) continue;
      const d = dist(c1, c2);
      if (d < 1e-9 || d > c1.r + c2.r || d < Math.abs(c1.r - c2.r)) continue;
      const along = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, c1.r * c1.r - along * along));
      const ux = (c2.x - c1.x) / d, uy = (c2.y - c1.y) / d;
      const bx = c1.x + along * ux, by = c1.y + along * uy;
      const candidates = h < 1e-9
        ? [{ x: bx, y: by }]
        : [{ x: bx - h * uy, y: by + h * ux }, { x: bx + h * uy, y: by - h * ux }];
      for (const p of candidates) {
        const error = Math.max(...valid.map((c) => Math.abs(dist(p, c) - c.r)));
        if (!best || error < best.error) best = { x: p.x, y: p.y, error, errorRelative: error / scale };
      }
    }
    if (!best) return { x: NaN, y: NaN, error: Infinity, errorRelative: Infinity, reliable: false };
    return { ...best, reliable: best.errorRelative < TOL };
  }

  /** Everything the page draws, in the applet's own order. */
  function compute(state) {
    const pts = [state.A, state.B, state.C, state.D];
    const triangles = INDEX.map((indices) => indices.map((i) => pts[i]));
    const nine = triangles.map((t) => nineCircle(t[0], t[1], t[2]));
    const pedal = triangles.map((t, i) => pedalCircle(t[0], t[1], t[2], pts[i]));
    const mids = [
      midpoint(state.A, state.B), midpoint(state.B, state.C),
      midpoint(state.C, state.D), midpoint(state.D, state.A),
      midpoint(state.A, state.C), midpoint(state.B, state.D),
    ];
    return { triangles, nine, pedal, mids, common: concurrency(nine, pedal) };
  }

  /**
   * Reset: the applet's four angles on a circle at (width/2, height/2) with
   * radius floor(min(width,height)/3). Its third vertex has a quirk — the
   * bytecode adds 10 to centre.y before taking sin — kept here on purpose.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? VIEW.width : o.width;
    const height = o.height === undefined ? VIEW.height : o.height;
    const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
    const radius = Math.floor(Math.min(width, height) / 3);
    const points = ANGLES.map((angle, i) => ({
      x: cx + radius * Math.cos(angle),
      y: i === 2 ? cy + (cy + 10) * Math.sin(angle) : cy + radius * Math.sin(angle),
    }));
    const flag = (name) => Boolean(o[name]);
    return {
      A: points[0], B: points[1], C: points[2], D: points[3],
      width, height,
      showNineCenters: flag("showNineCenters"),
      showNineCircles: flag("showNineCircles"),
      showMidpoints: flag("showMidpoints"),
      showCenterQuad: flag("showCenterQuad"),
      showPedalCircles: flag("showPedalCircles"),
      showPedalPoints: flag("showPedalPoints"),
      which: -1, // -1 until the canvas is clicked; then 0,1,2,3,no highlight
    };
  }

  /** A new position with one named point dragged (the applet clamps to canvas). */
  function withPoint(state, name, p) {
    if (!NAMES.includes(name) || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    return {
      ...state,
      [name]: {
        x: clamp(p.x, 0, state.width),
        y: clamp(p.y, 0, state.height),
      },
    };
  }

  /** A new position with one of the applet's six checkboxes changed. */
  function withOption(state, name, value) {
    if (!OPTIONS.includes(name)) return state;
    return { ...state, [name]: Boolean(value) };
  }

  /** One canvas click: WhichClicked = (WhichClicked + 1) % 5. */
  function cycleHighlight(state) {
    return { ...state, which: (state.which + 1) % 5 };
  }

  /** An illustration: there is no win and no loss. */
  function result(/* state */) {
    return null;
  }

  return {
    VIEW, ANGLES, INDEX, OPTIONS, NAMES, TOL,
    start, compute, result,
    intersect, altitude, orthocenter, circumcenter,
    midpoint, dist, nineCenter, nineCircle, pedalCircle, concurrency,
    withPoint, withOption, cycleHighlight,
    copy, finite, finiteCircle, clamp,
  };
})();
