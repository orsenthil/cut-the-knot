/*
 * run_game_logic actions and saved-position reader for Menelaus.
 *
 * The real core is menelaus/menelaus-core.js, copied into src/generated/cores/
 * at build time. It reproduces the applet's two-position switch. In Ceva mode
 * K is free and D = AK ∩ BC, E = BK ∩ AC, F = CK ∩ AB, so the cevians concur
 * and the directed product AF/FB · BD/DC · CE/EA is +1. In Menelaus mode D, E
 * and F stay on one line and that product is -1, which needs an odd number
 * (one or three) of them on side extensions. Reset(1) swaps A with the side
 * point F on the way in and back out, a quirk of the original applet that the
 * core keeps. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["menelaus"].MenelausCore;
type C = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Mode = "ceva" | "menelaus";
type State = {
  mode: string;
  width: number;
  height: number;
  A: Point;
  B: Point;
  C: Point;
  K: Point;
  Dm: Point | null;
  Fm: Point | null;
  selected: string | null;
};
type Points = { D: Point; E: Point; F: Point };
type Numbers = {
  tF: number;
  tD: number;
  uE: number;
  AFBF: number;
  BDCD: number;
  CEAE: number;
  product: number;
  signed: number;
  outside: number;
  cross: number;
};

const TOL = 1e-6;
const finite = (v: number): boolean => Number.isFinite(v);
const r6 = (v: number): number => (finite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number): number | null => (finite(v) ? r6(v) : null);
const sig = (v: number): string | null => (finite(v) ? v.toExponential(3) : null);
const pt = (p: Point | null | undefined): Point | null =>
  p && finite(p.x) && finite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const area2 = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const distToLine = (p: Point, a: Point, b: Point): number => {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return d > 0 ? Math.abs(area2(a, b, p)) / d : NaN;
};

/** The page saves { x, y }; short [x, y] pairs are accepted in tool arguments. */
function readPoint(raw: unknown, label: string, fallback: Point | null): Point | null {
  if (raw === undefined || raw === null) return fallback ? { ...fallback } : null;
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }`);
  }
  if (!finite(x) || !finite(y)) throw new Error(`"${label}" needs finite numeric x and y`);
  return { x, y };
}

function readMode(raw: unknown, fallback: Mode): Mode {
  if (raw === undefined || raw === null) return fallback;
  if (raw === "ceva" || raw === 0) return "ceva";
  if (raw === "menelaus" || raw === 1) return "menelaus";
  throw new Error('"mode" must be "ceva" or "menelaus"');
}

/**
 * An opening picture moved onto the caller's A, B, C and K. Menelaus mode is
 * reached with switchMode so the applet's A-F swap and K projection happen in
 * the core rather than being guessed here.
 */
function buildState(K: C, args: Json, mode: Mode): State {
  const seed = K.start() as State;
  const width = num(args, "width", seed.width);
  const height = num(args, "height", seed.height);
  if (!(width > 0) || !(height > 0)) throw new Error('"width" and "height" must be positive');
  const A = readPoint(args.A, "A", seed.A)!;
  const B = readPoint(args.B, "B", seed.B)!;
  const Cc = readPoint(args.C, "C", seed.C)!;
  const k = readPoint(args.K, "K", seed.K)!;
  if (Math.abs(area2(A, B, Cc)) < TOL) {
    throw new Error("A, B and C must be distinct and not collinear");
  }
  if (Math.min(distToLine(k, A, B), distToLine(k, B, Cc), distToLine(k, Cc, A)) < TOL) {
    throw new Error("K must not lie on a side of ABC: a cevian foot would land on a corner");
  }
  const base: State = {
    ...seed, mode: "ceva", width, height, A, B, C: Cc, K: k,
    Dm: null, Fm: null, selected: null,
  };
  return mode === "menelaus" ? (K.switchMode(base, "menelaus") as State) : base;
}

/** The core's numbers, with the mode's expected sign and extension parity. */
function reading(K: C, s: State) {
  const p = K.points(s) as Points;
  const n = K.numbers(s) as Numbers;
  const scale = Math.max(1, Math.hypot(p.D.x - p.E.x, p.D.y - p.E.y));
  const collinear = finite(n.cross) && Math.abs(n.cross) <= TOL * scale * scale;
  const expectedSign = s.mode === "menelaus" ? -1 : 1;
  const valid = [n.tF, n.tD, n.uE, n.product, n.signed].every(finite);
  const parity = s.mode === "menelaus" ? n.outside % 2 === 1 : n.outside % 2 === 0;
  return {
    mode: s.mode,
    valid,
    points: {
      D: { on: "BC", point: pt(p.D) },
      E: { on: "AC", point: pt(p.E) },
      F: { on: "AB", point: pt(p.F) },
    },
    sideParameters: { tF: maybe(n.tF), tD: maybe(n.tD), uE: maybe(n.uE) },
    ratios: { AFoverBF: maybe(n.AFBF), BDoverCD: maybe(n.BDCD), CEoverAE: maybe(n.CEAE) },
    unsignedProduct: maybe(n.product),
    signedProduct: maybe(n.signed),
    expectedSignedProduct: expectedSign,
    signedProductMatches: valid && Math.abs(n.signed - expectedSign) < TOL,
    pointsOnExtensions: n.outside,
    extensionParityMatchesMode: parity,
    collinearityResidual: sig(n.cross),
    collinear,
    note: !valid
      ? "A cevian is parallel to a side or a foot fell on a corner, so the ratios are not defined here."
      : s.mode === "menelaus"
        ? `D, E and F lie on one line (residual ${sig(n.cross)}), so the directed product is ${maybe(n.signed)} = -1 and ${n.outside} of the points sit on side extensions: an odd number, 1 or 3. The unsigned product is ${maybe(n.product)} = 1.`
        : `AD, BE and CF meet at K, so Ceva's directed product is ${maybe(n.signed)} = +1 and ${n.outside} of the feet sit on side extensions: an even number, 0 or 2. The unsigned product is ${maybe(n.product)} = 1 even though D, E and F are not collinear.`,
  };
}

/** What Reset(mode) does to A, K and the side point F, measured by the core. */
function swapReading(K: C, ceva: State, switched: State) {
  const oldF = (K.points(ceva) as Points).F;
  return {
    oldA: pt(ceva.A),
    newA: pt(switched.A),
    oldSideF: pt(oldF),
    newSideF: pt(switched.Fm),
    newAEqualsOldSideF: Math.hypot(switched.A.x - oldF.x, switched.A.y - oldF.y) < TOL,
    newSideFEqualsOldA: Math.hypot(switched.Fm!.x - ceva.A.x, switched.Fm!.y - ceva.A.y) < TOL,
    kDistanceToNewAC: sig(distToLine(switched.K, switched.A, switched.C)),
    note: "The applet's Reset swaps A with F: the old side point F becomes the new vertex A, the old A becomes the new draggable side point F, and K is projected onto the new AC. The core keeps this quirk.",
  };
}

export function actions(): GameActions {
  return {
    ceva_vs_menelaus: {
      describe:
        "Build one picture of a triangle ABC and a point K (each [x, y] or { x, y } on the 500 by 380 board, y downward; omit a point to keep the opening picture) and measure it twice with the real core: K free in Ceva mode, then after the applet's mode switch in Menelaus mode. Reports both directed products (+1 for concurrent cevians, -1 for collinear points), the unsigned product, the number of points on side extensions (even in Ceva, odd in Menelaus), the collinearity residual and the A-F swap that the switch makes.",
      args: '{ "A": [331, 190], "B": [212, 256], "C": [212, 124], "K": [250, 190] }',
      run: (args) => {
        const K = core();
        const ceva = buildState(K, args, "ceva");
        const menelaus = buildState(K, args, "menelaus");
        return {
          board: { width: ceva.width, height: ceva.height },
          triangle: { A: pt(ceva.A), B: pt(ceva.B), C: pt(ceva.C) },
          K: pt(ceva.K),
          ceva: reading(K, ceva),
          menelaus: reading(K, menelaus),
          modeSwitchSwap: swapReading(K, ceva, menelaus),
          note: "Same triangle, same ratios read two ways: with AD, BE, CF concurrent the directed product is +1; after the switch D, E, F are collinear and it is -1. This is an illustration with no win or loss.",
        };
      },
    },

    switch_and_drag: {
      describe:
        "Start in the requested mode, optionally drag one handle to point (or nudge it with dx and dy), and report what the real core recomputes, including the A-F swap when switching to Menelaus. The before and after readings show that a Menelaus drag keeps D, E and F on one line with directed product -1 and an odd count of extension points, while Ceva keeps the cevians meeting at K with product +1.",
      args: '{ "mode": "menelaus", "handle": "D", "point": [220, 200] }',
      run: (args) => {
        const K = core();
        const mode = readMode(args.mode, "ceva");
        const ceva = buildState(K, args, "ceva");
        const target = mode === "menelaus" ? (K.switchMode(ceva, "menelaus") as State) : ceva;
        const handle = args.handle === undefined || args.handle === null ? null : String(args.handle);
        const allowed = mode === "menelaus" ? ["A", "B", "C", "K", "D", "F"] : ["A", "B", "C", "K"];
        if (handle !== null && !allowed.includes(handle)) {
          throw new Error(
            `"handle" must be one of ${allowed.join(", ")} in ${mode} mode, got ${JSON.stringify(handle)}`,
          );
        }
        let after = target;
        let landed: Point | null = null;
        if (handle !== null) {
          if (args.point !== undefined && args.point !== null) {
            const requested = readPoint(args.point, "point", null);
            if (!requested) throw new Error('"point" needs finite numeric x and y');
            after = K.move(target, handle, requested) as State;
          } else if (args.dx !== undefined || args.dy !== undefined) {
            after = K.step(target, handle, num(args, "dx"), num(args, "dy")) as State;
          } else {
            throw new Error('a "handle" needs a "point" or "dx" and "dy" to move to');
          }
          const key = handle === "D" ? "Dm" : handle === "F" ? "Fm" : handle;
          landed = pt((after as unknown as Record<string, Point>)[key]);
        }
        return {
          requestedMode: mode,
          drag: handle === null ? null : {
            handle,
            landed,
            selected: after.selected,
          },
          before: reading(K, target),
          after: reading(K, after),
          modeSwitchSwap: mode === "menelaus" ? swapReading(K, ceva, target) : null,
          note: mode === "menelaus"
            ? "Moving a corner or a side dot in Menelaus mode recomputes the next point round the cycle, so D, E and F stay collinear; the directed product stays -1."
            : "In Ceva mode only the corners and K are draggable; D, E and F are the cevian feet and the directed product stays +1.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus the same picture re-measured by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Menelaus state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Menelaus position must be an object");
  }
  const K = core();
  const seed = K.start() as State;
  try {
    const s: State = {
      ...seed,
      mode: readMode(state.mode, "ceva"),
      width: num(state, "width", seed.width),
      height: num(state, "height", seed.height),
      A: readPoint(state.A, "A", seed.A)!,
      B: readPoint(state.B, "B", seed.B)!,
      C: readPoint(state.C, "C", seed.C)!,
      K: readPoint(state.K, "K", seed.K)!,
      Dm: readPoint(state.Dm, "Dm", seed.Dm),
      Fm: readPoint(state.Fm, "Fm", seed.Fm),
      selected: state.selected === undefined || state.selected === null
        ? null
        : String(state.selected),
    };
    const r = reading(K, s);
    return {
      ...state,
      stateVersion,
      board: { width: s.width, height: s.height },
      result: K.result(s),
      signedProduct: r.signedProduct,
      unsignedProduct: r.unsignedProduct,
      pointsOnExtensions: r.pointsOnExtensions,
      collinear: r.collinear,
      reading: r,
      note:
        "Track.state saves the mode, the board size, the corners A, B, C, the point K (the side point E in Menelaus mode) and the two optional side dots Dm and Fm, never the derived feet. The core rebuilds D, E and F, then measures both products, the extension count and the collinearity residual with the same arithmetic the page uses. This is an illustration with no win or loss.",
    };
  } catch (e) {
    return {
      ...state,
      stateVersion,
      reading: null,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
