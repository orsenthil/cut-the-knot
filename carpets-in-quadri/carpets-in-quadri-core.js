"use strict";

/*
 * Carpets in a Quadrilateral — Alexander Bogomolny's applet CarpetsInQuadri.
 *
 * ABCD is a convex quadrilateral. P is on AB and Q is on CD so that
 * AP/AB = CQ/CD = r. R is where AQ meets DP and S is where BQ meets CP.
 * The page asks us to prove that the blue quadrilateral PSQR has the same area
 * as the two red triangles ARD and BSC together.
 *
 * The one idea the code uses: the applet keeps t = BP/AB (its field `coefP`,
 * initially 0.7) and puts P = t*A + (1-t)*B and Q = t*C + (1-t)*D. Since
 * r = 1-t, this is exactly the page's P = rB + (1-r)A and
 * Q = rD + (1-r)C. Dragging P changes t = dist(B,P)/dist(A,B); dragging A or B
 * carries P along at the same t. R and S come from the applet's own
 * GeoSDoub.Intersect(A,Q,D,P) and Intersect(B,Q,C,P).
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, CarpetsInQuadriCore, so the page loads it with
 * a plain <script> and porting/check-carpets-in-quadri.mjs loads it in Node.
 * Positions are plain data in the SVG viewBox units.
 */
const CarpetsInQuadriCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 16;
  const MIN_RATIO = 0;
  const MAX_RATIO = 1;
  const START_RATIO = 0.7;

  const point = (x, y) => ({ x, y });
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Keep a corner inside the board, with room for its handle and label. */
  function clampPoint(p) {
    return point(
      clamp(p.x, VIEW.x + PAD, VIEW.x + VIEW.width - PAD),
      clamp(p.y, VIEW.y + PAD, VIEW.y + VIEW.height - PAD),
    );
  }

  /** The applet's Init() on a 400x300 canvas: W/5=80, H/5=60. */
  function start(options) {
    const o = options || {};
    return {
      A: point(80, 180), B: point(320, 240), C: point(320, 60), D: point(160, 60),
      t: o.t === undefined ? START_RATIO : clamp(Number(o.t) || 0, MIN_RATIO, MAX_RATIO),
      options: {
        names: o.names === undefined ? true : !!o.names,
        hint: o.hint === undefined ? false : !!o.hint,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.t = state.t;
    s.explored = state.explored;
    return s;
  }

  /** Project a point onto the segment AB, as CTKMoveableDoub.RestrictToLine does. */
  function projectOnSegment(p, a, b) {
    const ab = sub(b, a);
    const len2 = dot(ab, ab);
    if (len2 === 0) return point(a.x, a.y);
    const k = clamp(dot(sub(p, a), ab) / len2, 0, 1);
    return point(a.x + ab.x * k, a.y + ab.y * k);
  }

  function move(state, name, p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    if (name === "A" || name === "B" || name === "C" || name === "D") {
      return Object.assign({}, state, { [name]: clampPoint(point(p.x, p.y)), explored: true });
    }
    if (name === "P") {
      const on = projectOnSegment(p, state.A, state.B);
      // UpgradePoints(): t = dist(B, P) / dist(A, B) when P itself is dragged.
      const ab = dist(state.A, state.B);
      const t = ab === 0 ? state.t : clamp(dist(state.B, on) / ab, MIN_RATIO, MAX_RATIO);
      return Object.assign({}, state, { t, explored: true });
    }
    return state;
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /*
   * GeoSDoub.Intersect(a,b,c,d), straight from the bytecode: four line
   * coefficients, then x = (l6*l14 - l12*l8)/den, y = (l8*l10 - l14*l4)/den.
   * The applet returns NaN for |den| < 1 and then sets NoDraw; null means that
   * here. The cutoff is deliberately 1 (not an epsilon) — it is the applet's.
   */
  function intersect(a, b, c, d) {
    if (!finite(a) || !finite(b) || !finite(c) || !finite(d)) return null;
    const l4 = a.y - b.y, l6 = b.x - a.x, l8 = a.x * b.y - a.y * b.x;
    const l10 = c.y - d.y, l12 = d.x - c.x, l14 = c.x * d.y - c.y * d.x;
    const den = l4 * l12 - l10 * l6;
    if (!Number.isFinite(den) || Math.abs(den) < 1) return null;
    return point((l6 * l14 - l12 * l8) / den, (l8 * l10 - l14 * l4) / den);
  }

  /* GeoSDoub.NearestPoint(p,a,b): the foot on line ab, with the applet's
   * shortcut of returning p itself when SqDist(a,p) < 0.1. Used only by Hint. */
  function nearestPoint(p, a, b) {
    if (!finite(p) || !finite(a) || !finite(b)) return null;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy === 0) return point(a.x, a.y);
    if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return point(p.x, p.y);
    const k = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return point(a.x + dx * k, a.y + dy * k);
  }

  /** Signed shoelace area; abs() gives the area whatever the drawing order. */
  function signedArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      s += p.x * q.y - q.x * p.y;
    }
    return s / 2;
  }
  const area = (pts) => Math.abs(signedArea(pts));

  /** Signed distance from p to the line through a and b (for the Hint heights). */
  function height(p, a, b) {
    const len = dist(a, b);
    if (len === 0) return 0;
    return ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
  }

  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  function isConvex(a, b, c, d) {
    const cs = [cross(a, b, c), cross(b, c, d), cross(c, d, a), cross(d, a, b)];
    return cs.every((v) => v > 1e-9) || cs.every((v) => v < -1e-9);
  }

  /**
   * All the points and measurements of the drawing from a position.
   * The four sides are always usable; R and S are null exactly when the
   * applet would set NoDraw and hide the carpets.
   */
  function compute(state) {
    const { A: a, B: b, C: c, D: d } = state;
    if (![a, b, c, d].every(finite)) return null;
    const t = clamp(state.t, MIN_RATIO, MAX_RATIO);
    const P = point(t * a.x + (1 - t) * b.x, t * a.y + (1 - t) * b.y);
    const Q = point(t * c.x + (1 - t) * d.x, t * c.y + (1 - t) * d.y);
    const R = intersect(a, Q, d, P);
    const S = intersect(b, Q, c, P);
    const noDraw = !R || !S;

    // Compute() still makes the six feet of the perpendiculars when it draws.
    const Ap = nearestPoint(a, c, d), Bp = nearestPoint(b, c, d);
    const Pp = nearestPoint(P, c, d), Cp = nearestPoint(c, a, b);
    const Dp = nearestPoint(d, a, b), Qp = nearestPoint(Q, a, b);

    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a));
    const tol = 1e-9 * scale * scale;
    const blue = noDraw ? 0 : area([P, S, Q, R]);
    const red = noDraw ? 0 : area([a, R, d]) + area([b, S, c]);
    const carpet = area([a, Q, b]);
    const halves = area([a, d, P]) + area([b, c, P]);
    const r = 1 - t; // the page's common ratio AP/AB = CQ/CD
    const hC = height(c, a, b), hD = height(d, a, b), hQ = height(Q, a, b);

    return {
      A: a, B: b, C: c, D: d, P: P, Q: Q, R: R, S: S,
      Ap: Ap, Bp: Bp, Pp: Pp, Cp: Cp, Dp: Dp, Qp: Qp,
      t: t, r: r, noDraw: noDraw,
      convex: isConvex(a, b, c, d),
      measures: {
        blue: blue, red: red, difference: Math.abs(blue - red),
        carpet: carpet, halves: halves,
        heightQ: hQ, heightTotal: r * hD + (1 - r) * hC,
      },
      claims: {
        blueEqualsRed: !noDraw && Math.abs(blue - red) <= tol,
        carpetEqualsHalves: Math.abs(carpet - halves) <= tol,
        heightsMatch: Math.abs(hQ - (r * hD + (1 - r) * hC)) <= 1e-9 * scale,
      },
      tol: tol,
    };
  }

  function geometry(state) {
    return compute(state);
  }

  /* An illustration has no win and no loss. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move the four corners so the picture makes a quadrilateral.";
    if (g.noDraw) return "The crossing lines do not meet clearly. Drag a corner a little to bring them back.";
    const m = g.measures;
    let text = `Blue carpet ${Math.round(m.blue)}; two red triangles together ${Math.round(m.red)}. ${g.claims.blueEqualsRed ? "They are equal." : "They are nearly equal in this drawing."}`;
    if (!g.convex) text += " Make ABCD a convex four-sided shape to see the match.";
    if (state.options && state.options.hint) text += " The Hint shows the heights on AB that prove the match.";
    return text;
  }

  return {
    VIEW: VIEW, PAD: PAD, MIN_RATIO: MIN_RATIO, MAX_RATIO: MAX_RATIO,
    START_RATIO: START_RATIO,
    point: point, sub: sub, dot: dot, dist: dist, clamp: clamp,
    clampPoint: clampPoint, projectOnSegment: projectOnSegment,
    intersect: intersect, nearestPoint: nearestPoint,
    signedArea: signedArea, area: area, height: height, isConvex: isConvex,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, result: result, describe: describe,
  };
})();
