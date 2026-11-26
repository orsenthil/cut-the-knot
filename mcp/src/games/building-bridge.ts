/*
 * run_game_logic actions and saved-position reader for Building Bridge.
 *
 * The core lives in building-bridge/ and is copied into src/generated/cores/
 * at build time. The page saves its whole diagram with Track.state; this
 * module rebuilds that diagram and asks the core for the translated towns,
 * the two bank crossings and the triangle-inequality minimality check.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["building-bridge"].BuildingBridgeCore;
type Point = { x: number; y: number };

const round = (v: number) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const rp = (p: Point) =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;

/** Accept [x, y] from a caller or { x, y } from a saved page position. */
function point(v: unknown, key: string, fallback: Point): Point {
  if (v === undefined || v === null) return { ...fallback };
  let x: number;
  let y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`${key} must be [x, y]`);
    x = Number(v[0]);
    y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    if (o.x === undefined || o.y === undefined) throw new Error(`${key} must be [x, y] or { x, y }`);
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`${key} must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${key} must have finite coordinates`);
  return { x, y };
}

/** A fresh diagram of the requested size, with the towns and C put as the page puts them. */
function diagram(args: Json) {
  const C = core();
  const width = num(args, "width", 400);
  const height = num(args, "height", 300);
  if (width <= 0 || height <= 0) throw new Error("width and height must be positive");
  let s = C.start({ width, height });
  s = C.withPoint(s, "A", point(args.A, "A", s.A));
  s = C.withPoint(s, "B", point(args.B, "B", s.B));
  s = C.withPoint(s, "C", point(args.C, "C", s.C));
  return s;
}

/** The bridge each translation gives, and the shortest road both prove. */
function construction(s: ReturnType<typeof diagram>) {
  const C = core();
  const t = C.translated(s);
  const b = C.best(s);
  const finite = Number.isFinite(b.KU.x) && Number.isFinite(b.KL.x);
  return {
    core: C,
    translated: t,
    best: b,
    finite,
    reading: {
      picture: { width: s.width, height: s.height, upperBank: s.yU, lowerBank: s.yL },
      riverWidth: C.riverWidth(s),
      bridgeVector: rp(t.V),
      translatedTowns: {
        Bprime: rp(t.Bprime),
        Aprime: rp(t.Aprime),
        note: "B' = B - (0, river width) and A' = A + (0, river width); the bridge vector is perpendicular to the banks.",
      },
      constructions: {
        fromTranslatedB: { line: [rp(s.A), rp(t.Bprime)], nearBankCrossing: rp(b.KU) },
        fromTranslatedA: { line: [rp(t.Aprime), rp(s.B)], farBankCrossing: rp(b.KL) },
        sameBridge: finite && Math.abs(b.KU.x - b.KL.x) < 1e-7,
        bestBridge: finite ? { C: rp(b.KU), Cprime: rp(C.bridgeMate(s, b.KU)) } : null,
      },
      shortestRoad: finite ? round(C.minRoad(s)) : null,
      note: "Translating a town by the bridge vector preserves the length of the land road: AC + C'B = AC + CB'. By the triangle inequality that is at least AB', with equality when C lies on AB' where it crosses the near bank; translating A instead gives the same bridge and |AB'| = |A'B|.",
    },
  };
}

export function actions(): GameActions {
  return {
    crossings: {
      describe:
        "For two towns A (near side) and B (far side) of a straight river in a width x height picture (y grows downwards), report the translated towns B' = B - V and A' = A + V, where AB' crosses the near bank and A'B crosses the far bank, whether these give the same bridge, and the shortest road |AB'| + river width. A town dragged into the river is reflected out again as the page does; if a town sits exactly on a bank there is no crossing.",
      args: '{ "A": [103, 122], "B": [300, 178], "width": 400, "height": 300 }',
      run: (args) => construction(diagram(args)).reading,
    },
    road: {
      describe:
        "With a bridge point C on the near bank, report the road A -> C -> C' -> B, its length, the shortest possible length, the extra distance, the equal land lengths after translation and the triangle inequality, plus the page's own checks: perpendicular bridge, minimum at the crossing, both translations agreeing and the applet's finishing test.",
      args: '{ "A": [103, 122], "B": [300, 178], "C": [105, 130], "width": 400, "height": 300 }',
      run: (args) => {
        const s = diagram(args);
        const C = core();
        const t = C.translated(s);
        const mate = C.bridgeMate(s, s.C);
        const cl = C.claims(s);
        const road = C.roadLength(s, s.C);
        const shortest = C.minRoad(s);
        const ac = Math.hypot(s.A.x - s.C.x, s.A.y - s.C.y);
        const cbPrime = Math.hypot(s.C.x - t.Bprime.x, s.C.y - t.Bprime.y);
        return {
          bridge: { C: rp(s.C), Cprime: rp(mate), onNearBank: Math.abs(s.C.y - s.yU) < 1e-9 },
          roadLength: round(road),
          shortestRoad: round(shortest),
          extraDistance: round(road - shortest),
          landLengths: {
            AC: round(ac),
            CBprime: round(cbPrime),
            CprimeB: round(Math.hypot(mate.x - s.B.x, mate.y - s.B.y)),
            equalAfterTranslation: cl.equalLand,
          },
          triangleInequality: {
            ACplusCBprime: round(ac + cbPrime),
            ABprime: round(Math.hypot(s.A.x - t.Bprime.x, s.A.y - t.Bprime.y)),
            holds: cl.triangleInequality,
          },
          checks: cl,
          shortestFound: C.atBest(s),
          note: "The bridge is always the river width long and perpendicular to the banks, so only the land lengths change as C slides. The best C is where the dashed line from A to B' meets the near bank; press Snap to put it there.",
        };
      },
    },
  };
}

/** What the core says about the diagram the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const width = num(state, "width", 400);
  const height = num(state, "height", 300);
  if (width <= 0 || height <= 0) throw new Error("saved width and height must be positive");
  const fresh = C.start({ width, height });
  const H = num(state, "H", fresh.H);
  const yU = num(state, "yU", fresh.yU);
  const yL = num(state, "yL", fresh.yL);
  if (H <= 0) throw new Error("saved H (half the river width) must be positive");
  const s = {
    width,
    height,
    H,
    yU,
    yL,
    A: point(state.A, "A", fresh.A),
    B: point(state.B, "B", fresh.B),
    C: point(state.C, "C", fresh.C),
  };
  const made = construction(s);
  const t = made.translated;
  const b = made.best;
  const mate = C.bridgeMate(s, s.C);
  const road = C.roadLength(s, s.C);
  const shortest = C.minRoad(s);
  return {
    stateVersion,
    picture: { width, height, upperBank: yU, lowerBank: yL, riverWidth: 2 * H },
    towns: { A: rp(s.A), B: rp(s.B), C: rp(s.C) },
    translatedTowns: { Bprime: rp(t.Bprime), Aprime: rp(t.Aprime) },
    bestBridge: {
      nearBankCrossing: rp(b.KU),
      farBankCrossing: rp(b.KL),
      CprimeAtBest: made.finite ? rp(C.bridgeMate(s, b.KU)) : null,
      sameBridge: made.reading.constructions.sameBridge,
    },
    road: {
      now: round(road),
      shortest: round(shortest),
      extra: round(road - shortest),
    },
    shortestFound: C.atBest(s),
    bridgeMateNow: rp(mate),
    checks: C.claims(s),
    note: "The land road AC + C'B equals AC + CB' after translating B down by the river width; the triangle inequality makes it shortest on the line AB', and translating A gives the same bridge.",
  };
}
