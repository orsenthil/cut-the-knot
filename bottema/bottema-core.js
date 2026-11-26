"use strict";

/*
 * Bottema — the illustration behind Bogomolny's applet Bottema.
 *
 * Two squares share the vertex C of a triangle ABC: B A_c A_b C is built on
 * BC, and A B_a B_c C is built on CA. Bottema's theorem says that the midpoint
 * M of A_b B_a does not move when C moves with A and B held still. In fact
 * M is the centre of the square erected on AB on the same side as M, so AMB
 * is an isosceles right triangle, and the same M completes the square-built
 * points A_c and B_c into another isosceles right triangle.
 *
 * The one idea the code relies on: GeoSDoub.Rotate turns C about B one way
 * and about A the other way. In the sum of the two rotated points the part
 * that depends on C cancels, because a quarter turn and its inverse add to
 * zero. Only A and B are left, which is why M is independent of C.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BottemaCore, so the page loads it with a plain
 * <script> and porting/check-bottema.mjs loads it in Node. The position is
 * plain data (numbers, strings, booleans, plain objects), so it can be saved
 * and handed to the tutor as it is. Functions take a position and return new
 * objects; nothing passed in is changed.
 */
const BottemaCore = (() => {
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
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const vec = (p, q) => ({ x: q.x - p.x, y: q.y - p.y });
  const close = (a, b, tol) => Math.abs(a - b) <= tol;

  /**
   * The starting diagram, placed exactly as BottemaCanvas.init places it on
   * its preferred 400x250 canvas. The two checkboxes start unchecked and the
   * hint checkbox is disabled until lines are shown, as in BottemaPanel.
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
   * One redraw of BottemaCanvas.Draw: FormSquare(B,C,AB,AC), then
   * FormSquare(C,A,BC,BA), then M = Midpoint(BA,AB). The names keep the
   * applet's subscripts: A_b and A_c are the two points of the square on BC,
   * B_a and B_c those of the square on CA.
   */
  function figure(state) {
    const { A, B, C } = state;
    const Ab = rotate(B, C, HALF_PI, 1);    // A_b: C about B, quarter turn +
    const Ac = rotate(C, B, HALF_PI, -1);   // A_c: B about C, quarter turn -
    const Bc = rotate(C, A, HALF_PI, 1);    // B_c: A about C, quarter turn +
    const Ba = rotate(A, C, HALF_PI, -1);   // B_a: C about A, quarter turn -
    const M = midpoint(Ba, Ab);             // the treasure in the pirate story
    return { A, B, C, Ab, Ac, Bc, Ba, M };
  }

  /** The same M from the closed form: only A and B appear in it. */
  function squareCentre(state) {
    const { A, B } = state;
    return {
      x: (A.x + B.x + B.y - A.y) / 2,
      y: (A.y + B.y - B.x + A.x) / 2,
    };
  }

  /**
   * The lengths in the elementary proof, written for a tilted AB. U, V, W and
   * Z are the feet of the perpendiculars from B_a, A_b, M and C onto AB.
   * B_aU = AZ, A_bV = BZ, and MW is the midline of the trapezoid B_aUVA_b.
   */
  function flankHeights(state) {
    const f = figure(state);
    const u = vec(state.A, state.B);
    const len = Math.hypot(u.x, u.y);
    if (len < EPS) return null;
    const unit = { x: u.x / len, y: u.y / len };
    // n points to the side of AB on which M lies.
    const n = { x: unit.y, y: -unit.x };
    const height = (p) => dot(vec(state.A, p), n);
    const along = (p) => dot(vec(state.A, p), unit);
    return {
      BaU: height(f.Ba), AbV: height(f.Ab), MW: height(f.M),
      AZ: along(f.C), BZ: len - along(f.C),
      base: len, halfBase: len / 2,
    };
  }

  /** Each claim made by the article and the applet, checked at this diagram. */
  function claims(state) {
    const f = figure(state);
    const base = distance(state.A, state.B);
    const tol = 1e-8 * Math.max(1, base);
    const centre = squareCentre(state);
    const u = vec(f.M, state.A), v = vec(f.M, state.B);
    const u2 = vec(f.M, f.Ac), v2 = vec(f.M, f.Bc);
    const foot = flankHeights(state);
    const ab2 = base * base;
    return {
      /* The treasure is fixed: the closed form agrees with the applet. */
      midpointIndependent: closePoint(f.M, centre, tol),
      /* AMB is isosceles right at M, the centre of the square on AB. */
      rightIsosceles:
        base > EPS &&
        close(dot(u, v), 0, tol) && close(Math.hypot(u.x, u.y), Math.hypot(v.x, v.y), tol) &&
        close(Math.hypot(u.x, u.y) ** 2, ab2 / 2, tol),
      /* The other flanks, A_c and B_c, give the same kind of triangle. */
      otherRightIsosceles:
        close(dot(u2, v2), 0, tol) && close(Math.hypot(u2.x, u2.y), Math.hypot(v2.x, v2.y), tol),
      /* The two squares have equal sides and right corners, as constructed. */
      squares:
        close(distance(state.B, f.Ab), distance(state.B, state.C), tol) &&
        close(distance(state.C, f.Ac), distance(state.C, state.B), tol) &&
        close(distance(state.C, f.Bc), distance(state.C, state.A), tol) &&
        close(distance(state.A, f.Ba), distance(state.A, state.C), tol),
      /* The trapezoid identity B_aU = AZ and A_bV = BZ from the article. */
      heightsMatch: Boolean(foot) &&
        close(foot.BaU, foot.AZ, tol) && close(foot.AbV, foot.BZ, tol),
      /* MW, the midline of that trapezoid, is half of AB. */
      halfway: Boolean(foot) &&
        close((foot.BaU + foot.AbV) / 2, foot.halfBase, tol) &&
        close(foot.MW, foot.halfBase, tol),
    };
  }

  function closePoint(p, q, tol) {
    return p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
  }

  /** A new position with one of A, B, C moved; the checkboxes are options. */
  function withPoint(state, name, p) {
    const next = {
      A: { ...state.A }, B: { ...state.B }, C: { ...state.C },
      showNames: state.showNames,
      showLines: state.showLines,
      showHint: state.showHint,
    };
    if (next[name]) next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** With the lines hidden the hint checkbox is greyed out, as in the applet. */
  function withOption(state, name, value) {
    const next = withPoint(state, "", state.A);
    if (name === "showNames" || name === "showLines" || name === "showHint") next[name] = Boolean(value);
    if (!next.showLines) next.showHint = false;
    return next;
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    HALF_PI, rotate, distance, midpoint, start, figure, squareCentre,
    flankHeights, claims, withPoint, withOption, result,
  };
})();
