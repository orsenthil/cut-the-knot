#!/usr/bin/env node
"use strict";

/*
 * Logic test for hart-inversor/hart-inversor-core.js.
 *
 *   node porting/check-hart-inversor.mjs
 *
 * Part 1 transcribes the applet's own geometry a second time, straight from
 * HartInversorCanvas and GeoSDoub's bytecode (ScaleTo, NearestPoint,
 * GetParallelTo, Intersect(circle,line), IntersectCirclesX/Y, FindOrientation,
 * GetS and the ComputeC/ComputeABD/ComputePQ/ComputeS routines) and compares it
 * with the core on the opening position and on 17,500 generated configurations.
 *
 * Part 2 checks every claim on the cut-the-knot page over those configurations:
 * AO/AB = AP/AD = CQ/BC = m, O/P/Q collinear and parallel to AC and BD,
 * AC*BD = AD^2-AB^2, OP*OQ = m(1-m)(AD^2-AB^2), SP = SO, P and Q on the same
 * ray from O, and Q on the inverse of P's circle (a straight line). Part 3
 * sweeps P around S's circle and checks the applet's rod limits and every
 * other drag, option and refusal.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("hart-inversor/hart-inversor-core.js", "HartInversorCore");

/* ------------------------- a second transcription of the Java applets ------ */

const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;

/** HartInversorCanvas.ScaleTo / GeoSDoub scale step. */
const appletScale = (p, q, t) => ({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });

/** GeoSDoub.FindOrientation, including its > 0 / <= 0 split. */
function appletOrientation(a, b, c) {
  const z = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return z > 0 ? 1 : -1;
}

/** GeoSDoub.NearestPoint(p, a, b): its 0.1 early return and projection. */
function appletNearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** GeoSDoub.GetParallelTo(p, q1, q2) = p + 100(q1-q2). */
const appletParallel = (p, q1, q2) => ({ x: p.x + 100 * (q1.x - q2.x), y: p.y + 100 * (q1.y - q2.y) });

/** HartInversorCanvas.ComputeC(), in the bytecode's order. */
function appletComputeC(A, B, D) {
  const E = appletNearestPoint(A, B, D);
  const F = { x: D.x + B.x - E.x, y: D.y + B.y - E.y };
  const parallel = appletParallel(A, E, F);
  const C = appletNearestPoint(F, A, parallel);
  return { C, E, F };
}

/** GeoSDoub.IntersectY(DoubLine(B, B+(200,0)), DoubCircle(A,r)). */
function appletIntersectHorizontal(center, radius, throughY) {
  const m = 0;                         // (through.y - (through.y+0)) / 200
  const bIntercept = throughY;         // intercept - m*x2
  const t = m * m + 1;                 // line 6
  const aa = m * (bIntercept - center.y) - center.x;
  const cc = center.x * center.x + (bIntercept - center.y) ** 2 - radius * radius;
  const disc = aa * aa - t * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x0 = (-aa + root) / t, x1 = (-aa - root) / t;
  // IntersectY solves for x and then sets y = m*x+b; [0] is the right root.
  return [{ x: x0, y: m * x0 + bIntercept }, { x: x1, y: m * x1 + bIntercept }];
}

/** ComputeUpperPoint(A, B, b), including the `x0 > A.x` branch. */
function appletUpperPoint(A, B, radius) {
  const points = appletIntersectHorizontal(A, radius, B.y);
  if (!points) return null;
  return points[0].x > A.x ? points[0] : points[1];
}

/**
 * GeoSDoub.IntersectCirclesY(c1,r1,c2,r2), transcribed from the bytecode:
 * y = m*x + b on the radical axis, then the same discriminant and root order.
 */
function appletIntersectCirclesY(c1, r1, c2, r2) {
  const m = (c2.x - c1.x) / (c1.y - c2.y);
  const b = (c1.y ** 2 - c2.y ** 2 + c1.x ** 2 - c2.x ** 2 - r1 * r1 + r2 * r2) /
    (2 * (c1.y - c2.y));
  const aa = m * (b - c1.y) - c1.x;
  const cc = c1.x ** 2 + (b - c1.y) ** 2 - r1 * r1;
  const disc = aa * aa - (m * m + 1) * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x0 = (-aa + root) / (m * m + 1), x1 = (-aa - root) / (m * m + 1);
  return [{ x: x0, y: m * x0 + b }, { x: x1, y: m * x1 + b }];
}

/** GeoSDoub.IntersectCirclesX: x = m*y + b, same root order. */
function appletIntersectCirclesX(c1, r1, c2, r2) {
  const m = (c2.y - c1.y) / (c1.x - c2.x);
  const b = (c1.x ** 2 - c2.x ** 2 + c1.y ** 2 - c2.y ** 2 - r1 * r1 + r2 * r2) /
    (2 * (c1.x - c2.x));
  const aa = m * (b - c1.x) - c1.y;
  const cc = c1.y ** 2 + (b - c1.x) ** 2 - r1 * r1;
  const disc = aa * aa - (m * m + 1) * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y0 = (-aa + root) / (m * m + 1), y1 = (-aa - root) / (m * m + 1);
  return [{ x: m * y0 + b, y: y0 }, { x: m * y1 + b, y: y1 }];
}

/** GeoSDoub.Intersect(circle, circle), with its |dx| then |dy| choice. */
function appletIntersectCircles(c1, r1, c2, r2) {
  // The tangent/disjoint test is what the Java discriminant means; written
  // explicitly because its X/Y formulas lose all precision for nested circles
  // whose centres almost coincide.
  const d = dist(c1, c2);
  if (!(d > 0) || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return null;
  if (Math.abs(c1.x - c2.x) > 1) return appletIntersectCirclesX(c1, r1, c2, r2);
  if (Math.abs(c1.y - c2.y) > 1) return appletIntersectCirclesY(c1, r1, c2, r2);
  return [{ x: c1.x, y: c1.y }, { x: c2.x, y: c2.y }];
}

/** HartInversorCanvas.ComputeABD() with its FindOrientation comparison. */
function appletComputeABD(O, P, a, b, m, B) {
  const points = appletIntersectCircles(O, a * m, P, b * m);
  if (!points) return null;
  const side = appletOrientation(O, P, B);
  const A = appletOrientation(O, P, points[0]) === side ? points[0] : points[1];
  return { A, B: appletScale(A, O, 1 / m), D: appletScale(A, P, 1 / m) };
}

/** HartInversorCanvas.GetS() / ComputeS(), including the one c += 20 retry. */
function appletGetS(O, P, c) {
  const mid = appletScale(O, P, 0.5);
  const d = dist(O, P);
  let h = Math.sqrt(c * c - d * d / 4) / d;
  if (O.x > P.x) h = -h;
  return { x: mid.x + h * (O.y - P.y), y: mid.y - h * (O.x - P.x) };
}
function appletComputeS(O, P, c0) {
  let c = c0, S = appletGetS(O, P, c);
  if (!Number.isFinite(S.x) || !Number.isFinite(S.y) || dist(S, { x: 0, y: 0 }) < 2) {
    c += 20;
    S = appletGetS(O, P, c);
  }
  return { S, c };
}

/** HartInversorCanvas.init(): the opening picture, from the bytecode. */
function appletInit(width, height) {
  const a = Math.min(width, height) / 4, b = 2 * a, c = a / 2, m = 0.4;
  const A = { x: Math.trunc(width / 6), y: Math.trunc(2 * height / 3) };
  const ang = 0.3490658503988659;
  const B = { x: A.x + a * Math.sin(ang), y: A.y - a * Math.cos(ang) };
  const D = appletUpperPoint(A, B, b);
  const { C } = appletComputeC(A, B, D);
  const O = appletScale(A, B, m), P = appletScale(A, D, m), Q = appletScale(C, B, m);
  const { S } = appletComputeS(O, P, c);
  return { a, b, c, m, A, B, C, D, O, P, Q, S };
}

const near = (p, q, tol = 1e-6) => dist(p, q) <= tol;
const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

/* -------------------------------------------- 1. the opening configuration */

{
  const core = C.start({}), java = appletInit(C.WIDTH, C.HEIGHT);
  for (const p of ["A", "B", "C", "D", "O", "P", "Q", "S"]) {
    check(`init ${p} matches the applet`, near(core[p], java[p], 1e-8),
      `core ${JSON.stringify(core[p])} vs applet ${JSON.stringify(java[p])}`);
  }
  check("init a, b, c and m", close(core.a, java.a) && close(core.b, java.b) &&
    close(core.c, java.c) && close(core.r, java.m));
  check("the page's m is 0.4", core.r === 0.4);
  check("initial S circle passes through O and P",
    close(dist(core.S, core.O), core.c, 1e-8) && close(dist(core.S, core.P), core.c, 1e-8));
  check("initial state is not finished", C.result(core) === null);
  check("legal moves include every draggable point", ["A", "B", "D", "O", "P", "S"]
    .every((w) => C.legalMoves(core).some((m) => m.type === "point" && m.which === w)));
}

/* ------------------------------------- 2. the page's claims, exhaustively */

/* A grid of 5 x 5 x 20 x 5 x 7 = 17,500 legal linkage configurations. */
const AS = [40, 55, 75, 90, 110];
const CENTRES = [{ x: 55, y: 180 }, { x: 100, y: 220 }, { x: 160, y: 150 },
  { x: 205, y: 195 }, { x: 240, y: 215 }];
const RATIOS = [1.45, 1.7, 2.0, 2.35, 2.8];
const MS = [0.08, 0.2, 0.35, 0.4, 0.55, 0.7, 0.9];
const worst = {
  ratios: 0, collinear: 0, acbd: 0, product: 0, spso: 0, ray: 0,
  line: 0, coreVsJava: 0, abdVsJava: 0, count: 0, skipped: 0,
};

for (const a of AS) {
  for (const A0 of CENTRES) {
    for (let k = 0; k < 20; k++) {
      const phi = -2.5 + k * 0.17;
      const B0 = { x: A0.x + a * Math.cos(phi), y: A0.y + a * Math.sin(phi) };
      for (const ratio of RATIOS) {
        const D0 = C.upperPoint(A0, a * ratio, B0);
        if (!D0) { worst.skipped++; continue; }
        for (const m of MS) {
          const a0 = dist(A0, B0), b0 = dist(A0, D0);
          const O0 = C.scale(A0, B0, m), P0 = C.scale(A0, D0, m);
          const d0 = dist(O0, P0);
          const c0 = Math.max(a0 / 2, d0 * 0.55 + 5);
          const s = C.configure({ A: A0, B: B0, D: D0, r: m, c: c0 });
          const g = C.compute(s);
          const scale = Math.max(1, a0 * a0);
          worst.count++;

          // Second transcription: C, O, P, Q, S from the applet's own routines.
          const jC = appletComputeC(A0, B0, D0);
          const jO = appletScale(A0, B0, m), jP = appletScale(A0, D0, m);
          const jQ = appletScale(jC.C, B0, m);
          const jS = appletComputeS(jO, jP, c0);
          for (const p of ["C", "E", "F"]) {
            worst.coreVsJava = Math.max(worst.coreVsJava, dist(s[p], jC[p]));
          }
          for (const [key, val] of [["O", jO], ["P", jP], ["Q", jQ], ["S", jS.S]]) {
            worst.coreVsJava = Math.max(worst.coreVsJava, dist(s[key], val));
          }
          worst.coreVsJava = Math.max(worst.coreVsJava, Math.abs(s.c - jS.c));

          // Second transcription of ComputeABD on 7 independently chosen P
          // positions per configuration (still inside the applet's rod limits).
          for (let j = 0; j < 7; j++) {
            const ang = (2 * Math.PI * j) / 7;
            const P = C.projectToCircle(
              { x: s.S.x + s.c * Math.cos(ang), y: s.S.y + s.c * Math.sin(ang) }, s.S, s.c);
            const own = C.computeABD(s.O, P, s.a, s.b, s.r, s.B);
            const java = appletComputeABD(s.O, P, s.a, s.b, s.r, s.B);
            if (!own && !java) continue;
            if (!own || !java) { worst.abdVsJava = Infinity; continue; }
            worst.abdVsJava = Math.max(worst.abdVsJava, dist(own.A, java.A));
          }

          const res = C.residuals(s);
          worst.ratios = Math.max(worst.ratios,
            Math.abs(res.aoRatio - m), Math.abs(res.apRatio - m), Math.abs(res.cqRatio - m));
          const dirOP = sub(g.Q, g.O);
          const parallel = (v) => Math.abs(cross(dirOP, v)) /
            ((dist(dirOP, { x: 0, y: 0 }) * dist(v, { x: 0, y: 0 })) || 1);
          worst.collinear = Math.max(worst.collinear, res.collinearity,
            parallel(sub(g.C, g.A)), parallel(sub(g.D, g.B)));
          worst.acbd = Math.max(worst.acbd, Math.abs(res.acTimesBd - res.bSqMinusASq) / scale);
          worst.product = Math.max(worst.product, Math.abs(res.product - res.power) / scale);
          worst.spso = Math.max(worst.spso, Math.abs(res.sp - res.so));
          worst.ray = Math.max(worst.ray, res.sameRay / scale);
          worst.line = Math.max(worst.line, res.inverseLineDeviation);
        }
      }
    }
  }
}

check("17,500 configurations were actually built", worst.count === 17500 - worst.skipped,
  `count ${worst.count}, skipped ${worst.skipped}`);
check("core matches a second transcription of the applet's init/ComputeC/PQ/S",
  worst.coreVsJava < 1e-6, `max drift ${worst.coreVsJava}`);
check("ComputeABD matches a second transcription of IntersectCircles + FindOrientation",
  worst.abdVsJava < 1e-6, `max drift ${worst.abdVsJava}`);
check("claim (1): AO/AB = AP/AD = CQ/BC = m everywhere", worst.ratios < 1e-9,
  `max drift ${worst.ratios}`);
check("O, P, Q are collinear and the line is parallel to AC and BD",
  worst.collinear < 1e-6, `max drift ${worst.collinear}`);
check("claim (5): AC*BD = AD^2 - AB^2 everywhere", worst.acbd < 1e-6,
  `max relative drift ${worst.acbd}`);
check("claim (2): OP*OQ = m(1-m)(AD^2-AB^2) everywhere", worst.product < 1e-6,
  `max relative drift ${worst.product}`);
check("claim (3): SP = SO everywhere", worst.spso < 1e-6, `max drift ${worst.spso}`);
check("P and Q lie on the same ray from O (a real inversion)", worst.ray < 1e-6,
  `max relative cross product ${worst.ray}`);
check("claim: Q lies on the inverse line of P's circle", worst.line < 1e-6,
  `max drift ${worst.line}`);

/* ----------------------------------- 3. P's circle, the trail and the drags */

{
  const start = C.start({});
  // With m = 0.4 the whole circle of P fits inside the rod limits. To exercise
  // the page's warning, use the same trapezoid with m = 0.2: the far arc of
  // the circle then needs BD > a+b-5 and the applet stops tracing.
  const base = C.configure({ A: start.A, B: start.B, D: start.D, r: 0.2, c: start.c });
  const g = C.compute(base);
  const line = g.inverseLine;
  let swept = 0, ineligible = 0, maxLine = 0, maxProduct = 0, maxRay = 0;
  let phase = base.collectPhase;
  let previous = base;
  for (let i = 0; i < 240; i++) {
    const ang = (2 * Math.PI * i) / 240;
    const target = { x: g.S.x + g.c * Math.cos(ang), y: g.S.y + g.c * Math.sin(ang) };
    const next = C.move(previous, { type: "point", which: "P", point: target });
    if (!next) throw new Error("a point on S's circle was refused");
    if (!next.eligible) { ineligible++; previous = next; continue; }
    swept++;
    const r = C.residuals(next);
    maxLine = Math.max(maxLine, r.inverseLineDeviation);
    maxProduct = Math.max(maxProduct, Math.abs(r.product - r.power));
    maxRay = Math.max(maxRay, r.sameRay);
    // The applet's Mod=2 counter keeps every other eligible drag.
    if (phase === 0) {
      check(`trail point ${swept} is recorded`, next.traceQ.length === previous.traceQ.length + 1);
      phase = 1;
    } else {
      check(`trail point ${swept} is skipped`, next.traceQ.length === previous.traceQ.length);
      phase = 0;
    }
    previous = next;
  }
  check("a real arc of P positions was swept", swept > 50, `${swept} eligible of 240`);
  check("some positions violate the rods and stop the tracing", ineligible > 0,
    `${ineligible} refused of 240`);
  check("every swept Q is on one straight line", maxLine < 1e-6, `max drift ${maxLine}`);
  check("the swept product stays constant", maxProduct < 1e-6, `max drift ${maxProduct}`);
  check("the swept P and Q stay on one ray", maxRay < 1e-6, `max drift ${maxRay}`);
  check("both trail vectors are kept in sync", previous.traceQ.length === previous.traceP.length);
  check("the inverse line is perpendicular to OS",
    close(dot(sub(line.b, line.a), sub(g.S, g.O)), 0, 1e-6));
  check("the inverse line stands power/(2c) from O",
    close(C.lineDeviation(g.O, line.a, line.b) * 2 * g.c, base.r * (1 - base.r) *
      (base.b * base.b - base.a * base.a), 1e-6));

  // An ineligible P drag keeps A, B and D untouched, as the applet does.
  const far = add(g.S, mul(sub(g.S, g.O), g.c / dist(g.S, g.O)));
  const stuck = C.move(base, { type: "point", which: "P", point: far });
  check("an ineligible P drag is reported", stuck !== null && stuck.eligible === false);
  check("an ineligible P drag leaves the linkage alone",
    near(stuck.B, base.B) && near(stuck.D, base.D) && near(stuck.A, base.A));
  check("an ineligible P drag adds no trail point", stuck.traceQ.length === base.traceQ.length);
}

{
  const s = C.start({});
  const moved = C.move(s, { type: "translate", delta: { x: 37, y: -21 } });
  check("dragging A translates every rod and pivot",
    ["A", "B", "C", "D", "O", "P", "Q", "S"].every((k) =>
      near(moved[k], add(s[k], { x: 37, y: -21 }), 1e-8)));
  check("A's drag keeps the rod lengths", close(dist(moved.A, moved.B), s.a) &&
    close(dist(moved.A, moved.D), s.b));
  check("a drag finishes a demo", C.result(moved) === "done");
  check("a refused translate leaves no position", C.move(s, { type: "translate", delta: null }) === null);

  const bMove = C.move(s, { type: "point", which: "B", point: { x: s.B.x + 9, y: s.B.y - 13 } });
  check("dragging B recomputes a and O", close(bMove.a, dist(bMove.A, bMove.B)) &&
    near(bMove.O, C.scale(bMove.A, bMove.B, bMove.r)));
  const dMove = C.move(s, { type: "point", which: "D", point: { x: s.D.x - 11, y: s.D.y + 7 } });
  check("dragging D recomputes b and P", close(dMove.b, dist(dMove.A, dMove.D)) &&
    near(dMove.P, C.scale(dMove.A, dMove.D, dMove.r)));

  const targetO = { x: s.A.x + 30, y: s.A.y + 70 };
  const oMove = C.move(s, { type: "point", which: "O", point: targetO });
  check("O is projected back onto AB",
    C.lineDeviation(oMove.O, oMove.A, oMove.B) < 1e-8);
  check("dragging O keeps the page's 0 < m < 1 range",
    oMove.r > 0 && oMove.r < 1 && close(oMove.r, dist(oMove.A, oMove.O) / oMove.a));
  const farO = C.move(s, { type: "point", which: "O", point: { x: 390, y: 5 } });
  check("O's m is clamped at the top of the range", farO.r === C.R_MAX);
  const nearA = C.scale(s.A, s.B, 0.01);
  const backO = C.move(s, { type: "point", which: "O", point: nearA });
  check("O's m is clamped at the bottom of the range", backO.r === C.R_MIN);

  const named = C.move(s, { type: "option", key: "showNames", value: true });
  const extra = C.move(named, { type: "option", key: "showExtra", value: true });
  check("the applet's two checkboxes toggle", named.showNames && !named.showExtra &&
    extra.showNames && extra.showExtra);
  check("an unknown option is refused", C.move(s, { type: "option", key: "n", value: 1 }) === null);
  check("a non-boolean option is refused", C.move(s, { type: "option", key: "showNames", value: 1 }) === null);

  const cleared = C.move(extra, { type: "clearTrace" });
  check("Clear trail empties both vectors", cleared.traceQ.length === 0 && cleared.traceP.length === 0);
  const reset = C.move(cleared, { type: "reset" });
  check("Reset restores the opening geometry", near(reset.A, s.A) &&
    near(reset.B, s.B) && near(reset.D, s.D) && close(reset.r, 0.4));
  check("unknown and malformed moves are refused",
    C.move(s, { type: "nonsense" }) === null && C.move(s, { type: "point", which: "X", point: s.A }) === null &&
    C.move(s, { type: "point", which: "B", point: { x: NaN, y: 1 } }) === null);
}

{
  // S slides on ComputeSS's perpendicular bisector; a legal slide resets c.
  const s = C.start({});
  const line = C.sLine(s.O, s.P);
  let moved = 0, refused = 0, maxSO = 0;
  for (let i = -20; i <= 20; i++) {
    const target = C.scale(line.a, line.b, i / 10);
    const next = C.move(s, { type: "point", which: "S", point: target });
    if (next.eligible) {
      moved++;
      maxSO = Math.max(maxSO, Math.abs(dist(next.S, next.O) - dist(next.S, next.P)));
      check(`S slide ${i} keeps SP = SO`, close(dist(next.S, next.O), next.c, 1e-8) &&
        close(dist(next.S, next.P), next.c, 1e-8));
    } else {
      refused++;
      check(`S slide ${i} is refused and restored`, near(next.S, C.computeS(s.O, s.P, s.c).S));
    }
  }
  check("some S slides are accepted", moved > 0, `${moved} accepted`);
  check("some S slides are refused by the 20-unit margin", refused > 0, `${refused} refused`);
  check("SP = SO after every accepted slide", maxSO < 1e-8);

  // ComputeS's own NaN/near-origin fallback, from the Java bytecode.
  const O = { x: 100, y: 100 }, P = { x: 140, y: 100 };
  check("GetS is undefined when c is shorter than half of OP",
    !Number.isFinite(appletGetS(O, P, 10).x) && !Number.isFinite(C.getS(O, P, 10).x));
  const fixed = C.computeS(O, P, 10);
  check("ComputeS retries with c increased by 20", fixed.c === 30 &&
    near(fixed.S, appletComputeS(O, P, 10).S, 1e-8));

  // The applet's exact drag eligibility inequalities.
  check("PIsEligible is BD < a+b-5", C.pEligible(s) ===
    (dist(s.B, s.D) < s.a + s.b - 5));
  check("SIsEligible is OP < SP+OS-20", C.sEligible(s, s.S) ===
    (dist(s.O, s.P) < dist(s.S, s.P) + dist(s.O, s.S) - 20));
}

done("hart-inversor");
