"use strict";

/*
 * Mc Worter 2 — the illustration behind Bogomolny's applet McWorter2.
 *
 * A triangle ABC has two similar parallelograms on the sides CA and BC. With
 * A at the origin, B = b and C = g, the applet's own computation is
 *   B_a = c·g,  A_c = g + c·(b − g),  A_b = A_c + (b − g),
 * where c is any complex multiplier; in the applet c = K times a rotation
 * through the chosen angle. Their midpoint is
 *   M = (A_b + B_a)/2 = b·(1 + c)/2,
 * so the part containing C cancels. With c = i this is Bottema's theorem;
 * McWorter's observation in this applet is that the same identity works for
 * any similar parallelograms, not just squares. The earlier McWorter applet
 * instead adds the point D completing ADBC and studies the right isosceles
 * triangle B_a D A_b; this applet drops D and keeps only M.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Mcworter2Core, so the page loads it with a plain
 * <script> and porting/check-mcworter-2.mjs loads it in Node. The position is
 * plain data (numbers, strings, booleans, plain objects), so it can be saved
 * and handed to the tutor as it is. Functions take a position and return new
 * objects; nothing passed in is changed.
 */
const Mcworter2Core = (() => {
  /* McWorter2Panel creates Scrollbar(0, 0, 2, -20, 30) and
   * Scrollbar(0, 0, 10, -90, 100). AWT caps a scrollbar's reachable value at
   * maximum − visibleAmount, hence 28 and 90 here. */
  const COEF_MIN = -20, COEF_MAX = 28;
  const ANGLE_MIN = -90, ANGLE_MAX = 90;
  const EPS = 1e-10;

  /* Rotate Q about P by angle; orientation -1 is GeoSDoub.Rotate's clockwise
   * factor e^(-i·angle) in canvas coordinates (y grows downwards). */
  function rotate(pivot, point, angle, orientation) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    const dx = point.x - pivot.x, dy = point.y - pivot.y;
    return {
      x: pivot.x + cs * dx - orientation * sn * dy,
      y: pivot.y + orientation * sn * dx + cs * dy,
    };
  }

  /** The two scrollbar values as the applet's adjustmentValueChanged reads them. */
  function settings(state) {
    const coef = state.coef === undefined ? 0 : state.coef;
    const angleValue = state.angle === undefined ? 0 : state.angle;
    const degrees = angleValue + 90;
    return {
      K: (coef + 20) / 20,
      angleValue,
      degrees,
      angle: degrees * Math.PI / 180,
    };
  }

  /** McWorter2Canvas.ComputePoint: rotate, then scale away from the pivot. */
  function computePoint(pivot, point, angle, K) {
    const r = rotate(pivot, point, angle, -1);
    return {
      x: pivot.x + K * (r.x - pivot.x),
      y: pivot.y + K * (r.y - pivot.y),
    };
  }

  /** McWorter2Canvas.CompleteParallelogram: target = p + q − r. */
  function completeParallelogram(p, q, r) {
    return { x: p.x + q.x - r.x, y: p.y + q.y - r.y };
  }

  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
  const closePoint = (p, q, tol) =>
    Boolean(p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol));
  const vec = (p, q) => ({ x: q.x - p.x, y: q.y - p.y });
  const dot = (u, v) => u.x * v.x + u.y * v.y;

  /** The position McWorter2Canvas.init places on a width × height canvas. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 250 : o.height;
    const cx = width / 2, cy = height / 2, dx = width / 8, dy = height / 4;
    const base = o.points || {
      A: { x: cx - dx, y: cy + dy },
      B: { x: cx + dx, y: cy + dy },
      C: { x: cx + dx / 2, y: cy - dy * 3 / 2 },
    };
    return {
      A: { x: base.A.x, y: base.A.y },
      B: { x: base.B.x, y: base.B.y },
      C: { x: base.C.x, y: base.C.y },
      coef: 0,
      angle: 0,
      showNames: true,
      ...("coef" in o ? { coef: withOption(base, "coef", o.coef).coef } : {}),
      ...("angle" in o ? { angle: withOption(base, "angle", o.angle).angle } : {}),
      ...("showNames" in o ? { showNames: Boolean(o.showNames) } : {}),
    };
  }

  /**
   * One redraw of McWorter2Canvas.Compute: AC = ComputePoint(C, B),
   * AB = AC + B − C, BA = ComputePoint(A, C), BC = BA + C − A,
   * M = Midpoint(AB, BA). The names keep the applet's subscripts.
   */
  function figure(state) {
    const { A, B, C } = state;
    const { angle, K } = settings(state);
    const Ac = computePoint(C, B, angle, K);
    const Ab = completeParallelogram(Ac, B, C);
    const Ba = computePoint(A, C, angle, K);
    const Bc = completeParallelogram(Ba, C, A);
    return { A, B, C, Ab, Ac, Ba, Bc, M: midpoint(Ab, Ba) };
  }

  /** The closed form M = b(1 + c)/2, translated so that A need not be 0. */
  function claimedMidpoint(state) {
    const { A, B } = state;
    const { angle, K } = settings(state);
    const v = rotate({ x: 0, y: 0 }, vec(A, B), angle, -1);
    return { x: (A.x + B.x + K * v.x) / 2, y: (A.y + B.y + K * v.y) / 2 };
  }

  /** The smaller angle between two vectors, in degrees. */
  function angleBetween(u, v) {
    if (Math.hypot(u.x, u.y) < EPS || Math.hypot(v.x, v.y) < EPS) return NaN;
    /* atan2 keeps full precision at 0° and 180°, where acos of a dot product
     * rounded to ±1 would lose a few millionths of a degree. */
    const cross = Math.abs(u.x * v.y - u.y * v.x);
    return Math.atan2(cross, dot(u, v)) * 180 / Math.PI;
  }

  /** Every claim the article makes, checked at this configuration. */
  function claims(state) {
    const f = figure(state);
    const { K, degrees } = settings(state);
    const scale = Math.max(1, distance(state.A, state.B), distance(state.A, state.C));
    const tol = 1e-8 * scale;
    const expected = claimedMidpoint(state);

    /* The C-containing terms cancel, so the midpoint is this closed form. */
    const midpointIndependent = closePoint(f.M, expected, tol);

    /* Move C to five very different places: M must not budge. */
    const offsets = [{ x: 37, y: 0 }, { x: -25, y: 55 }, { x: 0, y: -80 },
      { x: 120, y: 35 }, { x: -90, y: -30 }];
    const independenceOverC = offsets.every((d) => {
      const moved = figure(withPoint(state, "C", {
        x: state.C.x + d.x, y: state.C.y + d.y,
      }));
      return closePoint(moved.M, expected, tol);
    });

    /* Both four-point shapes close up as parallelograms. */
    const parallelograms =
      closePoint(vec(state.B, f.Ab), vec(state.C, f.Ac), tol) &&
      closePoint(vec(f.Ab, f.Ac), vec(state.B, state.C), tol) &&
      closePoint(vec(state.C, f.Bc), vec(state.A, f.Ba), tol) &&
      closePoint(vec(f.Bc, f.Ba), vec(state.C, state.A), tol);

    /* Their adjacent sides differ by the same factor K and the same turn. */
    const similar = parallelograms &&
      close(distance(state.B, f.Ab), K * distance(state.B, state.C), tol) &&
      close(distance(state.C, f.Ac), K * distance(state.C, state.B), tol) &&
      close(distance(state.A, f.Ba), K * distance(state.A, state.C), tol) &&
      close(distance(state.C, f.Bc), K * distance(state.C, state.A), tol);

    /* The page's equal angles: ∠B_aAC = ∠BCA_c = the chosen turn. */
    const angleA = angleBetween(vec(state.A, f.Ba), vec(state.A, state.C));
    const angleC = angleBetween(vec(state.C, state.B), vec(state.C, f.Ac));
    const turning = Math.min(degrees, 360 - degrees);
    const equalAngles = K > EPS &&
      Number.isFinite(angleA) && Number.isFinite(angleC) &&
      close(angleA, angleC, 1e-6) && close(angleA, turning, 1e-6);

    return { midpointIndependent, independenceOverC, parallelograms, similar, equalAngles };
  }

  /** True exactly at the applet's default settings, where the flanks are squares. */
  function defaultSquares(state) {
    const f = figure(state);
    const { K, degrees } = settings(state);
    if (!close(K, 1, 1e-12) || !close(degrees, 90, 1e-9)) return false;
    const tol = 1e-8 * Math.max(1, distance(state.A, state.B));
    return close(distance(state.B, f.Ab), distance(state.B, state.C), tol) &&
      close(distance(state.A, f.Ba), distance(state.A, state.C), tol) &&
      close(dot(vec(state.B, state.C), vec(state.B, f.Ab)), 0, tol) &&
      close(dot(vec(state.A, state.C), vec(state.A, f.Ba)), 0, tol);
  }

  /** A new position with one of A, B, C moved; the options stay the same. */
  function withPoint(state, name, p) {
    const next = {
      A: { ...state.A }, B: { ...state.B }, C: { ...state.C },
      coef: state.coef, angle: state.angle, showNames: state.showNames,
    };
    if (next[name]) next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** Scrollbar values are integers inside the applet's ranges. */
  function withOption(state, name, value) {
    const next = withPoint(state, "", state.A);
    if (name === "coef") {
      next.coef = Math.round(Math.max(COEF_MIN, Math.min(COEF_MAX, Number(value) || 0)));
    } else if (name === "angle") {
      next.angle = Math.round(Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, Number(value) || 0)));
    } else if (name === "showNames") {
      next.showNames = Boolean(value);
    }
    return next;
  }

  /** An illustration has nothing to win or lose. */
  function result(/* state */) {
    return null;
  }

  return {
    COEF_MIN, COEF_MAX, ANGLE_MIN, ANGLE_MAX,
    rotate, settings, computePoint, completeParallelogram, midpoint,
    distance, angleBetween, start, figure, claimedMidpoint,
    claims, defaultSquares, withPoint, withOption, result,
  };
})();
