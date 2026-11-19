"use strict";

/*
 * Cantor sets — the logic behind Alexander Bogomolny's `Cantor` applet.
 *
 * The applet is not a middle-third drawing game. It shows the tent map
 *   T(x) = a*x  for x <= 1/2,   T(x) = a*(1-x) for x > 1/2,
 * with a draggable peak (the blue spot at x = 1/2, height a/2) and one
 * "Iterate" checkbox. While Iterate is on, the applet walks a *backwards*
 * orbit: X0 = Y0, Y0 = TInverse(X0), where TInverse picks one of the two
 * preimages y/a or (a-y)/a with a coin toss (and returns 0 if y > 1). Each
 * later repaint draws a vertical mark at x = Y0 with its top at the height
 * X0. At the opening value a = 3 those two inverse branches are exactly the
 * two maps x/3 and 1 - x/3 whose repeated use builds the Cantor set: after
 * p steps every mark lies in the p-th approximation of C0. This is the one
 * idea the code relies on — the Cantor set is the attractor of the inverse
 * tent map — plus the ternary description C0 = {digits 0 or 2 only}.
 *
 * The page linked from the applet is an *article* about the Cantor set and
 * the Cantor function; it embeds no applet. Its claims (counts, lengths,
 * ternary expansions, the devil's staircase) are checked in
 * porting/check-cantor.mjs against the exact arithmetic below.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CantorCore, so the page loads it with a
 * plain <script> and porting/check-cantor.mjs loads it in Node. The position
 * is plain JSON (numbers, booleans, arrays, plain objects).
 */
const CantorCore = (() => {
  const DEFAULT_A = 3; // the applet's opening value; dragging stops at a < 2
  const X_START = 0.123456; // m_X0 in the applet
  const Y_START = 0; // m_Y0 in the applet
  const WARMUP = 15; // marks start once the old counter is > 15
  const MAX_MARKS = 24;

  /* ------------------------------------------------------ exact arithmetic */

  // Fractions {n, d}, d > 0, always reduced so the same value has one shape
  // and repeated splitting never overflows. At the depths we use (<= 20)
  // numerator and denominator stay well inside exact integer range.
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a || 1;
  }
  const F = (n, d) => {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  };
  const fadd = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
  const fsub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
  const fmul = (a, b) => F(a.n * b.n, a.d * b.d);
  const fdiv = (a, b) => F(a.n * b.d, a.d * b.n);
  const fnum = (a) => a.n / a.d;
  const third = F(1, 3);

  /* ------------------------------------------------------------ position */

  /** The position a new run starts from (options: { a }). */
  function start(options) {
    const want = options && options.a !== undefined ? Number(options.a) : DEFAULT_A;
    const a = Number.isFinite(want) && want > 0 && want <= 3 ? want : DEFAULT_A;
    return { a, running: false, step: 0, x: X_START, y: Y_START, orbit: [], marks: [] };
  }

  /** The applet's drag test: the new a is kept only when mouseY > 0 and a < 2. */
  function validDrag(mouseY, a) {
    return mouseY > 0 && Number.isFinite(a) && a > 0 && a < 2;
  }

  /** The value dragged out of the peak; matches mouseDragged in the bytecode. */
  function dragA(mouseY, offsetY, rect) {
    const y = mouseY + offsetY;
    return (4 * (rect.y + rect.height - y)) / rect.height;
  }

  /** A new position with a changed peak. The slider may also return to a = 3. */
  function setA(state, a) {
    if (!Number.isFinite(a) || a <= 0 || a > 3) return state;
    return Object.assign({}, state, { a });
  }

  /* ----------------------------------------------------- the tent map itself */

  /** T(x) — dcmpg with 0.5 in the applet: <= 0.5 takes the left branch. */
  function tent(a, x) {
    return x <= 0.5 ? a * x : a * (1 - x);
  }

  /** TInverse(y) with the applet's coin already chosen: coin 1 = right branch. */
  function inverseTent(a, y, coin) {
    if (y > 1) return 0;
    return coin > 0 ? y / a : (a - y) / a;
  }

  /** ComputeIterates: X0 = Y0, Y0 = F(X0). */
  function computeIterates(state, coin) {
    const x = state.y;
    return Object.assign({}, state, {
      x,
      y: inverseTent(state.a, x, coin),
      orbit: state.orbit.concat([x]).slice(-MAX_MARKS),
    });
  }

  /**
   * One repaint while Iterate is on (applet's Draw). For old step <= 15 the
   * orbit advances silently; after that DrawIterates first records a mark at
   * x = Y0 with its top at Convert(X0), then advances the orbit.
   */
  function tick(state, coin) {
    if (!state.running) return state;
    const mark = state.step > WARMUP ? { x: state.y, top: state.x } : null;
    const next = computeIterates(state, coin);
    return Object.assign(next, {
      step: state.step + 1,
      marks: mark ? state.marks.concat([mark]).slice(-MAX_MARKS) : state.marks,
    });
  }

  /** Set whether Iterate is on; like start(), turning it on restarts at 0. */
  function setRunning(state, running) {
    if (running) return Object.assign({}, state, { running: true, step: 0, marks: [] });
    if (!state.running) return state;
    return Object.assign({}, state, { running: false });
  }

  /** The demo has been explored as soon as the orbit has moved once. */
  function explored(state) {
    return state.step > 0;
  }

  /* ------------------------------------------------------------- geometry */

  /** Convert(value) in the applet: 0 sits on the base, 2 at the top. */
  function convert(value, rect) {
    return rect.y + rect.height - (rect.height / 2) * value;
  }

  /** The peak of the red tent and the blue handle: (1/2, a/2). */
  function tentPeak(a, rect) {
    return { x: rect.x + rect.width / 2, y: convert(a / 2, rect) };
  }

  /* ------------------------------------------- middle-thirds / ternary maths */

  /** The closed intervals left after p rounds, as exact fractions. */
  function remainingIntervals(p) {
    let pairs = [[F(0, 1), F(1, 1)]]; // [lo, hi] pairs, starting with [0, 1]
    for (let k = 0; k < p; k++) {
      const next = [];
      for (const [lo, hi] of pairs) {
        const t = fdiv(fsub(hi, lo), F(3, 1));
        next.push([lo, fadd(lo, t)], [fsub(hi, t), hi]);
      }
      pairs = next;
    }
    return pairs.map(([lo, hi]) => ({ lo, hi }));
  }

  /** The open middle thirds removed at rounds 1..p: {p, k, lo, hi}. */
  function removedIntervals(p) {
    const out = [];
    let pairs = [[F(0, 1), F(1, 1)]];
    for (let level = 1; level <= p; level++) {
      const next = [];
      pairs.forEach(([lo, hi], i) => {
        const t = fdiv(fsub(hi, lo), F(3, 1));
        const gapLo = fadd(lo, t);
        const gapHi = fsub(hi, t);
        out.push({ p: level, k: i + 1, lo: gapLo, hi: gapHi });
        next.push([lo, gapLo], [gapHi, hi]);
      });
      pairs = next;
    }
    return out;
  }

  /** Exact total length left after p rounds: 2^p / 3^p. */
  function remainingLength(p) {
    return F(Math.pow(2, p), Math.pow(3, p));
  }

  /** Ternary digits of x = n/d: the ordinary expansion, padded with zeros. */
  function ternaryDigits(x, depth) {
    let n = x.n;
    const d = x.d;
    if (n === 0) return Array(depth).fill(0);
    if (n === d) return Array(depth).fill(2);
    const digs = [];
    for (let i = 0; i < depth; i++) {
      const t = 3 * n;
      const digit = Math.floor(t / d);
      digs.push(digit);
      n = t - digit * d;
      if (n === 0) break;
    }
    while (digs.length < depth) digs.push(0);
    return digs;
  }

  /**
   * The article's convention: a representation ending in 1000... is replaced
   * by ...0222..., so 1/3 = 0.1 = 0.0222... and belongs to C0. x = 1 itself
   * becomes 0.2222.... This is the expansion membership and f use.
   */
  function cantorDigits(x, depth) {
    const digs = ternaryDigits(x, depth);
    let j = digs.length - 1;
    while (j >= 0 && digs[j] === 0) j--;
    if (x.n === x.d) return Array(depth).fill(2);
    if (j >= 0 && digs[j] === 1) {
      digs[j] = 0;
      for (let k = j + 1; k < depth; k++) digs[k] = 2;
    }
    return digs;
  }

  /** Membership in C0: no ternary digit is 1 (with the convention above). */
  function inCantor(x, depth = 20) {
    return cantorDigits(x, depth).every((digit) => digit !== 1);
  }

  /**
   * The Cantor function f(x): read ternary digits as binary (0 -> 0, 2 -> 1).
   * At the first digit 1 we are inside a removed gap, so f is constant there:
   * turn that digit into a 1 and every later digit into a 0. Truncated at
   * `depth` places, so exact values are approached from below.
   */
  function cantorFunction(x, depth = 20) {
    const digs = cantorDigits(x, depth);
    const firstOne = digs.indexOf(1);
    let sum = 0;
    let place = 2;
    for (let i = 0; i < digs.length; i++) {
      const bit = digitsToBit(digs[i], i === firstOne);
      if (bit) sum += 1 / place;
      place *= 2;
    }
    return sum;
  }

  function digitsToBit(digit, atFirstOne) {
    if (digit === 2 || atFirstOne) return 1;
    return 0;
  }

  /* ----------------------------------------------------------- descriptions */

  /** A sentence in words describing what just changed, for #status. */
  function describe(action, state) {
    const a = state.a.toFixed(2);
    switch (action) {
      case "reset":
        return "Reset: the peak is back at a = 3.00 and the marks are cleared.";
      case "a":
        return a > 2
          ? "The peak moved to a = " + a + ": this is the Cantor setting, where the two inverse branches keep every step inside the set."
          : "The peak moved to a = " + a + ": the two inverse branches still land in [0, 1].";
      case "iterate-on":
        return "Iterate switched on: the backwards orbit starts again from y = " + state.y.toFixed(3) + ".";
      case "iterate-off":
        return "Iterate switched off: the orbit stopped at step " + state.step + " with " + state.marks.length + " marks on the board.";
      case "step":
        if (state.marks.length && state.step > WARMUP) {
          const m = state.marks[state.marks.length - 1];
          return "Step " + state.step + ": a new mark stands at x = " + m.x.toFixed(3) +
            " rising to height " + m.top.toFixed(3) + "; the next value is " + state.y.toFixed(3) + ".";
        }
        return "Step " + state.step + ": the orbit moved to y = " + state.y.toFixed(3) +
          (state.running ? "; the first marks appear after step " + (WARMUP + 1) + "." : ".");
      default:
        return "";
    }
  }

  return {
    DEFAULT_A, X_START, Y_START, WARMUP,
    F, fnum, start, validDrag, dragA, setA,
    tent, inverseTent, computeIterates, tick, setRunning, explored,
    convert, tentPeak,
    remainingIntervals, removedIntervals, remainingLength,
    ternaryDigits, cantorDigits, inCantor, cantorFunction,
    describe,
  };
})();
