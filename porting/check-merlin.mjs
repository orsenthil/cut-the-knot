#!/usr/bin/env node
"use strict";

/*
 * Logic test for merlin/merlin-core.js.
 *
 *   node porting/check-merlin.mjs
 *
 * The rules against the page's description (pressing 1 advances 1, 2, 4, 5), the
 * applet's three matrices against its integer inverses (A times the inverse is
 * det times the identity: 5, 80, -7), the hint (the applet's formula)
 * solving every board: all 512 x 512 pairs for N = 2, every board for N = 3 against
 * the ring target and 200,000 random board and target pairs for N = 3 and 4.
 * The page's claims: the plane matrix has determinant 5 and is invertible mod N
 * for N = 2, 3, 4 and not for 5; the torus matrix has determinant 80 and of 2, 3, 4
 * only N = 3 works (the others are not one-to-one); the matrix has a double
 * eigenvalue 1 with two independent eigenvectors; the order of presses does not
 * matter; the hint columns give A^-1. Then the game: a press and Undo cancel, with
 * the hint on or off, the hint always solves the board, pressing the hint solves it.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("merlin/merlin-core.js", "MerlinCore");
const mod = (v, n) => ((v % n) + n) % n;
const matVec = (M, v) => M.map((r) => r.reduce((t, x, k) => t + x * v[k], 0));
const matMul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((t, v, k) => t + v * B[k][j], 0)));

/* ------------------------------------------------------------ 1. the rules */
{
  const cells = (g, k) => C.pressVector(g, k).map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  equal("plane, button 1 (index 0): advances 1, 2, 4, 5 (index 0, 1, 3, 4), as the page says", cells(C.PLANE, 0), [0, 1, 3, 4]);
  equal("plane, a corner: itself, two edge neighbours and the centre (all four corners)", [0, 2, 6, 8].map((k) => cells(C.PLANE, k)), [[0, 1, 3, 4], [1, 2, 4, 5], [3, 4, 6, 7], [4, 5, 7, 8]]);
  equal("plane, a side: the three in its line along the edge", [1, 3, 5, 7].map((k) => cells(C.PLANE, k)), [[0, 1, 2], [0, 3, 6], [2, 5, 8], [6, 7, 8]]);
  equal("plane, the centre: itself and the four sides", cells(C.PLANE, 4), [1, 3, 4, 5, 7]);
  equal("torus: itself, its row and its column", [0, 4].map((k) => cells(C.TORUS, k)), [[0, 1, 2, 3, 6], [1, 3, 4, 5, 7]]);
  equal("the hidden rules: a press advances itself and its four neighbours (Lights Out)", [0, 4, 7].map((k) => cells(C.MYSTERY, k)), [[0, 1, 3], [1, 3, 4, 5, 7], [4, 6, 7, 8]]);
  equal("the ring target: t = (1,1,1,1,0,1,1,1,1)", C.RING, [1, 1, 1, 1, 0, 1, 1, 1, 1]);
  equal("names", C.NAMES, ["Plane", "Torus", "Don't touch"]);
}

/* -------------------------------- 2. the matrices against their inverses */
const A = (g) => C.MATRIX[g];
const matrixAs = (g) => A(g); // MATRIX[g][cell][pressed]
{
  const dets = [5, 80, -7];
  for (let g = 0; g < 3; g++) {
    const P = matMul(A(g), C.INVERSE[g]);
    equal(`matrix ${g} times its inverse is ${dets[g]} times the identity`, P.every((r, i) => r.every((v, j) => v === (i === j ? dets[g] : 0))), true);
  }
  equal("the applet's inverse of the determinant mod N (N = 2, 3, 4)", C.INVERSE_DET, [1, 2, 1]);
}

/* --------------- 3. the hint solves every board, and the unique s */
function solvesAll(g, n, pairs) {
  let bad = 0, count = 0;
  for (const [x, t] of pairs) {
    count++;
    const s = C.solve({ n, geometry: g, values: x, target: t });
    const got = matVec(A(g), s).map((v, i) => mod(x[i] + v, n));
    if (s.some((v) => v < 0 || v >= n) || got.some((v, i) => v !== t[i])) bad++;
  }
  return [bad, count];
}
{
  const all = (n) => { const out = []; const total = Math.pow(n, 9); for (let m = 0; m < total; m++) { const v = []; let x = m; for (let i = 0; i < 9; i++) { v.push(x % n); x = Math.floor(x / n); } out.push(v); } return out; };
  const r = rng(11), rand = (n) => Array.from({ length: 9 }, () => Math.floor(r() * n));
  for (const g of [C.PLANE, C.MYSTERY]) {
    const b2 = all(2); const pairs2 = []; for (const x of b2) for (const t of b2) pairs2.push([x, t]);
    const [bad2, n2] = solvesAll(g, 2, pairs2);
    equal(`geometry ${g}, N = 2: the hint solves all ${n2.toLocaleString()} (board, target) pairs`, bad2, 0);
    const ring3 = C.RING.map((v) => v % 3);
    const [bad3, n3] = solvesAll(g, 3, all(3).map((x) => [x, ring3]));
    equal(`geometry ${g}, N = 3: every one of the ${n3.toLocaleString()} boards solves to the ring`, bad3, 0);
    const [bad4, n4] = solvesAll(g, 4, Array.from({ length: 50000 }, () => [rand(4), rand(4)]));
    equal(`geometry ${g}, N = 4: ${n4.toLocaleString()} random (board, target) pairs`, bad4, 0);
    const [bad3r, n3r] = solvesAll(g, 3, Array.from({ length: 50000 }, () => [rand(3), rand(3)]));
    equal(`geometry ${g}, N = 3: ${n3r.toLocaleString()} random pairs`, bad3r, 0);
  }
  const [badT, nT] = solvesAll(C.TORUS, 3, Array.from({ length: 50000 }, () => [rand(3), rand(3)]));
  equal(`torus, N = 3: ${nT.toLocaleString()} random pairs`, badT, 0);
  const ring3 = C.RING.map((v) => v % 3);
  const [badTa, nTa] = solvesAll(C.TORUS, 3, all(3).map((x) => [x, ring3]));
  equal(`torus, N = 3: every one of ${nTa.toLocaleString()} boards solves to the ring`, badTa, 0);
}

/* -------- 4. the page's claims: when is the puzzle always solvable? */
{
  const imageSize = (g, n) => { const seen = new Set(); const total = Math.pow(n, 9); for (let m = 0; m < total; m++) { const v = []; let x = m; for (let i = 0; i < 9; i++) { v.push(x % n); x = Math.floor(x / n); } seen.add(matVec(A(g), v).map((q) => q % n).join("")); } return seen.size; };
  for (const n of [2, 3, 4]) equal(`plane, N = ${n}: every pattern of presses gives a different board (A is invertible)`, imageSize(C.PLANE, n), Math.pow(n, 9));
  equal("plane, N = 5: not invertible (5 divides the determinant), so some boards cannot be reached", imageSize(C.PLANE, 5) < Math.pow(5, 9), true);
  equal("torus, N = 3: invertible", imageSize(C.TORUS, 3), Math.pow(3, 9));
  equal("torus, N = 2: not invertible", imageSize(C.TORUS, 2) < 512, true);
  equal("torus, N = 4: not invertible", imageSize(C.TORUS, 4) < Math.pow(4, 9), true);
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  equal("determinants: invertible mod N exactly when gcd(det, N) = 1 (plane 5, torus 80)", [2, 3, 4, 5, 6].map((n) => [gcd(5, n) === 1, gcd(80, n) === 1]), [[true, false], [true, true], [true, false], [false, false], [true, false]]);
}

/* ------------- 5. the page's other questions: eigenvalue 1, the inverse, the order of presses */
{
  // eigenvalue 1 of the plane matrix: its characteristic polynomial and eigenspace
  const M = A(C.PLANE), n = 9;
  // Faddeev-LeVerrier: coefficients of det(xI - M)
  let Mk = M.map((r) => r.slice()), c = [1], I = M.map((_, i) => M.map((_, j) => (i === j ? 1 : 0)));
  const coeffs = [1];
  let prev = I;
  for (let k = 1; k <= n; k++) {
    const AM = matMul(M, prev);
    const ck = -AM.reduce((t, r, i) => t + r[i], 0) / k;
    coeffs.push(ck);
    prev = AM.map((r, i) => r.map((v, j) => v + (i === j ? ck : 0)));
  }
  const p = (x) => coeffs.reduce((t, a) => t * x + a, 0);
  const dp = (x) => { let t = 0; const d = coeffs.length - 1; coeffs.forEach((a, i) => { const e = d - i; if (e > 0) t += a * e * Math.pow(x, e - 1); }); return t; };
  const ddp = (x) => { let t = 0; const d = coeffs.length - 1; coeffs.forEach((a, i) => { const e = d - i; if (e > 1) t += a * e * (e - 1) * Math.pow(x, e - 2); }); return t; };
  equal("1 is a root of the characteristic polynomial, a double root (not a triple)", [p(1), dp(1), ddp(1) !== 0], [0, 0, true]);
  equal("the constant term is the determinant 5 (det of A = (-1)^9 times it... up to sign)", Math.abs(coeffs[9]), 5);
  // two independent eigenvectors with entries in -1..1
  const vecs = [];
  const entries = [-1, 0, 1];
  for (let m = 0; m < Math.pow(3, 9); m++) {
    const v = []; let x = m; for (let i = 0; i < 9; i++) { v.push(entries[x % 3]); x = Math.floor(x / 3); }
    if (v.every((q) => q === 0)) continue;
    const w = matVec(M, v);
    if (w.every((q, i) => q === v[i])) vecs.push(v);
  }
  equal("there are eigenvectors for the eigenvalue 1 (with entries -1, 0, 1)", vecs.length > 2, true);
  const indep = (u, v) => { for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) if (u[i] * v[j] - u[j] * v[i] !== 0) return true; return false; };
  let pair = null; for (const u of vecs) for (const v of vecs) if (!pair && indep(u, v)) pair = [u, v];
  equal("two of them are independent", pair !== null, true);
  // nothing more: the eigenspace is exactly 2-dimensional (rank of A - I is 7), by elimination over the rationals
  const B = M.map((r, i) => r.map((v, j) => v - (i === j ? 1 : 0)));
  const rank = (X) => { const R = X.map((r) => r.slice()); let rk = 0; for (let col = 0; col < 9 && rk < 9; col++) { let piv = -1; for (let i = rk; i < 9; i++) if (Math.abs(R[i][col]) > 1e-9) { piv = i; break; } if (piv < 0) continue; [R[rk], R[piv]] = [R[piv], R[rk]]; for (let i = 0; i < 9; i++) if (i !== rk) { const f = R[i][col] / R[rk][col]; for (let j = col; j < 9; j++) R[i][j] -= f * R[rk][j]; } rk++; } return rk; };
  equal("rank of A - I is 7: the eigenspace has exactly two dimensions", rank(B), 7);
  // and mod 2, 3, 4 the same vectors are eigenvectors
  equal("the two eigenvectors satisfy A v = v mod 2, 3 and 4", [2, 3, 4].every((N) => pair.every((v) => matVec(M, v).every((q, i) => mod(q - v[i], N) === 0))), true);
}
{
  // the hint columns give A^-1: with target - board = e_i the hint is column i of the inverse mod N
  const bad = [];
  for (const n of [2, 3, 4]) for (let i = 0; i < 9; i++) {
    const e = Array(9).fill(0); e[i] = 1;
    const s = C.solve({ n, geometry: C.PLANE, values: Array(9).fill(0), target: e });
    const col = matVec(A(C.PLANE), s).map((q) => mod(q, n));
    if (col.some((q, k) => q !== e[k])) bad.push([n, i]);
  }
  equal("hint for target - board = e_i is a column of A^-1: A times it is e_i (all i, N = 2, 3, 4)", bad, []);
  // the page's unknown-rules question: set the target to 0, apply e_i with the hint on; the board gives the press
  const s0 = { ...C.start({ random: rng(3) }), values: Array(9).fill(0), target: Array(9).fill(0) };
  const r = rng(5);
  let ok = true;
  for (let g = 0; g < 3; g++) for (let i = 0; i < 9; i++) {
    let s = { ...s0, geometry: g, values: Array(9).fill(0), target: Array(9).fill(0) };
    s = C.editTarget(s, i);                       // target e_i
    s = C.setHint(s, true); s = C.setHint(s, false);  // hint on then off keeps the board
    const hint = C.solve({ ...s, values: Array(9).fill(0) });
    // pressing e_i's solution on the zero board reaches the target e_i
    let b = { ...s, values: Array(9).fill(0), hintOn: false, stack: [] };
    hint.forEach((h, cell) => { for (let t = 0; t < h; t++) b = C.press(b, cell); });
    if (!C.solved(b)) ok = false;
  }
  equal("the three rule sets can be recovered by experiment (e_i targets are all reachable)", ok, true);
  // order of presses does not matter
  let bad2 = 0;
  for (let k = 0; k < 500; k++) {
    const seq = Array.from({ length: 12 }, () => Math.floor(r() * 9)), shuf = seq.slice().sort(() => r() - 0.5);
    const g = Math.floor(r() * 3), n = g === 1 ? 3 : [2, 3, 4][Math.floor(r() * 3)];
    const base = { n, geometry: g, values: Array.from({ length: 9 }, () => Math.floor(r() * n)), target: C.RING.map((v) => v % n), hint: Array(9).fill(0), hintOn: false, stack: [] };
    const run = (sq) => sq.reduce((s, c) => C.press(s, c), base).values.join("");
    if (run(seq) !== run(shuf)) bad2++;
  }
  equal("two sequences of presses with the same counts give the same board (500 random pairs)", bad2, 0);
}

/* ------------------------------------------------------------ 6. the game */
{
  const r = rng(99);
  let badUndo = 0, badHint = 0, badSolve = 0, badEdit = 0, steps = 0;
  for (let k = 0; k < 600; k++) {
    const g = Math.floor(r() * 3), n = g === 1 ? 3 : [2, 3, 4][Math.floor(r() * 3)];
    let s = C.reset({ n, geometry: g }, r);
    if (!(s.stack.length === 0 && s.values.every((v) => v >= 0 && v < n))) badSolve++;
    const start = s;
    for (let m = 0; m < 10; m++) {
      steps++;
      const cell = Math.floor(r() * 9), turn = r();
      if (turn < 0.15) s = C.setHint(s, !s.hintOn);
      else if (turn < 0.25) s = C.editTarget(s, cell);
      else if (turn < 0.35 && s.stack.length) s = C.undo(s);
      else s = C.press(s, cell);
      // while the hint is on, board and hint are tied by t = x + A s
      if (s.hintOn) {
        const left = matVec(A(g), s.hint).map((v, i) => mod(s.values[i] + v, n));
        if (left.some((v, i) => v !== s.target[i])) badHint++;
      }
    }
    // press then undo is a no-op
    const t = C.press(s, 4), u = C.undo(t);
    if (JSON.stringify(u.values) !== JSON.stringify(s.values) || u.stack.length !== s.stack.length) badUndo++;
    // pressing the hint's presses solves the board
    let b = { ...s, hintOn: false, stack: [] };
    C.solve(b).forEach((h, cell) => { for (let q = 0; q < h; q++) b = C.press(b, cell); });
    if (!C.solved(b) || C.result(b) !== "win") badSolve++;
    // editing the target with the hint on keeps the hint right
    let e = C.setHint({ ...s, hintOn: false }, true);
    e = C.editTarget(e, 2);
    if (matVec(A(g), e.hint).map((v, i) => mod(e.values[i] + v, n)).some((v, i) => v !== e.target[i])) badEdit++;
  }
  equal(`${steps} random actions: with the hint on, t = x + A s always holds`, badHint, 0);
  equal("a press then Undo changes nothing (600 boards)", badUndo, 0);
  equal("pressing what the hint says always solves the board (600 boards)", badSolve, 0);
  equal("editing the target with the hint on keeps the hint right", badEdit, 0);
}
{
  const s = C.start({ random: rng(4) });
  equal("a new game: plane, 3 states, no stack, hint off", [s.geometry, s.n, s.stack.length, s.hintOn, s.target], [0, 3, 0, false, C.RING.map((v) => v % 3)]);
  equal("moduli other than 2, 3, 4 are refused", [C.setModulus(s, 5), C.setModulus(s, 1)], [null, null]);
  const t = C.setGeometry(s, C.TORUS), t2 = C.setGeometry(C.setModulus(s, 4, rng(1)), C.TORUS);
  equal("the torus has 3 states (even coming from 4), and 2 or 4 are refused there", [t.n, t2.n, C.setModulus(t, 2), C.setModulus(t, 4), C.setModulus(t, 3, rng(2)).n], [3, 3, null, null, 3]);
  const m2 = C.setModulus(s, 2, rng(1));
  equal("with 2 states the board is 0/1 and the ring target is 1s and a 0", [m2.n, m2.values.every((v) => v === 0 || v === 1), m2.target], [2, true, C.RING]);
  equal("the plane keeps its states after the torus is left", C.setGeometry(t, C.PLANE).n, 3);
  equal("a bad geometry, a bad button, nothing to undo", [C.setGeometry(s, 3), C.press(s, 9), C.press(s, -1), C.editTarget(s, 9), C.undo(s)], [null, null, null, null, null]);
  const p = C.press(s, 0);
  equal("a press does not change the old position", [s.stack.length, p.stack.length, p.stack[0]], [0, 1, { cell: 0, hint: false }]);
  const w = { ...s, values: s.target.slice() };
  equal("the board equal to the target is a win", [C.solved(w), C.result(w), C.result(s) === null || C.solved(s)], [true, "win", true]);
  equal("editing a target square goes up by 1 mod N", [C.editTarget({ ...s, n: 3, target: [2, 0, 0, 0, 0, 0, 0, 0, 0] }, 0).target[0], C.editTarget(s, 4).target[4]], [0, 1]);
}

done("merlin");
