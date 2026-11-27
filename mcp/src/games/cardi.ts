/*
 * run_game_logic actions and saved-position reader for Cardi.
 *
 * A circle of radius r rolls without slipping round the outside of an equal
 * fixed circle. A rim mark M, starting at the cusp A, traces the cardioid
 *
 *     M = O + 2r(cos t, sin t) - r(cos 2t, sin 2t),
 *
 * where t is the angle AOT through which the rolling centre has travelled:
 * the mark has turned through 2t about the moving centre P. Every point and
 * every check below comes from the game's real core (cardi/cardi-core.js),
 * copied into src/generated/cores/ at build time. See _shared.ts for the
 * shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cardi"].CardiCore;
type Core = ReturnType<typeof core>;
type Pt = { x: number; y: number };

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const pt = (p: Pt) => ({ x: round(p.x), y: round(p.y) });
const near = (a: number, b: number) => Math.abs(a - b) < 1e-7;

/** The generating radius; the fixed circle has the same radius (as in the applet). */
function radiusOf(args: Json, C: Core): number {
  const r = num({ r: args.radius ?? args.r }, "r", C.R_MOVING);
  if (!(r > 0)) throw new Error("radius must be positive");
  if (r > 1e6) throw new Error("radius must be at most 1000000");
  return r;
}

/** The roll angle t, given in degrees, folded into [0, 2*pi) by the core. */
function thetaOf(tDegrees: number, C: Core): number {
  return C.norm((tDegrees * Math.PI) / 180);
}

/** The labelled points of one instant, all built with the core's own primitives. */
function picture(C: Core, radius: number, theta: number) {
  const O: Pt = C.O;
  const A = C.point(O.x + radius, O.y); // the cusp, where M starts
  const P = C.onCircle(O, 2 * radius, theta); // centre of the rolling circle
  const T = C.onCircle(O, radius, theta); // contact, the midpoint of OP
  const M = C.formulaPoint(theta, O, radius, radius, 1);
  const N = C.formulaPoint(theta + Math.PI, O, radius, radius, 1); // far end of the chord
  const Q = C.add(O, C.sub(M, P)); // OQ is equal and parallel to PM
  const foot = C.midpoint(A, M); // the pedal point, where the tangent meets AM
  const tangent = C.tangent({ O, P, T, radius: 2 * radius });
  return { O, A, P, T, M, N, Q, foot, tangent };
}

export function actions(): GameActions {
  return {
    point_and_tangent: {
      describe:
        "For a generating radius r and a roll angle t in degrees, report the cardioid point M, the rolling centre P, the contact T, the common tangent at T and the pedal foot. Checks that M lies on the rolling circle, that T is the midpoint of OP, that TA = TM, that the tangent is the perpendicular bisector of AM, and that its crossing with AM is the midpoint of AM.",
      args: '{ "radius": 30, "t": 60 }',
      run: (args) => {
        const C = core();
        const radius = radiusOf(args, C);
        const tDegrees = num(args, "t", 60);
        const theta = thetaOf(tDegrees, C);
        const v = picture(C, radius, theta);
        const u = C.mul(C.sub(v.P, v.O), 1 / (2 * radius)); // unit normal to the tangent at T
        const mirror = C.sub(v.A, C.mul(u, 2 * C.dot(C.sub(v.A, v.T), u)));
        const onLine = C.add(v.T, C.mul(v.tangent.direction, C.dot(C.sub(v.foot, v.T), v.tangent.direction)));
        return {
          radius,
          tDegrees: round(tDegrees),
          thetaRadians: round(theta),
          points: {
            O: pt(v.O), A: pt(v.A), T: pt(v.T), P: pt(v.P), M: pt(v.M), foot: pt(v.foot), Q: pt(v.Q),
          },
          tangent: {
            through: pt(v.T),
            direction: pt(v.tangent.direction),
            secondPoint: pt(v.tangent.along(200)),
          },
          distances: {
            PM: round(C.dist(v.P, v.M)),
            TA: round(C.dist(v.T, v.A)),
            TM: round(C.dist(v.T, v.M)),
            AM: round(C.dist(v.A, v.M)),
          },
          checks: {
            markOnRollingCircle: near(C.dist(v.P, v.M), radius),
            contactIsMidpointOfCentres: near(C.dist(v.O, v.T), radius) && near(C.dist(v.P, v.T), radius)
              && near(C.dist(C.midpoint(v.O, v.P), v.T), 0),
            tangentPerpendicularToOP: near(C.dot(v.tangent.direction, C.sub(v.P, v.O)), 0),
            tangentBisectsAM: near(C.dist(v.T, v.A), C.dist(v.T, v.M)),
            reflectionOfAIsM: near(C.dist(mirror, v.M), 0),
            footOnTangent: near(C.dist(onLine, v.foot), 0),
            footIsMidpointOfAM: near(C.dist(v.foot, C.midpoint(v.A, v.M)), 0),
          },
          note: `After a roll of ${round(tDegrees)} degrees the mark has turned ${round(2 * tDegrees)} degrees about P. The common tangent at T is the mirror line of A and M; its crossing with AM is the midpoint of AM, the foot of the perpendicular from A to the tangent.`,
        };
      },
    },

    chord_through_cusp: {
      describe:
        "For a generating radius r and a roll angle t in degrees, report the cardioid points M and N on the chord through the cusp A, its length and the two halves AM and AN. Checks that MN = 4r, that A is between M and N with AM = 2r(1-cos t) and AN = 2r(1+cos t), and that the midpoint of MN lies on the fixed circle. Pass 'tValues' (an array of degrees) to check the same chord at several angles; the applet's own page claims at this angle are reported too.",
      args: '{ "radius": 30, "t": 60, "tValues": [0, 30, 60, 90, 120] }',
      run: (args) => {
        const C = core();
        const radius = radiusOf(args, C);
        const tDegrees = num(args, "t", 60);
        const theta = thetaOf(tDegrees, C);
        const v = picture(C, radius, theta);
        const am = C.dist(v.A, v.M), an = C.dist(v.A, v.N);
        const cross = (v.M.x - v.A.x) * (v.N.y - v.A.y) - (v.M.y - v.A.y) * (v.N.x - v.A.x);
        const angles = Array.isArray(args.tValues) ? args.tValues : [tDegrees];
        if (angles.length > 50) throw new Error("tValues must have at most 50 entries");
        const sweep = angles.map((value) => {
          const t = num({ t: value }, "t");
          const g = picture(C, radius, thetaOf(t, C));
          const length = C.dist(g.M, g.N);
          return { tDegrees: round(t), chordLength: round(length), expected4r: 4 * radius, equals4r: near(length, 4 * radius) };
        });
        return {
          radius,
          tDegrees: round(tDegrees),
          points: { A: pt(v.A), M: pt(v.M), N: pt(v.N), midpoint: pt(C.midpoint(v.M, v.N)) },
          halfLengths: { AM: round(am), AN: round(an), expectedAM: round(2 * radius * (1 - Math.cos(theta))), expectedAN: round(2 * radius * (1 + Math.cos(theta))) },
          chordLength: round(C.dist(v.M, v.N)),
          fourR: 4 * radius,
          ratioTo4r: round(C.dist(v.M, v.N) / (4 * radius)),
          checks: {
            chordIsFourR: near(C.dist(v.M, v.N), 4 * radius),
            cuspOnChord: near(cross, 0),
            cuspBetweenMAndN: C.dot(C.sub(v.A, v.M), C.sub(v.A, v.N)) <= 0,
            halvesAddTo4r: near(am + an, 4 * radius) && near(am, 2 * radius * (1 - Math.cos(theta))) && near(an, 2 * radius * (1 + Math.cos(theta))),
            midpointOnFixedCircle: near(C.dist(C.midpoint(v.M, v.N), v.O), radius),
            appletClaimsAtThisAngle: C.claims(C.start({ theta })),
          },
          sweep,
          note: `The chord MN through the cusp is always 4r = ${4 * radius} long, whatever t: A lies between M and N, splitting it into 2r(1 - cos t) = ${round(2 * radius * (1 - Math.cos(theta)))} and 2r(1 + cos t) = ${round(2 * radius * (1 + Math.cos(theta)))}. Its midpoint runs on the fixed circle.`,
        };
      },
    },
  };
}

/** What the core says about the illustration the player last saved. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const mode = C.MODES.includes(String(state.mode)) ? String(state.mode) : "cross";
  // start() always opens unexplored: restore the saved flag so result() agrees.
  const here = {
    ...C.start({
      theta: num(state, "theta", C.START_ANGLE),
      mode,
      construction: state.construction === true,
    }),
    explored: state.explored === true,
  };
  const g = C.geometry(here);
  const checks = C.claims(here);
  const length = C.dist(g.M, g.N);
  return {
    stateVersion,
    tDegrees: round(g.theta * C.DEG),
    thetaRadians: round(g.theta),
    mode: here.mode,
    construction: here.construction,
    explored: here.explored,
    points: {
      O: pt(g.O), A: pt(g.A), T: pt(g.T), P: pt(g.P), M: pt(g.M), N: pt(g.N), foot: pt(g.foot),
    },
    tangentDirection: pt(C.tangent(g).direction),
    chordLength: round(length),
    fourR: 4 * g.r,
    chordIsFourR: checks.chordThroughCuspIs4r,
    checks,
    result: C.result(here),
    note: C.describe(here),
  };
}
