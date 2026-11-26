/*
 * run_game_logic actions and saved-position reader for BOL13, Archimedes' Book
 * of Lemmas XIII. A diameter AB of a circle meets a chord CD at E; dropping
 * AM and BN perpendicular to the chord gives feet M and N with CN = DM.
 * Every reading comes from the game's real core (bol-13/), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bol-13"].Bol13Core;

type Pt = { x: number; y: number };
type Reader = (v: unknown, name: string, fallback: Pt) => Pt;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const isPt = (p: unknown): p is Pt =>
  !!p && typeof p === "object" &&
  Number.isFinite((p as Pt).x) && Number.isFinite((p as Pt).y);
const pt = (p: unknown) => (isPt(p) ? { x: round(p.x), y: round(p.y) } : null);

/** A point is [x, y] or { x, y }, both coordinates finite. */
function readPoint(v: unknown, name: string): Pt {
  let x: number;
  let y: number;
  if (Array.isArray(v) && v.length === 2) {
    x = Number(v[0]);
    y = Number(v[1]);
  } else if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Json;
    if (o.x === undefined || o.y === undefined) throw new Error(`argument "${name}" needs x and y`);
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`argument "${name}" must be a point [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${name}" must have finite coordinates`);
  return { x, y };
}

/** Actions reject malformed points; a saved position falls back to the default. */
const strict: Reader = (v, name, fallback) =>
  v === undefined || v === null ? fallback : readPoint(v, name);
const soft: Reader = (v, name, fallback) => {
  if (v === undefined || v === null) return fallback;
  try { return readPoint(v, name); } catch { return fallback; }
};

/** Rebuild the position the page draws, using the core's own defaults. */
function stateFrom(args: Json, read: Reader) {
  const d = core().start({});
  return {
    O: read(args.O, "O", d.O),
    Bo: read(args.Bo, "Bo", d.Bo),
    C: read(args.C, "C", d.C),
    D: read(args.D, "D", d.D),
    showNames: args.showNames === true,
    showStatement: args.showStatement === true,
    showHint: args.showHint === true,
  };
}

/** Measure one position with the same functions the page uses. */
function reading(s: Json) {
  const C = core();
  const st = C.start({ position: s });
  const m = C.measure(st);
  return { st, m, cl: C.claims(st, m) };
}

const length = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
const gap = (cn: unknown, dm: unknown): number | null =>
  typeof cn === "number" && typeof dm === "number" && Number.isFinite(cn) && Number.isFinite(dm)
    ? round(cn - dm, 9)
    : null;

const GUARD_NOTE =
  "The applet's NearestPoint short-circuits when a point is within sqrt(0.1) ≈ 0.32 px of the chord's first end, leaving the foot where the point was: a hair off the exact projection. Read CN − DM and the midpoint checks with a small tolerance.";

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a circle with centre O and radius point Bo (or the defaults) and a chord CD, give the diameter ends A and B, the crossing E, the perpendicular feet M and N from A and B, the helper points H (foot from O) and K, the lengths CN and DM with their gap, and all six claims (chord bisected, K midpoint of BM, H midpoint of MN, perpendiculars, E on both lines, CN = DM).",
      args: '{ "O": [210, 150], "Bo": [110, 150], "C": [260, 236.60254037844385], "D": [123.39745962155612, 100] }',
      run: (args) => {
        const C = core();
        const { st, m, cl } = reading(stateFrom(args, strict));
        if (m.r <= 0.1) throw new Error("the circle is collapsed: Bo must be more than 0.1 px from O");
        return {
          circle: { O: pt(st.O), Bo: pt(st.Bo), radius: round(m.r), A: pt(m.A), B: pt(m.B) },
          chord: {
            C: pt(st.C), D: pt(st.D),
            onCircle: {
              C: Math.abs(C.distance(st.O, st.C) - m.r) < 1e-6,
              D: Math.abs(C.distance(st.O, st.D) - m.r) < 1e-6,
            },
          },
          feet: { M: pt(m.M), N: pt(m.N) },
          E: pt(m.E), H: pt(m.H), K: pt(m.K),
          active: m.active,
          lengths: { CN: length(m.cn), DM: length(m.dm), gap: gap(m.cn, m.dm) },
          claims: cl,
          note: m.active
            ? `H is the foot from O, so it is the midpoint of CD; M and N are symmetric about H, which makes CN = DM. K is the midpoint of BM and H is also the midpoint of MN. ${GUARD_NOTE}`
            : "This chord runs through the centre (or is collapsed), so there is no unique crossing E and the applet hides the construction. Move C or D off the diameter.",
        };
      },
    },
    sweep: {
      describe:
        "Check Archimedes' claim across several chords of one circle: C is placed at each angle in radians (y down), D stays at dAngle, and each row reports the feet M and N, CN, DM, their gap and the six claims, with the largest gap over all chords.",
      args: '{ "O": [210, 150], "r": 100, "dAngle": -0.6, "angles": [0.2, 0.9, 1.5, 2.4] }',
      run: (args) => {
        const C = core();
        const O = strict(args.O, "O", C.start({}).O);
        const r = num(args, "r", 100);
        if (!(r > 0.1)) throw new Error("r must be greater than 0.1 px");
        const dAngle = num(args, "dAngle", -0.6);
        const angles = args.angles === undefined ? [0.2, 0.9, 1.5, 2.4] : numArray(args, "angles");
        if (angles.length < 1 || angles.length > 24) throw new Error("angles must contain between 1 and 24 numbers");
        const D = C.pointOnCircle(O, r, dAngle);
        const rows = angles.map((a) => {
          const Cc = C.pointOnCircle(O, r, a);
          const { m, cl } = reading({
            O, Bo: { x: O.x - r, y: O.y }, C: Cc, D,
            showNames: true, showStatement: false, showHint: false,
          });
          return {
            angleDeg: round(a * 180 / Math.PI, 3),
            C: pt(Cc), D: pt(D), M: pt(m.M), N: pt(m.N),
            active: m.active,
            CN: length(m.cn), DM: length(m.dm), gap: gap(m.cn, m.dm),
            claims: cl,
          };
        });
        const live = rows.filter((row) => row.active);
        const gaps = live.map((row) => Math.abs(row.gap ?? 0));
        return {
          O: pt(O), radius: round(r), dAngleDeg: round(dAngle * 180 / Math.PI, 3),
          rows,
          largestGap: gaps.length ? round(Math.max(...gaps)) : null,
          allClaimsHold:
            live.length > 0 && live.every((row) => Object.values(row.claims as Json).every(Boolean)),
          note: `Each row puts C on the circle and D at ${round(dAngle * 180 / Math.PI, 2)} degrees. When they are opposite, the chord is a diameter and the construction is hidden; otherwise H bisects CD and MN, K bisects BM, and CN = DM. ${GUARD_NOTE}`,
        };
      },
    },
  };
}

/** What the core says about the picture the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const { st, m, cl } = reading(stateFrom(state, soft));
  return {
    stateVersion,
    O: pt(st.O), Bo: pt(st.Bo), C: pt(st.C), D: pt(st.D),
    showNames: st.showNames, showStatement: st.showStatement, showHint: st.showHint,
    radius: round(m.r),
    active: m.active,
    A: pt(m.A), B: pt(m.B), E: pt(m.E),
    M: pt(m.M), N: pt(m.N), H: pt(m.H), K: pt(m.K),
    lengths: { CN: length(m.cn), DM: length(m.dm), gap: gap(m.cn, m.dm) },
    claims: cl,
    note: m.active
      ? `H bisects the chord CD and also MN, K is the midpoint of BM, and CN = ${length(m.cn)} = DM = ${length(m.dm)}. ${GUARD_NOTE}`
      : "The chord passes through the centre, so the applet hides the crossing and the perpendicular feet.",
  };
}
