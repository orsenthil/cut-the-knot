/*
 * run_game_logic actions and saved-position reader for Escher Ceva Menelaus.
 *
 * The real core is escher-ceva-menelaus/escher-ceva-menelaus-core.js, copied
 * into src/generated/cores/ at build time. A triangle A1A2A3 has two marked
 * points on each side: B1, C1 on A2A3 (a side cut into grid.BC parts), B2, C2
 * on A3A1 (grid.CA parts) and B3, C3 on A1A2 (grid.AB parts). With
 *   b = (n - i)/i for a B mark and c = i/(n - i) for a C mark,
 * the three lines C1B2, C2B3, C3B1 are concurrent exactly when
 *   F = b1b2b3 + c1c2c3 + b1c1 + b2c2 + b3c3 = 1.
 * The page's opening picture is one of the twelve adjacent-tick patterns
 * M. C. Escher found on sides cut into 3, 4 and 5 parts. That is NOT the
 * "Escher's Theorem" about Napoleon hexagons, 120-degree rotations and a
 * tessellation. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["escher-ceva-menelaus"].EscherCevaMenelausCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Divisions = { AB: number; BC: number; CA: number };
type Marks = { B1: number; C1: number; B2: number; C2: number; B3: number; C3: number };
type State = {
  corners: { A1: Point; A2: Point; A3: Point };
  divisions: Divisions;
  grid: Divisions;
  marks: Marks;
};

const SIDES = ["AB", "BC", "CA"] as const;
const MARKS = ["B1", "C1", "B2", "C2", "B3", "C3"] as const;
const SIDE_OF: Record<(typeof MARKS)[number], (typeof SIDES)[number]> = {
  B1: "BC", C1: "BC", B2: "CA", C2: "CA", B3: "AB", C3: "AB",
};
const CRITERION = "F = b1b2b3 + c1c2c3 + b1c1 + b2c2 + b3c3 = 1";

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : r6(v);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const near = (a: number, b: number, tol = 1e-9): boolean =>
  Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** A point as the page saves it ({x, y}) or as a short [x, y] argument. */
function readPoint(raw: unknown, label: string): Point {
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} is not a finite point`);
    return { x, y };
  }
  if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`${label} must be [x, y] or { "x": ..., "y": ... }`);
}

function readDivisions(K: Core, raw: unknown, label: string): Divisions {
  if (raw === null || typeof raw !== "object") {
    throw new Error(`${label} must be an object with integer AB, BC and CA values`);
  }
  const o = raw as Json;
  const out = {} as Divisions;
  for (const side of SIDES) {
    const n = num(o, side);
    if (!Number.isInteger(n) || n < K.DIV_MIN || n > K.DIV_MAX) {
      throw new Error(`${label}.${side} must be an integer between ${K.DIV_MIN} and ${K.DIV_MAX}`);
    }
    out[side] = n;
  }
  return out;
}

/**
 * The six integer indices. A B mark i needs 1 <= i <= n-1 (else (n-i)/i
 * divides by zero) and a C mark needs 0 <= i <= n-1 (else i/(n-i) does).
 */
function readMarks(raw: unknown, grid: Divisions, strict: boolean, seed: Marks): Marks {
  if (raw === null || typeof raw !== "object") {
    if (strict) throw new Error('argument "marks" must be an object with B1, C1, B2, C2, B3 and C3');
    return { ...seed };
  }
  const o = raw as Json;
  const out = { ...seed };
  for (const m of MARKS) {
    if (o[m] === undefined || o[m] === null) continue; // keep the start value
    const i = num(o, m);
    if (!Number.isInteger(i)) throw new Error(`marks.${m} must be an integer tick index`);
    const n = grid[SIDE_OF[m]];
    const low = m[0] === "B" ? 1 : 0;
    if (strict && (i < low || i > n - 1)) {
      throw new Error(
        `marks.${m} = ${i} is off the side: ${m} lies on a side with ${n} divisions, ` +
        `so its index must be between ${low} and ${n - 1} (otherwise its ratio divides by zero)`,
      );
    }
    out[m] = i;
  }
  return out;
}

/** Build the exact position the page saves, starting from the core's seed. */
function readState(K: Core, args: Json, strict: boolean): State {
  const seed = K.start({}) as State;
  let corners = seed.corners;
  if (args.corners !== undefined && args.corners !== null) {
    const c = args.corners as Json;
    corners = {
      A1: readPoint(c.A1, "corners.A1"),
      A2: readPoint(c.A2, "corners.A2"),
      A3: readPoint(c.A3, "corners.A3"),
    };
  }
  const divisions = args.divisions === undefined || args.divisions === null
    ? seed.divisions : readDivisions(K, args.divisions, "divisions");
  const grid = args.grid === undefined || args.grid === null
    ? (args.divisions === undefined || args.divisions === null ? seed.grid : { ...divisions })
    : readDivisions(K, args.grid, "grid");
  const marks = readMarks(args.marks, grid, strict, seed.marks);
  return { corners, divisions, grid, marks };
}

/** Everything worth telling a tutor about one drawing, measured by the core. */
function reading(K: Core, s: State) {
  const pos = K.start(s);
  const ev = K.evaluate(pos);
  const nums = ev.numbers as Record<string, number>;
  const fGeom = ev.formula;
  const fIdx = K.formulaFromIndices(pos);
  const det = K.lineDeterminant(pos);
  const center = ev.crossings.center;
  const satisfied = near(fIdx, 1);
  return {
    divisions: s.divisions,
    grid: s.grid,
    marks: s.marks,
    numbers: Object.fromEntries(MARKS.map((m) => [m, r6(nums[m])])),
    formula: {
      geometric: maybe(fGeom),
      fromIndices: maybe(fIdx),
      criterion: 1,
      satisfied,
      appletFinished: ev.finished,
    },
    concurrence: {
      determinant: maybe(det),
      concurrent: ev.concurrent,
      crossings: ev.crossings.points.map(pt),
      center: pt(center),
      agreesWithFormula: satisfied === ev.concurrent,
    },
    note:
      `With b = (n-i)/i for a B mark and c = i/(n-i) for a C mark, ${CRITERION} ` +
      `exactly when C1B2, C2B3 and C3B1 meet at one point. Here F = ${maybe(fIdx)} ` +
      `(the panel's divisions are ${s.divisions.AB}-${s.divisions.BC}-${s.divisions.CA}, while the ` +
      `marks are snapped to the grid's ${s.grid.AB}-${s.grid.BC}-${s.grid.CA} ticks). ` +
      (satisfied
        ? "The criterion holds, so the three lines are concurrent and the applet marks the crossing P."
        : "The criterion fails, so the three lines miss one another.") +
      " " +
      (satisfied === ev.concurrent
        ? "The formula and the independent barycentric determinant agree."
        : "The formula and the drawn-line determinant disagree: check a degenerate point.") +
      " This is the Klamkin–Liu generalization of Ceva and Menelaus, not the Napoleon-hexagon result called Escher's Theorem.",
  };
}

export function actions(): GameActions {
  return {
    evaluate: {
      describe:
        "Measure one drawing of Escher Ceva Menelaus. divisions are the three spinner values (AB, BC, CA, integers 2..30); grid is the tick counts the marks actually snap to (defaults to divisions); marks are the six integer indices B1, C1 on BC, B2, C2 on CA and B3, C3 on AB, with B indices from 1 and C indices from 0; corners A1, A2, A3 are optional points. Reports the six numbers b1,b2,b3,c1,c2,c3, the Klamkin–Liu number F = b1b2b3 + c1c2c3 + b1c1 + b2c2 + b3c3 from both the drawn geometry and the indices, whether F = 1, whether C1B2, C2B3, C3B1 really concur (independent determinant), their crossings and centre, and the applet's |1-F| < 0.01 finish flag. The default marks are the opening Escher picture {B1:4,C1:3,B2:1,C2:0,B3:2,C3:1} on a 3-5-4 grid, where F = 1.",
      args: '{ "divisions": { "AB": 3, "BC": 5, "CA": 4 }, "marks": { "B1": 4, "C1": 3, "B2": 1, "C2": 0, "B3": 2, "C3": 1 } }',
      run: (args) => {
        const K = core();
        return reading(K, readState(K, args, true));
      },
    },
    escher_patterns: {
      describe:
        "Enumerate the adjacent-tick concurrences Escher found when a triangle's sides are cut into 3, 4 and 5 equal parts. For each of the six assignments of 3, 4, 5 to sides AB, BC, CA it puts B one tick after C on every side and keeps the choices where F = 1 and the three lines really concur; it also counts the opposite (B one tick before C) choices and tests whether the opening picture is among the results. Returns every pattern with its divisions, indices, six numbers, F and meeting point, plus an explanation that these twelve are a Ceva/Menelaus concurrence and are not the Napoleon-hexagon theorem usually called Escher's Theorem. Optional parts defaults to [3, 4, 5]; any other triple is enumerated the same way but the count of twelve is specific to 3-4-5.",
      args: "{}",
      run: (args) => {
        const K = core();
        const parts: number[] = args.parts === undefined || args.parts === null
          ? [3, 4, 5]
          : (Array.isArray(args.parts) ? args.parts : []);
        if (parts.length !== 3 || !parts.every((v) => Number.isInteger(Number(v)) && Number(v) >= K.DIV_MIN && Number(v) <= K.DIV_MAX)) {
          throw new Error(`argument "parts" must be three integers between ${K.DIV_MIN} and ${K.DIV_MAX}`);
        }
        const p = parts.map(Number);
        const idx = [0, 1, 2];
        const permKeys = new Set<string>();
        const perms: number[][] = [];
        for (const a of idx) for (const b of idx) for (const c of idx) {
          if (a === b || b === c || a === c) continue;
          const key = `${p[a]},${p[b]},${p[c]}`;
          if (permKeys.has(key)) continue;
          permKeys.add(key);
          perms.push([p[a], p[b], p[c]]);
        }

        const found: Json[] = [];
        let reverse = 0;
        for (const [ab, bc, ca] of perms) {
          const divisions = { AB: ab, BC: bc, CA: ca };
          for (let iB1 = 1; iB1 <= bc; iB1++)
          for (let iB2 = 1; iB2 <= ca; iB2++)
          for (let iB3 = 1; iB3 <= ab; iB3++) {
            const pos = K.fromIndices(divisions, iB1, iB1 - 1, iB2, iB2 - 1, iB3, iB3 - 1);
            const f = K.formulaFromIndices(pos);
            if (near(f, 1) && K.concurrent(pos)) {
              found.push({
                divisions,
                marks: { B1: iB1, C1: iB1 - 1, B2: iB2, C2: iB2 - 1, B3: iB3, C3: iB3 - 1 },
                formula: maybe(f),
                numbers: K.numbers(pos),
                center: pt(K.crossings(pos).center),
              });
            }
            if (iB1 < bc && iB2 < ca && iB3 < ab) {
              const mirror = K.fromIndices(divisions, iB1, iB1 + 1, iB2, iB2 + 1, iB3, iB3 + 1);
              if (near(K.formulaFromIndices(mirror), 1) && K.concurrent(mirror)) reverse++;
            }
          }
        }
        const opening = found.some((x) => {
          const d = x.divisions as Divisions;
          const m = x.marks as Marks;
          return d.AB === 3 && d.BC === 5 && d.CA === 4 &&
            m.B1 === 4 && m.B2 === 1 && m.B3 === 2;
        });
        const isTwelve = p[0] === 3 && p[1] === 4 && p[2] === 5 && found.length === 12 && reverse === 0;
        return {
          parts: p,
          sideAssignments: perms.map(([AB, BC, CA]) => ({ AB, BC, CA })),
          count: found.length,
          patterns: found,
          oppositeAdjacentCount: reverse,
          openingPictureIsAmongThem: opening,
          twelveConfirmed: isTwelve,
          note:
            `Across the ${perms.length} ways of putting ${p.join("-")} on the three sides, exactly ${found.length} ` +
            `adjacent-tick choices satisfy ${CRITERION} and give finite concurrent lines` +
            (isTwelve ? " (the twelve Escher patterns; two per assignment); the opposite adjacent choice gives none" : "") +
            `. The opening 3-5-4 picture ${opening ? "is" : "is not"} one of them. ` +
            "Other integer dot choices can also satisfy the equation, so twelve counts only the adjacent-tick patterns. " +
            "This is the Ceva/Menelaus concurrence criterion on a triangle cut into 3, 4 and 5 parts; it is different from the Napoleon-hexagon result known as Escher's Theorem, which uses 120-degree rotations and a tessellation.",
        };
      },
    },
  };
}

/** The saved Track.state fields, read again through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const K = core();
  const savedPoint = (key: string): Point | null =>
    state.corners && typeof state.corners === "object"
      ? pt((state.corners as Json)[key] as Point)
      : null;
  const saved = {
    stateVersion,
    corners: {
      A1: savedPoint("A1"), A2: savedPoint("A2"), A3: savedPoint("A3"),
    },
    divisions: state.divisions ?? null,
    grid: state.grid ?? null,
    marks: state.marks ?? null,
  };
  try {
    const s = readState(K, state, false);
    const pos = K.start(s);
    return {
      ...saved,
      result: K.result(),
      reading: reading(K, s),
      note:
        "Track.state saves the three corners, the panel's divisions, the grid the marks snap to and the six integer indices — not the derived ratios or crossings. The reading recomputes b1,b2,b3,c1,c2,c3, F = b1b2b3 + c1c2c3 + b1c1 + b2c2 + b3c3, the drawn-line determinant and the meeting point with the same core the page uses, so the saved picture can be checked against the concurrence criterion. This is an illustration: there is no win or loss.",
    };
  } catch (e) {
    return {
      ...saved,
      reading: null,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
