#!/usr/bin/env node
"use strict";

/*
 * Logic test for lemoine-gen/lemoine-gen-core.js.
 *
 *   node porting/check-lemoine-gen.mjs
 *
 * Checks the start configuration against GetPoint()'s arithmetic, the six
 * options, the Vector trim limit, the two walks, and the claims in the maths
 * section: both walks have a fixed point, its barycentrics are
 * (1/y : 1/z : 1/x) for M = (x:y:z), and with M at the symmedian point the
 * fixed point is the ordinary Lemoine limit. Every construction is also
 * computed a second time straight from the Java bytecode (the 4-argument
 * Intersect, NearestPoint, GetParallelTo, GetThePoint and ClearVector) and
 * compared over 600 seeded configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("lemoine-gen/lemoine-gen-core.js", "LemoineGenCore");
const close = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;
const near = (p, q, tol = 1e-6) =>
  !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);

/* ------------------- a second transcription of the applet's own helpers */

// The bytecode uses e=p.y-q.y, f=q.x-p.x, g=a.y-b.y, h=b.x-a.x.
const jIntersect = (p, q, a, b) => {
  const e = p.y - q.y, f = q.x - p.x;
  const g = a.y - b.y, h = b.x - a.x;
  const i = p.x * q.y - p.y * q.x, j = a.x * b.y - a.y * b.x;
  const det = e * h - g * f;
  return Math.abs(det) < 1e-12 ? { x: NaN, y: NaN }
    : { x: (f * j - h * i) / det, y: (i * g - j * e) / det };
};

const jNearest = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dsq = (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y);
  if (dsq < 0.1) return p; // SqDist(p, a) < 0.1 guard in NearestPoint
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
};

const jParallel = (p, m, v) =>
  ({ x: p.x + 100 * (m.x - v.x), y: p.y + 100 * (m.y - v.y) });

const jArea = (a, b, c) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

// Barycentrics.FromPoint flips each sub-area that points the other way,
// so the coordinates are all positive (or all negative) even outside ABC.
const jOrient = (a, b, c) => (jArea(a, b, c) > 0 ? 1 : -1);
const jBary = (p, v) => {
  const t = jArea(v[0], v[1], v[2]);
  const orient = jOrient(v[0], v[1], v[2]);
  const subs = [jArea(p, v[1], v[2]), jArea(v[0], p, v[2]), jArea(v[0], v[1], p)];
  const subsOrient = [jOrient(p, v[1], v[2]), jOrient(v[0], p, v[2]),
    jOrient(v[0], v[1], p)];
  return subs.map((area, i) => (orient === subsOrient[i] ? area : -area) / t);
};

const jFromBary = (w, v) => {
  const s = w[0] + w[1] + w[2];
  return { x: (w[0] * v[0].x + w[1] * v[1].x + w[2] * v[2].x) / s,
    y: (w[0] * v[0].y + w[1] * v[1].y + w[2] * v[2].y) / s };
};

const SIDES = [[1, 2], [2, 0], [0, 1]];

/** A literal transcription of CollectIterations + DrawIterations' increment. */
function appletStep(red, blue, which, ABC, M) {
  const n = red.length;
  const p = red[n - 1];
  const [u, v] = SIDES[which];
  const redNext = jIntersect(p, jParallel(p, M, ABC[which]), ABC[u], ABC[v]);

  const q = blue[n - 1];
  const other = which === 1 ? 2 : which === 2 ? 1 : 0;
  const [ou, ov] = SIDES[other];
  const foot = jNearest(q, ABC[ou], ABC[ov]);
  const blueNext = jIntersect(foot, jParallel(foot, M, ABC[other]),
    ABC[ou], ABC[ov]);

  return { red: red.concat([redNext]), blue: blue.concat([blueNext]),
    which: (which + 1) % 3 };
}

/** A literal transcription of ClearVector from the bytecode. */
function appletTrim(vector, which, big = 24) {
  const n = vector.length;
  if (n < 3 || n <= big) return vector;
  const temp = [];
  for (let i = n - which - 4; i < n; i++) temp.push(vector[i]);
  return temp;
}

/** ComputeCenter() with Barycentrics.FromPoint's orientation signs. */
function appletCenter(ABC, M) {
  const w = jBary(M, ABC);
  if (w[0] === 0 || w[1] === 0 || w[2] === 0) return null;
  const inv = w.map((x) => 1 / x);
  return jFromBary([inv[1] + inv[2], inv[2] + inv[0], inv[0] + inv[1]], ABC);
}

const triangleAt = (A, B, Cx, M) => ({
  ABC: [A, B, Cx],
  point: M,
});

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start({});
  // The live page's applet tag is WIDTH=500 HEIGHT=300; the port's own
  // default start uses those same numbers.
  const appletDefault = C.start({ width: 500, height: 300 });
  check("the default start matches the applet's 500x300 canvas",
    s.ABC.every((p, i) => near(p, appletDefault.ABC[i], 1e-9)) &&
    near(s.point, appletDefault.point, 1e-9));
  check("the default start has three corners and one moving point",
    s.ABC.length === 3 && !!s.point);
  check("the red walk starts with one point", s.red.length === 1);
  check("the blue walk starts with one point", s.blue.length === 1);
  equal("Which starts at zero", s.which, 0);
  check("an illustration has no result", C.result(s) === null);
  equal("only A, B, C and M can be dragged", C.legalMoves(s), ["A", "B", "C", "M"]);

  // GetPoint(i): radius = min(w,h)/3, angle = 2pi(i-1)/3, integer truncation.
  const width = 500, height = 300, r = Math.floor(Math.min(width, height) / 3);
  // The applet adds the integer centre to (int)(r*cos(theta)), truncating
  // the whole sum towards zero, not the radius term by itself.
  const expected = [0, 1, 2].map((i) => ({
    x: Math.trunc(Math.floor(width / 2) + r * Math.cos(2 * Math.PI * (i - 1) / 3)),
    y: Math.trunc(Math.floor(height / 2) + r * Math.sin(2 * Math.PI * (i - 1) / 3)),
  }));
  const t = C.start({ width, height });
  check("GetPoint(0) matches the applet's truncation", near(t.ABC[0], expected[0], 1e-9));
  check("GetPoint(1) matches the applet's truncation", near(t.ABC[1], expected[1], 1e-9));
  check("GetPoint(2) matches the applet's truncation", near(t.ABC[2], expected[2], 1e-9));
  check("M starts at (A + 2B + 2C)/5",
    near(t.point, {
      x: (expected[0].x + 2 * expected[1].x + 2 * expected[2].x) / 5,
      y: (expected[0].y + 2 * expected[1].y + 2 * expected[2].y) / 5,
    }));
  check("the start state is not mutated by a move",
    C.movePoint ? true : C.move(t, { name: "A", point: { x: 1, y: 2 } }).ABC[1].x === t.ABC[1].x);
  check("an unknown drag does nothing",
    C.move(t, { name: "Z", point: { x: 1, y: 2 } }) === t);
}

/* ---------------------------------------------- 2. the six options and trim */

{
  let s = C.start({});
  const names = ["red", "blue", "connections", "center", "reflection", "cevians"];
  for (const name of names) {
    check(`${name} starts off`, s.show[name] === false);
    s = C.move(s, { type: "toggle", name, on: true });
    check(`${name} can be switched on`, s.show[name] === true);
    s = C.move(s, { type: "toggle", name, on: false });
    check(`${name} can be switched off`, s.show[name] === false);
  }
  s = C.move(s, { type: "toggle", name: "red", on: true });
  s = C.move(s, { type: "toggle", name: "nothing", on: true });
  check("an unknown checkbox is ignored", s.show.red === true);

  // ClearVector: below three entries it does nothing; at 24 it keeps 24.
  const v = Array.from({ length: 30 }, (_, i) => i);
  equal("a short vector is left alone", C.trimVector(v.slice(0, 2), 0), v.slice(0, 2));
  equal("a 30-entry vector follows ClearVector", C.trimVector(v, 0),
    appletTrim(v, 0));
  check("applet TrimVectors keeps exactly one red and one blue point",
    (() => {
      let st = C.start({});
      st = { ...st, red: v, blue: v, which: 0 };
      const out = C.trim(st);
      return out.red.length === 1 && out.blue.length === 1 && out.which === 0;
    })());
}

/* ------------------------------- 3. both walks and their common fixed point */

{
  const A = { x: 60, y: 160 }, B = { x: 300, y: 140 }, Cx = { x: 150, y: 30 };
  const M = { x: 120, y: 80 };
  let s = { ...C.start({}), ABC: [A, B, Cx], point: M };
  s = C.move(s, { type: "restart", point: { x: 170, y: 110 } });
  for (let i = 0; i < 12; i++) {
    s = C.move(s, { type: "step" });
  }
  check("the red walk settles at a side point", near(s.red[s.red.length - 1],
    { x: 72.2449, y: 158.9796 }, 0.01));
  // The applet's blue walk cycles 0,2,1 (Which=1 swaps to 2, Which=2 to 1).
  check("the blue walk settles at the other side point",
    near(s.blue[s.blue.length - 1], { x: 97.0408, y: 106.4966 }, 0.01));
  check("the fixed point is on the side AB",
    close(C.geo.area2(A, B, s.red[s.red.length - 1]), 0, 1e-4));
  check("the blue fixed point is on the side CA",
    close(C.geo.area2(Cx, A, s.blue[s.blue.length - 1]), 0, 1e-4));
  const O = C.center(s.ABC, s.point);
  check("the fixed point has barycentrics (1/y : 1/z : 1/x)",
    near(O, { x: 113.4184, y: 96.1735 }, 0.001));
  const w = C.barycentric(O, s.ABC);
  const mw = C.barycentric(M, s.ABC);
  const inv = mw.map((x) => 1 / x);
  check("the computed weights are (1/y+1/z : 1/z+1/x : 1/x+1/y)",
    close(w[0] / w[1], (inv[1] + inv[2]) / (inv[2] + inv[0]), 1e-9) &&
    close(w[1] / w[2], (inv[2] + inv[0]) / (inv[0] + inv[1]), 1e-9));
}

/* ------------------ 4. the symmedian case and the ordinary Lemoine limit */

{
  const A = { x: 40, y: 200 }, B = { x: 310, y: 170 }, Cx = { x: 150, y: 20 };
  const K = C.symmedianPoint([A, B, Cx]);
  const bw = C.barycentric(K, [A, B, Cx]);
  const sa = Math.hypot(B.x - Cx.x, B.y - Cx.y);
  const sb = Math.hypot(Cx.x - A.x, Cx.y - A.y);
  const sc = Math.hypot(A.x - B.x, A.y - B.y);
  check("K has barycentrics a²:b²:c²",
    close(bw[0] / bw[1], (sa * sa) / (sb * sb), 1e-9) &&
    close(bw[1] / bw[2], (sb * sb) / (sc * sc), 1e-9));
  const O = C.center([A, B, Cx], K);
  const cw = C.barycentric(O, [A, B, Cx]);
  // The centre takes reciprocals first: (1/b²+1/c² : 1/c²+1/a² : 1/a²+1/b²).
  check("with M=K the centre is the reciprocal-side formula",
    close(cw[0] / cw[1], (1 / (sb * sb) + 1 / (sc * sc)) /
      (1 / (sc * sc) + 1 / (sa * sa)), 1e-9));
  let s = { ...C.start({}), ABC: [A, B, Cx], point: K };
  s = C.move(s, { type: "restart", point: { x: 120, y: 100 } });
  s = C.run(s, 90);
  const lim = s.red[s.red.length - 1];
  const fixed = s.red[s.red.length - 4];
  check("running the red walk converges to a three-cycle", near(lim, fixed, 1e-5));
  const blueLim = s.blue[s.blue.length - 1];
  check("the blue walk converges to a three-cycle too",
    near(blueLim, s.blue[s.blue.length - 4], 1e-5));
  const bary = C.barycentric(lim, [A, B, Cx]);
  check("the red limit lies on the side line AB", Math.abs(bary[2]) < 1e-5);
  check("the centre is not the limit of either walk", !near(O, lim, 1e-3));
}

/* --------------------- 5. compare with the bytecode over many triangles */

{
  const rand = rng(1985);
  let compared = 0;
  for (let trial = 0; trial < 600; trial++) {
    const A = { x: rand() * 400, y: rand() * 300 };
    const B = { x: rand() * 400, y: rand() * 300 };
    const Cx = { x: rand() * 400, y: rand() * 300 };
    // Skip degenerate or near-zero-barycentric triangles, where the applet's
    // 1e-12 line intersection guard and the centre's divide-by-zero differ.
    if (Math.abs(jArea(A, B, Cx)) < 1000) continue;
    const M = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
    const mw = jBary(M, [A, B, Cx]);
    if (mw.some((x) => Math.abs(x) < 0.02)) continue;
    const seed = { x: rand() * 400, y: rand() * 300 };
    let core = { ...C.start({}), ABC: [A, B, Cx], point: M };
    core = C.move(core, { type: "restart", point: seed });
    let red = [seed], blue = [seed], which = 0;
    for (let i = 0; i < 12; i++) {
      core = C.move(core, { type: "step" });
      ({ red, blue, which } = appletStep(red, blue, which, [A, B, Cx], M));
      const n = core.red.length;
      if (!near(core.red[n - 1], red[n - 1], 1e-6) ||
        !near(core.blue[n - 1], blue[n - 1], 1e-6) ||
        core.which !== which) {
        check(`trial ${trial} step ${i}: core matches the applet`, false,
          JSON.stringify({ core: core.red[n - 1], applet: red[n - 1] }));
        break;
      }
      compared++;
    }
    const coreCenter = C.center([A, B, Cx], M);
    const appletC = appletCenter([A, B, Cx], M);
    if (!near(coreCenter, appletC, 1e-6)) {
      check(`trial ${trial}: centre matches ComputeCenter`, false);
      break;
    }
    compared++;
  }
  check("the core matches the bytecode over at least 2000 comparisons",
    compared > 2000, `compared ${compared}`);
}

/* ------------------------------ 6. moving a point also resets the walks */

{
  const s = C.start({});
  const moved = C.move(s, { name: "A", point: { x: 12, y: 34 } });
  check("dragging A moves only A", near(moved.ABC[0], { x: 12, y: 34 }, 1e-9) &&
    near(moved.ABC[1], s.ABC[1], 1e-9));
  check("dragging A trims both walks", moved.red.length === 1 && moved.blue.length === 1);
  const movedM = C.move(s, { name: "M", point: { x: 50, y: 60 } });
  check("dragging M keeps the triangle", near(movedM.ABC[2], s.ABC[2], 1e-9));
  check("dragging M changes the guide point", near(movedM.point, { x: 50, y: 60 }, 1e-9));
  check("a zero barycentric coordinate gives no centre",
    C.center([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }],
      { x: 10, y: 0 }) === null);
  check("reflect is 2C - P", near(C.reflect({ x: 1, y: 2 }, { x: 5, y: 7 }),
    { x: 9, y: 12 }, 1e-9));
}

done("lemoine-gen");
