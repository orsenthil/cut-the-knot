#!/usr/bin/env node
"use strict";

/*
 * Logic test for farey/farey-core.js.
 *
 *   node porting/check-farey.mjs
 *
 * For EVERY N the applet offers (2 to 70): the series from the next-term recurrence
 * equals the series by brute force (every fraction in lowest terms, sorted by cross
 * products); the number of terms is 1 + phi(1) + ... + phi(N); (1) m2 n1 - m1 n2 = 1 for
 * every pair of successive terms; (2) the middle of three successive terms is the mediant
 * of the other two; and the reverse direction the page proves by induction: a list built
 * by repeatedly inserting mediants of neighbours whose denominators sum to at most N is
 * exactly F(N). Also the lattice-point picture: the applet's list holds the coprime
 * points, and the triangle from the origin to two successive points has area 1/2.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("farey/farey-core.js", "FareyCore");
const phi = (n) => { let c = 0; for (let k = 1; k <= n; k++) if (C.gcd(n, k) === 1) c++; return c; };

{
  const s = C.start({});
  check("the board opens on N = 5 with lines on and one half on", s.n === 5 && s.lines === true && s.oneHalf === true && s.selected === -1 && C.result(s) === null);
  equal("F(5)", C.farey(5).map((x) => x.join("/")).join(" "), "0/1 1/5 1/4 1/3 2/5 1/2 3/5 2/3 3/4 4/5 1/1");
  check("N runs from 2 to 70", C.move(s, { type: "n", value: 1 }) === null && C.move(s, { type: "n", value: 71 }) === null && C.move(s, { type: "n", value: 70 }).n === 70 && C.move(C.start({ n: 2 }), { type: "step", dir: -1 }) === null && C.move(C.start({ n: 70 }), { type: "step", dir: 1 }) === null);
  check("moving the number resets the selection and counts as exploring", C.move(C.move(s, { type: "select", index: 3 }), { type: "step", dir: 1 }).selected === -1 && C.result(C.move(s, { type: "step", dir: 1 })) === "done");
  check("the old position is untouched", s.n === 5 && s.moves === 0);
  check("a selection outside the series is refused", C.move(s, { type: "select", index: 99 }) === null && C.move(s, { type: "select", index: 10 }).selected === 10);
  const a = C.around(5, 5);
  check("around 1/2 in F(5): neighbours 2/5 and 3/5, both determinants 1, and it is their mediant", a.term.join("/") === "1/2" && a.prev.join("/") === "2/5" && a.next.join("/") === "3/5" && a.detPrev === 1 && a.detNext === 1 && a.isMediant && a.mediantOfNeighbours.join("/") === "5/10");
  check("the ends have only one neighbour", C.around(5, 0).prev === null && C.around(5, 10).next === null);
}

{
  let bad = null, terms = 0;
  for (let n = 2; n <= 70; n++) {
    const f = C.farey(n), b = C.fareyBrute(n);
    if (f.map((x) => x.join("/")).join() !== b.map((x) => x.join("/")).join()) bad = `series differ at N=${n}`;
    let expected = 1; for (let k = 1; k <= n; k++) expected += phi(k);
    if (f.length !== expected) bad = `count ${f.length} != ${expected} at N=${n}`;
    for (let i = 0; i + 1 < f.length; i++) {
      const [m1, n1] = f[i], [m2, n2] = f[i + 1];
      if (m2 * n1 - m1 * n2 !== 1) bad = `det at N=${n}, ${m1}/${n1} ${m2}/${n2}`;
      terms++;
    }
    for (let i = 0; i + 2 < f.length; i++) {
      const [m1, n1] = f[i], [m2, n2] = f[i + 1], [m3, n3] = f[i + 2];
      if ((m1 + m3) * n2 !== m2 * (n1 + n3)) bad = `mediant at N=${n}`;
      // (3), (4) of the page: subtracting the two determinants gives (m3 + m1) n2 = m2 (n3 + n1)
      if ((m3 * n2 - m2 * n3) - (m2 * n1 - m1 * n2) !== 0) bad = `(3) at N=${n}`;
    }
    for (let i = 0; i + 1 < f.length; i++) if (f[i][0] * f[i + 1][1] >= f[i + 1][0] * f[i][1]) bad = `order at N=${n}`;
    if (f[0].join() !== "0,1" || f[f.length - 1].join() !== "1,1" || f[1].join() !== "1," + n) bad = `ends at N=${n}`;
  }
  check(`for every N from 2 to 70 the recurrence equals the brute-force series, has 1 + phi(1) + ... + phi(N) terms, and every successive pair has m2 n1 - m1 n2 = 1 and every successive triple has the mediant property (${terms} pairs)`, bad === null, String(bad));
}

{
  // (2) => (1): build F(N) by inserting mediants between neighbours whose denominators add to at most N
  let bad = null;
  for (let n = 2; n <= 70; n++) {
    let list = [[0, 1], [1, 1]];
    for (let round = 0; round < n + 1; round++) {
      const next = [];
      for (let i = 0; i < list.length; i++) {
        next.push(list[i]);
        if (i + 1 < list.length && list[i][1] + list[i + 1][1] <= n) next.push([list[i][0] + list[i + 1][0], list[i][1] + list[i + 1][1]]);
      }
      if (next.length === list.length) break;
      list = next;
    }
    if (list.map((x) => x.join("/")).join() !== C.farey(n).map((x) => x.join("/")).join()) bad = `mediant construction differs at N=${n}`;
  }
  check("inserting mediants (denominators adding to at most N) between 0/1 and 1/1 builds exactly F(N), for every N up to 70", bad === null, String(bad));
}

{
  // the lattice points the applet draws
  let bad = null;
  for (const n of [2, 5, 20, 70]) {
    const pts = C.points(n);
    const coprime = pts.slice(2);
    if (!coprime.every(([p, q]) => C.gcd(p, q) === 1 && p >= 1 && q >= 1 && p <= n && q <= n)) bad = `points ${n}`;
    let want = 0; for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) if (C.gcd(i, j) === 1) want++;
    if (coprime.length !== want) bad = `count ${n}`;
    if (pts[0].join() !== "1,0" || pts[1].join() !== "1,1") bad = `specials ${n}`;
    // the Farey fractions (p <= q) are the points on or under the diagonal: one per ray, with area 1/2 between neighbours
    const under = coprime.filter(([p, q]) => p <= q).concat([[0, 1]]);
    if (under.length !== C.farey(n).length) bad = `under the diagonal ${n}`;
    const f = C.farey(n);
    for (let i = 0; i + 1 < f.length; i++) {
      const area = Math.abs(f[i][1] * f[i + 1][0] - f[i][0] * f[i + 1][1]) / 2; // triangle (0,0), (q1, p1), (q2, p2)
      if (area !== 0.5) bad = `area ${n}`;
    }
  }
  check("the applet's point list is the coprime points (q, p) with 1 <= p, q <= N, and neighbouring Farey points span a triangle of area 1/2 with the origin", bad === null, String(bad));
}

done("farey");
