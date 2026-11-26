/*
 * run_game_logic actions and saved-position reader for BOL12 (Archimedes'
 * Book of Lemmas, Proposition 12).
 *
 * The real core is bol-12/bol-12-core.js, copied into src/generated/cores/ at
 * build time. AB is the horizontal diameter of a circle with centre C and
 * radius |C Bo|; T is any point outside the circle. TP and TQ are the tangents
 * from T, AQ and BP meet at R, and TR meets AB at M. The proposition says
 * TR ⟂ AB. In fact R lies directly above T, TP = TQ = TR, and P, Q, R and
 * O = 2T − P are concyclic with centre T. Every number below comes from the
 * core's compute()/residuals()/claims(). See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["bol-12"].Bol12Core;

type Point = { x: number; y: number };
type Core = ReturnType<typeof core>;
type CoreState = ReturnType<Core["start"]>;

type Geometry = {
  valid: boolean;
  reason: string | null;
  C0: Point; Bo: Point; T: Point; r: number; d: number;
  A: Point; B: Point; P: Point; Q: Point; R: Point; M: Point; O: Point;
  hint: Point | null; hintRadius: number | null;
};

const r6 = (n: number): number => Number(n.toFixed(6));
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const ptOrNull = (p: Point | null | undefined): Point | null => (p ? pt(p) : null);

/** Accept the page's {x,y} objects and the [x,y] arrays used in JSON args. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} must have finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Build a core position from an optional circle (C, Bo) and point T. */
function build(args: Json): { C: Core; s: CoreState } {
  const C = core();
  const opts: Record<string, unknown> = {};
  for (const key of ["C", "Bo", "T"]) {
    if (args[key] !== undefined && args[key] !== null) opts[key] = readPoint(args[key], key);
  }
  for (const key of C.OPTION_KEYS as string[]) {
    if (typeof args[key] === "boolean") opts[key] = args[key];
  }
  const s = C.start(opts);
  // The page saves these too; keep them so result() reflects the saved record.
  if (typeof args.moves === "number" && Number.isFinite(args.moves)) s.moves = args.moves;
  if (typeof args.explored === "boolean") s.explored = args.explored;
  return { C, s };
}

/**
 * The construction and the five claims, measured with the core. Residuals are
 * divided by the radius, so they are comparable across circle sizes.
 */
function analyse(C: Core, s: CoreState) {
  const g = C.compute(s) as unknown as Geometry;
  if (!g.valid) {
    return {
      valid: false as const,
      reason: g.reason || "invalid",
      center: pt(s.C), radiusPoint: pt(s.Bo), T: pt(s.T),
      radius: r6(C.dist(s.C, s.Bo) as number),
      distanceCT: r6(C.dist(s.C, s.T) as number),
      note:
        "T must lie strictly outside the circle (|CT| > radius) before the tangents from T and the point R exist. " +
        "Move T further out, or move Bo inward to shrink the circle.",
    };
  }

  const res = C.residuals(g) as unknown as Record<string, number>;
  const flags = C.claims(g, 1e-7) as unknown as Record<string, boolean>;
  const TP = C.dist(g.T, g.P) as number;
  const TQ = C.dist(g.T, g.Q) as number;
  const TR = C.dist(g.T, g.R) as number;
  const TO = C.dist(g.T, g.O) as number;

  const rounded = Object.fromEntries(
    Object.entries(res).map(([k, v]) => [k, Number(v.toExponential(3))]),
  );

  return {
    valid: true as const,
    circle: { center: pt(g.C0), radius: r6(g.r), A: pt(g.A), B: pt(g.B) },
    T: pt(g.T),
    points: { P: pt(g.P), Q: pt(g.Q), R: pt(g.R), M: pt(g.M), O: pt(g.O) },
    distances: {
      TP: r6(TP), TQ: r6(TQ), TR: r6(TR), TO: r6(TO),
      CP: r6(C.dist(g.C0, g.P) as number), CQ: r6(C.dist(g.C0, g.Q) as number),
      CT: r6(g.d),
    },
    checks: {
      TR_perpendicular_AB: {
        holds: flags.perpendicular,
        residual: Number(res.perpendicular.toExponential(3)),
        detail: "AB is horizontal, so TR ⟂ AB means R.x = T.x; the foot is M = (T.x, C.y).",
        foot: pt(g.M),
        expectedFoot: { x: r6(g.T.x), y: r6(g.C0.y) },
        footResidual: Number(res.foot.toExponential(3)),
      },
      TP_equals_TQ: {
        holds: flags.equalTangents,
        residual: Number(res.equalTangents.toExponential(3)),
        TP: r6(TP), TQ: r6(TQ),
      },
      TP_equals_TQ_equals_TR: {
        holds: flags.equalRadii,
        residual: Number(res.equalRadii.toExponential(3)),
        radii: { TP: r6(TP), TQ: r6(TQ), TR: r6(TR), TO: r6(TO) },
      },
      concyclic_P_Q_R_O: {
        holds: flags.equalRadii && flags.hintCenter && flags.hintRadius,
        center: pt(g.T),
        circumcenter: ptOrNull(g.hint),
        circumradius: g.hintRadius === null ? null : r6(g.hintRadius),
        centerResidual: Number(res.hintCenter.toExponential(3)),
        radiusResidual: Number(res.hintRadius.toExponential(3)),
        detail: "O = 2T − P is the reflection of P in T; T is the circumcentre of P, Q, R and O.",
      },
      tangents_from_T: {
        holds: flags.tangency,
        residual: Number(res.tangency.toExponential(3)),
        detail: "CP ⟂ TP and CQ ⟂ TQ: a radius is perpendicular to the tangent at its endpoint.",
      },
      P_and_Q_on_circle: {
        holds: flags.onCircle,
        residual: Number(res.onCircle.toExponential(3)),
      },
      R_on_AQ_and_BP: {
        holds: flags.concurrence,
        residual: Number(res.concurrence.toExponential(3)),
      },
    },
    residuals: rounded,
    claims: flags,
    allClaimsHold: Object.values(flags).every(Boolean),
    hint: {
      center: ptOrNull(g.hint),
      radius: g.hintRadius === null ? null : r6(g.hintRadius),
      centeredAtT: flags.hintCenter,
      radiusMatchesTP: flags.hintRadius,
    },
    note:
      `With centre C = (${r6(g.C0.x)}, ${r6(g.C0.y)}) and radius ${r6(g.r)}, AB is the horizontal diameter. ` +
      `The tangents from T touch the circle at P and Q; the lines AQ and BP cross at R = (${r6(g.R.x)}, ${r6(g.R.y)}), ` +
      `which has exactly the x of T = (${r6(g.T.x)}, ${r6(g.T.y)}), so TR is vertical and meets AB at a right angle at M. ` +
      `TP = TQ = TR = TO = ${r6(TP)}, so P, Q, R and O lie on a circle centred at T — the applet's hint circle. ` +
      "Writing a circle point as t = tan(a/2) gives the tangent equation (u+1)t² − 2v t + (1−u) = 0 for (u,v) = (T−C)/r; " +
      "the product of its roots, (1−u)/(1+u), is what forces AQ and BP to cross directly above T.",
  };
}

export function actions(): GameActions {
  return {
    figure: {
      describe:
        "For a circle with centre C and edge point Bo (its radius is |C Bo|) and a point T outside it, run the real BOL12 construction and report P and Q (the tangent points), R (where AQ and BP cross), M (where TR meets the diameter AB) and O (the reflection of P in T). Checks: TR perpendicular to AB (R.x = T.x), TP = TQ, TP = TQ = TR, and P, Q, R, O concyclic with centre T; also the tangencies and that P and Q lie on the circle. Residuals are divided by the radius, so values below 1e-6 mean the claim holds to drawing precision. C, Bo and T accept {x,y} or [x,y]; omitted points use the applet's opening picture. T must be strictly outside the circle.",
      args: '{ "C": [140, 180], "Bo": [70, 180], "T": [170, 100] }',
      run: (args) => {
        const { C, s } = build(args);
        return analyse(C, s);
      },
    },

    check_positions: {
      describe:
        "Check the BOL12 claims at several outside points T around the same circle. For each T the real core builds P, Q, R, M and O and reports the residuals for TR perpendicular to AB, TP = TQ, TP = TQ = TR, R on AQ and BP, and the concyclicity of P, Q, R, O. This shows the proposition holds wherever T is, not just at one picture. Give Ts as an array of points; C and Bo set the circle (defaults to the opening picture). At most 50 points; a T inside the circle is reported as invalid rather than throwing.",
      args: '{ "C": [140, 180], "Bo": [70, 180], "Ts": [[170, 100], [220, 180], [140, 260], [60, 110], [250, 90]] }',
      run: (args) => {
        if (!Array.isArray(args.Ts)) throw new Error('"Ts" must be an array of points [x, y] or {x, y}');
        if (args.Ts.length === 0) throw new Error('"Ts" must contain at least one point');
        if (args.Ts.length > 50) throw new Error('"Ts" may contain at most 50 points');
        const C = core();
        const opts: Record<string, unknown> = {};
        for (const key of ["C", "Bo"]) {
          if (args[key] !== undefined && args[key] !== null) opts[key] = readPoint(args[key], key);
        }
        const base = C.start(opts);
        const rows = (args.Ts as unknown[]).map((raw) => {
          const T = readPoint(raw, "each entry of Ts");
          type Check = { residual?: number; centerResidual?: number; holds: boolean };
          const reading = analyse(C, C.start({ ...base, T })) as {
            valid: boolean;
            checks?: Record<string, Check>;
          };
          if (!reading.valid) return { T: pt(T), valid: false, allHold: false };
          const checks = reading.checks!;
          return {
            T: pt(T),
            valid: true,
            perpendicular: Number(checks.TR_perpendicular_AB.residual!.toExponential(3)),
            equalTangents: Number(checks.TP_equals_TQ.residual!.toExponential(3)),
            equalRadii: Number(checks.TP_equals_TQ_equals_TR.residual!.toExponential(3)),
            concyclic: Number(checks.concyclic_P_Q_R_O.centerResidual!.toExponential(3)),
            concurrence: Number(checks.R_on_AQ_and_BP.residual!.toExponential(3)),
            allHold: Object.values(checks).every((c) => c.holds),
          };
        });
        const valid = rows.filter((r) => r.valid);
        const worst = (key: "perpendicular" | "equalTangents" | "equalRadii" | "concyclic" | "concurrence") =>
          valid.length ? Math.max(...valid.map((r) => (r as unknown as Record<string, number>)[key])) : null;
        return {
          circle: { center: pt(base.C), radius: r6(C.dist(base.C, base.Bo) as number) },
          checked: rows.length,
          invalidCount: rows.length - valid.length,
          allHoldEverywhere: valid.length > 0 && valid.length === rows.length && rows.every((r) => r.allHold),
          worst: {
            perpendicular: worst("perpendicular"),
            equalTangents: worst("equalTangents"),
            equalRadii: worst("equalRadii"),
            concyclic: worst("concyclic"),
            concurrence: worst("concurrence"),
          },
          rows,
          note:
            `Rebuilt all ${rows.length} positions with the real core. ` +
            `${valid.length === rows.length ? "Every T lies outside the circle." : `${rows.length - valid.length} T value(s) were inside the circle and are marked invalid.`} ` +
            "For every valid T, TR meets the horizontal diameter at a right angle and TP = TQ = TR, " +
            "so R lies on the circle centred at T through P, Q and O. Residuals are scaled by the radius.",
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported BOL12 state version ${stateVersion}`);
  const { C, s } = build(state);
  const reading = analyse(C, s);
  return {
    stateVersion,
    // What the core reconstructs from the saved fields.
    ...reading,
    // The fields the page saved, with the same names.
    C: pt(s.C), Bo: pt(s.Bo), T: pt(s.T),
    showNames: s.showNames,
    showStatement: s.showStatement,
    showHint: s.showHint,
    moves: s.moves,
    explored: s.explored,
    result: C.result(s),
    note: reading.valid
      ? `Saved picture: T = (${reading.T.x}, ${reading.T.y}) outside a circle of radius ${reading.circle.radius}. The core rebuilds R = (${reading.points.R.x}, ${reading.points.R.y}) on the vertical through T, so TR ⟂ AB, and TP = TQ = TR = ${reading.distances.TP}; P, Q, R and O lie on the circle centred at T. The illustration is ${s.explored ? "already explored (recorded as done)" : "not yet explored"}.`
      : `Saved picture: T = (${reading.T.x}, ${reading.T.y}) is at distance ${reading.distanceCT} from the centre of a circle of radius ${reading.radius}, so it is not strictly outside it and the tangents, R and O are undefined. Move T outside the circle.`,
  };
}
