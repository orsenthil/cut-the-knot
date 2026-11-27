/*
 * run_game_logic actions and saved-position reader for de Villiers 4.
 *
 * The core lives in de-villiers-4/ and is copied into src/generated/cores/ at
 * build time.  One turn-and-scale multiplier z = coef * exp(i * turn) builds
 * ACP, DCQ and DBR on the bases AC, DC and DB, so the three triangles stay
 * similar.  When their apex angle equals the angle ASB (S = AD ∩ BC), P, Q,
 * R and S fall on one line; the applet's own "ShowLine" only tests Q against
 * line PR.  Every answer below comes from the real core.  See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const C = cores["de-villiers-4"].DeVilliers4Core;

interface Pt { x: number; y: number }
interface Corners { A: Pt; B: Pt; C: Pt; D: Pt }

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const out = (p: Pt) => ({ x: round(p.x), y: round(p.y) });
const deg = (r: number) => round(r * 180 / Math.PI);
const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);

/** Read a required point argument, e.g. { "x": 120, "y": 83 }, with a useful error. */
function point(args: Json, key: string): Pt {
  const v = args[key];
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`argument "${key}" must be a point object with numeric x and y`);
  }
  const o = v as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

/** A derived number in a saved position may be missing/null; echo it as null. */
function maybeNum(state: Json, key: string): number | null {
  const v = state[key];
  const n = Number(v);
  return v !== undefined && v !== null && Number.isFinite(n) ? n : null;
}

function readCorners(args: Json): Corners {
  return { A: point(args, "A"), B: point(args, "B"), C: point(args, "C"), D: point(args, "D") };
}

/** A fresh diagram whose four corners are the given ones and whose three
 *  apexes are rebuilt with one shared turn and scale (AdjustApexes). */
function withCorners(q: Corners, alpha: number, coef: number) {
  const s = C.start({});
  s.A = q.A;
  s.B = q.B;
  s.C = q.C;
  s.D = q.D;
  s.alpha = alpha;
  s.coef = coef;
  return C.adjustApexes(s, null);
}

/** The three similar triangles, with their bases, apex angles and ratios. */
function triangles(s: ReturnType<typeof withCorners>) {
  const bases: Array<[string, string, Pt, Pt, Pt]> = [
    ["ACP", "AC", s.A, s.C, s.P],
    ["DCQ", "DC", s.D, s.C, s.Q],
    ["DBR", "DB", s.D, s.B, s.R],
  ];
  return bases.map(([name, base, b1, b2, apex]) => {
    const span = dist(b1, b2);
    if (!(span > 0)) throw new Error(`base ${base} has zero length; choose distinct corners`);
    const angle = C.computeAngle(apex, b1, b2);
    if (!Number.isFinite(angle)) throw new Error(`base ${base} and its tip make a degenerate triangle`);
    return {
      triangle: name,
      base,
      apex: out(apex),
      baseLength: round(span),
      sideLength: round(dist(b1, apex)),
      ratio: round(dist(b1, apex) / span),
      apexAngleDegrees: deg(angle),
    };
  });
}

function optionsOf(v: unknown) {
  const o = v && typeof v === "object" && !Array.isArray(v) ? v as Json : {};
  return { names: o.names === true, angles: o.angles === true, hint: o.hint === true };
}

export function actions(): GameActions {
  return {
    similar_triangles: {
      describe:
        "Build ACP, DCQ and DBR on the bases AC, DC and DB with the same turn (alpha, radians) and scale (coef), and report each apex angle and side/base ratio: they are equal, which is why the triangles are similar. Also report the angle ASB at the crossing of AD and BC, and whether the tip angle matches it — the condition for P, Q, R and S to line up.",
      args:
        '{ "A": { "x": 173.18, "y": 286.60 }, "B": { "x": 304.78, "y": 250 }, "C": { "x": 268.18, "y": 113.40 }, "D": { "x": 119.70, "y": 217.36 }, "alpha": 1.0472, "coef": 1 }',
      run: (args) => {
        const q = readCorners(args);
        const alpha = num(args, "alpha", C.INITIAL_ALPHA);
        const coef = num(args, "coef", C.INITIAL_COEF);
        if (!Number.isFinite(alpha)) throw new Error("alpha must be a finite turn in radians");
        if (!(coef > 0)) throw new Error("coef must be a positive scale factor");
        const s = withCorners(q, alpha, coef);
        const three = triangles(s);
        const g = C.geometry(s);
        const sameRatio = three.every((t) => Math.abs(t.ratio - three[0].ratio) <= 1e-5);
        const sameAngle = three.every((t) => Math.abs(t.apexAngleDegrees - three[0].apexAngleDegrees) <= 1e-4);
        const theta = g && C.finite(g.S) && Number.isFinite(g.theta) ? deg(g.theta) : null;
        return {
          triangles: three,
          similar: sameRatio && sameAngle,
          sharedTurnDegrees: deg(-alpha),
          scale: round(coef),
          thetaDegrees: theta,
          anglesMatch: theta === null ? null : g!.angleGap < 1e-6,
          note:
            "Dragging a tip measures the turn and scale (AdjustParams); dragging a corner rebuilds all three tips with them (AdjustApexes), so the three triangles keep the same shape. When their apex angle equals angle ASB, one of the two mirror positions puts P, Q, R and S on one line.",
        };
      },
    },
    show_the_claim: {
      describe:
        "Place the three similar triangles so their apex angle equals the angle ASB, then check whether P, Q, R and S are collinear. For an obtuse angle at S the helper needs a smaller scale (longer, thinner triangles); the answer also reports the applet's ShowLine quirk, which tests only Q against line PR and can light up while S is off the line.",
      args:
        '{ "A": { "x": 40, "y": 80 }, "B": { "x": 40, "y": 260 }, "C": { "x": 120, "y": 110 }, "D": { "x": 120, "y": 240 } }',
      run: (args) => {
        const q = readCorners(args);
        const s = withCorners(q, C.INITIAL_ALPHA, C.INITIAL_COEF);
        const before = C.geometry(s);
        if (!before || !C.finite(before.S) || !Number.isFinite(before.theta)
            || before.theta < 1e-4 || before.theta > Math.PI - 1e-4) {
          throw new Error("the corners must give a finite crossing point S and a non-degenerate angle ASB");
        }
        const aligned = C.align(s);
        const g = C.geometry(aligned);
        if (!g || !g.onLine) {
          throw new Error("could not place the three tips so P, Q, R and S line up for these corners");
        }
        const obtuse = g.theta > Math.PI / 2;
        /* The applet's Compute() never checks S.  A tiny drag of R towards B
         * puts Q within 0.5 of line PR while S is off it, so ShowLine lights up
         * even though the four points are no longer collinear. */
        const nudged = C.move(aligned, "R", C.rotate(aligned.D, aligned.B, -0.2 * Math.PI / 180));
        const nudgeG = C.geometry(nudged);
        return {
          thetaDegrees: deg(g.theta),
          obtuseAtS: obtuse,
          sharedTurnDegrees: deg(-aligned.alpha),
          scale: round(aligned.coef),
          apexAngleDegrees: deg(g.apexAngle),
          apexAnglesDegrees: [
            deg(C.computeAngle(aligned.P, aligned.A, aligned.C)),
            deg(C.computeAngle(aligned.Q, aligned.D, aligned.C)),
            deg(C.computeAngle(aligned.R, aligned.D, aligned.B)),
          ],
          S: out(g.S),
          P: out(g.P),
          Q: out(g.Q),
          R: out(g.R),
          distQ: round(g.distQ),
          distS: round(g.distS),
          showLine: g.showLine,
          onLine: g.onLine,
          angleGapDegrees: deg(g.angleGap),
          quirkExample: nudgeG ? {
            note: "After a 0.2-degree drag of R towards B, Q is still within 0.5 of line PR, so ShowLine stays on although S has left the line.",
            distQ: round(nudgeG.distQ),
            distS: round(nudgeG.distS),
            showLine: nudgeG.showLine,
            onLine: nudgeG.onLine,
          } : null,
          note:
            `With one shared multiplier on AC, DC and DB the triangles are similar; once their apex angle equals angle ASB (${deg(g.theta)} degrees), P, Q, R and S are collinear. ${obtuse ? `Here that angle is obtuse, so the helper uses a smaller scale (${round(aligned.coef)}) with longer, thinner triangles. ` : ""}The applet's ShowLine only tests whether Q is within 0.5 of line PR (distQ = ${round(g.distQ)}), so it can appear while S is off the line; onLine also checks S (distS = ${round(g.distS)}).`,
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported de Villiers 4 state version ${stateVersion}`);
  const A = point(state, "A"), B = point(state, "B"), C0 = point(state, "C"), D = point(state, "D");
  const P = point(state, "P"), Q = point(state, "Q"), R = point(state, "R");
  const alpha = num(state, "alpha"), coef = num(state, "coef");
  const options = optionsOf(state.options);
  const saved = {
    stateVersion,
    A: state.A, B: state.B, C: state.C, D: state.D,
    P: state.P, Q: state.Q, R: state.R, S: state.S ?? null,
    alpha, coef,
    lineUp: state.lineUp === true,
    showLine: state.showLine === true,
    angleGap: maybeNum(state, "angleGap"),
    theta: maybeNum(state, "theta"),
    apexAngle: maybeNum(state, "apexAngle"),
    options,
  };

  const here = { A, B, C: C0, D, P, Q, R, alpha, coef, options, explored: true };
  const g = C.geometry(here);
  if (!g) {
    return {
      ...saved,
      degenerate: true,
      note: "The saved corners or tips are missing or non-finite, so there is no geometry to read. Move the points into a clear quadrilateral on the page.",
    };
  }
  const S = C.finite(g.S) ? out(g.S) : null;
  const savedS = state.S && typeof state.S === "object" ? state.S as Json : null;
  const samePoint = (p: Json | null, q: Pt | null) =>
    !!p && !!q && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))
      && dist({ x: Number(p.x), y: Number(p.y) }, q) <= 1e-5;
  const same = (a: number | null, b: number) => a !== null && Math.abs(a - b) <= 1e-6;
  return {
    ...saved,
    degenerate: false,
    reading: {
      S,
      E: out(g.E),
      F: C.finite(g.F) ? out(g.F) : null,
      distQ: round(g.distQ),
      distS: round(g.distS),
      showLine: g.showLine,
      onLine: g.onLine,
      thetaDegrees: Number.isFinite(g.theta) ? deg(g.theta) : null,
      apexAngleDegrees: Number.isFinite(g.apexAngle) ? deg(g.apexAngle) : null,
      angleGapDegrees: Number.isFinite(g.angleGap) ? deg(g.angleGap) : null,
      triangles: (() => {
        try {
          return triangles(here);
        } catch {
          return null;
        }
      })(),
      savedMatchesCore: {
        S: samePoint(savedS, C.finite(g.S) ? g.S : null),
        theta: same(maybeNum(state, "theta"), g.theta),
        apexAngle: same(maybeNum(state, "apexAngle"), g.apexAngle),
        angleGap: same(maybeNum(state, "angleGap"), g.angleGap),
        showLine: state.showLine === g.showLine,
        lineUp: state.lineUp === g.onLine,
      },
      note: C.describe(here),
    },
  };
}
