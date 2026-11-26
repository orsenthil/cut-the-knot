/*
 * run_game_logic actions and saved-position reader for Bottema.
 *
 * The real core is bottema/bottema-core.js, copied into src/generated/cores/
 * at build time. Two squares are erected on BC and CA sharing the corner C.
 * If A_b is the far corner of the square on BC and B_a the far corner of the
 * square on CA, their midpoint M is the centre of the square on AB, so it does
 * not depend on C at all. The core reaches it by rotating C about B one way
 * and about A the other way: in the sum of the rotated points the part that
 * depends on C cancels. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["bottema"].BottemaCore;

type Point = { x: number; y: number };
type Diagram = {
  A: Point; B: Point; C: Point;
  showNames: boolean; showLines: boolean; showHint: boolean;
};

const round = (v: number): number => Number(v.toFixed(6));
const pt = (p: Point): [number, number] => [round(p.x), round(p.y)];
const diagram = (A: Point, B: Point, C: Point): Diagram =>
  ({ A, B, C, showNames: false, showLines: false, showHint: false });

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
  throw new Error(`"${name}" must be a point [x, y] or {x, y} with finite numbers`);
}

/** Everything the core measures about one diagram, in tutor-friendly form. */
function reading(C: ReturnType<typeof core>, s: Diagram) {
  const f = C.figure(s);
  const centre = C.squareCentre(s);
  const claims = C.claims(s) as Record<string, boolean>;
  const foot = C.flankHeights(s) as Record<string, number> | null;
  const names = [
    "midpointIndependent", "rightIsosceles", "otherRightIsosceles",
    "squares", "heightsMatch", "halfway",
  ] as const;
  const failed = names.filter((k) => claims[k] !== true);
  return {
    vertices: { A: pt(f.A), B: pt(f.B), C: pt(f.C) },
    squareOnBC: {
      corners: { B: pt(f.B), A_b: pt(f.Ab), A_c: pt(f.Ac), C: pt(f.C) },
      centre: pt(C.midpoint(f.B, f.Ac)),
    },
    squareOnCA: {
      corners: { C: pt(f.C), B_c: pt(f.Bc), B_a: pt(f.Ba), A: pt(f.A) },
      centre: pt(C.midpoint(f.C, f.Ba)),
    },
    M: pt(f.M),
    squareCentreOnAB: pt(centre),
    distanceMtoSquareCentre: round(C.distance(f.M, centre)),
    flankHeights: foot ? {
      BaU: round(foot.BaU), AbV: round(foot.AbV), MW: round(foot.MW),
      AZ: round(foot.AZ), BZ: round(foot.BZ), halfBase: round(foot.halfBase),
    } : null,
    claims: {
      midpointIndependent: claims.midpointIndependent === true,
      rightIsosceles: claims.rightIsosceles === true,
      otherRightIsosceles: claims.otherRightIsosceles === true,
      squares: claims.squares === true,
      heightsMatch: claims.heightsMatch === true,
      halfway: claims.halfway === true,
      allHold: failed.length === 0,
      failed,
    },
    note:
      "M is the midpoint of A_b B_a, the two far corners of the squares on BC and CA. It equals the centre of the square on AB, so it is fixed by A and B alone: rotating C about B and about A by quarter turns in opposite directions makes every term containing C cancel. AMB and A_c M B_c are isosceles right triangles at M, and the trapezoid heights give B_aU = AZ, A_bV = BZ, MW = AB/2.",
  };
}

export function actions(): GameActions {
  return {
    squares_and_midpoint: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] in page coordinates, y downward), erect the two squares on BC and CA that share C. Returns their four other corners (A_b, A_c on BC; B_a, B_c on CA) and centres, the midpoint M of A_b B_a, the closed-form centre of the square on AB, the proof's flank heights, and the claim checks (M independent of C, AMB and A_c M B_c isosceles right, the squares and the trapezoid identities). M never moves when C moves.",
      args: '{ "A": [150, 210], "B": [250, 210], "C": [215, 120] }',
      run: (args) => {
        const C = core();
        return reading(C, diagram(readPoint(args.A, "A"), readPoint(args.B, "B"), readPoint(args.C, "C")));
      },
    },
    move_c: {
      describe:
        "Hold A and B still and drag C to several places Cs (an array of [x, y] points). For each C the core re-erects the squares and reports M, the midpoint of A_b B_a, and its distance to the centre of the square on AB. Every M is the same point, demonstrating Bottema's theorem: M does not depend on C.",
      args: '{ "A": [150, 210], "B": [250, 210], "Cs": [[215, 120], [180, 60], [300, 170], [90, 100]] }',
      run: (args) => {
        const C = core();
        const A = readPoint(args.A, "A"), B = readPoint(args.B, "B");
        const raw = args.Cs;
        if (!Array.isArray(raw) || raw.length === 0) {
          throw new Error('"Cs" must be a non-empty array of [x, y] points');
        }
        if (raw.length > 50) throw new Error('"Cs" may list at most 50 positions');
        const Cs = raw.map((p, i) => readPoint(p, `Cs[${i}]`));
        const centre = C.squareCentre(diagram(A, B, Cs[0]));
        const positions = Cs.map((c, i) => {
          const f = C.figure(diagram(A, B, c));
          return {
            i, C: pt(c), M: pt(f.M), distanceToSquareCentre: round(C.distance(f.M, centre)),
          };
        });
        const allMEqual = positions.every((p) => p.distanceToSquareCentre < 1e-6);
        return {
          A: pt(A), B: pt(B), squareCentreOnAB: pt(centre), positions, allMEqual,
          note: allMEqual
            ? "Every position of C gives the same M: the centre of the square on AB. A and B alone decide where the treasure is buried."
            : "The points should all agree; if they do not, the inputs are degenerate (A and B too close together).",
        };
      },
    },
  };
}

/** The page's saved diagram, with the core's reading of it for the tutor. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) {
    throw new Error(`unsupported Bottema state version ${stateVersion}`);
  }
  const defaults = C.start({}) as Diagram;
  const pick = (key: string): Point =>
    state[key] === undefined || state[key] === null ? defaults[key as "A" | "B" | "C"] : readPoint(state[key], key);
  const s = diagram(pick("A"), pick("B"), pick("C"));
  s.showNames = state.showNames === true;
  s.showLines = state.showLines === true;
  s.showHint = state.showHint === true;
  return {
    // The fields the page saved with Track.state, with the same names.
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    showNames: s.showNames, showLines: s.showLines, showHint: s.showHint,
    // What the core adds.
    reading: reading(C, s),
  };
}
