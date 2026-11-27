/*
 * run_game_logic actions and saved-position reader for Equilateral 345
 * (Bogomolny's Equilateral345 applet).
 *
 * An equilateral triangle ABC has an interior point P with AP = 3, BP = 4,
 * CP = 5. Rotating a copy of the triangle by 60 degrees about each corner
 * makes the hexagon A-Pc-B-Pa-C-Pb (applet subscripts), whose area is twice
 * that of ABC. The hexagon splits into three equilateral triangles of sides
 * 3, 4 and 5 and three 3-4-5 right triangles, so comparing the two area sums
 * gives a² = 25 + 12√3 and a ≈ 6.7664. The applet's FindP instead uses the
 * constant 24 + 12√3, one less, so its drawn point is slightly off 3:4:5.
 *
 * Every number below comes from the real core
 * equilateral-345/equilateral-345-core.js, copied into src/generated/cores/
 * at build time. Coordinates are board units in the applet's 640 x 460 canvas,
 * y down; a state is the side, the three corners, the point P, the dial angle
 * (0..65) and two display flags. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = (): any => cores["equilateral-345"].Equilateral345Core;
type Core = ReturnType<typeof core>;

type Pt = { x: number; y: number };
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const pt = (p: any): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const near = (a: number, b: number, tol = 1e-7): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** Tool arguments may give [x, y]; the page saves points as { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

function objectArgs(args: Json): Json {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object");
  }
  return args;
}

/** A positive side in board units; the core itself refuses sides below 20. */
function readSide(args: Json, C: Core): number {
  const side = num(args, "side", C.APPLET.side);
  if (!(side >= 20) || side > 2000) {
    throw new Error('"side" must be a number from 20 to 2000 board units');
  }
  return side;
}

/** The dial is a whole number of degrees in the applet's 0..65 range. */
function readAngle(args: Json, C: Core): number {
  const angle = num(args, "angle", 60);
  if (!Number.isInteger(angle) || angle < C.APPLET.angle.min || angle > C.APPLET.angle.max) {
    throw new Error(`"angle" must be a whole number from ${C.APPLET.angle.min} to ${C.APPLET.angle.max}`);
  }
  return angle;
}

/**
 * The proof picture: the opening triangle and dial angle, but with P placed
 * at the exact 3-4-5 point from C.exactP rather than the applet's FindP.
 */
function proofState(C: Core, side: number, angle: number): any {
  const t = C.triangle(side);
  const ex = C.exactP(side, t.A, t.B, t.C);
  if (!ex || !ex.P) throw new Error("the core could not place the exact 3-4-5 point");
  return { ...C.start({ side, angle }), P: ex.P };
}

/**
 * The six triangles inside the proof hexagon. The core labels Pa, Pb, Pc are
 * P turned about B, C and A; the page's hexagon "A Pc B Pa C Pb" in applet
 * subscripts is [A, Pa, B, Pb, C, Pc] in core labels, the one with double area.
 */
function hexagon(C: Core, s: any) {
  const rot = C.compute(s);
  const dist = (p: Pt, q: Pt): number => C.distance(p, q);
  const ring = [s.A, rot.Pa, s.B, rot.Pb, s.C, rot.Pc];
  const triArea: number = C.area([s.A, s.B, s.C]);
  const hexArea: number = C.area(ring);
  const piece = (kind: string, pts: Pt[]) => {
    const sides = [dist(pts[0], pts[1]), dist(pts[1], pts[2]), dist(pts[2], pts[0])];
    const sorted = [...sides].sort((a, b) => a - b);
    const area: number = C.area(pts);
    // Away from 60° the rotated points collapse onto P and the pieces vanish.
    const degenerate = area < 1e-6;
    return {
      kind,
      vertices: pts.map(pt),
      sides: sides.map(r6),
      area: r6(area),
      degenerate,
      equilateral: degenerate ? null : near(Math.max(...sides) - Math.min(...sides), 0, 1e-5),
      pythagorean: degenerate ? null : near(sorted[0] ** 2 + sorted[1] ** 2, sorted[2] ** 2, 1e-5),
    };
  };
  return {
    vertices: ring.map(pt),
    area: r6(hexArea),
    triangleArea: r6(triArea),
    areaRatio: r6(hexArea / triArea),
    twiceTriangle: near(hexArea, 2 * triArea),
    pieces: [
      piece("equilateral at A", [s.A, rot.Pc, s.P]),
      piece("right at A", [s.A, s.P, rot.Pa]),
      piece("equilateral at B", [s.B, rot.Pa, s.P]),
      piece("right at B", [s.B, s.P, rot.Pb]),
      piece("equilateral at C", [s.C, rot.Pb, s.P]),
      piece("right at C", [s.C, s.P, rot.Pc]),
    ],
  };
}

export function actions(): GameActions {
  return {
    hexagon_proof: {
      describe:
        "Place P at the exact point with AP:BP:CP = 3:4:5 in an equilateral triangle and turn copies of it by 60° about each corner (optional 'side' 20..2000, default 200; optional whole-number 'angle' 0..65, default 60). The core measures the hexagon A-Pc-B-Pa-C-Pb, shows its area is twice the triangle's at 60°, lists its three equilateral and three 3-4-5 right pieces, and evaluates the two area sums that give a² = 25 + 12√3, a ≈ 6.7664. Away from 60° the copies do not line up and the area ratio is no longer two.",
      args: '{ "side": 200, "angle": 60 }',
      run: (args) => {
        const a = objectArgs(args);
        const C = core();
        const side = readSide(a, C);
        const angle = readAngle(a, C);
        const s = proofState(C, side, angle);
        const h = hexagon(C, s);
        const cl = C.claim();
        const exactHexagon = 2 * cl.equilateralArea(cl.side);
        const exactPieces = [3, 4, 5].reduce((sum: number, x: number) => sum + cl.equilateralArea(x), 0)
          + cl.rightTriangles;
        const m = C.metrics(s);
        return {
          side, angle,
          P: pt(s.P),
          k: r6(m.k),
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          hexagon: h,
          pieceAreaSum: r6(h.pieces.reduce((sum: number, p: any) => sum + p.area, 0)),
          claim: {
            factor: r6(cl.factor),
            side: r6(cl.side),
            rightTriangles: cl.rightTriangles,
            equation: cl.equation,
            exactTriangleArea: r6(cl.equilateralArea(cl.side)),
            exactHexagonArea: r6(exactHexagon),
            exactEquilateralPieceAreas: [3, 4, 5].map((x) => r6(cl.equilateralArea(x))),
            exactRightPieceAreas: cl.rightTriangles,
            exactPieceSum: r6(exactPieces),
            sumsAgree: near(exactHexagon, exactPieces),
          },
          note:
            "At 60° the rotated copies tile a hexagon made of three equilateral triangles (sides 3k, 4k, 5k) and three 3-4-5 right triangles, and the core measures its area as twice ABC. Equating the two sums, 2·a²√3/4 = (3²+4²+5²)√3/4 + 3·(3·4/2), gives a² = 25 + 12√3, so a ≈ 6.7664 when the distances really are 3, 4 and 5; with side 200 the scale k = a/√45.78... is about 29.56 board units per unit distance. " +
            (angle === 60
              ? "The dial is at 60°, the proof's hexagon."
              : `The dial is at ${angle}°, so the core still reports the ring but its area is not twice the triangle's.`),
        };
      },
    },

    applet_scale_constant: {
      describe:
        "Compare the applet's scale constant with the exact one for a triangle of optional 'side' (20..2000, default 200). The core reports that FindP uses 24 + 12√3 where correctness needs 25 + 12√3 — exactly one less — so its drawn P gives distances about 1.1% short of 3:4:5, while the page's answer a² = 25 + 12√3 is the exact one.",
      args: '{ "side": 200 }',
      run: (args) => {
        const a = objectArgs(args);
        const C = core();
        const side = readSide(a, C);
        const drawn = C.start({ side });
        const t = C.triangle(side);
        const ex = C.exactP(side, t.A, t.B, t.C);
        if (!ex || !ex.P) throw new Error("the core could not place the exact 3-4-5 point");
        const m = C.metrics(drawn);
        const appletSide = Math.sqrt(C.APPLET_FACTOR);
        return {
          side,
          exact: {
            factor: r6(C.FACTOR),
            side: r6(C.SOLUTION),
            k: r6(side / C.SOLUTION),
            P: pt(ex.P),
            idealDistances: m.ideal.map(r6),
          },
          applet: {
            factor: r6(C.APPLET_FACTOR),
            side: r6(appletSide),
            k: r6(side / appletSide),
            P: pt(drawn.P),
            drawnDistances: m.lengths.map(r6),
          },
          factorDifference: r6(C.FACTOR - C.APPLET_FACTOR),
          sideRelativeError: r6((C.SOLUTION - appletSide) / C.SOLUTION),
          drawnPOffset: r6(C.distance(drawn.P, ex.P)),
          note:
            "The Java applet's FindP places P with k = a/√(24 + 12√3), but the exact area identity needs k = a/√(25 + 12√3). The squared factors differ by exactly 1, so the applet's predicted side is about 1.1% smaller and its drawn distances from P miss 3:4:5 by that scale; the reader's claim uses the exact constant and keeps the applet's value only to expose the discrepancy. This picture has no win or loss — it is a geometric identity to inspect.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh reading of that picture by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Equilateral 345 state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equilateral 345 position must be an object");
  }
  const C = core();
  const saved = {
    side: cnt(state.side),
    A: pt(state.A), B: pt(state.B), C: pt(state.C), P: pt(state.P),
    angle: cnt(state.angle),
    showNames: state.showNames === true,
    showLengths: state.showLengths === true,
  };
  let s: any;
  try {
    const side = readSide(state as Json, C);
    const angle = readAngle(state as Json, C);
    s = {
      ...C.start({ side, angle }),
      A: readPoint(state.A, "A"),
      B: readPoint(state.B, "B"),
      C: readPoint(state.C, "C"),
      P: readPoint(state.P, "P"),
      showNames: state.showNames === true,
      showLengths: state.showLengths === true,
    };
  } catch (err) {
    return {
      stateVersion, valid: false, saved,
      error: err instanceof Error ? err.message : String(err),
      note: "Track.state saves the side, corners A, B, C, the point P, the whole-number dial angle and two display flags in the applet's 640 x 460 board; those fields are needed for a fresh core reading.",
    };
  }
  const m = C.metrics(s);
  const h = hexagon(C, s);
  const cl = C.claim();
  const freshP = C.findP(s.side, s.A, s.B, s.C);
  return {
    stateVersion, valid: true, saved,
    reading: {
      side: s.side, angle: s.angle,
      P: pt(s.P),
      k: r6(m.k),
      measuredDistances: m.lengths.map(r6),
      idealDistances: m.ideal.map(r6),
      are3_4_5: [0, 1, 2].every((i) => near(m.lengths[i], m.ideal[i], 1e-4)),
      hexagon: {
        vertices: h.vertices,
        area: h.area,
        triangleArea: h.triangleArea,
        areaRatio: h.areaRatio,
        atProofAngle: s.angle === 60,
        twiceTriangle: h.twiceTriangle,
      },
      pieces: h.pieces.map((p: any) => ({
        kind: p.kind, sides: p.sides, area: p.area, degenerate: p.degenerate,
        equilateral: p.equilateral, pythagorean: p.pythagorean,
      })),
      claim: {
        factor: r6(cl.factor),
        side: r6(cl.side),
        equation: cl.equation,
      },
      appletFindP: pt(freshP),
      offsetFromAppletFindP: r6(C.distance(s.P, freshP)),
    },
    note:
      "Track.state saved the side, the three corners, P, the dial angle and the two display flags. The core remeasures the three distances, the hexagon and its six pieces at the saved angle, and compares the saved P with the applet's own FindP at the saved corners: the applet uses 24 + 12√3 instead of the exact 25 + 12√3, and dragging a corner leaves P fixed, so the measured distances drift from 3:4:5. This is a demonstration with no win or loss; the identity a² = 25 + 12√3 holds only when AP, BP, CP really are 3, 4 and 5.",
  };
}
