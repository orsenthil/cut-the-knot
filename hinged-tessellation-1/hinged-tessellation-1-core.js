"use strict";

/*
 * A Semi-regular Tessellation on Hinges A — Alexander Bogomolny's applet
 * HingedTessellation1. The page still embeds the Java applet at
 * cut-the-knot.org/Curriculum/Geometry/HingedTessellation1.shtml.
 *
 * The starting cell is a square ABCD. A and C slide on the circle about B,
 * and B slides on the perpendicular bisector of AC, so AB = BC always: the
 * square is free to hinge into a rhombus. The other four points of each
 * "stranger" are made with GeoSDoub.Rotate by 60 degrees and by the signed
 * angle at C; those turns keep the five triangles equilateral in every
 * position, which is what the page means by "we may only preserve either the
 * squares or the equilateral triangles, but not both". At an angle of 60
 * degrees the rhombus is two equilateral triangles and six of them meet at
 * every corner, the (3,3,3,3,3,3) derivative the page describes. Version B
 * instead frees the triangles and keeps the squares.
 *
 * Every formula here is a line-for-line transcription of the bytecode:
 * GeoSDoub.FindOrientation / Rotate / ComputeSignedAngle,
 * HingedTessellation1Canvas.FourthPoint, Stranger.Draw, Draw() and
 * ShowOneLayer(). No document, no window, no storage: one global,
 * HingedTessellation1Core, with plain-data positions in the SVG viewBox units.
 */

const HingedTessellation1Core = (() => {
  /* The applet's canvas is 640 x 460 on the cut-the-knot page. */
  const VIEW = { x: 0, y: 0, width: 640, height: 460 };
  const LIMITS = {
    layers: { min: 0, max: 15, initial: 4 }, // SpinnerNumberModel(4, 0, 15, 1)
    mode: { min: 0, max: 2, initial: 0 },    // ONE_COLOR, TWO_COLORS, COLOR_LAYERS
  };
  const MODE_NAMES = ["One color", "Two colors", "Color bands"];
  const SIXTH = Math.PI / 3;
  const COLORS = 10; // the applet's Colors[] array has ten entries

  const point = (x, y) => ({ x, y });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const neg = (p) => point(-p.x, -p.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** GeoSDoub.FindOrientation: +1 for a clockwise turn in screen coordinates. */
  function orientation(a, b, c) {
    return c.x * (b.y - a.y) + c.y * (a.x - b.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(moving, centre, radians, sign). */
  function rotate(moving, centre, radians, sign) {
    const co = Math.cos(radians), si = Math.sin(radians);
    return point(
      moving.x + co * (centre.x - moving.x) - sign * si * (centre.y - moving.y),
      moving.y + sign * si * (centre.x - moving.x) + co * (centre.y - moving.y),
    );
  }

  /** GeoSDoub.ComputeSignedAngle(vertex, ray1, ray2). */
  function signedAngle(vertex, p, q) {
    const n = (dist(vertex, p) ** 2 + dist(vertex, q) ** 2 - dist(p, q) ** 2) /
      (2 * dist(vertex, p) * dist(vertex, q));
    return orientation(vertex, p, q) * Math.acos(n);
  }

  /** HingedTessellation1Canvas.FourthPoint(a, b, c) = c + a - b. */
  function fourthPoint(a, b, c) {
    return point(c.x + a.x - b.x, c.y + a.y - b.y);
  }

  function angle(vertex, p, q) {
    const n = dist(vertex, p) * dist(vertex, q);
    if (!n) return NaN;
    return Math.acos(Math.max(-1, Math.min(1,
      ((p.x - vertex.x) * (q.x - vertex.x) + (p.y - vertex.y) * (q.y - vertex.y)) / n))) * 180 / Math.PI;
  }

  /** Colours by index, as Stranger.Draw chooses them from HowColor/Layer/ID. */
  function colors(mode, layer, id) {
    let c5 = 0, c6 = 0;
    if (mode === LIMITS.mode.min + 1) {
      c5 = id % 2 === 0 ? 0 : 1;
      c6 = id % 2 === 0 ? 1 : 0;
    } else if (mode === LIMITS.mode.max) {
      c5 = layer % COLORS;
      c6 = (layer + 2) % COLORS;
    }
    return { c5, c6 };
  }

  /** HingedTessellation1Canvas$Stranger.Draw(), with its two translated copies. */
  function stranger(a, b, c, d, layer, id, mode) {
    const so = orientation(b, a, c);
    const theta = signedAngle(d, c, a);
    const e = rotate(d, c, SIXTH, -so);
    const f = rotate(e, d, theta, -so);
    const g = fourthPoint(d, e, f);
    const h = rotate(f, g, SIXTH, so);
    const i = rotate(h, g, SIXTH, so);
    const j = rotate(i, g, theta, -so);
    const n = fourthPoint(g, i, j);
    const l = rotate(n, j, SIXTH, -so);
    const m = rotate(l, n, theta, -so);
    const col = colors(mode, layer, id);
    const points = { A: a, B: b, C: c, D: d, E: e, F: f, G: g, H: h, I: i, J: j, N: n, L: l, M: m };
    const triangles = [
      { name: "CDE", pts: [c, d, e], color: col.c5 },
      { name: "JLN", pts: [j, l, n], color: col.c5 },
      { name: "ADN", pts: [a, d, n], color: col.c5 },
      { name: "GHI", pts: [g, h, i], color: col.c5 },
      { name: "DGN", pts: [d, g, n], color: col.c6 },
      { name: "GHF", pts: [g, h, f], color: col.c6 },
    ];
    const lines = [
      [a, b], [b, c], [c, d], [d, a], [d, e], [c, e], [e, f], [d, g], [d, n],
      [f, g], [f, h], [g, h], [h, i], [g, i], [g, n], [i, j], [j, n], [j, l],
      [l, m], [l, n], [m, a], [a, n],
    ];
    return {
      A: a, B: b, C: c, D: d, layer, id, points, triangles, lines,
      theta, so, colors: col,
      V: point(a.x - h.x, a.y - h.y),   // A - H, the step along a row
      W: point(l.x - c.x, l.y - c.y),   // L - C, the step between rows
    };
  }

  function normalize(name, raw) {
    const lim = LIMITS[name];
    if (!lim) return raw;
    const n = Number(raw);
    if (!Number.isFinite(n)) return lim.initial;
    return Math.round(Math.max(lim.min, Math.min(lim.max, n)));
  }

  /** HingedTessellation1Canvas.init(): B at 0, A at -90, C at +90 degrees. */
  function basePoints() {
    const r = Math.trunc(Math.min(VIEW.width / 3, VIEW.height / 3)) - 2 * 60; // int arithmetic in init()
    const cx = Math.trunc(VIEW.width / 2), cy = Math.trunc(VIEW.height / 2);
    const b = point(cx + r, cy);
    const a = point(cx, cy - r);
    const c = point(cx, cy + r);
    return { A: a, B: b, C: c, D: fourthPoint(a, b, c) };
  }

  function start(options) {
    const o = options || {};
    const base = basePoints();
    return Object.assign(base, {
      options: {
        layers: normalize("layers", o.layers === undefined ? LIMITS.layers.initial : o.layers),
        mode: normalize("mode", o.mode === undefined ? LIMITS.mode.initial : o.mode),
      },
      explored: false,
    });
  }

  function reset(state) {
    const s = start();
    if (state) s.explored = !!state.explored;
    return s;
  }

  /** CTKMoveableDoub.SetLocation for a circle glider: radial projection. */
  function projectCircle(p, centre, radius) {
    const d = dist(p, centre);
    if (d < 1e-12) return point(centre.x + radius, centre.y);
    return point(centre.x + (p.x - centre.x) * radius / d,
      centre.y + (p.y - centre.y) * radius / d);
  }

  /** GeoSDoub.NearestPoint on the perpendicular bisector of AC (an infinite line). */
  function projectBisector(p, a, c) {
    const mid = midpoint(a, c);
    const dx = (a.y - c.y) * 10, dy = -(a.x - c.x) * 10;
    const den = dx * dx + dy * dy;
    if (den < 1e-12) return mid;
    const t = (dx * (p.x - mid.x) + dy * (p.y - mid.y)) / den;
    return point(mid.x + dx * t, mid.y + dy * t);
  }

  /** The mousePressed restraints, reapplied for pointer and keyboard moves. */
  function constrained(state, name, p) {
    if (!state || !finite(p)) return null;
    if (name === "A") return projectCircle(p, state.B, dist(state.B, state.C));
    if (name === "C") return projectCircle(p, state.B, dist(state.B, state.A));
    if (name === "B") return projectBisector(p, state.A, state.C);
    return null;
  }

  function move(state, name, p) {
    const q = constrained(state, name, p);
    if (!q) return state;
    const next = Object.assign({}, state, { [name]: q, explored: true });
    next.D = fourthPoint(next.A, next.B, next.C);
    return next;
  }

  function setOption(state, name, value) {
    if (!state || !state.options || !Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: normalize(name, value) }),
      explored: true,
    });
  }

  /** Canvas.Draw() and ShowOneLayer(): one flower plus two directions of layers. */
  function layout(state, options) {
    const o = options || {};
    const n = state.options.layers;
    const base = stranger(state.A, state.B, state.C, state.D, 0, 0, state.options.mode);
    const v = base.V, w = base.W;
    const tiles = [base];
    const nv = neg(v), nw = neg(w);

    function show(a, b, c, d, layer0, id) {
      let pa = a, pb = b, pc = c, pd = d;
      for (let k = 0; k < n; k++) {
        pa = add(pa, v); pb = add(pb, v); pc = add(pc, v); pd = add(pd, v);
        tiles.push(stranger(pa, pb, pc, pd, layer0 + k, id, state.options.mode));
      }
      pa = a; pb = b; pc = c; pd = d;
      for (let k = 0; k < n; k++) {
        pa = add(pa, nv); pb = add(pb, nv); pc = add(pc, nv); pd = add(pd, nv);
        tiles.push(stranger(pa, pb, pc, pd, layer0 + k, id, state.options.mode));
      }
    }

    show(state.A, state.B, state.C, state.D, 0, 0);
    let a = state.A, b = state.B, c = state.C, d = state.D;
    for (let k = 0; k < n; k++) {
      a = add(a, w); b = add(b, w); c = add(c, w); d = add(d, w);
      tiles.push(stranger(a, b, c, d, k + 1, k + 1, state.options.mode));
      show(a, b, c, d, k + 1, k + 1);
    }
    a = state.A; b = state.B; c = state.C; d = state.D;
    for (let k = 0; k < n; k++) {
      a = add(a, nw); b = add(b, nw); c = add(c, nw); d = add(d, nw);
      tiles.push(stranger(a, b, c, d, k + 2, k + 1, state.options.mode));
      show(a, b, c, d, k + 2, k + 1);
    }
    return { base, v, w, tiles, total: tiles.length };
  }

  function bounds(tile) {
    let lo = point(Infinity, Infinity), hi = point(-Infinity, -Infinity);
    for (const k of Object.keys(tile.points)) {
      const p = tile.points[k];
      lo = point(Math.min(lo.x, p.x), Math.min(lo.y, p.y));
      hi = point(Math.max(hi.x, p.x), Math.max(hi.y, p.y));
    }
    return { lo, hi };
  }

  /** A Java Graphics clips to the component; do the same before making SVG nodes. */
  function visible(tile, pad) {
    const m = pad || 0, b = bounds(tile);
    return b.hi.x >= VIEW.x - m && b.lo.x <= VIEW.x + VIEW.width + m &&
      b.hi.y >= VIEW.y - m && b.lo.y <= VIEW.y + VIEW.height + m;
  }

  function geometry(state) {
    const drawn = layout(state);
    const kept = drawn.tiles.filter((t) => visible(t, 40));
    return Object.assign({}, drawn, { drawn: kept });
  }

  /** The smallest spread of the four rhombus sides and of the five triangles. */
  function measures(state) {
    const f = stranger(state.A, state.B, state.C, state.D, 0, 0, state.options.mode);
    const sides = [dist(state.A, state.B), dist(state.B, state.C),
      dist(state.C, state.D), dist(state.D, state.A)];
    const spread = (v) => Math.max(...v) - Math.min(...v);
  const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
    const preserved = f.triangles.filter((t) => t.name !== "ADN");
    const triSpread = Math.max(...preserved.map((t) =>
      spread([dist(t.pts[0], t.pts[1]), dist(t.pts[1], t.pts[2]), dist(t.pts[2], t.pts[0])])));
    const adn = f.triangles.find((t) => t.name === "ADN").pts;
    const adnAngles = [angle(adn[0], adn[1], adn[2]), angle(adn[1], adn[2], adn[0]),
      angle(adn[2], adn[0], adn[1])];
    const atB = angle(state.B, state.A, state.C);
    const square = Math.max(...[angle(state.A, state.B, state.D), angle(state.B, state.A, state.C),
      angle(state.C, state.B, state.D), angle(state.D, state.C, state.A)]
      .map((v) => Math.abs(v - 90)));
    const scale = Math.max(1, ...sides);
    const tol = 1e-7 * scale;
    /* At 60 degrees the short diagonal is AC; at 120 degrees it is BD.
     * Either way the rhombus is two equilateral triangles. */
    const halves = near(atB, 60, 1e-3)
      ? [[state.A, state.B, state.C], [state.A, state.C, state.D]]
      : near(atB, 120, 1e-3)
        ? [[state.B, state.A, state.D], [state.B, state.C, state.D]]
        : [];
    const halfTol = 1e-4 * scale; // a pointer lands within a rounding error of 60 degrees
    const triangular = halves.length === 2 && halves.every((t) =>
      spread([dist(t[0], t[1]), dist(t[1], t[2]), dist(t[2], t[0])]) <= halfTol);
    return {
      sides, sideSpread: spread(sides), atB, adnAngles,
      triangleSpread: triSpread, squareError: square, tol, scale,
      triangular, halves,
      claims: {
        rhombus: spread(sides) <= tol,
        trianglesEquilateral: triSpread <= tol,
        squareAtStart: square <= 1e-7,
        vertexFigure: 2 * 90 + 3 * 60 === 360,
        triangularAt60: triangular,
        sixTriangles: 6 * 60 === 360,
      },
    };
  }

  function describe(state) {
    const m = measures(state);
    const n = state.options.layers;
    const tileText = `${2 * n + 1} by ${2 * n + 1} tiles`;
    if (m.claims.squareAtStart) {
      return `Start: squares and equilateral triangles alternate 4, 3, 3, 4, 3 around each corner (90 + 60 + 60 + 90 + 60 = 360 degrees). ${tileText}.`;
    }
    if (m.claims.triangularAt60) {
      return `At ${Math.round(m.atB)} degrees each rhombus splits into two equilateral triangles: six triangles meet at every corner. ${tileText}.`;
    }
    return `The rhombus corner at B is ${m.atB.toFixed(1)} degrees; the triangles stay equilateral. ${tileText}.`;
  }

  /* An illustration, not a game: no win, no loss and no finishing move. */
  function result() {
    return null;
  }

  return {
    VIEW, LIMITS, MODE_NAMES, COLORS, point, finite, dist, add, neg, midpoint,
    orientation, rotate, signedAngle, fourthPoint, angle, colors, stranger,
    normalize, basePoints, start, reset, projectCircle, projectBisector,
    constrained, move, setOption, layout, bounds, visible, geometry, measures,
    describe, result,
  };
})();
