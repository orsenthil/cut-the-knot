#!/usr/bin/env node
"use strict";

/*
 * Logic test for building-bridge/building-bridge-core.js.
 *
 *   node porting/check-building-bridge.mjs
 *
 * Checked: the starting towns and bridge point against a line-by-line reading of
 * BuildingBridgeCanvas.init (including DoubLine.CreateMidPoint); the reflected
 * drag rules from mouseDragged/mouseReleased; and the exact claim on the page —
 * AC + C'B is least where AB' crosses the near bank, C B' = C' B, the two
 * translations give the same bridge, and the triangle inequality is tight there.
 * Those claims are tested on fixed diagrams and on 400 seeded configurations,
 * with many dragged C positions each. The KU/KL computation is compared with a
 * second, literal transcription of GeoSDoub.Intersect and ComputePoints over
 * every configuration: ax+by+c=0 determinants with the applet's |det| < 1 test.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("building-bridge/building-bridge-core.js", "BuildingBridgeCore");
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);

/* --------------------------- the applet's own methods, transcribed from javap */

/* BuildingBridgeCanvas.init: A, B, H, the two banks and C = CreateMidPoint(). */
function appletStart(width, height, random) {
  const mid = height / 2;
  const H = Math.floor(height / 15); // Java `int H = height / 15`
  const k = Math.floor((mid * (random + 1)) / 8); // Java (int) cast, positive
  const yU = mid - H, yL = mid + H;
  // DoubLine.CreateMidPoint() with t = 0.75 on (10,yU) and (width-10,yU).
  const t = 0.75;
  return {
    width, height, H, yU, yL,
    A: { x: width / 4, y: mid - k },
    B: { x: (3 * width) / 4, y: mid + k },
    C: { x: 10 * t + (width - 10) * (1 - t), y: yU },
  };
}

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), straight from the
 * four-point bytecode: a1,b1,c1 / a2,b2,c2, determinant, and |det| < 1 -> NaN. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const nx = b1 * c2 - b2 * c1;
  const ny = c1 * a2 - c2 * a1;
  const det = a1 * b2 - a2 * b1;
  return Math.abs(det) < 1
    ? { x: NaN, y: NaN }
    : { x: nx / det, y: ny / det };
}

/* BuildingBridgeCanvas.ComputePoints + CheckFinished + Draw's C' point. */
function appletCompute(s) {
  const R = 2 * s.H;
  const BB = { x: s.B.x, y: s.B.y - R };
  const AA = { x: s.A.x, y: s.A.y + R };
  const upper1 = { x: 10, y: s.yU }, upper2 = { x: s.width - 10, y: s.yU };
  const lower1 = { x: 10, y: s.yL }, lower2 = { x: s.width - 10, y: s.yL };
  const KU = appletIntersect(s.A, BB, upper1, upper2);
  const KL = appletIntersect(s.B, AA, lower1, lower2);
  const Cp = { x: s.C.x, y: s.C.y + R };
  return { BB, AA, KU, KL, Cp, finished: dist(s.C, KU) < 1 };
}

/* The reflection in mouseDragged/mouseReleased: center = height/2, H = height/15. */
function appletDrag(s, name, p) {
  const next = {
    width: s.width, height: s.height, H: s.H, yU: s.yU, yL: s.yL,
    A: { ...s.A }, B: { ...s.B }, C: { ...s.C },
  };
  const center = s.height / 2;
  if (name === "A") {
    next.A = { x: p.x, y: p.y > center - s.H ? 2 * (center - s.H) - p.y : p.y };
  } else if (name === "B") {
    next.B = { x: p.x, y: p.y < center + s.H ? 2 * (center + s.H) - p.y : p.y };
  } else if (name === "C") {
    next.C = { x: p.x, y: center - s.H };
  }
  return next;
}

/* ------------------------------------------- 1. the start against init() */

{
  for (const [w, h, r] of [[400, 300, 0.5], [600, 500, 0.5], [320, 240, 0.1],
    [500, 360, 0.9], [480, 420, 0.33]]) {
    const s = C.start({ width: w, height: h, random: r });
    equal(`start matches applet init at ${w}x${h}, r=${r}`, s, appletStart(w, h, r));
  }
  const s = C.start({});
  check("fresh diagram has no outcome", C.result(s) === null);
  check("near town is above the upper bank", s.A.y < s.yU);
  check("far town is below the lower bank", s.B.y > s.yL);
  check("bridge point starts on the upper bank", s.C.y === s.yU);
  check("river width is twice H", C.riverWidth(s) === 2 * s.H);
  check("withPoint returns a new position", (() => {
    const n = C.withPoint(s, "C", { x: 5, y: s.yU });
    return n !== s && s.C.x === 105 && n.C.x === 5;
  })());
  check("an unknown handle leaves the diagram alone", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === s.A.x);
}

/* --------------------------------- 2. fixed configurations and their claims */

const base = C.start({});
const narrow0 = { ...base, H: 6, yU: base.height / 2 - 6, yL: base.height / 2 + 6 };
const narrow = { ...narrow0, C: { x: narrow0.C.x, y: narrow0.yU } };
const farApart = C.withPoint(C.withPoint(base, "A", { x: 40, y: 80 }), "B", { x: 360, y: 220 });
const aligned = C.withPoint(C.withPoint(base, "A", { x: 190, y: 80 }), "B", { x: 210, y: 220 });
const fixed = [
  ["default", base],
  ["applet's archived size", C.start({ width: 600, height: 500 })],
  ["narrow river", narrow],
  ["towns far apart", farApart],
  ["towns nearly aligned", aligned],
];

for (const [name, s0] of fixed) {
  const s = C.start({ position: s0 });
  const cl = C.claims(s);
  check(`${name}: bridge perpendicular and on the far bank`, cl.bridgePerpendicular);
  check(`${name}: CB' = C'B`, cl.equalLand);
  check(`${name}: AC + CB' >= AB'`, cl.triangleInequality);
  check(`${name}: AB' crossing is the shortest route`, cl.shortestAtCrossing);
  check(`${name}: translating A or B gives the same bridge`, cl.twoTranslations);
  check(`${name}: the eyes open only at the crossing`, cl.finishedAtCrossing);
  check(`${name}: every claim holds at once`, Object.values(cl).every(Boolean));
}

/* -------------------- 3. every claim over 400 seeded configurations */

{
  const rand = rng(2862);
  let tested = 0, degenerate = 0;
  const failures = [];
  for (let trial = 0; trial < 400; trial++) {
    const width = 280 + Math.floor(rand() * 340);
    const height = 240 + Math.floor(rand() * 280);
    const s0 = C.start({ width, height, random: rand() });
    const cx = 12 + rand() * (width - 24);
    const s = C.withPoint(s0, "C", { x: cx, y: s0.yU });
    const b = C.best(s);
    const t = C.translated(s);
    const ref = appletCompute(s);
    const scale = Math.max(width, height);
    const tol = 1e-7 * scale;
    // A very small random offset lands both towns exactly on the banks; the
    // applet's Intersect returns NaN there, so there is no crossing to test.
    if (!Number.isFinite(ref.KU.x)) { degenerate++; continue; }
    if (!closePoint(b.KU, ref.KU, tol) || !closePoint(b.KL, ref.KL, tol)) {
      failures.push(`trial ${trial}: KU/KL differ from applet Intersect`);
    }
    if (!closePoint(t.Bprime, ref.BB, tol) || !closePoint(t.Aprime, ref.AA, tol)) {
      failures.push(`trial ${trial}: translated towns differ from applet`);
    }
    if (!closePoint(C.bridgeMate(s, s.C), ref.Cp, tol)) {
      failures.push(`trial ${trial}: C' differs from applet`);
    }
    if (C.atBest(s) !== ref.finished) failures.push(`trial ${trial}: finish test differs`);
    const cl = C.claims(s);
    if (!Object.values(cl).every(Boolean)) failures.push(`trial ${trial}: ${JSON.stringify(cl)}`);
    if (!close(C.roadLength(s, b.KU), C.minRoad(s), tol)) {
      failures.push(`trial ${trial}: minimum is not |AB'| + width`);
    }
    // The triangle inequality and translation identity at many dragged C's.
    for (let i = 0; i < 6; i++) {
      const q = C.withPoint(s, "C", { x: 12 + rand() * (width - 24), y: s.yU });
      const qp = C.bridgeMate(s, q.C);
      const land1 = dist(s.A, q.C) + dist(q.C, t.Bprime);
      if (land1 < dist(s.A, t.Bprime) - tol) failures.push(`trial ${trial}: triangle inequality broke`);
      if (!close(dist(q.C, t.Bprime), dist(qp, s.B), tol)) failures.push(`trial ${trial}: CB' != C'B`);
      if (C.roadLength(s, q.C) < C.roadLength(s, b.KU) - tol) {
        failures.push(`trial ${trial}: a dragged C beat the crossing`);
      }
    }
    tested++;
  }
  check(`all claims and the applet's computation agree on ${tested} configurations (${degenerate} degenerate skipped)`,
    failures.length === 0 && tested > 350, failures.slice(0, 5).join("; "));
}

/* ------------------------------- 4. the drag rules against mouseDragged() */

{
  const rand = rng(771);
  const s = C.start({});
  const mismatches = [];
  for (let i = 0; i < 300; i++) {
    const p = { x: rand() * s.width, y: rand() * s.height };
    for (const name of ["A", "B", "C"]) {
      const mine = C.withPoint(s, name, p);
      const theirs = appletDrag(s, name, p);
      if (!closePoint(mine[name], theirs[name], 0)) mismatches.push(`${name} at ${JSON.stringify(p)}`);
    }
  }
  check("300 drags of A, B and C match the applet's reflection exactly",
    mismatches.length === 0, mismatches.slice(0, 3).join("; "));
  check("a town dragged into the river is mirrored out", (() => {
    const s2 = C.start({});
    return C.withPoint(s2, "A", { x: 100, y: s2.yU + 12 }).A.y === s2.yU - 12 &&
      C.withPoint(s2, "B", { x: 300, y: s2.yL - 12 }).B.y === s2.yL + 12;
  })());
  check("the bridge point stays on the near bank", (() => {
    const s2 = C.start({});
    return C.withPoint(s2, "C", { x: 77, y: 999 }).C.y === s2.yU;
  })());
}

/* ------------------------------------- 5. degenerate input is safe and false */

{
  const s = C.start({});
  const flat = C.withPoint(C.withPoint(s, "A", { x: 100, y: s.yU }), "B", { x: 300, y: s.yL });
  check("a town exactly on each bank gives a horizontal A-B'",
    C.translated(flat).Bprime.y === flat.yU);
  check("no claim passes when the two lines coincide", !Object.values(C.claims(flat)).some(Boolean));
  check("no crossing is reported as a point", !Number.isFinite(C.best(flat).KU.x));
  check("an illustration is never won or lost", C.result(flat) === null);
}

done("building-bridge");
