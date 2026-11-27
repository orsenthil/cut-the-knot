/*
 * run_game_logic actions and saved-position reader for Feuerbach's Theorem:
 * a Proof.
 *
 * For the excircles opposite B and C, let B', C' be their feet on BC, L the
 * midpoint of B'C' (also of BC), and w the circle with centre L and radius
 * LB' = LC'. Then BB' = CC' = (a+b+c)/2, LB' = LC' = (b+c)/2, and the foot P
 * of the altitude from A and the intersection S of BC with the line of the two
 * excentres are inverse points: LP*LS = LB'^2. The circle w is orthogonal to
 * both excircles (so inversion fixes them), while the nine-point circle
 * through K, L, M passes through L and so inverts to a line: the second common
 * external tangent. A line tangent to both excircles proves, after inverting
 * back, that the nine-point circle touches both.
 *
 * Every number below is measured on the real core
 * feuerbach-proof/feuerbach-proof-core.js, copied into src/generated/cores/
 * at build time. Coordinates are board units in the page's 400 x 250 viewBox,
 * y down. This is an illustration: it has no win or loss. See _shared.ts for
 * the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Ring = { x: number; y: number; r: number };
type Line = { p: Pt; q: Pt };
type State = {
  A: Pt; B: Pt; C: Pt;
  showNames: boolean; showAngles: boolean; showCircle: boolean; showNPCircle: boolean;
};
type Geometry = {
  valid: boolean;
  A: Pt; B: Pt; C: Pt; K: Pt; L: Pt; M: Pt;
  P: Pt; S: Pt; Bp: Pt; Cp: Pt; Bd: Pt; Cd: Pt; X: Pt; Y: Pt; Z: Pt;
  CN: Ring; Cb: Ring; Cc: Ring; Invert: Ring;
  centerLine: Line; secondTangent: Line;
  sides: { a: number; b: number; c: number };
};
type Core = {
  WIDTH: number; HEIGHT: number; EDGE: number; TANGENT_CUT: number;
  start(options?: Json): Json;
  setPoint(state: Json, name: string, p: Pt): Json;
  setFlag(state: Json, name: string, on: boolean): Json;
  geometry(state: Json): Geometry;
  describe(state: Json): string;
  dist(p: Pt, q: Pt): number;
  result(state: Json): unknown;
};

const core = (): Core =>
  cores["feuerbach-proof"].FeuerbachProofCore as unknown as Core;

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/** Residuals are tiny; keep their size and sign rather than printing zero. */
const sig = (v: number): number => (Number.isFinite(v) ? Number(v.toExponential(2)) : NaN);
const close = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const pt = (p: Pt): Pt => ({ x: round(p.x), y: round(p.y) });
const ring = (c: Ring): { center: Pt; radius: number } =>
  ({ center: pt(c), radius: round(c.r) });
const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const dist = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y);
/** Perpendicular distance from p to the infinite line through a and b. */
const lineDist = (p: Pt, a: Pt, b: Pt): number => {
  const d = dist(a, b);
  return d > 0
    ? Math.abs((b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y)) / d
    : NaN;
};
/** Where p sits on the line a -> b, in units of |ab| (0 at a, 1 at b). */
const lineParam = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x, dy = b.y - a.y;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
};
const angleAt = (o: Pt, p: Pt, q: Pt): number => {
  const u = { x: p.x - o.x, y: p.y - o.y };
  const v = { x: q.x - o.x, y: q.y - o.y };
  const denom = dist(o, p) * dist(o, q);
  return denom > 0
    ? Math.acos(clamp((u.x * v.x + u.y * v.y) / denom, -1, 1))
    : NaN;
};
/** Inversion in the circle with centre o and radius r. */
const invert = (p: Pt, o: Pt, r: number): Pt => {
  const dx = p.x - o.x, dy = p.y - o.y;
  const t = (r * r) / (dx * dx + dy * dy);
  return { x: o.x + t * dx, y: o.y + t * dy };
};

/** Tool arguments may use [x, y]; the page saves corners as { x, y }. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (raw && typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** A real core state: corners applied as page drags, flags as panel checkboxes. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of optional corners A, B, C and display flags");
  }
  let s = C.start({
    showNames: readBool(args, "showNames", true),
    showAngles: readBool(args, "showAngles", true),
    showCircle: readBool(args, "showCircle", false),
    showNPCircle: readBool(args, "showNPCircle", false),
  }) as State;
  for (const name of ["A", "B", "C"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) {
      s = C.setPoint(s, name, readPoint(raw, name)) as State;
    }
  }
  return s;
}

function geometryFor(C: Core, s: State): Geometry {
  const g = C.geometry(s);
  if (!g || !g.valid) {
    throw new Error("A, B and C are collinear or too close: the core cannot draw the excircles, the inversion circle and the nine-point circle");
  }
  return g;
}

/** Every claim of the proof, measured on the core's own construction. */
function reading(C: Core, s: State, g: Geometry) {
  const { a, b, c } = g.sides;
  const semi = (a + b + c) / 2;
  const BBp = C.dist(g.B, g.Bp), CCp = C.dist(g.C, g.Cp);
  const LBp = C.dist(g.L, g.Bp), LCp = C.dist(g.L, g.Cp);
  const LP = C.dist(g.L, g.P), LS = C.dist(g.L, g.S);
  const power = g.Invert.r * g.Invert.r;
  const invP = invert(g.P, g.L, g.Invert.r);
  const rb = g.Cb.r, rc = g.Cc.r, rw = g.Invert.r;
  const dCb2 = C.dist(g.L, g.Cb) ** 2, dCc2 = C.dist(g.L, g.Cc) ** 2;
  const ratio = rb / rc;
  const ratioA = C.dist(g.A, g.Cb) / C.dist(g.A, g.Cc);
  const ratioS = C.dist(g.S, g.Cb) / C.dist(g.S, g.Cc);
  const tA = lineParam(g.A, g.Cb, g.Cc), tS = lineParam(g.S, g.Cb, g.Cc);
  const dCbLine = lineDist(g.Cb, g.Bd, g.Cd);
  const dCcLine = lineDist(g.Cc, g.Bd, g.Cd);
  const angL = angleAt(g.L, g.X, g.K);
  const angM = angleAt(g.M, g.K, g.L);
  const angB = angleAt(g.B, g.A, g.C);
  const images = {
    K: invert(g.K, g.L, rw), M: invert(g.M, g.L, rw), P: invP,
  };
  const imageGaps = {
    K: lineDist(images.K, g.Bd, g.Cd),
    M: lineDist(images.M, g.Bd, g.Cd),
    P: lineDist(images.P, g.Bd, g.Cd),
  };
  // A circle through L, centred g.CN.r away with radius g.CN.r, inverts to a
  // line perpendicular to L->CN at distance rw^2/(2*g.CN.r) from L.
  const imageLineDistance = rw * rw / (2 * g.CN.r);
  const tangentLineDistance = lineDist(g.L, g.Bd, g.Cd);
  const dCbNine = C.dist(g.CN, g.Cb), dCcNine = C.dist(g.CN, g.Cc);
  const area2 = (g.B.x - g.A.x) * (g.C.y - g.A.y) - (g.B.y - g.A.y) * (g.C.x - g.A.x);
  const perimeter = a + b + c;
  const incenter = {
    x: (a * g.A.x + b * g.B.x + c * g.C.x) / perimeter,
    y: (a * g.A.y + b * g.B.y + c * g.C.y) / perimeter,
  };
  const inradius = Math.abs(area2) / perimeter;
  const dNineIn = C.dist(g.CN, incenter);
  const expectedIn = Math.abs(g.CN.r - inradius);

  return {
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    sides: { a: round(a), b: round(b), c: round(c), semiperimeter: round(semi) },
    midpoints: { K: pt(g.K), L: pt(g.L), M: pt(g.M) },
    points: {
      P: pt(g.P), S: pt(g.S), Bp: pt(g.Bp), Cp: pt(g.Cp),
      Bd: pt(g.Bd), Cd: pt(g.Cd), X: pt(g.X), Y: pt(g.Y), Z: pt(g.Z),
    },
    circles: {
      ninePoint: ring(g.CN), excircleB: ring(g.Cb), excircleC: ring(g.Cc),
      inversion: ring(g.Invert),
    },
    equalLengths: {
      BBp: {
        measured: round(BBp), formula: "(a+b+c)/2", expected: round(semi),
        residual: sig(BBp - semi), holds: close(BBp, semi),
      },
      CCp: {
        measured: round(CCp), formula: "(a+b+c)/2", expected: round(semi),
        residual: sig(CCp - semi), holds: close(CCp, semi),
      },
      LBp: {
        measured: round(LBp), formula: "(b+c)/2", expected: round((b + c) / 2),
        residual: sig(LBp - (b + c) / 2), holds: close(LBp, (b + c) / 2),
      },
      LCp: {
        measured: round(LCp), formula: "(b+c)/2", expected: round((b + c) / 2),
        residual: sig(LCp - (b + c) / 2), holds: close(LCp, (b + c) / 2),
      },
      LIsMidpointOfBC: close(C.dist(g.L, mid(g.B, g.C)), 0),
      LIsMidpointOfBpCp: close(C.dist(g.L, mid(g.Bp, g.Cp)), 0),
    },
    inversePair: {
      LP: round(LP), LS: round(LS), product: round(LP * LS), radiusSquared: round(power),
      residual: sig(LP * LS - power), holds: close(LP * LS, power),
      inverseOfP: pt(invP), S: pt(g.S),
      inverseGap: round(dist(invP, g.S)), imagesAgree: close(dist(invP, g.S), 0),
    },
    orthogonality: {
      Cb: {
        centreDistanceSquared: round(dCb2), radiiSquaredSum: round(rb * rb + rw * rw),
        residual: sig(dCb2 - rb * rb - rw * rw),
        orthogonal: close(dCb2, rb * rb + rw * rw),
      },
      Cc: {
        centreDistanceSquared: round(dCc2), radiiSquaredSum: round(rc * rc + rw * rw),
        residual: sig(dCc2 - rc * rc - rw * rw),
        orthogonal: close(dCc2, rc * rc + rw * rw),
      },
    },
    harmonicDivision: {
      AOffCentreLine: round(lineDist(g.A, g.Cb, g.Cc)),
      SOffCentreLine: round(lineDist(g.S, g.Cb, g.Cc)),
      ACbOverACc: {
        measured: round(ratioA), expected: round(ratio), residual: sig(ratioA - ratio),
        holds: close(ratioA, ratio),
      },
      SCbOverSCc: {
        measured: round(ratioS), expected: round(ratio), residual: sig(ratioS - ratio),
        holds: close(ratioS, ratio),
      },
      twoTProductMinusSum: sig(2 * tA * tS - tA - tS),
      holds: close(2 * tA * tS - tA - tS, 0),
    },
    secondTangent: {
      through: { reflectionOfBp: pt(g.Bd), reflectionOfCp: pt(g.Cd) },
      distancesFromCentres: {
        Cb: round(dCbLine), CbRadius: round(rb),
        Cc: round(dCcLine), CcRadius: round(rc),
      },
      CbTouches: close(dCbLine, rb), CcTouches: close(dCcLine, rc),
      SOnLine: close(lineDist(g.S, g.Bd, g.Cd), 0),
      anglesDegrees: {
        XLK: round((angL * 180) / Math.PI), KML: round((angM * 180) / Math.PI),
        ABC: round((angB * 180) / Math.PI),
        equal: close(angL, angM) && close(angM, angB),
      },
      inverseImagesOnLine: {
        K: sig(imageGaps.K), M: sig(imageGaps.M), P: sig(imageGaps.P),
      },
      allInverseImagesOnLine: Object.values(imageGaps).every((gap) => close(gap, 0)),
      imageLineDistanceFromL: sig(imageLineDistance),
      secondTangentDistanceFromL: sig(tangentLineDistance),
      ninePointInvertsToTangentLine: close(imageLineDistance, tangentLineDistance),
    },
    tangency: {
      Cb: {
        centreDistance: round(dCbNine), expectedSumOfRadii: round(g.CN.r + rb),
        residual: sig(dCbNine - g.CN.r - rb), touchesExternally: close(dCbNine, g.CN.r + rb),
      },
      Cc: {
        centreDistance: round(dCcNine), expectedSumOfRadii: round(g.CN.r + rc),
        residual: sig(dCcNine - g.CN.r - rc), touchesExternally: close(dCcNine, g.CN.r + rc),
      },
      ninePointThroughKLM: [g.K, g.L, g.M].every((p) => close(C.dist(g.CN, p), g.CN.r)),
      ninePointThroughP: close(C.dist(g.CN, g.P), g.CN.r),
    },
    incircleInternalTangency: {
      incenter: pt(incenter), inradius: round(inradius),
      centreDistance: round(dNineIn), expectedDifference: round(expectedIn),
      residual: sig(dNineIn - expectedIn), touchesInternally: close(dNineIn, expectedIn),
    },
    flags: {
      showNames: s.showNames, showAngles: s.showAngles,
      showCircle: s.showCircle, showNPCircle: s.showNPCircle,
    },
    status: C.describe(s),
  };
}

export function actions(): GameActions {
  return {
    inversion_proof: {
      describe:
        "For triangle ABC (each corner [x, y] or { x, y } in board units, y down; omit any to keep the applet's opening picture), run the real inversion proof for the excircles opposite B and C. With L the midpoint of B'C' and of BC, and w the circle centred at L of radius LB' = LC', it reports BB' = CC' = (a+b+c)/2, LP·LS = LB'^2 with the inverse of P at S, the orthogonality gaps showing w fixes both excircles, the angle equality XLK = KML = ABC, the inverses of K, M, P on the second external tangent, and the tangency of the nine-point circle. The four optional booleans showNames, showAngles, showCircle and showNPCircle are the page's checkboxes; supplied corners are clamped to the board just as a drag is.",
      args: '{"A":[200,40],"B":[60,180],"C":[320,180],"showCircle":true,"showNPCircle":true}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = geometryFor(C, s);
        const m = reading(C, s, g);
        return {
          triangle: m.triangle, sides: m.sides, midpoints: m.midpoints, points: m.points,
          circles: m.circles, equalLengths: m.equalLengths, inversePair: m.inversePair,
          orthogonality: m.orthogonality, harmonicDivision: m.harmonicDivision,
          secondTangent: m.secondTangent, tangency: m.tangency, flags: m.flags,
          note:
            `L is the midpoint of both BC and B'C', with LB' = LC' = ${m.equalLengths.LBp.measured} = (b+c)/2 and BB' = CC' = ${m.equalLengths.BBp.measured} = s. Inversion in w sends P to S (LP·LS = ${m.inversePair.product} = ${m.inversePair.radiusSquared}), leaves both excircles fixed (orthogonality residuals ${m.orthogonality.Cb.residual} and ${m.orthogonality.Cc.residual}), and sends the nine-point circle to the second tangent (distance ${m.secondTangent.ninePointInvertsToTangentLine ? "matches" : "does not match"}). Since that line touches both excircles, the nine-point circle does too: residuals ${m.tangency.Cb.residual} and ${m.tangency.Cc.residual}. This illustration has no win or loss.`,
        };
      },
    },

    tangency_checks: {
      describe:
        "For the same optional triangle ABC, measure the nine-point circle against the two excircles and the incircle using the real core. External tangency needs centre distance = (nine-point radius) + (exradius), while the incircle is touched internally at centre distance = |nine-point radius - inradius|; the applet draws only the excircles, so the incircle reading extends the picture. It also echoes the four checkbox flags and the core's status text.",
      args: '{"A":[202.17503,104.193316],"B":[80,154.249833],"C":[207.583167,154.249833]}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = geometryFor(C, s);
        const m = reading(C, s, g);
        return {
          triangle: m.triangle, sides: m.sides,
          circles: m.circles, tangency: m.tangency,
          incircleInternalTangency: m.incircleInternalTangency,
          flags: m.flags, result: C.result(s),
          note:
            `The nine-point circle has radius ${m.circles.ninePoint.radius} and touches excircle b (radius ${m.circles.excircleB.radius}) with residual ${m.tangency.Cb.residual} and excircle c (radius ${m.circles.excircleC.radius}) with residual ${m.tangency.Cc.residual}; the residuals are distance minus the sum of the radii. The undrawn incircle has radius ${m.incircleInternalTangency.inradius} and touches the nine-point circle internally with residual ${m.incircleInternalTangency.residual}. This is a demonstration, so the core returns no win or loss.`,
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Feuerbach Proof state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  try {
    s = buildState(C, src);
  } catch {
    savedReadable = false;
    s = C.start({}) as State;
  }
  const g = C.geometry(s);
  if (!g || !g.valid) {
    return {
      ...src, stateVersion, savedReadable, valid: false,
      saved: {
        A: pt(s.A), B: pt(s.B), C: pt(s.C),
        showNames: s.showNames, showAngles: s.showAngles,
        showCircle: s.showCircle, showNPCircle: s.showNPCircle,
      },
      note: "The saved corners are collinear or too close, so the core hides the inversion proof instead of drawing impossible circles.",
    };
  }
  const m = reading(C, s, g);
  return {
    ...src,
    stateVersion,
    savedReadable,
    valid: true,
    saved: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C),
      showNames: s.showNames, showAngles: s.showAngles,
      showCircle: s.showCircle, showNPCircle: s.showNPCircle,
    },
    reading: m,
    core: {
      L: m.midpoints.L, P: m.points.P, S: m.points.S,
      inversionCircle: m.circles.inversion,
      BBp: m.equalLengths.BBp.measured, CCp: m.equalLengths.CCp.measured,
      inversePair: m.inversePair.holds && m.inversePair.imagesAgree,
      orthogonalToCb: m.orthogonality.Cb.orthogonal,
      orthogonalToCc: m.orthogonality.Cc.orthogonal,
      ninePointInvertsToSecondTangent: m.secondTangent.ninePointInvertsToTangentLine,
      touchesCb: m.tangency.Cb.touchesExternally,
      touchesCc: m.tangency.Cc.touchesExternally,
    },
    coreDescription: C.describe(s),
    note: !savedReadable
      ? "The saved fields could not be read as three corners and four flags, so the applet's opening picture was reconstructed; the reading below is of that picture."
      : `Track.state saved the three corners in board units and the four checkbox flags. The core rebuilds L, P, S, the inversion circle w and the nine-point circle: BB' = CC' = ${m.equalLengths.BBp.measured}, LP·LS = ${m.inversePair.product}, w is orthogonal to both excircles, and its image of the nine-point circle is the second tangent. This is an illustration, so there is no win or loss.`,
  };
}
