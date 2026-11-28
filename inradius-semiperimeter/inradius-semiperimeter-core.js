"use strict";

/*
 * Inradius Semiperimeter, from Alexander Bogomolny's applet InradiusSemiperimeter.
 *
 * Drag the three corners of a triangle. The incenter O is joined to the three
 * touch points D (on BC), E (on CA) and F (on AB), splitting the triangle into
 * six right triangles. "Move them" swings each one into a rectangle whose
 * width is the semiperimeter s and whose height is the inradius r, so the
 * triangle's area is s·r. "Show hint" draws the incircle of radius r.
 *
 * All geometry is transcribed from the applet's bytecode (Compute,
 * SetRotatingPoly, MoveThem1/2, FlippingTriangle.Move, GeoSDoub). In particular
 * the incenter comes from intersecting two rotated bisector rays, not from the
 * closed-form weighted average, and the radius is the average of OD, OE, OF.
 * The board is the applet's own 500 x 360 canvas in pixel units; the rectangle
 * sits with its bottom edge ten units above the bottom of the canvas.
 *
 * This file has no DOM and no storage. It defines one global so the page loads
 * it with a plain <script> and porting/check-inradius-semiperimeter.mjs loads
 * it in Node. Positions are plain data (points are {x, y} objects).
 */
const InradiusSemiperimeterCore = (() => {
  const W = 500;
  const H = 360;
  const GAP = 10;
  const NSTEPS = 100;

  const pt = (x, y) => ({ x, y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (p, q, t) => pt(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);

  /** GeoSDoub.FindOrientation: +1 if A,B,C turn one way, -1 otherwise. */
  function orientation(a, b, c) {
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return cross > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeAngle: the angle at a, by the cosine rule. */
  function angle(a, b, c) {
    const ab = sqDist(a, b), ac = sqDist(a, c), bc = sqDist(b, c);
    const cos = (ab + ac - bc) / (2 * Math.sqrt(ab * ac));
    return Math.acos(clamp(cos, -1, 1));
  }

  /** GeoSDoub.Rotate: rotate p about centre by `a` in the triangle's orientation. */
  function rotate(p, center, a, orient) {
    const cos = Math.cos(a), sin = Math.sin(a) * orient;
    return pt(p.x + cos * (center.x - p.x) - sin * (center.y - p.y),
      p.y + sin * (center.x - p.x) + cos * (center.y - p.y));
  }

  /** GeoSDoub.Intersect: lines p1p2 and p3p4; NaN when nearly parallel. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return pt(NaN, NaN); // the applet's threshold
    return pt((b1 * c2 - b2 * c1) / d, (a2 * c1 - a1 * c2) / d);
  }

  /** GeoSDoub.FindIncenter: intersect the two rotated angle-bisector rays. */
  function findIncenter(a, b, c) {
    const orient = orientation(a, b, c);
    const rayA = rotate(a, b, angle(a, b, c) / 2, orient);
    const rayB = rotate(b, c, angle(b, c, a) / 2, orient);
    return intersect(a, rayA, b, rayB);
  }

  /** GeoSDoub.NearestPoint: the foot on UV, including the applet's near-vertex shortcut. */
  function nearestPoint(p, u, v) {
    if (sqDist(u, p) < 0.1) return p;
    const dx = v.x - u.x, dy = v.y - u.y;
    const t = ((p.x - u.x) * dx + (p.y - u.y) * dy) / (dx * dx + dy * dy);
    return pt(u.x + dx * t, u.y + dy * t);
  }

  /** GeoSDoub.ComputeSignedAngle, as used for the swinging pieces. */
  function signedAngle(a, b, c) {
    const cos = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / (2 * dist(a, b) * dist(a, c));
    const ang = Math.acos(clamp(cos, -1, 1));
    if (ang > 0.99 && sqDist(b, a) < 0) return Math.PI; // unreachable in the applet
    return orientation(a, b, c) > 0 ? ang : -ang;
  }

  const barycenter = (poly) => pt(
    poly.reduce((s, p) => s + p.x, 0) / poly.length,
    poly.reduce((s, p) => s + p.y, 0) / poly.length,
  );

  const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /**
   * Everything the drawing needs for one position: incenter, touch points,
   * the s by r rectangle and the six pieces with their start and target
   * triangles. `mode` is 1 or 2, matching MoveThem1 / MoveThem2.
   */
  function measurements(state) {
    const A = state.A, B = state.B, C = state.C;
    if (![A, B, C].every(finitePoint)) return { degenerate: true };
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    if (a < 1e-9 || b < 1e-9 || c < 1e-9) return { degenerate: true };
    const O = findIncenter(A, B, C);
    if (!finitePoint(O)) return { degenerate: true };
    // GeoSDoub.NearestPoint returns the incenter itself when a corner is
    // within 0.316 units. Keep that quirk (the applet has it), and flag it so
    // the drawing can say the triangle is too thin for the construction.
    const shortcut = sqDist(B, O) < 0.1 || sqDist(C, O) < 0.1 || sqDist(A, O) < 0.1;
    const D = nearestPoint(O, B, C);
    const E = nearestPoint(O, C, A);
    const F = nearestPoint(O, A, B);
    if (![D, E, F].every(finitePoint)) return { degenerate: true };
    const s = (a + b + c) / 2;
    const r = (dist(O, E) + dist(O, F) + dist(O, D)) / 3;
    if (!Number.isFinite(s) || !Number.isFinite(r) || r < 1e-9) return { degenerate: true };

    const x0 = (W - s) / 2, y0 = H - GAP;
    const L1 = pt(x0, y0);
    const L2 = pt(L1.x + dist(A, E), y0);
    const L3 = pt(L2.x + dist(B, F), y0);
    const L4 = pt(L3.x + dist(C, D), y0);
    const U = [L1, L2, L3, L4].map((p) => pt(p.x, y0 - r));
    const L = [L1, L2, L3, L4];

    const mode = orientation(U[0], L[0], L[1]) === orientation(O, E, A) ? 1 : 2;

    // Each entry: a colour group, how it moves, where it starts and where it ends.
    const spec = mode === 1 ? [
      [0, "rotate", [O, D, C], [U[2], L[2], L[3]], U[2], L[2]],
      [0, "flip", [O, C, E], [L[3], U[2], U[3]]],
      [1, "rotate", [O, E, A], [U[0], L[0], L[1]], U[0], L[0]],
      [1, "flip", [O, A, F], [L[1], U[0], U[1]]],
      [2, "rotate", [O, F, B], [U[1], L[1], L[2]], U[1], L[1]],
      [2, "flip", [O, B, D], [L[2], U[1], U[2]]],
    ] : [
      [0, "rotate", [O, C, E], [L[3], U[2], U[3]], L[3], U[2]],
      [0, "flip", [O, D, C], [U[2], L[2], L[3]]],
      [1, "rotate", [O, A, F], [L[1], U[0], U[1]], L[1], U[0]],
      [1, "flip", [E, A, O], [L[0], L[1], U[0]]],
      [2, "rotate", [O, B, D], [L[2], U[1], U[2]], L[2], U[1]],
      [2, "flip", [O, F, B], [U[1], L[1], L[2]]],
    ];
    const pieces = spec.map((entry) => {
      const [group, kind, start, target, p4, p5] = entry;
      const piece = { group, kind, start, target };
      if (kind === "rotate") {
        // The applet turns the piece about its barycenter by this signed angle.
        const guide = pt(start[0].x + p5.x - p4.x, start[0].y + p5.y - p4.y);
        const ang = signedAngle(start[0], start[1], guide);
        piece.angle = Number.isNaN(ang) ? Math.PI : ang;
      }
      return piece;
    });

    return {
      degenerate: false, shortcut, A, B, C, O, D, E, F, a, b, c, s, r,
      L, U, mode, pieces,
      area: Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)) / 2,
      radiusFromCenter: [dist(O, D), dist(O, E), dist(O, F)],
      tangentLengths: [dist(A, E), dist(A, F), dist(B, F), dist(B, D), dist(C, D), dist(C, E)],
    };
  }

  /** Signed area of a polygon; used by the logic test. */
  function polygonArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return Math.abs(sum) / 2;
  }

  /**
   * The six polygons at progress t (0 = in the triangle, 1 = in the
   * rectangle). Rotating pieces turn about their first barycenter while that
   centre slides to its goal; flipping pieces interpolate each vertex, exactly
   as FlippingTriangle.Move does.
   */
  function piecesAt(m, t) {
    if (m.degenerate) return [];
    const f = clamp(t, 0, 1);
    return m.pieces.map((piece) => {
      if (piece.kind === "flip") return piece.start.map((p, i) => lerp(p, piece.target[i], f));
      const c0 = barycenter(piece.start), c1 = barycenter(piece.target);
      const c = lerp(c0, c1, f), a = piece.angle * f;
      // rotate(fixed, moving, ...) turns `moving` about `fixed`.
      const turned = piece.start.map((p) => rotate(c0, p, a, 1));
      return turned.map((p) => pt(p.x + c.x - c0.x, p.y + c.y - c0.y));
    });
  }

  /** A new position: the applet's starting triangle unless corners are given. */
  function start(options) {
    const o = options || {};
    const s = {
      A: o.A ? pt(o.A.x, o.A.y) : pt(Math.floor(W / 6), Math.floor((2 * H) / 3)),
      B: o.B ? pt(o.B.x, o.B.y) : pt(W - Math.floor(W / 6), Math.floor((2 * H) / 3)),
      C: o.C ? pt(o.C.x, o.C.y) : pt(Math.floor(W / 4), Math.floor(H / 6)),
      hint: !!o.hint,
      progress: 0,
      explored: false,
      moves: 0,
    };
    if (o.progress !== undefined) {
      s.progress = clamp(Number(o.progress) || 0, 0, 1);
      s.explored = s.progress >= 1;
    }
    return s;
  }

  /**
   * Moves: {type:"point", name, x, y} drags a corner; {type:"hint", value}
   * toggles the incircle; {type:"animate", f} moves the pieces to fraction f;
   * {type:"reset"} restores the triangle. Every move returns a new position.
   */
  function move(state, m) {
    if (!m) return null;
    if (m.type === "point") {
      if (!["A", "B", "C"].includes(m.name) || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
      if (m.x === state[m.name].x && m.y === state[m.name].y) return state;
      return { ...state, [m.name]: pt(m.x, m.y), progress: 0, explored: false, moves: state.moves + 1 };
    }
    if (m.type === "hint") {
      if (m.value !== undefined && typeof m.value !== "boolean") return null;
      return { ...state, hint: m.value === undefined ? !state.hint : m.value };
    }
    if (m.type === "animate") {
      if (!Number.isFinite(m.f)) return null;
      const f = clamp(m.f, 0, 1);
      return { ...state, progress: f, explored: state.explored || f >= 1 };
    }
    if (m.type === "reset") return start({ hint: state.hint });
    return null;
  }

  /** What a player can press in a given position. */
  function legalMoves(state) {
    return [
      { type: "hint", value: !state.hint },
      { type: "animate", f: 1 },
      { type: "reset" },
    ];
  }

  /** A demo has no winner: it is finished once the dissection has been shown. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  return {
    W, H, GAP, NSTEPS, pt, dist, sqDist, clamp, lerp, orientation, angle,
    rotate, intersect, findIncenter, nearestPoint, signedAngle, barycenter,
    measurements, polygonArea, piecesAt, start, move, legalMoves, result,
  };
})();
