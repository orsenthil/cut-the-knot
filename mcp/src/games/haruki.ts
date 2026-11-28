/*
 * run_game_logic actions and saved-position reader for Haruki's lemma.
 *
 * The core (haruki/haruki-core.js on the site, copied into
 * src/generated/cores/ at build time) does the geometry: Q = PC ∩ AB,
 * R = PD ∩ AB, E and F are the second crossings of AB with the circles PQD
 * and PRC. Every answer below is computed by that core, never restated from
 * memory. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["haruki"].HarukiCore;

type Point = { x: number; y: number };
type Name = "A" | "B" | "C" | "D" | "P";
const NAMES: Name[] = ["A", "B", "C", "D", "P"];
const round = (v: number) => Math.round(v * 1e6) / 1e6;

/** Non-throwing reads, so a saved position can echo whatever the page kept. */
function asPoint(v: unknown): Point | null {
  const p = v as Json;
  if (!p || typeof p !== "object" || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) return null;
  return { x: Number(p.x), y: Number(p.y) };
}
function asNumber(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function readPoint(v: unknown, label: string): Point {
  const p = asPoint(v);
  if (!p) throw new Error(`${label} must be a point with numeric x and y`);
  return p;
}

/** A, B, C, D, P: any may be supplied, the rest come from the core's start. */
function readFigure(args: Json): Record<Name, Point> {
  const home = core().start({});
  const figure = {} as Record<Name, Point>;
  for (const name of NAMES) {
    figure[name] = args[name] === undefined ? home[name] : readPoint(args[name], name);
  }
  return figure;
}

function readOptions(state: Json) {
  const raw = state.options && typeof state.options === "object" ? state.options as Json : {};
  return {
    names: typeof raw.names === "boolean" ? raw.names : true,
    statement: raw.statement === true,
    hint: raw.hint === true,
  };
}

export function actions(): GameActions {
  return {
    lengths: {
      describe:
        "For five points A, B, C, D, P on one circle, rebuild Haruki's figure: Q and R on AB, the second crossings E and F, the lengths BE and AF, and the value AQ·RB/QR. Then spin P around the same circle and report how far E and F move, so the tutor can show the lengths do not depend on P.",
      args: '{ "sweep": 16 }',
      run: (args) => {
        const C = core();
        const fig = readFigure(args);
        const main = C.circle(fig.A, fig.B, fig.C);
        if (!main) throw new Error("A, B and C do not define a circle");
        const g = C.compute(fig.A, fig.B, fig.C, fig.D, fig.P);
        if (!g) throw new Error("the chords or the extra circles are degenerate for these points");

        const steps = Math.max(4, Math.min(64, Math.trunc(num(args, "sweep", 12))));
        const startP = C.projectToCircle(fig.P, main) || fig.P;
        let placed = 0, skipped = 0, maxDriftE = 0, maxDriftF = 0;
        for (let k = 1; k <= steps; k++) {
          const movedP = C.rotate(main.c, startP, 2 * Math.PI * k / steps, 1);
          const h = C.compute(fig.A, fig.B, fig.C, fig.D, movedP);
          // Close crossings make the applet's one-unit Other() test ambiguous.
          if (!h || h.gapE < 2 || h.gapF < 2) { skipped++; continue; }
          placed++;
          maxDriftE = Math.max(maxDriftE, C.dist(g.E, h.E));
          maxDriftF = Math.max(maxDriftF, C.dist(g.F, h.F));
        }

        return {
          Q: g.Q, R: g.R, E: g.E, F: g.F,
          BE: round(g.BE), AF: round(g.AF), AQtimesRBoverQR: round(g.ratio),
          equalLengths: Math.abs(g.BE - g.AF) < 1e-6,
          matchesProductFormula: Math.abs(g.BE - g.ratio) < 1e-6,
          gapEtoQ: round(g.gapE), gapFtoR: round(g.gapF),
          drawingAmbiguous: g.gapE < 2 || g.gapF < 2,
          sweep: {
            steps, wellDefinedPositions: placed, skipped,
            maxDriftE: round(maxDriftE), maxDriftF: round(maxDriftF),
            independentOfP: placed > 0 && maxDriftE < 1e-5 && maxDriftF < 1e-5,
          },
          note: C.describe({
            A: fig.A, B: fig.B, C: fig.C, D: fig.D, P: fig.P,
            options: { names: true, statement: true, hint: false }, explored: true,
          }),
        };
      },
    },
    other_rule: {
      describe:
        "Show the applet's one-unit Other() rule: given a known crossing and two candidate crossings, report which one it keeps and how far that is from the known point. With a far candidate the choice is right; when both candidates lie within one unit it can keep a point that is really the same crossing, which is why the drawing of E or F is ambiguous near tangency.",
      args: '{ "known": {"x":100,"y":100}, "near": {"x":100.5,"y":100}, "far": {"x":160,"y":100} }',
      run: (args) => {
        const C = core();
        const known = args.known === undefined ? { x: 100, y: 100 } : readPoint(args.known, "known");
        const near = args.near === undefined ? { x: 100.5, y: 100 } : readPoint(args.near, "near");
        const far = args.far === undefined ? { x: 160, y: 100 } : readPoint(args.far, "far");
        const withFar = C.other([near, far], known);
        const withFarReversed = C.other([far, near], known);
        // If the first candidate *is* the known crossing, the one-unit test
        // hands back the second even when it is only half a unit away.
        const withClose = C.other([known, near], known);
        return {
          known, near, far,
          distances: { knownToNear: round(C.dist(known, near)), knownToFar: round(C.dist(known, far)) },
          withADistantCandidate: {
            candidates: [near, far], picked: withFar,
            pickedDistance: round(C.dist(withFar, known)),
            pickedIsFar: Math.abs(withFar.x - far.x) < 1e-9 && Math.abs(withFar.y - far.y) < 1e-9,
            sameInEitherOrder: C.dist(withFar, withFarReversed) < 1e-9,
          },
          withTwoCloseCandidates: {
            candidates: [known, near], picked: withClose,
            pickedDistance: round(C.dist(withClose, known)),
            pickedWithinOneUnit: C.dist(withClose, known) < 1,
          },
          note: "Other() keeps the first candidate unless it is within one unit of the known crossing; when two crossings are closer than that, the theorem still holds but the applet can draw the wrong E or F.",
        };
      },
    },
  };
}

/** What the core says about the figure the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const fig = readFigure(state);
  const options = readOptions(state);
  const main = C.circle(fig.A, fig.B, fig.C);
  const g = C.compute(fig.A, fig.B, fig.C, fig.D, fig.P);
  const saved = {
    BE: asNumber(state.BE), AF: asNumber(state.AF), ratio: asNumber(state.ratio),
  };
  const savedCircleRaw = state.circle && typeof state.circle === "object" ? state.circle as Json : null;
  const savedCircle = savedCircleRaw
    ? { c: asPoint(savedCircleRaw.c), r: asNumber(savedCircleRaw.r) }
    : null;
  const savedLengthsMatch = g !== null
    && saved.BE !== null && Math.abs(saved.BE - g.BE) < 1e-6
    && saved.AF !== null && Math.abs(saved.AF - g.AF) < 1e-6
    && saved.ratio !== null && Math.abs(saved.ratio - g.ratio) < 1e-6;

  return {
    stateVersion,
    A: fig.A, B: fig.B, C: fig.C, D: fig.D, P: fig.P,
    Q: asPoint(state.Q) ?? (g ? g.Q : null),
    R: asPoint(state.R) ?? (g ? g.R : null),
    E: asPoint(state.E) ?? (g ? g.E : null),
    F: asPoint(state.F) ?? (g ? g.F : null),
    circle: savedCircle,
    options,
    BE: saved.BE, AF: saved.AF, ratio: saved.ratio,
    core: g ? {
      circle: main ? { c: main.c, r: round(main.r) } : null,
      Q: g.Q, R: g.R, E: g.E, F: g.F,
      BE: round(g.BE), AF: round(g.AF), AQtimesRBoverQR: round(g.ratio),
      gapEtoQ: round(g.gapE), gapFtoR: round(g.gapF),
      equalLengths: Math.abs(g.BE - g.AF) < 1e-6,
      matchesProductFormula: Math.abs(g.BE - g.ratio) < 1e-6,
      drawingAmbiguous: g.gapE < 2 || g.gapF < 2,
    } : null,
    savedLengthsMatch,
    note: C.describe({
      A: fig.A, B: fig.B, C: fig.C, D: fig.D, P: fig.P,
      options, explored: true,
    }),
  };
}
