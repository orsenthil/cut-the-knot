"use strict";

/*
 * Deco Symmetry, from Alexander Bogomolny's applet DecoSymmetry.
 *
 * A triangle is cut into congruent pieces which are then rotated and slid (never
 * turned over) onto its mirror image. The key idea transcribed here is the
 * applet's own construction: put the largest angle first, reflect the triangle
 * in the vertical middle of the canvas, drop the altitude from that corner and
 * join its foot to the midpoints of the two sides (four pieces), or, for an
 * acute triangle with the "Acute special" box ticked, join the circumcentre to
 * the three corners (three pieces).
 *
 * No document, no window, no storage: one global, plain data in and out.
 */
const DecoSymmetryCore = (() => {
  const WIDTH = 400;           // the applet's "WIDTH (400 seems optimal)"
  const HEIGHT = 250;          // the applet's "HEIGHT (250 seems optimal)"
  const NSTEPS = 50;           // the applet's animation length
  const HALF_PI = Math.PI / 2;
  const LIMIT = 6;             // keep a draggable corner clear of the edge

  const pt = (x, y) => ({ x: x, y: y });
  const add = (a, b) => pt(a.x + b.x, a.y + b.y);
  const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
  const scale = (a, k) => pt(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const sqDist = (a, b) => {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  };
  const dist = (a, b) => Math.sqrt(sqDist(a, b));
  const mid = (a, b) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);
  const avg = (a, b, c) => pt((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const clampPoint = (p) => pt(clamp(p.x, LIMIT, WIDTH - LIMIT), clamp(p.y, LIMIT, HEIGHT - LIMIT));
  const lerpPoint = (a, b, t) => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

  /* GeoSDoub.ComputeAngle: the law of cosines, angle at the first argument. */
  function angle(a, b, c) {
    const den = 2 * dist(a, b) * dist(a, c);
    if (!(den > 0)) return NaN;
    const cos = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / den;
    return Math.acos(clamp(cos, -1, 1));
  }

  /* GeoSDoub.FindOrientation, kept in the applet's own algebraic form. */
  function orientation(a, b, c) {
    const v = c.x * (b.y - a.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return v > 0 ? 1 : -1;
  }

  /* GeoSDoub.ComputeSignedAngle: the same unsigned angle with the applet's sign. */
  function signedAngle(a, b, c) {
    const theta = angle(a, b, c);
    const orient = orientation(a, b, c);
    let out = orient === 1 ? theta : -theta;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (theta > 0.99 && dx * dx + dy * dy < 0) return Math.PI; // unreachable, as in the applet
    return out;
  }

  /* GeoSDoub.Intersect of two lines through point pairs, including its NaN test. */
  function lineIntersection(a, b, c, d) {
    const A1 = a.y - b.y, B1 = b.x - a.x, C1 = a.x * b.y - a.y * b.x;
    const A2 = c.y - d.y, B2 = d.x - c.x, C2 = c.x * d.y - c.y * d.x;
    const det = A1 * B2 - A2 * B1;
    if (Math.abs(det) < 1) return pt(NaN, NaN);
    return pt((B1 * C2 - B2 * C1) / det, (C1 * A2 - C2 * A1) / det);
  }

  /* GeoSDoub.NearestPoint(a, b, c): the foot of the perpendicular from a to bc. */
  function foot(a, b, c) {
    if (sqDist(b, a) < 0.1) return a;
    const v = sub(c, b), t = dot(sub(a, b), v) / dot(v, v);
    return pt(b.x + v.x * t, b.y + v.y * t);
  }

  /* GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = mid(a, b), m2 = mid(b, c);
    const p1 = pt(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
    const p2 = pt(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
    return lineIntersection(m1, p1, m2, p2);
  }

  /*
   * FindLargestAngle: three independent tests, not an if/else chain. On a tie
   * the later assignments win, so an equilateral triangle ends as (M, K, L).
   */
  function orderedAngles(K, L, M) {
    const a = angle(K, L, M), b = angle(L, M, K), c = angle(M, L, K);
    let A = K, B = L, C = M;
    if (a >= b && a >= c) { A = K; B = L; C = M; }
    if (b >= a && b >= c) { A = L; B = M; C = K; }
    if (c >= a && c >= b) { A = M; B = K; C = L; }
    return { A: A, B: B, C: C, angles: [a, b, c] };
  }

  /** The position the applet opens with. No options are ticked. */
  function start(options) {
    const w = WIDTH, h = HEIGHT;
    const third = w / 3, half = h / 2, radius = Math.min(w, h) / 3;
    const turn = 2.0943951023931953; // the applet's 2*pi/3 literal
    const s = {
      K: pt(third + radius - w / 6, half + h / 8),
      L: pt(third + radius * Math.cos(turn) - w / 12, half - radius * Math.sin(turn)),
      M: pt(third + radius * Math.cos(2 * turn) - w / 12, half - radius * Math.sin(2 * turn)),
      showNames: false,
      showHint: false,
      specialAcute: false,
      moving: false,
      done: false,
    };
    return Object.assign(s, options || {});
  }

  /** A corner is dragged to p; the whole triangle is dragged by delta {dx,dy}. */
  function move(state, name, p) {
    if (name === "all") {
      const xs = [state.K.x, state.L.x, state.M.x], ys = [state.K.y, state.L.y, state.M.y];
      const dx = clamp(p.dx, LIMIT - Math.min.apply(null, xs), WIDTH - LIMIT - Math.max.apply(null, xs));
      const dy = clamp(p.dy, LIMIT - Math.min.apply(null, ys), HEIGHT - LIMIT - Math.max.apply(null, ys));
      return Object.assign({}, state, {
        K: pt(state.K.x + dx, state.K.y + dy),
        L: pt(state.L.x + dx, state.L.y + dy),
        M: pt(state.M.x + dx, state.M.y + dy),
        done: false,
      });
    }
    if (name !== "K" && name !== "L" && name !== "M") return state;
    const out = Object.assign({}, state);
    out[name] = clampPoint(p);
    out.done = false;
    return out;
  }

  /** The panel's three checkboxes; "Show moving" is set by the Move them button. */
  function option(state, key, value) {
    const out = Object.assign({}, state);
    out[key] = !!value;
    if (key === "moving" && !!value) out.done = false;
    return out;
  }

  /*
   * Compute(), ComputeRegular(), ComputeAcute(), IsAcute() and the piece lists
   * of MoveThem(), in one derived value. `pieces[i].from` is the filled triangle
   * drawn on the original; `pieces[i].to` is where Move them sends it.
   */
  function compute(state) {
    const ordered = orderedAngles(state.K, state.L, state.M);
    const A = ordered.A, B = ordered.B, C = ordered.C;
    const G = avg(A, B, C);
    const P = pt(WIDTH - G.x, G.y); // P.y = centroid.y, P.x = width - centroid.x
    const mirror = (p) => pt(P.x - (p.x - G.x), P.y + (p.y - G.y));
    const Ap = mirror(A), Bp = mirror(B), Cp = mirror(C);
    const acute = ordered.angles.every((a) => a < HALF_PI);
    const specialAcute = acute && !!state.specialAcute;

    let D = null, E = null, F = null, Dp = null, Ep = null, Fp = null;
    let O = null, Op = null;
    let pieces;
    if (specialAcute) {
      O = circumcenter(A, B, C);
      Op = circumcenter(Ap, Bp, Cp);
      // MoveThem starts each rotating triangle at the circumcentre, not at
      // the vertex used by the filled-polygon list in ComputeAcute.
      pieces = [
        { from: [O, A, B], to: [Op, Bp, Ap] },
        { from: [O, B, C], to: [Op, Cp, Bp] },
        { from: [O, C, A], to: [Op, Ap, Cp] },
      ];
    } else {
      D = foot(A, B, C);
      E = mid(A, B);
      F = mid(A, C);
      Dp = foot(Ap, Bp, Cp);
      Ep = mid(Ap, Bp);
      Fp = mid(Ap, Cp);
      pieces = [
        { from: [E, B, D], to: [Ep, Dp, Bp] },
        { from: [E, D, A], to: [Ep, Ap, Dp] },
        { from: [F, A, D], to: [Fp, Dp, Ap] },
        { from: [F, D, C], to: [Fp, Cp, Dp] },
      ];
    }
    return {
      K: state.K, L: state.L, M: state.M,
      A: A, B: B, C: C, angles: ordered.angles,
      P: P, G: G, Ap: Ap, Bp: Bp, Cp: Cp,
      acute: acute, specialAcute: specialAcute,
      D: D, E: E, F: F, Dp: Dp, Ep: Ep, Fp: Fp, O: O, Op: Op,
      pieces: pieces,
    };
  }

  /*
   * The turn that really takes one directed side onto the other. The applet's
   * ComputeSignedAngle uses GeoSDoub.FindOrientation, an expression that
   * depends on where the triangle sits on the canvas; it can choose the wrong
   * sign and leave a piece short of its target. The page asks us to show the
   * decomposition, so the animation uses the geometric turn instead.
   */
  function turnAngle(a, b, c) {
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const theta = angle(a, b, c);
    return cross >= 0 ? theta : -theta;
  }

  /* SetRotatingTriangle plus RotatingPoly.SetGoal: the applet's motion data. */
  function goal(piece) {
    const from = piece.from, to = piece.to;
    const focus = avg(from[0], from[1], from[2]);
    const goalPoint = avg(to[0], to[1], to[2]);
    const helper = pt(from[0].x + to[1].x - to[0].x, from[0].y + to[1].y - to[0].y);
    let fullAngle = turnAngle(from[0], from[1], helper);
    if (Number.isNaN(fullAngle)) fullAngle = Math.PI;
    const east = pt(focus.x + 1000, focus.y);
    const polar = from.map((p) => {
      const theta = signedAngle(focus, east, p);
      return { r: dist(focus, p), theta: Number.isNaN(theta) ? 0 : theta };
    });
    return { focus: focus, goal: goalPoint, fullAngle: fullAngle, polar: polar };
  }

  /* A frame of the animation: slide the centroid and turn the piece as it goes. */
  function frame(piece, t) {
    const g = goal(piece);
    const centre = lerpPoint(g.focus, g.goal, t);
    const turn = t * g.fullAngle;
    const cos = Math.cos(turn), sin = Math.sin(turn);
    return g.polar.map((p) => pt(
      centre.x + p.r * (Math.cos(p.theta) * cos - Math.sin(p.theta) * sin),
      centre.y + p.r * (Math.sin(p.theta) * cos + Math.cos(p.theta) * sin),
    ));
  }

  /*
   * The direct (rotation + translation, no reflection) isometry taking the
   * ordered points `from` to `to`, with the largest vertex error it leaves.
   */
  function rigidMap(from, to) {
    if (!from.length || from.length !== to.length) return null;
    const a = Math.atan2(to[1].y - to[0].y, to[1].x - to[0].x) -
      Math.atan2(from[1].y - from[0].y, from[1].x - from[0].x);
    const cos = Math.cos(a), sin = Math.sin(a);
    const map = (p) => pt(
      to[0].x + (p.x - from[0].x) * cos - (p.y - from[0].y) * sin,
      to[0].y + (p.x - from[0].x) * sin + (p.y - from[0].y) * cos,
    );
    let error = 0;
    for (let i = 0; i < from.length; i++) error = Math.max(error, dist(map(from[i]), to[i]));
    return { angle: a, cos: cos, sin: sin, error: error };
  }

  /** Convex polygons, same cyclic direction: congruent by a direct isometry? */
  function directlyCongruent(a, b, tol) {
    if (!a || !b || a.length !== b.length) return false;
    const limit = tol || 1e-7;
    for (let shift = 0; shift < a.length; shift++) {
      const turned = b.slice(shift).concat(b.slice(0, shift));
      const m = rigidMap(a, turned);
      if (m && m.error <= limit) return true;
    }
    return false;
  }

  /** The status line: what the current drawing shows. */
  function describe(f, state) {
    if (state.moving) return "The pieces are sliding and turning into the mirror image.";
    if (state.done) return "The pieces now form the mirror image. No piece was flipped.";
    const n = f.pieces.length;
    const extra = f.acute
      ? (f.specialAcute ? "Acute special: three pieces from the centre." : "Acute special is available.")
      : "Acute special is unavailable for this shape.";
    return `The triangle is cut into ${n} pieces; its mirror image is on the right. ${extra}`;
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, NSTEPS: NSTEPS,
    pt: pt, add: add, sub: sub, scale: scale, dot: dot,
    sqDist: sqDist, dist: dist, mid: mid, avg: avg, clamp: clamp,
    clampPoint: clampPoint, angle: angle, signedAngle: signedAngle,
    foot: foot, circumcenter: circumcenter, orderedAngles: orderedAngles,
    turnAngle: turnAngle,
    start: start, move: move, option: option, compute: compute,
    goal: goal, frame: frame, rigidMap: rigidMap,
    directlyCongruent: directlyCongruent, describe: describe,
  };
})();
