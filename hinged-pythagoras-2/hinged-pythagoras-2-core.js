"use strict";

/*
 * Hinged Pythagoras 2: Alexander Bogomolny's second hinged dissection of the
 * Pythagorean theorem (applet HingedPythagoras2, "Proof #36").
 *
 * The left square has side c. Each of its four sides turns about one corner by
 * the "ForSine" angle B; the four turned sides cut out four congruent right
 * triangles with legs a = c*cos(B), b = c*sin(B) and a small square of side
 * |a-b|. The right copy keeps two of those triangles and swings the other two
 * about the two marked corners by the "Rotation" angle. The pieces never
 * stretch, so their total area never changes: in the first position they fill
 * the square c², and in the last position they show the two squares a² and b².
 * That is the page's claim (Proof #10: the Proof #3 triangles can be
 * rearranged so the Pythagorean identity is obvious): c² = a² + b².
 *
 * The coordinates, the two scrollbar ranges, the rotation directions and the
 * thresholds below follow the applet's own bytecode. This file is the game's
 * logic and nothing else: no document, no window, no storage. It defines one
 * global, HingedPythagoras2Core, so the page loads it with a plain <script>
 * and porting/check-hinged-pythagoras-2.mjs loads it in Node. Positions are
 * plain data and functions return new data.
 */
const HingedPythagoras2Core = (() => {
  // init(): Side = min(width/2, height) - 2*inset, with integer division.
  // The applet is 640x460; its south panel is 32px, leaving a 640x428 canvas.
  const APPLET = {
    width: 640,
    height: 428,
    inset: 80,
    thresholdAngle: 4.70238898038469, // DrawRPyth: Angle > this (~269.4°)
    prMin: 0.5,                       // and Dist(P, R) > this
    near2: 0.1,                       // GeoSDoub.NearestPoint early return
    parallelLength: 100,              // GeoSDoub.GetParallelTo
  };

  // The two java.awt.Scrollbars: Rotation(0,0,5,0,275), ForSine(30,30,5,0,95).
  // The canvas field Betta starts at PI/6; Angle starts at 0.
  const LIMITS = { angleMin: 0, angleMax: 275, betaMin: 30, betaMax: 95 };
  const START = { angle: 0, beta: 30 };

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const shift = (p, dx, dy) => pt(p.x + dx, p.y + dy);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rad = (degrees) => (degrees * Math.PI) / 180;

  /** The applet's canvas layout, in canvas units (y grows downwards). */
  function layout(width = APPLET.width, height = APPLET.height) {
    const side = Math.min(Math.trunc(width / 2), height) - 2 * APPLET.inset;
    const leftX = Math.trunc((Math.trunc(width / 2) - side) / 2);
    const y = Math.trunc((height - side) / 2);
    return { width, height, side, leftX, rightX: Math.trunc(width / 2), y };
  }
  const DEFAULT_LAYOUT = layout();

  /** GeoSDoub.Rotate(p, q, angle, sign), transcribed literally. */
  function rotate(p, q, angle, sign) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = q.x - p.x, dy = q.y - p.y;
    return pt(p.x + c * dx - sign * s * dy, p.y + sign * s * dx + c * dy);
  }

  /** GeoSDoub.Intersect of two infinite lines (Cramer's rule, NaN if parallel). */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return pt(NaN, NaN);
    return pt((b1 * c2 - b2 * c1) / den, (c1 * a2 - c2 * a1) / den);
  }

  /** GeoSDoub.GetParallelTo(p, q, r): p plus 100 times the vector r->q. */
  function parallelTo(p, q, r) {
    return pt(p.x + APPLET.parallelLength * (q.x - r.x),
      p.y + APPLET.parallelLength * (q.y - r.y));
  }

  /** GeoSDoub.NearestPoint(p, a, b): the foot on line(a,b). */
  function nearestPoint(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    if (sqDist(a, p) < APPLET.near2) return p;
    const t = (vx * (p.x - a.x) + vy * (p.y - a.y)) / (vx * vx + vy * vy);
    return pt(a.x + vx * t, a.y + vy * t);
  }

  /** InsideTest.IsInside(p, a, b): the angle at p is at least a right angle. */
  function insideTest(p, a, b) {
    return (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0;
  }

  /** DrawLine(g, a, m, b): the part of the turned side that lies in the square. */
  function visibleCut(a, m, b) {
    if (insideTest(m, a, b)) return [m, b];
    if (insideTest(b, a, m)) return [a, m];
    return [a, b];
  }

  /** The two squares from init(): L is bottom-left, bottom-right, top-right, top-left. */
  function corners(lay = DEFAULT_LAYOUT) {
    const { side, leftX, rightX, y } = lay;
    return {
      L: [pt(leftX, y + side), pt(leftX + side, y + side),
        pt(leftX + side, y), pt(leftX, y)],
      R: [pt(rightX, y + side), pt(rightX + side, y + side),
        pt(rightX + side, y), pt(rightX, y)],
    };
  }

  /** Compute() on the left square: four turned sides and their intersections. */
  function leftDissection(betaDeg, lay = DEFAULT_LAYOUT) {
    const beta = rad(betaDeg);
    const L = corners(lay).L;
    const ends = L.map((p, i) => rotate(p, L[(i + 1) % 4], beta, -1));
    const pointsArray = L.map((p, i) =>
      intersect(p, ends[i], L[(i + 1) % 4], ends[(i + 1) % 4]));
    const P = pointsArray[0], Q = pointsArray[1], R = pointsArray[2], S = pointsArray[3];
    return {
      corners: L,
      ends,
      points: { P, Q, R, S },
      inner: [P, Q, R, S],
      triangles: L.map((p, i) => [p, L[(i + 1) % 4], pointsArray[i]]),
      cuts: [
        visibleCut(L[0], P, S),
        visibleCut(L[1], Q, P),
        visibleCut(L[2], R, Q),
        visibleCut(L[3], S, R),
      ],
    };
  }

  /** A polygon's area (shoelace, always positive). */
  function area(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return Math.abs(sum) / 2;
  }

  /**
   * The right square in DrawRPyth: the left dissection slid across by dx,
   * with two triangles fixed and two swung about the orange hinge corners.
   * `showInset` and `dashed` reproduce the applet's late-angle details.
   */
  function rightDissection(state, lay = DEFAULT_LAYOUT) {
    const left = leftDissection(state.beta, lay);
    const square = corners(lay).R;
    const dx = square[0].x - left.corners[0].x;
    const shiftX = (p) => shift(p, dx, 0);
    const { P, Q, R, S } = left.points;
    const Pp = shiftX(P), Qp = shiftX(Q), Rp = shiftX(R), Sp = shiftX(S);
    const angle = rad(state.angle);

    // Graphics2D.translate(R2/R0); rotate(Angle / -Angle); draw the polygon
    // whose vertices are given relative to that hinge.
    const swing = (hinge, relative, turns) =>
      relative.map((v) => add(hinge, rotate(pt(0, 0), v, turns * angle, 1)));
    const top = swing(square[2], [pt(0, 0), sub(square[3], square[2]),
      sub(Rp, square[2])], 1);
    const bottom = swing(square[0], [pt(0, 0), sub(square[3], square[0]),
      sub(Sp, square[0])], -1);

    const showInset = angle > APPLET.thresholdAngle && dist(Pp, Rp) > APPLET.prMin;
    // Compute() builds L5 and T in the *left* square's coordinates, then
    // DrawRPyth() slides T across by dx. Do not shift B before projecting.
    const lineThrough = parallelTo(left.corners[1], R, Q);
    const T = nearestPoint(S, lineThrough, left.corners[1]);
    const nearer = dist(T, S) < dist(T, R) ? S : R;

    return {
      corners: square,
      dx,
      inner: [Pp, Qp, Rp, Sp],
      points: { P: Pp, Q: Qp, R: Rp, S: Sp, T: shiftX(T) },
      triangles: [
        [square[0], square[1], Pp],
        [square[1], square[2], Qp],
        top,
        bottom,
      ],
      hinges: [square[0], square[2]],
      showInset,
      dashed: [shiftX(T), shiftX(nearer)],
    };
  }

  /** Combine the two halves for the page's renderer and the tutor. */
  function geometry(state, lay = DEFAULT_LAYOUT) {
    return { left: leftDissection(state.beta, lay), right: rightDissection(state, lay) };
  }

  /** The right triangle hidden in the dissection, plus the page's identity. */
  function identity(betaDeg, lay = DEFAULT_LAYOUT) {
    const c = lay.side;
    const beta = rad(betaDeg);
    const a = c * Math.cos(beta), b = c * Math.sin(beta);
    const a2 = a * a, b2 = b * b, c2 = c * c;
    const hole = Math.abs(a - b);
    const tri = (a * b) / 2;
    const pieces = leftDissection(betaDeg, lay);
    const filled = area(pieces.inner) +
      pieces.triangles.reduce((sum, t) => sum + area(t), 0);
    return {
      a, b, c, a2, b2, c2, hole, tri, filled,
      holds: Math.abs(a2 + b2 - c2) < 1e-9 * c2,
      tilingError: Math.abs(filled - c2),
      // Signed tri keeps (a-b)² + 4*(ab/2) = a² + b² even where the moving
      // pieces stop fitting inside the square (Betta > 90°).
      algebraicError: Math.abs(c2 - (hole * hole + 4 * tri)),
    };
  }

  /** Slider positions: whole degrees, clamped to the applet's scrollbars. */
  function withAngle(state, value) {
    const n = Math.round(Number(value));
    const angle = Number.isFinite(n) ? clamp(n, LIMITS.angleMin, LIMITS.angleMax) : state.angle;
    return { angle, beta: state.beta };
  }
  function withBeta(state, value) {
    const n = Math.round(Number(value));
    const beta = Number.isFinite(n) ? clamp(n, LIMITS.betaMin, LIMITS.betaMax) : state.beta;
    return { angle: state.angle, beta };
  }

  function start() { return { ...START }; }

  return {
    APPLET, LIMITS, START, DEFAULT_LAYOUT,
    pt, add, sub, shift, dist, sqDist, clamp, rad,
    layout, rotate, intersect, parallelTo, nearestPoint, insideTest, visibleCut,
    corners, leftDissection, rightDissection, geometry, area, identity,
    start, withAngle, withBeta,
  };
})();
