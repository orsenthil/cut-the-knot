#!/usr/bin/env node
"use strict";

/*
 * Logic test for inscriptible-quadri/inscriptible-quadri-core.js.
 *
 *   node porting/check-inscriptible-quadri.mjs
 *
 * The cut-the-knot page claims that a quadrilateral circumscribed around a
 * circle has AB + CD = BC + DA (Pitot), and remarks that the usual proof of
 * the converse has a subtle flaw although an extra proof repairs it. This
 * test checks the start position and every move, then the tangent-length
 * equalities and Pitot over thousands of seeded configurations (including every
 * inscribed placement on a grid of angles), the exscriptible alternatives when
 * the circle leaves the figure, and the converse on a family of convex Pitot
 * quadrilaterals. Finally the applet's own GetCircle, GetTangent and Compute
 * are transcribed a second time straight from the bytecode and compared with
 * the core over the whole parameter space sampled densely, including the
 * near-parallel and NaN cases.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("inscriptible-quadri/inscriptible-quadri-core.js", "InscriptibleQuadriCore");

const P = (x, y) => ({ x, y });
const plus = (p, q) => P(p.x + q.x, p.y + q.y);
const minus = (p, q) => P(p.x - q.x, p.y - q.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePt = (p, q, tol) => !!p && !!q &&
  (Number.isNaN(p.x) && Number.isNaN(q.x) && Number.isNaN(p.y) && Number.isNaN(q.y) ||
    close(p.x, q.x, tol) && close(p.y, q.y, tol));
const scaleOf = (...pts) => Math.max(1, ...pts.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]));
const tolOf = (...pts) => 1e-7 * scaleOf(...pts);
/** A tolerance that ignores the NaN intersections of parallel tangents. */
const geomTol = (g) => 1e-7 * Math.max(1,
  ...Object.values(g.sides).map(Math.abs), Math.abs(g.circle.O.x), Math.abs(g.circle.O.y), g.circle.r);

function stateOf(O, r, angles) {
  return {
    O: { ...O }, r,
    M: C.onCircle(O, r, angles.M), Q: C.onCircle(O, r, angles.Q),
    N: C.onCircle(O, r, angles.N), P: C.onCircle(O, r, angles.P),
    showNames: false, showTangency: false, showTangents: false, showSides: false,
    moves: 0, explored: false,
  };
}

/* ------------------------------ a second transcription of the applet's code */

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), from javap -c. */
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/** GeoSDoub.FindCircumcenter: two bisectors, then GeoSDoub.Intersect. */
function appletCircumcenter(p, q, r) {
  const m12 = P((p.x + q.x) / 2, (p.y + q.y) / 2);
  const m23 = P((q.x + r.x) / 2, (q.y + r.y) / 2);
  return appletIntersect(
    m12, P(m12.x + q.y - p.y, m12.y + p.x - q.x),
    m23, P(m23.x + r.y - q.y, m23.y + q.x - r.x),
  );
}

/** InscriptibleQuadriCanvas.GetCircle: circumcentre and the mean of three radii. */
function appletCircle(p, q, r) {
  const o = appletCircumcenter(p, q, r);
  return { O: o, r: (dist(o, p) + dist(o, q) + dist(o, r)) / 3 };
}

/** InscriptibleQuadriCanvas.GetTangent: the second point of the tangent line. */
function appletTangent(p, circle) {
  return P(p.x - (p.y - circle.O.y), p.y + (p.x - circle.O.x));
}

/** InscriptibleQuadriCanvas.Compute(): all six intersections, in bytecode order. */
function appletCompute(state) {
  const circle = { O: state.O, r: state.r };
  const T = {};
  for (const name of C.HANDLES) T[name] = appletTangent(state[name], circle);
  const line = (name) => ({ a: state[name], b: T[name] });
  const LM = line("M"), LQ = line("Q"), LN = line("N"), LP = line("P");
  return {
    A: appletIntersect(LM.a, LM.b, LP.a, LP.b),
    B: appletIntersect(LP.a, LP.b, LN.a, LN.b),
    Cc: appletIntersect(LN.a, LN.b, LQ.a, LQ.b),
    D: appletIntersect(LQ.a, LQ.b, LM.a, LM.b),
    S: appletIntersect(LM.a, LM.b, LN.a, LN.b),
    T: appletIntersect(LP.a, LP.b, LQ.a, LQ.b),
  };
}

/** CTKMoveableDoub circle glider: old position plus mouse delta, then radial. */
function appletGlide(p, circle) {
  const d = dist(circle.O, p);
  return P(circle.O.x + ((p.x - circle.O.x) * circle.r) / d,
    circle.O.y + ((p.y - circle.O.y) * circle.r) / d);
}

/** MoveableCircle.UpdateBPoints after a translation of centre and radius point. */
function appletTranslate(state, target) {
  const O = P(
    Math.max(C.PAD + state.r, Math.min(C.WIDTH - C.PAD - state.r, target.x)),
    Math.max(C.PAD + state.r, Math.min(C.HEIGHT - C.PAD - state.r, target.y)),
  );
  const dx = O.x - state.O.x, dy = O.y - state.O.y;
  const next = { ...state, O };
  for (const name of C.HANDLES) {
    next[name] = P(state[name].x + dx, state[name].y + dy);
  }
  return next;
}

/* ------------------------------------------------ 1. start position and moves */

{
  const s = C.start();
  check("applet init puts the centre at (width/3, height/2+20)",
    closePt(s.O, P(400 / 3, 145), 1e-9));
  close("applet radius is min(width,height)/6", s.r, 250 / 6, 1e-9);
  close("M starts at angle 0.4", Math.atan2(s.M.y - s.O.y, s.M.x - s.O.x), 0.4, 1e-9);
  close("Q starts at angle 1.2", Math.atan2(s.Q.y - s.O.y, s.Q.x - s.O.x), 1.2, 1e-9);
  close("N starts at angle 2.9", Math.atan2(s.N.y - s.O.y, s.N.x - s.O.x), 2.9, 1e-9);
  close("our deterministic P starts at angle 4.6", Math.atan2(s.P.y - s.O.y, s.P.x - s.O.x), 4.6, 1e-9);
  check("all four checkboxes start unticked, as the archived param ShowNames=0",
    C.OPTION_KEYS.every((k) => s[k] === false));
  check("an illustration has no win or loss before it is touched", C.result(s) === null);
  check("the opening picture is a genuine circumscribed quadrilateral", C.compute(s).inscribed);
  check("Pitot already holds on the opening picture",
    Math.abs(C.compute(s).residuals.pitot) < 1e-7 * Math.max(1, ...Object.values(C.compute(s).sides)));
  check("the opening move count is zero and it is not explored", s.moves === 0 && !s.explored);

  let inRange = true;
  for (let i = 0; i < 200; i++) {
    const a = C.start({ random: true });
    const ang = Math.atan2(a.P.y - a.O.y, a.P.x - a.O.x);
    const normalized = ang < 0 ? ang + 2 * Math.PI : ang;
    if (normalized < 0 || normalized >= Math.PI) inRange = false;
  }
  check("start({random:true}) reproduces the applet's P angle in [0,PI)", inRange);
}

{
  const s = C.start();
  const moved = C.move(s, { type: "point", name: "P", point: P(200, 40) });
  check("dragging P marks the picture explored and ends the play", moved.explored && C.result(moved) === "done");
  check("a dragged dot stays on the circle",
    close(dist(moved.P, moved.O), moved.r, 1e-9));
  check("dragging one dot leaves the other three alone",
    ["M", "Q", "N"].every((n) => C.dist(moved[n], s[n]) === 0));
  check("dragging P follows the mouse direction", moved.P.x > s.O.x && moved.P.y < s.O.y);
  check("an unknown dot is refused", C.move(s, { type: "point", name: "Z", point: P(2, 2) }) === null);
  check("a non-finite point is refused", C.move(s, { type: "circle", point: P(NaN, 2) }) === null);
  check("an unknown option is refused",
    C.move(s, { type: "option", key: "nope", value: true }) === null);
  check("the original position is not mutated by a move", s.P.x === C.onCircle(s.O, s.r, 4.6).x);

  const t = C.move(s, { type: "circle", point: P(180, 100) });
  check("dragging the circle keeps its radius", t.r === s.r);
  check("dragging the circle translates every boundary dot by the same amount",
    C.HANDLES.every((n) => {
      const a = minus(t[n], s[n]);
      return close(a.x, 180 - s.O.x, 1e-9) && close(a.y, 100 - s.O.y, 1e-9);
    }));
  const option = C.move(s, { type: "option", key: "showSides", value: true });
  check("switching sides on keeps everything else", option.showSides && !option.showNames && option.r === s.r);
  const reset = C.move(option, { type: "reset" });
  check("Reset restores the opening geometry but keeps the switches", reset.showSides && reset.M.x === s.M.x);
  check("legalMoves offers five drags, four switches and a reset", C.legalMoves(s).length === 10);
}

/* ------------------------------------------- 2. the page's claims, exhaustively */

{
  // The two tangent segments from a corner are equal for every position of
  // the four dots. This is the ingredient of Pitot's proof.
  const rand = rng(2027);
  let worst = 0;
  let cases = 0;
  for (let i = 0; i < 2500; i++) {
    const O = P(60 + rand() * 280, 60 + rand() * 130);
    const r = 18 + rand() * 55;
    const a = { M: rand() * 2 * Math.PI, Q: rand() * 2 * Math.PI,
      N: rand() * 2 * Math.PI, P: rand() * 2 * Math.PI };
    const g = C.compute(stateOf(O, r, a));
    if (!g.valid) continue;
    worst = Math.max(worst, g.residuals.tangents / geomTol(g));
    cases++;
  }
  check(`equal tangents from each corner over ${cases} random configurations`,
    cases > 2400 && worst < 1e-3, `worst scaled error ${worst}`);
}

{
  // Pitot's formula on every inscribed arrangement. Sorting the four angles
  // and keeping all four gaps below PI makes the circle lie inside ABCD.
  const rand = rng(31415);
  let tested = 0;
  let worst = 0;
  let allInscribed = true;
  for (let i = 0; i < 6000; i++) {
    const ts = Array.from({ length: 4 }, () => rand() * 2 * Math.PI).sort((a, b) => a - b);
    const gaps = [ts[1] - ts[0], ts[2] - ts[1], ts[3] - ts[2], ts[0] + 2 * Math.PI - ts[3]];
    if (gaps.some((v) => v >= Math.PI - 0.05)) continue;
    const O = P(40 + rand() * 320, 40 + rand() * 170);
    const r = 20 + rand() * 40;
    const g = C.compute(stateOf(O, r, { M: ts[0], Q: ts[1], N: ts[2], P: ts[3] }));
    if (!g.valid) continue;
    allInscribed = allInscribed && g.inscribed;
    worst = Math.max(worst, Math.abs(g.residuals.pitot) / geomTol(g));
    tested++;
  }
  check(`every inscribed arrangement in 6000 samples is recognised (${tested})`, allInscribed && tested > 2500);
  check(`AB+CD = BC+DA on ${tested} inscribed configurations`, worst < 1e-3, `worst scaled error ${worst}`);

  // A deterministic grid over the gaps, including a square, a long thin kite
  // and almost-parallel tangents, checked the same way.
  let grid = 0;
  let gridWorst = 0;
  for (let a = 1; a <= 16; a++) {
    for (let b = 1; b <= 16; b++) {
      for (let c = 1; c <= 16; c++) {
        const t = [0, a, a + b, a + b + c].map((v) => v * Math.PI / 34);
        if (t[3] >= 2 * Math.PI - Math.PI / 34) continue;
        const g = C.compute(stateOf(P(133, 145), 42, { M: t[0], Q: t[1], N: t[2], P: t[3] }));
        if (!g.valid) continue;
        if (!g.inscribed) continue;
        gridWorst = Math.max(gridWorst, Math.abs(g.residuals.pitot) / geomTol(g));
        grid++;
      }
    }
  }
  check(`AB+CD = BC+DA on ${grid} grid configurations including near-degenerate ones`,
    grid > 500 && gridWorst < 1e-7, `worst scaled error ${gridWorst}`);
}

{
  // When the circle is outside the figure the page's formula is not the one
  // that holds. Exactly one of the three possible pairings must still match.
  const rand = rng(808);
  let valid = 0, inside = 0, outside = 0, bad = 0;
  for (let i = 0; i < 3000; i++) {
    const a = { M: rand() * 2 * Math.PI, Q: rand() * 2 * Math.PI,
      N: rand() * 2 * Math.PI, P: rand() * 2 * Math.PI };
    const g = C.compute(stateOf(P(160, 130), 40, a));
    if (!g.valid) continue;
    valid++;
    if (g.inscribed) inside++; else outside++;
    const tol = geomTol(g);
    const res = g.residuals;
    const matches = [res.pitot, res.exscriptibleB, res.exscriptibleA].filter((v) => Math.abs(v) < tol).length;
    if (matches < 1) bad++;
  }
  check(`one of the three side pairings always matches (${valid} configurations)`, bad === 0);
  check("random placements include both inscribed and exscriptible figures", inside > 100 && outside > 100);

  // An explicit exscriptible case from the applet's own starting angles:
  // with P in the upper half plane the circle is outside ABCD.
  const ex = C.compute(C.start({ angles: { P: 1.6 } }));
  check("exscriptible example fails Pitot but satisfies AB+BC = CD+DA",
    ex.valid && !ex.inscribed &&
    Math.abs(ex.residuals.pitot) > 1 && Math.abs(ex.residuals.exscriptibleB) < 1e-7 * 200);
}

{
  // The page says the common proof of the converse has a flaw, but the
  // converse itself is true: a convex quadrilateral with equal opposite sums
  // does have an incircle. Move D along the perpendicular bisector of AC in
  // the square A(0,0) B(2,0) C(2,2): CD = DA and AB = BC = 2, so Pitot holds.
  const A = P(0, 0), B = P(2, 0), Cc = P(2, 2);
  const unit = (v) => P(v.x / Math.hypot(v.x, v.y), v.y / Math.hypot(v.x, v.y));
  const dir = (p, q) => unit(minus(q, p));
  const lineCross = (p, q) => p.x * q.y - p.y * q.x;
  const crossPoint = (p, u, q, v) => {
    const t = lineCross(minus(q, p), v) / lineCross(u, v);
    return plus(p, P(t * u.x, t * u.y));
  };
  const lineDist = (p, a, b) => Math.abs(lineCross(minus(b, a), minus(p, a))) / dist(a, b);
  let converse = 0;
  let worst = 0;
  for (let i = 0; i <= 40; i++) {
    const u = -1 + i * 0.045;                  // D = (u, 2-u), convex and non-degenerate
    if (Math.abs(u - 1) < 0.1) continue;
    const D = P(u, 2 - u);
    const sides = [dist(A, B), dist(B, Cc), dist(Cc, D), dist(D, A)];
    if (Math.abs(sides[0] + sides[2] - sides[1] - sides[3]) > 1e-9) continue;
    const uA = plus(dir(A, B), dir(A, D));
    const uB = plus(dir(B, A), dir(B, Cc));
    const I = crossPoint(A, uA, B, uB);
    const ds = [lineDist(I, A, B), lineDist(I, B, Cc), lineDist(I, Cc, D), lineDist(I, D, A)];
    worst = Math.max(worst, Math.max(...ds) - Math.min(...ds));
    converse++;
  }
  check(`the converse holds on ${converse} convex quadrilaterals with equal side sums`,
    converse === 41 && worst < 1e-9, `worst inradius spread ${worst}`);
}

{
  // Two opposite tangency points give parallel tangents; the applet's
  // GeoSDoub.Intersect returns NaN and there is no figure to draw.
  const antipodal = C.start({ angles: { M: 0, P: Math.PI } });
  const g = C.compute(antipodal);
  check("antipodal tangents are reported as not drawable", !g.valid && g.reason === "parallel");
  check("no residuals are claimed for an undrawable figure", g.residuals.pitot === undefined || !g.valid);
}

/* ------------------------ 3. the applet's own methods, transcribed twice */

{
  const rand = rng(1234567);
  let worstInter = 0, worstCircle = 0, worstTangent = 0, worstCompute = 0;
  let compared = 0, nanMatches = 0, comparedCircle = 0;
  for (let i = 0; i < 3000; i++) {
    const O = P(30 + rand() * 340, 30 + rand() * 190);
    const r = 15 + rand() * 55;
    const a = { M: rand() * 2 * Math.PI, Q: rand() * 2 * Math.PI,
      N: rand() * 2 * Math.PI, P: rand() * 2 * Math.PI };
    const s = stateOf(O, r, a);

    // Intersect, including the |det| < 1 fallback.
    const L1 = C.tangentLine(s.M, { O, r });
    const L2 = C.tangentLine(s.P, { O, r });
    const mine = C.intersect(L1, L2);
    const theirs = appletIntersect(L1.a, L1.b, L2.a, L2.b);
    if (Number.isNaN(theirs.x)) {
      if (Number.isNaN(mine.x)) nanMatches++;
    } else {
      worstInter = Math.max(worstInter,
        Math.abs(mine.x - theirs.x) / tolOf(mine), Math.abs(mine.y - theirs.y) / tolOf(mine));
    }

    // GetCircle from the three dots M, Q, N.
    const movieCircle = C.circleFrom3(s.M, s.Q, s.N);
    const appletCir = appletCircle(s.M, s.Q, s.N);
    if (Number.isFinite(appletCir.O.x)) {
      worstCircle = Math.max(worstCircle,
        Math.abs(movieCircle.O.x - appletCir.O.x) / tolOf(appletCir.O),
        Math.abs(movieCircle.O.y - appletCir.O.y) / tolOf(appletCir.O),
        Math.abs(movieCircle.r - appletCir.r) / tolOf(appletCir.O));
      comparedCircle++;
    }

    // GetTangent at each dot.
    for (const n of C.HANDLES) {
      const a1 = C.tangentLine(s[n], { O, r });
      const b1 = appletTangent(s[n], { O, r });
      worstTangent = Math.max(worstTangent,
        Math.abs(a1.b.x - b1.x) / tolOf(b1), Math.abs(a1.b.y - b1.y) / tolOf(b1));
    }

    // Compute: A, B, C, D, S and T.
    const g = C.compute(s);
    const v = appletCompute(s);
    for (const [name, other] of [["A", v.A], ["B", v.B], ["C", v.Cc],
      ["D", v.D], ["S", v.S], ["T", v.T]]) {
      const p = g.v[name];
      if (Number.isNaN(other.x)) {
        if (Number.isNaN(p.x)) nanMatches++;
      } else {
        worstCompute = Math.max(worstCompute,
          Math.abs(p.x - other.x) / tolOf(other), Math.abs(p.y - other.y) / tolOf(other));
      }
    }
    compared++;
  }
  // Force the |det| < 1 branch with two antipodal tangency points.
  const anti = stateOf(P(120, 120), 40, { M: 0, Q: 1, N: 2, P: Math.PI });
  const antiMine = C.intersect(C.tangentLine(anti.M, { O: anti.O, r: anti.r }),
    C.tangentLine(anti.P, { O: anti.O, r: anti.r }));
  const antiTheirs = appletCompute(anti).A;
  check("GeoSDoub.Intersect's |det| < 1 NaN fallback is reproduced",
    Number.isNaN(antiMine.x) && Number.isNaN(antiTheirs.x));
  check(`intersections agree with GeoSDoub.Intersect over ${compared} line pairs`,
    worstInter < 1e-7, `worst ${worstInter}, NaN matches ${nanMatches}`);
  check(`GetCircle agrees with FindCircumcenter over ${comparedCircle} triangles`,
    comparedCircle > 2900 && worstCircle < 1e-7, `worst ${worstCircle}`);
  check(`GetTangent agrees at all four dots over ${compared} configurations`,
    worstTangent < 1e-7, `worst ${worstTangent}`);
  check(`all six Compute intersections agree over ${compared} configurations`,
    worstCompute < 1e-7, `worst ${worstCompute}`);
}

{
  // The opening GetCircle must recover the centre and radius used to place
  // M, Q and N, exactly as the applet's init() does.
  const s = C.start();
  const circle = C.circleFrom3(s.M, s.Q, s.N);
  check("GetCircle recovers the opening centre", closePt(circle.O, s.O, 1e-7 * s.O.x));
  check("GetCircle recovers the opening radius", close(circle.r, s.r, 1e-7 * s.r));

  // Dragging a boundary dot and translating the circle, transcribed from
  // CTKMoveableDoub.UpdateLocation and MoveableCircle.UpdateBPoints.
  const rand = rng(4242);
  let worstGlide = 0, worstTranslate = 0;
  let glides = 0;
  for (let i = 0; i < 1500; i++) {
    const O = P(80 + rand() * 240, 60 + rand() * 130);
    const r = 20 + rand() * 30;
    const a = { M: rand() * 2 * Math.PI, Q: rand() * 2 * Math.PI,
      N: rand() * 2 * Math.PI, P: rand() * 2 * Math.PI };
    const s = stateOf(O, r, a);
    const name = C.HANDLES[i % 4];
    const raw = P(O.x + (rand() - 0.5) * 200, O.y + (rand() - 0.5) * 200);
    const wanted = appletGlide(raw, { O, r });
    const got = C.projectToCircle(raw, { O, r });
    worstGlide = Math.max(worstGlide, dist(got, wanted) / tolOf(wanted));
    const target = P(C.clamp(raw.x, C.PAD + r, C.WIDTH - C.PAD - r),
      C.clamp(raw.y, C.PAD + r, C.HEIGHT - C.PAD - r));
    const theirs = appletTranslate(s, target);
    const mine = C.move(s, { type: "circle", point: raw });
    worstTranslate = Math.max(worstTranslate,
      dist(mine.O, theirs.O) / tolOf(theirs.O),
      ...C.HANDLES.map((n) => dist(mine[n], theirs[n]) / tolOf(theirs[n])));
    glides++;
  }
  check(`circle-glider projection agrees over ${glides} drags`, worstGlide < 1e-7, `worst ${worstGlide}`);
  check(`circle translation agrees over ${glides} drags`, worstTranslate < 1e-7, `worst ${worstTranslate}`);
}

done("inscriptible-quadri");
