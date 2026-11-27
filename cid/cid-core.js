"use strict";

/*
 * CID — Consecutive Isosceles Decomposition, from Alexander Bogomolny's CID
 * Java applet (Roza Leikin's question: which isosceles triangles can be cut
 * into a chain of isosceles triangles with their bases on the sides).
 *
 * The original canvas draws one triangle ABC with apex A. Starting from the
 * two base points B, C it repeatedly draws a circle centred at the last point
 * with radius |BC| and meets the line through the point before it and A. Each
 * hit adds another point, until the chain reaches the apex. Every segment of
 * the chain has the length |BC|, so each slice is isosceles; their base angles
 * form an arithmetic sequence whose common difference is the apex angle.
 * The chain closes on A exactly when the apex angle is 180/(2n+1) degrees.
 *
 * The code follows the applet's own method: CIDCanvas.Reset places A, B, C
 * from the spinner denominator; CIDCanvas.Compute uses DoubCircle(radius BC),
 * DoubLine(previous point, A), GeoSDoub.Intersect and Other. The only extra
 * idea is that the three corners may be dragged; a drag keeps the isosceles
 * shape and the same apex angle, so the construction is unchanged.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CidCore, so the page loads it with a plain <script>
 * and porting/check-cid.mjs loads it in Node. Functions take plain data and
 * return new objects; nothing passed in is changed.
 */
const CidCore = (() => {
  const MIN_N = 2;          // the applet's JSpinner model: 9, 2, 178, 1
  const MAX_N = 178;
  const DEFAULT_N = 9;      // 180 / 9 = 20 degrees, the 80-80-20 triangle
  const WIDTH = 500;        // the applet's WIDTH and HEIGHT
  const HEIGHT = 450;
  const TOP_PAD = 10;       // CIDCanvas.Reset's two margins
  const SIDE_PAD = 30;
  const EPS = 1e-9;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const javaRound = (x) => Math.floor(x + 0.5);
  const toDeg = (r) => (r * 180) / Math.PI;

  /** The applet's spinner only ever holds integers in [2, 178]. */
  function clampN(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(MIN_N, Math.min(MAX_N, n)) : DEFAULT_N;
  }

  /** CIDCanvas.Reset, with TopAngle = 180 / n degrees. */
  function reset(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const n = clampN(o.n === undefined ? DEFAULT_N : o.n);
    const gamma = ((180 / n) * Math.PI) / 180;
    let top = TOP_PAD;
    let side = SIDE_PAD;
    let h = height - top - 2 * side;
    let half = h * Math.tan(gamma / 2);
    let base = 2 * half;
    if (base > width - 2 * side) {
      base = width - 2 * side;
      half = base / 2;
      h = half / Math.tan(gamma / 2);
      top = height - h - 2 * side;
    }
    const A = { x: Math.floor(width / 2), y: top + side };
    return {
      A: A,
      B: { x: A.x - half, y: A.y + h },
      C: { x: A.x + half, y: A.y + h },
    };
  }

  /** The position: the three corners plus the applet's two options. */
  function start(options) {
    const o = options || {};
    const n = clampN(o.n === undefined ? DEFAULT_N : o.n);
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const p = o.points;
    const corners =
      p && p.A && p.B && p.C
        ? {
            A: { x: p.A.x, y: p.A.y },
            B: { x: p.B.x, y: p.B.y },
            C: { x: p.C.x, y: p.C.y },
          }
        : reset({ n: n, width: width, height: height });
    return {
      n: n,
      width: width,
      height: height,
      showNames: Boolean(o.showNames),
      A: corners.A,
      B: corners.B,
      C: corners.C,
    };
  }

  /** The applet's TopAngle: exactly 180 / n degrees (CIDPanel.stateChanged). */
  function topAngle(state) {
    return 180 / state.n;
  }

  /** The angle actually drawn at A, measured from the saved corners. */
  function apexAngle(state) {
    const midX = (state.B.x + state.C.x) / 2;
    const baseY = (state.B.y + state.C.y) / 2;
    return toDeg(2 * Math.atan2(Math.abs(state.B.x - midX), Math.max(EPS, baseY - state.A.y)));
  }

  /** Math.round((180 / TopAngle) / 2) - 1, the Compute loop's trip count.
   *  TopAngle is the applet's 180/n double; 180/TopAngle can land just below
   *  an integer (n=169 does), so the division is kept in that order. */
  function iterations(state) {
    return Math.max(0, javaRound(180 / topAngle(state) / 2) - 1);
  }

  /*
   * GeoSDoub.Intersect(DoubCircle, DoubLine), straight from the bytecode.
   * The line is written x = m*y + c when |dy| > 1, otherwise y = m*x + c.
   */
  function intersectCircleLine(p, q, circle) {
    const dy = p.y - q.y;
    const dx = p.x - q.x;
    let m, c, bb, cc, k;
    if (Math.abs(dy) > 1) {
      m = dx / dy;
      c = q.x - m * q.y;
      k = c - circle.x;
      bb = m * k - circle.y;
      cc = circle.y * circle.y + k * k - circle.r * circle.r;
    } else if (Math.abs(dx) > 1) {
      m = dy / dx;
      c = q.y - m * q.x;
      k = c - circle.y;
      bb = m * k - circle.x;
      cc = circle.x * circle.x + k * k - circle.r * circle.r;
    } else {
      return null;
    }
    const aa = m * m + 1;
    const disc = bb * bb - aa * cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t0 = (-bb + root) / aa;
    const t1 = (-bb - root) / aa;
    return Math.abs(dy) > 1
      ? [{ x: m * t0 + c, y: t0 }, { x: m * t1 + c, y: t1 }]
      : [{ x: t0, y: m * t0 + c }, { x: t1, y: m * t1 + c }];
  }

  /** CIDCanvas.Other: keep the hit that is not the point we came from. */
  function other(hits, previous) {
    if (!hits || !hits.length) return null;
    if (hits.length < 2) return hits[0];
    return dist(hits[0], previous) < 1 ? hits[1] : hits[0];
  }

  /** CIDCanvas.Compute: the chain of points, starting with B then C. */
  function compute(state) {
    const points = [{ x: state.B.x, y: state.B.y }, { x: state.C.x, y: state.C.y }];
    const radius = dist(state.B, state.C);
    const count = iterations(state);
    for (let k = count; k >= 0; k--) {
      const size = points.length;
      const last = points[size - 1];
      const previous = points[size - 2];
      const hits = intersectCircleLine(previous, state.A, {
        x: last.x,
        y: last.y,
        r: radius,
      });
      const hit = other(hits, previous);
      if (!hit) break;
      if (hit.y <= state.A.y - 0.001) break;
      points.push({ x: hit.x, y: hit.y });
    }
    return points;
  }

  /** Angle at v between the rays to p and q, in degrees. */
  function angleAt(v, p, q) {
    const u = { x: p.x - v.x, y: p.y - v.y };
    const w = { x: q.x - v.x, y: q.y - v.y };
    const norm = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
    if (norm < EPS) return 0;
    return toDeg(Math.acos(Math.max(-1, Math.min(1, (u.x * w.x + u.y * w.y) / norm))));
  }

  /** The isosceles slices drawn between consecutive chain points. */
  function triangles(state) {
    const points = compute(state);
    const out = [];
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1], b = points[i], c = points[i + 1];
      out.push({
        points: [a, b, c],
        baseAngle: angleAt(a, b, c),   // at the first point of the step
        apexAngle: angleAt(b, a, c),   // at the corner the step turns around
        farAngle: angleAt(c, a, b),
      });
    }
    return out;
  }

  /**
   * Each claim made by the article, tested on the current diagram. `formula`
   * is only true for a complete chain, which happens for odd denominators.
   */
  function claims(state) {
    const points = compute(state);
    const tris = triangles(state);
    const gamma = topAngle(state);
    const radius = dist(state.B, state.C);
    const scale = Math.max(1, radius);
    const tol = 1e-6 * scale;
    const steps = [];
    for (let i = 1; i < points.length; i++) steps.push(dist(points[i - 1], points[i]));
    const bases = tris.map((t) => t.baseAngle);
    let arithmetic = bases.length > 0;
    for (let i = 1; i < bases.length; i++) {
      if (Math.abs(bases[i - 1] - bases[i] - gamma) > 1e-6) arithmetic = false;
    }
    return {
      equalSteps: steps.every((d) => Math.abs(d - radius) < tol),
      isosceles: tris.every(
        (t) => Math.abs(t.baseAngle - t.farAngle) < 1e-6 && Math.abs(t.baseAngle + t.farAngle + t.apexAngle - 180) < 1e-6,
      ),
      arithmetic: arithmetic,
      complete: points.length >= 2 && dist(points[points.length - 1], state.A) < tol,
      formula: Math.abs(gamma - 180 / (2 * tris.length + 1)) < 1e-6,
      twentyDegrees: Math.abs(gamma - 20) < 1e-9 && tris.length === 4,
      thirtySixDegrees: Math.abs(gamma - 36) < 1e-9 && tris.length === 2,
      sixtyDegrees: Math.abs(gamma - 60) < 1e-9 && tris.length === 1,
    };
  }

  /**
   * Move one corner. The three corners stay isosceles with the current apex
   * angle: a drag changes the size of the picture, not the decomposition.
   */
  function withPoint(state, name, p) {
    const next = {
      n: state.n, width: state.width, height: state.height,
      showNames: state.showNames,
      A: { x: state.A.x, y: state.A.y },
      B: { x: state.B.x, y: state.B.y },
      C: { x: state.C.x, y: state.C.y },
    };
    const midX = (next.B.x + next.C.x) / 2;
    const baseY = (next.B.y + next.C.y) / 2;
    const tan = Math.tan(((180 / next.n) * Math.PI) / 360);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const room = (mid) => Math.max(2, Math.min(mid - 8, next.width - mid - 8));

    if (name === "A") {
      // A follows the pointer; the two base corners stay on their line and
      // move apart or together so that the apex angle stays 180/n.
      const mid = clamp(p.x, 8, next.width - 8);
      const ay = clamp(p.y, 8, baseY - 12);
      const half = Math.min((baseY - ay) * tan, room(mid));
      next.A = { x: mid, y: baseY - half / tan };
      next.B = { x: mid - half, y: baseY };
      next.C = { x: mid + half, y: baseY };
    } else if (name === "B" || name === "C") {
      // A base corner follows the pointer; the apex moves along the axis to
      // keep the same isosceles angle.
      const by = clamp(p.y, next.A.y + 12, next.height - 8);
      const hi = Math.min(room(midX), (by - 8) * tan);
      const half = Math.max(Math.min(1, hi), Math.min(Math.abs(p.x - midX), hi));
      next.A = { x: midX, y: by - half / tan };
      next.B = { x: midX - half, y: by };
      next.C = { x: midX + half, y: by };
    }
    return next;
  }

  /** Change one of the two applet options; changing n restores the picture. */
  function withOption(state, key, value) {
    if (key === "n") {
      return start({
        n: value, width: state.width, height: state.height, showNames: state.showNames,
      });
    }
    if (key === "showNames") return { ...state, showNames: Boolean(value) };
    return { ...state };
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    MIN_N, MAX_N, DEFAULT_N, WIDTH, HEIGHT,
    dist, clampN, reset, start, topAngle, apexAngle, iterations,
    intersectCircleLine, other, compute, angleAt, triangles, claims,
    withPoint, withOption, result,
  };
})();
