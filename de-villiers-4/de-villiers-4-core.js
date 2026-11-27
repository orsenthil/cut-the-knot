"use strict";

/*
 * de Villiers 4 — Alexander Bogomolny's applet deVilliers4 (cut-the-knot).
 *
 * Four corners A,B,C,D form a quadrilateral.  Three triangles are built on
 * AC, DC and DB: ACP, DCQ and DBR.  They stay similar because all three apexes
 * come from the same turn-and-scale rule.  S is where the extended lines AD
 * and BC meet.  The page's claim is that, when the apex angle equals the
 * angle ASB, P, Q, R and S lie on one line.
 *
 * The key idea in the code is the applet's own rule: one complex multiplier
 * z = coef * exp(i * turn) carries each base segment to its apex.  Dragging an
 * apex fixes z for that triangle (AdjustParams), and every other apex is
 * rebuilt with the same z (AdjustApexes).  Moving a corner rebuilds all three
 * with the z already in force.  S, E, F and the "ShowLine" test are the
 * applet's Compute(): intersection by line coefficients, E = C + A - D and
 * the distance from Q to the line PR compared with 0.5.
 *
 * No document, no window, no storage: one global, plain data positions.  The
 * page loads this with a plain <script>; porting/check-de-villiers-4.mjs
 * evaluates it in Node and tests it against a second transcription.
 */
const DeVilliers4Core = (() => {
  /* The board the SVG uses.  The applet's canvas was 400x300; the viewBox has
   * room for apexes that fall outside that canvas. */
  const VIEW = { x: -40, y: -10, width: 500, height: 500 };
  const PAD = 12;

  /* deVilliers4Canvas.init(): centre = (W*6/11, H*2/3), radius = min(W,H)/3,
   * with corner angles 120, 30, 300 and 170 degrees, and Alpha = Coef = 1. */
  const W = 400, H = 300;
  const CX = W * 6 / 11, CY = H * 2 / 3;
  const RAD = Math.min(W, H) / 3;
  const START_ANGLES = [2 * Math.PI / 3, Math.PI / 6, 5 * Math.PI / 3, 2.9670597283903604];
  const INITIAL_ALPHA = 1.0471975511965976; // 60 degrees
  const INITIAL_COEF = 1;

  const point = (x, y) => ({ x, y });
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => {
    const dx = p.x - q.x, dy = p.y - q.y;
    return dx * dx + dy * dy;
  };

  /** GeoSDoub.ComputeAngle(p,q,r): the angle at p, from the cosine law. */
  function computeAngle(p, q, r) {
    const a = dist(p, q), b = dist(p, r), c = dist(q, r);
    if (!(a * b)) return NaN;
    const cos = (a * a + b * b - c * c) / (2 * a * b);
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /** GeoSDoub.FindOrientation(p,q,r): +1 if its determinant is > 0, else -1. */
  function findOrientation(p, q, r) {
    const d = (r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)
      + p.x * q.y - q.x * p.y;
    return d > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(p,q,angle,1) — turn q about p, keeping its length. */
  function rotate(p, q, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = q.x - p.x, dy = q.y - p.y;
    return point(p.x + c * dx - s * dy, p.y + s * dx + c * dy);
  }

  /** GeoSDoub.Intersect(a,b,c,d): line coefficients; NaN under its |det|<1 guard. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = b1 * a2 - a1 * b2;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((c1 * b2 - b1 * c2) / det, (a1 * c2 - c1 * a2) / det);
  }

  /** GeoSDoub.Dist(p, DoubLine(a,b)): distance to the infinite line. */
  function pointLineDistance(p, a, b) {
    if (sqDist(a, p) < 0.1) return 0;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return dist(p, a);
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return dist(p, point(a.x + t * dx, a.y + t * dy));
  }

  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /* AdjustOneApex: apex = base1 + coef * (Rotate(base1, base2, -alpha) - base1). */
  function place(base1, base2, alpha, coef) {
    const rotated = rotate(base1, base2, -alpha);
    return point(
      base1.x + coef * (rotated.x - base1.x),
      base1.y + coef * (rotated.y - base1.y),
    );
  }

  /* AdjustApexes(skip): the moved apex keeps its dragged position; the other
   * two use the new alpha and coef.  A null skip rebuilds all three. */
  function adjustApexes(state, skip) {
    const next = Object.assign({}, state);
    if (skip !== "R") next.R = place(state.D, state.B, state.alpha, state.coef);
    if (skip !== "Q") next.Q = place(state.D, state.C, state.alpha, state.coef);
    if (skip !== "P") next.P = place(state.A, state.C, state.alpha, state.coef);
    return next;
  }

  /* AdjustParams(apex, base1, base2, 1): match the dragged triangle's size and
   * signed turn.  Degenerate drags keep the last good turn and scale. */
  function adjustParams(apex, base1, base2) {
    const span = dist(base1, base2);
    if (!span || !finite(apex)) return null;
    const coef = dist(base1, apex) / span;
    const angle = computeAngle(base1, base2, apex);
    if (!Number.isFinite(angle)) return null;
    return {
      coef,
      alpha: -angle * findOrientation(base1, base2, apex),
    };
  }

  const BASES = {
    P: ["A", "C"], Q: ["D", "C"], R: ["D", "B"],
  };
  const CORNERS = ["A", "B", "C", "D"];
  const APEXES = ["P", "Q", "R"];
  const HANDLES = CORNERS.concat(APEXES);

  /** A fresh diagram, with the applet's initial turn of 60 degrees. */
  function start(options) {
    const o = options || {};
    const s = {
      alpha: INITIAL_ALPHA,
      coef: INITIAL_COEF,
      options: {
        names: o.names === undefined ? false : !!o.names,
        angles: o.angles === undefined ? false : !!o.angles,
        hint: o.hint === undefined ? false : !!o.hint,
      },
      explored: false,
    };
    for (let i = 0; i < 4; i++) {
      const angle = START_ANGLES[i];
      s[CORNERS[i]] = point(CX + RAD * Math.cos(angle), CY + RAD * Math.sin(angle));
    }
    return adjustApexes(s, null);
  }

  function reset(state) {
    const s = start({ names: state.options.names, angles: state.options.angles });
    s.explored = !!state.explored;
    return s;
  }

  /** Drag a corner (all three apexes follow) or an apex (only the other two
   * follow).  Positions are clamped into the drawing area. */
  function move(state, name, p) {
    if (HANDLES.indexOf(name) < 0 || !finite(p)) return state;
    const q = clamp(p);
    let next = Object.assign({}, state, { [name]: q, explored: true });
    if (name in BASES) {
      const base = BASES[name];
      const params = adjustParams(q, next[base[0]], next[base[1]]);
      if (params) {
        next.alpha = params.alpha;
        next.coef = params.coef;
      }
      return adjustApexes(next, name);
    }
    return adjustApexes(next, null);
  }

  /** The applet's three checkboxes.  Angles and hint cannot both be on; the
   * hint box is disabled unless the three apexes nearly line up. */
  function setOption(state, name, on) {
    if (["names", "angles", "hint"].indexOf(name) < 0) return state;
    const want = !!on;
    if (name === "hint" && want && !geometry(state).showLine) return state;
    const options = Object.assign({}, state.options, { [name]: want });
    if (want && name === "hint") options.angles = false;
    if (want && name === "angles") options.hint = false;
    return Object.assign({}, state, { options, explored: true });
  }

  /**
   * A modern helper, not a control in the applet: move all three apexes to
   * the configuration in the page's statement (apex angle = angle ASB, with
   * whichever of the two mirror choices puts S on line PR).  It is one
   * "position" change rather than a sequence of drags; see the maths section.
   */
  function align(state) {
    const s = geometry(state);
    if (!s || !Number.isFinite(s.theta)) return state;
    const theta = s.theta;
    const scaled = (base1, base2, turn, k) => {
      const q = rotate(base1, base2, turn);
      return point(base1.x + k * (q.x - base1.x), base1.y + k * (q.y - base1.y));
    };
    let best = null;
    /* For a given scale k, the apex angle at P obeys the cosine law.  Solving
     * it gives up to two turn sizes; either mirror may be the one away from
     * AB.  Try both and keep the one that really puts S on line PR. */
    for (const k of [1, 0.8, 0.6, 0.4, 0.25, 0.1, 1.25, 1.5, 2, 3]) {
      const disc = 1 - k * k * Math.sin(theta) * Math.sin(theta);
      if (disc < 0) continue;
      const root = Math.sqrt(disc);
      for (const v of [k * Math.cos(theta) + root, k * Math.cos(theta) - root]) {
        if (v <= 0) continue;
        const cosTurn = (1 + k * k - v * v) / (2 * k);
        if (cosTurn < -1 || cosTurn > 1) continue;
        const size = Math.acos(cosTurn);
        for (const turn of [size, -size]) {
          const p = scaled(state.A, state.C, turn, k);
          const q = scaled(state.D, state.C, turn, k);
          const r = scaled(state.D, state.B, turn, k);
          const gap = Math.abs(computeAngle(p, state.A, state.C) - theta);
          const score = pointLineDistance(q, p, r)
            + pointLineDistance(s.S, p, r) + 1000 * gap;
          if (!best || score < best.score) {
            best = { P: p, Q: q, R: r, score, turn, coef: k };
          }
        }
      }
    }
    if (!best) return state;
    return Object.assign({}, state, {
      P: best.P, Q: best.Q, R: best.R,
      // Preserve the displayed turn if a corner is dragged afterwards.
      alpha: -best.turn,
      coef: best.coef,
      explored: true,
    });
  }

  /** Compute(): S, E, F, and the applet's own near-collinearity test. */
  function geometry(state) {
    if (!state || !CORNERS.concat(APEXES).every((k) => finite(state[k]))) return null;
    const S = intersect(state.A, state.D, state.B, state.C);
    const E = point(
      state.C.x + state.A.x - state.D.x,
      state.C.y + state.A.y - state.D.y,
    );
    const F = intersect(state.C, E, state.A, state.B);
    const distQ = pointLineDistance(state.Q, state.P, state.R);
    const distS = pointLineDistance(S, state.P, state.R);
    // Both named angles have their vertex in the first argument: the angle
    // ASB is at S, and the apex angle APC is at P.
    const theta = finite(S) ? computeAngle(S, state.A, state.B) : NaN;
    const apexAngle = computeAngle(state.P, state.A, state.C);
    return {
      A: state.A, B: state.B, C: state.C, D: state.D,
      P: state.P, Q: state.Q, R: state.R,
      S, E, F,
      distQ, distS,
      showLine: distQ < 0.5,
      onLine: distQ < 0.5 && distS < 1e-6,
      theta, apexAngle,
      angleGap: Math.abs(theta - apexAngle),
      alpha: state.alpha, coef: state.coef,
      options: state.options,
    };
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Drag the points into a clear quadrilateral so the lines can meet.";
    if (g.showLine && g.onLine) {
      return "P, Q, R and S are on one line. The tip angle matches the angle at S.";
    }
    if (g.showLine) {
      return "P, Q and R line up, but S is off their line. Keep dragging until the angle at P matches the angle at S.";
    }
    return "The three tips are not in a line yet. Drag P, Q or R until its tip angle matches the angle where AD and BC meet at S.";
  }

  /* An illustration: there is no win, loss or ending. */
  function result(state) {
    return null;
  }

  return {
    VIEW, PAD, CX, CY, RAD, INITIAL_ALPHA, INITIAL_COEF,
    point, sub, dist, sqDist, computeAngle, findOrientation, rotate, intersect,
    pointLineDistance, finite, clamp, place, adjustApexes, adjustParams,
    BASES, CORNERS, APEXES, HANDLES,
    start, reset, move, setOption, align, geometry, describe, result,
  };
})();
