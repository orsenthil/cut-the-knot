"use strict";

/*
 * Minkowski Addition — Alexander Bogomolny's applet MinkowskiAddition
 * ("Addition of Radius-Vectors"), from the cut-the-knot page
 * https://www.cut-the-knot.org/Curriculum/Geometry/MinkowskiAddition.shtml
 *
 * Four points can be dragged: A, B, the first origin O and the second origin
 * O' (the applet calls it Op).  The applet draws two parallelograms for the
 * sums S = A + B - O and S' = A + B - O', then joins O to O', S to S', S to
 * O' and O to S'.  The page's claim is that moving the origin from O to O'
 * moves the sum by the *opposite* vector with the same length:
 *
 *     S' - S = O - O' = -(O' - O).
 *
 * Equivalently the quadrilateral O, S', S, O' (the order of the applet's pink
 * segments) is a parallelogram: its diagonals OS and O'S' are both bisected
 * by the midpoint of AB.  All of that is component-wise addition and
 * subtraction, so it holds for every placement of the four points.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, MinkowskiAdditionCore, so the page loads it
 * with a plain <script> and porting/check-minkowski-addition.mjs loads it in
 * Node.  Positions are plain data in the SVG viewBox units (the applet's own
 * pixel coordinates, with a small margin so a handle at the bottom fits).
 */
const MinkowskiAdditionCore = (() => {
  /* The applet's canvas is 400x300 by default ("(400 will do)", "(300 will
   * do)" in getParameterInfo).  The viewBox keeps those exact coordinates and
   * adds a margin: Reset puts O at y=300, on the original canvas's edge. */
  const VIEW = { x: 0, y: 0, width: 420, height: 330 };
  const PAD = 16;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Keep a dragged point inside the board, with room for its handle. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /* MinkowskiAdditionCanvas.Reset(), straight from the bytecode:
   *   A  = new MoveablePoint(new DoubPoint(152, 194))
   *   B  = new MoveablePoint(new DoubPoint(264, 140))
   *   O  = new MoveablePoint(new DoubPoint(142, 300))
   *   Op = new MoveablePoint(new DoubPoint(386, 238))
   * Each has r=5, is drawable, draggable, named and shows its name. */
  function start(options) {
    const o = options || {};
    return {
      A: point(152, 194), B: point(264, 140),
      O: point(142, 300), Op: point(386, 238),
      options: {
        showFirst: o.showFirst === undefined ? true : !!o.showFirst,
        showSecond: o.showSecond === undefined ? true : !!o.showSecond,
        showShift: o.showShift === undefined ? true : !!o.showShift,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state && state.options);
    s.explored = !!(state && state.explored);
    return s;
  }

  function move(state, name, p) {
    if (!state || !Object.prototype.hasOwnProperty.call(state, name)) return state;
    if (!finite(p)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  function setOption(state, name, on) {
    if (!state || !Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /**
   * Everything the applet's Draw() computes and draws, from the four draggable
   * points.  The segment arrays are in the bytecode's order and are named for
   * its three colours: red (OASB), blue (O'AS'B) and pink (OS'SO').
   */
  function compute(a, b, o, op) {
    if (!finite(a) || !finite(b) || !finite(o) || !finite(op)) return null;

    // DoubPoint(A.x + B.x - O.x, A.y + B.y - O.y) and the same with O'.
    const S = sub(add(a, b), o);
    const Sp = sub(add(a, b), op);
    const M = midpoint(a, b);

    const scale = Math.max(1, dist(a, b), dist(o, op), dist(a, S), dist(b, Sp));
    const tol = 1e-9 * scale;

    /* The page's claim: S' - S = O - O' (the opposite of O' - O). */
    const shift = sub(op, o);           // O' - O, the way the origin moved
    const sumShift = sub(Sp, S);        // S' - S, the way the sum moved
    const opposite = add(sumShift, shift); // zero when the claim holds

    /* The two parallelograms share the diagonal AB: A + B = O + S = O' + S'. */
    const firstMid = midpoint(o, S);
    const secondMid = midpoint(op, Sp);
    const bisectError = Math.max(dist(firstMid, M), dist(secondMid, M));

    /* O, S', S, O' is a parallelogram: opposite sides are equal as free
     * vectors (traversing the quadrilateral they point the other way), and
     * its diagonals OS and O'S' have M as their common midpoint. */
    const sideA = dist(add(sub(Sp, o), sub(op, S)), point(0, 0));
    const sideB = dist(sub(sub(S, Sp), shift), point(0, 0));
    const diagMid = midpoint(Sp, op);
    const paraError = Math.max(sideA, sideB, dist(firstMid, diagMid));

    /* Translation bookkeeping from the page's second explanation. */
    const v = point(7, -11);
    const one = sub(sub(add(add(a, v), b), o), S);       // move A only: +v
    const two = sub(sub(add(add(a, v), add(b, v)), o), S);          // +2v
    const three = sub(sub(add(add(a, v), add(b, v)), add(o, v)), S); // +v

    const oppositeError = dist(opposite, point(0, 0));
    const lengthError = Math.abs(dist(S, Sp) - dist(o, op));
    const claims = {
      sumAtO: dist(S, sub(add(a, b), o)) <= tol,
      sumAtOp: dist(Sp, sub(add(a, b), op)) <= tol,
      oppositeShift: oppositeError <= tol,
      equalLength: lengthError <= tol,
      bisectedAtMidAB: bisectError <= tol,
      OSpSOpParallelogram: paraError <= tol,
      shiftA: dist(one, v) <= tol,
      shiftAB: dist(two, mul(v, 2)) <= tol,
      shiftABO: dist(three, v) <= tol,
    };

    return {
      A: a, B: b, O: o, Op: op, S: S, Sp: Sp, M: M,
      shift: shift, sumShift: sumShift,
      /* Draw() order, exactly as the bytecode calls GeoSDoub.DrawLine. */
      red: [[o, a], [o, b], [a, S], [b, S]],
      blue: [[op, a], [op, b], [a, Sp], [b, Sp]],
      pink: [[o, op], [S, Sp], [S, op], [o, Sp]],
      measures: {
        oppositeError, lengthError, bisectError, paraError,
        oneError: dist(one, v), twoError: dist(two, mul(v, 2)),
        threeError: dist(three, v),
      },
      claims, tol,
    };
  }

  function geometry(state) {
    if (!state) return null;
    return compute(state.A, state.B, state.O, state.Op);
  }

  /* This is an illustration: there is no win, no loss and no finish. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move A, B, O or O' to draw the two sums.";
    let text = `S = A + B - O = (${Math.round(g.S.x)}, ${Math.round(g.S.y)}); `
      + `S' = A + B - O' = (${Math.round(g.Sp.x)}, ${Math.round(g.Sp.y)}). `
      + "The second sum sits the same distance from the first as O' is from O, in the opposite direction.";
    const err = Math.max(g.measures.oppositeError, g.measures.lengthError, g.measures.paraError);
    if (err > g.tol) text += ` Drawing error ${err.toExponential(1)}.`;
    return text;
  }

  return {
    VIEW, PAD,
    point, add, sub, mul, dist, midpoint, finite, clamp,
    start, reset, move, setOption, compute, geometry, result, describe,
  };
})();
