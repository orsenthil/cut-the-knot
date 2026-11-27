"use strict";

/*
 * Half Area Of Quadrilateral — Alexander Bogomolny's applet
 * HalfAreaOfQuadrilateral ("Dividing Evenly a Quadrilateral", problem 521 in
 * Kiselev's Planimetry).  Drag the four corners A,B,C,D of a quadrilateral.
 * K is the midpoint of the diagonal BD; the line through K parallel to the
 * other diagonal AC meets AB or AD at E.  The page claims that CE bisects the
 * area of the quadrilateral.
 *
 * The one idea the code relies on is the applet's own Compute(): it uses
 * GeoSDoub.GetParallelTo(K, A, C) to make a point 100 times (C-A) away from K,
 * intersects that line with AB and with AD, and takes the nearer intersection
 * as E.  Because K lies on side BD of triangle ABD, that nearer point always
 * lies on one of the two side segments.  Signed polygon areas then show the
 * two pieces [C,E,A,other] and [C,E,nearer corner] are equal.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, HalfAreaOfQuadrilateralCore, so the page
 * loads it with a plain <script> and porting/check-half-area-of-quadrilateral.mjs
 * loads it in Node.  Positions are plain data in the SVG viewBox units.
 */
const HalfAreaOfQuadrilateralCore = (() => {
  /* The applet's parameter info says WIDTH 400 and HEIGHT 250 are optimal. */
  const VIEW = { x: 0, y: 0, width: 400, height: 250 };
  /* Room for a handle and its label; the applet only kept drags 2px inside. */
  const PAD = 12;
  /* Compute() refuses to draw when any two corners are closer than this. */
  const MIN_SEPARATION = 1;

  const point = (x, y) => ({ x, y });
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** GeoSDoub.GetParallelTo(p,q,r) = p + 100*(r-q), literally. */
  function parallelTo(p, q, r) {
    return point(p.x + 100 * (r.x - q.x), p.y + 100 * (r.y - q.y));
  }

  /** GeoSDoub.Intersect(p,q,r,s): lines through the two pairs of points. */
  function intersect(p, q, r, s) {
    const l4 = p.y - q.y;
    const l6 = q.x - p.x;
    const l8 = p.x * q.y - p.y * q.x;
    const l10 = r.y - s.y;
    const l12 = s.x - r.x;
    const l14 = r.x * s.y - r.y * s.x;
    const den = l4 * l12 - l10 * l6;
    if (Math.abs(den) < 1) return point(NaN, NaN); // the applet's 1px cutoff
    return point((l6 * l14 - l12 * l8) / den, (l8 * l10 - l14 * l4) / den);
  }

  /** Twice-free signed shoelace area; its magnitude is the polygon's area. */
  function signedArea(pts) {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      sum += cross(p, q);
    }
    return sum / 2;
  }

  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Keep a corner inside the board, with room for its label and handle. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /*
   * HalfAreaOfQuadrilateralCanvas.init() on a 400x250 canvas, from the bytecode:
   *   A = (W/3,       H/7)
   *   B = (W/6,       H*5/6)
   *   C = (W*5/6,     H*4/5)
   *   D = (W*2/3,     H/4)
   * The panel starts with names ticked, premise and hint unticked; the hint
   * checkbox is disabled until premise is ticked.
   */
  function start(options) {
    const o = options || {};
    const premise = o.premise === undefined ? false : !!o.premise;
    return {
      A: point(VIEW.width / 3, VIEW.height / 7),
      B: point(VIEW.width / 6, VIEW.height * 5 / 6),
      C: point(VIEW.width * 5 / 6, VIEW.height * 4 / 5),
      D: point(VIEW.width * 2 / 3, VIEW.height / 4),
      options: {
        names: o.names === undefined ? true : !!o.names,
        premise: premise,
        hint: premise && o.hint !== undefined ? !!o.hint : false,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  /** Move one corner; the applet kept the others exactly where they were. */
  function move(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name) || !finite(p)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  /** The panel's three "Show" checkboxes, with the applet's hint dependency. */
  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    const options = Object.assign({}, state.options, { [name]: !!on });
    if (!options.premise) {
      options.hint = false;
    } else if (name === "hint" && !options.premise) {
      options.hint = false;
    }
    return Object.assign({}, state, { options, explored: true });
  }

  const onSegment = (e, p, q, tol) => {
    if (!finite(e)) return false;
    const box = 1e-9 * Math.max(1, dist(p, q));
    return Math.abs(cross(sub(e, p), sub(q, p))) <= tol
      && e.x >= Math.min(p.x, q.x) - box && e.x <= Math.max(p.x, q.x) + box
      && e.y >= Math.min(p.y, q.y) - box && e.y <= Math.max(p.y, q.y) + box;
  };

  /**
   * The applet's Compute() plus the measurements needed to check the page's
   * claim.  Returns null exactly when Compute() returns without drawing.
   */
  function compute(a, b, c, d) {
    const corners = [a, b, c, d];
    if (!corners.every(finite)) return null;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        if (dist(corners[i], corners[j]) < MIN_SEPARATION) return null;
      }
    }

    const K = midpoint(b, d);
    const guide = parallelTo(K, a, c);
    const onAB = intersect(K, guide, a, b);
    const onAD = intersect(K, guide, a, d);
    /* Java: dcmpg then ifge — NaNs fall through to the AD branch. */
    const useAB = dist(K, onAB) < dist(K, onAD);
    const E = useAB ? onAB : onAD;
    const L = intersect(a, K, c, E);
    const nearCorner = useAB ? b : d;
    const farCorner = useAB ? d : b;

    /* Draw(): pink quadrilateral, light-gray triangle, then the outline and CE. */
    const quad = useAB ? [c, E, a, d] : [c, E, a, b];
    const tri = useAB ? [c, E, b] : [c, E, d];
    const valid = [K, E, L, guide, onAB, onAD].every(finite);

    const total = Math.abs(signedArea(corners));
    const areaQuad = Math.abs(signedArea(quad));
    const areaTri = Math.abs(signedArea(tri));
    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a),
      dist(a, c), dist(b, d));
    const tol = 1e-9 * scale * scale;
    const diff = Math.abs(areaQuad - areaTri);

    /* The proof's four pairs of triangles, with their unsigned areas. */
    const a1 = (p, q, r) => Math.abs(signedArea([p, q, r]));
    const abk = a1(a, b, K), adk = a1(a, d, K);
    const cbk = a1(c, b, K), cdk = a1(c, d, K);
    const aek = a1(a, E, K), cek = a1(c, E, K);
    const ael = finite(L) ? a1(a, E, L) : NaN;
    const ckl = finite(L) ? a1(c, K, L) : NaN;

    const sides = [cross(sub(b, a), sub(c, b)), cross(sub(c, b), sub(d, c)),
      cross(sub(d, c), sub(a, d)), cross(sub(a, d), sub(b, a))];
    const convex = sides.every((s) => s > 0) || sides.every((s) => s < 0);
    const opp = (p, q, r, s) => cross(sub(r, p), sub(s, p)) * cross(sub(r, q), sub(s, q)) < 0;
    const bdInterior = opp(a, c, b, d) && opp(b, d, a, c);
    const onSide = onSegment(E, a, nearCorner, 1e-7 * scale);

    const eq = (x, y) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= tol;
    const claims = {
      equalHalves: eq(areaQuad, areaTri),
      eOnSide: onSide,
      bisects: eq(areaQuad, areaTri) && onSide,
      abkAdk: eq(abk, adk), cbkCdk: eq(cbk, cdk),
      aekCek: eq(aek, cek), aelCkl: eq(ael, ckl),
      bdInterior, convex,
    };

    return {
      A: a, B: b, C: c, D: d, K, E, L, guide, onAB, onAD,
      useAB, side: useAB ? "AB" : "AD", nearCorner, farCorner,
      quad, tri, valid,
      /* Lines drawn by ShowPremise and ShowHint. */
      premiseLines: [[b, d], [a, c], [K, E]],
      hintTriangles: [[a, E, K], [c, E, K]],
      hintLines: [[c, K], [a, K]],
      areas: {
        total, quad: areaQuad, tri: areaTri, difference: diff,
        abk, adk, cbk, cdk, aek, cek, ael, ckl,
      },
      claims, tol,
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D);
  }

  /* The applet has no game to win or lose: the illustration is always open. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move two corners apart so the drawing can be made.";
    if (!g.valid) return "The guide line misses the sides. Move a corner to make a crossing.";
    const area = g.areas.quad.toFixed(1), other = g.areas.tri.toFixed(1);
    let text = `K is halfway along BD and KE is parallel to AC. The pink piece is ${area} and the grey piece is ${other} square units — the same area.`;
    text += g.claims.eOnSide
      ? ` E lies on side ${g.side}, so CE cuts the shape in half.`
      : ` E falls outside the shape, so CE does not cut it into two pieces.`;
    if (!g.claims.bdInterior) {
      text += " Here BD is outside the four-sided shape, so the two matching areas are polygons rather than two pieces of the drawing.";
    }
    if (state.options.hint) text += " The faint triangles and L show why the pieces match.";
    return text;
  }

  return {
    VIEW, PAD, MIN_SEPARATION,
    point, sub, dot, cross, dist, midpoint, parallelTo, intersect, signedArea,
    finite, clamp, start, reset, move, setOption, compute, geometry,
    result, describe,
  };
})();
