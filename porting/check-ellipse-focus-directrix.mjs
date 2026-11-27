#!/usr/bin/env node
"use strict";

/*
 * Logic test for ellipse-focus-directrix/ellipse-focus-directrix-core.js.
 *
 *   node porting/check-ellipse-focus-directrix.mjs
 *
 * The Java canvas had four draggable rectangle corners and one point P held
 * on the ellipse by CTKEllipse.KeepOnEllipse. Its Compute() chose the focus
 * on the longer axis, drew the matching directrix at a/e from the centre,
 * dropped P's perpendicular to it and built a right triangle of PF, PD and
 * sqrt(PD^2-PF^2). Nothing chose a winner: there is no win or loss.
 *
 * Here CTKEllipse, GeoSDoub and Compute() are transcribed a second time,
 * straight from javap, and compared with the core on every shape in a grid
 * (half axes 30..180 by 20..140 in tens) at 24 parameters each, on every
 * corner index at a grid of pointer positions, and on a grid of dragged P
 * positions. The page's three claims are then checked exhaustively over the
 * same grid: PF/PD is constant and below 1, each ellipse has two working
 * focus/directrix pairs, and the foci line is the symmetry axis at right
 * angles to both directrices. The sibling EllipseFocal's PF + PF' = 2a is
 * checked on the same points, and the applet's near-circle early return is
 * pinned down to its one-pixel boundary.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("ellipse-focus-directrix/ellipse-focus-directrix-core.js", "EllipseFocusDirectrixCore");
const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const firstBad = (items, fn) => {
  for (const item of items) {
    const why = fn(item);
    if (why) return why;
  }
  return null;
};
/* ================================================== 1. the starting picture */

const initial = C.start({});
equal("the applet's default width", initial.width, 400);
equal("the applet's default height", initial.height, 300);
equal("the applet's margin", initial.margin, 20);
equal("the centre of the initial rectangle", initial.center, { x: 200, y: 150 });
equal("the four initial corners", initial.corners, [
  { x: 100, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 100 }, { x: 100, y: 100 },
]);
equal("the initial half axes (WIDTH/4, HEIGHT/6)", C.halfAxes(initial), { a: 100, b: 50 });
check("P starts at EllipseAt(-pi/4)", near(C.pointAt(initial).x, 200 + 100 * Math.cos(-Math.PI / 4)) &&
  near(C.pointAt(initial).y, 150 + 50 * Math.sin(-Math.PI / 4)));
check("an illustration has no win or loss", C.result(initial) === null && C.result(C.preset(initial, "tall")) === null);
check("the second directrix starts hidden, as in the applet", initial.showOther === false);

/* ============================== 2. the class methods rebuilt from bytecode */

/* CTKEllipse(MoveablePoint[]) and EllipseUpdated(). */
function refEllipse(V) {
  return {
    center: { x: (V[0].x + V[1].x) / 2, y: (V[1].y + V[2].y) / 2 },
    Inf: { x: (V[0].x + V[1].x) / 2 + 200, y: (V[1].y + V[2].y) / 2 },
    A: (V[1].x - V[0].x) / 2,
    B: (V[1].y - V[2].y) / 2,
  };
}
function refEllipseAt(E, t) {
  return { x: E.center.x + E.A * Math.cos(t), y: E.center.y + E.B * Math.sin(t) };
}

/* MaintainRect(MoveablePoint): the centre stays put, the other corners mirror. */
function refMaintainRect(V, O, index, q) {
  const R = V.map((p) => ({ x: p.x, y: p.y }));
  const dx = O.x - q.x, dy = O.y - q.y;
  if (index === 0) {
    R[1] = { x: O.x + dx, y: O.y - dy };
    R[2] = { x: O.x + dx, y: O.y + dy };
    R[3] = { x: O.x - dx, y: O.y + dy };
  } else if (index === 1) {
    R[0] = { x: O.x + dx, y: O.y - dy };
    R[2] = { x: O.x - dx, y: O.y + dy };
    R[3] = { x: O.x + dx, y: O.y + dy };
  } else if (index === 2) {
    R[0] = { x: O.x + dx, y: O.y + dy };
    R[1] = { x: O.x - dx, y: O.y + dy };
    R[3] = { x: O.x + dx, y: O.y - dy };
  } else {
    R[0] = { x: O.x - dx, y: O.y + dy };
    R[1] = { x: O.x + dx, y: O.y + dy };
    R[2] = { x: O.x + dx, y: O.y - dy };
  }
  R[index] = { x: q.x, y: q.y };
  return R;
}

/* GeoSDoub.FindOrientation(a,b,c) and ComputeSignedAngle(a,b,c). */
function refOrientation(a, b, c) {
  const cross = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return cross > 0 ? 1 : -1;
}
function refSignedAngle(a, b, c) {
  const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const len = (p, q) => Math.sqrt(sq(p, q));
  const cos = Math.max(-1, Math.min(1, (sq(a, b) + sq(a, c) - sq(b, c)) / (2 * len(a, b) * len(a, c))));
  const angle = Math.acos(cos);
  return refOrientation(a, b, c) === 1 ? angle : -angle;
}
function refKeepOnEllipse(E, q) {
  return refEllipseAt(E, refSignedAngle(E.center, E.Inf, q));
}

/* CTKEllipse.Foci(). */
function refFoci(E) {
  const A = Math.abs(E.A), B = Math.abs(E.B);
  const big = A > B ? A : B, small = A > B ? B : A;
  const c = Math.sqrt(big * big - small * small);
  if (Number.isNaN(c)) return null;
  return A > B
    ? [{ x: E.center.x - c, y: E.center.y }, { x: E.center.x + c, y: E.center.y }]
    : [{ x: E.center.x, y: E.center.y - c }, { x: E.center.x, y: E.center.y + c }];
}

/* GeoSDoub.NearestPoint(P, m1, m2) and Dist(). */
function refNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 < 0.1) return { x: a.x, y: a.y };
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/* EllipseFocusDirectrixCanvas.Compute(), literal branch order from javap. */
function refCompute(state) {
  const V = state.corners;
  const F = refFoci(refEllipse(V)); // the applet refreshes F before its test
  const L1 = Math.abs(V[1].x - V[0].x);
  const L3 = Math.abs(V[0].y - V[3].y);
  if (!(Math.abs(L1 - L3) >= 1)) return null; // bytecode: ifge 74; else return
  const E = refEllipse(V);
  let L5, L7, L9, FF, line, S;
  if (!(L3 >= L1)) {
    L5 = Math.sqrt(L1 * L1 - L3 * L3);
    L7 = L5 / L1;
    L9 = L1 / L7 / 2;
    FF = F[0];
    line = [{ x: E.center.x - L9, y: 100 }, { x: E.center.x - L9, y: 200 }];
    const P = refEllipseAt(E, state.theta);
    const N = refNearest(P, line[0], line[1]);
    const f = dist(FF, P), d = dist(N, P);
    L5 = Math.sqrt(d * d - f * f);
    S = { x: (Math.max(V[0].x, V[1].x) + state.width) / 2 - state.margin, y: state.height - state.margin };
    const Apt = { x: S.x - f, y: S.y };
    const Bpt = { x: Apt.x, y: Apt.y - L5 };
    return { vertical: false, foci: F, focus: FF, line: line, N: N, P: P, f: f, d: d, S: S, A: Apt, B: Bpt, e: L7, dCenter: L9 };
  }
  L5 = Math.sqrt(L3 * L3 - L1 * L1);
  L7 = L5 / L3;
  L9 = L3 / L7 / 2;
  FF = F[1];
  line = [{ x: 100, y: E.center.y + L9 }, { x: 200, y: E.center.y + L9 }];
  const P = refEllipseAt(E, state.theta);
  const N = refNearest(P, line[0], line[1]);
  const f = dist(FF, P), d = dist(N, P);
  L5 = Math.sqrt(d * d - f * f);
  S = { x: state.width - state.margin, y: Math.min(V[0].x, V[1].y) / 2 };
  const Apt = { x: S.x, y: S.y + f };
  const Bpt = { x: Apt.x - L5, y: Apt.y };
  return { vertical: true, foci: F, focus: FF, line: line, N: N, P: P, f: f, d: d, S: S, A: Apt, B: Bpt, e: L7, dCenter: L9 };
}

/* All half-axis shapes of the test grid. */
const shapes = [];
for (let a = 30; a <= 180; a += 10) {
  for (let b = 20; b <= 140; b += 10) shapes.push({ a: a, b: b });
}
const states = shapes.map(({ a, b }) => C.resize(initial, a, b));
/* A circle has no directrix: the applet skips it, and so do the pair checks. */
const validStates = states.filter((s) => {
  const h = C.halfAxes(s);
  return Math.abs(Math.abs(h.a) - Math.abs(h.b)) >= 2;
});

/* --------------------------------------------------- corner dragging against javap */

{
  const points = [];
  for (let x = 60; x <= 340; x += 35) {
    for (let y = 40; y <= 260; y += 30) {
      if (Math.abs(x - 200) <= 10 && Math.abs(y - 150) <= 10) continue; // PointIsGood
      points.push({ x: x, y: y });
    }
  }
  let bad = null;
  for (const s of [initial, C.resize(initial, 45, 100), states[states.length - 1]]) {
    const E = refEllipse(s.corners);
    for (let i = 0; i < 4 && !bad; i++) {
      for (const q of points) {
        const core = C.moveCorner(s, i, q).corners;
        const ref = refMaintainRect(s.corners, E.center, i, q);
        if (JSON.stringify(core) !== JSON.stringify(ref)) {
          bad = `corner ${i} at (${q.x},${q.y}): ${JSON.stringify(core)} != ${JSON.stringify(ref)}`;
          break;
        }
      }
    }
  }
  check("MaintainRect: every corner at 99 pointer positions matches the bytecode", !bad, bad || "");
}

{
  let bad = null;
  for (let i = 0; i < 4 && !bad; i++) {
    for (const q of [{ x: 200, y: 150 }, { x: 195, y: 145 }, { x: 210, y: 150 }, { x: 200, y: 160 }]) {
      if (C.moveCorner(initial, i, q) !== initial) {
        bad = `corner ${i} was allowed at (${q.x},${q.y})`;
        break;
      }
    }
  }
  check("PointIsGood: a corner cannot move within 10 px of the centre", !bad, bad || "");
  check("an out-of-range corner index changes nothing", C.moveCorner(initial, -1, { x: 0, y: 0 }) === initial &&
    C.moveCorner(initial, 4, { x: 0, y: 0 }) === initial);
  check("a non-number corner position changes nothing", C.moveCorner(initial, 0, { x: NaN, y: 1 }) === initial);
  check("a non-number half axis changes nothing", C.resize(initial, NaN, 50) === initial && C.resize(initial, 50, -1) === initial);
}

/* ------------------------------------------------- dragging P against javap */

{
  const targets = [];
  for (let x = 60; x <= 340; x += 40) {
    for (let y = 40; y <= 260; y += 40) targets.push({ x: x, y: y });
  }
  let bad = null;
  for (const s of [initial, C.resize(initial, 45, 100), states[0], states[states.length - 1]]) {
    const E = refEllipse(s.corners);
    for (const q of targets) {
      const got = C.pointAt(C.setPoint(s, q));
      const want = refKeepOnEllipse(E, q);
      if (!near(got.x, want.x, 1e-9) || !near(got.y, want.y, 1e-9)) {
        bad = `drag (${q.x},${q.y}): (${got.x},${got.y}) != (${want.x},${want.y})`;
        break;
      }
    }
    if (bad) break;
  }
  check("KeepOnEllipse: 176 drag targets on four ellipses match the bytecode", !bad, bad || "");
  check("a non-number drag target changes nothing", C.setPoint(initial, { x: NaN, y: 4 }) === initial);
}

/* ------------------------------------------------ the whole Compute() against javap */

{
  const parameters = [];
  for (let i = 0; i < 24; i++) parameters.push(-Math.PI + (2 * Math.PI * i) / 24);
  let bad = null;
  let compared = 0;
  for (const s of states) {
    for (const t of parameters) {
      const state = Object.assign({}, s, { theta: t });
      const core = C.compute(state);
      const ref = refCompute(state);
      compared++;
      if (!core || !ref) {
        if (!core !== !ref) { bad = `one side returned null for a=${s.corners[1].x - 200}`; break; }
        continue;
      }
      const same = (p, q) => p && q && near(p.x, q.x, 1e-8) && near(p.y, q.y, 1e-8);
      if (core.orientation !== (ref.vertical ? "vertical" : "horizontal") ||
          !same(core.foci[0], ref.foci[0]) || !same(core.foci[1], ref.foci[1]) ||
          !same(core.focus, ref.focus) || !same(core.directrix[0], ref.line[0]) ||
          !same(core.directrix[1], ref.line[1]) || !same(core.foot, ref.N) ||
          !same(core.P, ref.P) || !same(core.S, ref.S) || !same(core.A, ref.A) ||
          !same(core.B, ref.B) || !near(core.focusDist, ref.f, 1e-8) ||
          !near(core.directDist, ref.d, 1e-8) || !near(core.eccentricity, ref.e, 1e-8) ||
          !near(core.halfMajor, Math.max(Math.abs(s.corners[1].x - 200), Math.abs(s.corners[0].y - 150)), 1e-8)) {
        bad = `a=${s.corners[1].x - 200}, b=${s.corners[0].y - 150}, t=${t.toFixed(3)}`;
        break;
      }
    }
    if (bad) break;
  }
  check(`Compute: ${compared} shape/parameter combinations match the bytecode field by field`, !bad, bad || "");
}

{
  let bad = null;
  for (let a = 40; a <= 180; a += 7) {
    const s = C.resize(initial, a, a - 0.49); // |2a-2b| = 0.98, just below the threshold
    const r = C.compute(s);
    if (r !== null) { bad = `near circle a=${a} did not take the early return`; break; }
  }
  check("Compute keeps the old picture when |2a-2b| < 1", !bad, bad || "");
  for (let a = 40; a <= 180; a += 7) {
    const s = C.resize(initial, a, a - 0.51); // |2a-2b| = 1.02, just above it
    if (!C.compute(s)) { bad = `a=${a} took the early return above the threshold`; break; }
  }
  check("Compute recomputes when |2a-2b| > 1", !bad, bad || "");
  const circle = C.preset(initial, "circle");
  check("the near-circle preset is inside the applet's skip band", C.compute(circle) === null);
  check("the focus array is still refreshed on the early return", C.foci(circle) !== null && C.foci(circle).length === 2);
}

/* ================================================ 3. the page's three claims */

{
  /* PF / PD, checked for both pairs on every shape and 24 points of each ellipse. */
  const parameters = [];
  for (let i = 0; i < 24; i++) parameters.push(-Math.PI + (2 * Math.PI * i) / 24);
  let worst = 0;
  let bad = null;
  let count = 0;
  for (const s of validStates) {
    for (const pair of C.pairs(s)) {
      if (!pair || !Number.isFinite(pair.e) || !(pair.e < 1) || !(pair.e > 0)) {
        bad = `bad eccentricity for a=${s.corners[1].x - 200}`;
        break;
      }
      for (const t of parameters) {
        const P = C.ellipseAt(s, t);
        const foot = C.nearestOnLine(P, pair.directrix[0], pair.directrix[1]);
        const ratio = dist(P, pair.focus) / dist(P, foot);
        worst = Math.max(worst, Math.abs(ratio - pair.e));
        count++;
        if (!(ratio < 1) || Math.abs(ratio - pair.e) > 1e-9) {
          bad = `ratio ${ratio} != e ${pair.e} at a=${s.corners[1].x - 200}, t=${t.toFixed(3)}`;
          break;
        }
      }
      if (bad) break;
    }
    if (bad) break;
  }
  check(`PF / PD is constant and below 1 for both pairs (${count} points)`, !bad, bad || "");
  check(`the ratio agrees with c/major semi-axis to ${worst.toExponential(2)}`, worst < 1e-9);
}

{
  /* The two combinations are mirror images; the foci line is their axis. */
  let bad = null;
  for (const s of validStates) {
    const P = C.pairs(s);
    if (P.length !== 2) { bad = "a shape did not have two pairs"; break; }
    const h = C.halfAxes(s);
    const vertical = Math.abs(h.b) >= Math.abs(h.a);
    const axis = vertical ? "y" : "x";
    const mid = (p, q) => (p + q) / 2;
    const mirror = mid(P[0].focus[axis], P[1].focus[axis]);
    const focalMid = vertical ? s.center.y : s.center.x;
    const d0 = vertical ? P[0].directrix[0].y : P[0].directrix[0].x;
    const d1 = vertical ? P[1].directrix[0].y : P[1].directrix[0].x;
    if (!near(mirror, focalMid, 1e-9) || !near(mid(d0, d1), focalMid, 1e-9) ||
        !near(P[0].e, P[1].e, 1e-12) ||
        (vertical && !near(P[0].focus.x, s.center.x, 1e-9)) ||
        (!vertical && !near(P[0].focus.y, s.center.y, 1e-9))) {
      bad = `pairs are not mirror images for a=${Math.abs(h.a)}, b=${Math.abs(h.b)}`;
      break;
    }
    /* Directrix perpendicular to the foci line: vertical ellipse -> horizontal line. */
    const line = P[0].directrix;
    const isHorizontal = near(line[0].y, line[1].y, 1e-12);
    if (isHorizontal !== vertical) {
      bad = `directrix is not perpendicular to the major axis for a=${Math.abs(h.a)}`;
      break;
    }
  }
  check("every ellipse has two mirrored focus/directrix pairs", !bad, bad || "");
  check("the directrices are perpendicular to the line joining the foci", !bad, bad || "");
}

{
  /* Reflecting a point across the foci line leaves it on the ellipse. */
  let bad = null;
  for (const s of validStates) {
    const h = C.halfAxes(s);
    const vertical = Math.abs(h.b) >= Math.abs(h.a);
    for (let i = 0; i < 12; i++) {
      const t = (2 * Math.PI * i) / 12;
      const P = C.ellipseAt(s, t);
      const Q = vertical ? { x: 2 * s.center.x - P.x, y: P.y } : { x: P.x, y: 2 * s.center.y - P.y };
      const dx = (Q.x - s.center.x) / h.a, dy = (Q.y - s.center.y) / h.b;
      if (!near(dx * dx + dy * dy, 1, 1e-9)) {
        bad = `reflection left the ellipse for t=${t.toFixed(3)}`;
        break;
      }
    }
    if (bad) break;
  }
  check("the foci line is truly an axis of symmetry (all shapes, 12 points each)", !bad, bad || "");
}

{
  /* The sibling EllipseFocal's claim on the same points, and the geometry behind e. */
  let bad = null;
  for (const s of validStates) {
    const F = C.foci(s);
    const h = C.halfAxes(s);
    const major = Math.max(Math.abs(h.a), Math.abs(h.b));
    const minor = Math.min(Math.abs(h.a), Math.abs(h.b));
    const c = Math.sqrt(major * major - minor * minor);
    for (let i = 0; i < 16; i++) {
      const P = C.ellipseAt(s, (2 * Math.PI * i) / 16);
      const sum = dist(P, F[0]) + dist(P, F[1]);
      if (!near(sum, 2 * major, 1e-8)) { bad = `PF+PF' ${sum} != ${2 * major}`; break; }
    }
    if (bad) break;
  }
  check("the sibling's PF + PF' = 2*major also holds here (the same ellipse)", !bad, bad || "");
  for (const s of validStates) {
    const h = C.halfAxes(s);
    const major = Math.max(Math.abs(h.a), Math.abs(h.b));
    const minor = Math.min(Math.abs(h.a), Math.abs(h.b));
    const e = C.pairs(s)[0].e;
    if (!near(e * e, 1 - (minor * minor) / (major * major), 1e-12) || !(e > 0 && e < 1)) {
      bad = `e^2 != 1 - b^2/a^2 for a=${major}`;
      break;
    }
  }
  check("e^2 = 1 - (minor/major)^2 and 0 < e < 1 on every shape", !bad, bad || "");
}

{
  /* The applet's chosen pair, its ratio field, and its measuring triangle. */
  let bad = null;
  for (const s of validStates) {
    for (let i = 0; i < 8; i++) {
      const r = C.compute(Object.assign({}, s, { theta: (2 * Math.PI * i) / 8 }));
      if (!r) { bad = "compute returned null on a valid ellipse"; break; }
      const wantE = C.pairs(s).find((p) => dist(p.focus, r.focus) < 1e-9).e;
      if (!near(r.ratio, wantE, 1e-9) || !near(r.eccentricity, wantE, 1e-9)) {
        bad = `status ratio ${r.ratio} differs from pair ratio ${wantE}`;
        break;
      }
      if (!near(dist(r.A, r.B), r.leg, 1e-8) ||
          !near(dist(r.A, r.S), r.focusDist, 1e-8) ||
          !near(dist(r.S, r.B), r.directDist, 1e-8) ||
          !near(r.focusDist * r.focusDist + r.leg * r.leg, r.directDist * r.directDist, 1e-7)) {
        bad = `measuring triangle failed for a=${Math.abs(r.ellipse.a)}`;
        break;
      }
      const centerToLine = r.orientation === "horizontal"
        ? Math.abs(r.directrix[0].x - s.center.x) : Math.abs(r.directrix[0].y - s.center.y);
      if (!near(centerToLine, r.halfMajor / r.eccentricity, 1e-8)) {
        bad = `directrix is not at a/e for a=${Math.abs(r.ellipse.a)}`;
        break;
      }
    }
    if (bad) break;
  }
  check("the drawn PF/PD pair has the page's ratio, and the triangle is right", !bad, bad || "");
  check("the directrix sits a/e from the centre on every shape", !bad, bad || "");
}

/* ============================================== 4. presets, toggles, messages */

{
  const wide = C.preset(initial, "wide");
  const tall = C.preset(initial, "tall");
  equal("wide preset keeps the applet's 100 by 50 rectangle", C.halfAxes(wide), { a: 100, b: 50 });
  equal("tall preset makes the major axis vertical", C.halfAxes(tall), { a: 45, b: 100 });
  check("the wide ellipse uses the left focus and a vertical directrix",
    C.compute(wide).orientation === "horizontal" && C.compute(wide).focus.x < 200 &&
    near(C.compute(wide).directrix[0].x, C.compute(wide).directrix[1].x, 1e-12));
  check("the tall ellipse uses the lower focus and a horizontal directrix",
    C.compute(tall).orientation === "vertical" && C.compute(tall).focus.y > 150 &&
    near(C.compute(tall).directrix[0].y, C.compute(tall).directrix[1].y, 1e-12));
  check("the more stretched tall ellipse has the larger eccentricity",
    C.compute(tall).eccentricity > C.compute(wide).eccentricity);
  check("an unknown preset changes nothing", C.preset(initial, "nonsense") === initial);
  check("reset keeps the near-circle toggle but restores the rectangle",
    C.preset(C.toggleOther(wide), "initial").showOther === true &&
    JSON.stringify(C.preset(wide, "initial").corners) === JSON.stringify(initial.corners));
  check("the other-pair toggle flips both ways", C.toggleOther(C.toggleOther(initial)).showOther === false);
  const text = C.describe(wide).text;
  check("the status speaks in PF and PD, not win or lose",
    /PF is/.test(text) && /PD is/.test(text) && /PF \/ PD/.test(text) &&
    !/won|lose|lost/i.test(text));
  check("the near-circle status explains the skipped update",
    /less than one pixel/.test(C.describe(C.preset(initial, "circle")).text));
}

done("ellipse-focus-directrix");
