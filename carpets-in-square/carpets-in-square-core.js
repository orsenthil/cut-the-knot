"use strict";

/*
 * Carpets In Square, from Alexander Bogomolny's applet CarpetsInSquare.
 *
 * The page states the Carpets Theorem's latest case: in a square ABCD with M
 * on AB and N on BC (often the midpoints, but their position is free), the
 * blue quadrilateral DPQR has exactly the area of the three red pieces put
 * together, AMP, BMQN and CNR. Here P = AN ∩ DM, Q = AN ∩ CM and R = CM ∩ DN.
 * The reason is that triangle ADN and the union of triangles ADM and BCM each
 * cover half the square; taking their common part away leaves equal areas.
 *
 * init() in CarpetsInSquareCanvas puts A at the top-left with B below it, C
 * bottom-right and D top-right, draws a square of side 3/4 of the smaller
 * canvas side, truncating the product to a whole number, and centres it. M is
 * the midpoint of AB, fixed in x by CTKMoveableDoub.Fix(1), and N the midpoint
 * of BC, fixed in y by Fix(2). Compute() calls GeoSDoub.Intersect three times
 * to get P, Q and R. The check script transcribes that bytecode a second time
 * and compares every point and area on hundreds of configurations.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines the global CarpetsInSquareCore; every function takes a
 * plain position and returns a new one.
 */
const CarpetsInSquareCore = (() => {
  const WIDTH = 450;
  const HEIGHT = 400;
  const EPS = 1e-9;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const close = (a, b, tol = 1e-7) =>
    Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** init(): min(width,height) * 3 / 4, with Java's integer division. */
  const snapSide = (width, height) => Math.floor(Math.min(width, height) * 3 / 4);

  /** GeoSDoub.Intersect: NaN when |d| < 1, from javap -c of its bytecode. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** Signed shoelace area; abs() turns it into an ordinary area. */
  function area(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      if (!finite(points[i])) return NaN;
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return Math.abs(sum / 2);
  }

  const onLine = (p, a, b, tol = 1e-6) =>
    finite(p) && Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) < tol;

  /**
   * The whole drawing for a state, in canvas coordinates. The order of P, Q
   * and R is Compute()'s: AN∩DM, AN∩CM, CM∩DN. blue is FillQuadri(D,R,Q,P);
   * reds are FillTriangle(A,P,M), FillQuadri(M,Q,N,B) and FillTriangle(C,R,N).
   */
  function layout(state) {
    const side = state.side, width = state.width, height = state.height;
    const x0 = (width - side) / 2, y0 = (height - side) / 2;
    const A = { x: x0, y: y0 };
    const B = { x: x0, y: y0 + side };
    const C = { x: x0 + side, y: y0 + side };
    const D = { x: x0 + side, y: y0 };
    // M slides on the left side AB (x fixed), N on the bottom side BC (y fixed).
    const M = { x: x0, y: y0 + state.m };
    const N = { x: x0 + state.n, y: y0 + side };
    const P = intersect(A, N, D, M);
    const Q = intersect(A, N, C, M);
    const R = intersect(C, M, D, N);
    const blue = [D, R, Q, P];
    const reds = [[A, P, M], [M, Q, N, B], [C, R, N]];
    return {
      side, x0, y0, A, B, C, D, M, N, P, Q, R, blue, reds,
      halfs: [[A, D, N], [A, D, M], [B, C, M]],
      overlap: [[A, D, P], [N, Q, R]],
      lines: [[A, N], [D, N], [D, M], [C, M]],
      square: [A, B, C, D],
      finite: finite(P) && finite(Q) && finite(R),
      // mouseDragged()/mouseReleased() set NoDraw when a handle leaves its side.
      noDraw: !(A.y <= M.y && M.y <= B.y && B.x <= N.x && N.x <= C.x),
    };
  }

  /** The opening picture: 450×400 canvas, side 300, both points at midpoints. */
  function start(options) {
    const o = options || {};
    const width = o.width || WIDTH;
    const height = o.height || HEIGHT;
    const side = snapSide(width, height);
    return {
      width, height, side,
      m: clamp(o.m == null ? side / 2 : o.m, 0, side),
      n: clamp(o.n == null ? side / 2 : o.n, 0, side),
      showNames: !!o.showNames,
      explored: false,
    };
  }

  /**
   * One move. A `point` name M slides M along AB (only its y can change), a
   * `point` name N slides N along BC (only its x can change), matching Fix(1)
   * and Fix(2). `option` is the applet's "Show names" checkbox and `reset`
   * puts both points back at the midpoints.
   */
  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "reset") return start({ width: state.width, height: state.height });
    if (m.type === "option") {
      if (m.key !== "showNames" || typeof m.value !== "boolean") return null;
      return Object.assign({}, state, { showNames: m.value, explored: true });
    }
    if (m.type === "point") {
      if (!finite(m.point) || (m.name !== "M" && m.name !== "N")) return null;
      const q = m.point;
      if (q.x < 0 || q.x > state.width || q.y < 0 || q.y > state.height) return null;
      const g = layout(state);
      if (m.name === "M") {
        return Object.assign({}, state, {
          m: clamp(q.y - g.A.y, 0, state.side), explored: true,
        });
      }
      return Object.assign({}, state, {
        n: clamp(q.x - g.B.x, 0, state.side), explored: true,
      });
    }
    return null;
  }

  /** Areas of the carpets, the two halves and their common part. */
  function compute(state) {
    const g = layout(state);
    const blueArea = area(g.blue);
    const redAreas = g.reds.map(area);
    const redTotal = redAreas.reduce((a, b) => a + b, 0);
    const halfADN = area(g.halfs[0]);
    const halfCarpets = area(g.halfs[1]) + area(g.halfs[2]);
    const overlap = g.finite
      ? area(g.overlap[0]) + area(g.overlap[1]) : NaN;
    return Object.assign({}, g, {
      blueArea, redAreas, redTotal, halfADN, halfCarpets, overlap,
      squareArea: state.side * state.side,
    });
  }

  /** The page's claim and the identities the drawing relies on. */
  function claims(g) {
    return {
      redEqualsBlue: g.finite && close(g.blueArea, g.redTotal, 1e-6),
      halvesEqual: close(g.halfADN, g.squareArea / 2, 1e-6) &&
        close(g.halfCarpets, g.squareArea / 2, 1e-6),
      overlapFits: g.finite &&
        close(g.blueArea + g.overlap, g.halfADN, 1e-6) &&
        close(g.redTotal + g.overlap, g.halfCarpets, 1e-6) &&
        close(g.blueArea + g.redTotal + 2 * g.overlap, g.squareArea, 1e-6),
      pointsOnLines: g.finite &&
        onLine(g.P, g.A, g.N) && onLine(g.P, g.D, g.M) &&
        onLine(g.Q, g.A, g.N) && onLine(g.Q, g.C, g.M) &&
        onLine(g.R, g.C, g.M) && onLine(g.R, g.D, g.N),
      positive: g.finite && g.blueArea > EPS && g.redAreas.every((v) => v > EPS),
    };
  }

  /** A sentence for #status: the measured areas, in plain words. */
  function describe(state) {
    const g = compute(state);
    const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return `Blue ${fmt(g.blueArea)}. Red ${fmt(g.redAreas[0])} + ` +
      `${fmt(g.redAreas[1])} + ${fmt(g.redAreas[2])} = ${fmt(g.redTotal)}. ` +
      (g.finite && close(g.blueArea, g.redTotal, 1e-6)
        ? "They match." : "The corners make the lines miss.");
  }

  /** A demo has no win or loss; the record sees a finished exploration. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  return {
    WIDTH, HEIGHT, EPS,
    clamp, close, finite, snapSide, intersect, area, onLine,
    layout, start, move, compute, claims, describe, result,
  };
})();
