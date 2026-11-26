/*
 * run_game_logic actions and saved-position reader for Sierpinski Gasket via Chaos Game. The
 * core lives in sierpinski-chaos-game/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["sierpinski-chaos-game"].SierpinskiChaosGameCore;

export function actions(): GameActions {
  return {
    play: {
      describe: "Plays the chaos game from corner A with the given choices of corners (a string of A, B, C), and gives the final point in barycentric coordinates and whether it is in the gasket. The last choice names the biggest copy the point is in.",
      args: '{ "choices": "ABCCBA" }',
      run: (args) => {
        const C = core();
        const choices = String(args.choices ?? "");
        if (!/^[ABC]{1,40}$/.test(choices)) throw new Error("choices: 1 to 40 letters A, B or C");
        const r = { A: 0.1, B: 0.5, C: 0.9 } as Record<string, number>;
        let s = C.start({ triangle: { A: { x: 0, y: 0 }, B: { x: 1, y: 0 }, C: { x: 0.5, y: Math.sqrt(3) / 2 } } });
        for (const ch of choices) s = C.step(s, r[ch]);
        const [a, b, c] = C.barycentric(s, s.P);
        return { steps: choices.length, barycentric: { A: a, B: b, C: c }, inGasket: C.inGasket(s, s.P), sizeOfCopy: `1/${2 ** Math.max(0, choices.length - 1)}` };
      },
    },
  };
}

export function position(state: Json): unknown {
  const count = Math.max(0, Math.round(num(state, "count", 0)));
  return {
    dotsDrawn: count,
    corners: { A: state.A, B: state.B, C: state.C },
    note: count ? "Every dot is in the Sierpinski gasket: the first is a corner, and each map sends the gasket into itself." : "No dots yet: press Start.",
  };
}
