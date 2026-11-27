#!/usr/bin/env node
"use strict";

/*
 * Logic test for equi-tri-on-para/equi-tri-on-para-core.js.
 *
 *   node porting/check-equi-tri-on-para.mjs
 *
 * 1. A second, literal transcription of the applet's bytecode:
 *    GeoSDoub.Rotate, EquiTriOnParaCanvas.init (including its integer
 *    divisions), Draw()'s two rounds of apexes, UpkeepParallelogram and the
 *    four branches of mouseDragged. Compared with the core over grids and
 *    random shapes.
 * 2. The page's three claims, checked independently with complex numbers and
 *    with side-vector tests on every generated parallelogram: XYZW is a
 *    parallelogram, PQRS is a parallelogram, and PQRS coincides with ABCD
 *    (P=D, Q=A, R=B, S=C). Also checks that both rounds really are
 *    equilateral, with opposite orientation in the second round.
 * 3. The options, the reset, the status text, and degenerate or crossed
 *    parallelograms. The archived page is the source of the claim; the live
 *    page now embeds GeoGebra.
 */

import { readFileSync } from "node:fs";
import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equi-tri-on-para/equi-tri-on-para-core.js", "EquiTriOnParaCore");

const P = (x, y) => ({ x: x, y: y });
const add = (p, q) => P(p.x + q.x, p.y + q.y);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const scale = (pts) => Math.max(1, ...pts.map((p) => Math.hypot(p.x, p.y)));
const close = (a, b, s) => Math.abs(a - b) <= 1e-8 * s;
const closePt = (p, q, s) => close(p.x, q.x, s) && close(p.y, q.y, s);

/* -------------------------------------- 1. the applet, transcribed a second time */

/* GeoSDoub.Rotate(a,b,angle,dir), opcode by opcode. */
function apRotate(a, b, angle, dir) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const x = a.x + cos * (b.x - a.x) - dir * sin * (b.y - a.y);
  const y = a.y + dir * sin * (b.x - a.x) + cos * (b.y - a.y);
  return P(x, y);
}

/* EquiTriOnParaCanvas.init(), keeping Java's integer division for the corners. */
function apInit(W = 480, H = 340) {
  const hw = Math.trunc(W / 2) | 0, hh = Math.trunc(H / 2) | 0;
  const wy = H / 2, wx = W / 2;
  return {
    A: P((hw / 2 | 0) + wx / 6, hh + wy / 3),
    B: P((hw / 2 | 0) + (wx * 15) / 36, hh - wy / 3),
    C: P((hw / 2 | 0) + (wx * 15) / 16, Math.trunc((hh * 9) / 10)),
    D: P(0, 0),
  };
}

/* UpkeepParallelogram(target, p, q, r): target = r + p - q. */
function apUpkeep(target, p, q, r) {
  target.x = r.x + p.x - q.x;
  target.y = r.y + p.y - q.y;
  return target;
}

/* Draw(): first round with dir=-1, second round with dir=+1, both pi/3. */
function apDraw(pts) {
  const t = 1.0471975511965976;
  const X = apRotate(pts.A, pts.B, t, -1);
  const Y = apRotate(pts.B, pts.C, t, -1);
  const Z = apRotate(pts.C, pts.D, t, -1);
  const W = apRotate(pts.D, pts.A, t, -1);
  return {
    X: X, Y: Y, Z: Z, W: W,
    P: apRotate(X, Y, t, 1),
    Q: apRotate(Y, Z, t, 1),
    R: apRotate(Z, W, t, 1),
    S: apRotate(W, X, t, 1),
  };
}

/* The four explicit mouseDragged branches, with Java's identity checks. */
function apDrag(pts, name, p) {
  const next = {};
  for (const k of ["A", "B", "C", "D"]) next[k] = P(pts[k].x, pts[k].y);
  next[name] = P(p.x, p.y);
  if (name === "A") apUpkeep(next.D, next.A, next.B, next.C);
  else if (name === "B") apUpkeep(next.A, next.B, next.C, next.D);
  else if (name === "C") apUpkeep(next.B, next.C, next.D, next.A);
  else if (name === "D") apUpkeep(next.C, next.D, next.A, next.B);
  return next;
}

/* --------------------------------- 2. the page's complex-number calculation */

/* The page writes c = (1 + i√3)/2 in mathematical coordinates. On the Java
 * canvas y grows down, the Java sign conventions make the printed formulas
 * apply directly to its point coordinates. Test both identities it prints. */
const re = 0.5, im = Math.sqrt(3) / 2;
const c = { re: re, im: im }, oneMinusC = { re: re, im: -im };
const cmul = (u, v) => ({ re: u.re * v.re - u.im * v.im, im: u.re * v.im + u.im * v.re });
const cadd = (u, v) => ({ re: u.re + v.re, im: u.im + v.im });
const z = (p) => ({ re: p.x, im: p.y });
const xy = (q) => P(q.re, q.im);

function pageApexes(pts) {
  const A = z(pts.A), B = z(pts.B), Cc = z(pts.C), D = z(pts.D);
  /* Formula (1): X = cA + (1−c)B. The second round reverses the roles:
   * P = (1−c)X + cY, which is the opposite turn. */
  const first = (u, v) => cadd(cmul(c, u), cmul(oneMinusC, v));
  const second = (u, v) => cadd(cmul(oneMinusC, u), cmul(c, v));
  const X = first(A, B), Y = first(B, Cc), Z = first(Cc, D), W = first(D, A);
  return {
    X: xy(X), Y: xy(Y), Z: xy(Z), W: xy(W),
    P: xy(second(X, Y)), Q: xy(second(Y, Z)),
    R: xy(second(Z, W)), S: xy(second(W, X)),
  };
}

/* Formula (2) on the page: P = ((1-c)^2 + c^2)B + c(1-c)A + c(1-c)C. */
function pageP(pts) {
  const c2 = cmul(c, c), d2 = cmul(oneMinusC, oneMinusC), cd = cmul(c, oneMinusC);
  return xy(cadd(cadd(cmul(cadd(d2, c2), z(pts.B)),
    cmul(cd, z(pts.A))), cmul(cd, z(pts.C))));
}

/* ------------------------------------------------------ generated positions */

const shapes = [];
const seed = rng(20261127);
for (const bx of [-140, -45, 30, 115, 205]) {
  for (const dx of [-100, 15, 135]) {
    for (const dy of [-150, -35, 65, 175]) {
      shapes.push({ A: P(0, 0), B: P(bx, 0), C: P(bx + dx, dy), D: P(dx, dy) });
    }
  }
}
/* Crossed, flat, tiny, huge and translated cases, then reproducible random ones. */
shapes.push(
  { A: P(10, 10), B: P(300, 300), C: P(60, 300), D: P(-230, 10) },
  { A: P(20, 20), B: P(220, 20), C: P(220, 20), D: P(20, 20) },
  { A: P(100, 100), B: P(100.001, 100), C: P(100.001, 100.001), D: P(100, 100.001) },
  { A: P(-900, 700), B: P(400, -600), C: P(1100, 50), D: P(-200, 1350) },
  { A: P(123, -77), B: P(444, 333), C: P(321, 555), D: P(0, 145) },
);
for (let i = 0; i < 300; i++) {
  const A = P(seed() * 800 - 400, seed() * 700 - 350);
  const B = P(seed() * 500 - 250, seed() * 500 - 250);
  const D = P(seed() * 500 - 250, seed() * 500 - 250);
  shapes.push({ A: A, B: B, C: add(B, D), D: add(A, sub(D, B)) });
}
/* The last entry above stores D as A+D-B so that A+C = B+D exactly. */
for (const q of shapes) q.C = add(q.B, sub(q.D, q.A));

/* ------------------------------------------------------------ 3. the checks */

/* Starting position against the applet's own init(), over the canvas sizes. */
{
  let ok = true;
  for (const W of [300, 380, 480, 500, 640, 777]) {
    for (const H of [250, 340, 500, 601]) {
      const want = apInit(W, H);
      want.D = add(want.C, sub(want.A, want.B));
      const got = C.startPositions(W, H);
      ok = ok && ["A", "B", "C", "D"].every((k) => closePt(got[k], want[k], 1));
    }
  }
  check("init() corners agree with the bytecode at 24 canvas sizes", ok);
  const s = C.start({});
  const want = apInit(480, 480);
  want.D = add(want.C, sub(want.A, want.B));
  check("the page's opening diagram is the applet's", ["A", "B", "C", "D"]
    .every((k) => closePt(s[k], want[k], 1)));
}

/* GeoSDoub.Rotate against the core over angles, both directions and 30 points. */
{
  let ok = true;
  const directions = [-1, 1];
  const angles = [-1.0471975511965976, 0, 1.0471975511965976, 2.7];
  for (const a of angles) {
    for (const dir of directions) {
      for (let i = 0; i < 30; i++) {
        const center = P(seed() * 1000 - 500, seed() * 1000 - 500);
        const p = P(seed() * 1000 - 500, seed() * 1000 - 500);
        ok = ok && closePt(C.rotate(center, p, a, dir), apRotate(center, p, a, dir), 1);
      }
    }
  }
  check("GeoSDoub.Rotate matches the core in 240 cases", ok);
}

/* Both rounds of apexes against Draw(), for every generated parallelogram. */
{
  let first = true, second = true;
  for (const q of shapes) {
    const want = apDraw(q);
    const got = C.geometry(q);
    first = first && ["X", "Y", "Z", "W"].every((k) => closePt(got[k], want[k], scale([q.A, q.B, q.C, q.D])));
    second = second && ["P", "Q", "R", "S"].every((k) => closePt(got[k], want[k], scale([q.A, q.B, q.C, q.D])));
  }
  check(`first equilateral tips match Draw() in ${shapes.length} shapes`, first);
  check(`second equilateral tips match Draw() in ${shapes.length} shapes`, second);
}

/* The page's three claims, checked with complex numbers, not with Draw(). */
{
  let middle = true, last = true, coincide = true, equilateral = true, turning = true;
  for (const q of shapes) {
    const s = scale([q.A, q.B, q.C, q.D]);
    const page = pageApexes(q);
    const g = C.geometry(q);
    middle = middle && ["X", "Y", "Z", "W"].every((k) => closePt(g[k], page[k], s));
    last = last && ["P", "Q", "R", "S"].every((k) => closePt(g[k], page[k], s));
    /* XYZW and PQRS satisfy p+r = q+s. */
    middle = middle && closePt(add(page.X, page.Z), add(page.Y, page.W), s);
    last = last && closePt(add(page.P, page.R), add(page.Q, page.S), s);
    /* P=D, Q=A, R=B, S=C, independently of the core's rotate(). */
    coincide = coincide && closePt(page.P, q.D, s) && closePt(page.Q, q.A, s)
      && closePt(page.R, q.B, s) && closePt(page.S, q.C, s);
    coincide = coincide && g.coincide;
    const sides1 = [["A", "B", "X"], ["B", "C", "Y"], ["C", "D", "Z"], ["D", "A", "W"]];
    const sides2 = [["X", "Y", "P"], ["Y", "Z", "Q"], ["Z", "W", "R"], ["W", "X", "S"]];
    const at = (key) => q[key] || page[key];
    for (const [u, v, apex] of sides1.concat(sides2)) {
      const len = dist(at(u), at(v));
      equilateral = equilateral && close(dist(at(u), at(apex)), len, s)
        && close(dist(at(v), at(apex)), len, s);
    }
    /* First round one way, second round the other: signed areas differ.
     * Flat sides have no sign, so they are ignored here. */
    const oppositeTurn = (u, v, w, x, y, z) => {
      const a = cross(u, v, w), b = cross(x, y, z);
      const tiny = 1e-7 * s;
      return Math.abs(a) <= tiny || Math.abs(b) <= tiny || a * b < 0;
    };
    turning = turning && oppositeTurn(q.A, q.B, page.X, page.X, page.Y, page.P)
      && oppositeTurn(q.B, q.C, page.Y, page.Y, page.Z, page.Q)
      && oppositeTurn(q.C, q.D, page.Z, page.Z, page.W, page.R)
      && oppositeTurn(q.D, q.A, page.W, page.W, page.X, page.S);
  }
  check(`XYZW is a parallelogram in all ${shapes.length} cases`, middle);
  check(`PQRS is a parallelogram in all ${shapes.length} cases`, last);
  check(`PQRS coincides with ABCD (P=D, Q=A, R=B, S=C) in all ${shapes.length} cases`, coincide);
  check(`all eight constructed triangles are equilateral in ${shapes.length} cases`, equilateral);
  check(`the second round turns the opposite way in ${shapes.length} cases`, turning);
}

/* The printed identities and formula (2) on the page. */
{
  const sum = cadd(cmul(c, c), cmul(oneMinusC, oneMinusC));
  check("c² + (1−c)² = −1", close(sum.re, -1, 1) && close(sum.im, 0, 1));
  const prod = cmul(c, oneMinusC);
  check("c(1−c) = 1", close(prod.re, 1, 1) && close(prod.im, 0, 1));
  let ok = true;
  for (const q of shapes.slice(0, 60)) {
    const s = scale([q.A, q.B, q.C, q.D]);
    ok = ok && closePt(pageP(q), sub(add(q.A, q.C), q.B), s);
    ok = ok && closePt(pageP(q), q.D, s);
  }
  check("formula (2) gives P = A−B+C = D in 60 shapes", ok);
}

/* Dragging: the core's four branches against the four bytecode branches. */
{
  let ok = true, kept = true;
  const targets = [P(30, 40), P(200, 90), P(410, 25), P(460, 315), P(15, 300)];
  for (const q of shapes.slice(0, 80)) {
    for (const name of ["A", "B", "C", "D"]) {
      for (const p of targets) {
        const want = apDrag(q, name, p);
        const got = C.move({ A: q.A, B: q.B, C: q.C, D: q.D, explored: false }, name, p);
        ok = ok && ["A", "B", "C", "D"].every((k) => closePt(got[k], want[k], 1));
        kept = kept && closePt(add(got.A, got.C), add(got.B, got.D), 1);
      }
    }
  }
  check("all four drag branches match the applet in 1,600 moves", ok);
  check("A+C = B+D after every one of those drags", kept);
  const s = C.start({});
  check("an unknown point cannot be dragged", C.move(s, "X", P(1, 2)) === s);
  check("a non-finite point cannot be dragged", C.move(s, "A", P(NaN, 2)) === s);
  check("dragging marks the diagram explored", C.move(s, "A", P(180, 200)).explored === true);
}

/* The opposite() table and the on-screen drag bound are the UI's helpers. */
{
  let ok = true;
  for (const q of shapes.slice(0, 40)) {
    for (const name of ["A", "B", "C", "D"]) {
      const want = apDrag(q, name, q[name]);
      ok = ok && closePt(C.opposite(name, q), want[C.MOVED[name]], 1);
    }
  }
  check("opposite() agrees with UpkeepParallelogram in 160 cases", ok);

  let bounded = true;
  const opening = C.start({});
  for (const name of ["A", "B", "C", "D"]) {
    for (const far of [P(-9999, 9999), P(9999, -9999)]) {
      const p = C.clampDrag(opening, name, far);
      const moved = C.move(opening, name, p);
      bounded = bounded && ["A", "B", "C", "D"].every((k) =>
        moved[k].x >= 0 && moved[k].x <= C.VIEW.width
        && moved[k].y >= 0 && moved[k].y <= C.VIEW.height);
    }
  }
  check("clampDrag keeps the dragged corner and its opposite on the board", bounded);
}

/* Options, defaults, reset and status text. */
{
  const s = C.start({});
  equal("all three checkboxes start unchecked", [s.options.names, s.options.first, s.options.second],
    [false, false, false]);
  const shown = C.start({ show: "1" });
  check('the archived page\'s show="1" turns names on', shown.options.names === true);
  check("only the three applet options are accepted",
    C.setOption(s, "names", true).options.names === true
      && C.setOption(s, "size", true) === s);
  const moved = C.move(C.setOption(s, "first", true), "B", P(200, 100));
  const back = C.reset(moved);
  check("Reset restores the opening corners but keeps the checkboxes",
    ["A", "B", "C", "D"].every((k) => closePt(back[k], s[k], 1))
      && back.options.first === true && back.explored === true);
  check("the status line reports the coincidence", /P, Q, R, S sit on D, A, B, C/.test(C.describe(moved)));
  check("there is no win or loss in a demonstration", C.result(moved) === null);
  const source = readFileSync("equi-tri-on-para/equi-tri-on-para-core.js", "utf8");
  check("the core has no DOM and defines one global",
    !/\b(?:document|window)\s*[.[]/.test(source) && /^const EquiTriOnParaCore/m.test(source));
}

done("equi-tri-on-para");
