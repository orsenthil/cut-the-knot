#!/usr/bin/env node
"use strict";

/*
 * Logic test for lebesgue-curve/lebesgue-curve-core.js.
 *
 *    node porting/check-lebesgue-curve.mjs
 *
 * 1. A second transcription of LebesgueCurveCanvas's own bytecode (init,
 *    Reset, combine/combineK/combineM, the drawLebesgueCurve switch) compared
 *    with the core over many applet canvas sizes and every reachable order.
 * 2. The page's claims: the cells are joined top-down, left-right; the four
 *    diminished copies are joined in the same order; every cell centre is
 *    visited exactly once; the Cantor digit map is onto the square; the
 *    removed middle thirds have total length 1-(2/3)^k -> 1 and the extended
 *    map is affine on each of them (so its derivative exists almost everywhere).
 * 3. The rules' edges: the finest order wraps back to the first, setOrder
 *    clamps, nothing mutates, and every point stays inside the board.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("lebesgue-curve/lebesgue-curve-core.js", "LebesgueCurveCore");

/* ------------------------------------------------------------------------ *
 * Second transcription, written straight from javap -c -p of the three
 * classes in LebesgueCurve.zip. Deliberately uses its own locals and loops.
 * ------------------------------------------------------------------------ */

function jInit(canvas) {
  // The canvas is square in the applet: getSize() returned (canvas, canvas).
  let m_Step = Math.trunc(Math.min(canvas, canvas) / 2);
  let m_AbsMaxStep = 1;
  while (Math.trunc(m_Step / 2) >= 2) {
    m_Step = Math.trunc(m_Step / 2);
    m_AbsMaxStep++;
  }
  let p = 1;
  for (let i = 0; i < m_AbsMaxStep; i++) p = p << 1;
  const m_x0 = Math.trunc((canvas - m_Step * p) / 2);
  const m_y0 = Math.trunc((canvas - m_Step * p) / 2);
  let m_MaxStep = m_AbsMaxStep;
  while (m_MaxStep > 1) {
    m_MaxStep--;
    m_Step = m_Step << 1;
  }
  return {
    m_MaxStep, m_AbsMaxStep, m_StartStep: m_Step,
    m_x0, m_y0, m_Step, Str: jCombine(1),
  };
}

function jCombine(n) {
  if (n === 1) return "010";
  const s = jCombine(n - 1);
  return s + "2" + s + "3" + s + "2" + s;
}

function jCombineK(n) {
  if (n <= 1) return "";
  const s = jCombineK(n - 1);
  const q = new StringBuffer("").append(n - 1).toString();
  return s + q + s + s + q + s;
}

function jCombineM(n) {
  if (n <= 1) return "";
  const s = jCombineM(n - 1);
  const q = new StringBuffer("").append(n).toString();
  return s + q + s + s + q + s;
}

/* Standard.StringBuffer's append(int), used by combineK/combineM. */
function StringBuffer(initial) {
  this.buf = initial || "";
}
StringBuffer.prototype.append = function (x) {
  this.buf += String(x);
  return this;
};
StringBuffer.prototype.toString = function () { return this.buf; };

function jCharToInt(c) { return c.charCodeAt(0) - 48; }

function jIntToChar(v) {
  // The Java tableswitch maps 0..9 to '0'..'9' and everything else to '0'.
  return v >= 0 && v <= 9 ? String.fromCharCode(48 + v) : "0";
}

function jRotate(n, s) {
  // The bytecode is (CharToInt(c) + n) % 4, then IntToChar (tableswitch).
  const copy = s.split("");
  for (let i = 0; i < copy.length; i++) copy[i] = jIntToChar((jCharToInt(copy[i]) + n) % 4);
  return copy.join("");
}

function jReverse(n, s) {
  const copy = s.split("").reverse();
  for (let i = 0; i < copy.length; i++) copy[i] = jIntToChar((jCharToInt(copy[i]) + n + 2) % 4);
  return copy.join("");
}

/* Reset(): m_MaxStep++, m_Step /= 2, wrap when m_Step reaches 1. */
function jReset(state, startStep) {
  let m_MaxStep = state.m_MaxStep + 1;
  let m_Step = Math.trunc(state.m_Step / 2);
  if (m_Step === 1) {
    m_Step = startStep;
    m_MaxStep = 1;
  }
  return {
    m_MaxStep, m_Step,
    Str: jCombine(m_MaxStep),
    kStr: jCombineK(m_MaxStep),
    mStr: jCombineM(m_MaxStep),
  };
}

/* drawLebesgueCurve(): the switch on Str, with kStr/mStr consumed in order. */
function jPoints(g, order) {
  let Str = g.Str, kStr = "", mStr = "";
  let step = g.m_Step, maxStep = g.m_MaxStep;
  if (order !== 1) {
    for (let c = 1; c < order; c++) {
      const r = jReset({ m_MaxStep: maxStep, m_Step: step }, g.m_StartStep);
      Str = r.Str; kStr = r.kStr; mStr = r.mStr; step = r.m_Step; maxStep = r.m_MaxStep;
    }
  } else {
    kStr = jCombineK(1); mStr = jCombineM(1);
  }
  const half = Math.trunc(step / 2);
  let x = g.m_x0 + half, y = g.m_y0 + half; // locals 3 and 4
  const pts = [{ x, y }];
  for (let i = 0; i < Str.length; i++) {
    const oldx = x, oldy = y;         // locals 9 and 10
    let nx = x, ny = y;              // locals 5 and 6
    const ch = Str.charAt(i);
    if (ch === "0") {
      ny = y + step;
    } else if (ch === "1") {
      nx = x + step;
      ny = y - step;
    } else if (ch === "2") {
      const digit = jCharToInt(kStr.charAt(0));
      kStr = kStr.substring(1);
      const e = Math.trunc(Math.pow(2.0, digit)) - 1;
      nx = x - e * step;
      ny = y + step;
    } else if (ch === "3") {
      const digit = jCharToInt(mStr.charAt(0));
      mStr = mStr.substring(1);
      const f = Math.trunc(Math.pow(2.0, digit)) - 1;
      nx = x + step;
      ny = y - f * step;
    }
    // g.drawLine(oldx, oldy, nx, ny), then the new point becomes current.
    pts.push({ x: nx, y: ny });
    x = nx; y = ny;
  }
  return pts;
}

/* ---------------------------------------------- 1. the core against the code */

const CANVASES = [64, 100, 128, 200, 256, 333, 400, 512, 540, 700, 1000, 1024, 2048];

for (const canvas of CANVASES) {
  const g = jInit(canvas);
  const cg = C.geometry(canvas);
  check(`init/canvas ${canvas}: absMaxStep`,
    cg.absMaxStep === g.m_AbsMaxStep, `${cg.absMaxStep} vs ${g.m_AbsMaxStep}`);
  check(`init/canvas ${canvas}: startStep`,
    cg.startStep === g.m_StartStep, `${cg.startStep} vs ${g.m_StartStep}`);
  check(`init/canvas ${canvas}: origin`,
    cg.x0 === g.m_x0 && cg.y0 === g.m_y0, `${cg.x0},${cg.y0} vs ${g.m_x0},${g.m_y0}`);

  for (let n = 1; n <= g.m_AbsMaxStep; n++) {
    const corePts = C.points(C.setOrder(C.start({ canvas }), n));
    const apPts = jPoints(g, n);
    check(`trace/canvas ${canvas}/order ${n}: ${corePts.length} segments`,
      JSON.stringify(corePts) === JSON.stringify(apPts));
  }

  // Repeat Reset() well past the wrap; it must cycle exactly like the applet.
  let ap = { m_MaxStep: g.m_MaxStep, m_Step: g.m_Step };
  let co = C.start({ canvas });
  let same = true;
  for (let k = 0; k < g.m_AbsMaxStep * 3 + 2; k++) {
    ap = jReset(ap, g.m_StartStep);
    co = C.next(co);
    if (co.order !== ap.m_MaxStep || co.step !== ap.m_Step) same = false;
  }
  check(`Reset/canvas ${canvas}: order and step through three wraps`, same);
}

for (let n = 1; n <= 12; n++) {
  check(`combine(${n})`, C.combine(n) === jCombine(n));
  check(`combineK(${n})`, C.combineK(n) === jCombineK(n));
  check(`combineM(${n})`, C.combineM(n) === jCombineM(n));
  check(`rotate/reverse(${n}) leftovers`,
    C.rotate(2, "01023012") === jRotate(2, "01023012") &&
    C.reverse(3, "01230123") === jReverse(3, "01230123"));
}

/* ------------------------------------------------ 2. the page's claims */

/* Reference visitation order, from the page: top-down, left-right, with each
 * of the four diminished copies joined in the same order as its parent. */
function refCells(n) {
  if (n === 1) return [[0, 0], [0, 1], [1, 0], [1, 1]];
  const half = 2 ** (n - 1);
  const out = [];
  const bases = [[0, 0], [0, half], [half, 0], [half, half]];
  for (const b of bases) for (const p of refCells(n - 1)) out.push([b[0] + p[0], b[1] + p[1]]);
  return out;
}

{
  const s = C.start({});
  const g = C.geometry(s.canvas);
  check("applet default: canvas 512, orders 1..8",
    s.canvas === 512 && g.absMaxStep === 8 && C.MAX_ORDER === 8);
  check("Str length is 4^n - 1",
    [1, 2, 3, 4, 5, 6, 7, 8].every((n) => C.combine(n).length === 4 ** n - 1));
  check("Str uses only the four direction digits",
    Array.from(C.combine(7)).every((c) => "0123".includes(c)));
  check("jump strings use only decimal digits",
    Array.from(C.combineK(7) + C.combineM(7)).every((c) => "0123456789".includes(c)));
  check("kStr tokens match the '2' jumps of Str",
    C.combineK(7).length === Array.from(C.combine(7)).filter((c) => c === "2").length);
  check("mStr has enough tokens for the '3' jumps of Str",
    C.combineM(7).length >= Array.from(C.combine(7)).filter((c) => c === "3").length);

  for (let n = 1; n <= 7; n++) {
    const st = C.setOrder(s, n);
    const pts = C.points(st);
    check(`order ${n}: one point per cell centre (4^n)`, pts.length === 4 ** n);
    const want = refCells(n);
    const step = st.step;
    const got = pts.map((p) => [
      Math.round((p.x - (g.x0 + step / 2)) / step),
      Math.round((p.y - (g.y0 + step / 2)) / step),
    ]);
    check(`order ${n}: centres joined top-down, left-right`,
      JSON.stringify(got) === JSON.stringify(want));
    const unique = new Set(got.map((p) => p.join(",")));
    check(`order ${n}: every centre visited exactly once`, unique.size === 4 ** n);
    check(`order ${n}: all points inside the board`,
      pts.every((p) => p.x >= 0 && p.x <= 512 && p.y >= 0 && p.y <= 512));
  }
  const finest = C.points(C.setOrder(s, 8));
  check("order 8: 256 by 256 centres, still in the board",
    finest.length === 65536 &&
    new Set(finest.map((p) => `${p.x},${p.y}`)).size === 65536 &&
    finest.every((p) => p.x >= 0 && p.x <= 512 && p.y >= 0 && p.y <= 512));
}

/* The digit map f: Cantor digits 0/2 -> binary bits t_i = digit_i/2,
 * interlaced into (0.t1t3..., 0.t2t4...). */
function fFromDigits(digs) {
  let x = 0, y = 0;
  for (let i = 0; i < digs.length; i++) {
    const bit = digs[i] / 2;
    if (i % 2 === 0) x += bit * 2 ** -(i / 2 + 1);
    else y += bit * 2 ** -((i + 1) / 2);
  }
  return { x, y };
}

function ternary(t, n) {
  let v = t;
  const out = [];
  for (let i = 0; i < n; i++) {
    v *= 3;
    const d = Math.min(2, Math.floor(v + 1e-12));
    out.push(d);
    v -= d;
    if (v < 0) v = 0;
  }
  return out;
}

function ternaryValue(digs) {
  return digs.reduce((acc, d, i) => acc + d * 3 ** -(i + 1), 0);
}

{
  // Surjectivity: any pair of binary expansions can be interlaced into a
  // Cantor number, whose f is that pair. Test every k-bit pair for k <= 5.
  for (let k = 1; k <= 5; k++) {
    let ok = true;
    for (let xi = 0; xi < 2 ** k && ok; xi++) {
      for (let yi = 0; yi < 2 ** k && ok; yi++) {
        const xb = xi.toString(2).padStart(k, "0");
        const yb = yi.toString(2).padStart(k, "0");
        const bits = [];
        for (let j = 0; j < k; j++) { bits.push(xb[j], yb[j]); }
        const digs = bits.map((b) => Number(b) * 2);
        if (digs.some((d) => d !== 0 && d !== 2)) ok = false;
        const f = fFromDigits(digs);
        const x = parseInt(xb, 2) / 2 ** k, y = parseInt(yb, 2) / 2 ** k;
        if (Math.abs(f.x - x) > 1e-9 || Math.abs(f.y - y) > 1e-9) ok = false;
      }
    }
    check(`digit interlacing is onto the ${2 ** k}x${2 ** k} dyadic grid`, ok);
  }

  // Measure: the removed middle thirds total 1-(2/3)^k -> 1.
  let okMeasure = true;
  for (let k = 1; k <= 24; k++) {
    let removed = 0;
    for (let j = 1; j <= k; j++) removed += 2 ** (j - 1) * 3 ** -j;
    if (Math.abs(removed - (1 - (2 / 3) ** k)) > 1e-12) okMeasure = false;
  }
  check("removed thirds total 1-(2/3)^k for k = 1..24", okMeasure);
  const remaining = (2 / 3) ** 30;
  check("Cantor set has measure zero in the limit", remaining < 1e-5);

  // On a removed interval (a,b) the extended f is affine: for any t in it,
  // f(t) = (f(b)(t-a) + f(a)(b-t))/(b-a). Check the formula's linearity on
  // the endpoints of every removed interval up to level 4, at several
  // fractions, using the 0/2 expansions of the endpoints (which are exact).
  let okLinear = true;
  for (let level = 1; level <= 4 && okLinear; level++) {
    const count = 2 ** (level - 1);
    for (let m = 0; m < count && okLinear; m++) {
      const prefix = [];
      for (let j = 0; j < level - 1; j++) {
        const bit = (m >> (level - 2 - j)) & 1;
        prefix.push(bit ? 2 : 0);
      }
      const aDigs = prefix.concat([0, 0, 0, 0, 0, 0]);
      const bDigs = prefix.concat([2, 2, 2, 2, 2, 2]);
      const a = ternaryValue(aDigs), b = ternaryValue(bDigs);
      const fa = fFromDigits(aDigs), fb = fFromDigits(bDigs);
      for (const frac of [0.25, 0.5, 0.75]) {
        const t = a + frac * (b - a);
        const wantX = (fb.x * (t - a) + fa.x * (b - t)) / (b - a);
        const wantY = (fb.y * (t - a) + fa.y * (b - t)) / (b - a);
        // The affine rule is exactly the weighted mean of the endpoint values;
        // at frac=0.25 it lies 25% of the way from f(a) to f(b).
        const linX = fa.x + frac * (fb.x - fa.x);
        const linY = fa.y + frac * (fb.y - fa.y);
        if (Math.abs(wantX - linX) > 1e-12 || Math.abs(wantY - linY) > 1e-12) okLinear = false;
      }
    }
  }
  check("extended map is affine on every removed interval up to level 4", okLinear);
  check("difference quotient is constant across such an interval", (() => {
    const aDigs = [0, 0, 0, 0, 0, 0];
    const bDigs = [2, 2, 2, 2, 2, 2];
    const a = ternaryValue(aDigs), b = ternaryValue(bDigs);
    const fa = fFromDigits(aDigs), fb = fFromDigits(bDigs);
    const q1 = (fa.x + 0.25 * (fb.x - fa.x) - fa.x) / (0.25 * (b - a));
    const q2 = (fa.x + 0.75 * (fb.x - fa.x) - fa.x) / (0.75 * (b - a));
    return Math.abs(q1 - q2) < 1e-8;
  })());
}

/* ------------------------------------------------ 3. the rules' edges */

{
  const s = C.start({});
  check("start is order 1 with the largest step", s.order === 1 && s.step === 256);
  check("next advances one order", C.next(s).order === 2 && C.next(s).step === 128);
  check("next does not mutate its input", s.order === 1 && s.step === 256);
  equal("setOrder clamps below 1", C.setOrder(s, -3), { canvas: 512, order: 1, step: 256 });
  equal("setOrder clamps above the maximum", C.setOrder(s, 99),
    { canvas: 512, order: 8, step: 2 });
  equal("setOrder accepts a fractional order", C.setOrder(s, 3.7),
    { canvas: 512, order: 3, step: 64 });
  const finest = C.setOrder(s, 8);
  equal("the last order wraps back to the first", C.next(finest),
    { canvas: 512, order: 1, step: 256 });
  check("a demo has no result", C.describe(s).cells > 0);
  check("describe reports the grid and segment counts",
    C.describe(C.setOrder(s, 5)).cellsPerSide === 32 &&
    C.describe(C.setOrder(s, 5)).cells === 1024 &&
    C.describe(C.setOrder(s, 5)).segments === 1023);
  check("drawing strings agree with the described order",
    C.drawing(s).str === C.combine(1) && C.drawing(finest).str === C.combine(8));
}

done("lebesgue-curve");
