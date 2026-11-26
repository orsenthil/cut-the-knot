/*
 * run_game_logic actions and saved-position reader for Angle Between Tangent
 * And Chord (Bogomolny's AngleBetweenTangentAndChord applet).
 *
 * From an outside point C the two tangents touch a circle at A and B. The
 * incenter I of triangle ABC lies on that circle, at I' = the midpoint of the
 * small arc AB: the tangent-chord angle equals the inscribed angle standing on
 * the same chord in the alternate segment, so the four marked angles
 * CAI', I'AB, ABI', I'BC are all half the small arc AB, and AI' and BI' are the
 * angle bisectors at A and B. The 1896 Ibaragi sangaku is the statement.
 *
 * Every number below comes from the game's real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 * Coordinates are board units from the page's 360 x 240 viewBox, with y down.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angle-between-tangent-and-chord"].AngleBetweenTangentAndChordCore;

type Point = { x: number; y: number };

const TOL = 1e-6; // residuals are floating-point noise; the real equalities are exact
const round = (v: number, digits = 4): number => Number(v.toFixed(digits));
const deg = (radians: number): number => round(radians * 180 / Math.PI, 3);
const pt = (p: Point): Point => ({ x: round(p.x, 2), y: round(p.y, 2) });
const tiny = (v: number): number => Number(v.toExponential(2));

/** Tool arguments use [x, y]; a saved position from the page uses { x, y }. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be a point [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite x and y`);
  }
  return { x, y };
}

/** Optional boolean switch, defaulting to the value in start(). */
function flag(source: Json, key: string, fallback: boolean): boolean {
  const v = source[key];
  if (v === undefined) return fallback;
  if (typeof v !== "boolean") throw new Error(`"${key}" must be true or false`);
  return v;
}

/**
 * Assemble a core position from O, R and C. R is the radius point (the page's
 * draggable handle); a numeric "radius" may be given instead, placing R to the
 * left of O as in the opening picture. Missing points fall back to start().
 */
function makeState(source: Json, defaults: Json) {
  const C = core();
  const O = source.O === undefined ? readPoint(defaults.O, "O") : readPoint(source.O, "O");
  const centre = C.clampPoint(O);
  let R: Point;
  if (source.radius !== undefined && source.R === undefined) {
    const radius = num(source, "radius");
    if (radius < C.MIN_RADIUS) {
      throw new Error(`"radius" must be at least ${C.MIN_RADIUS} board units (the page keeps the handle usable)`);
    }
    const wanted = C.clampPoint({ x: centre.x - radius, y: centre.y });
    if (!Number.isFinite(C.dist(centre, wanted)) || Math.abs(C.dist(centre, wanted) - radius) > TOL) {
      throw new Error(`"radius" ${radius} would put R off the ${C.WIDTH}x${C.HEIGHT} board; give R as a point instead`);
    }
    R = wanted;
  } else {
    R = source.R === undefined ? readPoint(defaults.R, "R") : readPoint(source.R, "R");
  }
  const outside = source.C === undefined ? readPoint(defaults.C, "C") : readPoint(source.C, "C");
  const state = C.start({
    O, R, C: outside,
    showNames: flag(source, "showNames", defaults.showNames === true),
    showStatement: flag(source, "showStatement", defaults.showStatement === true),
    showHint: flag(source, "showHint", defaults.showHint === true),
  });
  if (source.moves !== undefined) state.moves = num(source, "moves", 0);
  if (source.explored !== undefined) state.explored = flag(source, "explored", false);
  return state;
}

/** refuse the degenerate cases the page cannot draw (C at or inside the circle). */
function geometry(state: any) {
  const C = core();
  const g = C.compute(state);
  if (!g.valid) {
    if (g.reason === "outside") {
      const d = C.dist(state.O, state.C), r = C.dist(state.O, state.R);
      throw new Error(
        `C must lie outside the circle with a little room: distance OC = ${round(d, 3)} but radius = ${round(r, 3)}. ` +
        "GetTangents needs d > r + 0.1.",
      );
    }
    throw new Error("O, R and C do not make a drawable circle and outside point");
  }
  return g;
}

/** The drawn figure: circle, tangency points, incenter, angles, inradii. */
function reading(g: any) {
  const C = core();
  const angles = {
    // CAI: tangent CA with chord AI'; IAB: chord AI' with chord AB;
    // ABI: inscribed angle on arc AI'; IBC: chord BI' with tangent BC.
    CAI: deg(g.angles.CAI), IAB: deg(g.angles.IAB),
    ABI: deg(g.angles.ABI), IBC: deg(g.angles.IBC),
  };
  const res = C.residuals(g) as Record<string, number>;
  const ratio = g.inradius > 0 ? g.shownInradius / g.inradius : null;
  return {
    circle: { center: pt(g.O), radius: round(g.r, 2), radiusPoint: pt(g.R) },
    outsidePoint: pt(g.C), centreToC: round(g.d, 2),
    tangency: {
      A: pt(g.A), B: pt(g.B), chordMidpoint: pt(g.M),
      tangentLengths: { CA: round(C.dist(g.C, g.A), 2), CB: round(C.dist(g.C, g.B), 2) },
    },
    incenter: pt(g.I), arcMidpointIprime: pt(g.Ip),
    anglesDegrees: angles,
    halfArcDegrees: deg(g.halfArc),
    inradius: {
      trueInradius: round(g.inradius, 2),
      shownByApplet: round(g.shownInradius, 2),
      ratio: ratio === null ? null : round(ratio, 6),
    },
    incenterOnCircle: res.IOnCircle < TOL,
    atSmallArcMidpoint: res.IAtArcMid < TOL && res.arcsEqual < TOL,
    allFourAnglesEqual: res.fourAngles < TOL,
    note:
      "The two tangents touch at A and B; I is the incenter of ABC and lies on the circle at I', the midpoint of the small arc AB. " +
      "The four angles CAI', I'AB, ABI', I'BC are each half the small arc AB, so AI' and BI' bisect the angles at A and B. " +
      "Quirk of the original applet: GetIncircle measures the first distance from I to the line II' (zero), then averages three distances, so it draws a circle of radius 2/3 of the true inradius; the true inradius is reported separately above.",
  };
}

/** The measured equalities behind the sangaku, with their residuals. */
function checks(g: any) {
  const C = core();
  const res = C.residuals(g) as Record<string, number>;
  const angles = {
    CAI: deg(g.angles.CAI), IAB: deg(g.angles.IAB),
    ABI: deg(g.angles.ABI), IBC: deg(g.angles.IBC),
  };
  const residuals = Object.fromEntries(Object.entries(res).map(([k, v]) => [k, tiny(v)]));
  return {
    fourAnglesDegrees: angles,
    halfArcDegrees: deg(g.halfArc),
    tangentChordEqualsInscribed: {
      onChordAIprime: { tangentAngleCAI: angles.CAI, inscribedAngleABI: angles.ABI },
      onChordBIprime: { tangentAngleIBC: angles.IBC, inscribedAngleIAB: angles.IAB },
      residual: tiny(res.alternate),
      holds: res.alternate < TOL,
    },
    allFourEqual: { residual: tiny(res.fourAngles), holds: res.fourAngles < TOL },
    eachIsHalfArc: { residual: tiny(res.halfArc), holds: res.halfArc < TOL },
    bisectorsAtAandB: { residual: tiny(res.bisectors), holds: res.bisectors < TOL },
    incenterOnCircle: { residual: tiny(res.IOnCircle), holds: res.IOnCircle < TOL },
    incenterAtArcMidpoint: {
      distanceToIprime: tiny(res.IAtArcMid), arcsResidual: tiny(res.arcsEqual),
      holds: res.IAtArcMid < TOL && res.arcsEqual < TOL,
    },
    tangentsFromC: {
      tangentResidual: tiny(res.tangent), equalLengthsResidual: tiny(res.tangentLengths),
      holds: res.tangent < TOL && res.tangentLengths < TOL,
    },
    residuals,
    note:
      "A tangent-chord angle equals the inscribed angle on the same chord in the alternate segment: angle CAI' = angle ABI' and angle IBC = angle IAB. All four equal half the small arc AB, hence AI' and BI' are bisectors and I' is the incenter. " +
      "The applet's drawn incircle is deliberately 2/3 of the true incircle radius (its first distance-to-line term is zero), but that quirk does not affect any of these angles.",
  };
}

export function actions(): GameActions {
  const defaults = core().start() as Json;
  return {
    figure: {
      describe:
        "Build the tangent-and-chord picture from a circle centre O, a radius point R on the circle (or a numeric radius), and an outside point C; points are board units in the page's 360 x 240 viewBox with y down, and may be [x, y] or {x, y}. Report the circle, the tangency points A and B, the incenter I, the small-arc midpoint I', the four marked angles in degrees and both inradii. Omit any point for the opening picture. C must be outside the circle.",
      args: '{ "O": [120, 160], "R": [60, 160], "C": [300, 80] }',
      run: (args) => reading(geometry(makeState(args, defaults))),
    },
    alternate_segment: {
      describe:
        "For the same circle and outside point C, verify the sangaku's angle facts with the real core: the tangent-chord angle equals the inscribed angle in the alternate segment (CAI' = ABI' and IBC = IAB), all four marked angles equal half the small arc AB, AI' and BI' are bisectors, and I lies on the circle at the arc midpoint. Each equality comes with a measured residual. Accepts O, R (or radius) and C as in figure.",
      args: '{ "O": [123, 160], "radius": 63, "C": [300, 80] }',
      run: (args) => checks(geometry(makeState(args, defaults))),
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Angle Between Tangent And Chord state version ${stateVersion}`);
  }
  const C = core();
  const defaults = C.start() as Json;
  const s = makeState(state, defaults);
  const saved = {
    O: pt(s.O), R: pt(s.R), C: pt(s.C),
    showNames: s.showNames, showStatement: s.showStatement, showHint: s.showHint,
    moves: s.moves, explored: s.explored,
  };
  const g = C.compute(s);
  if (!g.valid) {
    return {
      stateVersion, ...saved, valid: false, reason: g.reason,
      radius: round(C.dist(s.O, s.R), 2), centreToC: round(C.dist(s.O, s.C), 2),
      note: "C is not outside the circle, so the two tangents and the incenter cannot be drawn.",
    };
  }
  return {
    stateVersion, ...saved, valid: true,
    reading: reading(g), checks: checks(g),
  };
}
