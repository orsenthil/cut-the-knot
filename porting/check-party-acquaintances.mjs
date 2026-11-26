#!/usr/bin/env node
"use strict";

/*
 * Logic test for party-acquaintances/party-acquaintances-core.js.
 *
 *   node porting/check-party-acquaintances.mjs
 *
 * 1. The Friendship Theorem, R(3, 3) = 6: every one of the 2^15 = 32,768
 *    colourings of K6 has a one-colour triangle, and (Goodman) at least two;
 *    K5 has colourings with none (the page's round table), exactly 12 of
 *    the 1,024.
 * 2. The page's lower bounds: R(4, 3) > 8 and R(4, 4) > 17 (the Paley
 *    graph) by their usual constructions; for R(5, 3) > 13 the page's 13
 *    people each knowing only the 5th on the left and right do have 5
 *    mutual strangers, so the claim needs each also to know both
 *    neighbours, which works.
 * 3. The page's recursive bounds and the binomial bound, checked against
 *    its table of known values.
 * 4. The applet's drawing: alternating colours, refused lines, the check
 *    for red and blue cliques, Remove last, the ranges.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("party-acquaintances/party-acquaintances-core.js", "PartyAcquaintancesCore");

function pairs(n) { const p = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) p.push([a, b]); return p; }

{
  const P = pairs(6);
  let always = true, goodman = true, minT = 99;
  for (let mask = 0; mask < 1 << 15; mask++) {
    const col = new Map(P.map(([a, b], i) => [`${a}-${b}`, (mask >> i) & 1]));
    const t = C.monoTriangles(6, (a, b) => col.get(a < b ? `${a}-${b}` : `${b}-${a}`));
    minT = Math.min(minT, t);
    if (t < 1) always = false;
    if (t < 2) goodman = false;
  }
  check("all 32,768 colourings of K6 have a one-colour triangle: R(3,3) <= 6", always);
  check("and at least two of them (Goodman)", goodman && minT === 2);
  const Q = pairs(5);
  let free = 0;
  for (let mask = 0; mask < 1 << 10; mask++) {
    const col = new Map(Q.map(([a, b], i) => [`${a}-${b}`, (mask >> i) & 1]));
    if (C.monoTriangles(5, (a, b) => col.get(a < b ? `${a}-${b}` : `${b}-${a}`)) === 0) free++;
  }
  equal("K5 can avoid them: 12 of its 1,024 colourings have none", free, 12);
  // the round table through the applet: neighbours red, others blue
  let s = C.start({ n: 5, autoColor: false });
  for (const [a, b] of pairs(5)) s = C.draw({ ...s, useRed: (b - a) % 5 === 1 || (b - a) % 5 === 4 }, a, b);
  const r = C.check(s);
  check("five at a round table, neighbours acquainted: all 10 lines, no red or blue triangle", r.complete && !r.red.length && !r.blue.length);
}

const noClique = (n, red, k, wantRed) => {
  for (const set of C.combinations(n, k)) {
    let all = true;
    for (let i = 0; i < k && all; i++) for (let j = i + 1; j < k && all; j++) if (red(set[i], set[j]) !== wantRed) all = false;
    if (all) return false;
  }
  return true;
};
{
  const circ = (D) => (a, b) => { const d = Math.abs(a - b) % 13; return D.includes(Math.min(d, 13 - d)); };
  // The page: "each person is acquainted only with the fifth person on his left and the fifth on his right".
  check("the page's 13 at a table (only the 5th left and right) has no 3 acquaintances", noClique(13, circ([5]), 3, true));
  check("but it does have 5 mutual strangers (people 1-5 in a row): the page's example fails", !noClique(13, circ([5]), 5, false));
  check("R(5,3) > 13 holds when each also knows both neighbours: no 3 acquaintances, no 5 strangers", noClique(13, circ([1, 5]), 3, true) && noClique(13, circ([1, 5]), 5, false));
  const d8 = (a, b) => { const d = Math.abs(a - b) % 8; return [1, 4, 7].includes(d); };
  check("R(4,3) > 8: on 8 people, knowing the neighbours and the one opposite: no triangle of acquaintances, no 4 strangers", noClique(8, d8, 3, true) && noClique(8, d8, 4, false));
  const qr = new Set([1, 2, 4, 8, 9, 13, 15, 16]);
  const paley = (a, b) => qr.has(((a - b) % 17 + 17) % 17);
  check("R(4,4) > 17: the Paley graph on 17 has no 4 acquaintances and no 4 strangers", noClique(17, paley, 4, true) && noClique(17, paley, 4, false));
}

{
  const R = { "3,3": 6, "4,3": 9, "5,3": 14, "4,4": 18, "6,3": 18, "7,3": 23, "5,4": 25 };
  const r = (m, n) => (m === 2 ? n : n === 2 ? m : R[`${Math.max(m, n)},${Math.min(m, n)}`]);
  check("R(4,3) <= R(3,3) + R(4,2) - 1 = 9 (both even)", r(3, 3) + r(4, 2) - 1 === 9 && r(4, 3) <= 9);
  check("R(5,3) <= R(4,3) + R(5,2) = 14", r(4, 3) + r(5, 2) === 14 && r(5, 3) <= 14);
  check("every value in the page's table obeys R(m,n) <= R(m-1,n) + R(m,n-1)", Object.keys(R).every((k) => { const [m, n] = k.split(",").map(Number); return r(m, n) <= r(m - 1, n) + r(m, n - 1); }));
  const C2 = (x, y) => { let v = 1; for (let i = 1; i <= y; i++) v = (v * (x - y + i)) / i; return v; };
  check("and R(m,n) <= C(m+n-2, m-1)", Object.keys(R).every((k) => { const [m, n] = k.split(",").map(Number); return r(m, n) <= C2(m + n - 2, m - 1); }));
}

{
  let s = C.start();
  equal("defaults: 6 people, red and blue triangles, Autocolor", `${s.n} ${s.nRed} ${s.nBlue} ${s.autoColor}`, "6 3 3 true");
  s = C.draw(s, 0, 1); s = C.draw(s, 1, 2);
  equal("Autocolor: red, then blue", s.edges.map((e) => (e[2] ? "R" : "B")).join(""), "RB");
  check("the same line twice, or a point to itself, is refused", C.draw(s, 1, 0) === null && C.draw(s, 3, 3) === null);
  let t = C.start({ autoColor: false, useRed: true });
  for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) t = C.draw(t, a, b);
  equal("three red lines 0-1-2 make a red triangle", JSON.stringify(C.check(t).red), "[[0,1,2]]");
  check("the drawing is then finished: no more lines", C.result(t) === "done" && C.draw(t, 3, 4) === null);
  const u = C.removeLast(t);
  check("Remove last takes the third line back and the drawing goes on", u.edges.length === 2 && C.result(u) === null);
  equal("cliques of size up to 5, at most N - 1", `${C.start({ n: 4, nRed: 5 }).nRed} ${C.start({ nBlue: 9 }).nBlue}`, "3 5");
  const before = JSON.stringify(s);
  C.draw(s, 4, 5);
  equal("a line leaves the old position alone", JSON.stringify(s), before);
}

done("party-acquaintances");
