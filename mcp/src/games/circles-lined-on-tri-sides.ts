/*
 * run_game_logic actions and saved-position reader for Circles Lined On Tri Sides.
 *
 * The applet takes two different whole numbers N and M (1..8) and makes the
 * right triangle with legs N²−M² and 2NM and hypotenuse N²+M². Its inradius is
 * R = min(N, M)·|N−M|, and the equal circles lined along both legs have radius
 * r = R / (2R + 1): exactly 2R+1 of them span the incircle's diameter, so the
 * ratio R/r is always an odd integer. A leg of length L carries L+1 circles,
 * and the two rows share the circle at the right-angle corner, so L1+L2+1
 * circles fit in all. For the 3-4-5 triangle R = 1 and r = 1/3, so the big
 * incircle is precisely three small radii across.
 *
 * The core (copied into src/generated/cores/ at build time) also keeps the
 * applet's integer-grid layout: `compute` transcribes its private Compute(),
 * `arrangement` places the circles on the legs and `claims` checks each claim
 * made on the page. Every number returned below comes from that real core. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-lined-on-tri-sides"].CirclesLinedOnTriSidesCore;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;

/* The generated JS is plain JavaScript, so narrow its inferred union returns
 * here rather than asking TypeScript to follow the applet's two branches. */
type Geometry = {
  L1: number;
  L2: number;
  L3: number;
  L8: number;
  coef: number;
  R: number;
  r: number;
  scale: number;
  incircle: { x: number; y: number; r: number };
  statementCircles: unknown[];
};
type Arrangement = {
  base: unknown[];
  side: unknown[];
  circles: unknown[];
};

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));

/** The applet's own 400 by 300 board; pure lengths are independent of it. */
const boardSize = (C: Core) => ({ width: C.WIDTH, height: C.HEIGHT });

/** N and M are the applet's spinner values: whole numbers in its 1..8 range. */
function readPair(C: Core, args: Json, allowEqual: boolean): State {
  const N = num(args, "N", 1);
  const M = num(args, "M", 2);
  for (const [name, v] of [["N", N], ["M", M]] as const) {
    if (!Number.isInteger(v) || v < C.MIN || v > C.MAX) {
      throw new Error(`"${name}" must be a whole number between ${C.MIN} and ${C.MAX}, got ${JSON.stringify(args[name])}`);
    }
  }
  if (!allowEqual && N === M) {
    throw new Error('"N" and "M" must be different: equal numbers make no triangle (the applet draws nothing)');
  }
  return C.start({ N, M });
}

/** The applet's geometry and the article's circle counts, for N != M. */
function measure(C: Core, s: State) {
  const size = boardSize(C);
  const g = C.compute(s, size) as unknown as Geometry;
  const a = C.arrangement(s, size) as unknown as Arrangement;
  const gridR = g.L8 / 2; // min(N, M) * |N - M|, before the board scaling
  const ratio = g.coef; // L8 + 1 = 2 * gridR + 1, an odd integer
  return {
    triangle: {
      legs: { alongBase: g.L1, alongSide: g.L2 },
      hypotenuse: g.L3,
      pythagorean: g.L1 * g.L1 + g.L2 * g.L2 === g.L3 * g.L3,
    },
    inradius: {
      inGridUnits: gridR,
      onBoard: round(g.R),
      formula: "min(N, M) * |N - M|",
    },
    smallCircle: {
      radiusAsFraction: `${gridR}/${ratio}`,
      radiusInGridUnits: round(gridR / ratio),
      radiusOnBoard: round(g.r),
      bigOverSmall: ratio,
      integerRatio: Number.isInteger(ratio),
    },
    counts: {
      onBaseLeg: a.base.length,
      onSideLeg: a.side.length,
      sharedCornerCircle: 1,
      total: a.circles.length,
    },
    incircle: {
      center: { x: round(g.incircle.x), y: round(g.incircle.y) },
      radius: round(g.incircle.r),
    },
    statementRowCircles: g.statementCircles.length,
    boardScale: g.scale,
  };
}

/** Each claim the page makes about the drawing, checked by the core. */
function checkClaims(C: Core, s: State) {
  const c = C.claims(s, boardSize(C)) as unknown as Record<string, boolean | undefined>;
  const checks: Record<string, boolean> = {};
  for (const [name, value] of Object.entries(c)) {
    if (name !== "doNotDraw") checks[name] = value === true;
  }
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  return { checks, allHold: failed.length === 0, failed };
}

export function actions(): GameActions {
  return {
    triangle_and_chain: {
      describe:
        "For two different whole numbers N and M from 1 to 8, report the right triangle the applet draws (legs N²−M² and 2NM, hypotenuse N²+M²), its inradius R = min(N,M)·|N−M|, the common radius r = R/(2R+1) of the small circles, the integer ratio R/r, and how many circles line each leg (leg + 1, sharing the corner circle) and the whole chain. The 3-4-5 case (N=2, M=1) has R = 1 and r = 1/3.",
      args: '{ "N": 2, "M": 1 }',
      run: (args) => {
        const C = core();
        const s = readPair(C, args, false);
        const m = measure(C, s);
        return {
          N: s.N,
          M: s.M,
          ...m,
          note:
            `N = ${s.N} and M = ${s.M} give legs ${m.triangle.legs.alongBase} and ` +
            `${m.triangle.legs.alongSide} with hypotenuse ${m.triangle.hypotenuse}. ` +
            `The inradius is ${m.inradius.inGridUnits} = min(N,M)*|N-M|, so ` +
            `${m.smallCircle.bigOverSmall} circles of radius ${m.smallCircle.radiusAsFraction} ` +
            `span its diameter and R/r is the integer ${m.smallCircle.bigOverSmall}. ` +
            `${m.counts.onBaseLeg} circles line the base leg and ${m.counts.onSideLeg} the side leg, ` +
            `but ${m.counts.total} in all because the corner circle is shared.`,
        };
      },
    },

    check_claims: {
      describe:
        "Check every claim the page makes for a chosen pair N, M (distinct whole numbers from 1 to 8): the Pythagorean triple, R = min(N,M)·|N−M|, r = R/(2R+1), the odd integer ratio R/r, the counts L1+1 and L2+1 and L1+L2+1, the two rows fitting along their legs with neighbouring circles touching, the shared corner circle, the end circles touching the hypotenuse, and the chain lying inside the incircle. Returns a boolean and the core's verdict for each, plus the failed names.",
      args: '{ "N": 3, "M": 2 }',
      run: (args) => {
        const C = core();
        const s = readPair(C, args, false);
        const m = measure(C, s);
        const verdict = checkClaims(C, s);
        return {
          N: s.N,
          M: s.M,
          ...verdict,
          keyNumbers: {
            inradius: m.inradius.inGridUnits,
            smallRadius: m.smallCircle.radiusAsFraction,
            bigOverSmall: m.smallCircle.bigOverSmall,
            circles: m.counts.total,
          },
          note: verdict.allHold
            ? `Every claim holds for N = ${s.N}, M = ${s.M}. The ${m.inradius.inGridUnits}-unit incircle is exactly ${m.smallCircle.bigOverSmall} small radii across, and ${m.counts.total} circles fit along the two legs with the corner one shared.`
            : `These claims failed for N = ${s.N}, M = ${s.M}: ${verdict.failed.join(", ")}. The core's individual verdicts are in "checks".`,
        };
      },
    },
  };
}

/** The page's saved fields, plus a fresh reading from the same core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circles Lined On Tri Sides state version ${stateVersion}`);
  }
  const s = readPair(C, state, true);
  const saved = { N: s.N, M: s.M, showStatement: state.showStatement === true };
  const g = C.compute(s, boardSize(C)) as unknown as { doNotDraw: boolean };

  if (g.doNotDraw) {
    return {
      stateVersion,
      ...saved,
      reading: {
        doNotDraw: true,
        difference: 0,
        inradius: 0,
      },
      note:
        `The saved N and M are both ${s.N}. Equal numbers make no triangle, so the applet draws nothing. ` +
        `Move one of the two dots to a different whole number from ${C.MIN} to ${C.MAX}.`,
    };
  }

  const m = measure(C, s);
  const verdict = checkClaims(C, s);
  return {
    stateVersion,
    ...saved,
    reading: m,
    claims: verdict,
    note:
      `With N = ${s.N} and M = ${s.M} the triangle has legs ${m.triangle.legs.alongBase} and ` +
      `${m.triangle.legs.alongSide} and hypotenuse ${m.triangle.hypotenuse}. Its inradius is ` +
      `${m.inradius.inGridUnits} = min(N,M)*|N-M|, so ${m.smallCircle.bigOverSmall} circles of radius ` +
      `${m.smallCircle.radiusAsFraction} span its diameter; ${m.counts.total} small circles line both legs. ` +
      (verdict.allHold
        ? "The core confirms every claim for this saved position."
        : `The core reports failed claims: ${verdict.failed.join(", ")}.`) +
      (saved.showStatement
        ? " The R picture is showing the row of small circles that fills the incircle's diameter."
        : ""),
  };
}
