/*
 * run_game_logic actions and saved-position reader for Diameters And Chords.
 *
 * A circle carries three diameters BBt, CCt, MtNt and two chords BAb, CAc.
 * M and N are where those chords cross the third diameter; Kb is the second
 * point where NBt meets the circle and Kc the second point where MCt meets it.
 * Pascal's theorem, applied to the hexagon A B Bt Kb Ct C, says that Ab and Ac
 * coincide exactly when Kb and Kc coincide. Both pairs are measured in board
 * units on the page's 400 x 360 view; the applet declares two points "the
 * same" when they are under one screen pixel apart, and keeps a stricter
 * 1e-6 test for exact floating-point equality.
 *
 * Every number below comes from the game's real core
 * (diameters-and-chords/diameters-and-chords-core.js), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["diameters-and-chords"].DiametersAndChordsCore as any;

type Point = { x: number; y: number };
type AngleName = "Ab" | "Ac" | "B" | "C" | "Mt";
const ANGLE_NAMES: AngleName[] = ["Ab", "Ac", "B", "C", "Mt"];

const round = (v: number, digits = 4): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: any): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const finiteNum = (v: number): number | null => Number.isFinite(v) ? round(v) : null;

/** One named angle in radians; missing values fall back to the core's start. */
function readAngle(value: unknown, label: string, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`"${label}" must be a finite angle in radians, got ${JSON.stringify(value)}`);
  }
  return n;
}

/**
 * The five free angles may be given as top-level fields or under "angles".
 * Nt is never supplied: the core keeps it antipodal to Mt.
 */
function readAngles(args: Json, C: any): Record<AngleName, number> {
  const nested = args.angles;
  if (nested !== undefined && nested !== null &&
      (typeof nested !== "object" || Array.isArray(nested))) {
    throw new Error('"angles" must be an object of named angles in radians');
  }
  const src: Json = nested && typeof nested === "object" ? nested as Json : {};
  const out = {} as Record<AngleName, number>;
  for (const name of ANGLE_NAMES) {
    const top = args[name];
    const v = top !== undefined && top !== null ? top : src[name];
    out[name] = readAngle(v, name, C.START_ANGLES[name] as number);
  }
  return out;
}

function readOffsets(args: Json): number[] {
  const raw = args.offsets;
  const values = raw === undefined || raw === null
    ? [0, 0.0001, 0.001, 0.01, 0.1, 0.5]
    : numArray(args, "offsets");
  if (values.length === 0) throw new Error('"offsets" must be a non-empty array of numbers');
  if (values.length > 24) throw new Error('"offsets" has too many entries (limit 24)');
  return values;
}

function buildState(args: Json) {
  const C = core();
  const angles = readAngles(args, C);
  return C.fromAngles(angles, { names: args.names === true, hint: args.hint === true });
}

/** Everything the core measures at one arrangement, phrased for a tutor. */
function reading(C: any, s: any) {
  const g = C.geometry(s);
  const a = finiteNum(g.aDistance);
  const k = finiteNum(g.kDistance);
  return {
    angles: {
      Ab: round(g.angles.Ab, 6), Ac: round(g.angles.Ac, 6),
      B: round(g.angles.B, 6), C: round(g.angles.C, 6),
      Mt: round(g.angles.Mt, 6), Nt: round(g.angles.Nt, 6),
    },
    circle: { c: pt(g.circle.c), r: round(g.circle.r) },
    points: {
      Ab: pt(g.Ab), Ac: pt(g.Ac), B: pt(g.B), C: pt(g.C), Mt: pt(g.Mt), Nt: pt(g.Nt),
      Bt: pt(g.Bt), Ct: pt(g.Ct), Kb: pt(g.Kb), Kc: pt(g.Kc),
      M: pt(g.M), N: pt(g.N), L: pt(g.L), O: pt(g.circle.c),
    },
    distances: {
      abToAc: a, kbToKc: k,
      units: "board units on the 400 x 360 view",
      onePixelThreshold: 1, exactThreshold: 1e-6,
    },
    coincidence: {
      A: { onePixel: g.aCoincide === true, exact: g.aExact === true },
      K: { onePixel: g.kCoincide === true, exact: g.kExact === true },
      equivalenceHolds: (g.aCoincide === true) === (g.kCoincide === true) &&
        (g.aExact === true) === (g.kExact === true),
    },
    pascalHexagon: [pt(g.Ab), pt(g.B), pt(g.Bt), pt(g.Kb), pt(g.Ct), pt(g.C)],
    finished: g.finished === true,
    status: C.describe(s) as string,
  };
}

export function actions(): GameActions {
  return {
    pascal_equivalence: {
      describe:
        "Place the five draggable points by their angles in radians (Ab, Ac, B, C, Mt; Nt is always antipodal to Mt) and run the real core on that arrangement. Report the coordinates of Ab/Ac and Kb/Kc, their distances, and whether each pair coincides — both with the applet's one-pixel test (under 1 board unit) and with a stricter 1e-6 exact test — together with the Pascal hexagon A-B-Bt-Kb-Ct-C. The theorem says Ab and Ac meet exactly when Kb and Kc meet; because the applet uses a one-pixel test, a small non-zero gap can still read as 'the same point'. Angles default to the core's opening picture, so passing just Ac equal to Ab (1.727875959474386) shows the exact meeting case.",
      args: '{ "Ac": 1.727875959474386 }',
      run: (args) => {
        const C = core();
        const s = buildState(args);
        const r = reading(C, s);
        const a = r.distances.abToAc;
        const k = r.distances.kbToKc;
        const onePixel = r.coincidence;
        return {
          ...r,
          note:
            `Pascal's theorem on the hexagon A-B-Bt-Kb-Ct-C forces Ab = Ac exactly when Kb = Kc. ` +
            `Here the core measures Ab/Ac ${a === null ? "-" : a.toFixed(4)} and Kb/Kc ` +
            `${k === null ? "-" : k.toFixed(4)} board units apart; by the applet's one-pixel test ` +
            `the A pair reads ${onePixel.A.onePixel ? "coincident" : "apart"} and the K pair ` +
            `${onePixel.K.onePixel ? "coincident" : "apart"} ` +
            `(${onePixel.equivalenceHolds ? "in agreement" : "in disagreement"}). ` +
            `The one-pixel cutoff, not exact equality, is what the applet uses to finish the diagram, ` +
            `so points within a pixel of each other are reported as one point even though their ` +
            `measured distance is small but non-zero.`,
        };
      },
    },

    coincidence_sweep: {
      describe:
        "Keep Ab, B, C and Mt fixed and slide Ac by each offset in radians from Ab's angle (offsets default to 0, 1e-4, 1e-3, 0.01, 0.1, 0.5; at most 24 values), measuring both distances with the real core each time. Report aDistance and kDistance, the one-pixel and exact coincidence flags, and whether the two pairs agree at every sample. Offset 0 is the exact meeting point; small non-zero offsets fall inside the applet's one-pixel band, where both pairs read as coincident.",
      args: '{ "offsets": [0, 0.0001, 0.001, 0.01, 0.1, 0.5] }',
      run: (args) => {
        const C = core();
        const base = readAngles(args, C);
        const offsets = readOffsets(args);
        const rows = offsets.map((off) => {
          const s = C.fromAngles(Object.assign({}, base, { Ac: base.Ab + off }),
            { names: args.names === true, hint: args.hint === true });
          const r = reading(C, s);
          return {
            offset: round(off, 6),
            acAngle: r.angles.Ac,
            abToAc: r.distances.abToAc,
            kbToKc: r.distances.kbToKc,
            aOnePixel: r.coincidence.A.onePixel,
            kOnePixel: r.coincidence.K.onePixel,
            aExact: r.coincidence.A.exact,
            kExact: r.coincidence.K.exact,
            onePixelAgrees: r.coincidence.A.onePixel === r.coincidence.K.onePixel,
          };
        });
        const allAgree = rows.every((row) => row.onePixelAgrees);
        const band = rows
          .filter((row) => row.aOnePixel && row.kOnePixel)
          .map((row) => row.offset);
        return {
          base: {
            Ab: round(base.Ab, 6), B: round(base.B, 6),
            C: round(base.C, 6), Mt: round(base.Mt, 6),
          },
          samples: rows,
          allOnePixelFlagsAgree: allAgree,
          offsetsReadingCoincident: band,
          note:
            `Sliding Ac away from Ab makes both distances grow together: at offset 0 the pairs ` +
            `meet exactly, and for small non-zero offsets both still read coincident under the ` +
            `applet's one-pixel test even though neither gap is zero. ` +
            `Across these ${rows.length} samples the one-pixel flags ${allAgree ? "agree" : "do not all agree"} ` +
            `(Ab/Ac coincide iff Kb/Kc coincide), which is Pascal's theorem as the applet tests it.`,
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh reading by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Diameters And Chords state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object") {
    throw new Error("missing saved Diameters And Chords state");
  }
  const C = core();
  let here: any;
  let savedReadable = true;
  try {
    const angles = readAngles(state, C);
    here = C.fromAngles(angles, {
      names: state.options !== null && typeof state.options === "object" &&
        (state.options as Json).names === true,
      hint: state.options !== null && typeof state.options === "object" &&
        (state.options as Json).hint === true,
    });
  } catch {
    // An unreadable saved angle: show the opening picture, but echo the raw state.
    here = C.start({});
    savedReadable = false;
  }
  const r = reading(C, here);
  const close = (a: unknown, b: number | null): boolean | null =>
    Number.isFinite(Number(a)) && b !== null
      ? Math.abs(Number(a) - b) < 0.01
      : null;
  return {
    ...state,
    stateVersion,
    savedReadable,
    core: {
      ...r,
      result: C.result(here), // a demonstration: nothing can be won or lost
    },
    agreement: {
      aDistanceMatchesSaved: close(state.aDistance, r.distances.abToAc),
      kDistanceMatchesSaved: close(state.kDistance, r.distances.kbToKc),
    },
    note: !savedReadable
      ? "The saved angles could not be read, so the applet's opening picture is shown instead."
      : `The saved diagram puts Ab/Ac ${r.distances.abToAc === null ? "-" : r.distances.abToAc.toFixed(4)} ` +
        `and Kb/Kc ${r.distances.kbToKc === null ? "-" : r.distances.kbToKc.toFixed(4)} board units apart; ` +
        `by the applet's one-pixel test the A pair reads ` +
        `${r.coincidence.A.onePixel ? "coincident" : "apart"} and the K pair ` +
        `${r.coincidence.K.onePixel ? "coincident" : "apart"}. ${r.status}`,
  };
}
