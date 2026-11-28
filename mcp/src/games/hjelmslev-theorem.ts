/*
 * run_game_logic actions and saved-position reader for Hjelmslev Theorem.
 *
 * The illustration joins corresponding points of two segments and marks
 * M_i = r * P1_i + (1 - r) * P2_i for i = 0..10. The core proves algebraically
 * that M_i = A_r + (B_r - A_r) * i/10, so the marks lie on the one segment
 * A_r B_r (or all coincide when A_r = B_r). r = 1/2 is Hjelmslev's midpoint
 * theorem; the same calculation works for every r and for any affine matching.
 * Every number below comes from the game's real core. See _shared.ts for shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["hjelmslev-theorem"].HjelmslevTheoremCore;

type Point = { x: number; y: number };
type Picture = {
  A1: Point; B1: Point; A2: Point; B2: Point;
  s: number; showNames: boolean; keepEqual: boolean; fixLength: boolean;
};

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const show = (p: Point) => ({ x: round(p.x), y: round(p.y) });

function readPoint(value: unknown, label: string): Point {
  const p = value as Json | null | undefined;
  if (!p || typeof p !== "object" || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
    throw new Error(`${label} must be an object with numeric x and y`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

/** Endpoints may be given nested under "points" or as top-level saved fields. */
function readPoints(args: Json): Record<string, Point> | undefined {
  if (args.points !== undefined && args.points !== null && typeof args.points !== "object") {
    throw new Error('"points" must be an object with A1, B1, A2, B2');
  }
  const raw = ((args.points ?? args) as Json);
  const present = ["A1", "B1", "A2", "B2"].filter((name) => raw[name] !== undefined && raw[name] !== null);
  if (present.length === 0) return undefined; // the applet's own starting picture
  if (present.length !== 4) {
    throw new Error("provide all four endpoints A1, B1, A2, B2 (or none for the default picture)");
  }
  return {
    A1: readPoint(raw.A1, "A1"),
    B1: readPoint(raw.B1, "B1"),
    A2: readPoint(raw.A2, "A2"),
    B2: readPoint(raw.B2, "B2"),
  };
}

/** Validate the arguments, then build a real core state for the drawing. */
function readState(args: Json) {
  const C = core();
  const points = readPoints(args);
  // Actions name the fraction "r"; the saved page state names it "s".
  const r = args.r !== undefined && args.r !== null ? num(args, "r") : num(args, "s", C.S_DEFAULT);
  if (r < C.S_MIN || r > C.S_MAX) {
    throw new Error(`"r" must be between ${C.S_MIN} and ${C.S_MAX}, got ${r}`);
  }
  const n = args.n === undefined || args.n === null ? C.N : num(args, "n");
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    throw new Error('"n" must be an integer between 1 and 1000');
  }
  // The two branches of start() both fill in all four named endpoints.
  const state = C.start({
    points,
    s: r,
    showNames: args.showNames !== false,
    keepEqual: args.keepEqual === true,
    fixLength: args.fixLength === true,
  }) as Picture;
  return { state, n };
}

export function actions(): GameActions {
  return {
    verify_claim: {
      describe:
        "Mark the points M_i = r*P1_i + (1-r)*P2_i for i = 0..n on corresponding points of the two segments, and report whether all n+1 marks are collinear or all coincide, and whether they lie exactly on the segment from A_r to B_r. At r = 1/2 these are the midpoints of corresponding points under an isometry (Hjelmslev's theorem); the core checks the affine form for every r.",
      args: '{ "r": 0.5, "n": 10 }',
      run: (args) => {
        const C = core();
        const { state, n } = readState(args);
        const cl = C.claims(state, n);
        const { Ar, Br } = C.endpoints(state);
        const marks = C.combinedPoints(state, n);
        const note = cl.coincide
          ? `All ${n + 1} marks fall on one spot: A_r and B_r coincide at (${show(Ar).x}, ${show(Ar).y}).`
          : cl.collinear
            ? `All ${n + 1} marks lie on the one segment from A_r to B_r, a distance ${round(C.distance(Ar, Br))} apart.`
            : "The marks are neither collinear nor coincident at this position.";
        return {
          r: state.s,
          n,
          markCount: n + 1,
          endpointAr: show(Ar),
          endpointBr: show(Br),
          firstMark: show(marks[0]),
          lastMark: show(marks[n]),
          collinear: cl.collinear,
          coincide: cl.coincide,
          eitherCollinearOrCoincide: cl.dichotomy,
          onSegmentArBr: cl.endpoints && cl.affineFormula,
          spread: round(cl.spread),
          maxDeviationFromLine: round(cl.deviation),
          maxAffineError: round(cl.affineError),
          note: note + " The verdict holds for every r, not only r = 1/2, and needs only an affine matching of the segments.",
        };
      },
    },
    r_combination: {
      describe:
        "The r-linear-combination strengthening: A_r = r*A1 + (1-r)*A2, B_r = r*B1 + (1-r)*B2 and the i-th mark is exactly (1 - i/n)*A_r + (i/n)*B_r, an affine image of an evenly divided segment. Check that identity mark by mark and sample the collinear-or-coincide verdict at r = 0, 1/4, 1/2, 3/4 and 1 to show the midpoint case r = 1/2 is not special.",
      args: '{ "r": 0.25, "n": 10 }',
      run: (args) => {
        const C = core();
        const { state, n } = readState(args);
        const cl = C.claims(state, n);
        const { Ar, Br } = C.endpoints(state);
        const marks = C.combinedPoints(state, n).map((p, i) => {
          const image = C.affineImage(state, i / n);
          return {
            i,
            u: round(i / n),
            mark: show(p),
            affineImage: show(image),
            error: round(C.distance(p, image)),
          };
        });
        const sweep = [0, 0.25, 0.5, 0.75, 1].map((rv) => {
          const c = C.claims(C.withOption(state, "s", rv), n);
          return {
            r: rv,
            collinear: c.collinear,
            coincide: c.coincide,
            spread: round(c.spread),
            deviation: round(c.deviation),
          };
        });
        return {
          r: state.s,
          n,
          A_r: show(Ar),
          B_r: show(Br),
          formula: "M_i = A_r + (B_r - A_r) * i/n = (1 - i/n) * A_r + (i/n) * B_r",
          marks,
          maxAffineError: round(cl.affineError),
          affineFormulaHolds: cl.affineFormula,
          rSweep: sweep,
          note:
            "Each mark is the same fraction along A_r B_r as i/n, with zero error, so the marks are evenly spaced on one line — or all coincide when A_r = B_r. The same verdict holds at every sampled r: r = 1/2 gives Hjelmslev's midpoint theorem, and the rest is the affine generalisation.",
        };
      },
    },
  };
}

/** What the core says about the picture the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const { state: here } = readState(state);
  const cl = C.claims(here);
  const { Ar, Br } = C.endpoints(here);
  const note = cl.coincide
    ? "All eleven marks coincide at A_r = B_r; press Check the claim to read that on the page."
    : cl.collinear
      ? `All eleven marks lie on the segment from A_r to B_r (length ${round(C.distance(Ar, Br))}); press Check the claim to read that on the page.`
      : "The marks are not collinear at this position; drag a handle to explore the claim.";
  return {
    stateVersion,
    // The saved fields, echoed as the page wrote them.
    A1: here.A1,
    B1: here.B1,
    A2: here.A2,
    B2: here.B2,
    s: here.s,
    showNames: here.showNames,
    keepEqual: here.keepEqual,
    fixLength: here.fixLength,
    // The core's reading of that position.
    r: here.s,
    markCount: C.N + 1,
    A_r: show(Ar),
    B_r: show(Br),
    collinear: cl.collinear,
    coincide: cl.coincide,
    eitherCollinearOrCoincide: cl.dichotomy,
    onSegmentArBr: cl.endpoints && cl.affineFormula,
    spread: round(cl.spread),
    maxDeviationFromLine: round(cl.deviation),
    maxAffineError: round(cl.affineError),
    note,
  };
}
