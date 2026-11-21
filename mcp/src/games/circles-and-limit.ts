/*
 * run_game_logic actions and saved-position reader for Circles And Limit.
 *
 * A small circle centred at O shrinks inside a fixed circle of radius a centred
 * at S = (a, 0). The line through A = (0, r) and the upper crossing B meets the
 * axis at E, whose x-coordinate tends to 4a. Every number below comes from the
 * game's real core (circles-and-limit/), copied into src/generated/cores/ at
 * build time. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-and-limit"].CirclesAndLimitCore;

type Point = { x: number; y: number } | null;

/** Round a mathematical point to four decimals, keeping it plain JSON. */
function pt(p: Point): { x: number; y: number } | null {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: Number(p.x.toFixed(4)), y: Number(p.y.toFixed(4)) };
}

/** Rebuild the full core state from saved data (start() ignores `explored`). */
function readState(args: Json) {
  const C = core();
  const a = num(args, "a", C.DEFAULT_A);
  const r = num(args, "r", C.DEFAULT_R);
  const proof = num(args, "proof", 1);
  const built = C.start({
    a,
    r,
    proof,
    showNames: args.showNames === true,
    showHint: args.showHint === true,
  });
  return Object.assign({}, built, { explored: args.explored === true });
}

export function actions(): GameActions {
  return {
    approach_limit: {
      describe:
        "For a fixed circle radius a and several shrinking radii, show where crossing E lands, how far it is from the limit 4a, and that the closed form x_E = 2a(1 + sqrt(1 - (r/2a)^2)) agrees with the geometric construction.",
      args: '{ "a": 3, "radii": [3, 2, 1, 0.5, 0.1] }',
      run: (args) => {
        const C = core();
        const a = num(args, "a", C.DEFAULT_A);
        const radii = Array.isArray(args.radii)
          ? numArray(args, "radii")
          : [3, 2, 1, 0.5, 0.1];
        const limit = C.limitX(a);
        const steps = radii.map((r) => {
          const pic = C.compute(C.start({ a, r }));
          const closed = C.xOfE(r, a);
          const ex = pic.E.x;
          return {
            r,
            valid: C.validR(a, r),
            s: Number(C.sOf(r, a).toFixed(6)),
            crossingX: Number(ex.toFixed(6)),
            closedFormX: Number(closed.toFixed(6)),
            agree: Math.abs(ex - closed) < 1e-9,
            limit,
            distanceToLimit: Number((limit - ex).toFixed(6)),
          };
        });
        return {
          a,
          limit,
          claimFourTimesA: limit === 4 * a,
          steps,
          note: `As r shrinks, the crossing E forges toward x = ${limit} but never passes it; the distance to the limit falls to 0. The limit is four times the fixed centre's distance a (4 x ${a} = ${limit}).`,
        };
      },
    },
    geometry: {
      describe:
        "Give all the labelled points of the construction for a fixed circle radius a, a small-circle radius r and a proof number, together with the closed-form crossing, the limit and the helper points the chosen proof uses.",
      args: '{ "a": 3, "r": 2, "proof": 1 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const pic = C.compute(state);
        return {
          a: state.a,
          r: state.r,
          proof: state.proof,
          valid: pic.valid,
          points: {
            O: pt(pic.O),
            S: pt(pic.S),
            A: pt(pic.A),
            B: pt(pic.B),
            C: pt(pic.C),
            E: pt(pic.E),
            D: pt(pic.D),
            F: pt(pic.F),
            limit: pt(pic.limit),
          },
          crossingX: Number(pic.E.x.toFixed(6)),
          closedFormX: Number(C.xOfE(state.r, state.a).toFixed(6)),
          limit: C.limitX(state.a),
          fourTimesCentreDistance: C.limitX(state.a) === 4 * state.a,
          note: pic.valid
            ? `The two circles meet at B; the line AB cuts the axis at E = ${Number(pic.E.x.toFixed(2))}, heading for the limit (${C.limitX(state.a)}, 0). Proof ${state.proof} adds helpers D and F to read off the 4:1 ratio without algebra.`
            : "These circles do not meet (r must be positive and at most 2a), so there is no crossing B to draw.",
        };
      },
    },
  };
}

/** What the core says about the picture currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readState(state);
  const pic = C.compute(here);
  const limit = C.limitX(here.a);
  const ex = pic.E.x;
  return {
    a: here.a,
    r: here.r,
    proof: here.proof,
    showNames: here.showNames,
    showHint: here.showHint,
    explored: here.explored,
    valid: pic.valid,
    E: pt(pic.E),
    savedE: pt(
      state.E && typeof state.E === "object"
        ? (state.E as Point)
        : null,
    ),
    crossingX: Number(ex.toFixed(6)),
    closedFormX: Number(C.xOfE(here.r, here.a).toFixed(6)),
    limitX: limit,
    distanceToLimit: Number((limit - ex).toFixed(6)),
    note: pic.valid
      ? `With radius r = ${here.r}, the line AB meets the axis at x = ${Number(ex.toFixed(2))}, still ${Number((limit - ex).toFixed(2))} short of the limit ${limit} = 4a. Shrinking r closes that gap.`
      : "The circles are not meeting, so no crossing is drawn; a valid radius lies in (0, 2a].",
  };
}
