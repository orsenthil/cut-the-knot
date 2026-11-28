"use strict";

/*
 * Inversion in an Arbelos, from Alexander Bogomolny's applet InversionInArbelos
 * and its article "Chain of Inscribed Circles" (cut-the-knot.org).
 *
 * Two circles are tangent at O (the centre of inversion). Inversion sends them
 * to two parallel lines, and sends the chain of circles inscribed in the gap
 * to a stack of EQUAL circles between those lines: circle n has its centre n
 * diameters above the axis. Inverting that stack back gives, for every n,
 *     h_n = 2n R_n                  (the Pappus chain theorem)
 * and with k = (B-A)/(A-O), R = (radius of inversion)^2 / (2(A-O)):
 *     R_n = R k / (k^2 n^2 + k + 1),  AP_n = R(k+2) / (k^2 n^2 + k + 1).
 *
 * The position is plain data: four draggable points on the axis, the number of
 * chain circles (1..50, the applet's range) and the guide-line flag. No DOM,
 * no storage, one global, so the page renders it and the Node check tests it.
 */

const InversionInArbelosCore = (() => {
  const VIEW = { width: 420, height: 300 };
  const AXIS_Y = 245;
  const N_MIN = 1;
  const N_MAX = 50;

  // The applet's own starting points, scaled into this board: O is the centre
  // of inversion, R sets its radius, A and B are the two parallel lines.
  const START = {
    O: { x: 70, y: AXIS_Y },
    R: { x: 210, y: AXIS_Y },
    A: { x: 190, y: AXIS_Y },
    B: { x: 270, y: AXIS_Y },
    N: 1,
    hints: false,
  };

  // Keep the nested circles on the board and the handles apart.
  const MIN_P = 40;      // A.x - O.x
  const MIN_GAP = 30;    // B.x - A.x
  const MIN_RHO = 20;    // R.x - O.x
  const MIN_TOP = 12;    // top of the outer circle, in board units

  const finite = (v, fallback) => (Number.isFinite(v) ? v : fallback);
  const round = (v) => Number(v.toFixed(6));

  /** The largest inversion radius that still fits the outer circle on board. */
  function maxRho(oX, aX) {
    return Math.sqrt(Math.max(MIN_RHO, aX - oX) * (AXIS_Y - MIN_TOP));
  }

  /** Put a dragged point back on the axis, inside the applet's limits. */
  function clampPoint(src, name, q) {
    const get = (key) => finite(src[key] && src[key].x, START[key].x);
    const x = finite(q && q.x, get(name));
    let v;
    if (name === "O") v = Math.max(20, Math.min(get("A") - MIN_P, x));
    else if (name === "A") v = Math.max(get("O") + MIN_P, Math.min(get("B") - MIN_GAP, x));
    else if (name === "B") v = Math.max(get("A") + MIN_GAP, Math.min(VIEW.width - 16, x));
    else v = Math.max(get("O") + MIN_RHO, Math.min(get("O") + maxRho(get("O"), get("A")), x));
    return { x: v, y: AXIS_Y };
  }

  /** Fill in missing options and clamp them into the valid region. */
  function normalise(options) {
    const src = options || {};
    const s = {
      O: { x: finite(src.O && src.O.x, START.O.x), y: AXIS_Y },
      A: { x: finite(src.A && src.A.x, START.A.x), y: AXIS_Y },
      B: { x: finite(src.B && src.B.x, START.B.x), y: AXIS_Y },
      R: { x: finite(src.R && src.R.x, START.R.x), y: AXIS_Y },
      N: Math.round(finite(src.N, START.N)),
      hints: !!src.hints,
    };
    // Widen the limits for O first, then clamp A, B and R against it.
    s.O = clampPoint({ O: { x: 20 }, A: { x: VIEW.width - 16 } }, "O", s.O);
    s.A = clampPoint(s, "A", s.A);
    s.B = clampPoint(s, "B", s.B);
    s.R = clampPoint(s, "R", s.R);
    s.N = Math.max(N_MIN, Math.min(N_MAX, s.N));
    s.hints = !!s.hints && s.N > 1;
    return s;
  }

  /** A fresh diagram. Options may override any of the four points, N or hints. */
  function start(options) {
    return normalise(options);
  }

  /** Move one handle; the input state is never changed. */
  function setPoint(state, name, p) {
    if (!["O", "A", "B", "R"].includes(name)) return normalise(state);
    const s = normalise(state);
    s[name] = clampPoint(s, name, p);
    // Moving a boundary can push the other points out of range.
    s.A = clampPoint(s, "A", s.A);
    s.B = clampPoint(s, "B", s.B);
    s.R = clampPoint(s, "R", s.R);
    return s;
  }

  /** The applet's N spinner: whole circles, 1 to 50. */
  function setN(state, n) {
    const s = normalise(state);
    s.N = Math.max(N_MIN, Math.min(N_MAX, Math.round(finite(n, s.N))));
    s.hints = s.hints && s.N > 1; // the applet disables the checkbox at N=1
    return s;
  }

  /** The applet's "Center lines and common tangents" checkbox (off at N=1). */
  function setHints(state, on) {
    const s = normalise(state);
    s.hints = !!on && s.N > 1;
    return s;
  }

  /**
   * Everything the page draws, derived from the four points and N. The two
   * tangent circles are the inverses of the vertical lines through A and B;
   * the chain circles are the inverses of equal circles stacked between them.
   */
  function geometry(state) {
    const s = normalise(state);
    const p = s.A.x - s.O.x;
    const q = s.B.x - s.O.x;
    const gap = q - p;                    // B.x - A.x
    const rho = s.R.x - s.O.x;            // radius of inversion
    const rho2 = rho * rho;
    const outerR = rho2 / (2 * p);        // inverse of the line at A
    const innerR = rho2 / (2 * q);        // inverse of the line at B
    const k = gap / p;
    const strip = {
      center: { x: s.O.x + (p + q) / 2, y: AXIS_Y },
      radius: gap / 2,
      step: gap,
    };
    const chain = [];
    for (let n = 0; n < s.N; n++) {
      // x' = (p+q)/2, y' = n*gap, r' = gap/2;  d'^2 - r'^2 = p*q + n^2 gap^2.
      const denom = p * q + n * n * gap * gap;
      const radius = rho2 * (gap / 2) / denom;
      const height = rho2 * (n * gap) / denom;
      const distance = rho2 * ((p + q) / 2) / denom;
      chain.push({
        n: n,
        center: { x: s.O.x + distance, y: AXIS_Y - height },
        radius: radius,
        height: height,
        AP: distance,
      });
    }
    return {
      O: s.O, A: s.A, B: s.B, R: s.R, N: s.N, hints: s.hints,
      p: p, q: q, gap: gap, rho: rho, k: k,
      outer: { center: { x: s.O.x + outerR, y: AXIS_Y }, radius: outerR },
      inner: { center: { x: s.O.x + innerR, y: AXIS_Y }, radius: innerR },
      inversion: { center: s.O, radius: rho },
      Aprime: { x: s.O.x + rho2 / p, y: AXIS_Y },
      Bprime: { x: s.O.x + rho2 / q, y: AXIS_Y },
      RL: innerR, RR: outerR - innerR, Rbig: outerR,
      strip: strip,
      chain: chain,
    };
  }

  /** A compact JSON-safe snapshot for Track.state and the tutor. */
  function position(state) {
    const g = geometry(state);
    return {
      O: { x: round(g.O.x), y: round(g.O.y) },
      R: { x: round(g.R.x), y: round(g.R.y) },
      A: { x: round(g.A.x), y: round(g.A.y) },
      B: { x: round(g.B.x), y: round(g.B.y) },
      N: g.N,
      hints: g.hints,
      k: round(g.k),
      R: round(g.Rbig),
      RL: round(g.RL),
      RR: round(g.RR),
      chain: g.chain.map((c) => ({
        n: c.n,
        center: { x: round(c.center.x), y: round(c.center.y) },
        radius: round(c.radius),
        height: round(c.height),
      })),
    };
  }

  return {
    VIEW: VIEW, AXIS_Y: AXIS_Y, N_MIN: N_MIN, N_MAX: N_MAX,
    START: START, MIN_P: MIN_P, MIN_GAP: MIN_GAP, MIN_RHO: MIN_RHO,
    maxRho: maxRho, clampPoint: clampPoint, normalise: normalise,
    start: start, setPoint: setPoint, setN: setN, setHints: setHints,
    geometry: geometry, position: position,
  };
})();
