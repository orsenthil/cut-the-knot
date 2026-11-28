"use strict";

/*
 * McWorter — the illustration behind Bogomolny's applet McWorter, on the page
 * "On Bottema's Shoulders". Squares A C B_c B_a and B C A_c A_b share the
 * vertex C of a triangle ABC. Bottema's theorem says that M, the midpoint of
 * the segment A_b B_a, does not move when C moves. Professor W. McWorter
 * added the claim this port checks: if D completes the parallelogram A D B C
 * (so D = A + B - C), then the triangle B_a D A_b is isosceles and has a right
 * angle at D.
 *
 * The one idea the code relies on is the applet's Compute method, transcribed
 * here: FormSquare(B, C, AB, AC) and FormSquare(C, A, BC, BA) use quarter
 * turns about B/C and C/A; M is the midpoint of BA (B_a) and AB (A_b); and D
 * is A + B - C. A quarter turn R satisfies R(v) + R⁻¹(v) = 0, so the C terms
 * cancel in M, while the two legs at D are u - R(v) and v - R(u) (up to sign)
 * and are therefore equal and perpendicular.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, McworterCore, so the page loads it with a
 * plain <script> and porting/check-mcworter.mjs loads it in Node. The position
 * is plain data (numbers, strings, booleans, plain objects), so it can be
 * saved and handed to the tutor as it is. Functions take a position and return
 * new objects; nothing passed in is changed.
 */
const McworterCore = (() => {
  const HALF_PI = Math.PI / 2;
  const EPS = 1e-9;

  /* GeoSDoub.Rotate(P, Q, angle, orientation), transcribed from the bytecode:
   * x' = P.x + cos(a)(Q.x-P.x) - s*sin(a)(Q.y-P.y)
   * y' = P.y + s*sin(a)(Q.x-P.x) + cos(a)(Q.y-P.y), s = orientation.
   * The applet's canvas has y growing downwards; this keeps its arithmetic. */
  function rotate(pivot, point, angle, orientation) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    const dx = point.x - pivot.x, dy = point.y - pivot.y;
    return {
      x: pivot.x + cs * dx - orientation * sn * dy,
      y: pivot.y + orientation * sn * dx + cs * dy,
    };
  }

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const vec = (p, q) => ({ x: q.x - p.x, y: q.y - p.y });
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
  const closePoint = (p, q, tol) => Boolean(p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol));

  /**
   * McWorterCanvas.init on its preferred 400x250 canvas. The three points are
   * draggable; the three checkboxes start unchecked (the applet's "ShowNames"
   * parameter defaults to off on the top applet on the page).
   */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C },
        showNames: Boolean(o.showNames),
        showLines: Boolean(o.showLines),
        showHint: Boolean(o.showHint),
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 250 : o.height;
    const cx = width / 2, cy = height / 2;
    const dx = width / 8, dy = height / 3;
    return {
      A: { x: cx - dx, y: cy + dy },
      B: { x: cx + dx, y: cy + dy },
      C: {
        x: cx + dx * Math.cos(Math.PI / 3),
        y: cy - dx * Math.sin(Math.PI / 3) + dy / 2,
      },
      showNames: false,
      showLines: false,
      showHint: false,
    };
  }

  /**
   * One redraw of McWorterCanvas.Compute:
   * FormSquare(B,C,AB,AC), FormSquare(C,A,BC,BA), M = Midpoint(BA,AB),
   * D = A + B - C. AB is A_b, AC is A_c, BC is B_c, BA is B_a, as the applet's
   * ShowNames method calls them.
   */
  function figure(state) {
    const { A, B, C } = state;
    const Ab = rotate(B, C, HALF_PI, 1);    // A_b: C about B, quarter turn +
    const Ac = rotate(C, B, HALF_PI, -1);   // A_c: B about C, quarter turn -
    const Bc = rotate(C, A, HALF_PI, 1);    // B_c: A about C, quarter turn +
    const Ba = rotate(A, C, HALF_PI, -1);   // B_a: C about A, quarter turn -
    const M = midpoint(Ba, Ab);             // midpoint of A_b B_a
    const D = { x: A.x + B.x - C.x, y: A.y + B.y - C.y };
    return { A, B, C, Ab, Ac, Bc, Ba, M, D };
  }

  /**
   * The midpoint from the closed form in the article:
   * M = (A + B)/2 + R(A - B)/2. No C appears in it, which is Bottema's theorem.
   */
  function squareCentre(state) {
    const { A, B } = state;
    return {
      x: (A.x + B.x - (A.y - B.y)) / 2,
      y: (A.y + B.y + (A.x - B.x)) / 2,
    };
  }

  /**
   * The five equal-length pairs marked by the applet's ShowHint: LineID 2
   * matches AC, A B_a and B D; LineID 3 matches BC, B A_b and A D.
   */
  function hintLengths(state) {
    const f = figure(state);
    return {
      two: [distance(state.A, state.C), distance(state.A, f.Ba), distance(state.B, f.D)],
      three: [distance(state.B, state.C), distance(state.B, f.Ab), distance(state.A, f.D)],
    };
  }

  /** Each claim made by the article, evaluated at this diagram. */
  function claims(state) {
    const f = figure(state);
    const tol = 1e-8 * Math.max(1, distance(state.A, state.B));
    const toBa = vec(f.D, f.Ba), toAb = vec(f.D, f.Ab);
    const legA = Math.hypot(toBa.x, toBa.y), legB = Math.hypot(toAb.x, toAb.y);
    const centre = squareCentre(state);
    const hints = hintLengths(state);
    const same = (xs) => xs.every((v) => close(v, xs[0], tol));
    const parallelogram = closePoint(
      vec(state.A, f.D), vec(state.C, state.B), tol) &&
      closePoint(vec(state.B, f.D), vec(state.C, state.A), tol);
    return {
      /* Bottema: the midpoint M does not depend on C. */
      midpointIndependent: closePoint(f.M, centre, tol),
      /* McWorter: the triangle at D is isosceles. */
      isoscelesAtD: close(legA, legB, tol),
      /* ... and its angle at D is a right angle (non-degenerate legs). */
      rightAtD: legA > EPS * Math.max(1, distance(state.A, state.B)) &&
        legB > EPS * Math.max(1, distance(state.A, state.B)) &&
        close(dot(toBa, toAb), 0, tol),
      /* A D B C really is a parallelogram: AD = CB, BD = CA. */
      parallelogram: parallelogram,
      /* The two flanks are squares: four equal sides, right corners. */
      squares:
        close(distance(state.B, f.Ab), distance(state.B, state.C), tol) &&
        close(distance(f.Ab, f.Ac), distance(state.B, state.C), tol) &&
        close(distance(f.Ac, state.C), distance(state.B, state.C), tol) &&
        close(distance(state.C, f.Bc), distance(state.C, state.A), tol) &&
        close(distance(f.Bc, f.Ba), distance(state.C, state.A), tol) &&
        close(distance(f.Ba, state.A), distance(state.C, state.A), tol),
      /* The hint's two sets of three matching sides. */
      hintMarks: same(hints.two) && same(hints.three),
      /* The congruent triangles AB_aD and BD A_b have equal third sides too. */
      congruentTriangles:
        close(distance(state.A, f.Ba), distance(state.B, f.D), tol) &&
        close(distance(state.A, f.D), distance(state.B, f.Ab), tol) &&
        close(legA, legB, tol),
    };
  }

  /** Angle at D in degrees, for the readout; 90 is the page's claim. */
  function angleAtD(state) {
    const f = figure(state);
    const a = vec(f.D, f.Ba), b = vec(f.D, f.Ab);
    const na = Math.hypot(a.x, a.y), nb = Math.hypot(b.x, b.y);
    if (!na || !nb) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (na * nb)))) * 180 / Math.PI;
  }

  /** A new position with one of the draggable points moved. */
  function withPoint(state, name, p) {
    const next = {
      A: { ...state.A }, B: { ...state.B }, C: { ...state.C },
      showNames: state.showNames, showLines: state.showLines, showHint: state.showHint,
    };
    if (next[name]) next[name] = { x: p.x, y: p.y };
    return next;
  }

  /**
   * McWorterPanel has three independent checkboxes: names, rotation (lines)
   * and hint. Unlike Bottema's panel, it does not grey out the hint when the
   * lines are hidden, so the flags are kept exactly as given.
   */
  function withOption(state, name, value) {
    const next = withPoint(state, "", state.A);
    if (name === "showNames" || name === "showLines" || name === "showHint") {
      next[name] = Boolean(value);
    }
    return next;
  }

  /** An illustration has no win or loss. */
  function result(/* state */) {
    return null;
  }

  return {
    HALF_PI, rotate, distance, dot, close, closePoint, start, figure,
    squareCentre, hintLengths, claims, angleAtD, withPoint, withOption, result,
  };
})();
