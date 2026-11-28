/*
 * run_game_logic actions and saved-position reader for Max Common Chord 6
 * (Bogomolny's MaxCommonChord6 applet, "Problem 4, 1975 USA Math Olympiad:
 * The Final Touch").
 *
 * The earlier siblings find the best chord two ways. Max Common Chord and
 * Max Common Chord 3 show that AP × PB = PQ × PR and that the centre S of
 * circle ABQ must sit on C(O) with OS parallel to PQ; Max Common Chord 5
 * shows the concyclicities around W. This last page joins them: at that S,
 * W = AE ∩ BF lies on both C(O) and C(S), RW is a diameter of C(S), so
 * Thales gives RA ⟂ EA and RB ⟂ FB, which is the same as ∠EPA = ∠FPB.
 *
 * Every number below comes from the real core, copied at build time from
 * max-common-chord-6/max-common-chord-6-core.js into src/generated/cores/.
 * Coordinates are board units of the 640 × 460 board, y down. See _shared.ts
 * for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circ = { x: number; y: number; r: number };
type State = { P: Pt; Q: Pt; A: Pt; B: Pt; mode: string; showNames: boolean };
type Geometry = {
  valid: boolean; finished: boolean; product: number;
  E: Circ; F: Circ; EQF: Circ; AB: Circ;
  L: Pt; M: Pt; R: Pt; S: Pt; U: Pt; T: Pt; N: Pt; W: Pt;
  circleS: Circ; perp: Pt; angleUS: number; angleST: number;
};
type Core = {
  WIDTH: number; HEIGHT: number; FINISHED_EPS: number;
  start(o?: { width?: number; height?: number }): State;
  drag(s: State, name: string, p: Pt): State;
  compute(s: State): Geometry;
  optimal(s: State): State | null;
  describe(s: State): string;
  result(s: State): null;
  geom: {
    dist(a: Pt, b: Pt): number;
    midpoint(a: Pt, b: Pt): Pt;
    angleAt(v: Pt, p: Pt, q: Pt): number;
  };
};
const core = (): Core => cores["max-common-chord-6"].MaxCommonChord6Core as unknown as Core;

const HANDLES = ["P", "Q", "A", "B"] as const;

/* Six decimals keep the core's numbers readable without inventing precision. */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
/** JSON cannot carry NaN/Infinity; print non-finite core values as null. */
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const pt = (v: Pt | null | undefined): Pt | null =>
  v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: r6(v.x), y: r6(v.y) } : null;
const circ = (v: Circ | null | undefined) =>
  v ? { center: pt(v), radius: cnt(v.r) } : null;
const close = (a: number, b: number, tol = 1e-3): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < tol;
const deg = (radians: number): number => (radians * 180) / Math.PI;

/** Tutor points may be [x, y] or { x, y }; both must be finite. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Start at the applet's opening picture, then use any supplied handles as-is. */
function makeState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points and options");
  }
  const s = C.start({});
  for (const name of HANDLES) {
    const v = args[name];
    if (v !== undefined && v !== null) s[name] = readPoint(v, name);
  }
  const mode = args.mode === undefined || args.mode === null ? "chord" : String(args.mode);
  if (mode !== "chord" && mode !== "circles") {
    throw new Error('"mode" must be "chord" or "circles"');
  }
  s.mode = mode;
  s.showNames = args.showNames === undefined ? false : Boolean(args.showNames);
  return s;
}

/** Everything the real core can say about one picture. */
function reading(C: Core, s: State, g: Geometry) {
  const D = (a: Pt, b: Pt): number => C.geom.dist(a, b);
  const PQ = D(s.P, s.Q);
  const unit: Pt | null = PQ >= 1
    ? { x: (s.P.x - s.Q.x) / PQ, y: (s.P.y - s.Q.y) / PQ }
    : null;
  /* C(O)'s radius OS points toward P at the maximum; compare the core's S. */
  const targetS: Pt | null = unit
    ? { x: g.EQF.x + unit.x * g.EQF.r, y: g.EQF.y + unit.y * g.EQF.r }
    : null;
  const rightA = deg(C.geom.angleAt(s.A, g.R, g.E));  // ∠RAE, should be 90°
  const rightB = deg(C.geom.angleAt(s.B, g.R, g.F));  // ∠RBF, should be 90°
  const epa = deg(C.geom.angleAt(s.P, g.E, s.A));     // ∠EPA
  const fpb = deg(C.geom.angleAt(s.P, g.F, s.B));     // ∠FPB
  const midpointRW = C.geom.midpoint(g.R, g.W);
  const angleGap = Math.abs(g.angleUS - g.angleST);
  /* The circle claims need a straight bar; dragging P alone can bend it. */
  const cross = (s.P.x - s.A.x) * (s.B.y - s.P.y) - (s.P.y - s.A.y) * (s.B.x - s.P.x);
  const onChord = close(cross / Math.max(1, D(s.A, s.B)), 0);
  return {
    valid: g.valid,
    finished: g.finished,
    mode: s.mode,
    handles: Object.fromEntries(HANDLES.map((n) => [n, pt(s[n])])),
    onChord,
    chord: {
      A: pt(s.A), P: pt(s.P), B: pt(s.B),
      AP: cnt(D(s.A, s.P)), PB: cnt(D(s.P, s.B)), product: cnt(g.product),
    },
    circles: {
      E: circ(g.E), F: circ(g.F), CO: circ(g.EQF), ABQ: circ(g.AB),
    },
    finalTouch: {
      S: pt(g.S), W: pt(g.W), R: pt(g.R), circleS: circ(g.circleS),
      SOnCO: close(D(g.S, g.EQF), g.EQF.r),
      OSparallelPQ: targetS === null ? null : close(D(g.S, targetS), 0),
      WOnCO: close(D(g.W, g.EQF), g.EQF.r),
      WOnCS: close(D(g.W, g.S), g.circleS.r),
      RDiameterOfCS: close(D(g.R, g.W), 2 * g.circleS.r),
      midpointRW: pt(midpointRW),
      midpointIsS: close(D(midpointRW, g.S), 0),
      rightAtA: { degrees: cnt(rightA), right: close(rightA, 90, 0.05) },
      rightAtB: { degrees: cnt(rightB), right: close(rightB, 90, 0.05) },
      equalAngles: {
        EPA: cnt(epa), FPB: cnt(fpb), equal: close(epa, fpb, 0.05),
      },
      angleGap: cnt(angleGap),
      withinAppletEps: angleGap < C.FINISHED_EPS,
    },
    note: g.finished
      ? "The final touch is in place: S is the point of C(O) with OS parallel to PQ, W lies on C(O) and C(S), RW is a diameter so RA and RB are tangents, and ∠EPA = ∠FPB gives the largest AP × PB."
      : !onChord
        ? "A, P and B are not quite in line, so the circle-through-A-P-B construction is bent and the concyclicity with W fails; drag A or B back onto the bar before reading the circle claims."
        : "With a straight bar W lies on C(O) and C(S), but RW is a diameter, RA and RB are perpendicular to the radii, and the two angles at P match only at the maximum. Press “Show the best chord” (or call final_touch) to see them.",
  };
}

export function actions(): GameActions {
  return {
    final_touch: {
      describe:
        "Compare the picture on the board with the best chord from the real core, then verify the final touch at that optimum: S on C(O) with OS parallel to PQ, W = AE ∩ BF on both C(O) and C(S), RW a diameter giving RA ⟂ EA and RB ⟂ FB, and ∠EPA = ∠FPB — joining the longest-chord result of Max Common Chord / 3 to the concyclicity of Max Common Chord 5. Optional P, Q, A and B may be [x, y] or { x, y }; omit any to keep the opening picture.",
      args: '{"P":[352.090909090909,276],"Q":[320,368],"A":[259,251],"B":[574.95652967636,338.67713992028]}',
      run: (args) => {
        const C = core();
        const base = makeState(C, args);
        const now = C.compute(base);
        const best = C.optimal(base);
        if (!best) {
          return {
            current: reading(C, base, now), optimum: null,
            note: "This layout has no finite optimum; move P, Q, A and B further apart.",
          };
        }
        const optimum = C.compute(best);
        return {
          current: reading(C, base, now),
          optimum: reading(C, best, optimum),
          optimumHandles: Object.fromEntries(HANDLES.map((n) => [n, pt(best[n])])),
          gain: cnt(optimum.product - now.product),
          gainPercent: now.product > 0 ? cnt(100 * (optimum.product / now.product - 1)) : null,
          note:
            `Moving A and B to the optimum raises AP × PB from ${cnt(now.product)} to ${cnt(optimum.product)} ` +
            `(${cnt(100 * (optimum.product / now.product - 1))}% here). ` +
            "At that chord every check in optimum.finalTouch holds: the diameter gives the two right angles by Thales, and the matching angles at P are the angle answer from the olympiad. This is a drawing, so there is no win or loss.",
        };
      },
    },

    sweep_maximum: {
      describe:
        "Rotate the chord about P in `steps` directions (12 to 1440, default 360), dragging A around the circle through A, P and Q and letting the real core move B with it, then compare the largest AP × PB found with the synthetic optimum from optimal(). A sweep that cannot beat the optimum confirms that the point where W makes RW a diameter and ∠EPA = ∠FPB really is the maximum. Optional P, Q, A and B set the starting circles.",
      args: '{"steps":360}',
      run: (args) => {
        const C = core();
        const base = makeState(C, args);
        const steps = num(args, "steps", 360);
        if (!Number.isInteger(steps) || steps < 12 || steps > 1440) {
          throw new Error('"steps" must be a whole number from 12 to 1440');
        }
        const startGeom = C.compute(base);
        if (!startGeom.valid) {
          return {
            steps, validDirections: 0, bestSwept: null, optimum: null,
            note: "No circle can be drawn here; move P, Q, A and B apart.",
          };
        }
        const E = startGeom.E;
        let bestProduct = -Infinity;
        let bestState: State | null = null;
        let bestGeom: Geometry | null = null;
        let validDirections = 0;
        for (let i = 0; i < steps; i++) {
          const angle = (2 * Math.PI * i) / steps;
          const a = { x: E.x + E.r * Math.cos(angle), y: E.y + E.r * Math.sin(angle) };
          const s = C.drag({ ...base, mode: "chord" }, "A", a);
          /* drag() clamps to the board; skip directions it could not follow. */
          if (!close(C.geom.dist(s.A, E), E.r, 0.05)) continue;
          const g = C.compute(s);
          if (!g.valid) continue;
          validDirections++;
          if (g.product > bestProduct) {
            bestProduct = g.product;
            bestState = s;
            bestGeom = g;
          }
        }
        if (!bestState || !bestGeom) {
          return {
            steps, validDirections, bestSwept: null, optimum: null,
            note: "No direction gave a drawable chord; move P, Q, A and B apart.",
          };
        }
        const optimumState = C.optimal(base);
        const optimum = optimumState ? C.compute(optimumState) : null;
        const excess = optimum ? bestProduct - optimum.product : null;
        const reachesOptimum = excess === null ? null : excess < Math.max(1, optimum!.product * 1e-6);
        return {
          steps, validDirections,
          bestSwept: reading(C, bestState, bestGeom),
          optimum: optimum && optimumState ? reading(C, optimumState, optimum) : null,
          bestSweptProduct: cnt(bestProduct),
          optimumProduct: optimum ? cnt(optimum.product) : null,
          sweptMinusOptimum: excess === null ? null : cnt(excess),
          reachesOptimum,
          note: optimum
            ? `Of ${validDirections} drawable directions the largest AP × PB was ${cnt(bestProduct)}, against ${cnt(optimum.product)} at the constructed optimum (difference ${cnt(excess)}). ` +
              (reachesOptimum
                ? "The sweep cannot beat the point where RW is a diameter and the two angles at P are equal."
                : "A coarse sweep lands near, but not exactly on, the optimum; raise `steps` to close the gap.")
            : "The core found no optimum for these circles.",
        };
      },
    },
  };
}

/** Echo every field Track.state saved, plus a fresh core reading of the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Max Common Chord 6 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Max Common Chord 6 position must be an object");
  }
  const C = core();
  const s = makeState(C, state);
  const g = C.compute(s);
  const readingResult = reading(C, s, g);
  const coreOnChord = readingResult.onChord === true;
  const scalar = (saved: unknown, value: number) => ({
    saved: cnt(Number(saved)), core: cnt(value), equal: close(Number(saved), value),
  });
  const flag = (saved: unknown, value: boolean) => ({
    saved: saved === true, core: value, equal: (saved === true) === value,
  });
  const pointPair = (label: string, saved: unknown, value: Pt) => {
    const p = saved === undefined || saved === null ? null : readPoint(saved, `saved ${label}`);
    return { saved: pt(p), core: pt(value), distance: p ? cnt(C.geom.dist(p, value)) : null };
  };
  return {
    ...state,
    stateVersion,
    saved: { ...state },
    valid: g.valid,
    core: readingResult,
    savedVsCore: {
      product: scalar(state.product, g.product),
      finished: flag(state.finished, g.finished),
      S: pointPair("S", state.S, g.S),
      W: pointPair("W", state.W, g.W),
    },
    note:
      "Track.state saved the four handles P, Q, A and B, the mode and name switch, and the derived S, W, finished flag and AP × PB product, all in board units. " +
      "The real core rebuilds the circles, S, W and R from those handles; savedVsCore measures how close the saved derived values are to a fresh computation. " +
      (g.finished
        ? " Here RW is a diameter and the two angles at P match, so the chord is at its maximum."
        : coreOnChord
          ? " Here the bar is straight but the chord is not at its maximum: RW is not a diameter and the two angles at P differ."
          : " Here A, P and B are not quite in line, so even the concyclicity with W fails; the saved derived points are otherwise exactly what the core computes."),
  };
}
