/*
 * run_game_logic actions and saved-position reader for Derivatives of Sine and Cosine. The core
 * lives in sine-cosine-derivatives/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["sine-cosine-derivatives"].SineCosineDerivativesCore;
const r4 = (x: number) => Math.round(x * 1e4) / 1e4 + 0;

function read(deg: number) {
  const C = core();
  const p = C.picture(C.start({ a: deg }));
  return {
    degrees: C.start({ a: deg }).a, cos: r4(p.cos), sin: r4(p.sin),
    velocity: { x: r4(p.T.x - p.P.x), y: r4(p.T.y - p.P.y) },
    velocityArrows: p.verticalFirst ? "upright (as long as cos t) first, then sideways (sin t)" : "sideways (as long as sin t) first, then upright (cos t)",
    sinIs: p.cos > 1e-9 ? "growing" : p.cos < -1e-9 ? "falling" : "turning",
    cosIs: p.sin < -1e-9 ? "growing" : p.sin > 1e-9 ? "falling" : "turning",
  };
}

export function actions(): GameActions {
  return {
    at: {
      describe: "At an angle t in degrees: cos t, sin t, the velocity (-sin t, cos t) of the point on the unit circle, and whether sin and cos are growing or falling there.",
      args: '{ "degrees": 30 }',
      run: (args) => read(num(args, "degrees")),
    },
  };
}

export function position(state: Json): unknown {
  return { ...read(num(state, "a", 0)), speed: state.speed === "fast" ? "fast" : "slow" };
}
