/*
 * run_game_logic actions and saved-position reader for BOL1.
 *
 * Archimedes' Book of Lemmas, Proposition 1: two circles touch at A and carry
 * parallel diameters CD (small circle, centre O2) and EF (large circle, centre
 * O1); then A, D and F lie on one line, and so do A, C and E. Every number here
 * comes from the real core, bol-1/bol-1-core.js, copied into src/generated/cores/
 * at build time. See _shared.ts for the shape of a game module.
 *
 * The core's explanation is a homothety at A: when the circles touch internally,
 * D = A + r2*(w - u) and F = A + r1*(w - u) for the same direction w - u, so the
 * two points are the same ray from A at different scales. When the circles touch
 * externally the centres are on opposite sides of A and the applet's labels pair
 * up differently: A, C, F and A, D, E are the straight triples, not A, D, F.
 * The page is an illustration (no win, no loss); the actions report which of the
 * page's claims hold at a configuration.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bol-1"].Bol1Core as any;

type Point = { x: number; y: number };
type State = { width: number; height: number; A: Point; O1: Point; O2: Point; C: Point };

const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
const r9 = (v: number): number => Number(v.toFixed(9));
const xy = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;
const finite = (v: number | null | undefined): number | null =>
  v !== null && v !== undefined && Number.isFinite(v) ? v : null;

/** Accept both the page's saved {x, y} and the tutor's [x, y] arguments. */
function readPoint(v: unknown, label: string, fallback?: Point): Point {
  if (v === undefined || v === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    if (o.x === undefined || o.x === null || o.y === undefined || o.y === null) {
      throw new Error(`"${label}" needs both x and y`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** The four draggable dots (plus board size) that the page saves with Track.state. */
function readState(v: Json): State {
  if (v === null || typeof v !== "object") {
    throw new Error("the diagram must be an object with A, O1, O2 and C points");
  }
  const C = core();
  const home = C.start({});
  const width = num(v, "width", C.WIDTH);
  const height = num(v, "height", C.HEIGHT);
  if (!(width > 0) || !(height > 0)) {
    throw new Error('"width" and "height" must be positive numbers');
  }
  return {
    width, height,
    A: readPoint(v.A, "A", home.A),
    O1: readPoint(v.O1, "O1", home.O1),
    O2: readPoint(v.O2, "O2", home.O2),
    C: readPoint(v.C, "C", home.C),
  };
}

function readName(v: unknown): keyof Pick<State, "A" | "O1" | "O2" | "C"> {
  if (v !== "A" && v !== "O1" && v !== "O2" && v !== "C") {
    throw new Error('"point" must be one of "A", "O1", "O2" or "C"');
  }
  return v;
}

/** What the core says at one configuration, without the point coordinates. */
function reading(C: any, s: State) {
  const { r1, r2 } = C.radii(s);
  const dm = C.diameters(s);
  const kind = C.touchKind(s);
  const claims = C.claims(s);
  const H = C.hint(s, dm);
  const straight = (p: Point | null, q: Point | null, t: Point | null): number | null => {
    if (!dm || !p || !q || !t) return null;
    const v = C.straightness(p, q, t);
    const f = finite(v);
    return f === null ? null : r9(f);
  };
  // "straightness" is |sin of the angle| at A: zero means collinear.
  const straightness = {
    ADF: straight(s.A, dm && dm.D, dm && dm.F),
    ACE: straight(s.A, dm && dm.C, dm && dm.E),
    ACF: straight(s.A, dm && dm.C, dm && dm.F),
    ADE: straight(s.A, dm && dm.D, dm && dm.E),
  };
  const note =
    kind === "in"
      ? "Internal touch: both centres lie on the same side of A. D = A + r2*(w - u) and F = A + r1*(w - u) point the same way from A, so A, D and F are collinear (and so are A, C and E): a homothety at A carries the small circle onto the large one."
      : kind === "out"
        ? "External touch: the centres lie on opposite sides of A. The applet's names pair up the other way, so A, C, F and A, D, E are the straight triples; A, D, F is not."
        : "A, O1 and O2 are not on one line, so the circles cross instead of touching. The condition of the proposition is gone and the collinearities need not hold.";

  return {
    radii: { r1: r6(r1), r2: r6(r2) },
    touchKind: kind, // "in" = internal touch, "out" = external touch, "none" = crossing
    diameters: dm
      ? { C: xy(dm.C), D: xy(dm.D), E: xy(dm.E), F: xy(dm.F) }
      : null,
    diametersAreParallel: claims.diameters && claims.parallel,
    checks: {
      centresAndAOnOneLine: claims.tangent,
      // Archimedes' ADF claim is the internal case; the external case relabels.
      ADF: claims.adf,
      ACE: claims.ace,
      ACF: kind === "out" && Boolean(dm) && C.collinear(s.A, dm.C, dm.F),
      ADE: kind === "out" && Boolean(dm) && C.collinear(s.A, dm.D, dm.E),
      hintLengths: claims.hintLengths,
    },
    straightness,
    claimHolds: kind === "in" ? claims.adf && claims.ace : kind === "out" ? claims.externalPairs : false,
    hint: H
      ? {
          point: xy(H),
          O1H: r6(C.distance(s.O1, H)), O2D: r6(C.distance(s.O2, (dm as any).D)),
          O2A: r6(C.distance(s.O2, s.A)), HF: r6(C.distance(H, (dm as any).F)),
          O1O2: r6(C.distance(s.O1, s.O2)), DH: r6(C.distance((dm as any).D, H)),
        }
      : null,
    note,
  };
}

export function actions(): GameActions {
  return {
    claim: {
      describe:
        "Given the four draggable dots of the BOL1 picture - A (where the circles meet), O1 and O2 (their centres) and C on the small circle - report the radii, the two parallel diameters CD and EF (so D, E and F), whether the circles touch at A (internally, externally or not at all), and check the collinearity A-D-F (plus A-C-E) with the |sin| of the angle at A. For external touch the applet's names pair differently: A-C-F and A-D-E are the straight triples instead. All points are pixel coordinates on the page's 600 x 450 board; omit any dot to use the applet's starting position. The helper H of the longer proof and its equal lengths are reported too. This is an illustration: there is no win or loss.",
      args: '{ "A": [300, 20], "O1": [300, 260], "O2": [300, 100], "C": [364, 148] }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        return {
          board: { width: s.width, height: s.height },
          points: { A: xy(s.A), O1: xy(s.O1), O2: xy(s.O2), C: xy(s.C) },
          ...reading(C, s),
        };
      },
    },

    drag: {
      describe:
        "Move one of the four dots the way the page does and compare the claim before and after. Pass 'point' as \"A\", \"O1\", \"O2\" or \"C\" and 'to' as [x, y] or {x, y}; the other dots default to the applet's starting picture. Moving A, O1 or O2 rebuilds both circles and reprojects C onto the new small circle; moving C keeps it on that circle and turns both diameters together. Dragging C (or a centre along the line of centres) keeps A-D-F collinear; dragging a centre off that line makes the circles cross and the claim fail. External touch relabels the straight triples as A-C-F and A-D-E.",
      args: '{ "A": [300, 20], "O1": [300, 260], "O2": [300, 100], "C": [364, 148], "point": "O2", "to": [280, 100] }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const name = readName(args.point);
        const to = readPoint(args.to, "to");
        const moved = C.withPoint(s, name, to);
        return {
          moved: name,
          requested: xy(to),
          before: reading(C, s),
          after: reading(C, moved),
          afterPoints: { A: xy(moved.A), O1: xy(moved.O1), O2: xy(moved.O2), C: xy(moved.C) },
          note:
            name === "C"
              ? "C stays on the small circle and both diameters turn with it; a tangent configuration keeps the collinearity."
              : "A, O1 or O2 moved: the core rebuilt both radii and put C back on the small circle. If the three centres-and-A line is broken, the tangency condition and the collinearity go with it.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh reading by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported BOL1 state version ${stateVersion}`);
  const C = core();
  const s = readState(state ?? ({} as Json));
  return {
    stateVersion,
    saved: {
      width: s.width, height: s.height,
      A: xy(s.A), O1: xy(s.O1), O2: xy(s.O2), C: xy(s.C),
    },
    ...reading(C, s),
  };
}
