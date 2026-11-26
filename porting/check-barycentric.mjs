#!/usr/bin/env node
"use strict";

/*
 * Logic test for barycentric/barycentric-core.js.
 *
 *   node porting/check-barycentric.mjs
 *
 * What is checked:
 *  - the start position against BarycentricCanvas.init() for several sizes;
 *  - every interior lattice point with α+β+γ = 24 (300 configurations) and
 *    240 deterministic random exterior points: the article's equations (1)-(8);
 *  - a second, literal transcription of Compute() and Draw() straight from
 *    the Java bytecode, compared with the core over all of those positions,
 *    all three side-partition modes and all 15 significant-digit settings
 *    crossed with the eight checkbox states.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("barycentric/barycentric-core.js", "BarycentricCore");
const MODES = ["inherited", "addTo1", "routh"];
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const pointNear = (p, q, tol = 1e-6) => p && q && near(p.x, q.x, tol) && near(p.y, q.y, tol);

/* ------------------------------------------------ the applet, straight from bytecode */

function jDist(p, q) {
  const dx = p.x - q.x, dy = p.y - q.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* InsideTest.IsInside(q, a, b): (q-a)·(q-b) <= 0 */
function jInside(q, a, b) {
  return (q.x - a.x) * (q.x - b.x) + (q.y - a.y) * (q.y - b.y) <= 0;
}

/* GeoSDoub.Intersect: the four line coefficients and the three determinants. */
function jIntersect(p1, p2, p3, p4) {
  const s4 = p1.y - p2.y;
  const s6 = p2.x - p1.x;
  const s8 = p1.x * p2.y - p1.y * p2.x;
  const s10 = p3.y - p4.y;
  const s12 = p4.x - p3.x;
  const s14 = p3.x * p4.y - p3.y * p4.x;
  const s16 = s6 * s14 - s12 * s8;
  const s18 = s8 * s10 - s14 * s4;
  const s20 = s4 * s12 - s10 * s6;
  if (Math.abs(s20) < 1) return { x: NaN, y: NaN };
  return { x: s16 / s20, y: s18 / s20 };
}

/** BarycentricCanvas.Compute(), transcribed op for op. */
function jCompute(pos) {
  const { A, B, C: V, P } = pos;
  let Ap = null, Bp = null, Cp = null, aa, bb, cc;
  if (jDist(P, A) < 2) {
    aa = 1; bb = 0; cc = 0;
  } else if (jDist(P, B) < 2) {
    aa = 0; bb = 1; cc = 0;
  } else if (jDist(P, V) < 2) {
    aa = 0; bb = 0; cc = 1;
  } else {
    Ap = jIntersect(A, P, B, V);
    Bp = jIntersect(B, P, V, A);
    Cp = jIntersect(V, P, A, B);
    aa = jDist(P, Ap) / jDist(A, Ap);
    bb = jDist(P, Bp) / jDist(B, Bp);
    cc = jDist(P, Cp) / jDist(V, Cp);
    if (jInside(Ap, A, P)) aa = -aa;
    if (jInside(Bp, B, P)) bb = -bb;
    if (jInside(Cp, V, P)) cc = -cc;
  }
  return { aa, bb, cc, Ap, Bp, Cp };
}

/* NumberFormat.getInstance() with maximumFractionDigits(N): numeric values. */
function jNumber(v, n) {
  if (!Number.isFinite(v)) return NaN;
  return Number(v.toFixed(Math.max(1, Math.min(15, n))));
}

/** BarycentricCanvas.Draw(): which labels appear, and with which values. */
function jDisplay(pos, calc, opts) {
  const { aa, bb, cc } = calc;
  const show = {
    names: Boolean(opts.showNames), bary: Boolean(opts.showBary), ceva: Boolean(opts.showCeva),
  };
  const bary = [jNumber(aa, opts.digits), jNumber(bb, opts.digits), jNumber(cc, opts.digits)];
  let labels = null;
  if (show.ceva && calc.Ap && calc.Bp && calc.Cp) {
    if (opts.mode === "addTo1") {
      // Show1Ceva(C,B,Ap,cc/(1-aa)), Show1Ceva(A,C,Bp,aa/(1-bb)), ...
      labels = {
        BC: [["C", cc / (1 - aa)], ["B", 1 - cc / (1 - aa)]],
        CA: [["A", aa / (1 - bb)], ["C", 1 - aa / (1 - bb)]],
        AB: [["B", bb / (1 - cc)], ["A", 1 - bb / (1 - cc)]],
      };
    } else if (opts.mode === "routh") {
      labels = {
        BC: [["B", bb / cc], ["C", 1]],
        CA: [["C", cc / aa], ["A", 1]],
        AB: [["A", aa / bb], ["B", 1]],
      };
    } else {
      labels = {
        BC: [["B", bb], ["C", cc]],
        CA: [["C", cc], ["A", aa]],
        AB: [["A", aa], ["B", bb]],
      };
    }
  }
  return { show, bary, labels };
}

function combosOfInterior(n) {
  const out = [];
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < n - i; j++) {
      const k = n - i - j;
      out.push({ a: i / n, b: j / n, g: k / n });
    }
  }
  return out;
}

const base = C.start();
const at = (w) => ({
  ...base,
  P: {
    x: w.a * base.A.x + w.b * base.B.x + w.g * base.C.x,
    y: w.a * base.A.y + w.b * base.B.y + w.g * base.C.y,
  },
});
const interior = combosOfInterior(24).map(at);
const rand = rng(20261126);
const exterior = [];
for (let i = 0; i < 240; i++) {
  const a = (rand() * 4 - 1.5), b = (rand() * 4 - 1.5), g = (rand() * 4 - 1.5);
  const sum = a + b + g;
  if (Math.abs(sum) < 0.2) continue;
  exterior.push(at({ a: a / sum, b: b / sum, g: g / sum }));
}

/* ------------------------------------------------------------ 1. the starting scene */

for (const [w, h] of [[400, 300], [480, 360], [600, 250]]) {
  const s = C.start({ width: w, height: h });
  const cx = w / 2, cy = h / 2, r = w / 4;
  check(`start matches init at ${w}x${h}`,
    pointNear(s.A, { x: w / 4, y: cy + cy / 3 }, 1e-12) &&
    pointNear(s.B, { x: cx + r, y: s.A.y }, 1e-12) &&
    pointNear(s.C, { x: cx + r * Math.cos(Math.PI / 3), y: cy - r * Math.sin(Math.PI / 3) }, 1e-12) &&
    pointNear(s.P, {
      x: (s.A.x + s.B.x + s.C.x) / 3,
      y: (s.A.y + s.B.y + s.C.y) / 3,
    }, 1e-12));
}
check("the illustration has no winner", C.result(base) === null);
check("options clamp the digit spinner to 1..15",
  C.options({ digits: 0 }).digits === 1 && C.options({ digits: 99 }).digits === 15 &&
  C.options({ digits: 7 }).digits === 7);
check("options keep only the applet's three modes",
  MODES.every((m) => C.options({ mode: m }).mode === m) && C.options({ mode: "side" }).mode === "inherited");
{
  const moved = C.withPoint(base, "P", { x: 123, y: 45 });
  check("withPoint leaves the old position alone",
    base.P.x !== 123 && pointNear(moved.P, { x: 123, y: 45 }) &&
    pointNear(moved.A, base.A) && pointNear(moved.C, base.C));
}

/* ------------------------------------------- 2. the three near-vertex short circuits */

for (const name of ["A", "B", "C"]) {
  const p = C.withPoint(base, "P", { x: base[name].x + 0.5, y: base[name].y + 0.5 });
  const core = C.compute(p), java = jCompute(p);
  const expect = name === "A" ? [1, 0, 0] : name === "B" ? [0, 1, 0] : [0, 0, 1];
  check(`P near ${name}: both methods return its vertex coordinate`,
    expect.every((v, i) => near([core.coords.aa, core.coords.bb, core.coords.cc][i], v, 1e-12)) &&
    expect.every((v, i) => near([java.aa, java.bb, java.cc][i], v, 1e-12)) &&
    !core.feet.Ap && !core.feet.Bp && !core.feet.Cp && !java.Ap && !java.Bp && !java.Cp);
}

/* ------------------------------- 3. article (1)-(5) on all 300 interior configurations */

{
  let weighted = 0, sum = 0, onSides = 0, concurrent = 0, feet = 0, sides = 0, ceva = 0, inverse = 0;
  for (const pos of interior) {
    const c = C.claims(pos, C.compute(pos));
    if (c.weightedAverage) weighted++;
    if (c.addTo1) sum++;
    if (c.feetOnSides) onSides++;
    if (c.concurrent) concurrent++;
    if (c.footIsBarycenter) feet++;
    if (c.sideRatios) sides++;
    if (c.ceva) ceva++;
    if (c.converse) inverse++;
  }
  const n = interior.length;
  check(`(1) the weighted corners give P in all ${n} interiors`, weighted === n);
  check(`(2) the coordinates add to 1 in all ${n} interiors`, sum === n);
  check(`A', B', C' lie on their sides in all ${n} interiors`, onSides === n);
  check(`the three cevians meet at P in all ${n} interiors`, concurrent === n);
  check(`each foot is the barycenter of its side's two weights in all ${n} interiors`, feet === n);
  check(`(5) BA'/A'C = γ/β, CB'/B'A = α/γ, AC'/C'B = β/α in all ${n} interiors`, sides === n);
  check(`Ceva's product AC'/C'B · BA'/A'C · CB'/B'A = 1 in all ${n} interiors`, ceva === n);
  check(`(8) the converse gives the same P in all ${n} interiors`, inverse === n);
}

/* -------------------------- 4. the second transcription, inside and outside, signed */

{
  let coordsOk = 0, feetOk = 0, signOk = 0, sumOk = 0, productOk = 0;
  const all = interior.concat(exterior);
  for (const pos of all) {
    const core = C.compute(pos), java = jCompute(pos);
    if (near(core.coords.aa, java.aa) && near(core.coords.bb, java.bb) && near(core.coords.cc, java.cc)) coordsOk++;
    if (pointNear(core.feet.Ap, java.Ap) && pointNear(core.feet.Bp, java.Bp) && pointNear(core.feet.Cp, java.Cp)) feetOk++;
    const jSigns = [java.aa, java.bb, java.cc].map(Math.sign);
    const cSigns = [core.coords.aa, core.coords.bb, core.coords.cc].map(Math.sign);
    if (jSigns.every((s, i) => s === cSigns[i])) signOk++;
    if (Math.abs(core.coords.aa + core.coords.bb + core.coords.cc - 1) < 1e-8) sumOk++;
    const r = C.sideRatios(pos, core);
    if (r && near(r.product, 1, 1e-7)) productOk++;
  }
  check(`Compute() agrees on all ${all.length} coordinates`, coordsOk === all.length);
  check(`Compute() agrees on all ${all.length} cevian feet`, feetOk === all.length);
  check(`the sign flips agree on all ${all.length} configurations`, signOk === all.length);
  check(`aa + bb + cc = 1 inside and outside too (${all.length} cases)`, sumOk === all.length);
  check(`Ceva's product is 1 with signed ratios (${all.length} cases)`, productOk === all.length);
}

/* ---------------------------------- 5. every option: 3 modes x 15 digits x 8 toggles */

{
  const samples = [interior[40], exterior[7] || interior[41]];
  let baryOk = 0, visibilityOk = 0, labelsOk = 0, total = 0;
  for (const pos of samples) {
    const calc = C.compute(pos), java = jCompute(pos);
    for (const mode of MODES) {
      for (let digits = C.DIGITS_MIN; digits <= C.DIGITS_MAX; digits++) {
        for (const showNames of [false, true]) {
          for (const showBary of [false, true]) {
            for (const showCeva of [false, true]) {
              const opts = { mode, digits, showNames, showBary, showCeva };
              const d = C.display(pos, calc, opts);
              const j = jDisplay(pos, java, opts);
              total++;
              if (d.showNames === j.show.names && d.showBary === j.show.bary && d.showCeva === j.show.ceva) visibilityOk++;
              if (!d.baryText) {
                if (!j.show.bary) baryOk++;
              } else {
                const got = d.baryText.replace(/^P = /, "").slice(1, -1).split(",").map(Number);
                if (got.length === 3 && got.every((v, i) => near(v, j.bary[i], 1e-9)) &&
                    /^P = \(/.test(d.baryText) === showNames) baryOk++;
              }
              if (!j.labels) {
                if (!d.labels) labelsOk++;
              } else {
                let ok = Boolean(d.labels);
                for (const side of ["BC", "CA", "AB"]) {
                  const mine = d.labels.find((s) => s.side === side);
                  const theirs = j.labels[side];
                  if (!mine || mine.start !== theirs[0][0] || mine.end !== theirs[1][0] ||
                      !near(mine.values[0], theirs[0][1], 1e-9) ||
                      !near(mine.values[1], theirs[1][1], 1e-9)) ok = false;
                }
                if (ok) labelsOk++;
              }
            }
          }
        }
      }
    }
  }
  check(`all ${total} checkbox/digit/mode combinations keep the applet's visibility`, visibilityOk === total);
  check(`all ${total} combinations print P's coordinates as Draw() does`, baryOk === total);
  check(`all ${total} combinations place the three modes' side labels as Draw() does`, labelsOk === total);
}

/* -------------------------------------- 6. the page's exact numbers, in closed form */

{
  const w = { a: 0.2, b: 0.3, g: 0.5 };
  const pos = at(w), calc = C.compute(pos), r = C.sideRatios(pos, calc);
  check("BA'/A'C = γ/β = 0.5/0.3", near(r.BA_ApC, 5 / 3, 1e-9));
  check("CB'/B'A = α/γ = 0.2/0.5", near(r.CB_BpA, 2 / 5, 1e-9));
  check("AC'/C'B = β/α = 0.3/0.2", near(r.AC_CpB, 3 / 2, 1e-9));
  check("the three ratios multiply to exactly 1", near(r.product, 1, 1e-9));

  let inverseOk = 0, n = 0;
  for (let i = 1; i <= 40; i++) {
    for (let j = 1; j <= 40; j++) {
      const lambda = i / 17, mu = j / 19, nu = 1 / (lambda * mu);
      const inv = C.fromRatios(lambda, mu, nu);
      const pts = inv.triples.map((t) => C.balance(pos, t));
      const result = { ...base, P: pts[0] };
      const actual = C.sideRatios(result, C.compute(result));
      n++;
      if (Math.abs(inv.ceva - 1) < 1e-9 && pts.every((p) => pointNear(p, pts[0])) &&
          actual && near(actual.BA_ApC, lambda, 1e-8) &&
          near(actual.CB_BpA, mu, 1e-8) && near(actual.AC_CpB, nu, 1e-8)) inverseOk++;
    }
  }
  check(`(6)-(8) all ${n} ratio triples give the same point`, inverseOk === n);
  check("Ceva's condition is needed: λμν ≠ 1 is reported",
    Math.abs(C.fromRatios(2, 3, 4).ceva - 24) < 1e-12);
}

/* ------------------------------------------------- 7. edge cases and presentation */

{
  const collinear = {
    A: { x: 0, y: 0 }, B: { x: 100, y: 0 }, C: { x: 200, y: 0 }, P: { x: 80, y: 40 },
  };
  const c = C.claims(collinear, C.compute(collinear));
  check("a flattened triangle has no finite coordinates and no claims",
    !Object.values(c).some(Boolean) &&
    !Number.isFinite(C.compute(collinear).coords.aa));
  check("the digit spinner's formatted numbers keep 1..15 digits",
    C.format(1 / 3, 1) === "0.3" && C.format(1 / 3, 15).length === 17 &&
    C.format(-0.0001, 2) === "0" && C.format(Infinity, 2) === "Infinity");
  check("format clamps an out-of-range digit setting like the panel",
    C.format(0.123456, 0) === C.format(0.123456, 1) &&
    C.format(0.123456, 99) === C.format(0.123456, 15));
}

done("barycentric");
