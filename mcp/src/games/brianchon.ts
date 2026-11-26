/*
 * run_game_logic actions and saved-position reader for Brianchon.
 *
 * Six dots on a circle give six tangents; consecutive tangents meet at the
 * vertices of a circumscribed hexagon, and the three diagonals joining
 * opposite vertices always concur (Brianchon's theorem, dual to Pascal's).
 * The applet's red chords AD, BE and CF join opposite points of contact —
 * a different triple of lines, not generally concurrent. Every number here
 * comes from the real core, copied into src/generated/cores/ at build time.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["brianchon"].BrianchonCore;

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type Line = [Pt, Pt];
type SavedState = {
  width: number;
  height: number;
  circle: Circle;
  points: Record<string, Pt>;
  addons: boolean;
  drawLong: boolean;
};

const round = (v: number) => Number(v.toFixed(4));
/** Keep tiny numerical errors visible rather than rounding them to zero. */
const precise = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(3)) : null);

function finitePoint(p: unknown): p is Pt {
  if (!p || typeof p !== "object") return false;
  const q = p as Pt;
  return Number.isFinite(q.x) && Number.isFinite(q.y);
}

const point = (p: unknown) => (finitePoint(p) ? { x: round(p.x), y: round(p.y) } : null);

function readPoint(v: unknown, label: string): Pt {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`argument "${label}" must be a point { x, y }`);
  }
  const o = v as Json;
  try {
    return { x: num(o, "x"), y: num(o, "y") };
  } catch (e) {
    throw new Error(`argument "${label}": ${(e as Error).message}`);
  }
}

function readCircle(v: unknown, label: string): Circle {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`argument "${label}" must be a circle { center, radius }`);
  }
  const o = v as Json;
  const center = readPoint(o.center, `${label}.center`);
  const radius = num(o, "radius");
  if (!(radius > 0)) throw new Error(`argument "${label}.radius" must be positive`);
  return { center, radius };
}

/** Build a core state from either six named points or six angles on a circle. */
function readState(args: Json): SavedState {
  const C = core();
  const names: string[] = C.NAMES;
  const raw = args.points;
  const points: Record<string, Pt> = {};
  let circle: Circle | undefined;

  if (raw !== undefined && raw !== null) {
    if (typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error('argument "points" must be an object with keys A to F');
    }
    for (const n of names) points[n] = readPoint((raw as Json)[n], `points.${n}`);
    if (args.circle !== undefined && args.circle !== null) {
      circle = readCircle(args.circle, "circle");
    }
  } else if (args.angles !== undefined && args.angles !== null) {
    if (!Array.isArray(args.angles) || args.angles.length !== names.length) {
      throw new Error('argument "angles" must be an array of six angles in radians');
    }
    const center = args.center === undefined ? { x: 0, y: 0 } : readPoint(args.center, "center");
    const radius = num(args, "radius", 100);
    if (!(radius > 0)) throw new Error('argument "radius" must be positive');
    circle = { center, radius };
    (args.angles as unknown[]).forEach((a, i) => {
      const angle = num({ angle: a }, "angle");
      points[names[i]] = C.pointOnCircle(circle, angle) as Pt;
    });
  } else {
    // No data given: start from the illustration's own six dots.
    return C.start({}) as SavedState;
  }

  const width = args.width === undefined ? undefined : num(args, "width");
  const height = args.height === undefined ? undefined : num(args, "height");
  const built = C.withOptions(C.start({ points, circle, width, height }), {
    addons: args.addons === true,
    drawLong: args.drawLong === true,
  }) as SavedState;
  if (!finitePoint(built.circle.center) || !(built.circle.radius > 0)) {
    throw new Error("points A, C and E do not determine a circle; move them apart or pass an explicit circle");
  }
  return built;
}

/** The full measured diagram, shared by the diagram action and position(). */
function inspect(args: Json) {
  const C = core();
  const state = readState(args);
  const names: string[] = C.NAMES;
  const m = C.measurements(state);
  const claims = C.claims(state);
  const circle = state.circle;
  const pts = state.points;
  const tolerance = m.tolerance as number;

  const tangents = names.map((n) => {
    const t = C.tangent(pts[n], circle) as { p: Pt; q: Pt };
    return { at: n, p: point(t.p), q: point(t.q) };
  });
  const vertices = (m.vertices as Pt[]).map((v, i) => ({
    name: `V${i}`,
    point: point(v),
    betweenTangentsAt: [names[i], names[(i + 1) % 6]],
  }));
  const diagonals = (m.diagonals as Line[]).map((d, i) => ({
    name: `${names[i]}${names[(i + 3) % 6]}`,
    from: point(d[0]),
    to: point(d[1]),
  }));

  const con = m.concurrent as { point: Pt; error: number } | null;
  const concurrency = con && finitePoint(con.point)
    ? { point: point(con.point), error: precise(con.error), tolerance: precise(tolerance), holds: con.error < tolerance }
    : null;
  const chords = (m.chords as Line[]).map((c, i) => ({
    name: `${names[i]}${names[i + 3]}`,
    from: point(c[0]),
    to: point(c[1]),
  }));
  const chordCon = C.concurrency(m.chords) as { point: Pt; error: number } | null;
  const chordConcurrency = chordCon && finitePoint(chordCon.point)
    ? { point: point(chordCon.point), error: precise(chordCon.error), tolerance: precise(tolerance), concurrent: chordCon.error < tolerance }
    : null;

  const holds = Boolean(concurrency && concurrency.holds && m.finite);
  const chordsHold = Boolean(chordConcurrency && chordConcurrency.concurrent);
  const meeting = holds && concurrency && concurrency.point
    ? `meet at one point, (${concurrency.point.x}, ${concurrency.point.y}) (error ${concurrency.error} below tolerance ${concurrency.tolerance})`
    : "have no usable common point here — two tangents are almost parallel, so drag a dot and try again";
  const chordError = chordConcurrency ? String(chordConcurrency.error) : "not computable";
  const note = `Brianchon's theorem: the three diagonals joining opposite vertices of the circumscribed hexagon ${meeting}. The applet's extra chords AD, BE and CF join opposite points of contact: ${chordsHold ? "in this symmetric position they happen to concur too" : "they are a different triple of lines and are not generally concurrent"} (meeting error ${chordError}, tolerance ${precise(tolerance)}).`;

  return {
    width: state.width,
    height: state.height,
    circle: { center: point(circle.center), radius: round(circle.radius) },
    points: Object.fromEntries(names.map((n) => [n, point(pts[n])])),
    tangents,
    vertices,
    diagonals,
    concurrency,
    chords,
    chordConcurrency,
    finiteVertices: claims.finiteVertices === true,
    claims: {
      onCircle: claims.onCircle === true,
      tangentsTouch: claims.tangentsTouch === true,
      sidesTouch: claims.sidesTouch === true,
      majorDiagonals: claims.majorDiagonals === true,
    },
    note,
  };
}

export function actions(): GameActions {
  return {
    diagram: {
      describe:
        "For six points on a circle (given as six named x/y points, or as six angles in radians with an optional centre and radius), report the tangent at each point, the six vertices of the circumscribed hexagon, the three diagonals joining opposite vertices, and the point where those diagonals meet. Also report the applet's extra chords AD, BE and CF: they join opposite points of contact and are not generally concurrent.",
      args: '{"angles":[0,1.2,2.5,3.1,4.9,5.5],"center":{"x":0,"y":0},"radius":100}',
      run: (args) => inspect(args),
    },
    quadrilateral: {
      describe:
        "For the same six points, let B coincide with A and E with D — the applet's quadrilateral case. The circumscribed hexagon collapses to a tangential quadrilateral, and its diagonals AD plus the line through the other two vertices still meet at one point.",
      args: '{"angles":[0,1.2,2.5,3.1,4.9,5.5],"center":{"x":0,"y":0},"radius":100}',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const q = C.quadrilateral(state) as { point: Pt; error: number } | null;
        const tolerance = C.measurements(state).tolerance as number;
        const pts = state.points;
        return {
          collapsed: { B: "A", E: "D" },
          points: {
            A: point(pts.A), B: point(pts.A), C: point(pts.C),
            D: point(pts.D), E: point(pts.D), F: point(pts.F),
          },
          concurrency: q && finitePoint(q.point)
            ? { point: point(q.point), error: precise(q.error), tolerance: precise(tolerance), holds: q.error < tolerance }
            : null,
          note: "With B at A and E at D, two pairs of tangents coincide; in the limit the two collapsed vertices are A and D themselves. The diagonals AD, and the joins of the other two pairs of vertices, still meet at one point — the quadrilateral case of Brianchon's theorem.",
        };
      },
    },
  };
}

/** What the core says about the picture the page currently shows. */
export function position(state: Json, stateVersion: number): unknown {
  return {
    stateVersion,
    ...inspect(state),
    addons: state.addons === true,
    drawLong: state.drawLong === true,
  };
}
