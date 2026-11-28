"use strict";

/*
 * Inscribed Quadri — Alexander Bogomolny's applet InscribedQuadri, from its
 * own page "Remarkable Line in Cyclic Quadrilateral"
 * (Curriculum/Geometry/InscribedQuadri.shtml).
 *
 * Four corners A,B,C,D are dragged round one circle.  Each corner defines a
 * triangle from the other three, with orthocentre H_i, nine-point centre N_i
 * and centroid G_i.  In any triangle H, N, G, O are collinear with HN:NO=1:1
 * and HG:GO=2:1; on a cyclic quadrilateral the four Euler lines pass through
 * the common O, and the quadrilaterals H_A...H_D, N_A...N_D, G_A...G_D are
 * homothetic to ABCD with factors -1, -1/2 and -1/3.  Their homothety centres
 * H, N, G lie with O on one line, where HN:NO=1:2 and HG:GO=1:1.  H is also
 * the meeting point of the four nine-point circles, the four Simson lines and
 * the four maltitudes (the anticentre).
 *
 * The arithmetic follows the applet's bytecode literally:
 * GeoSDoub.FindAltitude/FindCircumcenter/Intersect/NearestPoint, the canvas'
 * FindOrthocenter/FindNinepointscenter, and the three "family centre" methods
 * DrawOrthocenters/DrawNinepointscenters/DrawCentroids, including their
 * |determinant| < 1 guard and their odd fallback when a diagonal intersection
 * fails.  The applet's own getAppletInfo still says "Pairs of incricles in a
 * quadrilateral", a copied label with no counterpart in its code or page.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, InscribedQuadriCore, so the page loads it
 * with a plain <script> and porting/check-inscribed-quadri.mjs loads it in
 * Node.  Positions are plain data in the SVG viewBox units.
 */
const InscribedQuadriCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const CENTER = { x: 200, y: 150 };       // Reset(): width/2, height/2
  const RADIUS = 100;                      // Reset(): Math.min(400,300)/3, Java int division
  const START_ANGLES = [
    0.5235987755982988,   // 30 degrees
    2.6179938779914944,  // 150 degrees
    3.765191430678208,   // about 215.7 degrees
    5.235987755982989,   // 300 degrees
  ];
  const NAMES = ["A", "B", "C", "D"];
  // The triangle that omits vertex i, in the order used by the canvas.
  const INDEX = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]];
  // The nine AWT checkboxes, in the panel's own words.
  const OPTION_KEYS = [
    "orthocenters", "ninePoints", "centroids", "eulerLines", "homothety",
    "quadrilaterals", "ninePointCircles", "maltitudes", "simsons",
  ];
  const OPTION_LABELS = {
    orthocenters: "Orthocenters",
    ninePoints: "Nine points centers",
    centroids: "Centroids",
    eulerLines: "Euler lines",
    homothety: "Homotheties",
    quadrilaterals: "Quadrilaterals",
    ninePointCircles: "Nine point circles",
    maltitudes: "Maltitudes",
    simsons: "Simsons",
  };

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const onCircle = (angle) => point(
    CENTER.x + RADIUS * Math.cos(angle), CENTER.y + RADIUS * Math.sin(angle));

  /** RestrictToCircle(Circle): keep a dragged corner on the common circle. */
  function angleOf(p) {
    if (!finite(p)) return null;
    let a = Math.atan2(p.y - CENTER.y, p.x - CENTER.x);
    if (p.x === CENTER.x && p.y === CENTER.y) return START_ANGLES[0];
    if (a < 0) a += 2 * Math.PI;
    return a;
  }

  function projectToCircle(p) {
    if (!finite(p)) return onCircle(START_ANGLES[0]);
    const dx = p.x - CENTER.x, dy = p.y - CENTER.y;
    const n = Math.hypot(dx, dy);
    if (n < 1e-9) return onCircle(START_ANGLES[0]);
    return point(CENTER.x + (RADIUS * dx) / n, CENTER.y + (RADIUS * dy) / n);
  }

  /* GeoSDoub.Intersect: ax+by+c=0 lines; NaN when |det| < 1 (applet guard). */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, a2 = p2.x - p1.x;
    const a3 = p1.x * p2.y - p1.y * p2.x;
    const b1 = p3.y - p4.y, b2 = p4.x - p3.x;
    const b3 = p3.x * p4.y - p3.y * p4.x;
    const den = a1 * b2 - b1 * a2;
    if (Math.abs(den) < 1) return point(NaN, NaN);
    return point((a2 * b3 - b2 * a3) / den, (a3 * b1 - b3 * a1) / den);
  }

  /* GeoSDoub.FindAltitude(P,A,B): perpendicular from P to the line AB. */
  function foot(p, a, b) {
    const q = point(p.x + b.y - a.y, p.y - b.x + a.x);
    return intersect(p, q, a, b);
  }

  /* GeoSDoub.FindCircumcenter: the two perpendicular bisectors.  The order
   * matters to the last few bits, and the applet swaps it in different calls. */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const q1 = point(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
    const q2 = point(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
    return intersect(m1, q1, m2, q2);
  }

  /* GeoSDoub.NearestPoint(P,A,B): the foot on line AB; within sqrt(0.1) of A
   * it returns P itself, as the applet's SqDist guard does. */
  function nearestPoint(p, a, b) {
    if ((p.x - a.x) ** 2 + (p.y - a.y) ** 2 < 0.1) return point(p.x, p.y);
    const dx = b.x - a.x, dy = b.y - a.y;
    const den = dx * dx + dy * dy;
    if (den <= 1e-12) return point(a.x, a.y);
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / den;
    return point(a.x + dx * t, a.y + dy * t);
  }

  /* InsideTest.IsInside(P,A,B): the angle at P is at least a right angle. */
  function inside(p, a, b) {
    return (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0;
  }

  function orthocenter(a, b, c) {
    return intersect(a, foot(a, b, c), b, foot(b, a, c));
  }

  /* FindNinepointscenter uses FindCircumcenter(B,A,C), not (A,B,C). */
  function ninePointCenter(a, b, c) {
    return midpoint(orthocenter(a, b, c), circumcenter(b, a, c));
  }

  const centroid = (a, b, c) => point((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);

  /* The canvas' Simson(P,A,B,C): three pedal feet, then a line through the
   * two that are not at the obtuse angle.  Null when no such pair exists. */
  function simson(p, a, b, c) {
    const f1 = nearestPoint(p, b, c);
    const f2 = nearestPoint(p, a, c);
    const f3 = nearestPoint(p, a, b);
    let ends = null;
    if (inside(f1, f2, f3)) ends = [f2, f3];
    else if (inside(f2, f3, f1)) ends = [f3, f1];
    else if (inside(f3, f1, f2)) ends = [f1, f2];
    return ends ? { feet: [f1, f2, f3], ends: ends } : null;
  }

  /* DrawOrthocenters/DrawNinepointscenters/DrawCentroids all finish the same
   * way: cross the lines joining A to family[0] with C to family[2], then B to
   * family[1] with D to family[3] — the homothety centres.  When either cross
   * fails, use the lines from family[2] to A[2] and family[3] to A[3]. */
  function familyCenter(family, corners) {
    let p = intersect(family[0], corners[0], family[2], corners[2]);
    let q = intersect(family[1], corners[1], family[3], corners[3]);
    if (!finite(p)) p = intersect(family[2], corners[2], family[3], corners[3]);
    if (!finite(q)) q = intersect(family[2], corners[2], family[3], corners[3]);
    if (!finite(p) || !finite(q)) return null;
    return midpoint(p, q);
  }

  function distToLine(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const n = Math.hypot(dx, dy);
    if (!n) return dist(p, a);
    return Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / n;
  }

  /** The position a new diagram starts from (Reset()). */
  function start(options) {
    const o = options || {};
    const opts = {};
    for (const key of OPTION_KEYS) opts[key] = o[key] === undefined ? false : !!o[key];
    return { angles: START_ANGLES.slice(), options: opts, explored: false };
  }

  function reset(state) {
    const s = start(state && state.options);
    s.explored = !!(state && state.explored);
    return s;
  }

  /** A corner is kept on the circle, exactly as RestrictToCircle does. */
  function move(state, name, p) {
    const i = NAMES.indexOf(name);
    if (i < 0 || !state || state.angles.length !== 4) return state;
    const a = typeof p === "number" ? p : angleOf(p);
    if (a === null || !Number.isFinite(a)) return state;
    const angles = state.angles.slice();
    angles[i] = a;
    return Object.assign({}, state, { angles: angles, explored: true });
  }

  function setOption(state, name, on) {
    if (!state || OPTION_KEYS.indexOf(name) < 0) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** All the points and lines of the drawing.  Null for a degenerate shape,
   * where the applet's Intersect produces NaN and nothing can be drawn. */
  function compute(a, b, c, d) {
    const pts = [a, b, c, d];
    if (!pts.every(finite)) return null;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) if (dist(pts[i], pts[j]) < 1e-7) return null;
    }

    const triangles = INDEX.map((ix) => ix.map((i) => pts[i]));
    const orthos = triangles.map((t) => orthocenter(t[0], t[1], t[2]));
    const centers = triangles.map((t) => ninePointCenter(t[0], t[1], t[2]));
    const cents = triangles.map((t) => centroid(t[0], t[1], t[2]));
    const H = familyCenter(orthos, pts);
    const N = familyCenter(centers, pts);
    const G = familyCenter(cents, pts);
    const O = point(CENTER.x, CENTER.y);
    if (!H || !N || !G) return null;
    if (!orthos.every(finite) || !centers.every(finite) || !cents.every(finite)) return null;

    /* DrawEulers passes (A1,A2,A3), (A0,A2,A3), (A0,A1,A3), (A0,A1,A2). */
    const eulerLines = triangles.map((t) => {
      const o = circumcenter(t[0], t[1], t[2]);
      return { from: orthocenter(t[0], t[1], t[2]), to: o, ok: finite(o) };
    });

    /* DrawMaltitudes: midpoint of AB to the foot on CD (and cyclically). */
    const maltitudes = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, k = (i + 2) % 4, l = (i + 3) % 4;
      maltitudes.push({ from: midpoint(pts[i], pts[j]), to: nearestPoint(midpoint(pts[i], pts[j]), pts[k], pts[l]) });
    }

    const simsons = [];
    for (let i = 0; i < 4; i++) {
      simsons.push(simson(pts[i], pts[(i + 1) % 4], pts[(i + 2) % 4], pts[(i + 3) % 4]));
    }

    const nineCircles = centers.map((n) => ({ center: n, radius: RADIUS / 2 }));
    const homothetyLines = {
      H: pts.map((p, i) => [p, orthos[i]]),
      N: pts.map((p, i) => [p, centers[i]]),
      G: pts.map((p, i) => [p, cents[i]]),
    };
    const quads = { H: orthos, N: centers, G: cents };

    /* Everything below measures the page's statements independently of the
     * checkboxes: a theorem is either true of this shape or it is not. */
    const scale = Math.max(1, RADIUS, dist(a, b), dist(b, c), dist(c, d),
      dist(d, a), dist(a, c), dist(b, d));
    const tol = 1e-7 * scale;
    let triangleRatioError = 0, collinearThreeError = 0, eulerConcurError = 0;
    let homotheticFamiliesError = 0, homotheticCornersError = 0;
    let lineRatioError = 0, nineCircleError = 0, simsonError = 0;
    let maltitudeError = 0, diagonalMaltitudeError = 0, nCircleCenterError = 0;

    for (let i = 0; i < 4; i++) {
      const ht = orthos[i], nt = centers[i], gt = cents[i];
      triangleRatioError = Math.max(triangleRatioError,
        Math.abs(dist(ht, nt) - dist(nt, O)),
        Math.abs(dist(ht, gt) - 2 * dist(gt, O)));
      collinearThreeError = Math.max(collinearThreeError,
        distToLine(nt, ht, O), distToLine(gt, ht, O));
      eulerConcurError = Math.max(eulerConcurError,
        eulerLines[i].ok ? distToLine(O, eulerLines[i].from, eulerLines[i].to) : Infinity);

      /* The three family quadrilaterals are homothetic about O with 3 and 3/2. */
      homotheticFamiliesError = Math.max(homotheticFamiliesError,
        dist(ht, add(O, mul(sub(gt, O), 3))),
        dist(nt, add(O, mul(sub(gt, O), 1.5))));

      /* And each family is homothetic to ABCD about its own centre. */
      homotheticCornersError = Math.max(homotheticCornersError,
        dist(ht, add(H, mul(sub(pts[i], H), -1))),
        dist(nt, add(N, mul(sub(pts[i], N), -0.5))),
        dist(gt, add(G, mul(sub(pts[i], G), -1 / 3))));

      nineCircleError = Math.max(nineCircleError,
        Math.abs(dist(centers[i], H) - RADIUS / 2));
      maltitudeError = Math.max(maltitudeError,
        distToLine(H, maltitudes[i].from, maltitudes[i].to));
      if (simsons[i]) {
        simsonError = Math.max(simsonError,
          distToLine(H, simsons[i].ends[0], simsons[i].ends[1]));
      }
    }

    /* H, N, G on one line with HN:NO = 1:2 and HG:GO = 1:1, so N is two
     * thirds of the way from O to H and G is halfway. */
    lineRatioError = Math.max(
      dist(N, add(O, mul(sub(H, O), 2 / 3))),
      dist(G, add(O, mul(sub(H, O), 1 / 2))),
      distToLine(H, N, O), distToLine(G, N, O));
    /* The page's remark: H is the circumcentre of N_A N_B N_C N_D. */
    const nQuadCenter = circumcenter(centers[0], centers[1], centers[2]);
    nCircleCenterError = finite(nQuadCenter) ? dist(H, nQuadCenter) : Infinity;
    /* The perpendicular from a diagonal's midpoint to the other diagonal. */
    diagonalMaltitudeError = Math.max(
      Math.abs(dot(sub(H, midpoint(a, c)), sub(d, b))),
      Math.abs(dot(sub(H, midpoint(b, d)), sub(a, c))));

    const measures = {
      triangleRatioError, collinearThreeError, eulerConcurError,
      homotheticFamiliesError, homotheticCornersError, lineRatioError,
      nineCircleError, nCircleCenterError, simsonError, maltitudeError,
      diagonalMaltitudeError,
    };
    const claims = {};
    for (const key of Object.keys(measures)) {
      claims[key] = Number.isFinite(measures[key]) && measures[key] <= tol;
    }
    claims.cyclic = pts.every((p) => Math.abs(dist(p, O) - RADIUS) <= tol);
    claims.fourSimsons = simsons.every((s) => !!s);

    return {
      A: a, B: b, C: c, D: d, points: pts, triangles, INDEX,
      orthocenters: orthos, nineCenters: centers, centroids: cents,
      H: H, N: N, G: G, O: O, circumradius: RADIUS,
      eulerLines: eulerLines, maltitudes: maltitudes, simsons: simsons,
      nineCircles: nineCircles, homothetyLines: homothetyLines, quads: quads,
      centralLine: { from: H, to: O },
      measures: measures, claims: claims, tol: tol,
    };
  }

  function geometry(state) {
    if (!state || !state.angles || state.angles.length !== 4) return null;
    return compute(...state.angles.map(onCircle));
  }

  /* A demonstration has no win and no loss. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the four points make a quadrilateral.";
    const shown = [];
    if (state.options.eulerLines) shown.push("the four Euler lines pass through O");
    if (state.options.homothety) shown.push("the match-up lines join each corner to its three copies");
    if (state.options.quadrilaterals) shown.push("the three copy quadrilaterals are shown");
    if (state.options.orthocenters) shown.push("dark dots mark the orthocentres");
    if (state.options.ninePoints) shown.push("blue dots mark the nine-point centres");
    if (state.options.centroids) shown.push("red dots mark the centroids");
    if (state.options.ninePointCircles) shown.push("the four nine-point circles pass through H");
    if (state.options.maltitudes) shown.push("the four maltitudes pass through H");
    if (state.options.simsons) shown.push("the four Simson lines pass through H");
    let text = shown.length
      ? "H, N, G and O lie on one line: " + shown.join("; ") + "."
      : "Drag A, B, C or D around the circle: all four corners stay on it.";
    if (state.options.eulerLines || state.options.ninePointCircles
      || state.options.maltitudes || state.options.simsons) {
      text += " H is the pink dot where they meet.";
    }
    return text;
  }

  return {
    VIEW: VIEW, CENTER: CENTER, RADIUS: RADIUS,
    START_ANGLES: START_ANGLES, NAMES: NAMES, INDEX: INDEX,
    OPTION_KEYS: OPTION_KEYS, OPTION_LABELS: OPTION_LABELS,
    point: point, add: add, sub: sub, mul: mul, dot: dot, dist: dist,
    midpoint: midpoint, finite: finite, onCircle: onCircle,
    angleOf: angleOf, projectToCircle: projectToCircle,
    intersect: intersect, foot: foot, circumcenter: circumcenter,
    nearestPoint: nearestPoint, inside: inside, orthocenter: orthocenter,
    ninePointCenter: ninePointCenter, centroid: centroid,
    simson: simson, familyCenter: familyCenter, distToLine: distToLine,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, result: result, describe: describe,
  };
})();
