/*
 * run_game_logic actions and saved-position reader for Bisectal Circle.
 *
 * Two circles given by a centre dot and a radius dot have an external centre
 * of homothety Q = (r2·O1 − r1·O2)/(r2 − r1). The circle centred at Q with
 * radius rho = sqrt((dist(Q,O1) − r1)(dist(Q,O2) + r2)) is the bisectal circle:
 * inversion in it swaps the two given circles. A circle orthogonal to it is
 * fixed by that inversion, so it cuts both given circles at equal angles.
 *
 * The core (bisectal-circle/bisectal-circle-core.js) does the whole geometry;
 * it is copied into src/generated/cores/ at build time. Every number below is
 * computed by that core. See _shared.ts for the shape of a game module.
 *
 * Two cautions the page makes explicit: equal radii send Q to infinity, where
 * the bisectal circle becomes the perpendicular bisector of the centres; and
 * the equal-angle claim belongs to the external circle only. For the internal
 * circle it fails when T is off the line of centres (the symmetry line).
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["bisectal-circle"].BisectalCircleCore as any;

type Point = { x: number; y: number };

/** Board coordinates to four decimals; computed numbers to six. */
const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
const xy = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;
const deg = (rad: number | null | undefined): number | null =>
  rad === null || rad === undefined || !Number.isFinite(rad) ? null : r6(rad * 180 / Math.PI);

/** Accept the page's {x,y} points and the tutor's [x,y] arguments alike. */
function readPoint(v: unknown, label: string, fallback: Point): Point {
  if (v === undefined || v === null) return { x: fallback.x, y: fallback.y };
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
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

/** The five draggable dots the page saves with Track.state. */
function readState(v: Json): { O1: Point; R1: Point; O2: Point; R2: Point; T: Point } {
  const home = core().start({});
  if (v === null || typeof v !== "object") throw new Error("the diagram must be an object of points");
  const out = {
    O1: readPoint(v.O1, "O1", home.O1),
    R1: readPoint(v.R1, "R1", home.R1),
    O2: readPoint(v.O2, "O2", home.O2),
    R2: readPoint(v.R2, "R2", home.R2),
    T: readPoint(v.T, "T", home.T),
  };
  if (core().dist(out.O1, out.R1) < core().EPS ||
      core().dist(out.O2, out.R2) < core().EPS) {
    throw new Error("each radius dot R1/R2 must be away from its centre O1/O2");
  }
  return out;
}

function readMode(v: unknown): "external" | "internal" {
  if (v === undefined || v === null || v === "external") return "external";
  if (v === "internal") return "internal";
  throw new Error('"mode" must be "external" or "internal"');
}

/** A short, readable view of one of the core's bisectal circles. */
function circleView(bc: any) {
  if (!bc) return null;
  return {
    kind: bc.kind,
    center: xy(bc.center),
    radius: bc.radius === null || bc.radius === undefined ? null : r6(bc.radius),
    power: bc.infinite ? "infinite (equal radii)" : r6(bc.power),
    infinite: bc.infinite,
    line: bc.line ? bc.line.map((p: Point) => xy(p)) : null,
    midpoint: xy(bc.midpoint),
  };
}

/** Build a diagram and report the core's homothety, power and inversion checks. */
function analyse(v: Json) {
  const C = core();
  const s = readState(v);
  const mode = readMode(v.mode);
  const { c1, c2 } = C.circles(s);
  const possible = C.isPossible(s);
  if (!possible) {
    return {
      possible: false,
      circles: { c1: { center: xy(c1.center), radius: r6(c1.r) }, c2: { center: xy(c2.center), radius: r6(c2.r) } },
      note:
        "No external bisectal circle exists: a radius is zero or one circle sits inside the other. " +
        "Move the centres apart, or enlarge the inner circle, before asking about Q.",
    };
  }
  const ext = C.bisectal(s, "external");
  const int = C.bisectal(s, "internal");
  const extClaims = C.claims(s, "external");
  const swapped = !ext.infinite && ext.radius !== null
    ? C.invertCircle(ext.center, ext.radius, c1)
    : null;
  const guideLines = C.tangentLines(s, mode === "internal" ? "internal" : "external").length;
  const equalRadii = Math.abs(c1.r - c2.r) < C.EPS;
  return {
    possible: true,
    mode,
    circles: { c1: { center: xy(c1.center), radius: r6(c1.r) }, c2: { center: xy(c2.center), radius: r6(c2.r) } },
    centreDistance: r6(C.dist(c1.center, c2.center)),
    radiiEqual: equalRadii,
    internalTangentsExist: C.hasInternal(s),
    externalCenter: xy(C.externalCenter(s)),
    internalCenter: xy(C.internalCenter(s)),
    externalBisectal: circleView(ext),
    internalBisectal: circleView(int),
    checks: extClaims,
    inversionImageOfCircle1: swapped ? { center: xy(swapped.center), radius: r6(swapped.radius) } : null,
    tangentGuideLines: guideLines,
    note: ext.infinite
      ? "The radii are equal, so Q is a point at infinity: the core draws the perpendicular bisector of O1O2 instead of a circle, and reflection in that line swaps the two equal circles. Give the circles different sizes to get a finite Q and the power formula rho² = (dist(Q,O1) − r1)(dist(Q,O2) + r2)."
      : `Q divides O1O2 externally in the ratio r1:r2, and inversion in the circle at Q of radius ${r6(ext.radius)} sends circle 1 to the image reported above, which the core checks against circle 2. ` +
        (mode === "internal"
          ? "The internal bisectal circle comes from the other homothety centre; inversion does not swap the circles there, and the equal-angle claim is false unless T lies on the line of centres."
          : "A circle orthogonal to the bisectal circle is fixed by that inversion, which is why it meets the two circles at equal angles (see equal_angles)."),
  };
}

/** Report the crossing angles for every pair of intersections of the test circle. */
function angleTable(v: Json) {
  const C = core();
  const s = readState(v);
  const mode = readMode(v.mode);
  const m = C.measurements(s, mode);
  if (!m.possible) {
    return {
      possible: false,
      note: "One circle sits inside the other (or a radius is zero); move the circles apart first.",
    };
  }
  if (m.bisectal.infinite) {
    return {
      possible: true,
      bisectal: circleView(m.bisectal),
      test: null,
      pairs: [],
      note:
        "With equal radii Q is at infinity and the bisectal circle is a line, so there is no finite circle " +
        "to be orthogonal to. Move a radius dot to bend the line into a circle.",
    };
  }
  const pairs: Array<Json> = [];
  for (const p of m.p1) {
    for (const q of m.p2) {
      const angle1 = C.crossAngle(p, m.c1, m.test);
      const angle2 = C.crossAngle(q, m.c2, m.test);
      const image = mode === "external" ? C.invert(m.bisectal.center, m.bisectal.radius, p) : null;
      pairs.push({
        S1: xy(p), S2: xy(q),
        angle1Deg: deg(angle1), angle2Deg: deg(angle2),
        differenceDeg: deg(Math.abs(angle1 - angle2)),
        inversionImageNearS2: image ? r6(C.dist(image, q)) : null,
      });
    }
  }
  const chosen = m.pair;
  const view = {
    possible: true,
    mode,
    bisectal: circleView(m.bisectal),
    test: m.test ? { center: xy(m.test.center), radius: r6(m.test.r) } : null,
    crossingsOnCircle1: m.p1.map((p: Point) => xy(p)),
    crossingsOnCircle2: m.p2.map((p: Point) => xy(p)),
    pairs,
    coreChosenPair: chosen ? {
      S1: xy(chosen.p), S2: xy(chosen.q),
      angle1Deg: deg(chosen.a), angle2Deg: deg(chosen.b),
      differenceDeg: deg(chosen.diff),
      inversionGap: Number.isFinite(chosen.invErr) ? r6(chosen.invErr) : null,
    } : null,
    claims: C.claims(s, mode),
    note: !m.test
      ? "T lies inside (or on) the bisectal circle, so no circle centred at T can be orthogonal to it. Drag T outside that circle."
      : pairs.length === 0
        ? "The orthogonal test circle does not reach both given circles. Move T until it crosses each of them."
        : mode === "external"
          ? "Every pair of crossings has equal angles, because the test circle is fixed by the inversion. The pair with inversionGap near 0 is the antihomologous one: inversion sends its S1 exactly onto S2."
          : "Here the bisectal circle is the internal one: inversion does not swap the circles, and the crossing angles differ when T is off the line of centres. Only on that symmetry line do they match.",
  };
  return view;
}

export function actions(): GameActions {
  return {
    bisectal_circle: {
      describe:
        "For two circles, each given by a centre dot and a radius dot (O1/R1 and O2/R2, as [x,y] or {x,y} in the page's 400 x 300 board), report the external homothety centre Q, the bisectal circle's centre and the radius rho from the power (dist(Q,O1) − r1)(dist(Q,O2) + r2), the image of circle 1 under inversion in it (the core checks it is circle 2), and also the internal homothety centre and bisectal circle. Equal radii give Q at infinity and a straight-line limit; mode 'internal' shows the other circle, for which inversion does not swap the circles and the equal-angle claim fails off the symmetry line. Optional 'mode' defaults to external.",
      args: '{ "O1": [110, 150], "R1": [90, 150], "O2": [280, 150], "R2": [325, 150], "mode": "external" }',
      run: (args) => analyse(args),
    },

    equal_angles: {
      describe:
        "Given two circles (O1/R1, O2/R2) and the centre T of a circle orthogonal to the bisectal circle, report where that test circle cuts both given circles and the crossing angles at every pair of intersections. The external bisectal circle gives equal angles at the antihomologous pair because inversion swaps the circles and fixes the test circle; the core also measures the gap from S1 to the inverted S2. Pass mode 'internal' with T off the line of centres to see that the equal-angle claim is false for the other bisectal circle.",
      args: '{ "O1": [150, 160], "R1": [134, 160], "O2": [280, 140], "R2": [375, 140], "T": [230, 35], "mode": "external" }',
      run: (args) => angleTable(args),
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh reading by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Bisectal Circle state version ${stateVersion}`);
  }
  const C = core();
  const s = readState(state ?? ({} as Json));
  const { c1, c2 } = C.circles(s);
  const possible = C.isPossible(s);
  const ext = possible ? C.bisectal(s, "external") : null;
  const bc = ext && !ext.infinite && ext.radius !== null ? ext : null;
  const m = possible ? C.measurements(s, "external") : null;
  const pair = m && m.pair;
  return {
    stateVersion,
    saved: {
      O1: xy(s.O1), R1: xy(s.R1), O2: xy(s.O2), R2: xy(s.R2), T: xy(s.T),
    },
    circles: {
      c1: { center: xy(c1.center), radius: r6(c1.r) },
      c2: { center: xy(c2.center), radius: r6(c2.r) },
    },
    centreDistance: r6(C.dist(c1.center, c2.center)),
    radiiEqual: Math.abs(c1.r - c2.r) < C.EPS,
    possible,
    internalTangentsExist: C.hasInternal(s),
    externalCenter: xy(C.externalCenter(s)),
    internalCenter: xy(C.internalCenter(s)),
    bisectal: possible ? circleView(ext) : null,
    checks: possible ? C.claims(s, "external") : null,
    testCircle: m && m.test ? { center: xy(m.test.center), radius: r6(m.test.r) } : null,
    crossingAngles: pair ? {
      atS1Deg: deg(pair.a), atS2Deg: deg(pair.b), differenceDeg: deg(pair.diff),
      inversionGap: Number.isFinite(pair.invErr) ? r6(pair.invErr) : null,
    } : null,
    note: !possible
      ? "The saved circles are nested or have a zero radius, so no bisectal circle can be drawn."
      : ext.infinite
        ? "The saved circles have equal radii: Q is at infinity and the bisectal circle is the perpendicular bisector of O1O2. Reflection in that line swaps the two circles."
        : `The saved circles have unequal radii: Q from the core is above, rho² = ${r6(ext.power)} matches the inversion power, and inversion in the bisectal circle swaps the two circles. ` +
          (pair
            ? `The orthogonal test circle at T meets them at ${deg(pair.a)}° and ${deg(pair.b)}°, equal to rounding error.`
            : "The core found no pair of crossings where the orthogonal test circle meets both given circles; move T to see the equal-angle test."),
  };
}
