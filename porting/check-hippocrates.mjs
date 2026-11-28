#!/usr/bin/env node
"use strict";

/*
 * Logic test for hippocrates/hippocrates-core.js.
 *
 *   node porting/check-hippocrates.mjs
 *
 * The geometry is transcribed a second time, straight from the bytecode of
 * GeoSDoub.NearestPoint / GetParallelTo / Intersect and HippocratesCanvas.
 * ComputePoints / CheckSolved, and compared with the core over thousands of
 * positions. The page's claim ("when EH = 2*AC, angle BAE is one third of
 * angle BAC") is checked by solving for E over a grid of acute angles, and
 * the same identity is shown to fail for obtuse angles. The current page's
 * "place G on H" is checked against what the applet's finish test really does.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hippocrates/hippocrates-core.js", "HippocratesCore");
const PI = Math.PI;
const near = (a, b, eps = 1e-8) =>
  (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= eps;
const closePoint = (a, b, eps = 1e-8) =>
  a == null || b == null ? a == null && b == null : near(a.x, b.x, eps) && near(a.y, b.y, eps);

/* ------------------------------------------------------- 1. the rules/start */

{
  const s = C.start({});
  equal("applet's default width and height", [s.width, s.height], [400, 300]);
  equal("A starts at width/6, 4*height/5", s.A, { x: 66, y: 240 });
  equal("B starts at 5*width/6 on AB", s.B, { x: 333, y: 240 });
  equal("C starts at width/4, 2*height/5", s.C, { x: 100, y: 120 });
  equal("E starts at 5*width/6 on the line through C", s.E, { x: 333, y: 120 });
  equal("the circle starts centred at E", s.circle, { x: 333, y: 120 });
  check("the circle starts with radius 2*AC", near(s.radius, 2 * C.dist(s.A, s.C)));
  check("the starting picture is not finished", C.result(s) === null && !s.finished);
  check("the hint checkbox starts off and disabled", !s.hint && !s.hintEnabled);
  check("names start hidden", !s.showNames);

  const shape = C.compute(s);
  check("D is the foot from C to AB", closePoint(shape.D, { x: 100, y: 240 }));
  check("F is the fourth corner of the rectangle", closePoint(shape.F, { x: 66, y: 120 }));
  check("H is AE crossed with CD", near(shape.H.x, 100) && shape.H.y > 120 && shape.H.y < 240);
  check("K is 2*AC from E along EA", near(C.dist(s.E, shape.K), s.radius));
  check("G is the midpoint of E and K", closePoint(shape.G, C.midPoint(s.E, shape.K)));
  check("the start is not within one unit of H", C.dist(shape.H, shape.K) > 1);

  const small = C.start({ width: 120, height: 90 });
  equal("a 120x90 applet truncates A like Java int division", small.A, { x: 20, y: 72 });
  equal("a 120x90 applet truncates C and E", [small.C, small.E],
    [{ x: 30, y: 36 }, { x: 100, y: 36 }]);
}

/* -------------------------- 2. a second, literal transcription of the code */

/* Everything below uses its own arithmetic; no core helper is called. */
const aSq = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
const aDist = (p, q) => Math.sqrt(aSq(p, q));

/* GeoSDoub.NearestPoint(DoubPoint, DoubPoint, DoubPoint). */
function appletNearest(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  if (aSq(b, a) < 0.1) return { x: a.x, y: a.y };
  const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy);
  return { x: a.x + vx * t, y: a.y + vy * t };
}

/* GeoSDoub.GetParallelTo: 100*(b-c) added to a. */
function appletParallel(a, b, c) {
  return { x: a.x + 100.0 * (b.x - c.x), y: a.y + 100.0 * (b.y - c.y) };
}

/* GeoSDoub.Intersect(p1,p2,p3,p4), including its |det| < 1 guard. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* HippocratesCanvas.ComputePoints + CheckSolved at one position. */
function appletCompute(A, B, C, E, radius) {
  const D = appletNearest(C, A, B);
  const helper = appletParallel(A, C, D);
  const F = appletNearest(C, A, helper);
  const H = appletIntersect(A, E, C, D);
  const len = aDist(A, E);
  if (len === 0) return { D, F, H, K: null, G: null, solved: false };
  const ratio = radius / len;
  const K = { x: E.x + ratio * (A.x - E.x), y: E.y + ratio * (A.y - E.y) };
  const G = { x: (E.x + K.x) / 2, y: (E.y + K.y) / 2 };
  return { D, F, H, K, G, solved: aDist(H, K) < 1 };
}

{
  let bad = 0, first = "";
  let cases = 0;
  for (const ax of [30, 66, 100, 160]) {
    for (const ay of [180, 240, 260]) {
      for (const cx of [20, 60, 100, 140, 200, 300, 380]) {
        for (const cy of [30, 90, 120, 180, 220, 260]) {
          for (const ex of [20, 100, 200, 300, 333, 390]) {
            const A = { x: ax, y: ay }, B = { x: 333, y: ay };
            const Cpt = { x: cx, y: cy }, E = { x: ex, y: cy };
            const radius = 2 * aDist(A, Cpt);
            const state = { A, B, C: Cpt, E, radius };
            const ours = C.compute(state);
            const theirs = appletCompute(A, B, Cpt, E, radius);
            cases++;
            for (const name of ["D", "F", "H", "K", "G"]) {
              if (!closePoint(ours[name], theirs[name])) {
                bad++;
                if (!first) first = `${name} at A=${ax},${ay} C=${cx},${cy} E=${ex}`;
              }
            }
            if (ours.solved !== theirs.solved) {
              bad++;
              if (!first) first = `finish test at A=${ax},${ay} C=${cx},${cy} E=${ex}`;
            }
          }
        }
      }
    }
  }
  check(`${cases} positions match the bytecode geometry (5 points + finish)`, bad === 0,
    `${bad} differences, first: ${first}`);
  check("the comparison covered a genuinely large grid", cases >= 3000, `${cases} cases`);
}

/* ---------------------- 3. the drag fix-ups, compared with mouseDragged */

{
  const s = C.start({});
  const c1 = C.move(s, "C", { x: 150, y: 80 });
  check("dragging C sets E.y to C.y", c1.E.y === 80 && c1.C.y === 80);
  check("dragging C moves the circle's centre with it", c1.circle.y === 80 && c1.circle.x === c1.E.x);
  check("the circle radius follows 2*AC after a C drag", near(c1.radius, 2 * aDist(c1.A, c1.C)));
  check("A keeps its fixed y when dragged", C.move(s, "A", { x: 90, y: 80 }).A.y === 240);
  check("E keeps its fixed y when dragged", C.move(s, "E", { x: 200, y: 80 }).E.y === 120);
  check("dragging E moves the circle's x, not its y",
    C.move(s, "E", { x: 200, y: 80 }).circle.x === 200 && C.move(s, "E", { x: 200, y: 80 }).circle.y === 120);
  check("A's drag also resets the radius", near(C.move(s, "A", { x: 90, y: 80 }).radius,
    2 * aDist({ x: 90, y: 240 }, s.C)));
  check("off-board drags are clamped to the picture", C.move(s, "E", { x: 9999, y: 0 }).E.x <= s.width - 6);
  check("a move is counted", C.move(s, "C", { x: 150, y: 80 }).moves === 1);
  check("a named point that does not exist is a no-op", C.move(s, "Z", { x: 1, y: 1 }) === s);

  // The same fix-ups written out from the Java branch order, on three starts.
  let bad = 0;
  for (const w of [180, 400, 900]) {
    for (const h of [120, 300, 600]) {
      const st = C.start({ width: w, height: h });
      const cases = [
        ["A", { x: st.A.x + 7, y: 5 }],
        ["E", { x: st.E.x - 11, y: 5 }],
        ["C", { x: st.C.x + 13, y: st.C.y - 9 }],
      ];
      for (const [name, p] of cases) {
        const got = C.move(st, name, p);
        const A = st.A, B = st.B, E = st.E;
        let wantA = A, wantE = E, wantCircle = { x: st.circle.x, y: st.circle.y };
        if (name === "A") wantA = { x: p.x, y: A.y };
        if (name === "E") { wantE = { x: p.x, y: E.y }; wantCircle.x = p.x; }
        if (name === "C") { wantE = { x: E.x, y: p.y }; wantCircle = { x: E.x, y: p.y }; }
        const wantR = 2 * aDist(wantA, name === "C" ? p : st.C);
        if (!closePoint(got.A, wantA) || !closePoint(got.E, wantE) ||
            !closePoint(got.circle, wantCircle) || !near(got.radius, wantR)) bad++;
      }
    }
  }
  check("all nine start sizes follow the bytecode drag fix-ups", bad === 0, `${bad} wrong`);
}

/* ---------------------------- 4. the page's central claim, exhaustively */

{
  let bad = 0, missing = 0, cases = 0, maxRatioError = 0;
  for (const cx of [8, 20, 34, 50, 80, 120, 200, 300]) {
    for (const h of [20, 40, 60, 80, 100, 120, 180, 240, 300]) {
      const A = { x: 0, y: h }, B = { x: 1000, y: h }, Cpt = { x: cx, y: 0 };
      const radius = 2 * aDist(A, Cpt);
      const st = { A, B, C: Cpt, E: { x: cx + 1, y: 0 }, radius };
      const ex = C.solveE(st, { lo: cx + 1e-7, hi: cx + 1e6 });
      if (ex === null) { missing++; continue; }
      const E = { x: ex, y: 0 };
      const H = appletIntersect(A, E, Cpt, { x: cx, y: h });
      const theirs = appletCompute(A, B, Cpt, E, radius);
      const BAC = C.angleAt(A, B, Cpt), BAE = C.angleAt(A, B, E);
      cases++;
      if (Math.abs(aDist(E, H) - 2 * aDist(A, Cpt)) > 1e-7) bad++;
      if (!theirs.solved || aDist(H, theirs.K) > 1e-6) bad++;
      const err = Math.abs(BAC / BAE - 3);
      maxRatioError = Math.max(maxRatioError, err);
      if (err > 1e-6) bad++;
    }
  }
  check("an E with EH = 2*AC exists for every acute case", missing === 0, `${missing} missing`);
  check(`${cases} acute constructions trisect the angle exactly`, bad === 0,
    `${bad} wrong, largest ratio error ${maxRatioError.toExponential(2)}`);
  check("the acute angle is below a right angle in every tested case",
    C.angleAt({ x: 0, y: 300 }, { x: 1000, y: 300 }, { x: 8, y: 0 }) < PI / 2);

  // The page does not say "for acute angles". For C on the far side of A the
  // identity is false; pin the actual behaviour instead of repeating the claim.
  let falseClaims = 0, roots = 0;
  for (const [cx, h] of [[-40, 80], [-100, 40], [-10, 100], [-25, 60], [-60, 120]]) {
    const A = { x: 0, y: h }, B = { x: 1000, y: h }, Cpt = { x: cx, y: 0 };
    const radius = 2 * aDist(A, Cpt);
    const st = { A, B, C: Cpt, E: { x: cx + 1, y: 0 }, radius };
    const ex = C.solveE(st, { lo: cx + 1e-7, hi: 0 });
    if (ex === null) continue;
    roots++;
    const E = { x: ex, y: 0 };
    const shape = C.compute({ A, B, C: Cpt, E, radius });
    const ratio = shape.BAC / shape.BAE;
    if (ratio > 2.9) falseClaims++;
    if (cx === -40 && h === 80) {
      check("the obtuse 116.6 degree example does not trisect", Math.abs(ratio - 1.17918) < 1e-4,
        `ratio ${ratio}`);
    }
  }
  check("all five obtuse constructions were solved", roots === 5, `${roots} roots`);
  check("the page's unqualified claim is false for every obtuse example", falseClaims === 0);
  check("obtuse BAC really is obtuse", C.angleAt({ x: 0, y: 80 }, { x: 1000, y: 80 }, { x: -40, y: 0 }) > PI / 2);
}

/* ------------------- 5. G, H and K: the page's later wording is not the code */

{
  const s = C.start({});
  const ex = C.solveE(s);
  const solved = C.move(s, "E", { x: ex, y: s.E.y });
  const sh = C.compute(solved);
  check("the matched construction is reported as done", C.result(solved) === "done" && solved.finished);
  check("K lands on H", C.dist(sh.H, sh.K) < 1e-6);
  check("G is still halfway between E and K", closePoint(sh.G, C.midPoint(solved.E, sh.K)));
  check("G is NOT on H: the current page's 'place G on H' is a slip", C.dist(sh.G, sh.H) > 1);
  check("at the match EH equals 2*AC", near(C.dist(solved.E, sh.H), 2 * sh.ac, 1e-6));
  check("the status line says K is on H", C.describe(solved, sh).includes("K is on H"));
  check("the status line before the match asks for K, not G",
    C.describe(s, C.compute(s)).includes("K reaches H"));

  // The strict '< 1' boundary: step E away until the match is lost.
  let inside = 0, outside = 0;
  for (const dx of [-8, -3, -1.5, -0.5, 0, 0.5, 1.5, 3, 8]) {
    const st = C.move(s, "E", { x: ex + dx, y: s.E.y });
    const shape = C.compute(st);
    if (shape.solved) inside++; else outside++;
  }
  check("the one-unit finish test accepts near misses", inside >= 1, `${inside} inside`);
  check("the one-unit finish test rejects larger misses", outside >= 1, `${outside} outside`);
  const exact = appletCompute(s.A, s.B, s.C, { x: ex, y: s.C.y }, s.radius);
  check("the second transcription agrees on the matched state", exact.solved);
}

/* --------------------------------- 6. options, degenerate cases, randomness */

{
  const s = C.start({});
  check("toggling names changes only the names flag", C.toggleNames(s).showNames === true &&
    C.toggleNames(s).E.x === s.E.x);
  check("the hint toggle does nothing before the match", C.toggleHint(s) === s);
  const ex = C.solveE(s);
  const solved = C.move(s, "E", { x: ex, y: s.E.y });
  check("the hint becomes available at the match", solved.hintEnabled);
  check("ticking the hint shows it", C.toggleHint(solved).showHint === true);
  const off = C.move(C.toggleHint(solved), "E", { x: ex - 30, y: s.E.y });
  check("leaving the match turns the hint back off and disables it",
    !off.hint && !off.showHint && !off.hintEnabled && !off.finished);
  const again = C.move(off, "E", { x: ex, y: s.E.y });
  check("the match can be made again after leaving it", again.finished && !again.hint);
  check("reset clears the match and the move count", C.start({}).moves === 0 && !C.start({}).finished);

  const collapsed = { A: s.A, B: s.B, C: s.C, E: { x: s.A.x, y: s.A.y }, radius: s.radius };
  const shape = C.compute(collapsed);
  check("A = E returns without K or G, as the Java method does",
    shape.K === null && shape.G === null && !shape.solved);
  check("a collapse does not crash the status line", typeof C.describe(collapsed) === "string");

  const parallelLines = C.compute({ A: { x: 10, y: 20 }, B: { x: 30, y: 20 },
    C: { x: 10, y: 100 }, E: { x: 10, y: 100 }, radius: 10 });
  check("parallel AE and CD give the applet's NaN intersection",
    Number.isNaN(parallelLines.H.x) && Number.isNaN(parallelLines.H.y));

  const rnd = rng(5532);
  let bad = 0;
  for (let i = 0; i < 400; i++) {
    const A = { x: 20 + 60 * rnd(), y: 200 + 60 * rnd() };
    const B = { x: 333, y: A.y };
    const Cpt = { x: 20 + 300 * rnd(), y: 20 + 150 * rnd() };
    const E = { x: 20 + 300 * rnd(), y: Cpt.y };
    const radius = 2 * aDist(A, Cpt);
    const ours = C.compute({ A, B, C: Cpt, E, radius });
    const theirs = appletCompute(A, B, Cpt, E, radius);
    if (!closePoint(ours.H, theirs.H) || !closePoint(ours.K, theirs.K) ||
        !closePoint(ours.G, theirs.G) || ours.solved !== theirs.solved) bad++;
  }
  check("400 seeded random positions agree with the bytecode", bad === 0, `${bad} wrong`);
}

done("hippocrates");
