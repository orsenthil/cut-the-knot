/*
 * run_game_logic actions and saved-position reader for Envelopes in Ellipse.
 *
 * A ray leaves T1 on an elliptic mirror towards T2 and keeps reflecting. The
 * confocal constant R (reflect a focus in a chord and measure to the other
 * focus) says which conic the chords envelop: R > 2c an ellipse, R < 2c a
 * hyperbola, R = 2c a ray that alternates between the two foci. Every number
 * below comes from the game's real core, copied at build time from
 * envelopes-in-ellipse/ into src/generated/cores/. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["envelopes-in-ellipse"].EnvelopesInEllipseCore;

type Point = { x: number; y: number };

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const pt = (p: Point) => ({ x: round(p.x), y: round(p.y) });

/** The envelope's meaning, from the core's classification. */
function noteFor(kind: string, c: number, R: number, crossing: boolean): string {
  if (kind === "circle") return "The mirror is a circle: its two foci coincide at the centre, so there is no focal segment to cross.";
  if (kind === "focus") return "R equals 2c, so each piece passes through one focus and then the other: the boundary between the ellipse and hyperbola envelopes.";
  if (kind === "ellipse") return `R is greater than 2c and no chord crosses the focal segment, so every chord touches a confocal ellipse of semi-axis ${round(R / 2)}.`;
  if (kind === "hyperbola") return `R is less than 2c and the chord${crossing ? "s" : ""} cross the focal segment, so every chord touches a confocal hyperbola of semi-axis ${round(R / 2)}.`;
  return `With c = ${round(c)} and R = ${round(R)}, the pieces do not settle into one of the three cases; drag T1 or T2.`;
}

/** Build a ray with the core's own start(), validating the angles and mirror size. */
function rayFrom(C: ReturnType<typeof core>, args: Json) {
  const sAngle = args.sAngle === undefined ? undefined : num(args, "sAngle");
  const tAngle = args.tAngle === undefined ? undefined : num(args, "tAngle");
  const width = args.width === undefined ? undefined : num(args, "width");
  const height = args.height === undefined ? undefined : num(args, "height");
  if (width !== undefined && width < 4 * C.MIN_HALF) throw new Error(`width must be at least ${4 * C.MIN_HALF}`);
  if (height !== undefined && height < 4 * C.MIN_HALF) throw new Error(`height must be at least ${4 * C.MIN_HALF}`);
  return C.start({
    ...(sAngle === undefined ? {} : { sAngle }),
    ...(tAngle === undefined ? {} : { tAngle }),
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
  });
}

/** The invariant and crossing reading for each chord, using only core helpers. */
function chordsOf(C: ReturnType<typeof core>, s: ReturnType<typeof C.start>) {
  const g = C.geometry(s);
  return C.segments(s).map(([p, q], i: number) => ({
    index: i,
    from: pt(p), to: pt(q),
    constant: round(C.chordConstant(s, p, q)),
    crossesFocalSegment: C.crossesFoci(p, q, g.foci[0], g.foci[1]),
  }));
}

export function actions(): GameActions {
  return {
    trace: {
      describe:
        "Add `bounces` reflections to a ray in an elliptic mirror and report every chord: its confocal constant, whether it crosses the focal segment, and which conic the chords touch. Angles are in radians; T1 starts at -pi/4 and T2 at about -2.1. The constant R (one focus reflected in a chord, measured to the other) decides the envelope against twice the focal half-distance 2c.",
      args: '{ "sAngle": -0.7853981634, "tAngle": -2.1, "bounces": 6, "width": 400, "height": 300 }',
      run: (args) => {
        const C = core();
        const bounces = Math.max(0, Math.min(100, Math.trunc(num(args, "bounces", 6))));
        const start = rayFrom(C, args);
        const s = C.add(start, bounces);
        const g = C.geometry(s);
        const chords = chordsOf(C, s);
        return {
          mirror: {
            center: pt(g.ellipse.center),
            semiMajor: round(Math.abs(g.ellipse.a)),
            semiMinor: round(Math.abs(g.ellipse.b)),
          },
          foci: g.foci.map(pt),
          focalHalfDistance: round(g.c),
          twiceC: round(2 * g.c),
          bounces: g.bounces,
          envelope: g.kind,
          confocalConstant: round(g.constant),
          confocalSemiAxis: round(g.semiAxis),
          allChordsSameConstant: chords.every((ch) => Math.abs(ch.constant - g.constant) < 1e-6),
          crossesBetweenFoci: g.crossing,
          chords,
          status: C.status(s),
          note: noteFor(g.kind, g.c, g.constant, g.crossing),
        };
      },
    },
    focal_ray: {
      describe:
        "Aim T1's ray straight at focus `focus` (1 or 2), find the T2 angle with the core, add `bounces` reflections and report how the pieces keep passing from one focus to the other. R comes out exactly equal to 2c: the boundary between the ellipse (R > 2c) and hyperbola (R < 2c) envelopes.",
      args: '{ "focus": 1, "bounces": 6, "width": 400, "height": 300 }',
      run: (args) => {
        const C = core();
        const which = Math.trunc(num(args, "focus", 1));
        if (which !== 1 && which !== 2) throw new Error('focus must be 1 or 2');
        const bounces = Math.max(0, Math.min(100, Math.trunc(num(args, "bounces", 6))));
        const start = rayFrom(C, args);
        const e = C.ellipseOf(start.corners);
        const target = C.fociOf(e)[which - 1];
        const cuts = C.intersectEllipse(e, C.lineCoefs(start.S, target));
        if (!cuts) throw new Error("the focal line does not cut the ellipse");
        const cut = cuts.find((p: Point) => Math.hypot(p.x - start.S.x, p.y - start.S.y) > 1);
        if (!cut) throw new Error("could not place T2 on the focal line");
        const tAngle = Math.atan2((cut.y - e.center.y) / e.b, (cut.x - e.center.x) / e.a);
        const sAngle = Math.atan2((start.S.y - e.center.y) / e.b, (start.S.x - e.center.x) / e.a);
        // Rebuild the ray from its two angles, then add the reflections. Going
        // through setRayPoint here would snap a cut near the left vertex onto
        // that vertex (the applet's KeepOnEllipse rounding), losing the focus.
        const s = C.add(C.start({
          sAngle, tAngle, width: start.width, height: start.height,
        }), bounces);
        const g = C.geometry(s);
        const pieces = C.segments(s).map(([p, q], i: number) => {
          const line = C.lineCoefs(p, q);
          const norm = Math.hypot(line[0], line[1]) || 1;
          const d1 = Math.abs(line[0] * g.foci[0].x + line[1] * g.foci[0].y + line[2]) / norm;
          const d2 = Math.abs(line[0] * g.foci[1].x + line[1] * g.foci[1].y + line[2]) / norm;
          return {
            index: i,
            towards: pt(q),
            passesNearFocus: d1 <= d2 ? 1 : 2,
            distanceToThatFocus: round(Math.min(d1, d2)),
            constant: round(C.chordConstant(s, p, q)),
          };
        });
        return {
          aimedAtFocus: which,
          t2Angle: round(tAngle),
          foci: g.foci.map(pt),
          focalHalfDistance: round(g.c),
          twiceC: round(2 * g.c),
          confocalConstant: round(g.constant),
          equalsTwiceC: Math.abs(g.constant - 2 * g.c) < 1e-6,
          envelope: g.kind,
          bounces: g.bounces,
          pieces,
          status: C.status(s),
          note: `The first chord goes through focus ${which}; later pieces pass near the two foci alternately and their endpoints settle at the ends of the major axis. R = 2c exactly, so this ray is the boundary between the ellipse and hyperbola envelopes.`,
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  // The page saves the core's whole state, so replay it as the core sees it.
  const here = state as unknown as ReturnType<typeof C.start>;
  const g = C.geometry(here);
  return {
    stateVersion,
    width: here.width,
    height: here.height,
    corners: here.corners.map(pt),
    S: pt(here.S),
    T: pt(here.T),
    showNames: here.showNames === true,
    showExtended: here.showExtended === true,
    showReflection: here.showReflection === true,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
    result: C.result(here),
    mirror: {
      center: pt(g.ellipse.center),
      semiMajor: round(Math.abs(g.ellipse.a)),
      semiMinor: round(Math.abs(g.ellipse.b)),
    },
    foci: g.foci.map(pt),
    focalHalfDistance: round(g.c),
    twiceC: round(2 * g.c),
    bounces: g.bounces,
    envelope: g.kind,
    confocalConstant: round(g.constant),
    confocalSemiAxis: round(g.semiAxis),
    crossesBetweenFoci: g.crossing,
    chords: chordsOf(C, here),
    status: C.status(here),
    note: noteFor(g.kind, g.c, g.constant, g.crossing),
  };
}
