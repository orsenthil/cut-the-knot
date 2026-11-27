"use strict";

/*
 * Euclid I.43 Extended, from Alexander Bogomolny's applet EuclidI43Extended
 * (the extension due to Quang Tuan Bui).
 *
 * ABCD is a parallelogram with horizontal top and bottom sides, centred at a
 * fixed point; X is a point inside it. Through X the applet draws MP parallel
 * to BC (M on AB, P on CD) and NQ parallel to AB (N on BC, Q on AD). When X is
 * on the diagonal BD the two off-diagonal pieces AMXQ and XNCP have the same
 * area (Euclid I.43). This page extends the theorem to X off the diagonal:
 * with Y = B + D - X, R = DY ∩ NQ and RS parallel to BC, the piece ASRQ always
 * has the same area as XNCP, so MSRX makes up the difference between XNCP and
 * AMXQ. Ticking "areas on the same side of BD" draws two orange pieces that
 * are equal; their intersection T lies on AX.
 *
 * This file is only the geometry and the state: no document, no window, no
 * storage. It defines one global, EuclidI43ExtendedCore. The intersections and
 * the point-in-parallelogram test follow the applet's own GeoSDoub.Intersect,
 * GeoSDoub.GetParallelTo and Polygon.contains, including their 100-unit ray,
 * |determinant| < 1 guard and 0.95 inset.
 */
const EuclidI43ExtendedCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 320;
  const MARGIN = 12;
  const MIN_SIDE = 24;
  const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
  /* The applet uses int(min(centre.x, centre.y) / 2) for its initial offsets. */
  const HALF = Math.floor(Math.min(CENTER.x, CENTER.y) / 2);
  const RAY = 100;                 // GeoSDoub.GetParallelTo's ray length
  const INSET = 0.95;              // the applet's Inside() polygon inset

  const copy = (p) => ({ x: p.x, y: p.y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampToBoard = (p) => ({
    x: clamp(p.x, MARGIN, WIDTH - MARGIN),
    y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
  });
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const reflect = (p) => ({ x: 2 * CENTER.x - p.x, y: 2 * CENTER.y - p.y });
  const mix = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });

  /** GeoSDoub.GetParallelTo(p, q, r): p + 100 * (r - q). */
  function parallelTo(p, q, r) {
    return { x: p.x + RAY * (r.x - q.x), y: p.y + RAY * (r.y - q.y) };
  }

  /** GeoSDoub.Intersect: the cross-product form, NaN for a small determinant. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }

  /* GeoSDoub.FindOrientation, in the bytecode's own order. Zero counts as -1,
     so an X exactly on BD takes the same drawing branch as triangle ABD. */
  const orientation = (p, q, r) =>
    (r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y) > 0 ? 1 : -1;
  const cross = (p, q, r) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  /** Twice the usual shoelace sum divided by two, with its sign. */
  function signed(pts) {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
  }
  const polygonArea = (pts) => Math.abs(signed(pts));

  /* The applet's Inside() first shrinks the four corners by 0.95 about the
     centre, rounds them to integer pixels, then asks Polygon.contains. */
  function pixel(p) {
    return {
      x: Math.round((p.x - CENTER.x) * INSET + CENTER.x),
      y: Math.round((p.y - CENTER.y) * INSET + CENTER.y),
    };
  }
  function polygonContains(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if ((yi > y) !== (yj > y) &&
          x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function insideCorners(corners, x) {
    return polygonContains(corners.map(pixel), x.x, x.y);
  }

  /** The fixed opening picture, matching the applet's init() construction. */
  function start(options) {
    const o = options || {};
    const w = Math.round(HALF * 1.5);
    const s = {
      A: { x: CENTER.x - HALF, y: CENTER.y + HALF },
      B: { x: CENTER.x + w, y: CENTER.y + HALF },
      C: { x: CENTER.x + HALF, y: CENTER.y - HALF },
      D: { x: CENTER.x - w, y: CENTER.y - HALF },
      X: {
        x: (2 * (CENTER.x - HALF) + CENTER.x + w) / 3,
        y: (2 * (CENTER.y + HALF) + CENTER.y - HALF) / 3,
      },
      showNames: o.showNames === undefined ? true : !!o.showNames,
      sameSide: !!o.sameSide,
      showProof: !!o.showProof,
      explored: false,
    };
    return s;
  }

  /** A fresh diagram with new side offsets and a new interior X. */
  function randomize(s) {
    const h = 55 + Math.random() * 30;
    const w = 85 + Math.random() * 50;
    const q = {
      A: { x: CENTER.x - h, y: CENTER.y + h },
      B: { x: CENTER.x + w, y: CENTER.y + h },
      C: { x: CENTER.x + h, y: CENTER.y - h },
      D: { x: CENTER.x - w, y: CENTER.y - h },
      X: copy(s.X),
      showNames: s.showNames, sameSide: s.sameSide, showProof: s.showProof,
      explored: false,
    };
    return setRegion(q, Math.random() < 0.5 ? "ABD" : "BCD");
  }

  /** Put X at one of the two places the page discusses. */
  function setRegion(s, region) {
    const t = region === "BCD" ? 0.7 : region === "BD" ? 0.5 : 0.3;
    const A = s.A, B = s.B, D = s.D;
    return Object.assign({}, s, {
      X: {
        x: A.x + t * (B.x - A.x) + t * (D.x - A.x),
        y: A.y + t * (B.y - A.y) + t * (D.y - A.y),
      },
      explored: true,
    });
  }

  /** Back to the opening diagram, keeping the player's three tick boxes. */
  function reset(s) {
    return start({
      showNames: s.showNames, sameSide: s.sameSide, showProof: s.showProof,
    });
  }

  function setOption(s, key, value) {
    if (!["showNames", "sameSide", "showProof"].includes(key)) return s;
    return Object.assign({}, s, { [key]: !!value, explored: true });
  }

  /**
   * One of the five draggable points moved. A/C and B/D are reflected in the
   * centre, exactly as the applet's UpdateTwo does, and the top and bottom
   * sides stay horizontal through the y copies in UpdatePoints. A move that
   * would put a corner off the board or collapse the parallelogram is refused.
   */
  function movePoint(s, name, p) {
    if (!finite(p)) return s;
    if (!["A", "B", "C", "D", "X"].includes(name)) return s;
    if (name === "X") {
      return Object.assign({}, s, { X: clampToBoard(p), explored: true });
    }
    const q = clampToBoard(p);
    let A = s.A, B = s.B, C = s.C, D = s.D;
    if (name === "A") {
      A = q; C = reflect(A); B = { x: B.x, y: A.y }; D = { x: D.x, y: C.y };
    } else if (name === "B") {
      B = q; D = reflect(B); A = { x: A.x, y: B.y }; C = { x: C.x, y: D.y };
    } else if (name === "C") {
      C = q; A = reflect(C); B = { x: B.x, y: A.y }; D = { x: D.x, y: C.y };
    } else {
      D = q; B = reflect(D); A = { x: A.x, y: B.y }; C = { x: C.x, y: D.y };
    }
    const pts = [A, B, C, D];
    if (Math.abs(A.x + C.x - 2 * CENTER.x) > 1e-9 ||
        Math.abs(B.x + D.x - 2 * CENTER.x) > 1e-9 ||
        Math.abs(A.y - B.y) > 1e-9 || Math.abs(C.y - D.y) > 1e-9 ||
        Math.abs(A.x - B.x) < MIN_SIDE || Math.abs(A.y - D.y) < MIN_SIDE ||
        pts.some((v) => v.x < MARGIN - 1e-9 || v.x > WIDTH - MARGIN + 1e-9 ||
                        v.y < MARGIN - 1e-9 || v.y > HEIGHT - MARGIN + 1e-9)) return s;
    return Object.assign({}, s, { A, B, C, D, explored: true });
  }

  /** The whole construction of EuclidI43ExtendedCanvas.Compute(). */
  function compute(s) {
    const A = s.A, B = s.B, C = s.C, D = s.D, X = s.X;
    const outOfBounds = !insideCorners([A, B, C, D], X);
    const result = {
      A, B, C, D, X, outOfBounds,
      region: outOfBounds ? "outside" : Math.abs(cross(B, D, X)) < 1e-7 ? "BD"
        : orientation(A, B, D) === orientation(X, B, D) ? "ABD" : "BCD",
      sameBranch: orientation(A, B, D) === orientation(X, B, D),
      sameSide: s.sameSide, showNames: s.showNames, showProof: s.showProof,
      explored: s.explored,
    };
    if (outOfBounds) return result;

    const alongBC = parallelTo(X, B, C);
    const alongAB = parallelTo(X, A, B);
    const M = intersect(alongBC, X, A, B);
    const P = intersect(alongBC, X, C, D);
    const N = intersect(alongAB, X, B, C);
    const Q = intersect(alongAB, X, A, D);
    /* Y.x = B.x - (X.x - D.x), the applet's three dsubs. */
    const Y = { x: B.x - (X.x - D.x), y: B.y - (X.y - D.y) };
    const R = intersect(D, Y, N, Q);

    const alongAD = parallelTo(R, A, D);
    const S = intersect(alongAD, R, A, B);
    const U = intersect(B, Y, P, M);
    const V = intersect(parallelTo(U, A, B), U, A, D);
    const T = intersect(R, S, U, V);

    const W = intersect(D, R, A, B);
    const throughW = parallelTo(W, B, C);
    const E = intersect(throughW, W, N, Q);
    const F = intersect(throughW, W, C, D);
    const K = intersect(R, S, C, D);

    Object.assign(result, { M, N, P, Q, R, S, T, U, V, W, E, F, K, Y });

    const amxq = polygonArea([A, M, X, Q]);
    const xncp = polygonArea([X, N, C, P]);
    const asrq = polygonArea([A, S, R, Q]);
    const msrx = polygonArea([M, S, R, X]);
    const orange1 = polygonArea([Q, X, U, V]);
    const orange2 = polygonArea([X, M, S, R]);
    const refk = polygonArea([R, E, F, K]);
    const diff = xncp - amxq;
    Object.assign(result, {
      amxq, xncp, asrq, msrx, orange1, orange2, refk, diff,
      gap: Math.abs(diff),
      finite: [M, N, P, Q, R, S, T, U, V, W, E, F, K].every(finite),
    });
    return result;
  }

  /** The line in words. A demonstration has no winner to announce. */
  function describe(s) {
    const g = compute(s);
    const r = (v) => Math.round(v);
    if (g.outOfBounds) {
      return "X is outside the parallelogram. Drag X back inside to see the equal areas.";
    }
    if (!g.finite) return "One of the construction lines is parallel to another; move X a little.";
    const where = g.region === "BD" ? "X is on diagonal BD, so the two off-diagonal pieces match"
      : g.region === "ABD" ? "X is inside triangle ABD, below BD"
        : "X is inside triangle BCD, above BD";
    const pieces = `Blue XNCP is ${r(g.xncp)} and red AMXQ is ${r(g.amxq)}. ` +
      `Orange ASRQ is ${r(g.asrq)}, the same as the blue piece.`;
    const gap = g.region === "BD"
      ? "The gap is zero."
      : `MSRX is ${r(g.msrx)}, the gap between them.`;
    const orange = s.sameSide
      ? ` The two orange pieces are both ${r(g.orange1)}.`
      : "";
    return `${where}. ${pieces} ${gap}${orange}`;
  }

  /** There is no win, loss or end: this is an illustration. */
  function result() { return null; }

  return {
    WIDTH, HEIGHT, MARGIN, MIN_SIDE, CENTER, HALF, RAY, INSET,
    copy, clamp, clampToBoard, finite, add, sub, reflect, mix,
    parallelTo, intersect, orientation, cross, signed, polygonArea,
    pixel, polygonContains, insideCorners,
    start, randomize, reset, setRegion, setOption, movePoint,
    compute, describe, result,
  };
})();
