/*
 * run_game_logic actions and saved-position reader for Chasles.
 *
 * Six points A..F sit on an ellipse. Chasles' theorem says that the cross-ratio
 * of the pencil of four lines from a *fifth* point of a conic to a fixed base
 * of four points does not depend on which fifth point is chosen. Applied twice
 * it gives Pascal's theorem: with P = AB^DE, Q = CD^FA and the line PQ meeting
 * the conic at L and M, the two crossings R = EF^PQ and S = BC^PQ coincide.
 * The applet also draws T = AD^PQ. Every number below comes from the real core
 * (chasles/chasles-core.js), copied into src/generated/cores/ at build time.
 * See _shared.ts for the shape of a game module. Coordinates are board units
 * in the page's viewBox, y down.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["chasles"].ChaslesCore as any;

const NAMES: string[] = ["A", "B", "C", "D", "E", "F"];

type Pt = { x: number; y: number };
type Ellipse = { cx: number; cy: number; a: number; b: number };
type Line = { a: number; b: number; c: number };
type Geom = {
  P: Pt; Q: Pt;
  R: Pt | null; S: Pt | null; T: Pt | null; L: Pt | null; M: Pt | null;
  line: Line | null;
};
type State = {
  width: number;
  height: number;
  corners: Pt[];
  ellipse: Ellipse;
  points: Record<string, Pt>;
  showNames: boolean;
};
type Claims = {
  regular: boolean;
  pascal: boolean;
  chaslesF: boolean;
  chaslesA: boolean;
  chain: boolean;
  all: boolean;
};

const round = (v: number): number => Number(v.toFixed(4));
/** Keep small cross-ratio errors visible, and turn NaN from a guard into null. */
const precise = (v: number): number | null =>
  Number.isFinite(v) ? Number(v.toPrecision(4)) : null;
const finite = (p: any): p is Pt => Boolean(p && Number.isFinite(p.x) && Number.isFinite(p.y));
const pt = (p: any): Pt | null => (finite(p) ? { x: round(p.x), y: round(p.y) } : null);
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Accept the tutor's [x, y] and the page's saved { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(v[0]);
    y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

function readPoints(v: unknown, count: number, label: string): Pt[] {
  if (!Array.isArray(v) || v.length !== count) {
    throw new Error(`argument "${label}" must be exactly ${count} points`);
  }
  return v.map((p, i) => readPoint(p, `${label}[${i}]`));
}

/** The six named conic points; each is projected onto the ellipse by start(). */
function readNamedPoints(v: unknown): Record<string, Pt> {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error('argument "points" must be an object with keys A to F');
  }
  const o = v as Json;
  return Object.fromEntries(NAMES.map((n) => [n, readPoint(o[n], `points.${n}`)]));
}

/**
 * Build the illustration the caller describes. V0..V3 are the rectangle
 * corners in the applet's order (V0/V1 lower edge). Supply either the six
 * named points or six angles in radians on the ellipse; omit both for the
 * applet's six opening angles.
 */
function readState(args: Json): State {
  const C = core();
  const options: Json = { showNames: args.showNames === true };
  if (args.width !== undefined) options.width = num(args, "width");
  if (args.height !== undefined) options.height = num(args, "height");
  /* Track.state saves the corners under `corners`; the tutor's actions use V. */
  if (args.V !== undefined) options.corners = readPoints(args.V, 4, "V");
  else if (args.corners !== undefined) options.corners = readPoints(args.corners, 4, "corners");

  if (args.points !== undefined && args.points !== null) {
    options.points = readNamedPoints(args.points);
  } else if (args.angles !== undefined && args.angles !== null) {
    const angles = numArray(args, "angles");
    if (angles.length !== 6) throw new Error('argument "angles" must be exactly 6 radians');
    const base = C.start(options) as State;
    options.points = Object.fromEntries(
      NAMES.map((n, i) => [n, C.ellipseAt(base.ellipse, angles[i]) as Pt]),
    );
  }
  return C.start(options) as State;
}

/** The full core reading of a diagram, shared by both actions and position(). */
function reading(state: State) {
  const C = core();
  const g = C.compute(state) as Geom;
  const cl = C.claims(state) as Claims;
  const p = state.points;

  /* The seven terms of the chain, each measured by the real core. */
  const qr = C.crossRatioLine(g.L, g.Q, g.R, g.M) as number; // (LQRM)
  const f = C.crossRatioPencil(p.F, g.L, p.A, p.E, g.M) as number; // F(LAEM)
  const d = C.crossRatioPencil(p.D, g.L, p.A, p.E, g.M) as number; // D(LAEM)
  const tp = C.crossRatioLine(g.L, g.T, g.P, g.M) as number; // (LTPM)
  const a = C.crossRatioPencil(p.A, g.L, p.D, p.B, g.M) as number; // A(LDBM)
  const c = C.crossRatioPencil(p.C, g.L, p.D, p.B, g.M) as number; // C(LDBM)
  const qs = C.crossRatioLine(g.L, g.Q, g.S, g.M) as number; // (LQSM)

  const chain = [qr, f, d, tp, a, c, qs];
  const nearby = (x: number, y: number): boolean =>
    Number.isFinite(x) && Number.isFinite(y) &&
    Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
  const chainSteps = [
    { from: "(LQRM)", to: "F(LAEM)", holds: nearby(qr, f) },
    { from: "F(LAEM)", to: "D(LAEM)", holds: nearby(f, d) },
    { from: "D(LAEM)", to: "(LTPM)", holds: nearby(d, tp) },
    { from: "(LTPM)", to: "A(LDBM)", holds: nearby(tp, a) },
    { from: "A(LDBM)", to: "C(LDBM)", holds: nearby(a, c) },
    { from: "C(LDBM)", to: "(LQSM)", holds: nearby(c, qs) },
  ];
  const rsDistance = finite(g.R) && finite(g.S) ? dist(g.R, g.S) : null;

  return {
    width: state.width,
    height: state.height,
    showNames: state.showNames === true,
    ellipse: {
      cx: round(state.ellipse.cx), cy: round(state.ellipse.cy),
      a: round(state.ellipse.a), b: round(state.ellipse.b),
    },
    corners: state.corners.map(pt),
    points: Object.fromEntries(NAMES.map((n) => [n, pt(p[n])])),
    construction: {
      P: pt(g.P), Q: pt(g.Q), R: pt(g.R), S: pt(g.S),
      T: pt(g.T), L: pt(g.L), M: pt(g.M),
    },
    pascalLine: g.line
      ? { a: round(g.line.a), b: round(g.line.b), c: round(g.line.c) }
      : null,
    crossRatios: {
      "(LQRM)": precise(qr), "F(LAEM)": precise(f), "D(LAEM)": precise(d),
      "(LTPM)": precise(tp), "A(LDBM)": precise(a), "C(LDBM)": precise(c),
      "(LQSM)": precise(qs),
    },
    /* Chasles: the pencil's cross-ratio is the same from F as from D, and
       from A as from C — the fifth point on the conic does not matter. */
    chaslesEqualities: {
      "F(LAEM) = D(LAEM)": cl.chaslesF === true,
      "A(LDBM) = C(LDBM)": cl.chaslesA === true,
    },
    chainSteps,
    chainHolds: cl.chain === true,
    R_equals_S: cl.pascal === true,
    R_S_distance: rsDistance === null ? null : Number(rsDistance.toExponential(3)),
    regular: cl.regular === true,
    all: cl.all === true,
  };
}

export function actions(): GameActions {
  return {
    conic_points: {
      describe:
        "Draw the Chasles illustration for six points A..F on an ellipse: give V (four rectangle corners, V0/V1 the lower edge), and either points (an object with keys A..F of [x, y] pairs) or angles (six radians on the ellipse). Omitting points and angles uses the applet's six opening angles. Report the six conic points, the crossings P = AB^DE, Q = CD^FA, R = EF^PQ, S = BC^PQ, T = AD^PQ and the two ends L, M where PQ cuts the conic, the Pascal line, whether R = S, and the two Chasles equalities F(LAEM) = D(LAEM) and A(LDBM) = C(LDBM). Nearly parallel chords lose a crossing to the core's Cramer guard and report null.",
      args:
        '{ "V": [[69.6667, 250], [330.3333, 250], [330.3333, 50], [69.6667, 50]], "points": { "A": [107.8404, 79.2893], "B": [200, 250], "C": [312.8720, 100], "D": [107.8404, 220.7107], "E": [200, 50], "F": [265.1667, 236.6025] }, "showNames": false }',
      run: (args) => {
        const r = reading(readState(args));
        return {
          ...r,
          note: r.regular
            ? `P, Q, R, S, T, L and M are all finite. R = S is ${r.R_equals_S ? "true" : "false"} (distance ${r.R_S_distance}), so the three Pascal crossings lie on one line. Chasles gives F(LAEM) = D(LAEM) and A(LDBM) = C(LDBM): the cross-ratio of the pencil on the base L, M does not depend on the fifth point of the conic.`
            : "Some chords are nearly parallel, so a crossing is missing (null). Move the points apart and try again.",
        };
      },
    },

    pascal_chain: {
      describe:
        "For the same six points, measure every term of the Chasles/Pascal chain (LQRM) = F(LAEM) = D(LAEM) = (LTPM) = A(LDBM) = C(LDBM) = (LQSM). The steps F=D and A=C are Chasles' theorem (the pencil's cross-ratio on base L,M ignores the fifth point); the others follow by rewriting on the Pascal line. The chain starts and ends with cross-ratios on the same line PQ sharing the base L,M, which forces R = S — Pascal's theorem. Accepts the same V / points / angles arguments as conic_points.",
      args:
        '{ "V": [[70, 250], [330, 250], [330, 50], [70, 50]], "angles": [-2.4, 1.4, -0.6, 2.2, -1.5, 1.1] }',
      run: (args) => {
        const r = reading(readState(args));
        return {
          crossRatios: r.crossRatios,
          chainSteps: r.chainSteps,
          chainHolds: r.chainHolds,
          chaslesEqualities: r.chaslesEqualities,
          R_equals_S: r.R_equals_S,
          R_S_distance: r.R_S_distance,
          regular: r.regular,
          note: r.regular
            ? `Cross-ratios: ${JSON.stringify(r.crossRatios)}. Each adjacent pair in the chain agrees; its first and last terms are (LQRM) and (LQSM), which have the same base L,M and the same first point Q, so R and S must agree too (measured distance ${r.R_S_distance}). That is Pascal's theorem, proved by Chasles' invariance of the pencil cross-ratio.`
            : "The diagram is degenerate — a needed crossing is missing — so the chain cannot be measured. Choose six distinct, well-spread points.",
        };
      },
    },
  };
}

/** What the core says about the position saved by Track.state on the page. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Chasles state version ${stateVersion}`);
  const C = core();
  let here: State = C.start({}) as State;
  let savedReadable = false;
  try {
    here = readState(state);
    savedReadable =
      Array.isArray(state.corners) &&
      state.points !== undefined && state.points !== null &&
      typeof state.points === "object";
  } catch { /* unusable saved data: fall back to the opening picture */ }

  const r = reading(here);
  return {
    stateVersion,
    savedReadable,
    saved: {
      width: here.width,
      height: here.height,
      corners: r.corners,
      ellipse: r.ellipse,
      points: r.points,
      showNames: here.showNames === true,
    },
    ellipse: r.ellipse,
    points: r.points,
    construction: r.construction,
    pascalLine: r.pascalLine,
    crossRatios: r.crossRatios,
    chaslesEqualities: r.chaslesEqualities,
    chainSteps: r.chainSteps,
    chainHolds: r.chainHolds,
    R_equals_S: r.R_equals_S,
    R_S_distance: r.R_S_distance,
    regular: r.regular,
    all: r.all,
    note: !savedReadable
      ? "The saved position could not be read, so the applet's opening picture is shown instead."
      : r.regular && r.all
        ? "The saved picture is regular: R = S, both Chasles equalities hold, and the whole Pascal chain is equal — the illustration is behaving as the theorem says."
        : "The saved picture is degenerate (a chord is nearly parallel) or one of the chain's equalities failed; drag the points apart and watch the crossings again.",
  };
}
