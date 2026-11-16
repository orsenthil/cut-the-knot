/*
 * run_game_logic actions and saved-position reader for Parrondo's Paradox.
 * Both use the same core as the browser page; see _shared.ts.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

function optionsFrom(args: Json) {
  return {
    pA: num(args, "pA", 0.495),
    pB1: num(args, "pB1", 0.095),
    pB2: num(args, "pB2", 0.745),
    modulus: num(args, "modulus", 3),
    games: num(args, "games", 100),
    trials: num(args, "trials", 500),
    codes: typeof args.codes === "string" ? args.codes : "AB ABBAB",
    epsilon: num(args, "epsilon", 0.005),
  };
}

export function actions(): GameActions {
  const P = cores.parrondo.ParrondoCore;
  return {
    simulate: {
      describe:
        "Run Parrondo's Paradox trials: games A and B plus each mix in `codes`. Returns each series' final average capital. Defaults match the applet (pA=0.495, pB1=0.095, pB2=0.745, M=3).",
      args: '{ "modulus": 3, "games": 100, "trials": 500, "codes": "AB ABBAB" }',
      run: (args) => {
        const result = P.simulate(optionsFrom(args));
        const ranked = result.series
          .map((s: { name: string; finalAverage: number }) => ({
            name: s.name,
            finalAverage: s.finalAverage,
          }))
          .sort((a: { finalAverage: number }, b: { finalAverage: number }) => b.finalAverage - a.finalAverage);
        return {
          options: result.options,
          trials: result.trials,
          games: result.games,
          ranked,
          best: ranked[0] ?? null,
        };
      },
    },
    parse_codes: {
      describe:
        "Parse a Parrondo mixes string the way the applet does: up to seven tokens of A/B patterns or random probabilities.",
      args: '{ "codes": "AB ABBAB .4 .5" }',
      run: (args) => {
        const codes = typeof args.codes === "string" ? args.codes : "AB ABBAB";
        return {
          codes,
          mixes: P.parseCodes(codes).map((c: { kind: string; label: string; pattern?: string; prob?: number }) => ({
            kind: c.kind,
            label: c.label,
            pattern: c.pattern ?? null,
            prob: c.kind === "random" ? c.prob : null,
          })),
        };
      },
    },
  };
}

/** What the page saved with Track.state after (or before) a run. */
export function position(state: Json): unknown {
  if (!state || state.ready !== true) {
    return {
      ready: false,
      note: "No run yet. Press Go on the page, or call simulate with the applet defaults.",
    };
  }
  const finals = Array.isArray(state.finals)
    ? (state.finals as { name?: string; average?: number }[])
        .map((f) => ({ name: String(f.name ?? ""), average: Number(f.average) }))
        .filter((f) => f.name && Number.isFinite(f.average))
    : [];
  const ranked = finals.slice().sort((a, b) => b.average - a.average);
  const options = (state.options && typeof state.options === "object" ? state.options : {}) as Json;
  return {
    ready: true,
    trials: num(state, "trials", 0),
    games: num(state, "games", 0),
    modulus: num(options, "modulus", 3),
    codes: typeof options.codes === "string" ? options.codes : "",
    ranked,
    best: ranked[0] ?? null,
    note: ranked[0]
      ? `Best average capital so far: ${ranked[0].name} at ${ranked[0].average.toFixed(2)}.`
      : "A run finished but no series were recorded.",
  };
}
