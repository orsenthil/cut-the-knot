#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-lined-on-tri-sides/circles-lined-on-tri-sides-core.js.
 *
 *   node porting/check-circles-lined-on-tri-sides.mjs
 *
 * Checks the start position and the 1..8 option range, then every one of the
 * 56 ordered pairs N != M at three canvas sizes against (a) a second,
 * literal transcription of the applet's Compute() bytecode and (b) every
 * claim the cut-the-knot article makes: the Pythagorean identity, the
 * inradius formula, the integer ratio R/r = 2R+1, the two circle counts
 * leg+1 (leg+1+leg+1 minus the shared corner), the exact fit of the rows and
 * their tangencies. The 3-4-5 / 3r / eight-circle case is pinned separately.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("circles-lined-on-tri-sides/circles-lined-on-tri-sides-core.js", "CirclesLinedOnTriSidesCore");

const SIZES = [{ width: 400, height: 300 }, { width: 500, height: 380 }, { width: 320, height: 260 }];
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start({});
  check("start N is the applet's 1", s.N === 1);
  check("start M is the applet's 2", s.M === 2);
  check("the statement starts hidden", s.showStatement === false);
  const clamped = C.withOptions(s, { N: 99, M: -3, showStatement: true });
  check("N is clamped to 8", clamped.N === 8);
  check("M is clamped to 1", clamped.M === 1);
  check("statement toggles", clamped.showStatement === true);
  check("start does not mutate its argument", s.N === 1 && s.M === 2);
  check("equal N and M draw nothing", C.compute(C.withOptions(s, { M: 1 })).doNotDraw === true);
}

/* ----------------------------------- 2. the applet's own method, transcribed */

/*
 * CirclesLinedOnTriSidesCanvas.Compute(), from `javap -c -p`. Local slots are
 * named after the bytecode: L1..L3, KV/KH, L4 (size), L5 (margin), L6 (scale),
 * L8 (twice the inradius), coef, r, L9 (inradius). Written independently of
 * the core, with the Java integer division and the duplicate Draw() row kept.
 */
function appletCompute(n, m, width, height) {
  const DoNotDraw = n === m;
  if (DoNotDraw) return { DoNotDraw };
  const L1 = n > m ? n * n - m * m : 2 * n * m;
  const L2 = n > m ? 2 * n * m : m * m - n * n;
  const L3 = n * n + m * m;
  const KV = L2 + 1;
  const KH = L1 + 1;
  const L4 = { width, height };
  const L5 = 20;
  const L6 = Math.min(Math.trunc((L4.width - 2 * L5) / L1), Math.trunc((L4.height - 2 * L5) / L2));
  const A = L6 * L2;
  const B = L6 * L1;
  const Cc = Math.sqrt(A * A + B * B);
  const x0 = (L4.width - B) / 2.0;
  const y0 = (L4.height + A) / 2.0;
  const L8 = L1 + L2 - L3;
  const coef = L8 + 1;
  const r = ((L6 * L8) / 2.0) / (L8 + 1);
  const L9 = (L8 * L6) / 2.0;
  const ICircle = { x: x0 + B - L9, y: y0 - L9, r: L9 };
  const IVCircle = { x: L5 + L9, y: L5 + L9, r: L9 };
  const SCircles = [];
  for (let i = 0; i < coef; i++) {
    SCircles.push({ x: IVCircle.x - IVCircle.r + r * (2 * i + 1), y: IVCircle.y, r });
  }
  const row1 = [], row2 = [];
  for (let k = 0; k < KV; k++) row1.push({ x: x0 + B - r - 2 * k * r, y: y0 - r, r });
  for (let k = 1; k < KH; k++) row2.push({ x: x0 + B - r - 2 * k * r, y: y0 - r, r });
  return { DoNotDraw, L1, L2, L3, KV, KH, L6, A, B, C: Cc, x0, y0, L8, coef, r, L9,
    ICircle, IVCircle, SCircles, row1, row2 };
}

{
  let pairs = 0, fields = 0;
  for (const size of SIZES) {
    for (let N = 1; N <= 8; N++) {
      for (let M = 1; M <= 8; M++) {
        const g = C.compute(C.withOptions(C.start({}), { N, M }), size);
        const a = appletCompute(N, M, size.width, size.height);
        if (N === M) {
          check(`N=M=${N} is not drawn`, g.doNotDraw && a.DoNotDraw);
          continue;
        }
        pairs++;
        const keys = ["L1", "L2", "L3", "KV", "KH", "scale", "A", "B", "C", "x0", "y0",
          "L8", "coef", "R", "r"];
        const vals = { scale: a.L6, R: a.L9 };
        for (const key of keys) {
          const expected = vals[key] === undefined ? a[key] : vals[key];
          if (near(g[key], expected, 1e-9)) fields++;
          else check(`compute ${key} at N=${N}, M=${M}, ${size.width}x${size.height}`, false,
            `core ${g[key]}, applet ${expected}`);
        }
        const circles = ["incircle", "auxCircle"];
        for (const key of circles) {
          const theirs = key === "incircle" ? a.ICircle : a.IVCircle;
          if (near(g[key].x, theirs.x, 1e-9) && near(g[key].y, theirs.y, 1e-9)
            && near(g[key].r, theirs.r, 1e-9)) fields++;
          else check(`${key} at N=${N}, M=${M}`, false);
        }
        for (let i = 0; i < a.coef; i++) {
          const c = g.statementCircles[i], t = a.SCircles[i];
          if (c && near(c.x, t.x, 1e-9) && near(c.y, t.y, 1e-9) && near(c.r, t.r, 1e-9)) fields++;
          else check(`statement circle ${i} at N=${N}, M=${M}`, false);
        }
        for (let i = 0; i < a.KV; i++) {
          const c = g.paintedOnBase[i], t = a.row1[i];
          if (c && near(c.x, t.x, 1e-9) && near(c.y, t.y, 1e-9)) fields++;
          else check(`painted row 1 circle ${i} at N=${N}, M=${M}`, false);
        }
        for (let i = 0; i < a.KH - 1; i++) {
          const c = g.paintedAgain[i], t = a.row2[i];
          if (c && near(c.x, t.x, 1e-9) && near(c.y, t.y, 1e-9)) fields++;
          else check(`painted row 2 circle ${i} at N=${N}, M=${M}`, false);
        }
      }
    }
  }
  check("all 56 pairs x 3 sizes compared with the applet", pairs === 56 * 3, `${pairs} pairs`);
  check(`every computed field matched (${fields} values)`, fields > 56 * 3 * 20);
}

/* ------------------------------------------- 3. every claim, every pair */

{
  let pairs = 0, checked = 0;
  for (let N = 1; N <= 8; N++) {
    for (let M = 1; M <= 8; M++) {
      if (N === M) continue;
      const state = C.withOptions(C.start({}), { N, M });
      const a = C.arrangement(state);
      const c = C.claims(state);
      pairs++;
      for (const [name, ok] of Object.entries(c)) {
        if (name === "doNotDraw") continue;
        if (ok === true) checked++;
        else check(`${name} holds at N=${N}, M=${M}`, false, String(ok));
      }
      const g = a.geometry;
      check(`Pythagorean triple ${N},${M}`, g.L1 * g.L1 + g.L2 * g.L2 === g.L3 * g.L3);
      check(`inradius ratio is the integer ${g.coef} at ${N},${M}`, near(g.R / g.r, g.coef, 1e-7));
    }
  }
  check("56 valid pairs tested", pairs === 56);
  check(`all ${checked} claim values passed`, checked === pairs * 16, `${checked} claims`);
}

/* ------------------------------------- 4. the tablet's 3-4-5 case, pinned */

{
  const s = C.withOptions(C.start({}), { N: 2, M: 1 });
  const g = C.compute(s);
  const a = C.arrangement(s);
  check("N=2, M=1 gives legs 3 and 4", g.L1 === 3 && g.L2 === 4);
  check("N=2, M=1 gives hypotenuse 5", g.L3 === 5);
  check("the inradius is one grid unit", near(g.R / g.scale, 1));
  check("the small radius is one third of a grid unit", near(g.r / g.scale, 1 / 3));
  check("the incircle is three small radii", near(g.R / g.r, 3));
  check("the coefficient is three", g.coef === 3);
  check("the statement shows three small circles", g.statementCircles.length === 3);
  check("the two rows have four and five circles", a.base.length === 4 && a.side.length === 5);
  check("eight circles in all (one is shared)", a.circles.length === 8);
  check("the corner circle is shared", near(a.base[a.base.length - 1].x, a.side[0].x)
    && near(a.base[a.base.length - 1].y, a.side[0].y));
  const other = C.withOptions(C.start({}), { N: 4, M: 1 });
  const og = C.compute(other);
  check("N=4, M=1 gives legs 15 and 8", og.L1 === 15 && og.L2 === 8);
  check("N=4, M=1 gives R/r = 7", near(og.R / og.r, 7));
  check("the radius fraction is always a whole number",
    [og.R / og.r, g.R / g.r].every((ratio) => near(ratio, Math.round(ratio), 1e-7)));
}

done("circles-lined-on-tri-sides");
