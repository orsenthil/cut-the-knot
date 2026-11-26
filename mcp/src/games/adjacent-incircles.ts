/*
 * run_game_logic actions and saved-position reader for Adjacent Incircles.
 *
 * Apex A and n points on a base line make a fan of triangles. With
 * g(i) = (AMi + signed offset from the altitude's foot) / h, the inradius of
 * the triangle Mi A M(i+k) is h/2 * (1 - g(i)/g(i+k)) (Heron + algebra). The
 * page's claim is about the circles: equal level-1 radii force equal radii at
 * every wider level, because they force the g(i) to be a geometric
 * progression. All numbers below come from the game's real core
 * (adjacent-incircles/), copied into src/generated/cores/ at build time.
 * See _shared.ts for the shape of a game module.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["adjacent-incircles"].AdjacentIncirclesCore;

type Point = { x: number; y: number };
type Fan = { n: number; apex: Point; points: Point[] };

const round = (v: number, digits = 4): number => Number(v.toFixed(digits));

/** Tool arguments use [x, y]; a saved position from the page uses {x, y}. */
function readPoint(value: unknown, name: string): Point {
  if (Array.isArray(value) && value.length === 2) {
    const x = Number(value[0]), y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const x = Number(o.x), y = Number(o.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  throw new Error(`"${name}" must be a point [x, y] or {x, y}`);
}

function readPoints(value: unknown, name: string): Point[] {
  if (!Array.isArray(value)) throw new Error(`"${name}" must be an array of points [x, y]`);
  return value.map((p, i) => readPoint(p, `${name}[${i}]`));
}

/** Build a fan from explicit base points, or place them with makeEqual(q). */
function fanFromArgs(args: Json): Fan {
  const C = core();
  const given = args.base === undefined ? null : readPoints(args.base, "base");
  const n = Math.round(num(args, "n", given ? given.length : C.N_DEFAULT));
  if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`"n" must be an integer from ${C.N_MIN} to ${C.N_MAX}`);
  }
  if (given && given.length !== n) {
    throw new Error(`"base" must list exactly ${n} points, got ${given.length}`);
  }
  const seed = C.start({ n, rng: () => 0.5 });
  const apex = args.apex === undefined ? seed.apex : readPoint(args.apex, "apex");
  if (given) return { n, apex, points: given };
  const ratio = num(args, "ratio", 1.6);
  if (!Number.isFinite(ratio) || ratio <= 1) throw new Error('"ratio" must be greater than 1');
  const placed = C.makeEqual({ ...seed, apex }, ratio) as Fan;
  return { n, apex, points: placed.points };
}

/** The core's reading of a fan: radii at every level and the ratio invariant. */
function readFan(f: Fan) {
  const C = core();
  const state = f as ReturnType<typeof C.start>;
  const line = C.baseLine(state);
  const g = C.gValues(state) as number[] | null;
  const ratios = g && g.length > 1 ? g.slice(1).map((v, i) => v / g[i]) : [];
  const geometric = ratios.length > 0 && ratios.every(
    (v) => Math.abs(v - ratios[0]) <= 1e-6 * Math.max(1, Math.abs(ratios[0])),
  );
  const q = geometric ? ratios[0] : null;
  const levels = [];
  for (let k = 1; k < f.n; k++) {
    const radii = C.radii(state, k) as number[];
    const spread = C.spread(radii) as number;
    levels.push({
      level: k,
      triangles: radii.length,
      radii: radii.map((r) => round(r)),
      spread: round(spread, 6),
      equalRadii: spread <= C.MATCH,
      predictedFromRatio: q === null ? null : round(line.h / 2 * (1 - Math.pow(q, -k))),
    });
  }
  return {
    n: f.n,
    apex: [round(f.apex.x), round(f.apex.y)],
    base: f.points.map((p) => [round(p.x), round(p.y)]),
    altitude: round(line.h),
    foot: [round(line.foot.x), round(line.foot.y)],
    g: g ? g.map((v) => round(v)) : null,
    successiveRatios: ratios.map((v) => round(v)),
    geometricProgression: geometric,
    ratioQ: q === null ? null : round(q),
    levels,
    level1Equal: C.equalFirstLevel(state) as boolean,
    theoremHolds: C.theoremHolds(state) as boolean,
    note: "The claim is about the circle radii: when the level-1 incircles are equal, so are the incircles of every wider triangle Mi A M(i+k). Equal radii make g(i) a geometric progression with ratio q, giving radius h/2 * (1 - q^-k) at level k, whatever i is.",
  };
}

export function actions(): GameActions {
  const C = core();
  return {
    radii_by_level: {
      describe:
        "For n base points and an apex, give the incircle radii of Mi A M(i+k) at every level k, whether the radii match at the applet's 1-pixel tolerance, and whether the equal-incircles conclusion holds throughout. Also gives h, the g(i) values and their successive ratios: equal level-1 radii mean those ratios are one common q, and level k then has radius h/2 * (1 - q^-k). Pass base as [x, y] pairs, or pass ratio instead to let the core place the points.",
      args: '{ "n": 4, "apex": [120, 80], "base": [[52, 216], [137, 216], [227, 216], [316, 216]] }',
      run: (args) => readFan(fanFromArgs(args)),
    },
    equal_fan: {
      describe:
        "Place n base points with the core's makeEqual so the neighbouring incircles have equal radii, then check the page's conclusions: radii at every level against h/2 * (1 - q^-k), the common ratio of the g(i), and the old tablet's AM_mid = sqrt(s(s-a)) for the first three points (s the semiperimeter of M1 A M3, a its base). A requested ratio above what the fan can hold is capped by the core; ratioQ is the one actually achieved.",
      args: '{ "n": 5, "apex": [120, 80], "ratio": 1.6 }',
      run: (args) => {
        if (args.base !== undefined) throw new Error('"base" is not allowed here: give n, apex and ratio');
        const f = fanFromArgs(args);
        const reading = readFan(f);
        const A = f.apex, M0 = f.points[0], M1 = f.points[1], M2 = f.points[2];
        const a = C.distance(M0, M2);
        const s = (a + C.distance(A, M0) + C.distance(A, M2)) / 2;
        const middle = C.distance(A, M1);
        const target = Math.sqrt(s * (s - a));
        return {
          ...reading,
          requestedRatio: num(args, "ratio", 1.6),
          sangaku: {
            outerBase: round(a),
            semiperimeter: round(s),
            middleDistance: round(middle),
            sqrtSemiperimeterTimesRemainder: round(target),
            agrees: Math.abs(middle - target) <= 1e-6 * Math.max(1, middle),
          },
          note: "makeEqual puts the g(i) in a geometric progression, so every level's circles come out equal; the measured ratio q gives their common radius h/2 * (1 - q^-k). The tablet relation for the middle point, AM2 = sqrt(s(s - a)), holds for the first three points as well.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) {
    throw new Error(`unsupported Adjacent Incircles state version ${stateVersion}`);
  }
  const n = Math.round(num(state, "n"));
  if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`"n" must be an integer from ${C.N_MIN} to ${C.N_MAX}`);
  }
  const apex = readPoint(state.apex, "apex");
  const points = readPoints(state.points, "points");
  if (points.length !== n) throw new Error(`"points" must list exactly ${n} points`);
  const savedLevel1 = Array.isArray(state.level1) ? numArray(state, "level1") : null;
  const savedEqual = state.equal === true;
  const f: Fan = { n, apex, points };
  const reading = readFan(f);
  const recomputed = C.radii(f as ReturnType<typeof C.start>, 1) as number[];
  return {
    // The page's saved fields, with the same names.
    stateVersion,
    n,
    apex: { x: apex.x, y: apex.y },
    points: points.map((p) => ({ x: p.x, y: p.y })),
    level1: savedLevel1,
    equal: savedEqual,
    // What the core adds.
    recomputedLevel1: reading.levels[0].radii,
    savedRadiiMatchCore: savedLevel1 && savedLevel1.length === recomputed.length
      ? savedLevel1.every((r, i) => Math.abs(r - recomputed[i]) < 1e-9)
      : null,
    savedEqualMatchesCore: savedEqual === reading.level1Equal,
    levels: reading.levels,
    altitude: reading.altitude,
    foot: reading.foot,
    g: reading.g,
    successiveRatios: reading.successiveRatios,
    geometricProgression: reading.geometricProgression,
    ratioQ: reading.ratioQ,
    theoremHolds: reading.theoremHolds,
    note: reading.level1Equal
      ? `The level-1 radii match at the applet's ${C.MATCH}-pixel tolerance, so every wider triangle's incircle matches too; the g(i) are a geometric progression with ratio ${reading.ratioQ}.`
      : `The level-1 radii differ by ${reading.levels[0].spread}, more than the applet's ${C.MATCH}-pixel tolerance, so the equal-radii conclusion does not apply; the g(i) are not a geometric progression.`,
  };
}
