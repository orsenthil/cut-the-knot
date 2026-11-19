"use strict";

/*
 * Chess Tournament, from Alexander Bogomolny's applet ChessTournament
 * (called "ChessTournament's Paradox" in getAppletInfo).
 *
 * Three chess players A, B and C play a series of games. A is the strongest,
 * C the weakest, and there are no draws: A beats B with probability p, B beats
 * C with probability q, and A beats C with probability r. The winner of each
 * game plays the player who sat it out; the first player to collect two wins
 * takes the series. B chooses which pair plays the first game. The surprise is
 * that B is better off starting against the weak player C (pair BC) than
 * against the strong player A (pair AB).
 *
 * The one idea the code relies on is enumerating the event tree. Starting
 * from a pair (first F, second S, idle T) with x = P(F beats S),
 * y = P(S beats T) and z = P(F beats T), the tree has only four levels, so the
 * win chances are the sum of the branch products:
 *
 *   first  = x z + x^2 y (1-z) + x (1-x)(1-y) z
 *   second = x(1-z) y (1-x) + (1-x) y + (1-x)^2 (1-y) z
 *   third  = x(1-z)(1-y) + (1-x)(1-y)(1-z)
 *
 * These three numbers add to 1. Feeding (p,q,r), (q,1-r,1-p) and
 * (1-r,p,1-q) gives the columns AB, BC and AC of the applet's table.
 *
 * The old applet's bytecode has a one-term typo in the "second" formula: it
 * multiplies the last branch by x where the game tree requires (1-x). Its AB
 * column can therefore add to more than 1. cut-the-knot's printed formula is
 * the correct one, so this port follows the page (CLAUDE.md, "when the applet
 * and its page disagree"). The check test transcribes the old bytecode too
 * and pins the exact difference.
 *
 * No DOM, no storage: everything here is a pure function over plain data.
 * The position { p, q, r, pair, explored } is plain JSON, so it can be saved
 * and handed to the tutor as it is. This file defines one global,
 * ChessTournamentCore.
 */
const ChessTournamentCore = (() => {
  // The applet's three AWT scrollbars:
  //   PScroll = Scrollbar(HORIZONTAL, 55, 10, 50, 110) -> p = value * 0.01
  //   QScroll = Scrollbar(HORIZONTAL, 60, 10, 50, 110) -> q = value * 0.01
  //   RScroll = Scrollbar(HORIZONTAL, 75, 10, 50, 110) -> r = value * 0.01
  // AWT's usable value range is min .. max-visible = 50 .. 100, so each
  // probability runs from 0.50 to 1.00 in steps of 0.01.
  const SCROLL = {
    p: {
      min: 50, max: 110, visible: 10, step: 1, initial: 55,
      toValue: (raw) => round2(raw * 0.01),
      fromValue: (v) => Math.round(v * 100),
    },
    q: {
      min: 50, max: 110, visible: 10, step: 1, initial: 60,
      toValue: (raw) => round2(raw * 0.01),
      fromValue: (v) => Math.round(v * 100),
    },
    r: {
      min: 50, max: 110, visible: 10, step: 1, initial: 75,
      toValue: (raw) => round2(raw * 0.01),
      fromValue: (v) => Math.round(v * 100),
    },
  };

  // The last raw value a scrollbar can actually show: max - visible = 100.
  const RAW_MAX = 100;

  const PAIRS = ["AB", "BC", "AC"];

  const DEFAULTS = {
    p: SCROLL.p.toValue(SCROLL.p.initial), // 0.55
    q: SCROLL.q.toValue(SCROLL.q.initial), // 0.60
    r: SCROLL.r.toValue(SCROLL.r.initial), // 0.75
  };

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  /** Keep a raw scrollbar value inside its usable range and on its step. */
  function clampRaw(scroll, raw) {
    let v = Number.isFinite(raw) ? raw : scroll.initial;
    v = Math.round(v / scroll.step) * scroll.step;
    if (v < scroll.min) v = scroll.min;
    if (v > RAW_MAX) v = RAW_MAX;
    return v;
  }

  /** Clamp the three options to the applet's ranges, two decimals each. */
  function clampOptions(options) {
    const o = options || {};
    const raw = (key) => {
      const s = SCROLL[key];
      const given = Number.isFinite(o[key]) ? s.fromValue(o[key]) : s.initial;
      return s.toValue(clampRaw(s, given));
    };
    return { p: raw("p"), q: raw("q"), r: raw("r") };
  }

  /**
   * The applet's ComputeResult(x, y, z): win chances of the first, second and
   * third player of a tree. x = P(first beats second), y = P(second beats
   * third), z = P(first beats third). Corrected version (see header).
   */
  function computeResult(x, y, z) {
    const mx = 1 - x;
    const my = 1 - y;
    const mz = 1 - z;
    return [
      x * z + x * x * y * mz + x * mx * my * z,
      x * mz * y * mx + mx * y + mx * mx * my * z,
      x * mz * my + mx * my * mz,
    ];
  }

  /**
   * The 3x3 table printed in the applet's canvas: rows are the players
   * A, B, C; columns are the pairs that play first, AB, BC, AC. Each column
   * adds to 1.
   */
  function computeTable(p, q, r) {
    const ab = computeResult(p, q, r);         // first A, second B, third C
    const bc = computeResult(q, 1 - r, 1 - p); // first B, second C, third A
    const ac = computeResult(1 - r, p, 1 - q); // first C, second A, third B
    return {
      AB: { A: ab[0], B: ab[1], C: ab[2] },
      BC: { A: bc[2], B: bc[0], C: bc[1] },
      AC: { A: ac[1], B: ac[2], C: ac[0] },
    };
  }

  /** B's chance when the first game is A vs B (the page's P_AB). */
  function pAB(p, q, r) {
    return computeTable(p, q, r).AB.B;
  }

  /** B's chance when the first game is B vs C (the page's P_BC). */
  function pBC(p, q, r) {
    return computeTable(p, q, r).BC.B;
  }

  /** P_BC - P_AB. */
  function difference(p, q, r) {
    return pBC(p, q, r) - pAB(p, q, r);
  }

  /** The page's factorisation of the difference. */
  function identityDifference(p, q, r) {
    return (p * q * (1 - r) + (1 - p) * (1 - q) * r) * (p + q - 1);
  }

  /** The page's closed form for P_AB. */
  function pagePAB(p, q, r) {
    return p * (1 - r) * q * (1 - p) + (1 - p) * q + (1 - p) * (1 - q) * r * (1 - p);
  }

  /** The page's closed form for P_BC. */
  function pagePBC(p, q, r) {
    return q * (1 - p) + q * p * (1 - r) * q + (1 - q) * r * (1 - p) * q;
  }

  /** The position a new exploration starts from. */
  function start(options) {
    const o = clampOptions(options || DEFAULTS);
    return { p: o.p, q: o.q, r: o.r, pair: "BC", explored: false };
  }

  function reset() {
    return start(DEFAULTS);
  }

  function withOption(state, key, value) {
    const given = optionsFrom(state);
    given[key] = value;
    const o = clampOptions(given);
    return { p: o.p, q: o.q, r: o.r, pair: state.pair, explored: true };
  }

  function optionsFrom(state) {
    return { p: state.p, q: state.q, r: state.r };
  }

  function setP(state, p) {
    return withOption(state, "p", p);
  }

  function setQ(state, q) {
    return withOption(state, "q", q);
  }

  function setR(state, r) {
    return withOption(state, "r", r);
  }

  /** Highlight one of the three columns; a demo has no win or loss. */
  function selectPair(state, pair) {
    const chosen = PAIRS.includes(pair) ? pair : state.pair;
    return { p: state.p, q: state.q, r: state.r, pair: chosen, explored: true };
  }

  /** "done" once explored — a demo has no win or loss. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  /** The applet's CTKFormat.CutDigits(v, 2) label, without a leading zero. */
  function formatP(v) {
    let s = Number(v).toFixed(2);
    if (s.startsWith("0.")) s = s.slice(1);
    return s;
  }

  /** The applet's CTKFormat.CutDigits(v, 3) table entry. */
  function formatProb(v) {
    return Number(v).toFixed(3);
  }

  return {
    SCROLL, RAW_MAX, PAIRS, DEFAULTS, clampOptions,
    start, reset, setP, setQ, setR, selectPair, result,
    computeResult, computeTable, pAB, pBC, difference,
    identityDifference, pagePAB, pagePBC, formatP, formatProb,
  };
})();
