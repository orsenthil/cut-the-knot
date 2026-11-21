/*
 * run_game_logic actions and saved-position reader for Estimating
 * Circumference. The core lives in archimedes-circumference/ and is copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["archimedes-circumference"].ArchimedesCircumferenceCore;

export function actions(): GameActions {
  return {
    estimate: {
      describe: "For a regular n-gon in a circle, report the inscribed and circumscribed perimeters and how they squeeze the circumference.",
      args: '{ "n": 96, "radius": 1 }',
      run: (args) => {
        const C = core();
        const r = C.analyze(num(args, "n", 6), Number.isFinite(args.radius) ? num(args, "radius") : 1);
        return {
          n: r.n, radius: r.radius,
          inscribed: r.inscribed, circumscribed: r.circumscribed,
          circumference: r.circumference, gap: r.gap, squeeze: r.squeeze,
          note: "The inscribed perimeter increases to the circumference while the circumscribed one decreases.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(num(state, "n", 6), Number.isFinite(state.radius) ? num(state, "radius") : 1);
  return { n: r.n, inscribed: r.inscribed, circumscribed: r.circumscribed, gap: r.gap, squeeze: r.squeeze, note: `The ${r.n}-gon squeezes the circle.` };
}
