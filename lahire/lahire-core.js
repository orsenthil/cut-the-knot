"use strict";

/*
 * La Hire's Theorem, from Alexander Bogomolny's Java applet LaHire.
 *
 * A circle has centre O and a point R on its rim. Two more points, A and B,
 * can be dragged anywhere. Each point has a polar: the line through its
 * inverse point in the circle, at right angles to the ray from O. The
 * droodle shows the polars of A and B in red; when A lands on B's polar the
 * applet wakes up three pairs of eyes, joins each point to O in blue and
 * marks the two inverse points C and D. The theorem is that B then lies on
 * the polar of A as well.
 *
 * Everything here is geometry and plain data: no document, no window, no
 * storage. One global, LahireCore, is defined so the page loads it with a
 * plain script and porting/check-lahire.mjs loads it in Node. The formulae
 * and constants come from LaHireCanvas (init, Draw, GetPolar, CheckTouch,
 * ConnectToCenter, Between), Inversion.Invert, GeoSDoub.Dist/Intersect, and
 * MoveableCircle, all in classes.zip.
 */

const LahireCore = (() => {
  /* The live page embeds <APPLET CODE="LaHire" WIDTH=600 HEIGHT=450 ...>. */
  const VIEW = Object.freeze({ width: 600, height: 450 });
  const MIN_DIST = 0.5;     // GetPolar: no polar for a point within 0.5 of O
  const TOUCH = 1.5;        // CheckTouch: strict Dist(A, polarB) < 1.5
  const DEGENERATE = 0.1;   // GeoSDoub.Dist: zero distance for a tiny line

  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const dist = (a, b) => Math.sqrt(sqDist(a, b));
  const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /*
   * LaHireCanvas.init(), with w and h from the canvas size:
   *   O = (w/5, 2h/3), r = (h/2)/4 = h/8, R = (O.x - r, O.y),
   *   A = (O.x + 4r, O.y), B = (O.x, O.y - 2r).
   * So the circle's radius is h/8, A is 4 radii away and B is 2 radii away.
   */
  function start(options) {
    const w = options && Number.isFinite(options.width) ? options.width : VIEW.width;
    const h = options && Number.isFinite(options.height) ? options.height : VIEW.height;
    const O = { x: w / 5, y: (2 * h) / 3 };
    const r = h / 8;
    return {
      O,
      R: { x: O.x - r, y: O.y },
      A: { x: O.x + 4 * r, y: O.y },
      B: { x: O.x, y: O.y - 2 * r },
      showNames: options && options.showNames === false ? false : true,
    };
  }

  /** Move one of the four draggable points; nothing else in the picture changes. */
  function moveVertex(state, name, p) {
    if (!["O", "R", "A", "B"].includes(name) || !finitePoint(p)) return state;
    return { ...state, [name]: copy(p) };
  }

  /* MoveableCircle.UpdateLocation: grabbing the circle translates O and R together. */
  function moveCircle(state, center) {
    if (!finitePoint(center)) return state;
    const dx = center.x - state.O.x;
    const dy = center.y - state.O.y;
    return {
      ...state,
      O: copy(center),
      R: { x: state.R.x + dx, y: state.R.y + dy },
    };
  }

  function setShowNames(state, on) {
    return { ...state, showNames: Boolean(on) };
  }

  function circleOf(state) {
    return { center: copy(state.O), radius: dist(state.O, state.R) };
  }

  /* Inversion.Invert(DoubCircle, DoubPoint): R^2/|OP|^2 along the ray O->P. */
  function invert(circle, p) {
    const d = dist(circle.center, p);
    if (!(d > 0)) return null;
    const k = (circle.radius * circle.radius) / d / d;
    return {
      x: circle.center.x + k * (p.x - circle.center.x),
      y: circle.center.y + k * (p.y - circle.center.y),
    };
  }

  /*
   * LaHireCanvas.GetPolar: invert P, then take a point one ray-length along
   * the perpendicular (dy, -dx). The line through those two points is the
   * polar. A point within half a board unit of O has no polar in the applet.
   */
  function polar(circle, p) {
    if (!finitePoint(p) || dist(p, circle.center) < MIN_DIST) return null;
    const inverse = invert(circle, p);
    if (!inverse) return null;
    const a = inverse;
    const b = {
      x: inverse.x + (p.y - circle.center.y),
      y: inverse.y - (p.x - circle.center.x),
    };
    return { a, b, inverse };
  }

  /* GeoSDoub.Dist(DoubPoint, DoubLine), including its tiny-line short cut. */
  function distToLine(p, line) {
    if (!line) return null; // the applet throws here; CheckTouch catches it
    const dx = line.b.x - line.a.x;
    const dy = line.b.y - line.a.y;
    if (sqDist(line.b, line.a) < DEGENERATE) return 0;
    const t = (dx * (p.x - line.a.x) + dy * (p.y - line.a.y)) / (dx * dx + dy * dy);
    const rx = line.a.x - p.x + dx * t;
    const ry = line.a.y - p.y + dy * t;
    return Math.sqrt(rx * rx + ry * ry);
  }

  /* GeoSDoub.Intersect(a, b, c, d): intersection of the two infinite lines. */
  function intersectLines(a, b, c, d) {
    const u = a.y - b.y;
    const v = b.x - a.x;
    const crossAB = a.x * b.y - a.y * b.x;
    const w = c.y - d.y;
    const z = d.x - c.x;
    const crossCD = c.x * d.y - c.y * d.x;
    const den = u * z - w * v;
    if (Math.abs(den) < 1) return null; // the applet returns NaN coordinates
    const x = (v * crossCD - z * crossAB) / den;
    const y = (crossAB * w - crossCD * u) / den;
    return finitePoint({ x, y }) ? { x, y } : null;
  }

  /*
   * LaHireCanvas.ConnectToCenter: where the ray from O through P crosses
   * P's polar. That is exactly the inverse point of P; the blue line in the
   * applet runs from O to P (if P is outside the circle) or only to the
   * inverse point (if P is inside it).
   */
  function connectToCenter(circle, p, line) {
    if (!line || !finitePoint(p)) return null;
    return intersectLines(circle.center, p, line.a, line.b);
  }

  /** Everything the page needs to draw and explain the current picture. */
  function geometry(state) {
    const circle = circleOf(state);
    const polarA = polar(circle, state.A);
    const polarB = polar(circle, state.B);
    const distA = polarB ? distToLine(state.A, polarB) : null;
    const distB = polarA ? distToLine(state.B, polarA) : null;
    /* CheckTouch(): PolarA must exist and A must be strictly within 1.5. */
    const touching = Boolean(polarA && polarB && distA !== null && distA < TOUCH);
    return {
      circle,
      polarA,
      polarB,
      inverseA: polarA ? polarA.inverse : null,
      inverseB: polarB ? polarB.inverse : null,
      distA,
      distB,
      touching,
      C: touching ? connectToCenter(circle, state.B, polarB) : null,
      D: touching ? connectToCenter(circle, state.A, polarA) : null,
    };
  }

  /** A plain-language line under the picture; this droodle has no end. */
  function status(state, info) {
    const g = info || geometry(state);
    if (!g.polarA || !g.polarB) {
      return "Move A and B away from the centre of the circle to draw both red lines.";
    }
    if (g.touching) {
      return "Touch! A is on the polar of B, and B is on the polar of A. " +
        "The blue lines end at the two marked inverse points.";
    }
    return `A is ${g.distA.toFixed(1)} units from B's polar. ` +
      "Drag A or B until the red line passes through the other point.";
  }

  /** An illustration: no win, no loss and no finishing move. */
  function result() {
    return null;
  }

  return {
    VIEW, MIN_DIST, TOUCH, DEGENERATE,
    start, moveVertex, moveCircle, setShowNames,
    circleOf, invert, polar, distToLine, intersectLines,
    connectToCenter, geometry, status, result,
    sqDist, dist,
  };
})();
