/*
 * run_game_logic actions and saved-position reader for Angles In Circle.
 *
 * Two secants meet at A and cut the circle at B, C (the nearer pair) and D, E
 * (the farther pair). The angle at A is half the sum of the intercepted arcs
 * when A is inside the circle and half their difference when A is outside.
 * A tangent merges one near/far pair, and A on the circle merges the near pair
 * into A itself, so one arc is 0 and the outside rule becomes an inscribed
 * angle. Sliding a secant parallel to itself keeps its direction, so the angle
 * and the half-sum/half-difference are unchanged while the two arcs change by
 * equal and opposite amounts.
 *
 * Every measurement below comes from the game's real core
 * (angles-in-circle/angles-in-circle-core.js), copied into src/generated/cores/
 * at build time. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angles-in-circle"].AnglesInCircleCore as any;

type Point = { x: number; y: number };

/** Degrees to three decimals, and board coordinates to four. */
const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const r4 = (v: number): number => Math.round(v * 10000) / 10000;
const xy = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;

/** Accept both the page's saved {x, y} and the tutor's [x, y] arguments. */
function readPoint(v: unknown, label: string, fallback?: Point): Point {
  if (v === undefined || v === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    if (o.x === undefined || o.x === null || o.y === undefined || o.y === null) {
      throw new Error(`"${label}" needs both x and y`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${label}" needs finite x and y`);
  return { x, y };
}

/** Rebuild a core state. The page saves plain data; the core clamps points. */
function scene(args: Json): any {
  const C = core();
  const home = C.start({});
  const A = readPoint(args.A, "A", home.A);
  const B = readPoint(args.B, "B", home.B);
  const Cc = readPoint(args.C, "C", home.C);
  if (C.dist(A, B) < 1e-6 || C.dist(A, Cc) < 1e-6) {
    throw new Error("B and C must be away from A to define two secants");
  }
  const u = C.unit(A, B), v = C.unit(A, Cc);
  if (Math.abs(u.x * v.y - u.y * v.x) < 1e-9) {
    throw new Error("the two secants must be different lines through A");
  }
  return C.start({ A, B, C: Cc });
}

/** The reading the page prints, in degrees, with the theorem checked. */
function reading(s: any) {
  const C = core();
  const g = C.compute(s);
  const pointFields = {
    A: xy(s.A), B: xy(g.B), C: xy(g.C), D: xy(g.D), E: xy(g.E),
    center: xy(C.CENTER),
  };
  if (!g.valid) {
    return {
      valid: false,
      points: pointFields,
      note: "Both lines must cross the circle: move a handle until they do.",
    };
  }
  const angleDeg = C.deg(g.angle);
  const formulaDeg = C.deg(g.formula);
  const special = g.onCircle
    ? "A is on the circle: the near point on each secant is A itself, so arc BC is 0 and the outside rule gives the inscribed angle (half of arc DE)."
    : g.tangent
      ? "One secant is a tangent: its near and far cut points have merged into one point, so the two intercepted arcs are both measured from that point and the outside rule (half the difference) still gives the angle."
      : null;
  return {
    valid: true,
    where: g.onCircle ? "on the circle" : g.inside ? "inside" : "outside",
    rule: g.inside ? "half-sum" : "half-difference",
    inside: g.inside,
    onCircle: g.onCircle,
    tangent: g.tangent,
    angleDegrees: r3(angleDeg),
    arcBCDegrees: r3(C.deg(g.arcBC)),
    arcDEDegrees: r3(C.deg(g.arcDE)),
    formulaDegrees: r3(formulaDeg),
    agrees: Math.abs(g.angle - g.formula) < 1e-6,
    residualDegrees: r3(Math.abs(angleDeg - formulaDeg)),
    points: pointFields,
    special,
    note: C.describe(s),
  };
}

export function actions(): GameActions {
  return {
    secant_angles: {
      describe:
        "Given the meeting point A and one handle on each secant, B and C ([x, y] or {x, y} in the page's 360 x 240 board), report the angle at A, the intercepted arcs BC and DE in degrees, the four cut points, and check the theorem: A inside gives angle = (arc BC + arc DE)/2, while A outside, on the circle or with a tangent gives angle = |arc DE - arc BC|/2. With A on the circle one arc is 0 (an inscribed angle); with a tangent the two cut points of one secant merge into one point. Pass A, B, C for one picture, or a 'cases' array of such objects to compare several pictures, including tangents and A on the circle.",
      args: '{ "cases": [ { "label": "A outside", "A": [288, 120], "B": [150, 46], "C": [150, 194] }, { "label": "A inside", "A": [210, 120], "B": [150, 46], "C": [150, 194] }, { "label": "A on the circle", "A": [264, 120], "B": [150, 46], "C": [150, 194] }, { "label": "tangent", "A": [276, 120], "B": [250.8256082496518, 165.5], "C": [233.08254802469673, 90.63859138345816] } ] }',
      run: (args) => {
        if (Array.isArray(args.cases)) {
          if (args.cases.length === 0 || args.cases.length > 8) {
            throw new Error('"cases" must hold between 1 and 8 pictures');
          }
          return args.cases.map((v: unknown, i: number) => {
            if (!v || typeof v !== "object" || Array.isArray(v)) {
              throw new Error(`cases[${i}] must be an object with A, B and C`);
            }
            const c = v as Json;
            return { label: typeof c.label === "string" ? c.label : `case ${i + 1}`, ...reading(scene(c)) };
          });
        }
        return reading(scene(args));
      },
    },
    slide_parallel: {
      describe:
        "Slide one secant (which: 'B' or 'C') sideways by amount board units without turning it, and compare the angle and arcs before and after. The angle at A stays the same, so the half-sum when A is inside and the half-difference when A is outside stay the same too: the two intercepted arcs change by equal and opposite amounts.",
      args: '{ "A": [210, 120], "B": [150, 46], "C": [150, 194], "which": "C", "amount": 6 }',
      run: (args) => {
        const C = core();
        const which = args.which;
        if (which !== "B" && which !== "C") throw new Error('argument "which" must be "B" or "C"');
        const amount = num(args, "amount");
        const before = scene(args);
        const after = C.slide(before, which, amount);
        const b = reading(before), a = reading(after);
        const diff = (x: number | undefined, y: number | undefined) =>
          typeof x === "number" && typeof y === "number" ? r3(y - x) : null;
        return {
          which,
          amount,
          before: b,
          after: a,
          angleChangeDegrees: diff(b.angleDegrees, a.angleDegrees),
          arcBCChangeDegrees: diff(b.arcBCDegrees, a.arcBCDegrees),
          arcDEChangeDegrees: diff(b.arcDEDegrees, a.arcDEDegrees),
          ruleValueChangeDegrees: diff(b.formulaDegrees, a.formulaDegrees),
          angleUnchanged: b.valid && a.valid ? Math.abs(C.compute(before).angle - C.compute(after).angle) < 1e-9 : null,
          ruleUnchanged: b.valid && a.valid ? Math.abs(C.compute(before).formula - C.compute(after).formula) < 1e-9 : null,
          note: b.valid && a.valid
            ? `Sliding line ${which} by ${amount} moved the meeting point and changed arc BC by ${diff(b.arcBCDegrees, a.arcBCDegrees)}° and arc DE by ${diff(b.arcDEDegrees, a.arcDEDegrees)}°. The angle at A and the ${b.rule} still match.`
            : "One of the two pictures has a line that misses the circle, so there is no angle to compare.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const home = C.start({});
  const s = C.start({
    A: readPoint(state.A, "A", home.A),
    B: readPoint(state.B, "B", home.B),
    C: readPoint(state.C, "C", home.C),
    showNames: state.showNames !== false,
    showArcs: state.showArcs !== false,
    showAngles: state.showAngles !== false,
  });
  return {
    stateVersion,
    center: xy(readPoint(state.center, "center", home.center)),
    radius: num(state, "radius", home.radius),
    A: xy(s.A),
    B: xy(s.B),
    C: xy(s.C),
    showNames: s.showNames,
    showArcs: s.showArcs,
    showAngles: s.showAngles,
    reading: reading(s),
  };
}
