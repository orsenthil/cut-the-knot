/*
 * run_game_logic actions and saved-position reader for Circles In Circles Sangaku.
 *
 * The 1837 Aichi temple puzzle. AB is a diameter of a circle of radius r and
 * centre O; X is the point where one of four equal circles touches AB, at
 * distance x = OX from O. With r1 the radius of those four circles, the right
 * triangle (r − r1, x, r1) gives r1 = (r² − x²)/(2r). A circle tangent to all
 * four, centred at O, has radius r3 = x²/r; the circle above the upper pair
 * has the same radius, r4 = r3, for every x. The small circle in the lens
 * between the overlapping upper pair has radius r5 = r1 − x, which is only a
 * real circle while x < (√2 − 1)r. At x = r/3 all three are r/9, the sangaku.
 * The article's optional five-region circles are all r/5 at x = r√(3/5).
 *
 * Every number below comes from the real core (circles-in-circles-sangaku/),
 * copied into src/generated/cores/ at build time. See _shared.ts for the shape
 * of a game module. This is an illustration: it has no win and no loss.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-in-circles-sangaku"].CirclesInCirclesSangakuCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type Geometry = NonNullable<ReturnType<Core["geometry"]>>;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
/** Residuals can be tiny or large: keep their size and sign rather than zeroing. */
const sig = (v: number): number => Number(v.toExponential(2));
const close = (a: number, b: number, tol = 1e-6): boolean =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x, 4), y: round(p.y, 4) } : null;
const circ = (c: Circle | null | undefined): { center: { x: number; y: number }; radius: number } | null =>
  c && Number.isFinite(c.r) ? { center: pt(c) as { x: number; y: number }, radius: round(c.r) } : null;

/** Saved points are {x, y}; short [x, y] pairs are accepted as arguments too. */
function readPoint(value: unknown, label: string): Point {
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or {x, y}`);
    const x = Number(value[0]), y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${label}" needs finite x and y`);
    return { x, y };
  }
  if (!value || typeof value !== "object") throw new Error(`"${label}" must be [x, y] or {x, y}`);
  const p = value as Json;
  return { x: num(p, "x"), y: num(p, "y") };
}

/** Build a core state from r and either a signed distance x or a ratio x/r. */
function stateFromArgs(args: Json) {
  const C = core();
  const r = num(args, "r", C.R);
  if (!(r > 0)) throw new Error('"r" must be a positive radius');
  if (args.x !== undefined && args.xRatio !== undefined) {
    throw new Error('give either "x" or "xRatio", not both');
  }
  let ratio: number;
  if (args.x !== undefined) {
    const x = num(args, "x");
    if (Math.abs(x) > r) throw new Error(`"x" must lie between -r and r (|x| <= ${r})`);
    ratio = x / r;
  } else {
    ratio = num(args, "xRatio", 0.4);
    if (Math.abs(ratio) > 1) throw new Error('"xRatio" must lie between -1 and 1');
  }
  const state = C.start({
    r,
    xRatio: ratio,
    names: args.names === true,
    secondary: args.secondary === true,
    fill: args.fill === true,
  });
  const g = C.geometry(state);
  if (!g) throw new Error("the core could not draw the circles for these r and x");
  return { C, state, g };
}

/** The page's claims, measured on the core's own construction. */
function reading(g: Geometry) {
  const r = g.r, x = g.x;
  const formulaR1 = (r * r - x * x) / (2 * r);
  const formulaR3 = x * x / r;
  const formulaR5 = formulaR1 - x;
  const firstRegion = g.circles5[0];
  const fifth = g.circles5[2];
  const tangency = core().tangency(g);
  return {
    r: round(r),
    x: round(x),
    signedX: round(g.signedX),
    radii: {
      fourSmallCirclesR1: round(g.r1),
      centralCircleR3: round(g.r3),
      aboveUpperPairR4: round(g.r4),
      lensCircleR5: round(g.r5),
      regionCircleRadius: round(g.half),
    },
    circles: {
      four: g.circles4.map(circ),
      three: g.circles3.map(circ),
      two: g.circles2.map(circ),
      five: g.circles5.map(circ),
    },
    formulas: {
      r1: {
        expression: "r1 = (r² − x²)/(2r)",
        value: round(formulaR1), residual: sig(g.r1 - formulaR1), holds: close(g.r1, formulaR1),
      },
      r3: {
        expression: "r3 = x²/r",
        value: round(formulaR3), residual: sig(g.r3 - formulaR3), holds: close(g.r3, formulaR3),
      },
      r4: {
        expression: "r4 = x²/r = r3",
        value: round(formulaR3), residual: sig(g.r4 - formulaR3),
        holds: close(g.r4, formulaR3), equalToR3: close(g.r4, g.r3),
      },
      r5: {
        expression: "r5 = r1 − x",
        value: round(formulaR5), residual: sig(g.r5 - formulaR5), holds: close(g.r5, formulaR5),
      },
    },
    lensCircleFits: g.r5 > 0 && g.circles2.every((c) => c !== null),
    sangaku: {
      special: g.special,
      at: "x = r/3 (or x = −r/3)",
      r1IsFourNinths: close(g.r1, 4 * r / 9),
      r3IsRNinths: close(g.r3, r / 9),
      r4IsRNinths: close(g.r4, r / 9),
      r5IsRNinths: close(g.r5, r / 9),
      allThreeEqualRNinths: close(g.r3, r / 9) && close(g.r4, r / 9) && close(g.r5, r / 9),
    },
    fiveRegions: {
      outerFourRadius: firstRegion ? round(firstRegion.r) : null,
      middleRadius: round(g.half),
      middleExists: fifth !== null,
      middleIsROverFive: close(g.half, r / 5),
      allFiveEqualROverFive: g.circles5.every((c) => c !== null && close(c.r, r / 5)),
    },
    // Tangencies as residuals in board units; zero means exact contact.
    tangencyResiduals: Object.fromEntries(
      tangency ? Object.entries(tangency).map(([k, v]) => [k, sig(v as number)]) : [],
    ),
  };
}

export function actions(): GameActions {
  return {
    circle_radii: {
      describe:
        "Place X at signed distance x from O (or give xRatio = x/r, from −1 to 1) in a circle of radius r (default 130) and run the real construction. Report the radii of all five kinds of circles — the four of radius r1 = (r²−x²)/(2r), the central and the two top/bottom circles of radius r3 = x²/r, the circle above the upper pair r4 = r3, and the lens circle r5 = r1−x — their centres, the residuals of those formulas, the tangencies, and whether this is the x = r/3 position where r3 = r4 = r5 = r/9. r must be positive and |x| must not exceed r; negative x only mirrors the picture.",
      args: '{ "r": 130, "x": 40 }',
      run: (args) => {
        const { C, state, g } = stateFromArgs(args);
        const m = reading(g);
        return {
          ...m,
          note: m.lensCircleFits
            ? `With r = ${m.r} and OX = ${m.x}, the four small circles have radius r1 = ${m.radii.fourSmallCirclesR1}; the centre circle and the circle above the pair both have radius ${m.radii.centralCircleR3} = x²/r, and the lens circle has radius ${m.radii.lensCircleR5} = r1 − x. ${m.sangaku.special ? "This is x = r/3: r3, r4 and r5 are all r/9, the 1837 sangaku." : "At x = r/3 all three would be r/9."}`
            : `With r = ${m.r} and OX = ${m.x}, r5 = ${m.radii.lensCircleR5} is not positive, so the upper circles do not overlap enough to hold a lens circle. The four r1 circles and the three r3 = r4 circles are still drawn: r1 = ${m.radii.fourSmallCirclesR1}, r3 = r4 = ${m.radii.centralCircleR3}. ${C.describe(state)}`,
        };
      },
    },
    special_positions: {
      describe:
        "For a given radius r (default 130) check the two memorable positions of the sangaku using the real core. At x = ±r/3 (the two buttons on the page) verify that r1 = 4r/9 and r3 = r4 = r5 = r/9 at both mirrored places. At x = r·sqrt(3/5) verify that the four outer five-region circles and their middle one all have radius r/5, with area pi(r/5)². Reports each measured radius and the residual against the claimed value.",
      args: '{ "r": 180 }',
      run: (args) => {
        const C = core();
        const r = num(args, "r", C.R);
        if (!(r > 0)) throw new Error('"r" must be a positive radius');
        const ninths = [-1, 1].map((side) => {
          const state = C.setSpecial(C.start({ r }), side);
          const g = C.geometry(state);
          if (!g) return null;
          const m = reading(g);
          return {
            signedX: side * r / 3,
            r1: m.radii.fourSmallCirclesR1,
            r3: m.radii.centralCircleR3,
            r4: m.radii.aboveUpperPairR4,
            r5: m.radii.lensCircleR5,
            r1Residual: sig(g.r1 - 4 * r / 9),
            ninthsResidual: sig(Math.max(Math.abs(g.r3 - r / 9), Math.abs(g.r4 - r / 9), Math.abs(g.r5 - r / 9))),
            allThreeAreRNinths: m.sangaku.allThreeEqualRNinths,
          };
        });
        const regionState = C.start({ r, xRatio: Math.sqrt(3 / 5) });
        const regionG = C.geometry(regionState);
        if (!regionG) throw new Error("the core could not draw the five-region circles");
        const region = reading(regionG);
        return {
          r,
          sangaku: {
            at: "x = ±r/3",
            positions: ninths,
            bothSidesEqualRNinths: ninths.every((n) => n !== null && n.allThreeAreRNinths),
          },
          fiveRegions: {
            at: "x = r·sqrt(3/5)",
            x: round(regionG.x),
            radii: region.circles.five.map((c) => c && c.radius),
            expected: round(r / 5),
            allFiveEqualROverFive: region.fiveRegions.allFiveEqualROverFive,
            areaEach: round(Math.PI * (r / 5) ** 2),
          },
          note: `At x = ±r/3 the picture mirrors but r1 = ${round(4 * r / 9)} = 4r/9 and r3 = r4 = r5 = ${round(r / 9)} = r/9 on both sides. At x = r·sqrt(3/5) (about ${round(Math.sqrt(3 / 5) * r)} from O) all five region circles have radius ${round(r / 5)} = r/5, enclosing area pi(r/5)² = ${round(Math.PI * (r / 5) ** 2)} each.`,
        };
      },
    },
  };
}

/** The saved fields, checked against a fresh run of the core at that X. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Circles In Circles Sangaku state version ${stateVersion}`);
  const saved = { ...state, stateVersion };
  let r: number, signedX: number;
  try {
    r = num(state, "r", C.R);
    if (!(r > 0)) throw new Error('"r" must be a positive radius');
    const O = readPoint(state.O, "O");
    const X = readPoint(state.X, "X");
    signedX = num(state, "signedX", X.x - O.x);
    if (!Number.isFinite(signedX) || Math.abs(signedX) > r) {
      throw new Error('"signedX" must lie between -r and r (X on the diameter AB)');
    }
  } catch (err) {
    return {
      ...saved, valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "The saved position needs a positive r and an X on the diameter within r of O.",
    };
  }
  const options = (state.options && typeof state.options === "object" ? state.options : {}) as Json;
  const here = Object.assign(C.start({ r }), {
    x: C.O.x + signedX,
    options: {
      names: options.names === true,
      secondary: options.secondary === true,
      fill: options.fill === true,
    },
    explored: true,
  });
  const g = C.geometry(here);
  if (!g) {
    return {
      ...saved, valid: false,
      note: "The core cannot draw circles at this saved X; X must sit on AB between A and B.",
    };
  }
  const measured = reading(g);
  const savedNumber = (key: string): number | null => {
    const v = state[key];
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const savedRadii = (key: string): (number | null)[] => {
    const raw = state[key];
    if (!Array.isArray(raw)) return [];
    return raw.map((c) => {
      if (!c || typeof c !== "object") return null;
      const n = Number((c as Json).r);
      return Number.isFinite(n) ? n : null;
    });
  };
  const fields: Array<[string, number | null, number]> = [
    ["x", savedNumber("x"), g.x],
    ["signedX", savedNumber("signedX"), g.signedX],
    ["r1", savedNumber("r1"), g.r1],
    ["r3", savedNumber("r3"), g.r3],
    ["r4", savedNumber("r4"), g.r4],
    ["r5", savedNumber("r5"), g.r5],
    ["special", savedNumber("special"), g.special ? 1 : 0],
  ];
  const differences = fields
    .filter(([, page]) => page !== null)
    .map(([field, page, actual]) => ({
      field, page, core: round(actual), diff: round(Math.abs((page as number) - actual), 9),
    }));
  const circleChecks: Record<string, boolean | null> = {};
  for (const key of ["circles4", "circles3", "circles2", "circles5"] as const) {
    const page = savedRadii(key);
    const actual = g[key].map((c) => (c === null ? null : c.r));
    circleChecks[key] = page.length === actual.length && actual.every((a, i) =>
      a === null ? page[i] === null : page[i] !== null && close(page[i] as number, a),
    );
  }
  const savedMatchesCore =
    differences.every((d) => close(d.page as number, d.core, 1e-4)) &&
    Object.values(circleChecks).every((v) => v !== false);
  return {
    ...saved,
    valid: true,
    core: measured,
    savedMatchesCore,
    differences,
    savedCirclesMatchCore: circleChecks,
    note: `X is ${round(g.signedX)} from O in a circle of radius ${round(g.r)}. The core measures r1 = ${measured.radii.fourSmallCirclesR1}, r3 = r4 = ${measured.radii.centralCircleR3}, r5 = ${measured.radii.lensCircleR5}${measured.lensCircleFits ? "" : " (negative, so no lens circle is drawn)"}; at x = r/3 all three would be r/9. ${savedMatchesCore ? "The saved radii agree with this construction." : "Some saved numbers differ from the core's geometry; see `differences` and `savedCirclesMatchCore`."}`,
  };
}
