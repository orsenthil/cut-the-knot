/*
 * run_game_logic actions and saved-position reader for Balls In Jar.
 *
 * Thirteen equal circles of radius r are stacked in a rack: three on the floor
 * (A, B, C), then D/E, F/G/H, I/J, and a top row K, L, M. Two touching circles
 * have centres 2r apart, so the core builds each new centre by intersecting the
 * "double radius" circles of its parents; a circle against a side comes from a
 * wall line and one parent. The page asks whether the top row K, L, M is always
 * perfectly horizontal. It is not: at small sizes the applet's repair step
 * lifts H onto C, and the top row tilts. Every number below comes from the
 * game's real core (balls-in-jar/), copied into src/generated/cores/ at build
 * time. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["balls-in-jar"].BallsInJarCore;
type Core = ReturnType<typeof core>;
type JarState = ReturnType<Core["start"]>;
type Figure = NonNullable<ReturnType<Core["stack"]>>;
type Point = { x: number; y: number };

/** The five rows, bottom to top, as the page names them. */
const ROWS: ReadonlyArray<{ row: number; name: string; names: readonly string[] }> = [
  { row: 0, name: "floor", names: ["A", "B", "C"] },
  { row: 1, name: "second", names: ["D", "E"] },
  { row: 2, name: "middle", names: ["F", "G", "H"] },
  { row: 3, name: "fourth", names: ["I", "J"] },
  { row: 4, name: "top", names: ["K", "L", "M"] },
];
const ALL_NAMES = ROWS.flatMap((r) => r.names);

const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
const pt = (p: Point): Point => ({ x: r4(p.x), y: r4(p.y) });

/** A saved point from JSON, e.g. the A/B/C the page wrote with Track.state. */
function point(value: unknown, key: string): Point {
  if (!value || typeof value !== "object") {
    throw new Error(`argument "${key}" must be a point with x and y`);
  }
  const p = value as Json;
  return { x: num(p, "x"), y: num(p, "y") };
}

/** The slider value as the applet's SetPercent accepts it. */
function checkedPercent(args: Json): number {
  const C = core();
  const p = num(args, "percent");
  if (p < C.PERCENT_MIN || p > C.PERCENT_MAX) {
    throw new Error(`percent must be between ${C.PERCENT_MIN} and ${C.PERCENT_MAX}, got ${p}`);
  }
  return p;
}

/** The B handle's x in the core's 400 x 300 board. */
function checkedB(args: Json): number {
  const C = core();
  const x = num(args, "bX");
  if (x < 0 || x > C.WIDTH) {
    throw new Error(`bX must be a board x between 0 and ${C.WIDTH}, got ${x}`);
  }
  return x;
}

/** Build a diagram: size from the slider, then slide B (withB clamps it). */
function build(percent: number, bX?: number): { here: JarState; figure: Figure | null } {
  const C = core();
  const sized = C.withPercent(C.start(), percent);
  const here = bX === undefined ? sized : C.withB(sized, bX);
  return { here, figure: C.stack(here) };
}

/**
 * The common reading of one diagram: all thirteen centres grouped by row,
 * which centres actually touch, the wall contacts, and the verdict on the
 * article's claim.
 */
function describe(here: JarState, figure: Figure | null) {
  const C = core();
  const valid = figure !== null;
  const circles = valid ? (figure.circles as Record<string, { x: number; y: number; r: number }>) : null;
  const centres: Record<string, Point> = {};
  if (circles) for (const name of ALL_NAMES) centres[name] = pt(circles[name]);

  // Touching bottles have centres exactly 2r apart. List every such pair.
  const touching: string[] = [];
  if (circles) {
    for (let i = 0; i < ALL_NAMES.length; i++) {
      for (let j = i + 1; j < ALL_NAMES.length; j++) {
        const a = circles[ALL_NAMES[i]], b = circles[ALL_NAMES[j]];
        if (Math.abs(C.dist(a, b) - 2 * here.r) < 1e-6) {
          touching.push(ALL_NAMES[i] + ALL_NAMES[j]);
        }
      }
    }
  }

  const gapKL = figure ? figure.dKL : null;
  const gapML = figure ? figure.dML : null;
  const allHorizontal = gapKL !== null && gapML !== null && Math.max(gapKL, gapML) <= 1e-6;
  const onePairHorizontal = gapKL !== null && gapML !== null && Math.min(gapKL, gapML) <= 1e-6;
  const highlight = !figure ? null : figure.showIL ? "KL" : figure.showJL ? "LM" : "none (both level)";

  let verdict: string;
  if (!valid) {
    verdict = "This size cannot hold the stack, so there is no top row to judge.";
  } else if (allHorizontal) {
    verdict = "At this setting the article's claim holds: K, L and M share one height (both gaps are zero to within a millionth of a unit).";
  } else if (onePairHorizontal) {
    verdict = "The 'perfectly horizontal' claim fails: one of KL, LM is level but the other is not, so the three tops are not on one line.";
  } else {
    verdict = "Both the article's claim and its weaker 'at least one pair is level' claim fail here: neither KL nor LM is horizontal.";
  }

  return {
    valid,
    percent: here.percent,
    r: r6(here.r),
    radiusFromSlider: r6(C.radius(here.percent)),
    A: pt(here.A), B: pt(here.B), C: pt(here.C),
    rows: ROWS.map((row) => ({
      row: row.row,
      name: row.name,
      circles: row.names.map((name) => ({ name, centre: centres[name] ?? null })),
    })),
    tangencies: {
      touchingPairs: touching,
      FAtWall: figure ? figure.FAtWall : null,
      HAtWall: figure ? figure.HAtWall : null,
      HDirectlyAboveC: figure
        ? Math.abs(circles!.H.y - (circles!.C.y - 2 * here.r)) < 1e-6
        : null,
    },
    topRow: {
      gapKL: gapKL === null ? null : r6(gapKL),
      gapML: gapML === null ? null : r6(gapML),
      highlight,
      allHorizontal,
      onePairHorizontal,
      articleClaimAlwaysHorizontal: allHorizontal,
    },
    status: C.report(figure),
    verdict,
  };
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For a bottle-size slider value (0-105) and the x position of the middle bottle B on the 400-unit board, give the centres of all thirteen bottles grouped into the five rows, the pairs whose centres touch (2r apart), the wall contacts, the vertical gaps |y(K)-y(L)| and |y(M)-y(L)|, and the verdict on the article's claim that K, L, M are always perfectly horizontal. B is clamped between A and C with room for one radius on each side, as on the page.",
      args: '{ "percent": 0, "bX": 175.15 }',
      run: (args) => {
        const percent = checkedPercent(args);
        const bX = checkedB(args);
        const { here, figure } = build(percent, bX);
        return {
          ...describe(here, figure),
          note:
            "At slider 0 with B pushed left, H is lifted onto C by the applet's repair step and K, L, M are far from level; with B centred they are level again. The centre of G stays at x = 200 whatever B does.",
        };
      },
    },
    check_horizontal_claim: {
      describe:
        "Sweep bottle sizes and positions of B using the real core, and count how many diagrams have all three top bottles level, only one top pair level, or neither pair level. Reports counterexamples to the article's 'always horizontal' claim and to its weaker 'at least one pair is horizontal' claim; bSteps is the number of B positions sampled in each size's allowed range.",
      args: '{ "percents": [0, 10, 25, 50, 75, 100, 105], "bSteps": 11 }',
      run: (args) => {
        const C = core();
        const raw = args.percents;
        if (raw !== undefined && !Array.isArray(raw)) {
          throw new Error('argument "percents" must be an array of numbers');
        }
        const percents = raw === undefined
          ? [0, 10, 25, 50, 75, 100, 105]
          : numArray(args, "percents");
        for (const p of percents) {
          if (p < C.PERCENT_MIN || p > C.PERCENT_MAX) {
            throw new Error(`every percent must be between ${C.PERCENT_MIN} and ${C.PERCENT_MAX}, got ${p}`);
          }
        }
        const bSteps = args.bSteps === undefined ? 11 : num(args, "bSteps");
        if (!Number.isInteger(bSteps) || bSteps < 2 || bSteps > 101) {
          throw new Error("bSteps must be a whole number between 2 and 101");
        }

        let sampled = 0, all = 0, one = 0, none = 0, invalid = 0;
        const counterexamples: Json[] = [];
        for (const p of percents) {
          const sized = C.withPercent(C.start(), p);
          const lo = sized.A.x + 2 * sized.r;
          const hi = sized.C.x - 2 * sized.r;
          for (let k = 0; k < bSteps; k++) {
            const bX = lo <= hi ? lo + ((hi - lo) * k) / (bSteps - 1) : undefined;
            const { here, figure } = build(p, bX);
            sampled++;
            if (!figure) { invalid++; continue; }
            if (figure.dKL <= 1e-6 && figure.dML <= 1e-6) all++;
            else if (Math.min(figure.dKL, figure.dML) <= 1e-6) one++;
            else {
              none++;
              if (counterexamples.length < 3) {
                counterexamples.push({
                  percent: here.percent, bX: r4(here.B.x),
                  gapKL: r6(figure.dKL), gapML: r6(figure.dML),
                  highlight: figure.showIL ? "KL" : figure.showJL ? "LM" : "none",
                });
              }
            }
          }
        }
        return {
          sampled, allThreeLevel: all, onePairLevel: one, neitherPairLevel: none, invalid,
          alwaysHorizontalClaimHolds: none === 0 && invalid === 0,
          weakerClaimHolds: none === 0 && invalid === 0,
          counterexamples,
          note:
            "The sweep uses the core's own stack construction. Whenever neither gap is zero the article's 'always horizontal' story is false, and its weaker 'at least one pair is level' story falls too; the page highlights the nearer pair when the gaps differ by more than one unit.",
        };
      },
    },
  };
}

/** What the core says about the picture the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Balls In Jar state version ${stateVersion}`);
  }
  const saved = {
    percent: num(state, "percent"),
    r: num(state, "r"),
    A: point(state.A, "A"),
    B: point(state.B, "B"),
    C: point(state.C, "C"),
  };
  const { here, figure } = build(saved.percent, saved.B.x);
  const rebuilt = { percent: here.percent, r: here.r, A: here.A, B: here.B, C: here.C };
  const matchesSaved =
    Math.abs(saved.r - rebuilt.r) <= 1e-9 &&
    Math.abs(saved.A.x - rebuilt.A.x) <= 1e-9 && Math.abs(saved.A.y - rebuilt.A.y) <= 1e-9 &&
    Math.abs(saved.B.x - rebuilt.B.x) <= 1e-9 && Math.abs(saved.B.y - rebuilt.B.y) <= 1e-9 &&
    Math.abs(saved.C.x - rebuilt.C.x) <= 1e-9 && Math.abs(saved.C.y - rebuilt.C.y) <= 1e-9;

  return {
    stateVersion,
    saved: {
      percent: saved.percent, r: r6(saved.r),
      A: pt(saved.A), B: pt(saved.B), C: pt(saved.C),
    },
    savedMatchesCore: matchesSaved,
    ...describe(here, figure),
    note: matchesSaved
      ? "The saved slider value and B position rebuild the exact same rack; the reading below is what the core draws for that saved position."
      : "The saved A, B, C do not quite match what the core builds from the saved slider and B position; the reading below uses the rebuilt rack.",
  };
}
