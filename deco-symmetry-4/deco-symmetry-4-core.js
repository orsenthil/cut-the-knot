"use strict";

/*
 * Deco Symmetry 4, from Alexander Bogomolny's applet DecoSymmetry4.
 *
 * Slide B and C along a horizontal base and move A freely. The applet reflects
 * the triangle in the horizontal line halfway between A and the base, so the
 * reflected A' lies on the base whenever A stands above the segment BC. Two
 * cuts from A' to the midpoints D of AB and E of AC split the triangle into
 * three pieces. A half turn about D carries the piece A'BD onto B'AD, and a
 * half turn about E carries A'EC onto C'EA; the middle piece A'DAE fits both
 * triangles. No piece is flipped, so this is a direct equidecomposition.
 *
 * The code follows DecoSymmetry4Canvas.Compute, SetRotatingPoly and
 * GeoSDoub.Intersect / ComputeSignedAngle from the applet's bytecode: B and C
 * keep a fixed y (CTKMoveableDoub.Fix(2)), the reflection is Ap=(A.x,B.y),
 * Bp=(B.x,A.y), Cp=(C.x,A.y), and the "Move them" button is disabled exactly
 * when A.x is not strictly between B.x and C.x.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, DecoSymmetry4Core, so the page loads it with
 * a plain <script> and porting/check-deco-symmetry-4.mjs loads it in Node.
 * The position is plain data and every function returns a new position.
 */
const DecoSymmetry4Core = (() => {
  // The applet says 400 by 250 is the optimal canvas size. The SVG board uses
  // those units so its viewBox is the applet's coordinate system.
  const WIDTH = 400;
  const HEIGHT = 250;
  const EDGE = 10; // keep a draggable dot inside the board

  const copy = (p) => ({ x: p.x, y: p.y });
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /** The position a new illustration starts from (the applet's init fractions). */
  function start() {
    return {
      A: { x: WIDTH / 3, y: HEIGHT / 6 },
      B: { x: WIDTH / 4, y: (HEIGHT * 5) / 6 },
      C: { x: (3 * WIDTH) / 4, y: (HEIGHT * 5) / 6 },
      showNames: false, // the applet's two Checkbox fields start unchecked
      showHint: false,
    };
  }

  /** Keep a dragged handle in the board; B and C may only slide horizontally. */
  function clampPoint(state, name, p) {
    const x = clamp(p.x, EDGE, WIDTH - EDGE);
    if (name === "A") return { x, y: clamp(p.y, EDGE, HEIGHT - EDGE) };
    const fixedY = name === "B" ? state.B.y : state.C.y;
    return { x, y: fixedY };
  }

  /** Position after a drag or a checkbox press; the given state is untouched. */
  function move(state, name, p) {
    if (name === "A" || name === "B" || name === "C") {
      return Object.assign({}, state, { [name]: clampPoint(state, name, p) });
    }
    return state;
  }

  function option(state, key, on) {
    if (key !== "showNames" && key !== "showHint") return state;
    return Object.assign({}, state, { [key]: !!on });
  }

  /** GeoSDoub.Intersect(a,b,c,d), transcribed line for line. NaN if parallel. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y;
    const b1 = b.x - a.x;
    const c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y;
    const b2 = d.x - c.x;
    const c2 = c.x * d.y - c.y * d.x;
    const nx = b1 * c2 - b2 * c1;
    const ny = c1 * a2 - c2 * a1;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN }; // the applet's threshold
    return { x: nx / den, y: ny / den };
  }

  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const centroid = (pts) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  });

  /** GeoSDoub.FindOrientation: +1 on one side, -1 on the other or collinear. */
  function orientation(a, b, c) {
    const cross = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return cross > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle(a,b,c), as used by SetRotatingPoly. */
  function signedAngle(a, b, c) {
    const s = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / 2;
    const cosine = s / (dist(a, b) * dist(a, c));
    const angle = Math.acos(cosine);
    // The bytecode has an unreachable guard here (a sum of squares cannot be
    // negative); it is kept so the second transcription can compare literally.
    const squared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (angle > 0.99 && !(squared >= 0)) return Math.PI;
    return orientation(a, b, c) === 1 ? angle : -angle;
  }

  /** Rotate a point through `angle` radians about `centre`. */
  function turn(p, centre, angle) {
    const dx = p.x - centre.x;
    const dy = p.y - centre.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: centre.x + dx * cos - dy * sin,
      y: centre.y + dx * sin + dy * cos,
    };
  }

  /**
   * The whole construction from a position. `valid` is the inverse of the
   * applet's NoDraw flag: A must stand strictly over the segment BC, otherwise
   * A' is not on the base and the Move them button is switched off.
   */
  function compute(state) {
    const A = copy(state.A);
    const B = copy(state.B);
    const C = copy(state.C);
    const Ap = { x: A.x, y: B.y };
    const Bp = { x: B.x, y: A.y };
    const Cp = { x: C.x, y: A.y };
    const valid = Math.min(B.x, C.x) < A.x && A.x < Math.max(B.x, C.x);
    const D = intersect(A, B, Ap, Bp);
    const E = intersect(A, C, Ap, Cp);

    const pieces = [
      { name: "first", points: [Ap, B, D], final: [Bp, A, D], pivot: D },
      { name: "middle", points: [Ap, D, A, E], final: null, pivot: null },
      { name: "last", points: [Ap, E, C], final: [Cp, E, A], pivot: E },
    ];

    // SetRotatingPoly's goal: translate the piece to the barycentre of its
    // final position and rotate it by the signed angle at its first vertex
    // towards first + (final[1] - final[0]); a NaN angle becomes a half turn.
    const moving = [0, 2].map((i) => {
      const from = pieces[i].points;
      const to = pieces[i].final;
      const target = {
        x: from[0].x + to[1].x - to[0].x,
        y: from[0].y + to[1].y - to[0].y,
      };
      let angle = signedAngle(from[0], from[1], target);
      if (Number.isNaN(angle)) angle = Math.PI;
      return { index: i, centre: centroid(to), angle };
    });

    return { A, B, C, Ap, Bp, Cp, D, E, valid, pieces, moving };
  }

  /** Vertices of a moving piece part-way through its half turn (0 to 1). */
  function movingPoints(figure, index, t) {
    const piece = figure.pieces[index];
    if (!piece || !piece.pivot) return piece ? piece.points : [];
    return piece.points.map((p) => turn(p, piece.pivot, Math.PI * t));
  }

  /** A short line for #status, updated after every drag and after the move. */
  function describe(figure, moved) {
    if (!figure.valid) {
      return "A' is not on the base. Move A between B and C to switch on the two cuts.";
    }
    if (moved) {
      return "The two end pieces have turned half a turn: the same three pieces make the mirror triangle, with no flipping.";
    }
    return "A' sits on the base. Two cuts from A' to D and E make three pieces; press Move them to turn the end pieces.";
  }

  return {
    WIDTH, HEIGHT, start, move, option, clampPoint, intersect, orientation,
    signedAngle, turn, compute, movingPoints, describe,
  };
})();
