/*
 * run_game_logic actions and saved-position reader for Rectangle in Arbelos.
 *
 * Three semicircles sit on the line AB. C splits AB into AC = a and CB = b,
 * and D is the point of the big semicircle above C; AD and BD meet the two
 * small semicircles again at E and F. Everything follows from one identity,
 * CD^2 = AC*CB: D lies on a semicircle, so the upright CD is the mean
 * proportional of the two pieces of the diameter. From it, CEDF has four right
 * corners and equal diagonals EF = CD, EF touches both small circles at E and
 * F, the rectangle's centre O satisfies OE = OC, and the arbelos has area
 * pi*CD^2/4, the area of the circle on CD.
 *
 * All numbers below come from the game's real core (arbelos-rect/), copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["arbelos-rect"].ArbelosRectCore;

type Point = { x: number; y: number };
type Geometry = ReturnType<ReturnType<typeof core>["geometry"]>;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const dist = (p: Point, q: Point): number => Math.hypot(q.x - p.x, q.y - p.y);
/** Dot product of the two rays leaving `vertex`. */
const dot = (vertex: Point, p: Point, q: Point): number =>
  (p.x - vertex.x) * (q.x - vertex.x) + (p.y - vertex.y) * (q.y - vertex.y);
/** The angle p-vertex-q in degrees, from the core's own (y-down) coordinates. */
const angle = (vertex: Point, p: Point, q: Point): number => {
  const den = dist(vertex, p) * dist(vertex, q);
  if (den === 0) throw new Error("cannot measure an angle with a zero-length side");
  return (Math.acos(Math.max(-1, Math.min(1, dot(vertex, p, q) / den))) * 180) / Math.PI;
};
/** The core's pixel arithmetic has rounding around 1e-12; 1e-6 is generous. */
const close = (a: number, b: number, tolerance = 1e-6): boolean =>
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
const right = (degrees: number): boolean => Math.abs(degrees - 90) < 1e-5;

/** Tool args may give [x, y]; a saved position from the page uses {x, y}. */
function readPoint(value: unknown, name: string): Point {
  if (Array.isArray(value) && value.length === 2) {
    const x = Number(value[0]), y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (value && typeof value === "object") {
    const o = value as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`"${name}" must be a point {x, y} or [x, y]`);
}

/**
 * Place C by its fraction t of AB, or by the two pieces AC and CB. The core
 * keeps C at least MIN_GAP units from either end, so an outside t is rejected
 * rather than silently clamped.
 */
function fromArgs(args: Json): Geometry {
  const C = core();
  let t: number;
  if (args.AC !== undefined || args.CB !== undefined) {
    const a = num(args, "AC"), b = num(args, "CB");
    if (!(a > 0) || !(b > 0)) throw new Error('"AC" and "CB" must be positive lengths');
    t = a / (a + b);
  } else {
    t = num(args, "t", C.START_T);
  }
  const lo = C.MIN_GAP / C.SIDE;
  if (!(t >= lo && t <= 1 - lo)) {
    throw new Error(
      `"t" must put C between ${round(lo)} and ${round(1 - lo)} of AB ` +
      `(the core keeps ${C.MIN_GAP} units clear of both ends)`,
    );
  }
  return C.geometry(C.start({ t }));
}

/** The rectangle claim, measured on the core's construction. */
function rectangleReading(g: Geometry) {
  const CE = dist(g.C, g.E), ED = dist(g.E, g.D);
  const DF = dist(g.D, g.F), FC = dist(g.F, g.C);
  const corners = {
    C: angle(g.C, g.F, g.E),
    E: angle(g.E, g.C, g.D),
    D: angle(g.D, g.E, g.F),
    F: angle(g.F, g.D, g.C),
  };
  const thales = {
    AEC: angle(g.E, g.A, g.C),
    ADB: angle(g.D, g.A, g.B),
    CFB: angle(g.F, g.C, g.B),
  };
  const midEF = { x: (g.E.x + g.F.x) / 2, y: (g.E.y + g.F.y) / 2 };
  const OE = dist(g.O, g.E), OC = dist(g.O, g.C);
  const formulaArea = (g.a * g.b * g.CD) / g.L;
  return {
    t: round(g.t),
    AC: round(g.a), CB: round(g.b), AB: round(g.L), CD: round(g.CD),
    E: pt(g.E), F: pt(g.F), O: pt(g.O),
    rectangle: {
      sides: { CE: round(CE), ED: round(ED), DF: round(DF), FC: round(FC) },
      cornersDeg: {
        C: round(corners.C), E: round(corners.E),
        D: round(corners.D), F: round(corners.F),
      },
      isRectangle:
        close(CE, DF) && close(ED, FC) &&
        Object.values(corners).every(right),
      diagonals: { CD: round(g.CD), EF: round(g.EF) },
      equalDiagonals: close(g.CD, g.EF),
      area: round(g.rectangleArea),
      formula_abCdOverAB: round(formulaArea),
      areaMatchesFormula: close(g.rectangleArea, formulaArea),
    },
    centre: {
      midpointOfEF: pt(midEF),
      OisMidpointOfEF: close(midEF.x, g.O.x) && close(midEF.y, g.O.y),
      distances: {
        OC: round(OC), OD: round(dist(g.O, g.D)),
        OE: round(OE), OF: round(dist(g.O, g.F)),
      },
      OEequalsOC: close(OE, OC),
    },
    thales: {
      AEC: round(thales.AEC), ADB: round(thales.ADB), CFB: round(thales.CFB),
      allRight: Object.values(thales).every(right),
    },
  };
}

/** The common-tangent and area claims, measured on the same construction. */
function tangentReading(g: Geometry) {
  // OaE is a radius of the left small circle and ObF of the right one.
  const angleOaEF = angle(g.E, g.Oa, g.F);
  const angleObFE = angle(g.F, g.Ob, g.E);
  // Equal-base angles of the isosceles triangles AOaE and BObF.
  const angleEAOa = angle(g.A, g.E, g.Oa);
  const angleAEOa = angle(g.E, g.A, g.Oa);
  const angleFBOb = angle(g.B, g.F, g.Ob);
  const angleBFO = angle(g.F, g.B, g.Ob);
  const cd2 = g.CD * g.CD;
  const ab = g.a * g.b;
  const piCD2Over4 = (Math.PI * cd2) / 4;
  return {
    t: round(g.t),
    AC: round(g.a), CB: round(g.b), CD: round(g.CD),
    E: pt(g.E), F: pt(g.F),
    tangent: {
      radii: {
        Oa: pt(g.Oa), Ob: pt(g.Ob),
        r1: round(g.r1), r2: round(g.r2),
        OaAequalsOaE: close(dist(g.Oa, g.A), dist(g.Oa, g.E)),
        ObBequalsObF: close(dist(g.Ob, g.B), dist(g.Ob, g.F)),
      },
      angleOaEF: round(angleOaEF),
      angleObFE: round(angleObFE),
      isCommonTangent: right(angleOaEF) && right(angleObFE),
      angleChain: {
        angleEAOa: round(angleEAOa), angleAEOa: round(angleAEOa),
        leftAnglesEqual: Math.abs(angleEAOa - angleAEOa) < 1e-5,
        angleFBOb: round(angleFBOb), angleBFO: round(angleBFO),
        rightAnglesEqual: Math.abs(angleFBOb - angleBFO) < 1e-5,
      },
    },
    areas: {
      CD2: round(cd2), ACtimesCB: round(ab),
      cd2EqualsACtimesCB: close(cd2, ab),
      arbelosArea: round(g.arbelosArea),
      circleOnCDArea: round(g.circleArea),
      piCD2Over4: round(piCD2Over4),
      arbelosEqualsCircle: close(g.arbelosArea, g.circleArea) && close(g.circleArea, piCD2Over4),
      rectangleArea: round(g.rectangleArea),
    },
  };
}

export function actions(): GameActions {
  return {
    rectangle_from_split: {
      describe:
        "Put C on the diameter AB, either by its fraction t of AB (about 0.0147 to 0.9853) or by the two lengths AC and CB, and run the real core. Report E and F, the four sides and corner angles of CEDF, its equal diagonals EF = CD, the centre O with OE = OC, and the three Thales right angles AEC, ADB and CFB. Checks that CEDF is always a rectangle.",
      args: '{ "t": 0.5 }',
      run: (args) => {
        const r = rectangleReading(fromArgs(args));
        return {
          ...r,
          note:
            `AC = ${r.AC} and CB = ${r.CB}, so CD = ${r.CD} = sqrt(AC*CB). ` +
            `E = (${r.E.x}, ${r.E.y}) and F = (${r.F.x}, ${r.F.y}) give CEDF sides ` +
            `${r.rectangle.sides.CE}, ${r.rectangle.sides.ED}, ${r.rectangle.sides.DF}, ` +
            `${r.rectangle.sides.FC}; all four corners are ${r.rectangle.cornersDeg.C} degrees. ` +
            `Its diagonals CD and EF are both ${r.rectangle.diagonals.CD} (EF = CD), ` +
            `O = (${r.O.x}, ${r.O.y}) is the midpoint of EF and OE = OC = ${r.centre.distances.OC}. ` +
            `The right angles at E, D and F are Thales' theorem: AEC, ADB and CFB each subtend a diameter.`,
        };
      },
    },
    tangent_and_area: {
      describe:
        "For a split of AB given by t or by AC and CB, report E and F and check that EF is a common tangent: the radii OaE and ObF are each perpendicular to EF, with the isosceles angle chain of triangle AOaE and triangle BObF behind it. Also check CD^2 = AC*CB and the area equalities: the arbelos and the circle on CD both have area pi*CD^2/4, and the rectangle has area AC*CB*CD/AB.",
      args: '{ "AC": 106, "CB": 234 }',
      run: (args) => {
        const r = tangentReading(fromArgs(args));
        return {
          ...r,
          note:
            `OaE and ObF are radii of lengths ${r.tangent.radii.r1} and ${r.tangent.radii.r2}, ` +
            `and OaE meets EF at ${r.tangent.angleOaEF} degrees, ObF at ${r.tangent.angleObFE} degrees, ` +
            `so EF from E = (${r.E.x}, ${r.E.y}) to F = (${r.F.x}, ${r.F.y}) touches both small semicircles. ` +
            `The equal angles in the isosceles triangles (${r.tangent.angleChain.angleEAOa} degrees each on the left, ` +
            `${r.tangent.angleChain.angleFBOb} degrees each on the right) carry the angle chase. ` +
            `CD^2 = ${r.areas.CD2} = AC*CB = ${r.areas.ACtimesCB}, and the arbelos and the circle on CD ` +
            `both have area ${r.areas.arbelosArea} = pi*CD^2/4.`,
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) {
    throw new Error(`unsupported Arbelos Rect state version ${stateVersion}`);
  }

  const t = num(state, "t");
  const here = C.start({ t });
  const g = C.geometry(here);
  const cp = C.position(here); // the core's rounded summary: the page's saved shape

  const A = readPoint(state.A, "A"), B = readPoint(state.B, "B");
  const Cc = readPoint(state.C, "C"), D = readPoint(state.D, "D");
  const E = readPoint(state.E, "E"), F = readPoint(state.F, "F");
  const saved = {
    t, A, B, C: Cc, D, E, F,
    AC: num(state, "AC"), CB: num(state, "CB"),
    CD: num(state, "CD"), EF: num(state, "EF"),
    rectangleArea: num(state, "rectangleArea"),
    arbelosArea: num(state, "arbelosArea"),
    circleArea: num(state, "circleArea"),
  };

  const numberPairs: Array<[string, number, number]> = [
    ["t", saved.t, cp.t],
    ["AC", saved.AC, cp.AC], ["CB", saved.CB, cp.CB],
    ["CD", saved.CD, cp.CD], ["EF", saved.EF, cp.EF],
    ["rectangleArea", saved.rectangleArea, cp.rectangleArea],
    ["arbelosArea", saved.arbelosArea, cp.arbelosArea],
    ["circleArea", saved.circleArea, cp.circleArea],
  ];
  const differences = numberPairs.map(([field, page, coreValue]) => ({
    field,
    page: round(page, 9), core: round(coreValue, 9),
    diff: round(Math.abs(page - coreValue), 9),
  }));
  const pointNames = ["A", "B", "C", "D", "E", "F"] as const;
  const pointDifferences = pointNames.map((name) => {
    const page = saved[name], fromCore = cp[name] as Point;
    return {
      point: name,
      page: pt(page), core: pt(fromCore),
      diff: round(Math.max(Math.abs(page.x - fromCore.x), Math.abs(page.y - fromCore.y)), 9),
    };
  });
  const savedMatchesCore =
    differences.every((d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core))) &&
    pointDifferences.every((d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core.x), Math.abs(d.core.y)));

  const rectangle = rectangleReading(g);
  const tangent = tangentReading(g);
  const tFromC = C.fractionAtX(Cc.x); // the saved point recovers an unrounded t

  return {
    stateVersion,
    // The page's saved fields, with the same names.
    t: saved.t,
    A: pt(saved.A), B: pt(saved.B), C: pt(saved.C),
    D: pt(saved.D), E: pt(saved.E), F: pt(saved.F),
    AC: saved.AC, CB: saved.CB, CD: saved.CD, EF: saved.EF,
    rectangleArea: saved.rectangleArea,
    arbelosArea: saved.arbelosArea,
    circleArea: saved.circleArea,
    // What the same core adds about this position.
    core: {
      t: round(g.t), tFromSavedC: round(tFromC),
      AB: round(g.L), CD: round(g.CD),
      radii: { r1: round(g.r1), r2: round(g.r2), R: round(g.R) },
      centres: { O: pt(g.O), Oa: pt(g.Oa), Ob: pt(g.Ob) },
      isRectangle: rectangle.rectangle.isRectangle,
      EFequalsCD: rectangle.rectangle.equalDiagonals,
      OEequalsOC: rectangle.centre.OEequalsOC,
      thales: rectangle.thales,
      commonTangent: tangent.tangent.isCommonTangent,
      angleChain: tangent.tangent.angleChain,
      areas: tangent.areas,
    },
    savedMatchesCore,
    differences,
    pointDifferences,
    note: savedMatchesCore
      ? `C is ${round(t)} of the way from A to B, so AC = ${round(g.a)}, CB = ${round(g.b)} and CD = ${round(g.CD)} = sqrt(AC*CB). CEDF is a rectangle with EF = CD = ${round(g.EF)} and OE = OC = ${round(dist(g.O, g.C))}; EF touches both small semicircles. The arbelos and the circle on CD both have area ${round(g.arbelosArea)} = pi*CD^2/4. The page rounds t to six decimals, which explains the tiny differences above.`
      : `The saved numbers do not agree with the core's geometry for t = ${round(t)}; see differences and pointDifferences.`,
  };
}
