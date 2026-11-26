/*
 * run_game_logic actions and saved-position reader for BOL9 — Archimedes'
 * Book of Lemmas, Proposition 9 (bol-9/ on the site).
 *
 * A horizontal chord AB and a vertical chord CD cross at right angles at O,
 * away from the circle's centre. Archimedes says arc AD + arc CB = arc AC +
 * arc DB; the cut-the-knot article adds that each sum is a semicircle, pi
 * radians or 180 degrees, because each is twice one of the right angles at O:
 *
 *     arc AD + arc CB = 2*angle AOD,   arc AC + arc DB = 2*angle BOD.
 *
 * The core reproduces the applet's Arc.SetAngle computation (a signed angle
 * from the east point Ro, brought into [0, 2*pi)), and the page keeps the
 * applet's drag limit: the crossing O may come no closer than 5 pixels to the
 * circle. Helper offsets below are measured from the circle's centre, with
 * screen y growing down: a negative cdOffset puts CD left of centre and a
 * positive abOffset puts AB below it. Every number here comes from the real
 * core, bol-9/bol-9-core.js, copied into src/generated/cores/ at build time.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bol-9"].Bol9Core;

type State = ReturnType<ReturnType<typeof core>["start"]>;

type Arc = { start: number; value: number; measure: number; degrees: number };

type Board = { width: number; height: number; cx: number; cy: number; r: number };

/** Round for readable JSON; the core's own claim checks use full precision. */
const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const pt = (p: { x: number; y: number }): { x: number; y: number } => ({
  x: round(p.x), y: round(p.y),
});
const deg = (v: number): number => round(v * 180 / Math.PI, 3);

/** Validate the optional board overrides shared by both actions and position(). */
function boardFrom(args: Json): Board {
  const C = core();
  const base = C.start({});
  const width = num(args, "width", base.width);
  const height = num(args, "height", base.height);
  if (!(width > 0) || !(height > 0)) {
    throw new Error('"width" and "height" must be positive');
  }
  const cx = num(args, "cx", width / 2);
  const cy = num(args, "cy", height / 2);
  const r = num(args, "r", Math.min(cx, cy) * 7 / 12);
  if (!(r > C.GAP + C.EPS)) {
    throw new Error(`"r" must exceed the applet's ${C.GAP}-unit drag gap to cut two chords`);
  }
  return { width, height, cx, cy, r };
}

/** Offsets from the centre, given directly or as absolute chord lines. */
function offsetsFrom(args: Json, board: Board): { cdOffset?: number; abOffset?: number } {
  if (args.cdOffset !== undefined && args.cdX !== undefined) {
    throw new Error('give either "cdOffset" or "cdX", not both');
  }
  if (args.abOffset !== undefined && args.abY !== undefined) {
    throw new Error('give either "abOffset" or "abY", not both');
  }
  const cdOffset = args.cdOffset !== undefined ? num(args, "cdOffset")
    : args.cdX !== undefined ? num(args, "cdX") - board.cx : undefined;
  const abOffset = args.abOffset !== undefined ? num(args, "abOffset")
    : args.abY !== undefined ? num(args, "abY") - board.cy : undefined;
  return { cdOffset, abOffset };
}

/**
 * Build a core state from a requested pair of chord offsets. start() clamps
 * each offset to the safe range; then withChord() projects the pair back onto
 * the applet's joint safe circle (radius r - 5), exactly as a drag would.
 */
function stateFrom(board: Board, cdOffset?: number, abOffset?: number) {
  const C = core();
  const seeded = C.start({ ...board, cdOffset, abOffset });
  let s: State = C.withChord(seeded, "AB", seeded.abY);
  s = C.withChord(s, "CD", s.cdX);
  const clamped =
    Math.abs(s.cdX - seeded.cdX) > 1e-9 || Math.abs(s.abY - seeded.abY) > 1e-9;
  return { state: s, clamped };
}

/** The four arcs, the two half-turn sums and every claim of Proposition 9. */
function reading(state: State, clamped: boolean) {
  const C = core();
  const g = C.geometry(state);
  const claims = C.claims(state);
  const showArc = (a: Arc) => ({
    start: round(a.start),
    signedSweep: round(a.value),
    radians: round(a.measure),
    degrees: round(a.degrees, 3),
  });
  return {
    circle: { x: g.circle.x, y: g.circle.y, r: g.circle.r },
    crossingO: pt(g.O),
    endpoints: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    halfChords: { AB: round(g.halfAB), CD: round(g.halfCD) },
    anglesAtO: {
      AOD_degrees: deg(g.angleAOD), BOD_degrees: deg(g.angleBOD),
      bothRightAngles: claims.rightAngles,
    },
    arcs: {
      AD: showArc(g.arcs.AD), BC: showArc(g.arcs.BC),
      AC: showArc(g.arcs.AC), BD: showArc(g.arcs.BD),
    },
    sums: {
      AD_plus_CB: round(g.sumADCB), AD_plus_CB_degrees: deg(g.sumADCB),
      AC_plus_DB: round(g.sumACDB), AC_plus_DB_degrees: deg(g.sumACDB),
      AD_plus_CB_is_pi: claims.adPlusCbIsSemicircle,
      AC_plus_DB_is_pi: claims.acPlusDbIsSemicircle,
      sums_equal: claims.sumsEqual,
      halfTurnDegrees: 180,
    },
    circumference: round(g.circumference),
    chordsMeetInside: claims.chordsMeetInside,
    claims,
    allClaimsHold: Object.values(claims).every(Boolean),
    degenerate: g.degenerate,
    clamped,
  };
}

/** Accept one [cdOffset, abOffset] pair or a {cdOffset, abOffset} object. */
function pairFrom(value: unknown, i: number): [number, number] {
  if (Array.isArray(value)) {
    const a = numArray({ value }, "value");
    if (a.length !== 2) {
      throw new Error(`placements[${i}] must have exactly two offsets`);
    }
    return [a[0], a[1]];
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    return [num(o, "cdOffset"), num(o, "abOffset")];
  }
  throw new Error(`placements[${i}] must be [cdOffset, abOffset] or {cdOffset, abOffset}`);
}

export function actions(): GameActions {
  return {
    four_arcs: {
      describe:
        "For a circle with a horizontal chord AB and a vertical chord CD crossing at right angles at O, give the chords' offsets from the centre as cdOffset and abOffset (screen y grows down), or the absolute lines cdX and abY; width, height, cx, cy and r may override the board. Run the real core and report A, B, C, D and O, all four arcs in radians and degrees with their applet start angles and signed sweeps, the two sums AD+CB and AC+DB, and every claim of Archimedes' Proposition 9 checked numerically. Each sum is pi radians (180 degrees), twice the 90-degree angle at O. A requested crossing inside the applet's 5-pixel circle-edge gap is projected back onto its safe circle, as a drag would be. Note the applet's coloured strokes begin a half turn away from the names they carry; their lengths, and these sums, are exact.",
      args: '{ "cdOffset": -21.875, "abOffset": 29.1667 }',
      run: (args) => {
        const board = boardFrom(args);
        const { cdOffset, abOffset } = offsetsFrom(args, board);
        const { state, clamped } = stateFrom(board, cdOffset, abOffset);
        const rd = reading(state, clamped);
        return {
          chordLines: { cdX: state.cdX, abY: state.abY },
          requestedOffsets: {
            cdOffset: cdOffset === undefined ? null : round(cdOffset),
            abOffset: abOffset === undefined ? null : round(abOffset),
          },
          ...rd,
          note: rd.degenerate
            ? "A chord is tangent to the circle, so there are no four arcs to add; move both chords inside the circle."
            : `At O = (${rd.crossingO.x}, ${rd.crossingO.y}) both angles are ${rd.anglesAtO.AOD_degrees}° and ${rd.anglesAtO.BOD_degrees}°. Arc AD + arc CB = ${rd.sums.AD_plus_CB} rad (${rd.sums.AD_plus_CB_degrees}°) = 2*angle AOD, and arc AC + arc DB = ${rd.sums.AC_plus_DB} rad (${rd.sums.AC_plus_DB_degrees}°) = 2*angle BOD: each sum is half a turn. All four arcs together make ${rd.circumference} rad (2*pi).${clamped ? " The requested crossing was inside the applet's 5-pixel edge gap and has been projected back for this reading." : ""} The applet measures its arcs from the east point Ro, so the coloured strokes sit a half turn from the names they label; the measures are exact.`,
        };
      },
    },
    check_claim: {
      describe:
        "Check Archimedes' ninth lemma over several chord placements in one call. Pass placements as a list of [cdOffset, abOffset] pairs (or {cdOffset, abOffset} objects), in board units from the circle's centre; with none, a representative list including chords through the centre is used. width, height, cx, cy and r may override the board for all placements. For each placement report the four arc measures, both sums in radians and degrees, and whether every claim holds, then the largest departure from pi over all of them. The equality is meant to hold even when a chord passes through the centre, and the core's claim checks use a 1e-8 tolerance.",
      args: '{ "placements": [[0, 0], [-30, 25], [30, -25], [-40, 40], [40, -40]] }',
      run: (args) => {
        const board = boardFrom(args);
        const raw = args.placements;
        let placements: Array<[number, number]>;
        if (raw === undefined) {
          const R = board.r;
          placements = [
            [0, 0], [-R / 4, R / 3], [R / 4, -R / 3],
            [-R * 0.45, R * 0.45], [R * 0.45, -R * 0.45],
          ];
        } else {
          if (!Array.isArray(raw)) {
            throw new Error('"placements" must be an array of [cdOffset, abOffset] pairs');
          }
          if (raw.length === 0) throw new Error('"placements" must contain at least one pair');
          if (raw.length > 200) throw new Error('"placements" may contain at most 200 pairs');
          placements = raw.map((p, i) => pairFrom(p, i));
        }
        const rows = placements.map(([cdOffset, abOffset]) => {
          const { state, clamped } = stateFrom(board, cdOffset, abOffset);
          const rd = reading(state, clamped);
          return {
            cdOffset: round(cdOffset), abOffset: round(abOffset),
            chordLines: { cdX: round(state.cdX), abY: round(state.abY) },
            arcsDegrees: {
              AD: rd.arcs.AD.degrees, BC: rd.arcs.BC.degrees,
              AC: rd.arcs.AC.degrees, BD: rd.arcs.BD.degrees,
            },
            AD_plus_CB_degrees: rd.sums.AD_plus_CB_degrees,
            AC_plus_DB_degrees: rd.sums.AC_plus_DB_degrees,
            bothAreHalfTurns: rd.sums.AD_plus_CB_is_pi && rd.sums.AC_plus_DB_is_pi,
            allClaimsHold: rd.allClaimsHold,
            degenerate: rd.degenerate,
            clamped,
          };
        });
        const worst = Math.max(
          ...rows.map((row) => Math.abs(row.AD_plus_CB_degrees - 180)),
          ...rows.map((row) => Math.abs(row.AC_plus_DB_degrees - 180)),
        );
        const allHold = rows.every((row) => row.allClaimsHold);
        return {
          checked: rows.length,
          allClaimsHold: allHold,
          worstDeviationFrom180Degrees: round(worst, 9),
          samples: rows,
          note: allHold
            ? `At all ${rows.length} placements the core's checks pass: arc AD + arc CB = arc AC + arc DB = 180°, twice the right angle at the crossing. The largest departure from a half turn is ${round(worst, 9)}° (floating-point round-off only), even with a chord through the centre.`
            : "At least one placement failed a claim; keep both chords cutting the circle in two distinct points.",
        };
      },
    },
  };
}

/** The page's saved diagram (Track.state sends the whole core state), plus the core's reading of it. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) {
    throw new Error(`unsupported BOL9 state version ${stateVersion}`);
  }
  const board = boardFrom(state);
  const cdX = num(state, "cdX");
  const abY = num(state, "abY");
  const { state: here, clamped } = stateFrom(
    board, cdX - board.cx, abY - board.cy,
  );
  const withinDragLimits =
    Math.abs(here.cdX - cdX) <= 1e-9 && Math.abs(here.abY - abY) <= 1e-9;
  const rd = reading(here, clamped);
  if (rd.degenerate) {
    return {
      ...state, stateVersion, valid: false, withinDragLimits, clamped,
      core: rd,
      note: "The saved chords do not both cut the circle; there are no four arcs to add.",
    };
  }
  return {
    // The fields the page saved with Track.state, with the same names.
    ...state,
    stateVersion,
    valid: true,
    withinDragLimits,
    chordLines: { cdX: here.cdX, abY: here.abY },
    savedMatchesCore: withinDragLimits,
    // What the same core adds about this position.
    core: rd,
    note: `The saved chords cross at O = (${rd.crossingO.x}, ${rd.crossingO.y}). The four arcs are AD ${rd.arcs.AD.degrees}°, CB ${rd.arcs.BC.degrees}°, AC ${rd.arcs.AC.degrees}°, DB ${rd.arcs.BD.degrees}°, so AD + CB = ${rd.sums.AD_plus_CB_degrees}° = 2*angle AOD and AC + DB = ${rd.sums.AC_plus_DB_degrees}° = 2*angle BOD: both are half turns.${withinDragLimits ? "" : " The saved crossing lay inside the applet's 5-pixel edge gap and was projected back for this reading."}`,
  };
}
