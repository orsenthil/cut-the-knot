/*
 * run_game_logic actions and saved-position reader for Sine of the Sum Formula. The core lives
 * in sine-of-sum/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["sine-of-sum"].SineOfSumCore;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

function read(alpha: number, beta: number) {
  const C = core();
  const s = C.start({ alpha, beta });
  const f = C.figures(s), v = C.values(s);
  return {
    alpha: s.alpha, beta: s.beta, rhombusAngle: v.rhombusAngle,
    rectangle: { width: r6(f.left.W), height: r6(f.left.H), note: "width cos a + cos b, height sin a + sin b" },
    rhombusArea: r6(v.rhombus), sinOfSum: r6(v.sinSum),
    emptyRectangles: { sinAcosB: r6(v.sinAcosB), cosAsinB: r6(v.cosAsinB) },
    check: `${r6(v.sinSum)} = ${r6(v.sinAcosB)} + ${r6(v.cosAsinB)}`,
  };
}

export function actions(): GameActions {
  return {
    figure: {
      describe: "For angles alpha and beta in whole degrees (1..89), the rectangle around the unit rhombus, the rhombus's area sin(alpha + beta), and the two empty rectangles sin a cos b and cos a sin b left after moving the triangles.",
      args: '{ "alpha": 30, "beta": 45 }',
      run: (args) => read(num(args, "alpha", 72), num(args, "beta", 45)),
    },
  };
}

export function position(state: Json): unknown {
  return { ...read(num(state, "alpha", 72), num(state, "beta", 45)), labelsShown: state.labels === true, anglesShown: state.angles === true };
}
