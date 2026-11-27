/*
 * run_game_logic actions and saved-position reader for Circles And Regular
 * Triangle (Bogomolny's Tangent Circles and an Isosceles Triangle, an 1803
 * Sangaku problem). Circle S has centre O and diameter AC; B slides along AC;
 * circle G has diameter AB; E sits on S above the midpoint D of BC; and the
 * small circle W, centre Q, is tucked between S, G and the side BE.
 *
 * The claim is that QB is perpendicular to AC, and it is true together with
 * three tangencies at every position of B on the open segment AC. The applet's
 * title says "regular triangle", but the page states an isosceles triangle
 * BCE: EB = EC for every B, while EB = BC only when B is the midpoint of AC.
 * Every number below comes from the real core
 * (circles-and-regular-triangle/circles-and-regular-triangle-core.js), copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 * Coordinates are board units in the page's 400 x 250 viewBox, y down.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () =>
  cores["circles-and-regular-triangle"].CirclesAndRegularTriangleCore as any;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type State = {
  A: Point; B: Point; C: Point; O: Point;
  showNames: boolean; showPremise: boolean; showStatement: boolean; showColors: boolean;
};
type Geometry = {
  A: Point; B: Point; C: Point; O: Point;
  D: Point | null; E: Point | null; P: Point | null; Q: Point | null;
  big: Circle; mid: Circle | null; small: Circle | null;
  tangencyBig: Point | null; tangencyMid: Point | null;
  noDraw: boolean; qbAngle: number; ab: number; eq: number;
};

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const deg = (v: number): number => (v * 180) / Math.PI;
/** Core numbers (including NaN) as plain JSON numbers or null. */
const num6 = (v: number): number | null => (Number.isFinite(v) ? r6(v) : null);
const sig = (v: number): number | null =>
  Number.isFinite(v) ? Number(v.toExponential(2)) : null;
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r6(p.x), y: r6(p.y) }
    : null;
const circleView = (c: Circle | null | undefined) =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)
    ? { center: { x: r6(c.x), y: r6(c.y) }, radius: r6(c.r) }
    : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

function readPoint(v: unknown, key: string, fallback?: Point): Point {
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing required argument "${key}"`);
  }
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    x = num({ x: v[0] }, "x");
    y = num({ y: v[1] }, "y");
  } else if (typeof v === "object") {
    const o = v as Json;
    x = num(o, "x");
    y = num(o, "y");
  } else {
    throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${key}" needs finite x and y`);
  }
  return { x, y };
}

/**
 * Build a core state. A, C and O default to the fixed diameter; B defaults to
 * the applet's opening position. The page fixes B's y and clamps its x to the
 * board, so a supplied drawing must respect that horizontal diameter.
 */
function readState(C: Core, args: Json, requireDraw = true): State {
  const home = C.start({});
  const A = readPoint(args.A, "A", home.A);
  const Cc = readPoint(args.C, "C", home.C);
  const O = readPoint(args.O, "O", home.O);
  const B = readPoint(args.B, "B", home.B);

  if (!near(A.y, Cc.y, 1e-6) || !near(O.y, A.y, 1e-6) ||
      !near(O.x, (A.x + Cc.x) / 2, 1e-6) || !(A.x < Cc.x)) {
    throw new Error("O must be the midpoint of a horizontal diameter AC");
  }
  if (!near(B.y, A.y, 1e-6)) {
    throw new Error("B must lie on the diameter AC: the page fixes its y");
  }
  if (B.x < C.MARGIN - 1e-6 || B.x > C.WIDTH - C.MARGIN + 1e-6) {
    throw new Error(`B is outside the ${C.WIDTH} by ${C.HEIGHT} board (margin ${C.MARGIN})`);
  }
  if (requireDraw && !(B.x > A.x && B.x < Cc.x)) {
    throw new Error("B must lie strictly between A and C: outside the segment the applet draws nothing");
  }
  return C.start({
    A, B, C: Cc, O,
    showNames: args.showNames === true,
    showPremise: args.showPremise === true,
    showStatement: args.showStatement === true,
    showColors: args.showColors === true,
  }) as State;
}

type Measured = {
  g: Geometry;
  residual: {
    bigSmall: number; midSmall: number; bigMidAtA: number; smallSideBE: number;
    qbAngle: number; qAboveB: number; isosceles: number; equilateral: number;
    bigContact: number; smallContact: number; midContact: number; smallMidContact: number;
  };
  perpendicular: boolean;
  tangenciesHold: boolean;
  contactsOnCircles: boolean;
  isosceles: boolean;
  equilateral: boolean;
  aboveB: boolean;
};

/** Recompute the whole picture and measure every claim the page makes. */
function measure(C: Core, s: State): Measured {
  const g = C.compute(s) as unknown as Geometry;
  const tol = 1e-6 * Math.max(1, g.big.r);
  const { A, B, C: Cc, O, D, E, P, Q, big, mid, small, tangencyBig, tangencyMid } = g;
  const residual = {
    // S and W touch internally, G and W externally, and G sits inside S at A.
    bigSmall: mid && small && Q ? C.dist(O, Q) + small.r - big.r : NaN,
    midSmall: mid && small && P && Q ? C.dist(P, Q) - (mid.r + small.r) : NaN,
    bigMidAtA: mid && P ? C.dist(O, P) + mid.r - big.r : NaN,
    smallSideBE: E && small && Q
      ? Math.abs(C.cross(B, E, Q)) / Math.max(1e-9, C.dist(B, E)) - small.r
      : NaN,
    qbAngle: g.qbAngle - Math.PI / 2,
    qAboveB: Q ? Q.x - B.x : NaN,
    isosceles: g.eq,                                   // |BE| - |CE|
    equilateral: E ? C.dist(B, E) - C.dist(B, Cc) : NaN, // |BE| - |BC|
    bigContact: tangencyBig ? C.dist(O, tangencyBig) - big.r : NaN,
    smallContact: small && tangencyBig ? C.dist(small, tangencyBig) - small.r : NaN,
    midContact: mid && tangencyMid ? C.dist(mid, tangencyMid) - mid.r : NaN,
    smallMidContact: small && tangencyMid ? C.dist(small, tangencyMid) - small.r : NaN,
  };
  const tangentHolds = (v: number) => near(v, 0, tol);
  const tangenciesHold = g.noDraw === false && !!(mid && small && Q && E) &&
    tangentHolds(residual.bigSmall) && tangentHolds(residual.midSmall) &&
    tangentHolds(residual.bigMidAtA) && tangentHolds(residual.smallSideBE);
  const contactsOnCircles = g.noDraw === false && !!(tangencyBig && tangencyMid && small) &&
    tangentHolds(residual.bigContact) && tangentHolds(residual.smallContact) &&
    tangentHolds(residual.midContact) && tangentHolds(residual.smallMidContact);
  return {
    g, residual,
    perpendicular: g.noDraw === false && !!Q && near(residual.qbAngle, 0, 1e-6),
    tangenciesHold,
    contactsOnCircles,
    isosceles: g.noDraw === false && !!E && near(residual.isosceles, 0, tol),
    equilateral: g.noDraw === false && !!E && near(residual.equilateral, 0, tol),
    aboveB: g.noDraw === false && !!Q && near(residual.qAboveB, 0, 1e-6),
  };
}

/** Tutor-friendly view of one measured drawing. */
function reading(m: Measured) {
  const { g, residual } = m;
  return {
    noDraw: g.noDraw,
    points: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C), O: pt(g.O),
      D: pt(g.D), E: pt(g.E), P: pt(g.P), Q: pt(g.Q),
    },
    circles: { S: circleView(g.big), G: circleView(g.mid), W: circleView(g.small) },
    qb: {
      angleRadians: num6(g.qbAngle),
      angleDegrees: num6(deg(g.qbAngle)),
      perpendicularToAC: m.perpendicular,
      angleResidualRadians: sig(residual.qbAngle),
      qDirectlyAboveB: m.aboveB,
      xGap: sig(residual.qAboveB),
    },
    tangencies: {
      S_and_W_inside: { residual: sig(residual.bigSmall), holds: m.tangenciesHold && near(residual.bigSmall, 0, 1e-6 * Math.max(1, g.big.r)) },
      G_and_W_outside: { residual: sig(residual.midSmall), holds: near(residual.midSmall, 0, 1e-6 * Math.max(1, g.big.r)) },
      S_and_G_at_A: { residual: sig(residual.bigMidAtA), holds: near(residual.bigMidAtA, 0, 1e-6 * Math.max(1, g.big.r)) },
      W_and_side_BE: { distanceMinusRadius: sig(residual.smallSideBE), holds: near(residual.smallSideBE, 0, 1e-6 * Math.max(1, g.big.r)) },
      contactPoints: {
        S_W: pt(g.tangencyBig), G_W: pt(g.tangencyMid),
        onBothCircles: m.contactsOnCircles,
        distanceResiduals: {
          S: sig(residual.bigContact), W_at_S: sig(residual.smallContact),
          G: sig(residual.midContact), W_at_G: sig(residual.smallMidContact),
        },
      },
      allHold: m.tangenciesHold,
    },
    triangle: {
      AB: num6(g.ab),
      AC: num6(Math.abs(g.C.x - g.A.x)),
      BC: num6(g.E ? Math.hypot(g.B.x - g.C.x, g.B.y - g.C.y) : NaN),
      BE: num6(g.E ? Math.hypot(g.B.x - g.E.x, g.B.y - g.E.y) : NaN),
      CE: num6(g.E ? Math.hypot(g.C.x - g.E.x, g.C.y - g.E.y) : NaN),
      isosceles: m.isosceles,
      isoscelesResidual: sig(residual.isosceles),
      equilateral: m.equilateral,
      equilateralResidual: sig(residual.equilateral),
    },
  };
}

export function actions(): GameActions {
  return {
    inscribed_circles: {
      describe:
        "For B on the diameter AC of circle S (centre O), report the three circles S (diameter AC), G (diameter AB) and W (centre Q, tucked between S, G and the side BE), the apex E of triangle BCE over the midpoint D of BC, and the point of contact of each pair. Check that QB is perpendicular to AC (the angle QBA is 90° and Q has B's x-coordinate), that W touches S from inside, G from outside and the side BE, and that BCE is isosceles. Give B as {x, y} or [x, y]; omit it for the opening position B = (220, 125). A, C and O may be supplied as well but must form the fixed horizontal diameter. Naming caveat: the applet says 'regular triangle', yet BCE is isosceles for every B and equilateral only when B is the midpoint of AC.",
      args: '{ "B": { "x": 222, "y": 125 } }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const m = measure(C, s);
        const midpoint = (s.A.x + s.C.x) / 2;
        return {
          ...reading(m),
          options: {
            showNames: s.showNames === true, showPremise: s.showPremise === true,
            showStatement: s.showStatement === true, showColors: s.showColors === true,
          },
          equilateralAtX: r6(midpoint),
          note: m.g.noDraw
            ? "B is not strictly between A and C, so the applet draws no circles and no triangle to check."
            : `Q sits at (${num6(m.g.Q!.x)}, ${num6(m.g.Q!.y)}), directly above B, so QB meets the horizontal diameter AC at ${num6(deg(m.g.qbAngle))}°. W (radius ${num6(m.g.small!.r)}) touches S, G and the side BE; BE = CE, so BCE is isosceles. It is equilateral only when B is the midpoint of AC at x = ${r6(midpoint)} — the applet's title is true at that one position.`,
          status: C.describe(s),
        };
      },
    },

    slide_b: {
      describe:
        "Keep the diameter AC fixed and slide B to several fractions t of the way from A to C (0 < t < 1). For each position report B, W's radius, the angle QBA, whether QB is perpendicular to AC, all three tangencies, and whether BCE is isosceles or equilateral. The reported spread of the QB angle checks that it stays 90°; equilateral is expected only at t = 0.5. Accept ts as an array of 2 to 12 fractions; the opening diameter A = (100, 125), C = (300, 125) is used unless A, C and O are supplied.",
      args: '{ "ts": [0.1, 0.25, 0.5, 0.75, 0.9] }',
      run: (args) => {
        const C = core();
        const base = readState(C, args, false);
        const raw = args.ts === undefined || args.ts === null
          ? [0.1, 0.25, 0.5, 0.75, 0.9]
          : numArray(args, "ts");
        if (raw.length < 2 || raw.length > 12) {
          throw new Error('"ts" must list between 2 and 12 positions');
        }
        if (raw.some((t) => !(t > 0 && t < 1))) {
          throw new Error("every t must lie strictly between 0 and 1 (at A or C the applet draws nothing)");
        }
        const samples = raw.map((t) => {
          const B = { x: base.A.x + t * (base.C.x - base.A.x), y: base.A.y };
          const m = measure(C, C.start({ A: base.A, B, C: base.C, O: base.O }) as State);
          return {
            t: r6(t),
            B: pt(B),
            radiusW: num6(m.g.small ? m.g.small.r : NaN),
            qbAngleDegrees: num6(deg(m.g.qbAngle)),
            perpendicular: m.perpendicular,
            tangenciesHold: m.tangenciesHold,
            isosceles: m.isosceles,
            equilateral: m.equilateral,
            noDraw: m.g.noDraw,
          };
        });
        const angles = samples
          .map((v) => v.qbAngleDegrees)
          .filter((v): v is number => v !== null);
        const spread = angles.length ? r6(Math.max(...angles) - Math.min(...angles)) : null;
        return {
          diameter: { A: pt(base.A), C: pt(base.C), O: pt(base.O) },
          samples,
          invariants: {
            qbAngleSpreadDegrees: spread,
            qbAlwaysPerpendicular: samples.every((v) => v.perpendicular),
            tangenciesAlwaysHold: samples.every((v) => v.tangenciesHold),
            triangleAlwaysIsosceles: samples.every((v) => v.isosceles),
            equilateralAt: samples.filter((v) => v.equilateral).map((v) => v.t),
          },
          note:
            `Q keeps B's x-coordinate at all ${samples.length} positions, so the QB angle spread is ${spread}°: QB is always perpendicular to AC. W stays tangent to S, G and BE and BCE stays isosceles; it is equilateral only at the midpoint (t = 0.5). Despite the applet's title, 'regular triangle' describes only that midpoint.`,
        };
      },
    },
  };
}

function savedPoint(v: unknown): Point | null {
  try {
    return readPoint(v, "saved point");
  } catch {
    return null;
  }
}

function savedCircle(v: unknown, key: string): Circle | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Json;
  try {
    return { x: num(o, "x"), y: num(o, "y"), r: num(o, "r") };
  } catch {
    throw new Error(`saved ${key} must be a circle { "x": number, "y": number, "r": number }`);
  }
}

/** What the core says about the illustration the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circles And Regular Triangle state version ${stateVersion}`);
  }
  const C = core();
  const s = readState(C, state, false);
  const m = measure(C, s);
  const g = m.g;
  const savedAngle = Number.isFinite(Number(state.qbAngle))
    ? Number(state.qbAngle)
    : NaN;
  const gapPt = (a: Point | null, b: Point | null): number | null =>
    a && b ? r6(C.dist(a, b)) : null;
  const gapCircle = (a: Circle | null, b: Circle | null): number | null =>
    a && b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.r)
      ? r6(Math.max(C.dist(a, b), Math.abs(a.r - b.r)))
      : null;
  const gaps = {
    D: gapPt(savedPoint(state.D), g.D),
    E: gapPt(savedPoint(state.E), g.E),
    P: gapPt(savedPoint(state.P), g.P),
    Q: gapPt(savedPoint(state.Q), g.Q),
    big: gapCircle(savedCircle(state.big, "big"), g.big),
    mid: gapCircle(savedCircle(state.mid, "mid"), g.mid),
    small: gapCircle(savedCircle(state.small, "small"), g.small),
    qbAngle: Number.isFinite(savedAngle) && Number.isFinite(g.qbAngle)
      ? r6(Math.abs(savedAngle - g.qbAngle))
      : null,
  };
  const matchesSaved = Object.values(gaps).every((gap) => gap !== null && gap < 1e-3);
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged (NaN -> null).
    A: pt(s.A), B: pt(s.B), C: pt(s.C), O: pt(s.O),
    D: pt(savedPoint(state.D)), E: pt(savedPoint(state.E)),
    P: pt(savedPoint(state.P)), Q: pt(savedPoint(state.Q)),
    big: circleView(savedCircle(state.big, "big")),
    mid: circleView(savedCircle(state.mid, "mid")),
    small: circleView(savedCircle(state.small, "small")),
    qbAngle: num6(savedAngle),
    noDraw: state.noDraw === true,
    reading: reading(m),
    agreement: { gaps, matchesSaved },
    note: g.noDraw
      ? "B is outside the open segment AC in the saved drawing, so the core draws no circles and no triangle."
      : matchesSaved
        ? `The saved drawing is reproduced: Q is at (${num6(g.Q!.x)}, ${num6(g.Q!.y)}) directly above B, so QB meets AC at ${num6(deg(g.qbAngle))}°, and W touches S, G and BE. BCE is isosceles; it would be equilateral only if B were at the midpoint of AC (x = ${r6((s.A.x + s.C.x) / 2)}), which is what the applet's 'regular triangle' title means.`
        : "The core recomputes a drawing that differs from the saved one; compare the agreement gaps with the recomputed reading.",
  };
}
