"use strict";

/*
 * General Napoleon — Alexander Bogomolny's applet GeneralNapoleon, whose page
 * is titled "Isotomy and Isogonality Hand-in-Hand".
 *
 * The page claims: on the sides of ABC take isotomic pairs K,L on AB, P,Q on
 * BC and M,N on CA whose barycentric coordinates agree (AK/AB = BP/BC =
 * CM/CA); build similar, similarly oriented isosceles triangles KLC', PQA',
 * MNB' on the three short bases; then AA', BB' and CC' are concurrent.  The
 * applet's Compute() is transcribed literally below: InSegment takes the
 * coefficient as the weight of the FIRST endpoint, so a coefficient d puts
 * the point 1-d of the way from that endpoint to the next vertex.  K, P and M
 * use DownCoef; L, Q and N use UpCoef.  GeoSDoub.Rotate(P, C, r, s) rotates C
 * about P by s*r, and the apex is the intersection of the two rotated rays.
 *
 * No document, no window: one global, GeneralNapoleonCore, with plain data
 * positions in the SVG viewBox units.  The page only draws and takes input.
 */

const GeneralNapoleonCore = (() => {
  const VIEW = { x: 0, y: 0, width: 420, height: 300 };
  const PAD = 16;

  /* The applet's three scrollbars: 0..105 / 100, 0..105 / 100, -90..95. */
  const LIMITS = {
    up: { min: 0, max: 1.05, step: 0.01, initial: 0.3 },
    down: { min: 0, max: 1.05, step: 0.01, initial: 0.7 },
    angle: { min: -90, max: 95, step: 1, initial: 60 },
  };

  const point = (x, y) => ({ x, y });
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** Angle at v between the rays v->p and v->q, in radians. */
  function angle(v, p, q) {
    const a = point(p.x - v.x, p.y - v.y), b = point(q.x - v.x, q.y - v.y);
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!n) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / n)));
  }

  /** Cross product of the two vectors from p. */
  function cross(p, q, r) {
    return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  }

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /* --------------------------- the applet's arithmetic, from the bytecode */

  /** InSegment(A, B, t) = t*A + (1-t)*B. */
  function inSegment(a, b, t) {
    return point(t * a.x + (1 - t) * b.x, t * a.y + (1 - t) * b.y);
  }

  /** GeoSDoub.Rotate(P, C, r, s): rotate C about P by s*r (SVG y points down). */
  function rotate(p, c, r, s) {
    const co = Math.cos(r), si = Math.sin(r);
    return point(
      p.x + co * (c.x - p.x) - s * si * (c.y - p.y),
      p.y + s * si * (c.x - p.x) + co * (c.y - p.y),
    );
  }

  /** GeoSDoub.Intersect of two lines, with the applet's |det| < 1 guard. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return null;
    const x = (b1 * c2 - b2 * c1) / det, y = (c1 * a2 - c2 * a1) / det;
    return finite(point(x, y)) ? point(x, y) : null;
  }

  /** A tolerance-free line intersection, only for measuring concurrency. */
  function lineIntersection(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    const den = rx * sy - ry * sx;
    if (!Number.isFinite(den) || Math.abs(den) < 1e-12) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
    const q = point(a.x + rx * t, a.y + ry * t);
    return finite(q) ? q : null;
  }

  function distanceToLine(p, a, b) {
    const n = dist(a, b);
    return n > 0 ? Math.abs(cross(a, b, p)) / n : dist(p, a);
  }

  /**
   * The applet's initial triangle: three points on a circle of radius
   * min(width, height)/3 about the canvas centre, 120 degrees apart, with a
   * small random rotation.  We use one fixed draw so the page is repeatable.
   */
  function initialTriangle(randomDraw) {
    const rnd = randomDraw === undefined ? 0.25 : randomDraw;
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const r = Math.min(VIEW.width, VIEW.height) / 3;
    const turn = (Math.PI / 2 - Math.PI * rnd) / 4;
    return [0, 1, 2].map((i) => {
      const t = (-2 * Math.PI / 3) * i + turn;
      return point(cx + r * Math.sin(t), cy + r * Math.cos(t));
    });
  }

  function start(options) {
    const o = options || {};
    const [A, B, C] = initialTriangle();
    return {
      A, B, C,
      options: {
        up: normalize("up", o.up === undefined ? LIMITS.up.initial : o.up),
        down: normalize("down", o.down === undefined ? LIMITS.down.initial : o.down),
        angle: normalize("angle", o.angle === undefined ? LIMITS.angle.initial : o.angle),
        names: o.names === undefined ? true : !!o.names,
      },
      explored: false,
    };
  }

  function normalize(name, raw) {
    const lim = LIMITS[name];
    if (!lim) return raw;
    const n = Number(raw);
    if (!Number.isFinite(n)) return lim.initial;
    const v = Math.max(lim.min, Math.min(lim.max, n));
    return name === "angle" ? Math.round(v) : Math.round(v * 100) / 100;
  }

  function reset(state) {
    // The applet's Reset button restores all three scrollbars; only the
    // ShowNames checkbox keeps the player's choice.
    const s = start({ names: state ? state.options.names : undefined });
    if (state) s.explored = !!state.explored;
    return s;
  }

  function move(state, name, p) {
    if (!state || !["A", "B", "C"].includes(name) || !finite(p)) return state;
    return Object.assign({}, state, { [name]: clamp(p), explored: true });
  }

  function setOption(state, name, value) {
    if (!state || !Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    const v = name === "names" ? !!value : normalize(name, value);
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: v }), explored: true,
    });
  }

  /* ------------------------------------------------------------ geometry */

  /**
   * Compute(), with the same three loops and the same index shift as the
   * applet: the apex built on side i is stored in Napoleons[(i+2)%3].
   * Returns null only for non-finite input; individual apexes can be null
   * when the two rays are parallel (the applet stores NaN and skips them).
   */
  function compute(a, b, c, up, down, angleDeg) {
    if (![a, b, c].every(finite)) return null;
    const u = Number(up), d = Number(down), deg = Number(angleDeg);
    if (![u, d, deg].every(Number.isFinite)) return null;

    const V = [a, b, c];
    const Up = [], Down = [], turnedUp = [], turnedDown = [], apexes = [null, null, null];
    for (let i = 0; i < 3; i++) {
      const next = (i + 1) % 3;
      Up[i] = inSegment(V[i], V[next], u);
      Down[i] = inSegment(V[i], V[next], d);
    }
    const r = deg * Math.PI / 180;
    for (let i = 0; i < 3; i++) {
      const next = (i + 1) % 3;
      turnedUp[i] = rotate(Up[i], V[i], r, 1);
      turnedDown[i] = rotate(Down[i], V[next], r, -1);
      const x = intersect(Up[i], turnedUp[i], Down[i], turnedDown[i]);
      apexes[(i + 2) % 3] = x;
    }

    const [apexA, apexB, apexC] = apexes; // A' on BC, B' on CA, C' on AB
    const valid = apexes.every((p) => p !== null);
    const degenerateBase = [0, 1, 2].some((i) => dist(Up[i], Down[i]) < 1e-9);
    const sum = u + d;
    /* DrawTorricelli uses this exact 0.99..1.01 band to switch between the
     * three cevians plus a meeting dot and plain apex-to-vertex segments. */
    const showCevians = sum >= 0.99 && sum <= 1.01;
    const torricelli = valid && showCevians ? intersect(apexA, a, apexB, b) : null;

    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, a));
    const tol = 1e-6 * scale;
    const base = [], heights = [], baseAngles = [];
    for (let i = 0; i < 3; i++) {
      const apex = apexes[(i + 2) % 3];
      const span = dist(Up[i], Down[i]);
      base.push(span);
      if (apex) {
        heights.push(dist(Up[i], apex) / (span || 1));
        baseAngles.push([
          angle(Up[i], Down[i], apex) * 180 / Math.PI,
          angle(Down[i], Up[i], apex) * 180 / Math.PI,
        ]);
      }
    }
    const spread = (xs) => (xs.length ? Math.max(...xs) - Math.min(...xs) : Infinity);
    const isotomicError = Math.abs(sum - 1);
    const baryFractions = [a, b, c].map((p, i) => dist(p, Down[i]) / (dist(p, V[(i + 1) % 3]) || 1));
    const baseAngleError = spread(baseAngles.map((pair) => Math.abs(pair[0] - pair[1])));
    const sideAngleError = spread(baseAngles.map((pair) => (pair[0] + pair[1]) / 2));
    const similarityError = spread(heights);

    let concurrencyError = Infinity;
    if (valid) {
      const p0 = lineIntersection(apexA, a, apexB, b);
      const p1 = lineIntersection(apexB, b, apexC, c);
      const p2 = lineIntersection(apexC, c, apexA, a);
      if (p0 && p1 && p2) {
        concurrencyError = Math.max(dist(p0, p1), dist(p1, p2), dist(p0, p2));
      }
    }

    const claims = {
      isotomic: isotomicError <= 1e-9,
      sameBarycentric: spread(baryFractions) <= tol,
      isosceles: valid && baseAngleError <= 1e-6 && similarityError <= 1e-6,
      similar: valid && sideAngleError <= 1e-6 && similarityError <= 1e-6,
      concurrent: valid && concurrencyError <= tol,
      showCevians: showCevians,
    };

    return {
      A: a, B: b, C: c,
      K: Down[0], L: Up[0], P: Down[1], Q: Up[1], M: Down[2], N: Up[2],
      Up, Down, turnedUp, turnedDown,
      apexes, Aprime: apexA, Bprime: apexB, Cprime: apexC,
      torricelli, valid, degenerateBase, showCevians,
      sum, base, heights, baseAngles, baryFractions,
      measures: {
        isotomicError, barySpread: spread(baryFractions), baseAngleError,
        sideAngleError, similarityError, concurrencyError, tol,
      },
      claims,
    };
  }

  function geometry(state) {
    if (!state || !state.options) return null;
    return compute(state.A, state.B, state.C,
      state.options.up, state.options.down, state.options.angle);
  }

  /* An illustration, not a game: no win, no loss and no finishing move. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move A, B or C to make a triangle.";
    if (g.degenerateBase) {
      return "Two points on a side are on top of each other, so the small triangles have no base. Move a slider.";
    }
    if (!g.valid) {
      return "The triangle sides are parallel at this angle, so the apexes are off the drawing. Move the angle slider.";
    }
    if (g.showCevians && g.claims.concurrent) {
      return `AA', BB' and CC' meet at one point (off by ${g.measures.concurrencyError.toFixed(2)} in the drawing). Drag A, B or C: they still meet.`;
    }
    if (g.showCevians) {
      return `AA', BB' and CC' nearly meet, off by ${g.measures.concurrencyError.toFixed(1)}.`;
    }
    return `The two sliders add to ${g.sum.toFixed(2)}, not 1, so K and L are not isotomic: the three lines need not meet.`;
  }

  return {
    VIEW, PAD, LIMITS, point, finite, dist, angle, cross, clamp,
    inSegment, rotate, intersect, lineIntersection, distanceToLine,
    initialTriangle, normalize, start, reset, move, setOption,
    compute, geometry, result, describe,
  };
})();
