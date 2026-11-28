#!/usr/bin/env node
"use strict";

/*
 * Logic test for minkowski-addition/minkowski-addition-core.js.
 *
 *   node porting/check-minkowski-addition.mjs
 *
 * Checks the four Reset() positions and all twelve segments of Draw() as a
 * second, literal transcription of the Java bytecode, over every point of a
 * grid and thousands of random configurations.  It also checks the cut-the-
 * knot page's claims independently of the core:
 *
 *   S = A + B - O and S' = A + B - O';
 *   S' - S = O - O' (opposite direction, the same distance);
 *   O, S', S, O' is a parallelogram, its diagonals OS and O'S' being bisected
 *   at the midpoint of AB; OASB and O'AS'B are parallelograms sharing AB;
 *   moving A moves the sum by v, moving A and B by 2v, moving A, B and O by v.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("minkowski-addition/minkowski-addition-core.js", "MinkowskiAdditionCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const add = (p, q) => P(p.x + q.x, p.y + q.y);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closePoint = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);
const zero = P(0, 0);
const tolFor = (...ps) => 1e-8 * Math.max(1, ...ps.filter(closePointSafe).map((p) => dist(zero, p)));
function closePointSafe(p) { return !!p && Number.isFinite(p.x) && Number.isFinite(p.y); }

/* ---------------------------------------- the applet's arithmetic, bytecode */

/* MinkowskiAdditionCanvas.Reset() — the four constants in the bytecode. */
function appletReset() {
  return {
    A: P(152, 194),
    B: P(264, 140),
    O: P(142, 300),
    Op: P(386, 238),
  };
}

/* MinkowskiAdditionCanvas.Draw(): S at local 2, S' at local 3, using dadd
 * and dsub in exactly the order of the bytecode, and the twelve DrawLine calls
 * in their bytecode order with their colours. */
function appletDraw(a, b, o, op) {
  const S = P(a.x + b.x - o.x, a.y + b.y - o.y);
  const Sp = P(a.x + b.x - op.x, a.y + b.y - op.y);
  return {
    S, Sp,
    red: [[o, a], [o, b], [a, S], [b, S]],       // Color.red
    blue: [[op, a], [op, b], [a, Sp], [b, Sp]],  // Color.blue
    pink: [[o, op], [S, Sp], [S, op], [o, Sp]],  // Color.pink
  };
}

/* An independent check of the page's claims, with no use of the core. */
function pageClaims(a, b, o, op) {
  const S = sub(add(a, b), o);
  const Sp = sub(add(a, b), op);
  const M = mid(a, b);
  const t = tolFor(a, b, o, op, S, Sp);
  const eq = (p, q) => dist(p, q) <= t;
  const shift = sub(op, o);
  const sumShift = sub(Sp, S);
  const v = P(7, -11);
  const moveA = sub(sub(add(add(a, v), b), o), S);
  const moveAB = sub(sub(add(add(a, v), add(b, v)), o), S);
  const moveABO = sub(sub(add(add(a, v), add(b, v)), add(o, v)), S);
  return {
    sumAtO: eq(S, sub(add(a, b), o)),
    sumAtOp: eq(Sp, sub(add(a, b), op)),
    opposite: eq(add(sumShift, shift), zero),
    equalLength: close(dist(S, Sp), dist(o, op), t),
    // OASB and O'AS'B: their diagonals OS and O'S' meet at the middle of AB.
    oasb: eq(mid(o, S), M),
    oasbOp: eq(mid(op, Sp), M),
    // The quadrilateral O, S', S, O' has both opposite side pairs equal.
    oSpSOp: eq(add(sub(Sp, o), sub(op, S)), zero) && eq(sub(sub(S, Sp), shift), zero),
    diagonalsBisected: eq(mid(o, S), mid(Sp, op)),
    moveA: eq(moveA, v),
    moveAB: eq(moveAB, P(2 * v.x, 2 * v.y)),
    moveABO: eq(moveABO, v),
  };
}
const ALL_CLAIMS = Object.keys(pageClaims(P(0, 0), P(1, 0), P(0, 1), P(1, 1)));

function compareApplet(label, ap, g) {
  const t = 1e-9;
  const pairs = [
    ["S", g.S, ap.S], ["S'", g.Sp, ap.Sp],
    ...ap.red.map((line, i) => [`red ${i}`, g.red[i], line]),
    ...ap.blue.map((line, i) => [`blue ${i}`, g.blue[i], line]),
    ...ap.pink.map((line, i) => [`pink ${i}`, g.pink[i], line]),
  ];
  for (const [what, actual, expected] of pairs) {
    if (Array.isArray(expected)) {
      if (!closePoint(actual[0], expected[0], t) || !closePoint(actual[1], expected[1], t)) {
        check(`${label}: core ${what} is DrawLine(${expected[0].x},${expected[0].y})-`
          + `(${expected[1].x},${expected[1].y})`, false,
        `got ${JSON.stringify(actual)}`);
      }
    } else if (!closePoint(actual, expected, t)) {
      check(`${label}: core ${what} matches the bytecode`, false,
        `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }
}

/* ------------------------------------------------------- 1. start and rules */

{
  const s = C.start({});
  const r = appletReset();
  equal("Reset puts A at the applet's (152,194)", s.A, r.A);
  equal("Reset puts B at the applet's (264,140)", s.B, r.B);
  equal("Reset puts O at the applet's (142,300)", s.O, r.O);
  equal("Reset puts O' at the applet's (386,238)", s.Op, r.Op);
  check("all three layers start visible",
    s.options.showFirst && s.options.showSecond && s.options.showShift);
  check("a fresh diagram is not explored", !s.explored);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the start position has a construction", !!C.geometry(s));
  check("the start position satisfies every page claim",
    ALL_CLAIMS.every((k) => pageClaims(s.A, s.B, s.O, s.Op)[k]));

  const moved = C.move(s, "A", P(10, 10));
  check("moving a point leaves the old state alone", s.A.x === 152 && moved.A.x === C.PAD);
  check("moving a point marks the diagram explored", moved.explored && !s.explored);
  check("an unknown point is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite point is ignored", C.move(s, "A", P(NaN, 4)) === s);
  const far = C.move(s, "B", P(9999, -9999));
  check("dragged points are clamped to the board",
    far.B.x === C.VIEW.width - C.PAD && far.B.y === C.PAD);
  check("the applet's Reset point at y=300 fits inside the viewBox",
    s.O.y <= C.VIEW.height - C.PAD);
  const hidden = C.setOption(s, "showShift", false);
  check("a layer toggle switches off and marks explored",
    !hidden.options.showShift && hidden.explored && s.options.showShift);
  check("an unknown layer is ignored", C.setOption(s, "nope", true) === s);
  const reset = C.reset(hidden);
  check("Reset restores all four points", reset.A.x === 152 && reset.Op.y === 238);
  check("Reset keeps the layer choices", !reset.options.showShift && reset.explored);
  check("status describes the two sums", /S = A \+ B - O/.test(C.describe(s)));
  check("status states the opposite-shift claim", /opposite direction/.test(C.describe(s)));
  check("a non-finite state has a helpful status", typeof C.describe({ A: P(NaN, 0) }) === "string");
}

/* --------------------------------- 2. the exact claim, on every grid point */

{
  const xs = [18, 90, 160, 230, 300, 372];
  const ys = [18, 90, 160, 230, 300];
  let tested = 0, failures = 0, coreFailures = 0;
  /* A and B from the 6x5 grid, O and O' from a smaller one: 30*30*9*9 =
   * 72,900 configurations, all checked. */
  const smallX = [30, 200, 370];
  const smallY = [30, 160, 290];
  for (const ax of xs) for (const ay of ys) for (const bx of xs) for (const by of ys) {
    const a = P(ax, ay), b = P(bx, by);
    for (const ox of smallX) for (const oy of smallY) {
      const o = P(ox, oy);
      for (const opx of smallX) for (const opy of smallY) {
        const op = P(opx, opy);
        const claim = pageClaims(a, b, o, op);
        const g = C.compute(a, b, o, op);
        tested++;
        const bad = ALL_CLAIMS.filter((k) => !claim[k]);
        if (bad.length) {
          failures++;
          check(`grid ${ax},${ay};${bx},${by};${ox},${oy};${opx},${opy}: claim`, false, bad.join(","));
          continue;
        }
        const coreName = {
          sumAtO: "sumAtO", sumAtOp: "sumAtOp", opposite: "oppositeShift",
          equalLength: "equalLength", oasb: "bisectedAtMidAB", oasbOp: "bisectedAtMidAB",
          oSpSOp: "OSpSOpParallelogram", diagonalsBisected: "OSpSOpParallelogram",
          moveA: "shiftA", moveAB: "shiftAB", moveABO: "shiftABO",
        };
        if (!g || ALL_CLAIMS.some((k) => !g.claims[coreName[k]])) {
          coreFailures++;
          check(`grid ${ax},${ay};${bx},${by};${ox},${oy};${opx},${opy}: core agrees`, false,
            JSON.stringify(g && g.claims));
        }
        // Check the independent page claim's numbers directly too.
        if (!closePoint(g.S, sub(add(a, b), o), 1e-9)
          || !closePoint(g.Sp, sub(add(a, b), op), 1e-9)
          || !closePoint(g.M, mid(a, b), 1e-9)) {
          coreFailures++;
          check(`grid ${ax},${ay};${bx},${by};${ox},${oy};${opx},${opy}: core points`, false);
        }
      }
    }
  }
  check(`the page's whole claim holds on all ${tested} grid configurations`,
    tested === 72900 && failures === 0);
  check(`the core agrees with the claim on all ${tested} configurations`, coreFailures === 0);
}

/* --------------------------- 3. the opposite shift, independently measured */

{
  /* No use of S or S' from the core: build them from the page's formula and
   * compare the displacement with the origin displacement, over random data. */
  const rand = rng(7319);
  let worstOpp = 0, worstLen = 0, worstPara = 0, worstMid = 0;
  for (let i = 0; i < 4000; i++) {
    const a = P(rand() * 420, rand() * 330);
    const b = P(rand() * 420, rand() * 330);
    const o = P(rand() * 420, rand() * 330);
    const op = P(rand() * 420, rand() * 330);
    const S = P(a.x + b.x - o.x, a.y + b.y - o.y);
    const Sp = P(a.x + b.x - op.x, a.y + b.y - op.y);
    const dS = sub(Sp, S), dO = sub(op, o);
    worstOpp = Math.max(worstOpp, dist(add(dS, dO), zero));
    worstLen = Math.max(worstLen, Math.abs(dist(dS, zero) - dist(dO, zero)));
    worstPara = Math.max(worstPara,
      dist(add(sub(Sp, o), sub(op, S)), zero),
      dist(sub(sub(S, Sp), dO), zero));
    worstMid = Math.max(worstMid, dist(mid(o, S), mid(Sp, op)), dist(mid(o, S), mid(a, b)));
  }
  check("S' - S + O' - O is zero on 4000 random configurations", worstOpp < 1e-9);
  check("|S' - S| equals |O' - O| on 4000 random configurations", worstLen < 1e-9);
  check("opposite sides of O,S',S,O' are equal on 4000 configurations", worstPara < 1e-9);
  check("both diagonals are bisected at the midpoint of AB on 4000 cases", worstMid < 1e-9);
}

/* ---------------- 4. the twelve drawn segments, straight from the bytecode */

{
  const rand = rng(4112);
  const start = appletReset();
  const fixed = [
    ["the Reset position", start],
    ["coincident origins", { A: P(100, 100), B: P(240, 90), O: P(160, 200), Op: P(160, 200) }],
    ["coincident A and B", { A: P(120, 120), B: P(120, 120), O: P(60, 240), Op: P(340, 60) }],
    ["a flat line", { A: P(40, 150), B: P(200, 150), O: P(300, 150), Op: P(390, 150) }],
    ["a crossed first parallelogram", { A: P(300, 70), B: P(80, 260), O: P(70, 70), Op: P(360, 260) }],
  ];
  for (const [label, q] of fixed) {
    compareApplet(label, appletDraw(q.A, q.B, q.O, q.Op), C.compute(q.A, q.B, q.O, q.Op));
  }
  let compared = 0;
  for (let i = 0; i < 2000; i++) {
    const q = {
      A: P(20 + rand() * 380, 20 + rand() * 290),
      B: P(20 + rand() * 380, 20 + rand() * 290),
      O: P(20 + rand() * 380, 20 + rand() * 290),
      Op: P(20 + rand() * 380, 20 + rand() * 290),
    };
    compareApplet(`random ${i}`, appletDraw(q.A, q.B, q.O, q.Op), C.compute(q.A, q.B, q.O, q.Op));
    compared++;
  }
  check(`core matches all 12 DrawLine calls on ${fixed.length + compared} configurations`,
    compared === 2000);
  const ap = appletDraw(start.A, start.B, start.O, start.Op);
  equal("the bytecode's first sum at Reset is (274,34)", ap.S, P(274, 34));
  equal("the bytecode's second sum at Reset is (30,96)", ap.Sp, P(30, 96));
  check("the applet's Reset sum shift is exactly minus the origin shift",
    closePoint(add(sub(ap.Sp, ap.S), sub(start.Op, start.O)), zero, 1e-9));
  check("both Reset parallelograms are bisected at (208,167)",
    closePoint(mid(start.O, ap.S), P(208, 167), 1e-9)
      && closePoint(mid(start.Op, ap.Sp), P(208, 167), 1e-9)
      && closePoint(mid(start.A, start.B), P(208, 167), 1e-9));
}

/* ---------------------------------------- 5. degenerate and invalid input is safe */

{
  check("non-finite input gives no construction",
    C.compute(P(NaN, 3), P(1, 2), P(4, 5), P(6, 7)) === null);
  check("a missing input gives no construction", C.compute(null, P(1, 2), P(4, 5), P(6, 7)) === null);
  check("coincident origins still give a construction", !!C.compute(P(1, 2), P(3, 4), P(5, 6), P(5, 6)));
  const same = C.compute(P(1, 2), P(3, 4), P(5, 6), P(5, 6));
  check("coincident origins make the two sums coincide, satisfying the claim",
    closePoint(same.S, same.Sp, 1e-12) && same.claims.oppositeShift && same.claims.OSpSOpParallelogram);
  const degenerateState = C.move(C.start(), "Op", P(142, 300));
  check("a degenerate drag still has a status", /S = A \+ B/.test(C.describe(degenerateState)));
  check("a degenerate drag still has no result", C.result(degenerateState) === null);
  check("the core never touches the DOM", typeof globalThis.document === "undefined"
    && typeof globalThis.window === "undefined");
}

done("minkowski-addition");
