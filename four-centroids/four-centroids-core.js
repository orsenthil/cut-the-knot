"use strict";

/*
 * Four Centroids — Alexander Bogomolny's applet FourCentroids.
 *
 * A point P and a triangle ABC give three more triangles ABP, BCP and CAP.
 * Their centroids are Gc = (A+B+P)/3, Ga = (B+C+P)/3 and Gb = (C+A+P)/3;
 * G = (A+B+C)/3 is the centroid of ABC.  Then
 *
 *     G - Ga = (A - P)/3,   G - Gb = (B - P)/3,   G - Gc = (C - P)/3,
 *
 * so the three lines through Ga, Gb, Gc parallel to AP, BP, CP all pass
 * through G.  Writing J = (A+B+C+P)/4 = (3G+P)/4 gives
 *
 *     Ga = J - (A - J)/3,   Gb = J - (B - J)/3,   Gc = J - (C - J)/3,
 *
 * so ABC and GaGbGc are homothetic about J with coefficient -1/3: their
 * sides are parallel and one third as long, and GJ : JP = 1 : 3.
 *
 * The page also says "Let U be the midpoint of AG.  In BCU, CGb : GbU = 2:1
 * and BGc : GcU = 2:1".  With U the midpoint of AG that is false for a moving
 * P; the 2:1 split holds when U is the midpoint of AP.  The conclusion
 * GbGc || BC and GbGc : BC = 1:3 holds either way, because Gb - Gc =
 * (C - B)/3.  porting/check-four-centroids.mjs tests both versions.
 *
 * The applet has four checkboxes — names, statement 1, statement 2, premises
 * — and four draggable points.  There is no win, loss, score or ending.
 * This file is only the geometry and the state: no document, no window, no
 * storage.  It defines one global, FourCentroidsCore, so the page loads it
 * with a plain <script> and porting/check-four-centroids.mjs loads it in Node.
 * All coordinates are plain numbers in the SVG viewBox units.
 */
const FourCentroidsCore = (() => {
  /* The applet's WIDTH/HEIGHT parameters suggest 400 by 300. */
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 12;                       /* room for a handle and its label */
  const NAMES = ["A", "B", "C"];
  const OPTION_KEYS = ["names", "statement1", "statement2", "premises"];

  const point = (x, y) => ({ x: x, y: y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const midpoint3 = (p, q, r) => point((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function valid(p) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  }

  /** Keep a draggable point inside the board. */
  function clampPoint(p) {
    if (!valid(p)) return null;
    return point(
      clamp(p.x, VIEW.x + PAD, VIEW.x + VIEW.width - PAD),
      clamp(p.y, VIEW.y + PAD, VIEW.y + VIEW.height - PAD),
    );
  }

  /* init(): A[0] = (W*4/5, H*4/5), A[1] = (W/3, H/6), A[2] = (W/5, H*4/5)
   * (Java integer division) and P is the centre of DoubCircle(W/2, H*13/20,
   * min(W,H)/2).  The radius is only the circle's own business. */
  function appletLayout() {
    const w = VIEW.width, h = VIEW.height;
    const A = [
      point(Math.trunc((w * 4) / 5), Math.trunc((h * 4) / 5)),
      point(Math.trunc(w / 3), Math.trunc(h / 6)),
      point(Math.trunc(w / 5), Math.trunc((h * 4) / 5)),
    ];
    const P = point(Math.trunc(w / 2), Math.trunc((h * 13) / 20));
    return { A: A, P: P };
  }

  /** The position a new diagram starts from.  `show: "1"` checks names, as
   *  the applet's panel does with getParameter("show"). */
  function start(options) {
    const o = options || {};
    const layout = appletLayout();
    return {
      A: layout.A,
      P: layout.P,
      show: {
        names: o.show === "1",
        statement1: false,
        statement2: false,
        premises: false,
      },
      explored: false,
    };
  }

  /* The applet has no Reset button.  This convenience control restores its
   * starting points but keeps the four checkbox states. */
  function reset(state) {
    const s = start({ show: state.show.names ? "1" : "0" });
    s.show = Object.assign({}, state.show);
    s.explored = state.explored;
    return s;
  }

  /** One of the panel's four checkboxes. */
  function setShow(state, key, on) {
    if (OPTION_KEYS.indexOf(key) < 0) return state;
    return Object.assign({}, state, {
      show: Object.assign({}, state.show, { [key]: !!on }),
      explored: true,
    });
  }

  /** Drag A, B, C or P.  An unknown name or a bad point leaves the state. */
  function movePoint(state, name, p) {
    const q = clampPoint(p);
    if (!q) return state;
    if (name === "P") return Object.assign({}, state, { P: q, explored: true });
    const i = NAMES.indexOf(name);
    if (i < 0) return state;
    const A = state.A.slice();
    A[i] = q;
    return Object.assign({}, state, { A: A, explored: true });
  }

  /* GeoSDoub.Intersect(p1, p2, p3, p4), with a scale-aware parallel test. */
  function intersect(p, q, r, s) {
    const v = sub(q, p), w = sub(s, r);
    const den = cross(v, w);
    const size = Math.hypot(v.x, v.y) * Math.hypot(w.x, w.y);
    if (size === 0 || Math.abs(den) <= 1e-12 * size) return null;
    const t = cross(sub(r, p), w) / den;
    return add(p, mul(v, t));
  }

  function distToLine(p, a, b) {
    const v = sub(b, a);
    const n = Math.hypot(v.x, v.y);
    if (n === 0) return dist(p, a);
    return Math.abs(cross(sub(p, a), v)) / n;
  }

  /** True when ratio(a, b) is r, ignoring a zero-length reference. */
  function ratioOK(a, b, r, tol) {
    if (a <= tol || b <= tol) return true;
    return Math.abs(a / b - r) <= 1e-7 * r;
  }

  /* The page's U is the midpoint of AG; the working proof needs the midpoint
   * of AP.  Return both, with the 2:1 checks on the corresponding triangle
   * BCU, so the test can show exactly which one is wrong. */
  function uCheck(A, G, P, Ga, Gb, Gc) {
    const uPage = midpoint(A[0], G);
    const uTrue = midpoint(A[0], P);
    const split = (u, pointOnC, pointOnB) => {
      const cu = dist(u, A[2]), bu = dist(u, A[1]);
      const cg = dist(pointOnC, A[2]), bg = dist(pointOnB, A[1]);
      const gu = dist(u, pointOnC), gub = dist(u, pointOnB);
      return ratioOK(cg, gu, 2, 1e-7) && ratioOK(bg, gub, 2, 1e-7)
        && cu > 1e-7 && bu > 1e-7;
    };
    return {
      pageMidpoint: uPage,
      workingMidpoint: uTrue,
      pageClaim: split(uPage, Gb, Gc),
      workingClaim: split(uTrue, Gb, Gc),
      /* Gb - Gc = (C - B)/3, whatever U is. */
      sideParallel: distToLine(sub(Gb, Gc), point(0, 0), sub(A[2], A[1])) <= 1e-7,
      sideRatio: dist(Gb, Gc) * 3 - dist(A[1], A[2]),
    };
  }

  /** Compute(): all the points the applet draws, plus checks of the claims. */
  function geometry(state) {
    if (!state || !Array.isArray(state.A) || state.A.length !== 3
        || !state.A.every(valid) || !valid(state.P)) return null;
    const A = state.A, P = state.P;
    const M = [], N = [], G = [];
    for (let i = 0; i < 3; i++) {
      const k1 = (i + 1) % 3, k2 = (i + 2) % 3;
      M.push(midpoint(A[k1], A[k2]));
      N.push(midpoint(P, A[i]));
      G.push(midpoint3(P, A[k1], A[k2]));
    }
    G.push(midpoint3(A[0], A[1], A[2]));
    const Gabc = G[3];

    /* J in the applet is the average of the three pairwise intersections of
     * A[i]G[i].  It must agree with (A+B+C+P)/4. */
    const x01 = intersect(A[0], G[0], A[1], G[1]);
    const x12 = intersect(A[1], G[1], A[2], G[2]);
    const x20 = intersect(A[2], G[2], A[0], G[0]);
    const J = x01 && x12 && x20 ? midpoint3(x01, x12, x20) : null;
    const Jformula = mul(add(add(add(A[0], A[1]), A[2]), P), 1 / 4);

    let scale = 1;
    for (const q of A.concat([P])) scale = Math.max(scale, dist(q, Gabc));
    const tol = 1e-9 * scale;

    /* Statement 1: the line through G[i] parallel to A[i]P goes through G. */
    let parallelError = 0, parallelDirectionError = 0;
    for (let i = 0; i < 3; i++) {
      const dir = sub(A[i], P);
      parallelError = Math.max(parallelError, distToLine(Gabc, G[i], add(G[i], dir)));
      parallelDirectionError = Math.max(parallelDirectionError,
        distToLine(add(Gabc, dir), G[i], add(G[i], dir)));
      parallelError = Math.max(parallelError, parallelDirectionError);
    }

    /* Statement 2: sides of GaGbGc are parallel to ABC and a third as long;
     * GJ : JP = 1 : 3; J is the centre of the homothety of coefficient -1/3. */
    let sideError = 0, sideRatioError = 0, centerError = 0, homothetyError = 0;
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      sideError = Math.max(sideError, distToLine(sub(G[j], G[i]), point(0, 0), sub(A[j], A[i])));
      sideRatioError = Math.max(sideRatioError, Math.abs(dist(G[j], G[i]) * 3 - dist(A[i], A[j])));
      homothetyError = Math.max(homothetyError, dist(G[i], add(Jformula, mul(sub(A[i], Jformula), -1 / 3))));
    }
    const gj = dist(Gabc, Jformula), jp = dist(Jformula, P);
    const centerRatioOK = ratioOK(gj, jp, 1 / 3, tol);
    const jError = J ? dist(J, Jformula) : Infinity;

    /* The midpoint L of a side: LG : LA = 1 : 3 and LG[i] : LP = 1 : 3. */
    let midpointError = 0;
    for (let i = 0; i < 3; i++) {
      midpointError = Math.max(midpointError,
        Math.abs(dist(M[i], Gabc) * 3 - dist(M[i], A[i])),
        Math.abs(dist(M[i], G[i]) * 3 - dist(M[i], P)));
    }

    const U = uCheck(A, Gabc, P, G[0], G[1], G[2]);
    const degenerate = scale <= 1e-9 || !J;
    return {
      A: A, P: P, G: G, Gabc: Gabc, M: M, N: N, J: J, Jformula: Jformula,
      x01: x01, x12: x12, x20: x20,
      U: U,
      measures: {
        parallelError: parallelError, sideError: sideError,
        sideRatioError: sideRatioError, homothetyError: homothetyError,
        midpointError: midpointError, centerRatioError: Math.abs(gj / (jp || 1) - 1 / 3),
        jError: jError, scale: scale, tol: tol,
      },
      claims: {
        parallels: parallelError <= tol,
        homothetic: sideError <= tol && sideRatioError <= 1e-7 * scale && homothetyError <= tol,
        midpointRatios: midpointError <= 1e-7 * scale,
        centerRatio: centerRatioOK,
        intersectionsAgree: jError <= tol,
        pageU: U.pageClaim,
        workingU: U.workingClaim,
      },
      degenerate: degenerate,
    };
  }

  /** A plain-English status line for #status. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move the four points to see the construction.";
    if (g.degenerate) return "Pull the points apart so the lines have room to meet.";
    const s = state.show;
    const bits = ["Ga, Gb and Gc are the centroids of the three triangles around P."];
    if (s.statement1) bits.push("The dashed lines through them run parallel to AP, BP and CP and meet at G.");
    if (s.statement2) bits.push("G and P are lined up with J, and GJ is one third of JP.");
    if (s.premises) bits.push("L, M, N and U, V, W are the midpoints used in the proof.");
    if (!s.statement1 && !s.statement2 && !s.premises) {
      bits.push("Tick statement 1 or statement 2 to draw the two halves of the claim.");
    }
    return bits.join(" ");
  }

  /* An illustration has no win, no loss and no finishing move. */
  function result(state) {
    return null;
  }

  /** The plain, storable position for Track.state() and the tutor. */
  function snapshot(state) {
    const g = geometry(state);
    return {
      A: state.A.map((p) => point(p.x, p.y)),
      P: point(state.P.x, state.P.y),
      show: Object.assign({}, state.show),
      G: g ? g.G.map((p) => point(p.x, p.y)) : null,
      Gabc: g ? point(g.Gabc.x, g.Gabc.y) : null,
      J: g && g.J ? point(g.J.x, g.J.y) : null,
      claims: g ? g.claims : null,
    };
  }

  return {
    VIEW: VIEW, PAD: PAD, NAMES: NAMES, OPTION_KEYS: OPTION_KEYS,
    point: point, add: add, sub: sub, mul: mul, midpoint: midpoint,
    midpoint3: midpoint3, dist: dist, dot: dot, cross: cross, clamp: clamp,
    clampPoint: clampPoint, appletLayout: appletLayout,
    intersect: intersect, distToLine: distToLine, uCheck: uCheck,
    start: start, reset: reset, setShow: setShow, movePoint: movePoint,
    geometry: geometry, describe: describe, result: result, snapshot: snapshot,
  };
})();
