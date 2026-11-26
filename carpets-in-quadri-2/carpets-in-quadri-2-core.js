"use strict";

/*
 * Carpets in a Quadrilateral II — Alexander Bogomolny's applet CarpetsInQuadri2.
 *
 * Drag the four corners of a quadrilateral.  E,F,G,H are the midpoints of its
 * sides AB,BC,CD,DA; P = AF∩DE, Q = AF∩BG, R = BG∩CH and S = CH∩DE.  The page
 * claims that the four corner triangles AEP, BFQ, CGR, DHS have the same total
 * area as the middle quadrilateral PQRS.  The two carpets are AFCH plus its
 * complement and BGDE plus its complement; each carpet and its complement has
 * half the area of ABCD, so the Carpets Theorem makes their overlaps equal.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, CarpetsInQuadri2Core, so the page loads it
 * with a plain <script> and porting/check-carpets-in-quadri-2.mjs loads it in
 * Node.  Positions are plain data in the SVG viewBox units.
 */
const CarpetsInQuadri2Core = (() => {
  /* The archived applet on the cut-the-knot page was 450x400. */
  const VIEW = { x: 0, y: 0, width: 450, height: 400 };
  const PAD = 12;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /* CarpetsInQuadri2Canvas.Midpoint(): ((p.x+q.x)/2, (p.y+q.y)/2). */
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  /*
   * GeoSDoub.Intersect(p1,p2,p3,p4), straight from the utility class' bytecode.
   * It writes the three lines in general form (a*x + b*y = c), solves them by
   * Cramer's rule and returns a point of NaNs when |det| < 1 (parallel or very
   * nearly parallel lines).  Keeping that pixel-sized tolerance matters: the
   * applet refuses to draw when the corners make such a pair of lines.
   */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y;
    const b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y;
    const b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return null;
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** Keep a corner inside the board, with room for its handle and label. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /*
   * CarpetsInQuadri2Canvas.init() on W=450, H=400: the four locals are
   * u = W/5 = 90 and v = H/5 = 80 (integer division), giving
   *   A = (u, H/2 - v) = (90, 120)
   *   B = (4u, H - v)  = (360, 320)
   *   C = (W - u, v)   = (360, 80)
   *   D = (2u, v)      = (180, 80)
   * Partition1 and Partition2 start checked; "1".equals(getParameter("ShowNames"))
   * makes the names checkbox start unchecked when that parameter is absent.
   */
  function start(options) {
    const o = options || {};
    const W = VIEW.width, H = VIEW.height;
    const u = Math.floor(W / 5), v = Math.floor(H / 5);
    return {
      A: point(u, H / 2 - v),
      B: point(4 * u, H - v),
      C: point(W - u, v),
      D: point(2 * u, v),
      options: {
        names: o.names === undefined ? false : !!o.names,
        partition1: o.partition1 === undefined ? true : !!o.partition1,
        partition2: o.partition2 === undefined ? true : !!o.partition2,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = !!state.explored;
    return s;
  }

  function move(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name) || !p) return state;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /* Shoelace area, made positive so a clockwise drawing works too. */
  function signedArea(poly) {
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      sum += p.x * q.y - p.y * q.x;
    }
    return sum / 2;
  }
  const area = (poly) => Math.abs(signedArea(poly));

  function isConvex(a, b, c, d) {
    const ps = [a, b, c, d];
    const turns = [0, 1, 2, 3].map((i) => {
      const p = ps[i], q = ps[(i + 1) % 4], r = ps[(i + 2) % 4];
      return cross(sub(q, p), sub(r, q));
    });
    return turns.every((t) => t > 0) || turns.every((t) => t < 0);
  }

  /**
   * All the points of the drawing, plus the carpet areas.  Returns null when
   * two corners coincide or one of the four applet intersections is the null
   * (NaN) point.
   */
  function compute(a, b, c, d) {
    const cs = [a, b, c, d];
    if (!cs.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        if (dist(cs[i], cs[j]) < 1e-9) return null;
      }
    }

    const E = midpoint(a, b);   // AB
    const F = midpoint(b, c);   // BC
    const G = midpoint(c, d);   // CD
    const H = midpoint(d, a);   // DA
    const P = intersect(a, F, d, E); // AF ∩ DE
    const Q = intersect(b, G, a, F); // BG ∩ AF
    const R = intersect(c, H, b, G); // CH ∩ BG
    const S = intersect(d, E, c, H); // DE ∩ CH
    if (!P || !Q || !R || !S) return null;
    if (![P, Q, R, S].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;

    const abcd = area([a, b, c, d]);
    const s1 = area([a, F, c, H]);       // the first carpet
    const s2 = area([a, b, F]) + area([c, d, H]);
    const t1 = area([b, G, d, E]);       // the second carpet
    const t2 = area([a, E, d]) + area([c, G, b]);
    const corner = area([a, E, P]) + area([b, F, Q])
      + area([c, G, R]) + area([d, H, S]);
    const inner = area([P, Q, R, S]);
    const tol = 1e-9 * Math.max(1, abcd);
    const close = (x, y, t) => Math.abs(x - y) <= t;
    const convex = isConvex(a, b, c, d);
    const parallelogram = dist(sub(b, a), sub(c, d)) <= tol
      && dist(sub(c, b), sub(d, a)) <= tol;

    const claims = {
      carpet: close(corner, inner, tol),
      halves: close(s1, abcd / 2, tol) && close(s2, abcd / 2, tol)
        && close(t1, abcd / 2, tol) && close(t2, abcd / 2, tol),
      convex: convex,
      parallelogram: parallelogram,
      fifth: abcd > 0 && close(inner / abcd, 1 / 5, 1e-6),
    };

    return {
      A: a, B: b, C: c, D: d,
      E: E, F: F, G: G, H: H,
      P: P, Q: Q, R: R, S: S,
      areas: { abcd, s1, s2, t1, t2, corner, inner },
      claims: claims, tol: tol,
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D);
  }

  /*
   * What CarpetsInQuadri2Canvas.Draw() paints, in bytecode order.  The two
   * dashed diagonals appear only when the *other* partition is switched off.
   * The page drawing uses these same point arrays; the test compares them with
   * a second transcription of Draw().
   */
  function shapes(g) {
    return {
      partition1: {
        triangles: [[g.A, g.B, g.F], [g.C, g.D, g.H]],
        quads: [[g.A, g.F, g.C, g.H]],
        lines: [[g.A, g.F], [g.C, g.H]],
        dashed: [g.A, g.C],
      },
      partition2: {
        triangles: [[g.A, g.E, g.D], [g.C, g.G, g.B]],
        quads: [[g.B, g.G, g.D, g.E]],
        lines: [[g.B, g.G], [g.D, g.E]],
        dashed: [g.B, g.D],
      },
      outline: [[g.A, g.B], [g.B, g.C], [g.C, g.D], [g.D, g.A]],
    };
  }

  /* An illustration has no win, loss or finish. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the four points make a four-sided shape.";
    if (!g.claims.convex) {
      return "This shape has a dent in it. The carpet sizes match only for a shape with no dents.";
    }
    return g.claims.carpet
      ? "The four corner pieces have the same total area as the middle piece."
      : "Move a corner: the drawing is too small for the exact carpet sizes.";
  }

  return {
    VIEW: VIEW, PAD: PAD,
    point: point, add: add, sub: sub, cross: cross, dist: dist,
    midpoint: midpoint, intersect: intersect, clamp: clamp,
    area: area, signedArea: signedArea, isConvex: isConvex,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, shapes: shapes, result: result,
    describe: describe,
  };
})();
