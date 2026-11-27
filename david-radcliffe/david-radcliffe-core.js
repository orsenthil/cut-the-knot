"use strict";

/*
 * David Radcliffe — Bogomolny's "Regular Polygons in a Triangular Grid" applet.
 *
 * The applet draws a regular N-gon, erects an equilateral triangle on each
 * side pointing towards the centre, and joins the new third vertices into a
 * second regular N-gon. David Radcliffe used this construction to answer
 * James Tanton's question: a triangular lattice cannot contain a square,
 * because a square in it would make a smaller square in it, and so on.
 *
 * The two ideas the code relies on:
 *
 *   1. In screen coordinates (y downwards) the third vertex of the triangle
 *      on side A->B is A + rot(+60 degrees)(B - A). The applet obtains the
 *      same point by rotating B about A and A about B and intersecting the
 *      two lines (GeoSDoub.Rotate + GeoSDoub.Intersect); porting/check-*
 *      transcribes that second method literally and compares the two for
 *      every N in the spinner's range on several canvas sizes.
 *   2. For a regular N-gon centred at O the apexes are lambda * V[i], where
 *      lambda = 1 + exp(i*pi/3)(exp(2*pi*i/N) - 1). Its modulus is
 *      |cos(pi/N) - sqrt(3) sin(pi/N)| = |2 cos(pi/N + pi/3)|. That is < 1
 *      for every N >= 4 except N = 6 where it is 0; for N = 3 it is 1.
 *      The lattice is closed under a 60 degree turn about any of its nodes,
 *      so all apexes of a lattice polygon are lattice nodes as well.
 *
 * Nothing can be won or lost: this is an illustration, not a game. The
 * position is plain data (numbers and arrays of points), so it can be saved
 * and handed to the tutor as it is. Functions take a position and return a
 * new one; they do not change what they are given. No document, no window,
 * no storage: one global, DavidRadcliffeCore.
 */
const DavidRadcliffeCore = (() => {
  /* DavidRadcliffePanel: SpinnerNumberModel(4, 3, 30, 1). */
  const RANGES = Object.freeze({ N: [3, 30] });
  const DEFAULTS = Object.freeze({ N: 4, width: 600, height: 450, angle: 0 });
  const PI3 = Math.PI / 3;
  const SQRT3 = Math.sqrt(3);
  const copy = (p) => ({ x: p.x, y: p.y });

  /** The spinner never leaves 3..30; clamp like the number model does. */
  function clampOption(name, value) {
    const range = RANGES[name];
    if (!range) throw new Error(`unknown option ${name}`);
    const v = Math.round(Number(value));
    if (!Number.isFinite(v)) throw new Error(`${name} must be a number`);
    return Math.min(range[1], Math.max(range[0], v));
  }

  /** Rotate a vector by `theta` in screen coordinates (y downwards). */
  function rot(p, theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return { x: c * p.x - s * p.y, y: s * p.x + c * p.y };
  }

  /**
   * The third vertex of the equilateral triangle on A->B that points the
   * same way as the applet's inward triangles. This is the analytic form of
   * EqTr(); the test compares it with the literal bytecode transcription.
   */
  function eqTriangle(a, b) {
    const apex = rot({ x: b.x - a.x, y: b.y - a.y }, PI3);
    return { x: a.x + apex.x, y: a.y + apex.y };
  }

  /** DavidRadcliffeCanvas.Reset: V[i] on a circle of radius min(w,h)/2.5. */
  function regularPolygon(n, center, radius, angle) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = ((Math.PI * 2) / n) * i + angle;
      out.push({ x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) });
    }
    return out;
  }

  /** Build the state Reset() leaves behind, including U[] = apexes of V[]. */
  function start(options = {}) {
    const N = clampOption("N", options.N === undefined ? DEFAULTS.N : options.N);
    const width = options.width === undefined ? DEFAULTS.width : options.width;
    const height = options.height === undefined ? DEFAULTS.height : options.height;
    const angle = options.angle === undefined ? DEFAULTS.angle : options.angle;
    // Java's integer division truncates towards zero.
    const center = { x: Math.trunc(width / 2), y: Math.trunc(height / 2) };
    const radius = Math.min(width, height) / 2.5;
    const V = regularPolygon(N, center, radius, angle);
    const U = V.map((p, i) => eqTriangle(p, V[(i + 1) % N]));
    return { N, width, height, angle, center, radius, V, U };
  }

  /** Change the spinner: the applet calls Reset(), so the polygon is rebuilt. */
  function withN(state, n) {
    const N = clampOption("N", n);
    return start({ N, width: state.width, height: state.height, angle: state.angle });
  }

  /** Rotate the whole picture without changing any of its lengths. */
  function withAngle(state, angle) {
    return start({ N: state.N, width: state.width, height: state.height, angle });
  }

  /** |lambda| for the inward-triangle construction; the side-length ratio. */
  function innerScale(n) {
    const p = Math.PI / n;
    return Math.abs(Math.cos(p) - SQRT3 * Math.sin(p));
  }

  /** The other construction on the page: a[i-1] + a[i+1] - a[i]. */
  function alternativeStep(poly) {
    const n = poly.length;
    return poly.map((p, i) => {
      const before = poly[(i - 1 + n) % n], after = poly[(i + 1) % n];
      return {
        x: before.x + after.x - p.x,
        y: before.y + after.y - p.y,
      };
    });
  }

  /** Its scale factor: 2cos(2pi/n) - 1, rotated by 180 degrees when negative. */
  function alternativeScale(n) {
    return Math.abs(2 * Math.cos((2 * Math.PI) / n) - 1);
  }

  /*
   * The triangular lattice in basis u=(1,0), v=(1/2,sqrt(3)/2): a node has
   * integer coordinates (m,n) and cartesian position m*u + n*v. Turning by
   * +60 degrees maps u -> v and v -> v-u, i.e. (m,n) -> (-n, m+n). Turning
   * by -60 degrees maps (m,n) -> (m+n, -m). Both keep integer coordinates,
   * which is why the apex of any segment between nodes is another node.
   */
  function latticeApex(a, b, sign) {
    const dx = b.m - a.m, dy = b.n - a.n;
    const turned = sign >= 0 ? { m: -dy, n: dx + dy } : { m: dx + dy, n: -dx };
    return { m: a.m + turned.m, n: a.n + turned.n };
  }

  function latticePoint(coords, scale = 1) {
    return { x: scale * (coords.m + coords.n / 2), y: scale * coords.n * SQRT3 / 2 };
  }

  /** A short summary used by the page's status line. */
  function claims(n) {
    const ratio = innerScale(n);
    const alt = alternativeScale(n);
    return {
      N: n,
      ratio,
      smaller: ratio > 1e-9 && ratio < 1 - 1e-9,
      collapses: ratio < 1e-9,
      sameSize: Math.abs(ratio - 1) < 1e-9,
      alternative: alt,
      alternativeSmaller: alt > 1e-9 && alt < 1 - 1e-9,
      // The page's exceptions: triangle (no shrink), hexagon (a point).
      exception: n === 3 || n === 6,
    };
  }

  /** This illustration has no win, loss or finished state. */
  function result(/* state */) {
    return null;
  }

  return {
    RANGES, DEFAULTS, clampOption, rot, eqTriangle, regularPolygon, start,
    withN, withAngle, innerScale, alternativeStep, alternativeScale,
    latticeApex, latticePoint, claims, result,
  };
})();
