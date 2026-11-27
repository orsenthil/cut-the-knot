"use strict";

/*
 * Five Incircles in a Square, from Alexander Bogomolny's applet
 * FiveCirclesInSquare (verified in a 2012 Wayback snapshot of the page).
 *
 * Four congruent right triangles sit inside a square, one on each side, and
 * the four points E, F, G, H they leave behind form a smaller square. Each
 * triangle has an incircle and the inner square has its own incircle. The
 * key idea of the code is that E slides on the circle with the left side of
 * the square as its diameter; the other three points are the rotations of E
 * about the centre by 90, 180 and 270 degrees. That makes the whole picture a
 * single number: the angle of E on its circle.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, FiveCirclesInSquareCore, so the page loads
 * it with a plain <script> and porting/check-five-circles-in-square.mjs loads
 * it in Node. The position is plain data, so it can be saved for the tutor.
 */
const FiveCirclesInSquareCore = (() => {
  /** The applet's embedded size (400 by 400); min(side)/3.5 is its R. */
  const WIDTH = 400;
  const HEIGHT = 400;
  /** Java: circle centre + R*(cos(0.6283185307179586), sin(...)), i.e. 36 degrees. */
  const INITIAL_ANGLE = Math.PI / 5;
  /** The page's answer: c = 2b puts the leg b opposite a 30 degree angle. */
  const EQUAL_ANGLE = Math.PI / 6;
  /** Java: Math.abs(centralRadius - circleA.radius) < 0.5 sets Finished. */
  const MATCH = 0.5;
  const EPS = 1e-12;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Java's atan2-style wrap keeps the angle on one turn. */
  function wrap(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  /** Foot of the perpendicular from p to the line through a and b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /**
   * The position a new diagram starts from. Width and height mirror the
   * applet's WIDTH and HEIGHT parameters; options may also set the angle.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const R = Math.min(width, height) / 3.5;
    const cx = width / 2, cy = height / 2;
    return {
      width: width, height: height, cx: cx, cy: cy, R: R,
      corners: {
        A: { x: cx - R, y: cy + R }, B: { x: cx + R, y: cy + R },
        C: { x: cx + R, y: cy - R }, D: { x: cx - R, y: cy - R },
      },
      angle: wrap(o.angle === undefined ? INITIAL_ANGLE : o.angle),
      showNames: !!o.showNames,
      showStatement: !!o.showStatement,
      showHint: !!o.showHint,
    };
  }

  /** The position after moving E; the other points follow in render. */
  function setAngle(state, angle) {
    return { ...state, angle: wrap(angle) };
  }

  /**
   * The applet refuses to drag outside its canvas (x > 2, y > 0, x < width,
   * y < height - 2). This is the same visible arc of E's circle, with a small
   * margin, as a limit on the angle: a keyboard nudge cannot lose the handle
   * off the edge.
   */
  function clampAngle(state, angle) {
    const ratio = (3 - (state.cx - state.R)) / state.R;
    const limit = ratio <= -1 ? Math.PI : ratio >= 1 ? 0 : Math.acos(ratio);
    return clamp(wrap(angle), -limit, limit);
  }

  /** E travels on the circle with diameter AD (Thales' right angle). */
  function pointE(state) {
    const ox = state.cx - state.R;
    return {
      x: ox + state.R * Math.cos(state.angle),
      y: state.cy + state.R * Math.sin(state.angle),
    };
  }

  /** A literal transcription of the applet's Swivel(P, theta, sign). */
  function swivel(state, p, theta, sign) {
    const cos = Math.cos(theta), sin = Math.sin(theta);
    const dx = sign * (pointE(state).x - state.corners.A.x);
    const dy = sign * (pointE(state).y - state.corners.A.y);
    return {
      x: p.x + cos * dx - sin * dy,
      y: p.y + sin * dx + cos * dy,
    };
  }

  /** Incenter by side-length weights; all three distances to the sides agree. */
  function incenter(a, b, c) {
    const la = distance(b, c), lb = distance(c, a), lc = distance(a, b);
    const sum = la + lb + lc;
    if (sum < EPS) return { x: a.x, y: a.y };
    return {
      x: (la * a.x + lb * b.x + lc * c.x) / sum,
      y: (la * a.y + lb * b.y + lc * c.y) / sum,
    };
  }

  /** The applet's GetIncircle: incenter, then the mean distance to the sides. */
  function incircle(a, b, c) {
    const center = incenter(a, b, c);
    const radius = (
      distance(center, foot(center, a, b)) +
      distance(center, foot(center, b, c)) +
      distance(center, foot(center, c, a))
    ) / 3;
    return { center: center, radius: radius };
  }

  /** Everything the drawing needs, in board units, for one angle of E. */
  function geometry(state) {
    const corners = state.corners;
    const E = pointE(state);
    // Swivel(B, pi/2, -1), Swivel(C, pi, 1), Swivel(D, 3pi/2, -1).
    const F = swivel(state, corners.B, Math.PI / 2, -1);
    const G = swivel(state, corners.C, Math.PI, 1);
    const H = swivel(state, corners.D, 3 * Math.PI / 2, -1);
    const triangles = [
      [corners.A, corners.B, F], [corners.B, corners.C, G],
      [corners.C, corners.D, H], [corners.D, corners.A, E],
    ];
    const incircles = triangles.map((t) => incircle(t[0], t[1], t[2]));
    // E and G are opposite corners of the inner square, as are F and H, so
    // their diagonals meet at the square's centre even at the degenerate
    // angle where E = G. The applet finds the same point by Intersect(EG,FH).
    const central = { center: { x: state.cx, y: state.cy }, radius: distance(E, F) / 2 };
    const a = distance(corners.A, F), b = distance(corners.B, F);
    const c = distance(corners.A, corners.B);
    return {
      corners: corners, points: { E: E, F: F, G: G, H: H },
      triangles: triangles, incircles: incircles, central: central,
      sides: { a: a, b: b, c: c },
    };
  }

  /** Radius of each triangle circle, then the inner square's circle. */
  function radii(state) {
    const g = geometry(state);
    return g.incircles.map((circle) => circle.radius).concat([g.central.radius]);
  }

  /** The applet's Finished: central radius and circle A within half a pixel. */
  function finished(state) {
    const g = geometry(state);
    const diff = Math.abs(g.central.radius - g.incircles[0].radius);
    return Number.isFinite(diff) && diff < MATCH;
  }

  /** The page's solution, mirrored below the centre when E started there. */
  function equalAngle(state) {
    return state.angle < 0 ? -EQUAL_ANGLE : EQUAL_ANGLE;
  }

  /** Move E to the equal configuration without touching the checkboxes. */
  function makeEqual(state) {
    return setAngle(state, equalAngle(state));
  }

  /** The applet's three option checkboxes; state is kept when disabled. */
  function option(state, name, value) {
    if (name !== "showNames" && name !== "showStatement" && name !== "showHint") return state;
    return { ...state, [name]: !!value };
  }

  /** The saved position for the player's record and the maths tutor. */
  function position(state) {
    const g = geometry(state);
    return {
      width: state.width, height: state.height, angle: state.angle,
      R: state.R, points: g.points, sides: g.sides,
      radii: g.incircles.map((circle) => circle.radius),
      innerRadius: g.central.radius, finished: finished(state),
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, INITIAL_ANGLE: INITIAL_ANGLE,
    EQUAL_ANGLE: EQUAL_ANGLE, MATCH: MATCH,
    start: start, setAngle: setAngle, clampAngle: clampAngle,
    pointE: pointE, swivel: swivel, incenter: incenter, incircle: incircle,
    geometry: geometry, radii: radii, finished: finished,
    equalAngle: equalAngle, makeEqual: makeEqual, option: option,
    position: position, distance: distance, foot: foot, wrap: wrap,
  };
})();
