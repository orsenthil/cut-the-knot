/*
 * run_game_logic actions and saved-position reader for Menelaus From Ceva.
 *
 * The real core is menelaus-from-ceva/menelaus-from-ceva-core.js, copied into
 * src/generated/cores/ at build time. A triangle ABC has E on side line AC,
 * D on BC and F on AB. The drawing keeps F, D and E collinear, and the page
 * proves with six applications of Ceva's theorem that this is the same as
 * Menelaus' product
 *
 *   (AF/BF)(BD/CD)(CE/AE) = 1   (directed segments).
 *
 * The six Ceva identities each equal 1 when the picture is drawn, using the
 * crossings X = BE ∩ AD, Y = AD ∩ CF and Z = BE ∩ CF. The algebraic heart is
 * that the product of the six Ceva identity values equals the square of the
 * Menelaus product, so all six being 1 forces Menelaus^2 = 1. Dragging any
 * dot rebuilds only the dependent dots in the chain E -> D -> F -> E, which
 * is what keeps the three side dots on one line. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["menelaus-from-ceva"].MenelausFromCevaCore;
type K = ReturnType<typeof core>;
type Point = { x: number; y: number };
type State = {
  A: Point; B: Point; C: Point; D: Point; E: Point; F: Point;
  showAddOns: boolean; selected: string | null;
};

const HANDLES = ["A", "B", "C", "D", "E", "F"] as const;
type Handle = (typeof HANDLES)[number];

/** Which dots the core rebuilds after a given dot is dragged. */
const CHAIN: Record<Handle, { moved: Handle; rebuilt: Handle[]; story: string }> = {
  A: { moved: "A", rebuilt: ["E", "F"], story: "A moves; E is snapped back onto AC, then F is rebuilt as DE ∩ AB." },
  B: { moved: "B", rebuilt: ["F", "D"], story: "B moves; F is snapped back onto AB, then D is rebuilt as EF ∩ BC." },
  C: { moved: "C", rebuilt: ["D", "E"], story: "C moves; D is snapped back onto BC, then E is rebuilt as FD ∩ AC." },
  D: { moved: "D", rebuilt: ["F"], story: "D is snapped onto BC, then F is rebuilt as DE ∩ AB." },
  E: { moved: "E", rebuilt: ["D"], story: "E is snapped onto AC, then D is rebuilt as EF ∩ BC." },
  F: { moved: "F", rebuilt: ["E"], story: "F is snapped onto AB, then E is rebuilt as FD ∩ AC." },
};

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : r6(v);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const near = (a: number, b: number, tol = 1e-7): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

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

/** Rebuild the page's state from the arguments; omitted dots keep the seed. */
function readState(Kx: K, args: Json): State {
  const seed = Kx.start({}) as State;
  const out: State = { ...seed };
  for (const name of HANDLES) {
    if (args[name] !== undefined && args[name] !== null) out[name] = readPoint(args[name], name);
  }
  if (args.showAddOns !== undefined && args.showAddOns !== null) out.showAddOns = Boolean(args.showAddOns);
  if (args.selected !== undefined && args.selected !== null) {
    const s = String(args.selected);
    if (!HANDLES.includes(s as Handle)) {
      throw new Error(`argument "selected" must be one of ${HANDLES.join(", ")} or null`);
    }
    out.selected = s as Handle;
  }
  return out;
}

/** Everything the core can say about one drawing, in tutor-friendly units. */
function reading(Kx: K, s: State) {
  const ev = Kx.evaluate(s);
  const r = ev.ratios;
  const ids = ev.identities as Record<string, number>;
  const sixValues = Object.values(ids);
  const productOfSix = sixValues.reduce((a, b) => a * b, 1);
  const menelausSquared = r.product * r.product;
  const allOne = sixValues.every((v) => near(v, 1));
  const identityHolds = near(productOfSix, menelausSquared, 1e-6);
  const cross = ev.crossings as { X: Point; Y: Point; Z: Point };
  return {
    points: Object.fromEntries(HANDLES.map((n) => [n, pt(s[n])])),
    menelaus: {
      AF_BF: maybe(r.AF_BF),
      BD_CD: maybe(r.BD_CD),
      CE_AE: maybe(r.CE_AE),
      product: maybe(r.product),
      collinear: ev.collinear,
    },
    crossings: {
      X: { lines: "BE ∩ AD", point: pt(cross.X) },
      Y: { lines: "AD ∩ CF", point: pt(cross.Y) },
      Z: { lines: "BE ∩ CF", point: pt(cross.Z) },
    },
    ceva: {
      one: maybe(ids.one),     // Ceva in ABE: F on AB, X on BE, C on EA
      two: maybe(ids.two),     // Ceva in ACD: E on AC, Y on AD, B on CD
      three: maybe(ids.three), // Ceva in BCF: D on BC, Z on CF, A on FB
      four: maybe(ids.four),   // Ceva in EBD: X on EB, C on BD, F on DE
      five: maybe(ids.five),   // Ceva in DAF: Y on DA, B on AF, E on FD
      six: maybe(ids.six),     // Ceva in FCE: Z on FC, A on CE, D on EF
      eachEqualsOne: allOne,
      productOfSix: maybe(productOfSix),
      menelausProductSquared: maybe(menelausSquared),
      squaringIdentityHolds: identityHolds,
    },
    note:
      `With directed segments, (AF/BF)(BD/CD)(CE/AE) = ${maybe(r.product)}, and F, D, E are ` +
      `${ev.collinear ? "on one line" : "not on one line"}. The page's six Ceva identities, built ` +
      `from the crossings X, Y and Z, are each ${allOne ? "1" : "a number whose product with the others is the square of the Menelaus product"}; ` +
      `their product is ${maybe(productOfSix)} while Menelaus^2 is ${maybe(menelausSquared)}. ` +
      (identityHolds
        ? "The two agree: when all six Ceva identities equal 1 the Menelaus product is ±1, and the directed convention makes it +1 exactly at collinearity."
        : "The two do not agree here, which signals a degenerate construction (a crossing ran off the drawing).") +
      " This is an illustration: there is no win and no loss.",
  };
}

export function actions(): GameActions {
  return {
    ceva_to_menelaus: {
      describe:
        "Measure one drawing of Menelaus From Ceva. The six points A, B, C, D, E, F may each be [x, y] or { x, y } in page coordinates (y downward); omitted points keep the applet's opening picture, where E is two thirds from A to C, D one third from B to C and F = DE ∩ AB. Reports the three directed side ratios AF/BF, BD/CD, CE/AE and their product, whether F, D and E are collinear, the crossings X = BE ∩ AD, Y = AD ∩ CF, Z = BE ∩ CF, and the six Ceva identities (one per triangle ABE, ACD, BCF, EBD, DAF, FCE). It also checks the key identity that the product of the six Ceva values equals the square of the Menelaus product, so all six being 1 forces (AF/BF)(BD/CD)(CE/AE)^2 = 1. The default opening picture has all six identities equal to 1 and Menelaus product 1.",
      args: "{}",
      run: (args) => {
        const K = core();
        const s = readState(K, args);
        return reading(K, s);
      },
    },
    drag_rebuild: {
      describe:
        "Demonstrate the rebuild chain that keeps the three side dots collinear. Starting from the six supplied points (or the opening picture), move the dot named by handle (one of A, B, C, D, E, F) by the vector [dx, dy] exactly as the page's drag does, then report the moved and rebuilt dots before and after, the Menelaus product and collinearity before and after, and the six Ceva identities after. A corner drags A -> E -> F, B -> F -> D or C -> D -> E; a side dot continues the E -> D -> F -> E cycle: dragging E rebuilds D, dragging D rebuilds F and dragging F rebuilds E. Try handle A with dx 12 and dy -6: the product stays 1 and all six identities stay 1.",
      args: '{ "handle": "A", "dx": 12, "dy": -6 }',
      run: (args) => {
        const K = core();
        const raw = args.handle;
        if (typeof raw !== "string" || !HANDLES.includes(raw as Handle)) {
          throw new Error(`argument "handle" must be one of ${HANDLES.join(", ")}`);
        }
        const handle = raw as Handle;
        const dx = num(args, "dx", 0);
        const dy = num(args, "dy", 0);
        const before = readState(K, args);
        const after = K.drag(before, handle, { x: dx, y: dy }) as State;
        const beforeR = reading(K, before);
        const afterR = reading(K, after);
        const chain = CHAIN[handle];
        return {
          handle,
          delta: { dx: r6(dx), dy: r6(dy) },
          chain: chain.story,
          moved: chain.moved,
          rebuilt: chain.rebuilt,
          before: {
            points: beforeR.points,
            menelaus: beforeR.menelaus,
            ceva: { eachEqualsOne: beforeR.ceva.eachEqualsOne, productOfSix: beforeR.ceva.productOfSix },
          },
          after: afterR,
          productPreserved: near(beforeR.menelaus.product ?? NaN, afterR.menelaus.product ?? NaN),
          collinearPreserved: beforeR.menelaus.collinear === afterR.menelaus.collinear,
          note:
            `Dragging ${handle} by [${r6(dx)}, ${r6(dy)}] moves ${chain.moved} and rebuilds ` +
            `${chain.rebuilt.join(" and ") || "no other dot"}. ${chain.story} ` +
            `The Menelaus product goes from ${maybe(beforeR.menelaus.product)} to ${maybe(afterR.menelaus.product)}, ` +
            `and F, D, E stay ${afterR.menelaus.collinear ? "collinear" : "off the line"}. ` +
            "This is the applet's own update chain, so the drawing remains a Menelaus configuration.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, read again through the core. */
export function position(state: Json, stateVersion: number): unknown {
  const K = core();
  const savedPoint = (key: string): Point | null =>
    state[key] && typeof state[key] === "object" ? pt(state[key] as Point) : null;
  const saved = {
    stateVersion,
    A: savedPoint("A"), B: savedPoint("B"), C: savedPoint("C"),
    D: savedPoint("D"), E: savedPoint("E"), F: savedPoint("F"),
    showAddOns: state.showAddOns === undefined ? null : Boolean(state.showAddOns),
    selected: state.selected === undefined || state.selected === null ? null : String(state.selected),
  };
  try {
    const s = readState(K, state);
    return {
      ...saved,
      result: K.result(),
      reading: reading(K, s),
      note:
        "Track.state saves the six drawn points, the showAddOns checkbox and the last selected dot, not the derived ratios, crossings or Ceva values. The reading recomputes the three Menelaus ratios, their product, the crossings X, Y, Z and the six Ceva identities with the same core the page uses, so the saved picture can be checked against Menelaus' product and the squaring identity. This is an illustration: there is no win or loss.",
    };
  } catch (e) {
    return {
      ...saved,
      result: null,
      reading: null,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
