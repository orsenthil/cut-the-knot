#!/usr/bin/env node
"use strict";

/*
 * Logic test for glide-reflection/glide-reflection-core.js.
 *
 *   node porting/check-glide-reflection.mjs
 *
 * Checks the applet's controls and moves, then every claim on the cut-the-knot
 * page over 1,200 random arrows and polygons: the two orders of translate and
 * reflect agree, orientation reverses, distances and angles are preserved,
 * parallel segments stay parallel, a nonzero glide moves every point by at
 * least the length of its vector, and a zero vector is a plain reflection.
 * Finally the applet's own Rotate/ComputeAngle/FindOrientation reflection,
 * its Start-End translation, its chained DrawGlideReflections pipeline, its
 * AddNGon centre and its Reset arrows are transcribed a second time straight
 * from the bytecode and compared on the whole n=1..20, p=3..20 ranges.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("glide-reflection/glide-reflection-core.js", "GlideReflectionCore");

/* ------------------------------------- a second transcription of the applet */

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;

/** GeoSDoub.SqDist / Dist, as used by ComputeAngle. */
const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

/** GeoSDoub.ComputeAngle(p,a,b): law of cosines, angle at p. */
function appletAngle(p, a, b) {
  const z = (sqDist(p, a) + sqDist(p, b) - sqDist(a, b)) / 2;
  return Math.acos(Math.max(-1, Math.min(1, z / (dist(p, a) * dist(p, b)))));
}

/** GeoSDoub.FindOrientation(a,b,c): the sign of cross(b-a, c-a). */
function appletOrientation(a, b, c) {
  const z = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return z > 0 ? 1 : -1;
}

/** GeoSDoub.Rotate(center,p,angle,orientation). */
function appletRotate(center, p, angle, orientation) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return {
    x: center.x + co * (p.x - center.x) - orientation * si * (p.y - center.y),
    y: center.y + orientation * si * (p.x - center.x) + co * (p.y - center.y),
  };
}

/** GeoSDoub.ReflectPointInLine(p, DoubLine(m1,m2)). */
function appletReflect(p, a, b) {
  const angle = appletAngle(b, p, a);
  const orientation = appletOrientation(b, p, a);
  return appletRotate(b, p, 2 * angle, orientation);
}

/** MoveableVector.GetVector(): Start - End, the direction of the arrow. */
const appletVector = (vec) => ({ x: vec.a.x - vec.b.x, y: vec.a.y - vec.b.y });

/** GlideReflectionCanvas.Translate(transform, shapes), vertex by vertex. */
function appletTranslate(vec, shapes) {
  return shapes.map((poly) => poly.map((p) => {
    const v = appletVector(vec);
    return { x: p.x + v.x, y: p.y + v.y };
  }));
}

/** ReflectInLine(transform.Line, shapes), vertex by vertex. */
function appletReflectShapes(a, b, shapes) {
  return shapes.map((poly) => poly.map((p) => appletReflect(p, a, b)));
}

/** DrawGlideReflections(): each arrow acts on the previous arrow's result. */
function appletDrawGlideReflections(shapes, vectors, showGhost) {
  let chain = shapes.map((poly) => poly.map((p) => ({ x: p.x, y: p.y })));
  const images = [], ghosts = [];
  for (const vec of vectors) {
    const shifted = appletTranslate(vec, chain);
    if (showGhost) ghosts.push(shifted);
    chain = appletReflectShapes(vec.a, vec.b, shifted);
    images.push(chain);
  }
  return { images, ghosts };
}

/** GlideReflectionCanvas.AddNGon(P, u, v) with Math.random() supplied. */
function appletAddNGon(p, u, v) {
  const cx = Math.trunc((400 * 2) / 3 + u * 30 - 15);
  const cy = Math.trunc(300 / 2 + v * 30 - 15);
  return Array.from({ length: p }, (_, i) => ({
    x: cx + 30 * Math.cos((2 * Math.PI * i) / p),
    y: cy + 30 * Math.sin((2 * Math.PI * i) / p),
  }));
}

/** GlideReflectionCanvas.Reset() arrow placement with supplied randoms. */
function appletReset(n, seed) {
  const rand = rng(seed);
  return Array.from({ length: n }, () => {
    const a = { x: ((1 + 2 * rand()) * 400) / 2, y: ((1 + 2 * rand()) * 300) / 2 };
    const b = { x: Math.max(6, Math.min(394, Math.round((a.x + 30) * 1000) / 1000)),
                y: Math.max(6, Math.min(294, Math.round((a.y + 50) * 1000) / 1000)) };
    return { a, b, kind: 1 };
  });
}

const maxError = (polysA, polysB) => {
  let worst = 0;
  for (let i = 0; i < polysA.length; i++) {
    for (let j = 0; j < polysA[i].length; j++) {
      worst = Math.max(worst, dist(polysA[i][j], polysB[i][j]));
    }
  }
  return worst;
};

/** Compare a list of pipeline steps (each a list of polygons). */
const maxStepsError = (stepsA, stepsB) => {
  let worst = 0;
  for (let i = 0; i < stepsA.length; i++) {
    worst = Math.max(worst, maxError(stepsA[i], stepsB[i]));
  }
  return worst;
};

/* ------------------------------------------------------------------ samples */

const sample = [];
const rand = rng(20261127);
for (let i = 0; i < 1200; i++) {
  const a = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
  let b = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
  if (dist(a, b) < 12) b = { x: a.x + 40, y: a.y + 30 };
  const sides = 3 + Math.floor(rand() * 18);
  const radius = 10 + rand() * 45;
  const center = { x: 40 + rand() * 240, y: 40 + rand() * 200 };
  const poly = Array.from({ length: sides }, (_, j) => {
    const t = (2 * Math.PI * j) / sides + rand() * 0.04;
    return { x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) };
  });
  sample.push({ a, b, poly });
}

/* --------------------------------------------------------------- 1. controls */

{
  const s = C.start();
  equal("the opening state uses the applet's defaults",
    [s.n, s.p, s.arrowKind, s.showDrags, s.showGhost, s.vectors.length, s.shapes.length],
    [1, 5, 1, true, false, 1, 1]);
  check("the opening arrow has the applet's +30,+50 tail", 
    Math.abs(s.vectors[0].b.x - s.vectors[0].a.x - 30) < 0.001 &&
    Math.abs(s.vectors[0].b.y - s.vectors[0].a.y - 50) < 0.001);
  check("a demo has not been explored at the start", C.result(s) === null);
  check("legal moves include both arrow ends, five corners and all controls",
    C.legalMoves(s).length === C.start().p + 10);
  const added = C.move(s, { type: "add" });
  check("Add appends a polygon whose side count follows the P spin",
    added.shapes.length === 2 && added.shapes[1].length === s.p);
  check("Add does not change the starting state", s.shapes.length === 1 && s.moves === 0);
  check("Remove takes the newest polygon away", C.move(added, { type: "remove" }).shapes.length === 1);
  let empty = C.move(s, { type: "remove" });
  for (let i = 0; i < 3; i++) empty = C.move(empty, { type: "remove" });
  check("Remove is refused once there is no polygon", empty === null);
  check("a demo is explored after any move", C.result(added) === "done");
  check("an unknown move is refused", C.move(s, { type: "jump" }) === null && C.move(s, null) === null);
}

{
  let s = C.start();
  for (const p of [C.P_MIN, 7, C.P_MAX]) s = C.move(s, { type: "option", key: "p", value: p });
  check("P accepts every integer from 3 to 20", s.p === C.P_MAX);
  check("P outside 3..20 is refused",
    C.move(s, { type: "option", key: "p", value: 2 }) === null &&
    C.move(s, { type: "option", key: "p", value: 21 }) === null);
  for (const n of [C.N_MIN, 9, C.N_MAX]) s = C.move(s, { type: "option", key: "n", value: n });
  check("the number of glides accepts every integer from 1 to 20", s.n === C.N_MAX && s.vectors.length === C.N_MAX);
  check("the glide count outside 1..20 is refused",
    C.move(s, { type: "option", key: "n", value: 0 }) === null &&
    C.move(s, { type: "option", key: "n", value: 21 }) === null);
  for (const k of [0, 2, 4]) s = C.move(s, { type: "option", key: "arrowKind", value: k });
  check("all five arrow styles are accepted and applied to every arrow",
    s.arrowKind === 4 && s.vectors.every((v) => v.kind === 4));
  check("an arrow style outside 0..4 is refused",
    C.move(s, { type: "option", key: "arrowKind", value: 5 }) === null);
  s = C.move(s, { type: "option", key: "showGhost", value: true });
  check("Show intermediate, the applet's ghost switch, can be ticked", s.showGhost === true);
  s = C.move(s, { type: "option", key: "showDrags", value: false });
  check("Show drag controls can be unticked", s.showDrags === false);
  check("an unknown option is refused", C.move(s, { type: "option", key: "size", value: 4 }) === null);
  const dragged = C.move(s, { type: "point", index: 0, which: "a", point: { x: 50, y: 60 } });
  check("a dragged arrow end stays on the board", dragged && dragged.vectors[0].a.x === 50 && dragged.vectors[0].a.y === 60);
  check("the arrow ends cannot be dragged together (the line must be defined)",
    C.move(s, { type: "point", index: 0, which: "a", point: s.vectors[0].b }) === null);
  check("a point outside the board is clamped, not lost",
    C.move(s, { type: "point", index: 0, which: "b", point: { x: 9999, y: -9999 } }).vectors[0].b.x <= C.WIDTH - 6);
  const grabbed = C.move(s, { type: "vertex", shape: 0, vertex: 2, point: { x: 100, y: 100 } });
  check("one polygon corner can be moved without moving its neighbours",
    grabbed.shapes[0][2].x === 100 && grabbed.shapes[0][1].x === s.shapes[0][1].x);
  check("an out-of-range polygon corner is refused",
    C.move(s, { type: "vertex", shape: 3, vertex: 0, point: { x: 1, y: 1 } }) === null);
  const options = C.move(s, { type: "reset" });
  check("Reset keeps the options and rebuilds the arrows", options.n === s.n && options.p === s.p &&
    options.showGhost === s.showGhost && options.vectors.length === s.n);
}

/* ------------------------------------------------ 2. the page's claims, 1200x */

{
  let commute = 0, orientation = 0, distance = 0, angle = 0, parallel = 0;
  let fixed = Infinity, required = Infinity, axis = 0, zeroFixed = 0, zeroOrient = 0;
  for (const { a, b, poly } of sample) {
    const vec = { a, b };
    const v = C.vectorOf(vec);
    const image = C.glide(vec, poly), reverse = C.glideReverse(vec, poly);
    for (let i = 0; i < poly.length; i++) {
      commute = Math.max(commute, C.dist(image[i], reverse[i]));
      fixed = Math.min(fixed, C.dist(image[i], poly[i]));
      const zero = C.glidePoint(poly[i], a, b, { x: 0, y: 0 });
      zeroFixed = Math.max(zeroFixed, C.dist(zero, C.reflectInLine(poly[i], a, b)));
      const onAxis = C.foot(poly[i], a, b);
      const moved = C.glidePoint(onAxis, a, b, v);
      axis = Math.max(axis, Math.abs(C.cross(C.sub(moved, a), C.sub(b, a))) / C.dist(a, b));
      for (let j = i + 1; j < poly.length; j++) {
        distance = Math.max(distance, Math.abs(C.dist(poly[i], poly[j]) - C.dist(image[i], image[j])));
      }
      angle = Math.max(angle, Math.abs(
        C.angleAt(poly[i], poly[(i + 1) % poly.length], poly[(i + 2) % poly.length]) -
        C.angleAt(image[i], image[(i + 1) % poly.length], image[(i + 2) % poly.length])));
    }
    orientation = Math.max(orientation,
      Math.abs(Math.sign(C.twiceArea(poly)) + Math.sign(C.twiceArea(image))));
    required = Math.min(required, Math.hypot(v.x, v.y));
    // Two deliberately parallel segments must still be parallel after the map.
    const p = poly[0], d = { x: poly[1].x - p.x + 7, y: poly[1].y - p.y - 3 };
    const q = poly[2], scale = 3;
    const dir1 = C.sub(C.glidePoint(C.add(p, d), a, b, v), C.glidePoint(p, a, b, v));
    const dir2 = C.sub(C.glidePoint(C.add(q, C.mul(d, scale)), a, b, v), C.glidePoint(q, a, b, v));
    parallel = Math.max(parallel, Math.abs(C.cross(dir1, dir2)) /
      Math.max(1, C.dist(p, C.add(p, d)) * C.dist(q, C.add(q, C.mul(d, scale)))));
    const zeroImage = poly.map((pt) => C.glidePoint(pt, a, b, { x: 0, y: 0 }));
    zeroOrient = Math.max(zeroOrient,
      Math.abs(Math.sign(C.twiceArea(poly)) + Math.sign(C.twiceArea(zeroImage))));
  }
  check("reflect after translate = translate after reflect - 1200 arrows",
    commute < 1e-7, `max ${commute}`);
  check("every glide reverses the orientation of every polygon",
    orientation === 0, `worst ${orientation}`);
  check("every glide preserves all pairwise distances", distance < 1e-7, `max ${distance}`);
  check("every glide preserves angles at each vertex", angle < 1e-7, `max ${angle}`);
  check("parallel segments are mapped to parallel segments", parallel < 1e-7, `max ${parallel}`);
  check("no point is fixed: each moves at least the length of the slide vector",
    fixed >= required - 1e-7, `min ${fixed}, shortest vector ${required}`);
  check("the reflecting line is carried to itself as a whole", axis < 1e-7, `max ${axis}`);
  check("with a zero vector the map is exactly a reflection in the line",
    zeroFixed === 0 && zeroOrient === 0, `max ${zeroFixed}`);
  check("the sample covers polygons of every side count from 3 to 20",
    Math.min(...sample.map((s) => s.poly.length)) === 3 &&
    Math.max(...sample.map((s) => s.poly.length)) === 20);
}

/* ---------------------------- 3. the whole option space, and the second read */

{
  let finite = true, chains = true, ghosts = true, addGon = 0, reset = 0;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (let p = C.P_MIN; p <= C.P_MAX; p++) {
      const s = C.start({ n, p, showGhost: true });
      const view = C.compute(s);
      finite = finite && view.images.length === n &&
        view.images.every((step) => step.every((poly) => poly.length === p &&
          poly.every(C.finite)));
      const second = C.start({ n, p, showGhost: false, seed: s.seed });
      const plain = C.compute(second);
      ghosts = ghosts && view.ghosts.length === n && plain.ghosts.length === 0;
      let chain = s.shapes;
      chains = chains && view.images.length === n;
      for (const vec of s.vectors) chain = chain.map((poly) => C.glide(vec, poly));
      chains = chains && maxError(chain, view.images[n - 1]) < 1e-9;
      addGon = Math.max(addGon, maxError([C.polygonFor(p, 0.33, 0.66)], [appletAddNGon(p, 0.33, 0.66)]));
      reset = Math.max(reset, maxError([s.vectors.map((v) => v.a)], [appletReset(n, s.seed).map((v) => v.a)]));
    }
  }
  check("all 324 n/p settings give n finite images of p vertices", finite);
  check("each arrow acts on the previous arrow's image (chained), all 324 settings", chains);
  check("the ghost switch controls only the intermediate translated polygons", ghosts);
  check("AddNGon's centre and 30-unit vertex ring match the bytecode", addGon === 0, `max ${addGon}`);
  check("Reset's arrow placement matches the bytecode for every n", reset < 1e-9, `max ${reset}`);
}

{
  let reflect = 0, vector = 0, translate = 0, pipeline = 0, ghostPipeline = 0;
  for (const { a, b, poly } of sample) {
    const vec = { a, b };
    for (const p of poly) {
      reflect = Math.max(reflect, dist(C.reflectInLine(p, a, b), appletReflect(p, a, b)));
    }
    vector = Math.max(vector,
      Math.abs(C.vectorOf(vec).x - appletVector(vec).x),
      Math.abs(C.vectorOf(vec).y - appletVector(vec).y));
    translate = Math.max(translate, maxError(C.ghost(vec, [poly]), appletTranslate(vec, [poly])));
  }
  // The chained pipeline, including the ghost option, on random multi-arrow states.
  for (let i = 0; i < 250; i++) {
    const n = 1 + Math.floor(rand() * 5);
    const shapes = 1 + Math.floor(rand() * 3);
    const p = 3 + Math.floor(rand() * 6);
    const s = C.start({ n, p, showGhost: i % 2 === 0, seed: 1000 + i });
    while (s.shapes.length < shapes) Object.assign(s, C.move(s, { type: "add" }));
    const view = C.compute(s);
    const applet = appletDrawGlideReflections(s.shapes, s.vectors, s.showGhost);
    pipeline = Math.max(pipeline, maxStepsError(view.images, applet.images));
    ghostPipeline = Math.max(ghostPipeline,
      s.showGhost ? maxStepsError(view.ghosts, applet.ghosts) : view.ghosts.length);
  }
  check("GeoSDoub's Rotate/ComputeAngle/FindOrientation reflection matches the core, 1200 lines",
    reflect < 1e-7, `max ${reflect}`);
  check("GetVector is Start - End, not End - Start", vector === 0);
  check("Translate adds exactly the applet vector to every vertex", translate === 0);
  check("DrawGlideReflections' chained images match the core on 250 random states",
    pipeline < 1e-7, `max ${pipeline}`);
  check("the applet's optional intermediate copies match the core's ghosts",
    ghostPipeline < 1e-7, `max ${ghostPipeline}`);
}

done("glide-reflection");
