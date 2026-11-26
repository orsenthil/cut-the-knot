/*
 * run_game_logic actions and saved-position reader for Archimedes Quadruplets.
 *
 * An arbelos has a big semicircle on AB and two small ones on AC and CB, with
 * radii r1 = AC/2 and r2 = CB/2, so the big radius is r = r1 + r2. Archimedes'
 * two twin circles have radius r1*r2/(r1+r2). F. Power built four more circles
 * at the tops D and E of the small semicircles: each circle of radius x touches
 * the line OD (or OE) at D (or E) and the big arc. Its centre L is x from D at
 * right angles to OD, so OL^2 = x^2 + OD^2 with OD^2 = r1^2 + r2^2; internal
 * tangency gives OL = r - x. Squaring cancels x^2 and leaves
 * 2x(r1 + r2) = 2r1r2, so x = r1*r2/(r1+r2): the four circles equal the twins
 * in radius and area wherever C is dragged. The radius is largest at the
 * midpoint (x = r/4) and tends to 0 at either end.
 *
 * The Java applet built its big circle with radius |AB| = 2r while drawing the
 * semicircle with radius r, which halved its four circles and put its tangency
 * dots off the arc. This port follows the article's explicit algebra. The port
 * also keeps a literal transcription of the applet's arithmetic in
 * porting/check-archimedes-quadruplets.mjs, which checks the difference.
 *
 * All numbers below come from the game's real core
 * (archimedes-quadruplets/), copied into src/generated/cores/ at build time.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["archimedes-quadruplets"].ArchimedesQuadrupletsCore;

type Point = { x: number; y: number };
type Geometry = ReturnType<ReturnType<typeof core>["geometry"]>;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const pt = (p: Point): Point => ({ x: round(p.x, 4), y: round(p.y, 4) });
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a: number, b: number, tolerance = 1e-6): boolean =>
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

const BUG_NOTE =
  "The original applet used |AB| = 2r for its big circle while drawing a semicircle of radius r, so its four circles were exactly half this size and their tangency dots missed the arc; this port follows the article's radius r, putting the dots on the arc.";

/** Tool args may use [x, y]; a saved position from the page uses {x, y}. */
function readPoint(value: unknown, name: string): Point {
  if (Array.isArray(value) && value.length === 2) {
    const x = Number(value[0]), y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const p = value as Json;
    const x = num(p, "x"), y = num(p, "y");
    return { x, y };
  }
  throw new Error(`"${name}" must be a point [x, y] or {x, y}`);
}

/**
 * Build a core state from the split point C. The caller may give `cx` directly
 * in board units, the two small radii `r1` and `r2`, or a fraction `t` of AB;
 * `ax` and `bx` optionally set the ends of the diameter.
 */
function fromArgs(args: Json) {
  const C = core();
  const ax = num(args, "ax", C.START_AX);
  const bx = num(args, "bx", C.START_BX);
  if (!(bx - ax > 2 * C.GAP)) {
    throw new Error('"bx" must be more than 10 board units to the right of "ax"');
  }

  if (args.r1 !== undefined || args.r2 !== undefined) {
    if (args.r1 === undefined || args.r2 === undefined) {
      throw new Error('give both "r1" and "r2", or give "cx" (or "t") instead');
    }
    const r1 = num(args, "r1"), r2 = num(args, "r2");
    if (!(r1 >= C.GAP) || !(r2 >= C.GAP)) {
      throw new Error('"r1" and "r2" must be at least 5 so the three handles stay apart');
    }
    if (r1 + r2 > (C.WIDTH - 2 * C.EDGE) / 2) {
      throw new Error(`"r1" + "r2" must be at most ${(C.WIDTH - 2 * C.EDGE) / 2} to fit the ${C.WIDTH}-unit board`);
    }
    // Centre the diameter on the board: AC = 2*r1, CB = 2*r2.
    const mid = C.WIDTH / 2;
    const state = C.start({ ax: mid - (r1 + r2), bx: mid + (r1 + r2), cx: mid + r1 - r2 });
    const g = C.geometry(state);
    if (!close(g.r1, r1, 1e-6) || !close(g.r2, r2, 1e-6)) {
      throw new Error("the requested radii do not fit the board");
    }
    return { state, g };
  }

  let cx: number;
  if (args.t !== undefined) {
    const t = num(args, "t");
    if (!(t > 0 && t < 1)) throw new Error('"t" must be strictly between 0 and 1');
    cx = ax + t * (bx - ax);
  } else {
    cx = num(args, "cx", C.START_CX);
  }
  const state = C.start({ ax, bx, cx });
  if (!close(state.cx, cx, 1e-6)) {
    throw new Error('"cx" must lie strictly between "ax" and "bx", with a five-unit gap to each');
  }
  return { state, g: C.geometry(state) };
}

/** The article's claims, measured on the core's construction. */
function reading(g: Geometry) {
  const x = g.radius;
  const formula = (g.r1 * g.r2) / g.r;
  const circles = g.left.concat(g.right);
  // The two left circles touch the line OD at D, the two right ones OE at E.
  const apexes = [g.D, g.D, g.E, g.E];
  const apexOffsets = circles.map((c, i) => dist(c.center, apexes[i]));
  const perpendicular = circles.every((c, i) => {
    const v = { x: c.center.x - apexes[i].x, y: c.center.y - apexes[i].y };
    const d = { x: apexes[i].x - g.O.x, y: apexes[i].y - g.O.y };
    return close(v.x * d.x + v.y * d.y, 0, 1e-6);
  });
  const OLs = circles.map((c) => dist(g.O, c.center));
  const dotsOnArc = circles.every((c) =>
    close(dist(g.O, c.contact), g.r) && c.contact.y <= g.O.y + 1e-6);
  const twinRadii = g.twins.map((t) => t.radius);

  return {
    split: {
      cx: round(g.C.x),
      fractionAlongAB: round((g.C.x - g.A.x) / (g.B.x - g.A.x)),
      AC: round(g.a),
      CB: round(g.b),
    },
    radii: { r1: round(g.r1), r2: round(g.r2), bigR: round(g.r) },
    commonRadius: {
      measured: round(x),
      formula: round(formula),
      equalsFormula: close(x, formula),
      twinRadii: twinRadii.map((v) => round(v)),
      equalsTwins: twinRadii.every((v) => close(v, x)),
    },
    od2: {
      measured: round(g.od2),
      formula: round(g.r1 * g.r1 + g.r2 * g.r2),
      equalsFormula: close(g.od2, g.r1 * g.r1 + g.r2 * g.r2),
      oe2: round(dist(g.O, g.E) * dist(g.O, g.E)),
    },
    centres: circles.map((c) => pt(c.center)),
    tangencyDots: circles.map((c) => pt(c.contact)),
    tangency: {
      distanceFromApex: apexOffsets.map((v) => round(v)),
      eachOffsetIsRadius: apexOffsets.every((v) => close(v, x)),
      offsetsPerpendicularToODorOE: perpendicular,
      OL: OLs.map((v) => round(v)),
      OLequalsRminusX: OLs.every((v) => close(v, g.r - x)),
      OL2equalsX2plusOD2: OLs.every((v) => close(v * v, x * x + g.od2)),
      dotsOnBigArc: dotsOnArc,
    },
    areas: {
      each: round(g.circleArea),
      twin: round(g.twinArea),
      fourTogether: round(g.fourArea),
      equalsTwins: close(g.circleArea, g.twinArea),
    },
    appletBug: { appletRadius: round(x / 2), portRadius: round(x), note: BUG_NOTE },
  };
}

export function actions(): GameActions {
  return {
    power_circles: {
      describe:
        "Given the split point C (use `cx` in board units, or the two small radii `r1` and `r2`, or a fraction `t` of AB; `ax` and `bx` may set the ends), run the real construction. Report AC, CB, r1, r2 and R = r1+r2; the common radius of Power's four circles and Archimedes' twins against r1*r2/(r1+r2); OD² = OE² = r1²+r2²; the four centres and their tangency dots on the big arc, each checked at distance r from O and r−x from O. Radial offsets from D and E are perpendicular to OD and OE. The original applet used |AB| = 2r as its big radius, halving every circle and putting its dots off the arc; this port follows the article.",
      args: '{ "cx": 244 }',
      run: (args) => {
        const r = reading(fromArgs(args).g);
        return {
          ...r,
          note:
            `With C at x = ${r.split.cx}, r1 = ${r.radii.r1} and r2 = ${r.radii.r2} (R = ${r.radii.bigR}). ` +
            `All four Power circles and both twins have radius ${r.commonRadius.measured} = r1*r2/(r1+r2); ` +
            `OD² = ${r.od2.measured} = r1²+r2², each centre is one radius from D or E at right angles to OD or OE, ` +
            `and all four tangency dots lie on the big arc. Each area is πx² = ${r.areas.each}. ` +
            BUG_NOTE,
        };
      },
    },
    radius_sweep: {
      describe:
        "For several positions of C along AB (fractions in `fractions` of AB, or board x-coordinates in `positions`; `ax` and `bx` may set the ends), report each common radius and its formula r1*r2/(r1+r2), plus the half-size radius the original applet would have drawn. The radius is largest at the midpoint, where x = r/4, and tends to 0 as C approaches either end. At most 20 positions; fractions must be strictly between 0 and 1, positions strictly between ax and bx.",
      args: '{ "fractions": [0.1, 0.3, 0.5, 0.7, 0.9] }',
      run: (args) => {
        const C = core();
        const ax = num(args, "ax", C.START_AX);
        const bx = num(args, "bx", C.START_BX);
        if (!(bx - ax > 2 * C.GAP)) {
          throw new Error('"bx" must be more than 10 board units to the right of "ax"');
        }
        const fractions = Array.isArray(args.fractions)
          ? numArray(args, "fractions")
          : [0.1, 0.3, 0.5, 0.7, 0.9];
        if (fractions.some((f) => !(f > 0 && f < 1))) {
          throw new Error('every "fractions" entry must be strictly between 0 and 1');
        }
        const positions = Array.isArray(args.positions)
          ? numArray(args, "positions")
          : fractions.map((f) => ax + f * (bx - ax));
        if (positions.length === 0 || positions.length > 20) {
          throw new Error("give between 1 and 20 positions");
        }
        const steps = positions.map((cx) => {
          const state = C.start({ ax, bx, cx });
          if (!close(state.cx, cx, 1e-6)) {
            throw new Error("each position must lie strictly between ax and bx, with a five-unit gap to each");
          }
          const g = C.geometry(state);
          const formula = (g.r1 * g.r2) / g.r;
          return {
            cx: round(cx),
            fractionAlongAB: round((cx - ax) / (bx - ax)),
            r1: round(g.r1),
            r2: round(g.r2),
            radius: round(g.radius),
            formula: round(formula),
            matchesFormula: close(g.radius, formula),
            appletRadius: round(g.radius / 2),
          };
        });
        const mid = C.geometry(C.start({ ax, bx, cx: (ax + bx) / 2 }));
        const peak = steps.reduce((best, s) => (s.radius > best.radius ? s : best), steps[0]);
        return {
          ax: round(ax),
          bx: round(bx),
          steps,
          midpoint: {
            cx: round((ax + bx) / 2),
            radius: round(mid.radius),
            formula: round(mid.r / 4),
            equalsRover4: close(mid.radius, mid.r / 4),
          },
          largestInSample: { cx: peak.cx, radius: peak.radius },
          note:
            `At the midpoint C, r1 = r2 = r/2, so x = (r/2)²/r = r/4 = ${round(mid.radius)} — the largest radius; ` +
            `as C approaches an end, one of r1, r2 tends to 0 and so does x. Every sampled radius equals ` +
            `r1*r2/(r1+r2). The applet's doubled big radius would have made each one exactly half ` +
            `(for example ${round(mid.radius / 2)} at the midpoint). ` +
            BUG_NOTE,
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Archimedes Quadruplets state version ${stateVersion}`);
  }
  const C = core();
  const A = readPoint(state.A, "A");
  const Cc = readPoint(state.C, "C");
  const B = readPoint(state.B, "B");
  const here = C.start({ ax: A.x, bx: B.x, cx: Cc.x });
  const g = C.geometry(here);
  if (!(g.r > 0)) {
    return {
      ...state, stateVersion, valid: false,
      note: "The saved A, C and B do not make a usable arbelos: the big radius must be positive.",
    };
  }
  const cp = C.position(here);
  const saved = {
    A,
    C: Cc,
    B,
    r1: num(state, "r1"),
    r2: num(state, "r2"),
    r: num(state, "r"),
    radius: num(state, "radius"),
    circleArea: num(state, "circleArea"),
    D: readPoint(state.D, "D"),
    E: readPoint(state.E, "E"),
  };
  const fields: Array<[string, number, number]> = [
    ["r1", saved.r1, cp.r1],
    ["r2", saved.r2, cp.r2],
    ["r", saved.r, cp.r],
    ["radius", saved.radius, cp.radius],
    ["circleArea", saved.circleArea, cp.circleArea],
    ["A.x", saved.A.x, cp.A.x],
    ["C.x", saved.C.x, cp.C.x],
    ["B.x", saved.B.x, cp.B.x],
    ["D.x", saved.D.x, cp.D.x],
    ["D.y", saved.D.y, cp.D.y],
    ["E.x", saved.E.x, cp.E.x],
    ["E.y", saved.E.y, cp.E.y],
  ];
  const differences = fields.map(([field, page, coreValue]) => ({
    field,
    page,
    core: coreValue,
    diff: round(Math.abs(page - coreValue), 9),
  }));
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)));
  const measured = reading(g);

  return {
    // The page's saved fields, with the same names.
    ...saved,
    stateVersion,
    valid: true,
    // What the same core adds about this position.
    core: measured,
    savedMatchesCore,
    differences,
    note:
      `A = ${saved.A.x}, C = ${saved.C.x}, B = ${saved.B.x} give r1 = ${measured.radii.r1}, ` +
      `r2 = ${measured.radii.r2} and R = ${measured.radii.bigR}, so all four Power circles and both ` +
      `twins have radius ${measured.commonRadius.measured} = r1*r2/(r1+r2); OD² = ${measured.od2.measured} ` +
      `= r1²+r2² and the four tangency dots lie on the big arc. ` +
      (savedMatchesCore
        ? "Every saved number agrees with the core. "
        : "Some saved numbers differ from the core; see `differences`. ") +
      BUG_NOTE,
  };
}
