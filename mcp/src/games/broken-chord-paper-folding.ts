/*
 * run_game_logic actions and saved-position reader for Broken Chord Paper Folding.
 *
 * The broken chord theorem: with P the midpoint of arc ACB on the circumcircle
 * of triangle ABC, the perpendicular from P to the longer of AC and BC meets it
 * at M, and M cuts the bent path A-C-B in half (AM = MC + CB when AC is longer).
 * The paper-folding proof reflects the far end of the shorter side in the crease
 * PC: its image F lands on the extension of the longer side past C with CF = CB
 * and PM is the altitude of the isosceles triangle APF, so AM = MF = MC + CB.
 *
 * Every number below comes from the game's real core, copied at build time from
 * broken-chord-paper-folding/ into src/generated/cores/. Coordinates are on the
 * applet's 600x450 board with y growing downwards. See _shared.ts for the shape
 * of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["broken-chord-paper-folding"].BrokenChordPaperFoldingCore;

type Pt = { x: number; y: number };

const r3 = (v: number) => Number(v.toFixed(3));
const r6 = (v: number) => Number(v.toFixed(6));
const small = (v: number) => Math.abs(v) < 1e-6;
const round = (p: any): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r3(p.x), y: r3(p.y) } : null;
const fmt = (p: Pt | null) => (p ? `(${p.x}, ${p.y})` : "?");

/** Accept {x, y} (the saved state) or [x, y] (convenient for a caller). */
function readPoint(args: Json, key: string, fallback: Pt): Pt {
  const v = args[key];
  if (v === undefined || v === null) return { ...fallback };
  if (Array.isArray(v)) {
    if (v.length < 2) throw new Error(`argument "${key}" needs two coordinates [x, y]`);
    return { x: num({ x: v[0] }, "x"), y: num({ y: v[1] }, "y") };
  }
  if (typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`argument "${key}" must be a point {x, y} or [x, y]`);
}

/** The three draggable corners; every other point is built from them. */
function readTriangle(args: Json) {
  const base = core().start();
  return {
    A: readPoint(args, "A", base.A),
    B: readPoint(args, "B", base.B),
    C: readPoint(args, "C", base.C),
  };
}

/** Compute the picture for a triangle, checking that the arguments are points. */
function analyse(args: Json) {
  const C = core();
  const tri = readTriangle(args);
  const g = C.compute(tri);
  return { C, tri, g };
}

/** The applet calls the endpoints of the longer/shorter side K and L. */
function nameOf(g: any, p: Pt): string {
  if (g.A && Math.abs(g.A.x - p.x) < 1e-9 && Math.abs(g.A.y - p.y) < 1e-9) return "A";
  if (g.B && Math.abs(g.B.x - p.x) < 1e-9 && Math.abs(g.B.y - p.y) < 1e-9) return "B";
  return "?";
}

/** The full geometric reading, shared by the actions and by position(). */
function reading(g: any, C: any) {
  const m = C.residuals(g);
  const kn = nameOf(g, g.K);   // far end of the longer side (A when AC > BC)
  const ln = nameOf(g, g.L);   // far end of the shorter side (B when AC > BC)
  const KM = C.dist(g.K, g.M);
  const MC = C.dist(g.M, g.C);
  const CL = C.dist(g.C, g.L);
  const CF = C.dist(g.C, g.F);
  const MF = C.dist(g.M, g.F);

  return {
    triangle: { A: round(g.A), B: round(g.B), C: round(g.C) },
    longerSide: g.longAC ? "AC" : "BC",
    farEndOfLongerSide: kn,
    farEndOfShorterSide: ln,
    points: {
      P: round(g.P), // midpoint of arc A-C-B, equally far from A and B
      M: round(g.M), // foot of the perpendicular from P to the longer side
      F: round(g.F), // reflection of L in the crease PC
      G: round(g.G), // reflection of K (the applet's "extra" fold)
      circleCenter: round(g.circle.O),
    },
    lengths: {
      halfOfBrokenPath: r3(KM), // K M
      MC: r3(MC),
      shortSide: r3(CL),        // C L, i.e. C B when AC is longer
      CF: r3(CF),
      foldedHalf: r3(MF),       // M F
    },
    claims: {
      PIsArcMidpoint: small(m.arcMidpoint),
      PMPerpendicularToLongSide: small(m.rightAngle),
      MOnLongSide: small(m.MonSegment),
      CFEqualsShortSide: small(m.CF),
      FOnExtensionBeyondC: small(m.FOnExtension) && m.foldDirection === 0,
      MIsMidpointOfFoldedSegment: small(m.FMidpoint),
      brokenChordSplitInHalf: small(m.brokenChord),
    },
    angles: {
      // residuals of the page's marked angle pairs and its alpha + gamma = beta
      alpha: r6(m.alpha),  // angle KPC = angle LPC at P
      beta: r6(m.beta),    // angle LPK = angle CPK at P
      gamma: r6(m.gamma),  // angle KLC = angle PLC at L
      alphaPlusGamma: r6(m.alphaPlusGamma),
      equalAnglesAtP: small(m.alpha),
      equalFoldAngles: small(m.beta) && small(m.gamma),
      alphaPlusGammaEqualsBeta: small(m.alphaPlusGamma),
    },
    note: `P ${fmt(round(g.P))} is the midpoint of arc A-C-B, so AP = PB. PM meets the longer side ${g.longAC ? "AC" : "BC"} at right angles at M ${fmt(round(g.M))}. Folding along PC sends ${ln} to F ${fmt(round(g.F))}, which lies past C on the line ${kn}C with CF = C${ln} = ${r3(CL)}. Because PB = PF, triangle ${kn}PF is isosceles and PM is its altitude, so ${kn}M = MF = MC + C${ln} = ${r3(MC + CL)}: the broken chord is split in half (${kn}M = ${r3(KM)}).`,
  };
}

/** A note for a triangle the core cannot draw (coincident or collinear corners). */
function invalidNote(g: any): string {
  if (g.reason === "close") return "A and B are less than one board unit apart, so the circle and the crease cannot be drawn. Move them apart.";
  if (g.reason === "collinear") return "A, B and C are collinear, so there is no circumcircle or arc midpoint. Move C off the line AB.";
  return "These corners do not make a drawable triangle; move a handle.";
}

export function actions(): GameActions {
  return {
    broken_chord: {
      describe:
        "For a triangle ABC on the 600x450 board (y down), report the arc midpoint P of arc ACB, the foot M of the perpendicular from P to the longer of AC and BC, and F, the reflection of the far end of the shorter side in the crease PC. Show that CF equals the short side, that F lies on the extension of the long side beyond C, and that M is the midpoint of the folded segment, proving the broken chord is cut in half (AM = MC + CB when AC is longer; swap A and B otherwise). A, B and C may be {x, y} or [x, y].",
      args: '{ "A": [192, 270], "B": [405.847, 248.544], "C": [367.337, 185.562] }',
      run: (args) => {
        const { C, tri, g } = analyse(args);
        if (!g.valid) {
          return { valid: false, reason: g.reason, triangle: { A: round(tri.A), B: round(tri.B), C: round(tri.C) }, note: invalidNote(g) };
        }
        return { valid: true, ...reading(g, C) };
      },
    },
    angles: {
      describe:
        "For the same triangle, report the angle residuals behind the paper-folding proof: the two equal angles at P cut by the crease (angle KPC = angle LPC), the reflected pairs angle LPK = angle CPK and angle KLC = angle PLC, and the identity angle KPC + angle KLC = angle CPK (the page's alpha + gamma = beta). Each residual is near zero for a valid triangle, which is why the crease PC folds the short side onto the extension of the long side. A, B and C may be {x, y} or [x, y].",
      args: '{ "A": [192, 270], "B": [405.847, 248.544], "C": [367.337, 185.562] }',
      run: (args) => {
        const { C, g } = analyse(args);
        if (!g.valid) return { valid: false, reason: g.reason, note: invalidNote(g) };
        const r = reading(g, C);
        return {
          valid: true,
          longerSide: r.longerSide,
          farEndOfLongerSide: r.farEndOfLongerSide,
          farEndOfShorterSide: r.farEndOfShorterSide,
          angles: r.angles,
          note: `PC is the crease that folds the short side C${r.farEndOfShorterSide} onto the extension of ${r.farEndOfLongerSide}C. The marked angles match in pairs (residuals alpha ${r.angles.alpha}, beta ${r.angles.beta}, gamma ${r.angles.gamma}) and alpha + gamma = beta (residual ${r.angles.alphaPlusGamma}), so the reflected point F lands on that line and CF = C${r.farEndOfShorterSide}.`,
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const g = C.compute(state);
  const saved = {
    showNames: state.showNames === true,
    showHint: state.showHint === true,
    showLines: state.showLines === true,
    showAngles: state.showAngles === true,
    showExtra: state.showExtra === true,
    moves: typeof state.moves === "number" ? state.moves : 0,
    explored: state.explored === true,
  };
  if (!g.valid) {
    return { stateVersion, ...saved, valid: false, reason: g.reason, note: invalidNote(g) };
  }
  return {
    stateVersion,
    ...saved,
    valid: true,
    reading: reading(g, C),
  };
}
