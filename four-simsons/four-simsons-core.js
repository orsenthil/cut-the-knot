"use strict";

/*
 * Four Simsons — Alexander Bogomolny's applet FourSimsons
 * ("Simsons and 9-Point Circles in Cyclic Quadrilateral").
 *
 * Four points A,B,C,D are dragged round one circle.  Each point has a Simson
 * line in the triangle made by the other three, and each of those four
 * triangles has a nine-point circle and a nine-point centre.  The page claims
 * that, while the quadrilateral is cyclic, all eight objects meet at one
 * point: the centre H of the homothety taking ABCD to the quadrilateral of
 * the four orthocentres.  For a non-cyclic quadrilateral the four Simson lines
 * become four pedal circles, and the eight circles still meet at one point.
 *
 * The arithmetic below is a transcription of the applet's bytecode:
 * GeoSDoub.FindAltitude/FindCircumcenter/Intersect/Dist and
 * FourSimsonsCanvas.FindOrthocenter/FindNinepointscenter/DrawNCircle/
 * DrawSimsonLine.  Notably the applet's nine-point radius is the *average* of
 * the distances from the nine-point centre to the three side midpoints, and
 * its Simson line joins just the first two of the three pedal feet.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, FourSimsonsCore, so the page loads it with
 * a plain <script> and porting/check-four-simsons.mjs loads it in Node.
 * Positions are plain data in the SVG viewBox units.
 */
const FourSimsonsCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const CENTER = { x: 200, y: 150 };  // applet: (WIDTH/2, HEIGHT/2)
  const RADIUS = 100;                 // applet: Math.min(WIDTH, HEIGHT) / 3

  /* Reset(): the four literal angles in the class file.  The third is
   * 7*PI/6 + a float 0.1, which keeps the start quadrilateral unsymmetric. */
  const START_ANGLES = [
    0.5235987755982988,
    2.6179938779914944,
    3.765191430678208,
    5.235987755982989,
  ];

  /* From the constructor: for vertex i the other three are Index[i]. */
  const INDEX = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]];
  const NAMES = ["A", "B", "C", "D"];
  const OPTION_NAMES = ["centers", "circles", "simsons"];

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  function onCircle(angle) {
    return point(CENTER.x + RADIUS * Math.cos(angle), CENTER.y + RADIUS * Math.sin(angle));
  }

  /** The angle of a dragged point, i.e. RestrictToCircle(Circle) in the applet. */
  function angleOf(p) {
    if (!finite(p)) return 0;
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

  /* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint): the line
   * p1p2 with the line p3p4.  The applet returns (NaN,NaN) when |den|<1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, a2 = p2.x - p1.x;
    const a3 = p1.x * p2.y - p1.y * p2.x;
    const b1 = p3.y - p4.y, b2 = p4.x - p3.x;
    const b3 = p3.x * p4.y - p3.y * p4.x;
    const den = a1 * b2 - b1 * a2;
    if (Math.abs(den) < 1) return point(NaN, NaN);
    return point((a2 * b3 - b2 * a3) / den, (a3 * b1 - b3 * a1) / den);
  }

  /* GeoSDoub.FindAltitude(P,A,B): the foot of the perpendicular from P to AB.
   * It intersects the line P->(P.x+B.y-A.y, P.y-B.x+A.x) with line AB. */
  function foot(p, a, b) {
    const q = point(p.x + b.y - a.y, p.y - b.x + a.x);
    return intersect(p, q, a, b);
  }

  /* GeoSDoub.FindCircumcenter(A,B,C): two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const q1 = point(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
    const q2 = point(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
    return intersect(m1, q1, m2, q2);
  }

  /* FourSimsonsCanvas.FindOrthocenter / FindNinepointscenter. */
  function orthocenter(a, b, c) {
    return intersect(a, foot(a, b, c), b, foot(b, a, c));
  }

  function ninePointCenter(a, b, c) {
    return midpoint(orthocenter(a, b, c), circumcenter(b, a, c));
  }

  /* FourSimsonsCanvas.DrawNCircle: centre N, radius = the mean of N's
   * distances to the three side midpoints (all three agree when N is exact). */
  function ninePointRadius(n, a, b, c) {
    return (dist(n, midpoint(a, b)) + dist(n, midpoint(a, c)) + dist(n, midpoint(b, c))) / 3;
  }

  /* FourSimsonsCanvas.DrawSimsonLine(P,A,B,C): the line through the feet from
   * P to BC and to AC.  The third foot (onto AB) is kept for the highlight. */
  function simsonLine(p, a, b, c) {
    const feet = [foot(p, b, c), foot(p, a, c), foot(p, a, b)];
    return { feet: feet, first: feet[0], second: feet[1], third: feet[2] };
  }

  /* The pedal circle of P in ABC: the circle through the three feet.  When P
   * lies on the circumcircle of ABC the three feet are collinear and this
   * circle degenerates into the Simson line. */
  function pedalCircle(p, a, b, c) {
    const s = simsonLine(p, a, b, c);
    const o = circumcenter(s.feet[0], s.feet[1], s.feet[2]);
    return { center: o, radius: dist(o, s.feet[0]) };
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
    return {
      angles: START_ANGLES.slice(),
      options: {
        centers: o.centers === undefined ? false : !!o.centers,
        circles: o.circles === undefined ? false : !!o.circles,
        simsons: o.simsons === undefined ? false : !!o.simsons,
      },
      selected: -1,
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = !!state.explored;
    return s;
  }

  /** A point of the diagram is kept on the circle, exactly as in the applet. */
  function move(state, name, p) {
    const i = NAMES.indexOf(name);
    if (i < 0 || state.angles.length !== 4) return state;
    const a = typeof p === "number" ? p : angleOf(p);
    if (!Number.isFinite(a)) return state;
    const angles = state.angles.slice();
    angles[i] = a;
    return Object.assign({}, state, { angles: angles, explored: true });
  }

  function setOption(state, name, on) {
    if (OPTION_NAMES.indexOf(name) < 0) return state;
    const options = Object.assign({}, state.options, { [name]: !!on });
    if (name === "simsons" && !on) return Object.assign({}, state, { options: options, selected: -1, explored: true });
    return Object.assign({}, state, { options: options, explored: true });
  }

  /** The highlighted Simson line, or -1 to clear the extra information. */
  function select(state, index) {
    if (!state.options.simsons || !Number.isInteger(index)) return state;
    return Object.assign({}, state, { selected: index >= 0 && index < 4 ? index : -1, explored: true });
  }

  /* mouseClicked(): choose the closest Simson line if it is within 2 px. */
  function clickSimson(state, p) {
    if (!state.options.simsons || !finite(p)) return -1;
    const g = geometry(state);
    if (!g) return -1;
    let best = 2.0, which = -1;
    for (let i = 0; i < 4; i++) {
      const s = g.simsons[i];
      const d = distToLine(p, s.first, s.second);
      if (d < best) { which = i; best = d; }
    }
    return which;
  }

  /**
   * All the points and lines of the drawing, from the four vertices.
   * Returns null for a degenerate position (the applet's own Intersect then
   * produces NaN), so the page can hide the construction instead of drawing it.
   */
  function compute(a, b, c, d) {
    const pts = [a, b, c, d];
    if (!pts.every(finite)) return null;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) if (dist(pts[i], pts[j]) < 1e-7) return null;
    }

    const triangles = INDEX.map((ix) => ix.map((i) => pts[i]));
    const centers = triangles.map((t) => ninePointCenter(t[0], t[1], t[2]));
    const orthocenters = triangles.map((t) => orthocenter(t[0], t[1], t[2]));
    const circles = centers.map((n, i) => ({
      center: n, radius: ninePointRadius(n, triangles[i][0], triangles[i][1], triangles[i][2]),
    }));
    const simsons = triangles.map((t, i) => simsonLine(pts[i], t[0], t[1], t[2]));
    const circum = circumcenter(a, b, c);
    const circumradius = dist(circum, a);
    const h = circumcenter(centers[0], centers[1], centers[2]);
    const hAgain = circumcenter(centers[1], centers[2], centers[3]);
    const homothetyMidpoints = pts.map((p, i) => midpoint(p, orthocenters[i]));

    if (![circum, h, hAgain].every(finite)
      || !centers.every(finite) || !orthocenters.every(finite)
      || circles.some((c) => !finite(c.center) || !Number.isFinite(c.radius))
      || simsons.some((s) => !s.feet.every(finite))) return null;

    const scale = Math.max(1, circumradius,
      dist(a, b), dist(b, c), dist(c, d), dist(d, a), dist(a, c), dist(b, d));
    const tol = 1e-7 * scale;

    /* The eight concurrence errors, all measured at the same point H. */
    const circleError = Math.max(...circles.map((c) => Math.abs(dist(c.center, h) - c.radius)));
    const simsonError = Math.max(...simsons.map((s) => distToLine(h, s.first, s.second)));
    const homothetyError = Math.max(...homothetyMidpoints.map((m) => dist(m, h)));
    const radiusError = Math.max(...circles.map((c) => Math.abs(c.radius - circumradius / 2)));
    const nQuadError = dist(h, hAgain);
    let similarityError = 0, collinearError = 0;
    for (let i = 0; i < 4; i++) {
      collinearError = Math.max(collinearError, distToLine(simsons[i].third, simsons[i].first, simsons[i].second));
      for (let j = i + 1; j < 4; j++) {
        similarityError = Math.max(similarityError,
          Math.abs(dist(centers[i], centers[j]) - dist(pts[i], pts[j]) / 2));
      }
    }

    const claims = {
      circlesConcurrent: circleError <= tol,
      simsonsConcurrent: simsonError <= tol,
      homothetyMidpoints: homothetyError <= tol,
      ninePointRadiusHalfR: radiusError <= tol,
      nQuadSimilarHalf: similarityError <= tol,
      nQuadCircumcenter: nQuadError <= tol,
      pedalFeetCollinear: collinearError <= tol,
      cyclic: Math.abs(dist(a, circum) - circumradius) <= tol
        && Math.abs(dist(b, circum) - circumradius) <= tol
        && Math.abs(dist(c, circum) - circumradius) <= tol
        && Math.abs(dist(d, circum) - circumradius) <= tol,
    };

    return {
      A: a, B: b, C: c, D: d, points: pts,
      triangles: triangles, INDEX: INDEX,
      centers: centers, orthocenters: orthocenters, circles: circles,
      simsons: simsons, circumcenter: circum, circumradius: circumradius,
      H: h, homothetyMidpoints: homothetyMidpoints,
      measures: {
        circleError: circleError, simsonError: simsonError,
        homothetyError: homothetyError, radiusError: radiusError,
        nQuadError: nQuadError, similarityError: similarityError,
        collinearError: collinearError,
      },
      claims: claims, tol: tol,
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
    let text = "Drag A, B, C or D around the circle: all four corners stay on it.";
    if (state.options.circles || state.options.simsons) {
      text = g.claims.circlesConcurrent && g.claims.simsonsConcurrent
        ? "The four nine-point circles and four Simson lines meet at one point."
        : "The four circles and lines should meet at one point, but this shape is too thin to measure.";
    }
    if (state.options.centers) text += " The small dots are the four nine-point centres.";
    if (state.options.simsons) {
      if (state.selected >= 0) {
        text += ` Looking at ${NAMES[state.selected]}'s Simson line: its three feet on the opposite triangle lie in a row.`;
      } else {
        text += " Click a Simson line to see its three perpendicular feet.";
      }
    }
    return text;
  }

  return {
    VIEW: VIEW, CENTER: CENTER, RADIUS: RADIUS,
    START_ANGLES: START_ANGLES, INDEX: INDEX, NAMES: NAMES,
    OPTION_NAMES: OPTION_NAMES,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, finite: finite, onCircle: onCircle,
    angleOf: angleOf, projectToCircle: projectToCircle,
    intersect: intersect, foot: foot, circumcenter: circumcenter,
    orthocenter: orthocenter, ninePointCenter: ninePointCenter,
    ninePointRadius: ninePointRadius, simsonLine: simsonLine,
    pedalCircle: pedalCircle, distToLine: distToLine,
    start: start, reset: reset, move: move, setOption: setOption,
    select: select, clickSimson: clickSimson,
    compute: compute, geometry: geometry, result: result, describe: describe,
  };
})();
