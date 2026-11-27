"use strict";

/*
 * Euler Nagel In Quad — Alexander Bogomolny's applet EulerNagelInQuad
 * ("Remarkable Line in a Quadrilateral").
 *
 * Four draggable corners A,B,C,D make four triangles, each with an
 * orthocenter H, nine-point centre N, centroid G and circumcenter O.  The
 * applet joins the centres belonging to the two triangles that omit opposite
 * corners: H_A H_C with H_B H_D, and likewise for N, G and O.  Its four
 * intersections H', N', G', O' always lie on one line, with N' halfway from
 * H' to O' and G' two thirds of the way there.  For a cyclic quadrilateral
 * the homothety centres instead use the ratios 1:2 and 1:1.
 *
 * The arithmetic here follows the applet's bytecode, including its quirks:
 * GeoSDoub.Intersect returns NaN when the determinant is below 1, and the
 * canvas' own Intersect snaps two centres less than one unit apart to their
 * midpoint.  It defines one global, EulerNagelInQuadCore, and has no DOM.
 */
const EulerNagelInQuadCore = (() => {
  const VIEW = { x: 0, y: 0, width: 560, height: 400 };
  const PAD = 14;
  const EPS = 1; // EulerNagelInQuadCanvas.eps

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const lerp = (p, q, t) => point(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /*
   * EulerNagelInQuadCanvas.Reset() on the applet's 560x400 canvas: the
   * radius is Math.min(W,H)/3, the circle centre is (W/2,H/2), and the four
   * angles are the bytecode constants 0.5235987755982988,
   * 2.6179938779914944, 3.765191430678208 and 5.235987755982989.  The
   * first corner alone gets the leftover +40 in x.
   */
  function start(options) {
    const o = options || {};
    const defaults = {
      circumcenters: false, orthocenters: false, centroids: false,
      ninePoints: false, diagonals: false, eulerLines: false,
    };
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const r = Math.min(VIEW.width, VIEW.height) / 3;
    const angles = [
      0.5235987755982988,
      2.6179938779914944,
      3.765191430678208,
      5.235987755982989,
    ];
    const corners = angles.map((a, i) => point(
      cx + r * Math.cos(a) + (i === 0 ? 40 : 0),
      cy + r * Math.sin(a),
    ));
    return {
      A: corners[0], B: corners[1], C: corners[2], D: corners[3],
      options: Object.keys(defaults).reduce((acc, key) => {
        acc[key] = o[key] === undefined ? defaults[key] : !!o[key];
        return acc;
      }, {}),
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = !!state.explored;
    return s;
  }

  function move(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name)) return state;
    if (name.length !== 1 || !"ABCD".includes(name)) return state;
    if (!finite(p)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint). */
  function lineIntersection(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /* The same two-line solve without the applet's one-unit cut-off.  The
   * applet's snapping changes the *drawn* point when two centres are close;
   * the ratios reported to the player are measured on the unsnapped lines,
   * which is what the theorem on the page is about. */
  function rawIntersection(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (det === 0 || !finite(p) || !finite(q) || !finite(r) || !finite(s)) {
      return point(NaN, NaN);
    }
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /* The canvas' Intersect: snap nearby first points, then GeoSDoub's line
   * intersection.  The order of the four arguments is the applet's order. */
  function intersect(p, q, r, s) {
    if (dist(p, r) <= EPS) return midpoint(p, r);
    if (dist(q, s) <= EPS) return midpoint(q, s);
    if (dist(p, s) <= EPS) return midpoint(p, s);
    if (dist(q, r) <= EPS) return midpoint(q, r);
    return lineIntersection(p, q, r, s);
  }

  /* GeoSDoub.FindAltitude(p,q,r): the foot of the perpendicular from p to qr. */
  function altitudeFoot(p, q, r) {
    const v = point(r.y - q.y, q.x - r.x);
    return lineIntersection(p, add(p, v), q, r);
  }

  /* EulerNagelInQuadCanvas.FindOrthocenter(p,q,r). */
  function orthocenter(p, q, r) {
    const fp = altitudeFoot(p, q, r);
    const fq = altitudeFoot(q, p, r);
    return lineIntersection(p, fp, q, fq);
  }

  /* GeoSDoub.FindCircumcenter(p,q,r): intersect the perpendicular bisectors
   * of pq and qr. */
  function circumcenter(p, q, r) {
    const m1 = midpoint(p, q);
    const m2 = midpoint(q, r);
    const v1 = point(q.y - p.y, p.x - q.x);
    const v2 = point(r.y - q.y, q.x - r.x);
    return lineIntersection(m1, add(m1, v1), m2, add(m2, v2));
  }

  /* FindNinepointscenter = midpoint of orthocentre and circumcentre. */
  function ninePointCenter(p, q, r) {
    return midpoint(orthocenter(p, q, r), circumcenter(p, q, r));
  }

  /* The applet's three-argument MidPoint: (p+q+r)/3. */
  function centroid3(p, q, r) {
    return point((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
  }

  function distToLine(p, a, b) {
    const n = dist(a, b);
    return n > 0 ? Math.abs(cross(sub(p, a), sub(b, a))) / n : dist(p, a);
  }

  /*
   * Everything the applet's Compute() and Draw() derive from four corners.
   * HH[i], NN[i], GG[i], OO[i] belong to the triangle that omits corner i:
   * 0 omits A (BCD), 1 omits B (ACD), 2 omits C (ABD), 3 omits D (ABC).
   * The combined points intersect the centres of opposite triangles:
   * i=0 with i=2, and i=1 with i=3.
   */
  function compute(a, b, c, d) {
    const corners = [a, b, c, d];
    if (!corners.every(finite)) return null;
    const triangles = [
      [b, c, d], [a, c, d], [a, b, d], [a, b, c],
    ];
    const HH = triangles.map((t) => orthocenter(t[0], t[1], t[2]));
    const NN = triangles.map((t) => ninePointCenter(t[0], t[1], t[2]));
    const GG = triangles.map((t) => centroid3(t[0], t[1], t[2]));
    const OO = triangles.map((t) => circumcenter(t[0], t[1], t[2]));

    /* The drawn points use the applet's one-unit snapping. */
    const H = intersect(HH[0], HH[2], HH[1], HH[3]);
    const N = intersect(NN[0], NN[2], NN[1], NN[3]);
    const G = intersect(GG[0], GG[2], GG[1], GG[3]);
    const O = intersect(OO[0], OO[2], OO[1], OO[3]);
    /* The measurements use the same lines unsnapped. */
    const EH = rawIntersection(HH[0], HH[2], HH[1], HH[3]);
    const EN = rawIntersection(NN[0], NN[2], NN[1], NN[3]);
    const EG = rawIntersection(GG[0], GG[2], GG[1], GG[3]);
    const EO = rawIntersection(OO[0], OO[2], OO[1], OO[3]);
    const valid = [H, N, G, O].every(finite);
    const exact = [EH, EN, EG, EO].every(finite) && dist(EH, EO) > 1;
    const scale = exact ? Math.max(1, dist(EH, EO)) : 1;
    const tol = exact ? 1e-6 * scale : 0;

    /* The page's (1'): N' is the midpoint of H'O' and G' is 2/3 along it. */
    let collinearError = Infinity, nError = Infinity, gError = Infinity;
    let order = null;
    if (exact) {
      collinearError = Math.max(
        distToLine(EN, EH, EO), distToLine(EG, EH, EO), distToLine(EO, EH, EO),
      );
      nError = dist(EN, lerp(EH, EO, 1 / 2));
      gError = dist(EG, lerp(EH, EO, 2 / 3));
      const tOf = (p) => dot(sub(p, EH), sub(EO, EH)) / (dist(EH, EO) ** 2);
      const tN = tOf(EN), tG = tOf(EG);
      order = tN > 0 && tG > tN && tG < 1;
    }

    /* The page's (1): inside every one of the four triangles. */
    const triangleChecks = triangles.map((t, i) => {
      const h = HH[i], o = OO[i];
      const n = NN[i], g = GG[i];
      if (![h, o, n, g].every(finite)) {
        return { valid: false, collinear: false, nMidpoint: false, gRatio: false };
      }
      const s = Math.max(1, dist(h, o));
      const e = 1e-6 * s;
      return {
        valid: true,
        collinear: distToLine(n, h, o) <= e && distToLine(g, h, o) <= e,
        nMidpoint: dist(n, midpoint(h, o)) <= e,
        gRatio: dist(g, lerp(h, o, 2 / 3)) <= e,
      };
    });

    /* The page's (2): for a cyclic quadrilateral, all four circumcentres
     * coincide and the homothety centres of the centre quadrilaterals with
     * ABCD satisfy HN:NO = 1:2 and HG:GO = 1:1. */
    const ring = OO.every((p) => finite(p) && dist(p, OO[0]) <= 1e-6 * Math.max(1, dist(a, b)));
    const r0 = dist(a, OO[0]);
    const cyclic = ring && [b, c, d].every((p) => Math.abs(dist(p, OO[0]) - r0) <= 1e-6 * Math.max(1, r0));
    let cyclicCenters = null;
    if (cyclic) {
      const h0 = rawIntersection(a, HH[0], b, HH[1]);
      const n0 = rawIntersection(a, NN[0], b, NN[1]);
      const g0 = rawIntersection(a, GG[0], b, GG[1]);
      const o0 = OO[0];
      if ([h0, n0, g0].every(finite)) {
        const size = Math.max(1, dist(h0, o0));
        const e = 1e-6 * size;
        cyclicCenters = {
          H: h0, N: n0, G: g0, O: o0,
          collinear: distToLine(n0, h0, o0) <= e && distToLine(g0, h0, o0) <= e,
          nRatio: dist(n0, lerp(h0, o0, 1 / 3)) <= e,
          gRatio: dist(g0, midpoint(h0, o0)) <= e,
          order: (() => {
            const tOf = (p) => dot(sub(p, h0), sub(o0, h0)) / (dist(h0, o0) ** 2);
            const tN = tOf(n0), tG = tOf(g0);
            return tN > 0 && tG > tN && tG < 1;
          })(),
        };
      }
    }

    return {
      A: a, B: b, C: c, D: d,
      corners: corners,
      HH: HH, NN: NN, GG: GG, OO: OO,
      H: H, N: N, G: G, O: O,
      exact: { H: EH, N: EN, G: EG, O: EO },
      eulerLines: triangles.map((t, i) => [HH[i], OO[i]]),
      valid: valid,
      scale: scale,
      measures: { collinearError, nError, gError },
      claims: {
        collinear: valid && collinearError <= tol,
        nMidpoint: valid && nError <= tol,
        gRatio: valid && gError <= tol,
        order: !!order,
        triangleEuler: triangleChecks.every((t) => t.valid && t.collinear && t.nMidpoint && t.gRatio),
        cyclic: !!cyclic,
        cyclicClaim: !!cyclicCenters && cyclicCenters.collinear && cyclicCenters.nRatio
          && cyclicCenters.gRatio && cyclicCenters.order,
      },
      triangles: triangleChecks,
      cyclicCenters: cyclicCenters,
    };
  }

  function geometry(state) {
    if (!state) return null;
    return compute(state.A, state.B, state.C, state.D);
  }

  /* A picture has no win, loss or finish. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    const corners = g && g.corners;
    const repeated = corners && corners.some((p, i) =>
      corners.slice(i + 1).some((q) => dist(p, q) < 1e-9));
    if (!g || !g.valid || repeated) {
      return "Move a corner so the four centre points can be found.";
    }
    let text = "H', N', G' and O' lie on one line: N' is halfway from H' to O', and G' is two thirds of the way.";
    if (state.options.diagonals) text += " The dashed lines are the diagonals AC and BD.";
    if (state.options.eulerLines) text += " The green lines are the Euler lines of the four triangles.";
    if (g.claims.cyclicClaim) {
      text += " This quadrilateral is cyclic, so its homothety centres split the line 1:2 and 1:1.";
    }
    return text;
  }

  return {
    VIEW: VIEW, PAD: PAD, EPS: EPS,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, lerp: lerp, finite: finite, clamp: clamp,
    lineIntersection: lineIntersection, rawIntersection: rawIntersection, intersect: intersect,
    altitudeFoot: altitudeFoot, orthocenter: orthocenter,
    circumcenter: circumcenter, ninePointCenter: ninePointCenter,
    centroid3: centroid3, distToLine: distToLine,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, result: result, describe: describe,
  };
})();
