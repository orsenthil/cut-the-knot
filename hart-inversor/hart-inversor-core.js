"use strict";

/*
 * Hart's Inversor — the four-bar linkage in Alexander Bogomolny's applet
 * HartInversor (cut-the-knot.org/Curriculum/Geometry/HartInversor.shtml).
 *
 * The rods AB, BC, CD, AD form an isosceles trapezoid with AB = CD = a,
 * BC = AD = b. O, P, Q divide AB, AD, CB in the same fraction m, so they are
 * collinear and OP = m*BD while OQ = (1-m)*AC. Since AC*BD = b^2 - a^2,
 * OP*OQ = m(1-m)(b^2-a^2), a constant: P and Q are inverse points about O.
 * A pivot S with SP = SO makes P run on a circle through O, so Q runs on the
 * inverse of that circle, a straight line. The Java code computes each new
 * position by circle intersections and by projecting a dragged point onto its
 * guiding circle or line; this file is that geometry and nothing else.
 *
 * No document, no window, no storage. It defines one global, HartInversorCore,
 * so the page loads it as a plain script and porting/check-hart-inversor.mjs
 * can load it in Node. Positions are plain data (points, numbers and arrays),
 * so the player's record and the tutor can be given them as they are.
 */

const HartInversorCore = (() => {
  // The applet's own numbers: WIDTH/HEIGHT ("400 will do", "300 will do"),
  // a = min(width,height)/4, b = 2a, c = a/2, m = 0.4 and the 20-degree opening
  // angle at A. PIsEligible and SIsEligible use the applet's 5 and 20 margins.
  const WIDTH = 400;
  const HEIGHT = 300;
  const OPEN_ANGLE = 0.3490658503988659;
  const R0 = 0.4;
  const P_MARGIN = 5;
  const S_MARGIN = 20;
  const R_MIN = 0.05;   // the page states 0 < m < 1; keep the picture inside it
  const R_MAX = 0.95;
  const BOARD_MARGIN = 4;

  /* ------------------------------------------------------- tiny vector kit */

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const copy = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub-style orientation: +1 left of a->b, -1 right of it. */
  function orient(a, b, c) {
    const z = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return z > 0 ? 1 : -1;
  }

  /** ScaleTo(p, q, t) = p + t(q-p), the applet's whole scaling primitive. */
  const scale = (p, q, t) => add(p, mul(sub(q, p), t));

  /** GeoSDoub.NearestPoint: the foot of the perpendicular from p to line(a,b). */
  function foot(p, a, b) {
    const d = sub(b, a), len2 = dot(d, d);
    if (len2 < 1e-12) return copy(a);
    return add(a, mul(d, dot(sub(p, a), d) / len2));
  }

  /** Distance of p from the infinite line a->b (zero if it lies on it). */
  const lineDeviation = (p, a, b) => Math.abs(cross(sub(p, a), sub(b, a))) /
    (dist(a, b) || 1);

  /** GeoSDoub.Intersect(circle, line) for the horizontal line through `through`.
   *  ComputeUpperPoint(A, B, b) takes the intersection to the right of A. */
  function upperPoint(center, radius, through) {
    const dy = through.y - center.y;
    const dx2 = radius * radius - dy * dy;
    if (!(dx2 >= 0)) return null;
    const dx = Math.sqrt(dx2);
    const right = { x: center.x + dx, y: through.y };
    const left = { x: center.x - dx, y: through.y };
    // GeoSDoub.IntersectY returns [right, left]; the bytecode keeps [0] when
    // its x exceeds the circle centre's x, otherwise [1].
    return right.x > center.x ? right : left;
  }

  /** The two intersection points of two circles (0, 1 or 2), null if none. */
  function circleIntersection(c1, r1, c2, r2) {
    const d = dist(c1, c2);
    if (!(d > 0) || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return null;
    const u = mul(sub(c2, c1), 1 / d);
    const a1 = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h2 = r1 * r1 - a1 * a1;
    if (h2 < -1e-9) return null;
    const h = Math.sqrt(Math.max(0, h2));
    const base = add(c1, mul(u, a1));
    return [add(base, { x: -h * u.y, y: h * u.x }),
      add(base, { x: h * u.y, y: -h * u.x })];
  }

  /** ComputeC(): E is the foot from A to BD, F = D+B-E, and C is the foot of F
   *  on the line through A parallel to EF (GetParallelTo scales by 100). */
  function computeC(A, B, D) {
    const E = foot(A, B, D);
    const F = { x: D.x + B.x - E.x, y: D.y + B.y - E.y };
    const parallel = add(A, mul(sub(E, F), 100));
    const C = foot(F, A, parallel);
    return { C, E, F };
  }

  /** ComputeABD(): intersect circle(O, a*m) with circle(P, b*m) and choose the
   *  solution on the same side of OP as the old B, as the applet's
   *  FindOrientation comparison does. Then B = A+(O-A)/m, D = A+(P-A)/m. */
  function computeABD(O, P, a, b, m, B) {
    const points = circleIntersection(O, a * m, P, b * m);
    if (!points) return null;
    const side = orient(O, P, B);
    const A = points.find((p) => orient(O, P, p) === side) || points[0];
    return { A, B: scale(A, O, 1 / m), D: scale(A, P, 1 / m) };
  }

  /** GetS(): one of the two centres on the perpendicular bisector of OP whose
   *  distance from O (and from P) is c. The sign follows O.x > P.x. */
  function getS(O, P, c) {
    const mid = scale(O, P, 0.5);
    const d = dist(O, P);
    if (!(d > 0)) return { x: NaN, y: NaN };
    let h = Math.sqrt(c * c - d * d / 4) / d;
    if (O.x > P.x) h = -h;
    return { x: mid.x + h * (O.y - P.y), y: mid.y - h * (O.x - P.x) };
  }

  /** ComputeS(): the applet retries once with c increased by 20 when GetS is
   *  undefined or sits at the board origin. */
  function computeS(O, P, c) {
    let guess = getS(O, P, c);
    if (!finite(guess) || dist(guess, { x: 0, y: 0 }) < 2) {
      c += 20;
      guess = getS(O, P, c);
    }
    return { S: finite(guess) ? guess : copy(O), c };
  }

  /** ComputeSS(): the line through the midpoint of OP perpendicular to OP.
   *  That is the only line S is allowed to slide along. */
  function sLine(O, P) {
    const mid = scale(O, P, 0.5);
    const sign = O.x > P.x ? -10 : 10;
    const end = {
      x: mid.x + sign * (O.y - P.y),
      y: mid.y - sign * (O.x - P.x),
    };
    return { a: mid, b: end };
  }

  /** CTKMoveableDoub.UpdateLocation for a point restricted to a circle/line. */
  const projectToCircle = (p, c, r) => {
    const d = dist(p, c);
    if (!(d > 0)) return { x: c.x + r, y: c.y };
    return add(c, mul(sub(p, c), r / d));
  };
  const projectToLine = (p, a, b) => foot(p, a, b);

  function clampPoint(p, width, height) {
    return {
      x: clamp(p.x, BOARD_MARGIN, width - BOARD_MARGIN),
      y: clamp(p.y, BOARD_MARGIN, height - BOARD_MARGIN),
    };
  }

  /** Build a state from A, B, D, m and c using the applet's ComputeC/PQ/S. */
  function configure(options) {
    const o = options || {};
    const width = Number.isFinite(o.width) ? o.width : WIDTH;
    const height = Number.isFinite(o.height) ? o.height : HEIGHT;
    const A = copy(o.A || { x: Math.trunc(width / 6), y: Math.trunc(2 * height / 3) });
    let B;
    if (o.B) B = copy(o.B);
    else {
      const a = Math.min(width, height) / 4;
      B = { x: A.x + a * Math.sin(OPEN_ANGLE), y: A.y - a * Math.cos(OPEN_ANGLE) };
    }
    let D;
    if (o.D) D = copy(o.D);
    else D = upperPoint(A, 2 * dist(A, B), B) || { x: A.x + 2 * dist(A, B), y: B.y };
    const a = dist(A, B), b = dist(A, D);
    const m = clamp(Number.isFinite(o.r) ? o.r : R0, R_MIN, R_MAX);
    const c0 = Number.isFinite(o.c) && o.c > 0 ? o.c : a / 2;
    const { C, E, F } = computeC(A, B, D);
    const O = scale(A, B, m), P = scale(A, D, m), Q = scale(C, B, m);
    const fixed = computeS(O, P, c0);
    return {
      width, height, a, b, c: fixed.c, r: m,
      A, B, D, C, E, F, O, P, Q, S: fixed.S,
      showNames: !!o.showNames, showExtra: !!o.showExtra,
      traceQ: [], traceP: [], collectPhase: 0,
      eligible: true, message: "", moves: 0, explored: false,
    };
  }

  /** The opening picture, straight from HartInversorCanvas.init(). */
  function start(options) { return configure(options || {}); }

  /** Nothing can be won; a demo counts as explored after its first change. */
  const result = (state) => (state && state.explored ? "done" : null);

  function legalMoves(state) {
    if (!state) return [];
    return [
      { type: "translate" },
      ...["A", "B", "D", "O", "P", "S"].map((which) => ({ type: "point", which })),
      { type: "option", key: "showNames" }, { type: "option", key: "showExtra" },
      { type: "clearTrace" }, { type: "reset" },
    ];
  }

  const P_IS_ELIGIBLE = (s) => dist(s.B, s.D) < s.a + s.b - P_MARGIN;
  const S_IS_ELIGIBLE = (s, S) => dist(s.O, s.P) <
    dist(S, s.P) + dist(s.O, S) - S_MARGIN;

  /** Collect(): like the applet's Mod=2 counter, keep every other P drag. */
  function collect(s, Q, P) {
    const traceQ = s.traceQ.slice(), traceP = s.traceP.slice();
    if (s.collectPhase === 0) {
      traceQ.push(copy(Q));
      traceP.push({ ...copy(P), color: "accent" });
    }
    return { traceQ, traceP, collectPhase: 1 };
  }

  function finish(s, patch, message, ok = true) {
    if (!ok) return { ...s, ...patch, eligible: false, message };
    return {
      ...s, ...patch,
      message: message || "",
      moves: s.moves + 1,
      explored: true,
    };
  }

  /** Apply one drag/option. Returns a new state, or null for an invalid move. */
  function move(state, m) {
    if (!state || !m) return null;
    const s = state;

    if (m.type === "option") {
      if (m.key !== "showNames" && m.key !== "showExtra") return null;
      if (typeof m.value !== "boolean") return null;
      return finish(s, { [m.key]: m.value }, m.key === "showNames"
        ? (m.value ? "Showing the point names." : "Hidden the point names.")
        : (m.value ? "Showing the helper lines and feet E and F." : "Hidden the helper lines."));
    }
    if (m.type === "clearTrace") {
      return finish(s, { traceQ: [], traceP: [], collectPhase: 0 }, "Cleared the traced arc and line.");
    }
    if (m.type === "reset") {
      const fresh = start({ width: s.width, height: s.height, showNames: s.showNames, showExtra: s.showExtra });
      return { ...fresh, explored: true, moves: s.moves + 1, message: "Back to the opening linkage." };
    }

    if (m.type === "translate") {
      if (!finite(m.delta)) return null;
      const d = m.delta;
      const shift = (p) => add(p, d);
      const A = shift(s.A), B = shift(s.B), D = shift(s.D);
      const O = shift(s.O), P = shift(s.P), S = shift(s.S);
      const { C, E, F } = computeC(A, B, D);
      const Q = scale(C, B, s.r);
      return finish(s, { A, B, D, O, P, S, C, E, F, Q, eligible: true },
        `Moved the whole linkage by (${Math.round(d.x)}, ${Math.round(d.y)}). Q follows at (${Math.round(Q.x)}, ${Math.round(Q.y)}).`);
    }

    if (m.type !== "point") return null;
    const idx = ["A", "B", "D", "O", "P", "S"].indexOf(m.which);
    if (idx < 0 || !finite(m.point)) return null;
    const target = clampPoint(m.point, s.width, s.height);

    if (m.which === "A") {
      // Dragging A: the Mover's defect offsets translate every other handle,
      // then ComputeC and ComputeQ redraw C and Q.
      const delta = sub(target, s.A);
      return move(s, { type: "translate", delta });
    }

    if (m.which === "B") {
      const a = dist(s.A, target);
      if (a < 1) return null;
      const B = target;
      const O = scale(s.A, B, s.r);
      const { C, E, F } = computeC(s.A, B, s.D);
      const P = scale(s.A, s.D, s.r);
      const Q = scale(C, B, s.r);
      const fixed = computeS(O, P, s.c);
      return finish(s, { a, B, O, C, E, F, P, Q, S: fixed.S, c: fixed.c, eligible: true },
        `B moved; the short rod is now ${Math.round(a)} units and Q is at (${Math.round(Q.x)}, ${Math.round(Q.y)}).`);
    }

    if (m.which === "D") {
      const b = dist(s.A, target);
      if (b < 1) return null;
      const D = target;
      const { C, E, F } = computeC(s.A, s.B, D);
      const O = scale(s.A, s.B, s.r);
      const P = scale(s.A, D, s.r);
      const Q = scale(C, s.B, s.r);
      const fixed = computeS(O, P, s.c);
      return finish(s, { b, D, C, E, F, O, P, Q, S: fixed.S, c: fixed.c, eligible: true },
        `D moved; the long rod is now ${Math.round(b)} units and Q is at (${Math.round(Q.x)}, ${Math.round(Q.y)}).`);
    }

    if (m.which === "O") {
      // O is restricted to line AB; r = AO/a. Keep it inside the page's 0<m<1.
      const onLine = projectToLine(target, s.A, s.B);
      let r = dist(s.A, onLine) / (s.a || 1);
      r = clamp(r, R_MIN, R_MAX);
      const O = scale(s.A, s.B, r);
      const P = scale(s.A, s.D, r);
      const Q = scale(s.C, s.B, r);
      const fixed = computeS(O, P, s.c);
      return finish(s, { r, O, P, Q, S: fixed.S, c: fixed.c, eligible: true },
        `O moved along AB; m is now ${r.toFixed(2)} and OP·OQ is still ${Math.round(residuals({ ...s, r, O, P, Q }).power)}.`);
    }

    if (m.which === "P") {
      // P is projected onto the circle with centre S and radius c. The rods
      // can only close while BD < a+b-5; outside that arc the applet stops
      // recomputing the linkage and stops tracing Q.
      const P = projectToCircle(target, s.S, s.c);
      const abd = computeABD(s.O, P, s.a, s.b, s.r, s.B);
      if (!abd) return finish(s, { P, eligible: false },
        "The rods cannot reach that point. Move P back onto the drawn arc.", false);
      if (dist(abd.B, abd.D) >= s.a + s.b - P_MARGIN) {
        return finish(s, { P, eligible: false },
          "The rods cannot stretch that far. Tracing stopped; move P back into the arc.", false);
      }
      const { C, E, F } = computeC(abd.A, abd.B, abd.D);
      const Q = scale(C, abd.B, s.r);
      const tr = s.collectPhase === 0 ? collect(s, Q, P) :
        { traceQ: s.traceQ, traceP: s.traceP, collectPhase: (s.collectPhase + 1) % 2 };
      return finish(s, {
        A: abd.A, B: abd.B, D: abd.D, C, E, F, P, Q, eligible: true,
        traceQ: tr.traceQ, traceP: tr.traceP, collectPhase: tr.collectPhase,
      }, `P is on its circle at (${Math.round(P.x)}, ${Math.round(P.y)}); Q stays on the straight line at (${Math.round(Q.x)}, ${Math.round(Q.y)}).`);
    }

    // S: slide along the perpendicular bisector of OP, then take c = SP when
    // that keeps the pivot outside the triangle; otherwise put S back.
    if (m.which === "S") {
      const line = sLine(s.O, s.P);
      const S = projectToLine(target, line.a, line.b);
      if (S_IS_ELIGIBLE(s, S)) {
        const c = dist(S, s.P);
        return finish(s, { S, c, eligible: true },
          `S moved; its circle now has radius ${Math.round(c)} and still passes through O.`);
      }
      const fixed = computeS(s.O, s.P, s.c);
      return finish(s, { S: fixed.S, c: fixed.c, eligible: false },
        "S cannot pivot there: the rods would fold past each other. Try nearer the midpoint.", false);
    }
    return null;
  }

  /** Everything needed for drawing and for the page's status line. Pure. */
  function compute(state) {
    const s = state;
    const power = s.r * (1 - s.r) * (s.b * s.b - s.a * s.a);
    const OP = dist(s.O, s.P), OQ = dist(s.O, s.Q);
    const line = sLine(s.O, s.P);
    const unitOS = mul(sub(s.S, s.O), 1 / (dist(s.S, s.O) || 1));
    const inversePoint = add(s.O, mul(unitOS, power / (2 * s.c)));
    return {
      A: copy(s.A), B: copy(s.B), C: copy(s.C), D: copy(s.D),
      O: copy(s.O), P: copy(s.P), Q: copy(s.Q), S: copy(s.S),
      E: copy(s.E), F: copy(s.F),
      a: s.a, b: s.b, c: s.c, r: s.r,
      ac: dist(s.A, s.C), bd: dist(s.B, s.D),
      op: OP, oq: OQ,
      sp: dist(s.S, s.P), so: dist(s.S, s.O),
      power,
      sLine: line,
      inverseLine: { a: inversePoint, b: add(inversePoint, { x: -unitOS.y, y: unitOS.x }) },
      traceQ: s.traceQ.map(copy), traceP: s.traceP.map(copy),
      eligible: s.eligible,
    };
  }

  /** Measured residuals of every claim on the original page. */
  function residuals(state) {
    const s = state;
    const g = compute(s);
    const sameRay = cross(sub(g.P, g.O), sub(g.Q, g.O));
    return {
      aoRatio: dist(g.A, g.O) / g.a,
      apRatio: dist(g.A, g.P) / g.b,
      cqRatio: dist(g.C, g.Q) / g.b,
      collinearity: lineDeviation(g.Q, g.O, g.P),
      acTimesBd: g.ac * g.bd,
      bSqMinusASq: g.b * g.b - g.a * g.a,
      product: g.op * g.oq,
      power: g.power,
      sp: g.sp, so: g.so,
      sameRay: Math.abs(sameRay),
      inverseLineDeviation: lineDeviation(g.Q, g.inverseLine.a, g.inverseLine.b),
      bd: g.bd, eligible: g.eligible,
    };
  }

  return {
    WIDTH, HEIGHT, R0, R_MIN, R_MAX, OPEN_ANGLE, P_MARGIN, S_MARGIN,
    add, sub, mul, dot, cross, dist, copy, finite, clamp, clampPoint,
    orient, scale, foot, lineDeviation, upperPoint, circleIntersection,
    computeC, computeABD, getS, computeS, sLine,
    projectToCircle, projectToLine, pEligible: P_IS_ELIGIBLE, sEligible: S_IS_ELIGIBLE,
    configure, start, move, result, legalMoves, compute, residuals,
  };
})();
