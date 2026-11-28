/*
 * run_game_logic actions and saved-position reader for Inversion in an Arbelos.
 *
 * The real core is inversion-in-arbelos/inversion-in-arbelos-core.js, copied
 * into src/generated/cores/ at build time. Every number below is measured by
 * that core, with O the centre of inversion, R its radius handle, and A and B
 * the two vertical lines that invert to the tangent circles. Inverting the
 * equal circles stacked between those lines back gives the Pappus chain:
 * h_n = 2n·R_n, R_n = R·k/(k²n² + k + 1), AP_n = R(k+2)/(k²n² + k + 1),
 * where R = Rbig is the outer radius and k = (B−A)/(A−O). See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

interface Pt { x: number; y: number; }
interface CoreState { O: Pt; A: Pt; B: Pt; R: Pt; N: number; hints: boolean; }
interface ChainCircle { n: number; center: Pt; radius: number; height: number; AP: number; }
interface Geometry {
  O: Pt; A: Pt; B: Pt; R: Pt; N: number; hints: boolean;
  p: number; q: number; gap: number; rho: number; k: number;
  outer: { center: Pt; radius: number };
  inner: { center: Pt; radius: number };
  inversion: { center: Pt; radius: number };
  Aprime: Pt; Bprime: Pt;
  RL: number; RR: number; Rbig: number;
  strip: { center: Pt; radius: number; step: number };
  chain: ChainCircle[];
}
interface ArbelosCore {
  AXIS_Y: number;
  N_MIN: number;
  N_MAX: number;
  MIN_RHO: number;
  START: CoreState;
  start(options?: Partial<CoreState>): CoreState;
  geometry(state: CoreState): Geometry;
  position(state: CoreState): Json;
}

const core = (): ArbelosCore =>
  cores["inversion-in-arbelos"].InversionInArbelosCore as unknown as ArbelosCore;

const r6 = (v: number): number => Number(v.toFixed(6));
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** A handle is a number on the axis, { x, y } or [x, y]; the core forces y. */
function readHandle(args: Json, key: string, fallbackX: number): number {
  const finite = (v: unknown, label: string): number => {
    if (v === undefined || v === null) return fallbackX;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`argument "${label}" must be a finite number, got ${JSON.stringify(v)}`);
    return n;
  };
  const raw = args[key];
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be a number, [x, y] or { x, y }`);
    return finite(raw[0], `${key}.x`);
  }
  if (raw !== null && typeof raw === "object") return finite((raw as Json).x, `${key}.x`);
  return finite(raw, key);
}

/** Validate the tutor's arguments, then let the core clamp the four handles. */
function readState(C: ArbelosCore, args: Json): CoreState {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with optional O, A, B, R, N and hints");
  }
  if (args.hints !== undefined && typeof args.hints !== "boolean") {
    throw new Error('argument "hints" must be true or false');
  }
  const nRaw = num(args, "N", num(args, "n", C.START.N));
  if (!Number.isInteger(nRaw) || nRaw < C.N_MIN || nRaw > C.N_MAX) {
    throw new Error(`argument "N" must be an integer from ${C.N_MIN} to ${C.N_MAX}`);
  }
  return C.start({
    O: { x: readHandle(args, "O", C.START.O.x), y: C.AXIS_Y },
    A: { x: readHandle(args, "A", C.START.A.x), y: C.AXIS_Y },
    B: { x: readHandle(args, "B", C.START.B.x), y: C.AXIS_Y },
    R: { x: readHandle(args, "R", C.START.R.x), y: C.AXIS_Y },
    N: nRaw,
    hints: args.hints === true,
  });
}

/** One chain circle, measured from the core and checked against the formulae. */
function chainReading(c: ChainCircle, g: Geometry) {
  const denom = g.k * g.k * c.n * c.n + g.k + 1;
  const bigR = g.Rbig;
  const fromFormula = bigR * g.k / denom; // R_n = R k / (k²n² + k + 1)
  const apFormula = bigR * (g.k + 2) / denom; // AP_n = R(k+2) / (k²n² + k + 1)
  const dOuter = Math.hypot(c.center.x - g.outer.center.x, c.center.y - g.outer.center.y);
  const dInner = Math.hypot(c.center.x - g.inner.center.x, c.center.y - g.inner.center.y);
  const outerGap = dOuter + c.radius - g.outer.radius; // internal tangency
  const innerGap = dInner - (g.inner.radius + c.radius); // external tangency
  return {
    n: c.n,
    center: pt(c.center),
    radius: r6(c.radius),
    height: r6(c.height),
    AP: r6(c.AP),
    radiusFromFormula: r6(fromFormula),
    apFromFormula: r6(apFormula),
    radiusMatchesFormula: near(c.radius, fromFormula),
    apMatchesFormula: near(c.AP, apFormula),
    heightIsTwiceNRadius: near(c.height, 2 * c.n * c.radius),
    touchesOuter: near(outerGap, 0),
    touchesInner: near(innerGap, 0),
    outerGapResidual: r6(outerGap),
    innerGapResidual: r6(innerGap),
  };
}

/** Consecutive circles of the Pappus chain touch one another. */
function neighbourTangencies(g: Geometry) {
  const out: Array<{ nA: number; nB: number; gap: number; tangent: boolean }> = [];
  for (let i = 1; i < g.chain.length; i++) {
    const a = g.chain[i - 1], b = g.chain[i];
    const gap = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) - (a.radius + b.radius);
    out.push({ nA: a.n, nB: b.n, gap: r6(gap), tangent: near(gap, 0) });
  }
  return out;
}

/** Everything the two actions and the saved-position reader measure. */
function measure(C: ArbelosCore, s: CoreState) {
  const g = C.geometry(s);
  const chain = g.chain.map((c) => chainReading(c, g));
  const neighbours = neighbourTangencies(g);
  const oa = g.A.x - g.O.x, oap = g.Aprime.x - g.O.x;
  const ob = g.B.x - g.O.x, obp = g.Bprime.x - g.O.x;
  return {
    handles: {
      O: r6(g.O.x), A: r6(g.A.x), B: r6(g.B.x), R: r6(g.R.x),
      N: g.N, hints: g.hints,
    },
    inversion: {
      centre: pt(g.inversion.center),
      radius: r6(g.rho),
      rhoSquared: r6(g.rho * g.rho),
      inverseOfLineA: pt(g.Aprime),
      inverseOfLineB: pt(g.Bprime),
      OAtimesOAprime: r6(oa * oap),
      OBtimesOBprime: r6(ob * obp),
      linesInvertToPoints: near(oa * oap, g.rho * g.rho) && near(ob * obp, g.rho * g.rho),
    },
    boundaries: {
      k: r6(g.k),
      outer: { centre: pt(g.outer.center), radius: r6(g.outer.radius) },
      inner: { centre: pt(g.inner.center), radius: r6(g.inner.radius) },
      Rbig: r6(g.Rbig), RL: r6(g.RL), RR: r6(g.RR),
      gap: r6(g.gap),
    },
    strip: {
      centre: pt(g.strip.center), radius: r6(g.strip.radius), step: r6(g.strip.step),
      allImagesSameRadius: near(g.strip.step, g.gap),
    },
    chain,
    neighbourTangencies: neighbours,
    allPappusHeights: chain.every((c) => c.heightIsTwiceNRadius),
    allRadiiMatchFormula: chain.every((c) => c.radiusMatchesFormula),
    allAPsMatchFormula: chain.every((c) => c.apMatchesFormula),
    allTouchBothBoundaries: chain.every((c) => c.touchesOuter && c.touchesInner),
    allNeighboursTouch: neighbours.every((c) => c.tangent),
  };
}

export function actions(): GameActions {
  return {
    pappus_chain: {
      describe:
        "Build the arbelos from the x coordinates of the four axis handles O (centre of inversion), A, B and R (radius handle) and draw N circles (1–50; the applet's range) of the chain; point objects or [x, y] pairs work too. Reports each circle's centre, radius R_n, height h_n and distance AP_n from A, checking the closed forms R_n = R·k/(k²n²+k+1), h_n = 2n·R_n and AP_n = R(k+2)/(k²n²+k+1) with k = (B−A)/(A−O) and R the outer radius.",
      args: '{ "O": 70, "A": 190, "B": 270, "R": 210, "N": 4, "hints": true }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const m = measure(C, s);
        return {
          ...m,
          note:
            `With A−O = ${r6(s.A.x - s.O.x)} and B−A = ${r6(s.B.x - s.A.x)}, k = ${m.boundaries.k} and the outer radius is R = ${m.boundaries.Rbig}. ` +
            "Inversion in O sends the two tangent circles to the parallel lines through A and B and the chain to equal circles spaced one diameter apart; inverting back makes the nth circle's centre exactly 2n radii above the axis. Every radius, height, AP and residual above comes from the core's own geometry.",
        };
      },
    },
    inversion_tangencies: {
      describe:
        "Using the same four handles and N (1–50), check the inversion picture: O A·O A′ = O B·O B′ = ρ², the two boundary circles invert to parallel lines, and every chain circle touches both boundaries and its neighbours exactly. Reports the inverse points A′ and B′, the equal-circle strip, and each tangency residual in board units.",
      args: '{ "O": 70, "A": 190, "B": 270, "R": 210, "N": 3 }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        return measure(C, s);
      },
    },
  };
}

/** A finite point saved by Track.state; missing handles fall back to the core's. */
function savedPoint(C: ArbelosCore, state: Json, key: "O" | "A" | "B"): Pt {
  const fallback = C.START[key];
  const raw = state[key];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { x: num(raw as Json, "x", fallback.x), y: C.AXIS_Y };
  }
  return { x: num({ [key]: raw }, key, fallback.x), y: C.AXIS_Y };
}

/**
 * Track.state saves R as the *outer radius* (the key is overwritten by the
 * core's position()). Recover the radius handle from R² = ρ²/(2(A−O)) so the
 * core can rebuild the very same picture.
 */
function savedRadiusHandle(C: ArbelosCore, state: Json, O: Pt, A: Pt): number {
  const raw = state.R;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return num(raw as Json, "x", C.START.R.x);
  }
  const big = num({ R: raw }, "R", C.geometry(C.start({})).Rbig);
  const rho = Math.sqrt(Math.max(0, 2 * Math.max(C.MIN_RHO, A.x - O.x) * big));
  return rho > 0 ? O.x + rho : C.START.R.x;
}

/** Echo the saved payload, then rebuild and re-measure it with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Inversion in an Arbelos state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Inversion in an Arbelos position must be an object");
  }
  const C = core();
  const O = savedPoint(C, state, "O");
  const A = savedPoint(C, state, "A");
  const B = savedPoint(C, state, "B");
  const s = C.start({
    O, A, B,
    R: { x: savedRadiusHandle(C, state, O, A), y: C.AXIS_Y },
    N: num(state, "N", C.START.N),
    hints: state.hints === true,
  });
  const reading = measure(C, s);
  const fromCore = C.position(s);
  const maybeNum = (v: unknown): number | null => {
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const close = (a: unknown, b: unknown): boolean => {
    const x = maybeNum(a), y = maybeNum(b);
    return x !== null && y !== null && near(x, y, 1e-3);
  };
  const savedChain = Array.isArray(state.chain) ? state.chain as Json[] : [];
  const coreChain = Array.isArray(fromCore.chain) ? fromCore.chain as Json[] : [];
  const matches: Record<string, boolean> = {
    O: close((state.O as Json | undefined)?.x, (fromCore.O as Json | undefined)?.x),
    A: close((state.A as Json | undefined)?.x, (fromCore.A as Json).x as number),
    B: close((state.B as Json | undefined)?.x, (fromCore.B as Json).x as number),
    N: close(state.N, s.N),
    hints: state.hints === fromCore.hints,
    k: close(state.k, typeof fromCore.k === "number" ? fromCore.k : NaN),
    R: close(state.R, typeof fromCore.R === "number" ? fromCore.R : NaN),
    RL: close(state.RL, typeof fromCore.RL === "number" ? fromCore.RL : NaN),
    RR: close(state.RR, typeof fromCore.RR === "number" ? fromCore.RR : NaN),
    chain: savedChain.length === coreChain.length && savedChain.every((c, i) => {
      const k = coreChain[i];
      if (!k || typeof k !== "object") return false;
      const cp = k as Json;
      const centre = c.center as Json | undefined;
      const coreCentre = cp.center as Json | undefined;
      return close(c.n, Number(cp.n)) && close(centre?.x, Number(coreCentre?.x)) &&
        close(centre?.y, Number(coreCentre?.y)) && close(c.radius, Number(cp.radius)) &&
        close(c.height, Number(cp.height));
    }),
  };
  const first = reading.chain[0];
  return {
    ...state,
    stateVersion,
    saved: {
      O: savedPoint(C, state, "O"), A: savedPoint(C, state, "A"), B: savedPoint(C, state, "B"),
      R: maybeNum(state.R), N: s.N, hints: state.hints === true,
      k: maybeNum(state.k), RL: maybeNum(state.RL), RR: maybeNum(state.RR),
      chain: savedChain,
    },
    derived: {
      inversionRadius: reading.inversion.radius,
      outerRadius: reading.boundaries.Rbig,
      innerRadius: reading.boundaries.RL,
      strip: reading.strip,
      circles: reading.chain.length,
      allPappusHeights: reading.allPappusHeights,
      allRadiiMatchFormula: reading.allRadiiMatchFormula,
      allAPsMatchFormula: reading.allAPsMatchFormula,
      allTouchBothBoundaries: reading.allTouchBothBoundaries,
      allNeighboursTouch: reading.allNeighboursTouch,
      firstCircle: first ?? null,
    },
    core: reading,
    corePosition: fromCore,
    savedMatchesCore: { ...matches, all: Object.values(matches).every(Boolean) },
    note:
      "Track.state saved the four axis handles, N, the guide-line flag and the derived k, outer radius R, the two radii RL and RR, and the chain circles (with y measured down from the axis). The core recovers the radius handle from the saved outer radius, rebuilds the picture and checks each saved field; its Pappus reading has h_n = 2n·R_n and R_n = R·k/(k²n²+k+1).",
  };
}
