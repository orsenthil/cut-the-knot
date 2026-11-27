"use strict";

/*
 * Circles In Regular Polygon — Alexander Bogomolny's applet CirclesInRegularPolygon.
 *
 * A regular N-gon (N >= 5) is drawn on its circumcircle C with one vertex A
 * picked out.  Joining A to all the other vertices cuts the polygon into N-2
 * triangles.  Jeremy Dunn's five claims, as stated on the applet's page, are:
 *
 *   1. the incenters of those triangles lie on one circle (iCircle);
 *   2. their centroids lie on one circle (cCircle);
 *   3. a circle touches every incircle on the outside and also touches C
 *      (tCircle);
 *   4. cCircle touches the two sides of the polygon that meet at A;
 *   5. the feet of the angle bisectors from A are concyclic (aCircle).
 *
 * This file transcribes Reset() from CirclesInRegularPolygonCanvas, with the
 * geometric helpers GeoSDoub.FindIncenter, FindCircumcenter, FindAngleBisector,
 * NearestPoint, CTKGeometryPlus.Barycenter and ApolloniusCircle written with
 * ordinary analytic formulas (the bytecode builds the same points with
 * rotations and line intersections).  The circumcircle radius is min(W,H)/2.1
 * and A starts at angle -PI/2, exactly as in init() and Reset().  N runs from
 * 5 to 30 and the eight "Show ..." checkboxes start unchecked, as in
 * CirclesInRegularPolygonPanel.  Dragging A rotates the whole regular polygon
 * about its centre — a rigid motion, so none of the five claims change.
 *
 * No document, no window, no storage: this file only holds geometry and
 * rules.  It defines one global, CirclesInRegularPolygonCore, so the page
 * loads it with a plain <script> and porting/check-circles-in-regular-polygon.mjs
 * loads it in Node.  Positions are plain data in the SVG viewBox units.
 */
const CirclesInRegularPolygonCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const CENTER = { x: VIEW.width / 2, y: VIEW.height / 2 };
  const RADIUS = Math.min(VIEW.width, VIEW.height) / 2.1; // init(): min(W,H)/2.1
  const N_MIN = 5;
  const N_MAX = 30;
  const START_ANGLE = -Math.PI / 2; // Reset(): theta = -PI/2
  const OPTION_KEYS = [
    "incircles", "incenters", "centroids", "bisectors",
    "iCircle", "cCircle", "tCircle", "aCircle",
  ];

  const point = (x, y) => ({ x: x, y: y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function nOf(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return clamp(Math.round(n), N_MIN, N_MAX);
  }

  function angleOf(value, wrap) {
    const a = Number(value);
    if (!Number.isFinite(a)) return START_ANGLE;
    if (!wrap) return a;
    const turn = 2 * Math.PI;
    return ((a % turn) + turn) % turn;
  }

  /** GeoSDoub.NearestPoint(P,A,B): the foot of the perpendicular from P to AB. */
  function nearestPoint(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    if (a.x === b.x && a.y === b.y) return point(a.x, a.y);
    const t = clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy), 0, 1);
    return point(a.x + t * vx, a.y + t * vy);
  }

  function distToLine(p, a, b) {
    const d = dist(a, b);
    if (d === 0) return dist(p, a);
    return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / d;
  }

  /** GeoSDoub.FindIncenter: barycentric by the opposite side lengths. */
  function incenter(a, b, c) {
    const la = dist(b, c), lb = dist(c, a), lc = dist(a, b);
    const s = la + lb + lc;
    if (s === 0) return point(a.x, a.y);
    return point((la * a.x + lb * b.x + lc * c.x) / s,
                 (la * a.y + lb * b.y + lc * c.y) / s);
  }

  /** GeoSDoub.FindCircumcenter: solve the two perpendicular-bisector equations. */
  function circumcenter(a, b, c) {
    const ax = b.x - a.x, ay = b.y - a.y;
    const bx = c.x - a.x, by = c.y - a.y;
    const det = 2 * (ax * by - ay * bx);
    if (Math.abs(det) < 1e-14) return midpoint(a, c);
    const aa = a.x * a.x + a.y * a.y;
    const bb = b.x * b.x + b.y * b.y;
    const cc = c.x * c.x + c.y * c.y;
    return point(((bb - aa) * by - (cc - aa) * ay) / det,
                 ((cc - aa) * ax - (bb - aa) * bx) / det);
  }

  /** GeoSDoub.FindAngleBisector(A,B,C): the foot on BC, split in AB:AC. */
  function angleBisectorFoot(a, b, c) {
    const ab = dist(a, b), ac = dist(a, c);
    const s = ab + ac;
    if (s === 0) return midpoint(b, c);
    return point((ac * b.x + ab * c.x) / s, (ac * b.y + ab * c.y) / s);
  }

  /** GetCircumcircle(): centre is the circumcentre; radius is the mean of
   *  its distances to the three points, just as in the bytecode. */
  function circleFrom3(a, b, c) {
    const centre = circumcenter(a, b, c);
    const r = (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3;
    return { center: centre, radius: r };
  }

  /** GetIncircle(): centre is the incenter; radius is the mean distance to
   *  the three sides (all three are equal for a true incircle). */
  function incircleFrom3(a, b, c) {
    const centre = incenter(a, b, c);
    const r = (dist(centre, nearestPoint(centre, a, b))
      + dist(centre, nearestPoint(centre, b, c))
      + dist(centre, nearestPoint(centre, c, a))) / 3;
    return { center: centre, radius: r };
  }

  /* ApolloniusCircle.SetCircles/Compute, transcribed from the bytecode.
   * The applet calls SetCircles(inc[0], inc[N-3], inc[N/2-1]) and then
   * Compute(-1,-1,-1); result[0] is TCircle for an even-sided polygon. */
  function apolloniusTangent(c0, c1, c2) {
    const A1 = 2 * (c1.center.x - c0.center.x);
    const A2 = 2 * (c2.center.x - c0.center.x);
    const B1 = 2 * (c1.center.y - c0.center.y);
    const B2 = 2 * (c2.center.y - c0.center.y);
    const info = (c) => c.center.x * c.center.x + c.center.y * c.center.y - c.radius * c.radius;
    const o = info(c0);
    const D1 = o - info(c1);
    const D2 = o - info(c2);
    const K = A1 * B2 - A2 * B1;
    if (Math.abs(K) < 0.01) return null;
    const G = (B1 * D2 - B2 * D1) / K;
    const I = -(A1 * D2 - A2 * D1) / K;
    const e1 = 2 * (c1.radius - c0.radius);
    const e2 = 2 * (c2.radius - c0.radius);
    const x0 = (B1 * e2 - B2 * e1) / K;
    const y0 = -(A1 * e2 - A2 * e1) / K;
    const w = x0 * x0 + y0 * y0 - 1;
    const t = 2 * (x0 * G + y0 * I - x0 * c0.center.x - y0 * c0.center.y - c0.radius);
    const q = G * G + I * I - 2 * G * c0.center.x - 2 * I * c0.center.y + o;
    const disc = t * t - 4 * w * q;
    if (disc < 0 || Math.abs(w) < 1e-14) return null;
    /* Compute() keeps the signed root for the centre and takes |r| only for
     * the drawn radius; result[0] is the first (signed) root. */
    const signed = (-t + Math.sqrt(disc)) / (2 * w);
    if (signed === 0) return null;
    return {
      center: point(x0 * signed + G, y0 * signed + I),
      radius: Math.abs(signed),
    };
  }

  /** Reset(): the N vertices at theta + k*(2*PI/N) on the circumcircle. */
  function layout(n, angle) {
    const step = 2 * Math.PI / n;
    const v = [];
    for (let k = 0; k < n; k++) {
      const a = angle + k * step;
      v.push(point(CENTER.x + RADIUS * Math.cos(a), CENTER.y + RADIUS * Math.sin(a)));
    }
    return v;
  }

  /** The position a new diagram starts from: N=5, A at the top, boxes off. */
  function start(options) {
    const o = options || {};
    const settings = {};
    for (const key of OPTION_KEYS) settings[key] = !!(o.options && o.options[key]);
    return {
      n: nOf(o.n === undefined ? N_MIN : o.n, N_MIN),
      angle: angleOf(o.angle === undefined ? START_ANGLE : o.angle, false),
      options: settings,
      explored: false,
    };
  }

  /** Reset() rebuilds the vertices but leaves the options alone; here it
   *  also returns A to the top of the circle. */
  function reset(state) {
    return {
      n: state.n, angle: START_ANGLE,
      options: Object.assign({}, state.options), explored: state.explored,
    };
  }

  function setN(state, value) {
    const n = nOf(value, state.n);
    if (n === state.n) return state;
    return { n: n, angle: state.angle, options: state.options, explored: true };
  }

  /** Dragging A rotates all vertices by the same amount (a rigid motion). */
  function setAngle(state, value) {
    const angle = angleOf(value, true);
    if (angle === state.angle) return state;
    return { n: state.n, angle: angle, options: state.options, explored: true };
  }

  function setOption(state, key, on) {
    if (OPTION_KEYS.indexOf(key) < 0 || !!state.options[key] === !!on) return state;
    const options = Object.assign({}, state.options);
    options[key] = !!on;
    return { n: state.n, angle: state.angle, options: options, explored: true };
  }

  /** An illustration has no win, loss or end; "done" comes from explored. */
  function result(state) {
    return null;
  }

  function spread(points, circle) {
    if (!circle) return Infinity;
    let worst = 0;
    for (const p of points) worst = Math.max(worst, Math.abs(dist(p, circle.center) - circle.radius));
    return worst;
  }

  /** Everything Reset() builds, plus honest measurements of the five claims. */
  function geometry(state) {
    if (!state || !Number.isInteger(state.n) || state.n < N_MIN || state.n > N_MAX) return null;
    const n = state.n;
    const V = layout(n, state.angle);
    const triangles = [];
    for (let k = 1; k < n - 1; k++) {
      const verts = [V[0], V[k], V[k + 1]];
      triangles.push({
        index: k - 1,
        vertices: verts,
        incircle: incircleFrom3(verts[0], verts[1], verts[2]),
        centroid: point((verts[0].x + verts[1].x + verts[2].x) / 3,
                        (verts[0].y + verts[1].y + verts[2].y) / 3),
        bisectorFoot: angleBisectorFoot(verts[0], verts[1], verts[2]),
      });
    }
    const incircles = triangles.map((t) => t.incircle);
    const centroids = triangles.map((t) => t.centroid);
    const feet = triangles.map((t) => t.bisectorFoot);
    const half = Math.floor((n - 2) / 2);

    /* ICircle / CCircle: circumcircle of the first, last and middle point. */
    const iCircle = circleFrom3(incircles[0].center, incircles[n - 3].center, incircles[half].center);
    const cCircle = circleFrom3(centroids[0], centroids[n - 3], centroids[half]);

    /* TCircle: the Apollonius circle for even N, the circle with diameter
     * A--M (M the midpoint of the far side) for odd N. */
    let tCircle;
    if (n % 2 === 0) {
      tCircle = apolloniusTangent(incircles[0], incircles[n - 3], incircles[n / 2 - 1]);
    } else {
      const far = midpoint(V[(n - 1) / 2], V[(n + 1) / 2]);
      tCircle = { center: midpoint(V[0], far), radius: dist(V[0], far) / 2 };
    }

    /* ACircle: the applet picks AB[0], AB[N-3], and AB[1] only for N=5,
     * otherwise AB[(N-1)/2]. */
    const footIndex = n === 5 ? 1 : Math.floor((n - 1) / 2);
    const aCircle = circleFrom3(feet[0], feet[n - 3], feet[footIndex]);

    /* Honest residuals, in board units. */
    const tol = 1e-7 * RADIUS;
    /* The tangent circle encloses every incircle, so their tangency is
     * internal: |XY| = |r_t - r_inc|. */
    let tIncircleError = Infinity;
    if (tCircle) {
      tIncircleError = 0;
      for (const inc of incircles) {
        tIncircleError = Math.max(tIncircleError,
          Math.abs(dist(tCircle.center, inc.center) - Math.abs(tCircle.radius - inc.radius)));
      }
    }
    const tOuterError = tCircle
      ? Math.abs(dist(tCircle.center, CENTER) + tCircle.radius - RADIUS) : Infinity;
    const cSideError = Math.max(distToLine(cCircle.center, V[0], V[1]),
                                distToLine(cCircle.center, V[0], V[n - 1])) - cCircle.radius;

    /* The page's own formula: a_k = 2R |cos(pi*k/N)| for the diagonals. */
    let diagonalError = 0;
    for (let k = 1; k < n; k++) {
      diagonalError = Math.max(diagonalError,
        Math.abs(dist(V[0], V[k]) - 2 * RADIUS * Math.abs(Math.cos(Math.PI * k / n))));
    }

    const iSpread = spread(incircles.map((c) => c.center), iCircle);
    const cSpread = spread(centroids, cCircle);
    const aSpread = spread(feet, aCircle);

    return {
      n: n, angle: state.angle, center: CENTER, radius: RADIUS,
      vertices: V, triangles: triangles, incircles: incircles,
      centroids: centroids, feet: feet,
      iCircle: iCircle, cCircle: cCircle, tCircle: tCircle, aCircle: aCircle,
      measures: {
        iSpread, cSpread, aSpread, tIncircleError, tOuterError,
        cSideError, diagonalError, tol,
      },
      claims: {
        incentersConcyclic: iSpread <= tol,
        centroidsConcyclic: cSpread <= tol,
        bisectorFeetConcyclic: aSpread <= tol,
        tangentToIncircles: tIncircleError <= tol,
        tangentToCircumcircle: tOuterError <= tol,
        centroidCircleTangentToSides: Math.abs(cSideError) <= tol,
        diagonalFormula: diagonalError <= tol,
      },
      valid: true,
    };
  }

  /** The status line: tell the player what is on screen in plain words. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move the polygon so its points are different places.";
    const shown = OPTION_KEYS.filter((k) => state.options[k]);
    const triangles = g.n - 2;
    if (shown.length === 0) {
      return `${g.n}-gon split into ${triangles} triangles from the top corner. ` +
        "Tick a box to show the circles.";
    }
    const bits = [];
    if (state.options.incenters || state.options.iCircle) {
      bits.push(g.claims.incentersConcyclic
        ? `${triangles} incenters on one circle`
        : `only the first few incenters share a circle at ${g.n} sides`);
    }
    if (state.options.centroids || state.options.cCircle) {
      bits.push(g.claims.centroidsConcyclic
        ? `${triangles} centroids on another circle`
        : "centroids that do not all fit one circle");
    }
    if (state.options.bisectors || state.options.aCircle) {
      bits.push(g.claims.bisectorFeetConcyclic
        ? `${triangles} bisector feet on a third circle`
        : `only some bisector feet share a circle at ${g.n} sides`);
    }
    if (state.options.incircles || state.options.tCircle) {
      bits.push("a circle touching every incircle and the outer circle");
    }
    const worst = Math.max(g.measures.iSpread, g.measures.cSpread, g.measures.aSpread);
    return bits.join(", ") + `. Largest gap from a circle ${worst.toExponential(1)} units. ` +
      "Drag the top corner to turn the whole picture.";
  }

  /** Plain data for Track.state() and the tutor: the board units matter. */
  function snapshot(state) {
    return {
      n: state.n, angle: state.angle,
      options: Object.assign({}, state.options),
      vertices: layout(state.n, state.angle),
      explored: state.explored,
    };
  }

  return {
    VIEW, CENTER, RADIUS, N_MIN, N_MAX, START_ANGLE, OPTION_KEYS,
    start, reset, setN, setAngle, setOption, result,
    geometry, describe, snapshot,
    /* exported for the independent tests in porting/check-*.mjs */
    layout, circleFrom3, incircleFrom3, angleBisectorFoot,
    incenter, circumcenter, nearestPoint, distToLine,
  };
})();
