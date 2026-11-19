"use strict";

/*
 * Binomial Distribution, from Alexander Bogomolny's applet BinomialDistribution
 * (called "BinomialDistribution's Paradox" in getAppletInfo).
 *
 * It is a demo, not a game: two scrollbars choose the number of trials n and
 * the success probability p, and the applet draws b(k; n, p), the probability
 * of exactly k successes in n independent Bernoulli trials, for k = 0 .. n.
 * Nothing is won or lost; the demo counts as explored once a control is used.
 *
 * The one idea the code relies on is the applet's own recurrence: starting
 * from b(0) = (1 - p)^n, each next bar is
 *     b(k) = b(k - 1) * (n - k + 1) * p / k / (1 - p)
 * (with p == 1 handled separately). This is the binomial expansion C(n,k)
 * p^k (1 - p)^(n - k) computed without ever forming a large binomial
 * coefficient. The most likely k (the mode) is the integer m with
 * (n + 1) p - 1 < m <= (n + 1) p, i.e. floor((n + 1) p), capped at n.
 *
 * The applet's p scrollbar runs from 0 to 110 in raw units, mapped by
 * p = raw * 0.01, so p can be set as high as 1.10. That is outside the
 * probability range; the recurrence still evaluates the algebraic binomial
 * expansion there, but the bars alternate in sign. We keep the range faithful
 * and note the quirk in the maths section.
 *
 * No DOM, no storage: everything here is a pure function over plain data.
 * The position { p, n, k, explored } is plain JSON, so it can be saved for the
 * tutor as it is. This file defines one global, BinomialDistributionCore.
 */
const BinomialDistributionCore = (() => {
  // The applet's two AWT scrollbars:
  //   PScroll = Scrollbar(HORIZONTAL, 55, 10, 0, 110)  -> p = value * 0.01
  //   NScroll = Scrollbar(HORIZONTAL, 10,  5, 2, 105)
  const SCROLL = {
    p: {
      min: 0, max: 110, step: 1, initial: 55,
      toValue: (raw) => raw * 0.01,
      fromValue: (p) => Math.round(p * 100),
    },
    n: {
      min: 2, max: 105, step: 1, initial: 10,
      toValue: (raw) => raw,
      fromValue: (n) => n,
    },
  };

  const DEFAULTS = {
    p: SCROLL.p.toValue(SCROLL.p.initial), // 0.55
    n: SCROLL.n.toValue(SCROLL.n.initial), // 10
  };

  /** Keep a value inside a scrollbar's raw range and on its step. */
  function clampRaw(scroll, raw) {
    let v = Number.isFinite(raw) ? raw : scroll.initial;
    v = Math.round(v / scroll.step) * scroll.step;
    if (v < scroll.min) v = scroll.min;
    if (v > scroll.max) v = scroll.max;
    return v;
  }

  /** Clamp options to the applet's ranges. p is kept to two decimals. */
  function clampOptions(options) {
    const o = options || {};
    const pRaw = clampRaw(SCROLL.p, Number.isFinite(o.p) ? SCROLL.p.fromValue(o.p) : SCROLL.p.initial);
    const nRaw = clampRaw(SCROLL.n, Number.isFinite(o.n) ? SCROLL.n.fromValue(o.n) : SCROLL.n.initial);
    return { p: SCROLL.p.toValue(pRaw), n: SCROLL.n.toValue(nRaw) };
  }

  /**
   * The mode: the integer m with (n + 1)p - 1 < m <= (n + 1)p, i.e.
   * floor((n + 1)p). Capped to 0 .. n because the page's formula assumes
   * 0 < p < 1; at p = 1 it would give n + 1, while all the mass is at n.
   */
  function mode(p, n) {
    const m = Math.floor((n + 1) * p);
    if (m < 0) return 0;
    if (m > n) return n;
    return m;
  }

  /** Every k that attains the maximum of b(k). Usually one; two when
   * (n + 1)p is an integer in 1 .. n. */
  function modes(p, n) {
    const d = distribution(p, n);
    let best = -Infinity;
    for (const v of d) if (v > best) best = v;
    // The recurrence can leave a couple of ulps between two bars that are
    // mathematically equal (when (n + 1)p is an integer), so allow a hair.
    const tol = 1e-12 * (1 + Math.abs(best));
    const out = [];
    for (let k = 0; k <= n; k++) if (best - d[k] <= tol) out.push(k);
    return out;
  }

  /** b(0) ... b(n), transcribed literally from BinomialDistributionCanvas.Compute. */
  function distribution(p, n) {
    const count = n + 1;
    const d = new Array(count);
    d[0] = Math.pow(1 - p, n);
    if (p === 1) {
      for (let i = 0; i < n; i++) d[i] = 0;
      d[n] = 1;
    } else {
      for (let i = 1; i <= n; i++) {
        d[i] = d[i - 1] * (n - i + 1) * p / i / (1 - p);
      }
    }
    return d;
  }

  /** One bar: b(k; n, p) = C(n, k) p^k (1 - p)^(n - k), via the recurrence. */
  function pmf(p, n, k) {
    if (!Number.isInteger(k) || k < 0 || k > n) return 0;
    return distribution(p, n)[k];
  }

  /** b(k) / b(k - 1) = (n - k + 1) p / (k (1 - p)) = 1 + ((n+1)p - k)/(k(1-p)). */
  function ratio(p, n, k) {
    if (k < 1 || k > n || p === 1) return null;
    return (n - k + 1) * p / (k * (1 - p));
  }

  /** Sum of the probabilities. Should be 1 for any p with p + (1 - p) = 1. */
  function total(p, n) {
    return distribution(p, n).reduce((a, b) => a + b, 0);
  }

  /** The average (expected) number of successes, sum k * b(k) = n p. */
  function expectedValue(p, n) {
    const d = distribution(p, n);
    let sum = 0;
    for (let k = 0; k <= n; k++) sum += k * d[k];
    return sum;
  }

  /** The position a new exploration starts from. */
  function start(options) {
    const opts = clampOptions(options || DEFAULTS);
    return { p: opts.p, n: opts.n, k: mode(opts.p, opts.n), explored: false };
  }

  function explore(state) {
    return { p: state.p, n: state.n, k: state.k, explored: true };
  }

  /** The applet's p scroll: changes p, keeps the selected bar clamped. */
  function setP(state, p) {
    const opts = clampOptions({ p, n: state.n });
    return {
      p: opts.p,
      n: opts.n,
      k: Math.min(state.k, opts.n),
      explored: true,
    };
  }

  /** The applet's n scroll: changes n, keeps the selected bar clamped. */
  function setN(state, n) {
    const opts = clampOptions({ p: state.p, n });
    return {
      p: opts.p,
      n: opts.n,
      k: Math.min(state.k, opts.n),
      explored: true,
    };
  }

  /** Select a bar k (0 .. n) to inspect its probability. */
  function selectK(state, k) {
    let selected = Number.isFinite(k) ? Math.round(k) : 0;
    if (selected < 0) selected = 0;
    if (selected > state.n) selected = state.n;
    return { p: state.p, n: state.n, k: selected, explored: true };
  }

  /** Move the selected bar by delta, stopping at the ends. */
  function stepK(state, delta) {
    return selectK(state, state.k + delta);
  }

  /** "done" once explored — a demo has no win or loss. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  /** The applet's CTKFormat.CutDigits(p, 2) label, without a leading zero
   * (the AWT label starts as ".55"). */
  function formatP(p) {
    let s = p.toFixed(2);
    if (s.startsWith("0.")) s = s.slice(1);
    return s;
  }

  return {
    SCROLL, DEFAULTS, clampOptions,
    start, explore, setP, setN, selectK, stepK, result,
    distribution, pmf, ratio, total, expectedValue, mode, modes, formatP,
  };
})();
