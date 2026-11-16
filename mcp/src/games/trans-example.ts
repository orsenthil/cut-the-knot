/*
 * Tutor actions and position reader for Trans Example (Gardner's shuttle
 * puzzle): each shuttle swaps the two lines it joins, so the top-to-bottom
 * map is a product of transpositions.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Bar = { a: number; b: number; h: number };

function build(args: Json) {
  const S = cores["trans-example"].TransExampleCore;
  let state = S.start({ n: args.n === undefined ? S.DEFAULT_POLES : num(args, "n") });
  const bars = Array.isArray(args.bars) ? (args.bars as Bar[]) : [];
  for (const b of bars) {
    const next = S.addBar(state, Number(b.a), Number(b.b), Number(b.h));
    if (next) state = next;
  }
  return { S, state };
}

export function actions(): GameActions {
  return {
    trace_line: {
      describe:
        "Follow one line from the top, crossing each shuttle it meets: where it ends and the path it takes. Poles are 0-based, heights in (0,1) with 0 at the top.",
      args: '{ "n": 5, "bars": [{ "a": 0, "b": 2, "h": 0.5 }], "pole": 0 }',
      run: (args) => {
        const { S, state } = build(args);
        const walk = S.itineraryOf(state, num(args, "pole", 0));
        if (!walk) throw new Error(`pole must be between 0 and ${state.n - 1}`);
        return {
          from: walk.from + 1,
          to: walk.to + 1,
          points: walk.points.map((p: { pole: number; h: number }) => ({ pole: p.pole + 1, h: p.h })),
        };
      },
    },
    permutation: {
      describe:
        "Where every top ends up: the permutation the shuttles define, the same as applying their swaps top down. Poles are 0-based in the answer's input, 1-based in its output.",
      args: '{ "n": 5, "bars": [{ "a": 0, "b": 2, "h": 0.35 }, { "a": 1, "b": 3, "h": 0.65 }] }',
      run: (args) => {
        const { S, state } = build(args);
        return {
          shuttles: state.bars.length,
          topToBottom: S.permutation(state).map((p: number) => p + 1),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const S = cores["trans-example"].TransExampleCore;
  const n = Number(state.n) > 0 ? Number(state.n) : S.DEFAULT_POLES;
  let game = S.start({ n });
  const bars = Array.isArray(state.bars) ? (state.bars as Bar[]) : [];
  for (const b of bars) {
    const next = S.addBar(game, Number(b.a), Number(b.b), Number(b.h));
    if (next) game = next;
  }
  const mode = state.mode === "verify" ? "verify" : "draw";
  const labels = Array.isArray(state.labels)
    ? (state.labels as number[]).map(Number)
    : new Array(n).fill(0);
  const traced = labels.filter((l) => l > 0).length;
  const finished = traced === n;
  return {
    finished,
    mode,
    poles: n,
    shuttles: game.bars.length,
    traced,
    topToBottom: S.permutation(game).map((p: number) => p + 1),
    bottomLabels: labels,
    note: finished
      ? `All ${n} lines verified — every top reached a different bottom.`
      : mode === "draw"
        ? `${game.bars.length} shuttle${game.bars.length === 1 ? "" : "s"} drawn; Verify follows the lines.`
        : `${traced} of ${n} lines traced.`,
  };
}