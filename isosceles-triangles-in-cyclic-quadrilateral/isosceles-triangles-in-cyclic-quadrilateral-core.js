"use strict";

/*
 * Parallel Lines in a Cyclic Quadrilateral — Alexander Bogomolny's applet
 * IsoscelesTrianglesInCyclicQuadrilateral ("A Mathematical Droodle").
 *
 * Four points A, B, C, D sit on a circle.  M is placed on the line AC so that
 * AM = AD, and N on BD so that BN = BC.  The page asks us to prove that, when
 * M and N are different points, MN is parallel to AB.  The key idea is that
 * triangles AGD and BGC are similar (G = AC ∩ BD), so AD/AG = BC/BG; the two
 * points M and N are therefore the same enlargement of A and B about G, and
 * MN is a scaled copy of AB.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, IsoscelesTrianglesInCyclicQuadrilateralCore,
 * so the page loads it with a plain <script> and porting/check-...mjs loads it
 * in Node.  Positions are plain data in the SVG viewBox units.
 *
 * The arithmetic below is a direct transcription of the applet's bytecode:
 *   Compute(): G = GeoSDoub.Intersect(A,C,B,D)
 *              M = CTKGeometryPlus.Prorate(A,C,GeoSDoub.Dist(A,D))
 *              N = CTKGeometryPlus.Prorate(B,D,GeoSDoub.Dist(B,C))
 *              MN = new DoubLine(M,N)
 *              centre of the names = CTKGeometryPlus.Barycenter(M,N,G)
 *   Reset():   circle centre (W/2,H/2), radius floor(min(W,H)/4), points at
 *              angles PI/6, 5*PI/6, 3.765191430678208, 5*PI/3.
 *   SetPoint(): RestrictToCircle — dragging projects a point back onto the circle.
 * The four checkboxes start unchecked.
 */
const IsoscelesTrianglesInCyclicQuadrilateralCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const CIRCLE = {
    center: { x: VIEW.width / 2, y: VIEW.height / 2 },
    radius: Math.floor(Math.min(VIEW.width, VIEW.height) / 4),
  };
  const START_ANGLES = [Math.PI / 6, 5 * Math.PI / 6, 3.765191430678208, 5 * Math.PI / 3];
  const NAMES = ["A", "B", "C", "D"];
  const OPTIONS = ["premise", "statement", "hint", "names"];

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));

  const finitePoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const scaleOf = () => CIRCLE.radius;

  /* GeoSDoub.Intersect(a,b,c,d): the 2x2 solve, with its |denominator| < 1
   * guard returning a point at NaN.  This is an intersection of *lines*, not
   * of segments: dragging the points past one another is allowed. */
  function intersect(a, b, c, d) {
    const a1 = b.y - a.y;
    const b1 = a.x - b.x;
    const c1 = a.x * b.y - a.y * b.x;
    const a2 = d.y - c.y;
    const b2 = c.x - d.x;
    const c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (!(Math.abs(den) >= 1)) return point(NaN, NaN);
    return point((c1 * b2 - c2 * b1) / den, (a1 * c2 - a2 * c1) / den);
  }

  /* CTKGeometryPlus.Prorate(p,q,r): walk from p toward q a distance r.  When
   * p and q are nearer than 0.1 the applet returns p (its short-distance
   * guard); otherwise the point can lie beyond q. */
  function prorate(p, q, r) {
    const d = dist(p, q);
    if (d < 0.1) return point(p.x, p.y);
    const t = r / d;
    return point(p.x + t * (q.x - p.x), p.y + t * (q.y - p.y));
  }

  /* CTKGeometryPlus.Barycenter(p,q,r) — component-wise average of three. */
  function barycenter(p, q, r) {
    return point((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
  }

  function onCircle(theta) {
    return point(
      CIRCLE.center.x + CIRCLE.radius * Math.cos(theta),
      CIRCLE.center.y + CIRCLE.radius * Math.sin(theta),
    );
  }

  /** CTKMoveableDoub.RestrictToCircle: radial projection to the circle. */
  function clampPoint(p, fallback) {
    const dx = p && p.x - CIRCLE.center.x;
    const dy = p && p.y - CIRCLE.center.y;
    const n = Math.hypot(dx, dy);
    if (!Number.isFinite(n) || n < 1e-9) return fallback ? point(fallback.x, fallback.y) : onCircle(START_ANGLES[0]);
    return point(
      CIRCLE.center.x + (CIRCLE.radius * dx) / n,
      CIRCLE.center.y + (CIRCLE.radius * dy) / n,
    );
  }

  /** The position a new diagram starts from, decoded from Reset(). */
  function start(options) {
    const o = options || {};
    const opts = {};
    for (const name of OPTIONS) opts[name] = o[name] === undefined ? false : !!o[name];
    const result = { options: opts, explored: false };
    START_ANGLES.forEach((theta, i) => { result[NAMES[i]] = onCircle(theta); });
    return result;
  }

  function reset(state) {
    const next = start(state.options);
    next.explored = !!state.explored;
    return next;
  }

  function move(state, name, p) {
    if (NAMES.indexOf(name) < 0 || !finitePoint(p)) return state;
    const next = Object.assign({}, state);
    next[name] = clampPoint(p, state[name]);
    next.explored = true;
    return next;
  }

  function setOption(state, name, on) {
    if (OPTIONS.indexOf(name) < 0) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /* The angle at `vertex`, from GeoSDoub.ComputeAngle's law-of-cosines form. */
  function angle(p, vertex, q) {
    const a = dist(vertex, p);
    const b = dist(vertex, q);
    const c = dist(p, q);
    if (a < 1e-12 || b < 1e-12) return NaN;
    const cosphi = (a * a + b * b - c * c) / (2 * a * b);
    return Math.acos(Math.max(-1, Math.min(1, cosphi)));
  }

  /**
   * IsoscelesTrianglesInCyclicQuadrilateralCanvas.Compute(), with the
   * measurements the page's claims are checked against.  Returns null if any
   * corner is missing or not a finite point.
   */
  function compute(A, B, C, D) {
    if (![A, B, C, D].every(finitePoint)) return null;
    const G = intersect(A, C, B, D);
    const M = prorate(A, C, dist(A, D));
    const N = prorate(B, D, dist(B, C));
    const nameCenter = barycenter(M, N, G);

    const scale = scaleOf();
    const tol = 1e-9 * scale;
    const gFinite = finitePoint(G);

    /* The page's equalities and ratios.  The parallel test is the size of the
     * cross product of MN with AB, divided by |AB| times the circle radius:
     * zero exactly when the two directions agree. */
    const amError = Math.abs(dist(A, M) - dist(A, D));
    const bnError = Math.abs(dist(B, N) - dist(B, C));
    const parallelCross = cross(sub(M, N), sub(B, A));
    const parallelError = Math.abs(parallelCross) / Math.max(1e-12, dist(A, B) * scale);
    const angleCAD = angle(C, A, D);
    const angleCBD = angle(C, B, D);
    const inscribedError = Math.abs(angleCAD - angleCBD);
    const ag = gFinite ? dist(A, G) : NaN;
    const bg = gFinite ? dist(B, G) : NaN;
    const ratioAGAD = ag / dist(A, D);
    const ratioBGBC = bg / dist(B, C);
    const proportionError = Math.abs(ratioAGAD - ratioBGBC);
    const mAlongAC = Math.abs(cross(sub(M, A), sub(C, A))) / scale;
    const nAlongBD = Math.abs(cross(sub(N, B), sub(D, B))) / scale;
    const mn = dist(M, N);
    const mg = gFinite ? dist(M, G) : NaN;
    const ng = gFinite ? dist(N, G) : NaN;
    const similarityError = gFinite && mn > tol
      ? Math.abs(mg / Math.max(1e-12, ag) - ng / Math.max(1e-12, bg)) : 0;

    const tAC = gFinite ? dot(sub(G, A), sub(C, A)) / Math.max(1e-12, dist(A, C) * dist(A, C)) : NaN;
    const tBD = gFinite ? dot(sub(G, B), sub(D, B)) / Math.max(1e-12, dist(B, D) * dist(B, D)) : NaN;
    const corners = [A, B, C, D];
    let separated = true;
    for (let i = 0; i < 4 && separated; i++) {
      for (let j = i + 1; j < 4; j++) {
        if (dist(corners[i], corners[j]) <= 1e-6 * scale) { separated = false; break; }
      }
    }
    const crossing = separated && tAC > 0 && tAC < 1 && tBD > 0 && tBD < 1;

    const measures = {
      amError: amError, bnError: bnError, parallelError: parallelError,
      parallelCross: parallelCross, inscribedError: inscribedError,
      ratioAGAD: ratioAGAD, ratioBGBC: ratioBGBC, proportionError: proportionError,
      mAlongAC: mAlongAC, nAlongBD: nAlongBD, mn: mn,
      mg: mg, ng: ng, ag: ag, bg: bg, similarityError: similarityError,
      angleCAD: angleCAD, angleCBD: angleCBD, tAC: tAC, tBD: tBD,
    };
    const claims = {
      amEqualsAd: amError <= tol,
      bnEqualsBc: bnError <= tol,
      inscribedAnglesEqual: inscribedError <= tol,
      proportion: gFinite && proportionError <= tol,
      mnParallelAb: mn > tol && parallelError <= tol,
      mnDefined: mn > tol,
      mOnAc: mAlongAC <= tol,
      nOnBd: nAlongBD <= tol,
      similarTriangles: gFinite && mn > tol && similarityError <= tol,
      crossing: crossing,
    };

    /* The four things the applet's ShowHint() draws: arcs CAD, CBD, DGA and
     * BGC, plus the segments MD and NC.  ShowPremise() marks AM and AD with
     * two short ticks each and BN and BC with one tick each (LineID(2,4,4)). */
    const arcs = [
      { vertex: A, p: C, q: D, r: 22, kind: "equal-inscribed" },
      { vertex: B, p: C, q: D, r: 22, kind: "equal-inscribed" },
      { vertex: G, p: D, q: A, r: 16, kind: "vertical" },
      { vertex: G, p: B, q: C, r: 16, kind: "vertical" },
    ];
    const premiseTicks = [
      { p: A, q: M, count: 2 }, { p: A, q: D, count: 2 },
      { p: B, q: N, count: 1 }, { p: B, q: C, count: 1 },
    ];
    return {
      A: A, B: B, C: C, D: D, M: M, N: N, G: G,
      nameCenter: nameCenter,
      edges: [[A, B], [B, C], [C, D], [D, A]],
      chords: [[A, G], [B, G]],
      statementLines: [[A, B], [M, N]],
      hintLines: [[M, D], [N, C]],
      arcs: arcs, premiseTicks: premiseTicks,
      measures: measures, claims: claims, tol: tol,
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D);
  }

  /* A droodle has no win and no loss; the shared #status is only narration. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move the four points onto the circle.";
    if (!Number.isFinite(g.G.x)) {
      return "AC and BD are parallel, so G is off the board. M and N are still marked on the chords.";
    }
    if (!g.claims.mnDefined) {
      return "M and N have fallen together at G, so there is no line MN to compare with AB.";
    }
    let text = g.claims.mnParallelAb
      ? "MN is parallel to AB: AM equals AD and BN equals BC."
      : "The chords do not cross here, so MN need not be parallel to AB.";
    if (state.options.premise) text += " The tick marks show the two pairs of equal lengths.";
    if (state.options.statement) text += " The two grey lines are AB and MN.";
    if (state.options.hint) text += " The arcs show the equal angles that make the triangles similar.";
    if (state.options.names) text += " The points are labelled A, B, C, D, M, N and G.";
    return text;
  }

  return {
    VIEW: VIEW, CIRCLE: CIRCLE, START_ANGLES: START_ANGLES, NAMES: NAMES, OPTIONS: OPTIONS,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross, dist: dist,
    intersect: intersect, prorate: prorate, barycenter: barycenter, onCircle: onCircle,
    clampPoint: clampPoint, angle: angle,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, result: result, describe: describe,
  };
})();
