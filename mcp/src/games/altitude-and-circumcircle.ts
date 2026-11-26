/*
 * run_game_logic actions and saved-position reader for Altitude And Circumcircle.
 * The core lives in altitude-and-circumcircle/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 *
 * The theorem: for triangle ABC, drop the altitudes to Ha, Hb, Hc, let H be
 * their meeting point (the orthocenter), and reflect H in each side to get
 * Ka = 2Ha - H, Kb, Kc. Those three points lie on the circumcircle of ABC,
 * and each foot is the midpoint of H and its reflection. Everything below is
 * measured by the real core, so obtuse triangles (H outside the circle) are
 * checked the same way as acute ones.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["altitude-and-circumcircle"].AltitudeAndCircumcircleCore;
type C = ReturnType<typeof core>;
type Point = { x: number; y: number };

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const pt = (p: Point) => ({ x: r3(p.x), y: r3(p.y) });
/** Residuals are tiny; keep their size instead of rounding them to zero. */
const sig = (v: number) => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);

/** A corner may arrive as the page saves it ({x,y}) or as a short [x,y] pair. */
function pointArg(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or {x, y}`);
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${key}" is not a finite point`);
    return { x, y };
  }
  if (typeof raw !== "object") throw new Error(`argument "${key}" must be [x, y] or {x, y}`);
  const o = raw as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

/** The real core's start(), with validated corners and the page's four flags. */
function readPosition(Core: C, args: Json) {
  const seed = Core.start({});
  const s = Core.start({
    A: pointArg(args, "A", seed.A),
    B: pointArg(args, "B", seed.B),
    C: pointArg(args, "C", seed.C),
    showNames: args.showNames !== false,
    showHint: args.showHint === true,
    showAltitudes: args.showAltitudes === true,
    showCircle: args.showCircle === true,
  });
  // start() sets only the geometry and the four flags; the page's record fields
  // are saved separately and matter to result(), so keep them here too.
  return {
    ...s,
    moves: Math.round(num(args, "moves", s.moves)),
    explored: args.explored === true,
  };
}

function geometry(args: Json) {
  const Core = core();
  const s = readPosition(Core, args);
  const g = Core.compute(s) as any;
  if (g.degenerate) {
    throw new Error("A, B and C must be three distinct, non-collinear points on the 360 x 240 board");
  }
  return { Core, s, g };
}

/** Angles in degrees and the shape the orthocenter reveals. */
function triangleShape(Core: C, s: any) {
  const anglesDegrees = {
    atA: r3(Core.angleAt(s.A, s.B, s.C) * 180 / Math.PI),
    atB: r3(Core.angleAt(s.B, s.A, s.C) * 180 / Math.PI),
    atC: r3(Core.angleAt(s.C, s.A, s.B) * 180 / Math.PI),
  };
  const largest = Math.max(anglesDegrees.atA, anglesDegrees.atB, anglesDegrees.atC);
  const kind = largest > 90.001 ? "obtuse" : largest > 89.999 ? "right" : "acute";
  return { anglesDegrees, kind };
}

const circleInfo = (c: any) => (c ? { center: pt(c.center), radius: r3(c.radius) } : null);

/** The core's own residuals, in the order the page's claims are made. */
function checks(Core: C, s: any, g: any) {
  const q = Core.residuals(s, g);
  if (!q) return null;
  return {
    altitudesFootPerpendicular: sig(q.altitude),
    altitudesMeetAtH: sig(q.collinearH),
    footIsMidpointOfHAndReflection: sig(q.bisected),
    reflectionsOnCircumcircle: sig(q.concyclic),
    reflectionsAreSecondAltitudeMeetings: sig(q.secondPoint),
    auxiliaryCirclesEqualRadius: sig(q.equalCircles),
    SOnCircleHBC: sig(q.SOnCircleHBC),
    allChecksWithinTolerance:
      q.altitude < 1e-6 && q.collinearH < 1e-6 && q.bisected < 1e-6 &&
      q.concyclic < 1e-6 && q.secondPoint < 1e-6,
  };
}

function reading(Core: C, s: any, g: any) {
  const dOH = Core.dist(g.O, g.H) - g.r;
  return {
    ...triangleShape(Core, s),
    orthocenter: pt(g.H),
    orthocenterRelativeToCircumcircle: dOH > 1e-6 ? "outside" : dOH < -1e-6 ? "inside" : "on the circle",
    circumcircle: circleInfo(g.circle),
    feet: { Ha: pt(g.feet.a), Hb: pt(g.feet.b), Hc: pt(g.feet.c) },
    reflectionsOfHInSides: { Ka: pt(g.refs.a), Kb: pt(g.refs.b), Kc: pt(g.refs.c) },
    S: pt(g.S),
    extraCircleHBC: circleInfo(g.circleHBC),
    checks: checks(Core, s, g),
  };
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For a triangle with corners A, B, C (each {x,y} or [x,y] on the page's 360 x 240 board), report the orthocenter H, the circumcircle, the three altitude feet and the three reflections of H in the sides. Checks that each reflection lies on the circumcircle, each foot bisects H and its reflection, and the altitudes meet at H; the same checks work for obtuse triangles, where H sits outside the circle. Points outside the board are clamped to it, as the page does.",
      args: '{ "A": [180, 48], "B": [108, 192], "C": [252, 192] }',
      run: (args) => {
        const { Core, s, g } = geometry(args);
        return {
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          ...reading(Core, s, g),
          distancesFromCircumcircle: {
            Ka: r3(Core.dist(g.O, g.refs.a) - g.r),
            Kb: r3(Core.dist(g.O, g.refs.b) - g.r),
            Kc: r3(Core.dist(g.O, g.refs.c) - g.r),
          },
          note:
            "Ka, Kb and Kc are 2*Ha - H, 2*Hb - H and 2*Hc - H. The residuals are the largest errors in the perpendicular feet, the meeting of the altitudes, the midpoints, and the three circle memberships; they are effectively zero for every non-degenerate triangle, including obtuse ones.",
        };
      },
    },
    extra_circle: {
      describe:
        "For a triangle A, B, C, report the circle through H, B and C (the circumcircle reflected in side BC) and S, the reflection of A in the foot Ha. Checks that S lies on that circle, that it has the same radius as the circumcircle, and that the circles through H and any two corners do too. In a right triangle with the right angle at B or C two of those circles collapse to a line, so their radii are reported as null. Try an obtuse triangle: H then lies outside ABC and the reflected circle is still the same size.",
      args: '{ "A": [180, 170], "B": [60, 60], "C": [300, 60] }',
      run: (args) => {
        const { Core, s, g } = geometry(args);
        const extra = g.circleHBC;
        return {
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          triangleKind: triangleShape(Core, s).kind,
          orthocenter: pt(g.H),
          footHa: pt(g.feet.a),
          S: pt(g.S),
          extraCircleHBC: circleInfo(extra),
          SOnExtraCircleDistance: extra ? r3(Core.dist(extra.center, g.S) - extra.radius) : null,
          radii: {
            ABC: r3(g.r),
            ABH: g.circles.ABH ? r3(g.circles.ABH.radius) : null,
            BCH: g.circles.BCH ? r3(g.circles.BCH.radius) : null,
            CAH: g.circles.CAH ? r3(g.circles.CAH.radius) : null,
            HBC: extra ? r3(extra.radius) : null,
          },
          note:
            "Reflecting the circumcircle in BC takes A to S and keeps its radius, so S lies on the circle through H, B and C. The circle through H and any two corners is the reflection of the circumcircle in the remaining side, hence all these circles have the same radius.",
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const Core = core();
  const s = readPosition(Core, state);
  const g = Core.compute(s) as any;
  const saved = {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    showNames: s.showNames,
    showHint: s.showHint,
    showAltitudes: s.showAltitudes,
    showCircle: s.showCircle,
    moves: Math.round(num(state, "moves", s.moves)),
    explored: state.explored === true,
  };
  if (g.degenerate) {
    return {
      ...saved,
      degenerate: true,
      note: "The saved corners are collinear or too close together, so there is no triangle to measure. Move a corner apart on the page.",
    };
  }
  return {
    ...saved,
    degenerate: false,
    ...reading(Core, s, g),
    result: Core.result(s),
    note:
      "The saved triangle is measured with the same construction the page draws: altitudes, orthocenter, reflections of H in the sides, and their distances from the circumcircle. The residuals show how closely the reflected points lie on that circle.",
  };
}
