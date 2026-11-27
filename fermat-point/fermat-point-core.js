"use strict";

/*
 * FermatPointCore — the geometry of Alexander Bogomolny's FermatPoint applet.
 *
 * Fermat's question is where a point F should be so that FA + FB + FC is as
 * small as possible.  Turn each side of the triangle outward by 60° to make
 * the three Napoleon triangles; the lines from A, B, C to the opposite new
 * corners then meet at F, and the three angles at F are 120°.  If a corner of
 * the triangle is already 120° or more, that corner itself is the answer.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, FermatPointCore, so the page loads it with
 * a plain <script> and porting/check-fermat-point.mjs can load it in Node.
 * All coordinates are plain points in the SVG viewBox.  The construction
 * follows the applet method for method (FindOrientation, Rotate by 60°,
 * Intersect, Average and the 120° test), including D being a point the player
 * can drag away from the triangle's centroid.
 */
const FermatPointCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 22;
  const SIXTY = 1.0471975511965976;   // applet: Math.PI / 3
  const TWO_THIRDS = 2.0943951023931953; // applet: 2 * Math.PI / 3
  const DEG = 180 / Math.PI;

  const point = (x, y) => ({ x: x, y: y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** GeoSDoub.FindOrientation: +1 for a left turn, -1 for a right turn. */
  function findOrientation(a, b, c) {
    const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + (a.x * b.y - b.x * a.y);
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeAngle: the angle at v, from the law of cosines. */
  function computeAngle(v, p, q) {
    const num = dist(v, p) ** 2 + dist(v, q) ** 2 - dist(p, q) ** 2;
    const den = 2 * dist(v, p) * dist(v, q);
    if (!den) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, num / den)));
  }

  /** GeoSDoub.Rotate(centre, p, t, sgn): turn p about centre; sgn picks the
   *  outward side.  The centre is the FIRST argument in the Java signature. */
  function rotate(centre, p, t, sgn) {
    const c = Math.cos(t), s = Math.sin(t);
    const dx = p.x - centre.x, dy = p.y - centre.y;
    return point(centre.x + c * dx - sgn * s * dy,
                 centre.y + sgn * s * dx + c * dy);
  }

  /** GeoSDoub.Intersect of two lines.  The applet returns NaN points when
   *  |determinant| < 1; keep that, so degenerate drags behave the same way. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  const average = (p, q, r) => point((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);

  /** FermatPointCanvas.AngleMoreThan120, in the applet's A, B, C order. */
  function angleMoreThan120(a, b, c) {
    if (computeAngle(a, b, c) > TWO_THIRDS) return a;
    if (computeAngle(b, c, a) > TWO_THIRDS) return b;
    if (computeAngle(c, a, b) > TWO_THIRDS) return c;
    return null;
  }

  /** Perpendicular distance from p to line(a,b), for the concurrency checks. */
  function distanceToLine(p, a, b) {
    const v = sub(b, a);
    const n = Math.hypot(v.x, v.y);
    return n ? Math.abs(cross(sub(p, a), v)) / n : dist(p, a);
  }

  /** Keep a dragged handle in the board with room for its label. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /** The applet's own starting picture on its 400x300 canvas. */
  function start(options) {
    const o = options || {};
    const a = point(200 - 50, 150 + 20);
    const b = point(200 + 50, 150 + 20);
    const c = point(200 + 50 * Math.cos(SIXTY),
                    150 - 50 * Math.sin(SIXTY) - 10);
    return {
      A: a, B: b, C: c, D: average(a, b, c),
      options: {
        names: o.names === undefined ? false : !!o.names,
        hint: !!o.hint,
        fermat: !!o.fermat,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function move(state, name, p) {
    if (name !== "A" && name !== "B" && name !== "C" && name !== "D") return state;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** FermatPointCanvas.Compute(), with the same six rotations and the same
   *  average of the three pairwise intersections. */
  function compute(a, b, c, d) {
    const o = findOrientation(a, b, c);
    const Ap = rotate(c, b, SIXTY, o);
    const Da = rotate(c, d, SIXTY, o);
    const Bp = rotate(a, c, SIXTY, o);
    const Db = rotate(a, d, SIXTY, o);
    const Cp = rotate(b, a, SIXTY, o);
    const Dc = rotate(b, d, SIXTY, o);

    const outer = angleMoreThan120(a, b, c);
    const moreThan120 = outer !== null;
    let F = outer;
    if (!F) {
      const x = intersect(a, Ap, b, Bp);
      const y = intersect(b, Bp, c, Cp);
      const z = intersect(c, Cp, a, Ap);
      F = average(x, y, z);
    }
    const angles = { A: computeAngle(a, b, c), B: computeAngle(b, c, a), C: computeAngle(c, a, b) };
    const total = dist(F, a) + dist(F, b) + dist(F, c);
    const outerName = !outer ? null : outer === a ? "A" : outer === b ? "B" : "C";

    return {
      A: a, B: b, C: c, D: d,
      Ap: Ap, Bp: Bp, Cp: Cp, Da: Da, Db: Db, Dc: Dc, F: F,
      orientation: o, moreThan120: moreThan120, outer: outerName,
      nearD: dist(F, d) < 1, // applet's Bool: < 1 pixel from D
      angles: angles, total: total,
      // AA', BB' and CC' are the three long lines of the construction.
      lines: [
        { from: a, to: Ap }, { from: b, to: Bp }, { from: c, to: Cp },
      ],
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D);
  }

  function sumDistances(p, a, b, c) {
    return dist(p, a) + dist(p, b) + dist(p, c);
  }

  /* This is an illustration, not a game: there is no win and no loss. */
  function result(state) {
    return null;
  }

  /** What the status line says, in words a player can follow. */
  function describe(state) {
    const g = geometry(state);
    if (!g || ![g.F.x, g.F.y, g.total].every(Number.isFinite)) {
      return "Drag A, B and C apart so they make a triangle with clear lines.";
    }
    if (g.moreThan120) {
      return `The angle at ${g.outer} is ${(g.angles[g.outer] * DEG).toFixed(1)}°, `
        + `so ${g.outer} itself is the best point: FA + FB + FC = ${g.total.toFixed(1)}.`;
    }
    if (state.options.hint) {
      return `AA' = BB' = CC' = FA + FB + FC = ${g.total.toFixed(1)}. `
        + "The three 60° turns make equal broken lines from each corner to F.";
    }
    if (state.options.fermat) {
      return `F is where the three lines meet: the angles at F are all 120°, `
        + `and FA + FB + FC = ${g.total.toFixed(1)}.`;
    }
    return `F is where the lines from A, B and C to A', B' and C' meet; `
      + `FA + FB + FC = ${g.total.toFixed(1)}.`;
  }

  return {
    VIEW: VIEW, PAD: PAD, SIXTY: SIXTY, TWO_THIRDS: TWO_THIRDS, DEG: DEG,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, findOrientation: findOrientation,
    computeAngle: computeAngle, rotate: rotate, intersect: intersect,
    average: average, angleMoreThan120: angleMoreThan120,
    distanceToLine: distanceToLine, clamp: clamp,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, sumDistances: sumDistances,
    result: result, describe: describe,
  };
})();
