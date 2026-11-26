/*
 * run_game_logic actions and saved-position reader for Apollonius.
 *
 * Three given circles can have up to eight circles tangent to all three, one
 * for each choice of "given circle i lies inside" (+1) or "touches outside"
 * (-1). The core (apollonius/ in the site, copied into src/generated/cores/ at
 * build time) solves the resulting quadratic for each of the eight sign
 * triples. Every number below comes from that core. See _shared.ts for the
 * shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["apollonius"].ApolloniusCore;

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };

const r4 = (n: number) => Number(n.toFixed(4));
const r6 = (n: number) => Number(n.toFixed(6));

function readPoint(value: unknown, label: string): Point {
  const p = value as Json;
  if (!p || typeof p !== "object") throw new Error(`${label} must be an object with x and y`);
  const x = Number(p.x), y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} must have finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Accept {center:{x,y},radius} (the saved form) or a flat {x,y,radius}. */
function readCircle(value: unknown, label: string): Circle {
  const o = value as Json;
  if (!o || typeof o !== "object") throw new Error(`${label} must be a circle object`);
  const center = o.center !== undefined ? readPoint(o.center, `${label}.center`) : readPoint(o, `${label} (as x/y)`);
  const raw = o.radius !== undefined ? o.radius : o.r;
  const radius = Number(raw);
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error(`${label}.radius must be a positive number, got ${JSON.stringify(raw)}`);
  }
  return { center, radius };
}

function readCircles(args: Json): Circle[] {
  const v = args.circles;
  if (!Array.isArray(v) || v.length !== 3) {
    throw new Error('"circles" must be an array of exactly three circles, each {center:{x,y},radius}');
  }
  return v.map((c, i) => readCircle(c, `circles[${i}]`));
}

/** The core's own Reset board, in the same plain geometry form. */
function startCircles(): Circle[] {
  const C = core();
  return C.position(C.start({})).circles as Circle[];
}

/** The applet's K determinant: 0 means the three centres are collinear. */
function determinant(gs: Circle[]): number {
  const [c0, c1, c2] = gs;
  const A1 = 2 * (c1.center.x - c0.center.x);
  const B1 = 2 * (c1.center.y - c0.center.y);
  const A2 = 2 * (c2.center.x - c0.center.x);
  const B2 = 2 * (c2.center.y - c0.center.y);
  return A1 * B2 - A2 * B1;
}

/** A solved circle: centre, drawn radius, signed quadratic root, residuals. */
function circleView(c: { x: number; y: number; radius: number; signedR: number; root: number },
                    gs: Circle[], signs: number[]) {
  const residuals = signs.map((s, i) => core().tangencyError(c, gs[i], s, true));
  return {
    center: { x: r4(c.x), y: r4(c.y) },
    radius: r4(c.radius),
    signedR: r4(c.signedR),
    root: c.root,
    residuals: residuals.map(r6),
    maxResidual: r6(Math.max(...residuals)),
  };
}

export function actions(): GameActions {
  return {
    tangent_circles: {
      describe:
        "Given three circles (each {center:{x,y},radius}), report the tangent-circle solution for every one of the eight inside/outside sign triples: drawn centre, radius, signed quadratic root and the tangency residual against each given circle. Triples with no real solution are reported with the reason (usually nearly collinear centres).",
      args:
        '{ "circles": [ {"center":{"x":42,"y":150},"radius":40}, {"center":{"x":280,"y":230},"radius":60}, {"center":{"x":200,"y":70},"radius":80} ] }',
      run: (args) => {
        const C = core();
        const gs = Object.prototype.hasOwnProperty.call(args, "circles")
          ? readCircles(args)
          : startCircles();
        const K = determinant(gs);
        const found = C.solve(gs);
        let next = 0;
        const triples = C.SIGN_TRIPLES.map((signs: number[]) => {
          const pair = C.compute(gs, signs);
          const signature = C.signature(signs);
          if (!pair) {
            const reason = Math.abs(K) < 0.01
              ? "the three centres are nearly collinear (determinant K ≈ 0), so a centre cannot be solved for"
              : "this sign choice gives no real tangent circle (the quadratic has no real roots)";
            return { signs, signature, drawn: false, roots: 0, reason };
          }
          // solve() draws one root per triple, skipping a root within one unit
          // of an earlier drawing; found[] is in SIGN_TRIPLES order.
          const drawn = found[next++];
          const firstGap = Math.hypot(pair[0].x - drawn.x, pair[0].y - drawn.y, pair[0].radius - drawn.radius);
          const secondGap = Math.hypot(pair[1].x - drawn.x, pair[1].y - drawn.y, pair[1].radius - drawn.radius);
          const drawnRoot = secondGap < firstGap ? 1 : 0;
          return {
            signs,
            signature,
            drawn: true,
            roots: 2,
            // The two roots of the quadratic for this sign triple.
            solutions: pair.map((c: { x: number; y: number; radius: number; signedR: number; root: number }) =>
              circleView(c, gs, signs)),
            // The one the applet actually draws.
            drawnCircle: circleView(pair[drawnRoot], gs, signs),
            drawnRoot,
          };
        });
        return {
          circles: gs.map((g) => ({ center: g.center, radius: r4(g.radius) })),
          determinantK: r6(K),
          centresCollinear: Math.abs(K) < 0.01,
          drawnCount: found.length,
          signTriples: triples,
          note:
            "Eight sign triples mean up to eight tangent circles: sign +1 puts the given circle inside the tangent circle (centre distance = |t − r|), −1 touches it outside (t + r). Each triple solves a quadratic with two roots; the applet draws one of them. A residual near 0 confirms a circle really touches all three given circles.",
        };
      },
    },

    verify_tangency: {
      describe:
        "Check a proposed circle (x, y, radius) against three given circles under a chosen sign triple. Report the distance to each centre, the required distance |t − sign*r|, and the residual; all residuals near 0 mean the candidate is a genuine Apollonius solution. The signed root t may be ±radius; pass signedR to fix it, otherwise the smaller-residual choice is used.",
      args:
        '{ "circles": [ {"center":{"x":42,"y":150},"radius":40}, {"center":{"x":280,"y":230},"radius":60}, {"center":{"x":200,"y":70},"radius":80} ], "candidate": {"x":140.4988,"y":218.4974,"radius":79.9746}, "signs": [1,1,1] }',
      run: (args) => {
        const C = core();
        const gs = Object.prototype.hasOwnProperty.call(args, "circles")
          ? readCircles(args)
          : startCircles();
        const cand = args.candidate as Json;
        if (!cand || typeof cand !== "object") {
          throw new Error('"candidate" must be a circle with x, y and radius');
        }
        const x = Number(cand.x), y = Number(cand.y);
        const radius = Number(cand.radius !== undefined ? cand.radius : cand.r);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) {
          throw new Error('"candidate" must have finite x, y and a positive radius');
        }
        const signed = cand.signedR !== undefined ? Number(cand.signedR) : undefined;
        if (signed !== undefined && !Number.isFinite(signed)) {
          throw new Error('"candidate.signedR" must be a finite number');
        }
        const rawSigns = args.signs === undefined ? [1, 1, 1] : args.signs;
        if (!Array.isArray(rawSigns) || rawSigns.length !== 3 ||
            !rawSigns.every((s) => Number(s) === 1 || Number(s) === -1)) {
          throw new Error('"signs" must be exactly three values, each +1 or -1');
        }
        const signs = rawSigns.map((s) => Number(s));
        // The tangency test uses the signed quadratic root t, which can be
        // negative even for an all-ones sign triple. Without an explicit
        // signedR, try +radius and -radius and keep the better fit.
        const trial = (t: number) => {
          const obj = { x, y, radius, signedR: t, root: 0 };
          const rows = signs.map((s, i) => {
            const g = gs[i];
            const distance = Math.hypot(x - g.center.x, y - g.center.y);
            const required = Math.abs(t - s * g.radius);
            return {
              given: i + 1,
              sign: s,
              centreDistance: r6(distance),
              requiredDistance: r6(required),
              residual: r6(C.tangencyError(obj, g, s, true)),
            };
          });
          return { rows, max: Math.max(...rows.map((row) => row.residual)) };
        };
        const positive = trial(radius);
        const negative = trial(-radius);
        const chosen = signed !== undefined
          ? { signedR: signed, ...trial(signed) }
          : negative.max < positive.max
            ? { signedR: -radius, ...negative }
            : { signedR: radius, ...positive };
        const rows = chosen.rows;
        return {
          candidate: { x: r4(x), y: r4(y), radius: r4(radius), signedR: r4(chosen.signedR) },
          signs,
          rows,
          maxResidual: r6(chosen.max),
          tangent: chosen.max < 1e-4,
          note:
            "Sign +1 means the given circle lies inside the candidate (distance = |t − r|); −1 means outside touch (distance = |t + r|). A residual of 0 at all three rows means the candidate solves Apollonius' problem for this sign triple.",
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const gs = readCircles(state);
  const found = C.solve(gs);
  const reading = found.map((c: { x: number; y: number; radius: number; signedR: number; root: number; signs: number[] }) => ({
    ...circleView(c, gs, c.signs),
    signs: c.signs,
    signature: C.signature(c.signs),
  }));
  const saved = Array.isArray(state.tangent) ? state.tangent : [];
  const savedCount = Number.isFinite(Number(state.count)) ? Number(state.count) : saved.length;
  const matched = reading.map((c) => {
    let best = Infinity;
    for (const t of saved) {
      const p = t as Json;
      if (!p || typeof p !== "object") continue;
      best = Math.min(best, Math.hypot(
        c.center.x - Number(p.x), c.center.y - Number(p.y), c.radius - Number(p.radius)));
    }
    return Number.isFinite(best) ? r6(best) : null;
  });
  const agrees = savedCount === found.length && matched.every((gap) => gap !== null && gap < 0.01);
  return {
    stateVersion,
    width: num(state, "width", C.DEFAULT_WIDTH),
    height: num(state, "height", C.DEFAULT_HEIGHT),
    circles: gs.map((g) => ({ center: g.center, radius: r4(g.radius) })),
    count: found.length,
    savedCount,
    tangent: saved,
    agreesWithSaved: agrees,
    closestSavedGap: matched,
    reading,
    note: agrees
      ? `The saved picture shows ${found.length} tangent circles; the core reproduces all of them from the three given circles, and every tangency residual is essentially 0.`
      : `The page saved ${savedCount} tangent circles but the core finds ${found.length} from these three circles; compare the saved tangent list with the recomputed reading for a mismatch.`,
  };
}
