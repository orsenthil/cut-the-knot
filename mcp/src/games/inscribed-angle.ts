/*
 * run_game_logic actions and saved-position reader for Inscribed Angle.
 *
 * All numbers come from the game's real core (inscribed-angle/ in the site),
 * copied into src/generated/cores/ at build time. The core measures the arc BC
 * that does not contain A: the inscribed angle at A is half that arc's central
 * angle, the applet splits the central at A′ once the arc passes a semicircle,
 * and a collapsed chord becomes the tangent whose chord angle is the same
 * half-angle limit. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["inscribed-angle"].InscribedAngleCore;

type Point = { x: number; y: number };
type State = ReturnType<ReturnType<typeof core>["start"]>;

/**
 * A point may be given as {x, y} or as an angle in degrees around the centre
 * (the core's y-down convention: 90° is below O, 180° left, 270° above).
 */
function readPoint(value: unknown, label: string, fallback: Point): Point {
  const C = core();
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(n))) {
    return C.pointOnCircle(C.CIRCLE, n * Math.PI / 180);
  }
  const p = value as Json;
  if (!p || typeof p !== "object" || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
    throw new Error(`${label} must be a point {x, y} or an angle in degrees`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

function readWhich(args: Json, key: string): "B" | "C" {
  const v = args[key];
  if (v === undefined || v === null) return "C";
  const s = String(v).toUpperCase();
  if (s !== "B" && s !== "C") throw new Error(`${key} must be "B" or "C"`);
  return s;
}

/** Build a core state from three points, defaulting to the opening picture. */
function makeState(args: Json): State {
  const C = core();
  const base = C.start({});
  return {
    ...base,
    A: readPoint(args.A, "A", base.A),
    B: readPoint(args.B, "B", base.B),
    C: readPoint(args.C, "C", base.C),
    names: args.names === undefined ? base.names : !!args.names,
    explored: !!args.explored,
  };
}

/** Every reading the core can make of one three-point picture. */
function reading(state: State) {
  const C = core();
  const g = C.geometry(state);
  const deg = (t: number) => t * C.DEG;

  // The page's cyclic-quadrilateral claim, corrected: A and its antipode A′
  // see chord BC under supplementary angles only when the chord separates
  // them; when they lie on the same arc of BC the angles are equal instead.
  const tB = C.angleOf(g.B, C.CIRCLE);
  const tC = C.angleOf(g.C, C.CIRCLE);
  const arcBC = C.ccw(tB, tC);
  const aOn = C.ccw(tB, C.angleOf(g.A, C.CIRCLE)) <= arcBC;
  const apOn = C.ccw(tB, C.angleOf(g.Ap, C.CIRCLE)) <= arcBC;
  const degenerate = C.dist(g.A, g.B) < C.HIT || C.dist(g.A, g.C) < C.HIT
    || C.dist(g.Ap, g.B) < C.HIT || C.dist(g.Ap, g.C) < C.HIT
    || C.dist(g.B, g.C) < C.HIT;
  const angleAtApDeg = degenerate ? null : deg(C.angle(g.Ap, g.B, g.C));
  const relation = degenerate ? null : (aOn !== apOn ? "supplementary" : "equal");
  const cyclic = degenerate ? null : {
    angleAtADeg: deg(g.inscribed),
    angleAtApDeg,
    relation,
    chordSeparatesThem: aOn !== apOn,
    sumDeg: aOn !== apOn ? deg(g.inscribed) + (angleAtApDeg ?? 0) : null,
    differenceDeg: aOn === apOn ? Math.abs(deg(g.inscribed) - (angleAtApDeg ?? 0)) : null,
  };

  const tangent = g.tangent ? {
    vanished: g.mode === "tangentC" ? "B" : "C",
    chord: g.mode === "tangentC" ? "AC" : "AB",
    chordPoint: g.tangent.chordPoint,
    centralDeg: deg(g.tangent.central),
    markedDeg: deg(g.tangent.marked),
    acuteDeg: deg(g.tangent.acute),
    halfCentralDeg: deg(g.tangent.central) / 2,
    acuteIsHalfCentral: Math.abs(g.tangent.acute - g.tangent.central / 2) < 1e-9,
    chosenRay: g.tangent.chosen,
    mirrorRay: g.tangent.T2,
  } : null;

  let note: string;
  if (tangent) {
    note = `A chord has collapsed onto A: the tangent at A meets the surviving chord ${tangent.chord} at ${tangent.acuteDeg.toFixed(2)}°, exactly half the ${tangent.centralDeg.toFixed(2)}° central angle over that chord. The applet marks the ${tangent.markedDeg.toFixed(2)}° ray its orientation picks (sometimes the supplement). Use tangent_limit to explore this case.`;
  } else {
    const cyclicNote = cyclic === null
      ? "Two of the drawn points are too close to measure the angle at A′."
      : relation === "supplementary"
        ? "A and A′ lie on opposite arcs of BC, so their angles add to 180°."
        : "A and A′ lie on the same arc of BC, so their angles are equal, not supplementary.";
    note = `∠BAC = ${deg(g.inscribed).toFixed(2)}°; the central angle over the arc BC that does not contain A is ${deg(g.central).toFixed(2)}° = twice it, drawn ${g.split ? "as ∠BOA′ + ∠A′OC because the arc exceeds a semicircle" : "as the single ∠BOC"}. ${cyclicNote}`;
  }

  return {
    mode: g.mode,
    circle: { center: g.O, radius: C.CIRCLE.r },
    A: g.A, B: g.B, C: g.C, antipodeOfA: g.Ap,
    inscribedDeg: deg(g.inscribed),
    centralDeg: deg(g.central),
    arcDeg: deg(g.arc),
    centralIsTwiceInscribed: Math.abs(g.central - 2 * g.inscribed) < 1e-9,
    factor: g.inscribed > 1e-9 ? g.central / g.inscribed : null,
    split: g.split,
    centralDrawnAs: g.split ? "∠BOA′ + ∠A′OC" : "∠BOC",
    proof: g.proof.map((part) => ({
      point: part.name,
      shown: part.show,
      angleOnDiameterDeg: deg(part.atP),
      rightAngle: part.show && Math.abs(part.atP - Math.PI / 2) < 1e-9,
      baseAngleAtADeg: deg(part.base),
      baseAngleAtPDeg: deg(C.angle(state.A, part.P, g.O)),
      isoscelesBaseAngles: part.show && Math.abs(part.base - C.angle(state.A, part.P, g.O)) < 1e-9,
    })),
    cyclic,
    tangent,
    description: C.describe(state),
    note,
  };
}

export function actions(): GameActions {
  return {
    inscribed_and_central: {
      describe:
        "Place three points A, B and C on the circle (give each as {x, y} or an angle in degrees around the circle; defaults are the opening picture) and compare the inscribed angle at A with the central angle over the arc BC that does not contain A. Reports the factor of two, whether the applet splits the central angle at the antipode A′ because the arc exceeds a semicircle, the isosceles/Thales proof angles, and the corrected cyclic-quadrilateral relation between the angles at A and A′.",
      args: '{ "A": 90, "B": 180, "C": 300 }',
      run: (args) => {
        const state = makeState(args);
        return reading(state);
      },
    },
    tangent_limit: {
      describe:
        "Drag B (or C) onto A so its chord vanishes and the applet replaces it with the tangent at A. Given A, the surviving chord point and which point collapsed, report the central angle over that chord, the marked tangent–chord angle and its acute form, and check that the acute angle is half the central angle (the alternate-segment limit).",
      args: '{ "A": 90, "chordPoint": 270, "which": "C" }',
      run: (args) => {
        const C = core();
        const base = C.start({});
        const A = readPoint(args.A, "A", base.A);
        const chordPoint = readPoint(args.chordPoint, "chordPoint", base.C);
        const which = readWhich(args, "which");
        if (C.dist(A, chordPoint) < C.HIT) {
          throw new Error("chordPoint must be a different point from A so a chord survives");
        }
        const state: State = which === "B"
          ? { ...base, A, B: A, C: chordPoint, explored: true }
          : { ...base, A, B: chordPoint, C: A, explored: true };
        const g = C.geometry(state);
        if (!g.tangent) throw new Error("the core did not enter the tangent case; check A and chordPoint");
        return { vanished: which, chordPoint, ...reading(state) };
      },
    },
  };
}

/** Echo what Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Inscribed Angle state version ${stateVersion}`);
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  const here = makeState(src);
  return {
    ...src,
    stateVersion,
    saved: { A: here.A, B: here.B, C: here.C, names: here.names, explored: here.explored },
    reading: reading(here),
  };
}
