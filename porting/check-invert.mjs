#!/usr/bin/env node
"use strict";

/*
 * Logic test for invert/invert-core.js.
 *
 *   node porting/check-invert.mjs
 *
 * Part 1 transcribes the applet's peauc class a second time, straight from the
 * bytecode (constructor, FindPeauc, CheckDoubPoint, all five move handlers,
 * Uncheck, drawLine/CheckForBetweeness) and compares it with the core on the
 * opening picture, 1,440 solved rod configurations and 3,000 drag targets.
 *
 * Part 2 checks the page's claims over all 1,440 configurations and a 720-step
 * sweep of A around the guide circle: OA*OC = OB^2 - AB^2 = L^2 - s^2, ABCD is
 * a rhombus of side s, OB = OD = L, O/A/C are collinear and C is the inverse
 * of A, and because A's circle passes through O, C lies on one straight line
 * (a finite segment). Part 3 checks the guards, the trail, the handle picking
 * order and the demo's end-of-play marker.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("invert/invert-core.js", "InvertCore");

/* ------------------------------------------------ a second transcription --- */

const cp = (p) => ({ x: p.x, y: p.y });
const dv = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const dd = (p, q) => p.x * q.x + p.y * q.y;
const len = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);

/** peauc(int,int,int,int,int) + FindPeauc(), written as mutable Java fields. */
function javaInit(w, h, radius, L, s, centre, O, A) {
  const m = {
    Trajectory: [], Center: cp(centre), Radius: radius, RombSide: s, LongOne: L,
    P0: cp(O), P1: cp(A), P21: { x: 0, y: 0 }, P22: { x: 0, y: 0 },
    P23: { x: 0, y: 0 }, Aux: { x: 0, y: 0 }, Storage: { x: 0, y: 0 },
    Draw: { x: 0, y: 0 }, Its: 9, New: false, Turn: 0, R: 5, D: 11,
  };
  if (!javaFind(m)) {
    // The constructor created all five DoubPoints at (0,0); Aux may already
    // have been written by FindPeauc before it refused the configuration.
    for (const key of ["P21", "P22", "P23", "Draw"]) m[key] = { x: 0, y: 0 };
  }
  m.Draw = cp(m.P22);
  return m;
}

/** peauc.FindPeauc(): local slots 1,3,5,7,9,11,13,15,17,19 of the bytecode. */
function javaFind(m) {
  const slot1 = len(m.P0, m.P1);
  if (slot1 < 0.1) return false;
  const slot3 = (m.LongOne * m.LongOne - m.RombSide * m.RombSide) / slot1;
  const slot5 = slot3 / slot1;
  m.Aux.x = (m.P1.x + m.P0.x + slot5 * (m.P1.x - m.P0.x)) / 2;
  m.Aux.y = (m.P1.y + m.P0.y + slot5 * (m.P1.y - m.P0.y)) / 2;
  let slot7 = m.RombSide * m.RombSide - ((slot3 - slot1) / 2) ** 2;
  if (!(slot7 > 0)) return false;
  slot7 = Math.sqrt(slot7);
  let slot13, slot15;
  if (Math.abs(m.P0.y - m.P1.y) < 2) {
    slot13 = 0;
    slot15 = 1;
  } else {
    const slot9 = -(m.P0.x - m.P1.x) / (m.P0.y - m.P1.y);
    const slot11 = Math.sqrt(slot9 * slot9 + 1);
    slot13 = 1 / slot11;
    slot15 = slot9 / slot11;
  }
  const slot17 = m.P0.x + slot5 * (m.P1.x - m.P0.x);
  const slot19 = m.P0.y + slot5 * (m.P1.y - m.P0.y);
  if (Math.abs(slot17) > 2000 || Math.abs(slot19) > 2000) return false;
  m.P21.x = m.Aux.x - slot7 * slot13;
  m.P21.y = m.Aux.y - slot7 * slot15;
  m.P22.x = slot17;
  m.P22.y = slot19;
  m.P23.x = m.Aux.x + slot7 * slot13;
  m.P23.y = m.Aux.y + slot7 * slot15;
  return true;
}

/** peauc.CheckDoubPoint(): the order of the five checks matters. */
function javaPick(m, point) {
  const p = { x: Math.round(point.x), y: Math.round(point.y) };
  const near = (q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y) <= 2;
  if (near(m.P0)) m.Its = 0;
  else if (near(m.P1)) m.Its = 1;
  else if (near(m.P21)) m.Its = 2;
  else if (near(m.P22)) m.Its = 3;
  else if (near(m.Center)) m.Its = 4;
  else m.Its = 9;
}

/** MoveFixedDoubPoint / MoveMovingDoubPoint, including the 1e-4 early return. */
function javaProject(m, which, target) {
  const slot2 = len(m.Center, target);
  if (slot2 < 0.0001) return;
  const k = m.Radius / slot2;
  m.Storage.x = m[which].x;
  m.Storage.y = m[which].y;
  m[which].x = m.Center.x + k * (target.x - m.Center.x);
  m[which].y = m.Center.y + k * (target.y - m.Center.y);
  if (!javaFind(m)) {
    m[which].x = m.Storage.x;
    m[which].y = m.Storage.y;
  }
}

function javaMoveFixed(m, p) { javaProject(m, "P0", p); }

function javaMoveMoving(m, p) {
  m.New = false;
  javaProject(m, "P1", p);
}

/** MoveUpperDoubPoint: B sets both rod lengths, then FindPeauc is ignored. */
function javaMoveUpper(m, p) {
  m.LongOne = len(p, m.P0);
  m.RombSide = len(p, m.P1);
  javaFind(m);
}

/** MoveSideDoubPoint: the projection and the quadratic for the rhombus side. */
function javaMoveSide(m, p) {
  const slot2 = dd(dv(m.P1, m.P0), dv(p, m.P0)) /
    dd(dv(m.P1, m.P0), dv(m.P1, m.P0));
  m.Aux.x = m.P0.x + slot2 * (m.P1.x - m.P0.x);
  m.Aux.y = m.P0.y + slot2 * (m.P1.y - m.P0.y);
  m.Aux.x = (m.P1.x + m.Aux.x) / 2;
  m.Aux.y = (m.P1.y + m.Aux.y) / 2;
  const q = m.LongOne * m.LongOne
    - dd(dv(m.P0, m.Aux), dv(m.P0, m.Aux))
    + dd(dv(m.P1, m.Aux), dv(m.P1, m.Aux));
  if (!(q > 0)) return;
  m.RombSide = Math.sqrt(q);
  javaFind(m);
}

/** MoveCenter: slide P perpendicular to OA, round the radius, reclose at O. */
function javaMoveCenter(m, p) {
  let slot6, slot8;
  if (Math.abs(m.P0.y - m.P1.y) < 2) {
    slot6 = 0;
    slot8 = 1;
  } else {
    const slot2 = -(m.P0.x - m.P1.x) / (m.P0.y - m.P1.y);
    const slot4 = Math.sqrt(slot2 * slot2 + 1);
    slot6 = 1 / slot4;
    slot8 = slot2 / slot4;
  }
  const slot10 = (slot6 * (p.x - m.Center.x) + slot8 * (p.y - m.Center.y)) /
    (slot6 * slot6 + slot8 * slot8);
  m.Center.x += slot10 * slot6;
  m.Center.y += slot10 * slot8;
  m.Radius = Math.round(len(m.Center, m.P1));
  m.Its = 0;
  javaMove(m, cp(m.P0));
  javaFind(m);
  m.Its = 4;
}

/** peauc.move(java.awt.Point): the tableswitch on m_Its. */
function javaMove(m, point) {
  const p = { x: Math.round(point.x), y: Math.round(point.y) };
  switch (m.Its) {
    case 0: javaMoveFixed(m, p); break;
    case 1: javaMoveMoving(m, p); break;
    case 2: javaMoveUpper(m, p); break;
    case 3: javaMoveSide(m, p); break;
    case 4: javaMoveCenter(m, p); break;
    default: break;
  }
}

/** peauc.drawLine + CheckForBetweeness while A is held down. */
function javaDrawLine(m) {
  if (m.Its !== 1) return;
  m.Trajectory.push(cp(m.Draw));
  m.Draw = cp(m.P22);
  m.Turn = (m.Turn + 1) % 7;
  const n = m.Trajectory.length;
  if (n >= 3 && m.Turn !== 0) {
    const q = m.Trajectory[n - 2];
    const at = m.Trajectory.indexOf(q);
    if (at >= 0) m.Trajectory.splice(at, 1);
  }
}

/** peauc.Uncheck() */
function javaUncheck(m) {
  if (m.Its !== 1) {
    m.New = true;
    m.Trajectory = [];
    m.Draw = cp(m.P22);
  }
  m.Its = 9;
}

const javaGeom = (m) => [m.Center, m.P0, m.P1, m.P21, m.P22, m.P23, m.Aux, m.Draw,
  { x: m.Radius, y: m.LongOne }, { x: m.RombSide, y: m.Its }].map((p) => [p.x, p.y]);
const coreGeom = (s) => [s.center, s.O, s.A, s.B, s.C, s.D, s.M, s.draw,
  { x: s.radius, y: s.longOne }, { x: s.rombSide, y: s.its }].map((p) => [p.x, p.y]);

function drift(a, b) {
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < 2; j++) {
      const x = a[i][j], y = b[i][j];
      if (Number.isNaN(x) && Number.isNaN(y)) continue;
      worst = Math.max(worst, Math.abs(x - y));
    }
  }
  return worst;
}

const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const near = (p, q, tol = 1e-6) => len(p, q) <= tol;
const cross = (p, q) => p.x * q.y - p.y * q.x;

/* -------------------------------------- 1. the opening picture and its guards */

{
  const s = C.start({});
  const j = javaInit(s.width, s.height, s.radius, s.longOne, s.rombSide,
    s.center, s.O, s.A);
  check("opening picture matches the applet's constructor",
    drift(coreGeom(s), javaGeom(j)) < 1e-9, `drift ${drift(coreGeom(s), javaGeom(j))}`);
  check("the applet's canvas and rods are 400x350, R=60, L=80, s=30",
    s.center.x === 200 && s.center.y === 262 && s.radius === 60 &&
    s.longOne === 80 && s.rombSide === 30);
  check("the starting state is not finished", C.result(s) === null);
  check("all five rings and both modern buttons are legal moves",
    ["O", "A", "B", "C", "P"].every((w) => C.legalMoves(s).some((m) => m.which === w)) &&
    C.legalMoves(s).some((m) => m.type === "clearTrail") &&
    C.legalMoves(s).some((m) => m.type === "reset"));
  check("the opening product is L^2 - s^2 = 5500",
    close(len(s.O, s.A) * len(s.O, s.C), 5500, 1e-8));
  check("FindPeauc refuses A within 0.1 of O",
    C.solve({ x: 10, y: 10 }, { x: 10.05, y: 10 }, 80, 30) === null &&
    javaFind(javaInit(400, 350, 60, 80, 30, { x: 200, y: 262 },
      { x: 10, y: 10 }, { x: 10.05, y: 10 })) === false);
  check("FindPeauc refuses a negative half-diagonal (L - s > OA)",
    C.solve({ x: 100, y: 100 }, { x: 130, y: 100 }, 300, 30).ok === false &&
    javaFind(javaInit(400, 350, 60, 300, 30, { x: 200, y: 262 },
      { x: 100, y: 100 }, { x: 130, y: 100 })) === false);
  check("FindPeauc refuses a drawing point beyond the 2000 guard",
    C.solve({ x: 100, y: 100 }, { x: 100, y: 100.5 }, 80, 30).ok === false);
}

/* --------------------------------- 2. 1,440 configurations, core vs bytecode */

const centres = [{ x: 60, y: 190 }, { x: 140, y: 260 }, { x: 200, y: 262 },
  { x: 265, y: 200 }, { x: 330, y: 280 }];
const radii = [35, 50, 60, 75];
const rods = [[80, 30], [70, 40], [95, 25]];
const worst = { coreVsJava: 0, product: 0, rhombus: 0, long: 0, collinear: 0,
  ray: 0, line: 0, count: 0, refused: 0 };

for (const centre of centres) {
  for (const radius of radii) {
    // O and A are both on P's circle, as the applet keeps them after any drag.
    const O = { x: centre.x - radius * Math.sqrt(2) / 2,
      y: centre.y - radius * Math.sqrt(2) / 2 };
    for (let k = 0; k < 24; k++) {
      const ang = 2 * Math.PI * k / 24;
      const A = { x: centre.x + radius * Math.cos(ang), y: centre.y + radius * Math.sin(ang) };
      for (const [L, s] of rods) {
        worst.count++;
        const state = C.start({ center: centre, radius, longOne: L, rombSide: s, O, A });
        const java = javaInit(400, 350, radius, L, s, centre, O, A);
        worst.coreVsJava = Math.max(worst.coreVsJava,
          drift(coreGeom(state), javaGeom(java)));
        if (!C.solve(O, A, L, s)?.ok) { worst.refused++; continue; }

        // The page's central identity, checked at every configuration.
        worst.product = Math.max(worst.product,
          Math.abs(len(state.O, state.A) * len(state.O, state.C) - (L * L - s * s)));
        // ABCD is a rhombus: four equal sides, with OB = OD as the long rods.
        worst.rhombus = Math.max(worst.rhombus,
          Math.abs(len(state.A, state.B) - s), Math.abs(len(state.B, state.C) - s),
          Math.abs(len(state.C, state.D) - s), Math.abs(len(state.D, state.A) - s));
        worst.long = Math.max(worst.long,
          Math.abs(len(state.O, state.B) - L), Math.abs(len(state.O, state.D) - L));
        // M is the common midpoint of the diagonals AC and BD.
        worst.collinear = Math.max(worst.collinear,
          len(state.M, { x: (state.A.x + state.C.x) / 2, y: (state.A.y + state.C.y) / 2 }),
          len(state.M, { x: (state.B.x + state.D.x) / 2, y: (state.B.y + state.D.y) / 2 }),
          Math.abs(cross(dv(state.A, state.O), dv(state.C, state.O))) /
          (len(state.O, state.A) || 1));
        // C is the inverse of A: same ray, product L^2-s^2 (checked above).
        const u = dv(state.C, state.O), v = dv(state.A, state.O);
        worst.ray = Math.max(worst.ray, Math.abs(cross(u, v)) /
          (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1));
        // The inverse of P's circle is the line perpendicular to OP through
        // O + (L^2-s^2)/(2R) * unit(OP).
        const dir = dv(centre, state.O);
        const unit = { x: dir.x / radius, y: dir.y / radius };
        const foot = { x: state.O.x + unit.x * (L * L - s * s) / (2 * radius),
          y: state.O.y + unit.y * (L * L - s * s) / (2 * radius) };
        worst.line = Math.max(worst.line,
          Math.abs(dd(unit, dv(state.C, foot))) /
          Math.max(1, len(state.C, foot)));
      }
    }
  }
}

check("1,440 configurations were built", worst.count === 1440, `${worst.count}`);
check("solved cases exist in every rod family", worst.count - worst.refused > 600,
  `${worst.count - worst.refused} solved`);
check("core matches a second transcription of FindPeauc on all configurations",
  worst.coreVsJava < 1e-8, `max drift ${worst.coreVsJava}`);
check("page claim: OA * OC = OB^2 - AB^2 = L^2 - s^2 everywhere",
  worst.product < 1e-6, `max drift ${worst.product}`);
check("page claim: ABCD is a rhombus of side AB everywhere",
  worst.rhombus < 1e-6, `max drift ${worst.rhombus}`);
check("page claim: OB = OD everywhere (the two long rods)",
  worst.long < 1e-6, `max drift ${worst.long}`);
check("M is the shared midpoint of AC and BD, and O, A, C are collinear",
  worst.collinear < 1e-6, `max drift ${worst.collinear}`);
check("A and C are inverses in the same ray from O",
  worst.ray < 1e-6, `max drift ${worst.ray}`);
check("page claim: a circle through O inverts into a straight line",
  worst.line < 1e-6, `max drift ${worst.line}`);

/* ---------------------------------------- 3. every drag handler vs bytecode */

{
  const base = C.start({});
  const javaBase = javaInit(base.width, base.height, base.radius, base.longOne,
    base.rombSide, base.center, base.O, base.A);
  const targets = [];
  for (let x = 100; x <= 300; x += 10) {
    for (let y = 140; y <= 320; y += 10) targets.push({ x, y });
  }
  let maxDrag = 0, n = 0;
  let coreState = base, javaState = javaBase;
  for (const which of ["O", "A", "B", "C", "P"]) {
    for (const target of targets) {
      // Start each family from the opening picture so a refusal cannot hide a
      // later difference; the two machines receive the same selection.
      const c0 = C.selectWhich(base, which);
      const j0 = javaInit(base.width, base.height, base.radius, base.longOne,
        base.rombSide, base.center, base.O, base.A);
      j0.Its = ["O", "A", "B", "C", "P"].indexOf(which);
      const c1 = C.move(c0, { type: "drag", point: target });
      javaMove(j0, target);
      if (which === "A") javaDrawLine(j0);
      const d = drift(coreGeom(c1), javaGeom(j0));
      maxDrag = Math.max(maxDrag, d);
      n++;
      coreState = c1;
      javaState = j0;
    }
  }
  check("nearly two thousand drags were compared", n === 1995, `${n}`);
  check("all five drag handlers match the applet's bytecode",
    maxDrag < 1e-8, `max drift ${maxDrag}`);
  check("the last drag in each family stays in sync",
    coreState.trajectory.length === javaState.Trajectory.length);
}

/* ------------------------------- 4. handle picking, trail and release rules */

{
  const s = C.start({});
  const j = javaInit(s.width, s.height, s.radius, s.longOne, s.rombSide,
    s.center, s.O, s.A);
  const order = ["O", "A", "B", "C", "P"];
  const chosen = {};
  for (const name of order) {
    const at = name === "P" ? s.center : s[name];
    chosen[name] = C.selectPoint(s, at).its;
    javaPick(j, at);
    check(`pressing ${name} picks handle ${order.indexOf(name)}`,
      chosen[name] === order.indexOf(name) && j.Its === chosen[name]);
  }
  check("pressing empty space picks no handle", C.selectPoint(s, { x: 10, y: 10 }).its === 9);
  // Overlapping rings: O is checked before A, A before B, and so on.
  const midpoint = { x: (s.O.x + s.A.x) / 2, y: (s.O.y + s.A.y) / 2 };
  check("overlapping rings follow the applet's check order",
    C.selectPoint({ ...s, B: midpoint, C: midpoint, center: midpoint }, midpoint).its === 2);

  const drag = (state, name, p) => C.move(state, { type: "drag", which: name, point: p });
  let traced = C.start({});
  traced = drag(traced, "A", { x: 250, y: 235 });
  traced = drag(traced, "A", { x: 255, y: 225 });
  traced = drag(traced, "A", { x: 260, y: 220 });
  // CheckForBetweeness drops the middle point of every three after turn 3.
  check("dragging A adds C to the traced line", traced.trajectory.length === 2,
    `${traced.trajectory.length}`);
  const released = C.move(traced, { type: "release" });
  check("releasing A keeps the traced line", released.trajectory.length === 2);
  check("releasing A leaves no handle held", released.its === 9);
  const other = drag(C.move({ ...traced, its: 9 }, { type: "select", which: "B" }),
    "B", { x: 230, y: 200 });
  const cleared = C.move(other, { type: "release" });
  check("releasing any other handle clears the line", cleared.trajectory.length === 0);
  check("clearing sets the applet's new-linkage flag", cleared.newPeauc === true);
  check("Clear trail is an available modern button",
    C.move(released, { type: "clearTrail" }).trajectory.length === 0);
  const reset = C.move(released, { type: "reset" });
  check("Reset restores the opening rods and circle",
    near(reset.O, s.O) && near(reset.A, s.A) && near(reset.C, s.C) &&
    reset.radius === 60 && reset.longOne === 80 && reset.rombSide === 30);
  check("a demo is marked done only once something has changed",
    C.result(C.start({})) === null && C.result(drag(C.start({}), "A", { x: 250, y: 230 })) === "done");
  check("options are recorded and refused when malformed",
    C.move(s, { type: "option", key: "showCircle", value: false }).showCircle === false &&
    C.move(s, { type: "option", key: "nope", value: true }) === null);
}

/* -------------------------- 5. the 720-step sweep of A around P's circle */

{
  const s = C.start({});
  let ok = 0, refused = 0, maxProduct = 0, maxRay = 0, maxLine = 0;
  let minAlong = Infinity, maxAlong = -Infinity, minAcross = Infinity, maxAcross = -Infinity;
  const unit = { x: Math.SQRT1_2, y: Math.SQRT1_2 }; // from O towards P
  const foot = { x: s.O.x + unit.x * 5500 / (2 * s.radius),
    y: s.O.y + unit.y * 5500 / (2 * s.radius) };
  for (let i = 0; i < 720; i++) {
    const ang = 2 * Math.PI * i / 720;
    const target = { x: s.center.x + s.radius * Math.cos(ang),
      y: s.center.y + s.radius * Math.sin(ang) };
    const next = C.move(C.selectWhich(s, "A"), { type: "drag", point: target });
    if (next.failed || !Number.isFinite(next.C.x)) { refused++; continue; }
    ok++;
    maxProduct = Math.max(maxProduct,
      Math.abs(len(next.O, next.A) * len(next.O, next.C) - 5500));
    maxRay = Math.max(maxRay,
      Math.abs(cross(dv(next.C, next.O), dv(next.A, next.O))) /
      (len(next.C, next.O) * len(next.A, next.O)));
    maxLine = Math.max(maxLine, Math.abs(dd(unit, dv(next.C, foot))) /
      Math.max(1, len(next.C, foot)));
    const along = cross(unit, dv(next.C, foot)), across = dd(dv(next.C, foot), unit);
    minAlong = Math.min(minAlong, along);
    maxAlong = Math.max(maxAlong, along);
    minAcross = Math.min(minAcross, across);
    maxAcross = Math.max(maxAcross, across);
  }
  check("the sweep really moved A round the circle", ok > 300, `${ok} of 720`);
  check("the applet refuses the linkage over part of the circle", refused > 300,
    `${refused} refused`);
  check("the swept product stays at 5500", maxProduct < 1e-6, `max drift ${maxProduct}`);
  check("the swept A and C stay on one ray from O", maxRay < 1e-6, `max drift ${maxRay}`);
  check("every swept C lies on the inverse straight line", maxLine < 1e-6, `max drift ${maxLine}`);
  check("the page's 'line segment' is finite and bounded",
    minAlong > -2000 && maxAlong < 2000 && maxAcross - minAcross < 1e-6,
    `along ${minAlong}..${maxAlong}, across ${minAcross}..${maxAcross}`);
  check("the segment has a visible length", maxAlong - minAlong > 100,
    `length ${maxAlong - minAlong}`);
}

done("invert");
