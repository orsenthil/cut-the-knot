/*
 * run_game_logic actions and saved-position reader for Inscribed Square.
 *
 * The real core is inscribed-square/inscribed-square-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * With a horizontal base AB of length a and the top corner C at height h above
 * it, the trial square grown from a point P at fraction t along AB has its
 * free corner on BC exactly when t = solutionFraction(state); the fitted side
 * is a*h/(a+h). All trial squares are images of one another under a homothety
 * centred at A with ratio t2/t1, not under the "central symmetry at A" the
 * original page claims: a half-turn keeps lengths, so it cannot change the
 * side. On the three sidelines treated as whole lines there is a second
 * positive size, a*h/|a-h|, absent only when a = h. Coordinates are the
 * applet's 600 x 450 board, y downward. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Geometry = {
  active: boolean;
  fallback: boolean;
  open: boolean;
  gap: number;
  side: number;
  sign: number;
  P: Pt;
  p: Pt | null;
  q: Pt | null;
  r: Pt | null;
  target: { hit: Pt; foot1: Pt; foot2: Pt; top: Pt } | null;
  lines: [Pt, Pt][];
};
type State = { A: Pt; B: Pt; C: Pt; P: Pt; showNames: boolean };
type Core = {
  WIDTH: number;
  HEIGHT: number;
  START_A: Pt;
  START_B: Pt;
  START_C: Pt;
  START_P: Pt;
  dist(a: Pt, b: Pt): number;
  finite(p: Pt): boolean;
  nearestPoint(p: Pt, a: Pt, b: Pt): Pt;
  start(o?: Partial<State>): State;
  move(s: State, name: string, p: Pt): State;
  setFraction(s: State, t: number): State;
  fraction(s: State): number;
  geometry(s: State): Geometry;
  solutionFraction(s: State): number | null;
  inscribedSide(s: State): number | null;
};

const core = (): Core => cores["inscribed-square"].InscribedSquareCore as unknown as Core;

/* Only what we print is rounded; the core keeps full precision. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const cn = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const rp = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const near = (a: number, b: number, tol = 1e-7): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const samePt = (a: Pt | null | undefined, b: Pt | null | undefined, tol = 1e-6): boolean =>
  !!a && !!b && near(a.x, b.x, tol) && near(a.y, b.y, tol);
const isPlain = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const isPointLike = (v: unknown): boolean =>
  isPlain(v) && Number.isFinite(Number((v as Json).x)) && Number.isFinite(Number((v as Json).y)) &&
  (typeof (v as Json).x === "number" || typeof (v as Json).x === "string") &&
  (typeof (v as Json).y === "number" || typeof (v as Json).y === "string");

/** A strict point for action arguments: the page's { x, y } or a tutor's [x, y]. */
function readPoint(raw: unknown, label: string, fallback: Pt): Pt {
  if (raw === undefined || raw === null) return { x: fallback.x, y: fallback.y };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]);
    y = Number(raw[1]);
  } else if (isPlain(raw)) {
    x = Number(raw.x);
    y = Number(raw.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

/** A lenient point for a saved record, never throwing on damaged fields. */
const savedPoint = (v: unknown, fallback: Pt): Pt =>
  isPointLike(v) ? { x: Number((v as Json).x), y: Number((v as Json).y) } : fallback;

/**
 * Build a core state from action arguments. The game always keeps AB horizontal,
 * so we validate that; P is either given directly (dragged, then snapped to the
 * base's midline by the core) or placed at fraction t along AB as the slider does.
 */
function buildState(C: Core, args: Json): { s: State; t: number } {
  if (!isPlain(args)) throw new Error("arguments must be an object");
  const home = C.start();
  const A = readPoint(args.A, "A", home.A);
  const B = readPoint(args.B, "B", home.B);
  const Cc = readPoint(args.C, "C", home.C);
  if (!near(A.y, B.y, 1e-9)) {
    throw new Error("the game keeps the base AB horizontal: give A and B the same y");
  }
  const showNames = args.showNames === undefined ? true : !!args.showNames;
  let s = C.start({ A, B, C: Cc, showNames });
  let t: number;
  if (args.P !== undefined && args.P !== null) {
    s = C.move(s, "P", readPoint(args.P, "P", home.P));
    t = C.fraction(s);
  } else {
    t = num(args, "t", 0.2);
    if (!Number.isFinite(t) || t < -0.2 || t > 1.2) {
      throw new Error(`argument "t" (P's fraction along AB) must lie between -0.2 and 1.2, got ${JSON.stringify(args.t)}`);
    }
    s = C.setFraction(s, t);
  }
  return { s, t };
}

/** a, h and the two sideline sizes, with a and h measured by the core. */
function facts(C: Core, s: State) {
  const a = C.dist(s.A, s.B);
  const h = C.dist(s.C, C.nearestPoint(s.C, s.A, s.B));
  return {
    a,
    h,
    fittedFormula: a * h / (a + h),
    fittedCore: C.inscribedSide(s),
    second: a === h ? null : a * h / Math.abs(a - h),
  };
}

function solve(C: Core, s: State) {
  const tSol = C.solutionFraction(s);
  if (tSol === null) throw new Error("AB has zero length, so the triangle has no solution fraction");
  return { tSol, gSol: C.geometry(C.setFraction(s, tSol)) };
}

/**
 * An independent transcription of the two line equations (as in the port's
 * logic test): for each orientation eps, the top corners are on AC and BC.
 * Assumes the horizontal, non-flat triangle validated by the callers.
 */
function lineCandidates(s: State): { side: number; eps: number; sign: number }[] {
  const { A, B, C } = s;
  const at = (y: number, P: Pt, Q: Pt): number => P.x + ((Q.x - P.x) * (y - P.y)) / (Q.y - P.y);
  const L0 = at(A.y, B, C) - at(A.y, A, C);
  const out: { side: number; eps: number; sign: number }[] = [];
  for (const eps of [-1, 1]) {
    const L1 = eps * ((C.x - B.x) / (C.y - B.y) - (C.x - A.x) / (C.y - A.y));
    for (const sign of [1, -1]) {
      const side = (sign * L0) / (1 - sign * L1);
      if (Number.isFinite(side) && side > 1e-9) out.push({ side, eps, sign });
    }
  }
  return out;
}

const targetCorners = (g: Geometry): Json | null => g.target
  ? { hit: rp(g.target.hit), foot1: rp(g.target.foot1), foot2: rp(g.target.foot2), top: rp(g.target.top) }
  : null;

export function actions(): GameActions {
  return {
    homothety: {
      describe:
        "Grow the trial square from a point P at fraction t along the horizontal base AB, then use the real core to find where its free corner lands on BC. Reports the homothety centred at A with ratio t_solution/t that carries the trial square (and each of its four corners) onto the fitted square, its side a·h/(a+h), and the ray-to-BC target square. It also checks the page's claim: reflecting in A keeps the side length, so that 'central symmetry' cannot give the differently sized fitted square — the true relation is this scaling. Pass A, B, C as [x, y] or { x, y } (defaulting to the opening triangle) and optionally t between -0.2 and 1.2 or a point P; the example uses the saved triangle with t = 0.2.",
      args: '{"A":[204,300],"B":[400,300],"C":[360,150],"t":0.2}',
      run: (args) => {
        const C = core();
        const { s, t } = buildState(C, args);
        if (t === 0) throw new Error("t must not be 0: P would sit on A and the applet stops drawing");
        const g0 = C.geometry(s);
        const drawable = g0.active && !g0.fallback && !!g0.p && C.finite(g0.p) && !!g0.q && C.finite(g0.q) &&
          !!g0.r && C.finite(g0.r);
        if (!drawable) {
          throw new Error("the trial square could not be drawn: keep P away from A and make AC meet the perpendicular at P");
        }
        const f = facts(C, s);
        if (f.a <= 0 || f.h <= 0) throw new Error("the triangle needs a nonzero base and a nonzero height");
        const { tSol, gSol } = solve(C, s);
        const k = tSol / t;
        const p0 = g0 as Geometry & { p: Pt; q: Pt; r: Pt };
        const scale = (p: Pt): Pt => ({ x: s.A.x + k * (p.x - s.A.x), y: s.A.y + k * (p.y - s.A.y) });
        const images = (["P", "p", "q", "r"] as const).map((corner) => {
          const source = corner === "P" ? g0.P : p0[corner];
          const image = scale(source);
          const fitted = (corner === "P" ? gSol.P : gSol[corner]) as Pt;
          return { corner, image: rp(image), fitted: rp(fitted), agrees: samePt(image, fitted) };
        });
        const reflectedP = { x: 2 * s.A.x - g0.P.x, y: 2 * s.A.y - g0.P.y };
        const reflectedp = { x: 2 * s.A.x - p0.p.x, y: 2 * s.A.y - p0.p.y };
        const reflectedSide = C.dist(reflectedP, reflectedp);
        const sideRatio = gSol.side / g0.side;

        return {
          A: rp(s.A),
          B: rp(s.B),
          C: rp(s.C),
          P: rp(s.P),
          t: r6(t),
          trial: { side: cn(g0.side), p: rp(p0.p), q: rp(p0.q), r: rp(p0.r), freeCornerOnBC: g0.open, gap: cn(g0.gap) },
          homothety: {
            center: rp(s.A),
            ratio: cn(k),
            images,
            allCornersMap: images.every((m) => m.agrees),
            sideRatio: cn(sideRatio),
            ratioMatchesSides: near(sideRatio, k, 1e-7),
          },
          fitted: {
            fraction: cn(tSol),
            side: cn(gSol.side),
            formulaSide: cn(f.fittedFormula),
            coreSide: cn(f.fittedCore),
            gap: cn(gSol.gap),
            eyesOpen: gSol.open,
            target: targetCorners(gSol),
          },
          centralSymmetry: {
            reflectedSide: cn(reflectedSide),
            keepsSide: near(reflectedSide, g0.side, 1e-7),
            equalsFitted: near(reflectedSide, gSol.side, 1e-7),
          },
          note:
            `Scaling about A by k = t_solution/t = ${r6(k)} sends the trial square of side ${r6(g0.side)} to the fitted square of side ${r6(gSol.side)} = a·h/(a+h), and the free corner then lies on BC (eyes open: ${gSol.open}). ` +
            `The page's "central symmetry with center at A" is a slip: reflecting in A preserves the side (${r6(reflectedSide)}), so it cannot produce the fitted square; the squares are homothetic, and lengths change with the ratio.`,
        };
      },
    },

    sideline_solutions: {
      describe:
        "Count and size the squares whose base lies on line AB and whose other corners lie on the lines AC and BC. The real core supplies the fitted square at solutionFraction; together with the core-measured base a and height h it gives sides a·h/(a+h) and a·h/|a−h|, compared with an independent transcription of the two line equations. The second size is absent when a = h. Pass the same triangle arguments as homothety; the example uses the saved triangle, whose second solution uses the extensions of the sidelines.",
      args: '{"A":[204,300],"B":[400,300],"C":[360,150]}',
      run: (args) => {
        const C = core();
        const { s } = buildState(C, args);
        const f = facts(C, s);
        if (f.a <= 0 || f.h <= 0) throw new Error("the triangle needs a nonzero base and a nonzero height");
        const { tSol, gSol } = solve(C, s);
        const list = lineCandidates(s);
        const fittedInList = list.some((x) => near(x.side, f.fittedCore ?? NaN, 1e-7));
        const secondCase = f.second === null
          ? "none: base and height are equal, so the second solution is at infinity"
          : f.h > f.a
            ? "the square lies on the far side of the base (below AB on screen)"
            : "the square grows on the extensions of the base and sidelines beyond A";

        return {
          A: rp(s.A),
          B: rp(s.B),
          C: rp(s.C),
          baseLength: cn(f.a),
          height: cn(f.h),
          solutions: {
            fitted: {
              side: cn(f.fittedCore),
              formula: "a*h/(a+h)",
              formulaSide: cn(f.fittedFormula),
              agrees: near(f.fittedFormula, f.fittedCore ?? NaN, 1e-7),
              fraction: cn(tSol),
              gap: cn(gSol.gap),
              eyesOpen: gSol.open,
            },
            secondSideline: {
              side: cn(f.second),
              formula: "a*h/|a-h|",
              finite: f.second !== null,
              caseDescription: secondCase,
            },
          },
          independentCheck: {
            candidateSides: list.map((x) => ({ side: cn(x.side), eps: x.eps, sign: x.sign })),
            count: list.length,
            fittedMatchesCandidate: fittedInList,
            asClaimed: f.second === null ? list.length === 1 : list.length === 2,
          },
          note:
            `With base a = ${r6(f.a)} and height h = ${r6(f.h)}, the fitted square has side a·h/(a+h) = ${r6(f.fittedFormula)}, which the core draws with its eyes open; ${secondCase}. ` +
            `On the three sidelines as whole lines there are ${list.length} positive size${list.length === 1 ? "" : "s"} when a and h ${f.second === null ? "are equal" : "differ"}, and the core's fitted square is one of them.`,
        };
      },
    },
  };
}

/* Reading a saved position must not throw on a damaged or older record. */

/** Echo Track.state's four points and flag, then re-measure the picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Inscribed Square state version ${stateVersion}`);
  if (!isPlain(state)) throw new Error("saved Inscribed Square position must be an object");
  const C = core();
  const home = C.start();
  const A = savedPoint(state.A, home.A);
  const B = savedPoint(state.B, home.B);
  const Cc = savedPoint(state.C, home.C);
  const P = savedPoint(state.P, home.P);
  const showNames = typeof state.showNames === "boolean" ? state.showNames : home.showNames;
  const readable = isPointLike(state.A) && isPointLike(state.B) && isPointLike(state.C) &&
    isPointLike(state.P) && typeof state.showNames === "boolean";
  const s: State = { A, B, C: Cc, P, showNames };

  const g = C.geometry(s);
  const frac = C.fraction(s);
  const tSol = C.solutionFraction(s);
  const f = facts(C, s);
  const solved = tSol === null ? null : C.geometry(C.setFraction(s, tSol));

  return {
    stateVersion,
    savedReadable: readable,
    A: rp(A),
    B: rp(B),
    C: rp(Cc),
    P: rp(P),
    showNames,
    triangle: {
      baseLength: cn(f.a),
      height: cn(f.h),
      fittedSideFormula: cn(f.fittedFormula),
      fittedSideCore: cn(f.fittedCore),
      secondSidelineSide: cn(f.second),
    },
    fraction: cn(frac),
    trial: {
      active: g.active,
      fallback: g.fallback,
      side: cn(g.side),
      gap: cn(g.gap),
      eyesOpen: g.open,
      p: rp(g.p),
      q: rp(g.q),
      r: rp(g.r),
    },
    solution: tSol === null ? null : {
      fraction: cn(tSol),
      side: cn(solved!.side),
      gap: cn(solved!.gap),
      eyesOpen: solved!.open,
      target: targetCorners(solved!),
    },
    atSolution: tSol !== null && near(frac, tSol, 1e-6) && g.open,
    note: !readable
      ? "Some saved fields could not be read, so the opening values were substituted and the readings below come from them."
      : `Track.state saved the four draggable points and the names flag. The core reports base ${r6(f.a)}, height ${r6(f.h)}, fitted side ${r6(f.fittedFormula)} = a·h/(a+h)${f.second === null ? " with no finite second solution (a = h)" : ` and a second sideline size ${r6(f.second)} = a·h/|a−h|`}. This is a construction with no win or loss.`,
  };
}
