/*
 * run_game_logic actions and saved-position reader for Line, Circle, and Fixed
 * Points (Bogomolny's applet behind IMO 2007 Problem 3).
 *
 * Every number below is measured by the game's real core,
 * line-circle-and-fixed-points/line-circle-and-fixed-points-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * applet's 400 x 300 canvas, y down; the given line QV is horizontal.
 *
 *   - fixed_point slides V along QV and confirms that VR keeps going through
 *     the same point S, the other meeting of the given circle with the
 *     horizontal through R-infinity (the limit of R as V goes to infinity).
 *   - tangent_circle takes V' = SP ∩ QV and checks that the circle through
 *     P, Q, V' is tangent to the given circle at P.
 *
 * This is an illustration with no win or loss: the record marks it explored.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type Geometry = {
  P: Pt; Q: Pt; V: Pt; O: Pt;
  circleO: Circle; circleX: Circle; circleT: Circle | null;
  R: Pt; S: Pt; T: Pt | null;
  lineVR: Pt[]; VQ: Pt[];
  Sfixed: Pt | null;
  tangency: number | null;
  fixedError: number | null;
};
type Residuals = {
  onCircleO: number; onCircleX: number; onCircleT: number; pOnBoth: number;
  vrCollinear: number; sptCollinear: number; tvqCollinear: number;
  tangency: number | null; fixedError: number | null;
};
type State = {
  P: Pt; Q: Pt; V: Pt; O: Pt;
  showNames: boolean; showPremise: boolean; showStatement: boolean; showHint: boolean;
  moves: number; explored: boolean;
};
type Core = {
  WIDTH: number; HEIGHT: number; EDGE: number; MIN_VQ: number;
  HANDLES: string[]; OPTION_KEYS: string[];
  dot(a: Pt, b: Pt): number;
  dist(a: Pt, b: Pt): number;
  start(options?: Partial<State>): State;
  compute(state: State): Geometry | null;
  residuals(geometry: Geometry): Residuals | null;
  fixedPoint(P: Pt, Q: Pt, O: Pt): Pt | null;
  result(state: State): string | null;
};

const core = (): Core =>
  cores["line-circle-and-fixed-points"].LineCircleAndFixedPointsCore as unknown as Core;

/* The core is exact up to floating point; only what we print is rounded. */
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const sig = (v: number | null | undefined): number | null =>
  v !== null && v !== undefined && Number.isFinite(v) ? Number(v.toExponential(2)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r6(p.x)!, y: r6(p.y)! }
    : null;
const circle = (c: Circle | null): { center: Pt | null; radius: number | null } | null =>
  c ? { center: pt(c.center), radius: r6(c.radius) } : null;
const boolOr = (raw: unknown, fallback: boolean): boolean =>
  typeof raw === "boolean" ? raw : fallback;
const numberOr = (raw: unknown, fallback: number): number =>
  raw !== undefined && raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : fallback;

/** The tolerance the page itself uses to call the residuals zero. */
const TOL = 0.05;

/** A board point, accepted as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback: Pt): Pt {
  if (raw === undefined || raw === null) return { ...fallback };
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
    }
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** The opening picture moved onto the caller's handles, via the core's own clamps. */
function buildState(C: Core, args: Json): { state: State; options: Json } {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of P, Q, V and O points");
  }
  const seed = C.start();
  const options: Json = {};
  for (const name of C.HANDLES) {
    options[name] = readPoint(args[name], name, seed[name as keyof State] as Pt);
  }
  for (const key of C.OPTION_KEYS) {
    if (typeof args[key] === "boolean") options[key] = args[key];
  }
  return { state: C.start(options as Partial<State>), options };
}

/** A short, validated list of x positions for V on the line y = Q.y. */
function readVxs(args: Json): number[] {
  const raw = args.vxs;
  if (raw === undefined || raw === null) return [40, 100, 160, 220, 280, 340];
  if (!Array.isArray(raw)) throw new Error('"vxs" must be an array of V x-coordinates');
  if (raw.length < 1 || raw.length > 16) {
    throw new Error('"vxs" must hold between 1 and 16 x-coordinates');
  }
  return raw.map((v, i) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`vxs[${i}] is not a number`);
    return n;
  });
}

/** R-infinity: the second meeting of line PQ with C(O), the limit of R. */
function limitR(C: Core, P: Pt, Q: Pt, O: Pt): Pt | null {
  const d = { x: Q.x - P.x, y: Q.y - P.y };
  const dd = C.dot(d, d);
  if (!dd) return null;
  const t = -2 * C.dot({ x: P.x - O.x, y: P.y - O.y }, d) / dd;
  return { x: P.x + t * d.x, y: P.y + t * d.y };
}

export function actions(): GameActions {
  return {
    fixed_point: {
      describe:
        "Slide V along the given horizontal line QV and, for each position, find R where the circle through P, Q, V meets the given circle C(O) again and S where the line VR returns to C(O). The core's closed form gives the fixed point S as the other intersection of C(O) with the horizontal through R-infinity (the limit of R as V goes far away along PQ); the action reports S at each sampled V, its distance from that fixed point and whether V, R, S stay collinear. Pass P, Q, V, O as [x, y] or { x, y } on the 400 x 300 board (any omitted point keeps the opening picture) and vxs as a list of V x-coordinates (1 to 16 of them, default 40, 100, 160, 220, 280, 340); an ill-posed configuration with no second circle crossing is reported as invalid.",
      args: '{"P":[200,150],"Q":[300,262.5],"V":[100,262.5],"O":[140,131.25],"vxs":[40,100,160,220,280,340]}',
      run: (args) => {
        const C = core();
        const { state, options } = buildState(C, args);
        const vxs = readVxs(args);
        const samples = vxs.map((vx) => {
          const here = C.start({ ...options, V: { x: vx, y: state.Q.y } } as Partial<State>);
          const g = C.compute(here);
          if (!g) {
            return { requestedVx: vx, V: pt(here.V), valid: false, reason: "no second circle crossing" };
          }
          return {
            requestedVx: vx,
            V: pt(here.V),
            valid: true,
            R: pt(g.R),
            S: pt(g.S),
            fixedPointError: sig(g.fixedError),
            vrCollinear: sig(C.residuals(g)?.vrCollinear),
            passesThroughFixedPoint: g.fixedError !== null && g.fixedError < TOL,
          };
        });
        const good = samples.filter((s) => s.valid);
        const Ss = good.map((s) => s.S as Pt);
        let spread = 0;
        for (let i = 0; i < Ss.length; i++) {
          for (let j = i + 1; j < Ss.length; j++) spread = Math.max(spread, C.dist(Ss[i], Ss[j]));
        }
        const formula = C.fixedPoint(state.P, state.Q, state.O);
        const rInfinity = limitR(C, state.P, state.Q, state.O);
        return {
          board: { width: C.WIDTH, height: C.HEIGHT },
          points: { P: pt(state.P), Q: pt(state.Q), O: pt(state.O) },
          givenCircle: circle({ center: state.O, radius: C.dist(state.O, state.P) }),
          limit: {
            Rinfinity: pt(rInfinity),
            description: "As V goes far along line QV, the circle PQV tends to line PQ, so R tends to R-infinity, the second point where PQ meets C(O).",
          },
          fixedPoint: pt(formula),
          fixedPointConstruction: "S is the other point where C(O) meets the horizontal line through R-infinity (the line parallel to QV). It depends only on P, Q and O, never on V.",
          samples,
          allPassThroughFixedPoint: good.length > 0 && good.every((s) => s.passesThroughFixedPoint),
          largestDeviation: sig(Math.max(0, ...good.map((s) => s.fixedPointError ?? 0))),
          spreadOfS: sig(spread),
          tolerance: TOL,
          note:
            "Move V anywhere on its line: the circle through P, Q, V changes and R moves round C(O), but the line VR always swings about the same spot S. Push V to infinity and VR becomes the horizontal through R-infinity, which picks out S as that line's second crossing of C(O). This is an illustration with no win or loss.",
        };
      },
    },

    tangent_circle: {
      describe:
        "For one picture, take V' to be where the line SP meets the given line QV and draw the circle through P, Q, V' (the applet's Hint circle). Report V', that circle's centre and radius, the residual |distance between centres − (radii added)| that vanishes exactly when the two circles are tangent at P, and checks that V' lies on QV and that S, P and V' are collinear. Pass P, Q, V, O as [x, y] or { x, y } on the 400 x 300 board (any omitted point keeps the opening picture); the action reports invalid when the circles do not meet again or SP is parallel to QV.",
      args: '{"P":[200,150],"Q":[300,262.5],"V":[100,262.5],"O":[140,131.25]}',
      run: (args) => {
        const C = core();
        const { state } = buildState(C, args);
        const g = C.compute(state);
        if (!g) {
          return {
            valid: false,
            note: "This configuration has no second circle crossing, so R, S and the tangent circle are not defined; move P, Q, V or O.",
          };
        }
        const res = C.residuals(g);
        return {
          valid: true,
          points: {
            P: pt(g.P), Q: pt(g.Q), V: pt(g.V), O: pt(g.O),
            R: pt(g.R), S: pt(g.S), Vprime: pt(g.T),
          },
          givenCircle: circle(g.circleO),
          throughPQV: circle(g.circleX),
          throughPQVprime: circle(g.circleT),
          checks: {
            vPrimeOnQV: sig(res?.tvqCollinear),
            sPAndVPrimeCollinear: sig(res?.sptCollinear),
            pOnBothCircles: sig(res?.pOnBoth),
            tangencyResidual: sig(g.tangency),
            tangentAtP: g.tangency !== null && g.tangency < TOL,
          },
          tolerance: TOL,
          note:
            "The three circles through P — C(O), the circle through P, Q, V and the circle through P, Q, V' — all pass through P. Choosing V' on SP and on QV makes the third circle just touch C(O) at P: its centre is exactly one radius-sum away from O. This is an illustration with no win or loss.",
        };
      },
    },
  };
}

/** The saved state rebuilt from the fields Track.state wrote, with safe fallbacks. */
function savedState(C: Core, state: Json): State {
  const seed = C.start();
  return {
    P: readPoint(state.P, "P", seed.P),
    Q: readPoint(state.Q, "Q", seed.Q),
    V: readPoint(state.V, "V", seed.V),
    O: readPoint(state.O, "O", seed.O),
    showNames: boolOr(state.showNames, seed.showNames),
    showPremise: boolOr(state.showPremise, seed.showPremise),
    showStatement: boolOr(state.showStatement, seed.showStatement),
    showHint: boolOr(state.showHint, seed.showHint),
    moves: numberOr(state.moves, 0),
    explored: boolOr(state.explored, false),
  };
}

/** Echo the fields Track.state saved and re-measure that picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Line, Circle, and Fixed Points state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Line, Circle, and Fixed Points position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const g = C.compute(s);
  const res = g ? C.residuals(g) : null;
  const onS = !!g && g.fixedError !== null && g.fixedError < TOL;
  const tangent = !!g && g.tangency !== null && g.tangency < TOL;
  const status = !g || !g.circleT
    ? "Move the points so the circle through P, Q and V meets the given circle again."
    : "R is where the two circles meet again; S is where VR returns to the given circle. "
      + (onS ? "VR goes through the fixed point S." : "VR is close to the fixed point S.")
      + " " + (tangent
        ? "The circle through P, Q and V' touches the given circle at P."
        : "The circle through P, Q and V' is almost tangent at P.");
  return {
    ...state,
    stateVersion,
    saved: { ...state },
    board: { width: C.WIDTH, height: C.HEIGHT },
    points: { P: pt(s.P), Q: pt(s.Q), V: pt(s.V), O: pt(s.O) },
    options: {
      showNames: s.showNames, showPremise: s.showPremise,
      showStatement: s.showStatement, showHint: s.showHint,
    },
    moves: s.moves,
    explored: s.explored,
    result: C.result(s),
    valid: !!g,
    geometry: g ? {
      R: pt(g.R), S: pt(g.S), Vprime: pt(g.T),
      fixedPoint: pt(g.Sfixed),
      givenCircle: circle(g.circleO),
      throughPQV: circle(g.circleX),
      throughPQVprime: circle(g.circleT),
    } : null,
    residuals: res ? {
      onCircleO: sig(res.onCircleO), onCircleX: sig(res.onCircleX),
      onCircleT: sig(res.onCircleT), vrCollinear: sig(res.vrCollinear),
      sptCollinear: sig(res.sptCollinear), tvqCollinear: sig(res.tvqCollinear),
      tangency: sig(res.tangency), fixedError: sig(res.fixedError),
    } : null,
    vrThroughFixedPoint: onS,
    tangentAtP: tangent,
    tolerance: TOL,
    status,
    note:
      "Track.state saved the four draggable points P, Q, V, O, the four display switches and the exploration bookkeeping (moves, explored). The core rebuilds R (the second circle crossing), S (where VR meets the given circle again) and V' = SP ∩ QV, then measures that S is the fixed point and that the circle through P, Q, V' is tangent to C(O) at P. This is an illustration with no win or loss; the tracker records exploration.",
  };
}
