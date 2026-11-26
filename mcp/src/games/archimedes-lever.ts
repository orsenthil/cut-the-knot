/*
 * run_game_logic actions and saved-position reader for Archimedes' Law of the
 * Lever. The core lives in archimedes-lever/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 *
 * The illustration replaces each weight NP, NQ by a row of equal unit weights
 * spread evenly along the beam. When "Use GCD/LCM" is ticked and the weights
 * share a factor g, a unit weighs g and there are NP/g and NQ/g of them. The
 * red fulcrum belongs at the common centre of gravity, where NP·dP = NQ·dQ.
 * Nothing is won or lost; the actions measure the picture the page draws.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["archimedes-lever"].ArchimedesLeverCore;

type LeverState = {
  NP: number; NQ: number; useGCD: boolean; width: number; height: number;
  spacing: number; xP: number; xQ: number; xF: number;
};

const round = (v: number, dp = 2): number => Number(v.toFixed(dp));

/** Whole weights 1..25, as the applet's two number controls allow. */
function wholeWeight(args: Json, key: string): number {
  const C = core();
  const n = num(args, key);
  if (!Number.isInteger(n) || n < C.MIN_WEIGHT || n > C.MAX_WEIGHT) {
    throw new Error(`"${key}" must be a whole weight from ${C.MIN_WEIGHT} to ${C.MAX_WEIGHT}`);
  }
  return n;
}

function checkbox(args: Json, key: string): boolean {
  const v = args[key];
  if (v === undefined || v === null) return false;
  if (typeof v !== "boolean") throw new Error(`"${key}" must be true or false`);
  return v;
}

/** Arguments shared by the two actions: start from the applet's Reset layout. */
function fresh(args: Json): LeverState {
  const C = core();
  const width = args.width === undefined ? C.WIDTH : num(args, "width");
  if (width <= 120) throw new Error('"width" must be greater than 120 board units');
  return C.start({
    NP: wholeWeight(args, "NP"), NQ: wholeWeight(args, "NQ"),
    useGCD: checkbox(args, "useGCD"), width,
  }) as LeverState;
}

export function actions(): GameActions {
  return {
    lever: {
      describe:
        "Archimedes' law of the lever for two weights NP and NQ (whole numbers 1 to 25). With useGCD true, each weight is split into gcd-sized unit weights. Reports the gcd and unit size, the number and evenly spaced positions of the unit weights, the balance point (their common centre of gravity), the two arm lengths dP and dQ, and the equality NP·dP = NQ·dQ; the fulcrum divides the gap in the ratio NQ:NP.",
      args: '{ "NP": 6, "NQ": 8, "useGCD": true }',
      run: (args) => {
        const C = core();
        const NP = wholeWeight(args, "NP"), NQ = wholeWeight(args, "NQ");
        const useGCD = checkbox(args, "useGCD");
        const s = C.snapFulcrum(fresh(args)) as LeverState;
        const m = C.measure(s);
        const dP = m.leftDistance, dQ = m.rightDistance;
        const leftTurn = NP * dP, rightTurn = NQ * dQ;
        return {
          NP, NQ, useGCD,
          gcd: C.gcd(NP, NQ), unit: m.unit, gcdAvailable: m.gcdAvailable,
          units: { left: m.np, right: m.nq, total: m.total },
          unitXs: m.units.map((x: number) => round(x)),
          spacing: round(m.spacing),
          weightXs: { P: round(m.xP), Q: round(m.xQ) },
          balanceAt: round(m.balance),
          dP: round(dP), dQ: round(dQ),
          leftTurn: round(leftTurn), rightTurn: round(rightTurn),
          equalTurns: Math.abs(leftTurn - rightTurn) < 1e-6 * Math.max(1, Math.abs(leftTurn), Math.abs(rightTurn)),
          law: `${NP} × ${round(dP)} = ${NQ} × ${round(dQ)} = ${round(leftTurn)}`,
          ratio: `${NQ}:${NP}`,
          ratioReduced: `${NQ / C.gcd(NQ, NP)}:${NP / C.gcd(NQ, NP)}`,
          distanceRatio: `${round(dP)}:${round(dQ)}`,
          note: m.gcdAvailable
            ? `Both weights are multiples of ${C.gcd(NP, NQ)}; ${m.np} and ${m.nq} equal unit weights fill the row, and the fulcrum sits at the middle of the whole row. It cuts the gap ${NQ}:${NP}, so the heavier weight is closer to it.`
            : "The weights have no common factor, so the unit weights are singletons; the balance point is still the middle of the row.",
        };
      },
    },
    tilt: {
      describe:
        "Place the red fulcrum at xF across the beam (optionally dragging weight P or Q with xP, xQ first) and report the turning effect on each side, which way the beam tips and how far the fulcrum is from the balanced point. Outside the beam the fulcrum is clamped to its ends.",
      args: '{ "NP": 3, "NQ": 4, "useGCD": false, "xF": 220 }',
      run: (args) => {
        const C = core();
        let s = fresh(args) as LeverState;
        if (args.xP !== undefined) s = C.moveHandle(s, "P", { x: num(args, "xP") }) as LeverState;
        if (args.xQ !== undefined) s = C.moveHandle(s, "Q", { x: num(args, "xQ") }) as LeverState;
        s = C.moveHandle(s, "F", { x: num(args, "xF") }) as LeverState;
        const m = C.measure(s);
        return {
          NP: s.NP, NQ: s.NQ, useGCD: s.useGCD,
          fulcrumAt: round(m.pivot), balanceAt: round(m.balance),
          dP: round(m.leftDistance), dQ: round(m.rightDistance),
          moment: round(m.moment),
          balanced: m.balanced,
          sideDown: m.tilt > 0 ? "right" : m.tilt < 0 ? "left" : "level",
          leftArea: round(m.leftArea), rightArea: round(m.rightArea),
          label: C.label(s),
          note: "dP and dQ are the arms when the fulcrum is at the balance point (where NP·dP = NQ·dQ); moment and the two areas describe the current fulcrum. Only there are the turning effects equal; move it away and the side with the larger turning effect falls.",
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of the same position. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Archimedes Lever state version ${stateVersion}`);

  const saved: LeverState = {
    NP: wholeWeight(state, "NP"),
    NQ: wholeWeight(state, "NQ"),
    useGCD: state.useGCD === true,
    width: num(state, "width", C.WIDTH),
    height: num(state, "height", C.HEIGHT),
    spacing: num(state, "spacing"),
    xP: num(state, "xP"),
    xQ: num(state, "xQ"),
    xF: num(state, "xF"),
  };
  const m = C.measure(saved);
  const sideDown = m.tilt > 0 ? "right" : m.tilt < 0 ? "left" : "level";
  return {
    stateVersion,
    ...saved,
    gcd: C.gcd(saved.NP, saved.NQ),
    unit: m.unit,
    units: { left: m.np, right: m.nq, total: m.total },
    unitXs: m.units.map((x: number) => round(x)),
    balanceAt: round(m.balance),
    fulcrumAt: round(m.pivot),
    balanced: m.balanced,
    sideDown,
    dP: round(m.leftDistance), dQ: round(m.rightDistance),
    leftTurn: round(m.leftTurn), rightTurn: round(m.rightTurn),
    leftArea: round(m.leftArea), rightArea: round(m.rightArea),
    moment: round(m.moment),
    label: C.label(saved),
    note: `The ${m.total} unit weights sit ${round(m.spacing)} apart. Their common centre of gravity is at ${round(m.balance)}; the fulcrum is ${m.balanced ? "on" : "off"} it. At the balance point NP·dP = NQ·dQ = ${round(m.leftTurn)}; about the current fulcrum the two turning effects are ${round(m.leftArea)} and ${round(m.rightArea)}, so the ${sideDown} side ${m.balanced ? "stays level" : "falls"}.`,
  };
}
