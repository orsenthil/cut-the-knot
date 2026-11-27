"use strict";

/*
 * From Grebe, from Alexander Bogomolny's applet FromGrebe (cut-the-knot.org,
 * "Grebe: from Ladies' Diary to Carroll's Pillow").
 *
 * The player drags a triangle A'B'C'. A square is built on each side; the
 * outer sides of those squares meet at A0, B0 and C0. Grebe's theorem says
 * that A'A0, B'B0 and C'C0 all pass through one point K, the Lemoine
 * (symmedian) point of A'B'C'. Joining K to the far square corners cuts the
 * sides of A'B'C' at S; rotating such a pair by a right angle gives a corner
 * of the sought triangle ABC. The whole construction is a homothety about K
 * with factor D / (D - (a*a+b*b+c*c)), where D is twice the signed area.
 * For the winding that puts the squares outside, that is
 * 2*area / (a*a + b*b + c*c + 2*area), so the answer is unique.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, FromGrebeCore. Every point is a plain
 * {x, y} in board units, so the page and the tutor can save it as it is.
 * The formulas below are transcribed from FromGrebeCanvas.Compute(),
 * GetSquare(), GeoSDoub.Rotate() and GeoSDoub.Intersect() in the .class files.
 */
const FromGrebeCore = (() => {
  /** The SVG's user-unit rectangle; the page's viewBox must match. */
  const VIEW = { width: 500, height: 380 };
  const MARGIN = 14;

  /** A scaled version of the applet's opening triangle, fitting the view. */
  const START = {
    A: { x: 170, y: 220 },
    B: { x: 250, y: 220 },
    C: { x: 195, y: 160 },
  };

  const HALF_PI = Math.PI / 2;
  const NAMES = ["A", "B", "C"];
  const PRIMES = ["A\u2032", "B\u2032", "C\u2032"]; // A', B', C'
  const ZEROS = ["A\u2080", "B\u2080", "C\u2080"]; // A0, B0, C0
  const SUBS = ["a", "b", "c"];

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finitePoint = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const finite = (p) => finitePoint(p) && Number.isFinite(p.y);

  function clampToBoard(p) {
    return {
      x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    };
  }

  /**
   * GeoSDoub.Rotate(center, point, angle, dir): cos/sin expansion, with dir
   * choosing the turn. dir = +1 is the applet's GetSquare turn, -1 is the
   * turn used for the reconstructed corners.
   */
  function rotate(center, point, angle, dir) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = point.x - center.x, dy = point.y - center.y;
    return {
      x: center.x + c * dx - dir * s * dy,
      y: center.y + dir * s * dx + c * dy,
    };
  }

  /** Intersection of the infinite lines ab and cd; NaN when (nearly) parallel. */
  function intersect(a, b, c, d) {
    const r = { x: b.x - a.x, y: b.y - a.y };
    const s = { x: d.x - c.x, y: d.y - c.y };
    const den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
    return { x: a.x + t * r.x, y: a.y + t * r.y };
  }

  /** Twice the signed area of a triangle; positive when A,B,C turn left. */
  function twiceArea(A, B, Cc) {
    return (B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x);
  }

  function sideSquares(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y) ** 2;
  }

  /**
   * FromGrebeCanvas.Compute() in the order of the bytecode. The three square
   * corners, the outer-line intersections, the concurrency point, the cuts on
   * the triangle sides and the reconstructed triangle are all plain data.
   * The applet stops drawing when any side is shorter than two board units;
   * that is reported as valid: false.
   */
  function construct(A, B, Cc) {
    const T = [A, B, Cc];
    if ([dist(T[0], T[1]), dist(T[1], T[2]), dist(T[2], T[0])].some((d) => d < 2)) {
      return { valid: false };
    }

    // GetSquare(A[i], A[i+1], As[i][0], As[i][1]).
    const As = T.map((p, i) => {
      const q = T[(i + 1) % 3];
      return [rotate(p, q, HALF_PI, 1), rotate(q, p, HALF_PI, -1)];
    });
    // Line[i] is the outer side of the square on side i; P[i] is its meeting
    // with the previous outer side: A0, B0, C0 in the article's notation.
    const P = [0, 1, 2].map((i) => intersect(As[i][0], As[i][1],
      As[(i + 2) % 3][0], As[(i + 2) % 3][1]));

    // The three cevians A'A0, B'B0, C'C0 meet at K. CTKGeometryPlus.Barycenter
    // averages their pairwise intersections (they agree up to round-off).
    const cevian = [0, 1, 2].map((i) => intersect(T[i], P[i], T[(i + 1) % 3], P[(i + 1) % 3]));
    const K = {
      x: (cevian[0].x + cevian[1].x + cevian[2].x) / 3,
      y: (cevian[0].y + cevian[1].y + cevian[2].y) / 3,
    };

    // Rays from K through both far corners of each square cut that side.
    const S = T.map((p, i) => {
      const q = T[(i + 1) % 3];
      return [intersect(K, As[i][0], p, q), intersect(K, As[i][1], p, q)];
    });
    // Rotate the two cuts of a side to get the far corner of a square on it.
    const Ap = S.map((s) => rotate(s[0], s[1], HALF_PI, -1));

    const g = {
      valid: [K, ...P, ...cevian, ...Ap, ...As.flat(), ...S.flat()].every(finite),
      A: T[0], B: T[1], C: T[2], As, P, cevian, K, S, Ap,
    };
    return g;
  }

  /**
   * A closed form for the homothety factor K->ABC, used by the status line.
   * With D = twice the signed area and S = a^2+b^2+c^2, the applet's fixed
   * +90-degree turn gives ABC = K + r(A'-K) with r = D/(D-S). For the winding
   * where the squares are outside (D < 0) this is 2*area/(S+2*area); for the
   * other winding it is negative, because the squares turn inward.
   */
  function factor(A, B, Cc) {
    const sum = sideSquares(B, Cc) + sideSquares(Cc, A) + sideSquares(A, B);
    const D = twiceArea(A, B, Cc);
    return D / (D - sum);
  }

  /** Barycentric coordinates of K with respect to the draggable triangle. */
  function barycentric(p, A, B, Cc) {
    const d = twiceArea(A, B, Cc);
    if (d === 0) return null;
    const l2 = ((p.x - A.x) * (Cc.y - A.y) - (p.y - A.y) * (Cc.x - A.x)) / d;
    const l3 = ((B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x)) / d;
    return [1 - l2 - l3, l2, l3];
  }

  function defaultOptions() {
    return { names: false };
  }

  /** The applet's "show" parameter defaults to 0 on its own page. */
  function start(options) {
    const opts = defaultOptions();
    if (options) for (const k in opts) if (k in options) opts[k] = Boolean(options[k]);
    return {
      A: { ...START.A }, B: { ...START.B }, C: { ...START.C },
      options: opts, touches: 0,
    };
  }

  /** A fresh, well-spread triangle, as close to the applet's init() as fits. */
  function randomStart(rand = Math.random) {
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const r = 0.25 * VIEW.width;
    const a0 = rand() * Math.PI * 2;
    const spread = 0.7 + rand() * 0.6;
    const at = (a) => clampToBoard({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    return {
      A: at(a0),
      B: at(a0 + spread * Math.PI / 2),
      C: at(a0 + spread * Math.PI * 1.17),
      options: defaultOptions(),
      touches: 0,
    };
  }

  /** Move one corner; the old position is not changed. */
  function moveVertex(state, name, point) {
    if (!["A", "B", "C"].includes(name) || !finitePoint(point)) return state;
    return { ...state, [name]: clampToBoard(point), touches: state.touches + 1 };
  }

  /** Move all three corners together (the applet drags the whole triangle). */
  function moveAll(state, dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return state;
    return {
      ...state,
      A: clampToBoard({ x: state.A.x + dx, y: state.A.y + dy }),
      B: clampToBoard({ x: state.B.x + dx, y: state.B.y + dy }),
      C: clampToBoard({ x: state.C.x + dx, y: state.C.y + dy }),
      touches: state.touches + 1,
    };
  }

  /** The panel's single "Show names" checkbox. */
  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return { ...state, options: { ...state.options, [name]: Boolean(on) } };
  }

  /** An illustration has no win or loss: Track counts it once it is explored. */
  function result() {
    return null;
  }

  /** A short status line reporting the invariant the player can watch. */
  function label(g) {
    if (!g || !g.valid) return "Move the corners apart so they form a triangle.";
    const r = factor(g.A, g.B, g.C);
    return `The three joining lines meet at K, the Lemoine point. ` +
      `The new triangle is a ${r.toFixed(3)} times copy of the one you drag, centred at K.`;
  }

  return {
    VIEW, START, HALF_PI, NAMES, PRIMES, ZEROS, SUBS,
    start, randomStart, moveVertex, moveAll, setOption, result,
    construct, geometry: construct, factor, barycentric, rotate, intersect,
    twiceArea, sideSquares, dist, finitePoint, clampToBoard, label,
  };
})();
