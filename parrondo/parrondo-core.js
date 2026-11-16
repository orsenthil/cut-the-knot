"use strict";

/*
 * Parrondo's Paradox, from Alexander Bogomolny's applet Parrondo.
 *
 * Two losing capital games can be mixed into a winning one. Game A wins $1
 * with probability PA. Game B plays a poor simple game when capital is a
 * multiple of M, and a rich one otherwise. Periodic patterns (AB, ABBAB, …)
 * or a random mix of A and B are compared by averaging many trials.
 *
 * The core mirrors SimpleParrondoGame, ComplicatedParrondoGame, ParrondoCode
 * and ParrondoAccumulator from the bytecode. Randomness is injected so tests
 * can replay a run.
 */
const ParrondoCore = (() => {
  const DEFAULTS = {
    epsilon: 0.005,
    // Constructor stores base − epsilon; scrollbars later overwrite with the
    // raw base (see ParrondoCanvas / ParrondoPanel).
    pA: 0.5 - 0.005,
    pB1: 0.1 - 0.005,
    pB2: 0.75 - 0.005,
    modulus: 3,
    games: 100,
    trials: 500,
    codes: "AB ABBAB",
  };

  const CODE_DELIMS = /[ \-;:/]+/;
  const FALLBACK_PATTERN = "ABBAABBABB";
  const MAX_COMBOS = 7;

  function clampOptions(options) {
    const o = options || {};
    const epsilon = Number.isFinite(o.epsilon) ? o.epsilon : DEFAULTS.epsilon;
    const pA = Number.isFinite(o.pA) ? o.pA : DEFAULTS.pA;
    const pB1 = Number.isFinite(o.pB1) ? o.pB1 : DEFAULTS.pB1;
    const pB2 = Number.isFinite(o.pB2) ? o.pB2 : DEFAULTS.pB2;
    let modulus = Number.isInteger(o.modulus) ? o.modulus : DEFAULTS.modulus;
    if (modulus < 2) modulus = 2;
    if (modulus > 9) modulus = 9;
    let games = Number.isInteger(o.games) ? o.games : DEFAULTS.games;
    if (games < 0) games = 0;
    if (games > 1000) games = 1000;
    let trials = Number.isInteger(o.trials) ? o.trials : DEFAULTS.trials;
    if (trials < 0) trials = 0;
    if (trials > 10000) trials = 10000;
    const codes = typeof o.codes === "string" && o.codes.trim() ? o.codes : DEFAULTS.codes;
    return { epsilon, pA, pB1, pB2, modulus, games, trials, codes };
  }

  /** SimpleParrondoGame.Throw: +1 if random < P, else −1. */
  function simpleThrow(capital, p, random) {
    return capital + (random() < p ? 1 : -1);
  }

  /** ComplicatedParrondoGame.Throw: B1 when capital % M == 0, else B2. */
  function complicatedThrow(capital, pB1, pB2, modulus, random) {
    if (capital % modulus === 0) return simpleThrow(capital, pB1, random);
    return simpleThrow(capital, pB2, random);
  }

  /**
   * ParrondoCode.Next. Periodic codes cycle characters; random codes pick A
   * with the given probability (default 0.5).
   */
  function makeCode(spec) {
    if (spec.kind === "random") {
      const prob = Number.isFinite(spec.prob) ? spec.prob : 0.5;
      return {
        kind: "random",
        prob,
        label: `Random (${prob})`,
        next(random) {
          return random() < prob ? "A" : "B";
        },
      };
    }
    const pattern = spec.pattern || FALLBACK_PATTERN;
    let current = 0;
    return {
      kind: "pattern",
      pattern,
      label: pattern,
      next() {
        if (current === pattern.length) current = 0;
        const ch = pattern.charAt(current);
        current += 1;
        return ch;
      },
    };
  }

  /**
   * ParrondoCanvas.Reset token rules: up to 7 tokens split on " :-;/".
   * A token with neither A nor B is a random probability; otherwise a pattern.
   * A bad token falls back to ABBAABBABB (the applet's catch).
   */
  function parseCodes(codesText) {
    const raw = String(codesText || "").trim();
    const tokens = raw ? raw.toUpperCase().split(CODE_DELIMS).filter(Boolean) : [];
    const limited = tokens.slice(0, MAX_COMBOS);
    return limited.map((token) => {
      if (token.indexOf("A") === -1 && token.indexOf("B") === -1) {
        const prob = Number(token);
        if (!Number.isFinite(prob)) return makeCode({ kind: "pattern", pattern: FALLBACK_PATTERN });
        return makeCode({ kind: "random", prob });
      }
      return makeCode({ kind: "pattern", pattern: token });
    });
  }

  function emptySeries(length) {
    const sums = new Array(length);
    for (let i = 0; i < length; i++) sums[i] = 0;
    return sums;
  }

  /** One trial of L steps for a pure game A or B, added into sums[]. */
  function playPure(sums, games, which, opts, random) {
    let capital = 0;
    for (let i = 0; i < games; i++) {
      if (which === "A") capital = simpleThrow(capital, opts.pA, random);
      else capital = complicatedThrow(capital, opts.pB1, opts.pB2, opts.modulus, random);
      sums[i] += capital;
    }
  }

  /** One trial mixing A (Game) with B (GameB) via a ParrondoCode. */
  function playMixed(sums, games, code, opts, random) {
    let capital = 0;
    for (let i = 0; i < games; i++) {
      const pick = code.next(random);
      if (pick === "A") capital = simpleThrow(capital, opts.pA, random);
      else capital = complicatedThrow(capital, opts.pB1, opts.pB2, opts.modulus, random);
      sums[i] += capital;
    }
  }

  function seriesFromSums(name, sums, trials) {
    const averages = sums.map((s) => (trials > 0 ? s / trials : 0));
    let maxAbs = 0;
    for (const v of averages) {
      const a = Math.abs(v);
      if (a > maxAbs) maxAbs = a;
    }
    return {
      name,
      sums: sums.slice(),
      averages,
      finalAverage: gamesFinal(averages),
      maxAbs,
    };
  }

  function gamesFinal(averages) {
    if (!averages.length) return 0;
    return averages[averages.length - 1];
  }

  /**
   * Run `trials` independent paths of `games` steps for A, B and each combo
   * in the codes string. Returns named capital-average series ready to plot.
   */
  function simulate(options, random) {
    const rand = typeof random === "function" ? random : Math.random;
    const opts = clampOptions(options);
    const games = opts.games;
    const trials = opts.trials;
    const combos = parseCodes(opts.codes);

    const seriesSpecs = [{ name: "A", kind: "A" }, { name: "B", kind: "B" }];
    for (const combo of combos) {
      seriesSpecs.push({
        name: combo.label,
        kind: "mix",
        codeFactory: () => makeCode(combo.kind === "random"
          ? { kind: "random", prob: combo.prob }
          : { kind: "pattern", pattern: combo.pattern }),
      });
    }

    const buckets = seriesSpecs.map(() => emptySeries(games));
    for (let t = 0; t < trials; t++) {
      for (let s = 0; s < seriesSpecs.length; s++) {
        const spec = seriesSpecs[s];
        if (spec.kind === "A") playPure(buckets[s], games, "A", opts, rand);
        else if (spec.kind === "B") playPure(buckets[s], games, "B", opts, rand);
        else playMixed(buckets[s], games, spec.codeFactory(), opts, rand);
      }
    }

    const series = seriesSpecs.map((spec, i) => seriesFromSums(spec.name, buckets[i], trials));
    return {
      options: opts,
      trials,
      games,
      series,
      // Plain position for Track / the tutor.
      finals: series.map((s) => ({ name: s.name, average: s.finalAverage })),
    };
  }

  /** One more batch of `extraTrials` paths, adding into an existing result. */
  function continueSimulate(result, extraTrials, random) {
    const rand = typeof random === "function" ? random : Math.random;
    const opts = result.options;
    const games = opts.games;
    const combos = parseCodes(opts.codes);
    const seriesSpecs = [{ name: "A", kind: "A" }, { name: "B", kind: "B" }];
    for (const combo of combos) {
      seriesSpecs.push({
        name: combo.label,
        kind: "mix",
        codeFactory: () => makeCode(combo.kind === "random"
          ? { kind: "random", prob: combo.prob }
          : { kind: "pattern", pattern: combo.pattern }),
      });
    }

    const prevTrials = result.trials;
    const buckets = result.series.map((s) => s.sums.map((v) => v));
    for (let t = 0; t < extraTrials; t++) {
      for (let s = 0; s < seriesSpecs.length; s++) {
        const spec = seriesSpecs[s];
        if (spec.kind === "A") playPure(buckets[s], games, "A", opts, rand);
        else if (spec.kind === "B") playPure(buckets[s], games, "B", opts, rand);
        else playMixed(buckets[s], games, spec.codeFactory(), opts, rand);
      }
    }
    const trials = prevTrials + extraTrials;
    const series = seriesSpecs.map((spec, i) => seriesFromSums(spec.name, buckets[i], trials));
    return {
      options: opts,
      trials,
      games,
      series,
      finals: series.map((s) => ({ name: s.name, average: s.finalAverage })),
    };
  }

  /** Scrollbar mappings from ParrondoPanel.adjustmentValueChanged. */
  const SCROLL = {
    epsilon: { min: 0, max: 100, toValue: (v) => v * 0.001, fromValue: (x) => Math.round(x / 0.001) },
    pA: { min: 0, max: 100, toValue: (v) => v * 0.01, fromValue: (x) => Math.round(x / 0.01) },
    pB1: { min: 0, max: 100, toValue: (v) => v * 0.01, fromValue: (x) => Math.round(x / 0.01) },
    pB2: { min: 0, max: 100, toValue: (v) => v * 0.01, fromValue: (x) => Math.round(x / 0.01) },
    games: { min: 0, max: 100, toValue: (v) => v * 10, fromValue: (x) => Math.round(x / 10) },
    trials: { min: 0, max: 100, toValue: (v) => v * 100, fromValue: (x) => Math.round(x / 100) },
    modulus: { min: 2, max: 9, toValue: (v) => v, fromValue: (x) => x },
  };

  return {
    DEFAULTS,
    FALLBACK_PATTERN,
    clampOptions,
    simpleThrow,
    complicatedThrow,
    makeCode,
    parseCodes,
    simulate,
    continueSimulate,
    SCROLL,
  };
})();
