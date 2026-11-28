/*
 * run_game_logic actions and saved-position reader for Inscriptible Quadri.
 *
 * Four dots M, Q, N, P lie on one circle. The tangent at each dot meets the
 * tangent at the next to make a quadrilateral A = tangent(M) ∩ tangent(P),
 * B = tangent(P) ∩ tangent(N), C = tangent(N) ∩ tangent(Q),
 * D = tangent(Q) ∩ tangent(M). Two tangent segments from the same corner have
 * equal lengths (AM = AP, BP = BN, CN = CQ, DQ = DM), so when the circle lies
 * inside the figure,
 *   AB + CD = (AP + PB) + (CQ + QD) = (AM + DM) + (BN + CN) = BC + DA,
 * which is Pitot's theorem. When a dot is dragged until the circle leaves the
 * figure, Pitot's pairing fails and instead AB + BC = CD + DA (an excircle on
 * one side) or AB + DA = BC + CD (an excircle on the other). The core's
 * residuals measure all three signed mismatches. This is *not* the tangent-foot
 * test of incircles-in-quadri: here one given circle touches all four sides,
 * rather than four triangle incircles laying feet on two diagonals. The page
 * also notes that the usual proof of the converse has a subtle flaw although
 * the converse itself is true for a convex tangential quadrilateral; this core
 * starts from the circle, so it checks the forward direction and the
 * exscriptible alternatives, not the construction of an incircle from sides.
 *
 * Every number below comes from the game's real core,
 * inscriptible-quadri/inscriptible-quadri-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units in the
 * applet's 400 x 250 view, y down; angles given to start() are radians. This
 * is an illustration with no win or loss (result() is "done" once explored).
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Handle = "M" | "Q" | "N" | "P";
type Corner = "A" | "B" | "C" | "D" | "S" | "T";
type OptionKey = "showNames" | "showTangency" | "showTangents" | "showSides";
const HANDLES: Handle[] = ["M", "Q", "N", "P"];
const CORNERS: Corner[] = ["A", "B", "C", "D", "S", "T"];
const OPTIONS: OptionKey[] = ["showNames", "showTangency", "showTangents", "showSides"];

type Sides = { AB: number; BC: number; CD: number; DA: number };
type Touch = {
  AM: number; AP: number; BP: number; BN: number;
  CN: number; CQ: number; DQ: number; DM: number;
};
type Residuals = {
  pitot: number; exscriptibleB: number; exscriptibleA: number; tangents: number;
};
/** Printed versions of the core's numbers: NaN and infinities become null. */
type Rounded<T> = { [K in keyof T]: number | null };
type Geometry = {
  valid: boolean;
  reason: string | null;
  circle: { O: Pt; r: number };
  lines: Record<Handle, { a: Pt; b: Pt }>;
  v: Record<Corner, Pt>;
  sides: Sides;
  touch: Touch;
  inscribed: boolean;
  residuals: Residuals;
};
type State = {
  O: Pt; r: number; M: Pt; Q: Pt; N: Pt; P: Pt;
  showNames: boolean; showTangency: boolean; showTangents: boolean; showSides: boolean;
  moves: number; explored: boolean;
};
type Core = {
  WIDTH: number; HEIGHT: number; PAD: number;
  HANDLES: string[]; OPTION_KEYS: OptionKey[];
  START_O: Pt; START_R: number; START_ANGLES: Record<Handle, number>;
  dist(p: Pt, q: Pt): number;
  start(options?: Json): State;
  move(s: State, m: Json): State | null;
  result(s: State): string | null;
  compute(s: State): Geometry;
  residuals(g: Geometry): Residuals | null;
  circleFrom3(p: Pt, q: Pt, r: Pt): { O: Pt; r: number };
};

const core = (): Core =>
  cores["inscriptible-quadri"].InscriptibleQuadriCore as unknown as Core;

/** Tidy only what we print; keep a near-zero residual's sign and magnitude. */
const round = (v: number, digits = 6): number | null =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : null;
const sig = (v: number): number | null =>
  !Number.isFinite(v) ? null
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2))
      : round(v, 9);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x)!, y: round(p.y)! }
    : null;

/** Accept the tutor's [x, y] and the page's saved { x, y } points alike. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readFinite(raw: unknown, label: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`argument "${label}" must be a finite number, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** The four dot angles at the circle's centre, in radians. */
function readAngles(raw: unknown): Record<Handle, number> {
  if (!Array.isArray(raw) || raw.length !== 4) {
    throw new Error('argument "angles" must be four angles [M, Q, N, P] in radians');
  }
  const values = raw.map((v: unknown, i: number) => readFinite(v, `angles[${i}]`));
  return { M: values[0], Q: values[1], N: values[2], P: values[3] };
}

/** A real core state: the opening picture with the caller's circle and drags. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of dots M, Q, N, P, optional O, r, angles and switches");
  }
  const options: Json = {};
  if (args.O !== undefined && args.O !== null) options.O = readPoint(args.O, "O");
  if (args.r !== undefined && args.r !== null) {
    const radius = readFinite(args.r, "r");
    if (!(radius > 0)) throw new Error('argument "r" must be positive');
    options.r = radius;
  }
  if (args.angles !== undefined && args.angles !== null) options.angles = readAngles(args.angles);
  for (const key of OPTIONS) {
    if (typeof args[key] === "boolean") options[key] = args[key];
  }
  let s = C.start(options);
  for (const name of HANDLES) {
    if (args[name] !== undefined && args[name] !== null) {
      // move() clamps a drag to the board and snaps the dot onto the circle.
      const next = C.move(s, { type: "point", name, point: readPoint(args[name], name) });
      if (!next) throw new Error(`dot ${name} cannot be placed there (it must differ from the circle's centre)`);
      s = next;
    }
  }
  return s;
}

type Reading = {
  valid: boolean;
  reason: string | null;
  board: { width: number; height: number };
  circle: { center: Pt; radius: number | null };
  getCircle: {
    fromDots: [Handle, Handle, Handle];
    center: Pt | null; radius: number | null;
    centerGap: number | null; radiusGap: number | null;
  };
  dots: Record<Handle, Pt>;
  corners: Record<Corner, Pt | null>;
  sides: Rounded<Sides>;
  tangentSegments: Rounded<Touch>;
  equalTangents: {
    AM_AP: number | null; BP_BN: number | null;
    CN_CQ: number | null; DQ_DM: number | null; max: number | null;
  };
  residuals: Rounded<Residuals>;
  tolerance: number | null;
  inscribed: boolean;
  matchingPairs: string[];
  result: string | null;
};

/** One geometry computation, with the core's residual signs left visible. */
function reading(C: Core, s: State): Reading {
  const g = C.compute(s);
  const tol = 1e-7 * Math.max(
    1, Math.abs(s.O.x), Math.abs(s.O.y), s.r,
    ...Object.values(g.sides).map((v) => Math.abs(v)),
  );
  const pairs = [
    { name: "AB + CD = BC + DA (Pitot, circle inside)", value: g.residuals.pitot },
    { name: "AB + BC = CD + DA (excircle)", value: g.residuals.exscriptibleB },
    { name: "AB + DA = BC + CD (excircle)", value: g.residuals.exscriptibleA },
  ];
  const recovered = C.circleFrom3(s.M, s.Q, s.N);
  const roundT: Touch = {
    AM: g.touch.AM, AP: g.touch.AP, BP: g.touch.BP, BN: g.touch.BN,
    CN: g.touch.CN, CQ: g.touch.CQ, DQ: g.touch.DQ, DM: g.touch.DM,
  };
  const eq = {
    AM_AP: sig(g.touch.AM - g.touch.AP),
    BP_BN: sig(g.touch.BP - g.touch.BN),
    CN_CQ: sig(g.touch.CN - g.touch.CQ),
    DQ_DM: sig(g.touch.DQ - g.touch.DM),
    max: sig(g.residuals.tangents),
  };
  return {
    valid: g.valid,
    reason: g.reason,
    board: { width: C.WIDTH, height: C.HEIGHT },
    circle: { center: pt(s.O)!, radius: round(s.r) },
    getCircle: {
      fromDots: ["M", "Q", "N"],
      center: pt(recovered.O), radius: round(recovered.r),
      centerGap: sig(C.dist(recovered.O, s.O)), radiusGap: sig(recovered.r - s.r),
    },
    dots: {
      M: pt(s.M)!, Q: pt(s.Q)!, N: pt(s.N)!, P: pt(s.P)!,
    },
    corners: Object.fromEntries(CORNERS.map((name) => [name, pt(g.v[name])])) as Record<Corner, Pt | null>,
    sides: {
      AB: round(g.sides.AB), BC: round(g.sides.BC),
      CD: round(g.sides.CD), DA: round(g.sides.DA),
    },
    tangentSegments: Object.fromEntries(
      Object.entries(roundT).map(([k, v]) => [k, round(v)]),
    ) as unknown as Rounded<Touch>,
    equalTangents: eq,
    residuals: {
      pitot: sig(g.residuals.pitot), exscriptibleB: sig(g.residuals.exscriptibleB),
      exscriptibleA: sig(g.residuals.exscriptibleA), tangents: eq.max,
    },
    tolerance: sig(tol),
    inscribed: g.inscribed,
    matchingPairs: g.valid ? pairs.filter((p) => Math.abs(p.value) <= tol).map((p) => p.name) : [],
    result: C.result(s),
  };
}

const CONVERSE_NOTE =
  "The page remarks that the usual proof of the converse has a subtle flaw, but the converse is true for a convex tangential quadrilateral: equal opposite sums do bring an incircle. This core starts with a circle, so it measures the forward direction and the exscriptible alternatives rather than constructing an incircle from four side lengths.";

/** The compact fields worth comparing across pictures. */
function summary(r: Reading) {
  return {
    valid: r.valid,
    circle: r.circle,
    dots: r.dots,
    inscribed: r.inscribed,
    sides: r.sides,
    tangentSegments: r.tangentSegments,
    equalTangentMaxError: r.equalTangents.max,
    residuals: r.residuals,
    tolerance: r.tolerance,
    matchingPairs: r.matchingPairs,
  };
}

export function actions(): GameActions {
  return {
    equal_tangents_and_pitot: {
      describe:
        "For four dots M, Q, N, P on a circle (each [x, y] or { x, y } in the applet's 400 x 250 board, y down; a supplied dot is clamped to the board and snapped onto the circle, as a page drag is), optionally with circle centre O, radius r and/or four central angles in radians angles = [M, Q, N, P] (defaults: the opening picture), run the real core and report the six tangent-line intersections A, B, C, D, S, T, the four side lengths, the eight tangent segments and their signed residuals. Equal tangents from each corner (AM = AP, BP = BN, CN = CQ, DQ = DM) give AB + CD = BC + DA when the circle is inside; when it leaves the figure one of the exscriptible pairings AB + BC = CD + DA or AB + DA = BC + CD holds instead. This differs from incircles-in-quadri, which compares the feet of four triangle incircles on two diagonals rather than one circle touching all four sides. Refuses a figure whose tangents are parallel and cannot be drawn.",
      args: '{"angles":[0.4,1.2,2.9,4.6]}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        if (!r.valid) {
          throw new Error(
            `those dots make no quadrilateral (${r.reason ?? "parallel tangents"}): the core's Compute() returns no A, B, C, D; drag a dot away from the one opposite it`,
          );
        }
        const corners = ["A", "B", "C", "D"].map((name) => {
          const p = r.corners[name as Corner]!;
          return `${name} at (${p.x}, ${p.y})`;
        }).join(", ");
        return {
          ...r,
          note:
            `The core puts ${corners}. From each corner the two tangent pieces agree to ${r.equalTangents.max} board units: ` +
            `AM - AP = ${r.equalTangents.AM_AP}, BP - BN = ${r.equalTangents.BP_BN}, ` +
            `CN - CQ = ${r.equalTangents.CN_CQ}, DQ - DM = ${r.equalTangents.DQ_DM}. ` +
            `Adding them leaves AB + CD - BC - DA = ${r.residuals.pitot}, and the circle is ` +
            `${r.inscribed ? "inside the figure" : "outside the figure"}; the matching pairing here is ` +
            `${r.matchingPairs.join("; ") || "none"}. The applet's GetCircle from M, Q, N recovers the centre to ` +
            `${r.getCircle.centerGap} and the radius to ${r.getCircle.radiusGap} board units. ` +
            `This is an illustration, so there is no win or loss. ${CONVERSE_NOTE}`,
        };
      },
    },

    inside_and_exscriptible: {
      describe:
        "Compare three pictures measured by the real core: the opening one (P at 4.6 radians, circle inside, Pitot's AB + CD = BC + DA), one with P at 1.6 radians (circle outside, AB + BC = CD + DA), and one with P at 0 radians (circle outside, AB + DA = BC + CD). Pass O, r, angles or any dots M, Q, N, P as in equal_tangents_and_pitot to add a reading of your own picture. Each report gives the sides, the eight tangent pieces, all three signed residuals and which pairing matches to the core's floating-point tolerance. The repaired converse says a convex quadrilateral with equal opposite sums really does have an incircle, even though the usual proof is flawed; the core here starts from the circle.",
      args: "{}",
      run: (args) => {
        const C = core();
        const supplied = HANDLES.some((n) => args[n] !== undefined && args[n] !== null)
          || ["O", "r", "angles"].some((k) => args[k] !== undefined && args[k] !== null);
        const opening = reading(C, C.start());
        const outsideB = reading(C, C.start({ angles: { P: 1.6 } }));
        const outsideA = reading(C, C.start({ angles: { P: 0 } }));
        const yours = supplied ? reading(C, buildState(C, args)) : null;
        for (const [name, r] of [
          ["the opening", opening], ["P = 1.6", outsideB],
          ["P = 0", outsideA], ["your picture", yours],
        ] as [string, Reading | null][]) {
          if (r && !r.valid) {
            throw new Error(`${name} has parallel tangents, so the core cannot draw its quadrilateral`);
          }
        }
        return {
          source: supplied
            ? "the opening picture, two exscriptible positions, and the supplied dots or circle"
            : "the opening picture and two exscriptible positions from the core's opening angles",
          openingInside: summary(opening),
          outsideAtP16: summary(outsideB),
          outsideAtP0: summary(outsideA),
          yours: yours ? summary(yours) : null,
          comparison: {
            openingPitot: opening.residuals.pitot,
            outsideBExscriptible: outsideB.residuals.exscriptibleB,
            outsideAExscriptible: outsideA.residuals.exscriptibleA,
            allTangentEqualitiesHold:
              [opening, outsideB, outsideA, ...(yours ? [yours] : [])]
                .every((r) => Math.abs(r.equalTangents.max!) <= r.tolerance!),
            inscribedFlags: [opening.inscribed, outsideB.inscribed, outsideA.inscribed],
          },
          note:
            `Inside, AB + CD - BC - DA = ${opening.residuals.pitot} while the two exscriptible sums miss by ` +
            `${opening.residuals.exscriptibleB} and ${opening.residuals.exscriptibleA}. With P at 1.6 radians the circle is outside: ` +
            `Pitot misses by ${outsideB.residuals.pitot} but AB + BC - CD - DA = ${outsideB.residuals.exscriptibleB}. ` +
            `With P at 0 radians the other excircle applies: AB + DA - BC - CD = ${outsideA.residuals.exscriptibleA}. ` +
            `In all three the eight tangent pieces agree to the core's tolerance, so it is only the pairing of sides that changes. ` +
            `${CONVERSE_NOTE} This is an illustration, so there is no win or loss.`,
        };
      },
    },
  };
}

/** Track.state saved the whole core state here: rebuild it, validating fields. */
function savedState(C: Core, state: Json): { s: State; saved: Json; savedReadable: boolean } {
  const home = C.start();
  let savedReadable = true;
  let O = home.O;
  let r = home.r;
  try {
    O = readPoint(state.O, "saved O");
  } catch {
    savedReadable = false;
  }
  try {
    r = readFinite(state.r, "saved r");
    if (!(r > 0)) throw new Error("non-positive radius");
  } catch {
    savedReadable = false;
    r = home.r;
  }
  let s = C.start({ O, r });
  const dots: Json = {};
  for (const name of HANDLES) {
    try {
      const p = readPoint(state[name], `saved ${name}`);
      const next = C.move(s, { type: "point", name, point: p });
      if (!next) throw new Error("dot cannot be placed");
      s = next;
      dots[name] = pt(p);
    } catch {
      savedReadable = false;
      dots[name] = null; // keep the opening dot for that handle
    }
  }
  const switches: Json = {};
  for (const key of OPTIONS) {
    const v = state[key];
    if (typeof v === "boolean") {
      s = { ...s, [key]: v };
      switches[key] = v;
    } else {
      savedReadable = false;
      switches[key] = null;
    }
  }
  const moves = typeof state.moves === "number" && Number.isFinite(state.moves) ? state.moves : null;
  if (moves === null) savedReadable = false; else s = { ...s, moves };
  const explored = typeof state.explored === "boolean" ? state.explored : null;
  if (explored === null) savedReadable = false; else s = { ...s, explored };
  return {
    s,
    saved: { O: pt(O), r: round(r), ...dots, ...switches, moves, explored },
    savedReadable,
  };
}

/** Echo the saved fields, then re-measure that picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Inscriptible Quadri state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Inscriptible Quadri position must be an object");
  }
  const C = core();
  const { s, saved, savedReadable } = savedState(C, state);
  const r = reading(C, s);
  const distances = HANDLES.map((name) => {
    try {
      return Math.abs(C.dist(readPoint(state[name], name), s.O) - s.r);
    } catch {
      return null;
    }
  }).filter((v): v is number => v !== null);
  const onCircleGap = distances.length ? Math.max(...distances) : null;
  const dotsOnCircle = onCircleGap !== null && onCircleGap <= 1e-6 * Math.max(1, s.r);
  return {
    ...state,
    stateVersion,
    saved,
    savedReadable,
    dotsOnCircle,
    onCircleGap: sig(onCircleGap ?? NaN),
    valid: r.valid,
    reading: r,
    result: C.result(s),
    note:
      !savedReadable
        ? "Some saved fields could not be read, so the opening picture was substituted for them; the core reading below comes from that rebuilt state. "
        : "Track.state saved the whole core state: the circle's centre and radius, the four dots on it, the four switches, the move count and the explored flag. "
        + `The saved dots are ${dotsOnCircle ? "on" : "not all on"} the saved circle (worst gap ${sig(onCircleGap ?? NaN)} units). `
        + (!r.valid
          ? "Two tangents are parallel in this saved figure, so the core draws no quadrilateral and there is nothing to measure. "
          : `The core rebuilds A, B, C and D and measures AB + CD - BC - DA = ${r.residuals.pitot}, with the circle ${r.inscribed ? "inside" : "outside"}; the matching pairing is ${r.matchingPairs.join("; ") || "none"}. The applet's GetCircle from M, Q, N recovers the saved centre to ${r.getCircle.centerGap} and the radius to ${r.getCircle.radiusGap} units. `)
        + `${CONVERSE_NOTE} This is an illustration, so there is no win or loss.`,
  };
}
