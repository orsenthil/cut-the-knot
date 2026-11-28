"use strict";

/*
 * The Radical Axis of Circles Inscribed in a Circular Segment, from
 * Alexander Bogomolny's applet IncircleInSegment1.
 *
 * A horizontal chord AB of a circle C (centre O, radius r) holds two
 * draggable points P. For each P the applet builds the circle through O that
 * is tangent to the chord at P: project O on MP to N, reflect M in N to Q,
 * meet the line OQ with the vertical through P at W, and draw the circle
 * centred at W through P. Q is its tangency point with C, and M is the
 * midpoint of the arc on the far side of the chord.
 *
 * The page claims that if the two circles meet at U and V, then U, V and M
 * are collinear. The reason is MA*MB = MT^2 for *every* inscribed circle
 * (T is either end of the chord), so M has the same power with respect to
 * both circles and lies on their radical axis. This is stronger than the
 * sibling applet IncircleInSegment, whose claim is only that the chord
 * contact P, the circle contact Q and M are collinear for one circle.
 *
 * No document, no window, no storage: one global, plain data positions.
 */
const IncircleInSegment1Core = (() => {
  // The applet's suggested size is 600x450; the page normally shows 400x300.
  // A 360x300 board gives the same radius rule, min(width,height)/3.
  const VIEW = { width: 360, height: 300 };
  const CENTER = { x: VIEW.width / 2, y: VIEW.height / 2 };
  const RADIUS = Math.min(VIEW.width, VIEW.height) / 3;
  // init() picks (Math.random()+3)*PI/4; the page load uses a fixed picture.
  const DEFAULT_ANGLE = 5 * Math.PI / 4;
  // A dragged chord endpoint stays on the circle; keep it away from the very
  // top and bottom, where the chord collapses and the applet's construction
  // blows up. This is the one deliberate guard the Java canvas lacks.
  const MAX_SIN = 0.96;
  // GeoSDoub.Intersect returns a NaN point when |det| < 1.
  const DET_TOL = 1;
  // GeoSDoub.NearestPoint returns the point itself when SqDist(p,a) < 0.1.
  const FOOT_TOL = 0.1;
  const EPS = 1e-9;

  const pt = (x, y) => ({ x, y });
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const normalise = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  /** Keep the chord long enough to draw, with the same screen convention. */
  function clampAngle(a) {
    const t = normalise(a);
    const s = clamp(Math.sin(t), -MAX_SIN, MAX_SIN);
    if (Math.abs(s - Math.sin(t)) < EPS) return t;
    const c = (Math.cos(t) < 0 ? -1 : 1) * Math.sqrt(Math.max(0, 1 - s * s));
    return normalise(Math.atan2(s, c));
  }

  /** GeoSDoub.NearestPoint(O, M, P): project O on the line MP. */
  function foot(P, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy < FOOT_TOL) return pt(a.x, a.y);
    const t = ((P.x - a.x) * dx + (P.y - a.y) * dy) / (dx * dx + dy * dy);
    return pt(a.x + dx * t, a.y + dy * t);
  }

  /** GeoSDoub.Intersect of two lines; null when the determinant is too small. */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < DET_TOL) return null;
    return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** Standard circle intersection: 0, 1 or 2 points. */
  function circleIntersection(c1, r1, c2, r2) {
    if (![r1, r2].every(Number.isFinite) || r1 <= 0 || r2 <= 0) return [];
    const dx = c2.x - c1.x, dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h2 = r1 * r1 - a * a;
    if (h2 < 0) return [];
    const h = Math.sqrt(h2);
    const base = pt(c1.x + dx * a / d, c1.y + dy * a / d);
    if (h < EPS) return [base];
    return [pt(base.x - dy * h / d, base.y + dx * h / d),
      pt(base.x + dy * h / d, base.y - dx * h / d)];
  }

  function collinear(p, q, r, tolScale) {
    const scale = Math.max(1, tolScale || 1);
    return Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
      <= 1e-7 * scale * scale;
  }

  /** The four points the player can drag, plus the fixed M. */
  function handles(state) {
    if (!state || !state.center) return null;
    const O = state.center;
    const A = pt(O.x + state.radius * Math.cos(state.angle),
      O.y - state.radius * Math.sin(state.angle));
    const B = pt(2 * O.x - A.x, A.y);
    return {
      O: O, M: pt(O.x, O.y + state.radius),
      A: A, B: B, C: pt(state.c, A.y), D: pt(state.d, A.y),
    };
  }

  /**
   * A fresh picture. `random` follows the applet's own initial angle;
   * otherwise the fixed starting picture is used so tests are reproducible.
   */
  function start(options) {
    const o = options || {};
    const center = pt(CENTER.x, CENTER.y);
    const radius = o.radius === undefined ? RADIUS
      : clamp(Number(o.radius) || RADIUS, 20, 120);
    const rng = typeof o.rng === "function" ? o.rng : Math.random;
    const angle = o.angle === undefined
      ? (o.random ? (rng() + 3) * Math.PI / 4 : DEFAULT_ANGLE)
      : clampAngle(Number(o.angle));
    const blank = { center: center, radius: radius, angle: angle, c: 0, d: 0, hint: false };
    const h = handles(blank);
    blank.c = (h.A.x + 2 * h.B.x) / 3;
    blank.d = (3 * h.A.x + 2 * h.B.x) / 5;
    blank.explored = false;
    blank.hint = Boolean(o.hint);
    return blank;
  }

  /** Applet's AdjustPoint: keep a chord point between the chord's ends. */
  function adjust(p, A, B) {
    const lo = Math.min(A.x, B.x) + 2, hi = Math.max(A.x, B.x) - 2;
    return pt(clamp(p.x, lo < hi ? lo : (lo + hi) / 2, lo < hi ? hi : (lo + hi) / 2), A.y);
  }

  /** Apply a move; the old position is never changed. */
  function move(state, m) {
    if (!state || !m) return state;
    const h = handles(state);
    switch (m.type) {
      case "point": {
        if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return state;
        if (m.name === "A") {
          const angle = clampAngle(Math.atan2(-(m.y - h.O.y), m.x - h.O.x));
          const next = { ...state, angle: angle };
          const h2 = handles(next);
          return { ...next, c: adjust(h.C, h2.A, h2.B).x, d: adjust(h.D, h2.A, h2.B).x, explored: true };
        }
        if (m.name === "C" || m.name === "D") {
          const p = adjust(pt(m.x, m.y), h.A, h.B);
          return { ...state, [m.name === "C" ? "c" : "d"]: p.x, explored: true };
        }
        return state;
      }
      case "nudge": {
        const from = m.name === "A" ? h.A : m.name === "C" ? h.C : h.D;
        if (!from) return state;
        return move(state, { type: "point", name: m.name,
          x: from.x + (Number(m.dx) || 0), y: from.y + (Number(m.dy) || 0) });
      }
      case "hint":
        return { ...state, hint: m.value === undefined ? !state.hint : Boolean(m.value) };
      case "reset":
        return start({ hint: state.hint });
      case "new":
        return { ...start({ random: true, rng: m.rng, hint: state.hint }), explored: true };
      default:
        return state;
    }
  }

  /** Drag handles, the Hint box and the two modern buttons. */
  function legalMoves(state) {
    return [
      { type: "nudge", name: "A", dx: 2, dy: 0 },
      { type: "nudge", name: "A", dx: -2, dy: 0 },
      { type: "nudge", name: "C", dx: 2, dy: 0 },
      { type: "nudge", name: "C", dx: -2, dy: 0 },
      { type: "nudge", name: "D", dx: 2, dy: 0 },
      { type: "nudge", name: "D", dx: -2, dy: 0 },
      { type: "hint" }, { type: "reset" }, { type: "new" },
    ];
  }

  /** An illustration: there is no win, loss or finish to report. */
  function result(state) {
    return null;
  }

  /**
   * DrawCircleAndLine from the applet, straight from the bytecode:
   * N = NearestPoint(O, M, P), Q = 2N - M, R = P - 100j,
   * W = Intersect(O, Q, P, R), circle(W, |W-P|).
   */
  function inscribedCircle(O, M, P) {
    const N = foot(O, M, P);
    const Q = pt(2 * N.x - M.x, 2 * N.y - M.y);
    const R = pt(P.x, P.y - 100);
    const W = intersect(O, Q, P, R);
    if (!W) return null;
    const radius = distance(W, P);
    return {
      P: pt(P.x, P.y), N: N, Q: Q, R: R, center: W, radius: radius,
      power: distance(M, W) ** 2 - radius ** 2,
      product: distance(M, P) * distance(M, Q),
      singleClaim: collinear(M, P, Q, 300),
    };
  }

  /** The whole picture, or null when the chord has collapsed. */
  function geometry(state) {
    const h = handles(state);
    if (!h) return null;
    const { O, M, A, B, C, D } = h;
    const circles = [inscribedCircle(O, M, C), inscribedCircle(O, M, D)];
    const degenerate = circles.some((c) => !c || !Number.isFinite(c.radius));
    const chordHalf = Math.abs(A.x - O.x);
    const chordHeight = M.y - A.y;
    const base = {
      O: O, M: M, A: A, B: B, C: C, D: D, circles: circles,
      chordHalf: chordHalf, chordHeight: chordHeight,
      mt: distance(M, A), degenerate: degenerate,
    };
    if (degenerate) {
      return { ...base, intersections: [], radicalLine: null,
        powersEqual: false, collinear: false, identity: false, claim: false };
    }

    // Draw(): only try the two intersections when the centres are >1 apart.
    let intersections = [];
    let radicalLine = null;
    if (distance(circles[0].center, circles[1].center) > 1) {
      intersections = circleIntersection(circles[0].center, circles[0].radius,
        circles[1].center, circles[1].radius);
      if (intersections.length === 2) radicalLine = { p: intersections[0], q: intersections[1] };
    }
    if (!radicalLine) {
      // The applet's fallback: M to the projection of M on the centre line.
      const c0 = circles[0].center, c1 = circles[1].center;
      const dx = c1.x - c0.x, dy = c1.y - c0.y;
      const sq = dx * dx + dy * dy;
      const t = sq < FOOT_TOL ? 0 : ((M.x - c0.x) * dx + (M.y - c0.y) * dy) / sq;
      radicalLine = { p: M, q: pt(c0.x + dx * t, c0.y + dy * t) };
    }

    const scale = Math.max(300, distance(M, A) * 2, ...circles.map((c) => c.radius * 2));
    const tol = 1e-7 * scale * scale;
    const powersEqual = Math.abs(circles[0].power - circles[1].power) <= tol;
    const identity = circles.every((c) => Math.abs(c.product - base.mt * base.mt) <= tol);
    const collinearity = intersections.length === 2 && collinear(M, intersections[0], intersections[1], scale);
    return {
      ...base, intersections: intersections, radicalLine: radicalLine,
      powersEqual: powersEqual, identity: identity,
      collinear: collinearity,
      claim: powersEqual && identity && (intersections.length !== 2 || collinearity),
    };
  }

  /** Plain, board-unit position for the player's record and the tutor. */
  function position(state) {
    const g = geometry(state);
    return {
      angle: state.angle, c: state.c, d: state.d, hint: state.hint,
      explored: state.explored,
      chord: g ? { A: g.A, B: g.B } : null,
      centers: g && !g.degenerate ? g.circles.map((x) => x.center) : null,
      M: g ? g.M : null,
    };
  }

  /** A sentence in words a player can act on; no jargon in #rules, some here. */
  function describe(state) {
    const g = geometry(state);
    if (!g || g.degenerate) {
      return "The chord is too short to hold two circles here. Drag point A away from the top or bottom of the circle.";
    }
    const ps = g.circles.map((c) => c.power.toFixed(1)).join(" and ");
    if (g.intersections.length === 2) {
      return `The circles meet at U and V, and the line through them passes through M. Their powers at M are ${ps} — the same number.`
        + (state.hint ? " The hint shows the tangent lines and the circle through M." : "");
    }
    return `The circles do not meet in two points here. Their powers at M are still ${ps}. Drag C or D to make them cross.`
      + (state.hint ? " The hint shows the tangents and the circle through M." : "");
  }

  return {
    VIEW, CENTER, RADIUS, DEFAULT_ANGLE, MAX_SIN, DET_TOL, FOOT_TOL,
    pt, distance, clamp, normalise, clampAngle, foot, intersect,
    circleIntersection, collinear, handles, start, adjust, move,
    legalMoves, result, inscribedCircle, geometry, position, describe,
  };
})();
